// app/api/liquidaciones/borrador-carta/route.js
// Genera el PDF de la carta de UN propietario como BORRADOR (marca de agua
// "BORRADOR - NO ENVIAR") y lo devuelve para previsualizar. NO envía email ni
// toca liquidacion_envios. Solo requiere sesión (mismo acceso que la página).

import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { generarPdfLiquidacion } from '../../../../lib/liquidacionPdf'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: 'No autenticado' }, { status: 401 })

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const { bloque, mesTxt, fecha, despedida } = body || {}
  if (!bloque) return Response.json({ error: 'Falta bloque' }, { status: 400 })

  try {
    const bytes = await generarPdfLiquidacion({
      bloque,
      mesTxt,
      fecha: fecha || new Date().toLocaleDateString('es-CL'),
      despedida,
      borrador: true,   // ← marca de agua "BORRADOR - NO ENVIAR"
    })
    return new Response(Buffer.from(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="BORRADOR-${bloque.idprop || 'carta'}.pdf"`,
      },
    })
  } catch (err) {
    return Response.json({ error: err?.message || 'Error generando el borrador' }, { status: 500 })
  }
}
