'use client'
import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'
import TopNav from '../components/ui/TopNav'

const DIRECCION_EMAILS = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export default function CumpleanosPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const email = session?.user?.email
  const rol = session?.user?.role
  const esAdmin = rol === 'admin' || DIRECCION_EMAILS.includes(email)

  const [contactos, setContactos] = useState([])
  const [loading, setLoading] = useState(true)
  const hoy = new Date()
  const [mes, setMes] = useState(hoy.getMonth())          // 0-index
  const [fRol, setFRol] = useState('')
  const [busca, setBusca] = useState('')
  const [enviando, setEnviando] = useState({})

  useEffect(() => { if (status === 'authenticated' && !esAdmin) router.replace('/') }, [status, esAdmin, router])
  useEffect(() => { if (esAdmin) cargar() }, [esAdmin])

  async function cargar() {
    setLoading(true)
    const [cont, eq] = await Promise.all([
      supabase
        .from('contactos')
        .select('id, nombre, apellido, roles, email, telefono, whatsapp, fecha_nacimiento, comercial_asignado, activo')
        .not('fecha_nacimiento', 'is', null),
      supabase
        .from('crm_users')
        .select('id, nombre, email, rol, activo, fecha_nacimiento')
        .not('fecha_nacimiento', 'is', null),
    ])
    const contactos = (cont.data || []).map(c => ({ ...c, _src: 'contacto' }))
    const equipo = (eq.data || [])
      .filter(u => u.activo !== false)
      .map(u => ({
        id: u.id, nombre: u.nombre, apellido: '',
        roles: ['equipo'], _rolTexto: u.rol,
        email: u.email, telefono: null, whatsapp: null,
        fecha_nacimiento: u.fecha_nacimiento, _src: 'equipo',
      }))
    setContactos([...contactos, ...equipo])
    setLoading(false)
  }

  async function saludarCorreo(c) {
    if (!window.confirm(`¿Enviar saludo de cumpleaños a ${c.nombre || 'este contacto'}?`)) return
    setEnviando(e => ({ ...e, [c.id]: true }))
    const r = await fetch('/api/cumpleanos/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contacto_id: c.id, tipo: c._src }) })
    const j = await r.json().catch(() => ({}))
    setEnviando(e => ({ ...e, [c.id]: false }))
    if (r.ok) alert(j.prueba ? `Enviado en MODO PRUEBA a tu correo.\nDestino real: ${j.destino_real || '(sin email)'}` : `Saludo enviado a ${j.to}`)
    else alert(j.error || 'No se pudo enviar el saludo.')
  }

  // roles presentes en los datos (para el filtro)
  const rolesDisponibles = useMemo(() => {
    const set = new Set()
    contactos.forEach(c => (c.roles || []).forEach(r => r && set.add(r)))
    return Array.from(set).sort()
  }, [contactos])

  // contactos del mes elegido, con dia/edad calculados
  const delMes = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return contactos
      .map(c => {
        const [y, m, d] = String(c.fecha_nacimiento).split('-').map(Number)
        return { ...c, _y: y, _m: m - 1, _d: d }
      })
      .filter(c => c._m === mes)
      .filter(c => !fRol || (c.roles || []).includes(fRol))
      .filter(c => {
        if (!q) return true
        return [c.nombre, c.apellido].filter(Boolean).join(' ').toLowerCase().includes(q)
      })
      .sort((a, b) => a._d - b._d)
  }, [contactos, mes, fRol, busca])

  const esHoy = c => c._m === hoy.getMonth() && c._d === hoy.getDate()
  const edadQueCumple = c => {
    const anioRef = hoy.getFullYear()
    if (!c._y || c._y < 1900 || c._y > anioRef) return null
    return anioRef - c._y
  }
  const waLink = (c) => {
    const num = String(c.whatsapp || c.telefono || '').replace(/[^0-9]/g, '')
    if (!num) return null
    const txt = encodeURIComponent(`¡Feliz cumpleaños, ${(c.nombre || '').split(' ')[0]}! Te deseamos un gran día. — Equipo Fondo Capital Rent`)
    return `https://wa.me/${num}?text=${txt}`
  }

  if (status === 'loading') return <div style={{ minHeight: '100vh' }}><TopNav /><div style={{ padding: 40, color: '#888' }}>Cargando…</div></div>
  if (status === 'authenticated' && !esAdmin) return null

  const input = { padding: '8px 10px', borderRadius: 7, border: '1px solid #E5E7EB', fontSize: 13, fontFamily: 'inherit', background: '#fff' }
  const navBtn = { padding: '6px 11px', borderRadius: 7, border: '1px solid #E5E7EB', background: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: '#374151' }
  const mini = { fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid', textDecoration: 'none', display: 'inline-block' }

  const hoyDelMes = delMes.filter(esHoy)

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF8' }}>
      <TopNav />
      <div style={{ maxWidth: 920, margin: '0 auto', padding: 24, fontFamily: '"DM Sans", sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>🎂 Cumpleaños</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button style={navBtn} onClick={() => setMes(m => (m + 11) % 12)}>‹</button>
            <div style={{ minWidth: 110, textAlign: 'center', fontSize: 14, fontWeight: 600, color: '#1a1a2e', textTransform: 'capitalize' }}>{MESES[mes]}</div>
            <button style={navBtn} onClick={() => setMes(m => (m + 1) % 12)}>›</button>
            <button style={{ ...navBtn, color: '#7c3aed', borderColor: '#d8b4fe' }} onClick={() => setMes(hoy.getMonth())}>Este mes</button>
          </div>
        </div>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 18 }}>Contactos que cumplen años · de cualquier rol</div>

        {/* filtros */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <input style={{ ...input, minWidth: 220 }} value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nombre…" />
          <select style={input} value={fRol} onChange={e => setFRol(e.target.value)}>
            <option value="">Todos los roles</option>
            {rolesDisponibles.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {/* cumplen hoy (si el mes es el actual) */}
        {mes === hoy.getMonth() && hoyDelMes.length > 0 && (
          <div style={{ background: '#F5F3FF', border: '1px solid #d8b4fe', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>🎉 Cumplen hoy</div>
            <div style={{ fontSize: 13, color: '#5b21b6' }}>{hoyDelMes.map(c => [c.nombre, c.apellido].filter(Boolean).join(' ')).join(' · ')}</div>
          </div>
        )}

        {loading ? <div style={{ color: '#888' }}>Cargando…</div>
          : delMes.length === 0 ? (
            <div style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 12, textAlign: 'center', color: '#888', padding: 40 }}>
              Nadie cumple años en {MESES[mes]}{fRol ? ` con el rol "${fRol}"` : ''}{busca ? ` que coincida con "${busca}"` : ''}.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {delMes.map(c => {
                const nombre = [c.nombre, c.apellido].filter(Boolean).join(' ') || 'Contacto'
                const edad = edadQueCumple(c)
                const hoyEs = esHoy(c)
                const wa = waLink(c)
                return (
                  <div key={c.id} style={{ background: '#fff', border: '1px solid ' + (hoyEs ? '#d8b4fe' : '#E8E6E0'), boxShadow: hoyEs ? '0 0 0 2px #ede9fe' : 'none', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: hoyEs ? '#7c3aed' : '#EDE9FE', color: hoyEs ? '#fff' : '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
                      {(c.nombre || '?').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a2e' }}>
                        {nombre}
                        {c._src === 'equipo' && <span style={{ fontSize: 10, fontWeight: 700, color: '#0369a1', background: '#e0f2fe', border: '1px solid #7dd3fc', borderRadius: 20, padding: '2px 8px', marginLeft: 8 }}>Equipo</span>}
                        {hoyEs && <span style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', background: '#F5F3FF', border: '1px solid #d8b4fe', borderRadius: 20, padding: '2px 8px', marginLeft: 8 }}>¡HOY!</span>}
                      </div>
                      <div style={{ fontSize: 12, color: '#777', marginTop: 2 }}>
                        {c._d} de {MESES[c._m]}{edad != null ? ` · cumple ${edad}` : ''}
                        {(c.roles || []).length > 0 && <span> · {(c.roles || []).join(', ')}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {(c.email || '') && <button onClick={() => saludarCorreo(c)} disabled={enviando[c.id]} style={{ ...mini, borderColor: '#0F6E56', background: '#E1F5EE', color: '#0F6E56', opacity: enviando[c.id] ? 0.6 : 1 }}>{enviando[c.id] ? 'Enviando…' : 'Saludar por correo'}</button>}
                      {wa && <a href={wa} target="_blank" rel="noreferrer" style={{ ...mini, borderColor: '#16a34a', background: '#f0fdf4', color: '#16a34a' }}>WhatsApp</a>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
      </div>
    </div>
  )
}
