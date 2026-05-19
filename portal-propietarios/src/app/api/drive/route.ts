import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getDriveClient() {
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS!)
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  })
  return google.drive({ version: 'v3', auth })
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const session = verifyToken(token)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: contratos } = await supabaseAdmin
      .from('datos_arriendos')
      .select('idadmon, inmueble, arrendatario, fecha_inicio, termino_actual, cuota, unid')
      .eq('idprop', session.idprop)
      .in('estado', ['S', 'SQ', 'Q', 'P'])

    const contratosMap = new Map((contratos || []).map(c => [c.idadmon as string, c]))
    const idadmons = Array.from(contratosMap.keys())

    const drive = await getDriveClient()

    const drivesRes = await drive.drives.list({ fields: 'drives(id,name)' })
    const sharedDrive = drivesRes.data.drives?.find(d => d.name?.includes('ADMON-LEGAL'))
    if (!sharedDrive?.id) return NextResponse.json({ error: 'Shared Drive no encontrada' }, { status: 404 })
    const driveId = sharedDrive.id

    const todosRes = await drive.files.list({
      q: `name contains '4.TODOS' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      driveId, includeItemsFromAllDrives: true, supportsAllDrives: true, corpora: 'drive', fields: 'files(id,name)',
    })
    const carpetaTodos = todosRes.data.files?.[0]

    const admonRes = await drive.files.list({
      q: `name contains 'CONTRATOS' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      driveId, includeItemsFromAllDrives: true, supportsAllDrives: true, corpora: 'drive', fields: 'files(id,name)',
    })
    const carpetaAdmon = admonRes.data.files?.[0]

    const archivos: Record<string, unknown>[] = []

    if (carpetaTodos?.id) {
      for (const idadmon of idadmons) {
        const res = await drive.files.list({
          q: `name contains '${idadmon}' and '${carpetaTodos.id}' in parents and trashed = false`,
          includeItemsFromAllDrives: true, supportsAllDrives: true, fields: 'files(id,name)',
        })
        if (res.data.files?.length) {
          const datos = contratosMap.get(idadmon)
          res.data.files.forEach(f => {
            archivos.push({
              tipo: 'arriendo',
              nombre: f.name!,
              idadmon,
              fileId: f.id!,
              inmueble: datos?.inmueble,
              arrendatario: datos?.arrendatario,
              fecha_inicio: datos?.fecha_inicio,
              termino_actual: datos?.termino_actual,
              cuota: datos?.cuota,
              unid: datos?.unid,
            })
          })
        }
      }
    }

    if (carpetaAdmon?.id) {
      const res = await drive.files.list({
        q: `name contains '${session.idprop}' and '${carpetaAdmon.id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        includeItemsFromAllDrives: true, supportsAllDrives: true, fields: 'files(id,name)',
      })
      const carpetaProp = res.data.files?.[0]
      if (carpetaProp?.id) {
        const pdfs = await drive.files.list({
          q: `'${carpetaProp.id}' in parents and trashed = false`,
          includeItemsFromAllDrives: true, supportsAllDrives: true, fields: 'files(id,name)',
        })
        pdfs.data.files?.forEach(f => {
          archivos.push({ tipo: 'administracion', nombre: f.name!, fileId: f.id! })
        })
      }
    }

    return NextResponse.json({ archivos })
  } catch (err) {
    console.error('Drive error:', err)
    return NextResponse.json({ error: 'Error al conectar con Drive' }, { status: 500 })
  }
}
