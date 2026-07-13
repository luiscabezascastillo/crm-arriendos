// VERSION: v2 · 2026-07-13 · API SA. GET: cargas / movimientos (por cartola o TODAS) + sus líneas / líneas de un movimiento · PUT: guardar líneas.
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const EDITORES = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']

const COLS = 'id, carga_id, orden, linea_cartola, fecha, monto, descripcion, cargo_abono, n_lineas, suma_lineas, estado_clasificacion, saldo_calc'

export async function GET(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const carga = searchParams.get('carga')
  const movimiento = searchParams.get('movimiento')
  const todas = searchParams.get('todas')

  // Líneas de UN movimiento (para el drawer)
  if (movimiento) {
    const { data, error } = await admin
      .from('sa_lineas')
      .select('id, sub_orden, monto, ccb, cuenta_1, cuenta_2, concepto')
      .eq('movimiento_id', movimiento)
      .order('sub_orden', { ascending: true })
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ lineas: data })
  }

  // Movimientos: de una cartola, o TODAS (vista continua). Incluye sus líneas para el desglose inline.
  if (carga || todas) {
    let q = admin.from('vw_sa_movimientos').select(COLS)
    if (carga) q = q.eq('carga_id', carga).order('linea_cartola', { ascending: true })
    else q = q.order('fecha', { ascending: true }).order('carga_id', { ascending: true }).order('linea_cartola', { ascending: true })
    const { data: movs, error } = await q
    if (error) return Response.json({ error: error.message }, { status: 500 })

    const ids = (movs || []).map(m => m.id)
    let lineas = []
    if (ids.length) {
      const { data: ls, error: e2 } = await admin
        .from('sa_lineas')
        .select('id, movimiento_id, sub_orden, monto, ccb, cuenta_1, cuenta_2, concepto')
        .in('movimiento_id', ids)
        .order('sub_orden', { ascending: true })
      if (e2) return Response.json({ error: e2.message }, { status: 500 })
      lineas = ls || []
    }
    return Response.json({ movimientos: movs, lineas })
  }

  // Lista de cartolas para el selector
  const { data, error } = await admin
    .from('sa_cargas')
    .select('id, nro_cartola, periodo, tipo, fecha_desde, fecha_hasta, n_movimientos')
    .order('nro_cartola', { ascending: false })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ cargas: data })
}

export async function PUT(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!EDITORES.includes(email)) return Response.json({ error: 'No tienes permiso para editar la clasificación.' }, { status: 403 })

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const movimientoId = body?.movimiento_id
  const lineas = Array.isArray(body?.lineas) ? body.lineas : null
  if (!movimientoId || !lineas) return Response.json({ error: 'Faltan movimiento_id o lineas' }, { status: 400 })

  const { error: delErr } = await admin.from('sa_lineas').delete().eq('movimiento_id', movimientoId)
  if (delErr) return Response.json({ error: delErr.message }, { status: 500 })

  if (lineas.length) {
    const filas = lineas.map((l, i) => ({
      movimiento_id: movimientoId,
      sub_orden: l.sub_orden ?? (i + 1),
      monto: Math.abs(Math.round(Number(l.monto))) || 0,
      ccb: l.ccb || null,
      cuenta_1: l.cuenta_1 || null,
      cuenta_2: l.cuenta_2 || null,
      concepto: l.concepto || null,
      creado_por: email,
    }))
    const { error: insErr } = await admin.from('sa_lineas').insert(filas)
    if (insErr) return Response.json({ error: insErr.message }, { status: 500 })
  }

  return Response.json({ ok: true, n: lineas.length })
}
