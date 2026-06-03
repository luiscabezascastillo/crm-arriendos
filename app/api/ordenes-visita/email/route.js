import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(req) {
  try {
    const { ov_id, pdf_base64 } = await req.json()

    const { data: ov } = await supabase.from('ordenes_visita').select('*').eq('id', ov_id).single()
    if (!ov) return Response.json({ error: 'OV no encontrada' }, { status: 404 })

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    })

    const numeroOV = 'OV-' + String(ov.numero).padStart(4, '0')

    await transporter.sendMail({
      from: `"${ov.comercial || 'Fondo Capital'}" <${process.env.GMAIL_USER}>`,
      to: ov.contacto_email,
      cc: ov.comercial_email,
      subject: `Orden de Visita ${numeroOV} - Fondo Capital Rent SpA`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1a1a2e; padding: 20px; text-align: center;">
            <img src="https://crm-arriendos.vercel.app/logo-fcr.png" alt="Fondo Capital" style="height: 50px;" />
          </div>
          <div style="padding: 30px; background: #f8f7f4;">
            <h2 style="color: #1a1a2e;">Estimado/a ${ov.contacto_nombre},</h2>
            <p style="color: #555; line-height: 1.6;">
              Adjunto encontrará su Orden de Visita <strong>${numeroOV}</strong> con las propiedades seleccionadas para usted.
            </p>
            <p style="color: #555; line-height: 1.6;">
              Para agendar una visita o consultar información adicional, no dude en contactarnos.
            </p>
            <div style="margin: 30px 0; padding: 20px; background: #fff; border-radius: 8px; border-left: 4px solid #185FA5;">
              <p style="margin: 0; color: #185FA5; font-weight: bold;">${ov.comercial || 'Equipo Fondo Capital'}</p>
              <p style="margin: 4px 0 0; color: #888; font-size: 13px;">${ov.comercial_email || 'info@fondocapital.com'}</p>
            </div>
            <p style="color: #aaa; font-size: 12px;">
              Fondo Capital Rent SpA · Ebro 2791 Oficina 1B y C, Las Condes
            </p>
          </div>
        </div>
      `,
      attachments: pdf_base64 ? [{
        filename: `${numeroOV}.pdf`,
        content: pdf_base64,
        encoding: 'base64',
      }] : [],
    })

    // Actualizar estado OV
    await supabase.from('ordenes_visita').update({ estado: 'enviada', enviado_at: new Date().toISOString() }).eq('id', ov_id)

    // Registrar en historial
    if (ov.contacto_id) {
      await supabase.from('contactos_historial').insert({
        contacto_id: ov.contacto_id,
        tipo: 'email',
        descripcion: `Orden de Visita ${numeroOV} enviada por email a ${ov.contacto_email}`,
        usuario: ov.comercial,
      })
    }

    return Response.json({ ok: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
