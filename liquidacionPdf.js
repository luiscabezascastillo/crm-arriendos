// lib/liquidacionPdf.js
// VERSION: v9 · 2026-08-10 · EN ESPERA = pendiente de cobro, visible pero fuera de los totales. La carta referencia TODAS
//   las propiedades: la del moroso (x.enEspera) sigue en la tabla pero con TODOS sus importes en gris (PEND) y TACHADOS
//   (línea de A Cobrar a A transferir), más una subfila ámbar "PENDIENTE DE COBRO - se liquidará en la complementaria".
//   NO suma en totales (bloque.totales ya viene sin ella). Se retira el difuminado/subfila azul y la línea "En espera de
//   cobro" del total (v4-v7). Debajo del total, si bloque.enEsperaCount > 0, un recap sin importe. Hereda v8.
// VERSION: v8 · 2026-08-10 · La celda Arrendatario respeta el texto del bloque también en líneas P (captación): si trae
//   una etiqueta libre (RESERVADO, etc.) se pinta esa; si no, "EN CAPTACION ARRENDATARIO". Hereda v7.
// VERSION: v7 · 2026-08-10 · El "A transferir" de una línea en espera se difumina MÁS (gris más claro) para que se vea
//   con claridad que ese importe no se transfiere en esta oleada. Hereda v6.
// VERSION: v6 · 2026-08-10 · "EN ESPERA" en el total: si un inmueble está retenido (arrendatario no ha pagado), su
//   "A transferir" se pinta ATENUADO y NO se suma. En TOTALES la columna "A transferir" muestra el importe REAL de esta
//   oleada (aTransferirAhora = total − en espera) y, debajo, una línea "En espera de cobro" con el importe aplazado.
//   Usa bloque.totales.enEspera / .aTransferirAhora (los calcula la vista de EMAILS). Sin esos campos, se comporta como v5.
// VERSION: v5 · 2026-08-07 · Los DESCUENTOS asociados a un IDADMON en estado P (depto en captación) también se pintan
//   como sub-línea en la carta, igual que en S/SQ (antes ocultos por el gate !esP). Hereda v4.
// VERSION: v4 · 2026-08-07 · Sub-línea "en espera" (azul) por inmueble cuando su arrendatario no ha pagado: si el
//   inmueble trae `notaEspera`, se pinta el aviso de que la transferencia de ese arriendo se aplaza hasta el cobro.
// VERSION: v3 · 2026-07-08 · cierre institucional sin firma + quitada columna Final del PDF
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
const n0 = v => { const x = Number(v); return isNaN(x) ? 0 : x }
const GREEN = rgb(0.086, 0.639, 0.290)
const AMBER = rgb(0.706, 0.325, 0.035)
const PEND = rgb(0.62, 0.64, 0.68)   // gris atenuado: importes de una línea EN ESPERA (pendiente de cobro, no liquidada)
const GREY = rgb(0.29, 0.33, 0.39)
const DARK = rgb(0.10, 0.10, 0.18)
const HEADBG = rgb(0.20, 0.255, 0.333)
const LINE = rgb(0.88, 0.87, 0.83)
const TOTBG = rgb(0.945, 0.96, 0.98)

export async function generarPdfLiquidacion({ bloque, mesTxt, fecha, despedida, logoDataUrl, borrador, factorEscala }) {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const W = LANDSCAPE ? 842 : 595
  const H = LANDSCAPE ? 595 : 842
  const M = 40                         // margen
  const contentW = W - M * 2
  // Factor de escala para "reducir a 1 página" (comprime filas y fuente de la tabla).
  const esc = Math.max(0.50, Math.min(1, Number(factorEscala) || 1))
  const bottom = M + 40 * esc          // margen inferior para despedida/paginado (menor al reducir)

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

  // ── Cabecera de la carta ── (todo escalado por esc para poder caber en 1 página)
  if (logoImg) {
    const lw = 120 * esc, lh = (logoImg.height / logoImg.width) * lw
    page.drawImage(logoImg, { x: M, y: y - lh, width: lw, height: lh })
    y -= lh + 6 * esc
  } else {
    text('FONDO CAPITAL RENT SpA', M, y - 14 * esc, bold, 15 * esc, DARK); y -= 22 * esc
  }
  // Título centrado
  const tW = bold.widthOfTextAtSize(TITULO, 13 * esc)
  text(TITULO, M + (contentW - tW) / 2, y - 14 * esc, bold, 13 * esc, DARK); y -= 30 * esc

  // Meta (Fecha / Para / De / Asunto)
  const meta = [
    ['Fecha:', fecha || ''],
    ['Para:', `${bloque.propietario || ''}  (${bloque.idprop || ''})`],
    ['De:', DE],
    ['Asunto:', `Liquidacion de arriendo · ${mesTxt}`],
  ]
  for (const [k, v] of meta) { text(k, M, y - 11 * esc, bold, 9.5 * esc); text(v, M + 55 * esc, y - 11 * esc, font, 9.5 * esc); y -= 15 * esc }
  y -= 6 * esc
  text(`Estimado(a) ${bloque.propietario || ''}:`, M, y - 11 * esc, font, 10 * esc); y -= 15 * esc
  text(`Le adjuntamos el detalle de su liquidacion correspondiente a ${mesTxt}.`, M, y - 11 * esc, font, 10 * esc); y -= 22 * esc

  // ── Definición de columnas ──
  const hayDesc = Math.abs(Number(bloque.totales?.descuentos || 0)) > 0
  let cols = [
    { key: 'idadmon', label: 'IdAdmon', w: 55, align: 'l' },
    { key: 'propiedad', label: 'Propiedad', w: 150, align: 'l' },
    { key: 'comienzo', label: 'Comienzo', w: 62, align: 'l' },
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
    const hh = 16 * esc
    page.drawRectangle({ x: M, y: y - hh, width: contentW, height: hh, color: HEADBG })
    for (const c of cols) {
      const s = c.label
      if (c.align === 'r') rightText(s, c.x + c.w - 5, y - 12 * esc, bold, 8.5 * esc, rgb(1, 1, 1))
      else text(s, c.x + 4, y - 12 * esc, bold, 8.5 * esc, rgb(1, 1, 1))
    }
    y -= hh
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
    if (key === 'arrendatario') return x.arrendatario || (x.esP ? 'EN CAPTACION ARRENDATARIO' : '')
    if (key === 'rut') return x.esP ? '' : (x.rut || '')
    if (key === 'aCobrar') return x.esP ? '' : money(x.aCobrar)
    if (key === 'admon') return x.esP ? '' : money(x.admon)
    if (key === 'iva') return x.esP ? '' : money(x.iva)
    if (key === 'descuentos') return x.descuentos ? money(x.descuentos) : ''
    if (key === 'aTransferir') return (x.esP && !x.descuentos) ? '' : money(x.aTransferir)
    return ''
  }

  const FS = 8.5 * esc, ROWH = 15 * esc, OFF = 11 * esc
  for (const x of (bloque.inmuebles || [])) {
    pageBreak(ROWH + 1)
    // EN ESPERA (moroso): la propiedad SIGUE en la carta (se referencian todas) pero sus importes van
    // atenuados y tachados; no suma en los totales. Se liquidará en la complementaria al cobrar.
    const esp = !x.esP && x.enEspera
    for (const c of cols) {
      const raw = val(x, c.key)
      const isMoney = c.align === 'r'
      let color = DARK
      if (esp) color = PEND
      else if (c.key === 'descuentos' && x.descuentos) color = GREEN
      if (isMoney) rightText(raw, c.x + c.w - 5, y - OFF, font, FS, color)
      else text(fit(raw, font, FS, c.w - 6), c.x + 4, y - OFF, font, FS, esp ? PEND : color)
    }
    // Tacha los importes de la línea en espera (desde "A Cobrar" hasta "A transferir").
    if (esp) {
      const c0 = cols.find(c => c.key === 'aCobrar'), c1 = cols.find(c => c.key === 'aTransferir')
      if (c0 && c1) page.drawLine({ start: { x: c0.x, y: y - OFF + 2.5 }, end: { x: c1.x + c1.w - 3, y: y - OFF + 2.5 }, thickness: 0.6, color: PEND })
    }
    page.drawLine({ start: { x: M, y: y - ROWH }, end: { x: M + contentW, y: y - ROWH }, thickness: 0.5, color: LINE })
    y -= ROWH

    // Sub-líneas: descuentos (verde) · ajuste (ámbar) · comentario (gris) · pendiente de cobro (ámbar)
    const subs = []
    // Descuentos — también en líneas P (deptos en captación con descuento asignado)
    for (const d of (x.des || [])) subs.push({ color: GREEN, monto: money(d.monto), txt: d.texto || 'Descuento' })
    if (!x.esP) {
      if (x.ajuste) subs.push({ color: AMBER, monto: money(x.ajuste), txt: `Se ha realizado un ajuste de ${money(x.ajuste)} en la renta` })
    }
    // La nota (comentarios_liquidacion) se muestra también en líneas P (deptos vacíos)
    if (x.nota) subs.push({ color: GREY, monto: '', txt: `Nota: ${x.nota}` })
    // Pendiente de cobro: aviso claro de que esa propiedad no se liquida este mes.
    if (esp) subs.push({ color: AMBER, monto: '', txt: 'PENDIENTE DE COBRO - no se liquida este mes; se liquidara en la complementaria cuando el arrendatario pague.' })
    const SUBFS = 8 * esc, SUBH = 13 * esc, SUBOFF = 10 * esc
    for (const s of subs) {
      pageBreak(SUBH)
      text('\u00BB', M + 12, y - SUBOFF, font, SUBFS, GREY)
      if (s.monto) rightText(s.monto, M + 120, y - SUBOFF, bold, SUBFS, s.color)
      text(fit(s.txt, font, SUBFS, contentW - 140), M + 130, y - SUBOFF, font, SUBFS, s.color)
      y -= SUBH
    }
  }

  // ── Fila TOTALES ──
  pageBreak(20 * esc)
  const th = 18 * esc
  page.drawRectangle({ x: M, y: y - th, width: contentW, height: th, color: TOTBG })
  const t = bloque.totales || {}
  text('TOTALES', cols[0].x + 4, y - 13 * esc, bold, 9 * esc, DARK)
  const put = (key, v) => { const c = cols.find(c => c.key === key); if (c) rightText(money(v), c.x + c.w - 5, y - 13 * esc, bold, 9 * esc, DARK) }
  put('aCobrar', t.aCobrar); put('admon', t.admon); put('iva', t.iva)
  if (hayDesc) put('descuentos', t.descuentos)
  put('aTransferir', t.aTransferir)
  y -= 30 * esc
  // Nota SIN importe si hay arriendos en espera de cobro: quedan fuera de esta liquidación y se
  // liquidarán en una complementaria cuando el arrendatario pague (no se adelanta nada).
  const nEspera = Math.round(n0(bloque.enEsperaCount))
  if (nEspera > 0) {
    const txtEsp = `Queda(n) ${nEspera} arriendo(s) pendiente(s) de cobro: no se incluye(n) en esta liquidacion. Se liquidara(n) por separado cuando el arrendatario pague.`
    text('»', M + 12, y - 6 * esc, font, 8.5 * esc, AMBER)
    text(fit(txtEsp, font, 8.5 * esc, contentW - 40), M + 26, y - 6 * esc, font, 8.5 * esc, AMBER)
    y -= 20 * esc
  }

  // ── Despedida ──
  pageBreak(40 * esc)
  const dfs = 10 * esc
  const desp = (despedida || 'Desde Fondo Capital Rent SpA le deseamos un feliz mes. Atentamente, Servicio de Informacion al Cliente.').trim()
  const words = desp.split(/\s+/); let line = ''
  for (const w of words) {
    const test = line ? line + ' ' + w : w
    if (font.widthOfTextAtSize(test, dfs) > contentW) { text(line, M, y - 11 * esc, font, dfs); y -= 14 * esc; line = w; pageBreak(20 * esc) }
    else line = test
  }
  if (line) { text(line, M, y - 11 * esc, font, dfs); y -= 14 * esc }

  // ── Cierre institucional (sin firma manuscrita: es un documento informativo
  //    automático). Bloque limpio: línea divisoria fina + firma institucional. ──
  const AZUL = rgb(0.122, 0.306, 0.475)   // azul corporativo (membrete)
  pageBreak(56 * esc)
  y -= 26 * esc
  // línea divisoria fina, corta, en azul corporativo (evoca pie de firma)
  page.drawLine({ start: { x: M, y: y }, end: { x: M + 150 * esc, y: y }, thickness: 1, color: AZUL })
  y -= 16 * esc
  text('Fondo Capital Rent SpA', M, y, bold, 11 * esc, AZUL); y -= 14 * esc
  text(DE, M, y, font, 9.5 * esc, GREY); y -= 22 * esc

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
