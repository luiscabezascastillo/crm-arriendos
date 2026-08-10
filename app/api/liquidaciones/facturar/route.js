// app/api/liquidaciones/facturar/route.js
// VERSION: v2 · 2026-08-10 · UPSERT: si la fila del propietario para el mes NO existe (mes aún no preparado/congelado),
//   se CREA con lo mínimo (mes, idprop) + nombre y tipo_factura tomados de `propietarios`, para poder facturar EN VIVO
//   antes de "Preparar mes". Si ya existe y no está cerrada, se actualiza como siempre. Cerrada -> 409. Hereda v1.
// VERSION: v1 · 2026-07-08 · guarda facturar/comentario por propietario en liquidacion_idprop
// Verificar: Select-String route.js -Pattern "VERSION: v2"
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

  // ¿Existe la fila? maybeSingle -> null si no existe (mes aún no preparado), sin lanzar error.
  const { data: fila, error: eSel } = await sb
    .from('liquidacion_idprop').select('cerrado').eq('mes', mes).eq('idprop', idprop).maybeSingle()
  if (eSel) return Response.json({ error: 'lectura: ' + eSel.message }, { status: 500 })
  if (fila?.cerrado) return Response.json({ error: 'Mes cerrado: no se puede editar.' }, { status: 409 })

  const now = new Date().toISOString()

  // Construir el patch solo con lo que venga.
  const patch = { updated_at: now }
  if (body.facturar !== undefined) {
    const f = String(body.facturar).toUpperCase().trim()
    if (!FACTURAR_VALIDOS.includes(f)) return Response.json({ error: 'facturar debe ser SI/NO/DESPUES/HECHO' }, { status: 400 })
    patch.facturar = f
  }
  if (body.comentario !== undefined) {
    patch.comentario = String(body.comentario)
  }

  if (!fila) {
    // La fila NO existe (mes no preparado): crearla con lo mínimo + tipo/nombre permanentes del propietario,
    // para que facturar/comentario se guarden aunque el mes no esté congelado.
    let prop = null
    try {
      const r = await sb.from('propietarios').select('nombre, tipo_factura').eq('idprop', idprop).maybeSingle()
      prop = r.data || null
    } catch { /* si falla, se crea sin nombre/tipo */ }
    const nueva = {
      mes,
      idprop,
      nombre: prop?.nombre || null,
      tipo_factura: prop?.tipo_factura || null,
      facturar: patch.facturar || 'NO',
      comentario: patch.comentario ?? null,
      cerrado: false,
      created_at: now,
      updated_at: now,
    }
    const { error: eIns } = await sb.from('liquidacion_idprop').insert(nueva)
    if (eIns) return Response.json({ error: 'insert: ' + eIns.message }, { status: 500 })
    return Response.json({ ok: true, creada: true, mes, idprop, ...nueva })
  }

  // La fila existe y no está cerrada: actualizar.
  const { error: eUpd } = await sb
    .from('liquidacion_idprop').update(patch).eq('mes', mes).eq('idprop', idprop)
  if (eUpd) return Response.json({ error: 'update: ' + eUpd.message }, { status: 500 })

  return Response.json({ ok: true, mes, idprop, ...patch })
}
