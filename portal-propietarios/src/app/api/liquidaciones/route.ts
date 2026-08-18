// VERSION: v1 · 2026-08-18 · Liquidaciones del propietario desde Google Drive (unidad 2.SD.ADMON-CONTAB).
//   Lee 3.AÑOS/<año>/<AAMM>/4-CartasAutomaticas/LIQUIDACION-<AAMM>-<IDPROP>-*.pdf y las agrupa por mes.
//   Paola/P001 (quien_cobra=DUENO) no tiene cartas en este circuito: se devuelve esDueno=true.
// RUTA: portal-propietarios/src/app/api/liquidaciones/route.ts
import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Carpeta "3.AÑOS" en la unidad compartida 2.SD.ADMON-CONTAB (misma que usa el CRM en lib/driveArchivo.js).
const ROOT_3ANOS = '1yQn99Bo1gxHNeDNRY93LprzeS6RaXjRY'

function driveClient() {
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS!)
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  })
  return google.drive({ version: 'v3', auth })
}

type Fila = { fileId: string; nombre: string; aamm: string; anio: string; mesNum: string; modificado: string }

// Tipo minimo de la respuesta de Drive que usamos (evita depender de los tipos de googleapis,
// que rompen la inferencia dentro del do/while por el pageToken).
type DriveFile = { id?: string | null; name?: string | null; modifiedTime?: string | null }
type DriveListResp = { data: { files?: DriveFile[]; nextPageToken?: string | null } }

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const session = verifyToken(token)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const idprop = session.idprop

    // ¿Cobra el dueño? (Paola/P001). En ese caso su liquidación va aparte, no por este circuito.
    const { data: contratos } = await supabaseAdmin
      .from('datos_arriendos')
      .select('quien_cobra')
      .eq('idprop', idprop)
      .in('estado', ['S', 'SQ', 'Q', 'P'])
    const arr = (contratos || []) as { quien_cobra: string | null }[]
    const esDueno = arr.length > 0 && arr.every(c => String(c.quien_cobra ?? '').trim().toUpperCase() === 'DUEÑO')
    if (esDueno) {
      return NextResponse.json({ esDueno: true, archivos: [] })
    }

    const drive = driveClient()
    const meta = await drive.files.get({ fileId: ROOT_3ANOS, fields: 'driveId', supportsAllDrives: true })
    const driveId = meta.data.driveId
    if (!driveId) return NextResponse.json({ error: 'Unidad de Drive no encontrada' }, { status: 404 })

    // Búsqueda por prefijo del nombre (Drive solo soporta prefijo en "name contains"),
    // luego se filtra por IDPROP con una expresión regular exacta.
    const re = new RegExp('^LIQUIDACION-(\\d{4})-' + idprop + '-', 'i')
    const encontrados: Fila[] = []
    let pageToken: string | undefined = undefined
    do {
      const res = await drive.files.list({
        q: `name contains 'LIQUIDACION' and mimeType = 'application/pdf' and trashed = false`,
        corpora: 'drive', driveId,
        includeItemsFromAllDrives: true, supportsAllDrives: true,
        fields: 'nextPageToken, files(id, name, modifiedTime)',
        pageSize: 1000,
        pageToken,
      }) as unknown as DriveListResp
      for (const f of (res.data.files || [])) {
        const m = re.exec(f.name || '')
        if (m) {
          const aamm = m[1]
          encontrados.push({
            fileId: f.id!, nombre: f.name!, aamm,
            anio: '20' + aamm.slice(0, 2), mesNum: aamm.slice(2, 4),
            modificado: f.modifiedTime || '',
          })
        }
      }
      pageToken = res.data.nextPageToken || undefined
    } while (pageToken)

    // Un propietario tiene una carta por mes; si hay reenvíos (-2, -3), nos quedamos con la más reciente.
    const porMes = new Map<string, Fila>()
    for (const f of encontrados) {
      const prev = porMes.get(f.aamm)
      if (!prev || (f.modificado > prev.modificado)) porMes.set(f.aamm, f)
    }
    const archivos = Array.from(porMes.values()).sort((a, b) => b.aamm.localeCompare(a.aamm))

    return NextResponse.json({ esDueno: false, archivos })
  } catch (err) {
    console.error('liquidaciones error:', err)
    // DEBUG temporal: devolvemos el mensaje real para diagnosticar.
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Error al conectar con Drive: ' + msg }, { status: 500 })
  }
}
