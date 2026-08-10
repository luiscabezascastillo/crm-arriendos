// VERSION: v2 · 2026-08-10 · Además de devolver el PDF para previsualizar, ahora puede ENVIARLO por email a una persona
//   concreta si el body trae `enviarA` (correo). Es una copia de revisión interna, con marca de agua "BORRADOR - NO
//   ENVIAR"; NO es el envío oficial: no toca el candado ni liquidacion_envios. Solo Alberto/Luis/Karina pueden enviarlo.
// app/api/liquidaciones/borrador-carta/route.js
// Genera el PDF de la carta de UN propietario como BORRADOR (marca de agua
// "BORRADOR - NO ENVIAR"). Sin `enviarA` lo devuelve para previsualizar (cualquier
// sesión). Con `enviarA` lo manda por correo a esa dirección (solo quien puede enviar).

import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { generarPdfLiquidacion } from '../../../../lib/liquidacionPdf'
import { PDFDocument } from 'pdf-lib'
import nodemailer from 'nodemailer'

export const runtime = 'nodejs'
export const maxDuration = 30

// Quién puede ENVIAR el borrador por correo (mismo trío que el envío oficial).
const PUEDEN_ENVIAR = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']

// Factores de escala que se prueban (de mayor a menor) al reducir a 1 página.
const FACTORES = [1, 0.9, 0.82, 0.75, 0.68, 0.62, 0.56, 0.50]

async function nPaginas(bytes) {
  try { const d = await PDFDocument.load(bytes); return d.getPageCount() } catch { return 1 }
}

// Nombre de archivo seguro: quita acentos (NFD + fuera lo no-ASCII) y deja [A-Za-z0-9_].
const safeName = s => String(s || '')
  .normalize('NFD')
  .replace(/[^\x00-\x7F]/g, '')
  .replace(/[^A-Za-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '')
  .slice(0, 40)

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

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const { bloque, mesTxt, fecha, despedida, reducir, enviarA } = body || {}
  if (!bloque) return Response.json({ error: 'Falta bloque' }, { status: 400 })

  // ¿Se pide enviarlo por correo? Entonces validar permiso y destino.
  const destino = String(enviarA || '').trim()
  if (destino) {
    if (!PUEDEN_ENVIAR.includes(email)) {
      return Response.json({ error: 'No autorizado para enviar borradores por correo' }, { status: 403 })
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(destino)) {
      return Response.json({ error: 'Correo de destino no válido' }, { status: 400 })
    }
  }

  const base = {
    bloque,
    mesTxt,
    fecha: fecha || new Date().toLocaleDateString('es-CL'),
    despedida,
    borrador: true,   // ← marca de agua "BORRADOR - NO ENVIAR"
  }

  try {
    let bytes, paginas, escala = 1
    if (reducir) {
      // Buscar el factor mínimo (bajando) que quepa en 1 página.
      for (const f of FACTORES) {
        bytes = await generarPdfLiquidacion({ ...base, factorEscala: f })
        paginas = await nPaginas(bytes)
        escala = f
        if (paginas <= 1) break
      }
    } else {
      bytes = await generarPdfLiquidacion(base)
      paginas = await nPaginas(bytes)
    }

    // ── Envío por correo (revisión interna) ──
    if (destino) {
      const nombre = bloque.propietario || bloque.idprop || ''
      const filename = `BORRADOR-${bloque.idprop || 'carta'}-${safeName(nombre)}.pdf`
      const tx = transporter()
      await tx.sendMail({
        from: `Fondo Capital <${process.env.GMAIL_USER}>`,
        to: destino,
        subject: `[BORRADOR - NO ENVIAR] Liquidacion ${mesTxt || ''} · ${nombre}`,
        text:
`Este es un BORRADOR de la carta de liquidacion${mesTxt ? ' de ' + mesTxt : ''} del propietario ${nombre}.

Se envia para revision interna. NO es el documento oficial: lleva marca de agua "BORRADOR - NO ENVIAR".

Enviado por ${email} desde el CRM de Fondo Capital Rent.`,
        attachments: [{ filename, content: Buffer.from(bytes), contentType: 'application/pdf' }],
      })
      return Response.json({ ok: true, enviado: destino, paginas })
    }

    // ── Previsualización (sin envío): devuelve el PDF ──
    return new Response(Buffer.from(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="BORRADOR-${bloque.idprop || 'carta'}.pdf"`,
        'X-Paginas': String(paginas),
        'X-Escala': String(escala),
      },
    })
  } catch (err) {
    return Response.json({ error: err?.message || 'Error generando el borrador' }, { status: 500 })
  }
}
