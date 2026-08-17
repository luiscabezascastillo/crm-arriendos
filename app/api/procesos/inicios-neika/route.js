// VERSION: v1 · 2026-08-17 · API "Inicios Neika": registro de los primeros pagos de cada inicio (tabla inicios_neika).
//   Permisos: ESCRIBEN Neika + Dirección (alta/edición/borrado); LEEN además Adalis, Fabiola, Karina y Anthony.
//   Dirección puede todo. GET devuelve las filas + puedeEscribir para que la página sepa qué mostrar.
//   Ruta: app/api/procesos/inicios-neika/route.js
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const ROL_ALIAS = { admin: 'direccion', operaciones: 'administracion', tecnico: 'mantencion' }
const normRol = (r) => ROL_ALIAS[String(r || '').toLowerCase()] || String(r || '').toLowerCase()

const DIRECCION = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com']
const NEIKA = 'neika.duque@fondocapital.com'
const ESCRITORES = [NEIKA, ...DIRECCION]
const LECTORES = ['adalis@fondocapital.com', 'fabiola.guerra@fondocapital.com', 'karina.morales@fondocapital.com', 'anthony.mendoza@fondocapital.com']

const puedeEscribir = (email, rol) => ESCRITORES.includes(email) || normRol(rol) === 'direccion'
const puedeVer = (email, rol) => puedeEscribir(email, rol) || LECTORES.includes(email)

const COLS = 'id, idadmon, fecha_pago, cantidad, rut, descripcion, comentarios, creado_por, created_at, updated_at'
const money = (v) => { const n = Math.round(Number(String(v ?? '').replace(/[^\d.-]/g, '')) || 0); return Number.isFinite(n) ? n : 0 }
const clean = (v) => { const s = String(v ?? '').trim(); return s || null }
const okFechaISO = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '').trim())

async function sesion() {
  const session = await getServerSession(authOptions)
  return { email: session?.user?.email || '', rol: session?.user?.role || '' }
}

export async function GET() {
  const { email, rol } = await sesion()
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!puedeVer(email, rol)) return Response.json({ error: 'Sin permiso para ver esta información.' }, { status: 403 })
  const { data, error } = await admin.from('inicios_neika').select(COLS)
    .order('idadmon', { ascending: true }).order('fecha_pago', { ascending: true, nullsFirst: true })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ filas: data || [], puedeEscribir: puedeEscribir(email, rol) })
}

export async function POST(req) {
  const { email, rol } = await sesion()
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!puedeEscribir(email, rol)) return Response.json({ error: 'Solo Neika y Dirección pueden registrar pagos.' }, { status: 403 })
  let b; try { b = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const idadmon = String(b?.idadmon || '').trim().toUpperCase()
  if (!idadmon) return Response.json({ error: 'El IDADMON es obligatorio.' }, { status: 400 })
  const fecha_pago = clean(b?.fecha_pago)
  if (fecha_pago && !okFechaISO(fecha_pago)) return Response.json({ error: 'Fecha de pago inválida (aaaa-mm-dd).' }, { status: 400 })
  const fila = {
    idadmon, fecha_pago,
    cantidad: (b?.cantidad === '' || b?.cantidad == null) ? null : money(b.cantidad),
    rut: clean(b?.rut), descripcion: clean(b?.descripcion), comentarios: clean(b?.comentarios),
    creado_por: email,
  }
  const { data, error } = await admin.from('inicios_neika').insert(fila).select(COLS).single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, fila: data })
}

export async function PUT(req) {
  const { email, rol } = await sesion()
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!puedeEscribir(email, rol)) return Response.json({ error: 'Solo Neika y Dirección pueden editar.' }, { status: 403 })
  let b; try { b = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  if (!b?.id) return Response.json({ error: 'Falta id' }, { status: 400 })
  const idadmon = String(b?.idadmon || '').trim().toUpperCase()
  if (!idadmon) return Response.json({ error: 'El IDADMON es obligatorio.' }, { status: 400 })
  const fecha_pago = clean(b?.fecha_pago)
  if (fecha_pago && !okFechaISO(fecha_pago)) return Response.json({ error: 'Fecha de pago inválida (aaaa-mm-dd).' }, { status: 400 })
  const patch = {
    idadmon, fecha_pago,
    cantidad: (b?.cantidad === '' || b?.cantidad == null) ? null : money(b.cantidad),
    rut: clean(b?.rut), descripcion: clean(b?.descripcion), comentarios: clean(b?.comentarios),
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await admin.from('inicios_neika').update(patch).eq('id', b.id).select(COLS).single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, fila: data })
}

export async function DELETE(req) {
  const { email, rol } = await sesion()
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!puedeEscribir(email, rol)) return Response.json({ error: 'Solo Neika y Dirección pueden borrar.' }, { status: 403 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return Response.json({ error: 'Falta id' }, { status: 400 })
  const { error } = await admin.from('inicios_neika').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
