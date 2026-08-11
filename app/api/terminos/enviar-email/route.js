// VERSION: v2 · 2026-08-11 · app/api/terminos/enviar-email/route.js
//   Envía el email de liquidación de término. NOVEDADES v2:
//   · MODO PRUEBA (test:true): va SOLO a la dirección `toTest` que elija quien envía (o a su propio correo),
//     con "[PRUEBA]" en el asunto, SIN copia y SIN dejar constancia en histórico. Sirve para ver ambas visiones
//     (arrendatario/propietario) sin tocar al destinatario real.
//   · COPIA AL AVAL: en el correo real del ARRENDATARIO se añade en copia el email del aval (si lo hay).
//   · Pueden enviar: Dirección + Karina + Adalis + Fabiola (Administración, nodos N16/N17), o quien participe
//     activamente en el proceso de término.
//   El "quién" (autor/replyTo) sale SIEMPRE de la sesión del servidor. Hereda v1 (cc administración@, histórico).
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin.js'
import { enviarNotificacion } from '../../../../lib/cc1Email'

const DIRECCION = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com']
const ADMIN_CC = 'administracion@fondocapital.com'
// Administración (nodos N16/N17) y Finanzas: pueden enviar los correos de liquidación de término.
const ENVIADORES_EXTRA = ['karina.morales@fondocapital.com', 'adalis@fondocapital.com', 'fabiola.guerra@fondocapital.com']

async function puedeEnviar(email) {
  if (DIRECCION.includes(email) || ENVIADORES_EXTRA.includes(email)) return true
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
  const { idadmon, destinatario, to, subject, cuerpo, test, toTest } = body || {}
  if (!idadmon || !subject || !cuerpo) {
    return Response.json({ error: 'Faltan datos (idadmon, subject, cuerpo)' }, { status: 400 })
  }
  if (!['arrendatario', 'propietario'].includes(destinatario)) {
    return Response.json({ error: 'destinatario no válido' }, { status: 400 })
  }
  const esPrueba = !!test

  // Destinatario final + copias
  let toFinal, ccFinal = null, subjectFinal = subject
  if (esPrueba) {
    // Prueba: a donde el usuario indique (o a su propio correo). Sin copias. Marca [PRUEBA].
    toFinal = (toTest && /@/.test(String(toTest))) ? String(toTest).trim() : email
    subjectFinal = '[PRUEBA] ' + subject
  } else {
    if (!to || !/@/.test(String(to))) return Response.json({ error: 'Email destinatario no válido: ' + (to || '') }, { status: 400 })
    toFinal = String(to).trim()
    ccFinal = ADMIN_CC
    if (destinatario === 'arrendatario') {
      const { data: arr } = await supabaseAdmin
        .from('datos_arriendos').select('mail_avalista, email_avalista, mail_aval').eq('idadmon', idadmon).maybeSingle()
      const avalEmail = String(arr?.mail_avalista || arr?.email_avalista || arr?.mail_aval || '').trim()
      if (avalEmail && /@/.test(avalEmail)) ccFinal = [ADMIN_CC, avalEmail]
    }
  }
  if (!/@/.test(String(toFinal))) return Response.json({ error: 'Email de envío no válido: ' + toFinal }, { status: 400 })

  const r = await enviarNotificacion({ subject: subjectFinal, to: toFinal, cc: ccFinal, cuerpo, autor: email })
  if (!r.ok) return Response.json({ error: 'No se pudo enviar: ' + (r.error || 'error desconocido') }, { status: 500 })

  // Constancia SOLO en envío real (las pruebas no dejan rastro).
  if (!esPrueba) {
    const evento = destinatario === 'arrendatario' ? 'email_liquidacion_arrendatario' : 'email_liquidacion_propietario'
    const ccTxt = Array.isArray(ccFinal) ? ccFinal.join(', ') : (ccFinal || '')
    await supabaseAdmin.from('historico_idadmon').insert([{
      idadmon, evento,
      estado_anterior: null, estado_nuevo: null,
      fecha: new Date().toISOString().slice(0, 10),
      usuario: email, email_subject: subject,
      detalle: 'Enviado a ' + toFinal + (ccTxt ? ' (cc ' + ccTxt + ')' : ''),
    }])
  }

  return Response.json({ ok: true, enviadoA: toFinal, cc: ccFinal, test: esPrueba })
}
