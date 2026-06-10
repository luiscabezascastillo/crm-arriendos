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
const CATEGORIA_LABEL = { COMERCIAL: 'Comercial', MERCANTIL: 'Contrato mercantil' }

export default function PortalExternoPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const esDireccion = session?.user?.email && DIRECCION_EMAILS.includes(session.user.email)

  const [externos, setExternos] = useState([])
  const [emailActivo, setEmailActivo] = useState(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'loading') return
    if (!session) router.replace('/panel')
  }, [session, status, router])

  useEffect(() => {
    if (session?.user?.email && !emailActivo) setEmailActivo(session.user.email)
  }, [session, emailActivo])

  useEffect(() => {
    if (!esDireccion) return
    supabase.from('colaboradores_externos')
      .select('id, nombre, email, categoria').eq('activo', true).order('nombre')
      .then(({ data }) => setExternos(data || []))
  }, [esDireccion])

  useEffect(() => {
    if (!emailActivo) return
    cargar(emailActivo)
  }, [emailActivo])

  async function cargar(email) {
    setLoading(true)
    try {
      const res = await fetch(`/api/portal-externo?email=${encodeURIComponent(email)}`)
      const d = await res.json()
      setData(d)
    } catch (e) {
      setData({ error: e.message })
    }
    setLoading(false)
  }

  function fmtFecha(f) {
    if (!f) return '—'
    return new Date(f).toLocaleDateString('es-CL')
  }

  if (status === 'loading' || !session) return null

  const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 18 }
  const cardHead = { padding: '12px 18px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--gray-700)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }
  const td = { padding: '9px 14px', fontSize: 13, color: 'var(--gray-700)', borderBottom: '1px solid var(--border-subtle)' }
  const th = { textAlign: 'left', padding: '8px 14px', fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.04em' }

  const colaborador = data?.colaborador || null
  const tareas = data?.tareas || []
  const workflow = data?.workflow || []
  const noEsExterno = data && data.esExterno === false

  return (
    <>
      <TopNav />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 28px' }}>
        {/* Cabecera con sello EXTERNO */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--gray-800)', margin: 0 }}>Portal de colaborador externo</h1>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 8, background: '#7c2d12', color: '#fff', letterSpacing: '0.05em' }}>
              COLABORADOR EXTERNO
            </span>
          </div>
          {esDireccion && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <button onClick={() => router.push('/mi-portal')}
                style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--gray-600)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                ← Ver empleados
              </button>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', marginRight: 8 }}>Ver:</label>
                <select value={emailActivo || ''} onChange={e => setEmailActivo(e.target.value)}
                  style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', background: 'var(--surface)' }}>
                  <option value={session.user.email}>Yo ({session.user.email})</option>
                  {externos.map(x => <option key={x.id} value={x.email}>{x.nombre}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Aviso legal */}
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 12, color: '#9a3412' }}>
          Esta vista corresponde a un <strong>colaborador externo</strong> que presta servicios de forma independiente. No constituye relación laboral ni de dependencia con la empresa.
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)' }}>Cargando…</div>
        ) : noEsExterno ? (
          <div style={{ ...card, padding: 24, textAlign: 'center', color: 'var(--gray-500)' }}>
            Este usuario no figura como colaborador externo.
          </div>
        ) : (
          <>
            {/* Datos del colaborador */}
            {colaborador && (
              <div style={{ ...card, padding: '16px 18px' }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--gray-800)' }}>{colaborador.nombre}</div>
                <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 4 }}>
                  {CATEGORIA_LABEL[colaborador.categoria] || colaborador.categoria}
                  {colaborador.pais ? ` · ${colaborador.pais}` : ''} · {colaborador.email}
                </div>
              </div>
            )}

            {/* Encargos */}
            <div style={card}>
              <div style={cardHead}><span>📋 Encargos asignados</span><span style={{ color: 'var(--gray-400)' }}>{tareas.length}</span></div>
              {tareas.length === 0 ? (
                <div style={{ padding: 18, fontSize: 13, color: 'var(--gray-400)' }}>Sin encargos asignados</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ background: 'var(--gray-50)' }}><th style={th}>Título</th><th style={th}>Estado</th><th style={th}>Prioridad</th><th style={th}>Límite</th></tr></thead>
                  <tbody>
                    {tareas.map(t => {
                      const ec = ESTADO_COLOR[t.estado] || { bg: '#f3f4f6', color: '#6b7280' }
                      return (
                        <tr key={t.id}>
                          <td style={td}>{t.titulo}</td>
                          <td style={td}><span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: ec.bg, color: ec.color }}>{t.estado}</span></td>
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
              <div style={cardHead}><span>⚙️ Participación en procesos</span><span style={{ color: 'var(--gray-400)' }}>{workflow.length}</span></div>
              {workflow.length === 0 ? (
                <div style={{ padding: 18, fontSize: 13, color: 'var(--gray-400)' }}>Sin participación en procesos</div>
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
          </>
        )}
      </div>
    </>
  )
}