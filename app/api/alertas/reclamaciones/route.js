// VERSION: v1 · 2026-08-11 · Reclamaciones del día (Administración: Adalis y Fabiola).
//   Rankea las reclamaciones MÁS GRAVES por monto y tiempo, incluye avales, y suma las deudas
//   históricas sostenidas de GGCC/luz/agua/gas (vw_deuda_servicios). Devuelve el TOP N para el
//   piloto de cobranza. Estado "tratado" COMPARTIDO por idadmon (tabla reclamacion_tratado):
//   si Adalis lo trata, a Fabiola también le desaparece.
// Ruta real: app/api/alertas/reclamaciones/route.js
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

// Acceso: Administración + Dirección. Se puede añadir por email en EXTRA_EMAILS si el rol no viaja en la sesión.
const ROLES_OK = ['administracion', 'direccion']
const EXTRA_EMAILS = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com']
const TOP_N = 5
const ACTIVO = true

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
const n = (v) => Number(v || 0)
// Escalera (hint; la gestión real y sus plazos viven en /op/cobranza)
function siguientePaso(dias, soloServicio) {
  if (soloServicio) return 'Reclamar servicios al arrendatario + avisar al propietario'
  if (dias >= 15) return 'Aviso pre-DICOM (arrendatario) + reclamar al aval'
  if (dias >= 10) return 'Reclamar al aval + arrendatario juntos'
  if (dias >= 5) return '1ª reclamación (arrendatario) + avisar al propietario'
  return 'Recordatorio (solo arrendatario)'
}

export async function GET() {
  const session = await getServerSession(authOptions)
  const a = autoriza(session)
  if (!a.ok) return Response.json({ error: a.code === 401 ? 'No autenticado' : 'No autorizado' }, { status: a.code })
  if (!ACTIVO) return Response.json({ ok: true, total: 0, reclamaciones: [] })

  const sb = svc()
  const [casosR, servR, datosR, tratR] = await Promise.all([
    sb.from('cobranza_casos').select('idadmon, tipo, estado, monto_adeudado, dias_mora, propietario, propiedad, arrendatario, arrendatario_rut, aval, aval_rut').neq('estado', 'cerrado'),
    sb.from('vw_deuda_servicios').select('idadmon, meses_con_deuda, deuda_max_mes, deuda_actual, ggcc_actual, luz_actual, agua_actual, gas_actual'),
    sb.from('datos_arriendos').select('idadmon, propietario, inmueble, arrendatario, rut, avalista'),
    sb.from('reclamacion_tratado').select('idadmon'),
  ])
  const casos = casosR.data || []
  const serv = servR.data || []
  const datos = datosR.data || []
  const tratados = new Set((tratR.data || []).map(t => t.idadmon))

  const dMap = {}; for (const d of datos) dMap[d.idadmon] = d
  const sMap = {}; for (const s of serv) sMap[s.idadmon] = s

  // Universo: todo contrato con caso de mora abierto o con deuda de servicios > 0
  const ids = new Set()
  for (const c of casos) ids.add(c.idadmon)
  for (const s of serv) if (n(s.deuda_max_mes) > 0) ids.add(s.idadmon)

  const filas = []
  for (const idadmon of ids) {
    if (tratados.has(idadmon)) continue
    const c = casos.find(x => x.idadmon === idadmon) || null
    const s = sMap[idadmon] || null
    const d = dMap[idadmon] || {}

    const montoArriendo = c ? n(c.monto_adeudado) : 0
    const diasMora = c ? n(c.dias_mora) : 0
    const deudaServ = s ? n(s.deuda_max_mes) : 0
    const mesesServ = s ? n(s.meses_con_deuda) : 0
    const gravedad = montoArriendo + deudaServ
    if (gravedad <= 0) continue

    const antiguedadMeses = Math.max(diasMora / 30, mesesServ)
    const score = gravedad * (1 + antiguedadMeses / 6)   // el tiempo pondera fuerte
    const soloServicio = !c && deudaServ > 0

    filas.push({
      idadmon,
      propietario: (c && c.propietario) || d.propietario || '',
      propiedad: (c && c.propiedad) || d.inmueble || '',
      arrendatario: (c && c.arrendatario) || d.arrendatario || '',
      arrendatario_rut: (c && c.arrendatario_rut) || d.rut || '',
      aval: (c && c.aval) || d.avalista || '',
      aval_rut: (c && c.aval_rut) || '',
      tipo: c ? c.tipo : 'servicios',
      estado_caso: c ? c.estado : null,
      monto_arriendo: montoArriendo,
      dias_mora: diasMora,
      deuda_servicios: deudaServ,
      servicios_detalle: s ? { ggcc: n(s.ggcc_actual), luz: n(s.luz_actual), agua: n(s.agua_actual), gas: n(s.gas_actual) } : null,
      meses_servicio: mesesServ,
      gravedad,
      score,
      siguiente: siguientePaso(diasMora, soloServicio),
      motivo: soloServicio
        ? `Servicios ${mesesServ} mes(es)`
        : (mesesServ > 0 ? `Mora ${diasMora} d + servicios ${mesesServ} mes(es)` : `Mora ${diasMora} d`),
    })
  }

  filas.sort((x, y) => y.score - x.score)
  return Response.json({ ok: true, total: filas.length, reclamaciones: filas.slice(0, TOP_N) })
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const a = autoriza(session)
  if (!a.ok) return Response.json({ error: a.code === 401 ? 'No autenticado' : 'No autorizado' }, { status: a.code })
  let b
  try { b = await req.json() } catch { return Response.json({ error: 'JSON invalido' }, { status: 400 }) }
  const idadmon = String(b?.idadmon || '').trim()
  if (!idadmon) return Response.json({ error: 'Falta idadmon' }, { status: 400 })
  const sb = svc()
  const { error } = await sb.from('reclamacion_tratado').upsert(
    { idadmon, tratado_por: a.email, tratado_at: new Date().toISOString(), nota: b?.nota || null },
    { onConflict: 'idadmon' }
  )
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
