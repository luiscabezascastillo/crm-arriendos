// app/api/cc1/alta/route.js
//
// Alta de un contrato nuevo. Recibe { form } (los campos de datos_arriendos).
// - Anthony/Dirección (responsable): alta directa (pendiente_aprobacion = false).
// - Neika (colaborador): alta en pendiente_aprobacion = true (espera validación).
// - Otros roles: sin permiso.
//
// El IDADMON correlativo se calcula como MAX(idadmon) de datos_arriendos + 1.
// Envía email "00 nuevo" a cambiosdeestado@ y registra en historico_idadmon.

import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { supabaseAdmin, getCapacidades } from '../../../../lib/cc1Permisos'
import { buildSubject, enviarNotificacion } from '../../../../lib/cc1Email'

function siguienteIdadmon(maxId) {
  const m = String(maxId || '').match(/^([A-Za-z]*)(\d+)$/)
  if (!m) return null
  const prefijo = m[1] || 'A'
  const num = parseInt(m[2], 10) + 1
  return prefijo + String(num).padStart(m[2].length, '0')
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })

  const cap = await getCapacidades(email)
  if (!cap.puedeAltaDirecta && !cap.puedeAltaPendiente) {
    return Response.json({ error: 'Sin permiso para dar de alta contratos (requiere responsable o colaborador en Gestión LOG).' }, { status: 403 })
  }

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const form = body?.form || {}

  // Correlativo
  const { data: maxRows } = await supabaseAdmin
    .from('datos_arriendos').select('idadmon').order('idadmon', { ascending: false }).limit(1)
  const nuevoId = siguienteIdadmon(maxRows?.[0]?.idadmon)
  if (!nuevoId) return Response.json({ error: 'No se pudo calcular el correlativo' }, { status: 500 })

  const pendiente = !cap.puedeAltaDirecta  // colaborador -> pendiente; responsable -> directo

  // Construir fila (sin id; idadmon forzado al correlativo; marcas de control)
  const fila = { ...form }
  delete fila.id
  fila.idadmon = nuevoId
  fila.estado = form.estado || 'P'
  fila.pendiente_aprobacion = pendiente
  fila.creado_por = email
  fila.updated_at = new Date().toISOString()

  const { error: e1 } = await supabaseAdmin.from('datos_arriendos').insert([fila])
  if (e1) return Response.json({ error: 'Error al insertar: ' + e1.message }, { status: 500 })

  // Email "00 nuevo" + histórico
  const subject = buildSubject({
    idadmon: nuevoId, estadoNuevo: 'P',
    propietario: fila.propietario, inmueble: fila.inmueble,
    fecha: new Date().toISOString().slice(0, 10),
  })
  await supabaseAdmin.from('historico_idadmon').insert([{
    idadmon: nuevoId, evento: 'creado_P',
    estado_anterior: null, estado_nuevo: fila.estado,
    fecha: new Date().toISOString().slice(0, 10),
    usuario: email, email_subject: subject,
    detalle: pendiente ? 'alta pendiente de aprobación' : 'alta directa',
  }])
  const r = await enviarNotificacion({
    subject: pendiente ? `[PENDIENTE APROBACIÓN] ${subject}` : subject,
  })

  return Response.json({
    ok: true, idadmon: nuevoId, pendiente_aprobacion: pendiente, email_ok: r.ok,
    mensaje: pendiente
      ? `Contrato ${nuevoId} creado, pendiente de aprobación de Anthony.`
      : `Contrato ${nuevoId} creado.`,
  })
}
