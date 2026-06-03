import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  }
})

export async function POST(request) {
  try {
    const { deudores, mes, asunto, textoIntro, textoCierre, emailOverride } = await request.json()

    let enviados = 0
    let errores = 0
    const detalle = []

    for (const d of deudores) {
      const emailDestino = emailOverride || d.mail_arrendatario
      if (!emailDestino) continue

      const total = Number(d.total).toLocaleString('es-CL')
      const introTexto = textoIntro || `Le informamos que registra una deuda pendiente en servicios basicos correspondiente al periodo ${mes}${d.inmueble ? ` en la propiedad ${d.inmueble}` : ''}.`
      const cierreTexto = textoCierre || 'Le solicitamos regularizar esta situacion a la brevedad para evitar cobros adicionales o cortes de servicio.'
      const asuntoFinal = asunto || `Aviso deuda servicios ${mes} — Fondo Capital`

      const desglose = [
        d.ggcc > 0 ? `<tr><td style="padding:4px 0;font-size:13px;color:#374151;">🏢 Gastos comunes</td><td style="padding:4px 0;font-size:13px;font-weight:600;text-align:right;">$${Number(d.ggcc).toLocaleString('es-CL')}</td></tr>` : '',
        d.luz  > 0 ? `<tr><td style="padding:4px 0;font-size:13px;color:#374151;">⚡ Electricidad</td><td style="padding:4px 0;font-size:13px;font-weight:600;text-align:right;">$${Number(d.luz).toLocaleString('es-CL')}</td></tr>` : '',
        d.agua > 0 ? `<tr><td style="padding:4px 0;font-size:13px;color:#374151;">💧 Agua</td><td style="padding:4px 0;font-size:13px;font-weight:600;text-align:right;">$${Number(d.agua).toLocaleString('es-CL')}</td></tr>` : '',
        d.gas  > 0 ? `<tr><td style="padding:4px 0;font-size:13px;color:#374151;">🔥 Gas</td><td style="padding:4px 0;font-size:13px;font-weight:600;text-align:right;">$${Number(d.gas).toLocaleString('es-CL')}</td></tr>` : '',
      ].filter(Boolean).join('')

      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#1a56db;padding:24px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:20px;">FONDO CAPITAL</h1>
            <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:13px;">Administracion de Propiedades</p>
          </div>
          <div style="padding:32px 24px;background:#fff;">
            <p style="font-size:15px;color:#111827;">Estimado/a <strong>${d.arrendatario}</strong>,</p>
            <p style="font-size:14px;color:#374151;line-height:1.6;">${introTexto}</p>
            <div style="background:#FEF2F2;border:1px solid #FCA5A5;border-radius:8px;padding:16px 20px;margin:20px 0;">
              <div style="text-align:center;margin-bottom:12px;">
                <div style="font-size:12px;color:#6B7280;margin-bottom:4px;">DEUDA TOTAL SERVICIOS</div>
                <div style="font-size:28px;font-weight:700;color:#DC2626;">$${total}</div>
              </div>
              ${desglose ? `<table style="width:100%;border-top:1px solid #FCA5A5;padding-top:10px;">${desglose}</table>` : ''}
            </div>
            <p style="font-size:14px;color:#374151;line-height:1.6;">${cierreTexto}</p>
            <p style="font-size:14px;color:#374151;">Atentamente,<br/><strong>Fondo Capital — Area de Administracion</strong></p>
          </div>
          <div style="background:#F9FAFB;padding:16px 24px;text-align:center;font-size:11px;color:#9CA3AF;">
            Este es un mensaje automatico generado por el sistema CRM de Fondo Capital.
          </div>
        </div>
      `

      try {
        await transporter.sendMail({
          from: `"Fondo Capital" <${process.env.GMAIL_USER}>`,
          to: emailDestino,
          subject: asuntoFinal,
          html,
        })
        enviados++
        detalle.push({ ok: true, email: emailDestino, nombre: d.arrendatario })
      } catch (err) {
        errores++
        detalle.push({ ok: false, email: emailDestino, nombre: d.arrendatario, error: err.message })
      }
    }

    return NextResponse.json({ enviados, errores, detalle })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}