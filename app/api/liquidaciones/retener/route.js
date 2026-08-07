// VERSION: v2 · 2026-08-07 · app/api/liquidaciones/retener/route.js · "cobrado" con umbral 50.000 + acción 'justificar'.
// VERSION: v1 · 2026-08-07 · app/api/liquidaciones/retener/route.js
//   "Dejar en espera" un IDADMON dentro de la liquidación de un propietario: cuando el arrendatario de ESE inmueble
//   no ha pagado, se retiene su neto (no se transfiere ahora) y se paga en una oleada posterior cuando llegue el
//   dinero — todo antes de congelar el mes. Decisión MANUAL (botón de Alberto/Dirección/Karina); el banco solo ayuda
//   marcando si ya se cobró.
//   GET  ?mes=AAMM → { retenidos:[{ idadmon, idprop, propietario, renta, recibido, neto, cobrado, motivo, usuario }] }
//     enriquece con calcular_liquidacion(mes): renta=base, recibido=recibido_banco, neto=neto_transferir,
//     cobrado = recibido >= renta (ya llegó el dinero → listo para transferir/liberar).
//   POST { mes, idadmon, accion:'retener'|'liberar'|'justificar', motivo? } → marca/libera/justifica; log.
//     'justificar' = el arrendatario NO va a pagar (incobrable): se cierra la espera con motivo, para que quede
//     justificado y no afecte a futuro ni al DJ 1835.
//   Gate: Alberto + Luis + Karina (o rol admin).
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

const OK_EMAILS = [
  'alberto.cabezas@fondocapital.com',
  'luis.cabezas@fondocapital.com',
  'karina.morales@fondocapital.com',
]
function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
}
const n0 = v => { const x = Number(v); return isNaN(x) ? 0 : x }
const UMBRAL = 50000   // desvíos de pago menores a esto se consideran cobrados (se ignoran)
function autorizado(session) {
  const email = session?.user?.email
  return { email, ok: !!email && (OK_EMAILS.includes(email) || session?.user?.role === 'admin') }
}

// Mapa idadmon -> { idprop, propietario, renta, recibido, neto } desde el motor en vivo del mes.
async function motorDelMes(sb, mes) {
  const { data, error } = await sb.rpc('calcular_liquidacion', { p_mes: mes })
  if (error) return { map: {}, error: error.message }
  const map = {}
  for (const r of data || []) {
    const id = String(r.idadmon || '').trim()
    if (!id) continue
    // Puede haber varias filas por idadmon (copropiedad): se acumulan.
    const prev = map[id] || { idprop: r.idprop || '', propietario: r.propietario || '', renta: 0, recibido: 0, neto: 0 }
    prev.renta += n0(r.base)
    prev.recibido += n0(r.recibido_banco)
    prev.neto += n0(r.neto_transferir)
    if (!prev.idprop && r.idprop) prev.idprop = r.idprop
    if (!prev.propietario && r.propietario) prev.propietario = r.propietario
    map[id] = prev
  }
  return { map, error: null }
}

export async function GET(req) {
  const session = await getServerSession(authOptions)
  const { ok } = autorizado(session)
  if (!ok) return Response.json({ error: 'Solo Dirección y Karina.' }, { status: 403 })
  const mes = String(new URL(req.url).searchParams.get('mes') || '').trim()
  if (!/^\d{4}$/.test(mes)) return Response.json({ error: 'Mes inválido (AAMM)' }, { status: 400 })
  const sb = svc()

  const { data: rows } = await sb
    .from('liquidacion_retenidos')
    .select('idadmon, motivo, usuario, creado_at')
    .eq('mes', mes).eq('retenido', true)
  const ret = rows || []
  if (!ret.length) return Response.json({ ok: true, retenidos: [] })

  const { map } = await motorDelMes(sb, mes)
  const retenidos = ret.map(r => {
    const id = String(r.idadmon || '').trim()
    const m = map[id] || { idprop: '', propietario: '', renta: 0, recibido: 0, neto: 0 }
    return {
      idadmon: id, idprop: m.idprop, propietario: m.propietario,
      renta: Math.round(m.renta), recibido: Math.round(m.recibido), neto: Math.round(m.neto),
      cobrado: m.renta > 0 && (m.renta - m.recibido) < UMBRAL,   // desvío < 50.000 = cobrado
      motivo: r.motivo || '', usuario: r.usuario || '',
    }
  })
  return Response.json({ ok: true, retenidos })
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const { email, ok } = autorizado(session)
  if (!ok) return Response.json({ error: 'Solo Dirección y Karina.' }, { status: 403 })

  let body = {}
  try { body = await req.json() } catch {}
  const idadmon = String(body.idadmon || '').trim()
  const mes = String(body.mes || '').trim()
  const accion = String(body.accion || '').trim()
  const motivo = String(body.motivo || '').trim() || null
  if (!idadmon) return Response.json({ error: 'Falta idadmon' }, { status: 400 })
  if (!/^\d{4}$/.test(mes)) return Response.json({ error: 'Mes inválido (AAMM)' }, { status: 400 })
  if (!['retener', 'liberar', 'justificar'].includes(accion)) return Response.json({ error: 'Acción inválida' }, { status: 400 })

  const sb = svc()
  const nowIso = new Date().toISOString()

  if (accion === 'retener') {
    const { error } = await sb.from('liquidacion_retenidos').upsert({
      mes, idadmon, retenido: true, motivo, usuario: email, creado_at: nowIso, liberado_por: null, liberado_at: null,
    }, { onConflict: 'mes,idadmon' })
    if (error) return Response.json({ error: error.message }, { status: 500 })
  } else {
    // liberar (llegó el dinero) o justificar (incobrable): ambos cierran la espera. 'justificar' guarda el motivo.
    const upd = { retenido: false, liberado_por: email, liberado_at: nowIso }
    if (accion === 'justificar' && motivo) upd.motivo = motivo
    const { error } = await sb.from('liquidacion_retenidos').update(upd).eq('mes', mes).eq('idadmon', idadmon)
    if (error) return Response.json({ error: error.message }, { status: 500 })
  }
  try { await sb.from('liquidacion_retenidos_log').insert({ mes, idadmon, accion, motivo, usuario: email }) } catch {}

  return Response.json({ ok: true })
}
