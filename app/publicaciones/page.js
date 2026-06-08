'use client'
import React from 'react'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
const MapaPublicaciones = dynamic(() => import('./MapaPublicaciones'), { ssr: false })
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import TopNav from '../components/ui/TopNav'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const IMG_BASE = 'https://fondocapital.com/propiedades/'
const PAGE_SIZE = 15

const PORTALES = [
  { key: 'pi',        label: 'Portal Inmobiliario', code: 'PI', bg: '#E6F1FB', color: '#1a56db' },
  { key: 'yapo',      label: 'Yapo',                code: 'Ya', bg: '#FAEEDA', color: '#854F0B' },
  { key: 'goplaceit', label: 'GoPlaceIt',            code: 'Go', bg: '#EAF3DE', color: '#3B6D11' },
  { key: 'web',       label: 'Web',                  code: 'We', bg: '#E6F1FB', color: '#0891b2' },
  { key: 'proppit',   label: 'Proppit',              code: 'Pr', bg: '#F3E8FF', color: '#7C3AED' },
]

function PortalBadge({ portal }) {
  async function nuevaPublicacion() {
    const res = await fetch('/api/publicaciones/nueva', { method: 'POST' })
    const data = await res.json()
    if (data.id) router.push('/publicaciones/' + data.id)
  }

  return (
    <span style={{ fontSize:10, padding:'2px 6px', borderRadius:5, background:portal.bg, color:portal.color, fontWeight:600 }}>
      {portal.code}
    </span>
  )
}

function activoEnPortales(pub) {
  return PORTALES.filter(p => pub[p.key] === 'SI')
}

function ObjetivoBadge({ objetivo }) {
  const esVenta = (objetivo||'').toLowerCase().includes('venta')
  async function nuevaPublicacion() {
    const res = await fetch('/api/publicaciones/nueva', { method: 'POST' })
    const data = await res.json()
    if (data.id) router.push('/publicaciones/' + data.id)
  }

  return (
    <span style={{ fontSize:10, padding:'2px 7px', borderRadius:8, fontWeight:500, background:esVenta?'#EAF3DE':'#E6F1FB', color:esVenta?'#3B6D11':'#1a56db' }}>
      {objetivo||'—'}
    </span>
  )
}

function Miniatura({ imagen, direccion }) {
  const [error, setError] = useState(false)
  if (!imagen || error) {
    async function nuevaPublicacion() {
    const res = await fetch('/api/publicaciones/nueva', { method: 'POST' })
    const data = await res.json()
    if (data.id) router.push('/publicaciones/' + data.id)
  }

  return (
      <div style={{ width:110, height:82, borderRadius:8, background:'var(--gray-100)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="var(--gray-300)" strokeWidth="1.5"/></svg>
      </div>
    )
  }
  return <img src={IMG_BASE+imagen} alt={direccion} onError={() => setError(true)} style={{ width:110, height:82, borderRadius:8, objectFit:'cover', display:'block' }} />
}


const emptyF = { selected: [], sort: null, min: '', max: '' }

function ExcelFilter({ label, type, options, value, onApply, align }) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const [selected, setSelected] = React.useState(value.selected || [])
  const [sortDir, setSortDir] = React.useState(value.sort || null)
  const [minVal, setMinVal] = React.useState(value.min ?? '')
  const [maxVal, setMaxVal] = React.useState(value.max ?? '')
  const ref = React.useRef(null)

  React.useEffect(() => {
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handle)
    async function nuevaPublicacion() {
    const res = await fetch('/api/publicaciones/nueva', { method: 'POST' })
    const data = await res.json()
    if (data.id) router.push('/publicaciones/' + data.id)
  }

  return () => document.removeEventListener('mousedown', handle)
  }, [])

  const activo = (value.selected && value.selected.length > 0) || value.sort || value.min !== '' || value.max !== ''
  const filteredOpts = options.filter(o => String(o || '').toLowerCase().includes(search.toLowerCase()))

  function toggleAll() { setSelected(selected.length === options.length ? [] : [...options]) }
  function toggle(opt) { setSelected(s => s.includes(opt) ? s.filter(x => x !== opt) : [...s, opt]) }

  function apply() { onApply({ selected, sort: sortDir, min: minVal, max: maxVal }); setOpen(false) }
  function clear() {
    setSelected([]); setSortDir(null); setMinVal(''); setMaxVal('')
    onApply({ selected: [], sort: null, min: '', max: '' }); setOpen(false)
  }

  async function nuevaPublicacion() {
    const res = await fetch('/api/publicaciones/nueva', { method: 'POST' })
    const data = await res.json()
    if (data.id) router.push('/publicaciones/' + data.id)
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      <button onClick={() => setOpen(v => !v)} style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600,
        color: activo ? '#1D4ED8' : '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em'
      }}>
        {label}
        <span style={{ fontSize: 9, color: activo ? '#1D4ED8' : '#9CA3AF' }}>
          {value.sort === 'asc' ? ' ↑' : value.sort === 'desc' ? ' ↓' : ' ⬇'}
        </span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', [align === 'right' ? 'right' : 'left']: 0, marginTop: 4,
          background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 220, zIndex: 300
        }}>
          <div style={{ padding: '8px 12px', borderBottom: '0.5px solid #F3F4F6' }}>
            <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 500, marginBottom: 6, textTransform: 'uppercase' }}>Ordenar</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[['asc', type === 'number' ? 'Menor → Mayor' : 'A → Z'], ['desc', type === 'number' ? 'Mayor → Menor' : 'Z → A']].map(([dir, lbl]) => (
                <button key={dir} onClick={() => setSortDir(d => d === dir ? null : dir)} style={{
                  flex: 1, padding: '4px 8px', borderRadius: 6, border: '1px solid',
                  fontSize: 11, cursor: 'pointer',
                  background: sortDir === dir ? '#EFF6FF' : '#F9FAFB',
                  borderColor: sortDir === dir ? '#BFDBFE' : '#E5E7EB',
                  color: sortDir === dir ? '#1D4ED8' : '#374151'
                }}>{lbl}</button>
              ))}
            </div>
          </div>
          {type === 'number' && (
            <div style={{ padding: '8px 12px', borderBottom: '0.5px solid #F3F4F6' }}>
              <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 500, marginBottom: 6, textTransform: 'uppercase' }}>Rango</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input placeholder="Mín" value={minVal} onChange={e => setMinVal(e.target.value)} type="number"
                  style={{ flex: 1, padding: '4px 8px', borderRadius: 6, border: '1px solid #E5E7EB', fontSize: 12 }} />
                <span style={{ color: '#9CA3AF', fontSize: 12 }}>—</span>
                <input placeholder="Máx" value={maxVal} onChange={e => setMaxVal(e.target.value)} type="number"
                  style={{ flex: 1, padding: '4px 8px', borderRadius: 6, border: '1px solid #E5E7EB', fontSize: 12 }} />
              </div>
            </div>
          )}
          <div style={{ padding: '8px 12px', borderBottom: '0.5px solid #F3F4F6' }}>
            <input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '4px 8px', borderRadius: 6, border: '1px solid #E5E7EB', fontSize: 12, boxSizing: 'border-box' }} />
          </div>
          <div style={{ maxHeight: 180, overflowY: 'auto', padding: '4px' }}>
            <div onClick={toggleAll} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
              onMouseEnter={e => e.currentTarget.style.background = '#F3F4F6'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <input type="checkbox" readOnly checked={selected.length === options.length} style={{ margin: 0 }} />
              <span style={{ fontWeight: 500 }}>Seleccionar todo</span>
            </div>
            {filteredOpts.map(opt => (
              <div key={String(opt)} onClick={() => toggle(opt)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
                onMouseEnter={e => e.currentTarget.style.background = '#F3F4F6'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <input type="checkbox" readOnly checked={selected.includes(opt)} style={{ margin: 0 }} />
                <span>{opt === null || opt === '' ? '(vacío)' : String(opt)}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: '8px 12px', borderTop: '0.5px solid #F3F4F6', display: 'flex', gap: 6 }}>
            <button onClick={clear} style={{ flex: 1, padding: '5px', borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', fontSize: 12, cursor: 'pointer', color: '#6B7280' }}>
              Limpiar
            </button>
            <button onClick={apply} style={{ flex: 1, padding: '5px', borderRadius: 6, border: 'none', background: '#1D4ED8', fontSize: 12, cursor: 'pointer', color: '#fff', fontWeight: 500 }}>
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PublicacionesPage() {
  const router = useRouter()
  const [vista, setVista] = useState('tabla')
  const [modo, setModo] = useState('activas') // 'activas' | 'historicas'
  const [pubs, setPubs] = useState([])
  const [pubsMapa, setPubsMapa] = useState([])
  const [fCodigo, setFCodigo] = useState(emptyF)
  const [fTipo, setFTipo] = useState(emptyF)
  const [fEstado, setFEstado] = useState(emptyF)
  const [fCaptador, setFCaptador] = useState(emptyF)
  const [fVendedor, setFVendedor] = useState(emptyF)
  const [fComuna, setFComuna] = useState(emptyF)
  const [fPrecio, setFPrecio] = useState(emptyF)
  const [sortCol, setSortCol] = useState(null)
  const [sortDir2, setSortDir2] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [filtroPortal, setFiltroPortal] = useState('')
  const [filtroObjetivo, setFiltroObjetivo] = useState('')
  const [kpis, setKpis] = useState({ total:0, arriendos:0, ventas:0, pi:0, yapo:0, historicas:0 })
  const [valorUF, setValorUF] = useState(null)
  const [republicando, setRepublicando] = useState(null)
  const [copiando, setCopiando] = useState(null)

  useEffect(() => { loadKpis() }, [])
  useEffect(() => { fetch('https://mindicador.cl/api/uf').then(r=>r.json()).then(d=>setValorUF(d.serie?.[0]?.valor||null)).catch(()=>{}) }, [])
  useEffect(() => { setPage(1) }, [search, filtroPortal, filtroObjetivo, modo])
  useEffect(() => { loadData() }, [page, search, filtroPortal, filtroObjetivo, modo])

  async function loadMapa() {
    let query = supabase
      .from('publicaciones')
      .select('id, codigo, direccion, comuna, objetivo, tipo, tipo_moneda, valor, latitud, longitud, dormitorios')
      .eq('activo', 'active')
      .not('latitud', 'is', null)
      .neq('latitud', '')
    if (filtroPortal) query = query.eq(filtroPortal, 'SI')
    if (filtroObjetivo === 'arriendo') query = query.ilike('objetivo', '%arriendo%')
    if (filtroObjetivo === 'venta') query = query.ilike('objetivo', '%venta%')
    const { data } = await query
    setPubsMapa(data || [])
  }

  useEffect(() => { if (vista === 'mapa') loadMapa() }, [vista, filtroPortal, filtroObjetivo])

  async function loadKpis() {
    const [
      { count: total },
      { count: arriendos },
      { count: ventas },
      { count: pi },
      { count: yapo },
      { count: historicas },
    ] = await Promise.all([
      supabase.from('publicaciones').select('*', { count:'exact', head:true }).or('pi.eq.SI,yapo.eq.SI,goplaceit.eq.SI,web.eq.SI,proppit.eq.SI'),
      supabase.from('publicaciones').select('*', { count:'exact', head:true }).or('pi.eq.SI,yapo.eq.SI,goplaceit.eq.SI,web.eq.SI,proppit.eq.SI').ilike('objetivo','%arriendo%'),
      supabase.from('publicaciones').select('*', { count:'exact', head:true }).or('pi.eq.SI,yapo.eq.SI,goplaceit.eq.SI,web.eq.SI,proppit.eq.SI').ilike('objetivo','%venta%'),
      supabase.from('publicaciones').select('*', { count:'exact', head:true }).eq('pi','SI'),
      supabase.from('publicaciones').select('*', { count:'exact', head:true }).eq('yapo','SI'),
      supabase.from('publicaciones').select('*', { count:'exact', head:true }).not('pi','eq','SI').not('yapo','eq','SI').not('goplaceit','eq','SI').not('web','eq','SI').not('proppit','eq','SI'),
    ])
    setKpis({ total:total||0, arriendos:arriendos||0, ventas:ventas||0, pi:pi||0, yapo:yapo||0, historicas:historicas||0 })
  }

  async function loadData() {
    setLoading(true)
    let query = supabase
      .from('publicaciones')
      .select('id, codigo, direccion, comuna, objetivo, tipo, tipo_moneda, valor, dormitorios, banos, propietario, vendedor, captador, pi, yapo, goplaceit, web, proppit, activo, estado, imagen1, mt2_const', { count:'exact' })
      .order('codigo', { ascending: false })
      .range((page-1)*PAGE_SIZE, page*PAGE_SIZE-1)

    if (modo === 'activas') {
      if (filtroPortal) {
        query = query.eq(filtroPortal, 'SI')
      } else {
        query = query.or('pi.eq.SI,yapo.eq.SI,goplaceit.eq.SI,web.eq.SI,proppit.eq.SI')
      }
    } else {
      // Históricas: ningún portal activo + borradores
      query = query.or('activo.eq.CREAR,and(pi.neq.SI,yapo.neq.SI,goplaceit.neq.SI,web.neq.SI,proppit.neq.SI)')
    }

    if (search) query = query.or(`direccion.ilike.%${search}%,comuna.ilike.%${search}%,propietario.ilike.%${search}%,codigo.ilike.%${search}%`)
    if (filtroObjetivo) query = query.ilike('objetivo', `%${filtroObjetivo}%`)

    const { data, count, error } = await query
    if (!error) { setPubs(data||[]); setTotal(count||0) }
    setLoading(false)
  }

  const totalPages = Math.max(1, Math.ceil(total/PAGE_SIZE))

  function formatValor(pub) {
    if (!pub.valor) return { principal:'—', secundario:null }
    const num = Number(pub.valor)
    if (pub.tipo_moneda === 'UF') {
      return { principal:`UF ${num.toLocaleString('es-CL')}`, secundario: valorUF?`$${Math.round(num*valorUF).toLocaleString('es-CL')}`:null }
    } else {
      return { principal:`$${num.toLocaleString('es-CL')}`, secundario: valorUF?`UF ${(num/valorUF).toFixed(2)}`:null }
    }
  }

  function PrecioCell({ pub }) {
    const v = formatValor(pub)
    async function nuevaPublicacion() {
    const res = await fetch('/api/publicaciones/nueva', { method: 'POST' })
    const data = await res.json()
    if (data.id) router.push('/publicaciones/' + data.id)
  }

  return (
      <div>
        <div style={{ fontSize:12, fontWeight:600, color:'var(--gray-800)' }}>{v.principal}</div>
        {v.secundario && <div style={{ fontSize:10, color:'var(--gray-400)', marginTop:2 }}>{v.secundario}</div>}
      </div>
    )
  }

  function BtnAccion({ label, color, bg, onClick, disabled }) {
    async function nuevaPublicacion() {
    const res = await fetch('/api/publicaciones/nueva', { method: 'POST' })
    const data = await res.json()
    if (data.id) router.push('/publicaciones/' + data.id)
  }

  return (
      <button onClick={onClick} disabled={disabled} style={{
        display:'block', width:'100%', textAlign:'center', padding:'4px 0', borderRadius:6, marginBottom:3,
        border:`1px solid ${disabled?'#d1d5db':color}`, background:disabled?'#f9fafb':bg,
        color:disabled?'#9ca3af':color, fontSize:10, fontWeight:500,
        cursor:disabled?'not-allowed':'pointer', fontFamily:'inherit',
      }}>{label}</button>
    )
  }

    // ── REPUBLICAR ──
    async function republicar(pub) {
      if (!window.confirm(`¿Republicar la propiedad ${pub.codigo}?\n\nSe creará una nueva con el siguiente código y la original quedará como histórica.`)) return
      setRepublicando(pub.id)
      try {
        const res = await fetch('/api/publicaciones/republicar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceId: pub.id }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error al republicar')
        if (data.warning) alert('⚠️ ' + data.warning)
        await loadKpis()
        await loadData()
        alert(`✓ Propiedad republicada con el código ${data.codigo}`)
        router.push(`/publicaciones/${data.id}`)
      } catch (e) {
        alert('Error al republicar: ' + e.message)
      }
      setRepublicando(null)
    }

// ── COPIAR PUBLICACIÓN (sin cerrar original, sin imágenes) ──
  async function copiar(pub) {
    if (!window.confirm(`¿Copiar la propiedad ${pub.codigo}?\n\nSe creará una nueva con los mismos datos (sin fotos). La original NO se modifica.`)) return
    setCopiando(pub.id)
    try {
      const res = await fetch('/api/publicaciones/copiar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: pub.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al copiar')
      // Navegar directamente a la ficha de la copia
      router.push(`/publicaciones/${data.id}`)
    } catch (e) {
      alert('Error al copiar: ' + e.message)
    }
    setCopiando(null)
  }
  function Paginador() {
    async function nuevaPublicacion() {
    const res = await fetch('/api/publicaciones/nueva', { method: 'POST' })
    const data = await res.json()
    if (data.id) router.push('/publicaciones/' + data.id)
  }

  return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:4, marginTop:20 }}>
        <button onClick={() => setPage(1)} disabled={page===1} style={{ width:30, height:30, borderRadius:7, border:'1px solid var(--border)', background:'transparent', color:'var(--gray-500)', fontSize:12, cursor:page===1?'not-allowed':'pointer', opacity:page===1?0.4:1 }}>«</button>
        <button onClick={() => setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{ width:30, height:30, borderRadius:7, border:'1px solid var(--border)', background:'transparent', color:'var(--gray-500)', fontSize:12, cursor:page===1?'not-allowed':'pointer', opacity:page===1?0.4:1 }}>‹</button>
        {Array.from({ length:Math.min(5,totalPages) }, (_,i) => {
          const p = Math.max(1,Math.min(page-2,totalPages-4))+i
          if (p<1||p>totalPages) return null
          return <button key={p} onClick={() => setPage(p)} style={{ width:30, height:30, borderRadius:7, border:'1px solid var(--border)', background:p===page?'#1a56db':'transparent', color:p===page?'#fff':'var(--gray-500)', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>{p}</button>
        })}
        <button onClick={() => setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} style={{ width:30, height:30, borderRadius:7, border:'1px solid var(--border)', background:'transparent', color:'var(--gray-500)', fontSize:12, cursor:page===totalPages?'not-allowed':'pointer', opacity:page===totalPages?0.4:1 }}>›</button>
        <button onClick={() => setPage(totalPages)} disabled={page===totalPages} style={{ width:30, height:30, borderRadius:7, border:'1px solid var(--border)', background:'transparent', color:'var(--gray-500)', fontSize:12, cursor:page===totalPages?'not-allowed':'pointer', opacity:page===totalPages?0.4:1 }}>»</button>
        <span style={{ fontSize:11, color:'var(--gray-400)', marginLeft:8 }}>Página {page} de {totalPages} · {total} registros</span>
      </div>
    )
  }


  const unicos = (campo) => [...new Set(pubs.map(p => p[campo]).filter(Boolean))].sort()

  function applyExcelFilters(lista) {
    let r = [...lista]
    if (fCodigo.selected.length) r = r.filter(p => fCodigo.selected.includes(p.codigo))
    if (fTipo.selected.length) r = r.filter(p => fTipo.selected.includes(p.tipo))
    if (fEstado.selected.length) r = r.filter(p => fEstado.selected.includes(p.estado))
    if (fCaptador.selected.length) r = r.filter(p => fCaptador.selected.includes(p.captador))
    if (fVendedor.selected.length) r = r.filter(p => fVendedor.selected.includes(p.vendedor))
    if (fComuna.selected.length) r = r.filter(p => fComuna.selected.includes(p.comuna))
    const toP = (p) => p.tipo_moneda === 'UF' ? Number(p.valor||0) * (valorUF||1) : Number(p.valor||0)
    if (fPrecio.min !== '') r = r.filter(p => toP(p) >= Number(fPrecio.min))
    if (fPrecio.max !== '') r = r.filter(p => toP(p) <= Number(fPrecio.max))
    const sorts = [
      { f: fCodigo, k: 'codigo' }, { f: fTipo, k: 'tipo' },
      { f: fEstado, k: 'estado' }, { f: fCaptador, k: 'captador' },
      { f: fVendedor, k: 'vendedor' }, { f: fComuna, k: 'comuna' }, { f: fPrecio, k: 'valor', n: true },
    ].filter(s => s.f.sort)
    if (sorts.length) {
      const { k, f, n } = sorts[sorts.length - 1]
      r.sort((a, b) => {
        const toP = (p) => p.tipo_moneda === 'UF' ? Number(p.valor||0) * (valorUF||1) : Number(p.valor||0)
        const av = k === 'valor' ? toP(a) : (n ? Number(a[k]||0) : String(a[k]||''))
        const bv = k === 'valor' ? toP(b) : (n ? Number(b[k]||0) : String(b[k]||''))
        return f.sort === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
      })
    }
    return r
  }

  const pubsFiltradas = applyExcelFilters(pubs)

  async function nuevaPublicacion() {
    const res = await fetch('/api/publicaciones/nueva', { method: 'POST' })
    const data = await res.json()
    if (data.id) router.push('/publicaciones/' + data.id)
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--background)' }}>
      <TopNav />

      {/* Cabecera */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 24px', background:'var(--surface)', borderBottom:'1px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:32, height:32, background:'#1a56db', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div>
            <h1 style={{ fontSize:16, fontWeight:600, color:'var(--gray-900)', margin:0 }}>Publicaciones</h1>
            <p style={{ fontSize:11, color:'var(--gray-400)', margin:0 }}>
              Portales inmobiliarios activos
              {valorUF && <span style={{ marginLeft:8, color:'#16a34a' }}>· UF hoy: ${valorUF.toLocaleString('es-CL')}</span>}
            </p>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {/* Toggle Activas / Históricas */}
          <div style={{ display:'flex', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
            <button onClick={() => setModo('activas')} style={{ padding:'6px 14px', border:'none', fontSize:11, fontWeight:500, cursor:'pointer', fontFamily:'inherit', background:modo==='activas'?'#1a56db':'transparent', color:modo==='activas'?'#fff':'var(--gray-500)' }}>
              ● Activas
            </button>
            <button onClick={() => setModo('historicas')} style={{ padding:'6px 14px', border:'none', fontSize:11, fontWeight:500, cursor:'pointer', fontFamily:'inherit', background:modo==='historicas'?'#6b7280':'transparent', color:modo==='historicas'?'#fff':'var(--gray-500)' }}>
              📁 Históricas ({kpis.historicas})
            </button>
          </div>
          {/* Toggle tabla/tarjetas */}
          <div style={{ display:'flex', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
            <button onClick={() => setVista('tabla')} style={{ padding:'6px 14px', border:'none', fontSize:11, fontWeight:500, cursor:'pointer', fontFamily:'inherit', background:vista==='tabla'?'#1a56db':'transparent', color:vista==='tabla'?'#fff':'var(--gray-500)' }}>☰ Tabla</button>
            <button onClick={() => setVista('tarjetas')} style={{ padding:'6px 14px', border:'none', fontSize:11, fontWeight:500, cursor:'pointer', fontFamily:'inherit', background:vista==='tarjetas'?'#1a56db':'transparent', color:vista==='tarjetas'?'#fff':'var(--gray-500)' }}>⊞ Tarjetas</button>
              <button onClick={() => setVista('mapa')} style={{ padding:'6px 14px', border:'none', fontSize:11, fontWeight:500, cursor:'pointer', fontFamily:'inherit', background:vista==='mapa'?'#1a56db':'transparent', color:vista==='mapa'?'#fff':'var(--gray-500)' }}>🗺 Mapa</button>
          </div>
          <button style={{ padding:'7px 16px', background:'#1a56db', color:'#fff', border:'none', borderRadius:8, fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:'inherit' }} onClick={nuevaPublicacion}>+ Nueva publicación</button>
        </div>
      </div>

      {/* KPI bar */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', background:'var(--surface)', borderBottom:'1px solid var(--border)' }}>
        {[
          { label:'Total activas',  value:kpis.total,      color:'#1a56db' },
          { label:'Arriendos',      value:kpis.arriendos,  color:'#16a34a' },
          { label:'Ventas',         value:kpis.ventas,     color:'#d97706' },
          { label:'En PI',          value:kpis.pi,         color:'#1a56db' },
          { label:'En Yapo',        value:kpis.yapo,       color:'#854F0B' },
          { label:'Históricas',     value:kpis.historicas, color:'#6b7280' },
        ].map((k,i) => (
          <div key={i} style={{ padding:'10px 16px', borderRight:i<5?'1px solid var(--border)':'none', cursor:i===5?'pointer':'default' }}
            onClick={() => i===5 && setModo('historicas')}
          >
            <div style={{ fontSize:10, color:'var(--gray-400)', marginBottom:3, textTransform:'uppercase', letterSpacing:'0.05em' }}>{k.label}</div>
            <div style={{ fontSize:18, fontWeight:600, color:k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Banner modo históricas */}
      {modo === 'historicas' && (
        <div style={{ padding:'10px 24px', background:'#f9fafb', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:12, color:'#6b7280', fontWeight:500 }}>
            📁 Mostrando propiedades históricas (sin portales activos) — ordenadas por código descendente
          </span>
          <button onClick={() => setModo('activas')} style={{ fontSize:11, color:'#1a56db', background:'transparent', border:'none', cursor:'pointer', fontFamily:'inherit', marginLeft:'auto' }}>
            ← Volver a activas
          </button>
        </div>
      )}

      {/* Filtros */}
      <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', padding:'10px 24px', background:'var(--surface)', borderBottom:'1px solid var(--border)' }}>
        <div style={{ position:'relative' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'var(--gray-400)' }}>
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
            <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <input type="text" placeholder="Dirección, comuna, código…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft:30, paddingRight:12, paddingTop:6, paddingBottom:6, borderRadius:8, border:'1px solid var(--border)', background:'var(--gray-50)', fontSize:12, color:'var(--gray-700)', fontFamily:'inherit', width:220, outline:'none' }}
          />
        </div>
        <select value={filtroObjetivo} onChange={e => setFiltroObjetivo(e.target.value)} style={{ padding:'6px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--gray-50)', fontSize:12, color:'var(--gray-700)', fontFamily:'inherit', cursor:'pointer' }}>
          <option value="">Arriendo + Venta</option>
          <option value="arriendo">Solo arriendos</option>
          <option value="venta">Solo ventas</option>
        </select>
        {modo === 'activas' && (
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={() => setFiltroPortal('')} style={{ padding:'5px 12px', borderRadius:7, fontSize:11, fontWeight:500, cursor:'pointer', fontFamily:'inherit', border:'1px solid var(--border)', background:filtroPortal===''?'#1a56db':'transparent', color:filtroPortal===''?'#fff':'var(--gray-500)' }}>Todos</button>
            {PORTALES.map(p => (
              <button key={p.key} onClick={() => setFiltroPortal(filtroPortal===p.key?'':p.key)} style={{ padding:'5px 12px', borderRadius:7, fontSize:11, fontWeight:500, cursor:'pointer', fontFamily:'inherit', background:filtroPortal===p.key?p.color:p.bg, color:filtroPortal===p.key?'#fff':p.color, border:`1px solid ${p.color}40` }}>{p.label}</button>
            ))}
          </div>
        )}
        {(search||filtroPortal||filtroObjetivo) && (
          <button onClick={() => { setSearch(''); setFiltroPortal(''); setFiltroObjetivo('') }} style={{ padding:'6px 12px', borderRadius:7, border:'1px solid var(--border)', background:'transparent', fontSize:11, color:'var(--gray-500)', cursor:'pointer', fontFamily:'inherit' }}>Limpiar</button>
        )}
        <span style={{ marginLeft:'auto', fontSize:11, color:'var(--gray-400)' }}>{total} publicaciones</span>
      </div>

      {/* Contenido */}
      <div style={{ padding:'20px 24px' }}>
        {loading ? (
          <div style={{ textAlign:'center', padding:40, fontSize:12, color:'var(--gray-400)' }}>Cargando...</div>
        ) : pubs.length === 0 ? (
          <div style={{ textAlign:'center', padding:40, fontSize:12, color:'var(--gray-400)' }}>No se encontraron publicaciones</div>
        ) : vista === 'mapa' ? (
          <MapaPublicaciones key={filtroPortal + '|' + filtroObjetivo + '|' + modo} pubs={pubsMapa} />
        ) : vista === 'tabla' ? (

          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', tableLayout:'fixed' }}>
              <colgroup>
                <col style={{ width:126 }} /><col style={{ width:65 }} /><col style={{ width:100 }} />
                <col style={{ width:90 }} /><col style={{ width:90 }} /><col style={{ width:120 }} />
                <col /><col style={{ width:120 }} /><col style={{ width:95 }} />
                <col style={{ width:modo==='historicas'?110:100 }} />
              </colgroup>
              <thead>
                <tr style={{ background:'var(--gray-50)' }}>
                  <th style={{ padding:'9px 10px', borderBottom:'1px solid var(--border)', background:'var(--gray-50)', whiteSpace:'nowrap', fontSize:10, fontWeight:600, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Imagen</th>
                    <th style={{ padding:'9px 10px', borderBottom:'1px solid var(--border)', background:'var(--gray-50)' }}>
                      <ExcelFilter label="Código" type="text" options={unicos('codigo')} value={fCodigo} onApply={setFCodigo} />
                    </th>
                    <th style={{ padding:'9px 10px', borderBottom:'1px solid var(--border)', background:'var(--gray-50)' }}>
                      <ExcelFilter label="Tipo" type="text" options={unicos('tipo')} value={fTipo} onApply={setFTipo} />
                    </th>
                    <th style={{ padding:'9px 10px', borderBottom:'1px solid var(--border)', background:'var(--gray-50)', whiteSpace:'nowrap', fontSize:10, fontWeight:600, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Operación</th>
                    <th style={{ padding:'9px 10px', borderBottom:'1px solid var(--border)', background:'var(--gray-50)' }}>
                      <ExcelFilter label="Estado" type="text" options={unicos('estado')} value={fEstado} onApply={setFEstado} />
                    </th>
                    <th style={{ padding:'9px 10px', borderBottom:'1px solid var(--border)', background:'var(--gray-50)' }}>
                      <ExcelFilter label="Captador" type="text" options={unicos('captador')} value={fCaptador} onApply={setFCaptador} />
                    </th>
                    <th style={{ padding:'9px 10px', borderBottom:'1px solid var(--border)', background:'var(--gray-50)' }}>
                      <ExcelFilter label="Vendedor" type="text" options={unicos('vendedor')} value={fVendedor} onApply={setFVendedor} />
                    </th>
                    <th style={{ padding:'9px 10px', borderBottom:'1px solid var(--border)', background:'var(--gray-50)', whiteSpace:'nowrap', fontSize:10, fontWeight:600, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Dirección</th>
                    <th style={{ padding:'9px 10px', borderBottom:'1px solid var(--border)', background:'var(--gray-50)' }}><ExcelFilter label="Precio" type="number" options={[]} value={fPrecio} onApply={setFPrecio} /></th>
                    <th style={{ padding:'9px 10px', borderBottom:'1px solid var(--border)', background:'var(--gray-50)' }}>
                      <ExcelFilter label="Comuna" type="text" options={unicos('comuna')} value={fComuna} onApply={setFComuna} />
                    </th>
                    <th style={{ padding:'9px 10px', borderBottom:'1px solid var(--border)', background:'var(--gray-50)', whiteSpace:'nowrap', fontSize:10, fontWeight:600, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'0.05em' }}>{modo==='historicas'?'Acción':'Acciones'}</th>
                </tr>
              </thead>
              <tbody>
                {pubsFiltradas.map((p,i) => {
                  const activos = activoEnPortales(p)
                  const esHistorica = modo === 'historicas'
                  async function nuevaPublicacion() {
    const res = await fetch('/api/publicaciones/nueva', { method: 'POST' })
    const data = await res.json()
    if (data.id) router.push('/publicaciones/' + data.id)
  }

  return (
                    <tr key={i}
                      style={{ background:esHistorica?'#fafafa':'transparent' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-50)'}
                      onMouseLeave={e => e.currentTarget.style.background = esHistorica?'#fafafa':'transparent'}
                    >
                      <td style={{ padding:'8px 8px 8px 12px', borderBottom:'1px solid var(--border-subtle)', verticalAlign:'middle', opacity:esHistorica?0.7:1 }}>
                        <Miniatura imagen={p.imagen1} direccion={p.direccion} />
                      </td>
                      <td style={{ padding:'8px 10px', fontSize:12, fontWeight:700, color:esHistorica?'#6b7280':'#1a56db', borderBottom:'1px solid var(--border-subtle)', verticalAlign:'top' }}>
                        {p.codigo||'—'}
                      </td>
                      <td style={{ padding:'8px 10px', fontSize:11, color:'var(--gray-600)', borderBottom:'1px solid var(--border-subtle)', verticalAlign:'top', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {p.tipo||'—'}
                      </td>
                      <td style={{ padding:'8px 10px', borderBottom:'1px solid var(--border-subtle)', verticalAlign:'top' }}>
                        <ObjetivoBadge objetivo={p.objetivo} />
                      </td>
                      <td style={{ padding:'8px 10px', borderBottom:'1px solid var(--border-subtle)', verticalAlign:'top' }}>
                        {esHistorica ? (
                          <span style={{ fontSize:10, padding:'2px 7px', borderRadius:6, fontWeight:500, background:'#f3f4f6', color:'#6b7280' }}>
                            {p.activo||'Histórica'}
                          </span>
                        ) : (
                          <>
                            {p.activo && <span style={{ display:'inline-block', fontSize:10, padding:'2px 6px', borderRadius:6, fontWeight:500, marginBottom:4, background:p.activo==='active'?'#EAF3DE':'#f3f4f6', color:p.activo==='active'?'#3B6D11':'#6b7280' }}>{p.activo==='active'?'Activa':p.activo}</span>}
                            <div style={{ display:'flex', gap:3, flexWrap:'wrap' }}>
                              {activos.map(portal => <PortalBadge key={portal.key} portal={portal} />)}
                            </div>
                          </>
                        )}
                      </td>
                      <td style={{ padding:'8px 10px', fontSize:11, color:'var(--gray-600)', borderBottom:'1px solid var(--border-subtle)', verticalAlign:'top', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {p.captador||'—'}
                      </td>
                      <td style={{ padding:'8px 10px', fontSize:11, color:'var(--gray-600)', borderBottom:'1px solid var(--border-subtle)', verticalAlign:'top', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {p.vendedor||'—'}
                      </td>
                      <td style={{ padding:'8px 10px', borderBottom:'1px solid var(--border-subtle)', verticalAlign:'top' }}>
                        <div style={{ fontSize:12, fontWeight:500, color:'var(--gray-800)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.direccion||'—'}</div>
                        <div style={{ fontSize:10, color:'var(--gray-400)', marginTop:2 }}>
                          {[p.dormitorios&&`${p.dormitorios} dorm.`,p.banos&&`${p.banos} baños`,p.mt2_const&&`${p.mt2_const}m²`].filter(Boolean).join(' · ')}
                        </div>
                      </td>
                      <td style={{ padding:'8px 10px', borderBottom:'1px solid var(--border-subtle)', verticalAlign:'top' }}>
                        <PrecioCell pub={p} />
                      </td>
                      <td style={{ padding:'8px 10px', fontSize:11, color:'var(--gray-600)', borderBottom:'1px solid var(--border-subtle)', verticalAlign:'top', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {p.comuna||'—'}
                      </td>
                      <td style={{ padding:'8px 10px', borderBottom:'1px solid var(--border-subtle)', verticalAlign:'top' }}>
                        {esHistorica ? (
                          <>
                          <BtnAccion label="Ficha" color="#0891b2" bg="#ecfeff" onClick={() => router.push(`/publicaciones/${p.id}`)} />
                            <BtnAccion
                              label={copiando===p.id ? '⏳ Copiando...' : '📋 Copiar'}
                              color="#7c3aed" bg="#f5f3ff"
                              onClick={() => copiar(p)}
                              disabled={copiando===p.id}
                            />
                            <BtnAccion
                              label={republicando===p.id ? '⏳ Republicando...' : '🔄 Republicar'}
                              color="#16a34a" bg="#f0fdf4"
                              onClick={() => republicar(p)}
                              disabled={republicando===p.id}
                            />                          </>
                        ) : (
                          <>
                            <BtnAccion label="Editar"    color="#1a56db" bg="#eff6ff" onClick={() => {}} />
                            <BtnAccion label="Ficha"     color="#16a34a" bg="#f0fdf4" onClick={() => router.push(`/publicaciones/${p.id}`)} />
                            <BtnAccion
                              label={copiando===p.id ? '⏳ Copiando...' : '📋 Copiar'}
                              color="#7c3aed" bg="#f5f3ff"
                              onClick={() => copiar(p)}
                              disabled={copiando===p.id}
                            />
                            <BtnAccion label="Compartir" color="#dc2626" bg="#fef2f2" onClick={() => {}} />
                          </>                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

        ) : (

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px,1fr))', gap:16 }}>
            {pubs.map((p,i) => {
              const activos = activoEnPortales(p)
              const imgUrl = p.imagen1 ? IMG_BASE+p.imagen1 : null
              const v = formatValor(p)
              const esHistorica = modo === 'historicas'
              async function nuevaPublicacion() {
    const res = await fetch('/api/publicaciones/nueva', { method: 'POST' })
    const data = await res.json()
    if (data.id) router.push('/publicaciones/' + data.id)
  }

  return (
                <div key={i} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', opacity:esHistorica?0.85:1, transition:'border-color 0.15s, box-shadow 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor='#1a56db'; e.currentTarget.style.boxShadow='0 2px 12px rgba(26,86,219,0.1)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.boxShadow='none' }}
                >
                  <div style={{ height:150, background:'var(--gray-100)', position:'relative', overflow:'hidden' }}>
                    {imgUrl ? <img src={imgUrl} alt={p.direccion} style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e => e.target.style.display='none'} /> : (
                      <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="var(--gray-300)" strokeWidth="1.5"/></svg>
                      </div>
                    )}
                    {esHistorica && <div style={{ position:'absolute', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.15)' }} />}
                    <span style={{ position:'absolute', top:8, left:8, fontSize:10, padding:'3px 8px', borderRadius:8, fontWeight:600, background:(p.objetivo||'').toLowerCase().includes('venta')?'#3B6D11':'#1a56db', color:'#fff' }}>{p.objetivo||'—'}</span>
                    {esHistorica && <span style={{ position:'absolute', top:8, right:8, fontSize:10, padding:'3px 8px', borderRadius:8, fontWeight:600, background:'rgba(0,0,0,0.5)', color:'#fff' }}>📁 Histórica</span>}
                    <div style={{ position:'absolute', bottom:8, right:8, textAlign:'right' }}>
                      <div style={{ fontSize:12, padding:'3px 10px', borderRadius:8, fontWeight:600, background:'rgba(0,0,0,0.6)', color:'#fff' }}>{v.principal}</div>
                      {v.secundario && <div style={{ fontSize:10, padding:'2px 8px', borderRadius:6, fontWeight:500, background:'rgba(0,0,0,0.45)', color:'#e5e7eb', marginTop:2 }}>{v.secundario}</div>}
                    </div>
                  </div>
                  <div style={{ padding:'12px 14px' }}>
                    <div style={{ fontSize:13, fontWeight:500, color:'var(--gray-800)', marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.direccion||'—'}</div>
                    <div style={{ fontSize:11, color:'var(--gray-400)', marginBottom:8 }}>
                      {[p.comuna,p.dormitorios?`${p.dormitorios} dorm.`:null,p.banos?`${p.banos} baños`:null,p.mt2_const?`${p.mt2_const}m²`:null].filter(Boolean).join(' · ')}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                      <div style={{ display:'flex', gap:4 }}>{activos.map(portal => <PortalBadge key={portal.key} portal={portal} />)}</div>
                      <span style={{ fontSize:10, color:'var(--gray-400)' }}>{p.codigo||''}</span>
                    </div>
                    <div style={{ display:'flex', gap:6 }}>
                      {esHistorica ? (
                        <>
                          <button onClick={() => router.push(`/publicaciones/${p.id}`)} style={{ flex:1, padding:'5px 0', borderRadius:6, border:'1px solid #0891b2', background:'#ecfeff', color:'#0891b2', fontSize:10, fontWeight:500, cursor:'pointer', fontFamily:'inherit' }}>Ficha</button>
                          <button onClick={() => republicar(p)} disabled={republicando===p.id} style={{ flex:2, padding:'5px 0', borderRadius:6, border:'1px solid #16a34a', background:'#f0fdf4', color:'#16a34a', fontSize:10, fontWeight:500, cursor:republicando===p.id?'not-allowed':'pointer', fontFamily:'inherit' }}>
                            {republicando===p.id?'⏳ Republicando...':'🔄 Republicar'}
                          </button>
                        </>
                      ) : (
                        <>
                          <button style={{ flex:1, padding:'5px 0', borderRadius:6, border:'1px solid #1a56db', background:'#eff6ff', color:'#1a56db', fontSize:10, fontWeight:500, cursor:'pointer', fontFamily:'inherit' }}>Editar</button>
                          <button onClick={() => router.push(`/publicaciones/${p.id}`)} style={{ flex:1, padding:'5px 0', borderRadius:6, border:'1px solid #16a34a', background:'#f0fdf4', color:'#16a34a', fontSize:10, fontWeight:500, cursor:'pointer', fontFamily:'inherit' }}>Ficha</button>
                          <button style={{ flex:1, padding:'5px 0', borderRadius:6, border:'1px solid #dc2626', background:'#fef2f2', color:'#dc2626', fontSize:10, fontWeight:500, cursor:'pointer', fontFamily:'inherit' }}>Compartir</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <Paginador />
      </div>
    </div>
  )
}

