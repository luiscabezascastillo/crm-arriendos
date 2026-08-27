'use client'
// VERSION: 2026-08-26 · Añadido "← Volver" (BotonVolver, history.back) — convención de retorno. Hereda versión previa.
// VERSION: v2 · 2026-08-18 · Botón "📅 Calendar" en cada recordatorio con fecha: abre Google Calendar con el evento
//   ya rellenado (día completo). El aviso "1 día antes" lo aplica el propio Google Calendar. Hereda v1.
// VERSION: v1 · 2026-08-18 · Página de RECORDATORIOS personales: cada usuario gestiona SOLO los suyos (añadir, editar,
//   marcar hecho, borrar). Alimenta el aviso del Panel. Color por persona (Luis azul · Alberto teal).
//   Solo para RECORDATORIOS_USERS. Ruta: app/procesos/recordatorios/page.js
import { useState, useEffect, useMemo } from 'react'
import BotonVolver from '../../components/ui/BotonVolver'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import TopNav from '@/app/components/ui/TopNav'

const COLORES = {
  'luis.cabezas@fondocapital.com':    { fg: '#1D4ED8', btn: '#1D4ED8', soft: '#EFF6FF', bd: '#BFDBFE' },
  'alberto.cabezas@fondocapital.com': { fg: '#0F766E', btn: '#0D9488', soft: '#F0FDFA', bd: '#99F6E4' },
}
const fmtFecha = (s) => {
  if (!s) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s)); return m ? `${m[3]}/${m[2]}/${m[1]}` : String(s)
}
// Enlace a Google Calendar (evento de día completo en la fecha del recordatorio). El aviso "1 día antes" lo
// aplica Google según tus recordatorios por defecto del calendario. Devuelve null si el recordatorio no tiene fecha.
function gcalUrl(r) {
  if (!r.fecha_venc) return null
  const p2 = (n) => String(n).padStart(2, '0')
  const ini = String(r.fecha_venc).slice(0, 10).replace(/-/g, '')          // YYYYMMDD
  const d = new Date(String(r.fecha_venc).slice(0, 10) + 'T00:00:00'); d.setDate(d.getDate() + 1)
  const fin = `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}` // fin exclusivo (día siguiente)
  const text = encodeURIComponent(r.titulo || 'Recordatorio')
  const det = encodeURIComponent((r.nota ? r.nota + '\n\n' : '') + 'Creado desde el CRM de Fondo Capital')
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${ini}/${fin}&details=${det}`
}
const badgeEstado = (e) => e === 'vencido' ? { t: 'Vencido', bg: '#FEE2E2', fg: '#B91C1C' }
  : e === 'por_vencer' ? { t: 'Por vencer', bg: '#FEF3C7', fg: '#92400E' }
  : e === 'futuro' ? { t: 'Futuro', bg: '#F1F5F9', fg: '#475569' }
  : e === 'hecho' ? { t: 'Hecho', bg: '#EAF3DE', fg: '#3B6D11' }
  : { t: 'Sin fecha', bg: '#EFF6FF', fg: '#1D4ED8' }

const VACIO = { titulo: '', fecha_venc: '', nota: '' }

export default function Recordatorios() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const email = (session?.user?.email || '').toLowerCase()
  const col = COLORES[email]
  const puedeVer = !!col

  useEffect(() => {
    if (status === 'loading') return
    if (!session) { router.replace('/panel'); return }
    if (!puedeVer) router.replace('/panel')
  }, [status, session, puedeVer]) // eslint-disable-line

  const [items, setItems] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState(VACIO)
  const [editId, setEditId] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [verHechos, setVerHechos] = useState(false)

  async function cargar() {
    setCargando(true); setError('')
    try {
      const r = await fetch('/api/recordatorios')
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Error cargando')
      setItems(d.items || [])
    } catch (e) { setError(e.message) } finally { setCargando(false) }
  }
  useEffect(() => { if (status === 'authenticated' && puedeVer) cargar() }, [status, puedeVer]) // eslint-disable-line

  async function guardar() {
    if (!form.titulo.trim()) { setError('El título es obligatorio.'); return }
    setGuardando(true); setError('')
    try {
      const body = editId
        ? { accion: 'editar', id: editId, titulo: form.titulo, fecha_venc: form.fecha_venc || null, nota: form.nota }
        : { accion: 'crear', titulo: form.titulo, fecha_venc: form.fecha_venc || null, nota: form.nota }
      const r = await fetch('/api/recordatorios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Error guardando')
      setForm(VACIO); setEditId(null); cargar()
    } catch (e) { setError(e.message) } finally { setGuardando(false) }
  }
  async function accion(id, body) {
    setError('')
    try {
      const r = await fetch('/api/recordatorios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, id }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Error')
      cargar()
    } catch (e) { setError(e.message) }
  }
  function editar(r) {
    setEditId(r.id)
    setForm({ titulo: r.titulo || '', fecha_venc: (r.fecha_venc || '').slice(0, 10), nota: r.nota || '' })
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const pendientes = useMemo(() => items.filter(r => !r.hecho), [items])
  const hechos = useMemo(() => items.filter(r => r.hecho), [items])

  if (status === 'loading' || !session || !puedeVer) {
    return (<><TopNav /><div style={{ padding: '48px 32px', color: '#6B7280', fontSize: 14 }}>
      {status === 'loading' ? 'Comprobando acceso…' : 'Acceso restringido.'}</div></>)
  }

  const inp = { padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13, color: '#111827' }
  const th = { padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6B7280', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }
  const td = { padding: '8px 12px', borderBottom: '0.5px solid #F3F4F6', verticalAlign: 'top' }
  const card = { background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, padding: '16px 20px', marginBottom: 16 }
  const mini = (bg, fg, bd) => ({ background: bg, border: `1px solid ${bd}`, color: fg, borderRadius: 6, padding: '3px 10px', fontSize: 12, cursor: 'pointer' })

  const Fila = (r) => {
    const b = badgeEstado(r.estado)
    return (
      <tr key={r.id} style={{ background: '#fff' }}>
        <td style={td}><b style={{ textDecoration: r.hecho ? 'line-through' : 'none', color: r.hecho ? '#9CA3AF' : '#111827' }}>{r.titulo}</b>
          {r.nota ? <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{r.nota}</div> : null}
        </td>
        <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtFecha(r.fecha_venc)}</td>
        <td style={td}><span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: b.bg, color: b.fg }}>{b.t}</span></td>
        <td style={{ ...td, whiteSpace: 'nowrap' }}>
          <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
            {!r.hecho
              ? <button onClick={() => accion(r.id, { accion: 'marcar', hecho: true })} style={mini('#EAF3DE', '#3B6D11', '#BBE3A0')}>✓ Hecho</button>
              : <button onClick={() => accion(r.id, { accion: 'marcar', hecho: false })} style={mini('#EEF2FF', '#3730A3', '#C7D2FE')}>↩ Reabrir</button>}
            {r.fecha_venc && <a href={gcalUrl(r)} target="_blank" rel="noopener noreferrer" title="Añadir a Google Calendar (el aviso '1 día antes' lo pone tu calendario)" style={{ ...mini('#F0FDF4', '#166534', '#BBF7D0'), textDecoration: 'none', display: 'inline-block' }}>📅 Calendar</a>}
            <button onClick={() => editar(r)} style={mini('#EFF6FF', '#1D4ED8', '#BFDBFE')}>Editar</button>
            <button onClick={() => { if (typeof window !== 'undefined' && window.confirm('¿Borrar este recordatorio?')) accion(r.id, { accion: 'borrar' }) }} style={mini('#FCEBEB', '#A32D2D', '#F3C0C0')}>Borrar</button>
          </span>
        </td>
      </tr>
    )
  }

  return (
    <>
      <TopNav />
      <BotonVolver />
      <div style={{ padding: '24px 32px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ marginBottom: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, color: col.fg }}>🔔 Mis recordatorios</h1>
          <p style={{ color: '#6B7280', fontSize: 13, marginTop: 4 }}>
            Tus alarmas personales. Solo tú las ves y las gestionas. Las pendientes salen en tu aviso del Panel.
          </p>
        </div>

        <div style={{ ...card, borderColor: col.bd, background: col.soft }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: col.fg, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{editId ? 'Editar recordatorio' : 'Nuevo recordatorio'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px', gap: 10, marginTop: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#6B7280' }}>Título *
              <input value={form.titulo} onChange={e => setForm(s => ({ ...s, titulo: e.target.value }))} placeholder="p. ej. Pagar patente / llamar a…" style={inp} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#6B7280' }}>Fecha (opcional)
              <input type="date" value={form.fecha_venc} onChange={e => setForm(s => ({ ...s, fecha_venc: e.target.value }))} style={inp} />
            </label>
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#6B7280', marginTop: 10 }}>Nota (opcional)
            <input value={form.nota} onChange={e => setForm(s => ({ ...s, nota: e.target.value }))} style={{ ...inp, width: '100%', boxSizing: 'border-box' }} />
          </label>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button onClick={guardar} disabled={guardando} style={{ background: col.btn, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
              {guardando ? 'Guardando…' : (editId ? '💾 Guardar cambios' : '＋ Añadir recordatorio')}
            </button>
            {editId && <button onClick={() => { setEditId(null); setForm(VACIO) }} style={{ background: '#fff', color: '#374151', border: '1px solid #D1D5DB', borderRadius: 8, padding: '9px 16px', fontSize: 14, cursor: 'pointer' }}>Cancelar</button>}
          </div>
        </div>

        {error && <div style={{ color: '#A32D2D', fontSize: 13, marginBottom: 10 }}>✗ {error}</div>}

        <div style={{ ...card, padding: 0 }}>
          <div style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, color: '#374151', borderBottom: '1px solid #F3F4F6' }}>Pendientes ({pendientes.length})</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: '#F9FAFB' }}>{['Recordatorio', 'Fecha', 'Estado', ''].map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {cargando ? <tr><td colSpan={4} style={{ ...td, color: '#6B7280' }}>Cargando…</td></tr>
                : pendientes.length === 0 ? <tr><td colSpan={4} style={{ ...td, color: '#6B7280' }}>Sin recordatorios pendientes. ¡Todo al día!</td></tr>
                  : pendientes.map(Fila)}
            </tbody>
          </table>
        </div>

        <div style={{ marginBottom: 16 }}>
          <button onClick={() => setVerHechos(v => !v)} style={{ background: 'none', border: 'none', color: col.fg, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
            {verHechos ? '▾' : '▸'} Hechos ({hechos.length})
          </button>
          {verHechos && (
            <div style={{ ...card, padding: 0, marginTop: 6 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: '#F9FAFB' }}>{['Recordatorio', 'Fecha', 'Estado', ''].map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
                <tbody>{hechos.length === 0 ? <tr><td colSpan={4} style={{ ...td, color: '#6B7280' }}>Nada aún.</td></tr> : hechos.map(Fila)}</tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
