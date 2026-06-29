'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import TopNav from '@/app/components/ui/TopNav'

// ════════════════════════════════════════════════════════════════════════
// Endpoint de envío del recordatorio de arriendo.
// Tabla de control de envíos: notificaciones_arriendo (una fila por idadmon+mes).
//   control_envio (col C del Excel): fecha = enviado · texto = no enviar · vacío = pendiente
//   comentario (col W): nota informativa, no afecta al envío.
//   Regla: SOLO se envía si hay email y control_envio está vacío.
// ════════════════════════════════════════════════════════════════════════
const ENDPOINT_ENVIO = '/api/procesos/notificaciones/enviar'
const ENDPOINT_PREVIEW = '/api/procesos/notificaciones/preview'
const CC_ENVIO = 'administracion@fondocapital.com'
const TABLA_NOTI = 'notificaciones_arriendo'

// ── Helpers ──────────────────────────────────────────────────────────────
const fmtMiles = (n) => {
  if (n === null || n === undefined || n === '' || isNaN(Number(n))) return '—'
  return Math.round(Number(n)).toLocaleString('es-CL')
}
const num = (v) => {
  const n = Number(v)
  return isNaN(n) ? 0 : n
}
function splitEmails(s) {
  if (!s) return []
  return String(s).split(';').map((e) => e.trim()).filter(Boolean)
}
function esUF(revision) {
  return (revision || '').trim().toUpperCase() === 'UF'
}
function calcularApagar(c) {
  if (esUF(c.revision)) {
    return Math.round(num(c.cuota) * num(c.uf_peso_factor))
  }
  const sumaReajustes =
    num(c.cantidad_reajuste1) + num(c.cantidad_reajuste2) + num(c.cantidad_reajuste3) +
    num(c.cantidad_reajuste4) + num(c.cantidad_reajuste5) + num(c.cantidad_reajuste6)
  return Math.round(num(c.cuota) + sumaReajustes)
}

// Ajuste vigente del mes (solo contratos en pesos, nunca UF).
// Devuelve el reajuste con monto > 0 cuya fecha es la más reciente <= primer día
// del mes procesado. Si no hay, devuelve null (no se pinta bloque de ajuste).
//   mes: 'YYYY-MM-01'  ·  monto redondeado a entero
function ajusteVigente(c, mes) {
  if (esUF(c.revision) || !mes) return null
  const tope = mes // ISO 'YYYY-MM-01'; comparación lexicográfica de fechas ISO es válida
  let mejorFecha = null
  let mejorMonto = 0
  for (let i = 1; i <= 6; i++) {
    const f = c['fecha_reajuste' + i]
    const m = num(c['cantidad_reajuste' + i])
    if (!f || m <= 0) continue
    const fIso = String(f).slice(0, 10)
    if (fIso <= tope && (mejorFecha === null || fIso > mejorFecha)) {
      mejorFecha = fIso
      mejorMonto = m
    }
  }
  if (mejorFecha === null) return null
  return { tipo: c.revision || '', monto: Math.round(mejorMonto) }
}
function tipoComunicacion(c) {
  if (esUF(c.revision)) return 'UF'
  const r = (c.revision || '').trim().toUpperCase()
  if (r === 'FIJO' || r === '') return 'vacío'
  return 'AJUSTE'
}
// ¿El texto del control parece una fecha/timestamp ISO? ('2026-06-26 17:33:11' o ISO)
function esFechaIso(s) {
  if (!s) return false
  return /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2})?/.test(String(s).trim())
}
// Formatea el control-fecha a 'dd/mm HH:MM' para mostrar
function fmtControlFecha(s) {
  const t = String(s).trim().replace(' ', 'T')
  const d = new Date(t)
  if (isNaN(d.getTime())) return String(s)
  const p = (x) => String(x).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`
}
// Fecha simple 'dd/mm/yyyy' (para fecha_inicio, que es date)
function fmtFecha(s) {
  if (!s) return ''
  const d = new Date(String(s).slice(0, 10) + 'T00:00:00')
  if (isNaN(d.getTime())) return String(s)
  const p = (x) => String(x).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`
}

const ENVIO = {
  FALTAN: 'Faltan datos',
  BLOQUEADO: 'Bloqueado',
  ENVIADO: 'Enviado',
  PENDIENTE: 'Pendiente',
}

const revColores = {
  'UF':               { bg: '#eff6ff', color: '#1a56db' },
  'IPC semestral':    { bg: '#f0fdf4', color: '#16a34a' },
  'IPC 6 meses':      { bg: '#f0fdf4', color: '#16a34a' },
  'IPC anual':        { bg: '#fffbeb', color: '#d97706' },
  'IPC trimestral':   { bg: '#fef2f2', color: '#dc2626' },
  'Semestral con UF': { bg: '#ecfeff', color: '#0891b2' },
  'FIJO':             { bg: '#f3f4f6', color: '#6b7280' },
}
function RevBadge({ revision }) {
  const s = revColores[(revision || '').trim()] || { bg: '#f3f4f6', color: '#6b7280' }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 7px',
      borderRadius: 6, background: s.bg, color: s.color, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {revision || '—'}
    </span>
  )
}

const COLS = [
  { key: 'idadmon',           label: 'IDADMON',      w: '6%',   align: 'left',  val: (c) => c.idadmon || '' },
  { key: 'envioEstado',       label: 'Envío',        w: '11%',  align: 'left',  val: (c) => c.envioEstado || '' },
  { key: 'propietario',       label: 'Propietario',  w: '12%',  align: 'left',  val: (c) => c.propietario || '' },
  { key: 'inmueble',          label: 'Propiedad',    w: '13%',  align: 'left',  val: (c) => c.inmueble || '' },
  { key: 'arrendatario',      label: 'Arrendatario', w: '12%',  align: 'left',  val: (c) => c.arrendatario || '' },
  { key: 'fecha_inicio',      label: 'Inicio',       w: '8%',   align: 'left',  val: (c) => (c.fecha_inicio ? String(c.fecha_inicio).slice(0, 10) : '') },
  { key: 'revision',          label: 'Revisión',     w: '7.5%', align: 'left',  val: (c) => (c.revision || '').trim() },
  { key: 'apagar',            label: 'A pagar',      w: '8%',   align: 'right', val: (c) => String(c.apagar ?? ''), numeric: true },
  { key: 'tipoCom',           label: 'Comunic.',     w: '6%',   align: 'left',  val: (c) => c.tipoCom || '' },
  { key: 'mail_arrendatario', label: 'email',        w: '9%',   align: 'left',  val: (c) => c.mail_arrendatario || '' },
]

const menuItem = {
  display: 'block', width: '100%', textAlign: 'left', fontSize: 12, padding: '7px 10px',
  borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: '#374151',
}

function FilterPopover({ col, valores, seleccion, onToggle, onAll, onSoloEstos, onClear, onSort, ordenActual, onClose }) {
  const [q, setQ] = useState('')
  const lista = valores.filter((v) => v.toLowerCase().includes(q.trim().toLowerCase()))
  const todosMarcados = lista.length > 0 && lista.every((v) => seleccion.has(v))
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
      <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 41, width: 240,
        background: '#fff', border: '1px solid #D3D1C7', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 8 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <button onClick={() => onSort('asc')}
            style={{ flex: 1, fontSize: 11, padding: '5px 8px', borderRadius: 6, cursor: 'pointer',
              border: '1px solid ' + (ordenActual === 'asc' ? '#1a56db' : '#D3D1C7'),
              background: ordenActual === 'asc' ? '#eff6ff' : '#fff', color: ordenActual === 'asc' ? '#1a56db' : '#374151' }}>
            {col.numeric ? '↑ Menor' : '↑ A → Z'}
          </button>
          <button onClick={() => onSort('desc')}
            style={{ flex: 1, fontSize: 11, padding: '5px 8px', borderRadius: 6, cursor: 'pointer',
              border: '1px solid ' + (ordenActual === 'desc' ? '#1a56db' : '#D3D1C7'),
              background: ordenActual === 'desc' ? '#eff6ff' : '#fff', color: ordenActual === 'desc' ? '#1a56db' : '#374151' }}>
            {col.numeric ? '↓ Mayor' : '↓ Z → A'}
          </button>
        </div>
        <input type="text" placeholder="Buscar valor…" value={q} onChange={(e) => setQ(e.target.value)}
          style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', borderRadius: 6,
            border: '1px solid #D3D1C7', fontSize: 12, fontFamily: 'inherit', marginBottom: 6, outline: 'none' }} />
        {q.trim() !== '' && lista.length > 0 && (
          <button onClick={() => onSoloEstos(lista)}
            style={{ width: '100%', fontSize: 11, fontWeight: 600, padding: '6px 8px', borderRadius: 6, marginBottom: 6,
              border: '1px solid #1a56db', background: '#eff6ff', color: '#1a56db', cursor: 'pointer' }}>
            Mostrar solo estos ({lista.length})
          </button>
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', fontSize: 12, color: '#374151', cursor: 'pointer', fontWeight: 600 }}>
          <input type="checkbox" checked={todosMarcados} onChange={() => onAll(lista, !todosMarcados)} />
          (Seleccionar todo)
        </label>
        <div style={{ maxHeight: 200, overflowY: 'auto', borderTop: '1px solid #F0EEE8', marginTop: 4, paddingTop: 4 }}>
          {lista.length === 0 ? (
            <div style={{ fontSize: 11, color: '#9CA3AF', padding: '6px' }}>Sin valores</div>
          ) : lista.map((v) => (
            <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', fontSize: 12, color: '#374151', cursor: 'pointer' }}>
              <input type="checkbox" checked={seleccion.has(v)} onChange={() => onToggle(v)} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v === '' ? '(vacío)' : v}</span>
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: '1px solid #F0EEE8' }}>
          <button onClick={onClear} style={{ fontSize: 11, padding: '5px 10px', borderRadius: 6, border: '1px solid #D3D1C7', background: '#fff', cursor: 'pointer', color: '#6B7280' }}>Limpiar</button>
          <button onClick={onClose} style={{ fontSize: 11, padding: '5px 10px', borderRadius: 6, border: 'none', background: '#2C2C2A', cursor: 'pointer', color: '#fff' }}>Cerrar</button>
        </div>
      </div>
    </>
  )
}

// ── Página ───────────────────────────────────────────────────────────────
export default function NotificacionesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [contratos, setContratos] = useState([])
  const [indices, setIndices] = useState([])
  const [mesSel, setMesSel] = useState('')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [notiMap, setNotiMap] = useState(() => new Map())

  const [seleccionados, setSeleccionados] = useState(() => new Set())
  const [filtros, setFiltros] = useState({})
  const [orden, setOrden] = useState(null)
  const [filtroAbierto, setFiltroAbierto] = useState(null)
  const [menuFila, setMenuFila] = useState(null)

  const [modalAbierto, setModalAbierto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [modoPrueba, setModoPrueba] = useState(true)
  const [correoPrueba, setCorreoPrueba] = useState('')
  const [resultado, setResultado] = useState(null)
  const [toast, setToast] = useState(null)

  const [comentarioEdit, setComentarioEdit] = useState(null)
  const [controlEdit, setControlEdit] = useState(null)
  const [preview, setPreview] = useState(null) // { idadmon, asunto, html } | { loading } | { error }

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/api/auth/signin')
  }, [status, router])

  useEffect(() => {
    if (session?.user?.email && !correoPrueba) setCorreoPrueba(session.user.email)
  }, [session, correoPrueba])

  useEffect(() => {
    async function cargar() {
      setLoading(true)
      const [{ data: idx }, { data: arr }] = await Promise.all([
        supabase.from('indices_mensuales')
          .select('mes, valor_uf, ipc_3m, ipc_6m, ipc_12m, uf_3m, uf_6m, uf_12m')
          .order('mes', { ascending: false }),
        supabase.from('datos_arriendos')
          .select('idadmon, propietario, inmueble, arrendatario, mail_arrendatario, revision, cuota, uf_peso_factor, fecha_inicio, cantidad_reajuste1, cantidad_reajuste2, cantidad_reajuste3, cantidad_reajuste4, cantidad_reajuste5, cantidad_reajuste6, fecha_reajuste1, fecha_reajuste2, fecha_reajuste3, fecha_reajuste4, fecha_reajuste5, fecha_reajuste6')
          .eq('estado', 'S'),
      ])
      const idxList = idx || []
      setIndices(idxList)
      if (idxList.length) setMesSel(idxList[0].mes)
      setContratos(arr || [])
      setLoading(false)
    }
    cargar()
  }, [])

  async function cargarNoti(mes) {
    if (!mes) return
    const { data, error } = await supabase
      .from(TABLA_NOTI)
      .select('idadmon, control_envio, comentario, apagar_enviado')
      .eq('mes_notificacion', mes)
    if (error) { setNotiMap(new Map()); return }
    const m = new Map()
    ;(data || []).forEach((r) => m.set(r.idadmon, r))
    setNotiMap(m)
  }
  useEffect(() => { cargarNoti(mesSel) }, [mesSel])

  const idxMes = useMemo(() => indices.find((i) => i.mes === mesSel) || null, [indices, mesSel])

  const todasFilas = useMemo(() => {
    return contratos.map((c) => {
      const apagarCalc = calcularApagar(c)
      const tipoCom = tipoComunicacion(c)
      const noti = notiMap.get(c.idadmon)
      const tieneEmail = splitEmails(c.mail_arrendatario).length > 0
      const tieneArr = !!(c.arrendatario && c.arrendatario.trim())

      // Override: si la notificación tiene apagar_enviado, ese importe manda (casos especiales)
      const tieneOverride = noti && noti.apagar_enviado != null && noti.apagar_enviado !== ''
      const apagar = tieneOverride ? Math.round(num(noti.apagar_enviado)) : apagarCalc

      let envioEstado, sendable
      const control = noti && noti.control_envio != null ? String(noti.control_envio).trim() : ''
      const controlEsFecha = control !== '' && esFechaIso(control)
      if (!tieneEmail || !tieneArr) { envioEstado = ENVIO.FALTAN; sendable = false }
      else if (controlEsFecha) { envioEstado = ENVIO.ENVIADO; sendable = false }
      else if (control !== '') { envioEstado = ENVIO.BLOQUEADO; sendable = false }
      else { envioEstado = ENVIO.PENDIENTE; sendable = true }

      const av = ajusteVigente(c, mesSel)
      return {
        ...c, apagar, apagarCalc, tieneOverride, tipoCom, envioEstado, sendable,
        control,                                   // texto de la columna C (fecha o motivo)
        controlEsFecha,
        comentario: noti?.comentario || '',        // columna W (nota informativa)
        ajusteTipo: av ? av.tipo : null,
        ajusteMonto: av ? av.monto : 0,
      }
    })
  }, [contratos, notiMap, mesSel])

  const filaPorId = useMemo(() => {
    const m = new Map()
    todasFilas.forEach((f) => m.set(f.idadmon, f))
    return m
  }, [todasFilas])

  const filasBase = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return todasFilas
    return todasFilas.filter((c) =>
      (c.idadmon || '').toLowerCase().includes(q) ||
      (c.inmueble || '').toLowerCase().includes(q) ||
      (c.propietario || '').toLowerCase().includes(q) ||
      (c.arrendatario || '').toLowerCase().includes(q)
    )
  }, [todasFilas, search])

  const distinct = useMemo(() => {
    const out = {}
    COLS.forEach((col) => {
      const set = new Set()
      filasBase.forEach((f) => set.add(col.val(f)))
      let arr = Array.from(set)
      if (col.numeric) arr.sort((a, b) => num(a) - num(b))
      else arr.sort((a, b) => a.localeCompare(b, 'es'))
      out[col.key] = arr
    })
    return out
  }, [filasBase])

  const filas = useMemo(() => {
    let r = filasBase.filter((f) =>
      COLS.every((col) => {
        const sel = filtros[col.key]
        if (!sel || sel.size === 0) return true
        return sel.has(col.val(f))
      })
    )
    if (orden) {
      const col = COLS.find((c) => c.key === orden.col)
      if (col) {
        r = r.slice().sort((a, b) => {
          let cmp
          if (col.numeric) cmp = num(col.val(a)) - num(col.val(b))
          else cmp = col.val(a).localeCompare(col.val(b), 'es')
          return orden.dir === 'desc' ? -cmp : cmp
        })
      }
    } else {
      r = r.slice().sort((a, b) => {
        const p = (a.propietario || '').localeCompare(b.propietario || '', 'es')
        if (p !== 0) return p
        return (a.inmueble || '').localeCompare(b.inmueble || '', 'es')
      })
    }
    return r
  }, [filasBase, filtros, orden])

  const kpis = useMemo(() => {
    const total = filas.length
    const nUF = filas.filter((f) => esUF(f.revision)).length
    const totalCobrar = filas.reduce((s, f) => s + (f.apagar || 0), 0)
    const pendientes = filas.filter((f) => f.sendable).length
    return { total, nUF, conAjuste: total - nUF, totalCobrar, pendientes }
  }, [filas])

  const idsSendablesVisibles = useMemo(() => filas.filter((f) => f.sendable).map((f) => f.idadmon), [filas])
  const todosSel = idsSendablesVisibles.length > 0 && idsSendablesVisibles.every((id) => seleccionados.has(id))
  const algunoSel = idsSendablesVisibles.some((id) => seleccionados.has(id))

  function toggleFila(id) {
    setSeleccionados((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleTodos() {
    setSeleccionados((prev) => {
      const n = new Set(prev)
      if (todosSel) idsSendablesVisibles.forEach((id) => n.delete(id))
      else idsSendablesVisibles.forEach((id) => n.add(id))
      return n
    })
  }
  function limpiarSeleccion() { setSeleccionados(new Set()) }
  // Selecciona de golpe todos los enviables (Pendientes) de la vista filtrada actual
  function seleccionarPendientes() {
    setSeleccionados((prev) => {
      const n = new Set(prev)
      filas.forEach((f) => { if (f.sendable) n.add(f.idadmon) })
      return n
    })
  }
  // Copia al portapapeles los emails de los seleccionados, separados por ';'
  async function copiarEmails() {
    const set = new Set()
    seleccionados.forEach((id) => {
      const f = filaPorId.get(id)
      if (f) splitEmails(f.mail_arrendatario).forEach((e) => set.add(e))
    })
    const txt = Array.from(set).join('; ')
    try {
      await navigator.clipboard.writeText(txt)
      setToast(`${set.size} email(s) copiados al portapapeles`)
    } catch {
      setToast('No se pudo copiar; emails: ' + txt.slice(0, 80) + '…')
    }
    setTimeout(() => setToast(null), 3500)
  }

  const totalSeleccionado = useMemo(() => {
    let t = 0
    seleccionados.forEach((id) => { const f = filaPorId.get(id); if (f) t += f.apagar || 0 })
    return t
  }, [seleccionados, filaPorId])

  function toggleValor(colKey, valor) {
    setFiltros((prev) => {
      const total = distinct[colKey] ? distinct[colKey].length : 0
      const actual = prev[colKey] ? new Set(prev[colKey]) : new Set(distinct[colKey])
      actual.has(valor) ? actual.delete(valor) : actual.add(valor)
      const next = { ...prev }
      if (actual.size === 0 || actual.size === total) delete next[colKey]; else next[colKey] = actual
      return next
    })
  }
  // marcar=true sobre la lista visible del buscador → el filtro pasa a ser SOLO esa lista
  // (comportamiento Excel: buscas algo, "seleccionar todo" deja únicamente lo buscado)
  function setTodosFiltro(colKey, listaVisible, marcar) {
    setFiltros((prev) => {
      const total = distinct[colKey] ? distinct[colKey].length : 0
      const todosVisibles = distinct[colKey] && listaVisible.length === total
      let actual
      if (marcar) {
        if (todosVisibles) {
          // marcar todo sin búsqueda activa → sin filtro
          const next = { ...prev }; delete next[colKey]; return next
        }
        // marcar todo lo buscado → filtro = solo esa lista
        actual = new Set(listaVisible)
      } else {
        // desmarcar lo visible
        actual = prev[colKey] ? new Set(prev[colKey]) : new Set(distinct[colKey])
        listaVisible.forEach((v) => actual.delete(v))
      }
      const next = { ...prev }
      if (actual.size === 0 || actual.size === total) delete next[colKey]; else next[colKey] = actual
      return next
    })
  }
  function limpiarFiltro(colKey) { setFiltros((prev) => { const n = { ...prev }; delete n[colKey]; return n }) }
  function aplicarOrden(colKey, dir) { setOrden({ col: colKey, dir }) }

  const mesLabel = (mes) => {
    if (!mes) return ''
    const [y, m] = mes.split('-')
    const nombres = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    return `${nombres[parseInt(m, 10)]} ${y}`
  }

  async function upsertNoti(idadmon, campos) {
    const { error } = await supabase.from(TABLA_NOTI).upsert(
      { idadmon, mes_notificacion: mesSel, ...campos, actualizado_en: new Date().toISOString() },
      { onConflict: 'idadmon,mes_notificacion' }
    )
    if (error) { setToast('Error guardando: ' + error.message); setTimeout(() => setToast(null), 4000); return false }
    return true
  }
  function abrirControl(f) {
    setMenuFila(null)
    setControlEdit({ idadmon: f.idadmon, texto: f.controlEsFecha ? '' : (f.control || '') })
  }
  async function guardarControl() {
    if (!controlEdit) return
    const ok = await upsertNoti(controlEdit.idadmon, { control_envio: controlEdit.texto.trim() || null })
    if (ok) {
      setControlEdit(null)
      setSeleccionados((p) => { const n = new Set(p); n.delete(controlEdit.idadmon); return n })
      cargarNoti(mesSel)
    }
  }
  async function reabrir(f) {
    setMenuFila(null)
    // Vaciar el control = permitir envío (como dejar en blanco la celda del Excel)
    const ok = await upsertNoti(f.idadmon, { control_envio: null })
    if (ok) cargarNoti(mesSel)
  }
  function abrirComentario(f) {
    setMenuFila(null)
    setComentarioEdit({ idadmon: f.idadmon, texto: f.comentario || '' })
  }
  async function guardarComentario() {
    if (!comentarioEdit) return
    const ok = await upsertNoti(comentarioEdit.idadmon, { comentario: comentarioEdit.texto || null })
    if (ok) { setComentarioEdit(null); cargarNoti(mesSel) }
  }
  async function verPreview(f) {
    setMenuFila(null)
    setPreview({ idadmon: f.idadmon, loading: true })
    try {
      const res = await fetch(ENDPOINT_PREVIEW, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mes: mesSel, mesLabel: mesLabel(mesSel),
          valorUf: idxMes ? idxMes.valor_uf : null,
          notificacion: {
            idadmon: f.idadmon, arrendatario: f.arrendatario, propiedad: f.inmueble,
            apagar: f.apagar, revision: f.revision,
            ajusteTipo: f.ajusteTipo, ajusteMonto: f.ajusteMonto,
          },
        }),
      })
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status}${txt ? ' · ' + txt.slice(0, 120) : ''}`)
      }
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setPreview({ idadmon: f.idadmon, asunto: data.asunto, html: data.html,
        email: f.mail_arrendatario, apagar: f.apagar })
    } catch (err) {
      setPreview({ idadmon: f.idadmon, error: err.message })
    }
  }

  function abrirModal() {
    if (seleccionados.size === 0) return
    setResultado(null)
    setModalAbierto(true)
  }
  const aEnviar = useMemo(() => {
    const out = []
    seleccionados.forEach((id) => { const f = filaPorId.get(id); if (f && f.sendable) out.push(f) })
    return out
  }, [seleccionados, filaPorId])

  async function confirmarEnvio() {
    setEnviando(true)
    setResultado(null)
    const notificaciones = aEnviar.map((f) => ({
      idadmon: f.idadmon,
      arrendatario: f.arrendatario,
      propiedad: f.inmueble,
      mail_arrendatario: f.mail_arrendatario,
      destinatarios: splitEmails(f.mail_arrendatario),
      apagar: f.apagar,
      revision: f.revision,
      tipoCom: f.tipoCom,
      ajusteTipo: f.ajusteTipo,
      ajusteMonto: f.ajusteMonto,
    }))

    try {
      const res = await fetch(ENDPOINT_ENVIO, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mes: mesSel, mesLabel: mesLabel(mesSel),
          valorUf: idxMes ? idxMes.valor_uf : null,
          cc: CC_ENVIO,
          emailOverride: modoPrueba ? (correoPrueba || null) : null,
          notificaciones,
        }),
      })
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status}${txt ? ' · ' + txt.slice(0, 140) : ''}`)
      }
      const data = await res.json()
      setResultado(data)

      if (!data.error && !modoPrueba && Array.isArray(data.detalle)) {
        const ahora = new Date()
        const p = (x) => String(x).padStart(2, '0')
        const sello = `${ahora.getFullYear()}-${p(ahora.getMonth() + 1)}-${p(ahora.getDate())} ${p(ahora.getHours())}:${p(ahora.getMinutes())}:${p(ahora.getSeconds())}`
        const okIds = data.detalle.filter((d) => d.ok).map((d) => d.idadmon)
        if (okIds.length) {
          const filasUpsert = okIds.map((id) => {
            const f = filaPorId.get(id)
            return {
              idadmon: id, mes_notificacion: mesSel, control_envio: sello,
              email_usado: f ? f.mail_arrendatario : null,
              apagar_enviado: f ? f.apagar : null,
              revision_enviada: f ? f.revision : null,
              actualizado_en: new Date().toISOString(),
            }
          })
          await supabase.from(TABLA_NOTI).upsert(filasUpsert, { onConflict: 'idadmon,mes_notificacion' })
          await cargarNoti(mesSel)
          setSeleccionados((p) => { const n = new Set(p); okIds.forEach((id) => n.delete(id)); return n })
        }
      }
      if (!data.error) {
        setToast(`${modoPrueba ? 'Prueba' : 'Envío'}: ${data.enviados || 0} enviados, ${data.errores || 0} con error.`)
        setTimeout(() => setToast(null), 4500)
      }
    } catch (err) {
      setResultado({ error: err.message })
    } finally {
      setEnviando(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <>
        <TopNav />
        <div style={{ padding: 60, textAlign: 'center', color: '#888', fontSize: 14 }}>Cargando notificaciones…</div>
      </>
    )
  }

  function CeldaEnvio({ f }) {
    // Texto y estilo según estado
    let color, bg, txt, full
    if (f.envioEstado === ENVIO.ENVIADO) {
      color = '#166534'; bg = '#F0FDF4'; txt = `✓ ${fmtControlFecha(f.control)}`; full = `Enviado ${f.control}`
    } else if (f.envioEstado === ENVIO.FALTAN) {
      color = '#DC2626'; bg = '#FEF2F2'; txt = '⚠ Faltan datos'; full = 'Sin email o sin arrendatario'
    } else if (f.envioEstado === ENVIO.BLOQUEADO) {
      color = '#6B7280'; bg = '#F3F4F6'; txt = f.control; full = f.control   // muestra el texto real de la columna C
    } else {
      color = '#92400E'; bg = '#FFFBEB'; txt = '— Pendiente'; full = 'Pendiente de envío'
    }
    return (
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <span title={full}
          style={{ fontSize: 11, fontWeight: 600, color, background: bg, padding: '2px 7px', borderRadius: 6,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130, display: 'inline-block' }}>
          {txt}
        </span>
        {f.comentario && <span title={f.comentario} style={{ fontSize: 11, color: '#9CA3AF', flexShrink: 0 }}>💬</span>}
        <button onClick={() => setMenuFila(menuFila === f.idadmon ? null : f.idadmon)}
          title="Acciones" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#B4B2A9', fontSize: 12, padding: '0 2px', flexShrink: 0 }}>⋯</button>
        {menuFila === f.idadmon && (
          <>
            <div onClick={() => setMenuFila(null)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
            <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 41, width: 210,
              background: '#fff', border: '1px solid #D3D1C7', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 4 }}>
              <button onClick={() => verPreview(f)} style={menuItem}>👁 Vista previa del correo</button>
              <button onClick={() => abrirControl(f)} style={menuItem}>✎ Editar control de envío</button>
              {f.envioEstado !== ENVIO.PENDIENTE && f.envioEstado !== ENVIO.FALTAN && (
                <button onClick={() => reabrir(f)} style={menuItem}>↺ Vaciar control (permitir envío)</button>
              )}
              <button onClick={() => abrirComentario(f)} style={menuItem}>💬 Editar comentario</button>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <>
      <TopNav />
      <div style={{ maxWidth: 1360, margin: '0 auto', padding: '20px 24px 90px' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <button onClick={() => router.push('/cc1')}
            style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, border: '1px solid #D3D1C7', background: '#fff', cursor: 'pointer', color: '#2C2C2A', whiteSpace: 'nowrap' }}>
            ‹ Volver al listado
          </button>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0, color: '#2C2C2A' }}>Notificaciones a arrendatarios</h1>
        </div>
        <div style={{ fontSize: 12, color: '#888780', marginBottom: 16 }}>
          Importe a pagar del mes por contrato activo (estado S). Selecciona y envía el recordatorio de pago.
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 12, color: '#6B7280', fontWeight: 500 }}>Mes a procesar</label>
            <select value={mesSel} onChange={(e) => { setMesSel(e.target.value); limpiarSeleccion() }}
              style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #D3D1C7', background: '#fff', fontSize: 13, color: '#2C2C2A', fontFamily: 'inherit', cursor: 'pointer' }}>
              {indices.map((i) => (<option key={i.mes} value={i.mes}>{mesLabel(i.mes)}</option>))}
            </select>
          </div>
          {idxMes && (
            <div style={{ fontSize: 12, color: '#085041', background: '#E1F5EE', padding: '7px 12px', borderRadius: 8, fontWeight: 600 }}>
              Valor UF {mesLabel(mesSel)}: ${fmtMiles(idxMes.valor_uf)}
            </div>
          )}
          <button onClick={seleccionarPendientes} disabled={kpis.pendientes === 0}
            title="Marca todos los pendientes de la vista filtrada"
            style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 8,
              border: '1px solid ' + (kpis.pendientes ? '#1D9E75' : '#D3D1C7'),
              background: kpis.pendientes ? '#E1F5EE' : '#F3F4F6', color: kpis.pendientes ? '#085041' : '#9CA3AF',
              cursor: kpis.pendientes ? 'pointer' : 'default', whiteSpace: 'nowrap' }}>
            ✓ Seleccionar pendientes ({kpis.pendientes})
          </button>
          <div style={{ position: 'relative' }}>
            <input type="text" placeholder="IDADMON, inmueble, propietario, arrendatario…"
              value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #D3D1C7', background: '#F9FAFB', fontSize: 12, color: '#374151', fontFamily: 'inherit', width: 320, outline: 'none' }} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 18 }}>
          {[
            { label: 'Contratos activos (S)', val: kpis.total, color: '#1a56db' },
            { label: 'En UF', val: kpis.nUF, color: '#0891b2' },
            { label: 'Con ajuste ($)', val: kpis.conAjuste, color: '#16a34a' },
            { label: 'Pendientes de envío', val: kpis.pendientes, color: '#d97706' },
            { label: 'Total a cobrar el mes', val: `$${fmtMiles(kpis.totalCobrar)}`, color: '#633806' },
          ].map((k, i) => (
            <div key={i} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{k.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: k.color }}>{k.val}</div>
            </div>
          ))}
        </div>

        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'visible' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '4%' }} />
              {COLS.map((c) => <col key={c.key} style={{ width: c.w }} />)}
            </colgroup>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                <th style={{ padding: '9px 10px', textAlign: 'center', borderBottom: '1px solid #E5E7EB' }}>
                  <input type="checkbox" checked={todosSel}
                    ref={(el) => { if (el) el.indeterminate = !todosSel && algunoSel }}
                    onChange={toggleTodos} style={{ cursor: 'pointer' }} />
                </th>
                {COLS.map((col) => {
                  const activo = !!filtros[col.key] || (orden && orden.col === col.key)
                  return (
                    <th key={col.key} style={{ position: 'relative', padding: '9px 12px', textAlign: col.align, borderBottom: '1px solid #E5E7EB' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: col.align === 'right' ? 'flex-end' : 'flex-start' }}>
                        <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{col.label}</span>
                        <button onClick={() => setFiltroAbierto(filtroAbierto === col.key ? null : col.key)} title="Filtrar / ordenar"
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 11, lineHeight: 1, padding: '0 2px', color: activo ? '#1a56db' : '#B4B2A9' }}>▾</button>
                      </div>
                      {filtroAbierto === col.key && (
                        <FilterPopover col={col} valores={distinct[col.key] || []}
                          seleccion={filtros[col.key] || new Set(distinct[col.key])}
                          ordenActual={orden && orden.col === col.key ? orden.dir : null}
                          onToggle={(v) => toggleValor(col.key, v)}
                          onAll={(lista, marcar) => setTodosFiltro(col.key, lista, marcar)}
                          onSoloEstos={(lista) => { setFiltros((prev) => ({ ...prev, [col.key]: new Set(lista) })); setFiltroAbierto(null) }}
                          onClear={() => { limpiarFiltro(col.key); setFiltroAbierto(null) }}
                          onSort={(dir) => { aplicarOrden(col.key, dir); setFiltroAbierto(null) }}
                          onClose={() => setFiltroAbierto(null)} />
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {filas.length === 0 ? (
                <tr><td colSpan={COLS.length + 1} style={{ padding: 32, textAlign: 'center', fontSize: 12, color: '#9CA3AF' }}>No hay contratos que mostrar</td></tr>
              ) : filas.map((c, i) => {
                const sel = seleccionados.has(c.idadmon)
                return (
                  <tr key={c.idadmon} style={{ background: sel ? '#EFF6FF' : (i % 2 ? '#FCFCFB' : '#fff') }}>
                    <td style={{ padding: '9px 10px', textAlign: 'center', borderBottom: '1px solid #F0EEE8' }}>
                      <input type="checkbox" checked={sel} disabled={!c.sendable}
                        onChange={() => toggleFila(c.idadmon)}
                        style={{ cursor: c.sendable ? 'pointer' : 'not-allowed', opacity: c.sendable ? 1 : 0.35 }} />
                    </td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid #F0EEE8', fontSize: 12, fontWeight: 600, color: '#2C2C2A' }}>{c.idadmon}</td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid #F0EEE8' }}><CeldaEnvio f={c} /></td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid #F0EEE8', fontSize: 12, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.propietario || '—'}</td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid #F0EEE8', fontSize: 12, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.inmueble || '—'}</td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid #F0EEE8', fontSize: 12, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.arrendatario || '—'}</td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid #F0EEE8', fontSize: 12, color: '#374151', whiteSpace: 'nowrap' }}>{fmtFecha(c.fecha_inicio) || '—'}</td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid #F0EEE8' }}><RevBadge revision={c.revision} /></td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid #F0EEE8', fontSize: 13, fontWeight: 600, color: c.tieneOverride ? '#1a56db' : '#2C2C2A', textAlign: 'right' }}
                      title={c.tieneOverride ? `Importe manual (calculado: $${fmtMiles(c.apagarCalc)})` : ''}>
                      ${fmtMiles(c.apagar)}{c.tieneOverride ? ' *' : ''}</td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid #F0EEE8', fontSize: 11, color: c.tipoCom === 'UF' ? '#1a56db' : c.tipoCom === 'AJUSTE' ? '#d97706' : '#9CA3AF', fontWeight: 500 }}>{c.tipoCom}</td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid #F0EEE8', fontSize: 11, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.mail_arrendatario || ''}>{c.mail_arrendatario || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div style={{ fontSize: 11, color: '#B4B2A9', marginTop: 12 }}>
          {filas.length} contrato{filas.length === 1 ? '' : 's'} en la vista · {kpis.pendientes} pendiente{kpis.pendientes === 1 ? '' : 's'} de envío.
          Solo se envían contratos con email, no inhibidos y aún no enviados este mes.
        </div>
      </div>

      {seleccionados.size > 0 && (
        <div style={{ position: 'fixed', left: '50%', bottom: 20, transform: 'translateX(-50%)', zIndex: 30,
          display: 'flex', alignItems: 'center', gap: 16, background: '#2C2C2A', color: '#fff', padding: '12px 18px', borderRadius: 12, boxShadow: '0 8px 28px rgba(0,0,0,0.25)' }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{seleccionados.size} seleccionado{seleccionados.size === 1 ? '' : 's'}</span>
          <span style={{ fontSize: 12, color: '#C9C7BF' }}>Total ${fmtMiles(totalSeleccionado)}</span>
          <button onClick={abrirModal} style={{ fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#1D9E75', color: '#fff', cursor: 'pointer' }}>Revisar y enviar</button>
          <button onClick={copiarEmails} style={{ fontSize: 12, padding: '8px 12px', borderRadius: 8, border: '1px solid #555', background: 'transparent', color: '#C9C7BF', cursor: 'pointer' }}>Copiar emails</button>
          <button onClick={limpiarSeleccion} style={{ fontSize: 12, padding: '8px 12px', borderRadius: 8, border: '1px solid #555', background: 'transparent', color: '#C9C7BF', cursor: 'pointer' }}>Limpiar</button>
        </div>
      )}

      {modalAbierto && (
        <div onClick={() => !enviando && setModalAbierto(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 24, width: 500, maxWidth: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 6px', color: '#2C2C2A' }}>Enviar recordatorio de pago</h2>
            <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 16px' }}>
              Mes <strong>{mesLabel(mesSel)}</strong> · se enviará a <strong>{aEnviar.length}</strong> de {seleccionados.size} seleccionado{seleccionados.size === 1 ? '' : 's'}
              {aEnviar.length !== seleccionados.size && ' (el resto ya enviados, inhibidos o sin datos)'} · total ${fmtMiles(aEnviar.reduce((s, f) => s + f.apagar, 0))}.
            </p>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', marginBottom: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={modoPrueba} onChange={(e) => setModoPrueba(e.target.checked)} />
              Modo prueba — enviar todo a un solo correo (no marca como enviado)
            </label>
            {modoPrueba ? (
              <input type="email" value={correoPrueba} onChange={(e) => setCorreoPrueba(e.target.value)} placeholder="correo de prueba"
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid #D3D1C7', fontSize: 13, fontFamily: 'inherit', marginBottom: 14, outline: 'none' }} />
            ) : (
              <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#991B1B', marginBottom: 14 }}>
                ⚠ ENVÍO REAL: los correos llegarán a {aEnviar.length} arrendatario{aEnviar.length === 1 ? '' : 's'} (CC {CC_ENVIO}). Se marcarán como enviados con fecha y hora.
              </div>
            )}

            {resultado && (
              <div style={{ marginBottom: 14, fontSize: 12 }}>
                {resultado.error ? (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 12px', color: '#991B1B' }}>Error: {resultado.error}</div>
                ) : (
                  <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 8, padding: '10px 12px', color: '#166534' }}>
                    Enviados: {resultado.enviados || 0} · Errores: {resultado.errores || 0}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              {aEnviar.length > 0 && !(resultado && !resultado.error) && (
                <button onClick={() => verPreview(aEnviar[0])} disabled={enviando}
                  style={{ fontSize: 13, padding: '8px 14px', borderRadius: 8, border: '1px solid #D3D1C7', background: '#fff', color: '#374151', cursor: enviando ? 'default' : 'pointer', marginRight: 'auto' }}>
                  👁 Ver ejemplo
                </button>
              )}
              <button onClick={() => setModalAbierto(false)} disabled={enviando}
                style={{ fontSize: 13, padding: '8px 16px', borderRadius: 8, border: '1px solid #D3D1C7', background: '#fff', color: '#374151', cursor: enviando ? 'default' : 'pointer', opacity: enviando ? 0.6 : 1 }}>
                {resultado && !resultado.error ? 'Cerrar' : 'Cancelar'}
              </button>
              {!(resultado && !resultado.error) && (
                <button onClick={confirmarEnvio} disabled={enviando || aEnviar.length === 0}
                  style={{ fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 8, border: 'none',
                    background: (enviando || aEnviar.length === 0) ? '#9CA3AF' : (modoPrueba ? '#1a56db' : '#DC2626'), color: '#fff', cursor: (enviando || aEnviar.length === 0) ? 'default' : 'pointer' }}>
                  {enviando ? 'Enviando…' : (modoPrueba ? 'Enviar prueba' : 'Confirmar envío real')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {preview && (
        <div onClick={() => setPreview(null)} style={{ position: 'fixed', inset: 0, zIndex: 56, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: 680, maxWidth: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: '#2C2C2A' }}>Vista previa · {preview.idadmon}</h3>
                <button onClick={() => setPreview(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18, color: '#9CA3AF', lineHeight: 1 }}>×</button>
              </div>
              {preview.asunto && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#6B7280' }}>
                  <div><strong>Para:</strong> {preview.email || '—'}</div>
                  <div><strong>Asunto:</strong> {preview.asunto}</div>
                </div>
              )}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', background: '#F3F4F6', padding: 16 }}>
              {preview.loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Generando vista previa…</div>
              ) : preview.error ? (
                <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '12px 14px', color: '#991B1B', fontSize: 13 }}>Error: {preview.error}</div>
              ) : (
                <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden' }} dangerouslySetInnerHTML={{ __html: preview.html }} />
              )}
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <span style={{ fontSize: 11, color: '#9CA3AF', marginRight: 'auto', alignSelf: 'center' }}>Esto es solo una vista previa · no se ha enviado nada.</span>
              <button onClick={() => setPreview(null)} style={{ fontSize: 13, padding: '8px 16px', borderRadius: 8, border: '1px solid #D3D1C7', background: '#fff', color: '#374151', cursor: 'pointer' }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {controlEdit && (
        <div onClick={() => setControlEdit(null)} style={{ position: 'fixed', inset: 0, zIndex: 55, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 22, width: 440, maxWidth: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 6px', color: '#2C2C2A' }}>Control de envío · {controlEdit.idadmon}</h3>
            <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 10px' }}>
              Si escribes cualquier texto (p. ej. «OBSERVACIONES»), este contrato <strong>no se enviará</strong>. Déjalo <strong>vacío</strong> para permitir el envío. La fecha de envío se escribe aquí automáticamente al enviar.
            </p>
            <input type="text" value={controlEdit.texto} onChange={(e) => setControlEdit({ ...controlEdit, texto: e.target.value })}
              placeholder="Vacío = se enviará · texto = no enviar"
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid #D3D1C7', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
              <button onClick={() => setControlEdit(null)} style={{ fontSize: 13, padding: '8px 16px', borderRadius: 8, border: '1px solid #D3D1C7', background: '#fff', color: '#374151', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={guardarControl} style={{ fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#1a56db', color: '#fff', cursor: 'pointer' }}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {comentarioEdit && (
        <div onClick={() => setComentarioEdit(null)} style={{ position: 'fixed', inset: 0, zIndex: 55, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 22, width: 420, maxWidth: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 10px', color: '#2C2C2A' }}>Comentario · {comentarioEdit.idadmon}</h3>
            <textarea value={comentarioEdit.texto} onChange={(e) => setComentarioEdit({ ...comentarioEdit, texto: e.target.value })}
              rows={4} placeholder="Si escribes cualquier cosa aquí, este contrato NO se enviará este mes. Déjalo vacío para permitir el envío."
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid #D3D1C7', fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
              <button onClick={() => setComentarioEdit(null)} style={{ fontSize: 13, padding: '8px 16px', borderRadius: 8, border: '1px solid #D3D1C7', background: '#fff', color: '#374151', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={guardarComentario} style={{ fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#1a56db', color: '#fff', cursor: 'pointer' }}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: '#2C2C2A', color: '#fff', fontSize: 13, padding: '10px 20px', borderRadius: 8, zIndex: 60, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          {toast}
        </div>
      )}
    </>
  )
}