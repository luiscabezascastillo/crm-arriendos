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

// Capitaliza cada palabra para mostrar comuna de forma consistente (LAS CONDES / las condes -> Las Condes)
function comunaBonita(s) {
  const t = String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' ')
  if (!t) return '(sin comuna)'
  const menores = new Set(['de', 'del', 'la', 'las', 'los', 'y'])
  return t.split(' ').map((w, i) => (i > 0 && menores.has(w)) ? w : (w.charAt(0).toUpperCase() + w.slice(1))).join(' ')
}

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

function EstadisticasBloque({ titulo, data, acento, mostrarComision, uf }) {
  const maxComuna = data.comunas.length ? data.comunas[0].n : 1
  const totalOp = data.arriendo + data.venta + data.otro || 1
  const pct = (n) => Math.round((n / totalOp) * 100)
  const fmtPesos = (n) => '$' + Math.round(n).toLocaleString('es-CL')
  const barra = (n, max, color) => (
    <div style={{ background:'#f3f4f6', borderRadius:5, height:18, overflow:'hidden', flex:1 }}>
      <div style={{ width: Math.max(2, (n / max) * 100) + '%', height:'100%', background:color, borderRadius:5 }} />
    </div>
  )
  return (
    <div style={{ background:'#fff', borderRadius:10, border:'1px solid #e5e7eb', padding:'18px 20px', marginBottom:16 }}>
      <div style={{ display:'flex', alignItems:'baseline', gap:10, marginBottom:14 }}>
        <h3 style={{ fontSize:15, fontWeight:700, color:'#111827', margin:0 }}>{titulo}</h3>
        <span style={{ fontSize:13, color:'#6b7280' }}>{data.total.toLocaleString('es-CL')} propiedades</span>
      </div>

      {/* Comision potencial (solo bloque activas) */}
      {mostrarComision && (
        <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:9, padding:'14px 16px', marginBottom:18 }}>
          <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:10, flexWrap:'wrap' }}>
            <span style={{ fontSize:11, fontWeight:600, color:'#059669', textTransform:'uppercase', letterSpacing:0.4 }}>Comisión potencial estimada</span>
            <span style={{ fontSize:11, color:'#9ca3af' }}>arriendo = 1 mensualidad · venta = 4% · UF ${uf.toLocaleString('es-CL')}</span>
          </div>
          <div style={{ display:'flex', gap:28, flexWrap:'wrap', alignItems:'baseline' }}>
            <div>
              <div style={{ fontSize:11, color:'#6b7280' }}>Total</div>
              <div style={{ fontSize:22, fontWeight:700, color:'#059669' }}>{fmtPesos(data.comTotal)}</div>
            </div>
            <div>
              <div style={{ fontSize:11, color:'#6b7280' }}>Por arriendos ({data.arriendo})</div>
              <div style={{ fontSize:16, fontWeight:600, color:'#374151' }}>{fmtPesos(data.comArriendo)}</div>
            </div>
            <div>
              <div style={{ fontSize:11, color:'#6b7280' }}>Por ventas ({data.venta})</div>
              <div style={{ fontSize:16, fontWeight:600, color:'#374151' }}>{fmtPesos(data.comVenta)}</div>
            </div>
          </div>
          <p style={{ fontSize:11, color:'#9ca3af', margin:'10px 0 0', lineHeight:1.5 }}>
            Estimación si todas las propiedades activas se cerraran a su precio publicado. No es facturación real.
          </p>
        </div>
      )}

      {/* Operacion */}
      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:0.4, marginBottom:8 }}>Por operación</div>
        {[['Arriendo', data.arriendo, '#2563eb'],['Venta', data.venta, '#d97706'],['Otro', data.otro, '#9ca3af']].map(([lbl, n, color]) => (
          <div key={lbl} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
            <span style={{ fontSize:12, color:'#374151', width:70 }}>{lbl}</span>
            {barra(n, totalOp, color)}
            <span style={{ fontSize:12, color:'#6b7280', width:90, textAlign:'right' }}>{n.toLocaleString('es-CL')} · {pct(n)}%</span>
          </div>
        ))}
      </div>

      {/* Comunas (top 12) */}
      <div>
        <div style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:0.4, marginBottom:8 }}>Por comuna {data.comunas.length > 12 ? '(top 12)' : ''}</div>
        {data.comunas.slice(0, 12).map((c) => (
          <div key={c.nombre} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
            <span style={{ fontSize:12, color:'#374151', width:140, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.nombre}</span>
            {barra(c.n, maxComuna, acento)}
            <span style={{ fontSize:12, color:'#6b7280', width:50, textAlign:'right' }}>{c.n.toLocaleString('es-CL')}</span>
          </div>
        ))}
      </div>

      {/* Por comercial (solo bloque activas) */}
      {mostrarComision && data.vendedores.length > 0 && (
        <div style={{ marginTop:18 }}>
          <div style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:0.4, marginBottom:8 }}>Por comercial</div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign:'left', fontSize:11, color:'#9ca3af', fontWeight:600, padding:'4px 8px' }}>Comercial</th>
                  <th style={{ textAlign:'right', fontSize:11, color:'#9ca3af', fontWeight:600, padding:'4px 8px' }}>Propiedades</th>
                  <th style={{ textAlign:'right', fontSize:11, color:'#9ca3af', fontWeight:600, padding:'4px 8px' }}>Valor cartera</th>
                  <th style={{ textAlign:'right', fontSize:11, color:'#9ca3af', fontWeight:600, padding:'4px 8px' }}>Comisión potencial</th>
                </tr>
              </thead>
              <tbody>
                {data.vendedores.map((v) => (
                  <tr key={v.vendedor} style={{ borderTop:'1px solid #f3f4f6' }}>
                    <td style={{ fontSize:13, color:'#374151', padding:'7px 8px' }}>{v.vendedor}</td>
                    <td style={{ fontSize:13, color:'#6b7280', padding:'7px 8px', textAlign:'right' }}>{v.n}</td>
                    <td style={{ fontSize:13, color:'#374151', padding:'7px 8px', textAlign:'right', whiteSpace:'nowrap' }}>{fmtPesos(v.valor)}</td>
                    <td style={{ fontSize:13, color:'#059669', fontWeight:600, padding:'7px 8px', textAlign:'right', whiteSpace:'nowrap' }}>{fmtPesos(v.comision)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
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
  const [vista, setVista] = useState('listado')   // listado | stats

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
    const mapa = new Map()
    for (const x of propiedades) {
      const k = norm(x.rep.comuna)
      if (k && !mapa.has(k)) mapa.set(k, comunaBonita(x.rep.comuna))
    }
    return Array.from(mapa.values()).sort((a, b) => a.localeCompare(b))
  }, [propiedades])

  const nReferenciales = useMemo(() => propiedades.filter(x => !x.tieneDepto).length, [propiedades])

  // Estadisticas: por comuna y por operacion, en dos universos (todas / activas)
  const stats = useMemo(() => {
    const UF = 40790
    const aPesos = (p) => {
      const n = Number(p.valor)
      if (isNaN(n)) return 0
      const m = (p.tipo_moneda || '').toUpperCase()
      return (m === 'UF' || m === 'CLF') ? n * UF : n
    }
    const universos = {
      todas: propiedades,
      activas: propiedades.filter(x => x.nActivas > 0),
    }
    const calc = (lista) => {
      const porComuna = new Map()   // claveNorm -> { label, n }
      let arriendo = 0, venta = 0, otro = 0
      let comArriendo = 0, comVenta = 0
      const porVendedor = new Map()
      for (const x of lista) {
        const claveC = norm(x.rep.comuna) || '(sin comuna)'
        const gc = porComuna.get(claveC) || { label: comunaBonita(x.rep.comuna), n: 0 }
        gc.n += 1
        porComuna.set(claveC, gc)
        const op = (x.rep.objetivo || '').toLowerCase()
        const pesos = aPesos(x.rep)
        let comision = 0
        if (op.includes('arriendo')) { arriendo++; comArriendo += pesos; comision = pesos }
        else if (op.includes('venta')) { venta++; comVenta += pesos * 0.04; comision = pesos * 0.04 }
        else otro++
        const v = (x.rep.vendedor && String(x.rep.vendedor).trim()) ? x.rep.vendedor : '(sin asignar)'
        const g = porVendedor.get(v) || { vendedor: v, valor: 0, comision: 0, n: 0 }
        g.valor += pesos; g.comision += comision; g.n += 1
        porVendedor.set(v, g)
      }
      const comunas = Array.from(porComuna.values()).map(g => ({ nombre: g.label, n: g.n })).sort((a, b) => b.n - a.n)
      const vendedores = Array.from(porVendedor.values()).sort((a, b) => b.valor - a.valor)
      return { total: lista.length, comunas, arriendo, venta, otro, comArriendo, comVenta, comTotal: comArriendo + comVenta, vendedores }
    }
    return { todas: calc(universos.todas), activas: calc(universos.activas), uf: UF }
  }, [propiedades])

  const filtradas = useMemo(() => {
    let l = propiedades
    if (filtro === 'activas') l = l.filter(x => x.nActivas > 0)
    else if (filtro === 'arriendo') l = l.filter(x => (x.rep.objetivo || '').toLowerCase().includes('arriendo'))
    else if (filtro === 'venta') l = l.filter(x => (x.rep.objetivo || '').toLowerCase().includes('venta'))
    else if (filtro === 'referenciales') l = l.filter(x => !x.tieneDepto)
    if (comuna) l = l.filter(x => comunaBonita(x.rep.comuna) === comuna)
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

        {/* Toggle Listado / Estadisticas */}
        <div style={{ display:'inline-flex', gap:4, background:'#f3f4f6', borderRadius:9, padding:4, margin:'12px 0 4px' }}>
          {[['listado','Listado'],['stats','Estadísticas']].map(([k, lbl]) => (
            <button key={k} onClick={() => setVista(k)}
              style={{ padding:'7px 16px', borderRadius:7, border:'none', background: vista===k ? '#fff' : 'transparent', color: vista===k ? '#7c3aed' : '#6b7280', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', boxShadow: vista===k ? '0 1px 2px rgba(0,0,0,0.08)' : 'none' }}>
              {lbl}
            </button>
          ))}
        </div>

        {vista === 'listado' && (<>
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
        </>)}

        {vista === 'stats' && !loading && (
          <div style={{ margin:'14px 0' }}>
            <EstadisticasBloque titulo="Toda la cartera" data={stats.todas} acento="#7c3aed" />
            <EstadisticasBloque titulo="Solo con versión activa" data={stats.activas} acento="#059669" mostrarComision uf={stats.uf} />
            <p style={{ fontSize:12, color:'#9ca3af', marginTop:16, lineHeight:1.6 }}>
              Las estadísticas se calculan sobre las propiedades únicas. Los montos de facturación (cuánto se arrendó o vendió) estarán disponibles cuando se registre el motivo de cierre al dar de baja una propiedad.
            </p>
          </div>
        )}
        {vista === 'stats' && loading && (
          <div style={{ padding:40, textAlign:'center', color:'#9ca3af', fontSize:14 }}>Cargando estadísticas…</div>
        )}

      </div>
      )}
    </div>
  )
}
