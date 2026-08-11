// VERSION: v3 · 2026-08-11 · app/api/terminos/enviar-email/route.js
//   NOVEDAD v3: ADJUNTOS. Admite `adjuntos` = [{ url, nombre }] para adjuntar al correo los PDF definitivos
//   ya generados (liquidación del arrendatario / del propietario, presupuesto). Se validan CONTRA nuestro
//   bucket público de Supabase (evita que se cuele una URL externa: nodemailer descarga el `path` en el
//   servidor). Funciona igual en modo PRUEBA (para ver el adjunto antes de enviarlo de verdad). Hereda v2.
//   v2: MODO PRUEBA (test:true) a `toTest`, "[PRUEBA]" en asunto, sin copia ni histórico; COPIA AL AVAL en el
//   correo real del ARRENDATARIO; pueden enviar Dirección + Karina + Adalis + Fabiola o quien participe en el
//   proceso. El "quién" (autor/replyTo) sale SIEMPRE de la sesión. Hereda v1 (cc administración@, histórico).
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin.js'
import { enviarNotificacion } from '../../../../lib/cc1Email'

const DIRECCION = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com']
const ADMIN_CC = 'administracion@fondocapital.com'
// Administración (nodos N16/N17) y Finanzas: pueden enviar los correos de liquidación de término.
const ENVIADORES_EXTRA = ['karina.morales@fondocapital.com', 'adalis@fondocapital.com', 'fabiola.guerra@fondocapital.com']

// Solo se admiten adjuntos alojados en NUESTRO bucket público de Supabase (los PDF que genera el propio CRM).
// nodemailer descarga el `path` en el servidor, así que restringimos el origen para no exponerlo a URLs externas.
const STORAGE_PREFIX = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/+$/, '') + '/storage/v1/object/public/'
function construirAdjuntos(adjuntos) {
  if (!Array.isArray(adjuntos) || !adjuntos.length) return { list: null, error: null }
  const list = []
  for (const a of adjuntos) {
    const url = String(a?.url || a?.path || '').trim()
    if (!url) continue
    if (!/^https:\/\//i.test(url) || (STORAGE_PREFIX.length > 30 && !url.startsWith(STORAGE_PREFIX))) {
      return { list: null, error: 'Adjunto no permitido (debe ser un PDF generado por el CRM): ' + url }
    }
    const nombre = String(a?.nombre || a?.filename || 'documento.pdf').replace(/[^\w.\- ]/g, '').trim() || 'documento.pdf'
    list.push({ filename: /\.pdf$/i.test(nombre) ? nombre : nombre + '.pdf', path: url })
  }
  return { list: list.length ? list : null, error: null }
}

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
  const { idadmon, destinatario, to, subject, cuerpo, test, toTest, adjuntos } = body || {}
  if (!idadmon || !subject || !cuerpo) {
    return Response.json({ error: 'Faltan datos (idadmon, subject, cuerpo)' }, { status: 400 })
  }
  if (!['arrendatario', 'propietario'].includes(destinatario)) {
    return Response.json({ error: 'destinatario no válido' }, { status: 400 })
  }
  const esPrueba = !!test
  const { list: attachments, error: advErr } = construirAdjuntos(adjuntos)
  if (advErr) return Response.json({ error: advErr }, { status: 400 })

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

  const r = await enviarNotificacion({ subject: subjectFinal, to: toFinal, cc: ccFinal, cuerpo, autor: email, attachments })
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
      detalle: 'Enviado a ' + toFinal + (ccTxt ? ' (cc ' + ccTxt + ')' : '') + (attachments ? ' · ' + attachments.length + ' adjunto(s): ' + attachments.map(a => a.filename).join(', ') : ''),
    }])
  }

  return Response.json({ ok: true, enviadoA: toFinal, cc: ccFinal, test: esPrueba })
}
