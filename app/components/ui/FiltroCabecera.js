// VERSION: v1 · 2026-08-27 · Filtro de cabecera estilo Excel (▼ orden + condiciones + checkboxes + Aceptar/Cancelar).
//   COPIA VERBATIM del componente HeaderFilter del modulo SA (app/procesos/financiero/sa/page.js) para reutilizarlo
//   en CONTAB sin tocar el SA. Anade aplicarFiltros(rows, cols, filtros, orden) para tablas planas (una fila = un registro).
'use client'
import { useState, useEffect, useMemo } from 'react'

const MES_LARGO = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
const MESES_NOM = MES_LARGO.map(m => m.toLowerCase())   // para el árbol de fechas del filtro

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

export function HeaderFilter({ col, movs, state, setState, open, setOpen, orden, setOrden, limpiarTodo, hayAlguno }) {
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
            {false /* Monto ya usa el filtro de VALORES (captura 2), no el rango. Se conserva el bloque por si se quiere revertir. */ ? (
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
              <button style={itemMenu} onClick={() => { setOrden({ key: col.key, dir: 'asc' }); setOpen(null) }}>{col.tipo === 'num' ? '↑ Menor a mayor' : '↑ Orden ascendente'}</button>
              <button style={itemMenu} onClick={() => { setOrden({ key: col.key, dir: 'desc' }); setOpen(null) }}>{col.tipo === 'num' ? '↓ Mayor a menor' : '↓ Orden descendente'}</button>
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

// Aplica los filtros (sel + condiciones c1/c2 + rango) y el orden a una lista PLANA de filas.
// cols: [{ key, label, tipo:'texto'|'num'|'fecha', fkey:(row)=>valorClave, flabel:(k)=>etiqueta, num?:(row)=>number }]
export function aplicarFiltros(rows, cols, filtros, orden) {
  const out = (rows || []).filter(m => {
    for (const c of cols) {
      const f = filtros[c.key]
      if (!filtroActivo(f)) continue
      if (f.rango) {
        const v = Number(c.num ? c.num(m) : c.fkey(m)) || 0
        if (f.rango.min != null && v < f.rango.min) return false
        if (f.rango.max != null && v > f.rango.max) return false
      }
      if (Array.isArray(f.sel) && !f.sel.includes(c.fkey(m))) return false
      const vals = c.tipo === 'num' ? [Number(c.num ? c.num(m) : c.fkey(m)) || 0] : [String(c.fkey(m) ?? '')]
      const r1 = cumple(c, f.c1, m, vals)
      const r2 = cumple(c, f.c2, m, vals)
      if (r1 !== null && r2 !== null) { if (f.conector === 'O' ? !(r1 || r2) : !(r1 && r2)) return false }
      else if (r1 !== null && !r1) return false
      else if (r2 !== null && !r2) return false
    }
    return true
  })
  if (orden?.key) {
    const c = cols.find(x => x.key === orden.key)
    if (c) {
      const signo = orden.dir === 'desc' ? -1 : 1
      out.sort((a, b) => {
        const va = c.fkey(a), vb = c.fkey(b)
        if (c.tipo === 'num') return signo * ((Number(c.num ? c.num(a) : va) || 0) - (Number(c.num ? c.num(b) : vb) || 0))
        return signo * String(va).localeCompare(String(vb))
      })
    }
  }
  return out
}
