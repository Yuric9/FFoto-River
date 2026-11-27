# Planejamento: FFoto River como SaaS

> Documento vivo. Atualize conforme as decisões forem tomadas.
> Última revisão: novembro de 2026.

## 1. A visão em uma frase

Uma plataforma onde **qualquer fotógrafo de eventos** cria a própria conta, sobe as fotos, e vende por PIX com o dinheiro caindo **direto na conta dele**. A FFoto River fica com uma comissão por venda.

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

> **Migração dos dados atuais:** criar uma organização "FFoto River" e preencher o `org_id` de todos os eventos, fotos e pedidos existentes com ela, **antes** de aplicar o `not null`.

### RLS: o coração da segurança

```sql
-- Função auxiliar: o usuário logado é membro desta organização?
create function is_org_member(org uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from memberships
    where org_id = org and user_id = auth.uid()
  );
$$;

-- Fotógrafo gerencia só os eventos da própria organização
create policy "membros gerenciam eventos" on events
  for all using (is_org_member(org_id)) with check (is_org_member(org_id));

-- Comprador (anônimo) continua vendo eventos ativos
create policy "público vê eventos ativos" on events
  for select using (is_active = true);

-- Pedidos: o fotógrafo vê os da organização dele; o público não vê nada
create policy "membros veem pedidos" on orders
  for select using (is_org_member(org_id));
```

**Regra de ouro:** depois do SaaS, o painel do fotógrafo **não usa mais a `service_role`**. Ele usa o cliente com a sessão do usuário logado, e o RLS faz o isolamento. A `service_role` fica só para o webhook, o checkout e a entrega, que não têm usuário logado.

### Storage

Caminho dos arquivos: `originais/{org_id}/{event_id}/{uuid}.jpg`. O primeiro pedaço do caminho é a organização, o que permite escrever políticas de Storage como "só membros da organização X podem enviar arquivos para a pasta X".

---

## 4. Pagamentos: o ponto mais delicado

### O problema

Se todo o dinheiro cair na conta da FFoto River e você repassar depois aos fotógrafos, você vira um **intermediador financeiro**. Isso traz responsabilidade fiscal (o dinheiro entra como faturamento seu), risco de chargeback e trabalho manual de repasse. Não é o caminho para um projeto começando.

### A solução: split de pagamento

O gateway divide o PIX no momento do pagamento: por exemplo, 90% vai direto para a conta do fotógrafo e 10% para a plataforma. Você nunca segura o dinheiro de terceiros.

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

> ⚠️ Confirmar com um contador como emitir nota fiscal da comissão. Cada fotógrafo é responsável pela nota da própria venda.

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
- [ ] Integração PIX real com a EFI (sandbox → produção)
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
- [ ] Domínio próprio ou subdomínio por fotógrafo (`joao.ffotoriver.com`)

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

## 9. Decisões em aberto

- [ ] **Gateway de split:** EFI ou Asaas? (testar os dois no sandbox)
- [ ] **Comissão inicial:** 10%? 15%?
- [ ] **Nicho de lançamento:** só esportes ou também festas e formaturas?
- [ ] **Retenção dos originais:** 30, 60 ou 90 dias?
- [ ] **Nome e domínio** definitivos da plataforma
