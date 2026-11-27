# Planejamento: Achei Minha Photo como SaaS

> Documento vivo. Atualize conforme as decisões forem tomadas.
> Última revisão: novembro de 2026.

## 1. A visão em uma frase

Uma plataforma onde **qualquer fotógrafo de eventos** cria a própria conta, sobe as fotos, e vende por PIX com o dinheiro caindo **direto na conta dele**. O Achei Minha Photo fica com uma comissão por venda.

### Quem usa

| Pessoa | O que quer |
|---|---|
| **Fotógrafo** (cliente do SaaS) | Subir milhares de fotos rápido, vender sem complicação, receber o dinheiro |
| **Comprador** (atleta, participante) | Achar as próprias fotos entre milhares, pagar por PIX, baixar na hora |
| **Você** (dono da plataforma) | Ver todos os fotógrafos, vendas e comissões; bloquear abuso |

### O que muda em relação a hoje

| Hoje | No SaaS |
|---|---|
| Um fotógrafo só, login Basic Auth | Cadastro de fotógrafos com Supabase Auth |
| Tabelas sem "dono" | Todo evento, foto e pedido pertence a uma **organização** |
| RLS simples (público x service role) | RLS isolando os dados de cada organização |
| PIX cai numa conta só | **Split**: parte para o fotógrafo, parte para a plataforma |
| URL `/e/[slug]` | URL `/[org]/[evento]` (slug do evento único só dentro da organização) |

---

## 2. Conceito central: multi-tenant

**Tenant** ("inquilino") é cada cliente do SaaS. Aqui, cada fotógrafo ou estúdio é uma **organização**.

Existem três jeitos comuns de separar os dados:

1. Um banco por cliente: isolamento máximo, mas caro e difícil de manter.
2. Um schema por cliente: meio-termo, mas complica as migrações.
3. **Mesmo banco e mesmas tabelas, com uma coluna `org_id` em tudo, e o RLS filtrando.** ✅

A opção 3 é o padrão para SaaS pequeno e médio, e é o ponto forte do Supabase. O RLS garante, **dentro do banco**, que o fotógrafo A nunca enxerga os dados do fotógrafo B, mesmo que exista um bug no código do Next.js.

### Por que "organização" e não "usuário"

Começar com `events.user_id` é mais simples, mas um estúdio costuma ter mais de uma pessoa: o fotógrafo, um assistente que sobe as fotos, um sócio. Se tudo pertencer a um usuário, mudar isso depois exige migrar todos os dados.

**Decisão:** criar `organizations` e `memberships` desde já. No MVP, cada organização tem só um membro (o dono), mas a estrutura já está pronta para equipes.

---

## 3. Modelo de dados (rascunho)

```
auth.users (Supabase)
    │ 1:N
memberships ── N:1 ── organizations ──1:N── events ──1:N── photos
 (role)                 (plano, conta        │
                         de recebimento)     └──1:N── orders ──1:N── order_items
```

### Tabelas novas

```sql
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,              -- usado na URL: /joao-fotos/corrida-2026
  plan text not null default 'free',      -- free | pro | ...
  commission_rate numeric(5,4) not null default 0.10,  -- 10% para a plataforma
  payout_account_id text,                 -- id da conta/subconta no gateway de pagamento
  payout_status text not null default 'pending', -- pending | active | blocked
  created_at timestamptz default now()
);

create table memberships (
  org_id uuid references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','member')),
  primary key (org_id, user_id)
);
```

### Mudanças nas tabelas atuais

```sql
alter table events add column org_id uuid references organizations(id) not null;
-- o slug do evento passa a ser único só dentro da organização
alter table events drop constraint events_slug_key;
alter table events add constraint events_org_slug_key unique (org_id, slug);

-- org_id repetido em photos e orders: deixa o RLS simples e rápido
-- (sem precisar fazer join com events em toda consulta)
alter table photos add column org_id uuid references organizations(id) not null;
alter table orders add column org_id uuid references organizations(id) not null;
alter table orders add column platform_fee numeric(10,2);  -- comissão gravada no momento da venda
```

> **Migração dos dados atuais:** criar uma organização "Achei Minha Photo" e preencher o `org_id` de todos os eventos, fotos e pedidos existentes com ela, **antes** de aplicar o `not null`.

### RLS: o coração da segurança

```sql
-- Schema "private": não é exposto pela API do Supabase, então ninguém
-- consegue chamar estas funções por /rest/v1/rpc.
create schema if not exists private;

-- Função auxiliar: o usuário logado é membro desta organização?
-- SECURITY DEFINER é necessário porque a própria tabela memberships tem RLS;
-- por isso ela fica no schema private, confere auth.uid() por dentro
-- e usa search_path vazio (todos os nomes com schema explícito).
create function private.is_org_member(org uuid) returns boolean
language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = org and m.user_id = (select auth.uid())
  );
$$;

-- Fotógrafo gerencia só os eventos da própria organização.
-- "(select ...)" faz o Postgres calcular uma vez por consulta, não uma vez por linha.
create policy "membros gerenciam eventos" on public.events
  for all to authenticated
  using ((select private.is_org_member(org_id)))
  with check ((select private.is_org_member(org_id)));  -- impede mover o evento para outra org

-- Comprador (anônimo) continua vendo eventos ativos
create policy "público vê eventos ativos" on public.events
  for select to anon, authenticated using (is_active = true);

-- Pedidos: o fotógrafo vê os da organização dele; o público não vê nada
create policy "membros veem pedidos" on public.orders
  for select to authenticated using ((select private.is_org_member(org_id)));

-- Índices nas colunas usadas pelo RLS (sem eles, cada consulta varre a tabela)
create index on public.memberships (user_id, org_id);
create index on public.events (org_id);
create index on public.photos (org_id);
create index on public.orders (org_id);
```

> Regras tiradas da skill oficial `supabase/agent-skills` (veja a seção 9):
> - Policy de UPDATE e de ALL sempre com `USING` **e** `WITH CHECK`.
> - Sempre dizer o papel com `to authenticated` / `to anon`.
> - Nunca usar `SECURITY DEFINER` para "resolver" um erro de permissão.
> - Depois de cada migração, rodar os *advisors* de segurança do Supabase.

**Regra de ouro:** depois do SaaS, o painel do fotógrafo **não usa mais a `service_role`**. Ele usa o cliente com a sessão do usuário logado, e o RLS faz o isolamento. A `service_role` fica só para o webhook, o checkout e a entrega, que não têm usuário logado.

### Storage

Caminho dos arquivos: `originais/{org_id}/{event_id}/{uuid}.jpg`. O primeiro pedaço do caminho é a organização, o que permite escrever políticas de Storage como "só membros da organização X podem enviar arquivos para a pasta X".

---

## 4. Pagamentos: o ponto mais delicado

### Exemplo usado nesta seção

Na **Corrida do Rio 2026**, a atleta Ana compra **12 fotos** do fotógrafo **João**. Como passou de 10 fotos, vale o preço do pacote: R$ 8,00 por foto. **Total: R$ 96,00.**

### Hoje (Fase 0): uma conta só

O código atual usa **uma única conta EFI**, a do `.env` (`EFI_CLIENT_ID` e `EFI_PIX_KEY`).

```
Ana paga R$ 96,00 no PIX
        │
        ▼
Conta EFI do Achei Minha Photo  ← recebe tudo
        │
        ▼  (manual)
Repasse da parte do João
```

Se o fotógrafo é o próprio dono da plataforma, isso é perfeito. Com outros fotógrafos, serve só para testar com um ou dois parceiros de confiança.

### O problema

Se todo o dinheiro cair na conta do Achei Minha Photo e você repassar depois aos fotógrafos, você vira um **intermediador financeiro**. Isso traz responsabilidade fiscal (o dinheiro entra como faturamento seu), risco de chargeback e trabalho manual de repasse. Não é o caminho para um projeto começando.

### A solução: split de pagamento

O gateway divide o PIX no momento do pagamento: por exemplo, 90% vai direto para a conta do fotógrafo e 10% para a plataforma. Você nunca segura o dinheiro de terceiros.

```
Ana paga R$ 96,00 no PIX
        │
        ▼
   Gateway (Asaas / EFI)
        │  divide na hora
   ┌────┴─────────────┐
   ▼                  ▼
Conta do João     Conta do Achei Minha Photo
R$ 86,40 (90%)    R$ 9,60 (10% de comissão)
```

| | Valor |
|---|---|
| Ana paga | R$ 96,00 |
| Comissão da plataforma (10%) | R$ 9,60 → conta da plataforma |
| Parte do fotógrafo (90%) | R$ 86,40 → conta do João |
| Taxa do gateway pelo PIX | descontada do fotógrafo **ou** absorvida pela plataforma (decisão em aberto) |

### Como o fotógrafo cria a conta de recebimento (modelo de subcontas, ex.: Asaas)

1. João se cadastra no Achei Minha Photo.
2. No painel, em **"Configure seus recebimentos"**, ele informa nome, CPF/CNPJ e dados bancários.
3. O sistema chama a API do gateway: "criar subconta para o João".
4. O gateway verifica os documentos (o KYC fica com ele, não com a plataforma).
5. O gateway devolve o id da carteira, que é guardado em `organizations.payout_account_id`.
6. Com `payout_status = 'active'`, o João pode publicar eventos.

Na EFI, cada fotógrafo precisa abrir a **própria conta EFI** e vinculá-la à plataforma: funciona, mas o cadastro dá mais trabalho para ele.

### No código

Hoje o checkout chama `createPixCharge(order.id, 96.00)`. Com o split, ele passa a dizer para quem vai cada parte:

```ts
createPixCharge(order.id, 96.00, {
  split: [{ conta: org.payout_account_id, percentual: 90 }]
  // o restante (10%) fica na conta da plataforma
})
```

Cada pedido grava `platform_fee` (ex.: 9.60). Assim, o fotógrafo vê no painel "vendi R$ 96, recebi R$ 86,40" e a plataforma soma as comissões do mês.

### Resumo

| | Hoje (Fase 0) | SaaS (Fase 2) |
|---|---|---|
| Para onde vai o dinheiro | Tudo para a conta da plataforma | Dividido na hora: fotógrafo e plataforma |
| Repasse ao fotógrafo | Manual | Automático, pelo gateway |
| Imposto da plataforma sobre | O valor total | Só a comissão |
| Nota fiscal | A plataforma, do total | O fotógrafo da venda, a plataforma da comissão |
| Conta do fotógrafo | Não precisa | Subconta (Asaas) ou conta própria (EFI) |

### Comparando os gateways

| Opção | Como funciona | Observação |
|---|---|---|
| **EFI Pay** (já usado) | Split de PIX entre contas EFI | Cada fotógrafo precisa ter conta na EFI |
| **Asaas** | Cria **subcontas** por API para cada fotógrafo, com split nativo | Cadastro do fotógrafo pode ser feito dentro da sua plataforma |
| **Mercado Pago** | Modelo marketplace (o fotógrafo conecta a conta dele via OAuth) | Muito conhecido pelos usuários |

**Recomendação:** antes de decidir, criar uma conta sandbox em **Asaas** e **EFI** e testar o split dos dois. Compare taxas, facilidade de cadastrar o fotógrafo e a documentação. Em qualquer caso, manter o gateway **isolado em `lib/payments/`**, atrás de uma interface:

```ts
interface PaymentProvider {
  createRecipient(org): Promise<{ accountId: string }>   // cadastra o fotógrafo
  createPixCharge(order, split): Promise<PixCharge>      // cobra com divisão
  verifyWebhook(req): Promise<PaymentEvent | null>       // valida e interpreta o webhook
}
```

Assim, trocar de gateway no futuro significa escrever uma nova implementação, sem mexer no checkout.

> ⚠️ Antes de lançar o SaaS, confirmar com um contador como emitir a nota fiscal da comissão e qual regime faz sentido (MEI, Simples). Cada fotógrafo é responsável pela nota da própria venda.

---

## 5. Modelo de negócio

| Modelo | Prós | Contras |
|---|---|---|
| **Só comissão por venda** (ex.: 10–15%) | Fotógrafo só paga se vender; fácil de convencer | Receita imprevisível |
| **Só assinatura mensal** | Receita previsível | Barreira de entrada para quem está começando |
| **Híbrido**: grátis com comissão maior, Pro com assinatura e comissão menor | Atrai iniciantes e retém quem vende muito | Um pouco mais complexo |

**Recomendação:** lançar **só com comissão** (é o que o split já resolve). Adicionar o plano Pro depois que houver fotógrafos vendendo de verdade e dados para definir o preço.

### Custo que precisa entrar na conta: armazenamento

Uma corrida com 3.000 fotos de cerca de 8 MB ocupa uns **24 GB só de originais**. Com dezenas de eventos, o Storage vira o maior custo. Precisa haver:
- **Política de retenção**: por exemplo, originais apagados X dias depois do evento (com aviso ao fotógrafo).
- **Limite por plano**: GB ou número de fotos ativas.
- Acompanhamento do uso por organização (uma view somando o tamanho dos arquivos).

---

## 6. Diferencial: como o comprador acha as fotos dele

Numa corrida com 3.000 fotos, rolar uma galeria não funciona. É aqui que uma plataforma ganha ou perde.

1. **Busca por número de peito** (OCR): lê o número no peito do atleta e indexa. Muito útil em corridas.
2. **Busca por selfie** (reconhecimento facial): o comprador tira uma selfie e vê só as fotos dele.
3. **Filtros simples**: por horário ou por ponto do percurso (pasta "largada", "km 5", "chegada").

> ⚠️ **LGPD:** reconhecimento facial trata **dado biométrico, que é dado pessoal sensível**. Exige consentimento claro do comprador, finalidade explícita e política de exclusão. Comece pelo número de peito e pelos filtros.

---

## 7. Fases do projeto

Cada fase termina com algo **funcionando e testado**. Não começar a próxima sem fechar a anterior.

### Fase 0: Produto real com um fotógrafo *(próxima)*
- [x] Correções de segurança (webhook, checkout, upload direto)
- [x] Integração PIX real com a EFI: código pronto e testado contra uma EFI falsa local
- [ ] Testar no sandbox da EFI (com credenciais reais de homologação)
- [ ] Deploy na Vercel
- [ ] Vender as fotos de **um evento real**

**Pronto quando:** um comprador desconhecido pagou e baixou as fotos sem ajuda.

### Fase 1: Base multi-tenant
- [ ] Supabase Auth (e-mail e senha) com `@supabase/ssr`, substituindo o Basic Auth
- [ ] Tabelas `organizations` e `memberships` e migração dos dados atuais
- [ ] `org_id` em events, photos e orders, com as políticas de RLS
- [ ] Telas: cadastro, login, "criar minha organização", painel filtrado pela organização
- [ ] URL pública `/[org]/[evento]` (com redirect da antiga `/e/[slug]`)
- [ ] **Testes de isolamento:** o usuário A tenta ler e alterar dados de B e o banco recusa

**Pronto quando:** dois fotógrafos de teste usam o sistema ao mesmo tempo e nenhum vê nada do outro.

### Fase 2: Pagamento com split
- [ ] Escolher o gateway (seção 4) e implementar `PaymentProvider`
- [ ] Onboarding de recebimento: o fotógrafo cadastra os dados dele e a conta fica `active`
- [ ] Bloquear a publicação de eventos enquanto `payout_status != 'active'`
- [ ] Gravar `platform_fee` em cada pedido; painel de vendas e comissões

**Pronto quando:** uma venda de teste divide o dinheiro certo entre o fotógrafo e a plataforma.

### Fase 3: Painel da plataforma e limites
- [ ] Área de super admin: lista de organizações, vendas, bloquear conta
- [ ] Uso de armazenamento por organização e política de retenção
- [ ] Entrega por e-mail (Resend ou similar) e download em ZIP

### Fase 4: Diferenciais
- [ ] Busca por número de peito
- [ ] Planos pagos (assinatura)
- [ ] Domínio próprio ou subdomínio por fotógrafo (`joao.acheiminhaphoto.com.br`)

---

## 8. Riscos e como reduzir

| Risco | Mitigação |
|---|---|
| Vazamento de dados entre fotógrafos | RLS em todas as tabelas e testes automatizados de isolamento |
| Chave `service_role` usada onde não devia | `server-only` (já feito); painel usando a sessão do usuário |
| Custo de Storage crescer mais que a receita | Retenção, limites por plano, prévias pequenas (já em 1600 px) |
| Concorrência (Fotop, Banlek e outras) | Foco num nicho primeiro (ex.: corridas de rua da região) e atendimento próximo |
| Construir demais antes de validar | Fase 0 com evento real **antes** da Fase 1 |

---

## 9. Skills de IA que ajudam neste projeto

Skills oficiais avaliadas (do ecossistema [skills.sh](https://skills.sh/)):

| Skill | De quem | Para qual fase |
|---|---|---|
| `supabase` | Supabase | Fase 1: Auth com `@supabase/ssr` no Next.js, RLS, Storage, CLI e migrações |
| `supabase-postgres-best-practices` | Supabase | Fases 1 a 3: modelagem, índices, RLS rápido e testes de RLS |
| `react-best-practices` | Vercel | Todas: performance de React e Next.js |
| `deploy-to-vercel` | Vercel | Fase 0: colocar o site no ar |
| `web-design-guidelines` | Vercel | Fase 1: revisar as telas novas (acessibilidade e UX) |

Instalar no seu computador:

```bash
npx skills add supabase/agent-skills
```

```bash
npx skills add vercel-labs/agent-skills
```

## 10. Decisões em aberto

- [ ] **Gateway de split:** EFI ou Asaas? (testar os dois no sandbox)
- [ ] **Comissão inicial:** 10%? 15%?
- [ ] **Taxa do PIX:** descontada do fotógrafo ou absorvida pela plataforma?
- [ ] **Nicho de lançamento:** só esportes ou também festas e formaturas?
- [ ] **Retenção dos originais:** 30, 60 ou 90 dias?
- [ ] **Nome e domínio** definitivos da plataforma
