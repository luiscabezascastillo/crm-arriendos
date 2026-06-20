import { getToken } from 'next-auth/jwt'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin.js'
import { Resend } from 'resend'

export const runtime = 'nodejs'

export async function POST(req) {
  const auth = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!auth) return Response.json({ error: 'No autorizado' }, { status: 401 })

  if (!process.env.RESEND_API_KEY) {
    return Response.json({ error: 'Falta RESEND_API_KEY en el entorno.' }, { status: 500 })
  }

  try {
    const { token: ordenToken } = await req.json()
    if (!ordenToken) return Response.json({ error: 'Falta el token de la orden.' }, { status: 400 })

    // 1) cargar la orden
    const { data: orden, error } = await supabaseAdmin
      .from('ordenes_visita')
      .select('*')
      .eq('token', ordenToken)
      .single()
    if (error || !orden) return Response.json({ error: 'Orden no encontrada.' }, { status: 404 })

    // 2) destinatario (en modo prueba se redirige a RESEND_TEST_TO)
    const destinoReal = (orden.cliente_email || '').trim()
    const testTo = (process.env.RESEND_TEST_TO || '').trim()
    const to = testTo || destinoReal
    if (!to) {
      return Response.json({ error: 'La orden no tiene email de cliente, y no hay RESEND_TEST_TO configurado para pruebas.' }, { status: 400 })
    }
    const esPrueba = !!testTo

    // 3) link de firma + adjunto PDF (borrador)
    const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin
    const link = `${base}/firmar/${orden.token}`
    const from = process.env.RESEND_FROM || 'Fondo Capital Rent <onboarding@resend.dev>'

    const attachments = []
    if (orden.pdf_url) {
      try {
        const r = await fetch(orden.pdf_url)
        if (r.ok) {
          const buf = Buffer.from(await r.arrayBuffer())
          attachments.push({ filename: `orden-visita-${orden.id}.pdf`, content: buf.toString('base64') })
        }
      } catch (_) { /* si el adjunto falla, igual enviamos el link */ }
    }

    // 4) cuerpo del correo
    const notaPrueba = esPrueba
      ? `<div style="background:#FEF3C7;border:1px solid #FCD34D;border-radius:8px;padding:10px 12px;margin:0 0 16px;font-size:13px;color:#92400E">
           <b>MODO PRUEBA.</b> Este correo iba dirigido a <b>${destinoReal || '(cliente sin email)'}</b>, pero se redirigió a tu correo de pruebas.
         </div>`
      : ''
    const nombre = orden.cliente_nombre || 'Estimado/a cliente'
    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1a1a2e">
        ${notaPrueba}
        <h2 style="color:#185FA5;margin:0 0 4px">Orden de visita N° ${orden.id}</h2>
        <p style="color:#666;margin:0 0 18px;font-size:13px">Fondo Capital Rent Spa · Ebro 2791, of. 1B y 1C, Las Condes</p>
        <p>Hola ${nombre},</p>
        <p>Le enviamos la <b>orden de visita</b> para su firma electrónica. Puede revisar el documento adjunto y firmarlo en línea desde el siguiente enlace:</p>
        <p style="text-align:center;margin:24px 0">
          <a href="${link}" style="background:#185FA5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold;display:inline-block">Firmar orden de visita</a>
        </p>
        <p style="font-size:13px;color:#777">Si el botón no funciona, copie y pegue este enlace en su navegador:<br><a href="${link}">${link}</a></p>
        <hr style="border:none;border-top:1px solid #eee;margin:22px 0">
        <p style="font-size:12px;color:#999">Firma electrónica simple conforme a la Ley 19.799. Si no esperaba este correo, puede ignorarlo.</p>
      </div>`

    // 5) enviar
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { data, error: eSend } = await resend.emails.send({
      from,
      to,
      subject: `Orden de visita N° ${orden.id} · Fondo Capital Rent`,
      html,
      attachments: attachments.length ? attachments : undefined,
    })
    if (eSend) return Response.json({ error: 'Resend: ' + (eSend.message || JSON.stringify(eSend)) }, { status: 502 })

    // 6) si estaba en borrador, marcar como enviada
    if (orden.estado === 'borrador') {
      await supabaseAdmin.from('ordenes_visita').update({ estado: 'enviada', updated_at: new Date().toISOString() }).eq('id', orden.id)
    }

    return Response.json({ ok: true, id: data?.id, to, prueba: esPrueba, destino_real: destinoReal, adjunto: attachments.length > 0 })
  } catch (e) {
    return Response.json({ error: 'Error inesperado: ' + (e.message || String(e)) }, { status: 500 })
  }
}
