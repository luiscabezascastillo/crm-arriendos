// app/api/cc1/registrar-correccion/route.js
//
// Registra una corrección excepcional de un contrato activo en historico_idadmon.
// El guardado de los datos lo hace la página (update normal); este endpoint solo
// deja el RASTRO: quién, cuándo, sobre qué IDADMON y con qué motivo.
//
// Solo responsable (Anthony) o Dirección. Recibe { idadmon, motivo }.

import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { supabaseAdmin, getCapacidades } from '../../../../lib/cc1Permisos'

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })

  const cap = await getCapacidades(email)
  if (!cap.puedeAprobar) {
    return Response.json({ error: 'Solo Anthony o Dirección pueden hacer correcciones excepcionales.' }, { status: 403 })
  }

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const { idadmon, motivo } = body || {}
  if (!idadmon) return Response.json({ error: 'Falta idadmon' }, { status: 400 })
  if (!motivo || String(motivo).trim().length < 5) {
    return Response.json({ error: 'Hace falta un motivo.' }, { status: 400 })
  }

  // Estado actual del contrato (para dejarlo en el registro)
  const { data: contrato } = await supabaseAdmin
    .from('datos_arriendos').select('estado').eq('idadmon', idadmon).single()

  const { error } = await supabaseAdmin.from('historico_idadmon').insert([{
    idadmon,
    evento: 'correccion_excepcional',
    estado_anterior: contrato?.estado ?? null,
    estado_nuevo: contrato?.estado ?? null,
    fecha: new Date().toISOString().slice(0, 10),
    usuario: email,
    detalle: `Corrección excepcional de contrato activo. Motivo: ${String(motivo).trim()}`,
  }])

  if (error) return Response.json({ error: 'Error al registrar: ' + error.message }, { status: 500 })
  return Response.json({ ok: true })
}
