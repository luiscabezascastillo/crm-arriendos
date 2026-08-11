// lib/terminoPdf.js
// VERSION: v6 · 2026-08-11 · Se quita el "Estado: T-…" del bloque RESULTADO (código interno, no interesa al receptor).
//   Hereda v5.
// VERSION: v5 · 2026-08-11 · (1) GARANTÍA en su propia línea, bien formada y destacada en VERDE (importe a la derecha),
//   justo debajo del meta; se quita del meta para no duplicar. (2) Reparaciones: detalle del presupuesto + "Total
//   reparaciones" (una sola vez, sin repetir el importe). Hereda v4.
// VERSION: v4 · 2026-08-11 · Reparaciones en UNA tabla plana: detalle del presupuesto + una sola línea "Arreglos segun
//   presupuesto" (sin total en negrita ni bloque "Otras reparaciones" repetido). El importe del presupuesto aparece una
//   sola vez. Los descuentos de garantía ya no llegan (se filtran en la vista). Hereda v3.
// VERSION: v3 · 2026-08-11 · Se quita el texto "(cercanos al cierre)" del título de la sección de descuentos (queda
//   "DESCUENTOS APLICADOS"). El filtro no cambia, solo la etiqueta. Hereda v2.
// VERSION: v2 · 2026-08-11 · El PDF ya NO muestra el Propietario, y la garantía sale solo con el importe (sin
//   "quién la tiene"). Cambio solo de presentación del PDF (la vista y el endpoint no cambian). Hereda v1.
// VERSION: v1 · 2026-08-11 · PDF PROFESIONAL de LIQUIDACIÓN DE TÉRMINO DE CONTRATO. pdf-lib (JS puro, corre en
//   Vercel serverless). Un solo documento con logo FCR: cabecera, datos económicos, servicios, reparaciones +
//   presupuesto (detalle + total, precio final; coste y markup NUNCA se muestran), descuentos aplicados (los que
//   llegan ya filtrados a "cercanos al cierre") y RESULTADO destacado. Marca de agua BORRADOR en vista previa.
//
//   generarPdfTermino({ datos, fecha, borrador, logoDataUrl }) -> Uint8Array
//   datos = { idadmon, inmueble, arrendatario, propietario, fechaEntrega,
//     garantia:{monto,quien}, resultado:{tipo,valor,label},
//     datosEconomicos:[{concepto,monto,comentario}], servicios:[{concepto,monto,comentario}],
//     reparaciones:{ total, lineas:[{concepto,monto,comentario}], presupuesto:{ total, detalle:[{descripcion,importe}] } },
//     descuentos:[{num,fecha,imputarA,monto,comentario}] }

import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const money = n => { const v = Math.round(Number(n) || 0); return '$' + v.toLocaleString('es-CL') }
const n0 = v => { const x = Number(v); return isNaN(x) ? 0 : x }
const GREEN = rgb(0.086, 0.639, 0.290)
const RED = rgb(0.61, 0.11, 0.11)
const GREY = rgb(0.29, 0.33, 0.39)
const DARK = rgb(0.10, 0.10, 0.18)
const HEADBG = rgb(0.20, 0.255, 0.333)
const LINE = rgb(0.88, 0.87, 0.83)
const BOXBG = rgb(0.945, 0.96, 0.98)
const AZUL = rgb(0.122, 0.306, 0.475)

export async function generarPdfTermino({ datos, fecha, borrador, logoDataUrl }) {
  const d = datos || {}
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const W = 595, H = 842, M = 42, contentW = W - M * 2
  let page = pdf.addPage([W, H])
  let y = H - M

  // Logo (dataURL o public/logo-fcr.png en el servidor)
  let logoSrc = logoDataUrl
  if (!logoSrc) {
    try { const buf = readFileSync(join(process.cwd(), 'public', 'logo-fcr.png')); logoSrc = 'data:image/png;base64,' + Buffer.from(buf).toString('base64') } catch { logoSrc = null }
  }
  let logoImg = null
  if (logoSrc) {
    try { const bytes = Uint8Array.from(Buffer.from(logoSrc.split(',')[1], 'base64')); logoImg = logoSrc.includes('image/png') ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes) } catch { logoImg = null }
  }

  // Sanea a Latin-1 (evita crashes con comillas tipográficas, guiones largos, flechas, emojis…)
  const wa = t => String(t ?? '')
    .replace(/[‘’‚′]/g, "'").replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, '-').replace(/[…]/g, '...')
    .replace(/[→↳↑↓←▸•]/g, '-').replace(/[ ]/g, ' ')
    .replace(/[^\x00-\xFF]/g, '')
  const text = (t, x, yy, f = font, size = 9, color = DARK) => page.drawText(wa(t), { x, y: yy, size, font: f, color })
  const rightText = (t, xR, yy, f = font, size = 9, color = DARK) => { const s = wa(t); text(s, xR - f.widthOfTextAtSize(s, size), yy, f, size, color) }
  const fit = (t, f, size, maxW) => { let s = wa(t); if (f.widthOfTextAtSize(s, size) <= maxW) return s; while (s.length && f.widthOfTextAtSize(s + '...', size) > maxW) s = s.slice(0, -1); return s + '...' }
  const ensure = need => { if (y - need < M + 44) { page = pdf.addPage([W, H]); y = H - M } }

  // ── Cabecera ──
  if (logoImg) { const lw = 110, lh = (logoImg.height / logoImg.width) * lw; page.drawImage(logoImg, { x: M, y: y - lh, width: lw, height: lh }); y -= lh + 8 }
  else { text('FONDO CAPITAL RENT SpA', M, y - 14, bold, 14, DARK); y -= 22 }
  text('LIQUIDACION DE TERMINO DE CONTRATO', M, y - 15, bold, 15, DARK); y -= 24
  text(`Fecha de emision: ${fecha || ''}`, M, y - 11, font, 9.5, GREY); y -= 20

  // Meta en dos columnas
  const colW = contentW / 2
  // El PDF NO muestra el propietario. La garantía va en su propia línea, destacada en verde (justo debajo del meta).
  const metaL = [['IDADMON', d.idadmon || ''], ['Inmueble', d.inmueble || ''], ['Fecha de entrega', d.fechaEntrega || '']]
  const metaR = [['Arrendatario', d.arrendatario || '']]
  const rowsN = Math.max(metaL.length, metaR.length)
  for (let i = 0; i < rowsN; i++) {
    if (metaL[i]) { text(metaL[i][0] + ':', M, y - 10, bold, 8.5, GREY); text(fit(metaL[i][1], font, 9.5, colW - 100), M + 96, y - 10, font, 9.5, DARK) }
    if (metaR[i]) { text(metaR[i][0] + ':', M + colW, y - 10, bold, 8.5, GREY); text(fit(metaR[i][1], font, 9.5, colW - 105), M + colW + 105, y - 10, font, 9.5, DARK) }
    y -= 15
  }
  y -= 6
  // Línea de GARANTÍA entregada: bien formada, importe a la derecha y en VERDE (es el saldo a favor del que se descuenta).
  if (n0(d.garantia && d.garantia.monto) > 0) {
    ensure(20)
    page.drawRectangle({ x: M, y: y - 17, width: contentW, height: 17, color: rgb(0.90, 0.96, 0.91) })
    text('GARANTIA ENTREGADA', M + 6, y - 12, bold, 9.5, GREEN)
    rightText(money(d.garantia.monto), M + contentW - 6, y - 12, bold, 10, GREEN)
    y -= 23
  }

  // ── Helpers de sección/tabla ──
  const sectionTitle = t => { ensure(24); page.drawRectangle({ x: M, y: y - 16, width: contentW, height: 16, color: HEADBG }); text(t, M + 6, y - 12, bold, 9, rgb(1, 1, 1)); y -= 16 }
  const tableRows = (cols, rows, opts = {}) => {
    const sumW = cols.reduce((a, c) => a + c.w, 0), k = contentW / sumW; let cx = M
    const C = cols.map(c => { const x = cx, w = c.w * k; cx += w; return { ...c, x, w } })
    ensure(16)
    for (const c of C) { if (c.align === 'r') rightText(c.label, c.x + c.w - 4, y - 11, bold, 8, GREY); else text(c.label, c.x + 4, y - 11, bold, 8, GREY) }
    page.drawLine({ start: { x: M, y: y - 14 }, end: { x: M + contentW, y: y - 14 }, thickness: 0.6, color: LINE }); y -= 15
    for (const r of rows) {
      ensure(14)
      for (let i = 0; i < C.length; i++) { const c = C[i]; const val = r[i] == null ? '' : r[i]; if (c.align === 'r') rightText(String(val), c.x + c.w - 4, y - 10, font, 8.5, DARK); else text(fit(String(val), font, 8.5, c.w - 6), c.x + 4, y - 10, font, 8.5, DARK) }
      page.drawLine({ start: { x: M, y: y - 13 }, end: { x: M + contentW, y: y - 13 }, thickness: 0.4, color: LINE }); y -= 14
    }
    if (opts.total != null) { ensure(17); page.drawRectangle({ x: M, y: y - 15, width: contentW, height: 15, color: BOXBG }); text(opts.totalLabel || 'Subtotal', M + 6, y - 11, bold, 8.5, DARK); rightText(money(opts.total), M + contentW - 4, y - 11, bold, 8.5, DARK); y -= 17 }
  }
  const has = a => Array.isArray(a) && a.length > 0

  // ── DATOS ECONOMICOS ──
  if (has(d.datosEconomicos)) {
    sectionTitle('DATOS ECONOMICOS DEL ARRENDATARIO')
    tableRows(
      [{ label: 'Concepto', w: 190, align: 'l' }, { label: 'Comentario', w: 230, align: 'l' }, { label: 'Importe', w: 90, align: 'r' }],
      d.datosEconomicos.map(x => [x.concepto, x.comentario || '', money(x.monto)]),
      { total: d.datosEconomicos.reduce((a, x) => a + n0(x.monto), 0), totalLabel: 'Total datos economicos' }
    )
    y -= 6
  }

  // ── SERVICIOS ──
  if (has(d.servicios)) {
    sectionTitle('SERVICIOS')
    tableRows(
      [{ label: 'Concepto', w: 190, align: 'l' }, { label: 'Comentario', w: 230, align: 'l' }, { label: 'Importe', w: 90, align: 'r' }],
      d.servicios.map(x => [x.concepto, x.comentario || '', money(x.monto)]),
      { total: d.servicios.reduce((a, x) => a + n0(x.monto), 0), totalLabel: 'Total servicios' }
    )
    y -= 6
  }

  // ── REPARACIONES Y PRESUPUESTO ──
  const rep = d.reparaciones || {}
  const repDet = (rep.presupuesto && rep.presupuesto.detalle) || []
  const repTotal = n0(rep.presupuesto && rep.presupuesto.total)
  const repLin = rep.lineas || []
  const repLinSum = repLin.reduce((a, x) => a + n0(x.monto), 0)
  if (has(repDet) || repTotal > 0 || has(repLin)) {
    sectionTitle('REPARACIONES Y PRESUPUESTO APLICADO')
    // Tabla única: el detalle del presupuesto (o, si no hay detalle, una sola línea "Arreglos segun presupuesto"),
    // luego las otras reparaciones si las hubiera, y un ÚNICO "Total reparaciones". El importe no se repite.
    const rows = []
    for (const x of repDet) rows.push([x.descripcion, money(x.importe)])
    if (!has(repDet) && repTotal > 0) rows.push(['Arreglos segun presupuesto', money(repTotal)])
    for (const x of repLin) rows.push([x.concepto, money(x.monto)])
    tableRows([{ label: 'Concepto', w: 430, align: 'l' }, { label: 'Importe', w: 90, align: 'r' }], rows,
      { total: repTotal + repLinSum, totalLabel: 'Total reparaciones' })
    y -= 6
  }

  // ── DESCUENTOS APLICADOS ──
  if (has(d.descuentos)) {
    sectionTitle('DESCUENTOS APLICADOS')
    tableRows(
      [{ label: 'Num', w: 42, align: 'l' }, { label: 'Fecha', w: 62, align: 'l' }, { label: 'Imputar a', w: 92, align: 'l' }, { label: 'Comentario', w: 236, align: 'l' }, { label: 'Importe', w: 80, align: 'r' }],
      d.descuentos.map(x => [String(x.num || ''), x.fecha || '', x.imputarA || '', x.comentario || '', money(x.monto)]),
      { total: d.descuentos.reduce((a, x) => a + n0(x.monto), 0), totalLabel: 'Total descuentos' }
    )
    y -= 6
  }

  // ── RESULTADO ──
  ensure(52)
  const res = d.resultado || {}
  const resColor = n0(res.valor) >= 0 ? GREEN : RED
  // No se muestra el "Estado" (código interno del término): no le interesa al receptor del PDF.
  page.drawRectangle({ x: M, y: y - 44, width: contentW, height: 44, color: BOXBG, borderColor: LINE, borderWidth: 0.6 })
  text('RESULTADO DEL TERMINO', M + 12, y - 20, bold, 11, DARK)
  rightText(money(res.valor), M + contentW - 14, y - 20, bold, 20, resColor)
  rightText(res.label || '', M + contentW - 14, y - 35, font, 9, GREY)
  y -= 52

  // ── Cierre institucional ──
  ensure(48)
  page.drawLine({ start: { x: M, y }, end: { x: M + 150, y }, thickness: 1, color: AZUL }); y -= 15
  text('Fondo Capital Rent SpA', M, y, bold, 10, AZUL); y -= 13
  text('Servicio de Informacion al Cliente', M, y, font, 9, GREY)

  // ── Marca de agua BORRADOR (vista previa) ──
  if (borrador) {
    const wm = 'BORRADOR - NO ENVIAR', ang = 30, rad = ang * Math.PI / 180
    for (const pg of pdf.getPages()) {
      const w = pg.getWidth(), h = pg.getHeight()
      let size = 58; while (size > 12 && bold.widthOfTextAtSize(wm, size) > w * 0.85) size -= 2
      const tw = bold.widthOfTextAtSize(wm, size)
      pg.drawText(wm, { x: w / 2 - (tw / 2) * Math.cos(rad), y: h / 2 - (tw / 2) * Math.sin(rad), size, font: bold, color: rgb(0.85, 0.12, 0.12), opacity: 0.16, rotate: degrees(ang) })
    }
  }

  return await pdf.save()
}
