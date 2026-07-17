// app/api/cartolas/resincronizar/route.js
// Re-sincroniza el CARGO de un IDADMON en `cuentas` desde el origen (calcular_liquidacion),
// tras corregir datos en el LOG. Solo Direccion y Karina.
//
// Regla: el IDADMON debe estar en la liquidacion del mes (= en CARTAS). Si esta:
//   - si ya tiene fila de cargo del mes en `cuentas` -> la ACTUALIZA
//   - si no la tiene -> la CREA
// Nunca toca abonos. Solo la fila del CARGO (concepto que empieza por "MES AÑO...").
//
// Ventana: dias 6-8 (hora de Santiago) libre. Fuera de ventana requiere forzar:true.
//
// POST { idadmon, mes, confirmar, forzar } -> preview (confirmar!=true) o aplica.

import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

const PERMITIDOS = [
  'alberto.cabezas@fondocapital.com',
  'luis.cabezas@fondocapital.com',
  'karina.morales@fondocapital.com',
]
const MESES_TXT = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
const n0 = v => { const x = Number(v); return isNaN(x) ? 0 : x }
const aammToTxt = aamm => {
  if (!aamm || String(aamm).length !== 4) return String(aamm)
  const a = String(aamm).slice(0, 2), m = parseInt(String(aamm).slice(2), 10)
  return `${MESES_TXT[m - 1] || '?'} 20${a}`
}
const aammToFecha = aamm => `20${String(aamm).slice(0, 2)}-${String(aamm).slice(2)}-01`
function diaMesSantiago() {
  try { return parseInt(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', day: '2-digit' }).format(new Date()), 10) }
  catch { return new Date().getUTCDate() }
}
function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
}
function puede(session) {
  const e = session?.user?.email, r = session?.user?.role
  return r === 'admin' || PERMITIDOS.includes(e)
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!puede(session)) return Response.json({ error: 'Solo Dirección y Karina pueden re-sincronizar.' }, { status: 403 })

  let body = {}
  try { body = await req.json() } catch {}
  const idadmon = String(body.idadmon || '').trim().toUpperCase()
  const mes = String(body.mes || '').trim()
  const confirmar = body.confirmar === true
  const forzar = body.forzar === true
  if (!idadmon) return Response.json({ error: 'Falta idadmon.' }, { status: 400 })
  if (!/^\d{4}$/.test(mes)) return Response.json({ error: 'Mes inválido (AAMM).' }, { status: 400 })

  const sb = svc()
  const mesTxt = aammToTxt(mes)
  const fecha = aammToFecha(mes)
  const dia = diaMesSantiago()
  const enVentana = dia >= 6 && dia <= 8

  // 1) El IDADMON debe estar en la liquidacion del mes (= en CARTAS)
  const { data: liq, error: e1 } = await sb.rpc('calcular_liquidacion', { p_mes: mes })
  if (e1) return Response.json({ error: 'calcular_liquidacion: ' + e1.message }, { status: 500 })
  const filas = (liq || []).filter(r => r.idadmon === idadmon)
  if (filas.length === 0) {
    return Response.json({ error: `El IDADMON ${idadmon} no está en la liquidación de ${mesTxt} (no aparece en CARTAS este mes).` }, { status: 400 })
  }
  const main = filas.find(r => !String(r.inmueble || '').startsWith('[proporcional')) || filas[0]

  // 2) Estado del contrato (para el cargo y para poblar la columna estado)
  const { data: arr } = await sb.from('datos_arriendos').select('estado, propietario, inmueble').eq('idadmon', idadmon).limit(1)
  const info = (arr && arr[0]) || {}
  const estado = String(info.estado || '').trim().toUpperCase()
  if (estado === 'P') {
    return Response.json({ error: `El IDADMON ${idadmon} está en captación (P): no genera cargo este mes.` }, { status: 400 })
  }

  const cargoNuevo = Math.round(n0(main.base))
  if (cargoNuevo <= 0) {
    return Response.json({ error: `El IDADMON ${idadmon} no tiene cargo (base 0) este mes; no hay nada que sincronizar.` }, { status: 400 })
  }
  const propietario = main.propietario || info.propietario || ''
  const inmueble = main.inmueble || info.inmueble || ''
  const concepto = `${mesTxt} ${propietario} ${inmueble}`

  // 3) ¿Ya existe la fila de cargo del mes en cuentas?
  const { data: existentes } = await sb.from('cuentas').select('id, cargo').eq('idadmon', idadmon).ilike('concepto', `${mesTxt}%`)
  const existe = existentes && existentes.length > 0
  const cargoAnterior = existe ? n0(existentes[0].cargo) : null
  const accion = existe ? 'actualiza' : 'crea'

  // --- PREVIEW ---
  if (!confirmar) {
    return Response.json({
      preview: true, idadmon, mes, mesTxt, dia, enVentana,
      accion, cargoAnterior, cargoNuevo, concepto,
      propietario, inmueble, estado,
      sinCambio: existe && cargoAnterior === cargoNuevo,
    })
  }

  // --- APLICAR ---
  if (!enVentana && !forzar) {
    return Response.json({ error: `Hoy es día ${dia}: fuera de la ventana (6-8). Marca "forzar" para hacerlo igualmente.`, requiereForzar: true, dia }, { status: 409 })
  }

  const nowIso = new Date().toISOString()
  if (existe) {
    const { error } = await sb.from('cuentas')
      .update({ cargo: cargoNuevo, concepto, estado: estado || 'S', propietario, inmueble, updated_at: nowIso })
      .eq('idadmon', idadmon).ilike('concepto', `${mesTxt}%`)
    if (error) return Response.json({ error: 'UPDATE cuentas: ' + error.message }, { status: 500 })
  } else {
    const { error } = await sb.from('cuentas').insert({
      fecha, idadmon, concepto, cargo: cargoNuevo, estado: estado || 'S', propietario, inmueble, updated_at: nowIso,
    })
    if (error) return Response.json({ error: 'INSERT cuentas: ' + error.message }, { status: 500 })
  }

  await sb.from('cuentas_resync_log').insert({
    idadmon, mes, cargo_anterior: cargoAnterior, cargo_nuevo: cargoNuevo,
    accion, forzado: !enVentana, dia_mes: dia, usuario: email,
  })

  return Response.json({ ok: true, idadmon, mesTxt, accion, cargoAnterior, cargoNuevo, forzado: !enVentana, dia })
}
