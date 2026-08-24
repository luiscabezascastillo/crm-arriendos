// VERSION: v1 · 2026-08-24 · Cobranza · sube un archivo al bucket privado 'cobranza-adjuntos' para
//   adjuntarlo luego al correo. Devuelve {path, nombre, size}. El archivo se INCRUSTA en el email al
//   enviar (no se comparte el enlace del bucket). Solo roles internos.
// Ruta real: app/api/cobranza/adjunto/route.js
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const PUEDEN_VER = ['direccion', 'administracion', 'finanzas', 'legal']
const BUCKET_ADJ = 'cobranza-adjuntos'
const MAX_BYTES = 15 * 1024 * 1024   // 15 MB por archivo (limite comodo para adjuntos de correo)

const safeName = (s) => String(s || 'adjunto').replace(/[^\w.\- ]/g, '_').replace(/\s+/g, '_').slice(0, 120) || 'adjunto'

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const rol = session?.user?.role
  if (!session?.user?.email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!PUEDEN_VER.includes(rol)) return Response.json({ error: 'No autorizado' }, { status: 403 })

  let form
  try { form = await req.formData() } catch { return Response.json({ error: 'Formulario invalido' }, { status: 400 }) }
  const file = form.get('file')
  const idadmon = String(form.get('idadmon') || 'sin_idadmon')
  if (!file || typeof file === 'string') return Response.json({ error: 'Falta el archivo' }, { status: 400 })

  const bytes = Buffer.from(await file.arrayBuffer())
  if (!bytes.length) return Response.json({ error: 'Archivo vacio' }, { status: 400 })
  if (bytes.length > MAX_BYTES) return Response.json({ error: 'El archivo supera 15 MB' }, { status: 413 })

  const nombre = safeName(file.name)
  const path = `${safeName(idadmon)}/${Date.now()}_${nombre}`
  const { error } = await admin.storage.from(BUCKET_ADJ).upload(path, bytes, {
    contentType: file.type || 'application/octet-stream', upsert: false,
  })
  if (error) return Response.json({ error: 'No se pudo subir: ' + error.message }, { status: 500 })

  return Response.json({ ok: true, path, nombre: file.name || nombre, size: bytes.length })
}
