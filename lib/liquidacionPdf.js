// lib/liquidacionPdf.js
// Genera el PDF de la carta de liquidación mensual de un propietario.
// Usa pdf-lib (JS puro, funciona en Vercel serverless). Requiere: npm install pdf-lib
//
// generarPdfLiquidacion({ bloque, mesTxt, fecha, despedida, logoDataUrl }) -> Uint8Array
//
// `bloque` es EXACTAMENTE el objeto que arma la Vista CARTAS por propietario:
//   { idprop, propietario, inmuebles:[{ idadmon, esP, propiedad, comienzo, final,
//       arrendatario, rut, aCobrar, admon, iva, descuentos, aTransferir,
//       des:[{monto,texto}], ajuste, nota }...],
//     totales:{ aCobrar, admon, iva, descuentos, aTransferir } }

import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ── Ajustes rápidos (Luis) ──────────────────────────────────────────────
const LANDSCAPE = true          // A4 apaisado (11 columnas caben mejor). Poner false para vertical.
const TITULO = 'LIQUIDACION AUTOMATICA MENSUAL DE ARRIENDO'
const DE = 'Servicio de Informacion al Cliente'
// ────────────────────────────────────────────────────────────────────────

const money = n => { const v = Math.round(Number(n) || 0); return '$' + v.toLocaleString('es-CL') }
const GREEN = rgb(0.086, 0.639, 0.290)
const AMBER = rgb(0.706, 0.325, 0.035)
const GREY = rgb(0.29, 0.33, 0.39)
const DARK = rgb(0.10, 0.10, 0.18)
const HEADBG = rgb(0.20, 0.255, 0.333)
const LINE = rgb(0.88, 0.87, 0.83)
const TOTBG = rgb(0.945, 0.96, 0.98)

export async function generarPdfLiquidacion({ bloque, mesTxt, fecha, despedida, logoDataUrl, borrador }) {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const W = LANDSCAPE ? 842 : 595
  const H = LANDSCAPE ? 595 : 842
  const M = 40                         // margen
  const contentW = W - M * 2
  const bottom = M + 40                // margen inferior para despedida/paginado

  let page = pdf.addPage([W, H])
  let y = H - M

  // Logo. Si no llega en dataURL, se lee de public/logo-fcr.png (servidor nodejs).
  let logoImg = null
  let logoSrc = logoDataUrl
  if (!logoSrc) {
    try {
      const buf = readFileSync(join(process.cwd(), 'public', 'logo-fcr.png'))
      logoSrc = 'data:image/png;base64,' + Buffer.from(buf).toString('base64')
    } catch { logoSrc = null }
  }
  if (logoSrc) {
    try {
      const b64 = logoSrc.split(',')[1]
      const bytes = Uint8Array.from(Buffer.from(b64, 'base64'))
      logoImg = logoSrc.includes('image/png')
        ? await pdf.embedPng(bytes)
        : await pdf.embedJpg(bytes)
    } catch { logoImg = null }
  }

  // Sanea a caracteres que la fuente estándar (WinAnsi/Latin-1) sabe dibujar.
  // Evita crashes con comillas tipográficas, guiones largos, flechas, emojis, etc.
  const wa = (t) => String(t ?? '')
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/[\u2026]/g, '...')
    .replace(/[\u2192\u21B3\u2191\u2193\u2190\u25B8\u2022]/g, '-')
    .replace(/[\u00A0]/g, ' ')
    .replace(/[^\x00-\xFF]/g, '')   // descarta lo que quede fuera de Latin-1

  const text = (t, x, yy, f = font, size = 9, color = DARK) => page.drawText(wa(t), { x, y: yy, size, font: f, color })
  const rightText = (t, xRight, yy, f = font, size = 9, color = DARK) => {
    const s = wa(t); text(s, xRight - f.widthOfTextAtSize(s, size), yy, f, size, color)
  }
  const fit = (t, f, size, maxW) => {
    let s = wa(t)
    if (f.widthOfTextAtSize(s, size) <= maxW) return s
    while (s.length && f.widthOfTextAtSize(s + '...', size) > maxW) s = s.slice(0, -1)
    return s + '...'
  }

  // ── Cabecera de la carta ──
  if (logoImg) {
    const lw = 120, lh = (logoImg.height / logoImg.width) * lw
    page.drawImage(logoImg, { x: M, y: y - lh, width: lw, height: lh })
    y -= lh + 6
  } else {
    text('FONDO CAPITAL RENT SpA', M, y - 14, bold, 15, DARK); y -= 22
  }
  // Título centrado
  const tW = bold.widthOfTextAtSize(TITULO, 13)
  text(TITULO, M + (contentW - tW) / 2, y - 14, bold, 13, DARK); y -= 30

  // Meta (Fecha / Para / De / Asunto)
  const meta = [
    ['Fecha:', fecha || ''],
    ['Para:', `${bloque.propietario || ''}  (${bloque.idprop || ''})`],
    ['De:', DE],
    ['Asunto:', `Liquidacion de arriendo · ${mesTxt}`],
  ]
  for (const [k, v] of meta) { text(k, M, y - 11, bold, 9.5); text(v, M + 55, y - 11, font, 9.5); y -= 15 }
  y -= 6
  text(`Estimado(a) ${bloque.propietario || ''}:`, M, y - 11, font, 10); y -= 15
  text(`Le adjuntamos el detalle de su liquidacion correspondiente a ${mesTxt}.`, M, y - 11, font, 10); y -= 22

  // ── Definición de columnas ──
  const hayDesc = Math.abs(Number(bloque.totales?.descuentos || 0)) > 0
  let cols = [
    { key: 'idadmon', label: 'IdAdmon', w: 55, align: 'l' },
    { key: 'propiedad', label: 'Propiedad', w: 150, align: 'l' },
    { key: 'comienzo', label: 'Comienzo', w: 62, align: 'l' },
    { key: 'final', label: 'Final', w: 62, align: 'l' },
    { key: 'arrendatario', label: 'Arrendatario', w: 150, align: 'l' },
    { key: 'rut', label: 'RUT', w: 78, align: 'l' },
    { key: 'aCobrar', label: 'A Cobrar', w: 66, align: 'r' },
    { key: 'admon', label: 'Admon', w: 56, align: 'r' },
    { key: 'iva', label: 'IVA', w: 52, align: 'r' },
    ...(hayDesc ? [{ key: 'descuentos', label: 'Descuentos', w: 66, align: 'r' }] : []),
    { key: 'aTransferir', label: 'A transferir', w: 72, align: 'r' },
  ]
  // Escalar para que siempre quepa en el ancho disponible
  const sumW = cols.reduce((a, c) => a + c.w, 0)
  const k = contentW / sumW
  let cx = M
  cols = cols.map(c => { const x = cx; const w = c.w * k; cx += w; return { ...c, x, w } })

  const drawHeader = () => {
    page.drawRectangle({ x: M, y: y - 16, width: contentW, height: 16, color: HEADBG })
    for (const c of cols) {
      const s = c.label
      if (c.align === 'r') rightText(s, c.x + c.w - 5, y - 12, bold, 8.5, rgb(1, 1, 1))
      else text(s, c.x + 4, y - 12, bold, 8.5, rgb(1, 1, 1))
    }
    y -= 16
  }
  const pageBreak = (need = 16) => {
    if (y - need < bottom) {
      page = pdf.addPage([W, H]); y = H - M
      drawHeader()
    }
  }

  drawHeader()

  const val = (x, key) => {
    if (key === 'idadmon') return x.idadmon || ''
    if (key === 'propiedad') return x.propiedad || '—'
    if (key === 'comienzo') return x.esP ? '' : (x.comienzo || '')
    if (key === 'final') return x.esP ? '' : (x.final || '')
    if (key === 'arrendatario') return x.esP ? 'EN CAPTACION ARRENDATARIO' : (x.arrendatario || '')
    if (key === 'rut') return x.esP ? '' : (x.rut || '')
    if (key === 'aCobrar') return x.esP ? '' : money(x.aCobrar)
    if (key === 'admon') return x.esP ? '' : money(x.admon)
    if (key === 'iva') return x.esP ? '' : money(x.iva)
    if (key === 'descuentos') return x.descuentos ? money(x.descuentos) : ''
    if (key === 'aTransferir') return (x.esP && !x.descuentos) ? '' : money(x.aTransferir)
    return ''
  }

  for (const x of (bloque.inmuebles || [])) {
    pageBreak(16)
    for (const c of cols) {
      const raw = val(x, c.key)
      const isMoney = c.align === 'r'
      const color = (c.key === 'descuentos' && x.descuentos) ? GREEN : DARK
      if (isMoney) rightText(raw, c.x + c.w - 5, y - 11, font, 8.5, color)
      else text(fit(raw, font, 8.5, c.w - 6), c.x + 4, y - 11, font, 8.5, color)
    }
    page.drawLine({ start: { x: M, y: y - 15 }, end: { x: M + contentW, y: y - 15 }, thickness: 0.5, color: LINE })
    y -= 15

    // Sub-líneas: descuentos (verde) · ajuste (ámbar) · comentario (gris)
    const subs = []
    if (!x.esP) {
      for (const d of (x.des || [])) subs.push({ color: GREEN, monto: money(d.monto), txt: d.texto || 'Descuento' })
      if (x.ajuste) subs.push({ color: AMBER, monto: money(x.ajuste), txt: `Se ha realizado un ajuste de ${money(x.ajuste)} en la renta` })
      if (x.nota) subs.push({ color: GREY, monto: '', txt: `Nota: ${x.nota}` })
    }
    for (const s of subs) {
      pageBreak(13)
      text('\u00BB', M + 12, y - 10, font, 8, GREY)
      if (s.monto) rightText(s.monto, M + 120, y - 10, bold, 8, s.color)
      text(fit(s.txt, font, 8, contentW - 140), M + 130, y - 10, font, 8, s.color)
      y -= 13
    }
  }

  // ── Fila TOTALES ──
  pageBreak(20)
  page.drawRectangle({ x: M, y: y - 18, width: contentW, height: 18, color: TOTBG })
  const t = bloque.totales || {}
  text('TOTALES', cols[0].x + 4, y - 13, bold, 9, DARK)
  const put = (key, v) => { const c = cols.find(c => c.key === key); if (c) rightText(money(v), c.x + c.w - 5, y - 13, bold, 9, DARK) }
  put('aCobrar', t.aCobrar); put('admon', t.admon); put('iva', t.iva)
  if (hayDesc) put('descuentos', t.descuentos)
  put('aTransferir', t.aTransferir)
  y -= 30

  // ── Despedida ──
  pageBreak(40)
  const desp = (despedida || 'Desde Fondo Capital Rent SpA le deseamos un feliz mes. Atentamente, Servicio de Informacion al Cliente.').trim()
  // Envolver la despedida a ~110 caracteres por línea
  const words = desp.split(/\s+/); let line = ''
  for (const w of words) {
    const test = line ? line + ' ' + w : w
    if (font.widthOfTextAtSize(test, 10) > contentW) { text(line, M, y - 11, font, 10); y -= 14; line = w; pageBreak(20) }
    else line = test
  }
  if (line) { text(line, M, y - 11, font, 10); y -= 14 }

  // ── Firma (rúbrica abstracta dibujada + texto) ──
  pageBreak(70)
  y -= 22
  const INK = rgb(0.10, 0.20, 0.45)   // tinta azul-oscuro
  // rúbrica: trazo cursivo con floritura final (path SVG; su origen queda en (x,y), y hacia abajo)
  const firma = 'M 2 20 C 20 -6 36 42 56 16 C 70 -2 84 36 104 14 C 122 -4 140 34 162 14 C 182 -2 168 44 150 32 C 140 26 158 22 172 26'
  page.drawSvgPath(firma, { x: M + 4, y: y, borderColor: INK, borderWidth: 1.4 })
  y -= 40
  page.drawLine({ start: { x: M, y: y + 6 }, end: { x: M + 180, y: y + 6 }, thickness: 0.6, color: GREY })
  text('Fondo Capital Rent SpA', M, y - 6, bold, 10, DARK)
  text('Unidad de Informacion', M, y - 19, font, 9, GREY)
  y -= 26

  // Marca de agua diagonal "BORRADOR - NO ENVIAR" en todas las páginas (solo vista previa)
  if (borrador) {
    const wm = 'BORRADOR - NO ENVIAR'
    const ang = 30, rad = ang * Math.PI / 180
    for (const pg of pdf.getPages()) {
      const w = pg.getWidth(), h = pg.getHeight()
      // tamaño que ocupe ~85% del ancho de la página
      let size = 60
      while (size > 12 && bold.widthOfTextAtSize(wm, size) > w * 0.85) size -= 2
      const tw = bold.widthOfTextAtSize(wm, size)
      const x = w / 2 - (tw / 2) * Math.cos(rad)
      const y = h / 2 - (tw / 2) * Math.sin(rad)
      pg.drawText(wm, { x, y, size, font: bold, color: rgb(0.85, 0.12, 0.12), opacity: 0.18, rotate: degrees(ang) })
    }
  }

  return await pdf.save()
}
