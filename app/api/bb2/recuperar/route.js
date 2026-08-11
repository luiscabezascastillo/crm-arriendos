// VERSION: v1 · 2026-08-11 · app/api/bb2/recuperar/route.js — Carga una operación BB2 (arriendo) del LOG para la
//   ficha. GET ?id=R00xxx. Devuelve { existe, id, hecho, model }. Solo lectura. Gate: Dirección + Anthony.
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin.js'
import { modelDesdeRaw } from '../../../../lib/bb2Log.js'

const AUTORIZADOS = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'anthony.mendoza@fondocapital.com']

export async function GET(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!AUTORIZADOS.includes(email)) return Response.json({ error: 'Solo Dirección y Anthony pueden ver BB2.' }, { status: 403 })

  const id = String(new URL(req.url).searchParams.get('id') || '').trim()
  if (!id) return Response.json({ error: 'Falta id' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('log').select('id_lcc, raw_data').eq('id_lcc', id).maybeSingle()
  if (error) return Response.json({ error: 'Error leyendo el LOG: ' + error.message }, { status: 500 })
  if (!data) return Response.json({ ok: true, existe: false, id, model: modelDesdeRaw({}) })

  const model = modelDesdeRaw(data.raw_data || {})
  return Response.json({ ok: true, existe: true, id, hecho: model.hecho, hecho_txt: model.hecho_txt, model })
}
