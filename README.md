# FFoto River

Plataforma para fotógrafos venderem fotos online. O cliente vê as fotos com marca d'água, escolhe as que quer, paga por **PIX** no próprio site e recebe o link para baixar as originais.

> Projeto de estudo em desenvolvimento. Ainda não está publicado em produção.

## O que o sistema faz

- **Galeria pública** de cada evento em `/e/[slug]`, com marca d'água nas prévias
- **Checkout simples** com geração de cobrança PIX (EFI Pay)
- **Confirmação automática** do pagamento por webhook (`/api/webhooks/efi`)
- **Entrega das fotos originais** por link individual (`/entrega/[token]`) depois que o pagamento é confirmado
- **Painel de administração** em `/admin`, protegido por login simples
- **Geração das prévias** com marca d'água no navegador, na hora do upload (as fotos vão direto para o Cloudflare R2)

## Como funciona a compra

```
/e/[slug]  ->  /checkout  ->  gera o PIX  ->  webhook confirma  ->  /entrega/[token]
 escolhe as     dados do       cliente paga     sistema libera       baixa as
 fotos          cliente        no banco         as originais         originais
```

As fotos ficam no **Cloudflare R2**: as originais num bucket **privado** (só saem por link temporário depois do pagamento) e as prévias com marca d'água num bucket público.

## Tecnologias

| Parte | Tecnologia |
|---|---|
| Site e rotas de API | Next.js 14 (App Router) e TypeScript |
| Visual | Tailwind CSS |
| Banco de dados | Supabase (PostgreSQL) |
| Arquivos (fotos) | Cloudflare R2 (compatível com S3) |
| Pagamento | EFI Pay (PIX) |
| Marca d'água | Canvas, no navegador |
| Hospedagem prevista | Vercel |

## Como rodar no seu computador

Você precisa de Node.js 18 ou mais novo, uma conta no Supabase, uma na Cloudflare (R2) e uma conta de desenvolvedor na EFI Pay (o modo sandbox serve para testar).

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Crie um projeto no Supabase e rode, em ordem, os arquivos de `supabase/migrations/` (`001_initial.sql`, depois `002_protect_sales_dashboard.sql`) no SQL Editor.
3. Configure o Cloudflare R2 (veja abaixo). Depois copie `.env.example` para `.env.local` e preencha com as chaves do Supabase, do R2 e da EFI Pay. Troque também `ADMIN_USER` e `ADMIN_PASSWORD`.
4. Rode o projeto:
   ```bash
   npm run dev
   ```

### Fotos no Cloudflare R2

1. No painel da Cloudflare, abra **R2** e crie dois buckets: `ffoto-originais` e `ffoto-provas`.
2. Em `ffoto-provas` > **Settings** > **Public access**, ative o domínio público (`r2.dev`) ou ligue um domínio seu. Coloque esse endereço em `NEXT_PUBLIC_PREVIEWS_BASE_URL`. **Nunca** ative o acesso público no `ffoto-originais`.
3. Nos **dois** buckets, em **Settings** > **CORS policy**, cole a regra abaixo (troque pelo endereço do seu site). Sem ela, o navegador não consegue enviar as fotos:
   ```json
   [
     {
       "AllowedOrigins": ["http://localhost:3000", "https://seu-site.vercel.app"],
       "AllowedMethods": ["PUT", "GET"],
       "AllowedHeaders": ["content-type"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
4. Em **R2** > **Manage API tokens**, crie um token com permissão **Object Read & Write** nesses dois buckets. Copie o *Access Key ID*, o *Secret Access Key* e o endpoint (`https://<account-id>.r2.cloudflarestorage.com`) para o `.env.local`.

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

### Testes

```bash
npm test
```

Os testes ficam em `tests/` e cobrem o cálculo de preço, os links assinados das fotos, a confirmação do pagamento e a segurança do webhook. Eles não usam o Supabase, o R2 nem a EFI de verdade, então rodam sem nenhuma chave configurada. No GitHub, rodam sozinhos a cada push (aba **Actions**).

Nunca envie o arquivo `.env.local` nem os certificados da EFI Pay para o GitHub.

## Estrutura

```
app/          páginas e rotas de API (galeria, checkout, entrega, admin, webhook)
lib/          Supabase (público e admin), R2 (storage.ts, media.ts), EFI Pay (efi.ts, payments.ts), pedidos, preço e marca d'água
components/   tela de pagamento PIX e configuração do webhook
supabase/     migrações do banco (rodar em ordem)
public/       logo e arquivos estáticos
middleware.ts proteção do painel /admin
```

## O que aprendi

- Integrar pagamento por PIX e tratar a confirmação por webhook
- Modelar o banco no Supabase e guardar arquivos no Cloudflare R2, com bucket privado e público e links assinados
- Separar o que o cliente pode ver (prévia) do que só vê depois de pagar (original)

## Próximos passos

- Publicar na Vercel
- Melhorar o painel de administração

## Autor

Yuri Cesar, Trindade, GO. [LinkedIn](https://www.linkedin.com/in/yuri-cesar-dev/) | [GitHub](https://github.com/Yuric9)
