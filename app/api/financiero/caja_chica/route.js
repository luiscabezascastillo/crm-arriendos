// VERSION: v1 · 2026-07-13 · API Caja Chica (Financiero). GET meses/movimientos · PUT editar CCB · POST cargar (dedup por orden).
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const EDITORES = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']
const COLS = 'id, orden, fecha, detalle, pagado, recibido, monto, n_documento, saldo, ccb, mes'

export async function GET(req) {
  const session = await getServerSession(authOptions); const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  const { searchParams } = new URL(req.url); const mes = searchParams.get('mes'); const todas = searchParams.get('todas')
  if (mes || todas) {
    let q = admin.from('caja_chica').select(COLS)
    if (mes) q = q.eq('mes', mes)
    q = q.order('orden', { ascending: true })
    const { data, error } = await q
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ movimientos: data })
  }
  const { data, error } = await admin.from('caja_chica').select('mes')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  const counts = {}; for (const r of (data || [])) { if (r.mes) counts[r.mes] = (counts[r.mes] || 0) + 1 }
  const meses = Object.entries(counts).map(([mes, n]) => ({ mes, n })).sort((a, b) => b.mes.localeCompare(a.mes))
  return Response.json({ meses })
}

export async function PUT(req) {
  const session = await getServerSession(authOptions); const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!EDITORES.includes(email)) return Response.json({ error: 'No tienes permiso para editar caja chica.' }, { status: 403 })
  let body; try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  if (!body?.id) return Response.json({ error: 'Falta id' }, { status: 400 })
  const patch = { ccb: (body.ccb || '').trim() || null, detalle: (body.detalle || '').trim() || null }
  const { error } = await admin.from('caja_chica').update(patch).eq('id', body.id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export async function POST(req) {
  const session = await getServerSession(authOptions); const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!EDITORES.includes(email)) return Response.json({ error: 'No tienes permiso para cargar caja chica.' }, { status: 403 })
  let body; try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const movimientos = Array.isArray(body?.movimientos) ? body.movimientos : null
  if (!movimientos || !movimientos.length) return Response.json({ error: 'No hay movimientos para cargar' }, { status: 400 })
  const seen = new Set(); const rows = []
  for (const m of movimientos) {
    if (m.orden == null || !m.fecha) continue
    if (seen.has(m.orden)) continue; seen.add(m.orden)
    const pagado = m.pagado == null ? 0 : Math.round(Number(m.pagado))
    const recibido = m.recibido == null ? 0 : Math.round(Number(m.recibido))
    rows.push({
      orden: Math.round(Number(m.orden)), fecha: m.fecha, detalle: m.detalle || null, pagado, recibido,
      monto: recibido - pagado, n_documento: m.n_documento || null, saldo: m.saldo == null ? null : Math.round(Number(m.saldo)),
      mes: m.mes || null, cargado_por: email, archivo: body.archivo || null,
    })
  }
  if (!rows.length) return Response.json({ error: 'No hay movimientos válidos (con orden y fecha)' }, { status: 400 })
  const { data, error } = await admin.from('caja_chica').upsert(rows, { onConflict: 'orden', ignoreDuplicates: true }).select('id')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  const nuevas = (data || []).length
  return Response.json({ ok: true, nuevas, duplicadas: rows.length - nuevas, total: rows.length })
}
