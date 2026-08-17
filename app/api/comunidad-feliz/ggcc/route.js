// VERSION: v1 · 2026-08-17 · GET de ggcc_agua_luz para el visor "Ver GGCC cargado" de /op/comunidad-feliz.
//   Filtra por mes: acepta ?aamm=YYMM (p.ej. 2608) y/o ?mes=YYYY-MM (p.ej. 2026-08). Solo lectura.
//   Usa service-role (como el resto del circuito CF). Ruta: app/api/comunidad-feliz/ggcc/route.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const aamm = String(searchParams.get('aamm') || '').trim()
  const mes = String(searchParams.get('mes') || '').trim()
  if (!aamm && !mes) return Response.json({ error: 'Falta el mes (aamm o mes).' }, { status: 400 })

  let q = supabase
    .from('ggcc_agua_luz')
    .select('idadmon, idinmue, estado, deuda_gastos_comunes, fecha_hecho_ggcc, mes, aamm')
  // Preferimos aamm (columna estable YYMM); si no viene, caemos a mes (YYYY-MM).
  q = aamm ? q.eq('aamm', aamm) : q.eq('mes', mes)
  q = q.order('idadmon', { ascending: true })

  const { data, error } = await q
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ filas: data || [] })
}
