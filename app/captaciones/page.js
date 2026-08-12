'use client'
// VERSION: v4 · 2026-08-12 · app/captaciones/page.js — Acceso restringido a SOLO Alberto + Luis (Dirección); se
//   quita Administración del módulo. Hereda v3.
// VERSION: v3 · 2026-08-12 · app/captaciones/page.js — (1) KPIs del embudo arriba (clicables para filtrar).
//   (2) Plantilla A1 sin el "demanda por {comuna}" (la comuna es la de la publicación, no implica demanda ahí).
//   Hereda v2.
// VERSION: v2 · 2026-08-12 · app/captaciones/page.js — Editor rápido del TELÉFONO por fila (✎): poner/corregir el
//   número sin salir de la lista (p. ej. reemplazar un fijo por el celular que ya se tiene). Si es móvil, activa el
//   WhatsApp al instante. Hereda v1.
// VERSION: v1 · 2026-08-12 · app/captaciones/page.js — MVP del módulo de Captaciones. Importa dueños de publicaciones
//   (dry-run → confirmar), lista los leads, y por cada uno: botón WhatsApp (click-to-send, mensaje personalizado "como
//   si fuera Alberto") + registro de resultado que avanza el pipeline y reprograma a +45 días. Acceso: Dirección + Admin.
import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import TopNav from '../components/ui/TopNav'

const AUTORIZADOS = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com']

const PLANTILLAS = {
  'A1 · Captación (relación)': 'Hola {nombre}, ¿cómo estás? Te escribo yo, Alberto, de Fondo Capital. Ando con harta demanda de arriendo y venta y me acordé de ti. ¿Tienes alguna propiedad disponible, o que estés pensando mover, para arriendo o venta? La veo con gusto. Un abrazo.',
  'A2 · Captación (directa)': '¡Hola {nombre}! Alberto, de Fondo Capital 👋 ¿Tienes hoy alguna propiedad para arrendar o vender? Tengo clientes buscando y me encantaría ayudarte a colocarla. Cualquier cosa me avisas.',
  'A3 · Captación (servicio)': 'Hola {nombre}, ¿cómo va todo? Soy Alberto (Fondo Capital). Paso a saludarte y, de paso, preguntarte: ¿te quedó alguna propiedad desocupada o que quieras poner en arriendo/venta? La gestiono yo directo. Quedo atento.',
  'B · Reactivación': 'Hola {nombre}, ¿alcanzaste a ver mi mensaje? Sin apuro — si en algún momento tienes una propiedad para arriendo o venta, cuenta conmigo. Un abrazo, Alberto.',
  'C · Fiestas Patrias': '¡Hola {nombre}! Que tengas unas lindas Fiestas Patrias, con harta familia y buen asado 🇨🇱. Un abrazo, Alberto — Fondo Capital.',
  'D · Navidad': 'Hola {nombre}, en esta Navidad quería desearte lo mejor para ti y los tuyos, y agradecerte la confianza de siempre. ¡Felices fiestas y un gran 2027! Un abrazo, Alberto.',
  'E · Cumpleaños': '¡Feliz cumpleaños, {nombre}! 🎉 Que tengas un día increíble y un año lleno de cosas buenas. Un abrazo, Alberto.',
  'F · Agendar valoración': '¡Genial, {nombre}! Para ayudarte mejor, ¿coordinamos una visita para verla y hacerte una valoración sin costo? Dime qué día te acomoda y lo dejamos agendado. Alberto.',
}
const RESULTADOS = [['', 'registrar…'], ['contactado', 'Contactado'], ['respondio', 'Respondió'], ['interesado', 'Interesado'], ['agendada', 'Valoración agendada'], ['no_ahora', 'No ahora (pausa)'], ['captado', 'Captado ✅'], ['no_molestar', 'No molestar']]
const COLOR_ESTADO = { por_contactar: '#6b7280', contactado: '#0891b2', en_conversacion: '#7c3aed', interesado: '#0e7490', valoracion_agendada: '#b45309', captado: '#16a34a', en_pausa: '#9ca3af', no_molestar: '#dc2626' }
const EMBUDO = [['por_contactar', 'Por contactar'], ['contactado', 'Contactado'], ['en_conversacion', 'En conversación'], ['interesado', 'Interesado'], ['valoracion_agendada', 'Valoración agendada'], ['captado', 'Captado'], ['en_pausa', 'En pausa'], ['no_molestar', 'No molestar']]
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const primerNombre = s => String(s || '').trim().split(/\s+/)[0] || ''

export default function CaptacionesPage() {
  const { data: session, status } = useSession()
  const email = session?.user?.email
  const autorizado = !!email && AUTORIZADOS.includes(email)

  const [rows, setRows] = useState([])
  const [cargando, setCargando] = useState(true)
  const [msg, setMsg] = useState(null)
  const [busca, setBusca] = useState('')
  const [fEstado, setFEstado] = useState('')
  const [plantilla, setPlantilla] = useState(Object.keys(PLANTILLAS)[0])
  // Importación
  const [impLimite, setImpLimite] = useState(20)
  const [impBusy, setImpBusy] = useState(false)
  const [preview, setPreview] = useState(null)
  const [editTel, setEditTel] = useState(null)   // id de la fila cuyo teléfono se está editando
  const [telVal, setTelVal] = useState('')

  async function cargar() {
    setCargando(true)
    try {
      const j = await (await fetch('/api/captaciones/listar')).json()
      if (j.error) setMsg({ t: 'error', x: j.error }); else setRows(j.rows || [])
    } catch (e) { setMsg({ t: 'error', x: String(e?.message || e) }) } finally { setCargando(false) }
  }
  useEffect(() => { if (status === 'authenticated' && autorizado) cargar() }, [status, autorizado])

  async function importar(dryRun) {
    setImpBusy(true); setMsg(null)
    try {
      const res = await fetch('/api/captaciones/importar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dryRun, limite: impLimite }) })
      const j = await res.json()
      if (!res.ok || j.error) { setMsg({ t: 'error', x: j.error || ('Error ' + res.status) }); return }
      if (dryRun) { setPreview(j); setMsg({ t: 'ok', x: `Simulación: ${j.total_duenos} dueños (${j.con_telefono} con teléfono, ${j.ya_en_contactos} ya en Contactos). Revisa la muestra y confirma.` }) }
      else { setPreview(null); setMsg({ t: 'ok', x: `Importados: ${j.captaciones_creadas} nuevos · ${j.contactos_creados} contactos creados · quedan ~${j.restantes_aprox}.` }); await cargar() }
    } catch (e) { setMsg({ t: 'error', x: String(e?.message || e) }) } finally { setImpBusy(false) }
  }

  async function registrar(row, resultado) {
    if (!resultado) return
    try {
      const res = await fetch('/api/captaciones/gestion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ captacion_id: row.id, canal: 'whatsapp', plantilla, resultado }) })
      const j = await res.json()
      if (!res.ok || j.error) { setMsg({ t: 'error', x: j.error || ('Error ' + res.status) }); return }
      setRows(rs => rs.map(r => r.id === row.id ? { ...r, estado: j.estado, proxima_gestion: j.proxima_gestion, ultima_gestion: new Date().toISOString().slice(0, 10) } : r))
    } catch (e) { setMsg({ t: 'error', x: String(e?.message || e) }) }
  }

  async function guardarTelefono(row) {
    try {
      const res = await fetch('/api/captaciones/telefono', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ captacion_id: row.id, telefono: telVal }) })
      const j = await res.json()
      if (!res.ok || j.error) { setMsg({ t: 'error', x: j.error || ('Error ' + res.status) }); return }
      setRows(rs => rs.map(r => r.id === row.id ? { ...r, telefono: j.telefono || '', wa: j.wa || '' } : r))
      setEditTel(null); setTelVal('')
    } catch (e) { setMsg({ t: 'error', x: String(e?.message || e) }) }
  }

  function abrirWhatsApp(row) {
    if (!row.wa) return
    const texto = PLANTILLAS[plantilla].replace(/\{nombre\}/g, primerNombre(row.nombre)).replace(/\{comuna\}/g, row.comuna || 'tu sector')
    window.open(`https://wa.me/${row.wa}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener,noreferrer')
  }

  const kpis = useMemo(() => {
    const c = {}; for (const r of rows) c[r.estado] = (c[r.estado] || 0) + 1
    return { total: rows.length, conWa: rows.filter(r => r.wa).length, porEstado: c }
  }, [rows])

  const filtradas = useMemo(() => {
    const q = norm(busca.trim())
    return rows.filter(r => {
      if (fEstado && r.estado !== fEstado) return false
      if (q && !norm([r.propietario, r.nombre, r.comuna, r.telefono].join(' ')).includes(q)) return false
      return true
    })
  }, [rows, busca, fEstado])

  if (status === 'loading') return <div style={{ minHeight: '100vh' }}><TopNav /><div style={{ padding: 40, color: '#888' }}>Cargando…</div></div>
  if (status === 'authenticated' && !autorizado) return <div style={{ minHeight: '100vh' }}><TopNav /><div style={{ padding: 40, color: '#b91c1c' }}>Captaciones está restringido a Dirección y Administración.</div></div>

  const th = { padding: '7px 8px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: .3, whiteSpace: 'nowrap', borderBottom: '1px solid #E8E6E0', position: 'sticky', top: 0, background: '#F7F8FA', zIndex: 1 }
  const tdc = { padding: '7px 8px', fontSize: 12, color: '#1f2937', verticalAlign: 'middle' }
  const sel = { padding: '8px 10px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 13, fontFamily: 'inherit', background: '#fff' }
  const mini = { padding: '4px 9px', borderRadius: 6, border: '1px solid', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: '#fff' }
  const card = { background: '#fff', border: '1px solid #E8E6E0', borderRadius: 12, padding: 14, marginBottom: 14 }

  return (
    <div style={{ minHeight: '100vh', background: '#f4f6f9' }}>
      <TopNav />
      <div style={{ maxWidth: 1440, margin: '0 auto', padding: 18, fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: .5 }}>Captaciones</span>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1a1a2e', margin: 0 }}>Cartera de propietarios · captación</h1>
        </div>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 14 }}>Dueños de publicaciones (captador Alberto). Contacto por WhatsApp desde tu número, seguimiento cada 45 días.</div>

        {msg && <div style={{ ...card, padding: 10, background: msg.t === 'error' ? '#fef2f2' : '#f0fdf4', color: msg.t === 'error' ? '#b91c1c' : '#166534', borderColor: msg.t === 'error' ? '#fecaca' : '#bbf7d0' }}>{msg.x}</div>}

        {/* Importación */}
        <div style={{ ...card, border: '2px solid #0C447C', background: '#F5F8FF' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#0C447C', marginBottom: 8 }}>Importar dueños de publicaciones → Contactos + Captaciones</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: 12, color: '#374151' }}>Tanda: <input type="number" value={impLimite} onChange={e => setImpLimite(Math.max(1, parseInt(e.target.value, 10) || 1))} style={{ ...sel, width: 90, padding: '6px 8px' }} /></label>
            <button onClick={() => importar(true)} disabled={impBusy} style={{ ...mini, borderColor: '#0C447C', color: '#0C447C', padding: '8px 14px' }}>{impBusy ? '…' : '🔍 Simular (dry-run)'}</button>
            {preview && <button onClick={() => importar(false)} disabled={impBusy} style={{ ...mini, borderColor: '#16a34a', background: '#16a34a', color: '#fff', padding: '8px 14px' }}>{impBusy ? '…' : `✓ Importar ${impLimite} de verdad`}</button>}
            <span style={{ fontSize: 11, color: '#6b7280' }}>Se puede correr por tandas: los ya importados se saltan.</span>
          </div>
          {preview && (
            <div style={{ marginTop: 10, overflowX: 'auto' }}>
              <div style={{ fontSize: 12, color: '#374151', marginBottom: 6 }}><b>{preview.total_duenos}</b> dueños · <b>{preview.con_telefono}</b> con teléfono · <b>{preview.sin_telefono}</b> sin teléfono · <b>{preview.ya_en_contactos}</b> ya en Contactos. Muestra de {preview.muestra.length}:</div>
              <table style={{ borderCollapse: 'collapse', fontSize: 11.5 }}>
                <thead><tr>{['Propietario', 'Teléfono', 'Objetivo', 'Comuna', 'Pub.', 'Admin', 'En Contactos'].map(h => <th key={h} style={{ ...th, position: 'static' }}>{h}</th>)}</tr></thead>
                <tbody>{preview.muestra.map((m, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #eef' }}>
                    <td style={tdc}>{m.propietario}</td><td style={tdc}>{m.telefono}{m.es_movil ? '' : ' (no móvil)'}</td>
                    <td style={tdc}>{m.objetivo}</td><td style={tdc}>{m.comuna || '—'}</td><td style={tdc}>{m.n_pub}</td>
                    <td style={tdc}>{m.administrado ? 'sí' : '—'}</td><td style={tdc}>{m.ya_en_contactos ? 'sí' : 'nuevo'}</td>
                  </tr>))}</tbody>
              </table>
            </div>
          )}
        </div>

        {/* KPIs del embudo (clicables para filtrar) */}
        {!cargando && rows.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <button onClick={() => setFEstado('')} style={{ padding: '7px 12px', borderRadius: 10, border: '1px solid ' + (fEstado === '' ? '#0C447C' : '#E8E6E0'), background: fEstado === '' ? '#EEF4FB' : '#fff', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center', minWidth: 78 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0C447C' }}>{kpis.total}</div>
              <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 700 }}>Total</div>
            </button>
            {EMBUDO.map(([e, label]) => (
              <button key={e} onClick={() => setFEstado(e)} title={'Ver ' + label}
                style={{ padding: '7px 12px', borderRadius: 10, border: '1px solid ' + (fEstado === e ? (COLOR_ESTADO[e] || '#0C447C') : '#E8E6E0'), background: fEstado === e ? '#F8FAFC' : '#fff', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center', minWidth: 78 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: COLOR_ESTADO[e] || '#374151' }}>{kpis.porEstado[e] || 0}</div>
                <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 700, lineHeight: 1.1 }}>{label}</div>
              </button>
            ))}
            <div style={{ alignSelf: 'center', fontSize: 11, color: '#9ca3af', marginLeft: 4 }}>{kpis.conWa} con WhatsApp</div>
          </div>
        )}

        {/* Filtros + plantilla */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar propietario, comuna, teléfono…" style={{ ...sel, minWidth: 280, flex: '1 1 280px' }} />
          <select value={fEstado} onChange={e => setFEstado(e.target.value)} style={sel}>
            <option value="">Todos los estados</option>
            {Object.keys(COLOR_ESTADO).map(e => <option key={e} value={e}>{e.replace(/_/g, ' ')}</option>)}
          </select>
          <label style={{ fontSize: 12, color: '#374151' }}>Plantilla WhatsApp:&nbsp;
            <select value={plantilla} onChange={e => setPlantilla(e.target.value)} style={sel}>{Object.keys(PLANTILLAS).map(k => <option key={k} value={k}>{k}</option>)}</select>
          </label>
          <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>{filtradas.length} de {rows.length}</span>
        </div>

        <div style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 12, overflow: 'hidden' }}>
          {cargando ? <div style={{ padding: 30, color: '#888' }}>Cargando…</div>
            : filtradas.length === 0 ? <div style={{ padding: 30, color: '#888' }}>Sin captaciones todavía. Usa "Simular" y luego "Importar" arriba.</div>
              : (
                <div style={{ overflowX: 'auto', maxHeight: '68vh', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
                    <thead><tr>
                      {['Propietario', 'Teléfono', 'Objetivo', 'Comuna', 'Pub.', 'Estado', 'Próxima', 'WhatsApp', 'Resultado'].map(h => <th key={h} style={th}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {filtradas.map((r, i) => (
                        <tr key={r.id} style={{ borderBottom: '1px solid #F1F1EE', background: i % 2 ? '#FCFCFB' : '#fff' }}>
                          <td style={{ ...tdc, fontWeight: 600, minWidth: 180 }}>{r.propietario}{r.administrado ? <span style={{ fontSize: 10, color: '#0e7490' }}> · admin</span> : ''}</td>
                          <td style={{ ...tdc, whiteSpace: 'nowrap' }}>
                            {editTel === r.id ? (
                              <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                                <input autoFocus value={telVal} onChange={e => setTelVal(e.target.value)} placeholder="+56 9 …"
                                  onKeyDown={e => { if (e.key === 'Enter') guardarTelefono(r); if (e.key === 'Escape') { setEditTel(null); setTelVal('') } }}
                                  style={{ ...sel, padding: '4px 6px', width: 140, fontSize: 12 }} />
                                <button onClick={() => guardarTelefono(r)} style={{ ...mini, borderColor: '#16a34a', color: '#16a34a', padding: '3px 7px' }}>✓</button>
                                <button onClick={() => { setEditTel(null); setTelVal('') }} style={{ ...mini, borderColor: '#e5e7eb', color: '#6b7280', padding: '3px 7px' }}>✕</button>
                              </span>
                            ) : (
                              <span>{r.telefono || <span style={{ color: '#b45309' }}>falta tel</span>}
                                <button onClick={() => { setEditTel(r.id); setTelVal(r.telefono || '') }} title="Poner/corregir teléfono"
                                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', marginLeft: 6, fontSize: 12 }}>✎</button>
                              </span>
                            )}
                          </td>
                          <td style={tdc}>{r.objetivo}</td>
                          <td style={tdc}>{r.comuna || '—'}</td>
                          <td style={tdc}>{r.n_publicaciones}</td>
                          <td style={tdc}><span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color: COLOR_ESTADO[r.estado] || '#6b7280', background: '#fff', border: '1px solid ' + (COLOR_ESTADO[r.estado] || '#ddd') }}>{String(r.estado || '').replace(/_/g, ' ')}</span></td>
                          <td style={{ ...tdc, whiteSpace: 'nowrap', fontSize: 11, color: '#6b7280' }}>{r.proxima_gestion || '—'}</td>
                          <td style={tdc}>
                            <button onClick={() => abrirWhatsApp(r)} disabled={!r.wa} title={r.wa ? 'Abrir WhatsApp con el mensaje puesto' : 'Sin teléfono válido'}
                              style={{ ...mini, borderColor: r.wa ? '#25D366' : '#e5e7eb', color: r.wa ? '#128C7E' : '#9ca3af', cursor: r.wa ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}>WhatsApp</button>
                          </td>
                          <td style={tdc}>
                            <select defaultValue="" onChange={e => { registrar(r, e.target.value); e.target.value = '' }} style={{ ...sel, padding: '5px 8px', fontSize: 11.5 }}>
                              {RESULTADOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
        </div>
      </div>
    </div>
  )
}
