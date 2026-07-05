// app/api/drive/test/route.js
// Diagnóstico: comprueba que la Service Account puede CREAR (y borrar) en 3.AÑOS.
// Abrir /api/drive/test en el navegador. Debe devolver { ok: true }.

import { google } from 'googleapis'

export const runtime = 'nodejs'

const ROOT_3ANOS = '1yQn99Bo1gxHNeDNRY93LprzeS6RaXjRY'

export async function GET() {
  try {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS)
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive'],
    })
    const drive = google.drive({ version: 'v3', auth })

    const created = await drive.files.create({
      requestBody: {
        name: '__test_crm_' + Date.now(),
        mimeType: 'application/vnd.google-apps.folder',
        parents: [ROOT_3ANOS],
      },
      fields: 'id, name',
      supportsAllDrives: true,
    })
    const id = created.data.id
    await drive.files.delete({ fileId: id, supportsAllDrives: true })

    return Response.json({ ok: true, mensaje: 'Acceso de escritura OK en 3.AÑOS (carpeta creada y borrada).' })
  } catch (e) {
    return Response.json({ ok: false, error: e?.message || 'error' }, { status: 500 })
  }
}
