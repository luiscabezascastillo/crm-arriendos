// RUTA: app/lib/parseTarjetaCredito.js
// VERSION: v1 · 2026-08-16 · Lector del ESTADO DE CUENTA de la Tarjeta de Crédito Santander (MASTER
//   EMPRESA PLUS, FONDO CAPITAL RENT, tarjeta ...2494) en PDF, en el navegador (pdf.js desde CDN).
//   El estado trae capa de texto por filas. Se reconstruyen las líneas por 'y', y de cada línea de
//   movimiento se extrae: fecha de operación, lugar, comercio, nº de cuota (p.ej. 04/06), moneda
//   (USD si trae "US ..."), y el CARGO DEL MES (el importe que golpea la factura, el último $ de la
//   línea; negativo en pagos "MONTO CANCELADO" y notas de crédito). Se EXCLUYE el comprobante de pago
//   del pie (usa fecha con año de 4 dígitos, dd/mm/aaaa; los movimientos reales usan dd/mm/aa).
//   Validado contra los 7 estados reales de FCR (ene–jul 2026): 74 movimientos, con los signos y las
//   cuotas correctos, cuadrando con el Excel de respaldo.
'use client'

const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174'

async function cargarPdfJs() {
  if (typeof window === 'undefined') throw new Error('Solo en el navegador.')
  if (window.pdfjsLib) return window.pdfjsLib
  await new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = `${CDN}/pdf.min.js`
    s.onload = resolve
    s.onerror = () => reject(new Error('No pude cargar el lector de PDF (pdf.js). ¿Hay conexión?'))
    document.head.appendChild(s)
  })
  if (!window.pdfjsLib) throw new Error('pdf.js no quedó disponible.')
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${CDN}/pdf.worker.min.js`
  return window.pdfjsLib
}

// dd/mm/aa (NO seguido de otro dígito → descarta el dd/mm/aaaa del comprobante de pago del pie).
const RE_FECHA = /(\d{2})\/(\d{2})\/(\d{2})(?!\d)/
const RE_MONTOS = /\$\s*(-?[\d.]+)/g
// nº de cuota = dd/dd que va justo antes del último importe de la línea (p.ej. "04/06 $84.091").
const RE_CUOTA_TAIL = /(\d{2}\/\d{2})\s*\$?\s*-?[\d.]+\s*$/
const RE_USD = /\bUS\s+([\d.,]+)/
// marcadores donde ACABA el nombre del comercio y empieza la "morralla" (importes, cuotas, sellos).
const RE_MARK = /(\$|N\/CUOTAS|CUOTA COMERCIO|CUOTAS COMERC|COMPRAS P\.A\.T\.|TRES CUOTAS|CUOTAS PREC|\bUS\s|\bCL\s|\s%)/
const RE_EDC = /FECHA ESTADO DE CUENTA\s+(\d{2})\/(\d{2})\/(\d{4})/
const RE_FACT = /PER[IÍ]ODO FACTURADO\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})/
const RE_PAGAR = /PAGAR HASTA\s+(\d{2}\/\d{2}\/\d{4})/
const RE_FACTURADO = /MONTO TOTAL FACTURADO A PAGAR\s*\$?\s*([\d.]+)/
const RE_SALDO_FIN = /SALDO ADEUDADO FINAL PER[IÍ]ODO ANTERIOR\s*\$?\s*([\d.]+)/

// Cabeceras/etiquetas que NO son movimientos (aunque lleven cifras).
const SALTAR = ['PERÍODO', 'PERIODO', 'PAGAR HASTA', 'ESTADO DE CUENTA', 'SALDO ADEUDADO',
  'MONTO FACTURADO', 'MONTO PAGADO', 'MONTO TOTAL', 'TOTAL OPERACIONES', 'MOVIMIENTOS TARJETA',
  'PRODUCTOS O SERVICIOS', 'CARGOS, COMISIONES', 'INFORMACION COMPRAS', 'INFORMACIÓN COMPRAS',
  'COMPROBANTE', 'NÚMERO DE TARJETA', 'MONTO MÍNIMO', 'CUPO', 'TASA INTER', 'CAE ']

const soloDig = (s) => { const t = String(s).replace(/[^\d-]/g, ''); if (t === '' || t === '-') return null; const n = parseInt(t, 10); return Number.isFinite(n) ? n : null }
const fechaISO = (dd, mm, yy) => `20${yy}-${mm}-${dd}`
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim()

// ── Núcleo puro: array de líneas (texto) + meta → objeto tarjeta. (Probado con los 7 PDF.) ──
export function tarjetaFromLineas(lineas, meta = {}) {
  const periodo = meta.periodo || null
  const fecha_edc = meta.fecha_edc || null
  let seccion = 'operacion'
  const movimientos = []
  for (const raw of lineas) {
    const L = norm(raw)
    if (!L) continue
    const U = L.toUpperCase()
    if (U.startsWith('3. CARGOS') || U.startsWith('3.CARGOS')) { seccion = 'cargo'; continue }
    if (U.startsWith('4. INFORMACION') || U.startsWith('4.INFORMACION') || U.startsWith('4. INFORMACIÓN')) { seccion = 'fin'; continue }
    if (seccion === 'fin') continue
    if (SALTAR.some(k => U.includes(k))) continue
    const d = RE_FECHA.exec(L)
    if (!d) continue
    const pos = d.index
    const fecha = fechaISO(d[1], d[2], d[3])
    const lugar = norm(L.slice(0, pos))
    const cola = L.slice(pos)                       // desde la fecha hasta el final
    const restoTrasFecha = norm(cola.slice(d[0].length))
    const amts = cola.match(RE_MONTOS)
    if (!amts || !amts.length) continue
    const cargo = soloDig(amts[amts.length - 1])    // CARGO DEL MES = último importe (con su signo)
    if (cargo == null) continue
    const cu = RE_CUOTA_TAIL.exec(cola)
    const n_cuota = cu ? cu[1] : ''
    const usd = RE_USD.exec(cola)
    const moneda = usd ? 'USD' : 'CLP'
    const monto_divisa = usd ? usd[1] : null
    const mk = RE_MARK.exec(restoTrasFecha)
    const descripcion = norm(mk ? restoTrasFecha.slice(0, mk.index) : restoTrasFecha)
    const id_transaccion = [periodo, fecha, descripcion, n_cuota, cargo].join('|')
    movimientos.push({ id_transaccion, periodo, fecha_edc, fecha, lugar: lugar || null, descripcion: descripcion || null, seccion, n_cuota: n_cuota || null, moneda, monto_divisa, monto: cargo })
  }
  return movimientos
}

// Reconstruye líneas de una página a partir de los items {str,x,y} de pdf.js (agrupa por 'y').
function lineasDePagina(items) {
  const it = items.filter(i => (i.str || '').trim() !== '').map(i => ({ s: i.str, x: Math.round(i.transform[4]), y: Math.round(i.transform[5]) }))
  it.sort((a, b) => b.y - a.y || a.x - b.x)
  const filas = []; let cur = null
  for (const t of it) { if (!cur || Math.abs(cur.y - t.y) > 3) { cur = { y: t.y, its: [] }; filas.push(cur) } cur.its.push(t) }
  return filas.map(f => { f.its.sort((a, b) => a.x - b.x); return f.its.map(t => t.s).join(' ') })
}

export async function parseTarjetaCredito(file) {
  const pdfjsLib = await cargarPdfJs()
  const buf = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  const lineas = []
  let textoTodo = ''
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const tc = await page.getTextContent()
    const ls = lineasDePagina(tc.items)
    lineas.push(...ls)
    textoTodo += '\n' + ls.join('\n')
  }
  // Cabecera del estado (para mostrar y cuadrar; no se guarda en v1).
  const edc = RE_EDC.exec(textoTodo)
  const fecha_edc = edc ? `20${edc[3].slice(2)}-${edc[2]}-${edc[1]}` : null
  const periodo = edc ? edc[3].slice(2) + edc[2] : null   // AAMM del estado
  const fact = RE_FACT.exec(textoTodo)
  const pagar = RE_PAGAR.exec(textoTodo)
  const facturado = RE_FACTURADO.exec(textoTodo)
  const saldo = RE_SALDO_FIN.exec(textoTodo)
  const resumen = {
    periodo_facturado: fact ? { desde: fact[1], hasta: fact[2] } : null,
    pagar_hasta: pagar ? pagar[1] : null,
    monto_facturado: facturado ? soloDig(facturado[1]) : null,
    saldo_final_anterior: saldo ? soloDig(saldo[1]) : null,
  }
  const movimientos = tarjetaFromLineas(lineas, { periodo, fecha_edc })
  if (!movimientos.length) throw new Error('No encontré movimientos. ¿Es el estado de cuenta de la tarjeta Santander (PDF)?')
  return { archivo: file.name, periodo, fecha_edc, resumen, movimientos }
}
