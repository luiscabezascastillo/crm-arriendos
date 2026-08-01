// VERSION: v3 · 2026-08-01 · ENDPOINT REFORZADO: registra en logs (Vercel) el resultado correo a correo
//   (idadmon + accepted/rejected + código SMTP o error de Gmail), devuelve ese detalle para que la página
//   SOLO marque como enviado lo que Gmail aceptó, mantiene CCO (bcc) a info@ y pausa entre correos
//   para no disparar el límite de ráfaga de Gmail. Verificar tras copiar: Select-String route.js -Pattern "VERSION: v3"
import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { plantillaArriendo, asuntoArriendo, splitEmails } from '@/lib/notifPlantilla'

// Copia de archivo (CCO): cada correo real deja copia aquí.
const BCC_ARCHIVO = 'info@fondocapital.com'

// Pausa entre correos (ms) para no gatillar el rate-limit de Gmail en ráfaga.
const PAUSA_ENTRE_CORREOS_MS = 400
const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

// Mismo transporte que el resto de correos del CRM.
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

const norm = (s) => String(s || '').trim().toLowerCase()

export async function POST(request) {
  try {
    const { mes, mesLabel, valorUf, cc, emailOverride, notificaciones, notaCorreccion } = await request.json()

    if (!Array.isArray(notificaciones) || notificaciones.length === 0) {
      return NextResponse.json({ error: 'No hay notificaciones que enviar' }, { status: 400 })
    }

    const ctx = { mes, mesLabel, valorUf, notaCorreccion: notaCorreccion || '' }
    const asunto = asuntoArriendo(mesLabel)
    const esPrueba = !!emailOverride
    let enviados = 0
    let errores = 0
    const detalle = []

    console.log(`[notif-enviar] INICIO mes=${mesLabel} n=${notificaciones.length} prueba=${esPrueba} remitente=${process.env.GMAIL_USER || '(sin GMAIL_USER)'}`)

    let i = 0
    for (const n of notificaciones) {
      i++
      const destinatarios = emailOverride
        ? [emailOverride]
        : (Array.isArray(n.destinatarios) && n.destinatarios.length
            ? n.destinatarios
            : splitEmails(n.mail_arrendatario))

      if (destinatarios.length === 0) {
        errores++
        console.error(`[notif-enviar] SIN-EMAIL ${n.idadmon}`)
        detalle.push({ ok: false, idadmon: n.idadmon, error: 'sin email' })
        continue
      }

      const html = plantillaArriendo(n, ctx)

      try {
        const info = await transporter.sendMail({
          from: `"Fondo Capital" <${process.env.GMAIL_USER}>`,
          to: destinatarios.join(', '),
          cc: cc || undefined,
          bcc: esPrueba ? undefined : BCC_ARCHIVO,   // CCO de archivo a info@ (no en pruebas)
          subject: asunto,
          html,
        })

        const accepted = (info && info.accepted) || []
        const rejected = (info && info.rejected) || []
        const smtp = (info && info.response) || ''
        const acc = accepted.map(norm)
        // ¿Gmail aceptó (250) al menos a un destinatario del arrendatario?
        const okDest = destinatarios.some((d) => acc.includes(norm(d)))

        if (okDest) {
          enviados++
          console.log(`[notif-enviar] OK ${n.idadmon} -> ${destinatarios.join(',')} | msgId=${info.messageId} | smtp=${smtp} | accepted=${accepted.length} rejected=${rejected.length}`)
          detalle.push({
            ok: true, idadmon: n.idadmon, email: destinatarios.join(', '), html,
            messageId: info.messageId || null, smtp, accepted, rejected,
          })
        } else {
          errores++
          console.error(`[notif-enviar] RECHAZADO ${n.idadmon} -> ${destinatarios.join(',')} | smtp=${smtp} | rejected=${JSON.stringify(rejected)}`)
          detalle.push({
            ok: false, idadmon: n.idadmon,
            error: `Gmail no aceptó al destinatario (smtp=${smtp || 's/r'}, rechazados=${JSON.stringify(rejected)})`,
          })
        }
      } catch (err) {
        errores++
        console.error(`[notif-enviar] ERROR ${n.idadmon} -> ${destinatarios.join(',')} | ${err && err.message}`)
        detalle.push({ ok: false, idadmon: n.idadmon, error: (err && err.message) || 'error de envío' })
      }

      // Pausa entre correos (salvo tras el último) para suavizar la ráfaga.
      if (i < notificaciones.length) await dormir(PAUSA_ENTRE_CORREOS_MS)
    }

    console.log(`[notif-enviar] FIN enviados=${enviados} errores=${errores}`)
    return NextResponse.json({ enviados, errores, detalle })
  } catch (err) {
    console.error(`[notif-enviar] EXCEPCION global: ${err && err.message}`)
    return NextResponse.json({ error: (err && err.message) || 'error' }, { status: 500 })
  }
}
