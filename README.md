# FFOTO RIVER - Plataforma de Venda de Fotos

## PROMPT PARA IA DEV - COPIE E COLE ISSO
```
Você é um Arquiteto Full-Stack Sênior. Sua missão é subir o projeto FFoto River.

STACK: Next.js 14 App Router + Tailwind + Supabase + EFI Pay PIX

PASSO 1 - INSTALAR:
npm install

PASSO 2 - SUPABASE:
1. Crie um projeto no supabase.com chamado ffoto-river
2. No SQL Editor, rode o arquivo supabase/migrations/001_initial.sql
3. Em Storage, crie os buckets 'originais' (privado) e 'provas' (público) - o SQL já tenta criar, mas confirme
4. Copie a URL e ANON_KEY de Project Settings > API
5. Rode: npx supabase login && npx supabase link --project-ref SEU_ID
6. Deploy da função: npx supabase functions deploy process-photo --no-verify-jwt

PASSO 3 - ENV:
Copie .env.example para .env.local e preencha com as chaves do Supabase e EFI Pay

PASSO 4 - RODAR:
npm run dev

O projeto já tem:
- Galeria pública /e/[slug] com marca d'água CSS
- Checkout minimalista
- Webhook de PIX em /api/webhooks/efi
- Painel admin básico em /admin
- Edge Function para gerar preview com marca d'água

Não precisa implementar pagamento fake, use a lógica real da EFI Pay conforme lib/payments.ts
```

## Fluxo
Cliente: /e/[slug] -> seleciona fotos -> /checkout -> gera PIX -> webhook confirma -> /entrega/[token]

## Marca
Nome: FFoto River
Cores: #0A0A0A fundo, #C6FF00 accent, #FFFFFF
Logo em /public/logo.png (transparente)