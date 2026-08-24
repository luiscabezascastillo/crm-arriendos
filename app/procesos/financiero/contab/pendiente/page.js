// VERSION: v4 · 2026-08-24 · Filtros tipo Excel (embudo, multiseleccion, orden) por columna, igual que SA/Cobranza (lib/filtroExcel). Reemplaza los inputs de texto de v3. Export y contador respetan el filtro. Hereda v3.
// VERSION: v3 · 2026-08-24 · Filtros por columna (sustituidos en v4). Hereda v2.
// VERSION: v2 · 2026-08-19 · Encabezado de tabla sticky, clavado bajo TopNav + FinancieroNav (altura medida). Hereda v1.
// VERSION: v1 · 2026-08-19 · Vista "Pendiente de clasificar": lo que cae en el puente 1104-98, por unidad, con export a Excel (CSV).
'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useMemo } from 'react'
import TopNav from '@/app/components/ui/TopNav'
import FinancieroNav from '@/app/components/ui/FinancieroNav'
import { HeaderFilter, filtroActivo, aplicarFiltros } from '@/lib/filtroExcel'

const VERDE = '#085041'
const BORDE = '#E5E4DF'
const TENUE = '#888780'
const ROJO_BG = '#FBE9E7'
const ROJO = '#B23A3A'
const clp = (n) => (n == null || n === '' ? '' : Number(n).toLocaleString('es-CL'))

function fechaCL(f) {
  if (!f) return ''
  const d = new Date(f); if (isNaN(d)) return String(f)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

// Filtro tipo Excel por columna (mismo motor que SA/Cobranza: lib/filtroExcel).
const PEND_COLS = [
  { key: 'unidad', label: 'Unidad', tipo: 'texto', fkey: it => it.origen || '', flabel: k => (k === '' ? '(vacías)' : k) },
  { key: 'periodo', label: 'Periodo', tipo: 'texto', fkey: it => it.periodo || '', flabel: k => (k === '' ? '(vacías)' : k) },
  { key: 'fecha', label: 'Fecha', tipo: 'fecha', fkey: it => String(it.fecha || '').slice(0, 10), flabel: k => (k === '' ? '(vacías)' : fechaCL(k)) },
  { key: 'folio', label: 'Folio', tipo: 'num', fkey: it => String(it.orden ?? ''), flabel: k => (k === '' ? '(vacías)' : k) },
  { key: 'glosa', label: 'Glosa', tipo: 'texto', fkey: it => it.glosa || '', flabel: k => (k === '' ? '(vacías)' : k) },
  { key: 'ccb', label: 'CCB', tipo: 'texto', fkey: it => it.ccb || '', flabel: k => (k === '' ? '(sin CCB)' : k) },
  { key: 'monto', label: 'Monto', tipo: 'num', fkey: it => String(it.monto ?? ''), flabel: k => (k === '' ? '(vacías)' : clp(Number(k))) },
]

export default function PendientePage() {
  const { status } = useSession()
  const router = useRouter()
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [items, setItems] = useState([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const contentRef = useRef(null)
  const [stickyTop, setStickyTop] = useState(96)

  // Filtros estilo Excel
  const [filters, setFilters] = useState({})
  const [openFilter, setOpenFilter] = useState(null)
  const [orden, setOrden] = useState(null)
  const setFiltroCol = (key, val) => setFilters(f => { const n = { ...f }; if (val == null) delete n[key]; else n[key] = val; return n })
  const limpiarTodo = () => { setFilters({}); setOrden(null) }
  const hayAlguno = PEND_COLS.some(c => filtroActivo(filters[c.key])) || !!orden?.key

  useEffect(() => { if (status === 'unauthenticated') router.push('/') }, [status, router])

  useEffect(() => {
    const medir = () => {
      let alto = 0
      let el = contentRef.current ? contentRef.current.previousElementSibling : null
      while (el) {
        const pos = window.getComputedStyle(el).position
        if (pos === 'sticky' || pos === 'fixed') alto += Math.round(el.getBoundingClientRect().height)
        el = el.previousElementSibling
      }
      if (alto) setStickyTop(alto)
    }
    medir()
    window.addEventListener('resize', medir)
    const t = setTimeout(medir, 300)
    return () => { window.removeEventListener('resize', medir); clearTimeout(t) }
  }, [])

  const cargar = async () => {
    setCargando(true); setError(null)
    try {
      const r = await fetch(`/api/financiero/contab/pendiente?anio=${anio}`)
      const j = await r.json()
      if (j.error) { setError(j.error); setItems([]); return }
      setItems(j.items || [])
    } catch (e) { setError('No se pudo cargar.') } finally { setCargando(false) }
  }
  useEffect(() => { if (status === 'authenticated') cargar() }, [anio, status]) // eslint-disable-line

  const porOrigen = useMemo(() => {
    const m = {}
    for (const it of items) {
      const o = (m[it.origen] ||= { origen: it.origen, n: 0, monto: 0 })
      o.n += 1; o.monto += Number(it.monto) || 0
    }
    return Object.values(m).sort((a, b) => b.monto - a.monto)
  }, [items])

  const itemsVis = useMemo(() => aplicarFiltros(items, PEND_COLS, filters, orden), [items, filters, orden])
  const totalVis = itemsVis.reduce((acc, it) => acc + (Number(it.monto) || 0), 0)

  const HF = (key) => (
    <HeaderFilter col={PEND_COLS.find(c => c.key === key)} movs={items}
      state={filters[key]} setState={v => setFiltroCol(key, v)}
      open={openFilter} setOpen={setOpenFilter} orden={orden} setOrden={setOrden}
      limpiarTodo={limpiarTodo} hayAlguno={hayAlguno} />
  )

  const exportarExcel = () => {
    const cab = ['Unidad', 'Periodo', 'Fecha', 'Folio', 'Glosa', 'CCB', 'Monto', 'Cuenta a asignar']
    const filas = itemsVis.map(it => [it.origen, it.periodo, fechaCL(it.fecha), it.orden, it.glosa, it.ccb || '', it.monto, ''])
    const esc = (v) => { const s = String(v == null ? '' : v); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
    const csv = [cab, ...filas].map(r => r.map(esc).join(';')).join('\r\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `pendiente_clasificar_${anio}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const thSticky = { ...th, position: 'sticky', top: stickyTop, zIndex: 5 }

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF8' }}>
      <TopNav />
      <FinancieroNav activo="contab" />
      <div ref={contentRef} style={{ maxWidth: 1300, margin: '0 auto', padding: '24px 20px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 13, color: TENUE, marginBottom: 4 }}>
              <span style={{ cursor: 'pointer', color: VERDE }} onClick={() => router.push('/procesos/financiero/contab')}>← CONTAB</span> · Pendiente de clasificar
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1A1A17', margin: 0 }}>Pendiente de clasificar</h1>
            <div style={{ fontSize: 14, color: TENUE, marginTop: 4 }}>Movimientos que caen en el puente 1104-98, por unidad. Al asignarles cuenta salen del puente.</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <select value={anio} onChange={e => setAnio(Number(e.target.value))} style={selStyle}>
              {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <button onClick={exportarExcel} disabled={!items.length} style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: items.length ? VERDE : '#B4B2A9', color: '#fff', fontSize: 14, fontWeight: 600, cursor: items.length ? 'pointer' : 'default' }}>Exportar a Excel</button>
          </div>
        </div>

        {error && <div style={{ padding: 14, borderRadius: 10, background: ROJO_BG, color: ROJO, marginBottom: 16 }}>{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {porOrigen.map(o => (
            <div key={o.origen} style={{ border: `1px solid ${BORDE}`, borderRadius: 10, background: '#fff', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1A1A17', textTransform: 'uppercase' }}>{o.origen}</div>
              <div style={{ fontSize: 13, color: TENUE }}>{o.n} mov · <b style={{ color: ROJO }}>{clp(o.monto)}</b></div>
            </div>
          ))}
          {!porOrigen.length && !cargando && (
            <div style={{ gridColumn: '1 / -1', padding: 30, textAlign: 'center', color: VERDE, border: `1px dashed ${BORDE}`, borderRadius: 12 }}>Nada pendiente en {anio}. El puente está a cero ✓</div>
          )}
        </div>

        {items.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, fontSize: 13, color: TENUE }}>
            <span>{itemsVis.length}{itemsVis.length !== items.length ? ` de ${items.length}` : ''} movimientos · total <b style={{ color: ROJO }}>{clp(totalVis)}</b></span>
            {hayAlguno && <button onClick={limpiarTodo} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 6, border: `1px solid ${BORDE}`, background: '#fff', color: VERDE, cursor: 'pointer', fontWeight: 600 }}>Quitar filtros</button>}
          </div>
        )}
        {cargando ? (
          <div style={{ padding: 40, color: TENUE }}>Cargando…</div>
        ) : items.length > 0 && (
          <div style={{ border: `1px solid ${BORDE}`, borderRadius: 12, background: '#fff' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead><tr>
                <th style={thSticky}><span style={hd}>Unidad{HF('unidad')}</span></th>
                <th style={thSticky}><span style={hd}>Periodo{HF('periodo')}</span></th>
                <th style={thSticky}><span style={hd}>Fecha{HF('fecha')}</span></th>
                <th style={thSticky}><span style={hd}>Folio{HF('folio')}</span></th>
                <th style={thSticky}><span style={hd}>Glosa{HF('glosa')}</span></th>
                <th style={thSticky}><span style={hd}>CCB{HF('ccb')}</span></th>
                <th style={{ ...thSticky, textAlign: 'right' }}><span style={{ ...hd, justifyContent: 'flex-end' }}>Monto{HF('monto')}</span></th>
              </tr></thead>
              <tbody>
                {itemsVis.map((it, i) => (
                  <tr key={i}>
                    <td style={{ ...td, textTransform: 'uppercase', color: TENUE }}>{it.origen}</td>
                    <td style={td}>{it.periodo}</td>
                    <td style={td}>{fechaCL(it.fecha)}</td>
                    <td style={td}>{it.orden}</td>
                    <td style={td}>{it.glosa}</td>
                    <td style={td}>{it.ccb}</td>
                    <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{clp(it.monto)}</td>
                  </tr>
                ))}
                {!itemsVis.length && <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: TENUE }}>Sin coincidencias con los filtros.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

const selStyle = { padding: '8px 12px', borderRadius: 8, border: `1px solid ${BORDE}`, fontSize: 15, fontWeight: 600, color: VERDE, background: '#fff' }
const hd = { display: 'inline-flex', alignItems: 'center', gap: 6 }
const th = { textAlign: 'left', padding: '10px 12px', fontSize: 12, fontWeight: 600, color: TENUE, borderBottom: `1px solid ${BORDE}`, whiteSpace: 'nowrap', background: '#FBFBF9' }
const td = { padding: '9px 12px', fontSize: 13, color: '#1A1A17', borderBottom: `1px solid ${BORDE}`, whiteSpace: 'nowrap' }
