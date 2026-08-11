// VERSION: v5 · 2026-08-11 · Regla diaria FCR: la alerta trae 3 términos Q sin tratar (excluye balance corrupto):
//   (1) el de MAYOR déficit DUEÑO, (2) el de MAYOR déficit FCR, (3) el MÁS RECIENTE. Reactivada.
//   Hereda v4 (kill switch), v3 (solo Q), v2 (acceso Karina+Dirección), v1 (constancia).
// Ruta real: app/api/alertas/terminos-del-dia/route.js
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

const ALERTAS_EMAILS = ['karina.morales@fondocapital.com', 'alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com']
const MARCAR_OK_EMAILS = ALERTAS_EMAILS

// Interruptor general de la alerta "Términos del día".
const TERMINOS_DEL_DIA_ACTIVO = true
// Balance por encima de esto = dato corrupto (imposible) -> se excluye de la selección.
const BALANCE_CORRUPTO = 1_500_000

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
}
const esFechaReal = (f) => /^\d{4}-\d{2}-\d{2}/.test(String(f || '')) && String(f) < '2099-01-01'

export async function GET() {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!ALERTAS_EMAILS.includes(email)) return Response.json({ error: 'No autorizado' }, { status: 403 })
  if (!TERMINOS_DEL_DIA_ACTIVO) return Response.json({ ok: true, total_pendientes: 0, terminos: [] })

  const sb = svc()
  // Contratos Q + resultado del término + tratados
  const { data: qs } = await sb.from('datos_arriendos')
    .select('idadmon, propietario, inmueble, arrendatario, rut, avalista, termino_actual')
    .eq('estado', 'Q')
  const { data: vt } = await sb.from('vw_termino_resultado').select('idadmon, resultado, balance, quien')
  const { data: tratados } = await sb.from('terminos_revision').select('idadmon')

  const res = {}; for (const v of (vt || [])) res[v.idadmon] = v
  const setT = new Set((tratados || []).map(t => t.idadmon))

  // Universo: Q, sin tratar, con dato de resultado, balance NO corrupto
  const pool = (qs || []).map(q => ({ ...q, ...(res[q.idadmon] || {}) }))
    .filter(q => q.resultado != null && !setT.has(q.idadmon) && Number(q.balance) <= BALANCE_CORRUPTO)

  const esFCR = (q) => /FCR/i.test(String(q.quien || ''))
  const esDueno = (q) => /DUE(Ñ|N)O/i.test(String(q.quien || '')) && !esFCR(q)

  const deficits = pool.filter(q => Number(q.resultado) < 0)
  const dueno = deficits.filter(esDueno).sort((a, b) => a.resultado - b.resultado)   // más negativo primero
  const fcr = deficits.filter(esFCR).sort((a, b) => a.resultado - b.resultado)
  const recientes = pool.filter(q => esFechaReal(q.termino_actual)).sort((a, b) => String(b.termino_actual).localeCompare(String(a.termino_actual)))

  const picks = []; const usados = new Set()
  const add = (q, tramo) => { if (q && !usados.has(q.idadmon)) { usados.add(q.idadmon); picks.push({ ...q, tramo }) } }
  add(dueno[0], 'Mayor déficit DUEÑO')
  add(fcr[0], 'Mayor déficit FCR')
  add(recientes.find(q => !usados.has(q.idadmon)), 'Más reciente')

  return Response.json({
    ok: true,
    total_pendientes: pool.filter(q => Number(q.resultado) < 0).length,
    terminos: picks.map(p => ({
      idadmon: p.idadmon, propietario: p.propietario, inmueble: p.inmueble,
      arrendatario: p.arrendatario, termino_actual: p.termino_actual,
      resultado: p.resultado, quien: p.quien, tramo: p.tramo,
    })),
  })
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
