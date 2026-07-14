// VERSION: v1 · 2026-07-13 · API Ventas (Financiero). GET: meses / ventas (por mes o todas) · PUT: editar venta · POST: cargar ventas del mes.
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const EDITORES = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']
const COLS = 'id, folio, tipo_doc, fecha, ccb, idadmon, rut, receptor, neto, iva, total, revision, glosa, mes'

export async function GET(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const mes = searchParams.get('mes')
  const todas = searchParams.get('todas')

  if (mes || todas) {
    let q = admin.from('ventas').select(COLS)
    if (mes) q = q.eq('mes', mes)
    q = q.order('fecha', { ascending: true }).order('folio', { ascending: true })
    const { data, error } = await q
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ventas: data })
  }

  // Lista de meses (para el selector "mensual")
  const { data, error } = await admin.from('ventas').select('mes')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  const counts = {}
  for (const r of (data || [])) { if (r.mes) counts[r.mes] = (counts[r.mes] || 0) + 1 }
  const meses = Object.entries(counts).map(([mes, n]) => ({ mes, n })).sort((a, b) => b.mes.localeCompare(a.mes))
  return Response.json({ meses })
}

export async function PUT(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!EDITORES.includes(email)) return Response.json({ error: 'No tienes permiso para editar ventas.' }, { status: 403 })

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  if (!body?.id) return Response.json({ error: 'Falta id' }, { status: 400 })
  const patch = {
    ccb: (body.ccb || '').trim() || null,
    idadmon: (body.idadmon || '').trim() || null,
    revision: (body.revision || '').trim() || null,
    glosa: (body.glosa || '').trim() || null,
  }
  const { error } = await admin.from('ventas').update(patch).eq('id', body.id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

// POST: cargar ventas de un mes (parseadas en el cliente). Deduplica por (tipo_doc, folio).
export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!EDITORES.includes(email)) return Response.json({ error: 'No tienes permiso para cargar ventas.' }, { status: 403 })

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const ventas = Array.isArray(body?.ventas) ? body.ventas : null
  if (!ventas || !ventas.length) return Response.json({ error: 'No hay ventas para cargar' }, { status: 400 })

  // dedup interno por (tipo_doc, folio) antes de mandar
  const seen = new Set(); const rows = []
  for (const v of ventas) {
    if (!v.folio || !v.fecha) continue
    const k = `${v.tipo_doc || ''}-${v.folio}`
    if (seen.has(k)) continue
    seen.add(k)
    rows.push({
      folio: Math.round(Number(v.folio)), tipo_doc: v.tipo_doc || null, fecha: v.fecha,
      ccb: v.ccb || null, idadmon: v.idadmon || null, rut: v.rut || null, receptor: v.receptor || null,
      neto: v.neto == null ? null : Math.round(Number(v.neto)), iva: v.iva == null ? null : Math.round(Number(v.iva)),
      total: v.total == null ? null : Math.round(Number(v.total)), revision: v.revision || null, glosa: v.glosa || null,
      mes: v.mes || null, cargado_por: email, archivo: body.archivo || null,
    })
  }
  if (!rows.length) return Response.json({ error: 'No hay ventas válidas (con folio y fecha)' }, { status: 400 })

  const { data, error } = await admin.from('ventas').upsert(rows, { onConflict: 'tipo_doc,folio', ignoreDuplicates: true }).select('id')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  const nuevas = (data || []).length
  return Response.json({ ok: true, nuevas, duplicadas: rows.length - nuevas, total: rows.length })
}
