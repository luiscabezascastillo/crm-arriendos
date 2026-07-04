// app/api/liquidaciones/enviar-cartas/route.js
// FASE B — envío real de las cartas de liquidación.
// - Solo Alberto y Luis pueden enviar (PUEDEN_ENVIAR).
// - Genera el PDF por propietario, lo adjunta y envía por Nodemailer (info@fondocapital.com).
// - Candado anti-reenvío: si ya hay fecha_envio en liquidacion_envios(mes,idprop) -> se salta.
// - Guarda snapshot + fecha_envio al enviar.
// Requiere: npm install pdf-lib nodemailer   (y @supabase/supabase-js, nodemailer ya en el proyecto)

import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import { generarPdfLiquidacion } from '../../../../lib/liquidacionPdf'

export const runtime = 'nodejs'
export const maxDuration = 60

// ── Quién puede enviar (cámbialo aquí si hace falta) ──
const PUEDEN_ENVIAR = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com']
const CC_FIJO = 'administracion@fondocapital.com'
// ──────────────────────────────────────────────────────

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const sinAcentos = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const safeName = s => sinAcentos(s).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40)

function transporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  })
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!PUEDEN_ENVIAR.includes(email)) {
    return Response.json({ error: 'No autorizado para enviar liquidaciones' }, { status: 403 })
  }

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const { mes, mesTxt, fecha, despedida, logoDataUrl, envios } = body || {}
  if (!mes || !Array.isArray(envios) || envios.length === 0) {
    return Response.json({ error: 'Faltan datos (mes / envios)' }, { status: 400 })
  }

  const tx = transporter()
  const fechaTxt = fecha || new Date().toLocaleDateString('es-CL')
  const results = []

  for (const e of envios) {
    const idprop = e?.idprop
    const bloque = e?.bloque
    const dest = (e?.email || '').trim()
    const nombre = e?.propietario || bloque?.propietario || ''
    const marca = { idprop, propietario: nombre }
    try {
      if (!idprop || !bloque) { results.push({ ...marca, ok: false, motivo: 'datos_incompletos' }); continue }

      // Solo cartas cuadradas
      if (!['OK', 'OK DESC'].includes(bloque.estado)) { results.push({ ...marca, ok: false, motivo: 'estado_no_enviable' }); continue }

      // Candado: ¿ya enviada este mes?
      const { data: prev } = await admin
        .from('liquidacion_envios').select('fecha_envio').eq('mes', mes).eq('idprop', idprop).maybeSingle()
      if (prev?.fecha_envio) { results.push({ ...marca, ok: false, motivo: 'ya_enviada' }); continue }

      if (!dest) { results.push({ ...marca, ok: false, motivo: 'sin_email' }); continue }

      // PDF
      const pdfBytes = await generarPdfLiquidacion({ bloque, mesTxt, fecha: fechaTxt, despedida, logoDataUrl })
      const filename = `LIQUIDACION-${mes}-${idprop}-${safeName(nombre)}.pdf`

      // Email
      await tx.sendMail({
        from: `Fondo Capital <${process.env.GMAIL_USER}>`,
        to: dest,
        cc: CC_FIJO,
        subject: `[NO RESPONDER] Liquidación mes de ${mesTxt}`,
        text:
`Estimado(a) ${nombre}:

Le adjuntamos en PDF el detalle de su liquidación de arriendo correspondiente a ${mesTxt}.

${(despedida || 'Desde Fondo Capital Rent SpA le deseamos un feliz mes. Atentamente, Servicio de Información al Cliente.').trim()}

— Este es un correo automático, por favor no responda a esta dirección.`,
        attachments: [{ filename, content: Buffer.from(pdfBytes), contentType: 'application/pdf' }],
      })

      // Grabar envío (candado + snapshot)
      const ahora = new Date().toISOString()
      const { error: eUp } = await admin.from('liquidacion_envios').upsert({
        mes, idprop, estado_envio: 'ENVIADA', fecha_envio: ahora,
        enviado_por: email, email_dest: dest, snapshot: bloque,
      }, { onConflict: 'mes,idprop' })
      if (eUp) { results.push({ ...marca, ok: false, motivo: 'enviado_pero_no_registrado: ' + eUp.message }); continue }

      results.push({ ...marca, ok: true, email_dest: dest, fecha_envio: ahora })
    } catch (err) {
      results.push({ ...marca, ok: false, motivo: (err?.message || 'error').slice(0, 200) })
    }
  }

  const enviadas = results.filter(r => r.ok).length
  return Response.json({ ok: true, enviadas, fallidas: results.length - enviadas, results })
}
