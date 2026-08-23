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
  propietario = 'P001 · Paola Albornoz Sáez',
  totales = true,
  leyenda = true,
}) {
  if (!Array.isArray(filas)) throw new Error('generarExcelPaola: "filas" debe ser un array')
  const { texto: mesTexto } = etiquetaMes(mes)

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
  construirMovimientos(wb, mesTexto, movimientos, propDe)
  construirComprobantes(wb, mesTexto)
  if (leyenda) construirLeyenda(wb, mesTexto)

  const buffer = await wb.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

function construirMovimientos(wb, mesTexto, movimientos, propDe = {}) {
  const ws = wb.addWorksheet('Movimientos cuenta', { views: [{ state: 'frozen', ySplit: 3 }] })
  const W = [12, 40, 13, 10, 26]; W.forEach((w, i) => ws.getColumn(i + 1).width = w)
  pintarBanda(ws, 1, 1, 5, 'Movimientos de la cuenta · Paola Albornoz', { size: 13 })
  ws.getRow(1).height = 26
  pintarBanda(ws, 2, 1, 5, `Cartola de ${mesTexto} que envía Paola. El IDADMON se reconoce con el discriminador del CRM (RUT del pagador).`, { fill: CLARO, color: GRIS, size: 9, bold: false })
  const cab = ['Fecha', 'Detalle', 'Monto ($)', 'IdAdmon', 'Inmueble']
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
  } else {
    lista.forEach((m, idx) => {
      const idadmon = m.idadmon || ''
      const inmueble = (idadmon && propDe[idadmon]) ? propDe[idadmon] : (m.glosa || m.inmueble || m.nota_cartola || '')
      const vals = [
        aFecha(m.fecha) || (m.fecha ? String(m.fecha) : null),
        m.detalle || m.nota_cartola || '',
        aNumero(m.monto),
        idadmon,
        inmueble,
      ]
      vals.forEach((v, i) => {
        const cell = ws.getCell(`${letra(i + 1)}${r}`)
        cell.value = v
        cell.font = { name: FUENTE, size: 9, color: { argb: TINTA }, bold: i === 3 && !!idadmon }
        cell.border = BORDER
        cell.alignment = { horizontal: i === 2 ? 'right' : (i === 3 ? 'center' : 'left'), vertical: 'middle', wrapText: i === 4 }
        if (i === 0 && v instanceof Date) cell.numFmt = FMT_FECHA
        if (i === 2 && typeof v === 'number') cell.numFmt = FMT_NUM
        if (idx % 2) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } }
      })
      r++
    })
  }
}

function construirComprobantes(wb, mesTexto) {
  const ws = wb.addWorksheet('Comprobantes')
  ;[16, 16, 16, 16, 16, 16].forEach((w, i) => ws.getColumn(i + 1).width = w)
  pintarBanda(ws, 1, 1, 6, `Comprobantes · ${mesTexto}`, { size: 13 })
  ws.getRow(1).height = 26
  const nota = ws.getCell('A3')
  nota.value = 'Pega aquí los comprobantes / pantallazos de los pagos del mes.'
  nota.font = { name: FUENTE, size: 10, italic: true, color: { argb: GRIS } }
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

function nombreArchivo(mes, tipo = 'Control', sufijo = '') {
  const { anio, numero } = etiquetaMes(mes)
  const mm = String(numero).padStart(2, '0')
  const base = `${anio}-${mm}-${tipo} ${MES_CORTO[numero - 1]} ${anio}`
  return `${base}${sufijo ? ' ' + sufijo : ''}.xlsx`
}

export { generarExcelPaola, nombreArchivo, aNumero, aFecha, etiquetaMes }
