// VERSION: v1 · 2026-07-13 · API Compras (Financiero). GET: meses / compras · PUT: editar · POST: cargar mes (dedup por rut+folio).
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const EDITORES = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']
const COLS = 'id, folio, tipo_doc, fecha, rut, proveedor, ccb, cuenta, pagado_por, exento, neto, iva, total, estado, glosa, mes'

export async function GET(req) {
  const session = await getServerSession(authOptions); const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const mes = searchParams.get('mes'); const todas = searchParams.get('todas')
  if (mes || todas) {
    let q = admin.from('compras').select(COLS)
    if (mes) q = q.eq('mes', mes)
    q = q.order('fecha', { ascending: true }).order('folio', { ascending: true })
    const { data, error } = await q
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ compras: data })
  }
  const { data, error } = await admin.from('compras').select('mes')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  const counts = {}; for (const r of (data || [])) { if (r.mes) counts[r.mes] = (counts[r.mes] || 0) + 1 }
  const meses = Object.entries(counts).map(([mes, n]) => ({ mes, n })).sort((a, b) => b.mes.localeCompare(a.mes))
  return Response.json({ meses })
}

export async function PUT(req) {
  const session = await getServerSession(authOptions); const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!EDITORES.includes(email)) return Response.json({ error: 'No tienes permiso para editar compras.' }, { status: 403 })
  let body; try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  if (!body?.id) return Response.json({ error: 'Falta id' }, { status: 400 })
  const patch = {
    ccb: (body.ccb || '').trim() || null, cuenta: (body.cuenta || '').trim() || null,
    pagado_por: (body.pagado_por || '').trim() || null, estado: (body.estado || '').trim() || null,
    glosa: (body.glosa || '').trim() || null,
  }
  const { error } = await admin.from('compras').update(patch).eq('id', body.id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export async function POST(req) {
  const session = await getServerSession(authOptions); const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!EDITORES.includes(email)) return Response.json({ error: 'No tienes permiso para cargar compras.' }, { status: 403 })
  let body; try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const compras = Array.isArray(body?.compras) ? body.compras : null
  if (!compras || !compras.length) return Response.json({ error: 'No hay compras para cargar' }, { status: 400 })
  const seen = new Set(); const rows = []
  for (const c of compras) {
    if (!c.folio || !c.fecha || !c.rut) continue
    const k = `${c.rut}-${c.folio}`; if (seen.has(k)) continue; seen.add(k)
    rows.push({
      folio: Math.round(Number(c.folio)), tipo_doc: c.tipo_doc || null, fecha: c.fecha, rut: c.rut || null,
      proveedor: c.proveedor || null, ccb: c.ccb || null, cuenta: c.cuenta || null, pagado_por: c.pagado_por || null,
      exento: c.exento == null ? null : Math.round(Number(c.exento)), neto: c.neto == null ? null : Math.round(Number(c.neto)),
      iva: c.iva == null ? null : Math.round(Number(c.iva)), total: c.total == null ? null : Math.round(Number(c.total)),
      estado: c.estado || null, glosa: c.glosa || null, mes: c.mes || null, cargado_por: email, archivo: body.archivo || null,
    })
  }
  if (!rows.length) return Response.json({ error: 'No hay compras válidas (con rut, folio y fecha)' }, { status: 400 })
  const { data, error } = await admin.from('compras').upsert(rows, { onConflict: 'rut,folio', ignoreDuplicates: true }).select('id')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  const nuevas = (data || []).length
  return Response.json({ ok: true, nuevas, duplicadas: rows.length - nuevas, total: rows.length })
}
