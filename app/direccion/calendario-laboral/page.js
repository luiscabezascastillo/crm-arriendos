'use client'
// VERSION: v2 · 2026-08-31 · Muestra FinancieroNav (activo=ausencias) tras TopNav cuando viene del módulo financiero (?fin=1), como el resto del personal. Hereda v1.
// VERSION: v1 · 2026-08-31 · Calendario laboral (3ª pestaña de Control del personal): ver/editar por día es_habil,
//   horas_esperadas y motivo (feriados y días extra de la empresa). GET/POST a /api/control-asistencia/calendario.
import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import PersonalNav from '../../components/ui/PersonalNav'
import TopNav from '@/app/components/ui/TopNav'
import FinancieroNav from '@/app/components/ui/FinancieroNav'

const ACCESO_EMAILS = [
  'alberto.cabezas@fondocapital.com',
  'luis.cabezas@fondocapital.com',
  'karina.morales@fondocapital.com',
]
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DIAS_SEM = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const ANIOS = [2026, 2027]

export default function CalendarioLaboralPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [fin, setFin] = useState(false)
  useEffect(() => { setFin(new URLSearchParams(window.location.search).get('fin') === '1') }, [])

  const [anio, setAnio] = useState(2026)
  const [mes, setMes] = useState(() => new Date().getMonth())
  const [dias, setDias] = useState({})
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState(null)
  const [form, setForm] = useState({ es_habil: true, horas_esperadas: 8.5, motivo: '' })
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    if (status === 'loading') return
    if (!session || !ACCESO_EMAILS.includes(session.user?.email)) router.push('/panel')
  }, [session, status, router])

  const cargar = async (a) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/control-asistencia/calendario?anio=${a}`)
      const d = await res.json()
      const map = {}
      for (const r of (d.calendario || [])) map[String(r.fecha).slice(0, 10)] = r
      setDias(map)
    } catch (e) { /* silencioso */ }
    setLoading(false)
  }
  useEffect(() => { if (session) cargar(anio) }, [session, anio])   // eslint-disable-line

  const festivos = useMemo(
    () => Object.values(dias).filter(d => !d.es_habil && d.motivo).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))),
    [dias]
  )

  const celdas = useMemo(() => {
    const first = new Date(anio, mes, 1)
    const startDow = (first.getDay() + 6) % 7
    const nDias = new Date(anio, mes + 1, 0).getDate()
    const arr = []
    for (let i = 0; i < startDow; i++) arr.push(null)
    for (let d = 1; d <= nDias; d++) arr.push(`${anio}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
    return arr
  }, [anio, mes])

  function abrir(fecha) {
    if (!fecha) return
    const d = dias[fecha]
    setForm({ es_habil: d ? !!d.es_habil : true, horas_esperadas: d ? (Number(d.horas_esperadas) || 0) : 8.5, motivo: (d && d.motivo) || '' })
    setSel(fecha); setMsg(null)
  }

  async function guardar() {
    if (!sel) return
    setGuardando(true); setMsg(null)
    try {
      const res = await fetch('/api/control-asistencia/calendario', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha: sel,
          es_habil: form.es_habil,
          horas_esperadas: form.es_habil ? (Number(form.horas_esperadas) || 0) : 0,
          motivo: form.motivo,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Error al guardar')
      await cargar(anio)
      setSel(null)
      setMsg({ ok: true, text: '✓ Día guardado' })
    } catch (e) { setMsg({ ok: false, text: 'Error: ' + e.message }) }
    setGuardando(false)
  }

  const fmtDMA = (f) => { const [y, m, d] = String(f).slice(0, 10).split('-'); return `${d}/${m}/${y}` }

  if (status === 'loading') return (<><TopNav /><div style={{ padding: 40, color: '#888' }}>Cargando…</div></>)

  return (
    <>
      <TopNav />
      {fin && <FinancieroNav activo="ausencias" />}
      <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
        <PersonalNav activo="calendario" fin={fin} />

        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 2px', color: '#2C2C2A' }}>Calendario laboral</h1>
        <div style={{ fontSize: 13, color: '#999', marginBottom: 16, maxWidth: 720 }}>
          Días hábiles y festivos del personal. De aquí salen los días que descuentan las vacaciones y la teórica de asistencia.
          Marca un día como festivo (feriado o día extra que regale la empresa) para que no cuente como laborable.
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <select value={anio} onChange={e => setAnio(Number(e.target.value))} style={ctrl}>
            {ANIOS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <button onClick={() => setMes(m => (m + 11) % 12)} style={btnNav}>←</button>
          <select value={mes} onChange={e => setMes(Number(e.target.value))} style={ctrl}>
            {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <button onClick={() => setMes(m => (m + 1) % 12)} style={btnNav}>→</button>
          {loading && <span style={{ fontSize: 12, color: '#aaa' }}>cargando…</span>}
          {msg && <span style={{ fontSize: 12, color: msg.ok ? '#0a7f4f' : '#B23A3A' }}>{msg.text}</span>}
        </div>

        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 560px', minWidth: 320 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
              {DIAS_SEM.map(d => <div key={d} style={{ fontSize: 11, fontWeight: 700, color: '#8a8a8a', textAlign: 'center', padding: '2px 0' }}>{d}</div>)}
              {celdas.map((fecha, i) => {
                if (!fecha) return <div key={'x' + i} />
                const d = dias[fecha]
                const nd = Number(fecha.slice(8, 10))
                const habil = d ? d.es_habil : null
                const festivo = d && !d.es_habil && d.motivo
                const bg = d == null ? '#F4F4F1' : habil ? '#EAF7F0' : festivo ? '#FDECEC' : '#F0EFEA'
                const bd = festivo ? '#F1B0B0' : habil ? '#BFE6D2' : '#E5E4DF'
                return (
                  <div key={fecha} onClick={() => abrir(fecha)} title={festivo ? d.motivo : ''}
                    style={{ cursor: 'pointer', minHeight: 58, border: `1px solid ${bd}`, background: bg, borderRadius: 8, padding: '5px 7px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#2C2C2A' }}>{nd}</div>
                    {d == null
                      ? <div style={{ fontSize: 9, color: '#bbb' }}>sin datos</div>
                      : habil
                        ? <div style={{ fontSize: 10, color: '#0a7f4f' }}>{Number(d.horas_esperadas) || 0} h</div>
                        : festivo
                          ? <div style={{ fontSize: 9, color: '#B23A3A', lineHeight: 1.1, overflow: 'hidden' }}>{d.motivo}</div>
                          : <div style={{ fontSize: 10, color: '#aaa' }}>—</div>}
                  </div>
                )
              })}
            </div>
            <div style={{ fontSize: 11, color: '#999', marginTop: 8 }}>
              Verde = hábil · Rojo = festivo · Gris = fin de semana. Pincha un día para editarlo.
            </div>
          </div>

          <div style={{ flex: '0 1 300px', minWidth: 240, border: '1px solid #E5E3DC', borderRadius: 12, background: '#fff', padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#2C2C2A', marginBottom: 8 }}>Festivos {anio} ({festivos.length})</div>
            {festivos.length === 0
              ? <div style={{ fontSize: 12, color: '#aaa' }}>Sin festivos marcados.</div>
              : festivos.map(f => (
                <div key={f.fecha} onClick={() => { setMes(Number(String(f.fecha).slice(5, 7)) - 1); abrir(String(f.fecha).slice(0, 10)) }}
                  style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 8, padding: '5px 0', borderBottom: '0.5px solid #F0EEE8', fontSize: 12 }}>
                  <span style={{ color: '#B23A3A', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtDMA(f.fecha)}</span>
                  <span style={{ color: '#555', textAlign: 'right' }}>{f.motivo}</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {sel && (
        <div onClick={() => setSel(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 'min(420px, 94vw)', background: '#fff', borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.25)', padding: 18 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#2C2C2A', marginBottom: 12 }}>{fmtDMA(sel)}</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button onClick={() => setForm(f => ({ ...f, es_habil: true, horas_esperadas: f.horas_esperadas || 8.5 }))}
                style={{ ...toggleBtn, ...(form.es_habil ? toggleOnHabil : {}) }}>Hábil</button>
              <button onClick={() => setForm(f => ({ ...f, es_habil: false }))}
                style={{ ...toggleBtn, ...(!form.es_habil ? toggleOnFest : {}) }}>Festivo</button>
            </div>
            {form.es_habil && (
              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>Horas esperadas</label>
                <input type="number" step="0.5" min="0" value={form.horas_esperadas}
                  onChange={e => setForm(f => ({ ...f, horas_esperadas: e.target.value }))} style={inp} />
              </div>
            )}
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Motivo {form.es_habil ? '(opcional)' : '(nombre del festivo)'}</label>
              <input value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))}
                placeholder={form.es_habil ? '' : 'Ej.: Fiestas Patrias, día extra empresa…'} style={inp} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setSel(null)} style={btnCancel}>Cancelar</button>
              <button onClick={guardar} disabled={guardando} style={btnSave}>{guardando ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const ctrl = { fontSize: 14, padding: '7px 10px', borderRadius: 8, border: '1px solid #D3D1C7', background: '#fff' }
const btnNav = { fontSize: 14, padding: '7px 12px', borderRadius: 8, border: '1px solid #D3D1C7', background: '#fff', cursor: 'pointer' }
const lbl = { display: 'block', fontSize: 12, color: '#666', marginBottom: 4 }
const inp = { width: '100%', fontSize: 14, padding: '8px 10px', borderRadius: 8, border: '1px solid #D3D1C7', boxSizing: 'border-box' }
const toggleBtn = { flex: 1, fontSize: 13, fontWeight: 600, padding: '8px 0', borderRadius: 8, border: '1px solid #D3D1C7', background: '#fff', color: '#666', cursor: 'pointer' }
const toggleOnHabil = { border: '1px solid #0a7f4f', background: '#EAF7F0', color: '#0a7f4f' }
const toggleOnFest = { border: '1px solid #B23A3A', background: '#FDECEC', color: '#B23A3A' }
const btnCancel = { padding: '8px 16px', borderRadius: 8, border: '1px solid #D3D1C7', background: '#fff', color: '#666', fontSize: 13, cursor: 'pointer' }
const btnSave = { padding: '8px 16px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }
