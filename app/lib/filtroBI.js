// RUTA: app/lib/filtroBI.js
// VERSION: v1 · 2026-08-17 · Componente de filtro tipo Excel de BI, extraído a librería compartida para
//   reutilizarlo en otras pantallas (Tarjeta de crédito, etc.) SIN tocar la pantalla BI. Modo texto (orden
//   A→Z/Z→A + casillas por valor + buscador + Seleccionar todo), modo numérico (rango/valor exacto) y modo
//   árbol de fechas (Año › Mes › Día). El desplegable va por portal a document.body.
'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'

export function ColFilterExcel({ label, col, sortCol, sortDir, onSort, opciones, value, onApply, align = 'left', chips, catFiltro, onCat, numeric = false, tree = false }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ left: 0, top: 0 })   // coords del dropdown (fixed)
  const [buscar, setBuscar] = useState('')
  const [pending, setPending] = useState(null)
  const [rango, setRango] = useState({ min: '', max: '', igual: '' })   // filtro por cantidad (columnas numéricas): rango o valor exacto
  const [expanded, setExpanded] = useState(() => new Set())   // años/meses desplegados en el árbol de fechas
  const ref = useRef(null)
  const btnRef = useRef(null)
  const popRef = useRef(null)   // el desplegable va por PORTAL a document.body, así que necesita su propio ref
  useEffect(() => {
    function handle(e) {
      const inWrap = ref.current && ref.current.contains(e.target)
      const inPop = popRef.current && popRef.current.contains(e.target)
      if (!inWrap && !inPop) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])
  useEffect(() => {
    if (open) {
      setBuscar('')
      if (numeric) setRango({ min: value?.min ?? '', max: value?.max ?? '', igual: value?.igual ?? '' })
      else setPending(new Set(value || []))
      if (tree) {   // al abrir, deja desplegado el año más reciente
        const ys = [...new Set((opciones || []).map(o => { const m = /\/(\d{4})$/.exec(String(o)); return m ? m[1] : null }).filter(Boolean))].sort()
        const last = ys[ys.length - 1]
        setExpanded(new Set(last ? ['Y:' + last] : []))
      }
    }
  }, [open]) // eslint-disable-line
  // Abre el dropdown calculando su posición fija (respecto a la pantalla, no a la tabla con scroll).
  const abrir = () => {
    if (open) { setOpen(false); return }
    const rc = btnRef.current?.getBoundingClientRect()
    if (rc) {
      const W = 250
      const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
      const left = align === 'right' ? Math.max(8, rc.right - W) : Math.min(rc.left, vw - W - 8)
      setPos({ left, top: rc.bottom + 4 })
    }
    setOpen(true)
  }
  const norm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const opcNorm = useMemo(() => (opciones || []).map(o => [o, norm(o)]), [opciones])
  const rangoActivo = numeric && value && typeof value === 'object' && !Array.isArray(value) && (value.min != null || value.max != null || value.igual != null)
  const activo = (!numeric && value && value.length > 0) || rangoActivo || (!numeric && sortCol === col) || (chips && catFiltro && catFiltro !== 'todos')
  const nb = norm(buscar)
  const visibles = !buscar ? (opciones || []) : opcNorm.filter(x => x[1].includes(nb)).map(x => x[0])
  const p = pending || new Set()
  const todasVisiblesMarcadas = visibles.length > 0 && visibles.every(o => p.has(o))
  const toggle = o => { const n = new Set(p); n.has(o) ? n.delete(o) : n.add(o); setPending(n) }
  const toggleTodas = () => { const n = new Set(p); todasVisiblesMarcadas ? visibles.forEach(o => n.delete(o)) : visibles.forEach(o => n.add(o)); setPending(n) }
  const MESES = ['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const toggleExp = (k) => setExpanded(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })
  const tri = (hojas) => (hojas.length && hojas.every(l => p.has(l))) ? 'yes' : hojas.some(l => p.has(l)) ? 'mid' : 'no'
  const toggleHojas = (hojas, on) => { const n = new Set(p); hojas.forEach(l => on ? n.add(l) : n.delete(l)); setPending(n) }
  const treeData = {}
  if (tree && !numeric) for (const o of visibles) {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(o))
    const yy = m ? m[3] : '(sin fecha)'; const mm = m ? m[2] : '-'
    if (!treeData[yy]) treeData[yy] = {}
    if (!treeData[yy][mm]) treeData[yy][mm] = []
    treeData[yy][mm].push(o)
  }
  const toNum = (s) => { const t = String(s ?? '').trim(); if (t === '') return null; const n = Number(t.replace(/[^\d.-]/g, '')); return isNaN(n) ? null : n }
  const aplicar = () => {
    if (numeric) {
      const ig = toNum(rango.igual)
      onApply(col, ig != null ? { igual: ig } : { min: toNum(rango.min), max: toNum(rango.max) })
      setOpen(false); return
    }
    const arr = [...p]; onApply(col, (arr.length === 0 || arr.length === (opciones || []).length) ? [] : arr); setOpen(false)
  }
  const limpiar = () => {
    if (numeric) { setRango({ min: '', max: '' }); onApply(col, null); setOpen(false); return }
    setPending(new Set()); onApply(col, []); setOpen(false)
  }
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      <button ref={btnRef} onClick={abrir} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: activo ? '#1a56db' : '#5F5E5A', letterSpacing: '0.03em' }}>
        {label}
        <span style={{ fontSize: 9, color: activo ? '#1a56db' : '#B4B2A9' }}>
          {numeric ? (rangoActivo ? ' ⧩' : ' ⯬') : (value && value.length ? ' ⧩' : sortCol === col && sortDir === 'asc' ? ' ↑' : sortCol === col && sortDir === 'desc' ? ' ↓' : ' ⯬')}
        </span>
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div ref={popRef} style={{ position: 'fixed', left: pos.left, top: pos.top, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', width: 250, maxHeight: `calc(100vh - ${pos.top + 12}px)`, display: 'flex', flexDirection: 'column', zIndex: 4000, padding: 8, boxSizing: 'border-box' }}>
          {chips && (
            <>
              <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 500, marginBottom: 6, textTransform: 'uppercase' }}>Categoría</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #F3F4F6' }}>
                {chips.map(([k, lab, colr]) => (
                  <button key={k} onClick={() => onCat(k)} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, padding: '3px 8px', borderRadius: 12, cursor: 'pointer', border: '1px solid ' + (catFiltro === k ? '#1a56db' : '#E5E7EB'), background: catFiltro === k ? '#1a56db' : '#fff', color: catFiltro === k ? '#fff' : '#374151', fontWeight: catFiltro === k ? 600 : 400 }}>
                    {colr && <span style={{ width: 10, height: 10, borderRadius: '50%', border: '1px solid #9A968C', background: colr, flexShrink: 0 }} />}
                    {lab}
                  </button>
                ))}
              </div>
            </>
          )}
          {numeric ? (
            <>
              <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 500, marginBottom: 6, textTransform: 'uppercase' }}>Filtrar por cantidad</div>
              <div style={{ fontSize: 10.5, color: '#94A3B8', marginBottom: 8 }}>Un valor exacto, o un rango Desde/Hasta (deja un lado vacío para acotar solo por uno).</div>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: '#6B7280', marginBottom: 8 }}>
                <span>Igual a (exacto)</span>
                <input inputMode="numeric" value={rango.igual} onChange={e => setRango(v => ({ ...v, igual: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') aplicar() }} placeholder="valor exacto"
                  style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #E5E7EB', fontSize: 12, boxSizing: 'border-box', textAlign: 'right', fontFamily: 'ui-monospace, monospace' }} />
              </label>
              <div style={{ fontSize: 10, color: '#CBD5E1', textAlign: 'center', margin: '0 0 8px' }}>— o un rango —</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 4, opacity: String(rango.igual).trim() ? 0.4 : 1 }}>
                <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: '#6B7280' }}>
                  <span>Desde</span>
                  <input inputMode="numeric" value={rango.min} onChange={e => setRango(v => ({ ...v, min: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') aplicar() }} placeholder="mín"
                    style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #E5E7EB', fontSize: 12, boxSizing: 'border-box', textAlign: 'right', fontFamily: 'ui-monospace, monospace' }} />
                </label>
                <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: '#6B7280' }}>
                  <span>Hasta</span>
                  <input inputMode="numeric" value={rango.max} onChange={e => setRango(v => ({ ...v, max: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') aplicar() }} placeholder="máx"
                    style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #E5E7EB', fontSize: 12, boxSizing: 'border-box', textAlign: 'right', fontFamily: 'ui-monospace, monospace' }} />
                </label>
              </div>
              <div style={{ height: 8 }} />
            </>
          ) : (
            <>
              <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 500, marginBottom: 6, textTransform: 'uppercase' }}>Ordenar</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                {[['asc', 'A → Z'], ['desc', 'Z → A']].map(([dir, lbl]) => (
                  <button key={dir} onClick={() => { onSort(col, dir); setOpen(false) }} style={{ flex: 1, padding: '4px 8px', borderRadius: 6, border: '1px solid', fontSize: 11, cursor: 'pointer', background: sortCol === col && sortDir === dir ? '#EFF6FF' : '#F9FAFB', borderColor: sortCol === col && sortDir === dir ? '#BFDBFE' : '#E5E7EB', color: sortCol === col && sortDir === dir ? '#1D4ED8' : '#374151' }}>{lbl}</button>
                ))}
              </div>
              <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 500, marginBottom: 4, textTransform: 'uppercase' }}>Filtrar</div>
              <div style={{ fontSize: 10.5, color: '#94A3B8', marginBottom: 6 }}>Marca los que quieres ver (vacío = todos).</div>
              <input autoFocus placeholder={`Buscar ${String(label).toLowerCase()}...`} value={buscar} onChange={e => setBuscar(e.target.value)} style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #E5E7EB', fontSize: 12, boxSizing: 'border-box', marginBottom: 6 }} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#374151', borderBottom: '1px solid #F3F4F6' }}>
                <input type="checkbox" checked={todasVisiblesMarcadas} onChange={toggleTodas} style={{ margin: 0 }} />
                (Seleccionar todo){buscar ? ' (lo visible)' : ''}
              </label>
              <div style={{ flex: 1, minHeight: 40, overflowY: 'auto', margin: '2px 0 8px' }}>
                {visibles.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#9CA3AF', padding: '8px 4px' }}>Sin coincidencias</div>
                ) : tree ? (
                  Object.keys(treeData).sort((a, b) => b.localeCompare(a)).map(yy => {
                    const meses = treeData[yy]
                    const hojasY = Object.values(meses).flat()
                    const stY = tri(hojasY)
                    const abiertoY = !!buscar || expanded.has('Y:' + yy)
                    return (
                      <div key={yy}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 2px' }}>
                          <span onClick={() => toggleExp('Y:' + yy)} style={{ cursor: 'pointer', width: 14, textAlign: 'center', color: '#9CA3AF', fontSize: 10, userSelect: 'none' }}>{abiertoY ? '▾' : '▸'}</span>
                          <input type="checkbox" ref={el => { if (el) el.indeterminate = stY === 'mid' }} checked={stY === 'yes'} onChange={() => toggleHojas(hojasY, stY !== 'yes')} style={{ margin: 0 }} />
                          <span style={{ fontWeight: 700, fontSize: 12 }}>{yy}</span>
                          <span style={{ fontSize: 10, color: '#B4B2A9' }}>({hojasY.length})</span>
                        </div>
                        {abiertoY && Object.keys(meses).sort((a, b) => b.localeCompare(a)).map(mm => {
                          const dias = meses[mm]
                          const stM = tri(dias)
                          const abiertoM = !!buscar || expanded.has('M:' + yy + mm)
                          return (
                            <div key={mm} style={{ marginLeft: 16 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 2px' }}>
                                <span onClick={() => toggleExp('M:' + yy + mm)} style={{ cursor: 'pointer', width: 14, textAlign: 'center', color: '#9CA3AF', fontSize: 10, userSelect: 'none' }}>{abiertoM ? '▾' : '▸'}</span>
                                <input type="checkbox" ref={el => { if (el) el.indeterminate = stM === 'mid' }} checked={stM === 'yes'} onChange={() => toggleHojas(dias, stM !== 'yes')} style={{ margin: 0 }} />
                                <span style={{ fontSize: 12, textTransform: 'capitalize' }}>{MESES[parseInt(mm, 10)] || mm}</span>
                                <span style={{ fontSize: 10, color: '#B4B2A9' }}>({dias.length})</span>
                              </div>
                              {abiertoM && dias.slice().sort((a, b) => b.localeCompare(a)).map(d => (
                                <label key={d} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 4px', marginLeft: 16, fontSize: 12, cursor: 'pointer', color: '#374151' }}>
                                  <input type="checkbox" checked={p.has(d)} onChange={() => toggle(d)} style={{ margin: 0, flexShrink: 0 }} />
                                  <span>{d}</span>
                                </label>
                              ))}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })
                ) : (
                  <>
                    {visibles.slice(0, 300).map(o => (
                      <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: '#374151' }}>
                        <input type="checkbox" checked={p.has(o)} onChange={() => toggle(o)} style={{ margin: 0, flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={o}>{o}</span>
                      </label>
                    ))}
                    {visibles.length > 300 && (
                      <div style={{ fontSize: 11, color: '#9CA3AF', padding: '6px 4px' }}>Mostrando 300 de {visibles.length}. Escribe arriba para afinar (o marca «Seleccionar todo» sobre lo buscado).</div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button onClick={limpiar} style={{ flex: 1, padding: 5, borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', fontSize: 12, cursor: 'pointer', color: '#6B7280' }}>Limpiar</button>
            <button onClick={aplicar} style={{ flex: 1, padding: 5, borderRadius: 6, border: 'none', background: '#1a56db', fontSize: 12, cursor: 'pointer', color: '#fff', fontWeight: 500 }}>{numeric ? 'Aplicar' : ([...p].length ? `Aplicar (${[...p].length})` : 'Ver todos')}</button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
