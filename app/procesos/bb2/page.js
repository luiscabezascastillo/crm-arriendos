'use client'
// VERSION: v2 · 2026-08-11 · ACCESO restringido: solo Anthony (legal) y Dirección (Alberto, Luis). El resto ve "sin acceso".
//   Resto igual que v1. Hereda v1.
// VERSION: v1 · 2026-08-11 · BB2 · Operaciones comerciales (arriendos de corretaje SIN administración). Primer paso:
//   LISTADO leyendo la tabla `log` (id_lcc R%) vía /api/bb2/lista. Buscador + filtro HECHO/pendiente. La ficha de captura
//   y el flujo Terminar→facturación llegan en las siguientes versiones.

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import TopNav from '@/app/components/ui/TopNav'

const MONO = "ui-monospace, 'SF Mono', 'Roboto Mono', Menlo, Consolas, monospace"
const ACCESO = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'anthony.mendoza@fondocapital.com']

export default function BB2Page() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const permitido = (session?.user?.role === 'direccion') || ACCESO.includes((session?.user?.email || '').toLowerCase())

  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [arriendos, setArriendos] = useState([])
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [estado, setEstado] = useState('todos')   // todos | hecho | pendiente
  const [actualizado, setActualizado] = useState(null)

  async function cargar() {
    setCargando(true); setError(null)
    try {
      const p = new URLSearchParams()
      if (q.trim()) p.set('q', q.trim())
      if (estado !== 'todos') p.set('estado', estado)
      const r = await fetch('/api/bb2/lista?' + p.toString())
      const d = await r.json()
      if (!r.ok) { setError(d.error || 'Error al cargar'); setArriendos([]); setCargando(false); return }
      setArriendos(d.arriendos || []); setTotal(d.total || 0); setActualizado(new Date())
    } catch (e) { setError(String(e?.message || e)) }
    setCargando(false)
  }
  useEffect(() => { if (status === 'authenticated' && permitido) cargar() }, [status])   // eslint-disable-line

  if (status === 'loading') return (<><TopNav /><div style={{ padding: 40, color: '#888' }}>Cargando…</div></>)
  if (status === 'authenticated' && !permitido) return (<><TopNav /><div style={{ padding: 40, color: '#991B1B' }}>Sin acceso. Operaciones comerciales (BB2) es solo para Dirección y Legal.</div></>)

  const th = { fontSize: 11, color: '#e5e7eb', fontWeight: 700, textAlign: 'left', padding: '9px 10px', whiteSpace: 'nowrap' }
  const td = { fontSize: 12.5, padding: '8px 10px', borderTop: '1px solid #F0EEE8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

  return (
    <>
      <TopNav />
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: 24, fontFamily: '"DM Sans", sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>BB2 · Arriendos de corretaje</h1>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#EEF2FF', color: '#3730A3' }}>sin administración</span>
        </div>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
          Operaciones de corretaje del histórico (tabla <b>log</b>). {total > 0 && <>Hay <b>{total}</b> arriendos.</>} {actualizado && <>Actualizado {actualizado.toLocaleTimeString('es-CL')}.</>}
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') cargar() }}
            placeholder="Buscar Id, inmueble, dueño, arrendatario…"
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #D3D1C7', fontSize: 13, minWidth: 280 }} />
          <select value={estado} onChange={e => setEstado(e.target.value)}
            style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #D3D1C7', fontSize: 13 }}>
            <option value="todos">Todos</option>
            <option value="pendiente">Pendientes</option>
            <option value="hecho">HECHO (terminados)</option>
          </select>
          <button onClick={cargar} disabled={cargando}
            style={{ fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#1D9E75', color: '#fff', cursor: 'pointer' }}>
            {cargando ? 'Cargando…' : '🔄 Buscar'}
          </button>
          <div style={{ flex: 1 }} />
          <button disabled title="La ficha de captura llega en la próxima versión"
            style={{ fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 8, border: '1px dashed #C7D2FE', background: '#F5F7FF', color: '#9CA3AF', cursor: 'not-allowed' }}>
            + Nueva operación (pronto)
          </button>
        </div>

        {error && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>Error: {error}</div>}

        <div style={{ border: '1px solid #ECEAE3', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1000 }}>
              <thead>
                <tr style={{ background: '#334155' }}>
                  <th style={th}>Id</th>
                  <th style={th}>Fecha</th>
                  <th style={th}>Inmueble</th>
                  <th style={th}>Propietario (D)</th>
                  <th style={th}>Arrendatario (A)</th>
                  <th style={{ ...th, textAlign: 'right' }}>Monto</th>
                  <th style={th}>Moneda</th>
                  <th style={th}>Vendedor</th>
                  <th style={{ ...th, textAlign: 'center' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {arriendos.length === 0 && !cargando && (
                  <tr><td colSpan={9} style={{ ...td, textAlign: 'center', color: '#888', padding: 24 }}>Sin resultados.</td></tr>
                )}
                {arriendos.map((a, i) => (
                  <tr key={a.idop + i} style={{ background: a.hecho ? '#F8FAFC' : '#fff' }}>
                    <td style={{ ...td, fontFamily: MONO, fontWeight: 700, color: '#1e3a8a' }}>{a.idop}</td>
                    <td style={{ ...td, color: '#555' }}>{a.fecha_registro || '—'}</td>
                    <td style={{ ...td, maxWidth: 260 }} title={a.inmueble}>{a.inmueble || '—'}</td>
                    <td style={{ ...td, maxWidth: 200 }} title={a.dueno}>{a.dueno || '—'}</td>
                    <td style={{ ...td, maxWidth: 200 }} title={a.arrendatario}>{a.arrendatario || '—'}</td>
                    <td style={{ ...td, textAlign: 'right', fontFamily: MONO }}>{a.monto || '—'}</td>
                    <td style={td}>{a.moneda || '—'}</td>
                    <td style={{ ...td, color: '#555' }}>{a.vendedor || '—'}</td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      {a.hecho
                        ? <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 20, background: '#DCFCE7', color: '#166534' }}>HECHO</span>
                        : <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#F1F5F9', color: '#64748B' }}>Pendiente</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 12 }}>
          Mostrando {arriendos.length}{total ? ` de ${total}` : ''} arriendos de corretaje. La ficha de captura (guardar/recuperar/terminar) y el aviso a Karina para facturar llegan en las próximas versiones.
        </div>
      </div>
    </>
  )
}
