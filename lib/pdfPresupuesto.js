// VERSION: v2 · 2026-08-11 · lib/pdfPresupuesto.js — REDISEÑO PROFESIONAL, con la misma estética que el PDF del
//   término (lib/terminoPdf): membrete FCR, barra de sección oscura, tabla limpia y caja de TOTAL destacada.
//   Recibe las líneas YA calculadas (retención + markup embebidos e INVISIBLES); aquí solo se pinta. Hereda v1.
//   Uso: const bytes = await generarPresupuestoPDF(data) -> Uint8Array
//   data = { idadmon, inmueble, propietario, fecha,
//            secciones: [{ numero, descripcion, fecha, lineas:[{descripcion, cantidad, importe}], subtotal }],
//            neto, iva, total }

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { LOGO_FCR_PNG_BASE64 } from './logoFCR.js'

const money = n => '$' + Math.round(Number(n) || 0).toLocaleString('es-CL')
const n0 = v => { const x = Number(v); return isNaN(x) ? 0 : x }
const DARK = rgb(0.10, 0.10, 0.18)
const GREY = rgb(0.29, 0.33, 0.39)
const HEADBG = rgb(0.20, 0.255, 0.333)
const LINE = rgb(0.88, 0.87, 0.83)
const BOXBG = rgb(0.945, 0.96, 0.98)
const AZUL = rgb(0.122, 0.306, 0.475)

export async function generarPresupuestoPDF(data = {}) {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  let logoImg = null
  try { logoImg = await pdf.embedPng(Buffer.from(LOGO_FCR_PNG_BASE64, 'base64')) } catch { logoImg = null }

  const W = 595, H = 842, M = 42, contentW = W - M * 2
  let page = pdf.addPage([W, H])
  let y = H - M

  const wa = t => String(t ?? '')
    .replace(/[‘’‚′]/g, "'").replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, '-').replace(/[…]/g, '...')
    .replace(/[→↳↑↓←▸•]/g, '-').replace(/[ ]/g, ' ')
    .replace(/[^\x00-\xFF]/g, '')
  const text = (t, x, yy, f = font, size = 9, color = DARK) => page.drawText(wa(t), { x, y: yy, size, font: f, color })
  const rightText = (t, xR, yy, f = font, size = 9, color = DARK) => { const s = wa(t); text(s, xR - f.widthOfTextAtSize(s, size), yy, f, size, color) }
  const fit = (t, f, size, maxW) => { let s = wa(t); if (f.widthOfTextAtSize(s, size) <= maxW) return s; while (s.length && f.widthOfTextAtSize(s + '...', size) > maxW) s = s.slice(0, -1); return s + '...' }
  const ensure = need => { if (y - need < M + 40) { page = pdf.addPage([W, H]); y = H - M } }

  // ── Cabecera ──
  if (logoImg) { const lw = 110, lh = (logoImg.height / logoImg.width) * lw; page.drawImage(logoImg, { x: M, y: y - lh, width: lw, height: lh }); y -= lh + 8 }
  else { text('FONDO CAPITAL RENT SpA', M, y - 14, bold, 14, DARK); y -= 22 }
  text('PRESUPUESTO DE REPARACIONES', M, y - 15, bold, 15, DARK); y -= 24
  text(`Fecha de emision: ${data.fecha || ''}`, M, y - 11, font, 9.5, GREY); y -= 20

  // Meta (dos columnas)
  const colW = contentW / 2
  const metaL = [['Contrato', data.idadmon || ''], ['Inmueble', data.inmueble || '']]
  const metaR = [['Propietario', data.propietario || '']]
  const rowsN = Math.max(metaL.length, metaR.length)
  for (let i = 0; i < rowsN; i++) {
    if (metaL[i]) { text(metaL[i][0] + ':', M, y - 10, bold, 8.5, GREY); text(fit(metaL[i][1], font, 9.5, colW - 95), M + 90, y - 10, font, 9.5, DARK) }
    if (metaR[i]) { text(metaR[i][0] + ':', M + colW, y - 10, bold, 8.5, GREY); text(fit(metaR[i][1], font, 9.5, colW - 95), M + colW + 90, y - 10, font, 9.5, DARK) }
    y -= 15
  }
  y -= 8

  const sectionTitle = t => { ensure(24); page.drawRectangle({ x: M, y: y - 16, width: contentW, height: 16, color: HEADBG }); text(t, M + 6, y - 12, bold, 9, rgb(1, 1, 1)); y -= 16 }
  const colsHeader = () => {
    ensure(16)
    text('Concepto', M + 4, y - 11, bold, 8, GREY)
    rightText('Cant.', M + contentW - 96, y - 11, bold, 8, GREY)
    rightText('Importe', M + contentW - 4, y - 11, bold, 8, GREY)
    page.drawLine({ start: { x: M, y: y - 14 }, end: { x: M + contentW, y: y - 14 }, thickness: 0.6, color: LINE }); y -= 15
  }

  const secciones = data.secciones || []
  const multi = secciones.length > 1

  sectionTitle('DETALLE DEL PRESUPUESTO')
  colsHeader()
  for (const sec of secciones) {
    if (multi) {
      ensure(14)
      const tit = [sec.numero ? 'Presupuesto ' + sec.numero : 'Presupuesto', sec.descripcion || '', sec.fecha ? '(' + sec.fecha + ')' : ''].filter(Boolean).join(' - ')
      text(fit(tit, bold, 8.5, contentW - 6), M + 4, y - 10, bold, 8.5, AZUL); y -= 13
    }
    for (const ln of (sec.lineas || [])) {
      ensure(14)
      text(fit(ln.descripcion || '-', font, 8.5, contentW - 150), M + 4, y - 10, font, 8.5, DARK)
      const cant = (ln.cantidad != null && ln.cantidad !== '') ? String(ln.cantidad) : ''
      if (cant) rightText(cant, M + contentW - 96, y - 10, font, 8.5, GREY)
      rightText(money(ln.importe), M + contentW - 4, y - 10, font, 8.5, DARK)
      page.drawLine({ start: { x: M, y: y - 13 }, end: { x: M + contentW, y: y - 13 }, thickness: 0.4, color: LINE }); y -= 14
    }
    if (multi) {
      ensure(15)
      page.drawRectangle({ x: M, y: y - 14, width: contentW, height: 14, color: BOXBG })
      text('Subtotal', M + 6, y - 10, bold, 8, DARK); rightText(money(sec.subtotal), M + contentW - 4, y - 10, bold, 8, DARK); y -= 16
    }
  }
  y -= 8

  // ── Caja de TOTALES ──
  ensure(58)
  const th = 52
  page.drawRectangle({ x: M, y: y - th, width: contentW, height: th, color: BOXBG, borderColor: LINE, borderWidth: 0.6 })
  const totRow = (label, valor, yy, big) => {
    const s = big ? 13 : 10, f = big ? bold : font
    text(label, M + 12, yy, f, s, big ? DARK : GREY)
    rightText(valor, M + contentW - 12, yy, bold, s, big ? AZUL : DARK)
  }
  totRow('Neto', money(data.neto), y - 16)
  totRow('IVA (19%)', money(data.iva), y - 31)
  page.drawLine({ start: { x: M + 12, y: y - 38 }, end: { x: M + contentW - 12, y: y - 38 }, thickness: 0.5, color: LINE })
  totRow('TOTAL', money(data.total), y - 49, true)
  y -= th + 12

  // ── Cierre institucional ──
  ensure(34)
  page.drawLine({ start: { x: M, y }, end: { x: M + 150, y }, thickness: 1, color: AZUL }); y -= 14
  text('Fondo Capital Rent SpA', M, y, bold, 10, AZUL); y -= 13
  text('Importes en pesos chilenos, IVA incluido en el total. Documento emitido por Fondo Capital Rent SpA.', M, y, font, 8, GREY)

  return await pdf.save()
}
