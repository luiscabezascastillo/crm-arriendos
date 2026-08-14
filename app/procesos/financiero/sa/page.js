// VERSION: v36 · 2026-08-14 · SA: nueva columna CHECK (a la derecha de Est.). Muestra SÍ/NO por movimiento y
//   abre un cajón "COMENTARIOS" con Observación, Acciones y Mejoras propuestas (3 campos libres). Al guardar,
//   el servidor sella automáticamente "Revisado por" (email de quien revisa) y "Fecha". Persiste en sa_marcas
//   (columnas check_*) vía PATCH /api/financiero/sa v9. Solo editores pueden guardar; el resto lo ve en lectura.
//   Requiere el ALTER TABLE de sa_marcas (ver route v9). Hereda v35.
// VERSION: v35 · 2026-08-14 · SA: columnas más compactas — C/A a la mitad (24px) y Estado reducido ~80% mostrándose
//   como un punto de color (verde=Cuadrado, gris=Sin clasificar, rojo=Descuadrado; el texto sale al pasar el ratón).
//   Cabecera "Est.". (La columna CHECK con SI/NO + comentarios va aparte.) Hereda v34.
// VERSION: v34 · 2026-08-12 · SA: COLORear movimientos con paleta fija de 5 (MANDATOS / error corregido / DEVOLUCIÓN
//   A FCR / PRÉSTAMOS / ERROR a corregir). Botón ▾ tras el Monto abre la paleta; tiñe SOLO el fondo de las 4 primeras
//   columnas; leyenda encima de la tabla. Guarda en sa_marcas vía PATCH (requiere sa/route v8). Hereda v33.
// VERSION: v33 · 2026-08-12 · SA usabilidad: panel de clasificación más ESTRECHO (clamp 440–620px, antes 640–1120)
//   para no tapar los números; la tabla se alinea a la IZQUIERDA (margin 0, menos padding, más ancho) y la fila que
//   abre el panel se resalta en BLANCO con acento verde a la izquierda. Hereda v32.
// VERSION: v32 · 2026-08-12 · SA: la columna MONTO cambia su desplegable por un filtro POR RANGO con signo
//   (Desde/Hasta): cargos negativos / abonos positivos, un lado opcional. Se quitan de ese menú el "ordenar" y las
//   opciones inactivas (borrar filtro / quitar todos). El resto de columnas conserva su filtro Excel. Hereda v31.
// VERSION: v31 · 2026-07-30 · SA: Cuenta 1 se pone sola en 2105-05 en pagos a proveedor.
//   Cuando la linea CUADRA con una factura de Compras (mismo importe, ±20 dias), el pago
//   cancela la deuda del proveedor, asi que la contrapartida SIEMPRE es 2105-05 PROVEEDORES.
//   Ahora se rellena sola la Cuenta 1 con 2105-05 (solo si estaba vacia y solo en cargos),
//   y ademas se ofrece como sugerencia por si se borra. La persona se centra en la Cuenta 2.
//   Respeta cualquier cuenta que ya se hubiera escrito a mano: no pisa nada.
// VERSION: v30 · 2026-07-29 · SA: campo COMENTARIO por linea + autorelleno del origen.
//   · Cada linea gana un campo "Comentario" (tercera fila, ancho completo) para notas
//     libres y para dejar constancia de DE DONDE viene la cuenta.
//   · Al pulsar una compra sugerida para Cuenta 2, ademas de poner la cuenta se rellena
//     el comentario con la referencia ('Compras · PROVEEDOR · Folio N · fecha') si estaba
//     vacio, para que quede por escrito de que factura salio la imputacion.
//   · Requiere la columna nueva: alter table public.sa_lineas add column if not exists comentario text;
//     y el route de SA v7 (que la lee y la guarda).
// VERSION: v29 · 2026-07-29 · SA: cada linea del drawer en DOS filas + referencia visible.
//   Sobre la v28, tres arreglos pedidos al verlo en pantalla:
//   1) Cada linea se despliega en dos filas: arriba folio · CCB · cantidad · concepto;
//      abajo Cuenta 1 y Cuenta 2 a media anchura, CON su descripcion completa debajo
//      ('2105-05 · PROVEEDORES...'). Antes las cuentas iban en 90px y no se leia el texto.
//   2) La referencia a Compras esta SIEMPRE visible bajo Cuenta 2 en los pagos: si hay
//      compra que cuadra la lista; si esta cargando dice 'buscando en Compras…'; si no
//      hay ninguna dice 'sin compra que cuadre'. Asi se ve que el mecanismo actua.
//   3) La sugerencia ya NO exige que la compra tenga cuenta puesta: se muestra igual
//      (con 'sin cuenta') para saber QUE se pago; solo se puede pulsar para rellenar
//      Cuenta 2 cuando la compra si tiene cuenta.
// VERSION: v28 · 2026-07-29 · SA: Cuenta 2 con buscador y sugerencia desde Compras.
//   · Cuenta 2 deja de ser un campo a ciegas: usa el MISMO buscador que Cuenta 1
//     (CuentaSelector), con el plan de cuentas.
//   · Sugerencia de proveedor: al clasificar un pago se busca en el Registro de Compras
//     la factura que CUADRA por importe EXACTO y fecha cercana (±20 dias del movimiento).
//     Si la encuentra, se ofrece su cuenta en Cuenta 2 (la que ya se imputo en Compras),
//     asi no hay que ir a mirar "que se pago" a mano. Si hay varias candidatas, se
//     ofrecen todas.
//   · Campo de referencia nuevo: debajo de la linea salen la/las compras sugeridas con
//     su fecha · proveedor · folio · cuenta, y un clic las aplica a Cuenta 2.
//   · Reutiliza el endpoint que ya existe (/api/financiero/compras?todas=1): no toca
//     backend. Las compras se cargan la primera vez que se abre un movimiento y se
//     guardan en memoria para el resto de la sesion. Se ignoran las RECHAZADAS (no son de FCR).
// VERSION: v27 · 2026-07-27 · SA: al pasar el raton por una cuenta sale su descripcion.
//   Antes el tooltip repetia el codigo, que es justo lo que ya se ve. Ahora muestra
//   '4201-41 · TELEFONO E INTERNET', sacado del plan de cuentas que ya llega del
//   endpoint. Sirve para revisar sin tener que abrir cada movimiento.
// VERSION: v26 · 2026-07-27 · SA: columnas CCB y Cuenta en la lista.
//   El CCB y la cuenta viven en las LINEAS, no en el movimiento, asi que uno puede
//   tener varios. Se resume: si todas las lineas coinciden se muestra el valor; si no,
//   'varios' con el detalle en el tooltip. Vacio si aun no esta clasificado.
//   Se calcula en el navegador con las lineas que ya estan cargadas: ni endpoint ni
//   vista tocados.
// VERSION: v25 · 2026-07-27 · SA: al guardar ya no salta al principio de la lista.
//   Guardar recargaba la lista ENTERA: mientras cargaba las filas desaparecian, la
//   pagina se encogia y el navegador perdia la posicion, asi que al volver estabas en
//   el 01/01/2025. Con 732 movimientos eso hace inviable clasificar en serie.
//   Ahora el guardado actualiza SOLO ese movimiento en memoria, replicando el mismo
//   calculo de estado que hace la vista. Ni recarga ni salto.
//   Y cuando si hay que recargar (tras subir un extracto) se conserva la posicion.
// VERSION: v24 · 2026-07-27 · SA: glosa contable editable en el panel.
//   El banco repite su plantilla: un pago de honorarios sale como "Honorarios Noviembr"
//   en enero, febrero y marzo (folios 1879, 1922, 1966). Ahora se puede escribir una
//   glosa propia que es la que va al asiento; la del banco se sigue viendo debajo.
// VERSION: v23 · 2026-07-27 · SA: se captura el N° MOVIMIENTO del banco.
//   Es el correlativo unico que asigna el Santander a cada apunte (1646, 1647...).
//   Se capturaba N° DOCUMENTO -que en esta cuenta vale 000000000- e se ignoraba el
//   que si identifica. Con el, la Consulta de Movimientos semanal (parcial, solapada
//   y de rango libre) se reconcilia sin depender de la posicion en el archivo.
// VERSION: v22 · 2026-07-27 · SA: el buscador de cuentas pasa a componente compartido.
//   Compras necesita exactamente la misma ayuda, asi que CuentaSelector vive ahora en
//   components/ui y lo usan las dos pantallas. Comportamiento identico al v21.
// VERSION: v21 · 2026-07-27 · SA: ayuda para clasificar (buscador de cuentas + memoria).
//   · Cuenta 1 deja de ser un campo a ciegas: buscador sobre el plan de cuentas, por
//     codigo o por texto. Nadie tiene que recordar 181 codigos, y evita repetir el
//     1103-01 por 1101-03 que costo 42 millones de descuadre.
//   · Memoria por DESCRIPCION del movimiento (un apunte de banco no tiene RUT):
//       - patron unanime  -> se sugiere la cuenta con un clic;
//       - desglose repetido (PREVIRED son 6 lineas fijas, el SII 4) -> boton para
//         copiar el desglose entero del movimiento anterior igual;
//       - "TRANSF. SIN INFORMACION" (50 lineas, 3 cuentas) NO sugiere nada: una
//         sugerencia mala en el patron mas frecuente enseña a desconfiar de todas.
//   · El plan de cuentas llega del endpoint (route.js v4).
// VERSION: v20 · 2026-07-27 · SA: el panel de clasificacion se pone POR ENCIMA de las barras.
//   El panel se abre en top:0 con zIndex 41, pero el TopNav va por encima y le tapaba
//   las dos primeras lineas: folio, fecha y DESCRIPCION del movimiento. Es decir, se
//   ocultaba justo lo que hace falta para saber que se esta clasificando.
//   Ademas el fondo oscurecido tampoco cubria las barras, asi que la navegacion seguia
//   clicable durante la edicion: un clic en otra pestaña y se pierde lo escrito.
//   Un panel de edicion es modal: mientras esta abierto, va encima de todo.
// VERSION: v19 · 2026-07-26 · SA · Banco Santander: cabecera compartida FinancieroHeader (3 lineas, fija).
//   El offset pegajoso lo calcula el componente (TopNav + FinancieroNav). Antes esta
//   pagina media solo el hermano inmediato y la cabecera se escondia tras el TopNav.
//   Totales como chips dentro de la zona fija: ya no desaparecen al hacer scroll.
//   Fuera el boton ← Financiero (duplicado: ya esta en FinancieroNav).
//   · Operadores completos — texto: contiene/no contiene/empieza/termina/igual/distinto ·
//     número: = > < >= <= entre · fecha: hoy/ayer/esta semana/este mes/este año/desde/hasta/entre.
//   · DOS condiciones por columna combinables con Y / O.
//   · "Quitar todos los filtros" dentro del propio menú.
//   · El icono de la columna filtrada se pinta en verde sólido.
// v15 · "Add current selection to filter":
//   con un filtro ya puesto, al buscar otro valor se puede SUMARLO al filtro en vez de
//   sustituirlo. La casilla solo aparece cuando ya hay un filtro en esa columna.
// v14 · BUG del filtro: al escribir en el buscador se acortaba la lista
//   pero los valores ocultos seguían marcados, así que Aceptar concluía "están todos" y no
//   filtraba nada. Ahora, como en Excel, escribir en el buscador deja marcados SOLO los
//   resultados; al borrarlo se vuelven a marcar todos. Aceptar se desactiva si no hay ninguno.
// v13 · Marcas de auditoría (tabla sa_marcas): el folio admite sufijo
//   (1659A / 1659B), la fila se pinta del color indicado y un ⚠ muestra la nota al pasar el
//   ratón. Los desgloses heredan el folio con su sufijo: 1659A-01.
// v12 · Los filtros pasan a ser IGUALES A LOS DE EXCEL, en todas las
//   columnas: lista de valores con casillas, buscador, (Seleccionar todo), ordenar de menor a
//   mayor, borrar filtro, condiciones de número/fecha/texto, y Aceptar/Cancelar (no se aplica
//   hasta Aceptar). La Fecha se despliega en árbol año › mes › día.
// v11 · Segunda vuelta con Karina:
//   · Filtro de MONTO (no existía): igual / mayor / menor / entre, sin signo, buscando también
//     en las líneas de clasificación.
//   · Filtro de FECHA por rango desde–hasta con atajos de mes (la lista no salía con >40 fechas).
//   · Panel "Resumen por CCB" del periodo visible, con el texto del concepto único listo para
//     copiar: COBROS CC1 … CC2 … CC3 … (total).
//   · Botón para exportar a Excel exactamente lo filtrado, movimientos y líneas.
// v10 · Arreglos del filtro reportados por Karina:
//   · El texto busca también en las LÍNEAS de clasificación (CCB, cuentas, concepto), no solo en
//     la descripción del movimiento. Si coincide el padre o cualquier línea, sale el grupo entero.
//   · La fila de Apertura deja de colarse cuando hay un filtro activo.
//   · Pie con TOTALES de lo filtrado (movimientos, cargos, abonos y neto) + botón Limpiar filtros.
//   · El Saldo se atenúa al filtrar, porque es un saldo corrido y deja de ser el de lo que se ve.
//   · Solo se aceptan planillas: pegar una imagen ya no intenta cargarla, y el error va en español.
'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo, useRef } from 'react'
import TopNav from '@/app/components/ui/TopNav'
import FinancieroNav from '@/app/components/ui/FinancieroNav'
import FinancieroHeader from '@/app/components/ui/FinancieroHeader'
import CuentaSelector from '@/app/components/ui/CuentaSelector'

const EDITORES = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']
// Un pago que cuadra con una factura de compra cancela la deuda del proveedor: la
// contrapartida en el banco es siempre esta cuenta.
const CTA_PROVEEDORES = '2105-05'
const CCB_SUGERIDOS = ['CC1', 'CC2', 'CC3', 'BB1', 'BB2', 'GG']
const EXT_PLANILLA = /\.(xlsx|xlsm|xls|csv)$/i
const MES_LARGO = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
const MESES_NOM = MES_LARGO.map(m => m.toLowerCase())   // para el árbol de fechas del filtro

const ESTADO = {
  CUADRADO:       { bg: '#E1F5EE', color: '#085041', label: 'Cuadrado' },
  SIN_CLASIFICAR: { bg: '#F0EFEA', color: '#888780', label: 'Sin clasificar' },
  DESCUADRADO:    { bg: '#FBE9E7', color: '#B23A3A', label: 'Descuadrado' },
}

const clp = (n) => (n == null ? '—' : Number(n).toLocaleString('es-CL'))
const fmtFecha = (iso) => { if (!iso) return ''; const [y, m, d] = String(iso).slice(0, 10).split('-'); return `${d}/${m}/${y}` }
const subFolio = (folio, sub) => `${folio ?? '·'}-${String(sub).padStart(2, '0')}`
// Folio tal como se ve: el número más el sufijo de la marca de auditoría, si la tiene.
const folioVisible = (m) => (m?.orden == null ? null : `${m.orden}${m.sufijo_orden || ''}`)

function fechaISO(v) {
  if (v == null || v === '') return null
  if (v instanceof Date && !isNaN(v)) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`
  const s = String(v).trim()
  let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/); if (m) return `${m[3]}-${m[2]}-${m[1]}`
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`
  return null
}
function cellStr(v) { if (v == null) return null; let s = String(v).trim(); if (s.endsWith('.0')) s = s.slice(0, -2); return s || null }

// Lee un extracto del Santander (provisoria o mensual) y devuelve la cabecera + movimientos limpios.
async function parseCartola(file, XLSX) {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: false })
  let hi = -1
  for (let i = 0; i < rows.length; i++) { if (rows[i] && String(rows[i][0]).trim().toUpperCase() === 'MONTO') { hi = i; break } }
  if (hi < 0) throw new Error('No encontré la cabecera (columna MONTO). ¿Es un archivo del Santander?')
  // Las columnas se localizan POR NOMBRE: cambian de sitio según el formato.
  // Cartola mensual/provisoria: FECHA va en la 3 y CARGO/ABONO en la 7.
  // Consulta de movimientos (extracto semanal): FECHA en la 2, SALDO en la 3, CARGO/ABONO en la 6.
  const H = Array.from(rows[hi] || [], c => String(c == null ? '' : c).trim().toUpperCase())
  const col = (...subs) => { for (let i = 0; i < H.length; i++) { if (subs.every(s => H[i].includes(s))) return i } return -1 }
  const C = { monto: col('MONTO'), desc: col('DESCRIPCI'), fecha: col('FECHA'), saldo: col('SALDO'),
              ndoc: col('DOCUMENTO'), suc: col('SUCURSAL'), ca: col('CARGO'),
              // OJO: 'MOVIMIENTO' tambien casa con 'DESCRIPCION MOVIMIENTO'. Hay que excluirla.
              nmov: H.findIndex(h => h.includes('MOVIMIENTO') && !h.includes('DESCRIP')) }
  if (C.fecha < 0) throw new Error('No encontré la columna FECHA en el archivo.')
  const flat = rows.slice(0, hi + 1).map(r => (r || []).map(c => c == null ? '' : String(c)).join('  ')).join('  ')
  const nroM = flat.match(/N[uú]mero cartola:\s*(\d+)/i)
  const nroFile = (file.name || '').match(/-(\d{4})-\d{8}/)   // CartolaProvisoria-00008848470-0047-20260713.xlsx
  const desde = fechaISO((flat.match(/Fecha desde:\s*([\d/]+)/i) || [])[1])
  const hasta = fechaISO((flat.match(/Fecha hasta:\s*([\d/]+)/i) || [])[1])
  const esConsulta = /Consulta de movimientos/i.test(flat)
  const tipo = (esConsulta || /provisori/i.test(flat) || /provisori/i.test(file.name || '')) ? 'provisoria' : 'definitiva'
  let saldo_inicial = null
  for (let i = 0; i < hi; i++) {
    const r = rows[i] || []
    const idx = r.findIndex(c => String(c).trim().toUpperCase() === 'SALDO INICIAL')
    if (idx >= 0) { const v = (rows[i + 1] || [])[idx]; if (v != null && v !== '' && !isNaN(Number(v))) saldo_inicial = Math.round(Number(v)); break }
  }
  const movimientos = []
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i] || []
    const monto = Number(r[C.monto]); const f = fechaISO(r[C.fecha])
    if (r[C.monto] == null || r[C.monto] === '' || isNaN(monto) || !f) continue   // excluye saldos diarios y filas sin fecha
    const ca = String(C.ca >= 0 ? (r[C.ca] == null ? '' : r[C.ca]) : '').trim().toUpperCase().slice(0, 1)
    movimientos.push({ fecha: f, monto: Math.round(monto), descripcion: cellStr(r[C.desc]),
      n_documento: C.ndoc >= 0 ? cellStr(r[C.ndoc]) : null, sucursal: C.suc >= 0 ? cellStr(r[C.suc]) : null,
      // Correlativo unico del banco. Viene con ceros a la izquierda ('000001656').
      n_movimiento: (() => { const t = C.nmov >= 0 ? String(r[C.nmov] ?? '').replace(/\D/g, '') : ''; return t ? Number(t) : null })(),
      cargo_abono: (ca === 'C' || ca === 'A') ? ca : null,
      saldo: (C.saldo >= 0 && r[C.saldo] != null && r[C.saldo] !== '' && !isNaN(Number(r[C.saldo]))) ? Math.round(Number(r[C.saldo])) : null })
  }
  // El extracto semanal llega del más reciente al más antiguo. Hay que darle la vuelta:
  // el servidor reconcilia por posición, así que el orden tiene que ser el del banco.
  if (movimientos.length > 1 && movimientos[0].fecha > movimientos[movimientos.length - 1].fecha) movimientos.reverse()
  // El extracto no trae saldo inicial: se deduce del primer movimiento (su saldo menos su monto).
  if (saldo_inicial == null && movimientos.length && movimientos[0].saldo != null) saldo_inicial = movimientos[0].saldo - movimientos[0].monto
  // El periodo sale del primer movimiento (más fiable que «Fecha desde», que suele caer en el mes anterior).
  const meses = Array.from(new Set(movimientos.map(m => m.fecha.slice(0, 7)))).sort()
  const periodo = meses[0] || (hasta ? hasta.slice(0, 7) : (desde ? desde.slice(0, 7) : null))
  return { nro_cartola: nroM ? Number(nroM[1]) : (nroFile ? Number(nroFile[1]) : null), tipo, periodo,
    fecha_desde: desde, fecha_hasta: hasta, saldo_inicial, archivo: file.name, movimientos, meses }
}

// Cada columna declara: cómo se pinta (get), qué clave usa el filtro (fkey), cómo se etiqueta
// ese valor en la lista (flabel) y de qué tipo es, para ordenar la lista y ofrecer condiciones.
// Resume las lineas de un movimiento en un solo valor.
// Devuelve { txt, varios, detalle } para pintar la celda y su tooltip.
function resumeLineas(ls, campo, corta) {
  const vals = []
  for (const l of (ls || [])) {
    let v = String(l[campo] || '').trim()
    if (!v) continue
    if (corta) v = (v.match(/^[0-9]{4}-[0-9]{2}(-[0-9]{2})?/) || [v])[0]
    if (!vals.includes(v)) vals.push(v)
  }
  if (!vals.length) return { txt: '', varios: false, detalle: '' }
  if (vals.length === 1) return { txt: vals[0], varios: false, detalle: vals[0] }
  return { txt: 'varios', varios: true, detalle: vals.join(' · ') }
}

const COLDEFS = [
  { key: 'orden', label: 'Folio', w: '80px', align: 'left', tipo: 'num',
    get: m => (m.orden == null ? '' : String(m.orden)),
    fkey: m => folioVisible(m) || '', flabel: k => (k === '' ? '(vacías)' : k) },
  { key: 'fecha', label: 'Fecha', w: '92px', align: 'left', tipo: 'fecha',
    get: m => fmtFecha(m.fecha),
    fkey: m => String(m.fecha || '').slice(0, 10), flabel: k => (k === '' ? '(vacías)' : fmtFecha(k)) },
  { key: 'descripcion', label: 'Descripción', w: '1fr', align: 'left', tipo: 'texto',
    get: m => m.descripcion || '',
    fkey: m => m.descripcion || '', flabel: k => (k === '' ? '(vacías)' : k) },
  { key: 'monto', label: 'Monto', w: '118px', align: 'right', tipo: 'num',
    get: m => m.monto,
    fkey: m => String(m.monto ?? ''), flabel: k => (k === '' ? '(vacías)' : clp(Number(k))) },
  { key: 'saldo_calc', label: 'Saldo', w: '118px', align: 'right', tipo: 'num',
    get: m => m.saldo_calc,
    fkey: m => String(m.saldo_calc ?? ''), flabel: k => (k === '' ? '(vacías)' : clp(Number(k))) },
  { key: 'cargo_abono', label: 'C/A', w: '24px', align: 'center', tipo: 'texto',
    get: m => m.cargo_abono || '',
    fkey: m => m.cargo_abono || '', flabel: k => (k === '' ? '(vacías)' : k) },
  { key: 'ccb_res', label: 'CCB', w: '78px', align: 'center', tipo: 'texto',
    get: m => m.__ccb || '',
    fkey: m => m.__ccb || '', flabel: k => (k === '' ? '(sin CCB)' : k) },
  { key: 'cuenta_res', label: 'Cuenta', w: '92px', align: 'left', tipo: 'texto',
    get: m => m.__cta || '',
    fkey: m => m.__cta || '', flabel: k => (k === '' ? '(sin cuenta)' : k) },
  { key: 'estado_clasificacion', label: 'Est.', w: '30px', align: 'center', tipo: 'texto',
    get: m => m.estado_clasificacion,
    fkey: m => m.estado_clasificacion || '', flabel: k => (k === '' ? '(vacías)' : (ESTADO[k]?.label || k)) },
  { key: 'check', label: 'CHECK', w: '64px', align: 'center', tipo: 'texto',
    get: m => m.check_estado || '',
    fkey: m => m.check_estado || '', flabel: k => (k === '' ? '(sin revisar)' : k) },
]
const GRID = COLDEFS.map(c => c.w).join(' ')

// Paleta de marcas: SOLO estos colores, con su criterio fijo (para usarlos siempre igual).
const PALETA_MARCA = [
  { color: '#FBE2E2', label: 'MANDATOS' },            // rojo claro
  { color: '#F5EFDD', label: 'error corregido' },     // amarillo pálido / beige
  { color: '#E4F3E2', label: 'DEVOLUCIÓN A FCR' },    // verde claro
  { color: '#E2EDF8', label: 'PRÉSTAMOS' },           // azul claro
  { color: '#FCEB8A', label: 'ERROR a corregir' },    // amarillo fuerte
]
// Quita los numeros largos de cuenta para que "0768287120 Transf. SIN INFORMACION" y
// "0217103770 Transf a CABEZAS JIMENO" no cuenten como patrones distintos.
const patronDe = (d) => String(d || '').toUpperCase().replace(/[0-9]{6,}/g, '').replace(/\s+/g, ' ').trim()
// Patrones donde el banco no dice nada: no se sugiere.
const PATRON_MUDO = /TRANSF\.? SIN INFORMACION/

const DGRID = '80px 76px 108px 1fr 90px 90px 26px'  // (v27 y anteriores) drawer en una sola fila
const LGRID = '60px 96px 110px 1fr 28px'             // v28: fila superior de cada linea · folio · CCB · cantidad · concepto · x

function Chip({ estado }) {
  const e = ESTADO[estado] || ESTADO.SIN_CLASIFICAR
  return <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 9px', borderRadius: 20, background: e.bg, color: e.color, whiteSpace: 'nowrap' }}>{e.label}</span>
}
function Card({ label, value, color }) {
  return (
    <div style={{ background: '#fff', border: '0.5px solid #E0DED6', borderRadius: 10, padding: '10px 14px', minWidth: 112, flex: '1 1 auto' }}>
      <div style={{ fontSize: 11, color: '#888780', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color || '#2C2C2A' }}>{value}</div>
    </div>
  )
}

// ─── FILTRO TIPO EXCEL ──────────────────────────────────────────────────────
// Estado por columna:
//   { sel: string[] | undefined,          // valores marcados; ausente = todos
//     c1: {op,v1,v2}, conector: 'Y'|'O', c2: {op,v1,v2} }
// Se aplica: (sel) Y (c1 conector c2). Entre columnas distintas, siempre Y.

const OPERADORES = {
  texto: [['contiene','Contiene'], ['nocontiene','No contiene'], ['empieza','Empieza por'],
          ['termina','Termina por'], ['igual','Igual a'], ['distinto','Distinto de']],
  num:   [['=','Igual a'], ['>','Mayor que'], ['<','Menor que'], ['>=','Mayor o igual'],
          ['<=','Menor o igual'], ['entre','Entre dos valores']],
  fecha: [['hoy','Hoy'], ['ayer','Ayer'], ['semana','Esta semana'], ['mes','Este mes'],
          ['anio','Este año'], ['desde','Desde'], ['hasta','Hasta'], ['entre','Entre dos fechas']],
}
const SIN_VALOR = new Set(['hoy', 'ayer', 'semana', 'mes', 'anio'])
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Rango [desde, hasta] de los atajos de fecha, calculado sobre el día de hoy.
function rangoAtajo(op) {
  const h = new Date(); h.setHours(0, 0, 0, 0)
  if (op === 'hoy') return [iso(h), iso(h)]
  if (op === 'ayer') { const a = new Date(h); a.setDate(a.getDate() - 1); return [iso(a), iso(a)] }
  if (op === 'semana') {
    const d = new Date(h); const dow = (d.getDay() + 6) % 7   // lunes = 0
    const lun = new Date(d); lun.setDate(d.getDate() - dow)
    const dom = new Date(lun); dom.setDate(lun.getDate() + 6)
    return [iso(lun), iso(dom)]
  }
  if (op === 'mes') return [iso(new Date(h.getFullYear(), h.getMonth(), 1)), iso(new Date(h.getFullYear(), h.getMonth() + 1, 0))]
  if (op === 'anio') return [iso(new Date(h.getFullYear(), 0, 1)), iso(new Date(h.getFullYear(), 11, 31))]
  return [null, null]
}

const condPuesta = (c) => !!(c && c.op && (SIN_VALOR.has(c.op) || (c.v1 !== '' && c.v1 != null)))

export function filtroActivo(s) {
  if (!s) return false
  return Array.isArray(s.sel) || condPuesta(s.c1) || condPuesta(s.c2)
    || (!!s.rango && (s.rango.min != null || s.rango.max != null))   // rango de Monto (con signo)
}

// Evalúa UNA condición. valores = los del movimiento (para monto incluye sus líneas).
function cumple(col, cond, m, valores) {
  if (!condPuesta(cond)) return null
  const { op, v1, v2 } = cond

  if (col.tipo === 'num') {
    const a = Number(v1), b = Number(v2)
    return valores.some(v => {
      if (op === '>') return v > a
      if (op === '<') return v < a
      if (op === '>=') return v >= a
      if (op === '<=') return v <= a
      if (op === 'entre') return !isNaN(b) ? (v >= Math.min(a, b) && v <= Math.max(a, b)) : v >= a
      return Math.round(v) === Math.round(a)
    })
  }

  if (col.tipo === 'fecha') {
    const f = String(m.fecha || '').slice(0, 10)
    if (SIN_VALOR.has(op)) { const [d, h] = rangoAtajo(op); return f >= d && f <= h }
    if (op === 'desde') return f >= v1
    if (op === 'hasta') return f <= v1
    if (op === 'entre') return v2 ? (f >= v1 && f <= v2) : f >= v1
    return true
  }

  const val = String(valores[0] ?? '').toLowerCase()
  const t = String(v1).toLowerCase()
  if (op === 'contiene') return val.includes(t)
  if (op === 'nocontiene') return !val.includes(t)
  if (op === 'empieza') return val.startsWith(t)
  if (op === 'termina') return val.endsWith(t)
  if (op === 'igual') return val === t
  if (op === 'distinto') return val !== t
  return true
}

function HeaderFilter({ col, movs, state, setState, open, setOpen, orden, setOrden, limpiarTodo, hayAlguno }) {
  const activo = filtroActivo(state)
  const abierto = open === col.key

  const valores = useMemo(() => {
    const s = new Set()
    for (const m of movs) s.add(col.fkey(m))
    const arr = Array.from(s)
    if (col.tipo === 'num') arr.sort((a, b) => (Number(a) || 0) - (Number(b) || 0))
    else arr.sort((a, b) => String(a).localeCompare(String(b)))
    return arr
  }, [movs, col])

  const vacio = { op: '', v1: '', v2: '' }
  const [draft, setDraft] = useState(null)
  const [base, setBase] = useState(null)
  const [busca, setBusca] = useState('')
  const [anadir, setAnadir] = useState(false)
  const [c1, setC1] = useState(vacio)
  const [c2, setC2] = useState(vacio)
  const [conector, setConector] = useState('Y')
  const [verCond, setVerCond] = useState(false)
  const [abiertos, setAbiertos] = useState({})
  const [rMin, setRMin] = useState('')   // rango de Monto (con signo): desde
  const [rMax, setRMax] = useState('')   // rango de Monto (con signo): hasta
  const yaFiltrado = Array.isArray(state?.sel)

  useEffect(() => {
    if (!abierto) return
    const inicial = new Set(Array.isArray(state?.sel) ? state.sel : valores)
    setDraft(inicial); setBase(inicial); setAnadir(false); setBusca('')
    setC1(state?.c1 || vacio); setC2(state?.c2 || vacio); setConector(state?.conector || 'Y')
    setVerCond(condPuesta(state?.c1) || condPuesta(state?.c2))
    setRMin(state?.rango?.min != null ? String(state.rango.min) : '')
    setRMax(state?.rango?.max != null ? String(state.rango.max) : '')
  }, [abierto]) // eslint-disable-line

  const coincide = (k, t) => String(col.flabel(k)).toLowerCase().includes(t)
  const visibles = useMemo(() => {
    if (!busca) return valores
    const t = busca.toLowerCase()
    return valores.filter(k => coincide(k, t))
  }, [valores, busca, col]) // eslint-disable-line

  // Como Excel: al buscar quedan marcados solo los resultados (o se suman a lo ya filtrado).
  const recalcular = (t, sumar) => {
    if (!t) { setDraft(new Set(base || valores)); return }
    const tl = t.toLowerCase()
    const enc = valores.filter(k => coincide(k, tl))
    setDraft(sumar ? new Set([...(base || []), ...enc]) : new Set(enc))
  }
  const cambiarBusca = (t) => { setBusca(t); recalcular(t, anadir) }
  const cambiarAnadir = (v) => { setAnadir(v); recalcular(busca, v) }

  const marcadas = draft || new Set()
  const todasVisibles = visibles.length > 0 && visibles.every(k => marcadas.has(k))
  const algunaVisible = visibles.some(k => marcadas.has(k))
  const alternar = (k) => { const n = new Set(marcadas); n.has(k) ? n.delete(k) : n.add(k); setDraft(n) }
  const alternarVarias = (ks, poner) => { const n = new Set(marcadas); for (const k of ks) poner ? n.add(k) : n.delete(k); setDraft(n) }

  const arbol = useMemo(() => {
    if (col.tipo !== 'fecha') return null
    const t = {}
    for (const k of visibles) {
      if (!k) continue
      const [y, mm] = k.split('-')
      t[y] = t[y] || {}; t[y][mm] = t[y][mm] || []; t[y][mm].push(k)
    }
    return t
  }, [visibles, col])

  const aceptar = () => {
    const todas = valores.length > 0 && valores.every(k => marcadas.has(k))
    const nuevo = {}
    if (!todas) nuevo.sel = Array.from(marcadas)
    if (verCond && condPuesta(c1)) nuevo.c1 = c1
    if (verCond && condPuesta(c2)) { nuevo.c2 = c2; nuevo.conector = conector }
    setState(Object.keys(nuevo).length ? nuevo : null)
    setOpen(null)
  }

  // Monto: filtro por RANGO con signo (Desde/Hasta). Deja un lado vacío para acotar solo por arriba o por abajo.
  const numRango = (s) => { const t = String(s ?? '').trim(); if (t === '') return null; const n = Number(t.replace(',', '.')); return isNaN(n) ? null : n }
  const aceptarMonto = () => {
    const min = numRango(rMin), max = numRango(rMax)
    setState((min == null && max == null) ? null : { rango: { min, max } })
    setOpen(null)
  }

  const campo = { width: '100%', fontSize: 12, padding: '5px 8px', borderRadius: 6, border: '0.5px solid #D3D1C7', boxSizing: 'border-box' }
  const itemMenu = { display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, padding: '6px 4px', color: '#2C2C2A', fontFamily: 'inherit' }
  const casilla = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '2px 0', cursor: 'pointer' }
  const tipoTxt = col.tipo === 'num' ? 'número' : col.tipo === 'fecha' ? 'fecha' : 'texto'

  const editorCond = (c, setC) => (
    <>
      <select value={c.op} onChange={e => setC({ ...c, op: e.target.value, v1: '', v2: '' })} style={{ ...campo, marginBottom: 5 }}>
        <option value="">— sin condición —</option>
        {OPERADORES[col.tipo].map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
      {c.op && !SIN_VALOR.has(c.op) && (
        <input type={col.tipo === 'fecha' ? 'date' : col.tipo === 'num' ? 'number' : 'text'}
          value={c.v1} onChange={e => setC({ ...c, v1: e.target.value })} placeholder="valor" style={{ ...campo, marginBottom: 5 }} />
      )}
      {c.op === 'entre' && (
        <input type={col.tipo === 'fecha' ? 'date' : 'number'}
          value={c.v2} onChange={e => setC({ ...c, v2: e.target.value })} placeholder="y" style={{ ...campo, marginBottom: 5 }} />
      )}
    </>
  )

  return (
    <span style={{ position: 'relative', marginLeft: 4 }}>
      <button onClick={(e) => { e.stopPropagation(); setOpen(abierto ? null : col.key) }}
        title={activo ? 'Filtro aplicado' : 'Filtrar'}
        style={{ border: 'none', background: activo ? '#1D9E75' : 'transparent', borderRadius: 4, cursor: 'pointer', color: activo ? '#fff' : '#B4B2A9', fontSize: 11, padding: activo ? '0 3px' : 0 }}>▼</button>
      {abierto && (
        <>
          <div onClick={() => setOpen(null)} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 18, left: 0, zIndex: 31, background: '#fff', border: '0.5px solid #D3D1C7', borderRadius: 8, boxShadow: '0 8px 26px rgba(0,0,0,0.16)', width: 272, textAlign: 'left', fontWeight: 400, overflow: 'hidden' }}>
            {col.key === 'monto' ? (
              <>
                <div style={{ padding: '10px 10px 4px' }}>
                  <div style={{ fontSize: 11, color: '#888780', fontWeight: 700, marginBottom: 4 }}>Filtrar por importe (con signo)</div>
                  <div style={{ fontSize: 10.5, color: '#B4B2A9', marginBottom: 8 }}>Cargos negativos, abonos positivos. Deja un campo vacío para acotar solo por un lado. Enter aplica.</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <label style={{ flex: 1, fontSize: 11, color: '#6B7280' }}>Desde
                      <input type="number" value={rMin} onChange={e => setRMin(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') aceptarMonto() }} placeholder="mín" style={{ ...campo, marginTop: 3, textAlign: 'right' }} />
                    </label>
                    <label style={{ flex: 1, fontSize: 11, color: '#6B7280' }}>Hasta
                      <input type="number" value={rMax} onChange={e => setRMax(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') aceptarMonto() }} placeholder="máx" style={{ ...campo, marginTop: 3, textAlign: 'right' }} />
                    </label>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, padding: 8, borderTop: '0.5px solid #ECEAE3', background: '#FAFAF7' }}>
                  <button onClick={aceptarMonto} style={{ flex: 1, fontSize: 12, padding: 6, borderRadius: 6, border: 'none', background: '#1D9E75', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Aplicar</button>
                  <button onClick={() => { setState(null); setOpen(null) }} style={{ flex: 1, fontSize: 12, padding: 6, borderRadius: 6, border: '0.5px solid #D3D1C7', background: '#fff', cursor: 'pointer' }}>Limpiar</button>
                </div>
              </>
            ) : (
              <>

            <div style={{ padding: '6px 8px', borderBottom: '0.5px solid #ECEAE3' }}>
              <button style={itemMenu} onClick={() => { setOrden({ key: col.key, dir: 'asc' }); setOpen(null) }}>↑ Orden ascendente</button>
              <button style={itemMenu} onClick={() => { setOrden({ key: col.key, dir: 'desc' }); setOpen(null) }}>↓ Orden descendente</button>
              {orden?.key && <button style={{ ...itemMenu, color: '#888780' }} onClick={() => { setOrden(null); setOpen(null) }}>↔ Quitar orden</button>}
            </div>

            <div style={{ padding: '6px 8px', borderBottom: '0.5px solid #ECEAE3' }}>
              <button style={{ ...itemMenu, color: activo ? '#0C447C' : '#B4B2A9', cursor: activo ? 'pointer' : 'default' }}
                disabled={!activo} onClick={() => { setState(null); setOpen(null) }}>⌫ Borrar filtro de «{col.label}»</button>
              <button style={{ ...itemMenu, color: hayAlguno ? '#B23A3A' : '#B4B2A9', cursor: hayAlguno ? 'pointer' : 'default' }}
                disabled={!hayAlguno} onClick={() => { limpiarTodo(); setOpen(null) }}>⌦ Quitar todos los filtros</button>
              <button style={itemMenu} onClick={() => setVerCond(v => !v)}>{verCond ? '▾' : '▸'} Filtros de {tipoTxt}</button>
              {verCond && (
                <div style={{ padding: '4px 2px 2px' }}>
                  {editorCond(c1, setC1)}
                  {condPuesta(c1) && (
                    <>
                      <div style={{ display: 'flex', gap: 10, fontSize: 11, margin: '2px 0 6px' }}>
                        {['Y', 'O'].map(k => (
                          <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                            <input type="radio" checked={conector === k} onChange={() => setConector(k)} />{k}
                          </label>
                        ))}
                      </div>
                      {editorCond(c2, setC2)}
                    </>
                  )}
                  {col.key === 'monto' && <div style={{ fontSize: 10, color: '#B4B2A9' }}>Sin signo. Busca también en las líneas de clasificación.</div>}
                </div>
              )}
            </div>

            <div style={{ padding: '8px 8px 6px' }}>
              <input value={busca} onChange={e => cambiarBusca(e.target.value)} placeholder="Buscar…" autoFocus style={{ ...campo, marginBottom: 6 }} />
              <label style={{ ...casilla, fontWeight: 600 }}>
                <input type="checkbox" checked={todasVisibles}
                  ref={el => { if (el) el.indeterminate = !todasVisibles && algunaVisible }}
                  onChange={() => alternarVarias(visibles, !todasVisibles)} />
                <span>{busca ? '(Seleccionar los resultados)' : '(Seleccionar todo)'}</span>
              </label>
              {yaFiltrado && busca && (
                <label style={{ ...casilla, color: '#0C447C' }}>
                  <input type="checkbox" checked={anadir} onChange={e => cambiarAnadir(e.target.checked)} />
                  <span>Añadir la selección actual al filtro</span>
                </label>
              )}
              <div style={{ borderBottom: '0.5px solid #ECEAE3', margin: '5px 0 3px' }} />

              <div style={{ maxHeight: 210, overflowY: 'auto' }}>
                {visibles.length === 0 && <div style={{ fontSize: 12, color: '#B4B2A9', padding: '8px 0' }}>Sin resultados</div>}
                {col.tipo === 'fecha' && arbol ? (
                  Object.keys(arbol).sort().map(anio => {
                    const meses = arbol[anio]
                    const todasA = Object.values(meses).flat()
                    const marcA = todasA.every(k => marcadas.has(k))
                    return (
                      <div key={anio}>
                        <label style={casilla}>
                          <span onClick={e => { e.preventDefault(); setAbiertos(a => ({ ...a, [anio]: !a[anio] })) }} style={{ width: 12, cursor: 'pointer', color: '#888780' }}>{abiertos[anio] ? '−' : '+'}</span>
                          <input type="checkbox" checked={marcA}
                            ref={el => { if (el) el.indeterminate = !marcA && todasA.some(k => marcadas.has(k)) }}
                            onChange={() => alternarVarias(todasA, !marcA)} />
                          <span>{anio}</span>
                        </label>
                        {abiertos[anio] && Object.keys(meses).sort().map(mm => {
                          const dias = meses[mm]; const marcM = dias.every(k => marcadas.has(k)); const cm = anio + '-' + mm
                          return (
                            <div key={mm} style={{ paddingLeft: 16 }}>
                              <label style={casilla}>
                                <span onClick={e => { e.preventDefault(); setAbiertos(a => ({ ...a, [cm]: !a[cm] })) }} style={{ width: 12, cursor: 'pointer', color: '#888780' }}>{abiertos[cm] ? '−' : '+'}</span>
                                <input type="checkbox" checked={marcM}
                                  ref={el => { if (el) el.indeterminate = !marcM && dias.some(k => marcadas.has(k)) }}
                                  onChange={() => alternarVarias(dias, !marcM)} />
                                <span>{MESES_NOM[Number(mm) - 1] || mm}</span>
                              </label>
                              {abiertos[cm] && dias.slice().sort().map(k => (
                                <label key={k} style={{ ...casilla, paddingLeft: 28 }}>
                                  <input type="checkbox" checked={marcadas.has(k)} onChange={() => alternar(k)} />
                                  <span>{k.slice(8, 10)}</span>
                                </label>
                              ))}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })
                ) : (
                  visibles.map(k => (
                    <label key={k} style={casilla}>
                      <input type="checkbox" checked={marcadas.has(k)} onChange={() => alternar(k)} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{col.flabel(k)}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, padding: 8, borderTop: '0.5px solid #ECEAE3', background: '#FAFAF7' }}>
              <button onClick={aceptar} disabled={marcadas.size === 0}
                style={{ flex: 1, fontSize: 12, padding: 6, borderRadius: 6, border: 'none', background: marcadas.size === 0 ? '#C9C7BF' : '#1D9E75', color: '#fff', fontWeight: 600, cursor: marcadas.size === 0 ? 'default' : 'pointer' }}>
                Aceptar{marcadas.size && marcadas.size < valores.length ? ` (${marcadas.size})` : ''}
              </button>
              <button onClick={() => setOpen(null)} style={{ flex: 1, fontSize: 12, padding: 6, borderRadius: 6, border: '0.5px solid #D3D1C7', background: '#fff', cursor: 'pointer' }}>Cancelar</button>
            </div>
              </>
            )}
          </div>
        </>
      )}
    </span>
  )
}
export default function SaPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isMobile, setIsMobile] = useState(false)

  const [modo, setModo] = useState('continua')
  const [cargas, setCargas] = useState([])
  const [cargaId, setCargaId] = useState(null)
  const [movs, setMovs] = useState([])
  const [lineasByMov, setLineasByMov] = useState({})
  const [plan, setPlan] = useState([])
  // Registro de Compras, para sugerir en Cuenta 2 la cuenta del pago a proveedor.
  // null = aun no cargado; se pide la 1a vez que se abre un movimiento y se cachea.
  const [compras, setCompras] = useState(null)
  const [cargandoCompras, setCargandoCompras] = useState(false)
  const [glosa, setGlosa] = useState('')
  const [loading, setLoading] = useState(false)

  const [filters, setFilters] = useState({})   // { colKey: {text, sel[]} }
  const [openFilter, setOpenFilter] = useState(null)
  const [orden, setOrden] = useState(null)      // { key, dir } — ordenación tipo Excel
  const [verCCB, setVerCCB] = useState(false)
  const [copiado, setCopiado] = useState(false)

  const [sel, setSel] = useState(null)
  const [colorMenu, setColorMenu] = useState(null)   // { id, x, y } popover de color
  const [lineas, setLineas] = useState([])
  const [savedFlag, setSavedFlag] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDesc, setConfirmDesc] = useState(false)
  const [checkSel, setCheckSel] = useState(null)     // movimiento en revisión (modal CHECK)
  const [checkDraft, setCheckDraft] = useState(null) // { estado, observacion, acciones, mejoras }
  const [savingCheck, setSavingCheck] = useState(false)

  const canEdit = EDITORES.includes(session?.user?.email)

  // Abre el cajón de revisión CHECK con lo que ya hubiera guardado el movimiento.
  function abrirCheck(m) {
    setCheckSel(m)
    setCheckDraft({
      estado: (m.check_estado === 'SI' || m.check_estado === 'NO') ? m.check_estado : null,
      observacion: m.check_observacion || '',
      acciones: m.check_acciones || '',
      mejoras: m.check_mejoras || '',
    })
  }

  // Guarda la revisión: SI/NO + 3 comentarios. El servidor sella email de quien revisa y fecha.
  async function guardarCheck() {
    if (!checkSel || !checkDraft) return
    setSavingCheck(true)
    try {
      const res = await fetch('/api/financiero/sa', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movimiento_id: checkSel.id, check: checkDraft }),
      })
      const d = await res.json()
      if (!res.ok) { alert(d.error || 'No se pudo guardar la revisión.'); return }
      setMovs(ms => ms.map(x => x.id === checkSel.id ? {
        ...x,
        check_estado: d.check_estado ?? null,
        check_observacion: d.check_observacion ?? null,
        check_acciones: d.check_acciones ?? null,
        check_mejoras: d.check_mejoras ?? null,
        check_revisado_por: d.check_revisado_por ?? null,
        check_fecha: d.check_fecha ?? null,
      } : x))
      setCheckSel(null); setCheckDraft(null)
    } catch (e) { alert(String(e?.message || e)) }
    finally { setSavingCheck(false) }
  }
const wantScroll = useRef(false)
  const [topTabla, setTopTabla] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState(null); const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef(null); const handleFileRef = useRef(null)


  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check(); window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  useEffect(() => { if (status === 'unauthenticated') router.push('/api/auth/signin') }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/financiero/sa').then(r => r.json()).then(d => {
      const list = d.cargas || []
      setCargas(list)
      if (list.length && cargaId == null) setCargaId(list[0].id)
    }).catch(() => {})
  }, [status]) // eslint-disable-line

  const cargar = () => {
    const url = modo === 'continua' ? '/api/financiero/sa?todas=1' : (cargaId ? `/api/financiero/sa?carga=${cargaId}` : null)
    if (!url) return
    const y = typeof window !== 'undefined' ? window.scrollY : 0
    setLoading(true)
    fetch(url).then(r => r.json()).then(d => {
      const marcas = {}
      for (const k of (d.marcas || [])) marcas[k.movimiento_id] = k
      const map = {}
      for (const l of (d.lineas || [])) { (map[l.movimiento_id] = map[l.movimiento_id] || []).push(l) }
      setLineasByMov(map)
      // __ccb y __cta resumen las lineas para poder verlas y filtrarlas en la lista.
      setMovs((d.movimientos || []).map(m => ({
        ...m, ...(marcas[m.id] || {}),
        __ccb: resumeLineas(map[m.id], 'ccb', false).txt,
        __cta: resumeLineas(map[m.id], 'cuenta_1', true).txt,
      })))
      setPlan(d.plan || [])
      if (wantScroll.current) { wantScroll.current = false; setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' }), 90) }
      else if (y > 0) { setTimeout(() => window.scrollTo({ top: y, behavior: 'auto' }), 60) }
    }).finally(() => setLoading(false))
  }
  useEffect(() => {
    if (status === 'authenticated' && (modo === 'continua' || cargaId)) { wantScroll.current = true; cargar() }
  }, [modo, cargaId, status]) // eslint-disable-line

  // Compras: se cargan una sola vez, la primera vez que se abre un movimiento.
  // Reutiliza el endpoint de la pantalla de Compras (mismo dato, sin backend nuevo).
  useEffect(() => {
    if (!sel || compras !== null || cargandoCompras) return
    setCargandoCompras(true)
    fetch('/api/financiero/compras?todas=1')
      .then(r => r.json())
      .then(d => setCompras(Array.isArray(d.compras) ? d.compras : []))
      .catch(() => setCompras([]))
      .finally(() => setCargandoCompras(false))
  }, [sel, compras, cargandoCompras])

  const resumen = useMemo(() => {
    const r = { n: movs.length, cuad: 0, sin: 0, desc: 0, cargos: 0, abonos: 0 }
    for (const m of movs) {
      if (m.estado_clasificacion === 'CUADRADO') r.cuad++
      else if (m.estado_clasificacion === 'DESCUADRADO') r.desc++
      else r.sin++
      if (m.monto < 0) r.cargos += m.monto; else r.abonos += m.monto
    }
    return r
  }, [movs])

  // Texto buscable de las líneas de cada movimiento (CCB + cuentas + concepto).
  const textoLineas = useMemo(() => {
    const map = {}
    for (const id of Object.keys(lineasByMov)) {
      map[id] = (lineasByMov[id] || [])
        .map(l => [l.ccb, l.cuenta_1, l.cuenta_2, l.concepto].filter(Boolean).join(' '))
        .join(' ').toLowerCase()
    }
    return map
  }, [lineasByMov])

  const hayFiltro = useMemo(() => COLDEFS.some(c => filtroActivo(filters[c.key])), [filters])
  const limpiarTodo = () => { setFilters({}); setOrden(null) }

  const montosLineas = useMemo(() => {
    const map = {}
    for (const id of Object.keys(lineasByMov)) {
      map[id] = (lineasByMov[id] || []).map(l => Math.abs(Number(l.monto) || 0))
    }
    return map
  }, [lineasByMov])

  const movsFiltrados = useMemo(() => {
    // Valores que se comparan en cada columna. En Monto se añaden los de las líneas de
    // clasificación; en Descripción, su texto. Así el filtro ve el movimiento completo.
    const valoresDe = (c, m) => {
      if (c.tipo === 'num') return [Math.abs(Number(m[c.key]) || 0), ...(c.key === 'monto' ? (montosLineas[m.id] || []) : [])]
      if (c.key === 'descripcion') return [String(c.get(m) ?? '') + ' ' + (textoLineas[m.id] || '')]
      return [String(c.get(m) ?? '')]
    }

    const out = movs.filter(m => {
      for (const c of COLDEFS) {
        const f = filters[c.key]
        if (!filtroActivo(f)) continue
        if (f.rango) {   // Monto: rango CON SIGNO sobre el monto del movimiento
          const v = Number(m.monto) || 0
          if (f.rango.min != null && v < f.rango.min) return false
          if (f.rango.max != null && v > f.rango.max) return false
        }
        if (Array.isArray(f.sel) && !f.sel.includes(c.fkey(m))) return false

        const vals = valoresDe(c, m)
        const r1 = cumple(c, f.c1, m, vals)
        const r2 = cumple(c, f.c2, m, vals)
        if (r1 !== null && r2 !== null) { if (f.conector === 'O' ? !(r1 || r2) : !(r1 && r2)) return false }
        else if (r1 !== null && !r1) return false
        else if (r2 !== null && !r2) return false
      }
      return true
    })

    if (orden?.key) {
      const c = COLDEFS.find(x => x.key === orden.key)
      if (c) {
        const signo = orden.dir === 'desc' ? -1 : 1
        out.sort((a, b) => {
          const va = c.fkey(a), vb = c.fkey(b)
          if (c.tipo === 'num') return signo * ((Number(va) || 0) - (Number(vb) || 0))
          return signo * String(va).localeCompare(String(vb))
        })
      }
    }
    return out
  }, [movs, filters, textoLineas, montosLineas, orden])

  // Resumen por Centro de Coste/Beneficio de lo que se está viendo.
  const resumenCCB = useMemo(() => {
    const acc = {}
    for (const m of movsFiltrados) {
      for (const l of (lineasByMov[m.id] || [])) {
        const k = (l.ccb || '(sin CCB)').trim() || '(sin CCB)'
        const v = Math.abs(Number(l.monto) || 0)
        acc[k] = acc[k] || { ccb: k, cargos: 0, abonos: 0, n: 0 }
        if (m.monto < 0) acc[k].cargos += v; else acc[k].abonos += v
        acc[k].n++
      }
    }
    return Object.values(acc)
      .map(r => ({ ...r, neto: r.abonos - r.cargos }))
      .sort((a, b) => a.ccb.localeCompare(b.ccb))
  }, [movsFiltrados, lineasByMov])

  // El texto que pide Karina: COBROS CC1, CC2 Y CC3 ENERO 2026 (11.731.510) CC1 … CC2 … CC3 …
  const conceptoUnico = useMemo(() => {
    const conCobro = resumenCCB.filter(r => r.abonos > 0)
    if (!conCobro.length) return ''
    const fechas = movsFiltrados.map(m => String(m.fecha || '').slice(0, 7)).filter(Boolean)
    const meses = Array.from(new Set(fechas)).sort()
    let periodo = ''
    if (meses.length === 1) {
      const [y, mm] = meses[0].split('-')
      periodo = ` ${MES_LARGO[Number(mm) - 1]} ${y}`
    } else if (meses.length > 1) {
      periodo = ` ${meses[0]} a ${meses[meses.length - 1]}`
    }
    const total = conCobro.reduce((a, r) => a + r.abonos, 0)
    const detalle = conCobro.map(r => `${r.ccb} ${clp(r.abonos)}`).join(', ')
    return `COBROS ${conCobro.map(r => r.ccb).join(', ')}${periodo} (${clp(total)}) ${detalle}`
  }, [resumenCCB, movsFiltrados])

  const copiarConcepto = () => {
    if (!conceptoUnico) return
    navigator.clipboard?.writeText(conceptoUnico)
      .then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1800) })
      .catch(() => {})
  }

  // Exporta a Excel exactamente lo que se está viendo, con sus líneas debajo de cada movimiento.
  const exportar = async () => {
    const XLSX = await import('xlsx')
    const filas = []
    for (const m of movsFiltrados) {
      filas.push({
        Folio: folioVisible(m) ?? '', Fecha: fmtFecha(m.fecha), Tipo: 'MOVIMIENTO',
        Descripcion: m.descripcion || '', CCB: '', Cuenta_1: '', Cuenta_2: '',
        Monto: m.monto, 'C/A': m.cargo_abono || '', Estado: m.estado_clasificacion || '',
      })
      for (const l of (lineasByMov[m.id] || [])) {
        filas.push({
          Folio: subFolio(folioVisible(m), l.sub_orden), Fecha: '', Tipo: 'LINEA',
          Descripcion: l.concepto || '', CCB: l.ccb || '', Cuenta_1: l.cuenta_1 || '',
          Cuenta_2: l.cuenta_2 || '', Monto: Math.abs(Number(l.monto) || 0), 'C/A': '', Estado: '',
        })
      }
    }
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), 'Movimientos')
    if (resumenCCB.length) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
        resumenCCB.map(r => ({ CCB: r.ccb, Lineas: r.n, Cargos: r.cargos, Abonos: r.abonos, Neto: r.neto }))
      ), 'Resumen CCB')
    }
    const sello = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `SA-filtrado-${sello}.xlsx`)
  }

  const totalFiltro = useMemo(() => {
    let cargos = 0, abonos = 0
    for (const m of movsFiltrados) { if (m.monto < 0) cargos += m.monto; else abonos += m.monto }
    return { n: movsFiltrados.length, cargos, abonos, neto: cargos + abonos }
  }, [movsFiltrados])

  const apertura = useMemo(() => {
    if (modo === 'cartola') {
      const c = cargas.find(x => x.id === cargaId)
      return c && c.saldo_inicial != null ? { saldo: c.saldo_inicial, label: `Apertura cartola ${c.nro_cartola}` } : null
    }
    if (!cargas.length) return null
    const first = [...cargas].sort((a, b) => a.nro_cartola - b.nro_cartola)[0]
    return first && first.saldo_inicial != null ? { saldo: first.saldo_inicial, label: 'Apertura 2026' } : null
  }, [cargas, cargaId, modo])

  const planMap = useMemo(() => {
    const m = {}
    for (const c of plan) m[c.codigo] = c.descripcion
    return m
  }, [plan])

  // "4201-41" -> "4201-41 · TELEFONO E INTERNET". Si la cuenta no esta en el plan se
  // dice, que suele significar que esta mal escrita (paso con 1103-01 por 1101-03).
  const describeCuenta = (v) => {
    const t = String(v || '').trim()
    if (!t) return undefined
    const cod = (t.match(/^[0-9]{4}-[0-9]{2}(-[0-9]{2})?/) || [''])[0]
    if (!cod) return t
    const d = planMap[cod] || planMap[cod.slice(0, 7)]
    return d ? `${cod} · ${d}` : `${cod} · (no está en el plan de cuentas)`
  }

  // Para la celda resumen: si el movimiento tiene varias cuentas, se listan todas.
  const describeVarias = (ls) => {
    const vs = []
    for (const l of (ls || [])) {
      const d = describeCuenta(l.cuenta_1)
      if (d && !vs.includes(d)) vs.push(d)
    }
    return vs.length ? vs.join('\n') : undefined
  }

  // Memoria por patron de descripcion. Un apunte de banco no tiene RUT, asi que la
  // clave es la descripcion normalizada. Guarda dos cosas distintas:
  //   cuenta unica  -> para sugerir una cuenta en una linea suelta
  //   desglose      -> el ultimo reparto de varias lineas del mismo patron
  const memoria = useMemo(() => {
    const acc = {}
    for (const m of movs) {
      const pat = patronDe(m.descripcion)
      if (!pat || PATRON_MUDO.test(pat)) continue
      const ls = (lineasByMov[m.id] || []).filter(l => (l.cuenta_1 || '').trim())
      if (!ls.length) continue
      const e = acc[pat] || (acc[pat] = { ctas: {}, desglose: null, fecha: null, n: 0 })
      for (const l of ls) {
        const c = String(l.cuenta_1).trim()
        e.ctas[c] = (e.ctas[c] || 0) + 1
        e.n++
      }
      // el desglose mas reciente con mas de una linea
      if (ls.length > 1 && (!e.fecha || String(m.fecha) > String(e.fecha))) {
        e.fecha = m.fecha
        e.desglose = ls.map(l => ({ ccb: l.ccb || '', cuenta_1: l.cuenta_1 || '', cuenta_2: l.cuenta_2 || '', concepto: l.concepto || '', comentario: l.comentario || '', monto: l.monto }))
      }
    }
    for (const k of Object.keys(acc)) {
      const e = acc[k]
      const pares = Object.entries(e.ctas).sort((a, b) => b[1] - a[1])
      e.unica = pares.length === 1 && e.n >= 2 ? pares[0][0] : null
    }
    return acc
  }, [movs, lineasByMov])

  const memoSel = sel ? memoria[patronDe(sel.descripcion)] : null
  const copiarDesglose = () => {
    if (!memoSel?.desglose) return
    setLineas(memoSel.desglose.map((d, i) => ({ ...d, sub_orden: i + 1, monto: String(d.monto ?? '') })))
  }

  // ── Sugerencia de Cuenta 2 desde el Registro de Compras ─────────────────────
  // Un pago a proveedor sale del banco por el mismo importe que su factura y en
  // fechas cercanas. Se busca la compra que CUADRA por importe exacto dentro de una
  // ventana de ±20 dias del movimiento y se ofrece la cuenta que ya se le imputo.
  const codDe = (v) => (String(v || '').trim().match(/^[0-9]{4}-[0-9]{2}(-[0-9]{2})?/) || [''])[0]
  const DIA_MS = 86400000
  // Compras dentro de la ventana de fechas del movimiento abierto, con cuenta puesta
  // y que sean de FCR (se descartan las RECHAZADAS).
  const comprasCerca = useMemo(() => {
    if (!sel || !Array.isArray(compras) || !sel.fecha) return []
    if (Number(sel.monto) >= 0) return []   // solo pagos (cargos): una compra se paga, no se cobra
    const fMov = new Date(String(sel.fecha).slice(0, 10)).getTime()
    if (isNaN(fMov)) return []
    return compras.filter(c => {
      if (!c.fecha || !codDe(c.cuenta)) return false
      if (String(c.estado || '').toUpperCase() === 'RECHAZADA') return false
      const fc = new Date(String(c.fecha).slice(0, 10)).getTime()
      if (isNaN(fc)) return false
      return Math.abs(fc - fMov) / DIA_MS <= 20
    })
  }, [sel, compras])
  // Compras cuyo TOTAL coincide EXACTO con el importe dado (el de la linea, o el del
  // movimiento si la linea aun no tiene importe). Ordenadas por cercania de fecha.
  const matchCompras = (monto) => {
    const v = Math.abs(Math.round(Number(monto) || 0))
    if (!v || !comprasCerca.length) return []
    const fMov = sel ? new Date(String(sel.fecha).slice(0, 10)).getTime() : 0
    return comprasCerca
      .filter(c => Math.abs(Math.round(Number(c.total) || 0)) === v)
      .sort((a, b) => Math.abs(new Date(a.fecha).getTime() - fMov) - Math.abs(new Date(b.fecha).getTime() - fMov))
  }

  // Pago que cuadra con una factura de Compras -> cancela al proveedor: Cuenta 1 = 2105-05.
  // Se rellena sola en las lineas vacias (solo cargos) cuando ya estan cargadas las compras.
  // No pisa lo escrito a mano y no se vuelve a meter si la persona la borra (depende de
  // sel.id y compras, no de las lineas).
  useEffect(() => {
    if (!sel || Number(sel.monto) >= 0 || !Array.isArray(compras)) return
    setLineas(ls => {
      let cambio = false
      const next = ls.map(l => {
        if ((l.cuenta_1 || '').trim()) return l
        const val = Math.abs(Number(l.monto) || 0) || Math.abs(Number(sel.monto) || 0)
        if (matchCompras(val).length) { cambio = true; return { ...l, cuenta_1: CTA_PROVEEDORES } }
        return l
      })
      return cambio ? next : ls
    })
  }, [sel?.id, compras]) // eslint-disable-line

  const abrir = (m) => { setSel(m); setGlosa(m.glosa || ''); setSavedFlag(false); setConfirmDesc(false); setLineas((lineasByMov[m.id] || []).map(l => ({ ...l }))) }
  // Guarda el color de fondo (marca) de un movimiento. Optimista; si falla, recarga.
  const ponerColor = async (id, color) => {
    setColorMenu(null)
    setMovs(prev => prev.map(m => m.id === id ? { ...m, color_fondo: color } : m))
    try {
      const res = await fetch('/api/financiero/sa', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ movimiento_id: id, color_fondo: color }) })
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || 'No se pudo guardar el color'); cargar() }
    } catch { cargar() }
  }
  const cerrar = () => { setSel(null); setLineas([]); setConfirmDesc(false) }
  const setLinea = (i, campo, val) => setLineas(ls => ls.map((l, k) => k === i ? { ...l, [campo]: val } : l))
  const addLinea = () => setLineas(ls => [...ls, { sub_orden: ls.length + 1, monto: '', ccb: '', cuenta_1: '', cuenta_2: '', concepto: '', comentario: '' }])
  const delLinea = (i) => setLineas(ls => ls.filter((_, k) => k !== i))

  const sumaLineas = useMemo(() => lineas.reduce((a, l) => a + Math.abs(Number(l.monto) || 0), 0), [lineas])
  const cuadra = sel ? sumaLineas === Math.abs(Number(sel.monto)) : false
  const diferencia = sel ? Math.abs(Number(sel.monto)) - sumaLineas : 0

  const guardar = async () => {
    if (!sel) return
    if (!cuadra && !confirmDesc) { setConfirmDesc(true); return }
    setSaving(true)
    try {
      const payload = {
        movimiento_id: sel.id,
        glosa,
        lineas: lineas.filter(l => l.monto !== '' && l.monto != null).map((l, i) => ({
          sub_orden: i + 1, monto: Math.abs(Math.round(Number(l.monto))),
          ccb: (l.ccb || '').trim() || null, cuenta_1: (l.cuenta_1 || '').trim() || null,
          cuenta_2: (l.cuenta_2 || '').trim() || null, concepto: (l.concepto || '').trim() || null,
          comentario: (l.comentario || '').trim() || null,
        })),
      }
      const res = await fetch('/api/financiero/sa', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || 'No se pudo guardar'); return }
      setSavedFlag(true); setConfirmDesc(false)

      // Se actualiza SOLO este movimiento. El estado se calcula igual que en
      // vw_sa_movimientos: sin lineas SIN_CLASIFICAR, y si la suma cuadra CUADRADO.
      const nuevas = payload.lineas.map((l, i) => ({ ...l, id: `tmp-${sel.id}-${i}`, movimiento_id: sel.id }))
      const suma = nuevas.reduce((a, l) => a + Math.abs(Number(l.monto) || 0), 0)
      const estado = nuevas.length === 0 ? 'SIN_CLASIFICAR'
        : (suma === Math.abs(Number(sel.monto)) ? 'CUADRADO' : 'DESCUADRADO')
      setLineasByMov(prev => ({ ...prev, [sel.id]: nuevas }))
      setMovs(prev => prev.map(m => m.id === sel.id
        ? { ...m, glosa: (glosa || '').trim() || null, n_lineas: nuevas.length, suma_lineas: suma, estado_clasificacion: estado,
            __ccb: resumeLineas(nuevas, 'ccb', false).txt, __cta: resumeLineas(nuevas, 'cuenta_1', true).txt }
        : m))
      setSel(sv => sv ? { ...sv, glosa: (glosa || '').trim() || null } : sv)
    } finally { setSaving(false) }
  }

  const handleFile = async (file) => {
    if (!file) return
    if (!canEdit) { setUploadMsg({ error: 'No tienes permiso para cargar.' }); return }
    if (!EXT_PLANILLA.test(file.name || '')) {
      setUploadMsg({ error: `«${file.name}» no es una planilla. Sube el extracto del Santander en .xlsx, .xls o .csv. (Si has pegado una imagen sin querer, no pasa nada: no se ha cargado.)` })
      return
    }
    setUploading(true); setUploadMsg(null)
    try {
      const XLSX = await import('xlsx')
      const payload = await parseCartola(file, XLSX)
      // El extracto semanal no trae número de cartola: se deduce del periodo.
      // Si ya existe la cartola de ese mes se recarga sobre ella (conserva folios y clasificación).
      if (!payload.nro_cartola && payload.periodo) {
        const delMes = cargas.find(c => c.periodo === payload.periodo)
        payload.nro_cartola = delMes ? delMes.nro_cartola : (Math.max(0, ...cargas.map(c => Number(c.nro_cartola) || 0)) + 1)
      }
      if (!payload.nro_cartola) { setUploadMsg({ error: 'No pude identificar de qué mes es el archivo (no trae número de cartola ni fechas).' }); return }
      if (payload.meses && payload.meses.length > 1) {
        setUploadMsg({ error: `El archivo mezcla movimientos de ${payload.meses.join(' y ')}. Descarga el extracto dentro de un mismo mes (del día 1 a hoy).` }); return
      }
      if (!payload.movimientos.length) { setUploadMsg({ error: 'No encontré movimientos en el archivo.' }); return }
      const res = await fetch('/api/financiero/sa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const d = await res.json()
      if (!res.ok) { setUploadMsg({ error: d.error || 'No se pudo cargar el extracto.' }); return }
      const tag = d.cartola_nueva ? 'cartola nueva' : 'recarga'
      const cf = (d.conflictos && d.conflictos.length) ? ` · ${d.conflictos.length} línea(s) a revisar: ${d.conflictos.map(c => c.linea).join(', ')}` : ''
      setUploadMsg({ text: `Cartola ${d.nro_cartola} (${tag}): ${d.nuevos} nuevo(s), ${d.existentes} ya estaban, ${d.total} en total${cf}.` })
      fetch('/api/financiero/sa').then(r => r.json()).then(x => setCargas(x.cargas || [])).catch(() => {})
      cargar()
    } catch (err) {
      const bruto = String(err?.message || err)
      const amable = /not a spreadsheet|Unsupported file|zip|Corrupted/i.test(bruto)
        ? 'No he podido leer el archivo como planilla. Comprueba que es el extracto del Santander en .xlsx.'
        : bruto
      setUploadMsg({ error: amable })
    }
    finally { setUploading(false) }
  }
  handleFileRef.current = handleFile
  const onFileInput = (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) handleFile(f) }

  useEffect(() => {
    const over = (e) => { if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) { e.preventDefault(); setDragOver(true) } }
    const leave = (e) => { if (e.clientX <= 0 && e.clientY <= 0) setDragOver(false) }
    const drop = (e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer?.files?.[0]; if (f) handleFileRef.current?.(f) }
    // Solo se reacciona al pegar si es una planilla: pegar una captura no debe intentar cargarla.
    const paste = (e) => { const f = e.clipboardData?.files?.[0]; if (f && EXT_PLANILLA.test(f.name || '')) { e.preventDefault(); handleFileRef.current?.(f) } }
    window.addEventListener('dragover', over); window.addEventListener('dragleave', leave); window.addEventListener('drop', drop); window.addEventListener('paste', paste)
    return () => { window.removeEventListener('dragover', over); window.removeEventListener('dragleave', leave); window.removeEventListener('drop', drop); window.removeEventListener('paste', paste) }
  }, [])

  if (status === 'loading') return (<><TopNav /><div style={{ padding: 60, textAlign: 'center', color: '#888', fontSize: 14 }}>Cargando…</div></>)
  const cargaActual = cargas.find(c => c.id === cargaId)
  const inp = { fontSize: 12, padding: '5px 6px', borderRadius: 5, border: '0.5px solid #D3D1C7', boxSizing: 'border-box', width: '100%' }

  return (
    <>
      <TopNav />
      <FinancieroNav activo="sa" />
      {dragOver && canEdit && (
        <div data-overlay="1" style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(29,158,117,0.10)', border: '3px dashed #1D9E75', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ background: '#fff', padding: '16px 26px', borderRadius: 12, fontSize: 15, fontWeight: 700, color: '#085041', boxShadow: '0 8px 30px rgba(0,0,0,0.15)' }}>⬆ Suelta el archivo para cargar</div>
        </div>
      )}
      <FinancieroHeader
        titulo="SA · Banco Santander"
        subtitulo="Movimientos y clasificación por Centro de Coste/Beneficio"
        onOffset={setTopTabla}
        derecha={<>
          <div style={{ display: 'flex', border: '0.5px solid #D3D1C7', borderRadius: 8, overflow: 'hidden' }}>
            {[['continua', 'Continua'], ['cartola', 'Por cartola']].map(([v, lbl]) => (
              <button key={v} onClick={() => setModo(v)} style={{ fontSize: 12, padding: '6px 11px', border: 'none', cursor: 'pointer', background: modo === v ? '#1D9E75' : '#fff', color: modo === v ? '#fff' : '#2C2C2A', fontWeight: modo === v ? 600 : 400 }}>{lbl}</button>
            ))}
          </div>
          {modo === 'cartola' && (
            <select value={cargaId || ''} onChange={e => setCargaId(Number(e.target.value))} style={{ fontSize: 13, padding: '6px 9px', borderRadius: 8, border: '0.5px solid #D3D1C7', background: '#fff', color: '#2C2C2A' }}>
              {cargas.map(c => <option key={c.id} value={c.id}>Cartola {c.nro_cartola} · {c.periodo}{c.tipo === 'provisoria' ? ' (prov.)' : ''}</option>)}
            </select>
          )}
        </>}
        acciones={<>
          <button onClick={() => fileRef.current?.click()} disabled={!canEdit || uploading} title={canEdit ? 'Subir, arrastrar o pegar el extracto del Santander (provisoria o mensual)' : 'Sin permiso'} style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: 'none', background: (!canEdit || uploading) ? '#B4D8CB' : '#1D9E75', color: '#fff', cursor: (!canEdit || uploading) ? 'default' : 'pointer' }}>⬆ {uploading ? 'Procesando…' : 'Cargar extracto'}</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={onFileInput} style={{ display: 'none' }} />
          {canEdit && <span style={{ fontSize: 11, color: '#B4B2A9' }}>o arrastra / pega el Excel del extracto</span>}
        </>}
        metricas={[
          { label: 'Movim.', valor: resumen.n },
          { label: 'Cuadrados', valor: resumen.cuad, color: '#085041' },
          { label: 'Sin clasif.', valor: resumen.sin, color: '#888780' },
          { label: 'Descuadr.', valor: resumen.desc, color: '#B23A3A' },
          { label: 'Cargos', valor: clp(resumen.cargos), color: '#B23A3A' },
          { label: 'Abonos', valor: clp(resumen.abonos), color: '#085041' },
        ]}
        mensajes={<>
          {uploadMsg && (
            <div style={{ marginBottom: 8, fontSize: 12, padding: '7px 11px', borderRadius: 8, background: uploadMsg.error ? '#FBE9E7' : '#F3FBF8', border: `0.5px solid ${uploadMsg.error ? '#F0C9C2' : '#CDEBDF'}`, color: uploadMsg.error ? '#B23A3A' : '#085041' }}>{uploadMsg.error || uploadMsg.text}</div>
          )}
        </>}
      />

      <div style={{ maxWidth: 1320, margin: 0, padding: isMobile ? '12px 8px 40px' : '14px 12px 48px' }}>

        {/* RESUMEN POR CCB + CONCEPTO ÚNICO */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => setVerCCB(v => !v)}
              style={{ fontSize: 12, padding: '7px 12px', borderRadius: 8, border: '0.5px solid #D3D1C7', background: verCCB ? '#EEF3F8' : '#fff', cursor: 'pointer', color: '#0C447C', fontWeight: 600 }}>
              {verCCB ? '▾' : '▸'} Resumen por CCB {resumenCCB.length ? `(${resumenCCB.length})` : ''}
            </button>
            <button onClick={exportar} disabled={!movsFiltrados.length}
              style={{ fontSize: 12, padding: '7px 12px', borderRadius: 8, border: '0.5px solid #D3D1C7', background: '#fff', cursor: movsFiltrados.length ? 'pointer' : 'default', color: movsFiltrados.length ? '#2C2C2A' : '#B4B2A9' }}>
              ⬇ Exportar lo filtrado a Excel
            </button>
          </div>

          {/* Leyenda de colores: criterio fijo para marcar movimientos */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 14px', marginTop: 10, fontSize: 11.5, color: '#6b6b66' }}>
            <span style={{ fontWeight: 700, color: '#888780' }}>Colores:</span>
            {PALETA_MARCA.map(p => (
              <span key={p.color} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 14, height: 14, borderRadius: 3, background: p.color, border: '0.5px solid #C9C7BF' }} />
                {p.label}
              </span>
            ))}
          </div>

          {verCCB && (
            <div style={{ marginTop: 10, border: '0.5px solid #E0DED6', borderRadius: 10, background: '#fff', overflow: 'hidden' }}>
              {resumenCCB.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: '#888780' }}>
                  No hay líneas clasificadas en lo que estás viendo.
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '110px 90px 1fr 1fr 1fr', background: '#F1EFE9', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: '#888780' }}>
                    <div>CCB</div><div style={{ textAlign: 'right' }}>Líneas</div>
                    <div style={{ textAlign: 'right' }}>Cargos</div>
                    <div style={{ textAlign: 'right' }}>Abonos</div>
                    <div style={{ textAlign: 'right' }}>Neto</div>
                  </div>
                  {resumenCCB.map(r => (
                    <div key={r.ccb} style={{ display: 'grid', gridTemplateColumns: '110px 90px 1fr 1fr 1fr', padding: '7px 12px', fontSize: 12, borderTop: '0.5px solid #F0EFEA', alignItems: 'center' }}>
                      <div style={{ fontWeight: 600, color: '#0C447C' }}>{r.ccb}</div>
                      <div style={{ textAlign: 'right', color: '#888780' }}>{r.n}</div>
                      <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#B23A3A' }}>{clp(r.cargos)}</div>
                      <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#085041' }}>{clp(r.abonos)}</div>
                      <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{clp(r.neto)}</div>
                    </div>
                  ))}
                  {conceptoUnico && (
                    <div style={{ borderTop: '0.5px solid #E0DED6', background: '#F7F6F2', padding: '10px 12px' }}>
                      <div style={{ fontSize: 11, color: '#888780', marginBottom: 5 }}>Concepto único (de los abonos de lo filtrado)</div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <code style={{ flex: '1 1 320px', fontSize: 12, background: '#fff', border: '0.5px solid #E0DED6', borderRadius: 6, padding: '7px 9px', color: '#2C2C2A' }}>{conceptoUnico}</code>
                        <button onClick={copiarConcepto}
                          style={{ fontSize: 12, padding: '7px 12px', borderRadius: 8, border: 'none', background: copiado ? '#1D9E75' : '#0C447C', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                          {copiado ? '✓ Copiado' : 'Copiar'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* TABLA */}
        <div style={{ border: '0.5px solid #E0DED6', borderRadius: 10, overflow: 'visible', background: '#fff' }}>
          <div style={{ position: 'sticky', top: topTabla, zIndex: 16, display: 'grid', gridTemplateColumns: GRID, background: '#F1EFE9', borderBottom: '0.5px solid #E0DED6', padding: '9px 12px', fontSize: 11, fontWeight: 600, color: '#888780' }}>
            {COLDEFS.map(c => (
              <div key={c.key} style={{ textAlign: c.align, display: 'flex', justifyContent: c.align === 'right' ? 'flex-end' : c.align === 'center' ? 'center' : 'flex-start', alignItems: 'center' }}>
                <span>{c.label}{orden?.key === c.key ? (orden.dir === 'asc' ? ' ↑' : ' ↓') : ''}</span>
                <HeaderFilter col={c} movs={movs} state={filters[c.key]}
                  setState={(v) => setFilters(f => ({ ...f, [c.key]: v }))}
                  open={openFilter} setOpen={setOpenFilter} orden={orden} setOrden={setOrden}
                  limpiarTodo={limpiarTodo} hayAlguno={hayFiltro} />
              </div>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: 30, textAlign: 'center', color: '#888', fontSize: 13 }}>Cargando…</div>
          ) : (
            <>
              {apertura && !hayFiltro && (
                <div style={{ display: 'grid', gridTemplateColumns: GRID, padding: '8px 12px', fontSize: 12, background: '#F3F7FB', borderBottom: '0.5px solid #E7EDF3', alignItems: 'center', color: '#0C447C' }}>
                  <div style={{ fontWeight: 600 }}>—</div>
                  <div />
                  <div style={{ fontWeight: 600 }}>{apertura.label}</div>
                  <div />
                  <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{clp(apertura.saldo)}</div>
                  <div /><div /><div /><div /><div />
                </div>
              )}
              {movsFiltrados.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: '#888', fontSize: 13 }}>Sin movimientos para este filtro.</div>
              ) : movsFiltrados.map(m => {
                const desg = lineasByMov[m.id] || []
                const seleccionada = sel?.id === m.id   // fila que abrió el panel: fondo blanco + acento
                const cf = m.color_fondo || undefined    // marca: tiñe SOLO las 4 primeras columnas
                return (
                  <div key={m.id}>
                    <div onClick={() => abrir(m)} style={{ display: 'grid', gridTemplateColumns: GRID, padding: '8px 12px', fontSize: 13, color: '#2C2C2A', borderBottom: desg.length ? 'none' : '0.5px solid #F0EFEA', cursor: 'pointer', alignItems: 'center', background: '#fff', boxShadow: seleccionada ? 'inset 3px 0 0 #1D9E75' : undefined }}
                      onMouseEnter={e => e.currentTarget.style.background = seleccionada ? '#fff' : '#FAFAF7'}
                      onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                      <div style={{ fontWeight: 600, color: '#0C447C', display: 'flex', alignItems: 'center', gap: 4, alignSelf: 'stretch', background: cf }}>
                        <span>{folioVisible(m) ?? '—'}</span>
                        {m.nota_auditoria && (
                          <span title={m.nota_auditoria} style={{ cursor: 'help', color: '#B26B00', fontSize: 12 }}>⚠</span>
                        )}
                      </div>
                      <div style={{ color: '#888780', fontSize: 12, display: 'flex', alignItems: 'center', alignSelf: 'stretch', background: cf }}>{fmtFecha(m.fecha)}</div>
                      <div style={{ display: 'flex', alignItems: 'center', alignSelf: 'stretch', minWidth: 0, paddingRight: 8, background: cf }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{m.descripcion || <span style={{ color: '#B4B2A9' }}>—</span>}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, alignSelf: 'stretch', background: cf }}>
                        <span style={{ fontVariantNumeric: 'tabular-nums', color: m.monto < 0 ? '#B23A3A' : '#085041', fontWeight: 500 }}>{clp(m.monto)}</span>
                        {canEdit && (
                          <button onClick={(e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setColorMenu(cm => cm?.id === m.id ? null : { id: m.id, x: r.left, y: r.bottom }) }}
                            title="Colorear (fondo de las 4 primeras columnas)"
                            style={{ flexShrink: 0, width: 17, height: 17, borderRadius: 4, border: '0.5px solid #C9C7BF', background: cf || '#fff', cursor: 'pointer', padding: 0, lineHeight: 1, fontSize: 10, color: '#888780' }}>▾</button>
                        )}
                      </div>
                      <div title={hayFiltro ? 'El saldo es corrido sobre TODOS los movimientos, no sobre el filtro' : undefined}
                        style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: hayFiltro ? '#D3D1C7' : '#888780' }}>{clp(m.saldo_calc)}</div>
                      <div style={{ textAlign: 'center', color: '#888780', fontSize: 12 }}>{m.cargo_abono || '—'}</div>
                      <div style={{ textAlign: 'center' }}>
                        {m.__ccb
                          ? <span title={resumeLineas(lineasByMov[m.id], 'ccb', false).detalle}
                              style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 999, background: '#EEF3F8', color: '#0C447C' }}>{m.__ccb}</span>
                          : <span style={{ color: '#D3D1C7' }}>—</span>}
                      </div>
                      <div style={{ fontSize: 11, color: '#4A4A46', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={describeVarias(lineasByMov[m.id])}>
                        {m.__cta || <span style={{ color: '#D3D1C7' }}>—</span>}
                      </div>
                      <div style={{ textAlign: 'center' }} title={(ESTADO[m.estado_clasificacion] || ESTADO.SIN_CLASIFICAR).label}>
                        <span style={{ display: 'inline-block', width: 11, height: 11, borderRadius: '50%', background: (ESTADO[m.estado_clasificacion] || ESTADO.SIN_CLASIFICAR).color }} />
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); if (canEdit) abrirCheck(m) }}
                          disabled={!canEdit}
                          title={m.check_revisado_por ? `Revisado por ${m.check_revisado_por}${m.check_fecha ? ' · ' + fmtFecha(m.check_fecha) : ''}` : (canEdit ? 'Revisar: SÍ/NO + comentarios' : 'Solo lectura')}
                          style={{ cursor: canEdit ? 'pointer' : 'default', border: '0.5px solid #E4E2DA', borderRadius: 6, background: '#fff', padding: '2px 6px', fontSize: 11, fontWeight: 700, lineHeight: 1.3, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {m.check_estado === 'SI'
                            ? <span style={{ color: '#0B7A57' }}>SÍ</span>
                            : m.check_estado === 'NO'
                              ? <span style={{ color: '#B23A3A' }}>NO</span>
                              : <span style={{ color: '#C9C7BF' }}>·</span>}
                          {(m.check_observacion || m.check_acciones || m.check_mejoras)
                            ? <span title="Con comentarios" style={{ width: 5, height: 5, borderRadius: '50%', background: '#0C447C' }} />
                            : null}
                          <span style={{ fontSize: 10, color: '#B7B5AC' }}>✎</span>
                        </button>
                      </div>
                    </div>
                    {desg.map((l, k) => (
                      <div key={l.id ?? k} onClick={() => abrir(m)} style={{ display: 'grid', gridTemplateColumns: GRID, padding: '4px 12px', fontSize: 12, color: '#6b6b66', background: seleccionada ? '#fff' : '#FCFCFA', boxShadow: seleccionada ? 'inset 3px 0 0 #1D9E75' : undefined, borderBottom: k === desg.length - 1 ? '0.5px solid #F0EFEA' : 'none', cursor: 'pointer', alignItems: 'center' }}>
                        <div style={{ color: '#9a988f', paddingLeft: 8 }}>{subFolio(folioVisible(m), l.sub_orden)}</div>
                        <div />
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
                          {l.concepto || '—'}
                        </div>
                        <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{clp(l.monto)}</div>
                        <div /><div />
                        <div style={{ textAlign: 'center' }}>
                          {l.ccb
                            ? <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 20, background: '#EEF3F8', color: '#0C447C' }}>{l.ccb}</span>
                            : <span style={{ color: '#D3D1C7' }}>—</span>}
                        </div>
                        <div style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={describeCuenta(l.cuenta_1)}>
                          {(String(l.cuenta_1 || '').match(/^[0-9]{4}-[0-9]{2}(-[0-9]{2})?/) || [''])[0] || <span style={{ color: '#D3D1C7' }}>—</span>}
                        </div>
                        <div /><div />
                      </div>
                    ))}
                  </div>
                )
              })}

              {/* TOTALES de lo que se está viendo — es lo que permite cuadrar contra el Excel */}
              {movsFiltrados.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: GRID, padding: '10px 12px', fontSize: 12,
                  background: hayFiltro ? '#FFF8E7' : '#F7F6F2', borderTop: '1px solid #E0DED6', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, color: '#2C2C2A' }}>Total</div>
                  <div style={{ color: '#888780', fontSize: 11 }}>{totalFiltro.n} mov.</div>
                  <div style={{ color: '#888780', fontSize: 11 }}>
                    Cargos {clp(totalFiltro.cargos)} · Abonos {clp(totalFiltro.abonos)}
                    {hayFiltro && <span style={{ color: '#B26B00', marginLeft: 8 }}>· filtro activo</span>}
                  </div>
                  <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700,
                    color: totalFiltro.neto < 0 ? '#B23A3A' : '#085041' }}>{clp(totalFiltro.neto)}</div>
                  <div style={{ textAlign: 'right' }}>
                    {hayFiltro && (
                      <button onClick={() => { setFilters({}); setOrden(null) }}
                        style={{ fontSize: 11, border: '0.5px solid #D3D1C7', background: '#fff', borderRadius: 6,
                          padding: '3px 8px', cursor: 'pointer', color: '#0C447C' }}>Limpiar filtros</button>
                    )}
                  </div>
                  <div /><div /><div /><div />
                </div>
              )}
            </>
          )}
        </div>
        {hayFiltro && (
          <div style={{ fontSize: 11, color: '#B26B00', marginTop: 8 }}>
            Con el filtro activo la columna <strong>Saldo</strong> se atenúa: es el saldo corrido de la cartola
            entera, no el de lo que estás viendo. Para cuadrar, usa el total de la fila de abajo.
          </div>
        )}
        <div style={{ fontSize: 11, color: '#B4B2A9', marginTop: 8 }}>
          {modo === 'cartola' && cargaActual ? `Cartola ${cargaActual.nro_cartola} · ${fmtFecha(cargaActual.fecha_desde)} a ${fmtFecha(cargaActual.fecha_hasta)}  ·  ` : (modo === 'continua' ? 'Vista continua (todos los meses)  ·  ' : '')}
          {movsFiltrados.length} de {movs.length} movimientos. Pincha uno para clasificar o editar su desglose.
        </div>
      </div>

      {/* Menú de color (marca) — se abre desde el botón ▾ tras el Monto */}
      {colorMenu && (
        <>
          <div onClick={() => setColorMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 9500 }} />
          <div style={{ position: 'fixed', left: Math.max(8, Math.min(colorMenu.x - 150, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 220)), top: colorMenu.y + 6, zIndex: 9501, background: '#fff', border: '0.5px solid #D3D1C7', borderRadius: 8, boxShadow: '0 8px 26px rgba(0,0,0,0.16)', width: 212, padding: 6 }}>
            <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', padding: '2px 6px 6px' }}>Marcar con color</div>
            {PALETA_MARCA.map(p => (
              <button key={p.color} onClick={() => ponerColor(colorMenu.id, p.color)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', padding: '6px 6px', borderRadius: 6, fontSize: 12, color: '#2C2C2A', textAlign: 'left' }}>
                <span style={{ width: 16, height: 16, borderRadius: 4, background: p.color, border: '0.5px solid #C9C7BF', flexShrink: 0 }} />
                {p.label}
              </button>
            ))}
            <div style={{ borderTop: '0.5px solid #ECEAE3', margin: '4px 0' }} />
            <button onClick={() => ponerColor(colorMenu.id, null)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', padding: '6px 6px', borderRadius: 6, fontSize: 12, color: '#888780', textAlign: 'left' }}>
              <span style={{ width: 16, height: 16, borderRadius: 4, background: '#fff', border: '0.5px solid #C9C7BF', flexShrink: 0 }} />
              Sin color
            </button>
          </div>
        </>
      )}

      {/* MODAL CHECK: revisión SÍ/NO + comentarios (Observación, Acciones, Mejoras propuestas). */}
      {checkSel && checkDraft && (
        <>
          <div onClick={() => { if (!savingCheck) { setCheckSel(null); setCheckDraft(null) } }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.32)', zIndex: 9600 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 9601, background: '#fff', borderRadius: 12, boxShadow: '0 18px 50px rgba(0,0,0,0.22)', width: 'min(560px, 94vw)', maxHeight: '90vh', overflowY: 'auto', padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#2C2C2A' }}>COMENTARIOS</div>
              <div style={{ fontSize: 12, color: '#888780' }}>Folio {folioVisible(checkSel) ?? '—'}</div>
            </div>
            <div style={{ fontSize: 12, color: '#888780', marginBottom: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{checkSel.descripcion || ''}</div>

            {/* SÍ / NO */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {['SI', 'NO'].map(v => {
                const on = checkDraft.estado === v
                const col = v === 'SI' ? '#0B7A57' : '#B23A3A'
                return (
                  <button key={v} onClick={() => setCheckDraft(d => ({ ...d, estado: on ? null : v }))}
                    style={{ flex: 1, padding: '9px 0', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700,
                      border: on ? `1.5px solid ${col}` : '1px solid #D3D1C7', background: on ? col : '#fff', color: on ? '#fff' : '#888780' }}>
                    {v === 'SI' ? 'SÍ' : 'NO'}
                  </button>
                )
              })}
            </div>

            {[
              { k: 'observacion', label: 'Observación' },
              { k: 'acciones', label: 'Acciones' },
              { k: 'mejoras', label: 'Mejoras propuestas' },
            ].map(f => (
              <div key={f.k} style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b6b66', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 }}>{f.label}</label>
                <textarea value={checkDraft[f.k]} onChange={e => setCheckDraft(d => ({ ...d, [f.k]: e.target.value }))}
                  rows={2} style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', fontSize: 13, color: '#2C2C2A', padding: '8px 10px', borderRadius: 8, border: '1px solid #D3D1C7', fontFamily: 'inherit' }} />
              </div>
            ))}

            <div style={{ fontSize: 11, color: '#9CA3AF', background: '#F7F6F2', borderRadius: 8, padding: '8px 10px', marginBottom: 14 }}>
              <div><b style={{ color: '#6b6b66' }}>Revisado por:</b> {checkSel.check_revisado_por || <span style={{ color: '#C9C7BF' }}>— (se guarda tu email al guardar)</span>}</div>
              <div><b style={{ color: '#6b6b66' }}>Fecha:</b> {checkSel.check_fecha ? fmtFecha(checkSel.check_fecha) : <span style={{ color: '#C9C7BF' }}>— (se sella al guardar)</span>}</div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { if (!savingCheck) { setCheckSel(null); setCheckDraft(null) } }}
                style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #D3D1C7', background: '#fff', color: '#6b6b66', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Cancelar</button>
              <button onClick={guardarCheck} disabled={savingCheck}
                style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#1D9E75', color: '#fff', cursor: savingCheck ? 'default' : 'pointer', fontSize: 13, fontWeight: 700, opacity: savingCheck ? 0.7 : 1 }}>{savingCheck ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        </>
      )}

      {/* DRAWER (edición como tabla compacta) */}
      {sel && (
        <>
          <div onClick={cerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.28)', zIndex: 9000 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, height: '100vh', width: isMobile ? '100%' : 'clamp(440px, 40vw, 620px)', maxWidth: '100%', background: '#fff', zIndex: 9001, boxShadow: '-4px 0 24px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px 18px', borderBottom: '0.5px solid #E0DED6', flexShrink: 0, background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#888780' }}>Folio {sel.orden ?? '—'} · {fmtFecha(sel.fecha)}</div>
                  <input value={glosa} disabled={!canEdit}
                    onChange={e => setGlosa(e.target.value)}
                    placeholder={sel.descripcion || 'Glosa del asiento'}
                    title="Glosa que irá al asiento contable. Si se deja vacía se usa la descripción del banco."
                    style={{ width: '100%', fontSize: 14, fontWeight: 600, color: '#2C2C2A', marginTop: 2,
                      padding: '4px 7px', borderRadius: 5, border: `0.5px solid ${glosa ? '#CDEBDF' : 'transparent'}`,
                      background: glosa ? '#F3FBF8' : 'transparent', boxSizing: 'border-box' }} />
                  <div style={{ fontSize: 11, color: '#B4B2A9', marginTop: 2 }}>
                    Banco: {sel.descripcion || '—'}
                  </div>
                  <div style={{ fontSize: 19, fontWeight: 700, marginTop: 3, color: sel.monto < 0 ? '#B23A3A' : '#085041' }}>{clp(sel.monto)}</div>
                </div>
                <button onClick={cerrar} style={{ border: 'none', background: 'transparent', fontSize: 22, cursor: 'pointer', color: '#888780', lineHeight: 1 }}>×</button>
              </div>
              {canEdit && memoSel?.desglose && memoSel.desglose.length > 1 && lineas.length <= 1 && (
                <button onClick={copiarDesglose}
                  title={`Este movimiento se repite: se copian las ${memoSel.desglose.length} líneas de la última vez y sólo hay que ajustar los importes`}
                  style={{ marginTop: 9, fontSize: 12, padding: '6px 12px', borderRadius: 7, border: '0.5px solid #CDEBDF', background: '#F3FBF8', color: '#085041', cursor: 'pointer', fontWeight: 600 }}>
                  ⧉ Copiar el desglose de {fmtFecha(memoSel.fecha)} ({memoSel.desglose.length} líneas)
                </button>
              )}
              {!canEdit && <div style={{ marginTop: 8, fontSize: 12, color: '#888780', background: '#F7F6F2', padding: '6px 10px', borderRadius: 6 }}>Solo lectura · no tienes permiso para editar.</div>}
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '12px 18px' }}>
              <div style={{ minWidth: 620 }}>
                {/* cabecera de la fila de arriba de cada linea */}
                <div style={{ display: 'grid', gridTemplateColumns: LGRID, gap: 6, fontSize: 10, fontWeight: 600, color: '#888780', padding: '0 2px 6px' }}>
                  <div>Folio</div><div>CCB</div><div style={{ textAlign: 'right' }}>Cantidad</div><div>Concepto</div><div />
                </div>
                {lineas.length === 0 && <div style={{ fontSize: 13, color: '#B4B2A9', padding: '8px 2px' }}>Sin líneas. {canEdit && 'Añade una para clasificar.'}</div>}
                {lineas.map((l, i) => {
                  const selCta = { width: '100%', fontSize: 12, padding: '5px 7px', borderRadius: 5, border: '0.5px solid #D3D1C7', boxSizing: 'border-box', background: !canEdit ? '#F7F6F2' : '#fff' }
                  const esCargo = Number(sel.monto) < 0
                  // Compras que cuadran con esta linea (o con el movimiento si aun no tiene importe).
                  const sugs = matchCompras(Math.abs(Number(l.monto) || 0) || Math.abs(Number(sel.monto) || 0))
                  const ctasUnicas = Array.from(new Set(sugs.map(c => codDe(c.cuenta)).filter(Boolean)))
                  const sugCta2 = ctasUnicas.length === 1 ? ctasUnicas[0] : null
                  // Si el pago cuadra con una compra, la Cuenta 1 natural es 2105-05
                  // (proveedores); si no, la que sugiera la memoria por descripcion.
                  const sug1 = sugs.length ? CTA_PROVEEDORES : (memoSel?.unica || null)
                  const cta1EsProv = sugs.length > 0 && codDe(l.cuenta_1) === CTA_PROVEEDORES
                  const d1 = describeCuenta(l.cuenta_1)
                  const d2 = describeCuenta(l.cuenta_2)
                  return (
                  <div key={i} style={{ border: '0.5px solid #ECEAE3', borderRadius: 9, padding: '9px 11px', marginBottom: 9, background: '#FCFCFA' }}>
                    {/* fila 1: folio · CCB · cantidad · concepto · quitar */}
                    <div style={{ display: 'grid', gridTemplateColumns: LGRID, gap: 6, alignItems: 'center' }}>
                      <div style={{ fontSize: 11, color: '#9a988f', fontWeight: 600 }}>{subFolio(folioVisible(sel), i + 1)}</div>
                      <input list="ccb-list" value={l.ccb || ''} disabled={!canEdit} onChange={e => setLinea(i, 'ccb', e.target.value)} style={inp} />
                      <input type="number" value={l.monto} disabled={!canEdit} onChange={e => setLinea(i, 'monto', e.target.value)} style={{ ...inp, textAlign: 'right' }} />
                      <input value={l.concepto || ''} disabled={!canEdit} onChange={e => setLinea(i, 'concepto', e.target.value)} style={inp} />
                      {canEdit ? <button onClick={() => delLinea(i)} title="Quitar" style={{ border: '0.5px solid #E7C9C4', background: '#fff', color: '#B23A3A', borderRadius: 5, cursor: 'pointer', height: 28, fontSize: 14 }}>×</button> : <div />}
                    </div>
                    {/* fila 2: Cuenta 1 y Cuenta 2, cada una con su descripcion legible debajo */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 9 }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: '#888780', marginBottom: 3 }}>Cuenta 1</div>
                        <CuentaSelector valor={l.cuenta_1} plan={plan} disabled={!canEdit}
                          sugerida={sug1} formato="codigo" estilo={selCta}
                          onChange={v => setLinea(i, 'cuenta_1', v)} />
                        {d1 && <div style={{ fontSize: 10.5, color: '#888780', marginTop: 3, lineHeight: 1.3 }}>{d1}</div>}
                        {cta1EsProv && <div style={{ fontSize: 10, color: '#085041', marginTop: 2 }}>· puesta sola: pago a proveedor</div>}
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: '#888780', marginBottom: 3 }}>Cuenta 2 <span style={{ fontWeight: 400, color: '#B4B2A9' }}>· contrapartida</span></div>
                        <CuentaSelector valor={l.cuenta_2} plan={plan} disabled={!canEdit}
                          sugerida={sugCta2} formato="codigo" placeholder="cuenta / compra" estilo={selCta}
                          onChange={v => setLinea(i, 'cuenta_2', v)} />
                        {d2 && <div style={{ fontSize: 10.5, color: '#888780', marginTop: 3, lineHeight: 1.3 }}>{d2}</div>}
                        {/* Referencia al origen en Compras — siempre visible en los pagos */}
                        {esCargo && (
                          <div style={{ marginTop: 6 }}>
                            {sugs.length > 0 ? (
                              <>
                                <div style={{ fontSize: 10, color: '#085041', fontWeight: 600, marginBottom: 3 }}>
                                  💡 Origen en Compras{sugs.length > 1 ? ` (${sugs.length})` : ''} · clic para poner la cuenta
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                  {sugs.map((c, k) => {
                                    const cod = codDe(c.cuenta)
                                    const puesta = cod && codDe(l.cuenta_2) === cod
                                    return (
                                      <button key={k} disabled={!canEdit || !cod}
                                        onClick={() => { if (cod) setLineas(ls => ls.map((x, k2) => k2 === i ? { ...x, cuenta_2: cod, comentario: (x.comentario || '').trim() ? x.comentario : `Compras · ${c.proveedor || 'proveedor s/n'} · Folio ${c.folio} · ${fmtFecha(c.fecha)}` } : x)) }}
                                        title={`${c.proveedor || 'Proveedor s/n'} · Folio ${c.folio} · ${cod ? (describeCuenta(c.cuenta) || cod) : 'aún sin cuenta en Compras'}`}
                                        style={{ display: 'flex', gap: 7, alignItems: 'center', textAlign: 'left', width: '100%',
                                          fontSize: 10.5, padding: '4px 7px', borderRadius: 5,
                                          cursor: (canEdit && cod) ? 'pointer' : 'default',
                                          border: `0.5px solid ${puesta ? '#1D9E75' : '#CDEBDF'}`, background: puesta ? '#E1F5EE' : '#fff', color: '#2C2C2A' }}>
                                        <span style={{ color: '#888780', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmtFecha(c.fecha)}</span>
                                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.proveedor || '—'} · Folio {c.folio}</span>
                                        {cod
                                          ? <span style={{ fontWeight: 700, color: '#085041', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{cod}</span>
                                          : <span style={{ color: '#B26B00', whiteSpace: 'nowrap' }}>sin cuenta</span>}
                                        {puesta && <span style={{ color: '#1D9E75', fontWeight: 700 }}>✓</span>}
                                      </button>
                                    )
                                  })}
                                </div>
                              </>
                            ) : (compras === null || cargandoCompras) ? (
                              <div style={{ fontSize: 10, color: '#B4B2A9' }}>buscando en Compras…</div>
                            ) : (
                              <div style={{ fontSize: 10, color: '#B4B2A9' }}>sin compra que cuadre por importe (±20 días)</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* fila 3: comentario libre / origen de la imputacion */}
                    <div style={{ marginTop: 9 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#888780', marginBottom: 3 }}>Comentario <span style={{ fontWeight: 400, color: '#B4B2A9' }}>· nota u origen de la cuenta</span></div>
                      <input value={l.comentario || ''} disabled={!canEdit}
                        onChange={e => setLinea(i, 'comentario', e.target.value)}
                        placeholder="p. ej. de qué factura de Compras viene, o una nota"
                        style={{ ...inp, width: '100%' }} />
                    </div>
                  </div>
                  )
                })}
                {canEdit && <button onClick={addLinea} style={{ marginTop: 4, fontSize: 12, padding: '7px 12px', borderRadius: 7, border: '0.5px dashed #1D9E75', background: '#F3FBF8', color: '#085041', cursor: 'pointer', fontWeight: 500 }}>+ Añadir línea</button>}
                <datalist id="ccb-list">{CCB_SUGERIDOS.map(c => <option key={c} value={c} />)}</datalist>
              </div>
            </div>

            <div style={{ borderTop: '0.5px solid #E0DED6', padding: '12px 18px', background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span style={{ color: '#888780' }}>Suman las líneas</span>
                <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{clp(sumaLineas)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 10 }}>
                <span style={{ color: '#888780' }}>{cuadra ? 'Cuadra con el banco' : 'Diferencia con el banco'}</span>
                <span style={{ fontWeight: 700, color: cuadra ? '#085041' : '#B23A3A', fontVariantNumeric: 'tabular-nums' }}>{cuadra ? '✓ 0' : clp(diferencia)}</span>
              </div>
              {canEdit && (
                <>
                  {confirmDesc && !cuadra && <div style={{ fontSize: 12, color: '#B23A3A', background: '#FBE9E7', padding: '7px 10px', borderRadius: 6, marginBottom: 8 }}>Va a quedar <b>descuadrado</b> (diferencia {clp(diferencia)}). Pulsa otra vez para guardar igual.</div>}
                  <button onClick={guardar} disabled={saving} style={{ width: '100%', fontSize: 14, fontWeight: 600, padding: '10px', borderRadius: 8, border: 'none', cursor: saving ? 'default' : 'pointer', background: confirmDesc && !cuadra ? '#B23A3A' : '#1D9E75', color: '#fff', opacity: saving ? 0.7 : 1 }}>
                    {saving ? 'Guardando…' : (confirmDesc && !cuadra ? 'Guardar descuadrado' : 'Guardar clasificación')}
                  </button>
                  {savedFlag && <div style={{ textAlign: 'center', fontSize: 12, color: '#085041', marginTop: 6 }}>✓ Guardado</div>}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}