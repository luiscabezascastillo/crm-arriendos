// VERSION: v1 · 2026-07-12 · app/api/terminos/enviar-email/route.js
//   Envía el email de liquidación de término (ya confirmado/editado por el usuario).
//   cc a administración@. Deja CONSTANCIA en historico_idadmon (quién, a quién, cuándo).
//   Reutiliza enviarNotificacion de lib/cc1Email (to/cc/cuerpo/autor -> replyTo).

import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin.js'
import { enviarNotificacion } from '../../../../lib/cc1Email'

const DIRECCION = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com']
const ADMIN_CC = 'administracion@fondocapital.com'

// ¿Puede enviar? Dirección, o quien PARTICIPE activamente en un proceso de término
// (responsable/supervisor/colaborador). Observador NO envía. Los nodos N16/N17 son de
// Administración (Adalis/Fabiola), por eso no se restringe solo a Karina.
async function puedeEnviar(email) {
  if (DIRECCION.includes(email)) return true
  const { data } = await supabaseAdmin
    .from('proceso_permisos').select('proceso, rol').eq('email', email).eq('activo', true)
  return (data || []).some(p =>
    (p.proceso || '').toLowerCase().includes('termino') &&
    ['responsable', 'supervisor', 'colaborador'].includes((p.rol || '').toLowerCase()))
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!(await puedeEnviar(email))) {
    return Response.json({ error: 'Sin permiso para enviar correos de término (requiere participar en el proceso).' }, { status: 403 })
  }

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const { idadmon, destinatario, to, subject, cuerpo } = body || {}
  if (!idadmon || !to || !subject || !cuerpo) {
    return Response.json({ error: 'Faltan datos (idadmon, to, subject, cuerpo)' }, { status: 400 })
  }
  if (!['arrendatario', 'propietario'].includes(destinatario)) {
    return Response.json({ error: 'destinatario no válido' }, { status: 400 })
  }
  if (!/@/.test(String(to))) return Response.json({ error: 'Email destinatario no válido: ' + to }, { status: 400 })

  // Enviar (info@fondocapital.com, cc administración@, replyTo = quien envía)
  const r = await enviarNotificacion({ subject, to, cc: ADMIN_CC, cuerpo, autor: email })
  if (!r.ok) return Response.json({ error: 'No se pudo enviar: ' + (r.error || 'error desconocido') }, { status: 500 })

  // Constancia en historico_idadmon (no es cambio de estado -> estados en null)
  const evento = destinatario === 'arrendatario'
    ? 'email_liquidacion_arrendatario'
    : 'email_liquidacion_propietario'
  await supabaseAdmin.from('historico_idadmon').insert([{
    idadmon, evento,
    estado_anterior: null, estado_nuevo: null,
    fecha: new Date().toISOString().slice(0, 10),
    usuario: email, email_subject: subject,
    detalle: 'Enviado a ' + to + ' (cc ' + ADMIN_CC + ')',
  }])

  return Response.json({ ok: true, enviadoA: to })
}
