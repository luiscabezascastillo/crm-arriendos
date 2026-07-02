import { createClient } from '@supabase/supabase-js'

// Búsqueda de descuentos para cruzar egresos del BI (con service role, para no
// depender del RLS de descuentos).
//   ?monto=123586  -> descuentos con monto_a_transferir = ese importe (candidatos por importe)
//   ?q=texto        -> búsqueda libre por IDADMON, N° o texto_para_contabilidad
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const CAMPOS = 'num, idadmon, tipo, repercutir_a, mes_a_imputar, monto_a_imputar, monto_a_transferir, texto_para_contabilidad'

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const monto = searchParams.get('monto')
  const q = (searchParams.get('q') || '').trim()

  let query = supabaseAdmin.from('descuentos').select(CAMPOS)

  if (monto != null && monto !== '') {
    const n = Math.round(Number(monto))
    if (!Number.isFinite(n)) return Response.json({ rows: [] })
    query = query.eq('monto_a_transferir', n)
  } else if (q) {
    // sanitizar: quitar caracteres que rompen la sintaxis .or de PostgREST
    const s = q.replace(/[,()%]/g, ' ').trim()
    if (!s) return Response.json({ rows: [] })
    query = query.or(`idadmon.ilike.%${s}%,num.ilike.%${s}%,texto_para_contabilidad.ilike.%${s}%`)
  } else {
    return Response.json({ rows: [] })
  }

  const { data, error } = await query.order('num', { ascending: false }).limit(50)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ rows: data || [] })
}