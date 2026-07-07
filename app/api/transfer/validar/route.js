// app/api/transfer/validar/route.js
// Validación de transferencias por propietario+mes. Marcan Alberto y Administración.
// GET  ?mes=AAMM                       -> { rows:[{idprop, validado, validado_por, validado_at}], puede }
// POST { idprop, mes, validado:true|false } -> upsert (con traza de quién y cuándo)

import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

const DIRECCION_EMAILS = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com']

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
}
function puede(session) {
  const e = session?.user?.email, r = session?.user?.role
  return r === 'direccion' || r === 'administracion' || r === 'admin' || DIRECCION_EMAILS.includes(e)
}

export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const mes = String(searchParams.get('mes') || '').trim()
  if (!/^\d{4}$/.test(mes)) return Response.json({ error: 'Mes inválido (AAMM).' }, { status: 400 })
  const sb = svc()
  const { data, error } = await sb.from('transfer_validacion')
    .select('idprop, validado, validado_por, validado_at').eq('mes', mes)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ rows: data || [], puede: puede(session) })
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!puede(session)) return Response.json({ error: 'Solo Dirección y Administración pueden validar.' }, { status: 403 })

  let body = {}
  try { body = await req.json() } catch {}
  const idprop = String(body.idprop || '').trim()
  const mes = String(body.mes || '').trim()
  const validado = body.validado !== false   // por defecto true
  if (!idprop) return Response.json({ error: 'Falta idprop.' }, { status: 400 })
  if (!/^\d{4}$/.test(mes)) return Response.json({ error: 'Mes inválido (AAMM).' }, { status: 400 })

  const sb = svc()
  const fila = { idprop, mes, validado, validado_por: email, validado_at: new Date().toISOString() }
  const { data, error } = await sb.from('transfer_validacion').upsert(fila, { onConflict: 'idprop,mes' }).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, ...data })
}
