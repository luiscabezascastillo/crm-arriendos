'use client'
import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import TopNav from '../components/ui/TopNav'
import AgendarVisitaModal from '../components/AgendarVisitaModal'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const DIRECCION_EMAILS = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com']
const OPTS_VENDEDOR = ['Alberto', 'Adalis', 'Fabiola', 'Lorena', 'Pedro', 'Neika', 'Tirza', 'Karina']
const ESTADOS_VISITA = ['agendada', 'realizada', 'cancelada']
const COLOR_ESTADO_VISITA = { agendada: '#7c3aed', realizada: '#16a34a', cancelada: '#dc2626' }

const fmtFecha = s => {
  if (!s) return ''
  const [y, m, d] = String(s).split('-')
  return (d && m && y) ? `${d}-${m}-${y.slice(2)}` : String(s)
}

export default function VisitasPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const email = session?.user?.email
  const rol = session?.user?.role
  const esAdmin = rol === 'admin' || DIRECCION_EMAILS.includes(email)

  const [visitas, setVisitas] = useState([])
  const [loading, setLoading] = useState(true)
  const [fComercial, setFComercial] = useState('')
  const [fEstado, setFEstado] = useState('')
  const [fOrden, setFOrden] = useState('')      // '', 'sin', 'borrador', 'firmada'
  const [busca, setBusca] = useState('')
  const [nuevaOpen, setNuevaOpen] = useState(false)

  useEffect(() => {
    if (status === 'authenticated' && !esAdmin) router.replace('/')
  }, [status, esAdmin, router])

  useEffect(() => { if (esAdmin) cargar() }, [esAdmin])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase
      .from('visitas')
      .select('*, visita_propiedades(*), ordenes_visita(*)')
      .order('fecha', { ascending: false })
    setVisitas(data || [])
    setLoading(false)
  }

  async function cambiarEstado(v, estado) {
    await supabase.from('visitas').update({ estado, updated_at: new Date().toISOString() }).eq('id', v.id)
    await cargar()
  }
  async function eliminar(v) {
    if (!window.confirm('¿Eliminar esta visita y su orden asociada?')) return
    await supabase.from('visitas').delete().eq('id', v.id)
    await cargar()
  }
  async function generarOrden(v) {
    const res = await fetch('/api/ordenes/generar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visita_id: v.id }) })
    if (res.ok) await cargar()
    else { const j = await res.json().catch(() => ({})); alert(j.error || 'No se pudo generar la orden.') }
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

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return visitas.filter(v => {
      if (fComercial && v.comercial !== fComercial) return false
      if (fEstado && v.estado !== fEstado) return false
      const orden = (v.ordenes_visita || [])[0]
      if (fOrden === 'sin' && orden) return false
      if (fOrden === 'borrador' && (!orden || orden.estado !== 'borrador')) return false
      if (fOrden === 'firmada' && (!orden || orden.estado !== 'firmada')) return false
      if (q) {
        const hay = [v.cliente_nombre, v.cliente_telefono, v.comercial].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [visitas, fComercial, fEstado, fOrden, busca])

  if (status === 'loading') return <div style={{ minHeight: '100vh' }}><TopNav /><div style={{ padding: 40, color: '#888' }}>Cargando…</div></div>
  if (status === 'authenticated' && !esAdmin) return null

  const input = { padding: '8px 10px', borderRadius: 7, border: '1px solid #E5E7EB', fontSize: 13, fontFamily: 'inherit', background: '#fff' }
  const th = { padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: .5 }
  const td = { padding: '10px 12px', fontSize: 13, verticalAlign: 'top' }
  const mini = { fontSize: 11, padding: '3px 8px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid', textDecoration: 'none', display: 'inline-block' }

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF8' }}>
      <TopNav />
      <div style={{ maxWidth: 1300, margin: '0 auto', padding: 24, fontFamily: '"DM Sans", sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>Visitas y órdenes</h1>
          <button onClick={() => setNuevaOpen(true)} style={{ padding: '8px 16px', borderRadius: 8, background: '#7c3aed', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>+ Nueva orden de visita</button>
        </div>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 18 }}>Todas las visitas agendadas · venta y arriendo</div>

        {/* filtros */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <input style={{ ...input, minWidth: 220 }} value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar cliente, teléfono o comercial…" />
          <select style={input} value={fComercial} onChange={e => setFComercial(e.target.value)}>
            <option value="">Todos los comerciales</option>
            {OPTS_VENDEDOR.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <select style={input} value={fEstado} onChange={e => setFEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            {ESTADOS_VISITA.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select style={input} value={fOrden} onChange={e => setFOrden(e.target.value)}>
            <option value="">Cualquier orden</option>
            <option value="sin">Sin orden</option>
            <option value="borrador">Orden en borrador</option>
            <option value="firmada">Orden firmada</option>
          </select>
        </div>

        {loading ? (
          <div style={{ color: '#888' }}>Cargando…</div>
        ) : filtradas.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 12, textAlign: 'center', color: '#888', padding: 40 }}>
            No hay visitas que coincidan. Crea una con "+ Nueva orden de visita".
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#FAFAF8', borderBottom: '1px solid #E8E6E0' }}>
                  {['Fecha', 'Cliente', 'Propiedades', 'Comercial', 'Estado', 'Orden', ''].map(h => <th key={h} style={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtradas.map(v => {
                  const orden = (v.ordenes_visita || [])[0]
                  const nprops = v.visita_propiedades?.length || 0
                  return (
                    <tr key={v.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ ...td, whiteSpace: 'nowrap', fontWeight: 600 }}>{fmtFecha(v.fecha)}{v.hora ? <div style={{ fontWeight: 400, color: '#9ca3af', fontSize: 11 }}>{String(v.hora).slice(0, 5)}</div> : null}</td>
                      <td style={td}>{v.cliente_nombre || '—'}<div style={{ color: '#9ca3af', fontSize: 11 }}>{v.cliente_telefono || ''}</div></td>
                      <td style={{ ...td, color: '#555' }}>{nprops ? `${nprops} ${nprops === 1 ? 'propiedad' : 'propiedades'}` : '—'}</td>
                      <td style={{ ...td, color: '#555' }}>{v.comercial || '—'}</td>
                      <td style={td}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color: COLOR_ESTADO_VISITA[v.estado] || '#6b7280', background: '#fff', border: '1px solid ' + (COLOR_ESTADO_VISITA[v.estado] || '#ddd') }}>{v.estado}</span>
                        <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                          {v.estado !== 'realizada' && <button onClick={() => cambiarEstado(v, 'realizada')} style={{ ...mini, borderColor: '#16a34a', background: '#f0fdf4', color: '#16a34a' }}>✓</button>}
                          {v.estado !== 'cancelada' && <button onClick={() => cambiarEstado(v, 'cancelada')} style={{ ...mini, borderColor: '#d97706', background: '#fffbeb', color: '#b45309' }}>✕</button>}
                          <button onClick={() => eliminar(v)} style={{ ...mini, borderColor: '#dc2626', background: '#fef2f2', color: '#dc2626' }}>🗑</button>
                        </div>
                      </td>
                      <td style={td}>
                        {!orden ? (
                          <button onClick={() => generarOrden(v)} style={{ ...mini, borderColor: '#0C447C', background: '#E6F1FB', color: '#0C447C' }}>Generar</button>
                        ) : (
                          <>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color: orden.estado === 'firmada' ? '#16a34a' : '#b45309', background: '#fff', border: '1px solid ' + (orden.estado === 'firmada' ? '#bbf7d0' : '#fde68a') }}>N° {orden.id} · {orden.estado === 'firmada' ? 'firmada ✓' : orden.estado}</span>
                            <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                              {orden.pdf_url && <a href={orden.pdf_url} target="_blank" rel="noreferrer" style={{ ...mini, borderColor: '#E5E7EB', background: '#fff', color: '#374151' }}>PDF</a>}
                              <button onClick={() => enviarCorreo(orden)} style={{ ...mini, borderColor: '#0F6E56', background: '#E1F5EE', color: '#0F6E56' }}>Correo</button>
                              {orden.estado !== 'firmada' && <button onClick={() => copiarLink(orden)} style={{ ...mini, borderColor: '#E5E7EB', background: '#fff', color: '#374151' }}>Link</button>}
                              {orden.estado !== 'firmada' && <a href={`/firmar/${orden.token}`} target="_blank" rel="noreferrer" style={{ ...mini, borderColor: '#7c3aed', background: '#f5f3ff', color: '#7c3aed' }}>Firmar</a>}
                            </div>
                          </>
                        )}
                      </td>
                      <td style={{ ...td, whiteSpace: 'nowrap', textAlign: 'right' }}>
                        {v.requerimiento_id && <button onClick={() => router.push('/requerimientos')} style={{ ...mini, borderColor: '#185FA5', background: '#E6F1FB', color: '#185FA5' }}>Pipeline</button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {nuevaOpen && <AgendarVisitaModal onClose={() => setNuevaOpen(false)} onSaved={() => cargar()} />}
    </div>
  )
}
