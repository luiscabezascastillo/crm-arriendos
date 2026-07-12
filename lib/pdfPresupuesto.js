// VERSION: v1 · 2026-07-12 · lib/pdfPresupuesto.js
//   Genera el PDF del PRESUPUESTO de reparaciones de un término (pdf-lib), clonando el estilo de
//   lib/pdfOrden.js (membrete FCR, caja de cabecera, tabla de líneas, totales).
//   Recibe las líneas YA calculadas (retención + markup embebidos e INVISIBLES); aquí solo se pinta.
//   Uso: const bytes = await generarPresupuestoPDF(data)  -> Uint8Array
//   data = { idadmon, inmueble, propietario, fecha,
//            secciones: [{ numero, descripcion, fecha, lineas:[{descripcion, cantidad, importe}], subtotal }],
//            neto, iva, total }

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { LOGO_FCR_PNG_BASE64 } from './logoFCR.js'

const A4 = [595.28, 841.89]
const M = 48
const fmt = n => '$' + Math.round(Number(n) || 0).toLocaleString('es-CL')

// Recorta un texto para que quepa en maxW, añadiendo '…' si hace falta.
function fit(text, f, size, maxW) {
  let s = String(text ?? '')
  if (f.widthOfTextAtSize(s, size) <= maxW) return s
  while (s.length > 1 && f.widthOfTextAtSize(s + '…', size) > maxW) s = s.slice(0, -1)
  return s + '…'
}

export async function generarPresupuestoPDF(data = {}) {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  let logoImg = null, logoW = 0, logoH = 0
  try { logoImg = await pdf.embedPng(Buffer.from(LOGO_FCR_PNG_BASE64, 'base64')); logoW = 90; logoH = logoImg.height * (logoW / logoImg.width) } catch (e) { logoImg = null }

  const azul = rgb(0.047, 0.267, 0.486)
  const gris = rgb(0.42, 0.45, 0.5)
  const negro = rgb(0.1, 0.1, 0.18)
  const linea = rgb(0.9, 0.9, 0.88)

  const W = A4[0], H = A4[1], maxW = W - M * 2
  let page = pdf.addPage(A4)
  let y = H - M
  const ensure = (space) => { if (y - space < M) { page = pdf.addPage(A4); y = H - M } }
  const hr = () => { ensure(12); page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: linea }); y -= 12 }

  // columnas de la tabla
  const colDesc = M + 4
  const colCant = W - M - 200   // cantidad, alineada a la derecha en esta x
  const colImp = W - M - 4      // importe, alineado a la derecha en esta x

  // ── Encabezado ──
  if (logoImg) page.drawImage(logoImg, { x: W - M - logoW, y: y - logoH + 14, width: logoW, height: logoH })
  page.drawText('PRESUPUESTO DE REPARACIONES', { x: M, y: y - 15, size: 15, font: bold, color: azul })
  y -= 23
  page.drawText('Fondo Capital Rent SpA', { x: M, y: y - 8.5, size: 8.5, font, color: gris })
  if (data.fecha) page.drawText(`Fecha: ${data.fecha}`, { x: M + 240, y: y - 8.5, size: 8.5, font, color: gris })
  y -= 16
  hr()

  // ── Caja de cabecera (contrato / inmueble / propietario) ──
  const cajaAlto = 34
  ensure(cajaAlto + 10)
  const cy = y
  page.drawRectangle({ x: M, y: cy - cajaAlto, width: maxW, height: cajaAlto, color: rgb(0.96, 0.97, 0.99), borderColor: rgb(0.82, 0.86, 0.92), borderWidth: 1 })
  page.drawText(`Contrato ${data.idadmon || ''}`, { x: M + 10, y: cy - 15, size: 11, font: bold, color: negro })
  page.drawText(fit(data.inmueble || '', font, 8.5, maxW * 0.55), { x: M + 10, y: cy - 27, size: 8.5, font, color: gris })
  if (data.propietario) {
    const t = 'Propietario: ' + data.propietario
    const tw = font.widthOfTextAtSize(t, 8.5)
    page.drawText(t, { x: W - M - 10 - tw, y: cy - 27, size: 8.5, font, color: gris })
  }
  y = cy - cajaAlto - 12

  // ── Cabecera de la tabla ──
  const thR = (txt, x) => { const s = 8, w = bold.widthOfTextAtSize(txt, s); page.drawText(txt, { x: x - w, y: y - 8, size: s, font: bold, color: gris }) }
  ensure(16)
  page.drawText('DESCRIPCIÓN', { x: colDesc, y: y - 8, size: 8, font: bold, color: gris })
  thR('CANT.', colCant)
  thR('IMPORTE', colImp)
  y -= 12
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.7, color: linea }); y -= 8

  // ── Secciones (una por presupuesto) ──
  const secciones = data.secciones || []
  const multi = secciones.length > 1
  for (const sec of secciones) {
    ensure(16)
    const tit = [sec.numero ? 'Presupuesto ' + sec.numero : 'Presupuesto', sec.descripcion || '', sec.fecha ? '(' + sec.fecha + ')' : ''].filter(Boolean).join(' · ')
    page.drawText(fit(tit, bold, 9.5, maxW), { x: M, y: y - 9, size: 9.5, font: bold, color: azul }); y -= 15

    for (const ln of (sec.lineas || [])) {
      ensure(13)
      page.drawText(fit(ln.descripcion || '—', font, 9, colCant - colDesc - 40), { x: colDesc, y: y - 9, size: 9, font, color: negro })
      const cant = (ln.cantidad != null && ln.cantidad !== '') ? String(ln.cantidad) : ''
      if (cant) { const w = font.widthOfTextAtSize(cant, 9); page.drawText(cant, { x: colCant - w, y: y - 9, size: 9, font, color: gris }) }
      const imp = fmt(ln.importe)
      const iw = font.widthOfTextAtSize(imp, 9)
      page.drawText(imp, { x: colImp - iw, y: y - 9, size: 9, font, color: negro })
      y -= 13
    }
    // subtotal de la sección (solo si hay varias secciones)
    if (multi) {
      ensure(14)
      const st = 'Subtotal: ' + fmt(sec.subtotal)
      const stw = bold.widthOfTextAtSize(st, 9)
      page.drawText(st, { x: colImp - stw, y: y - 9, size: 9, font: bold, color: gris })
      y -= 16
    } else {
      y -= 6
    }
  }

  // ── Totales ──
  y -= 4
  hr()
  const totRow = (label, valor, big) => {
    ensure(16)
    const s = big ? 12 : 9.5
    const lf = big ? bold : font
    const lw = lf.widthOfTextAtSize(label, s)
    const vw = bold.widthOfTextAtSize(valor, s)
    page.drawText(label, { x: colImp - 130 - lw, y: y - s, size: s, font: lf, color: big ? negro : gris })
    page.drawText(valor, { x: colImp - vw, y: y - s, size: s, font: bold, color: big ? azul : negro })
    y -= s + 5
  }
  totRow('Neto', fmt(data.neto))
  totRow('IVA (19%)', fmt(data.iva))
  totRow('TOTAL', fmt(data.total), true)

  y -= 12
  ensure(24)
  page.drawText('Importes en pesos chilenos, IVA incluido en el total. Documento emitido por Fondo Capital Rent SpA.', { x: M, y: y - 8, size: 7.5, font, color: gris })

  return await pdf.save()
}
