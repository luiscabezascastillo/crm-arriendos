// RUTA: app/api/financiero/tarjeta/route.js
// VERSION: v1 · 2026-08-16 · Endpoint de la Tarjeta de Crédito Santander (cuenta 2105-18, propuesta).
//   GET   → lista de movimientos.
//   POST  → carga un lote ya parseado (parseTarjetaCredito). Dedup por id_transaccion:
//           los que ya están no se re-insertan (conserva CCB/cuenta/comentario puestos a mano).
//   PATCH → edita ccb, cuenta_contable, comentario de un movimiento.
//   Escritura restringida a Dirección + Alberto/Luis/Karina.
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const EDITORES = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']
const puedeEscribir = (s) => String(s?.user?.role || '').toLowerCase() === 'direccion' || EDITORES.includes(s?.user?.email)
const numOf = (v) => { if (v == null || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null }
const txt = (v) => { const s = String(v ?? '').trim(); return s === '' ? null : s }

const COLS = 'id, id_transaccion, periodo, fecha_edc, fecha, lugar, descripcion, seccion, n_cuota, moneda, monto_divisa, monto, ccb, cuenta_contable, comentario, archivo, cargado_por, created_at, updated_at'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  const { data, error } = await admin.from('tarjeta_movimientos').select(COLS).order('fecha', { ascending: false }).order('id', { ascending: false })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ movimientos: data || [] })
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!puedeEscribir(session)) return Response.json({ error: 'Solo Dirección puede cargar.' }, { status: 403 })

  let body; try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const movs = Array.isArray(body?.movimientos) ? body.movimientos : null
  if (!movs || !movs.length) return Response.json({ error: 'No hay movimientos en el archivo.' }, { status: 400 })

  // ¿cuáles ya están? (por id_transaccion)
  const ids = movs.map(m => txt(m.id_transaccion)).filter(Boolean)
  const yaHay = new Set()
  if (ids.length) {
    const { data } = await admin.from('tarjeta_movimientos').select('id_transaccion').in('id_transaccion', ids)
    for (const r of (data || [])) yaHay.add(r.id_transaccion)
  }
  const nuevos = movs.filter(m => { const id = txt(m.id_transaccion); return !id || !yaHay.has(id) }).map(m => ({
    id_transaccion: txt(m.id_transaccion), periodo: txt(m.periodo), fecha_edc: txt(m.fecha_edc), fecha: txt(m.fecha),
    lugar: txt(m.lugar), descripcion: txt(m.descripcion), seccion: txt(m.seccion), n_cuota: txt(m.n_cuota),
    moneda: txt(m.moneda) || 'CLP', monto_divisa: txt(m.monto_divisa), monto: numOf(m.monto),
    archivo: txt(body.archivo) || txt(m.archivo), cargado_por: email,
  }))
  let insertados = 0
  if (nuevos.length) {
    const { error } = await admin.from('tarjeta_movimientos').insert(nuevos)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    insertados = nuevos.length
  }
  return Response.json({ ok: true, insertados, ya_estaban: movs.length - insertados, total_archivo: movs.length })
}

export async function PATCH(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!puedeEscribir(session)) return Response.json({ error: 'Solo Dirección puede editar.' }, { status: 403 })
  let body; try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  if (!body?.id) return Response.json({ error: 'Falta id' }, { status: 400 })
  const patch = { updated_at: new Date().toISOString() }
  for (const k of ['ccb', 'cuenta_contable', 'comentario']) if (Object.prototype.hasOwnProperty.call(body, k)) patch[k] = txt(body[k])
  const { error } = await admin.from('tarjeta_movimientos').update(patch).eq('id', body.id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
