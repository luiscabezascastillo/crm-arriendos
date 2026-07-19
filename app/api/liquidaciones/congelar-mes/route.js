// ═══════════════════════════════════════════════════════════════
// VERSION: v1  ·  2026-07-19  ·  Congelar (cerrar) un mes completo
// Para verificar tras copiar:  Select-String route.js -Pattern "VERSION: v1"
// ═══════════════════════════════════════════════════════════════
// app/api/liquidaciones/congelar-mes/route.js
//
// Congela un mes: (1) comprueba si YA esta congelado -> avisa y no toca nada.
//   (2) si no, RECALCULA llamando al endpoint preparar-mes (Opcion B: refresca
//       las filas NO cerradas con el calculo actual, respeta las ya cerradas),
//   (3) pone cerrado=true en TODAS las filas del mes (idadmon e idprop).
// Tras congelar, preparar-mes ya no podra recalcular ese mes (respeta cerrado=true).
//
// Reversible solo por SQL:  update liquidacion_idadmon set cerrado=false where mes='AAMM';
//                           update liquidacion_idprop  set cerrado=false where mes='AAMM';
//
// POST { mes }        -> congela (recalcula + cierra)
// POST { mes, check:true } -> solo consulta si esta congelado (para el indicador visual)
//
// Respuestas:
//   { ok:true, ya_congelada:true, mes }                 -> ya estaba congelada
//   { ok:true, congelada:true, mes, lineas, propietarios } -> congelada ahora
//   { ok:true, estado:'congelada'|'abierta'|'vacia', mes } -> respuesta a check

import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

// Mismos permisos que preparar-mes: Direccion (admin) + los 3 emails.
const CONGELAR_EMAILS = [
  'alberto.cabezas@fondocapital.com',
  'luis.cabezas@fondocapital.com',
  'karina.morales@fondocapital.com',
]

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )
}

// Devuelve 'congelada' | 'abierta' | 'vacia' segun el estado de las filas del mes.
async function estadoMes(sb, mes) {
  const { data, error } = await sb
    .from('liquidacion_idadmon')
    .select('cerrado')
    .eq('mes', mes)
  if (error) throw new Error('lectura estado: ' + error.message)
  const filas = data || []
  if (filas.length === 0) return { estado: 'vacia', total: 0, cerradas: 0 }
  const cerradas = filas.filter(f => f.cerrado === true).length
  // 'congelada' solo si TODAS estan cerradas
  const estado = cerradas === filas.length ? 'congelada' : 'abierta'
  return { estado, total: filas.length, cerradas }
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  const rol = session?.user?.role
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!(rol === 'admin' || CONGELAR_EMAILS.includes(email))) {
    return Response.json({ error: 'Solo Direccion y Karina pueden congelar el mes.' }, { status: 403 })
  }

  let body = {}
  try { body = await req.json() } catch {}
  const mes = String(body.mes || '').trim()
  if (!/^\d{4}$/.test(mes)) return Response.json({ error: 'Mes invalido (AAMM).' }, { status: 400 })

  const sb = svc()

  // ── Modo CHECK: solo informar el estado (para el indicador visual del candado) ──
  if (body.check === true) {
    try {
      const e = await estadoMes(sb, mes)
      return Response.json({ ok: true, mes, ...e })
    } catch (err) {
      return Response.json({ error: String(err.message || err) }, { status: 500 })
    }
  }

  // ── 1) ¿Ya esta congelada? -> avisar y NO tocar nada ──────────────────────
  let est
  try { est = await estadoMes(sb, mes) }
  catch (err) { return Response.json({ error: String(err.message || err) }, { status: 500 }) }

  if (est.estado === 'congelada') {
    return Response.json({ ok: true, ya_congelada: true, mes, total: est.total })
  }

  // ── 2) RECALCULAR (Opcion B): reusar el endpoint preparar-mes ─────────────
  // Llamada interna: mismas cookies (para que getServerSession valide al usuario).
  const origin = new URL(req.url).origin
  const prep = await fetch(`${origin}/api/liquidaciones/preparar-mes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: req.headers.get('cookie') || '',
    },
    body: JSON.stringify({ mes }),
  })
  const prepJson = await prep.json().catch(() => ({}))
  if (!prep.ok) {
    return Response.json(
      { error: 'Al recalcular antes de congelar: ' + (prepJson.error || prep.status) },
      { status: 500 }
    )
  }

  // ── 3) CERRAR: poner cerrado=true a TODAS las filas del mes ────────────────
  const { error: e1, count: c1 } = await sb
    .from('liquidacion_idadmon')
    .update({ cerrado: true }, { count: 'exact' })
    .eq('mes', mes)
  if (e1) return Response.json({ error: 'cerrar lineas: ' + e1.message }, { status: 500 })

  const { error: e2, count: c2 } = await sb
    .from('liquidacion_idprop')
    .update({ cerrado: true }, { count: 'exact' })
    .eq('mes', mes)
  if (e2) return Response.json({ error: 'cerrar cabeceras: ' + e2.message }, { status: 500 })

  return Response.json({
    ok: true,
    congelada: true,
    mes,
    lineas: c1 ?? null,
    propietarios: c2 ?? null,
    recalculo: prepJson,
  })
}
