// RUTA: app/api/financiero/facturas-int/route.js
// VERSION: v1 · 2026-08-16 · Endpoint de Facturas Internacionales.
//   GET   → lista.
//   POST  → guarda una factura parseada (parseFacturaInternacional). Dedup por proveedor_id+numero
//           (o proveedor+numero): si ya existe, actualiza; si no, inserta. CCB por defecto CC1.
//   PATCH → edita cuenta_contable, comentario, ccb, importe, importe_clp, estado, descripcion, fecha.
//   Escritura restringida a Dirección + Alberto/Luis/Karina.
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const EDITORES = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']
const puedeEscribir = (s) => String(s?.user?.role || '').toLowerCase() === 'direccion' || EDITORES.includes(s?.user?.email)
const numOf = (v) => { if (v == null || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null }
const txt = (v) => { const s = String(v ?? '').trim(); return s === '' ? null : s }

const COLS = 'id, proveedor, proveedor_id, pais, numero, fecha, periodo, descripcion, moneda, importe, importe_clp, ccb, cuenta_contable, comentario, estado, archivo, cargado_por, created_at, updated_at'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  const { data, error } = await admin.from('facturas_internacionales').select(COLS).order('fecha', { ascending: false }).order('id', { ascending: false })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ facturas: data || [] })
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!puedeEscribir(session)) return Response.json({ error: 'Solo Dirección puede cargar facturas.' }, { status: 403 })

  let body; try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const f = body?.factura
  if (!f || !f.numero) return Response.json({ error: 'Factura sin número.' }, { status: 400 })

  const fila = {
    proveedor: txt(f.proveedor), proveedor_id: txt(f.proveedor_id), pais: txt(f.pais),
    numero: txt(f.numero), fecha: txt(f.fecha), periodo: txt(f.periodo), descripcion: txt(f.descripcion),
    moneda: txt(f.moneda) || 'USD', importe: numOf(f.importe), importe_clp: numOf(f.importe_clp),
    ccb: txt(f.ccb) || 'CC1', archivo: txt(f.archivo), cargado_por: email, updated_at: new Date().toISOString(),
  }

  // Dedup: misma factura (proveedor + número) -> update; si no -> insert.
  let q = admin.from('facturas_internacionales').select('id').eq('numero', fila.numero)
  q = fila.proveedor_id ? q.eq('proveedor_id', fila.proveedor_id) : q.eq('proveedor', fila.proveedor)
  const { data: prev } = await q.maybeSingle()
  if (prev?.id) {
    // no se pisan cuenta_contable/comentario que ya hubiera puesto la persona
    const { error } = await admin.from('facturas_internacionales').update(fila).eq('id', prev.id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true, id: prev.id, actualizada: true, numero: fila.numero })
  }
  const { data, error } = await admin.from('facturas_internacionales').insert(fila).select('id').single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, id: data.id, numero: fila.numero })
}

export async function PATCH(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!puedeEscribir(session)) return Response.json({ error: 'Solo Dirección puede editar.' }, { status: 403 })
  let body; try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  if (!body?.id) return Response.json({ error: 'Falta id' }, { status: 400 })
  const patch = { updated_at: new Date().toISOString() }
  for (const k of ['cuenta_contable', 'comentario', 'ccb', 'estado', 'descripcion', 'proveedor', 'pais']) {
    if (Object.prototype.hasOwnProperty.call(body, k)) patch[k] = txt(body[k])
  }
  for (const k of ['importe', 'importe_clp']) {
    if (Object.prototype.hasOwnProperty.call(body, k)) patch[k] = numOf(body[k])
  }
  if (Object.prototype.hasOwnProperty.call(body, 'fecha')) patch.fecha = txt(body.fecha)
  const { error } = await admin.from('facturas_internacionales').update(patch).eq('id', body.id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export async function DELETE(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!puedeEscribir(session)) return Response.json({ error: 'Solo Dirección puede borrar.' }, { status: 403 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return Response.json({ error: 'Falta id' }, { status: 400 })
  const { error } = await admin.from('facturas_internacionales').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
