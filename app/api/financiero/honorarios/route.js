// VERSION: v1 · 2026-07-13 · API Honorarios (Financiero). GET meses/honorarios · PUT editar · POST cargar mes (dedup rut+folio).
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const EDITORES = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']
const COLS = 'id, folio, fecha, estado, fecha_anulacion, rut, nombre, soc_prof, brutos, retenido, pagado, ccb, mes'

export async function GET(req) {
  const session = await getServerSession(authOptions); const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  const { searchParams } = new URL(req.url); const mes = searchParams.get('mes'); const todas = searchParams.get('todas')
  if (mes || todas) {
    let q = admin.from('honorarios').select(COLS)
    if (mes) q = q.eq('mes', mes)
    q = q.order('fecha', { ascending: true }).order('folio', { ascending: true })
    const { data, error } = await q
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ honorarios: data })
  }
  const { data, error } = await admin.from('honorarios').select('mes')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  const counts = {}; for (const r of (data || [])) { if (r.mes) counts[r.mes] = (counts[r.mes] || 0) + 1 }
  const meses = Object.entries(counts).map(([mes, n]) => ({ mes, n })).sort((a, b) => b.mes.localeCompare(a.mes))
  return Response.json({ meses })
}

export async function PUT(req) {
  const session = await getServerSession(authOptions); const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!EDITORES.includes(email)) return Response.json({ error: 'No tienes permiso para editar honorarios.' }, { status: 403 })
  let body; try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  if (!body?.id) return Response.json({ error: 'Falta id' }, { status: 400 })
  const patch = { ccb: (body.ccb || '').trim() || null, estado: (body.estado || '').trim() || null }
  const { error } = await admin.from('honorarios').update(patch).eq('id', body.id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export async function POST(req) {
  const session = await getServerSession(authOptions); const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!EDITORES.includes(email)) return Response.json({ error: 'No tienes permiso para cargar honorarios.' }, { status: 403 })
  let body; try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const honorarios = Array.isArray(body?.honorarios) ? body.honorarios : null
  if (!honorarios || !honorarios.length) return Response.json({ error: 'No hay honorarios para cargar' }, { status: 400 })
  const seen = new Set(); const rows = []
  for (const h of honorarios) {
    if (!h.folio || !h.fecha || !h.rut) continue
    const k = `${h.rut}-${h.folio}`; if (seen.has(k)) continue; seen.add(k)
    rows.push({
      folio: Math.round(Number(h.folio)), fecha: h.fecha, estado: h.estado || null, fecha_anulacion: h.fecha_anulacion || null,
      rut: h.rut || null, nombre: h.nombre || null, soc_prof: h.soc_prof || null,
      brutos: h.brutos == null ? null : Math.round(Number(h.brutos)), retenido: h.retenido == null ? null : Math.round(Number(h.retenido)),
      pagado: h.pagado == null ? null : Math.round(Number(h.pagado)), ccb: h.ccb || null, mes: h.mes || null, cargado_por: email, archivo: body.archivo || null,
    })
  }
  if (!rows.length) return Response.json({ error: 'No hay honorarios válidos (con rut, folio y fecha)' }, { status: 400 })
  const { data, error } = await admin.from('honorarios').upsert(rows, { onConflict: 'rut,folio', ignoreDuplicates: true }).select('id')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  const nuevas = (data || []).length
  return Response.json({ ok: true, nuevas, duplicadas: rows.length - nuevas, total: rows.length })
}
