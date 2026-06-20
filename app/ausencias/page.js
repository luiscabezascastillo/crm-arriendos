'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'
// Acceso: Dirección + Karina (RRHH)
const ACCESO_EMAILS = [
  'alberto.cabezas@fondocapital.com',
  'luis.cabezas@fondocapital.com',
  'karina.morales@fondocapital.com',
]

const TIPOS = [
  { value: 'VACACIONES', label: 'Vacaciones' },
  { value: 'LICENCIA',   label: 'Licencia médica' },
  { value: 'PERMISO',    label: 'Permiso' },
]

const COLOR_TIPO = {
  VACACIONES: { bg: '#eff6ff', color: '#1a56db' },
  LICENCIA:   { bg: '#fef2f2', color: '#dc2626' },
  PERMISO:    { bg: '#fffbeb', color: '#d97706' },
}

export default function AusenciasPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [trabajadores, setTrabajadores] = useState([])
  const [ausencias, setAusencias] = useState([])
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)

  const [form, setForm] = useState({
    trabajador_id: '',
    tipo: 'VACACIONES',
    fecha_inicio: '',
    fecha_fin: '',
    motivo: '',
    recuperable: false,
  })

  // Permisos
  useEffect(() => {
    if (status === 'loading') return
    if (!session || !ACCESO_EMAILS.includes(session.user?.email)) {
      router.push('/panel')
    }
  }, [session, status, router])

  // Cargar trabajadores activos + ausencias
  useEffect(() => {
    if (!session) return
    cargarTodo()
  }, [session])

  async function cargarTodo() {
    setLoading(true)
    const { data: trab } = await supabase
      .from('control_asistencia_trabajadores')
      .select('id, nombre_real, email')
      .eq('activo', true)
      .order('nombre_real')
    setTrabajadores(trab || [])

    try {
      const res = await fetch('/api/control-asistencia/ausencias')
      const data = await res.json()
      if (data.ausencias) setAusencias(data.ausencias)
    } catch (e) {
      // silencioso
    }
    setLoading(false)
  }

  async function guardar() {
    if (!form.trabajador_id || !form.fecha_inicio || !form.fecha_fin) {
      setMsg({ ok: false, text: 'Completa trabajador y fechas' }); return
    }
    if (form.fecha_fin < form.fecha_inicio) {
      setMsg({ ok: false, text: 'La fecha fin no puede ser anterior a la de inicio' }); return
    }
    setGuardando(true)
    setMsg(null)
    try {
      const res = await fetch('/api/control-asistencia/ausencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trabajador_id: Number(form.trabajador_id),
          tipo: form.tipo,
          fecha_inicio: form.fecha_inicio,
          fecha_fin: form.fecha_fin,
          motivo: form.motivo,
          recuperable: form.recuperable,
          created_by: session.user?.email,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al guardar')
      setMsg({ ok: true, text: `✓ Ausencia guardada (${data.dias_habiles} días hábiles)` })
      setForm({ trabajador_id: '', tipo: 'VACACIONES', fecha_inicio: '', fecha_fin: '', motivo: '', recuperable: false })
      await cargarTodo()
    } catch (e) {
      setMsg({ ok: false, text: 'Error: ' + e.message })
    }
    setGuardando(false)
  }

  async function eliminar(id) {
    if (!window.confirm('¿Eliminar esta ausencia?')) return
    try {
      const res = await fetch(`/api/control-asistencia/ausencias?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al eliminar')
      await cargarTodo()
    } catch (e) {
      setMsg({ ok: false, text: 'Error al eliminar: ' + e.message })
    }
  }

  function fmtFecha(f) {
    if (!f) return ''
    const [y, m, d] = f.split('-')
    return `${d}/${m}/${y}`
  }

  if (status === 'loading' || !session) return null
  if (!ACCESO_EMAILS.includes(session.user?.email)) return null

  const inputStyle = {
    width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)',
    fontSize: 13, fontFamily: 'inherit', background: 'var(--surface)', boxSizing: 'border-box',
  }
  const labelStyle = { fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 4, display: 'block' }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--gray-800)', margin: 0 }}>Gestión de ausencias</h1>
        <div style={{ fontSize: 13, color: 'var(--gray-400)', marginTop: 4 }}>
          Vacaciones, licencias médicas y permisos del personal
        </div>
      </div>

      {/* Formulario */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px', marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-700)', marginBottom: 14 }}>+ Nueva ausencia</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.2fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Trabajador</label>
            <select style={inputStyle} value={form.trabajador_id} onChange={e => setForm({ ...form, trabajador_id: e.target.value })}>
              <option value="">Selecciona…</option>
              {trabajadores.map(t => <option key={t.id} value={t.id}>{t.nombre_real}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Tipo</label>
            <select style={inputStyle} value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
              {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Desde</label>
            <input type="date" style={inputStyle} value={form.fecha_inicio} onChange={e => setForm({ ...form, fecha_inicio: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Hasta</label>
            <input type="date" style={inputStyle} value={form.fecha_fin} onChange={e => setForm({ ...form, fecha_fin: e.target.value })} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--gray-600)', whiteSpace: 'nowrap', cursor: 'pointer', paddingBottom: 8 }}>
            <input type="checkbox" checked={form.recuperable} onChange={e => setForm({ ...form, recuperable: e.target.checked })} />
            Recuperable
          </label>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Motivo (opcional)</label>
            <input type="text" style={inputStyle} value={form.motivo} onChange={e => setForm({ ...form, motivo: e.target.value })} placeholder="Observaciones…" />
          </div>
          <button onClick={guardar} disabled={guardando}
            style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: guardando ? '#9ca3af' : '#16a34a', color: '#fff', fontSize: 13, fontWeight: 600, cursor: guardando ? 'not-allowed' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
        {msg && (
          <div style={{ marginTop: 12, fontSize: 12, fontWeight: 500, color: msg.ok ? '#16a34a' : '#dc2626' }}>{msg.text}</div>
        )}
      </div>

      {/* Listado */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--gray-700)' }}>
          Ausencias registradas {ausencias.length > 0 && `(${ausencias.length})`}
        </div>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>Cargando…</div>
        ) : ausencias.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>No hay ausencias registradas</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--gray-50)' }}>
                {['Trabajador', 'Tipo', 'Desde', 'Hasta', 'Días hábiles', 'Motivo', ''].map((h, i) => (
                  <th key={i} style={{ textAlign: i === 4 ? 'center' : 'left', padding: '8px 14px', fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ausencias.map(a => {
                const ct = COLOR_TIPO[a.tipo] || { bg: '#f3f4f6', color: '#6b7280' }
                const nombre = a.control_asistencia_trabajadores?.nombre_real || `#${a.trabajador_id}`
                return (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '9px 14px', fontSize: 13, fontWeight: 500, color: 'var(--gray-800)' }}>{nombre}</td>
                    <td style={{ padding: '9px 14px' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 6, background: ct.bg, color: ct.color }}>
                        {a.tipo}{a.recuperable ? ' ↻' : ''}
                      </span>
                    </td>
                    <td style={{ padding: '9px 14px', fontSize: 13, color: 'var(--gray-600)' }}>{fmtFecha(a.fecha_inicio)}</td>
                    <td style={{ padding: '9px 14px', fontSize: 13, color: 'var(--gray-600)' }}>{fmtFecha(a.fecha_fin)}</td>
                    <td style={{ padding: '9px 14px', fontSize: 13, color: 'var(--gray-700)', textAlign: 'center', fontWeight: 600 }}>{a.dias_habiles ?? '—'}</td>
                    <td style={{ padding: '9px 14px', fontSize: 12, color: 'var(--gray-400)' }}>{a.motivo || '—'}</td>
                    <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                      <button onClick={() => eliminar(a.id)}
                        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #dc2626', background: '#fef2f2', color: '#dc2626', fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}