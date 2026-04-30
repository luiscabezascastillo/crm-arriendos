'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TopNav } from '../components/ui/TopNav'

/* ── Datos de ejemplo — luego vendrán de Supabase (datos_arriendos) ── */
const propiedades = [
  { idadmon: '20534', inmueble: 'Calle Mayor',      propietario: 'Marina López', estado: 'S',        ingresos: '€1,300', costes: '€800',   margen: 38, accion: 'normal'    },
  { idadmon: '10421', inmueble: 'Calle Mayor',      propietario: 'Marina López', estado: 'SQ',       ingresos: '€1,300', costes: '€800',   margen: 38, accion: 'normal'    },
  { idadmon: '15896', inmueble: 'Edificio Sol',     propietario: 'Juan García',  estado: 'P',        ingresos: '€1,750', costes: '€1,200', margen: 31, accion: 'normal'    },
  { idadmon: '20298', inmueble: 'Plaza Centro #12', propietario: 'Silvia Román', estado: 'Q',        ingresos: '€900',   costes: '€500',               accion: 'convertir' },
  { idadmon: '18487', inmueble: 'Av. Progreso #23', propietario: 'Pedro Medina', estado: 'Inactiva', ingresos: '€500',   costes: '€500',               accion: 'finiquito' },
  { idadmon: '20123', inmueble: 'Calle Luna',       propietario: 'Laura Torres', estado: 'O',        ingresos: '€600',   costes: '€400',               accion: 'finiquito' },
  { idadmon: '20124', inmueble: 'Calle Luna',       propietario: 'Laura Torres', estado: 'O',        ingresos: '€500',   costes: '€500',               accion: 'convertir' },
]

/* ── Badge de estado ── */
const estadoMap = {
  S:        { bg: '#eff6ff', color: '#1a56db' },
  SQ:       { bg: '#f0fdf4', color: '#16a34a' },
  P:        { bg: '#fffbeb', color: '#d97706' },
  Q:        { bg: '#fffbeb', color: '#d97706' },
  O:        { bg: '#ecfeff', color: '#0891b2' },
  Inactiva: { bg: '#fef2f2', color: '#dc2626' },
}

function EstadoBadge({ estado }) {
  const s = estadoMap[estado] || estadoMap.S
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      padding: estado === 'Inactiva' ? '2px 8px' : '0',
      width: estado === 'Inactiva' ? 'auto' : 26, height: 26,
      borderRadius: 6, background: s.bg, color: s.color,
      fontSize: 11, fontWeight: 600,
    }}>
      {estado}
    </span>
  )
}

/* ── Botón pequeño en tabla ── */
function TdBtn({ label, variant = 'default', onClick }) {
  const base = { padding: '4px 9px', borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }
  const variants = {
    default: { ...base, background: 'transparent', color: 'var(--gray-600)', border: '1px solid var(--border)' },
    primary: { ...base, background: '#1a56db',     color: '#fff',             border: '1px solid #1a56db' },
    amber:   { ...base, background: '#fffbeb',     color: '#92400e',          border: '1px solid #fcd34d' },
  }
  return <button onClick={onClick} style={variants[variant]}>{label}</button>
}

/* ── Botón de barra de acciones ── */
function ActionBtn({ label, bg, icon, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '7px 13px', borderRadius: 8, border: 'none',
      background: bg, color: '#fff',
      fontSize: 12, fontWeight: 500,
      cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
    }}
      onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
    >
      {icon}{label}
    </button>
  )
}

/* ── Iconos compactos ── */
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

export default function CC1Page() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('Datos base')
  const [search, setSearch] = useState('')

  const filtered = propiedades.filter(p =>
    p.inmueble.toLowerCase().includes(search.toLowerCase()) ||
    p.propietario.toLowerCase().includes(search.toLowerCase()) ||
    p.idadmon.includes(search)
  )

 const irAFormulario = () => router.push('/admin') // apunta al formulario ADMIN existente

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      <TopNav />

      {/* Breadcrumb + título */}
      <div style={{
        padding: '10px 24px 12px',
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
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
          <div style={{
            width: 30, height: 30, background: '#1a56db', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--gray-900)', margin: 0, letterSpacing: '-0.3px' }}>
            CC1 Administración
          </h1>
        </div>
      </div>

      {/* KPI bar CC1 */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4,1fr) 200px',
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
      }}>
        {[
          { label: 'Ingresos globales', value: '€120,500', color: 'var(--success-600)' },
          { label: 'Ingresos CC1',      value: '€78,200',  color: 'var(--success-600)' },
          { label: 'Costes',            value: '€45,300',  color: 'var(--warning-600)' },
          { label: 'Margen',            value: '33%',       color: 'var(--gray-800)'    },
        ].map((k, i) => (
          <div key={i} style={{ padding: '10px 20px', borderRight: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, color: 'var(--gray-400)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k.label}</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: k.color }}>{k.value}</div>
          </div>
        ))}
        <div style={{ padding: '8px 14px', display: 'flex', alignItems: 'center' }}>
          <select style={{
            width: '100%', padding: '6px 10px', borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--gray-50)',
            fontSize: 12, color: 'var(--gray-700)', fontFamily: 'inherit', cursor: 'pointer',
          }}>
            <option>Entadas-serre</option>
            <option>Fondo Capital</option>
            <option>Todos</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', background: 'var(--surface)',
        borderBottom: '1px solid var(--border)', padding: '0 24px',
      }}>
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '10px 16px', fontSize: 12,
            fontWeight: activeTab === tab ? 500 : 400,
            color: activeTab === tab ? '#1a56db' : 'var(--gray-400)',
            background: 'none', border: 'none',
            borderBottom: activeTab === tab ? '2px solid #1a56db' : '2px solid transparent',
            cursor: 'pointer', fontFamily: 'inherit', marginBottom: '-1px',
          }}>
            {tab}
          </button>
        ))}
      </div>

      {/* Barra de acciones */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        padding: '12px 24px', background: 'var(--surface)', borderBottom: '1px solid var(--border)',
      }}>
        <ActionBtn label="Nuevo / Modificar arriendo" bg="#1a56db" icon={Ico.edit}  onClick={irAFormulario} />
        <ActionBtn label="Propietarios"               bg="#16a34a" icon={Ico.users} />
        <ActionBtn label="Inmuebles"                  bg="#0891b2" icon={Ico.home}  />
        <ActionBtn label="Calcular ajustes"           bg="#d97706" icon={Ico.calc}  />
        <ActionBtn label="Operaciones"                bg="#c2410c" icon={Ico.gear}  />
        <ActionBtn label="Cierre"                     bg="#dc2626" icon={Ico.lock}  />

        {/* Botón compuesto */}
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
          </h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', display: 'flex' }}>
                {Ico.search}
              </span>
              <input
                type="text" placeholder="Buscar propiedad…"
                value={search} onChange={e => setSearch(e.target.value)}
                style={{
                  paddingLeft: 30, paddingRight: 12, paddingTop: 7, paddingBottom: 7,
                  borderRadius: 8, border: '1px solid var(--border)',
                  background: 'var(--gray-50)', fontSize: 12,
                  color: 'var(--gray-700)', fontFamily: 'inherit', width: 200, outline: 'none',
                }}
              />
            </div>
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
              <col style={{ width: 80 }} /><col style={{ width: 130 }} /><col style={{ width: 130 }} />
              <col style={{ width: 75 }} /><col style={{ width: 90 }} /><col style={{ width: 90 }} />
              <col /><col style={{ width: 28 }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--gray-50)' }}>
                {['IDADMON ↕', 'Inmueble', 'Propietario ↕', 'Estado ↕', 'Ingresos ↕', 'Costes ↕', 'Acción / Margen', ''].map((h, i) => (
                  <th key={i} style={{
                    padding: '9px 12px', textAlign: 'left',
                    fontSize: 10, fontWeight: 600, color: 'var(--gray-400)',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                    borderBottom: '1px solid var(--border)', cursor: 'pointer',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr key={i}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-50)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: 600, color: 'var(--gray-800)', borderBottom: '1px solid var(--border-subtle)' }}>{p.idadmon}</td>
                  <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--gray-700)', borderBottom: '1px solid var(--border-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.inmueble}</td>
                  <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--gray-700)', borderBottom: '1px solid var(--border-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.propietario}</td>
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border-subtle)' }}><EstadoBadge estado={p.estado} /></td>
                  <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--gray-700)', borderBottom: '1px solid var(--border-subtle)' }}>{p.ingresos}</td>
                  <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--gray-700)', borderBottom: '1px solid var(--border-subtle)' }}>{p.costes}</td>
                  <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
                    {p.accion === 'normal' && (
                      <span style={{ fontSize: 12, fontWeight: 500, color: p.margen >= 35 ? 'var(--success-600)' : 'var(--warning-600)' }}>
                        {p.margen}%
                      </span>
                    )}
                    {p.accion === 'convertir' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <TdBtn label="Convertir en" />
                        <TdBtn label="Asignar a inmueble" variant="primary" />
                      </div>
                    )}
                    {p.accion === 'finiquito' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <TdBtn label="Calcular finiquito" variant="amber" />
                        <TdBtn label="Ajustar costes" />
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '9px 8px', borderBottom: '1px solid var(--border-subtle)', color: 'var(--gray-300)', fontSize: 16, cursor: 'pointer', textAlign: 'center' }}>›</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginador */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 16 }}>
          {['«', '‹', '1', '2', '3', '4', '5', '›', '»'].map((p, i) => (
            <button key={i} style={{
              width: 30, height: 30, borderRadius: 7,
              border: '1px solid var(--border)',
              background: p === '1' ? '#1a56db' : 'transparent',
              color: p === '1' ? '#fff' : 'var(--gray-500)',
              fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
            }}>{p}</button>
          ))}
          <span style={{ fontSize: 11, color: 'var(--gray-400)', marginLeft: 8 }}>Página 1 de 5 · 10 filas</span>
        </div>
      </div>
    </div>
  )
}
