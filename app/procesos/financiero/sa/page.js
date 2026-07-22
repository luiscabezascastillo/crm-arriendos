// VERSION: v16 · 2026-07-22 · Filtros reescritos contra la especificación funcional:
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

const EDITORES = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']
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
  if (hi < 0) throw new Error('No encontré la cabecera (columna MONTO). ¿Es un extracto del Santander?')
  const flat = rows.slice(0, hi + 1).map(r => (r || []).map(c => c == null ? '' : String(c)).join('  ')).join('  ')
  const nroM = flat.match(/N[uú]mero cartola:\s*(\d+)/i)
  const desde = fechaISO((flat.match(/Fecha desde:\s*([\d/]+)/i) || [])[1])
  const hasta = fechaISO((flat.match(/Fecha hasta:\s*([\d/]+)/i) || [])[1])
  const tipo = (/provisori/i.test(flat) || /provisori/i.test(file.name)) ? 'provisoria' : 'definitiva'
  let saldo_inicial = null
  for (let i = 0; i < hi; i++) {
    const r = rows[i] || []
    const idx = r.findIndex(c => String(c).trim().toUpperCase() === 'SALDO INICIAL')
    if (idx >= 0) { const v = (rows[i + 1] || [])[idx]; if (v != null && v !== '' && !isNaN(Number(v))) saldo_inicial = Math.round(Number(v)); break }
  }
  const movimientos = []
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i] || []
    const monto = Number(r[0]); const f = fechaISO(r[3])
    if (r[0] == null || r[0] === '' || isNaN(monto) || !f) continue   // excluye saldos diarios y filas sin fecha
    const ca = String(r[7] == null ? '' : r[7]).trim().toUpperCase().slice(0, 1)
    movimientos.push({ fecha: f, monto: Math.round(monto), descripcion: cellStr(r[1]), n_documento: cellStr(r[4]), sucursal: cellStr(r[5]), cargo_abono: (ca === 'C' || ca === 'A') ? ca : null })
  }
  const periodo = hasta ? hasta.slice(0, 7) : (desde ? desde.slice(0, 7) : null)
  return { nro_cartola: nroM ? Number(nroM[1]) : null, tipo, periodo, fecha_desde: desde, fecha_hasta: hasta, saldo_inicial, archivo: file.name, movimientos }
}

// Cada columna declara: cómo se pinta (get), qué clave usa el filtro (fkey), cómo se etiqueta
// ese valor en la lista (flabel) y de qué tipo es, para ordenar la lista y ofrecer condiciones.
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
  { key: 'cargo_abono', label: 'C/A', w: '46px', align: 'center', tipo: 'texto',
    get: m => m.cargo_abono || '',
    fkey: m => m.cargo_abono || '', flabel: k => (k === '' ? '(vacías)' : k) },
  { key: 'estado_clasificacion', label: 'Estado', w: '116px', align: 'center', tipo: 'texto',
    get: m => m.estado_clasificacion,
    fkey: m => m.estado_clasificacion || '', flabel: k => (k === '' ? '(vacías)' : (ESTADO[k]?.label || k)) },
]
const GRID = COLDEFS.map(c => c.w).join(' ')
const DGRID = '80px 76px 108px 1fr 90px 90px 26px'  // drawer: folio-sub · CCB · cantidad · concepto · cta1 · cta2 · x

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
  const yaFiltrado = Array.isArray(state?.sel)

  useEffect(() => {
    if (!abierto) return
    const inicial = new Set(Array.isArray(state?.sel) ? state.sel : valores)
    setDraft(inicial); setBase(inicial); setAnadir(false); setBusca('')
    setC1(state?.c1 || vacio); setC2(state?.c2 || vacio); setConector(state?.conector || 'Y')
    setVerCond(condPuesta(state?.c1) || condPuesta(state?.c2))
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
  const [loading, setLoading] = useState(false)

  const [filters, setFilters] = useState({})   // { colKey: {text, sel[]} }
  const [openFilter, setOpenFilter] = useState(null)
  const [orden, setOrden] = useState(null)      // { key, dir } — ordenación tipo Excel
  const [verCCB, setVerCCB] = useState(false)
  const [copiado, setCopiado] = useState(false)

  const [sel, setSel] = useState(null)
  const [lineas, setLineas] = useState([])
  const [savedFlag, setSavedFlag] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDesc, setConfirmDesc] = useState(false)

  const canEdit = EDITORES.includes(session?.user?.email)
  const contentRef = useRef(null)
  const toolbarRef = useRef(null)
  const wantScroll = useRef(false)
  const [stickyTop, setStickyTop] = useState(0)
  const [toolbarH, setToolbarH] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState(null); const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef(null); const handleFileRef = useRef(null)

  // Medir la altura del TopNav (elemento anterior) para fijar la cabecera justo debajo, sin taparla.
  useEffect(() => {
    const medir = () => {
      const prev = contentRef.current?.previousElementSibling
      if (prev) {
        const pos = window.getComputedStyle(prev).position
        setStickyTop((pos === 'fixed' || pos === 'sticky') ? Math.round(prev.getBoundingClientRect().height) : 0)
      }
    }
    medir(); window.addEventListener('resize', medir)
    const t = setTimeout(medir, 300)
    return () => { window.removeEventListener('resize', medir); clearTimeout(t) }
  }, [status])

  // Altura de la toolbar fija (para anclar la cabecera de la tabla justo debajo).
  useEffect(() => {
    const m = () => { if (toolbarRef.current) setToolbarH(Math.round(toolbarRef.current.getBoundingClientRect().height)) }
    m(); window.addEventListener('resize', m)
    const t = setTimeout(m, 350)
    return () => { window.removeEventListener('resize', m); clearTimeout(t) }
  }, [status, modo, isMobile, uploadMsg])

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
    setLoading(true)
    fetch(url).then(r => r.json()).then(d => {
      const marcas = {}
      for (const k of (d.marcas || [])) marcas[k.movimiento_id] = k
      setMovs((d.movimientos || []).map(m => ({ ...m, ...(marcas[m.id] || {}) })))
      const map = {}
      for (const l of (d.lineas || [])) { (map[l.movimiento_id] = map[l.movimiento_id] || []).push(l) }
      setLineasByMov(map)
      if (wantScroll.current) { wantScroll.current = false; setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' }), 90) }
    }).finally(() => setLoading(false))
  }
  useEffect(() => {
    if (status === 'authenticated' && (modo === 'continua' || cargaId)) { wantScroll.current = true; cargar() }
  }, [modo, cargaId, status]) // eslint-disable-line

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

  const abrir = (m) => { setSel(m); setSavedFlag(false); setConfirmDesc(false); setLineas((lineasByMov[m.id] || []).map(l => ({ ...l }))) }
  const cerrar = () => { setSel(null); setLineas([]); setConfirmDesc(false) }
  const setLinea = (i, campo, val) => setLineas(ls => ls.map((l, k) => k === i ? { ...l, [campo]: val } : l))
  const addLinea = () => setLineas(ls => [...ls, { sub_orden: ls.length + 1, monto: '', ccb: '', cuenta_1: '', cuenta_2: '', concepto: '' }])
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
        lineas: lineas.filter(l => l.monto !== '' && l.monto != null).map((l, i) => ({
          sub_orden: i + 1, monto: Math.abs(Math.round(Number(l.monto))),
          ccb: (l.ccb || '').trim() || null, cuenta_1: (l.cuenta_1 || '').trim() || null,
          cuenta_2: (l.cuenta_2 || '').trim() || null, concepto: (l.concepto || '').trim() || null,
        })),
      }
      const res = await fetch('/api/financiero/sa', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || 'No se pudo guardar'); return }
      setSavedFlag(true); setConfirmDesc(false); cargar()
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
      if (!payload.nro_cartola) { setUploadMsg({ error: 'No pude leer el número de cartola del archivo.' }); return }
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
      {dragOver && canEdit && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(29,158,117,0.10)', border: '3px dashed #1D9E75', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ background: '#fff', padding: '16px 26px', borderRadius: 12, fontSize: 15, fontWeight: 700, color: '#085041', boxShadow: '0 8px 30px rgba(0,0,0,0.15)' }}>⬆ Suelta el archivo para cargar</div>
        </div>
      )}
      <div ref={contentRef} style={{ maxWidth: 1180, margin: '0 auto', padding: isMobile ? '16px 8px 40px' : '20px 24px 48px' }}>

        {/* TOOLBAR FIJA */}
        <div ref={toolbarRef} style={{ position: 'sticky', top: stickyTop, zIndex: 18, background: '#fff', paddingTop: 6, paddingBottom: 10, marginBottom: 8, borderBottom: '0.5px solid #ECEAE3' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontSize: isMobile ? 18 : 20, fontWeight: 600, margin: '0 0 2px', color: '#2C2C2A' }}>SA · Banco Santander</h1>
              <div style={{ fontSize: 12, color: '#888780' }}>Movimientos y clasificación por Centro de Coste/Beneficio</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', border: '0.5px solid #D3D1C7', borderRadius: 8, overflow: 'hidden' }}>
                {[['continua', 'Continua'], ['cartola', 'Por cartola']].map(([v, lbl]) => (
                  <button key={v} onClick={() => setModo(v)} style={{ fontSize: 12, padding: '7px 12px', border: 'none', cursor: 'pointer', background: modo === v ? '#1D9E75' : '#fff', color: modo === v ? '#fff' : '#2C2C2A', fontWeight: modo === v ? 600 : 400 }}>{lbl}</button>
                ))}
              </div>
              {modo === 'cartola' && (
                <select value={cargaId || ''} onChange={e => setCargaId(Number(e.target.value))} style={{ fontSize: 13, padding: '7px 10px', borderRadius: 8, border: '0.5px solid #D3D1C7', background: '#fff', color: '#2C2C2A' }}>
                  {cargas.map(c => <option key={c.id} value={c.id}>Cartola {c.nro_cartola} · {c.periodo}{c.tipo === 'provisoria' ? ' (prov.)' : ''}</option>)}
                </select>
              )}
              <button onClick={() => router.push('/procesos/financiero')} style={{ fontSize: 12, padding: '7px 12px', borderRadius: 8, border: '0.5px solid #D3D1C7', background: '#fff', cursor: 'pointer', color: '#2C2C2A', whiteSpace: 'nowrap' }}>← Financiero</button>
            </div>
          </div>
          {/* BOTONES DE ACCIÓN (izquierda) */}
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={() => fileRef.current?.click()} disabled={!canEdit || uploading}
              title={canEdit ? 'Subir, arrastrar o pegar el extracto del Santander (provisoria o mensual)' : 'Sin permiso para cargar'}
              style={{ fontSize: 12, fontWeight: 600, padding: '8px 15px', borderRadius: 8, border: 'none', background: (!canEdit || uploading) ? '#B4D8CB' : '#1D9E75', color: '#fff', cursor: (!canEdit || uploading) ? 'default' : 'pointer' }}>⬆ {uploading ? 'Procesando…' : 'Cargar extracto'}</button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={onFileInput} style={{ display: 'none' }} />
            {canEdit && <span style={{ fontSize: 11, color: '#B4B2A9' }}>o arrastra / pega el archivo Excel del extracto</span>}
            <button disabled title="Por definir" style={{ fontSize: 12, padding: '8px 14px', borderRadius: 8, border: '0.5px dashed #D3D1C7', background: '#FAFAF7', color: '#B4B2A9', cursor: 'default' }}>· · ·</button>
            <button disabled title="Por definir" style={{ fontSize: 12, padding: '8px 14px', borderRadius: 8, border: '0.5px dashed #D3D1C7', background: '#FAFAF7', color: '#B4B2A9', cursor: 'default' }}>· · ·</button>
          </div>
          {uploadMsg && (
            <div style={{ marginTop: 8, fontSize: 12, padding: '8px 12px', borderRadius: 8,
              background: uploadMsg.error ? '#FBE9E7' : '#F3FBF8', border: `0.5px solid ${uploadMsg.error ? '#F0C9C2' : '#CDEBDF'}`, color: uploadMsg.error ? '#B23A3A' : '#085041' }}>
              {uploadMsg.error || uploadMsg.text}
            </div>
          )}
        </div>

        {/* RESUMEN */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <Card label="Movimientos" value={resumen.n} />
          <Card label="Cuadrados" value={resumen.cuad} color="#085041" />
          <Card label="Sin clasificar" value={resumen.sin} color="#888780" />
          <Card label="Descuadrados" value={resumen.desc} color="#B23A3A" />
          <Card label="Cargos" value={clp(resumen.cargos)} color="#B23A3A" />
          <Card label="Abonos" value={clp(resumen.abonos)} color="#085041" />
        </div>

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
          <div style={{ position: 'sticky', top: stickyTop + toolbarH, zIndex: 16, display: 'grid', gridTemplateColumns: GRID, background: '#F1EFE9', borderBottom: '0.5px solid #E0DED6', padding: '9px 12px', fontSize: 11, fontWeight: 600, color: '#888780' }}>
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
                  <div /><div />
                </div>
              )}
              {movsFiltrados.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: '#888', fontSize: 13 }}>Sin movimientos para este filtro.</div>
              ) : movsFiltrados.map(m => {
                const desg = lineasByMov[m.id] || []
                return (
                  <div key={m.id}>
                    <div onClick={() => abrir(m)} style={{ display: 'grid', gridTemplateColumns: GRID, padding: '8px 12px', fontSize: 13, color: '#2C2C2A', borderBottom: desg.length ? 'none' : '0.5px solid #F0EFEA', cursor: 'pointer', alignItems: 'center', background: m.color_fondo || '#fff' }}
                      onMouseEnter={e => e.currentTarget.style.background = m.color_fondo ? '#FBD9B4' : '#FAFAF7'}
                      onMouseLeave={e => e.currentTarget.style.background = m.color_fondo || '#fff'}>
                      <div style={{ fontWeight: 600, color: '#0C447C', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span>{folioVisible(m) ?? '—'}</span>
                        {m.nota_auditoria && (
                          <span title={m.nota_auditoria} style={{ cursor: 'help', color: '#B26B00', fontSize: 12 }}>⚠</span>
                        )}
                      </div>
                      <div style={{ color: '#888780', fontSize: 12 }}>{fmtFecha(m.fecha)}</div>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>{m.descripcion || <span style={{ color: '#B4B2A9' }}>—</span>}</div>
                      <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: m.monto < 0 ? '#B23A3A' : '#085041', fontWeight: 500 }}>{clp(m.monto)}</div>
                      <div title={hayFiltro ? 'El saldo es corrido sobre TODOS los movimientos, no sobre el filtro' : undefined}
                        style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: hayFiltro ? '#D3D1C7' : '#888780' }}>{clp(m.saldo_calc)}</div>
                      <div style={{ textAlign: 'center', color: '#888780', fontSize: 12 }}>{m.cargo_abono || '—'}</div>
                      <div style={{ textAlign: 'center' }}><Chip estado={m.estado_clasificacion} /></div>
                    </div>
                    {desg.map((l, k) => (
                      <div key={l.id ?? k} onClick={() => abrir(m)} style={{ display: 'grid', gridTemplateColumns: GRID, padding: '4px 12px', fontSize: 12, color: '#6b6b66', background: m.color_fondo ? '#FEF1E2' : '#FCFCFA', borderBottom: k === desg.length - 1 ? '0.5px solid #F0EFEA' : 'none', cursor: 'pointer', alignItems: 'center' }}>
                        <div style={{ color: '#9a988f', paddingLeft: 8 }}>{subFolio(folioVisible(m), l.sub_orden)}</div>
                        <div />
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
                          {l.ccb && <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 20, background: '#EEF3F8', color: '#0C447C', marginRight: 6 }}>{l.ccb}</span>}
                          {l.concepto || l.cuenta_1 || '—'}
                        </div>
                        <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{clp(l.monto)}</div>
                        <div /><div /><div />
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
                  <div /><div />
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

      {/* DRAWER (edición como tabla compacta) */}
      {sel && (
        <>
          <div onClick={cerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.28)', zIndex: 40 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, height: '100vh', width: isMobile ? '100%' : 'clamp(640px, 66vw, 1120px)', maxWidth: '100%', background: '#fff', zIndex: 41, boxShadow: '-4px 0 24px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px 18px', borderBottom: '0.5px solid #E0DED6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#888780' }}>Folio {sel.orden ?? '—'} · {fmtFecha(sel.fecha)}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#2C2C2A', marginTop: 2 }}>{sel.descripcion || '—'}</div>
                  <div style={{ fontSize: 19, fontWeight: 700, marginTop: 3, color: sel.monto < 0 ? '#B23A3A' : '#085041' }}>{clp(sel.monto)}</div>
                </div>
                <button onClick={cerrar} style={{ border: 'none', background: 'transparent', fontSize: 22, cursor: 'pointer', color: '#888780', lineHeight: 1 }}>×</button>
              </div>
              {!canEdit && <div style={{ marginTop: 8, fontSize: 12, color: '#888780', background: '#F7F6F2', padding: '6px 10px', borderRadius: 6 }}>Solo lectura · no tienes permiso para editar.</div>}
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '12px 18px' }}>
              <div style={{ minWidth: 620 }}>
                {/* cabecera tabla */}
                <div style={{ display: 'grid', gridTemplateColumns: DGRID, gap: 6, fontSize: 10, fontWeight: 600, color: '#888780', padding: '0 2px 6px' }}>
                  <div>Folio</div><div>CCB</div><div style={{ textAlign: 'right' }}>Cantidad</div><div>Concepto</div><div>Cuenta 1</div><div>Cuenta 2</div><div />
                </div>
                {lineas.length === 0 && <div style={{ fontSize: 13, color: '#B4B2A9', padding: '8px 2px' }}>Sin líneas. {canEdit && 'Añade una para clasificar.'}</div>}
                {lineas.map((l, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: DGRID, gap: 6, alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontSize: 11, color: '#9a988f' }}>{subFolio(folioVisible(sel), i + 1)}</div>
                    <input list="ccb-list" value={l.ccb || ''} disabled={!canEdit} onChange={e => setLinea(i, 'ccb', e.target.value)} style={inp} />
                    <input type="number" value={l.monto} disabled={!canEdit} onChange={e => setLinea(i, 'monto', e.target.value)} style={{ ...inp, textAlign: 'right' }} />
                    <input value={l.concepto || ''} disabled={!canEdit} onChange={e => setLinea(i, 'concepto', e.target.value)} style={inp} />
                    <input value={l.cuenta_1 || ''} disabled={!canEdit} onChange={e => setLinea(i, 'cuenta_1', e.target.value)} style={inp} />
                    <input value={l.cuenta_2 || ''} disabled={!canEdit} onChange={e => setLinea(i, 'cuenta_2', e.target.value)} style={inp} />
                    {canEdit ? <button onClick={() => delLinea(i)} title="Quitar" style={{ border: '0.5px solid #E7C9C4', background: '#fff', color: '#B23A3A', borderRadius: 5, cursor: 'pointer', height: 28, fontSize: 14 }}>×</button> : <div />}
                  </div>
                ))}
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
