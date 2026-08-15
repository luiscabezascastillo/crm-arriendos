// VERSION: v1 · 2026-08-15 · API "Cuenta Alberto" (cuenta corriente del propietario de la empresa).
//   GET  → lista todos los movimientos (paginado, ordenados por fecha, id).
//   POST → alta de un movimiento. PUT → editar / anular / reactivar por id.
//   Escritura restringida a Dirección + Alberto/Luis/Karina (cuenta sensible). Tabla: cuenta_alberto.
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const EDITORES = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']
const COLS = 'id, fecha, descripcion, procedencia, destino, debe, haber, tipo, referencia, estado, asiento_id, justificante, anulado, registrado_por, created_at, updated_at'

const PAGINA = 1000
const TOPE = 200000

const num = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? n : 0 }
const txt = (v) => { const s = String(v ?? '').trim(); return s === '' ? null : s }

function puedeEscribir(session) {
  const email = session?.user?.email
  const rol = String(session?.user?.role || '').toLowerCase()
  return rol === 'direccion' || EDITORES.includes(email)
}

async function leerTodo(construir) {
  const filas = []
  for (let desde = 0; desde < TOPE; desde += PAGINA) {
    const { data, error } = await construir().range(desde, desde + PAGINA - 1)
    if (error) throw new Error(error.message)
    const lote = data || []
    filas.push(...lote)
    if (lote.length < PAGINA) break
  }
  return filas
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  try {
    const movimientos = await leerTodo(() => admin.from('cuenta_alberto').select(COLS)
      .order('fecha', { ascending: true }).order('id', { ascending: true }))
    return Response.json({ movimientos, total: movimientos.length, puedeEditar: puedeEscribir(session) })
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 500 })
  }
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!puedeEscribir(session)) return Response.json({ error: 'No tienes permiso para anotar en la cuenta de Alberto.' }, { status: 403 })
  let b; try { b = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  if (!b?.fecha) return Response.json({ error: 'Falta la fecha.' }, { status: 400 })
  const debe = num(b.debe), haber = num(b.haber)
  if (debe === 0 && haber === 0) return Response.json({ error: 'Pon un importe en Debe o en Haber.' }, { status: 400 })
  const fila = {
    fecha: b.fecha,
    descripcion: txt(b.descripcion),
    procedencia: txt(b.procedencia),
    destino: txt(b.destino),
    debe, haber,
    tipo: txt(b.tipo),
    referencia: txt(b.referencia),
    estado: txt(b.estado) || 'pendiente',
    justificante: txt(b.justificante),
    registrado_por: session.user.email,
  }
  const { data, error } = await admin.from('cuenta_alberto').insert([fila]).select(COLS).single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, movimiento: data })
}

export async function PUT(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!puedeEscribir(session)) return Response.json({ error: 'No tienes permiso para editar la cuenta de Alberto.' }, { status: 403 })
  let b; try { b = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  if (!b?.id) return Response.json({ error: 'Falta id' }, { status: 400 })

  // Solo cambiar anulado (anular / reactivar).
  if (b.soloAnulado === true) {
    const { data, error } = await admin.from('cuenta_alberto')
      .update({ anulado: !!b.anulado, updated_at: new Date().toISOString() }).eq('id', b.id).select(COLS).single()
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true, movimiento: data })
  }

  const debe = num(b.debe), haber = num(b.haber)
  if (debe === 0 && haber === 0) return Response.json({ error: 'Pon un importe en Debe o en Haber.' }, { status: 400 })
  const patch = {
    fecha: b.fecha || undefined,
    descripcion: txt(b.descripcion),
    procedencia: txt(b.procedencia),
    destino: txt(b.destino),
    debe, haber,
    tipo: txt(b.tipo),
    referencia: txt(b.referencia),
    estado: txt(b.estado) || 'pendiente',
    justificante: txt(b.justificante),
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await admin.from('cuenta_alberto').update(patch).eq('id', b.id).select(COLS).single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, movimiento: data })
}
