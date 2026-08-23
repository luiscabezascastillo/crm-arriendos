// VERSION: v2 · 2026-08-23 · Cortes semanales de servicios — PLAN B.
//   GET  ?aamm=2608                       → lista los cortes (registro `ggcc_cortes`).
//   POST { action:'tomar', aamm, fecha?, nota? } → toma una FOTO congelada del mes: copia ggcc_agua_luz →
//         ggcc_cortes_datos (secuencia de corte por aamm). La tabla viva NO se toca.
import { createClient } from '@supabase/supabase-js'
import { tomarCorte } from '@/lib/cortes'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const aamm = (searchParams.get('aamm') || '').trim()
    let q = supabase.from('ggcc_cortes').select('*')
      .order('aamm', { ascending: true }).order('corte', { ascending: true })
    if (aamm) q = q.eq('aamm', aamm)
    const { data, error } = await q
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true, cortes: data || [] })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}))
    if (body.action !== 'tomar') {
      return Response.json({ error: 'Acción no soportada (usa action:"tomar")' }, { status: 400 })
    }
    const r = await tomarCorte(supabase, body.aamm, { fecha: body.fecha, nota: body.nota })
    if (r.error) return Response.json({ error: r.error }, { status: 400 })
    return Response.json(r)
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
