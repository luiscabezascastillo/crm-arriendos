// lib/driveArchivo.js
// Archiva el PDF de una carta de liquidación en Google Drive (unidad compartida),
// en la ruta: 3.AÑOS / <año> / <AAMM> / 4-CartasAutomaticas
// Crea las carpetas que falten (año, mes y 4-CartasAutomaticas).
// Nombre: LIQUIDACION-<AAMM>-<idprop>-<Propietario>.pdf ; reenvíos -> -2, -3, ...
// Usa la misma auth que el resto del CRM (GOOGLE_CREDENTIALS + Service Account).

import { google } from 'googleapis'
import { Readable } from 'node:stream'

// ID de la carpeta "3.AÑOS" en la unidad compartida 2.SD.ADMON-CONTAB.
const ROOT_3ANOS = '1yQn99Bo1gxHNeDNRY93LprzeS6RaXjRY'

function driveClient() {
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS)
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],   // escritura (crear carpetas + subir)
  })
  return google.drive({ version: 'v3', auth })
}

const esc = (s) => String(s).replace(/'/g, "\\'")

// Busca una subcarpeta por nombre bajo parentId; si no existe, la crea. Devuelve su id.
async function getOrCreateFolder(drive, parentId, name) {
  const q = `'${parentId}' in parents and name = '${esc(name)}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  const res = await drive.files.list({
    q, fields: 'files(id,name)',
    supportsAllDrives: true, includeItemsFromAllDrives: true, corpora: 'allDrives',
  })
  if (res.data.files && res.data.files.length) return res.data.files[0].id
  const created = await drive.files.create({
    requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
    fields: 'id', supportsAllDrives: true,
  })
  return created.data.id
}

// Encuentra un nombre libre: base.pdf, si existe base-2.pdf, base-3.pdf, ...
async function nombreLibre(drive, folderId, base) {
  let n = 1
  while (true) {
    const nombre = (n === 1 ? base : `${base}-${n}`) + '.pdf'
    const q = `'${folderId}' in parents and name = '${esc(nombre)}' and trashed = false`
    const res = await drive.files.list({
      q, fields: 'files(id)',
      supportsAllDrives: true, includeItemsFromAllDrives: true, corpora: 'allDrives',
    })
    if (!res.data.files || res.data.files.length === 0) return nombre
    n++
    if (n > 50) return `${base}-${Date.now()}.pdf`  // salvaguarda anti-bucle
  }
}

// aamm '2607' -> año '2026'
function anioDeAamm(aamm) { return '20' + String(aamm).slice(0, 2) }

/**
 * Archiva el PDF. Devuelve { fileId, url, nombre } o lanza error.
 * @param {object} p
 * @param {string} p.aamm       - '2607'
 * @param {string} p.nombreBase - 'LIQUIDACION-2607-P004-Alberto Cabezas' (SIN .pdf)
 * @param {Uint8Array|Buffer} p.pdfBytes
 */
export async function archivarCartaEnDrive({ aamm, nombreBase, pdfBytes }) {
  const drive = driveClient()
  const fAnio = await getOrCreateFolder(drive, ROOT_3ANOS, anioDeAamm(aamm))   // 2026
  const fMes = await getOrCreateFolder(drive, fAnio, String(aamm))              // 2607
  const fCartas = await getOrCreateFolder(drive, fMes, '4-CartasAutomaticas')

  const nombre = await nombreLibre(drive, fCartas, nombreBase)
  const created = await drive.files.create({
    requestBody: { name: nombre, parents: [fCartas] },
    media: { mimeType: 'application/pdf', body: Readable.from(Buffer.from(pdfBytes)) },
    fields: 'id, webViewLink',
    supportsAllDrives: true,
  })
  return { fileId: created.data.id, url: created.data.webViewLink || '', nombre }
}
