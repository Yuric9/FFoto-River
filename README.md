# FFoto River

Plataforma para fotógrafos venderem fotos online. O cliente vê as fotos com marca d'água, escolhe as que quer, paga por **PIX** no próprio site e recebe o link para baixar as originais.

> Projeto de estudo em desenvolvimento. Ainda não está publicado em produção.

## O que o sistema faz

- **Galeria pública** de cada evento em `/e/[slug]`, com marca d'água nas prévias
- **Checkout simples** com geração de cobrança PIX (EFI Pay)
- **Confirmação automática** do pagamento por webhook (`/api/webhooks/efi`)
- **Entrega das fotos originais** por link individual (`/entrega/[token]`) depois que o pagamento é confirmado
- **Painel de administração** em `/admin`, protegido por login simples
- **Geração das prévias** com marca d'água no navegador, na hora do upload (as fotos vão direto para o Supabase Storage)

## Como funciona a compra

```
/e/[slug]  ->  /checkout  ->  gera o PIX  ->  webhook confirma  ->  /entrega/[token]
 escolhe as     dados do       cliente paga     sistema libera       baixa as
 fotos          cliente        no banco         as originais         originais
```

As fotos originais ficam em um bucket **privado**. Só as prévias com marca d'água ficam em um bucket público.

## Tecnologias

| Parte | Tecnologia |
|---|---|
| Site e rotas de API | Next.js 14 (App Router) e TypeScript |
| Visual | Tailwind CSS |
| Banco de dados e arquivos | Supabase (PostgreSQL e Storage) |
| Pagamento | EFI Pay (PIX) |
| Imagens | sharp |
| Hospedagem prevista | Vercel |

## Como rodar no seu computador

Você precisa de Node.js 18 ou mais novo, uma conta no Supabase e uma conta de desenvolvedor na EFI Pay (o modo sandbox serve para testar).

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Crie um projeto no Supabase e rode o arquivo `supabase/migrations/001_initial.sql` no SQL Editor. Confira em Storage se existem os buckets `originais` (privado) e `provas` (público).
3. Copie `.env.example` para `.env.local` e preencha com as chaves do Supabase e da EFI Pay. Troque também `ADMIN_USER` e `ADMIN_PASSWORD`.
4. Rode o projeto:
   ```bash
   npm run dev
   ```

### PIX com a EFI Pay

Sem as variáveis `EFI_*`, o checkout gera um **PIX simulado** para você testar as telas (em produção ele é bloqueado, a menos que `ALLOW_PIX_MOCK=true`). Para usar o PIX de verdade:

1. Na [EFI](https://sejaefi.com.br), crie uma aplicação com a API PIX ativada, em **homologação** (sandbox) primeiro.
2. Baixe o certificado `.p12` e salve em `certs/homologacao.p12` (a pasta `certs/` não vai para o GitHub).
3. Preencha `EFI_CLIENT_ID`, `EFI_CLIENT_SECRET`, `EFI_PIX_KEY` e deixe `EFI_SANDBOX=true`.
4. Rode `npm run dev` e faça uma compra. A página do PIX consulta a EFI a cada 4 segundos e libera as fotos quando o pagamento é confirmado, mesmo sem webhook.

**Na Vercel**, não existe arquivo local: converta o certificado para base64 e cole em `EFI_CERTIFICATE_BASE64`:

```bash
base64 -w 0 certs/producao.p12
```

(no macOS: `base64 -i certs/producao.p12`)

**Webhook:** depois de publicar, defina `SITE_URL` e `EFI_WEBHOOK_SECRET` (mínimo de 32 caracteres) e clique em **Cadastrar webhook** no `/admin`. A URL cadastrada leva o segredo (`?hmac=...`), e o webhook sempre **consulta a cobrança na EFI** antes de liberar as fotos: ele não confia no que recebe.

**Testar o webhook no modo simulado** (sem EFI), com o pedido criado no checkout:

```bash
curl -X POST "http://localhost:3000/api/webhooks/efi?hmac=SEU_SEGREDO" -H "Content-Type: application/json" -d '{"pix":[{"txid":"TXID_DO_PEDIDO","valor":"10.00"}]}'
```

O `TXID_DO_PEDIDO` é o id do pedido sem os hífens (coluna `pix_txid` da tabela `orders`).

Nunca envie o arquivo `.env.local` nem os certificados da EFI Pay para o GitHub.

## Estrutura

```
app/          páginas e rotas de API (galeria, checkout, entrega, admin, webhook)
lib/          Supabase (público e admin), EFI Pay (efi.ts, payments.ts), pedidos, preço e marca d'água
components/   tela de pagamento PIX e configuração do webhook
supabase/     migração do banco
public/       logo e arquivos estáticos
middleware.ts proteção do painel /admin
```

## O que aprendi

- Integrar pagamento por PIX e tratar a confirmação por webhook
- Modelar banco de dados e arquivos no Supabase, com bucket privado e público
- Separar o que o cliente pode ver (prévia) do que só vê depois de pagar (original)

## Próximos passos

- Publicar na Vercel
- Testes automatizados para o fluxo de pagamento
- Melhorar o painel de administração

## Autor

Yuri Cesar, Trindade, GO. [LinkedIn](https://www.linkedin.com/in/yuri-cesar-dev/) | [GitHub](https://github.com/Yuric9)
