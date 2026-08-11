// VERSION: v1 · 2026-08-11 · app/api/bb2/nuevo-id/route.js — Siguiente Id de arriendo disponible (máx R% + 1),
//   formato R00xxx. GET. Gate: Dirección + Anthony. No escribe nada (solo calcula).
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin.js'

const AUTORIZADOS = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'anthony.mendoza@fondocapital.com']

export async function siguienteIdArriendo() {
  const { data } = await supabaseAdmin
    .from('log').select('id_lcc').ilike('id_lcc', 'R%').order('id_lcc', { ascending: false }).limit(1)
  const ult = data && data[0] ? String(data[0].id_lcc) : 'R00000'
  const num = parseInt(ult.replace(/\D/g, ''), 10) || 0
  return 'R' + String(num + 1).padStart(5, '0')
}

export async function GET() {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!AUTORIZADOS.includes(email)) return Response.json({ error: 'Solo Dirección y Anthony pueden ver BB2.' }, { status: 403 })
  return Response.json({ ok: true, siguiente: await siguienteIdArriendo() })
}
