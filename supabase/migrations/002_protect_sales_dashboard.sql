-- A view sales_dashboard (faturamento por evento) foi criada sem security_invoker.
-- Assim ela rodava com as permissões do dono e ignorava o RLS da tabela orders:
-- qualquer visitante com a anon key (que é pública) conseguia ver o faturamento.
--
-- Correção:
-- 1. security_invoker = on: a view respeita o RLS de quem consulta.
-- 2. Tira o acesso de anon e authenticated. O painel /admin usa a service role e continua funcionando.

alter view public.sales_dashboard set (security_invoker = on);

revoke all on public.sales_dashboard from anon, authenticated;
