import { createClient } from '@supabase/supabase-js'

// Cliente SOLO de servidor. Usa la service role key (salta RLS).
// NUNCA importar esto desde un componente cliente.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
)
