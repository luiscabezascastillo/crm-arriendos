// VERSION: v1 · 2026-08-30 · Cron día 7: carga el "Descuento admin" del mes en curso en cuenta_alberto
//   (llama a la función SQL alberto_descuento_admin_mes). Idempotente; solo actúa el día 7 (Chile).
//   Auth: Vercel Cron manda "Authorization: Bearer $CRON_SECRET". Sin secret -> 401.
// app/api/cron/alberto-descuento/route.js
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } })
}
function partesChile() {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: '2-digit', month: '2-digit', day: '2-digit' })
  const o = {}; for (const p of f.formatToParts(new Date())) o[p.type] = p.value
  return { aamm: `${o.year}${o.month}`, dia: Number(o.day) }
}

export async function GET(req) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization') || ''
  if (!secret || auth !== `Bearer ${secret}`) return Response.json({ error: 'No autorizado' }, { status: 401 })

  const { aamm: mes, dia } = partesChile()
  if (dia !== 7) return Response.json({ ok: true, saltado: true, motivo: `Hoy es día ${dia} en Chile, no el 7.`, mes })

  const { data, error } = await svc().rpc('alberto_descuento_admin_mes', { p_mes: mes, p_email: 'cron' })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, mes, resultado: data })
}
