// VERSION: v2 · 2026-08-11 · Acceso solo para Karina + Dirección (lista de correos), tanto ver como marcar.
//   No se abre al resto del equipo. Hereda v1.
// VERSION: v1 · 2026-08-11 · Términos del día: GET devuelve 3 términos sin tratar (muy antiguo / del medio /
//   reciente) del backlog; POST {idadmon, decision} los marca tratados (tabla terminos_revision).
//   Universo: datos_arriendos en estados de término (Q/N/N-DICOM/N-Liquidacion) con termino_actual.
// Ruta real: app/api/alertas/terminos-del-dia/route.js
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

// Solo Karina + Dirección (mismo público que la vista de Alertas hoy).
const ALERTAS_EMAILS = ['karina.morales@fondocapital.com', 'alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com']
const MARCAR_OK_EMAILS = ALERTAS_EMAILS
const ESTADOS_TERMINO = ['Q', 'N', 'N-DICOM', 'N-Liquidacion']

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
}

export async function GET() {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!ALERTAS_EMAILS.includes(email)) return Response.json({ error: 'No autorizado' }, { status: 403 })

  const sb = svc()
  const { data: pool, error } = await sb.from('datos_arriendos')
    .select('idadmon, propietario, inmueble, arrendatario, estado, termino_actual')
    .in('estado', ESTADOS_TERMINO)
  if (error) return Response.json({ error: 'datos_arriendos: ' + error.message }, { status: 500 })

  const { data: tratados } = await sb.from('terminos_revision').select('idadmon')
  const setT = new Set((tratados || []).map(t => t.idadmon))

  let pend = (pool || []).filter(p => p.termino_actual && !setT.has(p.idadmon))
  pend.sort((a, b) => String(a.termino_actual).localeCompare(String(b.termino_actual)))  // más antiguo primero
  const n = pend.length

  const pick = []
  if (n > 0) {
    const idxs = n >= 3 ? [0, Math.floor(n / 2), n - 1] : Array.from({ length: n }, (_, i) => i)
    const labels = ['Muy antiguo', 'Del medio', 'Reciente']
    idxs.forEach((ix, k) => pick.push({ ...pend[ix], tramo: n >= 3 ? labels[k] : 'Pendiente' }))
  }

  // déficit (informativo) de los 3 elegidos
  if (pick.length) {
    const { data: vt } = await sb.from('vw_termino_resultado').select('idadmon, resultado').in('idadmon', pick.map(p => p.idadmon))
    const defMap = {}
    for (const v of (vt || [])) defMap[v.idadmon] = v.resultado
    pick.forEach(p => { p.resultado = (defMap[p.idadmon] ?? null) })
  }

  return Response.json({ ok: true, total_pendientes: n, terminos: pick })
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!MARCAR_OK_EMAILS.includes(email)) return Response.json({ error: 'No autorizado' }, { status: 403 })
  let b
  try { b = await req.json() } catch { return Response.json({ error: 'JSON invalido' }, { status: 400 }) }
  const idadmon = String(b?.idadmon || '').trim()
  if (!idadmon) return Response.json({ error: 'Falta idadmon' }, { status: 400 })

  const sb = svc()
  const { error } = await sb.from('terminos_revision').upsert(
    { idadmon, decision: b?.decision || null, tratado_por: email, tratado_at: new Date().toISOString() },
    { onConflict: 'idadmon' }
  )
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
