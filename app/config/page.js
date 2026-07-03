'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import TopNav from '@/app/components/ui/TopNav'

const DIRECCION_EMAILS = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']

// Catálogo de procesos (mismas keys/títulos que /procesos). Fuente: app/procesos/page.js
const PROCESOS = [
  { key: 'publicacion', titulo: 'Publicación', depto: 'Ventas' },
  { key: 'inicios', titulo: 'Inicios', depto: 'Ventas' },
  { key: 'servicios', titulo: 'Servicios', depto: 'Administración' },
  { key: 'descuentos', titulo: 'Descuentos', depto: 'Administración' },
  { key: 'cobranza', titulo: 'Cobranza', depto: 'Administración' },
  { key: 'notificaciones', titulo: 'Notificaciones', depto: 'Administración' },
  { key: 'liquidacion_paola', titulo: 'Liquidación Paola', depto: 'Administración' },
  { key: 'incidencia', titulo: 'Incidencia', depto: 'Mantención' },
  { key: 'presupuestos', titulo: 'Presupuestos', depto: 'Mantención' },
  { key: 'revision_log', titulo: 'Gestión LOG', depto: 'Legal' },
  { key: 'contratos', titulo: 'Contratos', depto: 'Legal' },
  { key: 'valoraciones', titulo: 'Valoraciones', depto: 'Legal' },
  { key: 'dicom', titulo: 'DICOM', depto: 'Legal' },
  { key: 'termino', titulo: 'Término', depto: 'Finanzas' },
  { key: 'liquidacion', titulo: 'Liquidación/APPVISION', depto: 'Finanzas' },
  { key: 'cartolas', titulo: 'Cartolas', depto: 'Finanzas' },
  { key: 'mandato', titulo: 'Mandato', depto: 'Finanzas' },
  { key: 'nubox', titulo: 'Financiero', depto: 'Finanzas' },
  { key: 'bi_sa', titulo: 'BI', depto: 'Finanzas' },
]

const ROLES = ['observador', 'colaborador', 'supervisor', 'responsable']
const ROL_COLOR = {
  responsable: { bg: '#DCFCE7', c: '#166534' },
  supervisor: { bg: '#FEF3C7', c: '#92400E' },
  colaborador: { bg: '#DBEAFE', c: '#1E40AF' },
  observador: { bg: '#F1F5F9', c: '#475569' },
}

export default function ConfigPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const email = session?.user?.email
  const rol = session?.user?.role
  const esDireccion = ['admin', 'direccion'].includes(rol) || DIRECCION_EMAILS.includes(email)

  const [tab, setTab] = useState('permisos')
  const [personas, setPersonas] = useState([])
  const [sel, setSel] = useState('')          // email de la persona seleccionada
  const [permisos, setPermisos] = useState({}) // proceso -> rol
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState('') // proceso que se está guardando
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    if (status === 'authenticated' && !esDireccion) router.replace('/')
  }, [status, esDireccion, router])

  // Cargar personas (crm_users activos)
  useEffect(() => {
    if (!esDireccion) return
    supabase.from('crm_users').select('email, nombre, rol, activo').order('nombre')
      .then(({ data }) => setPersonas((data || []).filter(p => p.activo !== false)))
  }, [esDireccion])

  // Cargar permisos de la persona seleccionada
  useEffect(() => {
    if (!sel) { setPermisos({}); return }
    setCargando(true)
    supabase.from('proceso_permisos').select('proceso, rol, activo').eq('email', sel).eq('activo', true)
      .then(({ data }) => {
        const m = {}
        for (const r of data || []) m[r.proceso] = r.rol
        setPermisos(m); setCargando(false)
      })
  }, [sel])

  async function cambiarRol(proceso, nuevoRol) {
    setGuardando(proceso); setMsg(null)
    try {
      const res = await fetch('/api/config/permisos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: sel, proceso, rol: nuevoRol || null }),
      })
      const data = await res.json()
      if (!res.ok) { setMsg({ tipo: 'error', txt: data.error || 'Error al guardar' }); setGuardando(''); return }
      setPermisos(prev => {
        const n = { ...prev }
        if (nuevoRol) n[proceso] = nuevoRol; else delete n[proceso]
        return n
      })
      setMsg({ tipo: 'ok', txt: 'Guardado' })
    } catch (e) { setMsg({ tipo: 'error', txt: e.message }) }
    setGuardando('')
  }

  if (status === 'loading') return (<><TopNav /><div style={{ padding: 40, color: '#888' }}>Cargando…</div></>)
  if (!esDireccion) return null

  const persona = personas.find(p => p.email === sel)
  const TABS = [
    { id: 'permisos', label: 'Permisos de procesos' },
    { id: 'usuarios', label: 'Usuarios · pronto', soon: true },
    { id: 'general', label: 'General · pronto', soon: true },
  ]

  return (
    <>
      <TopNav />
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24, fontFamily: '"DM Sans", sans-serif' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', margin: '0 0 4px' }}>Configuración</h1>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 18 }}>Panel de Dirección · ajustes del CRM.</div>

        {/* Pestañas */}
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #E5E7EB', marginBottom: 20 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => !t.soon && setTab(t.id)} disabled={t.soon}
              style={{
                fontSize: 13, fontWeight: 600, padding: '9px 16px', border: 'none', cursor: t.soon ? 'default' : 'pointer',
                background: 'transparent', color: t.soon ? '#C4C4BD' : (tab === t.id ? '#1D9E75' : '#6B7280'),
                borderBottom: tab === t.id ? '2px solid #1D9E75' : '2px solid transparent', marginBottom: -1,
              }}>{t.label}</button>
          ))}
        </div>

        {tab === 'permisos' && (
          <div>
            <div style={{ fontSize: 13, color: '#555', marginBottom: 14 }}>
              Elige una persona y define su rol en cada proceso. <b>Observador</b> = solo ver; el resto participan/gestionan.
              Quitar el acceso conserva el histórico (se desactiva).
            </div>

            {/* Selector de persona */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
              <label style={{ fontSize: 13, color: '#666' }}>Persona:</label>
              <select value={sel} onChange={e => setSel(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 14, minWidth: 280 }}>
                <option value="">— elige una persona —</option>
                {personas.map(p => <option key={p.email} value={p.email}>{p.nombre || p.email} ({p.email})</option>)}
              </select>
              {persona && <span style={{ fontSize: 12, color: '#888' }}>Departamento (vista): <b>{persona.rol || '—'}</b></span>}
              {msg && <span style={{ fontSize: 12, fontWeight: 600, color: msg.tipo === 'ok' ? '#166534' : '#B91C1C' }}>{msg.txt}</span>}
            </div>

            {!sel && <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13, background: '#FAFAF8', borderRadius: 10 }}>Selecciona una persona para ver y editar sus permisos.</div>}

            {sel && cargando && <div style={{ color: '#888', padding: 16 }}>Cargando permisos…</div>}

            {sel && !cargando && (
              <div style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1.2fr', gap: 8, padding: '10px 16px', background: '#FAFAF8', borderBottom: '1px solid #E8E6E0', fontSize: 12, color: '#888', fontWeight: 700 }}>
                  <div>Proceso</div><div>Departamento</div><div>Rol de esta persona</div>
                </div>
                {PROCESOS.map((p, i) => {
                  const actual = permisos[p.key] || ''
                  const col = ROL_COLOR[actual]
                  return (
                    <div key={p.key} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1.2fr', gap: 8, padding: '9px 16px', borderTop: i ? '1px solid #F0EEE8' : 'none', alignItems: 'center', fontSize: 13 }}>
                      <div style={{ fontWeight: 600, color: '#2C2C2A' }}>{p.titulo} <span style={{ color: '#B4B2A9', fontWeight: 400, fontSize: 11 }}>· {p.key}</span></div>
                      <div style={{ color: '#6B7280', fontSize: 12 }}>{p.depto}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <select value={actual} onChange={e => cambiarRol(p.key, e.target.value)} disabled={guardando === p.key}
                          style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid #E5E7EB', fontSize: 13, background: col ? col.bg : '#fff', color: col ? col.c : '#374151', fontWeight: actual ? 600 : 400 }}>
                          <option value="">— sin acceso —</option>
                          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        {guardando === p.key && <span style={{ fontSize: 11, color: '#888' }}>guardando…</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}