// VERSION: v2 · 2026-07-22 · ESM. Correcciones contra el Control real de Adalis: la fila de
//   TOTALES va pegada a la última fila (sin hueco) y FECHA PAGO admite texto ("6/7 y 15/7").
//   Añadido nombreArchivo() con la nomenclatura de la carpeta de Drive P001 PAOLA.
import ExcelJS from 'exceljs'

const MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
]

const FUENTE = { name: 'Aptos Narrow', size: 11 }
const FILL_CABECERA = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1EFE8' } }
const FILL_VACANTE = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5E9DA' } }

const FMT_NUM = '#,##0'
const FMT_FECHA = 'dd\\-mm\\-yyyy'

// B → S. La columna A (estado) va aparte porque no lleva título.
const COLUMNAS = [
  { col: 'B', titulo: 'IdAdmon',         campo: 'idadmon',       ancho: 11.0 },
  { col: 'C', titulo: 'Propiedad',       campo: 'propiedad',     ancho: 39.9 },
  { col: 'D', titulo: 'Comienzo',        campo: 'comienzo',      ancho: 12.3,  fmt: FMT_FECHA },
  { col: 'E', titulo: 'Termino',         campo: 'termino',       ancho: 12.4,  fmt: FMT_FECHA },
  { col: 'F', titulo: 'Arrendatario',    campo: 'arrendatario',  ancho: 26.1 },
  { col: 'G', titulo: 'RUT',             campo: 'rut',           ancho: 13.9 },
  { col: 'H', titulo: 'A Cobrar',        campo: 'aCobrar',       ancho: 12.3,  fmt: FMT_NUM },
  { col: 'I', titulo: 'Recibido',        campo: 'recibido',      ancho: 12.61, fmt: FMT_NUM },
  { col: 'J', titulo: 'FALTA DEL MES',   campo: null,            ancho: 11.1,  fmt: FMT_NUM }, // fórmula
  { col: 'K', titulo: 'FECHA PAGO',      campo: 'fechaPago',     ancho: 11.1,  fmt: FMT_FECHA },
  { col: 'L', titulo: 'MULTAS/DEUDAS',   campo: 'multasDeudas',  ancho: 16.3,  fmt: FMT_NUM },
  { col: 'M', titulo: 'Deuda G Comunes', campo: 'deudaGgcc',     ancho: 14.0,  fmt: FMT_NUM },
  { col: 'N', titulo: 'Deuda Luz',       campo: 'deudaLuz',      ancho: 11.0,  fmt: FMT_NUM },
  { col: 'O', titulo: 'Deuda Agua',      campo: 'deudaAgua',     ancho: 11.0,  fmt: FMT_NUM },
  { col: 'P', titulo: 'Especial',        campo: 'especial',      ancho: 10.9 },
  { col: 'Q', titulo: 'Cantidad',        campo: 'cantidad',      ancho: 10.0,  fmt: FMT_NUM },
  { col: 'R', titulo: 'COMENTARIOS 1',   campo: 'comentarios1',  ancho: 29.4 },
  { col: 'S', titulo: 'COMENTARIOS 2',   campo: 'comentarios2',  ancho: 40.39 },
]

const FILA_TITULOS = 2
const FILA_CABECERA = 3
const FILA_DATOS = 4

function etiquetaMes(mes) {
  const s = String(mes || '').trim()
  let anio, m
  if (/^\d{4}$/.test(s)) {              // AAMM  → '2607'
    anio = 2000 + Number(s.slice(0, 2))
    m = Number(s.slice(2, 4))
  } else if (/^\d{4}-\d{2}$/.test(s)) { // YYYY-MM → '2026-07'
    anio = Number(s.slice(0, 4))
    m = Number(s.slice(5, 7))
  } else {
    throw new Error(`Mes no reconocido: "${mes}". Se espera AAMM (2607) o YYYY-MM (2026-07).`)
  }
  if (!(m >= 1 && m <= 12)) throw new Error(`Mes fuera de rango: "${mes}"`)
  return { texto: `${MESES[m - 1]} ${anio}`, anio, numero: m }
}

// Los importes pueden llegar como texto desde ggcc_agua_luz ("47.320", "$ 12.776", "", null).
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
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)                       // ISO
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)                // dd/mm/yyyy
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

// Una vacante no trae importe y, o no tiene arrendatario, o lleva el rótulo "EN CAPTACION".
function esVacante(fila) {
  if (fila.vacante === true) return true
  if (fila.aCobrar != null) return false
  return !fila.arrendatario || /EN\s*CAPTACI/i.test(String(fila.arrendatario))
}

/**
 * @param {object} opts
 * @param {string} opts.mes            '2607' o '2026-07'
 * @param {Array}  opts.filas          ya ordenadas (orden natural por propiedad, vacantes incluidas)
 * @param {string} [opts.propietario]  rótulo de B2
 * @param {boolean} [opts.totales]     fila de TOTALES al final (por defecto true)
 * @param {boolean} [opts.leyenda]     hoja LEYENDA (por defecto true)
 * @returns {Promise<Buffer>}
 */
async function generarExcelPaola({
  mes,
  filas,
  propietario = 'P001 - Albornoz Sáez, Paola',
  totales = true,
  leyenda = true,
}) {
  if (!Array.isArray(filas)) throw new Error('generarExcelPaola: "filas" debe ser un array')
  const { texto: mesTexto } = etiquetaMes(mes)

  const wb = new ExcelJS.Workbook()
  wb.creator = 'CRM FCR'
  wb.created = new Date()

  const ws = wb.addWorksheet(`LIQUIDACION ${mesTexto}`, {
    views: [{ state: 'frozen', ySplit: FILA_CABECERA }],
  })

  ws.getColumn('A').width = 6.9
  for (const c of COLUMNAS) ws.getColumn(c.col).width = c.ancho

  // Fila 2 — títulos
  const t1 = ws.getCell(`B${FILA_TITULOS}`); t1.value = propietario
  const t2 = ws.getCell(`H${FILA_TITULOS}`); t2.value = `LIQUIDACION ${mesTexto}`
  const t3 = ws.getCell(`R${FILA_TITULOS}`); t3.value = 'COMENTARIOS'
  for (const c of [t1, t2, t3]) c.font = { ...FUENTE, bold: true }

  // Fila 3 — cabecera
  for (const c of COLUMNAS) {
    const cell = ws.getCell(`${c.col}${FILA_CABECERA}`)
    cell.value = c.titulo
    cell.font = { ...FUENTE, bold: true }
    cell.fill = FILL_CABECERA
  }

  // Datos
  let r = FILA_DATOS
  for (const fila of filas) {
    const vacante = esVacante(fila)

    const cA = ws.getCell(`A${r}`)
    cA.value = fila.estado ?? null
    cA.font = { ...FUENTE }
    if (vacante) cA.fill = FILL_VACANTE

    for (const c of COLUMNAS) {
      const cell = ws.getCell(`${c.col}${r}`)

      if (c.col === 'J') {
        // FALTA DEL MES: siempre fórmula, nunca valor. Puede dar negativo (pagó de más).
        cell.value = vacante ? null : { formula: `H${r}-I${r}` }
      } else if (vacante && c.campo !== 'idadmon' && c.campo !== 'propiedad' && c.campo !== 'arrendatario') {
        cell.value = null
      } else if (c.fmt === FMT_FECHA) {
        // FECHA PAGO puede venir como texto si hubo varios pagos ("6/7/2026 y 15/7/2026").
        const bruto = fila[c.campo]
        cell.value = aFecha(bruto) || (bruto ? String(bruto) : null)
      } else if (c.fmt === FMT_NUM) {
        cell.value = aNumero(fila[c.campo])
      } else {
        const v = fila[c.campo]
        cell.value = (v === undefined || v === '') ? null : v
      }

      cell.font = { ...FUENTE }
      if (c.fmt && !vacante && !(c.fmt === FMT_FECHA && typeof cell.value === 'string')) {
        cell.numFmt = c.fmt
      }
      if (vacante) cell.fill = FILL_VACANTE
    }
    r++
  }

  // Fila de TOTALES pegada a la última, como en el Control real de Adalis (sin hueco)
  if (totales && filas.length > 0) {
    const ultima = r - 1
    const filaTot = r
    const etiqueta = ws.getCell(`G${filaTot}`)
    etiqueta.value = 'TOTALES'
    etiqueta.font = { ...FUENTE, bold: true }
    for (const col of ['H', 'I', 'J']) {
      const cell = ws.getCell(`${col}${filaTot}`)
      cell.value = { formula: `SUM(${col}${FILA_DATOS}:${col}${ultima})` }
      cell.font = { ...FUENTE, bold: true }
      cell.numFmt = FMT_NUM
    }
  }

  if (leyenda) construirLeyenda(wb, mesTexto)

  const buffer = await wb.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

function construirLeyenda(wb, mesTexto) {
  const ws = wb.addWorksheet('LEYENDA')
  ws.getColumn('A').width = 26
  ws.getColumn('B').width = 105

  const titulo = ws.getCell('A1')
  titulo.value = 'LIQUIDACIÓN DE PAOLA · cómo se rellena'
  titulo.font = { ...FUENTE, bold: true }

  const lineas = [
    ['Orden', 'Las propiedades salen ordenadas por Propiedad (orden natural, como en CARTAS), con las vacantes intercaladas en su sitio.'],
    ['Generado por', 'El CRM (Procesos → Liquidación Paola). No se edita a mano el archivo.'],
    ['Estado (col. A)', 'Automático · de datos_arriendos, cruzando por IDADMON.'],
    ['A Cobrar (H)', 'Automático · viene de CARTAS (la liquidación del mes ya calculada).'],
    ['Termino (E)', 'Automático · de datos_arriendos (termino_actual), no la fecha de fin de contrato.'],
    ['Recibido (I) · Fecha pago (K)', 'Automático · del cruce con la cartola que envía Paola.'],
    ['FALTA DEL MES (J)', 'Fórmula =H-I. No se escribe. Si sale en negativo, se pagó de más.'],
    ['Deuda G.Comunes / Luz / Agua', 'Automático · desde el módulo de servicios (ggcc_agua_luz).'],
    ['MULTAS/DEUDAS · Especial · Cantidad', 'MANUAL · lo introduce Administración en la pantalla del CRM.'],
    ['COMENTARIOS 1 y 2', 'MANUAL · lo escribe Administración en la pantalla del CRM.'],
    ['Filas en marrón claro', 'Propiedades EN CAPTACIÓN (vacantes): aparecen sin importes.'],
    ['Al cerrar el mes', 'El mes se congela: queda como registro histórico y ya no se recalcula.'],
    ['Este archivo', mesTexto],
  ]

  let r = 3
  for (const [a, b] of lineas) {
    const ca = ws.getCell(`A${r}`); ca.value = a; ca.font = { ...FUENTE, bold: true }
    const cb = ws.getCell(`B${r}`); cb.value = b; cb.font = { ...FUENTE }
    cb.alignment = { wrapText: true, vertical: 'top' }
    r++
  }
}

// Nomenclatura de la carpeta G:\Unidades compartidas\2.SD.ADMON-CONTAB\6.VIPS\P001 PAOLA
//   Control → "2026-07-Control Jul 2026.xlsx"   ·   Cartola → "2026-07-Cartola Jul 2026.xlsx"
const MES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function nombreArchivo(mes, tipo = 'Control', sufijo = '') {
  const { anio, numero } = etiquetaMes(mes)
  const mm = String(numero).padStart(2, '0')
  const base = `${anio}-${mm}-${tipo} ${MES_CORTO[numero - 1]} ${anio}`
  return `${base}${sufijo ? ' ' + sufijo : ''}.xlsx`
}

export { generarExcelPaola, nombreArchivo, aNumero, aFecha, etiquetaMes }
