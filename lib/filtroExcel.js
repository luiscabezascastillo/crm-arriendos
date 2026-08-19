// VERSION: v4 · 2026-08-18 · FIX buscador numérico: en columnas 'num', la etiqueta puede llevar separador de miles
//   (folio 4938 → "4.938"), así que buscar "4938" no casaba. Ahora el buscador compara también sin separadores
//   (solo dígitos), así funcionan folio y montos. No cambia el filtro de texto/fecha. Hereda v3.
// VERSION: v3 · 2026-08-11 · FIX etiquetas invisibles: el desplegable se pinta dentro de la cabecera de la tabla y
//   HEREDABA el color del texto de esa cabecera. En tablas con cabecera de texto BLANCO (p.ej. Descuentos) las
//   etiquetas de valores y "(Seleccionar todo)" salían en blanco sobre blanco. Se fija color:#2C2C2A en el contenedor
//   del menú. No afecta a CC1/SA/LOG (allí ya era oscuro). Hereda v2.
// VERSION: v2 · 2026-08-11 · HeaderFilter admite prop `flotante`: pinta el desplegable en position:fixed (posición
//   calculada desde el botón) para que NO lo recorte un contenedor con overflow (p.ej. la tabla de Descuentos, con
//   scroll horizontal). SIN el prop, comportamiento idéntico (position:absolute) → CC1 / SA / LOG no cambian. Hereda v1.
// lib/filtroExcel.js — Motor de filtro estilo Excel, extraído del módulo SA (page v22) para
//   reutilizarlo en el LOG y donde haga falta. Casillas + buscador que marca solo resultados +
//   'añadir a la selección' + árbol de fechas + operadores (texto/número/fecha) con dos
//   condiciones Y/O. Trabaja en memoria sobre las filas ya cargadas.
//
// Cada columna declara: { key, label, tipo:'texto'|'num'|'fecha', fkey:(fila)=>valor, flabel:(v)=>etiqueta }
// Estado por columna: { sel?: string[], c1?:{op,v1,v2}, conector?:'Y'|'O', c2?:{op,v1,v2} }
'use client'
import { useEffect, useMemo, useState, useRef } from 'react'

const MESES_NOM = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

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
    // Usa el valor de la columna (via fkey), no un campo fijo 'fecha': así vale para cualquier
    // columna de fecha (termino_actual, etc.), no solo la de SA.
    const f = String((valores && valores[0]) ?? '').slice(0, 10)
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

export function HeaderFilter({ col, movs, state, setState, open, setOpen, orden, setOrden, limpiarTodo, hayAlguno, flotante }) {
  const activo = filtroActivo(state)
  const abierto = open === col.key

  // Modo `flotante`: el desplegable se pinta en position:fixed anclado al botón, para que un contenedor con
  // overflow (scroll) no lo recorte. Se calcula la posición al abrir (y se re-clampa al ancho de la ventana).
  const btnRef = useRef(null)
  const [fpos, setFpos] = useState({ left: 0, top: 0 })
  useEffect(() => {
    if (!abierto || !flotante) return
    const el = btnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const W = 272
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
    setFpos({ left: Math.max(8, Math.min(r.left, vw - W - 8)), top: r.bottom + 4 })
  }, [abierto, flotante])

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

  const coincide = (k, t) => {
    const lbl = String(col.flabel(k)).toLowerCase()
    if (lbl.includes(t)) return true
    // En columnas numéricas, la etiqueta puede llevar separadores de miles (p.ej. folio 4938 → "4.938"),
    // así que buscar "4938" no casaría. Comparamos también sin separadores (solo dígitos).
    if (col.tipo === 'num') {
      const soloDig = (x) => String(x).replace(/[^\d]/g, '')
      const td = soloDig(t)
      if (td && (soloDig(k).includes(td) || soloDig(lbl).includes(td))) return true
    }
    return false
  }
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
      <button ref={btnRef} onClick={(e) => { e.stopPropagation(); setOpen(abierto ? null : col.key) }}
        title={activo ? 'Filtro aplicado' : 'Filtrar'}
        style={{ border: 'none', background: activo ? '#1D9E75' : 'transparent', borderRadius: 4, cursor: 'pointer', color: activo ? '#fff' : '#B4B2A9', fontSize: 11, padding: activo ? '0 3px' : 0 }}>▼</button>
      {abierto && (
        <>
          <div onClick={() => setOpen(null)} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
          <div onClick={e => e.stopPropagation()} style={flotante
            ? { position: 'fixed', left: fpos.left, top: fpos.top, zIndex: 401, background: '#fff', color: '#2C2C2A', border: '0.5px solid #D3D1C7', borderRadius: 8, boxShadow: '0 8px 26px rgba(0,0,0,0.16)', width: 272, textAlign: 'left', fontWeight: 400, maxHeight: `calc(100vh - ${fpos.top + 16}px)`, overflowY: 'auto', overflowX: 'hidden' }
            : { position: 'absolute', top: 18, left: 0, zIndex: 31, background: '#fff', color: '#2C2C2A', border: '0.5px solid #D3D1C7', borderRadius: 8, boxShadow: '0 8px 26px rgba(0,0,0,0.16)', width: 272, textAlign: 'left', fontWeight: 400, overflow: 'hidden' }}>

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

// Aplica el conjunto de filtros + orden a una lista de filas.
// columnas: array de COLDEFS (con key, tipo, fkey). valoresDe: opcional, (col, fila) => array
//   de valores para las condiciones (por defecto usa fkey; útil si una columna busca en varios sitios).
export function aplicarFiltros(filas, columnas, filters, orden, valoresDe) {
  const vd = valoresDe || ((c, m) => {
    if (c.tipo === 'num') return [Math.abs(Number(c.fkey(m)) || 0)]
    return [String(c.fkey(m) ?? '')]
  })
  let out = (filas || []).filter(m => {
    for (const c of columnas) {
      const f = filters[c.key]
      if (!filtroActivo(f)) continue
      if (Array.isArray(f.sel) && !f.sel.includes(c.fkey(m))) return false
      const vals = vd(c, m)
      const r1 = cumple(c, f.c1, m, vals)
      const r2 = cumple(c, f.c2, m, vals)
      if (r1 !== null && r2 !== null) { if (f.conector === 'O' ? !(r1 || r2) : !(r1 && r2)) return false }
      else if (r1 !== null && !r1) return false
      else if (r2 !== null && !r2) return false
    }
    return true
  })
  if (orden?.key) {
    const c = columnas.find(x => x.key === orden.key)
    if (c) {
      const signo = orden.dir === 'desc' ? -1 : 1
      out = [...out].sort((a, b) => {
        const va = c.fkey(a), vb = c.fkey(b)
        if (c.tipo === 'num') return signo * ((Number(va) || 0) - (Number(vb) || 0))
        return signo * String(va).localeCompare(String(vb))
      })
    }
  }
  return out
}
