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

// Envía el email. Cuerpo mínimo. No lanza: devuelve {ok, error?} para no romper el flujo.
export async function enviarNotificacion({ subject, cuerpo }) {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,           // info@fondocapital.com
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    })
    await transporter.sendMail({
      from: `"FCR CRM" <${process.env.GMAIL_USER}>`,
      to: GRUPO_NOTIF,
      subject,
      text: cuerpo || subject,
    })
    return { ok: true }
  } catch (err) {
    console.error('[cc1Email] error enviando:', err?.message)
    return { ok: false, error: err?.message }
  }
}
