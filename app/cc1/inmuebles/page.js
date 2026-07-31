'use client'
// VERSION: v1 · 2026-07-31 · Vista de CONSULTA de Inmuebles (regenera la hoja "Inmuebles" del Excel).
//   Muestra por propietario las unidades individuales y las combinaciones (agrupaciones depto+bodega/
//   estacionamiento) con su ROL individual o combinado. Lee de la tabla `inmuebles` (raw_data) por
//   /api/inmuebles con service_role. Solo lectura: la edición se abordará como proyecto aparte.
import Link from 'next/link'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { HeaderFilter, filtroActivo, aplicarFiltros } from '../../../lib/filtroExcel'
import TopNav from '../../components/ui/TopNav'

// Columnas para el filtro estilo Excel (mismo motor que el LOG y SA).
const INM_COLS = [
  { key: 'idinmue', label: 'IDINMUE', tipo: 'texto',
    fkey: p => p.idinmue || '', flabel: k => (k === '' ? '(vacías)' : k) },
  { key: 'inmueble', label: 'Inmueble', tipo: 'texto',
    fkey: p => p.inmueble || '', flabel: k => (k === '' ? '(vacías)' : k) },
  { key: 'propietario', label: 'Propietario', tipo: 'texto',
    fkey: p => p.propietario || '', flabel: k => (k === '' ? '(vacías)' : k) },
  { key: 'rol', label: 'ROL', tipo: 'texto',
    fkey: p => p.rol || '', flabel: k => (k === '' ? '(vacías)' : k) },
]

export default function InmueblesPage() {
  const router = useRouter()
  const [todas, setTodas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({})
  const [openFilter, setOpenFilter] = useState(null)
  const [orden, setOrden] = useState(null)
  const [soloComb, setSoloComb] = useState(false)  // ver solo combinaciones (agrupaciones)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/inmuebles')
      const d = await res.json()
      if (!res.ok) { setError(d.error || 'Error cargando inmuebles'); setLoading(false); return }
      setTodas(d.inmuebles || [])
    } catch (e) {
      setError('Error de conexión: ' + (e?.message || e))
    }
    setLoading(false)
  }

  const setFiltroCol = (key, val) => setFilters(f => { const n = { ...f }; if (val == null) delete n[key]; else n[key] = val; return n })
  const limpiarTodo = () => { setSearch(''); setFilters({}); setOrden(null); setSoloComb(false) }
  const hayAlgunFiltro = INM_COLS.some(c => filtroActivo(filters[c.key]))
  const hayFiltros = search || hayAlgunFiltro || orden?.key || soloComb

  const filtradas = useMemo(() => {
    let base = todas
    if (soloComb) base = base.filter(p => p.combinacion)
    const q = search.trim().toLowerCase()
    if (q) base = base.filter(p => ['idinmue', 'inmueble', 'propietario', 'rol']
      .some(k => String(p[k] || '').toLowerCase().includes(q)))
    let out = aplicarFiltros(base, INM_COLS, filters, orden)
    if (!orden?.key) {
      out = [...out].sort((a, b) =>
        String(a.propietario || '').localeCompare(String(b.propietario || ''), 'es') ||
        String(a.idinmue || '').localeCompare(String(b.idinmue || ''), 'es'))
    }
    return out
  }, [todas, search, filters, orden, soloComb])

  const totalComb = useMemo(() => todas.filter(p => p.combinacion).length, [todas])

  const thStyle = { padding: '9px 12px', textAlign: 'left', position: 'sticky', top: 0, zIndex: 20, background: 'var(--gray-50)', borderBottom: '1px solid var(--border)', fontSize: 10, color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }
  const labelStyle = { fontSize: 10, color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }
  const hf = (key) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={labelStyle}>{INM_COLS.find(c => c.key === key).label}</span>
      <HeaderFilter col={INM_COLS.find(c => c.key === key)} movs={todas} state={filters[key]} setState={v => setFiltroCol(key, v)} open={openFilter} setOpen={setOpenFilter} orden={orden} setOrden={setOrden} limpiarTodo={limpiarTodo} hayAlguno={hayFiltros} />
    </span>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <TopNav />
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '20px 24px' }}>

        {/* Cabecera */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <Link href="/cc1" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--gray-500)', textDecoration: 'none' }}>‹ Volver al LOG</Link>
          <div style={{ width: 30, height: 30, background: '#0891b2', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0, color: '#2C2C2A' }}>Inmuebles</h1>
        </div>
        <p style={{ fontSize: 12, color: 'var(--gray-400)', margin: '0 0 16px 42px' }}>
          Unidades individuales y agrupaciones (departamento + bodega/estacionamiento) con su ROL. Solo consulta.
        </p>

        {/* Barra de búsqueda + toggle combinaciones */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por IDINMUE, inmueble, propietario o ROL…"
            style={{ flex: 1, minWidth: 260, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
          <button onClick={() => setSoloComb(v => !v)}
            style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid ' + (soloComb ? '#0891b2' : 'var(--border)'), background: soloComb ? '#0891b2' : '#fff', color: soloComb ? '#fff' : 'var(--gray-600)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Solo agrupaciones ({totalComb})
          </button>
          {hayFiltros && (
            <button onClick={limpiarTodo} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #fcd34d', background: '#fef9c3', color: '#92400e', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>✕ Limpiar filtros</button>
          )}
        </div>

        {/* Tabla */}
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--gray-700)' }}>
            Listado de inmuebles <span style={{ fontWeight: 400, color: 'var(--gray-400)' }}>({filtradas.length} registro{filtradas.length === 1 ? '' : 's'})</span>
          </div>
          <div style={{ overflow: 'auto', maxHeight: '70vh' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 180 }} />   {/* IDINMUE combinado */}
                <col style={{ width: 320 }} />   {/* Inmueble */}
                <col style={{ width: 150 }} />   {/* Propietario */}
                <col style={{ width: 60 }} />    {/* Bodega */}
                <col style={{ width: 60 }} />    {/* Estac */}
                <col style={{ width: 240 }} />   {/* ROL */}
              </colgroup>
              <thead>
                <tr style={{ background: 'var(--gray-50)' }}>
                  <th style={thStyle}>{hf('idinmue')}</th>
                  <th style={thStyle}>{hf('inmueble')}</th>
                  <th style={thStyle}>{hf('propietario')}</th>
                  <th style={thStyle}>Bod</th>
                  <th style={thStyle}>Est</th>
                  <th style={thStyle}>{hf('rol')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', fontSize: 12, color: 'var(--gray-400)' }}>Cargando inmuebles…</td></tr>
                ) : error ? (
                  <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', fontSize: 12, color: '#dc2626' }}>{error}</td></tr>
                ) : filtradas.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', fontSize: 12, color: 'var(--gray-400)' }}>No se encontraron inmuebles.</td></tr>
                ) : filtradas.map((p, i) => (
                  <tr key={i} style={{ background: p.combinacion ? '#f0fdfa' : 'transparent' }}>
                    <td title={p.idinmue} style={{ padding: '9px 12px', fontSize: 11, fontFamily: 'monospace', fontWeight: p.combinacion ? 700 : 400, color: 'var(--gray-700)', borderBottom: '1px solid var(--border-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.idinmue || '—'}</td>
                    <td title={p.inmueble} style={{ padding: '9px 12px', fontSize: 12, color: 'var(--gray-700)', borderBottom: '1px solid var(--border-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.inmueble || '—'}</td>
                    <td title={p.propietario} style={{ padding: '9px 12px', fontSize: 12, color: 'var(--gray-600)', borderBottom: '1px solid var(--border-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.propietario || '—'}</td>
                    <td style={{ padding: '9px 12px', fontSize: 11, color: 'var(--gray-500)', borderBottom: '1px solid var(--border-subtle)', textAlign: 'center' }}>{p.bodega || ''}</td>
                    <td style={{ padding: '9px 12px', fontSize: 11, color: 'var(--gray-500)', borderBottom: '1px solid var(--border-subtle)', textAlign: 'center' }}>{p.estac || ''}</td>
                    <td title={p.rol} style={{ padding: '9px 12px', fontSize: 11, fontFamily: 'monospace', color: 'var(--gray-600)', borderBottom: '1px solid var(--border-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.rol || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '10px 16px', fontSize: 11, color: 'var(--gray-400)', textAlign: 'center', borderTop: '1px solid var(--border-subtle)' }}>
            {filtradas.length} registro{filtradas.length === 1 ? '' : 's'} · las filas resaltadas son agrupaciones (varias unidades en un mismo arriendo)
          </div>
        </div>
      </div>
    </div>
  )
}
