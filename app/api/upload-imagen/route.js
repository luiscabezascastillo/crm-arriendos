import { NextResponse } from 'next/server'
import * as ftp from 'basic-ftp'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

const FTP_HOST = '131.108.211.119'
const FTP_USER = 'fon19_webjpg'
const FTP_PASS = 'Anita2016a'

export async function POST(request) {
  let tmpPath = null
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const publicacionId = formData.get('publicacionId')
    const slot = formData.get('slot') || Date.now()

    if (!file) {
      return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 })
    }
    // Validar que sea JPG
    if (!file.type.includes('jpeg') && !file.type.includes('jpg')) {
      return NextResponse.json({ error: 'Solo se admiten archivos JPG' }, { status: 400 })
    }
    // Validar tamaño máximo 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'El archivo supera los 10MB' }, { status: 400 })
    }

    // Nombre según convención: {codigo}-{nn}.jpg
    const nombreArchivo = `${publicacionId}-${slot}.jpg`

    // Guardar temporalmente en disco
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    tmpPath = join(tmpdir(), nombreArchivo)
    await writeFile(tmpPath, buffer)

    // Subir al FTP
    const client = new ftp.Client()
    client.ftp.verbose = false
    await client.access({
      host: FTP_HOST,
      user: FTP_USER,
      password: FTP_PASS,
      secure: false,
      port: 21,
    })
    // Subir el archivo al directorio raíz del usuario (que es /propiedades/)
    await client.uploadFrom(tmpPath, nombreArchivo)
    client.close()

    // Borrar archivo temporal
    await unlink(tmpPath)
    tmpPath = null

    return NextResponse.json({
      ok: true,
      nombreArchivo,
      url: `https://fondocapital.com/propiedades/${nombreArchivo}`,
    })
  } catch (error) {
    // Limpiar archivo temporal si hubo error
    if (tmpPath) {
      try { await unlink(tmpPath) } catch {}
    }
    console.error('Error subiendo imagen FTP:', error)
    return NextResponse.json({ error: 'Error al subir la imagen: ' + error.message }, { status: 500 })
  }
}