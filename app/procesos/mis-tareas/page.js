'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import TopNav from '../../components/ui/TopNav'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const PRIORIDAD_COLOR = { ALTA: '#dc2626', MEDIA: '#d97706', BAJA: '#16a34a' }

export default function MisTareasPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [tareas, setTareas]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [filtroEst, setFiltroEst] = useState('PENDIENTE')
  const [cerrando, setCerrando]   = useState(null)
  const [formCierre, setFormCierre] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg]             = useState(null)

  useEffect(() => {
    if (status === 'loading') return
    if (!session) router.replace('/panel')
  }, [session, status])

  useEffect(() => {
    if (session?.user?.email) loadTareas()
  }, [session, filtroEst])

  async function loadTareas() {
    setLoading(true)
    let q = supabase.from('tareas').select('*')
      .eq('responsable', session.user.email)
      .order('fecha_limite', { ascending: true, nullsFirst: false })
    if (filtroEst) q = q.eq('estado', filtroEst)
    const { data } = await q
    setTareas(data || [])
    setLoading(false)
  }

  async function marcarCompletada(t) {
    const cierre = formCierre[t.id] || {}
    if (!cierre.link_resultado?.trim()) {
      return setMsg({ id: t.id, ok:false, text:'Debes indicar el link de Drive con el resultado' })
    }
    setGuardando(t.id)
    const { error } = await supabase.from('tareas').update({
      estado: 'COMPLETADA',
      fecha_cierre: new Date().toISOString(),
      link_resultado: cierre.link_resultado,
      comentario_cierre: cierre.comentario_cierre || '',
    }).eq('id', t.id)
    setGuardando(null)
    if (error) return setMsg({ id: t.id, ok:false, text: 'Error: ' + error.message })
    setMsg({ id: t.id, ok:true, text: '✓ Tarea marcada como completada' })
    setCerrando(null)
    setTimeout(() => { setMsg(null); loadTareas() }, 2000)
  }

  async function cambiarEstado(t, estado) {
    await supabase.from('tareas').update({ estado }).eq('id', t.id)
    loadTareas()
  }

  const retrasada = (t) => t.fecha_limite && t.estado !== 'COMPLETADA' && new Date(t.fecha_limite) < new Date()

  if (status === 'loading' || !session) return null

  const pendientes  = tareas.filter(t => t.estado === 'PENDIENTE').length
  const en_proceso  = tareas.filter(t => t.estado === 'EN_PROCESO').length
  const retrasadas  = tareas.filter(t => retrasada(t)).length

  return (
    <div style={{ minHeight:'100vh', background:'var(--background)' }}>
      <TopNav />
      <div style={{ padding:'20px 24px' }}>

        {/* Header */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:18, fontWeight:700, color:'var(--gray-900)' }}>📋 Mis tareas</div>
          <div style={{ fontSize:12, color:'var(--gray-400)', marginTop:2 }}>{session.user.name || session.user.email}</div>
        </div>

        {/* KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
          {[
            { label:'Pendientes',  value: pendientes, color:'#6b7280' },
            { label:'En proceso',  value: en_proceso, color:'#1a56db' },
            { label:'Retrasadas',  value: retrasadas, color: retrasadas > 0 ? '#dc2626' : '#16a34a' },
          ].map(k => (
            <div key={k.label} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:'14px 18px' }}>
              <div style={{ fontSize:10, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:.5, marginBottom:4 }}>{k.label}</div>
              <div style={{ fontSize:22, fontWeight:700, color:k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Filtro estado */}
        <div style={{ display:'flex', gap:8, marginBottom:16 }}>
          {[['', 'Todas'], ['PENDIENTE', 'Pendientes'], ['EN_PROCESO', 'En proceso'], ['COMPLETADA', 'Completadas']].map(([val, lbl]) => (
            <button key={val} onClick={() => setFiltroEst(val)} style={{
              padding:'5px 14px', borderRadius:7, border:'1px solid var(--border)', fontSize:12, fontWeight:500,
              cursor:'pointer', fontFamily:'inherit',
              background: filtroEst === val ? '#1a56db' : 'transparent',
              color: filtroEst === val ? '#fff' : 'var(--gray-600)',
            }}>{lbl}</button>
          ))}
        </div>

        {/* Lista de tareas */}
        {loading ? (
          <div style={{ textAlign:'center', padding:40, color:'var(--gray-400)' }}>Cargando...</div>
        ) : tareas.length === 0 ? (
          <div style={{ textAlign:'center', padding:40, color:'var(--gray-400)' }}>No tienes tareas {filtroEst ? filtroEst.toLowerCase().replace('_',' ')+'s' : ''}</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {tareas.map(t => (
              <div key={t.id} style={{
                background:'var(--surface)', border:`1px solid ${retrasada(t) ? '#fca5a5' : 'var(--border)'}`,
                borderRadius:12, padding:16,
                background: retrasada(t) ? '#fff5f5' : 'var(--surface)',
              }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                      <span style={{ padding:'2px 7px', borderRadius:5, background: PRIORIDAD_COLOR[t.prioridad]+'20', color: PRIORIDAD_COLOR[t.prioridad], fontSize:10, fontWeight:700 }}>{t.prioridad}</span>
                      {retrasada(t) && <span style={{ fontSize:11, color:'#dc2626', fontWeight:600 }}>⚠️ RETRASADA</span>}
                      {t.proceso && <span style={{ fontSize:11, color:'var(--gray-400)' }}>{t.proceso}{t.idadmon ? ` · ${t.idadmon}` : ''}</span>}
                    </div>
                    <div style={{ fontSize:14, fontWeight:600, color:'var(--gray-800)', marginBottom:4 }}>{t.titulo}</div>
                    {t.descripcion && <div style={{ fontSize:12, color:'var(--gray-500)', marginBottom:6 }}>{t.descripcion}</div>}
                    <div style={{ fontSize:11, color: retrasada(t) ? '#dc2626' : 'var(--gray-400)' }}>
                      {t.fecha_limite ? `Fecha límite: ${new Date(t.fecha_limite).toLocaleDateString('es-CL')}` : 'Sin fecha límite'}
                    </div>
                    {t.link_resultado && (
                      <a href={t.link_resultado} target="_blank" rel="noreferrer" style={{ fontSize:12, color:'#1a56db', display:'inline-block', marginTop:4 }}>
                        📎 Ver resultado en Drive
                      </a>
                    )}
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:4, minWidth:120 }}>
                    {t.estado === 'PENDIENTE' && (
                      <button onClick={() => cambiarEstado(t, 'EN_PROCESO')} style={{
                        padding:'5px 10px', borderRadius:6, border:'1px solid #1a56db', background:'#eff6ff',
                        color:'#1a56db', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit'
                      }}>▶ Iniciar</button>
                    )}
                    {t.estado !== 'COMPLETADA' && (
                      <button onClick={() => setCerrando(cerrando === t.id ? null : t.id)} style={{
                        padding:'5px 10px', borderRadius:6, border:'1px solid #16a34a', background:'#f0fdf4',
                        color:'#16a34a', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit'
                      }}>✓ Completar</button>
                    )}
                    {t.estado === 'COMPLETADA' && (
                      <span style={{ fontSize:11, color:'#16a34a', fontWeight:600 }}>✓ Completada</span>
                    )}
                  </div>
                </div>

                {/* Formulario cierre */}
                {cerrando === t.id && (
                  <div style={{ marginTop:12, padding:12, background:'#f9fafb', borderRadius:8, border:'1px solid var(--border)' }}>
                    <div style={{ fontSize:11, fontWeight:600, color:'var(--gray-600)', marginBottom:8 }}>Completar tarea</div>
                    <div style={{ marginBottom:8 }}>
                      <label style={{ fontSize:11, color:'var(--gray-500)', display:'block', marginBottom:4 }}>Link de Drive con el resultado *</label>
                      <input
                        type="text"
                        placeholder="https://drive.google.com/..."
                        value={formCierre[t.id]?.link_resultado || ''}
                        onChange={e => setFormCierre(p => ({...p, [t.id]: {...(p[t.id]||{}), link_resultado: e.target.value}}))}
                        style={{ width:'100%', padding:'7px 10px', borderRadius:6, border:'1px solid var(--border)', fontSize:12, boxSizing:'border-box', fontFamily:'inherit' }}
                      />
                    </div>
                    <div style={{ marginBottom:10 }}>
                      <label style={{ fontSize:11, color:'var(--gray-500)', display:'block', marginBottom:4 }}>Comentario (opcional)</label>
                      <textarea
                        rows={2}
                        placeholder="Observaciones sobre el resultado..."
                        value={formCierre[t.id]?.comentario_cierre || ''}
                        onChange={e => setFormCierre(p => ({...p, [t.id]: {...(p[t.id]||{}), comentario_cierre: e.target.value}}))}
                        style={{ width:'100%', padding:'7px 10px', borderRadius:6, border:'1px solid var(--border)', fontSize:12, boxSizing:'border-box', fontFamily:'inherit', resize:'vertical' }}
                      />
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <button onClick={() => marcarCompletada(t)} disabled={guardando === t.id} style={{
                        padding:'6px 16px', borderRadius:7, border:'none', background:'#16a34a', color:'#fff',
                        fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit'
                      }}>{guardando === t.id ? '⏳ Guardando...' : '💾 Marcar como completada'}</button>
                      {msg?.id === t.id && <span style={{ fontSize:12, color: msg.ok ? '#16a34a' : '#dc2626', fontWeight:500 }}>{msg.text}</span>}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
