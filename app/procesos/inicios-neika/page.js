'use client'
// VERSION: 2026-08-26 · Añadido "← Volver" (BotonVolver, history.back) — convención de retorno. Hereda versión previa.
// VERSION: v2 · 2026-08-18 · Renombrado a "Pagos Iniciales - Neika" (h1). Añadida leyenda "DATOS CARGADOS DE
//   ARRIENDOS REALIZADOS DESDE JUNIO 2026" en un recuadro junto al título. Quitados los placeholder "opcional"
//   de RUT y Comentarios. Hereda v1.
// VERSION: v1 · 2026-08-17 · Proceso "Inicios Neika": Neika registra los primeros pagos de cada inicio.
//   Escriben Neika + Dirección; consultan (solo ver) Adalis, Fabiola, Karina y Anthony; el resto no entra.
//   Campos: IDADMON, fecha del pago, cantidad, RUT, descripción, comentarios. Lista filtrable por IDADMON.
//   Endpoint: /api/procesos/inicios-neika. Ruta: app/procesos/inicios-neika/page.js
import { useState, useEffect, useMemo } from 'react'
import BotonVolver from '../../components/ui/BotonVolver'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import TopNav from '@/app/components/ui/TopNav'

const ROL_ALIAS = { admin: 'direccion', operaciones: 'administracion', tecnico: 'mantencion' }
const normRol = (r) => ROL_ALIAS[String(r || '').toLowerCase()] || String(r || '').toLowerCase()
const DIRECCION = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com']
const NEIKA = 'neika.duque@fondocapital.com'
const LECTORES = ['adalis@fondocapital.com', 'fabiola.guerra@fondocapital.com', 'karina.morales@fondocapital.com', 'anthony.mendoza@fondocapital.com']
const VER = [NEIKA, ...DIRECCION, ...LECTORES]

const fmtPeso = (n) => (n == null || n === '') ? '—' : '$' + Number(n).toLocaleString('es-CL')
const fmtFecha = (s) => {
  if (!s) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s)); return m ? `${m[3]}/${m[2]}/${m[1]}` : String(s)
}
const VACIO = { idadmon: '', fecha_pago: '', cantidad: '', rut: '', descripcion: '', comentarios: '' }

export default function IniciosNeika() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const email = session?.user?.email || ''
  const rol = normRol(session?.user?.role)
  const puedeVer = VER.includes(email) || rol === 'direccion'

  useEffect(() => {
    if (status === 'loading') return
    if (!session) { router.replace('/panel'); return }
    if (!puedeVer) router.replace('/procesos/mi-portal')
  }, [status, session, puedeVer]) // eslint-disable-line

  const [filas, setFilas] = useState([])
  const [puedeEscribir, setPuedeEscribir] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [filtro, setFiltro] = useState('')
  const [form, setForm] = useState(VACIO)
  const [guardando, setGuardando] = useState(false)
  const [editId, setEditId] = useState(null)      // id en edición (o null = alta)
  const [borrarId, setBorrarId] = useState(null)   // confirmación de borrado

  async function cargar() {
    setCargando(true); setError('')
    try {
      const res = await fetch('/api/procesos/inicios-neika')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error cargando')
      setFilas(data.filas || []); setPuedeEscribir(!!data.puedeEscribir)
    } catch (e) { setError(e.message) } finally { setCargando(false) }
  }
  useEffect(() => { if (status === 'authenticated' && puedeVer) cargar() }, [status, puedeVer]) // eslint-disable-line

  async function guardar() {
    if (!form.idadmon.trim()) { setError('El IDADMON es obligatorio.'); return }
    setGuardando(true); setError('')
    try {
      const res = await fetch('/api/procesos/inicios-neika', {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editId ? { ...form, id: editId } : form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error guardando')
      setForm(VACIO); setEditId(null); cargar()
    } catch (e) { setError(e.message) } finally { setGuardando(false) }
  }

  async function borrar(id) {
    setError('')
    try {
      const res = await fetch(`/api/procesos/inicios-neika?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error borrando')
      setBorrarId(null); cargar()
    } catch (e) { setError(e.message) }
  }

  function editar(f) {
    setEditId(f.id)
    setForm({ idadmon: f.idadmon || '', fecha_pago: (f.fecha_pago || '').slice(0, 10), cantidad: f.cantidad ?? '',
              rut: f.rut || '', descripcion: f.descripcion || '', comentarios: f.comentarios || '' })
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const vista = useMemo(() => {
    const q = filtro.trim().toLowerCase()
    if (!q) return filas
    return filas.filter(f =>
      (f.idadmon || '').toLowerCase().includes(q) || (f.rut || '').toLowerCase().includes(q) ||
      (f.descripcion || '').toLowerCase().includes(q) || (f.comentarios || '').toLowerCase().includes(q))
  }, [filas, filtro])
  const total = useMemo(() => vista.reduce((s, f) => s + (Number(f.cantidad) || 0), 0), [vista])

  if (status === 'loading' || !session || !puedeVer) {
    return (<><TopNav /><div style={{ padding: '48px 32px', color: '#6B7280', fontSize: 14 }}>
      {status === 'loading' ? 'Comprobando acceso…' : 'Acceso restringido.'}</div></>)
  }

  return (
    <>
      <TopNav />
      <BotonVolver />
      <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 6 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Pagos Iniciales - Neika</h1>
            <p style={{ color: '#6B7280', fontSize: 13, marginTop: 4 }}>
              Registro de los primeros pagos de cada inicio. {puedeEscribir ? 'Puedes añadir, editar y borrar.' : 'Solo consulta.'}
            </p>
          </div>
          <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, color: '#92400E', textAlign: 'center', lineHeight: 1.35, whiteSpace: 'nowrap' }}>
            DATOS CARGADOS DE ARRIENDOS<br />REALIZADOS DESDE JUNIO 2026
          </div>
        </div>

        {puedeEscribir && (
          <div style={card}>
            <div style={stepLabel}>{editId ? 'Editar pago' : 'Registrar pago'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 130px 130px 130px 1fr', gap: 10, marginTop: 12 }}>
              <label style={lbl}>IDADMON *
                <input value={form.idadmon} onChange={e => setForm(s => ({ ...s, idadmon: e.target.value }))} placeholder="A00123" style={inp} />
              </label>
              <label style={lbl}>Fecha del pago
                <input type="date" value={form.fecha_pago} onChange={e => setForm(s => ({ ...s, fecha_pago: e.target.value }))} style={inp} />
              </label>
              <label style={lbl}>Cantidad
                <input value={form.cantidad} onChange={e => setForm(s => ({ ...s, cantidad: e.target.value }))} placeholder="0" style={{ ...inp, textAlign: 'right' }} />
              </label>
              <label style={lbl}>RUT
                <input value={form.rut} onChange={e => setForm(s => ({ ...s, rut: e.target.value }))} style={inp} />
              </label>
              <label style={lbl}>Descripción del pago
                <input value={form.descripcion} onChange={e => setForm(s => ({ ...s, descripcion: e.target.value }))} placeholder="p. ej. garantía + primer mes" style={inp} />
              </label>
            </div>
            <label style={{ ...lbl, marginTop: 10, display: 'block' }}>Comentarios
              <input value={form.comentarios} onChange={e => setForm(s => ({ ...s, comentarios: e.target.value }))} style={{ ...inp, width: '100%', boxSizing: 'border-box' }} />
            </label>
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button onClick={guardar} disabled={guardando} style={btnPrimary}>{guardando ? 'Guardando…' : (editId ? '💾 Guardar cambios' : '＋ Registrar pago')}</button>
              {editId && <button onClick={() => { setEditId(null); setForm(VACIO) }} disabled={guardando} style={btnSecondary}>Cancelar</button>}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0 12px' }}>
          <input placeholder="Filtrar por IDADMON, RUT, descripción…" value={filtro} onChange={e => setFiltro(e.target.value)}
            style={{ ...inp, width: 320 }} />
          <span style={{ fontSize: 13, color: '#6B7280' }}>{vista.length} pago(s) · total {fmtPeso(total)}</span>
        </div>

        {error && <div style={{ color: '#A32D2D', fontSize: 13, marginBottom: 10 }}>✗ {error}</div>}

        <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F3F4F6' }}>
                {['IDADMON', 'Fecha pago', 'Cantidad', 'RUT', 'Descripción', 'Comentarios', 'Registró', puedeEscribir ? '' : null].filter(h => h !== null).map((h, i) => (
                  <th key={i} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr><td colSpan={8} style={{ ...td, color: '#6B7280' }}>Cargando…</td></tr>
              ) : vista.length === 0 ? (
                <tr><td colSpan={8} style={{ ...td, color: '#6B7280' }}>Sin pagos registrados{filtro ? ' para ese filtro' : ''}.</td></tr>
              ) : vista.map((f, i) => (
                <tr key={f.id} style={{ background: i % 2 ? '#F9FAFB' : '#fff' }}>
                  <td style={td}><b>{f.idadmon}</b></td>
                  <td style={td}>{fmtFecha(f.fecha_pago)}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 500 }}>{fmtPeso(f.cantidad)}</td>
                  <td style={td}>{f.rut || '—'}</td>
                  <td style={td}>{f.descripcion || '—'}</td>
                  <td style={{ ...td, color: '#6B7280' }}>{f.comentarios || ''}</td>
                  <td style={{ ...td, color: '#9CA3AF', fontSize: 11 }}>{(f.creado_por || '').split('@')[0]}</td>
                  {puedeEscribir && (
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      {borrarId === f.id ? (
                        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ fontSize: 12, color: '#A32D2D' }}>¿Borrar?</span>
                          <button onClick={() => borrar(f.id)} style={miniDanger}>Sí</button>
                          <button onClick={() => setBorrarId(null)} style={mini}>No</button>
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', gap: 6 }}>
                          <button onClick={() => editar(f)} style={mini}>Editar</button>
                          <button onClick={() => setBorrarId(f.id)} style={miniDanger}>Borrar</button>
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

const card = { background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, padding: '16px 20px', marginBottom: 16 }
const stepLabel = { fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }
const lbl = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#6B7280' }
const inp = { padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13, color: '#111827' }
const btnPrimary = { background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 500, cursor: 'pointer' }
const btnSecondary = { background: '#fff', color: '#374151', border: '1px solid #D1D5DB', borderRadius: 8, padding: '9px 16px', fontSize: 14, cursor: 'pointer' }
const th = { padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6B7280', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }
const td = { padding: '8px 12px', borderBottom: '0.5px solid #F3F4F6' }
const mini = { background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8', borderRadius: 6, padding: '3px 10px', fontSize: 12, cursor: 'pointer' }
const miniDanger = { background: '#FCEBEB', border: '1px solid #F3C0C0', color: '#A32D2D', borderRadius: 6, padding: '3px 10px', fontSize: 12, cursor: 'pointer' }
