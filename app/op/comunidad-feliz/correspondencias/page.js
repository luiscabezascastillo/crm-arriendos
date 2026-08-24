'use client'
// VERSION: v1 · 2026-08-24 · Pantalla de gestión de correspondencias CF (/op/comunidad-feliz/correspondencias).
//   Lista editable de cf_correspondencias enriquecida con datos_arriendos; buscador; resalta las problemáticas
//   (sin comunidad / sin idadmon). Editar/crear/desactivar. Sugeridor de inmueble por nº de unidad (dep/est/bod)
//   + búsqueda libre en el maestro. Cerrada por rol (Administración + Dirección + Karina), como el resto de CF.
//   API: /api/comunidad-feliz/correspondencias-admin.
import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

const ROL_ALIAS = { admin: 'direccion', operaciones: 'administracion', tecnico: 'mantencion' }
const normRol = (r) => ROL_ALIAS[String(r || '').toLowerCase()] || String(r || '').toLowerCase()
const ROLES_OK = ['administracion', 'direccion']
const EMAILS_OK = ['karina.morales@fondocapital.com']

const API = '/api/comunidad-feliz/correspondencias-admin'

export default function CorrespondenciasCF() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const email = session?.user?.email || ''
  const rol = normRol(session?.user?.role)
  const puedeVer = ROLES_OK.includes(rol) || EMAILS_OK.includes(email)

  useEffect(() => {
    if (status === 'loading') return
    if (!session) { router.replace('/panel'); return }
    if (!puedeVer) { router.replace('/procesos/mi-portal') }
  }, [status, session, puedeVer]) // eslint-disable-line

  const [filas, setFilas] = useState([])
  const [cargando, setCargando] = useState(false)
  const [q, setQ] = useState('')
  const [verInactivas, setVerInactivas] = useState(false)
  const [msg, setMsg] = useState('')

  // modal edición
  const vacio = { id: null, comunidad_cf: '', inmueble_cf: '', idadmon: '', idinmue: '', propietario: '', estado: 'S', notas: '', activo: true }
  const [form, setForm] = useState(null) // null = cerrado
  const [sugs, setSugs] = useState([])
  const [busy, setBusy] = useState(false)
  const [bq, setBq] = useState('')
  const [bres, setBres] = useState([])

  async function cargar() {
    setCargando(true); setMsg('')
    try {
      const r = await fetch(`${API}?modo=lista&todas=${verInactivas ? 1 : 0}`)
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      setFilas(d.correspondencias || [])
    } catch (e) { setMsg('Error cargando: ' + e.message) }
    setCargando(false)
  }
  useEffect(() => { if (puedeVer) cargar() }, [puedeVer, verInactivas]) // eslint-disable-line

  const filtradas = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return filas
    return filas.filter((f) => [f.comunidad_cf, f.inmueble_cf, f.idadmon, f.idinmue, f.propietario, f.direccion_maestro]
      .some((v) => String(v || '').toLowerCase().includes(t)))
  }, [filas, q])

  const nProblemas = filas.filter((f) => f.problema).length

  function abrirNueva() { setForm({ ...vacio }); setSugs([]); setBres([]); setBq('') }
  function abrirEditar(f) {
    setForm({ id: f.id, comunidad_cf: f.comunidad_cf || '', inmueble_cf: f.inmueble_cf || '', idadmon: f.idadmon || '',
      idinmue: f.idinmue || '', propietario: f.propietario || '', estado: f.estado || 'S', notas: f.notas || '', activo: f.activo !== false })
    setSugs([]); setBres([]); setBq('')
  }
  function cerrar() { setForm(null) }

  async function pedirSugerencias() {
    if (!form) return
    setBusy(true); setSugs([])
    try {
      const r = await fetch(`${API}?modo=sugerir&comunidad=${encodeURIComponent(form.comunidad_cf)}&inmueble=${encodeURIComponent(form.inmueble_cf)}`)
      const d = await r.json()
      setSugs(d.candidatos || [])
    } catch (e) { setMsg('Error sugiriendo: ' + e.message) }
    setBusy(false)
  }
  async function buscarMaestro(txt) {
    setBq(txt)
    if (txt.trim().length < 2) { setBres([]); return }
    try {
      const r = await fetch(`${API}?modo=buscar&q=${encodeURIComponent(txt)}`)
      const d = await r.json()
      setBres(d.candidatos || [])
    } catch { setBres([]) }
  }
  function asignar(c) {
    setForm((f) => ({ ...f, idadmon: c.idadmon || '', idinmue: c.idinmue || '', propietario: c.propietario || f.propietario }))
    setSugs([]); setBres([]); setBq('')
  }

  async function guardar() {
    if (!form) return
    setBusy(true); setMsg('')
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'guardar', ...form }) })
      const d = await r.json()
      if (!d.ok) throw new Error(d.error || 'Error guardando')
      setForm(null); await cargar()
      setMsg('✓ Guardado.')
    } catch (e) { setMsg('✗ ' + e.message) }
    setBusy(false)
  }
  async function cambiarActivo(f, activar) {
    if (!activar && !confirm(`¿Desactivar la correspondencia ${f.comunidad_cf || '(sin comunidad)'} / ${f.inmueble_cf}?`)) return
    setBusy(true)
    try {
      await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: activar ? 'activar' : 'desactivar', id: f.id }) })
      await cargar()
    } catch (e) { setMsg('✗ ' + e.message) }
    setBusy(false)
  }

  if (status === 'loading' || !puedeVer) return <div style={s.page}><div style={{ padding: 40, color: '#64748b' }}>Cargando…</div></div>

  return (
    <div style={s.page}>
      <div style={s.wrap}>
        <div style={s.head}>
          <div>
            <button style={s.back} onClick={() => router.push('/op/comunidad-feliz')}>← Comunidad Feliz</button>
            <h1 style={s.h1}>Correspondencias CF ↔ inmuebles</h1>
            <p style={s.sub}>Puente entre lo que muestra Comunidad Feliz (comunidad + unidad) y tus inmuebles (idadmon/idinmue). Edítalo aquí para que los datos casen.</p>
          </div>
          <button style={s.btnPri} onClick={abrirNueva}>+ Nueva correspondencia</button>
        </div>

        <div style={s.barra}>
          <input style={s.input} placeholder="Buscar por comunidad, unidad, idadmon, propietario, dirección…" value={q} onChange={(e) => setQ(e.target.value)} />
          <label style={s.check}><input type="checkbox" checked={verInactivas} onChange={(e) => setVerInactivas(e.target.checked)} /> Ver inactivas</label>
          <span style={s.contador}>{filtradas.length} de {filas.length}</span>
          {nProblemas > 0 && <span style={s.alerta}>⚠ {nProblemas} a revisar (sin comunidad o sin idadmon)</span>}
        </div>

        {msg && <div style={s.msg}>{msg}</div>}

        <div style={s.tablaWrap}>
          <table style={s.tabla}>
            <thead>
              <tr>
                {['Comunidad CF', 'Unidad CF', 'IDADMON', 'IDINMUE', 'Propietario', 'Dirección (maestro)', 'Est', ''].map((h) => <th key={h} style={s.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {cargando && <tr><td colSpan={8} style={s.td}>Cargando…</td></tr>}
              {!cargando && filtradas.map((f) => (
                <tr key={f.id} style={{ background: f.problema ? '#FEF3C7' : (f.activo ? '#fff' : '#f1f5f9') }}>
                  <td style={s.td}>{f.comunidad_cf || <em style={s.falta}>— sin comunidad —</em>}</td>
                  <td style={s.td}>{f.inmueble_cf}</td>
                  <td style={{ ...s.td, fontWeight: 600 }}>{f.idadmon || <em style={s.falta}>—</em>}</td>
                  <td style={s.td}>{f.idinmue || '—'}</td>
                  <td style={s.td}>{f.propietario || '—'}</td>
                  <td style={{ ...s.td, color: '#64748b', fontSize: 12 }}>{f.direccion_maestro || '—'}</td>
                  <td style={s.td}>{f.estado}</td>
                  <td style={{ ...s.td, whiteSpace: 'nowrap' }}>
                    <button style={s.btnMini} onClick={() => abrirEditar(f)}>Editar</button>
                    {f.activo
                      ? <button style={{ ...s.btnMini, color: '#b91c1c' }} onClick={() => cambiarActivo(f, false)}>Baja</button>
                      : <button style={{ ...s.btnMini, color: '#15803d' }} onClick={() => cambiarActivo(f, true)}>Alta</button>}
                  </td>
                </tr>
              ))}
              {!cargando && filtradas.length === 0 && <tr><td colSpan={8} style={{ ...s.td, color: '#94a3b8' }}>Sin resultados.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {form && (
        <div style={s.overlay} onClick={(e) => { if (e.target === e.currentTarget) cerrar() }}>
          <div style={s.modal}>
            <div style={s.modalHead}>
              <strong>{form.id ? 'Editar correspondencia' : 'Nueva correspondencia'}</strong>
              <button style={s.back} onClick={cerrar}>Cerrar</button>
            </div>

            <div style={s.grid2}>
              <label style={s.lbl}>Comunidad CF (nombre en el portal)
                <input style={s.inp} value={form.comunidad_cf} onChange={(e) => setForm({ ...form, comunidad_cf: e.target.value })} placeholder="Comunidad Edificio…" />
              </label>
              <label style={s.lbl}>Unidad CF (tal cual sale en CF)
                <input style={s.inp} value={form.inmueble_cf} onChange={(e) => setForm({ ...form, inmueble_cf: e.target.value })} placeholder="705 · Depto 608 · 2208-B" />
              </label>
            </div>

            <div style={s.asignBox}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <strong style={{ fontSize: 13 }}>Inmueble asignado</strong>
                <button style={s.btnSec} disabled={busy || !form.inmueble_cf.trim()} onClick={pedirSugerencias}>💡 Sugerir por unidad</button>
              </div>
              <div style={s.grid3}>
                <label style={s.lbl}>IDADMON
                  <input style={s.inp} value={form.idadmon} onChange={(e) => setForm({ ...form, idadmon: e.target.value.toUpperCase() })} placeholder="A00xxx" />
                </label>
                <label style={s.lbl}>IDINMUE
                  <input style={s.inp} value={form.idinmue} onChange={(e) => setForm({ ...form, idinmue: e.target.value })} placeholder="P0xx-yy" />
                </label>
                <label style={s.lbl}>Propietario
                  <input style={s.inp} value={form.propietario} onChange={(e) => setForm({ ...form, propietario: e.target.value })} />
                </label>
              </div>

              {sugs.length > 0 && (
                <div style={s.sugList}>
                  <div style={s.sugTit}>Candidatos por número de unidad — pulsa para asignar:</div>
                  {sugs.map((c, i) => (
                    <div key={i} style={s.sugRow} onClick={() => asignar(c)}>
                      <span style={{ ...s.pill, background: c.score >= 0.8 ? '#16a34a' : c.score >= 0.5 ? '#f59e0b' : '#94a3b8' }}>{Math.round(c.score * 100)}%</span>
                      <span style={{ fontWeight: 600, minWidth: 64 }}>{c.idadmon}</span>
                      <span style={{ color: '#475569', flex: 1 }}>{c.inmueble}</span>
                      <span style={{ color: '#64748b', fontSize: 12 }}>{c.propietario}</span>
                    </div>
                  ))}
                </div>
              )}
              {sugs.length === 0 && !busy && form.inmueble_cf && (
                <div style={{ marginTop: 6 }}>
                  <input style={s.inp} placeholder="…o busca a mano: propietario, dirección, idadmon…" value={bq} onChange={(e) => buscarMaestro(e.target.value)} />
                  {bres.length > 0 && (
                    <div style={s.sugList}>
                      {bres.map((c, i) => (
                        <div key={i} style={s.sugRow} onClick={() => asignar(c)}>
                          <span style={{ fontWeight: 600, minWidth: 64 }}>{c.idadmon}</span>
                          <span style={{ color: '#475569', flex: 1 }}>{c.inmueble}</span>
                          <span style={{ color: '#64748b', fontSize: 12 }}>{c.propietario}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={s.grid2}>
              <label style={s.lbl}>Estado
                <select style={s.inp} value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                  <option value="S">S</option><option value="P">P</option>
                </select>
              </label>
              <label style={s.lbl}>Notas
                <input style={s.inp} value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <button style={s.btnSec} onClick={cerrar}>Cancelar</button>
              <button style={s.btnPri} disabled={busy} onClick={guardar}>{busy ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', background: '#f8fafc', color: '#0f172a', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' },
  wrap: { maxWidth: 1180, margin: '0 auto', padding: '20px 20px 60px' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 16 },
  back: { background: 'none', border: '1px solid #cbd5e1', color: '#475569', padding: '5px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 13, marginBottom: 8 },
  h1: { fontSize: 22, fontWeight: 700, margin: '4px 0' },
  sub: { fontSize: 13, color: '#64748b', margin: 0, maxWidth: 720 },
  btnPri: { background: '#2563eb', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' },
  btnSec: { background: '#fff', color: '#334155', border: '1px solid #cbd5e1', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 },
  barra: { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 },
  input: { flex: 1, minWidth: 260, background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, padding: '9px 12px', fontSize: 14 },
  check: { fontSize: 13, color: '#475569', display: 'flex', alignItems: 'center', gap: 6 },
  contador: { fontSize: 12, color: '#64748b' },
  alerta: { fontSize: 12, color: '#92400e', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 6, padding: '3px 8px' },
  msg: { fontSize: 13, padding: '8px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, marginBottom: 12 },
  tablaWrap: { overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 10, background: '#fff' },
  tabla: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e2e8f0', color: '#64748b', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, background: '#f8fafc' },
  td: { padding: '9px 12px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'top' },
  falta: { color: '#b45309', fontStyle: 'italic' },
  btnMini: { background: 'none', border: '1px solid #cbd5e1', color: '#334155', padding: '3px 9px', borderRadius: 6, cursor: 'pointer', fontSize: 12, marginRight: 5 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 24, overflowY: 'auto', zIndex: 50 },
  modal: { background: '#fff', borderRadius: 14, padding: 20, width: '100%', maxWidth: 720, boxShadow: '0 20px 50px rgba(0,0,0,0.25)' },
  modalHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', gap: 10 },
  lbl: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#475569', fontWeight: 500 },
  inp: { background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, padding: '8px 10px', fontSize: 14, color: '#0f172a' },
  asignBox: { border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, background: '#f8fafc', marginBottom: 12 },
  sugList: { marginTop: 8, border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', overflow: 'hidden' },
  sugTit: { fontSize: 12, color: '#64748b', padding: '6px 10px', background: '#f1f5f9' },
  sugRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderTop: '1px solid #f1f5f9', cursor: 'pointer', fontSize: 13 },
  pill: { color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 20, minWidth: 36, textAlign: 'center' },
}
