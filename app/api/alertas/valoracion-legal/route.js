// VERSION: v2 · 2026-08-11 · Valoración legal en DOS vertientes (Legal: Anthony):
//   (1) NOTIFICACIÓN del término (sobre estado Q, ANTES de auditar): cuándo/cómo se notificó, si cumple
//       el contrato -> veredicto CUMPLE/NO CUMPLE (terminos.notif_cumple + notif_valoracion).
//   (2) RESULTADO del término (sobre Q-Auditado, DESPUÉS de la auditoría de Karina): terminos.valoracion_legal.
//   GET devuelve las dos listas; POST enruta por tipo ('notificacion' | 'resultado').
// Ruta real: app/api/alertas/valoracion-legal/route.js
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

const ROLES_OK = ['legal', 'direccion']
const EXTRA_EMAILS = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com']
const ROL_ALIAS = { admin: 'direccion', operaciones: 'administracion', tecnico: 'mantencion' }
const normRol = (r) => ROL_ALIAS[String(r || '').toLowerCase()] || String(r || '').toLowerCase()
const ESTADOS_NOTIF = ['SQ', 'Q']                 // vertiente 1: notificación (antes de auditar)
const ESTADOS_RESULTADO = ['Q-Auditado', 'Q-Dicom'] // vertiente 2: resultado (tras auditoría de Karina)

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
}
function autoriza(session) {
  const email = session?.user?.email || ''
  const role = normRol(session?.user?.role)
  if (!email) return { ok: false, code: 401 }
  if (ROLES_OK.includes(role) || EXTRA_EMAILS.includes(email)) return { ok: true, email }
  return { ok: false, code: 403 }
}
const vacio = (v) => v == null || String(v).trim() === ''

export async function GET() {
  const session = await getServerSession(authOptions)
  const a = autoriza(session)
  if (!a.ok) return Response.json({ error: a.code === 401 ? 'No autenticado' : 'No autorizado' }, { status: a.code })

  const sb = svc()
  const [datosR, termR, vtR] = await Promise.all([
    sb.from('datos_arriendos').select('idadmon, propietario, inmueble, arrendatario, rut, avalista, termino_actual, estado').in('estado', [...ESTADOS_NOTIF, ...ESTADOS_RESULTADO]),
    sb.from('terminos').select('idadmon, valoracion_legal, decision_actuacion, notif_cumple, notif_valoracion'),
    sb.from('vw_termino_resultado').select('idadmon, resultado, quien'),
  ])
  const datos = datosR.data || []
  const tMap = {}; for (const t of (termR.data || [])) tMap[t.idadmon] = t
  const vMap = {}; for (const v of (vtR.data || [])) vMap[v.idadmon] = v

  const base = (d) => ({
    idadmon: d.idadmon,
    propietario: d.propietario || '',
    inmueble: d.inmueble || '',
    arrendatario: d.arrendatario || '',
    arrendatario_rut: d.rut || '',
    avalista: d.avalista || '',
    termino_actual: d.termino_actual || '',
    estado: d.estado || '',
    resultado: vMap[d.idadmon]?.resultado ?? null,
    quien: vMap[d.idadmon]?.quien ?? null,
  })

  // Vertiente 1: notificación pendiente (estado Q/SQ y sin veredicto de notificación)
  const notificacion = datos
    .filter(d => ESTADOS_NOTIF.includes(d.estado) && vacio(tMap[d.idadmon]?.notif_cumple))
    .map(base)
    .sort((x, y) => (Number(x.resultado ?? 0) - Number(y.resultado ?? 0)))

  // Vertiente 2: resultado pendiente (estado Q-Auditado/Q-Dicom y sin valoración de resultado)
  const resultado = datos
    .filter(d => ESTADOS_RESULTADO.includes(d.estado) && vacio(tMap[d.idadmon]?.valoracion_legal))
    .map(base)
    .sort((x, y) => (Number(x.resultado ?? 0) - Number(y.resultado ?? 0)))

  return Response.json({
    ok: true,
    total: notificacion.length + resultado.length,
    total_notificacion: notificacion.length,
    total_resultado: resultado.length,
    notificacion,
    resultado,
  })
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const a = autoriza(session)
  if (!a.ok) return Response.json({ error: a.code === 401 ? 'No autenticado' : 'No autorizado' }, { status: a.code })
  let b
  try { b = await req.json() } catch { return Response.json({ error: 'JSON invalido' }, { status: 400 }) }
  const idadmon = String(b?.idadmon || '').trim()
  const tipo = String(b?.tipo || 'notificacion').trim()
  if (!idadmon) return Response.json({ error: 'Falta idadmon' }, { status: 400 })

  let fila
  if (tipo === 'notificacion') {
    const cumple = String(b?.cumple || '').trim().toUpperCase()
    const valoracion = String(b?.valoracion || '').trim()
    if (!['CUMPLE', 'NO CUMPLE'].includes(cumple)) return Response.json({ error: 'Indica CUMPLE o NO CUMPLE' }, { status: 400 })
    if (!valoracion) return Response.json({ error: 'Escribe la valoración de la notificación' }, { status: 400 })
    fila = { idadmon, notif_cumple: cumple, notif_valoracion: valoracion, notif_por: a.email, notif_at: new Date().toISOString() }
  } else if (tipo === 'resultado') {
    const valoracion = String(b?.valoracion || '').trim()
    if (!valoracion) return Response.json({ error: 'Escribe la valoración legal del resultado' }, { status: 400 })
    fila = { idadmon, valoracion_legal: valoracion }
    const decision = String(b?.decision || '').trim()
    if (decision) fila.decision_actuacion = decision
  } else {
    return Response.json({ error: 'Tipo no válido' }, { status: 400 })
  }

  const sb = svc()
  const { error } = await sb.from('terminos').upsert(fila, { onConflict: 'idadmon' })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
