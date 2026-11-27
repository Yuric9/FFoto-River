import 'server-only'
import { createClient } from '@supabase/supabase-js'

// Cliente com a service role: ignora o RLS e tem acesso total ao banco.
// O `import 'server-only'` faz o build falhar se este arquivo for
// importado por um componente que roda no navegador.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)
