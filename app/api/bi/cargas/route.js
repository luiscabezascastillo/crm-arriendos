// app/api/bi/cargas/route.js
// Historial de cargas de cartola al BI.
//   GET  -> últimas 10 cargas (para mostrar en la página)
//   POST -> registra una carga hecha con éxito { guardados, total, archivo }

import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export async function GET() {
  const { data, error } = await admin
    .from('bi_cargas')
    .select('id, creado, guardados, total, archivo, usuario')
    .order('creado', { ascending: false })
    .limit(10)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ cargas: data || [] })
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }

  const guardados = parseInt(body?.guardados, 10) || 0
  const total = parseInt(body?.total, 10) || 0
  const archivo = String(body?.archivo || '').slice(0, 200)

  const { error } = await admin.from('bi_cargas').insert({ guardados, total, archivo, usuario: email })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
