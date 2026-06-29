import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { plantillaArriendo, asuntoArriendo, splitEmails } from '@/lib/notifPlantilla'

// Mismo transporte que el resto de correos del CRM (endpoint de deudas)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

export async function POST(request) {
  try {
    const { mes, mesLabel, valorUf, cc, emailOverride, notificaciones } = await request.json()

    if (!Array.isArray(notificaciones) || notificaciones.length === 0) {
      return NextResponse.json({ error: 'No hay notificaciones que enviar' }, { status: 400 })
    }

    const ctx = { mes, mesLabel, valorUf }
    let enviados = 0
    let errores = 0
    const detalle = []
    const asunto = asuntoArriendo(mesLabel)

    for (const n of notificaciones) {
      const destinatarios = emailOverride
        ? [emailOverride]
        : (Array.isArray(n.destinatarios) && n.destinatarios.length
            ? n.destinatarios
            : splitEmails(n.mail_arrendatario))

      if (destinatarios.length === 0) {
        errores++
        detalle.push({ ok: false, idadmon: n.idadmon, error: 'sin email' })
        continue
      }

      const html = plantillaArriendo(n, ctx)

      try {
        await transporter.sendMail({
          from: `"Fondo Capital" <${process.env.GMAIL_USER}>`,
          to: destinatarios.join(', '),
          cc: emailOverride ? undefined : (cc || undefined),
          subject: asunto,
          html,
        })
        enviados++
        detalle.push({ ok: true, idadmon: n.idadmon, email: destinatarios.join(', ') })
      } catch (err) {
        errores++
        detalle.push({ ok: false, idadmon: n.idadmon, error: err.message })
      }
    }

    return NextResponse.json({ enviados, errores, detalle })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
