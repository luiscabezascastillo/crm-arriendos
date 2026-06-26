// app/api/cc1/aprobar-alta/route.js
//
// Aprobar o rechazar un alta pendiente. Solo responsable/Dirección (Anthony).
// Recibe { idadmon, accion: 'aprobar' | 'rechazar' }.
//  - aprobar  -> pendiente_aprobacion = false
//  - rechazar -> borra la fila (era un alta que no se valida)

import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { supabaseAdmin, getCapacidades } from '../../../../lib/cc1Permisos'

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })

  const cap = await getCapacidades(email)
  if (!cap.puedeAprobar) {
    return Response.json({ error: 'Sin permiso para aprobar altas (requiere responsable en Gestión LOG).' }, { status: 403 })
  }

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const { idadmon, accion } = body || {}
  if (!idadmon || !['aprobar', 'rechazar'].includes(accion)) {
    return Response.json({ error: 'Faltan idadmon o acción válida (aprobar|rechazar)' }, { status: 400 })
  }

  if (accion === 'aprobar') {
    const { error } = await supabaseAdmin
      .from('datos_arriendos')
      .update({ pendiente_aprobacion: false, updated_at: new Date().toISOString() })
      .eq('idadmon', idadmon)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    await supabaseAdmin.from('historico_idadmon').insert([{
      idadmon, evento: 'cambio_estado', estado_anterior: null, estado_nuevo: null,
      fecha: new Date().toISOString().slice(0, 10), usuario: email,
      detalle: 'alta aprobada por ' + email,
    }])
    return Response.json({ ok: true, mensaje: `Alta ${idadmon} aprobada.` })
  }

  // rechazar -> borrar la fila pendiente
  const { error } = await supabaseAdmin
    .from('datos_arriendos').delete()
    .eq('idadmon', idadmon).eq('pendiente_aprobacion', true)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, mensaje: `Alta ${idadmon} rechazada y eliminada.` })
}
