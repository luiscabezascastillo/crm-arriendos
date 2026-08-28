// ═══════════════════════════════════════════════════════════════
// VERSION: v1 · 2026-08-28 · Auto-congelar el día 23 (Vercel Cron)
// Para verificar tras copiar:  Select-String route.js -Pattern "VERSION: v1"
// ═══════════════════════════════════════════════════════════════
// app/api/liquidaciones/auto-congelar/route.js
//
// Congela automáticamente el mes de liquidación que ACABA de cerrar.
// Las liquidaciones van del 23 de un mes al 22 del siguiente: la ventana de la
// liquidación del mes M es 23/(M-1) → 22/M. El día 23 esa ventana ya cerró (el 22),
// así que se congela el MES DE CALENDARIO actual (M) en zona horaria de Chile.
//
// Auth: Vercel Cron añade "Authorization: Bearer $CRON_SECRET" cuando la env
//   CRON_SECRET está definida. Sin CRON_SECRET, la ruta responde 401 (no hace nada).
// Idempotente: si el mes ya está congelado, no toca nada.
// Recalcula reusando /api/liquidaciones/preparar-mes (auth por x-cron-secret) y
// pone cerrado=true en liquidacion_idadmon e liquidacion_idprop.
//
// GET (lo invoca el cron) -> { ok, congelada|ya_congelada|saltado, mes, ... }

import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )
}

// AAMM (2 dígitos año + 2 mes) del calendario actual en Chile.
function partesChile() {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago', year: '2-digit', month: '2-digit', day: '2-digit',
  })
  const o = {}
  for (const p of f.formatToParts(new Date())) o[p.type] = p.value
  return { aamm: `${o.year}${o.month}`, dia: Number(o.day) }
}

async function estadoMes(sb, mes) {
  const { data, error } = await sb.from('liquidacion_idadmon').select('cerrado').eq('mes', mes)
  if (error) throw new Error('lectura estado: ' + error.message)
  const filas = data || []
  if (filas.length === 0) return { estado: 'vacia', total: 0, cerradas: 0 }
  const cerradas = filas.filter(f => f.cerrado === true).length
  return { estado: cerradas === filas.length ? 'congelada' : 'abierta', total: filas.length, cerradas }
}

export async function GET(req) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization') || ''
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { aamm: mes, dia } = partesChile()

  // Seguridad extra: solo actuar el día 23 (por si el cron se dispara otro día).
  if (dia !== 23) {
    return Response.json({ ok: true, saltado: true, motivo: `Hoy es día ${dia} en Chile, no el 23.`, mes })
  }

  const sb = svc()

  let est
  try { est = await estadoMes(sb, mes) }
  catch (err) { return Response.json({ error: String(err.message || err) }, { status: 500 }) }

  if (est.estado === 'congelada') {
    return Response.json({ ok: true, ya_congelada: true, mes, total: est.total })
  }
  if (est.estado === 'vacia') {
    // No hay foto que congelar: recalcular la creará; seguimos.
  }

  // 1) Recalcular (reusa preparar-mes con auth de cron)
  const origin = new URL(req.url).origin
  const prep = await fetch(`${origin}/api/liquidaciones/preparar-mes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-cron-secret': secret },
    body: JSON.stringify({ mes }),
  })
  const prepJson = await prep.json().catch(() => ({}))
  if (!prep.ok) {
    return Response.json({ error: 'Al recalcular antes de congelar: ' + (prepJson.error || prep.status) }, { status: 500 })
  }

  // 2) Cerrar todas las filas del mes
  const { error: e1, count: c1 } = await sb
    .from('liquidacion_idadmon').update({ cerrado: true }, { count: 'exact' }).eq('mes', mes)
  if (e1) return Response.json({ error: 'cerrar lineas: ' + e1.message }, { status: 500 })

  const { error: e2, count: c2 } = await sb
    .from('liquidacion_idprop').update({ cerrado: true }, { count: 'exact' }).eq('mes', mes)
  if (e2) return Response.json({ error: 'cerrar cabeceras: ' + e2.message }, { status: 500 })

  return Response.json({
    ok: true, congelada: true, auto: true, mes,
    lineas: c1 ?? null, propietarios: c2 ?? null, recalculo: prepJson,
  })
}
