// VERSION: v1 · 2026-07-10 · Generador PDF "Orden de Trabajo" (Mantención) con pdf-lib
// Uso (servidor): const bytes = await generarOrdenTrabajoPDF(data)  -> Uint8Array
// Calcado del patrón de lib/pdfOrden.js (misma librería y logo).
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { LOGO_FCR_PNG_BASE64 } from './logoFCR.js'

const A4 = [595.28, 841.89]
const M = 48
const AZUL = rgb(0.12, 0.16, 0.22)
const GRIS = rgb(0.42, 0.45, 0.5)
const LINEA = rgb(0.85, 0.87, 0.9)

function wrap(texto, font, size, maxW) {
  const words = String(texto || '').split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  for (const w of words) {
    const t = line ? line + ' ' + w : w
    if (font.widthOfTextAtSize(t, size) > maxW && line) { lines.push(line); line = w }
    else line = t
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['—']
}

export async function generarOrdenTrabajoPDF(data = {}) {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const page = pdf.addPage(A4)
  const [W, H] = A4
  const maxW = W - 2 * M
  let y = H - M

  // Logo
  let logoImg = null, logoW = 0, logoH = 0
  try {
    logoImg = await pdf.embedPng(Buffer.from(LOGO_FCR_PNG_BASE64, 'base64'))
    logoW = 90; logoH = logoImg.height * (logoW / logoImg.width)
    page.drawImage(logoImg, { x: W - M - logoW, y: y - logoH + 12, width: logoW, height: logoH })
  } catch (e) { logoImg = null }

  // Título
  page.drawText('ORDEN DE TRABAJO', { x: M, y: y - 6, size: 20, font: bold, color: AZUL })
  page.drawText('Mantención · Fondo Capital Rent', { x: M, y: y - 24, size: 11, font, color: GRIS })
  y -= 48
  page.drawText(`N° ${data.ticket || '—'}`, { x: M, y, size: 12, font: bold, color: AZUL })
  page.drawText(`Fecha: ${data.fecha || ''}`, { x: M + 200, y, size: 11, font, color: GRIS })
  y -= 18
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: LINEA })
  y -= 22

  const seccion = (titulo) => {
    page.drawText(titulo, { x: M, y, size: 12, font: bold, color: AZUL }); y -= 18
  }
  const campo = (k, v) => {
    page.drawText(k, { x: M, y, size: 9, font, color: GRIS })
    const lines = wrap(v, font, 11, maxW - 130)
    lines.forEach((ln, i) => page.drawText(ln, { x: M + 130, y: y - i * 13, size: 11, font, color: AZUL }))
    y -= Math.max(16, lines.length * 13 + 3)
  }

  seccion('Propiedad')
  campo('Inmueble', data.inmueble || '—')
  campo('IDADMON', data.idadmon || '—')
  campo('Propietario', data.propietario || '—')
  y -= 6

  seccion('Incidencia')
  campo('Categoría', data.categoria || '—')
  campo('Urgencia', data.urgencia || '—')
  campo('Descripción', data.descripcion || '—')
  y -= 6

  seccion('Proveedor asignado')
  campo('Nombre', data.proveedor?.nombre || '—')
  if (data.proveedor?.empresa) campo('Empresa', data.proveedor.empresa)
  campo('Contacto', data.proveedor?.telefono || data.proveedor?.email || '—')
  y -= 6

  if (data.presupuesto?.numero) {
    seccion('Presupuesto')
    campo('N° presupuesto', data.presupuesto.numero)
    campo('Total', data.presupuesto.total != null ? ('$' + Number(data.presupuesto.total).toLocaleString('es-CL')) : '—')
    y -= 6
  }

  // Instrucciones
  y -= 4
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: LINEA }); y -= 18
  seccion('Instrucciones')
  const instr = data.instrucciones ||
    'Se autoriza al proveedor a ejecutar el trabajo descrito. Coordinar el acceso con el arrendatario. ' +
    'Registrar fotos del antes y después. Cualquier costo adicional al presupuesto aprobado debe autorizarse por escrito antes de ejecutarse.'
  wrap(instr, font, 10, maxW).forEach((ln) => { page.drawText(ln, { x: M, y, size: 10, font, color: GRIS }); y -= 13 })

  // Firmas
  y -= 40
  const colW = (maxW - 30) / 2
  page.drawLine({ start: { x: M, y }, end: { x: M + colW, y }, thickness: 1, color: AZUL })
  page.drawLine({ start: { x: M + colW + 30, y }, end: { x: W - M, y }, thickness: 1, color: AZUL })
  y -= 12
  page.drawText('Autoriza · Fondo Capital', { x: M, y, size: 9, font, color: GRIS })
  page.drawText('Recibe · Proveedor', { x: M + colW + 30, y, size: 9, font, color: GRIS })
  if (data.emisor) { y -= 12; page.drawText(String(data.emisor), { x: M, y, size: 9, font, color: GRIS }) }

  return await pdf.save()
}

export default generarOrdenTrabajoPDF
