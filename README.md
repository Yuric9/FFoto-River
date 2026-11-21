# FFoto River

Plataforma para fotógrafos venderem fotos online. O cliente vê as fotos com marca d'água, escolhe as que quer, paga por **PIX** no próprio site e recebe o link para baixar as originais.

> Projeto de estudo em desenvolvimento. Ainda não está publicado em produção.

## O que o sistema faz

- **Galeria pública** de cada evento em `/e/[slug]`, com marca d'água nas prévias
- **Checkout simples** com geração de cobrança PIX (EFI Pay)
- **Confirmação automática** do pagamento por webhook (`/api/webhooks/efi`)
- **Entrega das fotos originais** por link individual (`/entrega/[token]`) depois que o pagamento é confirmado
- **Painel de administração** em `/admin`, protegido por login simples
- **Geração das prévias** com marca d'água em uma Edge Function do Supabase (`process-photo`)

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
4. Publique a função de geração de prévias:
   ```bash
   npx supabase login
   npx supabase link --project-ref SEU_ID
   npx supabase functions deploy process-photo --no-verify-jwt
   ```
5. Rode o projeto:
   ```bash
   npm run dev
   ```

Nunca envie o arquivo `.env.local` nem os certificados da EFI Pay para o GitHub.

## Estrutura

```
app/          páginas e rotas de API (galeria, checkout, entrega, admin, webhook)
lib/          integração com Supabase e com a EFI Pay
supabase/     migração do banco e Edge Function
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
