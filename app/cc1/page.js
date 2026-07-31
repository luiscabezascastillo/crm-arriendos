// VERSION: v7 · 2026-07-30 · Color de fondo por estado en las 2 primeras columnas (idadmon/inmueble),
//   como en el Excel: P marrón, SQ amarillo-ámbar pálido, Q violeta, N gris, N-DICOM rojizo. Además,
//   un P cuyo DEPARTAMENTO (idinmue en rango 01-49) tiene otra versión en SQ se pinta marrón+violeta
//   (idadmon marrón, inmueble violeta) → señal de que el piso sigue ocupado y la visita se coordina
//   con el arrendatario actual. Estacionamientos/bodegas sueltos (51-99) nunca llevan la mezcla.
// VERSION: v6 · 2026-07-28 · Filtros estilo Excel en TODAS las columnas (mismo motor que SA, ahora
//   en lib/filtroExcel.js). Para que los operadores (cuota > X, entre fechas, dos condiciones Y/O)
//   funcionen, la tabla carga los contratos de una vez y filtra/ordena/pagina EN MEMORIA en vez de
//   pedir 15 filas por página a la BD. El paginador se mantiene sobre el resultado ya filtrado.
// VERSION: v5 · 2026-07-28 · Botón "Comentarios" en la barra del LOG → /cc1/comentarios.
//   Visible para todos los que ven el LOG (no solo editores): cualquiera puede añadir hechos
//   del mes por contrato. Editar/borrar: cada uno lo suyo; Dirección (admin) todo.
// VERSION: v4 · 2026-07-21 · Filtro de Estado muestra el significado de cada código (S Activo, P Vacío, Q En término, SQ Activo c/aviso, N/N-DICOM Histórico)
// VERSION: v3 · 2026-07-16 · LOG: "Vencido" ya no se muestra en términos cerrados (N/N-DICOM/N-Liquidacion) — un término cerrado no está vencido. Hereda v2 ("Calcular ajustes" solo Dirección/Legal/Administración)
'use client'

import Link from 'next/link'
import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { supabase } from '../../lib/supabaseClient'
import { HeaderFilter, filtroActivo, aplicarFiltros } from '../../lib/filtroExcel'
import TopNav from '../components/ui/TopNav'

// Mismo criterio de edición que /cc1/propietarios: Dirección, Legal y Administración.
// "Calcular ajustes" solo se muestra a quien puede editar; el resto (p. ej. Karina,
// Finanzas, que entra a ver) no lo ve.
const ROLES_EDIT = ['admin', 'legal', 'operaciones']
const EMAILS_OK = [
  'luis.cabezas@fondocapital.com', 'alberto.cabezas@fondocapital.com',
  'anthony.mendoza@fondocapital.com', 'adalis@fondocapital.com', 'fabiola.guerra@fondocapital.com',
]

const PORTAL_URL = 'https://portal-propietarios-rose.vercel.app'

const estadoMap = {
  S:          { bg: '#eff6ff', color: '#1a56db' },
  SQ:         { bg: '#f0fdf4', color: '#16a34a' },
  P:          { bg: '#fffbeb', color: '#d97706' },
  Q:          { bg: '#fffbeb', color: '#d97706' },
  N:          { bg: '#f3f4f6', color: '#6b7280' },
  'N-DICOM':  { bg: '#fef2f2', color: '#dc2626' },
}

const opEspecialesCC1 = [
  { label: 'Creación y edición de Contratos',              href: '/op/contratos' },
  { label: 'Preparación liquidación de Paola',             href: '/op/liquidacion-paola' },
  { label: 'Actualización mensual de Comunidad Feliz',          href: '/op/comunidad-feliz' },
  { label: 'Deudas de servicios',                                    href: '/op/deudas' },
]

// Significado de cada estado, para tooltips y para el desplegable del filtro (ayuda a la formación).
const ESTADO_DESC = {
  'S': 'Vigente',
  'SQ': 'Vigente y notificación de término',
  'Q': 'Término',
  'P': 'Pendiente (vacío, buscando arrendatario)',
  'N': 'Cerrado / histórico',
  'N-DICOM': 'Histórico, todavía en DICOM',
}
function descEstado(e) {
  const k = estadoNorm(e)
  return ESTADO_DESC[k] || ''
}

function EstadoBadge({ estado }) {
  const s = estadoMap[estado] || { bg: '#f3f4f6', color: '#6b7280' }
  const desc = descEstado(estado)
  return (
    <span title={desc ? `${estado} · ${desc}` : (estado || '')}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      padding: '2px 7px', borderRadius: 6, background: s.bg, color: s.color, fontSize: 11, fontWeight: 600 }}>
      {estado || '—'}
    </span>
  )
}

function ActionBtn({ label, bg, icon, onClick }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 6,
      padding: '7px 13px', borderRadius: 8, border: 'none', background: bg, color: '#fff',
      fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
      onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
      onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
      {icon}{label}
    </button>
  )
}

function OperacionesBtn({ opciones, router }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden' }}>
        <button onClick={() => setOpen(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 10px 7px 13px', border: 'none', background: '#c2410c', color: '#fff',
          fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
          {Ico.gear} Operaciones
        </button>
        <button onClick={() => setOpen(v => !v)} style={{ padding: '7px 9px', border: 'none',
          borderLeft: '1px solid rgba(255,255,255,0.25)', background: '#c2410c', color: '#fff',
          cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
            style={{ transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            <path d="M6 9l6 6 6-6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)', minWidth: 290, zIndex: 100, overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px 6px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Operaciones especiales CC1
            </div>
          </div>
          <div style={{ padding: 4 }}>
            {opciones.map((op, i) => (
              <button key={i} onClick={() => { setOpen(false); router.push(op.href) }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  padding: '9px 12px', borderRadius: 7, fontSize: 12, fontWeight: 400,
                  color: 'var(--gray-700)', background: 'transparent', border: 'none',
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-50)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#c2410c', flexShrink: 0 }} />
                {op.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}


const Ico = {
  comment: <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  edit:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  users: <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/></svg>,
  home:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  calc:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="4" y="2" width="16" height="20" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M8 6h8M8 10h8M8 14h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  gear:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="2"/></svg>,
  lock:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  plus:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  search:<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/><path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  back:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polyline points="15 18 9 12 15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  portal:<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><polyline points="15 3 21 3 21 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="10" y1="14" x2="21" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
}

const tabs = ['Datos base', 'Operación', 'Ajustes', 'Cierre']

function alertaTermino(fecha, estado) {
  if (!fecha) return null
  // Los términos cerrados (N, N-DICOM, N-Liquidacion) no se marcan "Vencido": están cerrados, no vencidos.
  if (String(estado || '').toUpperCase().startsWith('N')) return null
  const hoy = new Date()
  const termino = new Date(fecha)
  const dias = Math.ceil((termino - hoy) / (1000 * 60 * 60 * 24))
  if (dias < 0) return { color: '#dc2626', text: 'Vencido' }
  if (dias <= 30) return { color: '#dc2626', text: `${dias}d` }
  if (dias <= 60) return { color: '#d97706', text: `${dias}d` }
  return null
}


// Orden de los estados de arriba abajo en el LOG (ciclo de vida: activos primero, cerrados al final).
const ORDEN_ESTADO = { S: 0, SQ: 1, Q: 2, P: 3, N: 4, 'N-DICOM': 5 }
const rankEstado = (e) => {
  const k = estadoNorm(e)
  return (k in ORDEN_ESTADO) ? ORDEN_ESTADO[k] : 99
}

// ── Colores de fondo por estado (paleta del Excel) ──
const COL_ESTADO = {
  P:  '#EADDC7',   // marrón claro: vacío, buscando arrendatario
  SQ: '#FCF4D6',   // amarillo-ámbar pálido: notificó salida, en transición
  Q:  '#E7E0F0',   // violeta claro: terminado
  N:  '#EAEAEA',   // gris: cerrado / histórico
}
const COL_NDICOM = '#F5D9D6'  // rojizo: N-DICOM (reclamación)
const COL_MARRON = '#EADDC7'
const COL_VIOLETA = '#E7E0F0'

// El idinmue de un departamento es el código cuyo número está en 01-49 (regla de numeración:
// 01-49 depto, 51-79 bodega, 81-99 estacionamiento). idlinmue puede traer varios separados por
// espacio ("P001-14 P001-85"); devolvemos el que sea depto, o null si no hay.
function idinmueDepto(idlinmue) {
  if (!idlinmue) return null
  for (const cod of String(idlinmue).trim().split(/\s+/)) {
    const m = cod.match(/-(\d{2,})$/)
    if (m) { const n = parseInt(m[1], 10); if (n >= 1 && n <= 49) return cod }
  }
  return null
}

// Normaliza el estado para leer N-DICOM en sus variantes.
function estadoNorm(e) {
  return String(e || '').trim().toUpperCase().replace('N_DICOM', 'N-DICOM').replace('N DICOM', 'N-DICOM')
}

// Columnas del LOG para el filtro estilo Excel (mismo motor que SA).
const fmtFechaLOG = (v) => { if (!v) return ''; const d = new Date(v); return isNaN(d) ? '' : d.toLocaleDateString('es-CL') }
const LOG_COLS = [
  { key: 'idadmon', label: 'IDADMON', tipo: 'texto',
    fkey: p => p.idadmon || '', flabel: k => (k === '' ? '(vacías)' : k) },
  { key: 'inmueble', label: 'Inmueble', tipo: 'texto',
    fkey: p => p.inmueble || '', flabel: k => (k === '' ? '(vacías)' : k) },
  { key: 'propietario', label: 'Propietario', tipo: 'texto',
    fkey: p => p.propietario || '', flabel: k => (k === '' ? '(vacías)' : k) },
  { key: 'estado', label: 'Estado', tipo: 'texto',
    fkey: p => p.estado || '', flabel: k => (k === '' ? '(vacías)' : (ESTADO_DESC[estadoNorm(k)] ? `${k} · ${ESTADO_DESC[estadoNorm(k)]}` : k)) },
  { key: 'cuota', label: 'Cuota', tipo: 'num',
    fkey: p => (p.cuota == null ? '' : String(p.cuota)),
    flabel: k => (k === '' ? '(vacías)' : Number(k).toLocaleString('es-CL')) },
  { key: 'termino_actual', label: 'Término actual', tipo: 'fecha',
    fkey: p => String(p.termino_actual || '').slice(0, 10),
    flabel: k => (k === '' ? '(vacías)' : fmtFechaLOG(k)) },
  { key: 'idprop', label: 'IDPROP', tipo: 'texto',
    fkey: p => p.idprop || '', flabel: k => (k === '' ? '(vacías)' : k) },
  { key: 'idlinmue', label: 'IDINMUE', tipo: 'texto',
    fkey: p => p.idlinmue || '', flabel: k => (k === '' ? '(vacías)' : k) },
]

export default function CC1Page() {
  const router = useRouter()
  const { data: session } = useSession()
  const email = session?.user?.email
  const rol = session?.user?.role
  const puedeEditar = ROLES_EDIT.includes(rol) || EMAILS_OK.includes(email)
  const [activeTab, setActiveTab] = useState('Datos base')
  const [search, setSearch] = useState('')
  const [recuperarId, setRecuperarId] = useState('')   // caja IDADMON para RECUPERAR
  // Filtro estilo Excel: un estado por columna en `filters`, más `orden` global. Igual que SA.
  const [filters, setFilters] = useState({})       // { colKey: {sel?, c1?, conector?, c2?} }
  const [openFilter, setOpenFilter] = useState(null)
  const [orden, setOrden] = useState(null)         // { key, dir }
  const [todas, setTodas] = useState([])           // TODAS las filas cargadas (sin paginar)
  const [loading, setLoading] = useState(true)
  const [kpis, setKpis] = useState({ total: 0, activos: 0, termino: 0, vacios: 0 })
  const [portalLoading, setPortalLoading] = useState(null) // idadmon cargando
  const [idpropMap, setIdpropMap] = useState({}) // idadmon -> idprop

  useEffect(() => { loadKpis() }, [])
  useEffect(() => { loadTodas() }, [])
  // Al cambiar búsqueda, filtros u orden, volver a la página 1 (paginación sobre lo ya filtrado).

  // Carga ÚNICA de todos los contratos. Con ~837 filas cabe de sobra en memoria; a partir de aquí
  // filtrar, ordenar y paginar se hace en el navegador (como SA), lo que permite el filtro Excel
  // con operadores. Trae en bloques de 1000 por si supera el tope por consulta de Supabase.
  async function loadTodas() {
    setLoading(true)
    const cols = 'idadmon, estado, propietario, idprop, idlinmue, inmueble, cuota, unid, termino_actual, arrendatario'
    let desde = 0, acc = [], hay = true
    while (hay) {
      const { data, error } = await supabase.from('datos_arriendos').select(cols)
        .order('estado', { ascending: false }).order('propietario', { ascending: true }).order('inmueble', { ascending: true })
        .range(desde, desde + 999)
      if (error) break
      acc = acc.concat(data || [])
      hay = (data || []).length === 1000
      desde += 1000
    }
    setTodas(acc)
    const map = {}
    acc.forEach(p => { if (p.idprop) map[p.idadmon] = p.idprop })
    setIdpropMap(prev => ({ ...prev, ...map }))
    setLoading(false)
  }

  async function loadKpis() {
    const { count: total }   = await supabase.from('datos_arriendos').select('*', { count: 'exact', head: true })
    const { count: activos } = await supabase.from('datos_arriendos').select('*', { count: 'exact', head: true }).eq('estado', 'S')
    const { count: termino } = await supabase.from('datos_arriendos').select('*', { count: 'exact', head: true }).eq('estado', 'Q')
    const { count: vacios }  = await supabase.from('datos_arriendos').select('*', { count: 'exact', head: true }).eq('estado', 'P')
    setKpis({ total: total || 0, activos: activos || 0, termino: termino || 0, vacios: vacios || 0 })
  }

  async function verPortal(e, idadmon, idprop) {
    e.stopPropagation()
    if (!idprop) {
      alert('Este contrato no tiene propietario asignado (sin IDPROP)')
      return
    }
    setPortalLoading(idadmon)
    try {
      const res = await fetch('/api/portal/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idprop }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Error al acceder al portal')
        return
      }
      window.open(data.portalUrl, '_blank')
    } catch (err) {
      alert('Error de conexión')
    } finally {
      setPortalLoading(null)
    }
  }

  function limpiarTodo() {
    setSearch(''); setFilters({}); setOrden(null)
  }
  const setFiltroCol = (key, val) => setFilters(f => { const n = { ...f }; if (val == null) delete n[key]; else n[key] = val; return n })
  const hayAlgunFiltro = LOG_COLS.some(c => filtroActivo(filters[c.key]))
  // Filtro rápido de estado (tarjetas KPI + desplegable): se guarda como sel en filters.estado.
  const estadoSel = (filters.estado?.sel && filters.estado.sel.length === 1) ? filters.estado.sel[0] : ''
  const setEstadoRapido = (e) => setFiltroCol('estado', e ? { sel: [e] } : null)

  // Derivación en memoria: búsqueda de texto → filtros de columna → orden.  Orden por defecto
  // (Estado ↓ · Propietario ↑ · Inmueble ↑) si el usuario no ha elegido columna, igual que antes.
  const filtradas = useMemo(() => {
    let base = todas
    const q = search.trim().toLowerCase()
    if (q) base = base.filter(p => ['idadmon','inmueble','propietario','arrendatario']
      .some(k => String(p[k] || '').toLowerCase().includes(q)))
    let out = aplicarFiltros(base, LOG_COLS, filters, orden)
    if (!orden?.key) {
      out = [...out].sort((a, b) =>
        (rankEstado(a.estado) - rankEstado(b.estado)) ||
        String(a.propietario||'').localeCompare(String(b.propietario||''), 'es') ||
        String(a.inmueble||'').localeCompare(String(b.inmueble||''), 'es'))
    }
    return out
  }, [todas, search, filters, orden])

  const total = filtradas.length

  // Deptos (por su idinmue 01-49) que tienen alguna versión en estado SQ. Un P de ese mismo depto
  // se marcará marrón+violeta ("piso aún ocupado, coordinar visita con el arrendatario actual").
  const deptosConSQ = useMemo(() => {
    const s = new Set()
    for (const r of todas) {
      if (estadoNorm(r.estado) === 'SQ') { const d = idinmueDepto(r.idlinmue); if (d) s.add(d) }
    }
    return s
  }, [todas])

  // Devuelve { idadmon, inmueble } con el color de fondo de cada una de las 2 primeras celdas.
  function fondoFila(p) {
    const est = estadoNorm(p.estado)
    if (est === 'N-DICOM') return { idadmon: COL_NDICOM, inmueble: COL_NDICOM }
    if (est === 'P') {
      const d = idinmueDepto(p.idlinmue)
      if (d && deptosConSQ.has(d)) return { idadmon: COL_MARRON, inmueble: COL_VIOLETA }  // ocupado
      return { idadmon: COL_ESTADO.P, inmueble: COL_ESTADO.P }
    }
    const c = COL_ESTADO[est]
    return c ? { idadmon: c, inmueble: c } : { idadmon: 'transparent', inmueble: 'transparent' }
  }
  const hayFiltros = search || hayAlgunFiltro || orden?.key
  const propiedades = filtradas  // scroll continuo: se muestran todas las filas filtradas
  const irAFormulario = () => router.push('/admin')
  const recuperar = () => {
    const v = recuperarId.trim().toUpperCase()
    router.push(v ? `/admin?idadmon=${encodeURIComponent(v)}` : '/admin')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      <TopNav />

      <div style={{ padding: '10px 24px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link href="/panel" style={{ fontSize: 12, color: 'var(--gray-400)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
          {Ico.back} Volver al panel
        </Link>
        <span style={{ color: 'var(--border)', fontSize: 14 }}>|</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, background: '#1a56db', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--gray-900)', margin: 0, letterSpacing: '-0.3px' }}>LOG</h1>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr) 200px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        {[
          { label: 'Total contratos', value: kpis.total,   color: 'var(--gray-800)', estado: '' },
          { label: 'Activos (S)',     value: kpis.activos, color: '#16a34a',          estado: 'S' },
          { label: 'En término (Q)', value: kpis.termino, color: '#d97706',     estado: 'Q' },
          { label: 'Vacíos (P)',  value: kpis.vacios,  color: '#dc2626',         estado: 'P' },
        ].map((k, i) => (
          <div key={i} style={{ padding: '10px 20px', borderRight: '1px solid var(--border)', cursor: 'pointer' }}
            onClick={() => setEstadoRapido(estadoSel === k.estado ? '' : k.estado)}>
            <div style={{ fontSize: 10, color: 'var(--gray-400)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k.label}</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: k.color }}>{k.value}</div>
            {estadoSel === k.estado && k.estado !== '' && <div style={{ fontSize: 10, color: '#1a56db', marginTop: 2 }}>● Filtro activo</div>}
          </div>
        ))}
        <div style={{ padding: '8px 14px', display: 'flex', alignItems: 'center' }}>
          <select value={estadoSel} onChange={e => setEstadoRapido(e.target.value)}
            style={{ width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--gray-50)', fontSize: 12, color: 'var(--gray-700)', fontFamily: 'inherit', cursor: 'pointer' }}>
            <option value="">Todos los estados</option>
            <option value="S">S – Activos</option>
            <option value="P">P – Vacíos</option>
            <option value="Q">Q – En término</option>
            <option value="SQ">SQ</option>
            <option value="O">O</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 24px' }}>
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '10px 16px', fontSize: 12, fontWeight: activeTab === tab ? 500 : 400,
            color: activeTab === tab ? '#1a56db' : 'var(--gray-400)', background: 'none', border: 'none',
            borderBottom: activeTab === tab ? '2px solid #1a56db' : '2px solid transparent',
            cursor: 'pointer', fontFamily: 'inherit', marginBottom: '-1px' }}>{tab}</button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '12px 24px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 52, zIndex: 23 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input value={recuperarId} onChange={e => setRecuperarId(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') recuperar() }}
            placeholder="IDADMON…"
            style={{ width: 120, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--gray-50)', fontSize: 12, color: 'var(--gray-800)', fontFamily: 'inherit',
              outline: 'none', textTransform: 'uppercase' }} />
          <ActionBtn label="RECUPERAR" bg="#1a56db" icon={Ico.edit} onClick={recuperar} />
        </div>
        <ActionBtn label="Propietarios"               bg="#16a34a" icon={Ico.users} onClick={() => router.push('/cc1/propietarios')} />
        <ActionBtn label="Inmuebles"                  bg="#0891b2" icon={Ico.home}  onClick={() => router.push('/cc1/inmuebles')} />
        <ActionBtn label="Comentarios"                bg="#7c3aed" icon={Ico.comment} onClick={() => router.push('/cc1/comentarios')} />
        {puedeEditar && (
          <ActionBtn label="Calcular ajustes"           bg="#d97706" icon={Ico.calc}  onClick={() => router.push('/procesos/notificaciones')} />
        )}
      </div>

      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 106, zIndex: 22, background: 'var(--surface)', height: 48, marginBottom: 0 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--gray-800)', margin: 0 }}>
            Listado de propiedades administradas
            <span style={{ fontSize: 11, color: 'var(--gray-400)', fontWeight: 400, marginLeft: 8 }}>
              ({total} registro{total === 1 ? '' : 's'}{estadoSel ? ` · estado ${estadoSel}` : ''})
            </span>
          </h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', display: 'flex' }}>{Ico.search}</span>
              <input type="text" placeholder="IDADMON, inmueble, propietario…" value={search} onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: 30, paddingRight: 12, paddingTop: 7, paddingBottom: 7, borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--gray-50)', fontSize: 12,
                  color: 'var(--gray-700)', fontFamily: 'inherit', width: 240, outline: 'none' }} />
            </div>
            {hayFiltros && (
              <button onClick={limpiarTodo} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)',
                background: '#FEF3C7', fontSize: 12, color: '#92400E', cursor: 'pointer', fontFamily: 'inherit' }}>
                ✕ Limpiar filtros
              </button>
            )}
          </div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'visible' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 78 }} />    {/* IDADMON — 6 chars + triángulo de filtro */}
              <col style={{ width: 320 }} />   {/* Inmueble — ancho para agrupaciones largas */}
              <col style={{ width: 150 }} />   {/* Propietario */}
              <col style={{ width: 58 }} />    {/* Estado */}
              <col style={{ width: 95 }} />    {/* Cuota */}
              <col style={{ width: 100 }} />   {/* Término actual */}
              <col style={{ width: 55 }} />    {/* IDPROP */}
              <col style={{ width: 175 }} />   {/* IDINMUE — hasta 3 códigos */}
              <col style={{ width: 65 }} />    {/* Portal */}
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--gray-50)' }}>
                <th style={{ padding: '9px 12px', textAlign: 'left', position: 'sticky', top: 154, zIndex: 20, background: 'var(--gray-50)', borderBottom: '1px solid var(--border)', borderTopLeftRadius: 12 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 10, color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>IDADMON</span><HeaderFilter col={LOG_COLS.find(c => c.key === 'idadmon')} movs={todas} state={filters['idadmon']} setState={v => setFiltroCol('idadmon', v)} open={openFilter} setOpen={setOpenFilter} orden={orden} setOrden={setOrden} limpiarTodo={limpiarTodo} hayAlguno={hayFiltros} /></span>
                </th>
                <th style={{ padding: '9px 12px', textAlign: 'left', position: 'sticky', top: 154, zIndex: 20, background: 'var(--gray-50)', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 10, color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Inmueble</span><HeaderFilter col={LOG_COLS.find(c => c.key === 'inmueble')} movs={todas} state={filters['inmueble']} setState={v => setFiltroCol('inmueble', v)} open={openFilter} setOpen={setOpenFilter} orden={orden} setOrden={setOrden} limpiarTodo={limpiarTodo} hayAlguno={hayFiltros} /></span>
                </th>
                <th style={{ padding: '9px 12px', textAlign: 'left', position: 'sticky', top: 154, zIndex: 20, background: 'var(--gray-50)', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 10, color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Propietario</span><HeaderFilter col={LOG_COLS.find(c => c.key === 'propietario')} movs={todas} state={filters['propietario']} setState={v => setFiltroCol('propietario', v)} open={openFilter} setOpen={setOpenFilter} orden={orden} setOrden={setOrden} limpiarTodo={limpiarTodo} hayAlguno={hayFiltros} /></span>
                </th>
                <th style={{ padding: '9px 12px', textAlign: 'left', position: 'sticky', top: 154, zIndex: 20, background: 'var(--gray-50)', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 10, color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Estado</span><HeaderFilter col={LOG_COLS.find(c => c.key === 'estado')} movs={todas} state={filters['estado']} setState={v => setFiltroCol('estado', v)} open={openFilter} setOpen={setOpenFilter} orden={orden} setOrden={setOrden} limpiarTodo={limpiarTodo} hayAlguno={hayFiltros} /></span>
                </th>
                <th style={{ padding: '9px 12px', textAlign: 'left', position: 'sticky', top: 154, zIndex: 20, background: 'var(--gray-50)', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 10, color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cuota</span><HeaderFilter col={LOG_COLS.find(c => c.key === 'cuota')} movs={todas} state={filters['cuota']} setState={v => setFiltroCol('cuota', v)} open={openFilter} setOpen={setOpenFilter} orden={orden} setOrden={setOrden} limpiarTodo={limpiarTodo} hayAlguno={hayFiltros} /></span>
                </th>
                <th style={{ padding: '9px 12px', textAlign: 'left', position: 'sticky', top: 154, zIndex: 20, background: 'var(--gray-50)', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 10, color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Término actual</span><HeaderFilter col={LOG_COLS.find(c => c.key === 'termino_actual')} movs={todas} state={filters['termino_actual']} setState={v => setFiltroCol('termino_actual', v)} open={openFilter} setOpen={setOpenFilter} orden={orden} setOrden={setOrden} limpiarTodo={limpiarTodo} hayAlguno={hayFiltros} /></span>
                </th>
                <th style={{ padding: '9px 12px', textAlign: 'left', position: 'sticky', top: 154, zIndex: 20, background: 'var(--gray-50)', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 10, color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>IDPROP</span><HeaderFilter col={LOG_COLS.find(c => c.key === 'idprop')} movs={todas} state={filters['idprop']} setState={v => setFiltroCol('idprop', v)} open={openFilter} setOpen={setOpenFilter} orden={orden} setOrden={setOrden} limpiarTodo={limpiarTodo} hayAlguno={hayFiltros} /></span>
                </th>
                <th style={{ padding: '9px 12px', textAlign: 'left', position: 'sticky', top: 154, zIndex: 20, background: 'var(--gray-50)', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 10, color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>IDINMUE</span><HeaderFilter col={LOG_COLS.find(c => c.key === 'idlinmue')} movs={todas} state={filters['idlinmue']} setState={v => setFiltroCol('idlinmue', v)} open={openFilter} setOpen={setOpenFilter} orden={orden} setOrden={setOrden} limpiarTodo={limpiarTodo} hayAlguno={hayFiltros} /></span>
                </th>
                <th style={{ padding: '9px 12px', textAlign: 'center', position: 'sticky', top: 154, zIndex: 20, background: 'var(--gray-50)', borderBottom: '1px solid var(--border)', fontSize: 10, color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase', borderTopRightRadius: 12 }}>Portal</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', fontSize: 12, color: 'var(--gray-400)' }}>Cargando datos...</td></tr>
              ) : propiedades.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', fontSize: 12, color: 'var(--gray-400)' }}>No se encontraron registros</td></tr>
              ) : propiedades.map((p, i) => {
                const alerta = alertaTermino(p.termino_actual, p.estado)
                const cargando = portalLoading === p.idadmon
                const bg = fondoFila(p)
                return (
                  <tr key={i} style={{ cursor: 'pointer' }}
                    onClick={(e) => { if (!e.defaultPrevented) router.push(`/admin?idadmon=${p.idadmon}`) }}>
                    <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: 600, color: 'var(--gray-800)', borderBottom: '1px solid var(--border-subtle)', background: bg.idadmon }}>{p.idadmon}</td>
                    <td title={p.inmueble || ''} style={{ padding: '9px 12px', fontSize: 12, color: 'var(--gray-700)', borderBottom: '1px solid var(--border-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: bg.inmueble }}>{p.inmueble || '—'}</td>
                    <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--gray-700)', borderBottom: '1px solid var(--border-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.propietario || '—'}</td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--border-subtle)' }}><EstadoBadge estado={p.estado} /></td>
                    <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--gray-700)', borderBottom: '1px solid var(--border-subtle)' }}>
                      {p.cuota ? `${p.unid === 'UF' ? 'UF ' : '$'}${Number(p.cuota).toLocaleString('es-CL')}` : '—'}
                    </td>
                    <td style={{ padding: '9px 12px', fontSize: 12, borderBottom: '1px solid var(--border-subtle)' }}>
                      {p.termino_actual ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: 'var(--gray-700)' }}>{new Date(p.termino_actual).toLocaleDateString('es-CL')}</span>
                          {alerta && <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 8, background: alerta.color + '20', color: alerta.color }}>{alerta.text}</span>}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '9px 12px', fontSize: 11, color: 'var(--gray-500)', borderBottom: '1px solid var(--border-subtle)', fontFamily: 'monospace' }}>{p.idprop || '—'}</td>
                    <td title={p.idlinmue || ''} style={{ padding: '9px 12px', fontSize: 11, color: 'var(--gray-500)', borderBottom: '1px solid var(--border-subtle)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.idlinmue || '—'}</td>
                    <td style={{ padding: '9px 8px', borderBottom: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                      {p.idprop ? (
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); verPortal(e, p.idadmon, p.idprop) }}
                          disabled={cargando}
                          title={`Ver portal como ${p.propietario}`}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '4px 8px', borderRadius: 6, border: '1px solid #BFDBFE',
                            background: cargando ? '#EFF6FF' : '#EFF6FF',
                            color: '#1a56db', fontSize: 11, cursor: cargando ? 'wait' : 'pointer',
                            fontFamily: 'inherit', fontWeight: 500,
                          }}
                          onMouseEnter={e => { if (!cargando) e.currentTarget.style.background = '#DBEAFE' }}
                          onMouseLeave={e => e.currentTarget.style.background = '#EFF6FF'}
                        >
                          {cargando ? '...' : <>{Ico.portal} Portal</>}
                        </button>
                      ) : (
                        <span style={{ color: 'var(--gray-300)', fontSize: 11 }}>—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 12 }}>
          <span style={{ fontSize:11, color:'var(--gray-400)' }}>{total} registro{total === 1 ? '' : 's'}</span>
        </div>
      </div>
    </div>
  )
}