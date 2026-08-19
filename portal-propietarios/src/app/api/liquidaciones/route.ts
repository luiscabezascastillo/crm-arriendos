// VERSION: v3 · 2026-08-19 · Arregla "requires shared drive membership": (1) scope 'drive' completo (como el CRM,
//   el 'drive.readonly' lo disparaba); (2) el listado reintenta SIN corpora:'allDrives' anclando en el parent
//   compartido; (3) el error ahora muestra la SA en uso [SA: …] para diagnóstico si aún fallara. Hereda v2.
// VERSION: v2 · 2026-08-18 · Navega por CARPETAS (no por unidad): la cuenta de servicio NO es miembro de la
//   unidad 2.SD.ADMON-CONTAB, solo tiene acceso a carpetas compartidas. Recorre 3.AÑOS/{año}/{AAMM}/
//   4-CartasAutomaticas con corpora:'allDrives' y "'carpeta' in parents" (como lib/driveArchivo.js del CRM),
//   evitando el error "requires shared drive membership". Filtra por IDPROP. Paola/P001 = esDueno.
// RUTA: portal-propietarios/src/app/api/liquidaciones/route.ts
import { NextResponse } from 'next/server'
import { google, drive_v3 } from 'googleapis'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Carpeta "3.AÑOS" en la unidad compartida 2.SD.ADMON-CONTAB (misma que usa el CRM en lib/driveArchivo.js).
const ROOT_3ANOS = '1yQn99Bo1gxHNeDNRY93LprzeS6RaXjRY'

type DriveItem = { id?: string | null; name?: string | null; modifiedTime?: string | null }
type ListResp = { data: { files?: DriveItem[] } }
type DriveClient = drive_v3.Drive

function driveClient(): DriveClient {
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS!)
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],   // como el CRM (driveArchivo.js). readonly disparaba el error de "shared drive membership".
  })
  return google.drive({ version: 'v3', auth })
}

// Lista anclando en el parent (que ya está compartido con la Service Account).
// Intenta primero con corpora:'allDrives'; si Google exige pertenencia a la unidad
// compartida ("shared drive membership"), reintenta SIN corpora (solo el parent),
// que no requiere ser miembro de la unidad.
async function listar(drive: DriveClient, q: string, fields: string): Promise<DriveItem[]> {
  const base = { q, fields, pageSize: 1000, supportsAllDrives: true, includeItemsFromAllDrives: true }
  try {
    const res = await drive.files.list({ ...base, corpora: 'allDrives' }) as unknown as ListResp
    return res.data.files || []
  } catch {
    const res = await drive.files.list(base) as unknown as ListResp
    return res.data.files || []
  }
}

// Lista subcarpetas de un padre (por ID de carpeta, no por unidad).
async function listarSubcarpetas(drive: DriveClient, parentId: string): Promise<DriveItem[]> {
  return listar(drive, `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`, 'files(id, name)')
}

// Lista PDFs de un padre.
async function listarPdfs(drive: DriveClient, parentId: string): Promise<DriveItem[]> {
  return listar(drive, `'${parentId}' in parents and mimeType = 'application/pdf' and trashed = false`, 'files(id, name, modifiedTime)')
}

type Fila = { fileId: string; nombre: string; aamm: string; anio: string; mesNum: string; modificado: string }

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const session = verifyToken(token)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const idprop = session.idprop

    // ¿Cobra el dueño? (Paola/P001): su liquidación va aparte, no por este circuito.
    const { data: contratos } = await supabaseAdmin
      .from('datos_arriendos')
      .select('quien_cobra')
      .eq('idprop', idprop)
      .in('estado', ['S', 'SQ', 'Q', 'P'])
    const arr = (contratos || []) as { quien_cobra: string | null }[]
    const esDueno = arr.length > 0 && arr.every(c => String(c.quien_cobra ?? '').trim().toUpperCase() === 'DUEÑO')
    if (esDueno) return NextResponse.json({ esDueno: true, archivos: [] })

    const drive = driveClient()

    // 1) Carpetas de año bajo 3.AÑOS (2023, 2024, 2025, 2026…). Solo nombres de 4 dígitos.
    const anios = (await listarSubcarpetas(drive, ROOT_3ANOS)).filter(f => /^\d{4}$/.test(f.name || ''))

    // 2) Carpetas de mes (AAMM) bajo cada año.
    const meses = (await Promise.all(anios.map(a => listarSubcarpetas(drive, a.id!))))
      .flat()
      .filter(f => {
        const n = f.name || ''
        return /^\d{4}$/.test(n) && Number(n.slice(2, 4)) >= 1 && Number(n.slice(2, 4)) <= 12
      })

    // 3) Carpeta "4-CartasAutomaticas" dentro de cada mes.
    const cartas = (await Promise.all(
      meses.map(m => listarSubcarpetas(drive, m.id!).then(sub => sub.find(s => s.name === '4-CartasAutomaticas')))
    )).filter((x): x is DriveItem => !!x && !!x.id)

    // 4) PDFs en cada carpeta de cartas, filtrando por IDPROP del propietario.
    const re = new RegExp('^LIQUIDACION-(\\d{4})-' + idprop + '-', 'i')
    const encontrados: Fila[] = []
    const pdfLists = await Promise.all(cartas.map(c => listarPdfs(drive, c.id!)))
    for (const lista of pdfLists) {
      for (const f of lista) {
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
    }

    // Una carta por mes; si hay reenvíos (-2, -3), la más reciente.
    const porMes = new Map<string, Fila>()
    for (const f of encontrados) {
      const prev = porMes.get(f.aamm)
      if (!prev || f.modificado > prev.modificado) porMes.set(f.aamm, f)
    }
    const archivos = Array.from(porMes.values()).sort((a, b) => b.aamm.localeCompare(a.aamm))

    return NextResponse.json({ esDueno: false, archivos })
  } catch (err) {
    console.error('liquidaciones error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    let sa = ''
    try { sa = JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}').client_email || '' } catch {}
    return NextResponse.json({ error: 'Error al conectar con Drive: ' + msg + (sa ? ' [SA: ' + sa + ']' : ' [SA: sin credenciales]') }, { status: 500 })
  }
}
