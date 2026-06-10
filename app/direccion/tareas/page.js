'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import TopNav from '../../components/ui/TopNav'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const DIRECCION_EMAILS = ['alberto.cabezas@fondocapital.com','luis.cabezas@fondocapital.com']

const RESPONSABLES = [
  { email: 'karina.morales@fondocapital.com', nombre: 'Karina Morales',  area: 'Controller' },
  { email: 'adalis@fondocapital.com',          nombre: 'Adalis',          area: 'Administración' },
  { email: 'fabiola.guerra@fondocapital.com',  nombre: 'Fabiola Guerra',  area: 'Administración' },
  { email: 'anthony.mendoza@fondocapital.com',         nombre: 'Anthony Mendoza',         area: 'Legal' },
]

const PRIORIDAD_COLOR = { ALTA: '#dc2626', MEDIA: '#d97706', BAJA: '#16a34a' }
const ESTADO_COLOR    = { PENDIENTE: '#6b7280', EN_PROCESO: '#1a56db', COMPLETADA: '#16a34a' }

const FORM_EMPTY = { titulo:'', descripcion:'', responsable:'', prioridad:'MEDIA', fecha_limite:'', proceso:'', idadmon:'' }

function TareasPageInner() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [tareas, setTareas]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [filtroResp, setFiltroResp] = useState(searchParams.get('responsable') || '')
  const [filtroEst,  setFiltroEst]  = useState('')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm]             = useState(FORM_EMPTY)
  const [guardando, setGuardando]   = useState(false)
  const [msg, setMsg]               = useState(null)
  const [editId, setEditId]         = useState(null)

  useEffect(() => {
    if (status === 'loading') return
    if (!session || !DIRECCION_EMAILS.includes(session.user?.email)) router.replace('/panel')
  }, [session, status])

  useEffect(() => { loadTareas() }, [filtroResp, filtroEst])

  async function loadTareas() {
    setLoading(true)
    let q = supabase.from('tareas').select('*').order('fecha_limite', { ascending: true, nullsFirst: false })
    if (filtroResp) q = q.eq('responsable', filtroResp)
    if (filtroEst)  q = q.eq('estado', filtroEst)
    const { data } = await q
    setTareas(data || [])
    setLoading(false)
  }

  async function guardar() {
    if (!form.titulo.trim() || !form.responsable) return setMsg({ ok:false, text:'Título y responsable son obligatorios' })
    setGuardando(true)
    const payload = {
      ...form,
      fecha_limite: form.fecha_limite || null,
      created_by: session.user.email,
    }
    let error
    if (editId) {
      ({ error } = await supabase.from('tareas').update(payload).eq('id', editId))
    } else {
      ({ error } = await supabase.from('tareas').insert([{ ...payload, estado: 'PENDIENTE' }]))
    }
    setGuardando(false)
    if (error) return setMsg({ ok:false, text:'Error: ' + error.message })
    setMsg({ ok:true, text: editId ? '✓ Tarea actualizada' : '✓ Tarea creada' })
    setTimeout(() => setMsg(null), 3000)
    setForm(FORM_EMPTY)
    setMostrarForm(false)
    setEditId(null)
    loadTareas()
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar esta tarea?')) return
    await supabase.from('tareas').delete().eq('id', id)
    loadTareas()
  }

  function editar(t) {
    setForm({
      titulo: t.titulo, descripcion: t.descripcion || '', responsable: t.responsable,
      prioridad: t.prioridad, fecha_limite: t.fecha_limite ? t.fecha_limite.split('T')[0] : '',
      proceso: t.proceso || '', idadmon: t.idadmon || '',
    })
    setEditId(t.id)
    setMostrarForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const nombreResp = (email) => RESPONSABLES.find(r => r.email === email)?.nombre || email
  const retrasada  = (t) => t.fecha_limite && t.estado !== 'COMPLETADA' && new Date(t.fecha_limite) < new Date()

  if (status === 'loading' || !session) return null

  return (
    <div style={{ minHeight:'100vh', background:'var(--background)' }}>
      <TopNav />
      <div style={{ padding:'20px 24px' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div>
            <div style={{ fontSize:18, fontWeight:700, color:'var(--gray-900)' }}>📋 Gestión de tareas</div>
            <div style={{ fontSize:12, color:'var(--gray-400)', marginTop:2 }}>
              {filtroResp ? `Tareas de ${nombreResp(filtroResp)}` : 'Todas las tareas'} · {tareas.length} registros
            </div>
          </div>
          <button onClick={() => { setForm(FORM_EMPTY); setEditId(null); setMostrarForm(v => !v) }} style={{
            padding:'8px 18px', borderRadius:8, border:'none', background:'#1a56db', color:'#fff',
            fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit'
          }}>
            {mostrarForm ? '✕ Cancelar' : '+ Nueva tarea'}
          </button>
        </div>

        {/* Formulario */}
        {mostrarForm && (
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:20, marginBottom:20 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'var(--gray-700)', marginBottom:16 }}>
              {editId ? '✏️ Editar tarea' : '✚ Nueva tarea'}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ fontSize:11, fontWeight:600, color:'var(--gray-500)', textTransform:'uppercase', display:'block', marginBottom:4 }}>Título *</label>
                <input value={form.titulo} onChange={e => setForm(p=>({...p,titulo:e.target.value}))}
                  style={{ width:'100%', padding:'8px 10px', borderRadius:7, border:'1px solid var(--border)', fontSize:13, boxSizing:'border-box', fontFamily:'inherit' }} />
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ fontSize:11, fontWeight:600, color:'var(--gray-500)', textTransform:'uppercase', display:'block', marginBottom:4 }}>Descripción</label>
                <textarea value={form.descripcion} onChange={e => setForm(p=>({...p,descripcion:e.target.value}))} rows={3}
                  style={{ width:'100%', padding:'8px 10px', borderRadius:7, border:'1px solid var(--border)', fontSize:13, boxSizing:'border-box', fontFamily:'inherit', resize:'vertical' }} />
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:600, color:'var(--gray-500)', textTransform:'uppercase', display:'block', marginBottom:4 }}>Responsable *</label>
                <select value={form.responsable} onChange={e => setForm(p=>({...p,responsable:e.target.value}))}
                  style={{ width:'100%', padding:'8px 10px', borderRadius:7, border:'1px solid var(--border)', fontSize:13, fontFamily:'inherit' }}>
                  <option value="">Seleccionar...</option>
                  {RESPONSABLES.map(r => <option key={r.email} value={r.email}>{r.nombre} ({r.area})</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:600, color:'var(--gray-500)', textTransform:'uppercase', display:'block', marginBottom:4 }}>Prioridad</label>
                <select value={form.prioridad} onChange={e => setForm(p=>({...p,prioridad:e.target.value}))}
                  style={{ width:'100%', padding:'8px 10px', borderRadius:7, border:'1px solid var(--border)', fontSize:13, fontFamily:'inherit' }}>
                  <option value="ALTA">🔴 Alta</option>
                  <option value="MEDIA">🟡 Media</option>
                  <option value="BAJA">🟢 Baja</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:600, color:'var(--gray-500)', textTransform:'uppercase', display:'block', marginBottom:4 }}>Fecha límite</label>
                <input type="date" value={form.fecha_limite} onChange={e => setForm(p=>({...p,fecha_limite:e.target.value}))}
                  style={{ width:'100%', padding:'8px 10px', borderRadius:7, border:'1px solid var(--border)', fontSize:13, fontFamily:'inherit' }} />
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:600, color:'var(--gray-500)', textTransform:'uppercase', display:'block', marginBottom:4 }}>Proceso (opcional)</label>
                <input value={form.proceso} onChange={e => setForm(p=>({...p,proceso:e.target.value}))} placeholder="Ej: Términos, Cobranza..."
                  style={{ width:'100%', padding:'8px 10px', borderRadius:7, border:'1px solid var(--border)', fontSize:13, fontFamily:'inherit' }} />
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:600, color:'var(--gray-500)', textTransform:'uppercase', display:'block', marginBottom:4 }}>IDADMON (opcional)</label>
                <input value={form.idadmon} onChange={e => setForm(p=>({...p,idadmon:e.target.value}))} placeholder="Ej: A00714"
                  style={{ width:'100%', padding:'8px 10px', borderRadius:7, border:'1px solid var(--border)', fontSize:13, fontFamily:'inherit' }} />
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <button onClick={guardar} disabled={guardando} style={{
                padding:'8px 20px', borderRadius:8, border:'none', background:'#1a56db', color:'#fff',
                fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit'
              }}>{guardando ? '⏳ Guardando...' : '💾 Guardar'}</button>
              {msg && <span style={{ fontSize:12, color:msg.ok?'#16a34a':'#dc2626', fontWeight:500 }}>{msg.text}</span>}
            </div>
          </div>
        )}

        {/* Filtros */}
        <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
          <select value={filtroResp} onChange={e => setFiltroResp(e.target.value)}
            style={{ padding:'6px 10px', borderRadius:7, border:'1px solid var(--border)', fontSize:12, fontFamily:'inherit' }}>
            <option value="">Todos los responsables</option>
            {RESPONSABLES.map(r => <option key={r.email} value={r.email}>{r.nombre}</option>)}
          </select>
          <select value={filtroEst} onChange={e => setFiltroEst(e.target.value)}
            style={{ padding:'6px 10px', borderRadius:7, border:'1px solid var(--border)', fontSize:12, fontFamily:'inherit' }}>
            <option value="">Todos los estados</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="EN_PROCESO">En proceso</option>
            <option value="COMPLETADA">Completada</option>
          </select>
          <div style={{ marginLeft:'auto', fontSize:12, color:'var(--gray-400)', alignSelf:'center' }}>
            {tareas.filter(t => retrasada(t)).length > 0 && (
              <span style={{ color:'#dc2626', fontWeight:600 }}>⚠️ {tareas.filter(t => retrasada(t)).length} retrasadas</span>
            )}
          </div>
        </div>

        {/* Tabla */}
        {loading ? (
          <div style={{ textAlign:'center', padding:40, color:'var(--gray-400)' }}>Cargando...</div>
        ) : tareas.length === 0 ? (
          <div style={{ textAlign:'center', padding:40, color:'var(--gray-400)' }}>No hay tareas con los filtros aplicados</div>
        ) : (
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'var(--gray-50)', borderBottom:'1px solid var(--border)' }}>
                  {['Prioridad','Título','Responsable','Estado','Fecha límite','Proceso','Acciones'].map(h => (
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:600, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tareas.map((t, i) => (
                  <tr key={t.id} style={{ borderBottom: i < tareas.length-1 ? '1px solid var(--border-subtle)' : 'none', background: retrasada(t) ? '#fff5f5' : 'transparent' }}>
                    <td style={{ padding:'10px 14px' }}>
                      <span style={{ padding:'2px 8px', borderRadius:5, background: PRIORIDAD_COLOR[t.prioridad]+'20', color: PRIORIDAD_COLOR[t.prioridad], fontSize:11, fontWeight:600 }}>{t.prioridad}</span>
                    </td>
                    <td style={{ padding:'10px 14px' }}>
                      <div style={{ fontSize:13, fontWeight:500, color:'var(--gray-800)' }}>{t.titulo}</div>
                      {t.descripcion && <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:2 }}>{t.descripcion.substring(0,80)}{t.descripcion.length>80?'...':''}</div>}
                      {t.link_resultado && <a href={t.link_resultado} target="_blank" rel="noreferrer" style={{ fontSize:11, color:'#1a56db' }}>📎 Ver resultado</a>}
                    </td>
                    <td style={{ padding:'10px 14px', fontSize:12, color:'var(--gray-600)' }}>{nombreResp(t.responsable)}</td>
                    <td style={{ padding:'10px 14px' }}>
                      <span style={{ padding:'2px 8px', borderRadius:5, background: ESTADO_COLOR[t.estado]+'20', color: ESTADO_COLOR[t.estado], fontSize:11, fontWeight:600 }}>{t.estado}</span>
                    </td>
                    <td style={{ padding:'10px 14px', fontSize:12, color: retrasada(t) ? '#dc2626' : 'var(--gray-600)', fontWeight: retrasada(t) ? 600 : 400 }}>
                      {t.fecha_limite ? new Date(t.fecha_limite).toLocaleDateString('es-CL') : '—'}
                      {retrasada(t) && ' ⚠️'}
                    </td>
                    <td style={{ padding:'10px 14px', fontSize:11, color:'var(--gray-500)' }}>
                      {t.proceso || '—'}{t.idadmon ? ` · ${t.idadmon}` : ''}
                    </td>
                    <td style={{ padding:'10px 14px' }}>
                      <div style={{ display:'flex', gap:4 }}>
                        <button onClick={() => editar(t)} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid #1a56db', background:'#eff6ff', color:'#1a56db', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>Editar</button>
                        <button onClick={() => eliminar(t.id)} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid #dc2626', background:'#fef2f2', color:'#dc2626', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default function TareasPage() { return <Suspense fallback={null}><TareasPageInner /></Suspense> }