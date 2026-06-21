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
    const { contacto_id, tipo } = await req.json()
    if (!contacto_id) return Response.json({ error: 'Falta contacto_id' }, { status: 400 })

    let c
    if (tipo === 'equipo') {
      const { data, error } = await supabaseAdmin
        .from('crm_users')
        .select('id, nombre, email')
        .eq('id', contacto_id)
        .single()
      if (error || !data) return Response.json({ error: 'Usuario no encontrado' }, { status: 404 })
      c = { nombre: data.nombre, apellido: '', email: data.email, email_2: null }
    } else {
      const { data, error } = await supabaseAdmin
        .from('contactos')
        .select('id, nombre, apellido, email, email_2')
        .eq('id', contacto_id)
        .single()
      if (error || !data) return Response.json({ error: 'Contacto no encontrado' }, { status: 404 })
      c = data
    }

    const destinoReal = (c.email || c.email_2 || '').trim()
    const testTo = (process.env.RESEND_TEST_TO || '').trim()
    const to = testTo || destinoReal
    if (!to) return Response.json({ error: 'El contacto no tiene email, y no hay RESEND_TEST_TO para pruebas.' }, { status: 400 })
    const esPrueba = !!testTo

    const nombre = [c.nombre, c.apellido].filter(Boolean).join(' ') || 'Estimado/a'
    const primerNombre = (c.nombre || nombre).split(' ')[0]
    const from = process.env.RESEND_FROM || 'Fondo Capital Rent <onboarding@resend.dev>'

    const notaPrueba = esPrueba
      ? `<div style="background:#FEF3C7;border:1px solid #FCD34D;border-radius:8px;padding:10px 12px;margin:0 0 16px;font-size:13px;color:#92400E">
           <b>MODO PRUEBA.</b> Este saludo iba dirigido a <b>${destinoReal || '(sin email)'}</b>, pero se redirigió a tu correo de pruebas.
         </div>`
      : ''

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1a1a2e">
        ${notaPrueba}
        <div style="text-align:center;padding:8px 0 4px;font-size:40px">🎂</div>
        <h2 style="color:#7c3aed;margin:0 0 10px;text-align:center">¡Feliz cumpleaños, ${primerNombre}!</h2>
        <p>Hola ${primerNombre},</p>
        <p>En este día tan especial, todo el equipo de <b>Fondo Capital Rent</b> quiere desearte un muy feliz cumpleaños. Que sea un año lleno de salud, alegría y nuevos logros.</p>
        <p>Gracias por la confianza de siempre. ¡Lo celebramos contigo!</p>
        <p style="margin-top:20px">Con afecto,<br><b>Equipo Fondo Capital Rent</b></p>
        <hr style="border:none;border-top:1px solid #eee;margin:22px 0">
        <p style="font-size:12px;color:#999">Fondo Capital Rent Spa · Ebro 2791, of. 1B y 1C, Las Condes.</p>
      </div>`

    const resend = new Resend(process.env.RESEND_API_KEY)
    const { data, error: eSend } = await resend.emails.send({
      from,
      to,
      subject: `¡Feliz cumpleaños, ${primerNombre}! 🎉`,
      html,
    })
    if (eSend) return Response.json({ error: 'Resend: ' + (eSend.message || JSON.stringify(eSend)) }, { status: 502 })

    return Response.json({ ok: true, id: data?.id, to, prueba: esPrueba, destino_real: destinoReal })
  } catch (e) {
    return Response.json({ error: 'Error inesperado: ' + (e.message || String(e)) }, { status: 500 })
  }
}
