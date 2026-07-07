// app/api/faltan/comentario/route.js
// Comentarios internos de FALTAN (morosidad), por IDADMON + mes.
// GET  ?mes=AAMM         -> { rows: [{ idadmon, comentario, actualizado_por, actualizado_at }] }
// POST { idadmon, mes, comentario } -> upsert (un comentario por idadmon+mes)
// Escritura restringida a Direccion (alberto/luis) y Admin. Karina NO escribe aqui.

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

function puedeComentar(session) {
  const email = session?.user?.email
  const rol = session?.user?.role
  return rol === 'admin' || DIRECCION_EMAILS.includes(email)
}

// --- GET: leer comentarios del mes ---
export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const mes = String(searchParams.get('mes') || '').trim()
  if (!/^\d{4}$/.test(mes)) return Response.json({ error: 'Mes invalido (AAMM).' }, { status: 400 })

  const sb = svc()
  const { data, error } = await sb.from('faltan_comentarios')
    .select('idadmon, comentario, actualizado_por, actualizado_at').eq('mes', mes)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ rows: data || [], puedeComentar: puedeComentar(session) })
}

// --- POST: guardar (upsert) un comentario ---
export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!puedeComentar(session)) {
    return Response.json({ error: 'Solo Direccion y Admin pueden escribir comentarios en FALTAN.' }, { status: 403 })
  }

  let body = {}
  try { body = await req.json() } catch {}
  const idadmon = String(body.idadmon || '').trim()
  const mes = String(body.mes || '').trim()
  const comentario = String(body.comentario ?? '').trim()
  if (!idadmon) return Response.json({ error: 'Falta idadmon.' }, { status: 400 })
  if (!/^\d{4}$/.test(mes)) return Response.json({ error: 'Mes invalido (AAMM).' }, { status: 400 })

  const sb = svc()

  // Comentario vacio -> borrar la fila (no dejar filas en blanco)
  if (comentario === '') {
    const { error } = await sb.from('faltan_comentarios').delete().eq('idadmon', idadmon).eq('mes', mes)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true, idadmon, mes, comentario: '', actualizado_por: session.user.email })
  }

  const fila = {
    idadmon, mes, comentario,
    actualizado_por: session.user.email,
    actualizado_at: new Date().toISOString(),
  }
  const { error } = await sb.from('faltan_comentarios').upsert(fila, { onConflict: 'idadmon,mes' })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, ...fila })
}
