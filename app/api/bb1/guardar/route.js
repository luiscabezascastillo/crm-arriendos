// VERSION: v1 · 2026-08-12 · app/api/bb1/guardar/route.js — Guardar borrador / desbloquear de una operación BB1 (VENTA).
//   POST { id, model, accion?, desbloquear? }. Escribe en log.raw_data con claves LIMPIAS (merge no destructivo) +
//   columnas promovidas + updated_at. Respeta el candado HECHO (VBA). `id='nuevo'` inserta con el siguiente V.
//   accion='desbloquear' limpia el HECHO (solo Dirección). Reusa `lib/bb2Log.js`. Gate: Dirección + Anthony. No hace "Terminar".
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin.js'
import { rawDesdeModel, columnasPromovidas, HECHO_RAW_KEY } from '../../../../lib/bb2Log.js'
import { siguienteIdVenta } from '../nuevo-id/route'

const DIRECCION = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com']
const AUTORIZADOS = [...DIRECCION, 'anthony.mendoza@fondocapital.com']
const esHecho = raw => /HECHO/i.test(String(raw?.[HECHO_RAW_KEY] || ''))

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!AUTORIZADOS.includes(email)) return Response.json({ error: 'Solo Dirección y Anthony pueden editar BB1.' }, { status: 403 })

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const accion = body?.accion || 'guardar'
  let id = String(body?.id || '').trim()
  const esNuevo = !id || id.toLowerCase() === 'nuevo'

  // ── DESBLOQUEAR: solo quita el candado HECHO (solo Dirección) ──
  if (accion === 'desbloquear') {
    if (!DIRECCION.includes(email)) return Response.json({ error: 'Solo Dirección puede desbloquear.' }, { status: 403 })
    if (esNuevo) return Response.json({ error: 'No aplica a una operación nueva.' }, { status: 400 })
    const { data: cur } = await supabaseAdmin.from('log').select('raw_data').eq('id_lcc', id).maybeSingle()
    if (!cur) return Response.json({ error: 'No existe ' + id }, { status: 404 })
    const raw = { ...(cur.raw_data || {}), [HECHO_RAW_KEY]: '' }
    const up = await supabaseAdmin.from('log').update({ raw_data: raw, updated_at: new Date().toISOString() }).eq('id_lcc', id)
    if (up.error) return Response.json({ error: up.error.message }, { status: 500 })
    return Response.json({ ok: true, desbloqueado: true, id })
  }

  // ── GUARDAR BORRADOR ──
  if (!body?.model) return Response.json({ error: 'Falta el modelo de datos' }, { status: 400 })
  if (esNuevo) id = await siguienteIdVenta()

  // Por defecto, una operación de BB1 es una venta.
  const model = { ...body.model, tipo: (body.model.tipo && String(body.model.tipo).trim()) || 'venta' }

  const { data: cur } = await supabaseAdmin.from('log').select('raw_data').eq('id_lcc', id).maybeSingle()
  const existe = !!cur
  const rawActual = cur?.raw_data || {}

  if (existe && esHecho(rawActual)) {
    if (!body?.desbloquear) return Response.json({ error: 'La operación ' + id + ' está protegida (HECHO). Desbloquéala para editar.', hecho: true }, { status: 409 })
    if (!DIRECCION.includes(email)) return Response.json({ error: 'Solo Dirección puede editar una operación protegida.' }, { status: 403 })
  }

  const clean = rawDesdeModel(model)
  const rawNuevo = { ...rawActual, ...clean, 'ID-LCC': id }
  if (body?.desbloquear && DIRECCION.includes(email)) rawNuevo[HECHO_RAW_KEY] = ''  // guardar y desbloquear a la vez

  const payload = { id_lcc: id, raw_data: rawNuevo, ...columnasPromovidas(model), updated_at: new Date().toISOString() }
  const res = existe
    ? await supabaseAdmin.from('log').update(payload).eq('id_lcc', id)
    : await supabaseAdmin.from('log').insert(payload)
  if (res.error) return Response.json({ error: 'No se pudo guardar: ' + res.error.message }, { status: 500 })

  return Response.json({ ok: true, id, nuevo: !existe })
}
