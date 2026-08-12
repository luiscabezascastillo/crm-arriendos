'use client'
// VERSION: v7 · 2026-08-12 · app/captaciones/page.js — El monto del CAPTADO se etiqueta "Comisión estimada" (no el
//   valor de la propiedad): pipeline y facturado quedan en la misma unidad (comisión posible → comisión real).
//   Solo cambian textos; la columna valor_estimado y los endpoints no cambian. Hereda v6.
// VERSION: v6 · 2026-08-12 · app/captaciones/page.js — Dos hitos: CAPTADO (mandato + valor estimado, pipeline) y
//   FACTURADO (operación cerrada + comisión real + fecha). El tablero separa "pipeline estimado" de "facturación real",
//   así los mandatos sin cerrar quedan en $0 sin inflar la comisión. Pestañas del módulo: Propietarios (activa) /
//   Prospección (próximamente). Hereda v5.
// VERSION: v5 · 2026-08-12 · app/captaciones/page.js — CIERRE con monto al marcar "Captado". Hereda v4.
// VERSION: v4 · 2026-08-12 · app/captaciones/page.js — Acceso SOLO Alberto + Luis (Dirección). Hereda v3.
// VERSION: v3 · 2026-08-12 · app/captaciones/page.js — KPIs del embudo clicables + plantilla A1 sin {comuna}. Hereda v2.
// VERSION: v2 · 2026-08-12 · app/captaciones/page.js — Editor rápido del teléfono por fila (✎). Hereda v1.
// VERSION: v1 · 2026-08-12 · app/captaciones/page.js — MVP del módulo de Captaciones (import + WhatsApp + pipeline +45d).
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
const RESULTADOS = [['', 'registrar…'], ['contactado', 'Contactado'], ['respondio', 'Respondió'], ['interesado', 'Interesado'], ['agendada', 'Valoración agendada'], ['no_ahora', 'No ahora (pausa)'], ['captado', 'Captado ✅ (mandato)'], ['facturado', 'Facturado 💰 (cerrado)'], ['no_molestar', 'No molestar']]
const COLOR_ESTADO = { por_contactar: '#6b7280', contactado: '#0891b2', en_conversacion: '#7c3aed', interesado: '#0e7490', valoracion_agendada: '#b45309', captado: '#16a34a', facturado: '#047857', en_pausa: '#9ca3af', no_molestar: '#dc2626' }
const EMBUDO = [['por_contactar', 'Por contactar'], ['contactado', 'Contactado'], ['en_conversacion', 'En conversación'], ['interesado', 'Interesado'], ['valoracion_agendada', 'Valoración agendada'], ['captado', 'Captado'], ['facturado', 'Facturado'], ['en_pausa', 'En pausa'], ['no_molestar', 'No molestar']]
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const primerNombre = s => String(s || '').trim().split(/\s+/)[0] || ''
const clp = n => '$' + (Number(n) || 0).toLocaleString('es-CL')
const hoyISO = () => new Date().toISOString().slice(0, 10)

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
  // Modal de hito: { row, modo:'captado'|'facturado', tipo, monto, fecha }
  const [cierre, setCierre] = useState(null)

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

  async function registrar(row, resultado, extra = {}) {
    if (!resultado) return
    try {
      const res = await fetch('/api/captaciones/gestion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ captacion_id: row.id, canal: 'whatsapp', plantilla, resultado, ...extra }) })
      const j = await res.json()
      if (!res.ok || j.error) { setMsg({ t: 'error', x: j.error || ('Error ' + res.status) }); return }
      setRows(rs => rs.map(r => r.id === row.id ? {
        ...r, estado: j.estado, proxima_gestion: j.proxima_gestion, ultima_gestion: hoyISO(),
        negocio_tipo: j.negocio_tipo ?? r.negocio_tipo, negocio_monto: j.negocio_monto ?? r.negocio_monto,
        valor_estimado: j.valor_estimado ?? r.valor_estimado, fecha_cierre: j.fecha_cierre ?? r.fecha_cierre,
      } : r))
    } catch (e) { setMsg({ t: 'error', x: String(e?.message || e) }) }
  }

  // Al elegir "captado" o "facturado" en el select, abrir el modal del hito correspondiente.
  function abrirHito(row, resultado) {
    if (resultado === 'captado') setCierre({ row, modo: 'captado', tipo: row.negocio_tipo || 'venta', monto: row.valor_estimado ?? '', fecha: '' })
    else setCierre({ row, modo: 'facturado', tipo: row.negocio_tipo || 'venta', monto: '', fecha: hoyISO() })
  }
  async function confirmarHito() {
    if (!cierre) return
    if (cierre.modo === 'facturado') await registrar(cierre.row, 'facturado', { negocio_tipo: cierre.tipo, negocio_monto: cierre.monto, fecha_cierre: cierre.fecha })
    else await registrar(cierre.row, 'captado', { negocio_tipo: cierre.tipo, valor_estimado: cierre.monto })
    setCierre(null)
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
    const captados = rows.filter(r => r.estado === 'captado')      // mandatos abiertos (aún sin facturar)
    const facturados = rows.filter(r => r.estado === 'facturado')  // operaciones cerradas con comisión
    return {
      total: rows.length, conWa: rows.filter(r => r.wa).length, porEstado: c,
      mandatos: captados.length + facturados.length,
      pipelineEst: captados.reduce((a, r) => a + (Number(r.valor_estimado) || 0), 0),
      facturados: facturados.length,
      ventas: facturados.filter(r => r.negocio_tipo === 'venta').length,
      arriendos: facturados.filter(r => r.negocio_tipo === 'arriendo').length,
      comision: facturados.reduce((a, r) => a + (Number(r.negocio_monto) || 0), 0),
    }
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
  if (status === 'authenticated' && !autorizado) return <div style={{ minHeight: '100vh' }}><TopNav /><div style={{ padding: 40, color: '#b91c1c' }}>Captaciones está restringido a Dirección (Alberto y Luis).</div></div>

  const th = { padding: '7px 8px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: .3, whiteSpace: 'nowrap', borderBottom: '1px solid #E8E6E0', position: 'sticky', top: 0, background: '#F7F8FA', zIndex: 1 }
  const tdc = { padding: '7px 8px', fontSize: 12, color: '#1f2937', verticalAlign: 'middle' }
  const sel = { padding: '8px 10px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 13, fontFamily: 'inherit', background: '#fff' }
  const mini = { padding: '4px 9px', borderRadius: 6, border: '1px solid', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: '#fff' }
  const card = { background: '#fff', border: '1px solid #E8E6E0', borderRadius: 12, padding: 14, marginBottom: 14 }
  const esFact = cierre?.modo === 'facturado'

  return (
    <div style={{ minHeight: '100vh', background: '#f4f6f9' }}>
      <TopNav />
      <div style={{ maxWidth: 1440, margin: '0 auto', padding: 18, fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: .5 }}>Captaciones</span>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1a1a2e', margin: 0 }}>Propietarios · reactivación y captación</h1>
        </div>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 10 }}>Dueños de publicaciones (captador Alberto). Contacto por WhatsApp desde tu número, seguimiento cada 45 días.</div>

        {/* Pestañas del módulo */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, borderBottom: '1px solid #E8E6E0' }}>
          <div style={{ padding: '8px 14px', fontSize: 13, fontWeight: 700, color: '#0C447C', borderBottom: '2px solid #0C447C', marginBottom: -1 }}>Propietarios</div>
          <div title="Captación por redes, marketing, referidos y portales — en desarrollo" style={{ padding: '8px 14px', fontSize: 13, fontWeight: 600, color: '#b6b6b6', cursor: 'not-allowed' }}>Prospección · próximamente</div>
        </div>

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

        {/* Resumen de resultados: pipeline (captado) vs. facturación real (facturado) */}
        {!cargando && (kpis.mandatos > 0) && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: '#166534', background: '#F0FDF4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 12px' }}>
              <b>Mandatos:</b> {kpis.mandatos} captado(s) · comisión estimada <b>{clp(kpis.pipelineEst)}</b>
            </div>
            <div style={{ fontSize: 12, color: '#065f46', background: '#ECFDF5', border: '1px solid #a7f3d0', borderRadius: 8, padding: '8px 12px' }}>
              <b>Facturado:</b> {kpis.facturados} cerrada(s) · {kpis.ventas} venta(s) · {kpis.arriendos} arriendo(s) · comisión <b>{clp(kpis.comision)}</b>
            </div>
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
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1180 }}>
                    <thead><tr>
                      {['Propietario', 'Teléfono', 'Objetivo', 'Comuna', 'Pub.', 'Estado', 'Negocio', 'Próxima', 'WhatsApp', 'Resultado'].map(h => <th key={h} style={th}>{h}</th>)}
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
                          <td style={{ ...tdc, whiteSpace: 'nowrap', fontSize: 11 }}>
                            {r.estado === 'facturado'
                              ? <span style={{ color: '#047857', fontWeight: 700 }}>{r.negocio_tipo || 'cerrado'} · {clp(r.negocio_monto)}</span>
                              : r.estado === 'captado'
                                ? <span style={{ color: '#16a34a' }}>{r.negocio_tipo || '—'}{r.valor_estimado ? ' · ~' + clp(r.valor_estimado) : ''}</span>
                                : <span style={{ color: '#c4c4c4' }}>—</span>}
                          </td>
                          <td style={{ ...tdc, whiteSpace: 'nowrap', fontSize: 11, color: '#6b7280' }}>{r.proxima_gestion || '—'}</td>
                          <td style={tdc}>
                            <button onClick={() => abrirWhatsApp(r)} disabled={!r.wa} title={r.wa ? 'Abrir WhatsApp con el mensaje puesto' : 'Sin teléfono válido'}
                              style={{ ...mini, borderColor: r.wa ? '#25D366' : '#e5e7eb', color: r.wa ? '#128C7E' : '#9ca3af', cursor: r.wa ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}>WhatsApp</button>
                          </td>
                          <td style={tdc}>
                            <select defaultValue="" onChange={e => { const v = e.target.value; if (v === 'captado' || v === 'facturado') abrirHito(r, v); else registrar(r, v); e.target.value = '' }} style={{ ...sel, padding: '5px 8px', fontSize: 11.5 }}>
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

      {/* Modal de hito: CAPTADO (mandato + valor estimado) o FACTURADO (comisión real + fecha) */}
      {cierre && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => e.target === e.currentTarget && setCierre(null)}>
          <div style={{ background: '#fff', borderRadius: 12, width: 400, padding: 20, boxShadow: '0 8px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: esFact ? '#065f46' : '#166534', marginBottom: 4 }}>
              {esFact ? '💰 Facturado — operación cerrada' : '✅ Captado — mandato conseguido'}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 14 }}>
              {cierre.row.propietario}{esFact ? '' : ' · comisión aún estimada (pipeline)'}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 4 }}>Tipo de negocio</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {[['venta', 'Venta'], ['arriendo', 'Arriendo']].map(([v, l]) => (
                <button key={v} onClick={() => setCierre(c => ({ ...c, tipo: v }))}
                  style={{ flex: 1, padding: '9px', borderRadius: 8, border: '1px solid ' + (cierre.tipo === v ? '#16a34a' : '#E5E7EB'), background: cierre.tipo === v ? '#F0FDF4' : '#fff', color: cierre.tipo === v ? '#166534' : '#374151', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>
              ))}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 4 }}>
              {esFact ? 'Comisión real (CLP)' : 'Comisión estimada (CLP)'}
            </div>
            <input autoFocus value={cierre.monto} onChange={e => setCierre(c => ({ ...c, monto: e.target.value }))} placeholder={esFact ? 'Ej: 850000' : 'Ej: 800000'}
              onKeyDown={e => { if (e.key === 'Enter') confirmarHito(); if (e.key === 'Escape') setCierre(null) }}
              style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: esFact ? 12 : 16 }} />
            {esFact && (<>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 4 }}>Fecha de cierre</div>
              <input type="date" value={cierre.fecha} onChange={e => setCierre(c => ({ ...c, fecha: e.target.value }))}
                style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 16 }} />
            </>)}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={confirmarHito} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: esFact ? '#047857' : '#16a34a', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                {esFact ? 'Registrar facturación' : 'Registrar mandato'}
              </button>
              <button onClick={() => setCierre(null)} style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', color: '#6b7280', cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
