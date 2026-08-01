// VERSION: v1 · 2026-08-01 · Lee el PDF de un contrato (plantilla FCR) y devuelve los campos extraídos.
// app/api/cc1/extraer-contrato/route.js
//
// SOLO LECTURA: extrae texto del PDF y aplica el parser. NO toca la base de datos, NO cambia estado,
// NO activa nada. La ficha usa esto para PRERELLENAR; Anthony revisa y activa con TERMINAR (P→S).
//
// POST multipart/form-data con el campo 'archivo' (el PDF).
// Respuesta: { ok:true, datos, deducidos, aviso } | { error }

import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { getCapacidades } from '../../../../lib/cc1Permisos'
import { extraerDatosContrato } from '../../../../lib/extraerContrato'
// Import directo del módulo interno para evitar el bloque de depuración del index de pdf-parse.
import pdfParse from 'pdf-parse/lib/pdf-parse.js'

export const runtime = 'nodejs'

export async function POST(req) {
  // 1) Sesión + permiso (mismo que editar la ficha)
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  const cap = await getCapacidades(email)
  if (!cap?.puedeEditar) {
    return Response.json({ error: 'Sin permiso para cargar datos en la ficha.' }, { status: 403 })
  }

  // 2) Recoger el PDF del form-data
  let file
  try {
    const fd = await req.formData()
    file = fd.get('archivo')
  } catch {
    return Response.json({ error: 'No se recibió el archivo (form-data).' }, { status: 400 })
  }
  if (!file || typeof file.arrayBuffer !== 'function') {
    return Response.json({ error: 'Falta el PDF (campo "archivo").' }, { status: 400 })
  }
  const nombre = (file.name || '').toLowerCase()
  if (nombre && !nombre.endsWith('.pdf')) {
    return Response.json({ error: 'El archivo debe ser un PDF.' }, { status: 400 })
  }

  // 3) Extraer texto
  let texto = ''
  try {
    const buf = Buffer.from(await file.arrayBuffer())
    const data = await pdfParse(buf)
    texto = data?.text || ''
  } catch (e) {
    return Response.json({ error: 'No se pudo leer el PDF: ' + (e?.message || e) }, { status: 422 })
  }
  if (texto.trim().length < 300) {
    return Response.json({
      error: 'El PDF no tiene texto legible (¿es un escaneo/imagen?). No se pueden extraer datos.',
      sin_texto: true,
    }, { status: 422 })
  }

  // 4) Parsear la plantilla FCR
  const { datos, deducidos, aviso } = extraerDatosContrato(texto)
  return Response.json({ ok: true, datos, deducidos, aviso })
}
