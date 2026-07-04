// app/api/descuentos/anular/route.js
// ANULAR un descuento: escribe mes_a_imputar='ANULADO' en el registro con ese Núm.
// Al dejar de coincidir con ningún mes de liquidación, queda excluido automáticamente
// de TRANSFER/CARTAS/EMAILS/FALTAN (esas vistas filtran por mes_a_imputar = 'MES AAAA').
// Acceso: SOLO Dirección (Luis, Alberto) y Karina.
// GET -> { puede }   ·   POST { num } -> anula

import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const GESTORES = [
  'luis.cabezas@fondocapital.com',
  'alberto.cabezas@fondocapital.com',
  'karina.morales@fondocapital.com',
]

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function emailSesion() {
  const s = await getServerSession(authOptions)
  return s?.user?.email || ''
}

export async function GET() {
  const email = await emailSesion()
  return Response.json({ puede: GESTORES.includes(email) })
}

export async function POST(req) {
  const email = await emailSesion()
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!GESTORES.includes(email)) return Response.json({ error: 'Solo Dirección y Karina pueden anular' }, { status: 403 })

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const num = parseInt(String(body?.num ?? '').replace(/\D/g, ''), 10)
  if (!num) return Response.json({ error: 'Falta el Núm del descuento' }, { status: 400 })

  const { data, error } = await admin
    .from('descuentos')
    .update({ mes_a_imputar: 'ANULADO' })
    .eq('num', num)
    .select('num, idadmon, propietario')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!data || data.length === 0) return Response.json({ error: `No existe el descuento Núm ${num}` }, { status: 404 })

  return Response.json({ ok: true, num, anulados: data.length, registro: data[0] })
}
