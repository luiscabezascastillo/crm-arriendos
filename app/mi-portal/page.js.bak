'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import TopNav from '../components/ui/TopNav'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const DIRECCION_EMAILS = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com']

const PRIORIDAD_COLOR = { ALTA: '#dc2626', MEDIA: '#d97706', BAJA: '#16a34a' }
const ESTADO_COLOR = {
  PENDIENTE: { bg: '#fffbeb', color: '#d97706' },
  EN_PROCESO: { bg: '#eff6ff', color: '#1a56db' },
  COMPLETADA: { bg: '#f0fdf4', color: '#16a34a' },
}
const TIPO_AUS_COLOR = {
  VACACIONES: { bg: '#eff6ff', color: '#1a56db' },
  LICENCIA: { bg: '#fef2f2', color: '#dc2626' },
  PERMISO: { bg: '#fffbeb', color: '#d97706' },
}
const FREC_LABEL = { DIARIA: 'Diaria', SEMANAL: 'Semanal', QUINCENAL: 'Quincenal', MENSUAL: 'Mensual' }

export default function MiPortalPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const esDireccion = session?.user?.email && DIRECCION_EMAILS.includes(session.user.email)

  const [trabajadores, setTrabajadores] = useState([])
  const [emailActivo, setEmailActivo] = useState(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  // Permiso de acceso + redirección de externos a su portal
  useEffect(() => {
    if (status === 'loading') return
    if (!session) { router.replace('/panel'); return }
    supabase.from('colaboradores_externos')
      .select('id').eq('email', session.user.email).eq('activo', true).maybeSingle()
      .then(({ data }) => { if (data) router.replace('/portal-externo') })
  }, [session, status, router])

  useEffect(() => {
    if (session?.user?.email && !emailActivo) setEmailActivo(session.user.email)
  }, [session, emailActivo])

  useEffect(() => {
    if (!esDireccion) return
    supabase.from('control_asistencia_trabajadores')
      .select('id, nombre_real, email').eq('activo', true).order('nombre_real')
      .then(({ data }) => setTrabajadores(data || []))
  }, [esDireccion])

  useEffect(() => {
    if (!emailActivo) return
    cargarPortal(emailActivo)
  }, [emailActivo])

  async function cargarPortal(email) {
    setLoading(true)
    try {
      const res = await fetch(`/api/portal?email=${encodeURIComponent(email)}`)
      const d = await res.json()
      setData(d)
    } catch (e) {
      setData({ error: e.message })
    }
    setLoading(false)
  }

  async function marcarPeriodicaHecha(id) {
    await fetch('/api/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'periodica_hecha', id, por: session.user.email }),
    })
    cargarPortal(emailActivo)
  }

  function fmtFecha(f) {
    if (!f) return '—'
    const d = new Date(f)
    return d.toLocaleDateString('es-CL')
  }

  if (status === 'loading' || !session) return null

  const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }
  const cardHead = { padding: '12px 18px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--gray-700)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }
  const td = { padding: '9px 14px', fontSize: 13, color: 'var(--gray-700)', borderBottom: '1px solid var(--border-subtle)' }
  const th = { textAlign: 'left', padding: '8px 14px', fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.04em' }

  const tareas = data?.tareas || []
  const workflow = data?.workflow || []
  const periodicas = data?.periodicas || []
  const asistencia = data?.asistencia || null
  const ausencias = data?.ausencias || []
  const nombre = data?.trabajador?.nombre_real || emailActivo
  const diasVacaciones = ausencias.filter(a => a.tipo === 'VACACIONES').reduce((s, a) => s + (a.dias_habiles || 0), 0)

  return (
    <>
      <TopNav />
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 28px' }}>
        {/* Cabecera */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--gray-800)', margin: 0 }}>Mi Portal Datos no validos, mientras dure el desarrollo</h1>
            <div style={{ fontSize: 13, color: 'var(--gray-400)', marginTop: 4 }}>{nombre}</div>
          </div>
          {esDireccion && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', marginRight: 8 }}>Ver portal de:</label>
                <select value={emailActivo || ''} onChange={e => setEmailActivo(e.target.value)}
                  style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', background: 'var(--surface)' }}>
                  <option value={session.user.email}>Yo ({session.user.email})</option>
                  {trabajadores.map(t => <option key={t.id} value={t.email}>{t.nombre_real}</option>)}
                </select>
              </div>
              <button onClick={() => router.push('/portal-externo')}
                style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #7c2d12', background: '#fff7ed', color: '#7c2d12', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                Ver colaboradores externos →
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)' }}>Cargando…</div>
        ) : (
          <>
            {/* ZONA DE TRABAJO — 2 columnas */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 18, marginBottom: 28 }}>
              {/* Tareas encargadas */}
              <div style={card}>
                <div style={cardHead}><span>📋 Tareas encargadas</span><span style={{ color: 'var(--gray-400)' }}>{tareas.length}</span></div>
                {tareas.length === 0 ? (
                  <div style={{ padding: 18, fontSize: 13, color: 'var(--gray-400)' }}>Sin tareas asignadas</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: 'var(--gray-50)' }}><th style={th}>Título</th><th style={th}>Estado</th><th style={th}>Prior.</th><th style={th}>Límite</th></tr></thead>
                    <tbody>
                      {tareas.map(t => {
                        const ec = ESTADO_COLOR[t.estado] || { bg: '#f3f4f6', color: '#6b7280' }
                        return (
                          <tr key={t.id}>
                            <td style={td}>{t.titulo}</td>
                            <td style={td}><span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 6, background: ec.bg, color: ec.color }}>{t.estado}</span></td>
                            <td style={{ ...td, color: PRIORIDAD_COLOR[t.prioridad] || 'var(--gray-600)', fontWeight: 600 }}>{t.prioridad || '—'}</td>
                            <td style={td}>{fmtFecha(t.fecha_limite)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Workflow */}
              <div style={card}>
                <div style={cardHead}><span>⚙️ Tareas de procesos</span><span style={{ color: 'var(--gray-400)' }}>{workflow.length}</span></div>
                {workflow.length === 0 ? (
                  <div style={{ padding: 18, fontSize: 13, color: 'var(--gray-400)' }}>Sin tareas de workflow</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: 'var(--gray-50)' }}><th style={th}>Nodo</th><th style={th}>Estado</th><th style={th}>Inicio</th><th style={th}>Límite</th></tr></thead>
                    <tbody>
                      {workflow.map(w => (
                        <tr key={w.id}>
                          <td style={td}>{w.node_codigo}</td>
                          <td style={td}>{w.estado}</td>
                          <td style={td}>{fmtFecha(w.fecha_inicio)}</td>
                          <td style={td}>{fmtFecha(w.fecha_limite)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Periódicas — ocupa el ancho (segunda fila) */}
              <div style={{ ...card, gridColumn: '1 / -1' }}>
                <div style={cardHead}><span>🔄 Actividades periódicas</span><span style={{ color: 'var(--gray-400)' }}>{periodicas.length}</span></div>
                {periodicas.length === 0 ? (
                  <div style={{ padding: 18, fontSize: 13, color: 'var(--gray-400)' }}>Sin actividades periódicas</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: 'var(--gray-50)' }}><th style={th}>Actividad</th><th style={th}>Frecuencia</th><th style={th}>Ruta</th><th style={th}>Última vez</th><th style={th}></th></tr></thead>
                    <tbody>
                      {periodicas.map(p => (
                        <tr key={p.id}>
                          <td style={td}>{p.titulo}{p.descripcion && <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{p.descripcion}</div>}</td>
                          <td style={td}>{FREC_LABEL[p.frecuencia] || p.frecuencia}</td>
                          <td style={td}>{p.ruta_destino ? <a href={p.ruta_destino} target="_blank" rel="noopener noreferrer" style={{ color: '#1a56db' }}>Abrir →</a> : '—'}</td>
                          <td style={td}>{fmtFecha(p.ultima_ejecucion)}</td>
                          <td style={td}>
                            <button onClick={() => marcarPeriodicaHecha(p.id)}
                              style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: '#16a34a', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                              Hecho hoy
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* ZONA DE INFORMACIÓN PERSONAL */}
            <div style={{ background: 'var(--gray-50)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 22px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
                Información personal
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 18 }}>
                <div style={{ ...card, padding: '16px 18px' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vacaciones tomadas (2026)</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#1a56db', marginTop: 4 }}>{diasVacaciones} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--gray-400)' }}>días hábiles</span></div>
                </div>
                {asistencia && (
                  <>
                    <div style={{ ...card, padding: '16px 18px' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Saldo horas (mes)</div>
                      <div style={{ fontSize: 28, fontWeight: 700, color: (asistencia.saldo_mes_a_fecha ?? 0) >= 0 ? '#16a34a' : '#dc2626', marginTop: 4 }}>{asistencia.saldo_mes_a_fecha ?? '—'}</div>
                    </div>
                    <div style={{ ...card, padding: '16px 18px' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Incidencias abiertas</div>
                      <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--gray-800)', marginTop: 4 }}>{asistencia.incidencias_abiertas_mes ?? 0}</div>
                    </div>
                  </>
                )}
              </div>

              <div style={card}>
                <div style={cardHead}><span>🏖️ Mis ausencias</span><span style={{ color: 'var(--gray-400)' }}>{ausencias.length}</span></div>
                {ausencias.length === 0 ? (
                  <div style={{ padding: 18, fontSize: 13, color: 'var(--gray-400)' }}>Sin ausencias registradas</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: 'var(--gray-100)' }}><th style={th}>Tipo</th><th style={th}>Desde</th><th style={th}>Hasta</th><th style={th}>Días</th><th style={th}>Motivo</th></tr></thead>
                    <tbody>
                      {ausencias.map(a => {
                        const ct = TIPO_AUS_COLOR[a.tipo] || { bg: '#f3f4f6', color: '#6b7280' }
                        return (
                          <tr key={a.id}>
                            <td style={td}><span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: ct.bg, color: ct.color }}>{a.tipo}{a.recuperable ? ' ↻' : ''}</span></td>
                            <td style={td}>{fmtFecha(a.fecha_inicio)}</td>
                            <td style={td}>{fmtFecha(a.fecha_fin)}</td>
                            <td style={td}>{a.dias_habiles ?? '—'}</td>
                            <td style={{ ...td, color: 'var(--gray-400)', fontSize: 12 }}>{a.motivo || '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}