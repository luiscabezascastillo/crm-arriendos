// VERSION: v14 · 2026-07-28 · Compras: filtro estilo Excel también en Neto, IVA y Total.
//   · Esas tres columnas estaban con filter:null (sin desplegable). Ahora usan el MISMO filtro
//     de lista que el resto y que SA: ordenar menor/mayor, buscar en la lista de importes,
//     marcar valores y recuento por valor. Los importes se muestran formateados (1.000.000),
//     y el buscador acepta tanto "1000000" como "1.000.000".
// VERSION: v13 · 2026-07-27 · Compras: columna Cuenta, tooltip del plan y sin salto al guardar.
//   · Columna Cuenta estrecha (solo el codigo) junto al CCB, filtrable como el resto.
//   · Al pasar el raton sale '4201-41 · TELEFONO E INTERNET', sacado del plan. Si la
//     cuenta no esta en el plan lo dice: ahi se ven los codigos mal escritos.
//   · Guardar recargaba la lista entera y el navegador perdia la posicion, devolviendote
//     al principio. Ahora se actualiza solo esa compra en memoria.
//   · Y las cabeceras Total y Estado dejan de tocarse ("TotalEstado").
// VERSION: v12 · 2026-07-27 · Compras: facturas RECHAZADAS (que no son de FCR).
//   Fondo rojo tenue, importes tachados y chip "No es de FCR" con el motivo.
//   Se quedan en la lista A PROPOSITO: existen en el registro del SII, y si
//   desaparecieran, el cuadre mensual contra el SII no daria nunca.
//   Los totales de la cabecera son los de FCR (sin las rechazadas) y al lado se
//   indica el total del SII (con ellas), que es contra el que se cuadra.
// VERSION: v11 · 2026-07-27 · Compras: el panel de edicion va POR ENCIMA de las barras.
//   Se abria en top:0 con zIndex 41, pero el TopNav y FinancieroNav van por encima y le
//   tapaban las primeras lineas: RUT, proveedor, importe y neto. Es decir, se ocultaba
//   justo lo que hace falta para decidir el CCB y la cuenta.
//   Ademas el fondo oscurecido no cubria las barras, asi que la navegacion seguia
//   clicable durante la edicion. Mismo arreglo que ya se hizo en SA (v20).
// VERSION: v10 · 2026-07-27 · Compras: se crea el componente CuentaSelector, que faltaba.
//   La v9 lo importaba de @/app/components/ui/CuentaSelector, pero ese archivo no
//   existia: la pantalla habria reventado al abrir el panel. esbuild no lo detecta
//   porque solo valida sintaxis, no si el modulo existe.
//   Se marca ademas en ambar lo que puso la maquina (origen_clasificacion = 'auto'),
//   con un contador en la cabecera, para que las sugerencias no se cuelen sin revisar.
// VERSION: v9 · 2026-07-27 · Compras: buscador del plan de cuentas y sugerencia por RUT.
//   · El campo Cuenta deja de pedir el codigo de memoria: buscador por codigo o texto,
//     el mismo componente que usa SA (CuentaSelector).
//   · Sugerencia por RUT calculada en la pagina desde el historico ya cargado, con el
//     mismo criterio que la memoria de la base: solo si el proveedor es UNANIME y hay
//     al menos 2 antecedentes. Un clic la acepta; nunca se rellena sola aqui.
//   · El plan sale del endpoint si lo devuelve (campo 'plan'); si no, se reconstruye
//     con las cuentas ya usadas en el historico, para que el buscador sirva igualmente.
// VERSION: v8 · 2026-07-26 · Compras: orden por columna + filtros estilo Excel.
//   · Orden por defecto ASCENDENTE por fecha, con scroll automatico al fondo: lo mas
//     reciente queda a la vista abajo y se sube para ver lo antiguo. (La v7 lo puso al
//     reves por error; se revierte.)
//   · Cabecera clicable para ordenar, con indicador de sentido.
//   · Filtro de columna estilo Excel: ordenar A-Z / Z-A, buscador que filtra la LISTA
//     de valores (no las filas), recuento por valor y sin el tope de 40 distintos que
//     hacia desaparecer la lista en Proveedor.
// VERSION: v6 · 2026-07-26 · Compras: carga directa de los CSV del Registro de Compras del SII.
//   · Acepta RCV_COMPRA_REGISTRO_<rut>_<AAAAMM>_<tipo>.csv ademas del Excel de siempre.
//   · tipo_doc y periodo salen del NOMBRE del archivo, no de los datos:
//       - la columna "Tipo Compra" del CSV vale siempre "Del Giro" y NO es un tipo de
//         documento (de ahi las 29 filas historicas con tipo_doc = 'Del Giro');
//       - la fecha del documento no marca el periodo tributario: en el registro de
//         junio hay facturas fechadas en mayo.
//   · Captura los impuestos adicionales (Codigo/Valor Otro Impuesto, p.ej. cod. 28
//     combustibles) que hasta ahora se perdian: total = exento + neto + iva + otro.
//   · Sube ccb y cuenta vacios: los completa Karina (o la memoria por RUT).
//   · La deduplicacion la hace el endpoint (devuelve nuevas/duplicadas/total).
// VERSION: v5 · 2026-07-26 · Compras: aviso de arrastrar/pegar + cabecera FinancieroHeader.
//   El soporte de arrastrar y pegar YA existia (dragover/drop/paste + overlay), pero no se
//   anunciaba en ningun sitio, asi que nadie lo usaba. Solo faltaba decirlo.
// VERSION: v4 · 2026-07-26 · Compras: cabecera compartida FinancieroHeader (3 lineas, fija).
//   El offset pegajoso lo calcula el componente (TopNav + FinancieroNav). Antes esta
//   pagina media solo el hermano inmediato y la cabecera se escondia tras el TopNav.
//   Totales como chips dentro de la zona fija: ya no desaparecen al hacer scroll.
//   Fuera el boton ← Financiero (duplicado: ya esta en FinancieroNav).
'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo, useRef } from 'react'
import TopNav from '@/app/components/ui/TopNav'
import FinancieroNav from '@/app/components/ui/FinancieroNav'
import FinancieroHeader from '@/app/components/ui/FinancieroHeader'
import CuentaSelector from '@/app/components/ui/CuentaSelector'

const EDITORES = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']
const CCB_SUGERIDOS = ['CC1', 'CC2', 'CC3', 'BB1', 'BB2', 'GG']
const PAGADO_SUGERIDOS = ['SA', 'BI', 'TC SA']

const clp = (n) => (n == null ? '—' : Number(n).toLocaleString('es-CL'))
const fmtFecha = (iso) => { if (!iso) return ''; const [y, m, d] = String(iso).slice(0, 10).split('-'); return `${d}/${m}/${y}` }
const mesLabel = (m) => { if (!m) return ''; const [y, mm] = m.split('-'); const N = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']; return `${N[Number(mm)] || mm} ${y}` }

function fechaISO(v) {
  if (v == null || v === '') return null
  if (v instanceof Date && !isNaN(v)) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`
  const s = String(v).trim()
  let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/); if (m) return `${m[3]}-${m[2]}-${m[1]}`
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`
  return null
}

// Parte una linea de CSV con ; respetando comillas.
function partirCSV(linea) {
  const out = []; let cur = ''; let q = false
  for (let i = 0; i < linea.length; i++) {
    const ch = linea[i]
    if (ch === '"') { if (q && linea[i + 1] === '"') { cur += '"'; i++ } else q = !q }
    else if (ch === ';' && !q) { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur); return out
}

// Lee un CSV del Registro de Compras del SII: RCV_COMPRA_REGISTRO_<rut>_<AAAAMM>_<tipo>.csv
// El tipo de documento (33 factura, 34 exenta, 61 nota de credito) y el periodo
// tributario van en el NOMBRE del archivo. No lo renombres al descargarlo.
async function parseComprasSII(file) {
  if (/RCV[_ ]?VENTA/i.test(file.name)) {
    throw new Error('Este es el registro de VENTAS del SII. Subelo en la pantalla de Ventas.')
  }
  const m = file.name.match(/_(\d{6})_(\d{2,3})(?!\d)/)
  if (!m) throw new Error('El nombre no tiene el formato del SII (…_AAAAMM_TIPO.csv). Descargalo otra vez sin renombrarlo.')
  const periodo = m[1]
  const tipoDoc = String(Number(m[2]))
  const mes = periodo.slice(0, 4) + '-' + periodo.slice(4)

  const texto = (await file.text()).replace(/^\uFEFF/, '')
  const lineas = texto.split(/\r?\n/).filter(l => l.trim() !== '')
  if (lineas.length < 2) throw new Error('El archivo no tiene filas de datos.')

  const H = partirCSV(lineas[0]).map(h => h.trim().toUpperCase())
  const exact = (n) => H.indexOf(n)
  const has = (...subs) => H.findIndex(h => subs.every(s => h.includes(s)))
  const pick = (nombre, ...subs) => { const i = exact(nombre); return i >= 0 ? i : has(...subs) }
  const C = {
    folio:  pick('FOLIO', 'FOLIO'),
    rut:    pick('RUT PROVEEDOR', 'RUT'),
    prov:   pick('RAZON SOCIAL', 'RAZON'),
    fecha:  pick('FECHA DOCTO', 'FECHA', 'DOCTO'),
    exento: pick('MONTO EXENTO', 'EXENTO'),
    neto:   pick('MONTO NETO', 'MONTO', 'NETO'),
    iva:    pick('MONTO IVA RECUPERABLE', 'IVA', 'RECUPERABLE'),
    total:  pick('MONTO TOTAL', 'MONTO', 'TOTAL'),
    otroV:  pick('VALOR OTRO IMPUESTO', 'VALOR', 'OTRO'),
    otroC:  pick('CODIGO OTRO IMPUESTO', 'CODIGO', 'OTRO'),
  }
  if (C.folio < 0 || C.rut < 0) throw new Error('No encontre las columnas Folio / RUT Proveedor. ¿Es el Registro de Compras del SII?')

  const g = (r, i) => (i >= 0 && i < r.length) ? r[i] : ''
  const num = (v) => { const t = String(v == null ? '' : v).trim(); if (!t) return 0; const n = Number(t.replace(/\./g, '').replace(',', '.')); return isNaN(n) ? 0 : Math.round(n) }
  const txt = (v) => { const t = String(v == null ? '' : v).trim(); return t === '' ? null : t }

  const compras = []
  let saltadas = 0
  for (let i = 1; i < lineas.length; i++) {
    const r = partirCSV(lineas[i]).slice(0, H.length)
    const folio = num(g(r, C.folio))
    const rut = txt(g(r, C.rut))
    const fecha = fechaISO(g(r, C.fecha))
    if (!folio || !rut || !fecha) { saltadas++; continue }
    compras.push({
      folio, tipo_doc: tipoDoc, fecha, rut,
      proveedor: txt(g(r, C.prov)),
      ccb: null, cuenta: null, pagado_por: null,
      exento: num(g(r, C.exento)), neto: num(g(r, C.neto)),
      iva: num(g(r, C.iva)), total: num(g(r, C.total)),
      otro_impuesto: num(g(r, C.otroV)), cod_otro_impuesto: txt(g(r, C.otroC)),
      estado: null, glosa: null, mes,
    })
  }
  if (!compras.length) throw new Error('No pude leer ninguna fila valida del CSV.')
  return { archivo: file.name, compras, mes, tipoDoc, saltadas }
}

// Lee un Libro de Compra (formato SII completo o mensual). Cabecera detectada dinámicamente, mapeo por nombre.
async function parseCompras(file, XLSX) {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: false })
  let hi = -1
  for (let i = 0; i < rows.length; i++) {
    const hh = (rows[i] || []).map(c => String(c == null ? '' : c).trim().toUpperCase())
    if (hh.includes('FOLIO') && hh.some(h => h.includes('RUT'))) { hi = i; break }
  }
  if (hi < 0) throw new Error('No encontré la cabecera (Folio / RUT). ¿Es un Libro de Compra?')
  const H = rows[hi].map(c => String(c == null ? '' : c).trim().toUpperCase())
  const idxExact = (name) => H.indexOf(name.toUpperCase())
  const idxHas = (...subs) => H.findIndex(h => subs.every(s => h.includes(s.toUpperCase())))
  const pick = (...specs) => { for (const s of specs) { const i = Array.isArray(s) ? idxHas(...s) : idxExact(s); if (i >= 0) return i } return -1 }
  const C = {
    folio: pick('Folio'), tipo: pick('Tipo Doc', 'Tipo Compra'), rut: pick(['RUT']), prov: pick('Razon Social', ['RAZON']),
    fecha: pick('Fecha Docto', ['FECHA', 'DOCTO'], ['FECHA']), exento: pick(['EXENTO']), neto: pick('Monto Neto'),
    iva: pick('Monto IVA Recuperable', ['MONTO', 'IVA', 'REC'], ['MONTO', 'IVA']), total: pick('Monto Total'),
    ccb: pick('CCB', ['COSTO', 'BENEFICIO']), pagado: pick('Pagado Por', 'Banco'), cuenta: pick('Ctas'),
    estado: pick('Estado'), glosa: pick('Descripcion', ['DETALLE']),
  }
  const num = (x) => { if (x == null || x === '') return null; const n = Number(x); return isNaN(n) ? null : Math.round(n) }
  const cl = (x) => { if (x == null) return null; const s = String(x).trim(); return (s === '' || s.toUpperCase() === 'X' || s === 'nan') ? null : s }
  const g = (r, i) => i >= 0 ? r[i] : null
  const compras = []
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i] || []
    const folio = num(g(r, C.folio)); const fecha = fechaISO(g(r, C.fecha)); const rut = cl(g(r, C.rut))
    if (folio == null || !fecha || !rut) continue
    compras.push({ folio, tipo_doc: cl(g(r, C.tipo)), fecha, rut, proveedor: cl(g(r, C.prov)), ccb: cl(g(r, C.ccb)),
      cuenta: cl(g(r, C.cuenta)), pagado_por: cl(g(r, C.pagado)), exento: num(g(r, C.exento)), neto: num(g(r, C.neto)),
      iva: num(g(r, C.iva)), total: num(g(r, C.total)), estado: cl(g(r, C.estado)), glosa: cl(g(r, C.glosa)), mes: fecha.slice(0, 7) })
  }
  return { archivo: file.name, compras }
}

// Estado de clasificación de una compra, deducido del campo 'cuenta'
// (mismo criterio que el generador de CONTAB): clasificada si 'cuenta'
// empieza por un código de gasto NNNN-NN. Si no, sin clasificar.
const esRechazada = (v) => String(v?.estado || '').toUpperCase() === 'RECHAZADA'

function estaClasificada(v) {
  const c = (v.cuenta || '').trim()
  if (!c) return false
  return /^\d{4}-\d{2}/.test(c)
}

const COLDEFS = [
  { key: 'folio', label: 'Folio', w: '82px', align: 'left', get: v => String(v.folio ?? ''), filter: 'text' },
  { key: 'fecha', label: 'Fecha', w: '92px', align: 'left', get: v => fmtFecha(v.fecha), filter: 'list' },
  { key: 'proveedor', label: 'Proveedor', w: '1fr', align: 'left', get: v => v.proveedor || '', filter: 'text' },
  { key: 'ccb', label: 'CCB', w: '86px', align: 'left', get: v => v.ccb || '', filter: 'list' },
  { key: 'cuenta', label: 'Cuenta', w: '92px', align: 'left',
    get: v => (String(v.cuenta || '').trim().match(/^[0-9]{4}-[0-9]{2}(-[0-9]{2})?/) || [''])[0], filter: 'list' },
  { key: 'pagado_por', label: 'Pagado', w: '72px', align: 'left', get: v => v.pagado_por || '', filter: 'list' },
  { key: 'neto', label: 'Neto', w: '100px', align: 'right', get: v => v.neto, fmt: clp, filter: 'list' },
  { key: 'iva', label: 'IVA', w: '90px', align: 'right', get: v => v.iva, fmt: clp, filter: 'list' },
  { key: 'total', label: 'Total', w: '112px', align: 'right', get: v => v.total, fmt: clp, filter: 'list' },
  { key: 'estado_clas', label: 'Estado', w: '124px', align: 'left', get: v => esRechazada(v) ? 'No es de FCR' : (estaClasificada(v) ? 'Clasificada' : 'Sin clasificar'), filter: 'list' },
]
const GRID = COLDEFS.map(c => c.w).join(' ')

function CcbChip({ ccb }) {
  if (!ccb) return <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#FBE9E7', color: '#B23A3A' }}>revisar</span>
  return <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#EEF3F8', color: '#0C447C' }}>{ccb}</span>
}
function Card({ label, value, color }) {
  return (<div style={{ background: '#fff', border: '0.5px solid #E0DED6', borderRadius: 10, padding: '10px 14px', minWidth: 108, flex: '1 1 auto' }}>
    <div style={{ fontSize: 11, color: '#888780', marginBottom: 3 }}>{label}</div>
    <div style={{ fontSize: 18, fontWeight: 700, color: color || '#2C2C2A' }}>{value}</div></div>)
}

function HeaderFilter({ col, movs, state, setState, open, setOpen, orden, setOrden }) {
  const active = state && (state.text || (state.sel && state.sel.length))
  const s = state || { text: '', sel: [] }
  const [busca, setBusca] = useState('')

  // valores distintos CON RECUENTO (como Excel)
  const distinct = useMemo(() => {
    const m = new Map()
    for (const v of movs) { const k = String(col.get(v) ?? ''); m.set(k, (m.get(k) || 0) + 1) }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0], 'es', { numeric: true }))
  }, [movs, col])

  // el buscador filtra la LISTA de valores, no las filas
  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return q ? distinct.filter(([v]) => v.toLowerCase().includes(q) || (col.fmt && col.fmt(v).toLowerCase().includes(q))) : distinct
  }, [distinct, busca])

  const toggle = (v) => { const sel = s.sel.includes(v) ? s.sel.filter(x => x !== v) : [...s.sel, v]; setState({ ...s, sel }) }
  const ordenar = (dir) => { setOrden({ key: col.key, dir }); setOpen(null) }
  const esFecha = col.key === 'fecha'
  const esNum = ['neto', 'iva', 'total', 'folio'].includes(col.key)
  const asc = esFecha ? 'Más antiguas primero' : esNum ? 'Menor a mayor' : 'A → Z'
  const desc = esFecha ? 'Más recientes primero' : esNum ? 'Mayor a menor' : 'Z → A'
  const activoOrden = orden && orden.key === col.key

  return (
    <span style={{ position: 'relative', marginLeft: 4 }}>
      <button onClick={(e) => { e.stopPropagation(); setBusca(''); setOpen(open === col.key ? null : col.key) }} title="Ordenar y filtrar"
        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: active ? '#1D9E75' : (activoOrden ? '#0C447C' : '#B4B2A9'), fontSize: 11, padding: 0 }}>
        {activoOrden ? (orden.dir === 'desc' ? '▼' : '▲') : '▼'}
      </button>
      {open === col.key && (<>
        <div onClick={() => setOpen(null)} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
        <div style={{ position: 'absolute', top: 18, left: 0, zIndex: 31, background: '#fff', border: '0.5px solid #D3D1C7', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,0.14)', padding: 10, width: 250, textAlign: 'left', fontWeight: 400 }}>

          <button onClick={() => ordenar('asc')} style={{ width: '100%', textAlign: 'left', fontSize: 12, padding: '5px 6px', border: 'none', borderRadius: 6, background: activoOrden && orden.dir === 'asc' ? '#E1F5EE' : 'transparent', cursor: 'pointer', color: '#2C2C2A' }}>↑ {asc}</button>
          <button onClick={() => ordenar('desc')} style={{ width: '100%', textAlign: 'left', fontSize: 12, padding: '5px 6px', border: 'none', borderRadius: 6, background: activoOrden && orden.dir === 'desc' ? '#E1F5EE' : 'transparent', cursor: 'pointer', color: '#2C2C2A' }}>↓ {desc}</button>
          <div style={{ borderTop: '0.5px solid #ECEAE3', margin: '8px 0' }} />

          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar en la lista…" autoFocus
            style={{ width: '100%', fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '0.5px solid #D3D1C7', boxSizing: 'border-box', marginBottom: 6 }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 5 }}>
            <button onClick={() => setState({ ...s, sel: visibles.map(([v]) => v) })} style={{ border: 'none', background: 'transparent', color: '#0C447C', cursor: 'pointer', padding: 0 }}>
              Marcar {busca ? `los ${visibles.length} visibles` : 'todos'}
            </button>
            <button onClick={() => setState({ ...s, sel: [] })} style={{ border: 'none', background: 'transparent', color: '#888780', cursor: 'pointer', padding: 0 }}>Limpiar</button>
          </div>

          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {visibles.length === 0 && <div style={{ fontSize: 11, color: '#B4B2A9', padding: '6px 0' }}>Sin coincidencias</div>}
            {visibles.slice(0, 400).map(([v, n]) => (
              <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '3px 0', cursor: 'pointer' }}>
                <input type="checkbox" checked={s.sel.includes(v)} onChange={() => toggle(v)} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v === '' ? '(vacío)' : (col.fmt ? col.fmt(v) : v)}</span>
                <span style={{ fontSize: 10, color: '#B4B2A9' }}>{n}</span>
              </label>))}
            {visibles.length > 400 && <div style={{ fontSize: 10, color: '#B4B2A9', padding: '4px 0' }}>…y {visibles.length - 400} más. Afina la búsqueda.</div>}
          </div>

          {active ? <button onClick={() => { setState({ text: '', sel: [] }); setBusca(''); setOpen(null) }} style={{ marginTop: 8, width: '100%', fontSize: 12, padding: '5px', borderRadius: 6, border: '0.5px solid #D3D1C7', background: '#F7F6F2', cursor: 'pointer' }}>Quitar filtro</button> : null}
        </div></>)}
    </span>
  )
}

export default function ComprasPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isMobile, setIsMobile] = useState(false)
  const [modo, setModo] = useState('continua')
  const [meses, setMeses] = useState([]); const [mesSel, setMesSel] = useState(null)
  const [compras, setCompras] = useState([]); const [loading, setLoading] = useState(false)
  const [planApi, setPlanApi] = useState([])
  const [filters, setFilters] = useState({}); const [openFilter, setOpenFilter] = useState(null)
  // Lo mas reciente ABAJO y scroll al fondo: se ve lo ultimo y se sube para lo antiguo.
  const [orden, setOrden] = useState({ key: 'fecha', dir: 'asc' })
  const [sel, setSel] = useState(null); const [edit, setEdit] = useState({}); const [saving, setSaving] = useState(false); const [savedFlag, setSavedFlag] = useState(false)
  const [uploading, setUploading] = useState(false); const [uploadMsg, setUploadMsg] = useState(null); const [dragOver, setDragOver] = useState(false); const fileRef = useRef(null); const handleFileRef = useRef(null)
  const canEdit = EDITORES.includes(session?.user?.email)
const wantScroll = useRef(false)
  const [topTabla, setTopTabla] = useState(0)

  useEffect(() => { const c = () => setIsMobile(window.innerWidth < 768); c(); window.addEventListener('resize', c); return () => window.removeEventListener('resize', c) }, [])
  useEffect(() => { if (status === 'unauthenticated') router.push('/api/auth/signin') }, [status, router])
  useEffect(() => { if (status !== 'authenticated') return; fetch('/api/financiero/compras').then(r => r.json()).then(d => { const l = d.meses || []; setMeses(l); if (l.length && mesSel == null) setMesSel(l[0].mes) }).catch(() => {}) }, [status]) // eslint-disable-line

  const cargar = () => {
    const url = modo === 'continua' ? '/api/financiero/compras?todas=1' : (mesSel ? `/api/financiero/compras?mes=${mesSel}` : null)
    if (!url) return
    setLoading(true)
    fetch(url).then(r => r.json()).then(d => { setCompras(d.compras || []); if (d.plan) setPlanApi(d.plan); if (wantScroll.current) { wantScroll.current = false; setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' }), 90) } }).finally(() => setLoading(false))
  }
  useEffect(() => { if (status === 'authenticated' && (modo === 'continua' || mesSel)) { wantScroll.current = true; cargar() } }, [modo, mesSel, status]) // eslint-disable-line

  const resumen = useMemo(() => { const r = { n: 0, neto: 0, iva: 0, total: 0, revisar: 0, sinClas: 0, auto: 0, rech: 0, totalRech: 0, totalSii: 0 }; for (const v of compras) { r.totalSii += v.total || 0; if (esRechazada(v)) { r.rech++; r.totalRech += v.total || 0; continue } r.n++; r.neto += v.neto || 0; r.iva += v.iva || 0; r.total += v.total || 0; if (!v.ccb) r.revisar++; if (!estaClasificada(v)) r.sinClas++; if (v.origen_clasificacion === 'auto') r.auto++ } return r }, [compras])
  const valOrden = (c, v) => {
    if (c.key === 'fecha') return v.fecha || ''
    if (['neto', 'iva', 'total', 'folio'].includes(c.key)) return Number(v[c.key] ?? 0)
    return String(c.get(v) ?? '').toLowerCase()
  }
  const comprasFiltradas = useMemo(() => compras.filter(v => { for (const c of COLDEFS) { const f = filters[c.key]; if (!f) continue; const val = String(c.get(v) ?? ''); if (f.text && !val.toLowerCase().includes(f.text.toLowerCase())) return false; if (f.sel && f.sel.length && !f.sel.includes(val)) return false } return true }), [compras, filters])

  const comprasVista = useMemo(() => {
    const c = COLDEFS.find(x => x.key === orden.key)
    if (!c) return comprasFiltradas
    const arr = comprasFiltradas.slice()
    arr.sort((a, b) => {
      const va = valOrden(c, a), vb = valOrden(c, b)
      let r = va < vb ? -1 : va > vb ? 1 : 0
      if (r === 0) r = (Number(a.folio) || 0) - (Number(b.folio) || 0)
      return orden.dir === 'desc' ? -r : r
    })
    return arr
  }, [comprasFiltradas, orden]) // eslint-disable-line

  // Plan de cuentas: lo que devuelva el endpoint y, si no lo devuelve, las cuentas que
  // ya se usan en el historico. Asi el buscador sirve desde el primer dia.
  const plan = useMemo(() => {
    if (planApi.length) return planApi
    const m = new Map()
    for (const c of compras) {
      const t = String(c.cuenta || '').trim()
      const mm = t.match(/^([0-9]{4}-[0-9]{2})\s*(.*)$/)
      if (mm && !m.has(mm[1])) m.set(mm[1], mm[2] || '')
    }
    return Array.from(m.entries()).map(([codigo, descripcion]) => ({ codigo, descripcion }))
      .sort((a, b) => a.codigo.localeCompare(b.codigo))
  }, [planApi, compras])

  const planMap = useMemo(() => {
    const m = {}
    for (const c of plan) m[c.codigo] = c.descripcion
    return m
  }, [plan])

  // Memoria por RUT: mismo criterio que la de la base (unanime y >= 2 antecedentes).
  const memoriaRut = useMemo(() => {
    const acc = {}
    for (const c of compras) {
      const rut = String(c.rut || '').trim()
      const cod = String(c.cuenta || '').trim().match(/^[0-9]{4}-[0-9]{2}/)
      if (!rut || !cod) continue
      const e = acc[rut] || (acc[rut] = { ctas: {}, n: 0 })
      e.ctas[cod[0]] = (e.ctas[cod[0]] || 0) + 1
      e.n++
    }
    const out = {}
    for (const [rut, e] of Object.entries(acc)) {
      const pares = Object.entries(e.ctas)
      if (pares.length === 1 && e.n >= 2) out[rut] = pares[0][0]
    }
    return out
  }, [compras])

  // "4201-41" -> "4201-41 · TELEFONO E INTERNET". Si no esta en el plan, se dice:
  // ahi se detectan los codigos mal escritos sin cruzar nada.
  const describeCuenta = (v) => {
    const t = String(v || '').trim()
    if (!t) return undefined
    const cod = (t.match(/^[0-9]{4}-[0-9]{2}(-[0-9]{2})?/) || [''])[0]
    if (!cod) return t
    const d = planMap[cod] || planMap[cod.slice(0, 7)]
    return d ? `${cod} · ${d}` : `${cod} · (no está en el plan de cuentas)`
  }

  const abrir = (v) => { setSel(v); setSavedFlag(false); setEdit({ ccb: v.ccb || '', cuenta: v.cuenta || '', pagado_por: v.pagado_por || '', estado: v.estado || '', glosa: v.glosa || '' }) }
  const cerrar = () => { setSel(null) }
  const guardar = async () => {
    if (!sel) return; setSaving(true)
    try {
      const res = await fetch('/api/financiero/compras', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: sel.id, ...edit }) })
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || 'No se pudo guardar'); return }
      setSavedFlag(true)
      // Se actualiza SOLO esta compra: recargar la lista entera hacia perder la
      // posicion del scroll y volver al principio, inviable para clasificar en serie.
      const patch = {
        ccb: (edit.ccb || '').trim() || null, cuenta: (edit.cuenta || '').trim() || null,
        pagado_por: (edit.pagado_por || '').trim() || null,
        estado: (edit.estado || '').trim() || null, glosa: (edit.glosa || '').trim() || null,
        origen_clasificacion: 'manual',   // lo marca el trigger en la base
      }
      setCompras(prev => prev.map(c => c.id === sel.id ? { ...c, ...patch } : c))
      setSel(sv => sv ? { ...sv, ...patch } : sv)
    } finally { setSaving(false) }
  }
  const handleFile = async (file) => {
    if (!file) return
    if (!canEdit) { setUploadMsg({ error: 'No tienes permiso para cargar.' }); return }
    setUploading(true); setUploadMsg(null)
    try {
      let parsed, archivo, extra = ''
      if (/\.csv$/i.test(file.name)) {
        const r = await parseComprasSII(file)
        parsed = r.compras; archivo = r.archivo
        extra = ` · SII tipo ${r.tipoDoc}, periodo ${r.mes}` + (r.saltadas ? `, ${r.saltadas} fila(s) ilegible(s)` : '')
      } else {
        const XLSX = await import('xlsx')
        const r = await parseCompras(file, XLSX)
        parsed = r.compras; archivo = r.archivo
      }
      if (!parsed.length) { setUploadMsg({ error: 'No encontré compras en el archivo.' }); return }
      const res = await fetch('/api/financiero/compras', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ compras: parsed, archivo }) })
      const d = await res.json()
      if (!res.ok) { setUploadMsg({ error: d.error || 'No se pudo cargar.' }); return }
      setUploadMsg({ text: `${d.nuevas} compra(s) nueva(s), ${d.duplicadas} ya estaban, ${d.total} en el archivo.` + extra })
      fetch('/api/financiero/compras').then(r => r.json()).then(x => setMeses(x.meses || [])).catch(() => {})
      cargar()
    } catch (err) { setUploadMsg({ error: String(err?.message || err) }) } finally { setUploading(false) }
  }
  handleFileRef.current = handleFile
  const onFileInput = (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) handleFile(f) }

  useEffect(() => {
    const over = (e) => { if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) { e.preventDefault(); setDragOver(true) } }
    const leave = (e) => { if (e.clientX <= 0 && e.clientY <= 0) setDragOver(false) }
    const drop = (e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer?.files?.[0]; if (f) handleFileRef.current?.(f) }
    const paste = (e) => { const f = e.clipboardData?.files?.[0]; if (f) { e.preventDefault(); handleFileRef.current?.(f) } }
    window.addEventListener('dragover', over); window.addEventListener('dragleave', leave); window.addEventListener('drop', drop); window.addEventListener('paste', paste)
    return () => { window.removeEventListener('dragover', over); window.removeEventListener('dragleave', leave); window.removeEventListener('drop', drop); window.removeEventListener('paste', paste) }
  }, [])

  if (status === 'loading') return (<><TopNav /><div style={{ padding: 60, textAlign: 'center', color: '#888', fontSize: 14 }}>Cargando…</div></>)
  const inp = { fontSize: 13, padding: '7px 9px', borderRadius: 7, border: '0.5px solid #D3D1C7', boxSizing: 'border-box', width: '100%' }

  return (
    <>
      <TopNav />
      <FinancieroNav activo="compras" />
      {dragOver && canEdit && (
        <div data-overlay="1" style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(29,158,117,0.10)', border: '3px dashed #1D9E75', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ background: '#fff', padding: '16px 26px', borderRadius: 12, fontSize: 15, fontWeight: 700, color: '#085041', boxShadow: '0 8px 30px rgba(0,0,0,0.15)' }}>⬆ Suelta el archivo para cargar</div>
        </div>
      )}
      <FinancieroHeader
        titulo="Compras"
        subtitulo="Compras del mes con Centro de Coste/Beneficio"
        onOffset={setTopTabla}
        derecha={<>
          <div style={{ display: 'flex', border: '0.5px solid #D3D1C7', borderRadius: 8, overflow: 'hidden' }}>
            {[['continua', 'Continua'], ['mensual', 'Mensual']].map(([v, lbl]) => (
              <button key={v} onClick={() => setModo(v)} style={{ fontSize: 12, padding: '6px 11px', border: 'none', cursor: 'pointer', background: modo === v ? '#1D9E75' : '#fff', color: modo === v ? '#fff' : '#2C2C2A', fontWeight: modo === v ? 600 : 400 }}>{lbl}</button>
            ))}
          </div>
          {modo === 'mensual' && (
            <select value={mesSel || ''} onChange={e => setMesSel(e.target.value)} style={{ fontSize: 13, padding: '6px 9px', borderRadius: 8, border: '0.5px solid #D3D1C7', background: '#fff', color: '#2C2C2A' }}>
              {meses.map(m => <option key={m.mes} value={m.mes}>{mesLabel(m.mes)} ({m.n})</option>)}
            </select>
          )}
        </>}
        acciones={<>
          <button onClick={() => fileRef.current?.click()} disabled={!canEdit || uploading} title={canEdit ? 'Excel del Libro de Compra, o CSV del Registro de Compras del SII (RCV_COMPRA_...)' : 'Sin permiso'} style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: 'none', background: (!canEdit || uploading) ? '#B4D8CB' : '#1D9E75', color: '#fff', cursor: (!canEdit || uploading) ? 'default' : 'pointer' }}>⬆ {uploading ? 'Procesando…' : 'Cargar compras del mes'}</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={onFileInput} style={{ display: 'none' }} />
          {canEdit && <span style={{ fontSize: 11, color: '#B4B2A9' }}>o arrastra / pega el Excel, o los CSV del SII (uno por tipo)</span>}
        </>}
        metricas={[
          { label: 'Compras', valor: resumen.n },
          { label: 'Neto', valor: clp(resumen.neto) },
          { label: 'IVA', valor: clp(resumen.iva) },
          { label: 'Total', valor: clp(resumen.total), color: '#B23A3A' },
          { label: 'Sin CCB', valor: resumen.revisar, color: resumen.revisar ? '#B23A3A' : '#888780' },
          { label: 'Sin clasificar', valor: resumen.sinClas, color: resumen.sinClas ? '#9A6E00' : '#888780' },
          { label: 'Sugeridas sin revisar', valor: resumen.auto, color: resumen.auto ? '#9A6E00' : '#888780' },
          ...(resumen.rech ? [{ label: 'No son de FCR', valor: `${resumen.rech} · ${clp(resumen.totalRech)}`, color: '#B23A3A' }] : []),
          ...(resumen.rech ? [{ label: 'Total según SII', valor: clp(resumen.totalSii), color: '#888780' }] : []),
        ]}
        mensajes={<>
          {uploadMsg && (
            <div style={{ marginBottom: 8, fontSize: 12, padding: '7px 11px', borderRadius: 8, background: uploadMsg.error ? '#FBE9E7' : '#F3FBF8', border: `0.5px solid ${uploadMsg.error ? '#F0C9C2' : '#CDEBDF'}`, color: uploadMsg.error ? '#B23A3A' : '#085041' }}>{uploadMsg.error || uploadMsg.text}</div>
          )}
        </>}
      />

      <div style={{ maxWidth: 1180, margin: '0 auto', padding: isMobile ? '12px 8px 40px' : '14px 24px 48px' }}>

        <div style={{ border: '0.5px solid #E0DED6', borderRadius: 10, overflow: 'visible', background: '#fff' }}>
          <div style={{ position: 'sticky', top: topTabla, zIndex: 16, display: 'grid', gridTemplateColumns: GRID, background: '#F1EFE9', borderBottom: '0.5px solid #E0DED6', padding: '9px 12px', fontSize: 11, fontWeight: 600, color: '#888780' }}>
            {COLDEFS.map(c => (<div key={c.key} style={{ textAlign: c.align, display: 'flex', justifyContent: c.align === 'right' ? 'flex-end' : c.align === 'center' ? 'center' : 'flex-start', alignItems: 'center', paddingRight: c.align === 'right' ? 10 : 0 }}><span>{c.label}</span>{c.filter && <HeaderFilter col={c} movs={compras} state={filters[c.key]} setState={(v) => setFilters(f => ({ ...f, [c.key]: v }))} open={openFilter} setOpen={setOpenFilter} orden={orden} setOrden={setOrden} />}</div>))}
          </div>
          {loading ? (<div style={{ padding: 30, textAlign: 'center', color: '#888', fontSize: 13 }}>Cargando…</div>
          ) : comprasVista.length === 0 ? (<div style={{ padding: 30, textAlign: 'center', color: '#888', fontSize: 13 }}>Sin compras para este filtro.</div>
          ) : comprasVista.map(v => (
            <div key={v.id} onClick={() => abrir(v)}
              title={esRechazada(v) ? (v.glosa || 'No es de FCR · se conserva para cuadrar con el SII') : undefined}
              style={{ display: 'grid', gridTemplateColumns: GRID, padding: '8px 12px', fontSize: 13, color: esRechazada(v) ? '#9C6B66' : '#2C2C2A', background: esRechazada(v) ? '#FBE9E7' : '#fff', borderBottom: '0.5px solid #F0EFEA', cursor: 'pointer', alignItems: 'center' }}
              onMouseEnter={e => e.currentTarget.style.background = esRechazada(v) ? '#F7DEDB' : '#FAFAF7'}
              onMouseLeave={e => e.currentTarget.style.background = esRechazada(v) ? '#FBE9E7' : '#fff'}>
              <div style={{ fontWeight: 600, color: '#0C447C' }}>{v.folio}</div>
              <div style={{ color: '#888780', fontSize: 12 }}>{fmtFecha(v.fecha)}</div>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>{v.proveedor || <span style={{ color: '#B4B2A9' }}>—</span>}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <CcbChip ccb={v.ccb} />
                {v.origen_clasificacion === 'auto' && (
                  <span title="Lo puso la memoria por RUT · pendiente de revisar" style={{ color: '#9A6E00', fontSize: 13, lineHeight: 1 }}>•</span>
                )}
              </div>
              <div style={{ fontSize: 11, color: '#4A4A46', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                title={describeCuenta(v.cuenta)}>
                {(String(v.cuenta || '').trim().match(/^[0-9]{4}-[0-9]{2}(-[0-9]{2})?/) || [''])[0] || <span style={{ color: '#D3D1C7' }}>—</span>}
              </div>
              <div style={{ fontSize: 12, color: '#888780' }}>{v.pagado_por || '—'}</div>
              <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#888780', textDecoration: esRechazada(v) ? 'line-through' : 'none' }}>{clp(v.neto)}</div>
              <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#888780', textDecoration: esRechazada(v) ? 'line-through' : 'none' }}>{clp(v.iva)}</div>
              <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 500, textDecoration: esRechazada(v) ? 'line-through' : 'none' }}>{clp(v.total)}</div>
              <div>
                {esRechazada(v)
                  ? <span title={v.glosa || undefined} style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: '#F7DEDB', color: '#B23A3A', border: '0.5px solid #F0C9C2' }}>No es de FCR</span>
                  : estaClasificada(v)
                    ? <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: '#E1F5EE', color: '#085041' }}>Clasificada</span>
                    : <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: '#FDF6E3', color: '#9A6E00' }}>Sin clasificar</span>}
              </div>
            </div>
          ))}
        </div>
        {resumen.rech > 0 && (
          <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.5, padding: '9px 12px', borderRadius: 8, background: '#FBE9E7', border: '0.5px solid #F0C9C2', color: '#8C4A44' }}>
            <strong style={{ color: '#B23A3A' }}>Las {resumen.rech} filas en rojo no son de FCR</strong> y <strong>no entran en la contabilidad</strong>:
            ni en el gasto, ni en el IVA, ni en CONTAB. Se conservan a propósito porque el SII sí las tiene
            en el Registro de Compras; si desaparecieran, el cuadre mensual contra el SII no daría nunca.
            Por eso arriba se ven dos cifras: el <strong>Total</strong> es el de FCR y el
            <strong> Total según SII</strong> incluye estas {clp(resumen.totalRech)}.
          </div>
        )}
        <div style={{ fontSize: 11, color: '#B4B2A9', marginTop: 8 }}>{modo === 'mensual' && mesSel ? `${mesLabel(mesSel)}  ·  ` : (modo === 'continua' ? 'Todas las compras  ·  ' : '')}{comprasVista.length} de {compras.length} compras. Pincha una para revisar/editar.</div>
      </div>

      {sel && (<>
        <div onClick={cerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.28)', zIndex: 9000 }} />
        <div style={{ position: 'fixed', top: 0, right: 0, height: '100vh', width: isMobile ? '100%' : 460, maxWidth: '100%', background: '#fff', zIndex: 9001, boxShadow: '-4px 0 24px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 18px', borderBottom: '0.5px solid #E0DED6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: '#888780' }}>{sel.tipo_doc || 'Compra'} · Folio {sel.folio} · {fmtFecha(sel.fecha)}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#2C2C2A', marginTop: 2 }}>{sel.proveedor || '—'}</div>
                <div style={{ fontSize: 12, color: '#888780', marginTop: 2 }}>{sel.rut || ''}</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: '#B23A3A' }}>{clp(sel.total)}</div>
                <div style={{ fontSize: 12, color: '#888780', marginTop: 2 }}>Neto {clp(sel.neto)} · IVA {clp(sel.iva)}</div>
              </div>
              <button onClick={cerrar} style={{ border: 'none', background: 'transparent', fontSize: 22, cursor: 'pointer', color: '#888780', lineHeight: 1 }}>×</button>
            </div>
            {!canEdit && <div style={{ marginTop: 8, fontSize: 12, color: '#888780', background: '#F7F6F2', padding: '6px 10px', borderRadius: 6 }}>Solo lectura.</div>}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ fontSize: 12, color: '#888780' }}>CCB<input list="ccb-list-c" value={edit.ccb} disabled={!canEdit} onChange={e => setEdit(x => ({ ...x, ccb: e.target.value }))} style={{ ...inp, marginTop: 4 }} /></label>
            <label style={{ fontSize: 12, color: '#888780' }}>Pagado por<input list="pag-list-c" value={edit.pagado_por} disabled={!canEdit} onChange={e => setEdit(x => ({ ...x, pagado_por: e.target.value }))} style={{ ...inp, marginTop: 4 }} /></label>
            <label style={{ fontSize: 12, color: '#888780' }}>Cuenta
              <div style={{ marginTop: 4 }}>
                <CuentaSelector
                  valor={edit.cuenta}
                  plan={plan}
                  disabled={!canEdit}
                  formato="codigo+desc"
                  sugerida={sel ? (memoriaRut[String(sel.rut || '').trim()] || null) : null}
                  onChange={v => setEdit(x => ({ ...x, cuenta: v }))}
                  estilo={{ ...inp, width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            </label>
            <label style={{ fontSize: 12, color: '#888780' }}>Estado<input value={edit.estado} disabled={!canEdit} onChange={e => setEdit(x => ({ ...x, estado: e.target.value }))} style={{ ...inp, marginTop: 4 }} /></label>
            <label style={{ fontSize: 12, color: '#888780' }}>Glosa<input value={edit.glosa} disabled={!canEdit} onChange={e => setEdit(x => ({ ...x, glosa: e.target.value }))} style={{ ...inp, marginTop: 4 }} /></label>
            <datalist id="ccb-list-c">{CCB_SUGERIDOS.map(c => <option key={c} value={c} />)}</datalist>
            <datalist id="pag-list-c">{PAGADO_SUGERIDOS.map(c => <option key={c} value={c} />)}</datalist>
          </div>
          {canEdit && (<div style={{ borderTop: '0.5px solid #E0DED6', padding: '12px 18px' }}>
            <button onClick={guardar} disabled={saving} style={{ width: '100%', fontSize: 14, fontWeight: 600, padding: '10px', borderRadius: 8, border: 'none', cursor: saving ? 'default' : 'pointer', background: '#1D9E75', color: '#fff', opacity: saving ? 0.7 : 1 }}>{saving ? 'Guardando…' : 'Guardar'}</button>
            {savedFlag && <div style={{ textAlign: 'center', fontSize: 12, color: '#085041', marginTop: 6 }}>✓ Guardado</div>}
          </div>)}
        </div>
      </>)}
    </>
  )
}