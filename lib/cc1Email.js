// lib/cc1Email.js
// Envío de notificaciones de cambio de estado a cambiosdeestado@fondocapital.com
// Reutiliza Nodemailer con info@fondocapital.com (igual que /api/email-deudores).
//
// Subjects codificados (según tabla de procesos de la empresa):
//   P        -> "A00xxx 00 nuevo (propietario) (inmueble)"
//   S        -> "A00xxx 11 inicio-contrato (dd/mm/aaaa)"
//   SQ       -> "A00xxx 14 notificación-término (dd/mm/aaaa)"
//   Q        -> "A00xxx 15 término (dd/mm/aaaa)"
//   N        -> "A00xxx 21 cierre-término"
//   N-DICOM  -> "A00xxx 22 cierre-término-dicom"
//
// NOTA sobre el remitente: el correo SALE siempre desde info@fondocapital.com
// (es la cuenta autenticada en Gmail). NO se puede falsificar el "from" para que
// aparezca como la persona que hizo el cambio sin delegación de dominio en Google
// Workspace. En su lugar:
//   - replyTo = email del autor  -> si alguien responde, le llega al autor.
//   - el cuerpo indica explícitamente quién hizo el cambio + datos del contrato.
//
// AMPLIACIÓN (facturación): enviarNotificacion acepta ahora 3 parámetros OPCIONALES:
//   - to    -> destinatario(s) alternativo(s). Si no se pasa, va a cambiosdeestado@ (igual que siempre).
//   - cc    -> copia(s).
//   - html  -> cuerpo HTML (si se pasa, el correo se manda en texto + html).
// Sin estos parámetros el comportamiento es EXACTAMENTE el de antes.

import nodemailer from 'nodemailer'

export const GRUPO_NOTIF = 'cambiosdeestado@fondocapital.com'

function ddmmaaaa(fecha) {
  // fecha: 'YYYY-MM-DD' o Date -> 'dd/mm/aaaa'
  if (!fecha) return new Date().toLocaleDateString('es-CL')
  const d = (fecha instanceof Date) ? fecha : new Date(fecha + 'T00:00:00')
  if (isNaN(d)) return String(fecha)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const aa = d.getFullYear()
  return `${dd}/${mm}/${aa}`
}

// Texto legible del estado (para el cuerpo).
function nombreEstado(e) {
  switch (e) {
    case 'P': return 'P (vacío / búsqueda de arrendatario)'
    case 'S': return 'S (activo)'
    case 'SQ': return 'SQ (notificación de término)'
    case 'Q': return 'Q (en término)'
    case 'N': return 'N (cierre)'
    case 'N-DICOM': return 'N-DICOM (cierre con DICOM)'
    case 'Inactiva': return 'Inactiva'
    default: return e || '—'
  }
}

// Construye el subject según el estado destino.
export function buildSubject({ idadmon, estadoNuevo, propietario, inmueble, fecha }) {
  const f = ddmmaaaa(fecha)
  switch (estadoNuevo) {
    case 'P':
      return `${idadmon} 00 nuevo (${propietario || ''}) (${inmueble || ''})`
    case 'S':
      return `${idadmon} 11 inicio-contrato (${f})`
    case 'SQ':
      return `${idadmon} 14 notificación-término (${f})`
    case 'Q':
      return `${idadmon} 15 término (${f})`
    case 'N':
      return `${idadmon} 21 cierre-término`
    case 'N-DICOM':
      return `${idadmon} 22 cierre-término-dicom`
    default:
      return `${idadmon} cambio de estado -> ${estadoNuevo}`
  }
}

// Construye un cuerpo de texto legible con todos los datos del cambio.
function buildCuerpo({ idadmon, estadoAnterior, estadoNuevo, propietario, inmueble, fecha, autor, esCreacionP, idadmonOrigen }) {
  const lineas = []
  if (esCreacionP) {
    lineas.push('Se ha creado automáticamente un nuevo IDADMON en estado P (búsqueda de arrendatario).')
    lineas.push('')
    lineas.push(`IDADMON nuevo : ${idadmon}`)
    if (idadmonOrigen) lineas.push(`Originado por : ${idadmonOrigen} (pasó a notificación de término)`)
  } else {
    lineas.push('Se ha registrado un cambio de estado de contrato.')
    lineas.push('')
    lineas.push(`IDADMON       : ${idadmon}`)
    lineas.push(`Estado        : ${nombreEstado(estadoAnterior)}  ->  ${nombreEstado(estadoNuevo)}`)
  }
  lineas.push(`Propietario   : ${propietario || '—'}`)
  lineas.push(`Inmueble      : ${inmueble || '—'}`)
  lineas.push(`Fecha         : ${ddmmaaaa(fecha)}`)
  lineas.push(`Realizado por : ${autor || '—'}`)
  lineas.push('')
  lineas.push('—')
  lineas.push('Mensaje automático del CRM FCR. Para responder a quien hizo el cambio, usa "Responder" (reply-to configurado).')
  return lineas.join('\n')
}

// Envía el email. No lanza: devuelve {ok, error?} para no romper el flujo del circuito.
// Parámetros:
//   subject        (obligatorio) -> asunto ya codificado (buildSubject)
//   autor          -> email de quien hizo el cambio (va a replyTo + cuerpo)
//   idadmon, estadoAnterior, estadoNuevo, propietario, inmueble, fecha -> para el cuerpo
//   esCreacionP    -> true cuando el correo es del nuevo P creado automáticamente
//   idadmonOrigen  -> IDADMON que originó el P (solo en creación)
//   cuerpo         -> si se pasa, se usa tal cual (override manual); si no, se construye
//   to             -> (OPCIONAL) destinatario alternativo; si no, GRUPO_NOTIF (cambiosdeestado@)
//   cc             -> (OPCIONAL) copia
//   html           -> (OPCIONAL) cuerpo HTML (se añade junto al texto)
export async function enviarNotificacion({
  subject, autor,
  idadmon, estadoAnterior, estadoNuevo, propietario, inmueble, fecha,
  esCreacionP = false, idadmonOrigen = null,
  cuerpo,
  to, cc, html,
}) {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,           // info@fondocapital.com
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    })

    const texto = cuerpo || buildCuerpo({
      idadmon, estadoAnterior, estadoNuevo, propietario, inmueble, fecha, autor,
      esCreacionP, idadmonOrigen,
    })

    const mail = {
      from: `"FCR CRM" <${process.env.GMAIL_USER}>`,
      to: to || GRUPO_NOTIF,        // por defecto, mismo destinatario de siempre
      subject,
      text: texto,
    }
    if (cc) mail.cc = cc
    if (html) mail.html = html
    // replyTo solo si tenemos un autor válido (para que "Responder" vaya a la persona).
    if (autor && /@/.test(autor)) mail.replyTo = autor

    await transporter.sendMail(mail)
    return { ok: true }
  } catch (err) {
    console.error('[cc1Email] error enviando:', err?.message)
    return { ok: false, error: err?.message }
  }
}
