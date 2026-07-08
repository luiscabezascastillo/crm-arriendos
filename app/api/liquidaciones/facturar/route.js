// app/api/liquidaciones/facturar/route.js
// VERSION: v1 · 2026-07-08 · guarda facturar/comentario por propietario en liquidacion_idprop
// Verificar: Select-String route.js -Pattern "VERSION: v1"
//
// Edita el estado de facturación de UN propietario en un mes.
// Solo Alberto, Luis, Karina. Solo si el mes NO está cerrado.
// POST { mes, idprop, facturar?, comentario? } -> { ok } | { error }

import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

const EMAILS_OK = [
  'alberto.cabezas@fondocapital.com',
  'luis.cabezas@fondocapital.com',
  'karina.morales@fondocapital.com',
]
const FACTURAR_VALIDOS = ['SI', 'NO', 'DESPUES', 'HECHO']

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
  if (!(rol === 'admin' || EMAILS_OK.includes(email))) {
    return Response.json({ error: 'Sin permiso para editar facturación.' }, { status: 403 })
  }

  let body = {}
  try { body = await req.json() } catch {}
  const mes = String(body.mes || '').trim()
  const idprop = String(body.idprop || '').trim()
  if (!/^\d{4}$/.test(mes) || !idprop) return Response.json({ error: 'mes/idprop invalido' }, { status: 400 })

  const sb = svc()

  // no editar si la fila esta cerrada (sellada)
  const { data: fila, error: eSel } = await sb
    .from('liquidacion_idprop').select('cerrado').eq('mes', mes).eq('idprop', idprop).single()
  if (eSel) return Response.json({ error: 'No existe esa fila: ' + eSel.message }, { status: 404 })
  if (fila?.cerrado) return Response.json({ error: 'Mes cerrado: no se puede editar.' }, { status: 409 })

  // construir patch solo con lo que venga
  const patch = { updated_at: new Date().toISOString() }
  if (body.facturar !== undefined) {
    const f = String(body.facturar).toUpperCase().trim()
    if (!FACTURAR_VALIDOS.includes(f)) return Response.json({ error: 'facturar debe ser SI/NO/DESPUES/HECHO' }, { status: 400 })
    patch.facturar = f
  }
  if (body.comentario !== undefined) {
    patch.comentario = String(body.comentario)
  }

  const { error: eUpd } = await sb
    .from('liquidacion_idprop').update(patch).eq('mes', mes).eq('idprop', idprop)
  if (eUpd) return Response.json({ error: 'update: ' + eUpd.message }, { status: 500 })

  return Response.json({ ok: true, mes, idprop, ...patch })
}
