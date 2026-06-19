'use client'
import React from 'react'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import TopNav from '../components/ui/TopNav'

const DIRECCION_EMAILS = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com']

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const PAGE_SIZE = 20

function norm(s) {
  return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
}
function llaveDe(p) {
  return [norm(p.comuna), norm(p.calle), norm(p.numero_calle), norm(p.departamento)].join('|')
}
function esActiva(p) { return p.activo === 'active' }

function fmtValor(p) {
  if (p.valor == null || p.valor === '') return '—'
  const m = (p.tipo_moneda || '').toUpperCase()
  const simbolo = (m === 'UF' || m === 'CLF') ? 'UF ' : '$'
  const n = Number(p.valor)
  if (isNaN(n)) return String(p.valor)
  return simbolo + n.toLocaleString('es-CL')
}
function valorOrden(p) {
  const n = Number(p.valor)
  if (isNaN(n)) return -1
  const m = (p.tipo_moneda || '').toUpperCase()
  return (m === 'UF' || m === 'CLF') ? n * 40790 : n
}
function fmtFecha(s) {
  if (!s) return '—'
  const d = new Date(s)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function PropiedadesPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const rol = session?.user?.role
  const email = session?.user?.email
  const esAdmin = rol === 'admin' || DIRECCION_EMAILS.includes(email)

  // Redirigir al inicio si no es admin (pagina invisible para no autorizados)
  useEffect(() => {
    if (status !== 'loading' && !esAdmin) router.replace('/')
  }, [status, esAdmin, router])

  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [busca, setBusca] = useState('')
  const [page, setPage] = useState(1)
  const [filtro, setFiltro] = useState('todas')
  const [comuna, setComuna] = useState('')
  const [sortKey, setSortKey] = useState('estado')
  const [sortDir, setSortDir] = useState('desc')

  useEffect(() => {
    if (status === 'loading') return
    if (!esAdmin) { setLoading(false); return }
    let cancelado = false
    async function cargar() {
      setLoading(true)
      const cols = 'id, codigo, comuna, calle, numero_calle, departamento, direccion, objetivo, tipo, tipo_moneda, valor, dormitorios, banos, estacionamientos, bodegas, propietario, vendedor, activo, pi, web, yapo, updated_at'
      let todas = []
      let desde = 0
      const lote = 1000
      while (true) {
        const { data, error } = await supabase
          .from('publicaciones').select(cols)
          .order('codigo', { ascending: false })
          .range(desde, desde + lote - 1)
        if (error) { console.error(error); break }
        if (!data || data.length === 0) break
        todas = todas.concat(data)
        if (data.length < lote) break
        desde += lote
        if (desde > 20000) break
      }
      if (!cancelado) { setRows(todas); setLoading(false) }
    }
    cargar()
    return () => { cancelado = true }
  }, [status, esAdmin])

  const propiedades = useMemo(() => {
    const mapa = new Map()
    for (const p of rows) {
      const k = llaveDe(p)
      let g = mapa.get(k)
      if (!g) { g = { llave: k, versiones: [] }; mapa.set(k, g) }
      g.versiones.push(p)
    }
    const lista = []
    for (const g of mapa.values()) {
      const activas = g.versiones.filter(esActiva)
      const reppool = activas.length ? activas : g.versiones
      const rep = reppool.reduce((a, b) => (Number(b.codigo) > Number(a.codigo) ? b : a), reppool[0])
      let ultima = null
      for (const v of g.versiones) {
        if (v.updated_at && (!ultima || new Date(v.updated_at) > new Date(ultima))) ultima = v.updated_at
      }
      lista.push({
        llave: g.llave, rep,
        nVersiones: g.versiones.length,
        nActivas: activas.length,
        tieneDepto: !!(rep.departamento && String(rep.departamento).trim()),
        ultima,
      })
    }
    return lista
  }, [rows])

  const comunas = useMemo(() => {
    const set = new Set()
    for (const x of propiedades) if (x.rep.comuna) set.add(x.rep.comuna)
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [propiedades])

  const nReferenciales = useMemo(() => propiedades.filter(x => !x.tieneDepto).length, [propiedades])

  const filtradas = useMemo(() => {
    let l = propiedades
    if (filtro === 'activas') l = l.filter(x => x.nActivas > 0)
    else if (filtro === 'arriendo') l = l.filter(x => (x.rep.objetivo || '').toLowerCase().includes('arriendo'))
    else if (filtro === 'venta') l = l.filter(x => (x.rep.objetivo || '').toLowerCase().includes('venta'))
    else if (filtro === 'referenciales') l = l.filter(x => !x.tieneDepto)
    if (comuna) l = l.filter(x => x.rep.comuna === comuna)
    const q = norm(busca)
    if (q) l = l.filter(x => {
      const r = x.rep
      return norm([r.calle, r.numero_calle, r.departamento, r.comuna, r.propietario, r.codigo].join(' ')).includes(q)
    })
    return l
  }, [propiedades, filtro, comuna, busca])

  const ordenadas = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    const val = (x) => {
      const r = x.rep
      switch (sortKey) {
        case 'direccion': return norm(r.calle + ' ' + r.numero_calle)
        case 'depto': return norm(r.departamento)
        case 'comuna': return norm(r.comuna)
        case 'operacion': return norm(r.objetivo)
        case 'tipo': return norm(r.tipo)
        case 'dorm': return Number(r.dormitorios) || 0
        case 'banos': return Number(r.banos) || 0
        case 'estac': return Number(r.estacionamientos) || 0
        case 'valor': return valorOrden(r)
        case 'propietario': return norm(r.propietario)
        case 'estado': return x.nActivas > 0 ? 1 : 0
        case 'versiones': return x.nVersiones
        case 'ultima': return x.ultima ? new Date(x.ultima).getTime() : 0
        default: return 0
      }
    }
    const arr = [...filtradas]
    arr.sort((a, b) => {
      const va = val(a), vb = val(b)
      if (va < vb) return -1 * dir
      if (va > vb) return 1 * dir
      return norm(a.rep.comuna + a.rep.calle).localeCompare(norm(b.rep.comuna + b.rep.calle))
    })
    return arr
  }, [filtradas, sortKey, sortDir])

  const totalPaginas = Math.max(1, Math.ceil(ordenadas.length / PAGE_SIZE))
  const pagina = ordenadas.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  useEffect(() => { setPage(1) }, [busca, filtro, comuna, sortKey, sortDir])

  function clickSort(key) {
    if (sortKey === key) { setSortDir(d => d === 'asc' ? 'desc' : 'asc') }
    else { setSortKey(key); setSortDir(key === 'valor' || key === 'versiones' || key === 'ultima' || key === 'estado' ? 'desc' : 'asc') }
  }

  const flecha = (key) => sortKey === key ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : ''
  const th = (key, label) => (
    <th onClick={() => clickSort(key)} style={{ padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:600, color: sortKey===key ? '#7c3aed' : '#6b7280', textTransform:'uppercase', letterSpacing:0.4, borderBottom:'1px solid #e5e7eb', whiteSpace:'nowrap', cursor:'pointer', userSelect:'none' }}>
      {label}{flecha(key)}
    </th>
  )
  const td = { padding:'10px 12px', fontSize:13, color:'#374151', borderBottom:'1px solid #f3f4f6', verticalAlign:'top' }

  return (
    <div style={{ minHeight:'100vh', background:'#f9fafb' }}>
      <TopNav />
      {status !== 'loading' && !esAdmin ? (
        <div style={{ padding:40, textAlign:'center', color:'#9ca3af', fontSize:14 }}>Redirigiendo…</div>
      ) : (
      <div style={{ maxWidth:1600, margin:'0 auto', padding:'20px 24px' }}>

        <div style={{ display:'flex', alignItems:'baseline', gap:12, marginBottom:4 }}>
          <h1 style={{ fontSize:22, fontWeight:700, color:'#111827', margin:0 }}>Propiedades</h1>
          <span style={{ fontSize:13, color:'#6b7280' }}>Cartera consolidada · cada fila es una propiedad única</span>
        </div>

        <div style={{ display:'flex', gap:24, margin:'14px 0 18px', flexWrap:'wrap' }}>
          <div><div style={{ fontSize:11, color:'#6b7280', textTransform:'uppercase' }}>Propiedades únicas</div><div style={{ fontSize:24, fontWeight:700, color:'#7c3aed' }}>{loading ? '…' : propiedades.length.toLocaleString('es-CL')}</div></div>
          <div><div style={{ fontSize:11, color:'#6b7280', textTransform:'uppercase' }}>Publicaciones totales</div><div style={{ fontSize:24, fontWeight:700, color:'#374151' }}>{loading ? '…' : rows.length.toLocaleString('es-CL')}</div></div>
          <div><div style={{ fontSize:11, color:'#6b7280', textTransform:'uppercase' }}>Con versión activa</div><div style={{ fontSize:24, fontWeight:700, color:'#059669' }}>{loading ? '…' : propiedades.filter(x => x.nActivas > 0).length.toLocaleString('es-CL')}</div></div>
          <div><div style={{ fontSize:11, color:'#6b7280', textTransform:'uppercase' }}>Referenciales (a definir)</div><div style={{ fontSize:24, fontWeight:700, color:'#d97706' }}>{loading ? '…' : nReferenciales.toLocaleString('es-CL')}</div></div>
        </div>

        <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:14, flexWrap:'wrap' }}>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar dirección, comuna, propietario, código…"
            style={{ flex:'1 1 280px', padding:'9px 12px', borderRadius:8, border:'1px solid #d1d5db', fontSize:13, fontFamily:'inherit' }} />
          <select value={comuna} onChange={e => setComuna(e.target.value)}
            style={{ padding:'9px 12px', borderRadius:8, border:'1px solid #d1d5db', fontSize:13, fontFamily:'inherit', background:'#fff', cursor:'pointer', maxWidth:200 }}>
            <option value="">Todas las comunas</option>
            {comunas.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {[['todas','Todas'],['activas','Activas'],['arriendo','Arriendo'],['venta','Venta'],['referenciales','Referenciales']].map(([k, lbl]) => (
            <button key={k} onClick={() => setFiltro(k)}
              style={{ padding:'8px 14px', borderRadius:8, border:'1px solid', borderColor: filtro===k ? '#7c3aed' : '#d1d5db', background: filtro===k ? '#7c3aed' : '#fff', color: filtro===k ? '#fff' : '#374151', fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'inherit' }}>
              {lbl}
            </button>
          ))}
        </div>

        <div style={{ background:'#fff', borderRadius:10, border:'1px solid #e5e7eb', overflow:'hidden' }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  {th('direccion','Dirección')}
                  {th('depto','Depto')}
                  {th('comuna','Comuna')}
                  {th('operacion','Operación')}
                  {th('tipo','Tipo')}
                  {th('dorm','Dorm')}
                  {th('banos','Baños')}
                  {th('estac','Estac.')}
                  {th('valor','Valor')}
                  {th('propietario','Propietario')}
                  {th('estado','Estado')}
                  {th('versiones','Versiones')}
                  {th('ultima','Últ. actividad')}
                </tr>
              </thead>
              <tbody>
                {loading && (<tr><td style={{ ...td, textAlign:'center', padding:40, color:'#9ca3af' }} colSpan={13}>Cargando cartera…</td></tr>)}
                {!loading && pagina.length === 0 && (<tr><td style={{ ...td, textAlign:'center', padding:40, color:'#9ca3af' }} colSpan={13}>Sin resultados</td></tr>)}
                {!loading && pagina.map((x) => {
                  const r = x.rep
                  const activa = x.nActivas > 0
                  return (
                    <tr key={x.llave} onClick={() => router.push('/publicaciones/' + r.id)} style={{ cursor:'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#faf5ff'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ ...td, fontWeight:600, color:'#111827' }}>{[r.calle, r.numero_calle].filter(Boolean).join(' ') || '—'}</td>
                      <td style={td}>{x.tieneDepto ? r.departamento : <span style={{ color:'#9ca3af', fontStyle:'italic' }}>referencial</span>}</td>
                      <td style={td}>{r.comuna || '—'}</td>
                      <td style={td}>{r.objetivo || '—'}</td>
                      <td style={td}>{r.tipo || '—'}</td>
                      <td style={td}>{r.dormitorios ?? '—'}</td>
                      <td style={td}>{r.banos ?? '—'}</td>
                      <td style={td}>{r.estacionamientos ?? '—'}</td>
                      <td style={{ ...td, whiteSpace:'nowrap' }}>{fmtValor(r)}</td>
                      <td style={td}>{r.propietario || '—'}</td>
                      <td style={td}>
                        {activa
                          ? <span style={{ fontSize:11, fontWeight:600, color:'#059669', background:'#ecfdf5', padding:'2px 8px', borderRadius:5 }}>Activa</span>
                          : <span style={{ fontSize:11, fontWeight:600, color:'#6b7280', background:'#f3f4f6', padding:'2px 8px', borderRadius:5 }}>Histórica</span>}
                      </td>
                      <td style={td}><span title={x.nActivas + ' activas de ' + x.nVersiones}>{x.nVersiones}{x.nVersiones > 1 ? ' versiones' : ' versión'}</span></td>
                      <td style={{ ...td, whiteSpace:'nowrap', color:'#6b7280' }}>{fmtFecha(x.ultima)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {!loading && totalPaginas > 1 && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12, marginTop:16 }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              style={{ padding:'7px 14px', borderRadius:7, border:'1px solid #d1d5db', background: page===1 ? '#f9fafb' : '#fff', color: page===1 ? '#9ca3af' : '#374151', cursor: page===1 ? 'not-allowed' : 'pointer', fontSize:13, fontFamily:'inherit' }}>← Anterior</button>
            <span style={{ fontSize:13, color:'#6b7280' }}>Página {page} de {totalPaginas} · {ordenadas.length.toLocaleString('es-CL')} propiedades</span>
            <button onClick={() => setPage(p => Math.min(totalPaginas, p + 1))} disabled={page === totalPaginas}
              style={{ padding:'7px 14px', borderRadius:7, border:'1px solid #d1d5db', background: page===totalPaginas ? '#f9fafb' : '#fff', color: page===totalPaginas ? '#9ca3af' : '#374151', cursor: page===totalPaginas ? 'not-allowed' : 'pointer', fontSize:13, fontFamily:'inherit' }}>Siguiente →</button>
          </div>
        )}

      </div>
      )}
    </div>
  )
}
