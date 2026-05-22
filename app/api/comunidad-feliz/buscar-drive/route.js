import { google } from 'googleapis'

export async function POST(req) {
  try {
    const { folderId, aamm } = await req.json()

    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS)
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.readonly']
    })
    const drive = google.drive({ version: 'v3', auth })

    // Unidades compartidas requieren supportsAllDrives + includeItemsFromAllDrives
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id,name,modifiedTime,mimeType)',
      orderBy: 'modifiedTime desc',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      driveId: undefined,
      corpora: 'allDrives'
    })

    const archivos = res.data.files || []

    // Debug — devolver todos los archivos encontrados
    const nombresEncontrados = archivos.map(f => f.name)

    // Buscar archivo CF del mes: 2605_CF.xlsx
    const archivoCF = archivos.find(f =>
      f.name.toLowerCase() === `${aamm}_cf.xlsx` ||
      (f.name.toLowerCase().startsWith(aamm.toLowerCase()) &&
       f.name.toLowerCase().includes('_cf') &&
       !f.name.toLowerCase().includes('correspondencia') &&
       f.name.toLowerCase().endsWith('.xlsx'))
    ) || null

    // Buscar correspondencias
    const archivoCorr = archivos.find(f =>
      f.name.toLowerCase().includes(aamm.toLowerCase()) &&
      f.name.toLowerCase().includes('_cf') &&
      f.name.toLowerCase().includes('correspondencia') &&
      f.name.toLowerCase().endsWith('.xlsx')
    ) || null

    return Response.json({
      archivoCF,
      archivoCorr,
      todos: archivos.slice(0, 30),
      nombresEncontrados,
      totalEncontrados: archivos.length
    })
  } catch (e) {
    console.error('buscar-drive error:', e)
    return Response.json({ error: e.message, stack: e.stack }, { status: 500 })
  }
}
