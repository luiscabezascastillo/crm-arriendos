'use client'
import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import TopNav from '../components/ui/TopNav'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const DIRECCION_EMAILS = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com']
const OPTS_VENDEDOR = ['Alberto', 'Adalis', 'Fabiola', 'Lorena', 'Pedro', 'Neika', 'Tirza', 'Karina']
const COLOR = { agendada: '#7c3aed', realizada: '#16a34a', cancelada: '#dc2626' }
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const DIAS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']

const pad = n => String(n).padStart(2, '0')
const ymd = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`   // m: 0-indexed
const hoyStr = () => { const t = new Date(); return ymd(t.getFullYear(), t.getMonth(), t.getDate()) }

export default function CalendarioPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const email = session?.user?.email
  const rol = session?.user?.role
  const esAdmin = rol === 'admin' || DIRECCION_EMAILS.includes(email)

  const [visitas, setVisitas] = useState([])
  const [loading, setLoading] = useState(true)
  const [fComercial, setFComercial] = useState('')
  const t0 = new Date()
  const [cursor, setCursor] = useState({ y: t0.getFullYear(), m: t0.getMonth() })
  const [sel, setSel] = useState(hoyStr())

  useEffect(() => { if (status === 'authenticated' && !esAdmin) router.replace('/') }, [status, esAdmin, router])
  useEffect(() => { if (esAdmin) cargar() }, [esAdmin])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase
      .from('visitas')
      .select('*, visita_propiedades(*), ordenes_visita(*)')
      .order('fecha', { ascending: true })
    setVisitas(data || [])
    setLoading(false)
  }

  async function cambiarEstado(v, estado) {
    await supabase.from('visitas').update({ estado, updated_at: new Date().toISOString() }).eq('id', v.id)
    await cargar()
  }
  async function generarOrden(v) {
    const r = await fetch('/api/ordenes/generar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visita_id: v.id }) })
    if (r.ok) await cargar()
    else { const j = await r.json().catch(() => ({})); alert(j.error || 'No se pudo generar la orden.') }
  }
  function copiarLink(orden) {
    const link = `${window.location.origin}/firmar/${orden.token}`
    if (navigator.clipboard) navigator.clipboard.writeText(link).then(() => alert('Link copiado'))
    else window.prompt('Copia el link:', link)
  }
  async function enviarCorreo(orden) {
    if (!window.confirm('¿Enviar la orden por correo al cliente?')) return
    const r = await fetch('/api/ordenes/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: orden.token }) })
    const j = await r.json().catch(() => ({}))
    if (r.ok) {
      alert(j.prueba ? `Enviado en MODO PRUEBA a tu correo.\nDestino real: ${j.destino_real || '(cliente sin email)'}` : `Correo enviado a ${j.to}`)
      await cargar()
    } else alert(j.error || 'No se pudo enviar el correo.')
  }

  const filtradas = useMemo(() => fComercial ? visitas.filter(v => v.comercial === fComercial) : visitas, [visitas, fComercial])
  const porDia = useMemo(() => {
    const m = {}
    filtradas.forEach(v => { if (v.fecha) (m[v.fecha] = m[v.fecha] || []).push(v) })
    return m
  }, [filtradas])

  const primerDia = new Date(cursor.y, cursor.m, 1)
  const offset = (primerDia.getDay() + 6) % 7      // lunes primero
  const diasMes = new Date(cursor.y, cursor.m + 1, 0).getDate()
  const celdas = []
  for (let i = 0; i < offset; i++) celdas.push(null)
  for (let d = 1; d <= diasMes; d++) celdas.push(d)
  while (celdas.length % 7 !== 0) celdas.push(null)

  const selVisitas = (porDia[sel] || []).slice().sort((a, b) => {
    if (!a.hora && !b.hora) return 0
    if (!a.hora) return 1
    if (!b.hora) return -1
    return String(a.hora).localeCompare(String(b.hora))
  })

  function navMes(delta) {
    setCursor(c => { let m = c.m + delta, y = c.y; if (m < 0) { m = 11; y-- } if (m > 11) { m = 0; y++ } return { y, m } })
  }
  function irHoy() { const t = new Date(); setCursor({ y: t.getFullYear(), m: t.getMonth() }); setSel(hoyStr()) }

  const [sy, sm, sd] = sel.split('-').map(Number)
  const selRaw = new Date(sy, sm - 1, sd).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' }).replace(',', '')
  const selLabel = selRaw.charAt(0).toUpperCase() + selRaw.slice(1)

  if (status === 'loading') return <div style={{ minHeight: '100vh' }}><TopNav /><div style={{ padding: 40, color: '#888' }}>Cargando…</div></div>
  if (status === 'authenticated' && !esAdmin) return null

  const input = { padding: '8px 10px', borderRadius: 7, border: '1px solid #E5E7EB', fontSize: 13, fontFamily: 'inherit', background: '#fff' }
  const navBtn = { padding: '6px 11px', borderRadius: 7, border: '1px solid #E5E7EB', background: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: '#374151' }
  const mini = { fontSize: 11, padding: '3px 8px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid', textDecoration: 'none', display: 'inline-block' }

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF8' }}>
      <TopNav />
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: 24, fontFamily: '"DM Sans", sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>Calendario</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <select style={input} value={fComercial} onChange={e => setFComercial(e.target.value)}>
              <option value="">Todos los comerciales</option>
              {OPTS_VENDEDOR.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <button style={navBtn} onClick={() => navMes(-1)}>‹</button>
            <div style={{ minWidth: 150, textAlign: 'center', fontSize: 14, fontWeight: 600, color: '#1a1a2e', textTransform: 'capitalize' }}>{MESES[cursor.m]} {cursor.y}</div>
            <button style={navBtn} onClick={() => navMes(1)}>›</button>
            <button style={{ ...navBtn, color: '#185FA5', borderColor: '#B5D4F4' }} onClick={irHoy}>Hoy</button>
          </div>
        </div>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 18 }}>Visitas agendadas · venta y arriendo</div>

        {/* leyenda */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 14, fontSize: 12, color: '#666' }}>
          {Object.entries(COLOR).map(([k, c]) => (
            <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: c, display: 'inline-block' }} />{k}
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* === GRID MENSUAL === */}
          <div style={{ flex: '2 1 560px', minWidth: 320, background: '#fff', border: '1px solid #E8E6E0', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#FAFAF8', borderBottom: '1px solid #E8E6E0' }}>
              {DIAS.map(d => <div key={d} style={{ padding: '8px 0', textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase' }}>{d}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {celdas.map((d, i) => {
                if (d === null) return <div key={i} style={{ minHeight: 86, borderRight: '1px solid #F3F4F6', borderBottom: '1px solid #F3F4F6', background: '#FCFCFB' }} />
                const fecha = ymd(cursor.y, cursor.m, d)
                const lista = porDia[fecha] || []
                const esHoy = fecha === hoyStr()
                const esSel = fecha === sel
                return (
                  <div key={i} onClick={() => setSel(fecha)}
                    style={{ minHeight: 86, padding: 6, cursor: 'pointer', borderRight: '1px solid #F3F4F6', borderBottom: '1px solid #F3F4F6',
                      background: esSel ? '#EEF6FF' : '#fff', boxShadow: esSel ? 'inset 0 0 0 2px #378ADD' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: esHoy ? 700 : 500,
                        color: esHoy ? '#fff' : '#374151', background: esHoy ? '#185FA5' : 'transparent',
                        width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{d}</span>
                      {lista.length > 0 && <span style={{ fontSize: 10, color: '#999' }}>{lista.length}</span>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {lista.slice(0, 3).map(v => (
                        <div key={v.id} style={{ fontSize: 10, lineHeight: 1.3, padding: '1px 4px', borderRadius: 4, background: (COLOR[v.estado] || '#999') + '22', color: COLOR[v.estado] || '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {v.hora ? String(v.hora).slice(0, 5) + ' ' : ''}{v.cliente_nombre || 'Visita'}
                        </div>
                      ))}
                      {lista.length > 3 && <div style={{ fontSize: 10, color: '#999', paddingLeft: 4 }}>+{lista.length - 3} más</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* === PANEL DEL DÍA === */}
          <div style={{ flex: '1 1 320px', minWidth: 300 }}>
            <div style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 2 }}>{selLabel}</div>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 14 }}>{selVisitas.length === 0 ? 'Sin visitas' : `${selVisitas.length} ${selVisitas.length === 1 ? 'visita' : 'visitas'}`}</div>

              {loading ? <div style={{ color: '#888', fontSize: 13 }}>Cargando…</div>
                : selVisitas.length === 0 ? <div style={{ color: '#aaa', fontSize: 13, padding: '12px 0' }}>No hay visitas este día.</div>
                  : selVisitas.map(v => {
                    const orden = (v.ordenes_visita || [])[0]
                    const nprops = v.visita_propiedades?.length || 0
                    return (
                      <div key={v.id} style={{ borderTop: '1px solid #F3F4F6', padding: '12px 0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>{v.hora ? String(v.hora).slice(0, 5) : 'Sin hora'} · {v.cliente_nombre || '—'}</div>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color: COLOR[v.estado] || '#6b7280', border: '1px solid ' + (COLOR[v.estado] || '#ddd') }}>{v.estado}</span>
                        </div>
                        <div style={{ fontSize: 12, color: '#777', margin: '3px 0' }}>
                          {v.comercial || 'sin comercial'}{nprops ? ` · ${nprops} ${nprops === 1 ? 'propiedad' : 'propiedades'}` : ''}
                        </div>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
                          {v.estado !== 'realizada' && <button onClick={() => cambiarEstado(v, 'realizada')} style={{ ...mini, borderColor: '#16a34a', background: '#f0fdf4', color: '#16a34a' }}>✓ realizada</button>}
                          {v.estado !== 'cancelada' && <button onClick={() => cambiarEstado(v, 'cancelada')} style={{ ...mini, borderColor: '#d97706', background: '#fffbeb', color: '#b45309' }}>✕</button>}
                          {!orden ? (
                            <button onClick={() => generarOrden(v)} style={{ ...mini, borderColor: '#0C447C', background: '#E6F1FB', color: '#0C447C' }}>Generar orden</button>
                          ) : (
                            <>
                              <span style={{ ...mini, borderColor: orden.estado === 'firmada' ? '#bbf7d0' : '#fde68a', background: '#fff', color: orden.estado === 'firmada' ? '#16a34a' : '#b45309', cursor: 'default' }}>N° {orden.id} · {orden.estado === 'firmada' ? 'firmada ✓' : orden.estado}</span>
                              {orden.pdf_url && <a href={orden.pdf_url} target="_blank" rel="noreferrer" style={{ ...mini, borderColor: '#E5E7EB', background: '#fff', color: '#374151' }}>PDF</a>}
                              <button onClick={() => enviarCorreo(orden)} style={{ ...mini, borderColor: '#0F6E56', background: '#E1F5EE', color: '#0F6E56' }}>Correo</button>
                              {orden.estado !== 'firmada' && <button onClick={() => copiarLink(orden)} style={{ ...mini, borderColor: '#E5E7EB', background: '#fff', color: '#374151' }}>Link</button>}
                              {orden.estado !== 'firmada' && <a href={`/firmar/${orden.token}`} target="_blank" rel="noreferrer" style={{ ...mini, borderColor: '#7c3aed', background: '#f5f3ff', color: '#7c3aed' }}>Firmar</a>}
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
