// app/api/liquidaciones/borrador-carta/route.js
// Genera el PDF de la carta de UN propietario como BORRADOR (marca de agua
// "BORRADOR - NO ENVIAR") y lo devuelve para previsualizar. NO envía email ni
// toca liquidacion_envios. Solo requiere sesión (mismo acceso que la página).

import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { generarPdfLiquidacion } from '../../../../lib/liquidacionPdf'
import { PDFDocument } from 'pdf-lib'

export const runtime = 'nodejs'
export const maxDuration = 30

// Factores de escala que se prueban (de mayor a menor) al reducir a 1 página.
const FACTORES = [1, 0.92, 0.85, 0.78, 0.72, 0.66, 0.6, 0.55]

async function nPaginas(bytes) {
  try { const d = await PDFDocument.load(bytes); return d.getPageCount() } catch { return 1 }
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: 'No autenticado' }, { status: 401 })

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const { bloque, mesTxt, fecha, despedida, reducir } = body || {}
  if (!bloque) return Response.json({ error: 'Falta bloque' }, { status: 400 })

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
