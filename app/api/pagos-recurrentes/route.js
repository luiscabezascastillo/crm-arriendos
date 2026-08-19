// RUTA: app/api/pagos-recurrentes/route.js
// VERSION: v2 · 2026-08-18 · El GET solo devuelve los pagos a quien puede verlos (Alberto/Luis/Karina o rol
//   direccion); al resto le devuelve listas vacías (defensa en profundidad, para que el aviso no lo vea nadie más).
//   Hereda v1.
// VERSION: v1 · 2026-08-17 · Recordatorios de pagos recurrentes de Alberto, con constancia para Luis/Karina.
//   GET  → catálogo + estado del período actual (por_vencer / vencido / pagado / futuro) + lista de PENDIENTES
//          (lo que hay que avisar hoy). Fecha de "hoy" en horario de Chile.
//   POST accion='marcar'          → registra/actualiza un pago como pagado (constancia: quién y cuándo).
//   POST accion='guardar_catalogo'→ alta/edición de un pago recurrente (editable sin tocar código).
//   POST accion='borrar_catalogo' → baja (activo=false).
//   Marcar/editar: Dirección + Alberto/Luis/Karina. Escritura con service_role (evita bloqueos de RLS).
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const EDITORES = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']
const puedeEscribir = (s) => String(s?.user?.role || '').toLowerCase() === 'direccion' || EDITORES.includes(s?.user?.email)

const numOf = (v) => { if (v == null || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null }
const txt = (v) => { const s = String(v ?? '').trim(); return s === '' ? null : s }
const p2 = (n) => String(n).padStart(2, '0')

// "Hoy" en horario de Chile (el server corre en UTC).
function hoyChile() {
  const s = new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' })
  const d = new Date(s)
  return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() }
}
const diasEnMes = (y, m) => new Date(y, m, 0).getDate()
// nº de días entre dos fechas (a - b) a nivel de día.
const diffDias = (ay, am, ad, by, bm, bd) => Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86400000)

// Devuelve la fecha de vencimiento RELEVANTE de un pago para "hoy" (o null si este mes no toca, para anuales).
function vencimientoRelevante(pago, hoy) {
  const dia = Math.min(Number(pago.dia_venc) || 1, 28 + 4) // se acota abajo a fin de mes
  if (pago.periodicidad === 'anual') {
    const meses = String(pago.meses_anual || '').split(',').map(s => parseInt(s, 10)).filter(Boolean)
    if (!meses.length) return null
    // el vencimiento de este año cuyo aviso está activo o más próximo: elegimos el del mes de este año que
    // esté dentro de la ventana [venc - aviso, venc] o ya vencido este año y aún sin pagar; si no, el próximo.
    let mejor = null
    for (const mm of meses) {
      const dd = Math.min(dia, diasEnMes(hoy.y, mm))
      // días desde hoy hasta el vencimiento de este año
      const hastaVenc = diffDias(hoy.y, mm, dd, hoy.y, hoy.m, hoy.d)
      const cand = { y: hoy.y, m: mm, d: dd, hastaVenc }
      // preferimos el que esté dentro de la ventana de aviso o recién vencido (|hastaVenc| pequeño)
      if (mejor == null || Math.abs(cand.hastaVenc) < Math.abs(mejor.hastaVenc)) mejor = cand
    }
    return mejor ? { y: mejor.y, m: mejor.m, d: mejor.d } : null
  }
  // mensual: el vencimiento de ESTE mes
  const dd = Math.min(dia, diasEnMes(hoy.y, hoy.m))
  return { y: hoy.y, m: hoy.m, d: dd }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  const hoy = hoyChile()

  // Solo Alberto/Luis/Karina (o rol dirección) reciben los pagos. Al resto, listas vacías (el aviso no debe verse).
  const emailL = String(session.user.email || '').toLowerCase()
  const rolL = String(session?.user?.role || '').toLowerCase()
  const puedeVerPagos = rolL === 'direccion' || EDITORES.map(e => e.toLowerCase()).includes(emailL)
  if (!puedeVerPagos) {
    return Response.json({ ok: true, hoy: `${p2(hoy.d)}/${p2(hoy.m)}/${hoy.y}`, items: [], pendientes: [], puedeEscribir: false, email: session.user.email })
  }

  const { data: cat, error: e1 } = await admin.from('pagos_recurrentes').select('*').order('orden', { ascending: true }).order('proveedor', { ascending: true })
  if (e1) return Response.json({ error: e1.message }, { status: 500 })
  const { data: marcas, error: e2 } = await admin.from('pagos_marcas').select('pago_id, periodo, pagado, monto, pagado_por, pagado_at')
  if (e2) return Response.json({ error: e2.message }, { status: 500 })
  const marcaDe = {}
  for (const m of (marcas || [])) marcaDe[`${m.pago_id}|${m.periodo}`] = m

  const items = []
  for (const p of (cat || [])) {
    const v = p.activo ? vencimientoRelevante(p, hoy) : null
    if (!v) { items.push({ ...p, vence: null, periodo: null, estado: p.activo ? 'sin_fecha' : 'inactivo', hastaVenc: null }); continue }
    const periodo = `${v.y}-${p2(v.m)}`
    const hastaVenc = diffDias(v.y, v.m, v.d, hoy.y, hoy.m, hoy.d) // >0 futuro, 0 hoy, <0 vencido
    const marca = marcaDe[`${p.id}|${periodo}`]
    let estado
    if (marca?.pagado) estado = 'pagado'
    else if (hastaVenc < 0) estado = 'vencido'
    else if (hastaVenc <= (Number(p.aviso_dias) || 3)) estado = 'por_vencer'
    else estado = 'futuro'
    items.push({
      id: p.id, proveedor: p.proveedor, dia_venc: p.dia_venc, periodicidad: p.periodicidad, meses_anual: p.meses_anual,
      monto: numOf(p.monto), aviso_dias: p.aviso_dias, activo: p.activo, nota: p.nota, orden: p.orden,
      vence: `${p2(v.d)}/${p2(v.m)}/${v.y}`, periodo, hastaVenc, estado,
      pagado_por: marca?.pagado_por || null, pagado_at: marca?.pagado_at || null, monto_pagado: numOf(marca?.monto),
    })
  }
  const pendientes = items.filter(i => i.estado === 'por_vencer' || i.estado === 'vencido')
  return Response.json({ ok: true, hoy: `${p2(hoy.d)}/${p2(hoy.m)}/${hoy.y}`, items, pendientes, puedeEscribir: puedeEscribir(session), email: session.user.email })
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!puedeEscribir(session)) return Response.json({ error: 'No tienes permiso.' }, { status: 403 })
  let body; try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }

  if (body.accion === 'marcar') {
    const pago_id = Number(body.pago_id), periodo = txt(body.periodo)
    if (!pago_id || !periodo) return Response.json({ error: 'Falta pago_id o periodo' }, { status: 400 })
    if (body.pagado === false) {
      const { error } = await admin.from('pagos_marcas').delete().eq('pago_id', pago_id).eq('periodo', periodo)
      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json({ ok: true, pagado: false })
    }
    const fila = { pago_id, periodo, pagado: true, monto: numOf(body.monto), pagado_por: session.user.email, pagado_at: new Date().toISOString() }
    const { error } = await admin.from('pagos_marcas').upsert(fila, { onConflict: 'pago_id,periodo' })
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true, pagado: true })
  }

  if (body.accion === 'guardar_catalogo') {
    const fila = {
      proveedor: txt(body.proveedor), dia_venc: Number(body.dia_venc) || 1,
      periodicidad: (body.periodicidad === 'anual') ? 'anual' : 'mensual', meses_anual: txt(body.meses_anual),
      monto: numOf(body.monto), aviso_dias: Number(body.aviso_dias) || 3,
      activo: body.activo !== false, nota: txt(body.nota), orden: Number(body.orden) || 0,
      updated_at: new Date().toISOString(),
    }
    if (!fila.proveedor) return Response.json({ error: 'Falta el proveedor' }, { status: 400 })
    if (body.id) {
      const { error } = await admin.from('pagos_recurrentes').update(fila).eq('id', Number(body.id))
      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json({ ok: true, id: Number(body.id) })
    }
    const { data, error } = await admin.from('pagos_recurrentes').insert(fila).select('id').single()
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true, id: data?.id })
  }

  if (body.accion === 'borrar_catalogo') {
    if (!body.id) return Response.json({ error: 'Falta id' }, { status: 400 })
    const { error } = await admin.from('pagos_recurrentes').update({ activo: false, updated_at: new Date().toISOString() }).eq('id', Number(body.id))
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  return Response.json({ error: 'Acción no reconocida' }, { status: 400 })
}
