// VERSION: v1 · 2026-08-18 · Recordatorios PERSONALES por usuario. Cada uno solo ve/edita los SUYOS (por email de
//   sesión). GET → { items, pendientes } (con estado vencido/por_vencer/futuro/sin_fecha, "hoy" en horario de Chile).
//   POST accion='crear'|'editar'|'marcar'|'borrar'. Escritura con service role, pero SIEMPRE acotada al email dueño.
//   Ruta: app/api/recordatorios/route.js
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const AVISO_DIAS = 3   // "por vencer" si vence dentro de estos días

function hoyChile() {
  const s = new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' })
  const d = new Date(s)
  const p2 = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
}
const diffDias = (a, b) => Math.round((Date.parse(a + 'T00:00:00') - Date.parse(b + 'T00:00:00')) / 86400000)

function conEstado(r, hoy) {
  if (r.hecho) return { ...r, estado: 'hecho', hastaVenc: null }
  if (!r.fecha_venc) return { ...r, estado: 'sin_fecha', hastaVenc: null }
  const dv = String(r.fecha_venc).slice(0, 10)
  const h = diffDias(dv, hoy)
  const estado = h < 0 ? 'vencido' : h <= AVISO_DIAS ? 'por_vencer' : 'futuro'
  return { ...r, estado, hastaVenc: h }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  const hoy = hoyChile()

  const { data, error } = await admin.from('recordatorios_personales')
    .select('id, titulo, fecha_venc, nota, hecho, creado_at, hecho_at')
    .eq('email', email)
    .order('hecho', { ascending: true })
    .order('fecha_venc', { ascending: true, nullsFirst: false })
    .order('creado_at', { ascending: false })
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const items = (data || []).map(r => conEstado(r, hoy))
  // Pendientes para el aviso: no hechos (vencidos, por vencer o sin fecha).
  const pendientes = items.filter(r => !r.hecho && r.estado !== 'futuro')
  return Response.json({ ok: true, hoy, items, pendientes })
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })

  let b = {}
  try { b = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const accion = String(b.accion || '').trim()
  const now = new Date().toISOString()
  const txt = (v) => { const s = String(v ?? '').trim(); return s === '' ? null : s }

  if (accion === 'crear') {
    const titulo = txt(b.titulo)
    if (!titulo) return Response.json({ error: 'Falta el título' }, { status: 400 })
    const fila = { email, titulo, fecha_venc: txt(b.fecha_venc), nota: txt(b.nota), hecho: false, creado_at: now }
    const { error } = await admin.from('recordatorios_personales').insert(fila)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  const id = Number(b.id)
  if (!id) return Response.json({ error: 'Falta id' }, { status: 400 })

  if (accion === 'editar') {
    const patch = {}
    if (b.titulo !== undefined) patch.titulo = txt(b.titulo)
    if (b.fecha_venc !== undefined) patch.fecha_venc = txt(b.fecha_venc)
    if (b.nota !== undefined) patch.nota = txt(b.nota)
    if (patch.titulo === null) return Response.json({ error: 'El título no puede quedar vacío' }, { status: 400 })
    const { error } = await admin.from('recordatorios_personales').update(patch).eq('id', id).eq('email', email)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  if (accion === 'marcar') {
    const hecho = !!b.hecho
    const { error } = await admin.from('recordatorios_personales')
      .update({ hecho, hecho_at: hecho ? now : null }).eq('id', id).eq('email', email)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  if (accion === 'borrar') {
    const { error } = await admin.from('recordatorios_personales').delete().eq('id', id).eq('email', email)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  return Response.json({ error: 'Acción no reconocida' }, { status: 400 })
}
