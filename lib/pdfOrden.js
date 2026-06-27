// =====================================================================
// Generador del PDF de la Orden de Visita (pdf-lib) - v2
// - Texto justificado (salvo ultima linea de cada parrafo)
// - Layout compacto: el documento y la firma caben en una pagina
//   para los casos tipicos (1 a 4 propiedades).
// Uso: const bytes = await generarOrdenPDF(data)  -> Uint8Array
// =====================================================================
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { CORREDOR, CONDICIONES, introTexto } from './ordenCondiciones.js'
import { LOGO_FCR_PNG_BASE64 } from './logoFCR.js'

const A4 = [595.28, 841.89]
const M = 48

function wrapParrafo(parrafo, font, size, maxW) {
  const words = String(parrafo).split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  for (const w of words) {
    const t = line ? line + ' ' + w : w
    if (font.widthOfTextAtSize(t, size) > maxW && line) { lines.push(line); line = w }
    else line = t
  }
  if (line) lines.push(line)
  return lines
}

export async function generarOrdenPDF(data = {}) {
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

  function drawLine(ln, x, baseY, size, f, color, justify) {
    if (!justify || !ln.includes(' ')) {
      page.drawText(ln, { x, y: baseY, size, font: f, color })
      return
    }
    const words = ln.split(' ')
    const wordsW = words.reduce((s, w) => s + f.widthOfTextAtSize(w, size), 0)
    const extra = (maxW - wordsW) / (words.length - 1)
    if (extra > size * 0.9) { page.drawText(ln, { x, y: baseY, size, font: f, color }); return }
    let cx = x
    for (const w of words) {
      page.drawText(w, { x: cx, y: baseY, size, font: f, color })
      cx += f.widthOfTextAtSize(w, size) + extra
    }
  }

  function texto(t, { f = font, size = 9, color = negro, gap = 3.2, justify = true } = {}) {
    for (const par of String(t).split('\n')) {
      const lines = wrapParrafo(par, f, size, maxW)
      lines.forEach((ln, i) => {
        ensure(size + gap)
        const esUltima = i === lines.length - 1
        drawLine(ln, M, y - size, size, f, color, justify && !esUltima)
        y -= size + gap
      })
    }
  }

  const seccion = (t) => { ensure(20); page.drawText(t, { x: M, y: y - 10.5, size: 10.5, font: bold, color: negro }); y -= 16 }
  const hr = () => { ensure(12); page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: linea }); y -= 12 }

  // Encabezado
  if (logoImg) { page.drawImage(logoImg, { x: W - M - logoW, y: y - logoH + 14, width: logoW, height: logoH }) }
  page.drawText('ORDEN DE VISITA', { x: M, y: y - 15, size: 15, font: bold, color: azul })
  page.drawText(`N° ${data.folio ?? '—'}`, { x: M + 175, y: y - 15, size: 12, font: bold, color: gris })
  y -= 23
  page.drawText(CORREDOR.oficina, { x: M, y: y - 8.5, size: 8.5, font, color: gris })
  if (data.fechaEmision) page.drawText(`Emitida: ${data.fechaEmision}`, { x: M + 230, y: y - 8.5, size: 8.5, font, color: gris })
  y -= 16
  hr()

  // Intro
  texto(introTexto(data.cliente || {}), { size: 9, gap: 3.2 })
  y -= 5

  // Propiedades
  seccion('Propiedades a mostrar')
  const props = data.propiedades || []
  if (!props.length) {
    texto('(sin propiedades indicadas)', { size: 9, color: gris, justify: false })
  } else {
    props.forEach((p, i) => {
      const valor = p.valor ? `${p.moneda || ''} ${Number(p.valor).toLocaleString('es-CL')}`.trim() : ''
      const dir = p.direccion || p.comuna || ''
      let valorFmt = valor.replace(/^\s*(PESOS|CLP)\s*/i, '$').replace(/^\s*\$\s*/, '$')
      const sub = [p.operacion, p.tipo, p.codigo ? 'cód ' + p.codigo : ''].filter(Boolean).join(' · ')
      const cajaAlto = 38
      ensure(cajaAlto + 6)
      const cy = y
      // Caja con fondo suave y borde
      page.drawRectangle({ x: M, y: cy - cajaAlto, width: maxW, height: cajaAlto, color: rgb(0.96, 0.97, 0.99), borderColor: rgb(0.82, 0.86, 0.92), borderWidth: 1 })
      // Direccion (grande, negrita) a la izquierda
      page.drawText(dir, { x: M + 10, y: cy - 16, size: 11, font: bold, color: negro })
      // Precio (grande, azul) a la derecha
      if (valor) {
        const pw = bold.widthOfTextAtSize(valorFmt, 12)
        page.drawText(valorFmt, { x: W - M - 10 - pw, y: cy - 16, size: 12, font: bold, color: azul })
      }
      // Subtitulo (gris, pequeno)
      page.drawText(sub, { x: M + 10, y: cy - 29, size: 8.5, font, color: gris })
      y = cy - cajaAlto - 6
    })
  }
  y -= 6

  if (data.fechaVisita) {
    texto(`Visita agendada: ${data.fechaVisita}${data.horaVisita ? ' a las ' + data.horaVisita : ''}${data.comercial ? '   ·   Comercial: ' + data.comercial : ''}`, { size: 9, color: gris, justify: false })
    y -= 3
  }

  // Condiciones
  seccion('Condiciones')
  for (const c of CONDICIONES) {
    ensure(15)
    texto(`${c.titulo}.`, { f: bold, size: 9, gap: 1.5, justify: false })
    texto(c.texto, { size: 9, gap: 3.2 })
    y -= 3
  }

  // Firma (bloque atomico)
  const firmada = !!(data.firma && data.firma.imagenPng)
  let png = null, imgW = 170, imgH = 0
  if (firmada) { png = await pdf.embedPng(data.firma.imagenPng); imgH = png.height * (imgW / png.width) }
  const altoFirma = (firmada ? imgH + 44 : 70) + 18
  ensure(altoFirma)

  y -= 6
  hr()
  if (firmada) {
    page.drawImage(png, { x: M, y: y - imgH, width: imgW, height: imgH })
    y -= imgH + 5
    texto(`${data.firma.nombre || ''}  —  ${data.firma.docLabel || 'R.U.T.'} ${data.firma.rut || ''}`, { size: 9.5, gap: 3, justify: false })
    texto(`Firmado electrónicamente el ${data.firma.fecha || ''}${data.firma.ip ? '  ·  IP ' + data.firma.ip : ''}.`, { size: 8, color: gris, gap: 2, justify: false })
    texto('Firma electrónica simple conforme a la Ley 19.799.', { size: 8, color: gris, justify: false })
  } else {
    texto('Pendiente de firma electrónica del CLIENTE (firma online por enlace o en el dispositivo del comercial).', { size: 9, color: gris, justify: false })
    y -= 26
    page.drawText('______________________________', { x: M, y: y - 9, size: 10, font, color: negro })
    page.drawText('______________________________', { x: W - M - 200, y: y - 9, size: 10, font, color: negro })
    y -= 13
    page.drawText('p.p. Fondo Capital Rent Spa', { x: M, y: y - 8, size: 8, font, color: gris })
    page.drawText('Cliente  ·  R.U.T.', { x: W - M - 200, y: y - 8, size: 8, font, color: gris })
  }

  return await pdf.save()
}
