'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'
import TopNav from '../components/ui/TopNav'

const PORTAL_URL = 'https://portal-propietarios-rose.vercel.app'
const PAGE_SIZE = 15

const estadoMap = {
  S:          { bg: '#eff6ff', color: '#1a56db' },
  SQ:         { bg: '#f0fdf4', color: '#16a34a' },
  P:          { bg: '#fffbeb', color: '#d97706' },
  Q:          { bg: '#fffbeb', color: '#d97706' },
  N:          { bg: '#f3f4f6', color: '#6b7280' },
  'N-DICOM':  { bg: '#fef2f2', color: '#dc2626' },
}

const opEspecialesCC1 = [
  { label: 'Creación y edición de Contratos',              href: '/op/contratos' },
  { label: 'Preparación liquidación de Paola',             href: '/op/liquidacion-paola' },
  { label: 'Actualización mensual de Comunidad Feliz',          href: '/op/comunidad-feliz' },
  { label: 'Consolidación y explotación datos de Cartolas', href: '/op/cartolas' },
  { label: 'Deudas de servicios',                                    href: '/op/deudas' },
]

function EstadoBadge({ estado }) {
  const s = estadoMap[estado] || { bg: '#f3f4f6', color: '#6b7280' }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      padding: '2px 7px', borderRadius: 6, background: s.bg, color: s.color, fontSize: 11, fontWeight: 600 }}>
      {estado || '—'}
    </span>
  )
}

function ActionBtn({ label, bg, icon, onClick }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 6,
      padding: '7px 13px', borderRadius: 8, border: 'none', background: bg, color: '#fff',
      fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
      onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
      onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
      {icon}{label}
    </button>
  )
}

function OperacionesBtn({ opciones, router }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden' }}>
        <button onClick={() => setOpen(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 10px 7px 13px', border: 'none', background: '#c2410c', color: '#fff',
          fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
          {Ico.gear} Operaciones
        </button>
        <button onClick={() => setOpen(v => !v)} style={{ padding: '7px 9px', border: 'none',
          borderLeft: '1px solid rgba(255,255,255,0.25)', background: '#c2410c', color: '#fff',
          cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
            style={{ transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            <path d="M6 9l6 6 6-6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)', minWidth: 290, zIndex: 100, overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px 6px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Operaciones especiales CC1
            </div>
          </div>
          <div style={{ padding: 4 }}>
            {opciones.map((op, i) => (
              <button key={i} onClick={() => { setOpen(false); router.push(op.href) }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  padding: '9px 12px', borderRadius: 7, fontSize: 12, fontWeight: 400,
                  color: 'var(--gray-700)', background: 'transparent', border: 'none',
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-50)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#c2410c', flexShrink: 0 }} />
                {op.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ColFilter({ label, col, sortCol, sortDir, onSort, searchVal, onSearch, align='left' }) {
  const [open, setOpen] = useState(false)
  const [localSearch, setLocalSearch] = useState(searchVal)
  const ref = useRef(null)
  useEffect(() => {
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])
  const activo = (sortCol === col) || searchVal !== ''
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      <button onClick={() => setOpen(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer',
        padding: 0, display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600,
        color: activo ? '#1a56db' : 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
        <span style={{ fontSize: 9, color: activo ? '#1a56db' : 'var(--gray-300)' }}>
          {sortCol === col && sortDir === 'asc' ? ' ↑' : sortCol === col && sortDir === 'desc' ? ' ↓' : ' ⯬'}
        </span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', [align === 'right' ? 'right' : 'left']: 0,
          marginTop: 4, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 200, zIndex: 300, padding: 8 }}>
          <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 500, marginBottom: 6, textTransform: 'uppercase' }}>Ordenar</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {[['asc', 'A → Z'], ['desc', 'Z → A']].map(([dir, lbl]) => (
              <button key={dir} onClick={() => { onSort(col, dir); setOpen(false) }} style={{
                flex: 1, padding: '4px 8px', borderRadius: 6, border: '1px solid',
                fontSize: 11, cursor: 'pointer',
                background: sortCol === col && sortDir === dir ? '#EFF6FF' : '#F9FAFB',
                borderColor: sortCol === col && sortDir === dir ? '#BFDBFE' : '#E5E7EB',
                color: sortCol === col && sortDir === dir ? '#1D4ED8' : '#374151'
              }}>{lbl}</button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 500, marginBottom: 6, textTransform: 'uppercase' }}>Buscar</div>
          <input placeholder={`Filtrar ${label.toLowerCase()}...`} value={localSearch}
            onChange={e => setLocalSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { onSearch(localSearch); setOpen(false) } }}
            style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #E5E7EB',
              fontSize: 12, boxSizing: 'border-box', marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => { setLocalSearch(''); onSearch(''); setOpen(false) }}
              style={{ flex: 1, padding: '5px', borderRadius: 6, border: '1px solid #E5E7EB',
                background: '#fff', fontSize: 12, cursor: 'pointer', color: '#6B7280' }}>
              Limpiar
            </button>
            <button onClick={() => { onSearch(localSearch); setOpen(false) }}
              style={{ flex: 1, padding: '5px', borderRadius: 6, border: 'none',
                background: '#1a56db', fontSize: 12, cursor: 'pointer', color: '#fff', fontWeight: 500 }}>
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function EstadoFilter({ col, sortCol, sortDir, onSort, value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const estados = ['S', 'P', 'Q', 'SQ', 'N', 'N-DICOM']
  useEffect(() => {
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])
  const activo = value !== '' || sortCol === col
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button onClick={() => setOpen(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer',
        padding: 0, display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600,
        color: activo ? '#1a56db' : 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Estado
        <span style={{ fontSize: 9, color: activo ? '#1a56db' : 'var(--gray-300)' }}>
          {sortCol === col && sortDir === 'asc' ? ' ↑' : sortCol === col && sortDir === 'desc' ? ' ↓' : ' ⯬'}
        </span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4,
          background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 180, zIndex: 300, padding: 8 }}>
          <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 500, marginBottom: 6, textTransform: 'uppercase' }}>Ordenar</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {[['asc', 'A → Z'], ['desc', 'Z → A']].map(([dir, lbl]) => (
              <button key={dir} onClick={() => { onSort(col, dir) }} style={{
                flex: 1, padding: '4px 8px', borderRadius: 6, border: '1px solid',
                fontSize: 11, cursor: 'pointer',
                background: sortCol === col && sortDir === dir ? '#EFF6FF' : '#F9FAFB',
                borderColor: sortCol === col && sortDir === dir ? '#BFDBFE' : '#E5E7EB',
                color: sortCol === col && sortDir === dir ? '#1D4ED8' : '#374151'
              }}>{lbl}</button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 500, marginBottom: 6, textTransform: 'uppercase' }}>Filtrar</div>
          {estados.map(e => (
            <div key={e} onClick={() => { onChange(value === e ? '' : e); setOpen(false) }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 4px',
                borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
              onMouseEnter={ev => ev.currentTarget.style.background = '#F3F4F6'}
              onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}>
              <input type="radio" readOnly checked={value === e} style={{ margin: 0 }} />
              <EstadoBadge estado={e} />
            </div>
          ))}
          {value && (
            <button onClick={() => { onChange(''); setOpen(false) }}
              style={{ width: '100%', marginTop: 6, padding: '5px', borderRadius: 6,
                border: '1px solid #E5E7EB', background: '#fff', fontSize: 12, cursor: 'pointer', color: '#6B7280' }}>
              Limpiar
            </button>
          )}
        </div>
      )}
    </div>
  )
}

const Ico = {
  edit:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  users: <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/></svg>,
  home:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  calc:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="4" y="2" width="16" height="20" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M8 6h8M8 10h8M8 14h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  gear:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="2"/></svg>,
  lock:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  plus:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  search:<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/><path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  back:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polyline points="15 18 9 12 15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  portal:<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><polyline points="15 3 21 3 21 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="10" y1="14" x2="21" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
}

const tabs = ['Datos base', 'Operación', 'Ajustes', 'Cierre']

function alertaTermino(fecha) {
  if (!fecha) return null
  const hoy = new Date()
  const termino = new Date(fecha)
  const dias = Math.ceil((termino - hoy) / (1000 * 60 * 60 * 24))
  if (dias < 0) return { color: '#dc2626', text: 'Vencido' }
  if (dias <= 30) return { color: '#dc2626', text: `${dias}d` }
  if (dias <= 60) return { color: '#d97706', text: `${dias}d` }
  return null
}

export default function CC1Page() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('Datos base')
  const [search, setSearch] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroIdadmon, setFiltroIdadmon] = useState('')
  const [filtroInmueble, setFiltroInmueble] = useState('')
  const [filtroPropietario, setFiltroPropietario] = useState('')
  // 'default' = orden por defecto multi-columna: Estado ↓ · Propietario ↑ · Inmueble ↑.
  // En cuanto el usuario pincha una columna, se pasa a orden simple por esa columna.
  const [sortCol, setSortCol] = useState('default')
  const [sortDir, setSortDir] = useState('desc')
  const [propiedades, setPropiedades] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [kpis, setKpis] = useState({ total: 0, activos: 0, termino: 0, vacios: 0 })
  const [portalLoading, setPortalLoading] = useState(null) // idadmon cargando
  const [idpropMap, setIdpropMap] = useState({}) // idadmon -> idprop

  useEffect(() => { loadKpis() }, [])
  useEffect(() => { setPage(1) }, [search, filtroEstado, filtroIdadmon, filtroInmueble, filtroPropietario, sortCol, sortDir])
  useEffect(() => { loadData() }, [page, search, filtroEstado, filtroIdadmon, filtroInmueble, filtroPropietario, sortCol, sortDir])

  async function loadKpis() {
    const { count: total }   = await supabase.from('datos_arriendos').select('*', { count: 'exact', head: true })
    const { count: activos } = await supabase.from('datos_arriendos').select('*', { count: 'exact', head: true }).eq('estado', 'S')
    const { count: termino } = await supabase.from('datos_arriendos').select('*', { count: 'exact', head: true }).eq('estado', 'Q')
    const { count: vacios }  = await supabase.from('datos_arriendos').select('*', { count: 'exact', head: true }).eq('estado', 'P')
    setKpis({ total: total || 0, activos: activos || 0, termino: termino || 0, vacios: vacios || 0 })
  }

  async function loadData() {
    setLoading(true)
    let query = supabase
      .from('datos_arriendos')
      .select('idadmon, estado, propietario, idprop, idlinmue, inmueble, cuota, unid, termino_actual', { count: 'exact' })

    // Orden estable estilo Excel: la columna elegida manda como criterio principal,
    // y SIEMPRE se mantienen detrás los criterios por defecto (Estado ↓ · Propietario ↑ ·
    // Inmueble ↑) como desempate. Así la agrupación no se pierde al ordenar ni al filtrar.
    const ordenBase = [
      ['estado', false],
      ['propietario', true],
      ['inmueble', true],
    ]
    const claves = (sortCol === 'default')
      ? ordenBase
      : [[sortCol, sortDir === 'asc'], ...ordenBase.filter(([c]) => c !== sortCol)]
    claves.forEach(([c, asc]) => { query = query.order(c, { ascending: asc }) })

    query = query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

    if (search) query = query.or(`idadmon.ilike.%${search}%,inmueble.ilike.%${search}%,propietario.ilike.%${search}%,arrendatario.ilike.%${search}%`)
    if (filtroEstado) query = query.eq('estado', filtroEstado)
    if (filtroIdadmon) query = query.ilike('idadmon', `%${filtroIdadmon}%`)
    if (filtroInmueble) query = query.ilike('inmueble', `%${filtroInmueble}%`)
    if (filtroPropietario) query = query.ilike('propietario', `%${filtroPropietario}%`)

    const { data, count, error } = await query
    if (!error) {
      setPropiedades(data || [])
      setTotal(count || 0)
      // Construir mapa idadmon -> idprop
      const map = {}
      ;(data || []).forEach(p => { if (p.idprop) map[p.idadmon] = p.idprop })
      setIdpropMap(prev => ({ ...prev, ...map }))
    }
    setLoading(false)
  }

  async function verPortal(e, idadmon, idprop) {
    e.stopPropagation()
    if (!idprop) {
      alert('Este contrato no tiene propietario asignado (sin IDPROP)')
      return
    }
    setPortalLoading(idadmon)
    try {
      const res = await fetch('/api/portal/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idprop }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Error al acceder al portal')
        return
      }
      window.open(data.portalUrl, '_blank')
    } catch (err) {
      alert('Error de conexión')
    } finally {
      setPortalLoading(null)
    }
  }

  function handleSort(col, dir) { setSortCol(col); setSortDir(dir) }

  function limpiarTodo() {
    setSearch(''); setFiltroEstado(''); setFiltroIdadmon('')
    setFiltroInmueble(''); setFiltroPropietario('')
    setSortCol('default'); setSortDir('desc')
  }

  const hayFiltros = search || filtroEstado || filtroIdadmon || filtroInmueble || filtroPropietario
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const irAFormulario = () => router.push('/admin')

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      <TopNav />

      <div style={{ padding: '10px 24px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link href="/panel" style={{ fontSize: 12, color: 'var(--gray-400)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
          {Ico.back} Volver al panel
        </Link>
        <span style={{ color: 'var(--border)', fontSize: 14 }}>|</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, background: '#1a56db', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--gray-900)', margin: 0, letterSpacing: '-0.3px' }}>CC1 Administración</h1>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr) 200px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        {[
          { label: 'Total contratos', value: kpis.total,   color: 'var(--gray-800)', estado: '' },
          { label: 'Activos (S)',     value: kpis.activos, color: '#16a34a',          estado: 'S' },
          { label: 'En término (Q)', value: kpis.termino, color: '#d97706',     estado: 'Q' },
          { label: 'Vacíos (P)',  value: kpis.vacios,  color: '#dc2626',         estado: 'P' },
        ].map((k, i) => (
          <div key={i} style={{ padding: '10px 20px', borderRight: '1px solid var(--border)', cursor: 'pointer' }}
            onClick={() => setFiltroEstado(filtroEstado === k.estado ? '' : k.estado)}>
            <div style={{ fontSize: 10, color: 'var(--gray-400)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k.label}</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: k.color }}>{k.value}</div>
            {filtroEstado === k.estado && k.estado !== '' && <div style={{ fontSize: 10, color: '#1a56db', marginTop: 2 }}>● Filtro activo</div>}
          </div>
        ))}
        <div style={{ padding: '8px 14px', display: 'flex', alignItems: 'center' }}>
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
            style={{ width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--gray-50)', fontSize: 12, color: 'var(--gray-700)', fontFamily: 'inherit', cursor: 'pointer' }}>
            <option value="">Todos los estados</option>
            <option value="S">S – Activos</option>
            <option value="P">P – Vacíos</option>
            <option value="Q">Q – En término</option>
            <option value="SQ">SQ</option>
            <option value="O">O</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 24px' }}>
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '10px 16px', fontSize: 12, fontWeight: activeTab === tab ? 500 : 400,
            color: activeTab === tab ? '#1a56db' : 'var(--gray-400)', background: 'none', border: 'none',
            borderBottom: activeTab === tab ? '2px solid #1a56db' : '2px solid transparent',
            cursor: 'pointer', fontFamily: 'inherit', marginBottom: '-1px' }}>{tab}</button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '12px 24px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <ActionBtn label="Nuevo / Modificar arriendo" bg="#1a56db" icon={Ico.edit}  onClick={irAFormulario} />
        <ActionBtn label="Propietarios"               bg="#16a34a" icon={Ico.users} onClick={() => {}} />
        <ActionBtn label="Inmuebles"                  bg="#0891b2" icon={Ico.home}  onClick={() => {}} />
        <ActionBtn label="Calcular ajustes"           bg="#d97706" icon={Ico.calc}  onClick={() => {}} />
        <OperacionesBtn opciones={opEspecialesCC1} router={router} />
        <ActionBtn label="Cierre"                     bg="#dc2626" icon={Ico.lock}  onClick={() => {}} />
      </div>

      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--gray-800)', margin: 0 }}>
            Listado de propiedades administradas
            <span style={{ fontSize: 11, color: 'var(--gray-400)', fontWeight: 400, marginLeft: 8 }}>
              ({total} registros{filtroEstado ? ` · estado ${filtroEstado}` : ''})
            </span>
          </h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', display: 'flex' }}>{Ico.search}</span>
              <input type="text" placeholder="IDADMON, inmueble, propietario…" value={search} onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: 30, paddingRight: 12, paddingTop: 7, paddingBottom: 7, borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--gray-50)', fontSize: 12,
                  color: 'var(--gray-700)', fontFamily: 'inherit', width: 240, outline: 'none' }} />
            </div>
            {hayFiltros && (
              <button onClick={limpiarTodo} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)',
                background: '#FEF3C7', fontSize: 12, color: '#92400E', cursor: 'pointer', fontFamily: 'inherit' }}>
                ✕ Limpiar filtros
              </button>
            )}
          </div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'visible' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 85 }} />
              <col style={{ width: 180 }} />
              <col style={{ width: 150 }} />
              <col style={{ width: 65 }} />
              <col style={{ width: 95 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 70 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 65 }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--gray-50)' }}>
                <th style={{ padding: '9px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)', borderTopLeftRadius: 12 }}>
                  <ColFilter label="IDADMON" col="idadmon" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} searchVal={filtroIdadmon} onSearch={setFiltroIdadmon} />
                </th>
                <th style={{ padding: '9px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                  <ColFilter label="Inmueble" col="inmueble" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} searchVal={filtroInmueble} onSearch={setFiltroInmueble} />
                </th>
                <th style={{ padding: '9px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                  <ColFilter label="Propietario" col="propietario" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} searchVal={filtroPropietario} onSearch={setFiltroPropietario} />
                </th>
                <th style={{ padding: '9px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                  <EstadoFilter col="estado" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} value={filtroEstado} onChange={setFiltroEstado} />
                </th>
                <th style={{ padding: '9px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                  <ColFilter label="Cuota" col="cuota" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} searchVal="" onSearch={() => {}} />
                </th>
                <th style={{ padding: '9px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                  <ColFilter label="Término actual" col="termino_actual" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} searchVal="" onSearch={() => {}} />
                </th>
                <th style={{ padding: '9px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)', fontSize: 10, color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>IDPROP</th>
                <th style={{ padding: '9px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)', fontSize: 10, color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>IDLINMUE</th>
                <th style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)', fontSize: 10, color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase', borderTopRightRadius: 12 }}>Portal</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', fontSize: 12, color: 'var(--gray-400)' }}>Cargando datos...</td></tr>
              ) : propiedades.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', fontSize: 12, color: 'var(--gray-400)' }}>No se encontraron registros</td></tr>
              ) : propiedades.map((p, i) => {
                const alerta = alertaTermino(p.termino_actual)
                const cargando = portalLoading === p.idadmon
                return (
                  <tr key={i} style={{ cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-50)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    onClick={(e) => { if (!e.defaultPrevented) router.push(`/admin?idadmon=${p.idadmon}`) }}>
                    <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: 600, color: 'var(--gray-800)', borderBottom: '1px solid var(--border-subtle)' }}>{p.idadmon}</td>
                    <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--gray-700)', borderBottom: '1px solid var(--border-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.inmueble || '—'}</td>
                    <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--gray-700)', borderBottom: '1px solid var(--border-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.propietario || '—'}</td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border-subtle)' }}><EstadoBadge estado={p.estado} /></td>
                    <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--gray-700)', borderBottom: '1px solid var(--border-subtle)' }}>
                      {p.cuota ? `${p.unid === 'UF' ? 'UF ' : '$'}${Number(p.cuota).toLocaleString('es-CL')}` : '—'}
                    </td>
                    <td style={{ padding: '9px 12px', fontSize: 12, borderBottom: '1px solid var(--border-subtle)' }}>
                      {p.termino_actual ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: 'var(--gray-700)' }}>{new Date(p.termino_actual).toLocaleDateString('es-CL')}</span>
                          {alerta && <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 8, background: alerta.color + '20', color: alerta.color }}>{alerta.text}</span>}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '9px 12px', fontSize: 11, color: 'var(--gray-500)', borderBottom: '1px solid var(--border-subtle)', fontFamily: 'monospace' }}>{p.idprop || '—'}</td>
                    <td style={{ padding: '9px 12px', fontSize: 11, color: 'var(--gray-500)', borderBottom: '1px solid var(--border-subtle)', fontFamily: 'monospace' }}>{p.idlinmue || '—'}</td>
                    <td style={{ padding: '9px 8px', borderBottom: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                      {p.idprop ? (
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); verPortal(e, p.idadmon, p.idprop) }}
                          disabled={cargando}
                          title={`Ver portal como ${p.propietario}`}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '4px 8px', borderRadius: 6, border: '1px solid #BFDBFE',
                            background: cargando ? '#EFF6FF' : '#EFF6FF',
                            color: '#1a56db', fontSize: 11, cursor: cargando ? 'wait' : 'pointer',
                            fontFamily: 'inherit', fontWeight: 500,
                          }}
                          onMouseEnter={e => { if (!cargando) e.currentTarget.style.background = '#DBEAFE' }}
                          onMouseLeave={e => e.currentTarget.style.background = '#EFF6FF'}
                        >
                          {cargando ? '...' : <>{Ico.portal} Portal</>}
                        </button>
                      ) : (
                        <span style={{ color: 'var(--gray-300)', fontSize: 11 }}>—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 16 }}>
          <button onClick={() => setPage(1)} disabled={page===1} style={{ width:30, height:30, borderRadius:7, border:'1px solid var(--border)', background:'transparent', color:'var(--gray-500)', fontSize:12, cursor:page===1?'not-allowed':'pointer', opacity:page===1?0.4:1 }}>«</button>
          <button onClick={() => setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{ width:30, height:30, borderRadius:7, border:'1px solid var(--border)', background:'transparent', color:'var(--gray-500)', fontSize:12, cursor:page===1?'not-allowed':'pointer', opacity:page===1?0.4:1 }}>‹</button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const p = Math.max(1, Math.min(page-2, totalPages-4))+i
            if (p<1||p>totalPages) return null
            return <button key={p} onClick={() => setPage(p)} style={{ width:30, height:30, borderRadius:7, border:'1px solid var(--border)', background:p===page?'#1a56db':'transparent', color:p===page?'#fff':'var(--gray-500)', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>{p}</button>
          })}
          <button onClick={() => setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} style={{ width:30, height:30, borderRadius:7, border:'1px solid var(--border)', background:'transparent', color:'var(--gray-500)', fontSize:12, cursor:page===totalPages?'not-allowed':'pointer', opacity:page===totalPages?0.4:1 }}>›</button>
          <button onClick={() => setPage(totalPages)} disabled={page===totalPages} style={{ width:30, height:30, borderRadius:7, border:'1px solid var(--border)', background:'transparent', color:'var(--gray-500)', fontSize:12, cursor:page===totalPages?'not-allowed':'pointer', opacity:page===totalPages?0.4:1 }}>»</button>
          <span style={{ fontSize:11, color:'var(--gray-400)', marginLeft:8 }}>Página {page} de {totalPages} · {total} registros</span>
        </div>
      </div>
    </div>
  )
}