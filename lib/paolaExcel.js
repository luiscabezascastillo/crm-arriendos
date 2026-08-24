// VERSION: v11 · 2026-08-24 · Hoja "Comprobantes" incrusta los JUSTIFICANTES (imágenes) del mes con ExcelJS.addImage,
//   en rejilla 2×N con su título (idadmon · nombre). generarExcelPaola acepta `justificantes` [{buffer, ext, ...}].
//   Hereda v10.
// VERSION: v10 · 2026-08-23 · Hoja "Garantías" con calidad de ledger: TODOS los arriendos (fuente datos_arriendos),
//   ordenados por inmueble, con CABECERAS AGRUPADAS por color (Identidad · Arriendo · Garantía · Cuotas · Contrato ·
//   Contacto). Columnas: moneda, arriendo inicial/actual (con reajustes), garantía pedida/entregada/pendiente, quién,
//   deuda, cuotas 1-4 (fecha/monto/pagado, resalta la del mes), fechas y contacto. UF con 2 decimales. TOTALES +
//   resumen del mes. Hereda v9.
// VERSION: v9 · 2026-08-23 · Hoja "Garantías" rehecha: roster de TODOS los contratos S/SQ (fuente datos_arriendos),
//   ordenado por inmueble, con garantía pedida, entregada (Σ cobradas), pendiente, quién, deuda, cuotas 1-4
//   (fecha/monto/cobrado) y contacto, + resumen del mes arriba y TOTALES. generarExcelPaola acepta `garantiasRoster`.
//   Hereda v8.
// VERSION: v8 · 2026-08-23 · Nueva hoja "Garantías": resumen por contrato (garantía pedida, quién la tiene, pagado,
//   pendiente) + calendario de cuotas (paola_garantias), con el mes en curso resaltado. generarExcelPaola acepta
//   `garantias`. Hereda v7.
// VERSION: v7 · 2026-08-19 · nombreArchivo admite el nº de envío (2026-08-1-Control…, -2-, -3-) para distinguir las
//   versiones que se mandan a Paola a lo largo del mes. Hereda v6.
// VERSION: v6 · 2026-08-19 · Hoja "Movimientos cuenta" reproduce la cartola COMPLETA (cargos y abonos, cols A-D) y añade
//   E=IDADMON / F=INMUEBLE. Colores de fuente por convención de la cartola: cargo naranja, abono verde, identificados en
//   azul. Usa cartolaRows si viene; si no, cae al resumen de abonos. Hereda v5.
// VERSION: v5 · 2026-08-19 · Hoja "Movimientos cuenta" añade columnas IdAdmon (reconocido por el discriminador del
//   CRM) e Inmueble (propiedad de ese IDADMON). Hereda v4.
// VERSION: v4 · 2026-08-19 · Rediseño PROFESIONAL para Paola (fase 1): banda de título institucional, cabecera azul,
//   filas cebra, vacantes en beige, importes con formato $ y FALTA en rojo/verde. Cambios pedidos por la propietaria:
//   (1) se OCULTA la columna Estado (P/S/SQ, uso interno); (2) en los SQ, Comentario 1 lleva "Avisó término para el
//   <fecha>"; (3) los P muestran "EN CAPTACION". Nuevas hojas: "Movimientos cuenta" (cartola del mes) y "Comprobantes".
//   Leyenda actualizada. Hereda v3.
import ExcelJS from 'exceljs'

const MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
]
const MES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

// ── paleta institucional ──
const FUENTE = 'Arial'
const AZUL = 'FF1D4E8F'   // banda de título / totales
const AZULH = 'FF14406B'  // cabecera de tabla
const CLARO = 'FFDDEBF7'  // meta / subcabecera
const BEIGE = 'FFF5E9DA'  // vacantes
const ZEBRA = 'FFF4F7FB'
const BLANCO = 'FFFFFFFF'
const TINTA = 'FF1F2A44'
const GRIS = 'FF5B6472'

const FMT_NUM = '#,##0;-#,##0;"—"'
const FMT_FALTA = '[Red]#,##0;[Green]-#,##0;"—"'
const FMT_FECHA = 'dd/mm/yyyy'

const bd = { style: 'thin', color: { argb: 'FFD3DCE6' } }
const BORDER = { top: bd, bottom: bd, left: bd, right: bd }

// Columnas VISIBLES (sin la columna interna de Estado). idx 1-based → letra A, B, …
const COLS = [
  { t: 'IdAdmon',         campo: 'idadmon',      w: 10, al: 'center' },
  { t: 'Propiedad',       campo: 'propiedad',    w: 30, al: 'left', wrap: true },
  { t: 'Comienzo',        campo: 'comienzo',     w: 12, al: 'center', fmt: FMT_FECHA },
  { t: 'Término',         campo: 'termino',      w: 12, al: 'center', fmt: FMT_FECHA },
  { t: 'Arrendatario',    campo: 'arrendatario', w: 24, al: 'left', wrap: true },
  { t: 'RUT',             campo: 'rut',          w: 14, al: 'center' },
  { t: 'A Cobrar',        campo: 'aCobrar',      w: 12, al: 'right', fmt: FMT_NUM, money: true },
  { t: 'Recibido',        campo: 'recibido',     w: 12, al: 'right', fmt: FMT_NUM, money: true },
  { t: 'FALTA DEL MES',   campo: null,           w: 13, al: 'right', fmt: FMT_FALTA, money: true, falta: true },
  { t: 'Fecha pago',      campo: 'fechaPago',    w: 12, al: 'center', fmt: FMT_FECHA },
  { t: 'Multas/Deudas',   campo: 'multasDeudas', w: 13, al: 'right', fmt: FMT_NUM, money: true },
  { t: 'Deuda G.Comunes', campo: 'deudaGgcc',    w: 13, al: 'right', fmt: FMT_NUM, money: true },
  { t: 'Deuda Luz',       campo: 'deudaLuz',     w: 11, al: 'right', fmt: FMT_NUM, money: true },
  { t: 'Deuda Agua',      campo: 'deudaAgua',    w: 11, al: 'right', fmt: FMT_NUM, money: true },
  { t: 'Especial',        campo: 'especial',     w: 11, al: 'left' },
  { t: 'Cantidad',        campo: 'cantidad',     w: 10, al: 'right', fmt: FMT_NUM, money: true },
  { t: 'Comentarios 1',   campo: 'comentarios1', w: 30, al: 'left', wrap: true },
  { t: 'Comentarios 2',   campo: 'comentarios2', w: 30, al: 'left', wrap: true },
  { t: 'Estado pago',     campo: 'estadoPago',   w: 15, al: 'center', chip: true },
  { t: 'Nota pago',       campo: 'notaPago',     w: 30, al: 'left', wrap: true },
]
const NCOL = COLS.length
const letra = (i) => {           // 1 → A, 27 → AA
  let s = '', n = i
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26) }
  return s
}
const COL_ACOBRAR = letra(7)     // G
const COL_RECIBIDO = letra(8)    // H
const COL_FALTA_IDX = 9

const FILA_TITULO = 1, FILA_META = 2, FILA_CAB = 3, FILA_DATOS = 4

function etiquetaMes(mes) {
  const s = String(mes || '').trim()
  let anio, m
  if (/^\d{4}$/.test(s)) { anio = 2000 + Number(s.slice(0, 2)); m = Number(s.slice(2, 4)) }
  else if (/^\d{4}-\d{2}$/.test(s)) { anio = Number(s.slice(0, 4)); m = Number(s.slice(5, 7)) }
  else throw new Error(`Mes no reconocido: "${mes}". Se espera AAMM (2607) o YYYY-MM (2026-07).`)
  if (!(m >= 1 && m <= 12)) throw new Error(`Mes fuera de rango: "${mes}"`)
  return { texto: `${MESES[m - 1]} ${anio}`, anio, numero: m }
}

function aNumero(v) {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const limpio = String(v).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
  if (limpio === '' || limpio === '-') return null
  const n = Number(limpio)
  return Number.isFinite(n) ? n : null
}

function aFecha(v) {
  if (!v) return null
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v
  const s = String(v).trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}
function fechaCorta(v) {
  const d = aFecha(v); if (!d) return String(v || '')
  const p = n => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`
}

function esVacante(fila) {
  if (fila.vacante === true) return true
  if (String(fila.estado || '').trim().toUpperCase() === 'P') return true
  if (fila.aCobrar != null) return false
  return !fila.arrendatario || /EN\s*CAPTACI/i.test(String(fila.arrendatario))
}

// Estado pago (valores del CRM) → etiqueta legible + colores del chip
const CHIP = {
  PAGADO: { txt: 'PAGADO', fill: 'FFDCFCE7', tinta: 'FF166534' },
  ATRASADO: { txt: 'PAGO ATRASADO', fill: 'FFFEF3C7', tinta: 'FF92400E' },
  'PAGO ATRASADO': { txt: 'PAGO ATRASADO', fill: 'FFFEF3C7', tinta: 'FF92400E' },
  NO_PAGADO: { txt: 'NO PAGÓ', fill: 'FFFEE2E2', tinta: 'FF991B1B' },
  'NO PAGÓ': { txt: 'NO PAGÓ', fill: 'FFFEE2E2', tinta: 'FF991B1B' },
}

function pintarBanda(ws, fila, desde, hasta, texto, { fill = AZUL, color = BLANCO, size = 15, bold = true, align = 'left' } = {}) {
  ws.mergeCells(`${letra(desde)}${fila}:${letra(hasta)}${fila}`)
  const c = ws.getCell(`${letra(desde)}${fila}`)
  c.value = texto
  c.font = { name: FUENTE, size, bold, color: { argb: color } }
  c.alignment = { horizontal: align, vertical: 'middle', indent: 1 }
  for (let i = desde; i <= hasta; i++) ws.getCell(`${letra(i)}${fila}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }
}

/**
 * @param {object} opts
 * @param {string} opts.mes
 * @param {Array}  opts.filas
 * @param {Array}  [opts.movimientos]  movimientos de la cartola del mes (fecha, detalle, monto, idadmon…)
 */
async function generarExcelPaola({
  mes,
  filas,
  movimientos = [],
  cartolaRows = [],
  garantiasRoster = [],
  justificantes = [],
  propietario = 'P001 · Paola Albornoz Sáez',
  totales = true,
  leyenda = true,
}) {
  if (!Array.isArray(filas)) throw new Error('generarExcelPaola: "filas" debe ser un array')
  const { texto: mesTexto, anio, numero } = etiquetaMes(mes)
  const mesYM = `${anio}-${String(numero).padStart(2, '0')}`

  const wb = new ExcelJS.Workbook()
  wb.creator = 'CRM FCR'; wb.created = new Date()

  const ws = wb.addWorksheet(`Liquidación ${mesTexto}`, {
    views: [{ state: 'frozen', ySplit: FILA_CAB }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  })
  for (let i = 1; i <= NCOL; i++) ws.getColumn(i).width = COLS[i - 1].w

  // Título + meta
  pintarBanda(ws, FILA_TITULO, 1, NCOL, 'FONDO CAPITAL RENT    ·    Liquidación de arriendos')
  ws.getRow(FILA_TITULO).height = 30
  const metaMitad = Math.min(10, NCOL)
  pintarBanda(ws, FILA_META, 1, metaMitad, `Propietario:  ${propietario}`, { fill: CLARO, color: TINTA, size: 11, align: 'left' })
  pintarBanda(ws, FILA_META, metaMitad + 1, NCOL, `Periodo:  ${mesTexto}`, { fill: CLARO, color: TINTA, size: 11, align: 'right' })
  ws.getRow(FILA_META).height = 20

  // Cabecera
  for (let i = 1; i <= NCOL; i++) {
    const cell = ws.getCell(`${letra(i)}${FILA_CAB}`)
    cell.value = COLS[i - 1].t
    cell.font = { name: FUENTE, size: 9, bold: true, color: { argb: BLANCO } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZULH } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = BORDER
  }
  ws.getRow(FILA_CAB).height = 30

  // Datos
  let r = FILA_DATOS
  filas.forEach((fila, idx) => {
    const vacante = esVacante(fila)
    const estado = String(fila.estado || '').trim().toUpperCase()
    const zebra = idx % 2 === 1
    const bg = vacante ? BEIGE : (zebra ? ZEBRA : BLANCO)

    // (2) SQ → aviso de término en Comentario 1 (delante de lo que haya escrito)
    let com1 = fila.comentarios1
    if (estado === 'SQ') {
      const aviso = `Avisó término para el ${fechaCorta(fila.termino)}`
      com1 = com1 && String(com1).trim() ? `${aviso} · ${com1}` : aviso
    }
    // (3) P → "EN CAPTACION"
    const arrend = vacante ? 'EN CAPTACION' : fila.arrendatario

    for (let i = 1; i <= NCOL; i++) {
      const c = COLS[i - 1]
      const cell = ws.getCell(`${letra(i)}${r}`)
      let val = null

      if (c.falta) {
        val = vacante ? null : { formula: `${COL_ACOBRAR}${r}-${COL_RECIBIDO}${r}` }
      } else if (c.campo === 'arrendatario') {
        val = arrend || null
      } else if (c.campo === 'comentarios1') {
        val = com1 || null
      } else if (vacante && !['idadmon', 'propiedad'].includes(c.campo)) {
        val = null
      } else if (c.fmt === FMT_FECHA) {
        const f = aFecha(fila[c.campo])
        if (f && f.getFullYear() >= 9999) val = 'indefinido'
        else val = f || (fila[c.campo] ? String(fila[c.campo]) : null)
      } else if (c.money) {
        val = aNumero(fila[c.campo])
      } else {
        const v = fila[c.campo]
        val = (v === undefined || v === '') ? null : v
      }
      cell.value = val
      cell.font = { name: FUENTE, size: 9, color: { argb: TINTA } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
      cell.border = BORDER
      cell.alignment = { horizontal: c.al, vertical: 'middle', wrapText: !!c.wrap }
      if (c.money && !vacante && typeof val !== 'string') cell.numFmt = c.fmt
      if (c.fmt === FMT_FECHA && val instanceof Date) cell.numFmt = FMT_FECHA

      // chip de estado pago
      if (c.chip && val) {
        const chip = CHIP[String(val).trim().toUpperCase()]
        if (chip) {
          cell.value = chip.txt
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: chip.fill } }
          cell.font = { name: FUENTE, size: 9, bold: true, color: { argb: chip.tinta } }
          cell.alignment = { horizontal: 'center', vertical: 'middle' }
        }
      }
    }
    ws.getRow(r).height = vacante ? 18 : 24
    r++
  })

  // TOTALES
  if (totales && filas.length > 0) {
    const ult = r - 1, ft = r
    ws.mergeCells(`${letra(1)}${ft}:${letra(6)}${ft}`)
    const et = ws.getCell(`${letra(1)}${ft}`)
    et.value = 'TOTALES'
    for (let i = 1; i <= NCOL; i++) {
      const c = COLS[i - 1]
      const cell = ws.getCell(`${letra(i)}${ft}`)
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } }
      cell.font = { name: FUENTE, size: 10, bold: true, color: { argb: BLANCO } }
      cell.border = BORDER
      cell.alignment = { horizontal: c.al === 'right' ? 'right' : 'left', vertical: 'middle', indent: 1 }
      if (c.money) {
        const L = letra(i)
        cell.value = { formula: `SUM(${L}${FILA_DATOS}:${L}${ult})` }
        cell.numFmt = c.fmt
      }
    }
    ws.getRow(ft).height = 24
  }

  const propDe = {}
  for (const f of filas) if (f.idadmon) propDe[f.idadmon] = f.propiedad
  construirMovimientos(wb, mesTexto, movimientos, propDe, cartolaRows)
  construirGarantias(wb, mesTexto, Array.isArray(garantiasRoster) ? garantiasRoster : [], mesYM)
  construirComprobantes(wb, mesTexto, justificantes)
  if (leyenda) construirLeyenda(wb, mesTexto)

  const buffer = await wb.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

// Colores de fuente de la cartola (convención): cargo naranja, abono verde; IDADMON/INMUEBLE resaltados en azul.
const COL_CARGO = 'FFE59D27'
const COL_ABONO = 'FF63BA68'
const COL_IDENT = AZUL   // 'FF1D4E8F'

function construirMovimientos(wb, mesTexto, movimientos, propDe = {}, cartolaRows = []) {
  const usarCartola = Array.isArray(cartolaRows) && cartolaRows.length > 0
  const ws = wb.addWorksheet('Movimientos cuenta', { views: [{ state: 'frozen', ySplit: 3 }] })

  if (usarCartola) {
    // Cartola COMPLETA (cargos + abonos) A-D, más E=IDADMON y F=INMUEBLE (nuestros).
    const W = [12, 46, 14, 14, 11, 26]; W.forEach((w, i) => ws.getColumn(i + 1).width = w)
    pintarBanda(ws, 1, 1, 6, 'Movimientos de la cuenta · Paola Albornoz', { size: 13 })
    ws.getRow(1).height = 26
    pintarBanda(ws, 2, 1, 6, `Cartola de ${mesTexto} que envía Paola. IDADMON e INMUEBLE los reconoce el CRM (RUT del pagador).`, { fill: CLARO, color: GRIS, size: 9, bold: false })
    const cab = ['Fecha', 'Detalle', 'Monto cargo ($)', 'Monto abono ($)', 'IDADMON', 'INMUEBLE']
    cab.forEach((t, i) => {
      const cell = ws.getCell(`${letra(i + 1)}3`)
      cell.value = t
      cell.font = { name: FUENTE, size: 9, bold: true, color: { argb: BLANCO } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZULH } }
      cell.border = BORDER; cell.alignment = { horizontal: 'center', wrapText: true }
    })
    ws.getRow(3).height = 26
    let r = 4
    cartolaRows.forEach((m, idx) => {
      const idadmon = m.idadmon || ''
      const inmueble = (idadmon && propDe[idadmon]) ? propDe[idadmon] : (m.nota || '')
      const vals = [
        aFecha(m.fecha) || (m.fecha ? String(m.fecha) : null),
        m.detalle || '', aNumero(m.cargo), aNumero(m.abono), idadmon, inmueble,
      ]
      vals.forEach((v, i) => {
        const cell = ws.getCell(`${letra(i + 1)}${r}`)
        cell.value = v
        // color de fuente por columna (convención de la cartola)
        let color = TINTA, bold = false
        if (i === 2) color = COL_CARGO           // Monto cargo → naranja
        else if (i === 3) color = COL_ABONO      // Monto abono → verde
        else if ((i === 4 || i === 5) && idadmon) { color = COL_IDENT; bold = true }  // identificados → azul
        cell.font = { name: FUENTE, size: 9, color: { argb: color }, bold }
        cell.border = BORDER
        cell.alignment = { horizontal: (i === 2 || i === 3) ? 'right' : (i === 4 ? 'center' : 'left'), vertical: 'middle', wrapText: i === 5 }
        if (i === 0 && v instanceof Date) cell.numFmt = FMT_FECHA
        if ((i === 2 || i === 3) && typeof v === 'number') cell.numFmt = FMT_NUM
        if (idx % 2) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } }
      })
      r++
    })
    return
  }

  // Fallback (sin cartola cargada, p.ej. "Ver lo guardado"): resumen de abonos identificados.
  const W = [12, 40, 13, 10, 26]; W.forEach((w, i) => ws.getColumn(i + 1).width = w)
  pintarBanda(ws, 1, 1, 5, 'Movimientos de la cuenta · Paola Albornoz', { size: 13 })
  ws.getRow(1).height = 26
  pintarBanda(ws, 2, 1, 5, `Cartola de ${mesTexto} (procesa la cartola para ver todos los movimientos).`, { fill: CLARO, color: GRIS, size: 9, bold: false })
  const cab = ['Fecha', 'Detalle', 'Monto ($)', 'IDADMON', 'INMUEBLE']
  cab.forEach((t, i) => {
    const cell = ws.getCell(`${letra(i + 1)}3`)
    cell.value = t
    cell.font = { name: FUENTE, size: 9, bold: true, color: { argb: BLANCO } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZULH } }
    cell.border = BORDER; cell.alignment = { horizontal: 'center' }
  })
  let r = 4
  const lista = Array.isArray(movimientos) ? movimientos : []
  if (!lista.length) {
    ws.mergeCells(`A4:E4`)
    ws.getCell('A4').value = 'Sin movimientos cargados (se completan al procesar la cartola del mes).'
    ws.getCell('A4').font = { name: FUENTE, size: 10, italic: true, color: { argb: GRIS } }
    return
  }
  lista.forEach((m, idx) => {
    const idadmon = m.idadmon || ''
    const inmueble = (idadmon && propDe[idadmon]) ? propDe[idadmon] : (m.glosa || m.nota_cartola || '')
    const vals = [aFecha(m.fecha) || (m.fecha ? String(m.fecha) : null), m.detalle || '', aNumero(m.monto), idadmon, inmueble]
    vals.forEach((v, i) => {
      const cell = ws.getCell(`${letra(i + 1)}${r}`)
      cell.value = v
      cell.font = { name: FUENTE, size: 9, color: { argb: i === 2 ? COL_ABONO : ((i === 3 || i === 4) && idadmon ? COL_IDENT : TINTA) }, bold: i === 3 && !!idadmon }
      cell.border = BORDER
      cell.alignment = { horizontal: i === 2 ? 'right' : (i === 3 ? 'center' : 'left'), vertical: 'middle', wrapText: i === 4 }
      if (i === 0 && v instanceof Date) cell.numFmt = FMT_FECHA
      if (i === 2 && typeof v === 'number') cell.numFmt = FMT_NUM
      if (idx % 2) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } }
    })
    r++
  })
}

// Hoja "Garantías": TODOS los arriendos de Paola (fuente: datos_arriendos), ordenados por inmueble, con
// cabeceras AGRUPADAS por color (Identidad · Arriendo · Garantía · Cuotas · Contrato · Contacto) y un
// resumen del mes arriba. Pensada para superar en claridad al control manual.
const GAR_GRUPOS = [
  { label: 'IDENTIDAD',   from: 1,  to: 4,  fill: 'FF14406B' },
  { label: 'ARRIENDO',    from: 5,  to: 7,  fill: 'FF5B6472' },
  { label: 'GARANTÍA',    from: 8,  to: 12, fill: 'FF1F7A8C' },
  { label: 'CUOTAS DE GARANTÍA', from: 13, to: 24, fill: 'FF1D4E8F' },
  { label: 'CONTRATO',    from: 25, to: 26, fill: 'FF5B6472' },
  { label: 'CONTACTO',    from: 27, to: 29, fill: 'FF5B6472' },
]
const GAR_COLS = [
  { t: 'IdAdmon',        w: 10, al: 'center' },
  { t: 'Est',            w: 6,  al: 'center' },
  { t: 'Inmueble',       w: 34, al: 'left', wrap: true },
  { t: 'IDINMUE',        w: 12, al: 'center' },
  { t: 'Moneda',         w: 8,  al: 'center' },
  { t: 'Arriendo inicial', w: 12, al: 'right', money: true },
  { t: 'Arriendo actual',  w: 12, al: 'right', money: true },
  { t: 'Pedida',         w: 12, al: 'right', money: true },
  { t: 'Entregada',      w: 12, al: 'right', money: true },
  { t: 'Pendiente',      w: 12, al: 'right', money: true },
  { t: 'Quién la tiene', w: 14, al: 'left' },
  { t: 'Deuda gar.',     w: 11, al: 'right', money: true },
  { t: 'C1 fecha', w: 11, al: 'center', date: true }, { t: 'C1 monto', w: 11, al: 'right', money: true }, { t: 'C1 pagado', w: 11, al: 'right', money: true },
  { t: 'C2 fecha', w: 11, al: 'center', date: true }, { t: 'C2 monto', w: 11, al: 'right', money: true }, { t: 'C2 pagado', w: 11, al: 'right', money: true },
  { t: 'C3 fecha', w: 11, al: 'center', date: true }, { t: 'C3 monto', w: 11, al: 'right', money: true }, { t: 'C3 pagado', w: 11, al: 'right', money: true },
  { t: 'C4 fecha', w: 11, al: 'center', date: true }, { t: 'C4 monto', w: 11, al: 'right', money: true }, { t: 'C4 pagado', w: 11, al: 'right', money: true },
  { t: 'Ingreso',        w: 11, al: 'center', date: true },
  { t: 'Término',        w: 11, al: 'center', date: true },
  { t: 'Arrendatario',   w: 28, al: 'left', wrap: true },
  { t: 'Mail',           w: 28, al: 'left' },
  { t: 'Celular',        w: 16, al: 'left' },
]
const GAR_CUOTA_FECHA_IDX = [13, 16, 19, 22]  // columnas (1-based) de las fechas de cuota → resaltar mes

function construirGarantias(wb, mesTexto, roster = [], mesYM = '') {
  const ws = wb.addWorksheet('Garantías', {
    views: [{ state: 'frozen', xSplit: 4, ySplit: 5 }],
    pageSetup: { orientation: 'landscape', fitToPage: false },
  })
  const NC = GAR_COLS.length
  GAR_COLS.forEach((c, i) => ws.getColumn(i + 1).width = c.w)

  const enMes = v => { const d = aFecha(v); return !!d && `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === mesYM }
  const sumaReaj = f => [1, 2, 3, 4, 5, 6].reduce((s, i) => s + (aNumero(f['cantidad_reajuste' + i]) || 0), 0)
  const cuotasDe = f => [1, 2, 3, 4].map(i => ({ fecha: f['fecha' + i], monto: aNumero(f['cuota' + i]), pag: aNumero(f['cobrada' + i]) }))

  const filas = [...roster].sort((a, b) =>
    String(a.inmueble || '').localeCompare(String(b.inmueble || ''), 'es', { numeric: true, sensitivity: 'base' }) ||
    String(a.fecha_inicio || '').localeCompare(String(b.fecha_inicio || '')))

  // Totales + movimientos del mes
  let totPedida = 0, totEntregada = 0, totPendiente = 0, movN = 0, movVenc = 0, movPag = 0
  for (const f of filas) {
    const pedida = aNumero(f.garantia_pedida) || 0
    const cs = cuotasDe(f)
    const entregada = cs.reduce((s, c) => s + (c.pag || 0), 0)
    totPedida += pedida; totEntregada += entregada; totPendiente += Math.max(pedida - entregada, 0)
    for (const c of cs) if (enMes(c.fecha) && (c.monto || c.pag)) { movN++; movVenc += (c.monto || 0); movPag += (c.pag || 0) }
  }
  const f0 = n => '$' + Math.round(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')

  // Fila 1: banda de título
  pintarBanda(ws, 1, 1, NC, `Garantías · todos los arriendos · ${mesTexto}`, { size: 14 })
  ws.getRow(1).height = 28
  // Fila 2: resumen del mes
  ws.mergeCells(2, 1, 2, NC)
  const res = ws.getCell(2, 1)
  res.value = `Cuotas con vencimiento en ${mesTexto}: ${movN} (vencido ${f0(movVenc)} · cobrado ${f0(movPag)})     ` +
    `Garantías S/SQ y activas — Pedido ${f0(totPedida)} · Entregado ${f0(totEntregada)} · Pendiente ${f0(totPendiente)}     Contratos: ${filas.length}`
  res.font = { name: FUENTE, size: 10, bold: true, color: { argb: AZUL } }
  res.alignment = { vertical: 'middle', indent: 1 }
  res.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CLARO } }
  ws.getRow(2).height = 20
  ws.getRow(3).height = 6

  // Fila 4: banda de GRUPOS (merge por grupo)
  const GB = 4
  for (const g of GAR_GRUPOS) {
    ws.mergeCells(GB, g.from, GB, g.to)
    const cell = ws.getCell(GB, g.from)
    cell.value = g.label
    cell.font = { name: FUENTE, size: 10, bold: true, color: { argb: BLANCO } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    for (let i = g.from; i <= g.to; i++) {
      const cc = ws.getCell(GB, i)
      cc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: g.fill } }
      cc.border = { left: { style: 'thin', color: { argb: 'FFFFFFFF' } }, right: { style: 'thin', color: { argb: 'FFFFFFFF' } } }
    }
  }
  ws.getRow(GB).height = 20

  // Fila 5: sub-cabecera
  const HF = 5
  GAR_COLS.forEach((c, i) => {
    const cell = ws.getCell(HF, i + 1)
    cell.value = c.t
    cell.font = { name: FUENTE, size: 9, bold: true, color: { argb: TINTA } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CLARO } }
    cell.alignment = { horizontal: c.al === 'right' ? 'right' : c.al === 'center' ? 'center' : 'left', vertical: 'middle', wrapText: true, indent: 1 }
    cell.border = BORDER
  })
  ws.getRow(HF).height = 24

  if (filas.length === 0) {
    ws.mergeCells(HF + 1, 1, HF + 1, NC)
    const c = ws.getCell(HF + 1, 1); c.value = 'No hay arriendos con datos.'
    c.font = { name: FUENTE, size: 10, italic: true, color: { argb: GRIS } }
    return
  }

  // Datos
  let r = HF + 1
  const ini = r
  for (const f of filas) {
    const pedida = aNumero(f.garantia_pedida) || 0
    const inicial = aNumero(f.cuota) || 0
    const actual = inicial + sumaReaj(f)
    const cs = cuotasDe(f)
    const entregada = cs.reduce((s, c) => s + (c.pag || 0), 0)
    const pendiente = Math.max(pedida - entregada, 0)
    const vals = [
      f.idadmon, f.estado || '', f.inmueble || '', f.idinmue || '',
      f.unid || '', inicial || null, actual || null,
      pedida || null, entregada || null, pendiente || null, f.quien_tiene_garantia || '', aNumero(f.deuda_garantia) || null,
    ]
    cs.forEach(c => { vals.push(aFecha(c.fecha), c.monto || null, c.pag || null) })
    vals.push(aFecha(f.fecha_inicio), aFecha(f.termino_actual), f.arrendatario || '', f.mail_arrendatario || '', f.movil || '')

    const esUF = String(f.unid || '').toUpperCase() === 'UF'
    const zebra = (r - ini) % 2 === 1
    vals.forEach((v, i) => {
      const c = GAR_COLS[i]
      const cell = ws.getCell(r, i + 1)
      cell.value = v
      if (c.money && typeof v === 'number') cell.numFmt = (esUF && (i === 5 || i === 6)) ? '#,##0.00' : FMT_NUM
      if (c.date && v) cell.numFmt = FMT_FECHA
      cell.font = { name: FUENTE, size: 9, color: { argb: TINTA }, bold: i === 0 }
      cell.alignment = { horizontal: c.al === 'right' ? 'right' : c.al === 'center' ? 'center' : 'left', vertical: 'middle', wrapText: !!c.wrap, indent: 1 }
      cell.border = BORDER
      if (GAR_CUOTA_FECHA_IDX.includes(i + 1) && enMes(v)) {
        // resalta la cuota (fecha+monto+pagado) cuyo vencimiento cae en el mes
        for (let k = 0; k < 3; k++) ws.getCell(r, i + 1 + k).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3C4' } }
      } else if (zebra && !cell.fill) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } }
      }
    })
    // Pendiente en color si > 0
    if (pendiente > 0) ws.getCell(r, 10).font = { name: FUENTE, size: 9, bold: true, color: { argb: 'FFB45309' } }
    r++
  }

  // TOTALES (Pedida=8, Entregada=9, Pendiente=10)
  const ult = r - 1, ft = r
  ws.getCell(ft, 1).value = 'TOTALES'
  for (let i = 1; i <= NC; i++) {
    const cell = ws.getCell(ft, i)
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } }
    cell.border = BORDER
    cell.font = { name: FUENTE, size: 10, bold: true, color: { argb: BLANCO } }
    if ([8, 9, 10].includes(i)) {
      const L = letra(i)
      cell.value = { formula: `SUM(${L}${ini}:${L}${ult})` }
      cell.numFmt = FMT_NUM
      cell.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 }
    }
  }
  ws.getRow(ft).height = 22
}

function construirComprobantes(wb, mesTexto, justificantes = []) {
  const ws = wb.addWorksheet('Comprobantes')
  ;[16, 16, 16, 16, 16, 16].forEach((w, i) => ws.getColumn(i + 1).width = w)
  pintarBanda(ws, 1, 1, 6, `Comprobantes · ${mesTexto}`, { size: 13 })
  ws.getRow(1).height = 26

  const imgs = (justificantes || []).filter(j => j && j.buffer)
  if (imgs.length === 0) {
    const nota = ws.getCell('A3')
    nota.value = 'Sin justificantes. Se pegan/suben desde la pantalla (pestaña Justificantes) y aparecen aquí.'
    nota.font = { name: FUENTE, size: 10, italic: true, color: { argb: GRIS } }
    return
  }

  // Rejilla de imágenes: 2 por fila, cada una ~3 columnas de ancho y ~15 filas de alto, con su título.
  const COLS_IMG = 3     // columnas que ocupa cada imagen
  const FILAS_IMG = 15   // filas que ocupa cada imagen
  const POR_FILA = 2
  let bloque = 0
  for (const j of imgs) {
    let imageId
    try { imageId = wb.addImage({ buffer: j.buffer, extension: j.ext || 'jpeg' }) } catch (e) { continue }
    const col0 = (bloque % POR_FILA) * COLS_IMG          // 0 o 3
    const fila0 = 2 + Math.floor(bloque / POR_FILA) * (FILAS_IMG + 2)   // deja hueco entre filas
    // Título encima de la imagen
    const cap = ws.getCell(fila0 + 1, col0 + 1)
    cap.value = [j.idadmon, j.nombre].filter(Boolean).join(' · ') || 'Justificante'
    cap.font = { name: FUENTE, size: 9, bold: true, color: { argb: AZUL } }
    // La imagen, anclada por rango (tl → br) para que escale dentro del hueco
    ws.addImage(imageId, {
      tl: { col: col0, row: fila0 + 1 },
      br: { col: col0 + COLS_IMG, row: fila0 + 1 + FILAS_IMG },
      editAs: 'oneCell',
    })
    bloque++
  }
}

function construirLeyenda(wb, mesTexto) {
  const ws = wb.addWorksheet('Leyenda')
  ws.getColumn(1).width = 30; ws.getColumn(2).width = 78
  pintarBanda(ws, 1, 1, 2, 'Cómo se rellena esta liquidación', { size: 13 })
  ws.getRow(1).height = 26
  const lineas = [
    ['Generado por', 'El CRM (Procesos → Liquidación Paola). No se edita a mano el archivo.'],
    ['A Cobrar', 'Automático · viene de CARTAS (la liquidación del mes ya calculada).'],
    ['Término', 'Automático · fecha comunicada de término (termino_actual), no el fin de contrato.'],
    ['Recibido · Fecha pago', 'Automático · del cruce con la cartola que envía Paola.'],
    ['FALTA DEL MES', 'Fórmula A Cobrar − Recibido. En rojo lo que falta; en verde, si pagó de más.'],
    ['Deuda G.Comunes / Luz / Agua', 'Automático · desde el módulo de servicios.'],
    ['Multas/Deudas · Especial · Cantidad', 'MANUAL · lo introduce Administración en el CRM.'],
    ['Comentarios 1 y 2', 'MANUAL · lo escribe Administración en el CRM. En los avisos de término, Comentario 1 indica la fecha comunicada.'],
    ['Estado pago · Nota pago', 'MANUAL · PAGADO / PAGO ATRASADO (el abono visto es de un mes anterior) / NO PAGÓ, con nota.'],
    ['Filas en beige', 'Propiedades EN CAPTACIÓN (vacantes): aparecen sin importes.'],
    ['Movimientos cuenta', 'La cartola del mes que envía Paola.'],
    ['Comprobantes', 'Hoja para pegar los comprobantes de los pagos.'],
    ['Al cerrar el mes', 'Se congela: queda como registro histórico y ya no se recalcula.'],
    ['Este archivo', mesTexto],
  ]
  let r = 3
  for (const [a, b] of lineas) {
    const ca = ws.getCell(`A${r}`); ca.value = a; ca.font = { name: FUENTE, size: 10, bold: true, color: { argb: AZUL } }
    ca.alignment = { vertical: 'top', wrapText: true }
    const cb = ws.getCell(`B${r}`); cb.value = b; cb.font = { name: FUENTE, size: 10, color: { argb: TINTA } }
    cb.alignment = { wrapText: true, vertical: 'top' }
    r++
  }
}

// `envio` (1/2/3): inserta el número de envío en el nombre para distinguir versiones del mes.
//   2026-08-1-Control Ago 2026.xlsx · 2026-08-2-… · 2026-08-3-…   (aunque solo se envíe uno, lleva -1-)
function nombreArchivo(mes, tipo = 'Control', sufijo = '', envio = null) {
  const { anio, numero } = etiquetaMes(mes)
  const mm = String(numero).padStart(2, '0')
  const nEnv = envio ? `${envio}-` : ''
  const base = `${anio}-${mm}-${nEnv}${tipo} ${MES_CORTO[numero - 1]} ${anio}`
  return `${base}${sufijo ? ' ' + sufijo : ''}.xlsx`
}

export { generarExcelPaola, nombreArchivo, aNumero, aFecha, etiquetaMes }
