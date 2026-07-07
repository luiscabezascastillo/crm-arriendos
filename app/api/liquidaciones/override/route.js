// app/api/liquidaciones/override/route.js
// Override manual de transferencia (por IDADMON + mes). Solo Direccion (alberto/luis).
// POST { idadmon, mes, monto_x, motivo }  -> upsert
// POST { idadmon, mes, borrar: true }      -> elimina el override (vuelve al calculo automatico)

import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

const OVERRIDE_EMAILS = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com']

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  const rol = session?.user?.role
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!(rol === 'admin' || OVERRIDE_EMAILS.includes(email))) {
    return Response.json({ error: 'Solo Direccion puede ajustar transferencias.' }, { status: 403 })
  }

  let body = {}
  try { body = await req.json() } catch {}
  const idadmon = String(body.idadmon || '').trim()
  const mes = String(body.mes || '').trim()
  if (!idadmon) return Response.json({ error: 'Falta idadmon.' }, { status: 400 })
  if (!/^\d{4}$/.test(mes)) return Response.json({ error: 'Mes invalido (AAMM).' }, { status: 400 })

  const sb = svc()

  // Borrar override -> volver al calculo automatico
  if (body.borrar === true) {
    const { error } = await sb.from('transferencia_override').delete().eq('idadmon', idadmon).eq('mes', mes)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true, borrado: true, idadmon, mes })
  }

  const monto_x = Math.round(Number(body.monto_x))
  if (!Number.isFinite(monto_x)) return Response.json({ error: 'monto_x invalido.' }, { status: 400 })
  const motivo = String(body.motivo || '').trim()
  if (!motivo) return Response.json({ error: 'Falta el motivo.' }, { status: 400 })

  const fila = { idadmon, mes, monto_x, motivo, creado_por: email, creado_at: new Date().toISOString() }
  const { error } = await sb.from('transferencia_override').upsert(fila, { onConflict: 'idadmon,mes' })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, ...fila })
}
