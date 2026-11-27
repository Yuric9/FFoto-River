import { createClient } from '@supabase/supabase-js'

// Cliente público (anon key). Pode ser usado no navegador e no servidor.
// O cliente com a service role fica em lib/supabase-admin.ts (só servidor).
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
