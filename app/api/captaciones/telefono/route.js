// VERSION: v1 · 2026-08-12 · app/api/captaciones/telefono/route.js — Pone/corrige el teléfono de una captación.
//   POST { captacion_id, telefono }. Normaliza a +56…; guarda en captaciones.telefono y, si es MÓVIL, en
//   contactos.whatsapp del contacto ligado. Devuelve { display, wa }. Gate: Dirección + Administración.
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin.js'
import { normalizaTelefono } from '../../../../lib/captacionImport.js'

const AUTORIZADOS = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'adalis@fondocapital.com', 'fabiola.guerra@fondocapital.com']

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!AUTORIZADOS.includes(email)) return Response.json({ error: 'Sin permiso.' }, { status: 403 })

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const { captacion_id, telefono } = body || {}
  if (!captacion_id) return Response.json({ error: 'Falta captacion_id' }, { status: 400 })

  const bruto = String(telefono || '').trim()
  const tn = bruto ? normalizaTelefono(bruto) : { valido: false }
  if (bruto && !tn.valido) return Response.json({ error: 'Teléfono no válido: ' + bruto }, { status: 400 })
  const e164 = tn.valido ? tn.e164 : null

  const { data: cap } = await supabaseAdmin.from('captaciones').select('contacto_id').eq('id', captacion_id).maybeSingle()
  if (!cap) return Response.json({ error: 'Captación no encontrada' }, { status: 404 })

  const up = await supabaseAdmin.from('captaciones').update({ telefono: e164, updated_at: new Date().toISOString() }).eq('id', captacion_id)
  if (up.error) return Response.json({ error: up.error.message }, { status: 500 })
  // Si es móvil, refleja en el WhatsApp del contacto.
  if (cap.contacto_id && tn.valido && tn.esMovil) {
    await supabaseAdmin.from('contactos').update({ whatsapp: e164 }).eq('id', cap.contacto_id)
  }

  return Response.json({ ok: true, telefono: tn.valido ? tn.display : '', wa: tn.wa || '' })
}
