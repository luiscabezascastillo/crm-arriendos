'use client'
// VERSION: 2026-08-27 · Barra de controles (top 52) y cabecera de la tabla (top 106) STICKY bajo el TopNav; la tarjeta pasa a overflowX visible para que el sticky de la cabecera funcione. Hereda versión previa.
// VERSION: 2026-08-26 · Añadido "← Volver" (BotonVolver, history.back) — convención de retorno. Hereda versión previa.
// VERSION: v2 · 2026-08-18 · Acceso explícito: Dirección SIEMPRE (por email luis/alberto o rol direccion) + roles
//   operativos (finanzas, administracion) y Karina. Antes solo pedía sesión. Hereda v1.
// VERSION: v1 · 2026-08-18 · Bitácora de cambios de estado de contratos (auditoría). Dos vistas: cambios recientes
//   (con filtros por persona y tipo de cambio) y el historial completo de un contrato (busca por IDADMON).
//   Lee /api/bitacora-estados (historico_idadmon). Solo lectura. Ruta: app/procesos/bitacora-estados/page.js
import { useState, useEffect, useMemo } from 'react'
import BotonVolver from '../../components/ui/BotonVolver'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import TopNav from '@/app/components/ui/TopNav'

// Dirección SIEMPRE tiene acceso (por email). Se gestiona por email, como en el resto del sistema.
const DIRECCION_EMAILS = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com']
const EMAILS_OK = ['karina.morales@fondocapital.com']
const ROLES_OK = ['direccion', 'finanzas', 'administracion']
const ROL_ALIAS = { admin: 'direccion', operaciones: 'administracion', tecnico: 'mantencion' }
const normRol = (r) => ROL_ALIAS[String(r || '').toLowerCase()] || String(r || '').toLowerCase()

const fmtFechaHora = (s) => {
  if (!s) return '—'
  const d = new Date(s)
  if (isNaN(d)) return String(s)
  return d.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
const fmtFecha = (s) => {
  if (!s) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s)); return m ? `${m[3]}/${m[2]}/${m[1]}` : String(s)
}
// Color por estado destino de la transición
function colorEstado(nuevo) {
  const n = String(nuevo || '').toUpperCase()
  if (n === 'SQ') return { bg: '#E7EEF9', fg: '#1D4ED8' }
  if (n.startsWith('Q')) return { bg: '#FEF3C7', fg: '#92400E' }
  if (n === 'N' || n.startsWith('N-')) return { bg: '#EAF3DE', fg: '#3B6D11' }
  if (n === 'S') return { bg: '#F3F4F6', fg: '#374151' }
  return { bg: '#F3F4F6', fg: '#374151' }
}

export default function BitacoraEstados() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const email = session?.user?.email || ''
  const rol = normRol(session?.user?.role)
  const puedeVer = DIRECCION_EMAILS.includes(email) || EMAILS_OK.includes(email) || ROLES_OK.includes(rol)

  useEffect(() => {
    if (status === 'loading') return
    if (!session) { router.replace('/panel'); return }
    if (!puedeVer) router.replace('/procesos/mi-portal')
  }, [status, session, puedeVer]) // eslint-disable-line

  const [dias, setDias] = useState(60)
  const [eventos, setEventos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [modo, setModo] = useState('recientes')
  const [buscar, setBuscar] = useState('')            // idadmon a buscar
  const [fUsuario, setFUsuario] = useState('')
  const [fTrans, setFTrans] = useState('')

  async function cargarRecientes(nd = dias) {
    setCargando(true); setError(''); setModo('recientes')
    try {
      const res = await fetch('/api/bitacora-estados?dias=' + encodeURIComponent(nd))
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Error cargando')
      setEventos(d.eventos || [])
    } catch (e) { setError(e.message) } finally { setCargando(false) }
  }
  async function cargarContrato(idadmon) {
    const id = String(idadmon || '').trim().toUpperCase()
    if (!id) { cargarRecientes(); return }
    setCargando(true); setError(''); setModo('contrato')
    try {
      const res = await fetch('/api/bitacora-estados?idadmon=' + encodeURIComponent(id))
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Error cargando')
      setEventos(d.eventos || [])
    } catch (e) { setError(e.message) } finally { setCargando(false) }
  }
  useEffect(() => { if (status === 'authenticated' && puedeVer) cargarRecientes(60) }, [status, puedeVer]) // eslint-disable-line

  const optsUsuario = useMemo(() => [...new Set(eventos.map(e => e.usuario_corto).filter(Boolean))].sort(), [eventos])
  const optsTrans = useMemo(() => [...new Set(eventos.map(e => `${e.estado_anterior || '—'}→${e.estado_nuevo || '—'}`))].sort(), [eventos])

  const vista = useMemo(() => eventos.filter(e => {
    if (fUsuario && e.usuario_corto !== fUsuario) return false
    if (fTrans && `${e.estado_anterior || '—'}→${e.estado_nuevo || '—'}` !== fTrans) return false
    return true
  }), [eventos, fUsuario, fTrans])

  if (status === 'loading' || !session || !puedeVer) {
    return (<><TopNav /><div style={{ padding: '48px 32px', color: '#6B7280', fontSize: 14 }}>
      {status === 'loading' ? 'Comprobando acceso…' : 'Acceso restringido.'}</div></>)
  }

  return (
    <>
      <TopNav />
      <BotonVolver />
      <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ marginBottom: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Bitácora de estados</h1>
          <p style={{ color: '#6B7280', fontSize: 13, marginTop: 4 }}>
            Auditoría de cambios de estado de los contratos (S / SQ / Q / N): quién lo hizo y cuándo. Solo lectura.
          </p>
        </div>

        {/* Controles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', position: 'sticky', top: 52, zIndex: 30, background: '#fff', paddingTop: 10, paddingBottom: 10, marginBottom: 4, borderBottom: '1px solid #E5E7EB' }}>
          <input value={buscar} onChange={e => setBuscar(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') cargarContrato(buscar) }}
            placeholder="Buscar historial por IDADMON (p. ej. A00874)"
            style={{ ...inp, width: 320 }} />
          <button onClick={() => cargarContrato(buscar)} style={btnPrimary}>🔎 Ver historial</button>
          <button onClick={() => { setBuscar(''); setFUsuario(''); setFTrans(''); cargarRecientes(dias) }} style={btnSecondary}>↩ Cambios recientes</button>

          {modo === 'recientes' && (
            <>
              <span style={{ width: 1, height: 24, background: '#E5E7EB' }} />
              <label style={{ fontSize: 12, color: '#6B7280' }}>Últimos</label>
              <select value={dias} onChange={e => { const v = Number(e.target.value); setDias(v); cargarRecientes(v) }} style={sel}>
                <option value={30}>30 días</option>
                <option value={60}>60 días</option>
                <option value={90}>90 días</option>
                <option value={180}>180 días</option>
              </select>
              <select value={fUsuario} onChange={e => setFUsuario(e.target.value)} style={sel}>
                <option value="">Todas las personas</option>
                {optsUsuario.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <select value={fTrans} onChange={e => setFTrans(e.target.value)} style={sel}>
                <option value="">Todos los cambios</option>
                {optsTrans.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </>
          )}
          <span style={{ fontSize: 13, color: '#6B7280', marginLeft: 'auto' }}>{vista.length} registro(s)</span>
        </div>

        {error && <div style={{ color: '#A32D2D', fontSize: 13, marginBottom: 10 }}>✗ {error}</div>}
        {modo === 'contrato' && !cargando && (
          <div style={{ fontSize: 13, color: '#374151', marginBottom: 10 }}>
            Historial del contrato <b>{buscar.toUpperCase()}</b>{eventos[0]?.propietario ? <> — {eventos[0].propietario} · {eventos[0].inmueble}</> : null} · estado actual: <b>{eventos[0]?.estado_actual || '—'}</b>
          </div>
        )}

        <div style={{ ...card, padding: 0, overflowX: 'visible' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F3F4F6' }}>
                {['Registrado (sistema)', 'Fecha efectiva', 'IDADMON', 'Propietario', 'Inmueble', 'Cambio', 'Quién', 'Autorizó', 'Motivo'].map((h, i) => (
                  <th key={i} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr><td colSpan={9} style={{ ...td, color: '#6B7280' }}>Cargando…</td></tr>
              ) : vista.length === 0 ? (
                <tr><td colSpan={9} style={{ ...td, color: '#6B7280' }}>Sin registros.</td></tr>
              ) : vista.map((e, i) => {
                const col = colorEstado(e.estado_nuevo)
                return (
                  <tr key={e.id || i} style={{ background: i % 2 ? '#F9FAFB' : '#fff' }}>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtFechaHora(e.created_at)}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap', color: '#6B7280' }}>{fmtFecha(e.fecha)}</td>
                    <td style={td}><b>{e.idadmon}</b></td>
                    <td style={{ ...td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.propietario}>{e.propietario || '—'}</td>
                    <td style={{ ...td, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#6B7280' }} title={e.inmueble}>{e.inmueble || '—'}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      <span style={{ color: '#9CA3AF' }}>{e.estado_anterior || '—'}</span>
                      <span style={{ margin: '0 5px', color: '#9CA3AF' }}>→</span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: col.bg, color: col.fg }}>{e.estado_nuevo || '—'}</span>
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{e.usuario_corto || '—'}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap', color: '#6B7280' }}>{e.autorizado_por ? String(e.autorizado_por).split('@')[0] : ''}</td>
                    <td style={{ ...td, maxWidth: 340, color: '#374151' }} title={e.motivo}>{e.motivo || ''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 10 }}>
          "Registrado (sistema)" es el momento real en que se hizo el cambio (inmutable). "Fecha efectiva" es la fecha que se tecleó (puede ser futura, como una salida anunciada). Ojo: aquí solo aparece lo que se registró; un cambio no registrado no sale.
        </p>
      </div>
    </>
  )
}

const card = { background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, padding: '16px 20px', marginBottom: 16 }
const inp = { padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13, color: '#111827' }
const sel = { padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13, color: '#111827', background: '#fff' }
const btnPrimary = { background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }
const btnSecondary = { background: '#fff', color: '#374151', border: '1px solid #D1D5DB', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }
const th = { padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6B7280', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap', position: 'sticky', top: 106, zIndex: 20, background: '#F3F4F6' }
const td = { padding: '8px 12px', borderBottom: '0.5px solid #F3F4F6', verticalAlign: 'top' }
