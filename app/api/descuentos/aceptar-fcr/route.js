// VERSION: v1 · 2026-08-04 · Karina acepta un descuento imputado a FCR como COSTE DE EMPRESA. Exige justificación
//   (mín. 15 car.). Marca fcr_aceptado=true + justificación + quién + cuándo (pasa de rojo a verde en el listado).
//   SOLO Karina. Deja traza en descuentos_bitacora.
// app/api/descuentos/aceptar-fcr/route.js

import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

const KARINA = 'karina.morales@fondocapital.com'

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (email !== KARINA) {
    return Response.json({ error: 'Solo Karina puede aceptar un cargo a FCR como coste de empresa.' }, { status: 403 })
  }

  let body = {}
  try { body = await req.json() } catch {}
  const id = body.id
  const justificacion = String(body.justificacion || '').trim()
  if (!id) return Response.json({ error: 'Falta id del descuento' }, { status: 400 })
  if (justificacion.length < 15) {
    return Response.json({ error: 'La justificación de por qué se acepta como coste de empresa debe tener al menos 15 caracteres.' }, { status: 400 })
  }

  const sb = svc()
  const { data: d, error: eD } = await sb.from('descuentos').select('*').eq('id', id).single()
  if (eD || !d) return Response.json({ error: 'Descuento no encontrado' }, { status: 404 })

  if (String(d.repercutir_a || '').trim().toUpperCase() !== 'FCR') {
    return Response.json({ error: 'Este descuento no está imputado a FCR.' }, { status: 400 })
  }
  if (d.fcr_aceptado) {
    return Response.json({ error: 'Este descuento FCR ya estaba aceptado.', yaAceptado: true }, { status: 409 })
  }

  const now = new Date().toISOString()
  const { data: upd, error: eU } = await sb.from('descuentos')
    .update({ fcr_aceptado: true, fcr_justificacion: justificacion, fcr_aceptado_por: email, fcr_aceptado_at: now })
    .eq('id', id).select().single()
  if (eU) return Response.json({ error: eU.message }, { status: 500 })

  // Bitácora (no rompe si falla)
  try {
    await sb.from('descuentos_bitacora').insert({
      descuento_id: id, num: d.num, accion: 'corregir',
      campo: 'fcr_aceptado', valor_anterior: 'false', valor_nuevo: 'true (coste empresa)', usuario: email,
    })
  } catch {}

  // Resolver la alerta FCR asociada, si existe (la que crea descuentosAlertas)
  try {
    await sb.from('alertas')
      .update({ estado: 'resuelta', resuelta_at: now, resuelta_por: email })
      .eq('origen', 'descuento_fcr').neq('estado', 'resuelta')
      .ilike('tema', `%Nº ${d.num},%`)
  } catch {}

  return Response.json({ ok: true, row: upd })
}
