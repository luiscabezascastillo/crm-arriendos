// VERSION: v1 · 2026-08-11 · Valoración legal de términos (Legal: Anthony).
//   GET  -> lista los términos SIN valoración legal (estado Q / Q-Auditado / Q-Dicom), con su resultado
//           para dar contexto. POST -> guarda la valoración que escribe Anthony en terminos.valoracion_legal
//           (upsert por idadmon: si el término no tenía fila, la crea; caso A00695).
// Ruta real: app/api/alertas/valoracion-legal/route.js
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

const ROLES_OK = ['legal', 'direccion']
const EXTRA_EMAILS = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com']
const ESTADOS_TERMINO = ['Q', 'Q-Auditado', 'Q-Dicom']

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
}
function autoriza(session) {
  const email = session?.user?.email || ''
  const role = String(session?.user?.role || '').toLowerCase()
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
    sb.from('datos_arriendos').select('idadmon, propietario, inmueble, arrendatario, rut, avalista, termino_actual, estado').in('estado', ESTADOS_TERMINO),
    sb.from('terminos').select('idadmon, valoracion_legal, decision_actuacion'),
    sb.from('vw_termino_resultado').select('idadmon, resultado, quien'),
  ])
  const datos = datosR.data || []
  const tMap = {}; for (const t of (termR.data || [])) tMap[t.idadmon] = t
  const vMap = {}; for (const v of (vtR.data || [])) vMap[v.idadmon] = v

  const pendientes = datos
    .filter(d => vacio(tMap[d.idadmon]?.valoracion_legal))
    .map(d => ({
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
    }))
    // déficit primero (más negativo), luego el resto
    .sort((x, y) => (Number(x.resultado ?? 0) - Number(y.resultado ?? 0)))

  return Response.json({ ok: true, total: pendientes.length, terminos: pendientes })
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const a = autoriza(session)
  if (!a.ok) return Response.json({ error: a.code === 401 ? 'No autenticado' : 'No autorizado' }, { status: a.code })
  let b
  try { b = await req.json() } catch { return Response.json({ error: 'JSON invalido' }, { status: 400 }) }
  const idadmon = String(b?.idadmon || '').trim()
  const valoracion = String(b?.valoracion || '').trim()
  if (!idadmon) return Response.json({ error: 'Falta idadmon' }, { status: 400 })
  if (!valoracion) return Response.json({ error: 'Escribe la valoración legal' }, { status: 400 })

  const fila = { idadmon, valoracion_legal: valoracion }
  const decision = String(b?.decision || '').trim()
  if (decision) fila.decision_actuacion = decision

  const sb = svc()
  const { error } = await sb.from('terminos').upsert(fila, { onConflict: 'idadmon' })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
