// VERSION: v1 · 2026-08-19 · GET pendiente de clasificar: lineas en el puente 1104-98 por comprobante/origen del año.
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const PUENTE = '1104-98'

export async function GET(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const anio = searchParams.get('anio') || String(new Date().getFullYear())

  const { data: comps, error: eC } = await admin
    .from('contab_comprobantes')
    .select('id, origen, periodo, fecha, orden, glosa, ccb')
    .like('periodo', `${anio}-%`)
  if (eC) return Response.json({ error: eC.message }, { status: 500 })
  if (!comps || !comps.length) return Response.json({ ok: true, anio, items: [] })

  const byId = {}
  for (const c of comps) byId[c.id] = c
  const ids = comps.map(c => c.id)

  const puente = []
  for (let i = 0; i < ids.length; i += 300) {
    const trozo = ids.slice(i, i + 300)
    const { data: ls, error: eL } = await admin
      .from('contab_lineas')
      .select('comprobante_id, debe, haber')
      .eq('cuenta', PUENTE)
      .in('comprobante_id', trozo)
    if (eL) return Response.json({ error: eL.message }, { status: 500 })
    for (const l of (ls || [])) puente.push(l)
  }

  const items = puente.map(l => {
    const c = byId[l.comprobante_id] || {}
    return {
      origen: c.origen, periodo: c.periodo, fecha: c.fecha, orden: c.orden,
      glosa: c.glosa, ccb: c.ccb,
      monto: (Number(l.debe) || 0) + (Number(l.haber) || 0),
    }
  }).sort((a, b) => (a.origen === b.origen
      ? (String(a.periodo) < String(b.periodo) ? -1 : 1)
      : (String(a.origen) < String(b.origen) ? -1 : 1)))

  return Response.json({ ok: true, anio, items })
}
