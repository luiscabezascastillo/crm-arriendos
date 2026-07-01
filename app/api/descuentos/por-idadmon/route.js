import { createClient } from '@supabase/supabase-js'

// Lectura de los descuentos de un IDADMON (con service role, para no depender
// del RLS de la tabla descuentos). Devuelve num, tipo, imputar-a, mes, montos y
// el texto_para_contabilidad ya precalculado, que es el que Karina copia al BI.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const idadmon = (searchParams.get('idadmon') || '').trim().toUpperCase()
  if (!idadmon) return Response.json({ rows: [] })

  const { data, error } = await supabaseAdmin
    .from('descuentos')
    .select('num, tipo, repercutir_a, mes_a_imputar, monto_a_imputar, monto_a_transferir, texto_para_contabilidad')
    .eq('idadmon', idadmon)
    .order('num', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ rows: data || [] })
}