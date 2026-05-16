'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { TopNav } from '../components/ui/TopNav'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const PAGE_SIZE = 15

const estadoMap = {
  S:        { bg: '#eff6ff', color: '#1a56db' },
  SQ:       { bg: '#f0fdf4', color: '#16a34a' },
  P:        { bg: '#fffbeb', color: '#d97706' },
  Q:        { bg: '#fffbeb', color: '#d97706' },
  O:        { bg: '#ecfeff', color: '#0891b2' },
  Inactiva: { bg: '#fef2f2', color: '#dc2626' },
}

function EstadoBadge({ estado }) {
  const s = estadoMap[estado] || { bg: '#f3f4f6', color: '#6b7280' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      padding: '2px 7px', borderRadius: 6,
      background: s.bg, color: s.color,
      fontSize: 11, fontWeight: 600,
    }}>
      {estado || '—'}
    </span>
  )
}

function ActionBtn({ label, bg, icon, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '7px 13px', borderRadius: 8, border: 'none',
      background: bg, color: '#fff', fontSize: 12, fontWeight: 500,
      cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
    }}
      onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
    >
      {icon}{label}
    </button>
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
  const [propiedades, setPropiedades] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [kpis, setKpis] = useState({ total: 0, activos: 0, termino: 0, vacios: 0 })

  useEffect(() => {
    loadKpis()
  }, [])

  useEffect(() => {
    setPage(1)
  }, [search, filtroEstado])

  useEffect(() => {
    loadData()
  }, [page, search, filtroEstado])

  async function loadKpis() {
    const { count: total } = await supabase
      .from('datos_arriendos').select('*', { count: 'exact', head: true })
    const { count: activos } = await supabase
      .from('datos_arriendos').select('*', { count: 'exact', head: true })
      .eq('estado', 'S')
    const { count: termino } = await supabase
      .from('datos_arriendos').select('*', { count: 'exact', head: true })
      .eq('estado', 'Q')
    const { count: vacios } = await supabase
      .from('datos_arriendos').select('*', { count: 'exact', head: true })
      .eq('estado', 'P')
    setKpis({ total: total || 0, activos: activos || 0, termino: termino || 0, vacios: vacios || 0 })
  }

  async function loadData() {
    setLoading(true)
    let query = supabase
      .from('datos_arriendos')
      .select('idadmon, estado, propietario, inmueble, cuota, unid, termino_actual', { count: 'exact' })
      .order('estado', { ascending: false })
      .order('propietario', { ascending: true })
      .order('inmueble', { ascending: true })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

    if (search) {
      query = query.or(
        `idadmon.ilike.%${search}%,inmueble.ilike.%${search}%,propietario.ilike.%${search}%,arrendatario.ilike.%${search}%`
      )
    }
    if (filtroEstado) {
      query = query.eq('estado', filtroEstado)
    }

    const { data, count, error } = await query
    if (!error) {
      setPropiedades(data || [])
      setTotal(count || 0)
    }
    setLoading(false)
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const irAFormulario = () => router.push('/admin')

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      <TopNav />

      {/* Breadcrumb */}
      <div style={{
        padding: '10px 24px 12px', background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <Link href="/panel" style={{
          fontSize: 12, color: 'var(--gray-400)', textDecoration: 'none',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          {Ico.back} Volver al panel
        </Link>
        <span style={{ color: 'var(--border)', fontSize: 14 }}>|</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, background: '#1a56db', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--gray-900)', margin: 0, letterSpacing: '-0.3px' }}>
            CC1 Administración
          </h1>
        </div>
      </div>

      {/* KPI bar — datos reales */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4,1fr) 200px',
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
      }}>
        {[
          { label: 'Total contratos',  value: kpis.total,   color: 'var(--gray-800)' },
          { label: 'Activos (S)',      value: kpis.activos, color: '#16a34a' },
          { label: 'En término (Q)',   value: kpis.termino, color: '#d97706' },
          { label: 'Vacíos (P)',       value: kpis.vacios,  color: '#dc2626' },
        ].map((k, i) => (
          <div key={i} style={{ padding: '10px 20px', borderRight: '1px solid var(--border)', cursor: 'pointer' }}
            onClick={() => setFiltroEstado(filtroEstado === ['','S','Q','P'][i] ? '' : ['','S','Q','P'][i])}
          >
            <div style={{ fontSize: 10, color: 'var(--gray-400)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k.label}</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: k.color }}>{k.value}</div>
            {filtroEstado === ['','S','Q','P'][i] && filtroEstado !== '' && (
              <div style={{ fontSize: 10, color: '#1a56db', marginTop: 2 }}>● Filtro activo</div>
            )}
          </div>
        ))}
        <div style={{ padding: '8px 14px', display: 'flex', alignItems: 'center' }}>
          <select
            value={filtroEstado}
            onChange={e => setFiltroEstado(e.target.value)}
            style={{
              width: '100%', padding: '6px 10px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--gray-50)',
              fontSize: 12, color: 'var(--gray-700)', fontFamily: 'inherit', cursor: 'pointer',
            }}
          >
            <option value="">Todos los estados</option>
            <option value="S">S — Activos</option>
            <option value="P">P — Vacíos</option>
            <option value="Q">Q — En término</option>
            <option value="SQ">SQ</option>
            <option value="O">O</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 24px' }}>
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '10px 16px', fontSize: 12,
            fontWeight: activeTab === tab ? 500 : 400,
            color: activeTab === tab ? '#1a56db' : 'var(--gray-400)',
            background: 'none', border: 'none',
            borderBottom: activeTab === tab ? '2px solid #1a56db' : '2px solid transparent',
            cursor: 'pointer', fontFamily: 'inherit', marginBottom: '-1px',
          }}>{tab}</button>
        ))}
      </div>

      {/* Barra de acciones */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        padding: '12px 24px', background: 'var(--surface)', borderBottom: '1px solid var(--border)',
      }}>
        <ActionBtn label="Nuevo / Modificar arriendo" bg="#1a56db" icon={Ico.edit} onClick={irAFormulario} />
        <ActionBtn label="Propietarios"   bg="#16a34a" icon={Ico.users} onClick={() => {}} />
        <ActionBtn label="Inmuebles"      bg="#0891b2" icon={Ico.home}  onClick={() => {}} />
        <ActionBtn label="Calcular ajustes" bg="#d97706" icon={Ico.calc} onClick={() => {}} />
        <ActionBtn label="Operaciones"    bg="#c2410c" icon={Ico.gear}  onClick={() => {}} />
        <ActionBtn label="Cierre"         bg="#dc2626" icon={Ico.lock}  onClick={() => {}} />
        <div style={{ marginLeft: 'auto', display: 'flex', borderRadius: 8, overflow: 'hidden' }}>
          <button onClick={irAFormulario} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', background: '#1a56db', color: '#fff',
            border: 'none', fontSize: 12, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            {Ico.plus} Nuevo / Asignar arriendo
          </button>
          <button style={{
            padding: '7px 10px', background: '#1447c3', color: '#fff',
            border: 'none', borderLeft: '1px solid rgba(255,255,255,0.2)',
            cursor: 'pointer', fontSize: 13,
          }}>▾</button>
        </div>
      </div>

      {/* Tabla */}
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
              <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', display: 'flex' }}>
                {Ico.search}
              </span>
              <input
                type="text" placeholder="IDADMON, inmueble, propietario…"
                value={search} onChange={e => setSearch(e.target.value)}
                style={{
                  paddingLeft: 30, paddingRight: 12, paddingTop: 7, paddingBottom: 7,
                  borderRadius: 8, border: '1px solid var(--border)',
                  background: 'var(--gray-50)', fontSize: 12,
                  color: 'var(--gray-700)', fontFamily: 'inherit', width: 240, outline: 'none',
                }}
              />
            </div>
            {(search || filtroEstado) && (
              <button onClick={() => { setSearch(''); setFiltroEstado('') }} style={{
                padding: '7px 12px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'transparent',
                fontSize: 12, color: 'var(--gray-500)', cursor: 'pointer', fontFamily: 'inherit',
              }}>Limpiar</button>
            )}
            <button onClick={irAFormulario} style={{
              padding: '7px 14px', background: '#1a56db', color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              {Ico.plus} Nuevo arriendo
            </button>
          </div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 90 }} /><col /><col style={{ width: 160 }} />
              <col style={{ width: 70 }} /><col style={{ width: 110 }} /><col style={{ width: 120 }} /><col style={{ width: 28 }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--gray-50)' }}>
                {['IDADMON', 'Inmueble', 'Propietario', 'Estado', 'Cuota', 'Término actual', ''].map((h, i) => (
                  <th key={i} style={{
                    padding: '9px 12px', textAlign: 'left',
                    fontSize: 10, fontWeight: 600, color: 'var(--gray-400)',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                    borderBottom: '1px solid var(--border)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: 32, textAlign: 'center', fontSize: 12, color: 'var(--gray-400)' }}>
                    Cargando datos...
                  </td>
                </tr>
              ) : propiedades.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 32, textAlign: 'center', fontSize: 12, color: 'var(--gray-400)' }}>
                    No se encontraron registros
                  </td>
                </tr>
              ) : propiedades.map((p, i) => {
                const alerta = alertaTermino(p.termino_actual)
                return (
                  <tr key={i}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-50)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    onClick={() => router.push(`/admin?idadmon=${p.idadmon}`)}
                  >
                    <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: 600, color: 'var(--gray-800)', borderBottom: '1px solid var(--border-subtle)' }}>
                      {p.idadmon}
                    </td>
                    <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--gray-700)', borderBottom: '1px solid var(--border-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.inmueble || '—'}
                    </td>
                    <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--gray-700)', borderBottom: '1px solid var(--border-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.propietario || '—'}
                    </td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <EstadoBadge estado={p.estado} />
                    </td>
                    <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--gray-700)', borderBottom: '1px solid var(--border-subtle)' }}>
                      {p.cuota ? `${p.unid === 'UF' ? 'UF ' : '$'}${Number(p.cuota).toLocaleString('es-CL')}` : '—'}
                    </td>
                    <td style={{ padding: '9px 12px', fontSize: 12, borderBottom: '1px solid var(--border-subtle)' }}>
                      {p.termino_actual ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: 'var(--gray-700)' }}>
                            {new Date(p.termino_actual).toLocaleDateString('es-CL')}
                          </span>
                          {alerta && (
                            <span style={{
                              fontSize: 10, fontWeight: 600, padding: '1px 6px',
                              borderRadius: 8, background: alerta.color + '20', color: alerta.color,
                            }}>{alerta.text}</span>
                          )}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '9px 8px', borderBottom: '1px solid var(--border-subtle)', color: 'var(--gray-300)', fontSize: 16, textAlign: 'center' }}>›</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Paginador */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 16 }}>
          <button onClick={() => setPage(1)} disabled={page === 1} style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--gray-500)', fontSize: 12, cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1 }}>«</button>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--gray-500)', fontSize: 12, cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1 }}>‹</button>

          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i
            if (p < 1 || p > totalPages) return null
            return (
              <button key={p} onClick={() => setPage(p)} style={{
                width: 30, height: 30, borderRadius: 7,
                border: '1px solid var(--border)',
                background: p === page ? '#1a56db' : 'transparent',
                color: p === page ? '#fff' : 'var(--gray-500)',
                fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
              }}>{p}</button>
            )
          })}

          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--gray-500)', fontSize: 12, cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.4 : 1 }}>›</button>
          <button onClick={() => setPage(totalPages)} disabled={page === totalPages} style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--gray-500)', fontSize: 12, cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.4 : 1 }}>»</button>

          <span style={{ fontSize: 11, color: 'var(--gray-400)', marginLeft: 8 }}>
            Página {page} de {totalPages} · {total} registros
          </span>
        </div>
      </div>
    </div>
  )
}