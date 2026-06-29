'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import TopNav from '@/app/components/ui/TopNav'

// ════════════════════════════════════════════════════════════════════════
// Endpoint de envío del recordatorio de arriendo.
// Tabla de control de envíos: notificaciones_arriendo (una fila por idadmon+mes).
//   fecha_envio NULL = no enviado · inhibir true = bloqueado · comentario libre
//   Solo se envía si: hay email, no está inhibido y fecha_envio es NULL.
// ════════════════════════════════════════════════════════════════════════
const ENDPOINT_ENVIO = '/api/procesos/notificaciones/enviar'
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
function tipoComunicacion(c) {
  if (esUF(c.revision)) return 'UF'
  const r = (c.revision || '').trim().toUpperCase()
  if (r === 'FIJO' || r === '') return 'vacío'
  return 'AJUSTE'
}
function fmtFechaEnvio(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ''
  const p = (x) => String(x).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const ENVIO = {
  FALTAN: 'Faltan datos',
  INHIBIDO: 'Inhibido',
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
  { key: 'idadmon',           label: 'IDADMON',      w: '6.5%', align: 'left',  val: (c) => c.idadmon || '' },
  { key: 'propietario',       label: 'Propietario',  w: '12%',  align: 'left',  val: (c) => c.propietario || '' },
  { key: 'inmueble',          label: 'Propiedad',    w: '14%',  align: 'left',  val: (c) => c.inmueble || '' },
  { key: 'arrendatario',      label: 'Arrendatario', w: '12%',  align: 'left',  val: (c) => c.arrendatario || '' },
  { key: 'revision',          label: 'Revisión',     w: '9%',   align: 'left',  val: (c) => (c.revision || '').trim() },
  { key: 'apagar',            label: 'A pagar',      w: '8.5%', align: 'right', val: (c) => String(c.apagar ?? ''), numeric: true },
  { key: 'tipoCom',           label: 'Comunic.',     w: '6.5%', align: 'left',  val: (c) => c.tipoCom || '' },
  { key: 'envioEstado',       label: 'Envío',        w: '12%',  align: 'left',  val: (c) => c.envioEstado || '' },
  { key: 'mail_arrendatario', label: 'email',        w: '9.5%', align: 'left',  val: (c) => c.mail_arrendatario || '' },
]

const menuItem = {
  display: 'block', width: '100%', textAlign: 'left', fontSize: 12, padding: '7px 10px',
  borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: '#374151',
}

function FilterPopover({ col, valores, seleccion, onToggle, onAll, onClear, onSort, ordenActual, onClose }) {
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
          .select('idadmon, propietario, inmueble, arrendatario, mail_arrendatario, revision, cuota, uf_peso_factor, cantidad_reajuste1, cantidad_reajuste2, cantidad_reajuste3, cantidad_reajuste4, cantidad_reajuste5, cantidad_reajuste6')
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
      .select('idadmon, fecha_envio, inhibir, comentario')
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
      const apagar = calcularApagar(c)
      const tipoCom = tipoComunicacion(c)
      const noti = notiMap.get(c.idadmon)
      const tieneEmail = splitEmails(c.mail_arrendatario).length > 0
      const tieneArr = !!(c.arrendatario && c.arrendatario.trim())

      let envioEstado, sendable
      if (!tieneEmail || !tieneArr) { envioEstado = ENVIO.FALTAN; sendable = false }
      else if (noti && noti.inhibir) { envioEstado = ENVIO.INHIBIDO; sendable = false }
      else if (noti && noti.fecha_envio) { envioEstado = ENVIO.ENVIADO; sendable = false }
      else { envioEstado = ENVIO.PENDIENTE; sendable = true }

      return {
        ...c, apagar, tipoCom, envioEstado, sendable,
        fechaEnvio: noti?.fecha_envio || null,
        comentario: noti?.comentario || '',
        ajuste: esUF(c.revision) ? 0 : Math.max(0, apagar - num(c.cuota)),
      }
    })
  }, [contratos, notiMap])

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

  const totalSeleccionado = useMemo(() => {
    let t = 0
    seleccionados.forEach((id) => { const f = filaPorId.get(id); if (f) t += f.apagar || 0 })
    return t
  }, [seleccionados, filaPorId])

  function toggleValor(colKey, valor) {
    setFiltros((prev) => {
      const actual = prev[colKey] ? new Set(prev[colKey]) : new Set(distinct[colKey])
      actual.has(valor) ? actual.delete(valor) : actual.add(valor)
      const next = { ...prev }
      if (actual.size === distinct[colKey].length) delete next[colKey]; else next[colKey] = actual
      return next
    })
  }
  function setTodosFiltro(colKey, listaVisible, marcar) {
    setFiltros((prev) => {
      const actual = prev[colKey] ? new Set(prev[colKey]) : new Set(distinct[colKey])
      listaVisible.forEach((v) => { marcar ? actual.add(v) : actual.delete(v) })
      const next = { ...prev }
      if (actual.size === distinct[colKey].length) delete next[colKey]; else next[colKey] = actual
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
  async function toggleInhibir(f) {
    setMenuFila(null)
    const actual = f.envioEstado === ENVIO.INHIBIDO
    const ok = await upsertNoti(f.idadmon, { inhibir: !actual })
    if (ok) { setSeleccionados((p) => { const n = new Set(p); n.delete(f.idadmon); return n }); cargarNoti(mesSel) }
  }
  async function reabrir(f) {
    setMenuFila(null)
    const ok = await upsertNoti(f.idadmon, { fecha_envio: null })
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
      ajuste: f.ajuste,
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
        const ahora = new Date().toISOString()
        const okIds = data.detalle.filter((d) => d.ok).map((d) => d.idadmon)
        if (okIds.length) {
          const filasUpsert = okIds.map((id) => {
            const f = filaPorId.get(id)
            return {
              idadmon: id, mes_notificacion: mesSel, fecha_envio: ahora,
              email_usado: f ? f.mail_arrendatario : null,
              apagar_enviado: f ? f.apagar : null,
              revision_enviada: f ? f.revision : null,
              actualizado_en: ahora,
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
    const map = {
      [ENVIO.ENVIADO]:   { color: '#166534', bg: '#F0FDF4', txt: `✓ ${fmtFechaEnvio(f.fechaEnvio)}` },
      [ENVIO.INHIBIDO]:  { color: '#6B7280', bg: '#F3F4F6', txt: '⊘ Inhibido' },
      [ENVIO.FALTAN]:    { color: '#DC2626', bg: '#FEF2F2', txt: '⚠ Faltan datos' },
      [ENVIO.PENDIENTE]: { color: '#92400E', bg: '#FFFBEB', txt: '— Pendiente' },
    }
    const s = map[f.envioEstado] || map[ENVIO.PENDIENTE]
    return (
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span title={f.comentario || ''}
          style={{ fontSize: 11, fontWeight: 600, color: s.color, background: s.bg, padding: '2px 7px', borderRadius: 6, whiteSpace: 'nowrap' }}>
          {s.txt}
        </span>
        {f.comentario && <span title={f.comentario} style={{ fontSize: 11, color: '#9CA3AF' }}>💬</span>}
        <button onClick={() => setMenuFila(menuFila === f.idadmon ? null : f.idadmon)}
          title="Acciones" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#B4B2A9', fontSize: 12, padding: '0 2px' }}>⋯</button>
        {menuFila === f.idadmon && (
          <>
            <div onClick={() => setMenuFila(null)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
            <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 41, width: 190,
              background: '#fff', border: '1px solid #D3D1C7', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 4 }}>
              <button onClick={() => toggleInhibir(f)} style={menuItem}>
                {f.envioEstado === ENVIO.INHIBIDO ? '↻ Reactivar' : '⊘ Inhibir'}
              </button>
              <button onClick={() => abrirComentario(f)} style={menuItem}>✎ Editar comentario</button>
              {f.envioEstado === ENVIO.ENVIADO && (
                <button onClick={() => reabrir(f)} style={menuItem}>↺ Reabrir (permitir reenvío)</button>
              )}
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
          <div style={{ position: 'relative', marginLeft: 'auto' }}>
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
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid #F0EEE8', fontSize: 12, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.propietario || '—'}</td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid #F0EEE8', fontSize: 12, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.inmueble || '—'}</td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid #F0EEE8', fontSize: 12, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.arrendatario || '—'}</td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid #F0EEE8' }}><RevBadge revision={c.revision} /></td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid #F0EEE8', fontSize: 13, fontWeight: 600, color: '#2C2C2A', textAlign: 'right' }}>${fmtMiles(c.apagar)}</td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid #F0EEE8', fontSize: 11, color: c.tipoCom === 'UF' ? '#1a56db' : c.tipoCom === 'AJUSTE' ? '#d97706' : '#9CA3AF', fontWeight: 500 }}>{c.tipoCom}</td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid #F0EEE8' }}><CeldaEnvio f={c} /></td>
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
          <button onClick={abrirModal} style={{ fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#1D9E75', color: '#fff', cursor: 'pointer' }}>Enviar notificación</button>
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

      {comentarioEdit && (
        <div onClick={() => setComentarioEdit(null)} style={{ position: 'fixed', inset: 0, zIndex: 55, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 22, width: 420, maxWidth: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 10px', color: '#2C2C2A' }}>Comentario · {comentarioEdit.idadmon}</h3>
            <textarea value={comentarioEdit.texto} onChange={(e) => setComentarioEdit({ ...comentarioEdit, texto: e.target.value })}
              rows={4} placeholder="Anotación libre (no bloquea el envío; para bloquear usa Inhibir)"
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
