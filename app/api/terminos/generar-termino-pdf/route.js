// VERSION: v1 · 2026-08-11 · app/api/terminos/generar-termino-pdf/route.js
//   Genera el PDF PROFESIONAL de la liquidación de un término a partir de los datos que la propia vista de
//   Términos ya tiene calculados (los mismos que ve el usuario en pantalla) y lo sube al bucket público
//   'presupuestos' (se reutiliza; nombre con token aleatorio → URL no adivinable). Devuelve { pdf_url }.
//   Gate ESTRICTO: solo Karina + Dirección (el PDF muestra el presupuesto a precio de cliente). El "quién"
//   sale de la sesión del servidor. Por defecto lleva marca de agua BORRADOR (borrador !== false).
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin.js'
import { generarPdfTermino } from '../../../../lib/terminoPdf.js'
import { randomUUID } from 'crypto'

const KARINA_DIRECCION = [
  'alberto.cabezas@fondocapital.com',
  'luis.cabezas@fondocapital.com',
  'karina.morales@fondocapital.com',
]
const BUCKET = 'presupuestos'
const dosDig = n => String(n).padStart(2, '0')

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!KARINA_DIRECCION.includes(email)) {
    return Response.json({ error: 'Solo Karina y Dirección pueden generar el PDF del término.' }, { status: 403 })
  }

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const { idadmon, datos } = body || {}
  if (!idadmon || !datos) return Response.json({ error: 'Faltan datos del término.' }, { status: 400 })

  const hoy = new Date()
  const fecha = `${dosDig(hoy.getDate())}/${dosDig(hoy.getMonth() + 1)}/${hoy.getFullYear()}`

  let bytes
  try {
    bytes = await generarPdfTermino({ datos, fecha, borrador: body?.borrador !== false })
  } catch (e) {
    return Response.json({ error: 'No se pudo generar el PDF: ' + e.message }, { status: 500 })
  }

  const path = `termino-${String(idadmon).replace(/[^\w-]/g, '')}-${randomUUID()}.pdf`
  const up = await supabaseAdmin.storage.from(BUCKET).upload(path, Buffer.from(bytes), { upsert: true, contentType: 'application/pdf' })
  if (up.error) return Response.json({ error: 'No se pudo subir el PDF: ' + up.error.message }, { status: 500 })
  const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)

  return Response.json({ ok: true, pdf_url: pub?.publicUrl || null, path })
}
