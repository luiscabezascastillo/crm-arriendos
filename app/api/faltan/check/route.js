// app/api/faltan/check/route.js
// VERSION: v1 · 2026-08-13 · Marca "Chequeado" de FALTAN por IDADMON + mes (solo gestión; NO toca datos de la
//   liquidación). Espejo del endpoint de comentarios.
//   GET  ?mes=AAMM                     -> { rows: [{ idadmon }] }  (solo los chequeados del mes)
//   POST { idadmon, mes, chequeado }   -> chequeado=true: upsert · chequeado=false: borra la fila (queda limpio)
//   Escritura restringida a Dirección (alberto/luis) y Administración. Igual que los comentarios.
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

const DIRECCION_EMAILS = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com']

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )
}

function puedeMarcar(session) {
  const email = session?.user?.email
  const rol = session?.user?.role
  return rol === 'administracion' || rol === 'direccion' || rol === 'admin' || DIRECCION_EMAILS.includes(email)
}

// --- GET: los chequeados del mes ---
export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const mes = String(searchParams.get('mes') || '').trim()
  if (!/^\d{4}$/.test(mes)) return Response.json({ error: 'Mes invalido (AAMM).' }, { status: 400 })

  const sb = svc()
  const { data, error } = await sb.from('faltan_check')
    .select('idadmon, actualizado_por, actualizado_at').eq('mes', mes)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ rows: data || [], puedeMarcar: puedeMarcar(session) })
}

// --- POST: marcar/desmarcar ---
export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!puedeMarcar(session)) {
    return Response.json({ error: 'Solo Dirección y Admin pueden marcar chequeados.' }, { status: 403 })
  }

  let body = {}
  try { body = await req.json() } catch {}
  const idadmon = String(body.idadmon || '').trim()
  const mes = String(body.mes || '').trim()
  const chequeado = body.chequeado === true || body.chequeado === 'true'
  if (!idadmon) return Response.json({ error: 'Falta idadmon.' }, { status: 400 })
  if (!/^\d{4}$/.test(mes)) return Response.json({ error: 'Mes invalido (AAMM).' }, { status: 400 })

  const sb = svc()

  // Desmarcar -> borrar la fila (no dejar filas en false)
  if (!chequeado) {
    const { error } = await sb.from('faltan_check').delete().eq('idadmon', idadmon).eq('mes', mes)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true, idadmon, mes, chequeado: false })
  }

  const fila = {
    idadmon, mes, chequeado: true,
    actualizado_por: session.user.email,
    actualizado_at: new Date().toISOString(),
  }
  const { error } = await sb.from('faltan_check').upsert(fila, { onConflict: 'idadmon,mes' })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, ...fila })
}
