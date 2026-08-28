'use client'
// VERSION: 2026-08-26 · Añadido "← Volver" (BotonVolver, history.back) — convención de retorno. Hereda versión previa.
// VERSION: v5 · 2026-08-12 · Mi Portal: botón "+ Nueva alerta" en la tarjeta Alertas (solo Dirección, viendo el
//   portal de otra persona), como el "+ Nueva tarea". Abre un modal (título, detalle, fecha) e inserta la alerta en
//   `alertas` para esa persona (origen manual, con nota de quién la creó y cuándo). Hereda v4.
// VERSION: v4 · 2026-08-11 · Oculta TEMPORALMENTE en "Tareas de procesos" las tareas de la gestión ANTIGUA
//   de Términos (nodos T*/ tarea "Notificar") para TODO el personal, hasta estabilizar el módulo de Términos.
//   Reversible: poner OCULTAR_TAREAS_TERMINOS = false y vuelven a aparecer. Hereda v3.
// VERSION: v3 · 2026-07-28 · Tarjeta "Alertas" en Mi Portal para Karina, Alberto y Luis: tareas
//   urgentes generadas por el CRM (p.ej. facturar al pasar P→S) y fechas clave. Cada alerta se
//   puede POSPONER (nueva fecha + motivo) o RESOLVER. Lee/escribe la tabla `alertas` (individual
//   por para_email). El enganche automático (que el disparo P→S cree la alerta) va aparte.
// VERSION: v2 · 2026-07-13 · app/procesos/mi-portal/page.js — FIX imports que rompían el build:
//   '../../lib/supabaseClient' → '../../../lib/supabaseClient' (lib está en la raíz, sube 3), y
//   '../components/ui/TopNav' → '@/app/components/ui/TopNav' (alias, como terminos/page.js).
//   Normalizado CRLF→LF. Sin cambios de lógica (el agrupado por antigüedad va aparte).

import { useState, useEffect } from 'react'
import BotonVolver from '../../components/ui/BotonVolver'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabaseClient'
import TopNav from '@/app/components/ui/TopNav'

const DIRECCION_EMAILS = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com']
const ALERTAS_EMAILS = ['karina.morales@fondocapital.com', 'alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com']

// Términos (gestión antigua): ocultar sus tareas de "Tareas de procesos" a TODO el personal hasta estabilizar
// el módulo de Términos. Poner en false para reactivarlas de golpe.
const OCULTAR_TAREAS_TERMINOS = true
const esTareaTermino = (w) =>
  /^T\d/i.test(String(w?.node_codigo || '')) ||
  String(w?.nodo_nombre || '').trim().toLowerCase() === 'notificar'

const PRIORIDAD_COLOR = { ALTA: '#dc2626', MEDIA: '#d97706', BAJA: '#16a34a' }
const ESTADO_COLOR = {
  PENDIENTE: { bg: '#fffbeb', color: '#d97706' },
  EN_PROCESO: { bg: '#eff6ff', color: '#1a56db' },
  COMPLETADA: { bg: '#f0fdf4', color: '#16a34a' },
}
const TIPO_AUS_COLOR = {
  VACACIONES: { bg: '#eff6ff', color: '#1a56db' },
  LICENCIA: { bg: '#fef2f2', color: '#dc2626' },
  PERMISO: { bg: '#fffbeb', color: '#d97706' },
}
const FREC_LABEL = { DIARIA: 'Diaria', SEMANAL: 'Semanal', QUINCENAL: 'Quincenal', MENSUAL: 'Mensual' }

function FiltroColumna({ titulo, valores, seleccionados, onChange }) {
  const [abierto, setAbierto] = useState(false)
  const [busca, setBusca] = useState('')
  const todos = valores.length > 0 && seleccionados.length === valores.length
  const filtrados = valores.filter(v => String(v).toLowerCase().includes(busca.toLowerCase()))
  const activo = seleccionados.length > 0 && seleccionados.length < valores.length
  function toggleUno(v) {
    if (seleccionados.includes(v)) onChange(seleccionados.filter(x => x !== v))
    else onChange([...seleccionados, v])
  }
  function toggleTodos() {
    if (todos) onChange([]); else onChange([...valores])
  }
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {titulo}
      <button onClick={(e) => { e.stopPropagation(); setAbierto(a => !a) }}
        style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 11, lineHeight: 1, padding: '0 2px', color: activo ? '#1a56db' : 'var(--gray-400)', fontWeight: 700 }} title="Filtrar">
        {activo ? '\u25BC\u25CF' : '\u25BC'}
      </button>
      {abierto && (
        <>
          <div onClick={() => setAbierto(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 41, background: 'white', border: '1px solid #ced4da', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,0.15)', padding: 8, width: 220, fontWeight: 400, textTransform: 'none' }}>
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar\u2026"
              style={{ width: '100%', boxSizing: 'border-box', padding: '5px 8px', marginBottom: 6, border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, fontFamily: 'inherit' }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 4px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
              <input type="checkbox" checked={todos} onChange={toggleTodos} />
              <strong>(Seleccionar todo)</strong>
            </label>
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              {filtrados.map(v => (
                <label key={String(v)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 4px', fontSize: 12, cursor: 'pointer' }}>
                  <input type="checkbox" checked={seleccionados.includes(v)} onChange={() => toggleUno(v)} />
                  {String(v) || '(vac\u00edo)'}
                </label>
              ))}
              {filtrados.length === 0 && (<div style={{ fontSize: 11, color: 'var(--gray-400)', padding: 4 }}>Sin coincidencias</div>)}
            </div>
          </div>
        </>
      )}
    </span>
  )
}
export default function MiPortalPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const esDireccion = session?.user?.email && DIRECCION_EMAILS.includes(session.user.email)

  const [trabajadores, setTrabajadores] = useState([])
  const [emailActivo, setEmailActivo] = useState(null)
  const [data, setData] = useState(null)
  const [procVisOpen, setProcVisOpen] = useState(false)
  const [filtrosWf, setFiltrosWf] = useState({ node_codigo: [], idadmon: [], nodo_nombre: [], estado: ['PENDIENTE'] })
  const [filtrosTar, setFiltrosTar] = useState({ titulo: [], estado: [], prioridad: [], fecha_limite: [] })
  const [verCompletadas, setVerCompletadas] = useState(false)   // COMPLETADA ocultas por defecto; toggle para verlas
  const [tareaAbierta, setTareaAbierta] = useState(null)
  const [nuevaTarea, setNuevaTarea] = useState(null)
  const [creandoTarea, setCreandoTarea] = useState(false)
  const [guardandoTarea, setGuardandoTarea] = useState(false)
  const [loading, setLoading] = useState(true)

  // ── Alertas ──
  const [alertas, setAlertas] = useState([])
  const [verResueltas, setVerResueltas] = useState(false)
  const [posponiendo, setPosponiendo] = useState(null)   // alerta en el modal de posponer
  const [posFecha, setPosFecha] = useState('')
  const [posMotivo, setPosMotivo] = useState('')
  const [guardandoAlerta, setGuardandoAlerta] = useState(false)
  const [nuevaAlerta, setNuevaAlerta] = useState(null)     // { tema, cuerpo, fecha_resolver } — asignar a mano
  const [creandoAlerta, setCreandoAlerta] = useState(false)
  const puedeAlertas = session?.user?.email && ALERTAS_EMAILS.includes(session.user.email)

  const cargarAlertas = async (mail) => {
    if (!mail) return
    const { data, error } = await supabase
      .from('alertas')
      .select('*')
      .eq('para_email', mail)
      .order('fecha_resolver', { ascending: true, nullsFirst: false })
      .order('fecha', { ascending: true })
    if (!error) setAlertas(data || [])
  }

  useEffect(() => {
    if (puedeAlertas && emailActivo) cargarAlertas(emailActivo)
  }, [puedeAlertas, emailActivo])

  const abrirPosponer = (a) => {
    setPosponiendo(a)
    setPosFecha(a.fecha_pospuesta || a.fecha_resolver || '')
    setPosMotivo(a.motivo_pospuesta || '')
  }

  const guardarPosponer = async () => {
    if (!posponiendo || !posFecha || guardandoAlerta) return
    setGuardandoAlerta(true)
    const { error } = await supabase.from('alertas')
      .update({ estado: 'pospuesta', fecha_pospuesta: posFecha, motivo_pospuesta: posMotivo || null })
      .eq('id', posponiendo.id)
    setGuardandoAlerta(false)
    if (!error) { setPosponiendo(null); cargarAlertas(emailActivo) }
  }

  const resolverAlerta = async (a) => {
    const { error } = await supabase.from('alertas')
      .update({ estado: 'resuelta', resuelta_at: new Date().toISOString(), resuelta_por: session?.user?.email })
      .eq('id', a.id)
    if (!error) cargarAlertas(emailActivo)
  }

  const reabrirAlerta = async (a) => {
    const { error } = await supabase.from('alertas')
      .update({ estado: 'pendiente', resuelta_at: null, resuelta_por: null })
      .eq('id', a.id)
    if (!error) cargarAlertas(emailActivo)
  }

  // Dirección asigna una alerta a la persona cuyo portal está viendo (queda registrado quién y cuándo).
  const crearAlerta = async () => {
    if (!nuevaAlerta || !(nuevaAlerta.tema || '').trim()) { alert('Escribe un título para la alerta.'); return }
    setCreandoAlerta(true)
    const hoy = new Date().toISOString().slice(0, 10)
    const detalle = (nuevaAlerta.cuerpo || '').trim()
    const cuerpo = (detalle ? detalle + ' · ' : '') + 'Asignada por ' + session.user.email + ' el ' + hoy
    const { error } = await supabase.from('alertas').insert({
      para_email: emailActivo, tema: nuevaAlerta.tema.trim(), cuerpo,
      fecha: hoy, fecha_resolver: nuevaAlerta.fecha_resolver || null,
      estado: 'pendiente', origen: 'manual',
    })
    setCreandoAlerta(false)
    if (error) { alert(error.message || 'No se pudo crear la alerta'); return }
    setNuevaAlerta(null)
    cargarAlertas(emailActivo)
  }

  const alertasVisibles = (alertas || []).filter(a => verResueltas ? true : a.estado !== 'resuelta')
  const nPendientes = (alertas || []).filter(a => a.estado !== 'resuelta').length

  // Permiso de acceso + redirección de externos a su portal
  useEffect(() => {
    if (status === 'loading') return
    if (!session) { router.replace('/panel'); return }
    supabase.from('colaboradores_externos')
      .select('id').eq('email', session.user.email).eq('activo', true).maybeSingle()
      .then(({ data }) => { if (data) router.replace('/portal-externo') })
  }, [session, status, router])

  useEffect(() => {
    if (session?.user?.email && !emailActivo) setEmailActivo(session.user.email)
  }, [session, emailActivo])

  useEffect(() => {
    if (!esDireccion) return
    supabase.from('control_asistencia_trabajadores')
      .select('id, nombre_real, email').eq('activo', true).order('nombre_real')
      .then(({ data }) => setTrabajadores(data || []))
  }, [esDireccion])

  useEffect(() => {
    if (!emailActivo) return
    cargarPortal(emailActivo)
  }, [emailActivo])

  async function cargarPortal(email) {
    setLoading(true)
    try {
      const res = await fetch(`/api/portal?email=${encodeURIComponent(email)}${esDireccion ? '&incluirOcultos=1' : ''}`)
      const d = await res.json()
      setData(d)
    } catch (e) {
      setData({ error: e.message })
    }
    setLoading(false)
  }

  async function toggleProcesoVisibilidad(codigo, ocultoActual) {
    await fetch('/api/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'proceso_visibilidad', codigo, oculto_personal: !ocultoActual }),
    })
    cargarPortal(emailActivo)
  }

  async function marcarPeriodicaHecha(id) {
    await fetch('/api/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'periodica_hecha', id, por: session.user.email }),
    })
    cargarPortal(emailActivo)
  }

    async function guardarTarea() {
      if (!tareaAbierta) return
      if (tareaAbierta.estado === 'COMPLETADA' && !(tareaAbierta.comentario_cierre || '').trim()) {
        alert('Para completar la tarea, escribe que se hizo.')
        return
      }
      setGuardandoTarea(true)
      await fetch('/api/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'tarea_guardar',
          id: tareaAbierta.id,
          estado: tareaAbierta.estado,
          comentario_cierre: tareaAbierta.comentario_cierre || null,
          link_resultado: tareaAbierta.link_resultado || null,
        }),
      })
      setGuardandoTarea(false)
      setTareaAbierta(null)
      cargarPortal(emailActivo)
    }

    async function crearTarea() {
      if (!nuevaTarea || !(nuevaTarea.titulo || '').trim()) { alert('Escribe un titulo para la tarea.'); return }
      setCreandoTarea(true)
      await fetch('/api/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'tarea_crear',
          titulo: nuevaTarea.titulo,
          descripcion: nuevaTarea.descripcion || null,
          responsable: emailActivo,
          prioridad: nuevaTarea.prioridad || 'MEDIA',
          fecha_limite: nuevaTarea.fecha_limite || null,
          created_by: session.user.email,
        }),
      })
      setCreandoTarea(false)
      setNuevaTarea(null)
      cargarPortal(emailActivo)
    }

  function fmtFecha(f) {
    if (!f) return '—'
    const d = new Date(f)
    return d.toLocaleDateString('es-CL')
  }

  if (status === 'loading' || !session) return null

  const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }
  const cardHead = { padding: '12px 18px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--gray-700)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }
  const td = { padding: '9px 14px', fontSize: 13, color: 'var(--gray-700)', borderBottom: '1px solid var(--border-subtle)' }
  const th = { textAlign: 'left', padding: '8px 14px', fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.04em' }

  const tareas = data?.tareas || []
  const workflowRaw = data?.workflow || []
  // Oculta las tareas de la gestión antigua de Términos (para todos), de forma reversible.
  const workflow = OCULTAR_TAREAS_TERMINOS ? workflowRaw.filter(w => !esTareaTermino(w)) : workflowRaw
  const periodicas = data?.periodicas || []
  const wfValores = {
    node_codigo: [...new Set(workflow.map(w => w.node_codigo).filter(v => v != null))].sort(),
    idadmon:     [...new Set(workflow.map(w => w.idadmon).filter(v => v != null))].sort(),
    nodo_nombre: [...new Set(workflow.map(w => w.nodo_nombre).filter(v => v != null))].sort(),
    estado:      [...new Set(workflow.map(w => w.estado).filter(v => v != null))].sort(),
  }
  const wfFiltrado = workflow.filter(w =>
    (filtrosWf.node_codigo.length === 0 || filtrosWf.node_codigo.includes(w.node_codigo)) &&
    (filtrosWf.idadmon.length === 0     || filtrosWf.idadmon.includes(w.idadmon)) &&
    (filtrosWf.nodo_nombre.length === 0 || filtrosWf.nodo_nombre.includes(w.nodo_nombre)) &&
    (filtrosWf.estado.length === 0      || filtrosWf.estado.includes(w.estado))
  )
  const tarValores = {
    titulo:       [...new Set(tareas.map(t => t.titulo).filter(v => v != null))].sort(),
    estado:       [...new Set(tareas.map(t => t.estado).filter(v => v != null))].sort(),
    prioridad:    [...new Set(tareas.map(t => t.prioridad).filter(v => v != null))].sort(),
    fecha_limite: [...new Set(tareas.map(t => t.fecha_limite).filter(v => v != null))].sort(),
  }
  const nCompletadas = tareas.filter(t => t.estado === 'COMPLETADA').length
  const tarFiltrado = tareas.filter(t =>
    (verCompletadas || t.estado !== 'COMPLETADA') &&
    (filtrosTar.titulo.length === 0       || filtrosTar.titulo.includes(t.titulo)) &&
    (filtrosTar.estado.length === 0       || filtrosTar.estado.includes(t.estado)) &&
    (filtrosTar.prioridad.length === 0    || filtrosTar.prioridad.includes(t.prioridad)) &&
    (filtrosTar.fecha_limite.length === 0 || filtrosTar.fecha_limite.includes(t.fecha_limite))
  )
  const asistencia = data?.asistencia || null
  const ausencias = data?.ausencias || []
  const nombre = data?.trabajador?.nombre_real || emailActivo
  const diasVacaciones = ausencias.filter(a => a.tipo === 'VACACIONES').reduce((s, a) => s + (a.dias_habiles || 0), 0)

  return (
    <>
      <TopNav />
      <BotonVolver />
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 28px' }}>
        {/* Cabecera */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--gray-800)', margin: 0 }}>Mi Portal</h1>
            <div style={{ fontSize: 13, color: 'var(--gray-400)', marginTop: 4 }}>{nombre}</div>
          </div>
          {esDireccion && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', marginRight: 8 }}>Ver portal de:</label>
                <select value={emailActivo || ''} onChange={e => setEmailActivo(e.target.value)}
                  style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', background: 'var(--surface)' }}>
                  <option value={session.user.email}>Yo ({session.user.email})</option>
                  {trabajadores.map(t => <option key={t.id} value={t.email}>{t.nombre_real}</option>)}
                </select>
              </div>
              <button onClick={() => router.push('/portal-externo')}
                style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #7c2d12', background: '#fff7ed', color: '#7c2d12', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                Ver colaboradores externos →
              </button>
              <div style={{ position: 'relative' }}>
                <button onClick={() => setProcVisOpen(o => !o)}
                  style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--gray-700)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                  Visibilidad de procesos ▾
                </button>
                {procVisOpen && (
                  <>
                    <div onClick={() => setProcVisOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                    <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, zIndex: 41, background: 'white', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 6px 20px rgba(0,0,0,0.15)', padding: 12, width: 320 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Ocultar procesos al personal</div>
                      {(data?.procesos || []).length === 0 ? (
                        <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>Sin procesos</div>
                      ) : (data?.procesos || []).map(p => (
                        <label key={p.codigo} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', fontSize: 13, cursor: 'pointer' }}>
                          <input type="checkbox" checked={!!p.oculto_personal} onChange={() => toggleProcesoVisibilidad(p.codigo, p.oculto_personal)} />
                          <span style={{ fontWeight: 600 }}>{p.codigo}</span>
                          <span style={{ color: 'var(--gray-400)', fontSize: 12 }}>{p.nombre}</span>
                        </label>
                      ))}
                      <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 8, lineHeight: 1.4 }}>
                        Marcado = oculto en la vista del personal. Tú (Dirección) lo sigues viendo siempre.
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)' }}>Cargando…</div>
        ) : (
          <>
            {/* ZONA DE TRABAJO — 2 columnas */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 18, marginBottom: 28 }}>
              {/* Tareas encargadas */}
              <div style={card}>
                <div style={cardHead}><span>📋 Tareas encargadas</span><span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{esDireccion && emailActivo && emailActivo !== session.user.email && (<button onClick={() => setNuevaTarea({ titulo: '', descripcion: '', prioridad: 'MEDIA', fecha_limite: '' })} style={{ padding: '3px 10px', borderRadius: 6, border: 'none', background: '#1a56db', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>+ Nueva tarea</button>)}{nCompletadas > 0 && (<button onClick={() => setVerCompletadas(v => !v)} title="Las tareas completadas se ocultan; pulsa para verlas" style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid var(--gray-300)', background: 'transparent', fontSize: 11, fontWeight: 600, color: 'var(--gray-600)', cursor: 'pointer', fontFamily: 'inherit' }}>{verCompletadas ? 'Ocultar completadas' : `Ver completadas (${nCompletadas})`}</button>)}<span style={{ color: 'var(--gray-400)' }}>{tarFiltrado.length}{tarFiltrado.length !== tareas.length ? ' / ' + tareas.length : ''}</span></span></div>
                {tareas.length === 0 ? (
                  <div style={{ padding: 18, fontSize: 13, color: 'var(--gray-400)' }}>Sin tareas asignadas</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: 'var(--gray-50)' }}><th style={th}><FiltroColumna titulo="Título" valores={tarValores.titulo} seleccionados={filtrosTar.titulo} onChange={v => setFiltrosTar(f => ({ ...f, titulo: v }))} /></th><th style={th}><FiltroColumna titulo="Estado" valores={tarValores.estado} seleccionados={filtrosTar.estado} onChange={v => setFiltrosTar(f => ({ ...f, estado: v }))} /></th><th style={th}><FiltroColumna titulo="Prior." valores={tarValores.prioridad} seleccionados={filtrosTar.prioridad} onChange={v => setFiltrosTar(f => ({ ...f, prioridad: v }))} /></th><th style={th}>Límite</th></tr></thead>
                    <tbody>
                      {tarFiltrado.map(t => {
                        const ec = ESTADO_COLOR[t.estado] || { bg: '#f3f4f6', color: '#6b7280' }
                        return (
                          <tr key={t.id} onClick={() => setTareaAbierta({ ...t })} style={{ cursor: 'pointer' }}>
                            <td style={td}>{t.titulo}</td>
                            <td style={td}><span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 6, background: ec.bg, color: ec.color }}>{t.estado}</span></td>
                            <td style={{ ...td, color: PRIORIDAD_COLOR[t.prioridad] || 'var(--gray-600)', fontWeight: 600 }}>{t.prioridad || '—'}</td>
                            <td style={td}>{fmtFecha(t.fecha_limite)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Workflow */}
              <div style={card}>
                <div style={cardHead}><span>⚙️ Tareas de procesos</span><span style={{ color: 'var(--gray-400)' }}>{workflow.length}</span></div>
                {workflow.length === 0 ? (
                  <div style={{ padding: 18, fontSize: 13, color: 'var(--gray-400)' }}>Sin tareas de workflow</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: 'var(--gray-50)' }}>
                        <th style={th}><FiltroColumna titulo="Nodo" valores={wfValores.node_codigo} seleccionados={filtrosWf.node_codigo} onChange={v => setFiltrosWf(f => ({ ...f, node_codigo: v }))} /></th>
                        <th style={th}><FiltroColumna titulo="IDADMON" valores={wfValores.idadmon} seleccionados={filtrosWf.idadmon} onChange={v => setFiltrosWf(f => ({ ...f, idadmon: v }))} /></th>
                        <th style={th}><FiltroColumna titulo="Tarea" valores={wfValores.nodo_nombre} seleccionados={filtrosWf.nodo_nombre} onChange={v => setFiltrosWf(f => ({ ...f, nodo_nombre: v }))} /></th>
                        <th style={th}><FiltroColumna titulo="Estado" valores={wfValores.estado} seleccionados={filtrosWf.estado} onChange={v => setFiltrosWf(f => ({ ...f, estado: v }))} /></th>
                        <th style={th}>Inicio</th><th style={th}>Límite</th></tr></thead>
                    <tbody>
                      {wfFiltrado.map(w => (
                          <tr key={w.id} onClick={() => w.idadmon && router.push('/procesos/terminos/' + w.idadmon)} style={{ cursor: w.idadmon ? 'pointer' : 'default' }} onMouseEnter={e => { if (w.idadmon) e.currentTarget.style.background = '#F4F8FE' }} onMouseLeave={e => e.currentTarget.style.background = ''}>
                            <td style={td}>{w.node_codigo}</td>
                            <td style={td}>{w.idadmon || '-'}</td>
                            <td style={td}>{w.nodo_nombre}</td>
                            <td style={td}>{w.estado}</td>
                            <td style={td}>{fmtFecha(w.fecha_inicio)}</td>
                            <td style={td}>{fmtFecha(w.fecha_limite)}</td>
                          </tr>
                        ))}
                        {wfFiltrado.length === 0 && (
                          <tr><td style={td} colSpan={6}><span style={{ color: 'var(--gray-400)', fontSize: 12 }}>Ninguna tarea coincide con el filtro</span></td></tr>
                        )}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Periódicas — ocupa el ancho (segunda fila) */}
              <div style={{ ...card, gridColumn: '1 / -1' }}>
                <div style={cardHead}><span>🔄 Actividades periódicas</span><span style={{ color: 'var(--gray-400)' }}>{periodicas.length}</span></div>
                {periodicas.length === 0 ? (
                  <div style={{ padding: 18, fontSize: 13, color: 'var(--gray-400)' }}>Sin actividades periódicas</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: 'var(--gray-50)' }}><th style={th}>Actividad</th><th style={th}>Frecuencia</th><th style={th}>Ruta</th><th style={th}>Última vez</th><th style={th}></th></tr></thead>
                    <tbody>
                      {periodicas.map(p => (
                        <tr key={p.id}>
                          <td style={td}>{p.titulo}{p.descripcion && <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{p.descripcion}</div>}</td>
                          <td style={td}>{FREC_LABEL[p.frecuencia] || p.frecuencia}</td>
                          <td style={td}>{p.ruta_destino ? <a href={p.ruta_destino} target="_blank" rel="noopener noreferrer" style={{ color: '#1a56db' }}>Abrir →</a> : '—'}</td>
                          <td style={td}>{fmtFecha(p.ultima_ejecucion)}</td>
                          <td style={td}>
                            <button onClick={() => marcarPeriodicaHecha(p.id)}
                              style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: '#16a34a', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                              Hecho hoy
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* ALERTAS — tareas urgentes generadas por el CRM y fechas clave */}
              {puedeAlertas && (
                <div style={{ ...card, gridColumn: '1 / -1' }}>
                  <div style={cardHead}>
                    <span>🔔 Alertas</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {esDireccion && emailActivo && emailActivo !== session.user.email && (
                        <button onClick={() => setNuevaAlerta({ tema: '', cuerpo: '', fecha_resolver: '' })}
                          style={{ padding: '3px 10px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>+ Nueva alerta</button>
                      )}
                      <button onClick={() => setVerResueltas(v => !v)}
                        style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid var(--border)', background: verResueltas ? '#EEF3F8' : '#fff', color: 'var(--gray-600)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                        {verResueltas ? 'Ocultar resueltas' : 'Ver resueltas'}
                      </button>
                      <span style={{ color: nPendientes ? '#d97706' : 'var(--gray-400)', fontWeight: nPendientes ? 700 : 400 }}>{nPendientes} pendiente(s)</span>
                    </span>
                  </div>
                  {alertasVisibles.length === 0 ? (
                    <div style={{ padding: 18, fontSize: 13, color: 'var(--gray-400)' }}>Sin alertas{verResueltas ? '' : ' pendientes'}.</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr style={{ background: 'var(--gray-50)' }}>
                        <th style={th}>Tema</th>
                        <th style={th}>Fecha</th>
                        <th style={th}>A resolver</th>
                        <th style={th}>Motivo aplazamiento</th>
                        <th style={th}>Estado</th>
                        <th style={th}></th>
                      </tr></thead>
                      <tbody>
                        {alertasVisibles.map(a => {
                          const resuelta = a.estado === 'resuelta'
                          const pospuesta = a.estado === 'pospuesta'
                          const objetivo = a.fecha_pospuesta || a.fecha_resolver
                          const vencida = objetivo && !resuelta && objetivo < new Date().toISOString().slice(0, 10)
                          return (
                            <tr key={a.id} style={{ opacity: resuelta ? 0.55 : 1 }}>
                              <td style={td}>
                                <div style={{ fontWeight: 500, color: 'var(--gray-800)' }}>{a.tema}</div>
                                {a.ref_idadmon && <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{a.ref_idadmon}{a.origen ? ' · ' + a.origen : ''}</div>}
                                {a.cuerpo && <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>{a.cuerpo}</div>}
                              </td>
                              <td style={td}>{fmtFecha(a.fecha)}</td>
                              <td style={{ ...td, color: vencida ? '#B23A3A' : 'var(--gray-700)', fontWeight: vencida ? 700 : 400 }}>
                                {fmtFecha(objetivo) || '—'}{pospuesta && <span style={{ fontSize: 10, color: '#0C447C', marginLeft: 4 }}>(pospuesta)</span>}
                              </td>
                              <td style={{ ...td, fontSize: 12, color: 'var(--gray-500)' }}>{a.motivo_pospuesta || '—'}</td>
                              <td style={td}>
                                <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 6,
                                  background: resuelta ? '#E1F5EE' : pospuesta ? '#EEF3F8' : '#FEF3E2',
                                  color: resuelta ? '#085041' : pospuesta ? '#0C447C' : '#92400E' }}>
                                  {resuelta ? 'Resuelta' : pospuesta ? 'Pospuesta' : 'Pendiente'}
                                </span>
                              </td>
                              <td style={{ ...td, whiteSpace: 'nowrap' }}>
                                {resuelta ? (
                                  <button onClick={() => reabrirAlerta(a)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: '#fff', color: 'var(--gray-600)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Reabrir</button>
                                ) : (
                                  <span style={{ display: 'flex', gap: 6 }}>
                                    <button onClick={() => abrirPosponer(a)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #D3D1C7', background: '#fff', color: '#0C447C', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Posponer</button>
                                    <button onClick={() => resolverAlerta(a)} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#16a34a', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Resolver</button>
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>

            {/* ZONA DE INFORMACIÓN PERSONAL */}
            <div style={{ background: 'var(--gray-50)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 22px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
                Información personal
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 18 }}>
                <div style={{ ...card, padding: '16px 18px' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vacaciones tomadas (2026)</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#1a56db', marginTop: 4 }}>{diasVacaciones} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--gray-400)' }}>días hábiles</span></div>
                </div>
                {asistencia && (
                  <>
                    <div style={{ ...card, padding: '16px 18px' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Saldo horas (mes)</div>
                      <div style={{ fontSize: 28, fontWeight: 700, color: (asistencia.saldo_mes_a_fecha ?? 0) >= 0 ? '#16a34a' : '#dc2626', marginTop: 4 }}>{asistencia.saldo_mes_a_fecha ?? '—'}</div>
                    </div>
                    <div style={{ ...card, padding: '16px 18px' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Incidencias abiertas</div>
                      <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--gray-800)', marginTop: 4 }}>{asistencia.incidencias_abiertas_mes ?? 0}</div>
                    </div>
                  </>
                )}
              </div>

              <div style={card}>
                <div style={cardHead}><span>🏖️ Mis ausencias</span><span style={{ color: 'var(--gray-400)' }}>{ausencias.length}</span></div>
                {ausencias.length === 0 ? (
                  <div style={{ padding: 18, fontSize: 13, color: 'var(--gray-400)' }}>Sin ausencias registradas</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: 'var(--gray-100)' }}><th style={th}>Tipo</th><th style={th}>Desde</th><th style={th}>Hasta</th><th style={th}>Días</th><th style={th}>Motivo</th></tr></thead>
                    <tbody>
                      {ausencias.map(a => {
                        const ct = TIPO_AUS_COLOR[a.tipo] || { bg: '#f3f4f6', color: '#6b7280' }
                        return (
                          <tr key={a.id}>
                            <td style={td}><span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: ct.bg, color: ct.color }}>{a.tipo}{a.recuperable ? ' ↻' : ''}</span></td>
                            <td style={td}>{fmtFecha(a.fecha_inicio)}</td>
                            <td style={td}>{fmtFecha(a.fecha_fin)}</td>
                            <td style={td}>{a.dias_habiles ?? '—'}</td>
                            <td style={{ ...td, color: 'var(--gray-400)', fontSize: 12 }}>{a.motivo || '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
                  {tareaAbierta && (
        <div onClick={() => setTareaAbierta(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 12, padding: 24, width: 'min(560px, 100%)', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.25)' }}>
            <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 4 }}>Tarea encargada{tareaAbierta.idadmon ? ' · ' + tareaAbierta.idadmon : ''}</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>{tareaAbierta.titulo}</div>
            {tareaAbierta.descripcion && <div style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 16, lineHeight: 1.5 }}>{tareaAbierta.descripcion}</div>}
 
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--gray-700)', marginBottom: 4 }}>Estado</label>
            <select value={tareaAbierta.estado || 'PENDIENTE'} onChange={e => setTareaAbierta({ ...tareaAbierta, estado: e.target.value })}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', marginBottom: 14, background: 'var(--surface)' }}>
              <option value="PENDIENTE">Pendiente</option>
              <option value="EN_PROCESO">En proceso</option>
              <option value="COMPLETADA">Completada</option>
            </select>
 
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--gray-700)', marginBottom: 4 }}>Qué se hizo</label>
            <textarea value={tareaAbierta.comentario_cierre || ''} onChange={e => setTareaAbierta({ ...tareaAbierta, comentario_cierre: e.target.value })}
              rows={4} placeholder="Explica qué se hizo…"
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', marginBottom: 14, resize: 'vertical' }} />
 
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--gray-700)', marginBottom: 4 }}>Dónde se guardó / enlace <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>(opcional)</span></label>
            <input value={tareaAbierta.link_resultado || ''} onChange={e => setTareaAbierta({ ...tareaAbierta, link_resultado: e.target.value })}
              placeholder="Enlace a Drive, ruta, o vacío"
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', marginBottom: 20 }} />
 
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setTareaAbierta(null)} disabled={guardandoTarea}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
              <button onClick={guardarTarea} disabled={guardandoTarea}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{guardandoTarea ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {posponiendo && (
        <div onClick={() => setPosponiendo(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 12, padding: 24, width: 'min(480px, 100%)', boxShadow: '0 10px 40px rgba(0,0,0,0.25)' }}>
            <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 4 }}>Posponer alerta</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--gray-900)' }}>{posponiendo.tema}</div>

            <label style={{ fontSize: 12, color: 'var(--gray-600)', display: 'block', marginBottom: 4 }}>Nueva fecha para resolverla</label>
            <input type="date" value={posFecha} onChange={e => setPosFecha(e.target.value)}
              style={{ width: '100%', fontSize: 13, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 14 }} />

            <label style={{ fontSize: 12, color: 'var(--gray-600)', display: 'block', marginBottom: 4 }}>Motivo del aplazamiento</label>
            <textarea value={posMotivo} onChange={e => setPosMotivo(e.target.value)} rows={3}
              placeholder="Ej.: se retrasa la factura al mes siguiente para posponer el IVA"
              style={{ width: '100%', fontSize: 13, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 18, resize: 'vertical' }} />

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setPosponiendo(null)}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: '#fff', color: 'var(--gray-600)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
              <button onClick={guardarPosponer} disabled={!posFecha || guardandoAlerta}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: posFecha ? '#0C447C' : '#C9C7BF', color: '#fff', fontSize: 13, fontWeight: 600, cursor: posFecha ? 'pointer' : 'default', fontFamily: 'inherit' }}>
                {guardandoAlerta ? 'Guardando…' : 'Posponer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {nuevaTarea && (
        <div onClick={() => setNuevaTarea(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 12, padding: 24, width: 'min(560px, 100%)', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.25)' }}>
            <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 4 }}>Nueva tarea para {nombre}</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Encargar tarea</div>

            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--gray-700)', marginBottom: 4 }}>Titulo</label>
            <input value={nuevaTarea.titulo} onChange={e => setNuevaTarea({ ...nuevaTarea, titulo: e.target.value })}
              placeholder="Titulo de la tarea"
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', marginBottom: 14 }} />

            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--gray-700)', marginBottom: 4 }}>Descripcion</label>
            <textarea value={nuevaTarea.descripcion} onChange={e => setNuevaTarea({ ...nuevaTarea, descripcion: e.target.value })}
              rows={3} placeholder="Detalle de lo que hay que hacer"
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', marginBottom: 14, resize: 'vertical' }} />

            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--gray-700)', marginBottom: 4 }}>Prioridad</label>
                <select value={nuevaTarea.prioridad} onChange={e => setNuevaTarea({ ...nuevaTarea, prioridad: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', background: 'var(--surface)' }}>
                  <option value="ALTA">Alta</option>
                  <option value="MEDIA">Media</option>
                  <option value="BAJA">Baja</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--gray-700)', marginBottom: 4 }}>Fecha limite</label>
                <input type="date" value={nuevaTarea.fecha_limite} onChange={e => setNuevaTarea({ ...nuevaTarea, fecha_limite: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit' }} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setNuevaTarea(null)} disabled={creandoTarea}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
              <button onClick={crearTarea} disabled={creandoTarea}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#1a56db', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{creandoTarea ? 'Creando\u2026' : 'Crear tarea'}</button>
            </div>
          </div>
        </div>
      )}

      {nuevaAlerta && (
        <div onClick={() => setNuevaAlerta(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 12, padding: 24, width: 'min(560px, 100%)', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.25)' }}>
            <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 4 }}>Nueva alerta para {nombre}</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Asignar alerta</div>

            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--gray-700)', marginBottom: 4 }}>T\u00edtulo</label>
            <input value={nuevaAlerta.tema} onChange={e => setNuevaAlerta({ ...nuevaAlerta, tema: e.target.value })}
              placeholder="Ej.: Revisar cobro urgente A00xxx"
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', marginBottom: 14 }} />

            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--gray-700)', marginBottom: 4 }}>Detalle (opcional)</label>
            <textarea value={nuevaAlerta.cuerpo} onChange={e => setNuevaAlerta({ ...nuevaAlerta, cuerpo: e.target.value })}
              rows={3} placeholder="Qu\u00e9 hay que hacer y por qu\u00e9 es prioritario"
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', marginBottom: 14, resize: 'vertical' }} />

            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--gray-700)', marginBottom: 4 }}>Fecha para resolver (opcional)</label>
            <input type="date" value={nuevaAlerta.fecha_resolver} onChange={e => setNuevaAlerta({ ...nuevaAlerta, fecha_resolver: e.target.value })}
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', marginBottom: 20 }} />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setNuevaAlerta(null)} disabled={creandoAlerta}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
              <button onClick={crearAlerta} disabled={creandoAlerta || !(nuevaAlerta.tema || '').trim()}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: (nuevaAlerta.tema || '').trim() ? '#dc2626' : '#C9C7BF', color: '#fff', fontSize: 13, fontWeight: 600, cursor: (nuevaAlerta.tema || '').trim() ? 'pointer' : 'default', fontFamily: 'inherit' }}>{creandoAlerta ? 'Creando\u2026' : 'Asignar alerta'}</button>
            </div>
          </div>
        </div>
      )}
          </>
        )}
      </div>
    </>
  )
}