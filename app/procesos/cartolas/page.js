'use client'
// VERSION: v22 · 2026-08-15 · Cartola por IDADMON, mejor aprovechamiento del espacio: (1) CABECERA (ficha) más
//   compacta (≈mitad de alto): menos padding, saldo total en una línea, etiquetas más cortas ("Quién tiene la
//   garantía"→"Quién"). (2) El bloque PROPORCIONAL del primer mes deja de ocupar su propia franja y pasa a la
//   derecha de la línea "Movimientos" (chip desplegable). El panel de Morosidad (cuadros 2/3) se compacta en su
//   propio componente (MorosidadCartola v6). Hereda v21.
// VERSION: v21 · 2026-08-15 · Vista Tabla, dos ajustes de espacio/uso: (1) BUSCADOR de IDADMON incrustado en la
//   barra sticky superior (junto a las pestañas). "Ver cuenta" salta directo a la Cartola por IDADMON YA cargada,
//   sin pasar por la página en blanco. (2) Se elimina el bloque central redundante (título "Cuentas (CARTOLAS)" +
//   subtítulo "recientes abajo…") y los botones "Duplicados"/"Refrescar" se suben a la barra sticky (derecha), para
//   recuperar espacio vertical. El estado del IDADMON a abrir se eleva al componente padre. Hereda v20.
// VERSION: v20 · 2026-08-15 · Cartola por IDADMON: las 3 líneas de arriba (pestañas + título + buscador) se
//   unifican en UNA sola barra sticky bajo el TopNav (top:52): [pestañas Tabla/Cartola por IDADMON] + input +
//   "Ver cuenta" + "Añadir línea". Se quita el título redundante y el botón "Añadir línea" duplicado de la
//   sección Movimientos. Las cabeceras de las tablas siguen sticky en su scroll. Hereda v19.
// VERSION: v19 · 2026-08-13 · Colores de fila diferenciados: CAMBIO MANUAL → rojo SUAVE (#FDEBEA); "no cuadra
//   con la liquidación" → rojo FUERTE (#F5B7B1, prioritario). Hereda v18.
// VERSION: v18 · 2026-08-13 · Movimientos: las filas con CAMBIO MANUAL (línea añadida a mano, cargo editado o
//   cargo con override) se pintan con fondo ROJO SUAVE, para localizarlas de un vistazo. Hereda v17.
// VERSION: v17 · 2026-08-13 · RECAP bajo "Movimientos": se repite IDADMON+Estado, Propietario e Inmueble, para
//   saber siempre qué contrato se está mirando al hacer scroll a la tabla. Hereda v16.
// VERSION: v16 · 2026-08-12 · AÑADIR líneas (cargo o abono): Dirección Y KARINA (antes solo Dirección). El botón
//   "➕ Añadir línea" sigue encima de la tabla y arriba. Cada alta/edición/anulación registra usuario y fecha/hora en
//   cuentas_bitacora. Requiere movimiento v4 (alta para Dirección + Karina). Hereda v15.
// VERSION: v15 · 2026-08-12 · AÑADIR líneas (cargo o abono) pasa a ser SOLO Dirección, con botón "➕ Añadir línea"
//   también encima de la tabla de movimientos (donde se trabaja). Editar cargo y anular/reactivar siguen para
//   Dirección + Alberto/Luis/Karina. Requiere movimiento v3 (alta restringida a Dirección). Hereda v14.
// VERSION: v14 · 2026-08-12 · CARGOS gestionables por Dirección + Alberto/Luis/Karina: editar el cargo de CUALQUIER
//   línea (antes solo 5 recientes), y ANULAR/REACTIVAR cualquier línea de cargo (soft, reversible, auditado), además
//   de añadir/editar manuales. Requiere editar-cargo v2 y movimiento v2. Hereda v13.
// VERSION: v13 · 2026-08-12 · Movimientos: Comentarios recortado a 15 caracteres + tooltip (title) con el texto
//   completo; Calif y Justificantes también con tooltip. Así la tabla cabe y las columnas de la derecha se ven
//   sin scroll horizontal. Hereda v12.
// VERSION: v12 · 2026-08-12 · BLINDAJE anti-scroll-horizontal: overflow-x:clip en html/body mientras la página está
//   montada (cubre también el TopNav y cualquier ancestro), además del clip del contenedor. Las tablas conservan su
//   scroll interno; el vertical y los sticky no se rompen (clip, no hidden). Hereda v11.
// VERSION: v11 · 2026-08-12 · overflowX:'clip' en el contenedor de la ficha por IDADMON → la página nunca necesita
//   scroll horizontal (las tablas siguen con su propio scroll interno). Hereda v10.
// VERSION: v10 · 2026-08-12 · Panel de MOROSIDAD (componente MorosidadCartola) bajo la cabecera de la Cartola
//   por IDADMON: comportamiento de pago (KPIs + saldo a fin de mes + calendario), para leer al deudor antes
//   de reclamar. Hereda v9.
// VERSION: v9 · 2026-08-11 · Cartola por IDADMON: botón "➕ Añadir movimiento" (solo Dirección + Karina) para
//   registrar manualmente un CARGO o un ABONO, y en cada fila MANUAL botones "editar" y "anular" (anular es
//   reversible). Todo escribe en `cuentas` vía /api/cartolas/movimiento y deja rastro en `cuentas_bitacora`
//   (motivo obligatorio, quién/cuándo). Las filas manuales llevan chip MANUAL; las anuladas, chip ANULADO, no
//   suman al saldo y su saldo corrido sale como "—". Hereda v8. Requiere el SQL de `cuentas_bitacora` + columnas
//   manual/anulado en `cuentas`.
// VERSION: v8 · 2026-08-03 · Tooltip (title) al pasar el ratón en Concepto, Comentarios, Justificantes,
//   Propietario, Inmueble y updated_at, para ver el contenido completo cuando la celda lo trunca.
// VERSION: v7 · 2026-07-28 · Cartola por IDADMON: editar el CARGO de los 5 movimientos
//   más recientes (Dirección/Karina, incl. Término), con motivo obligatorio y auditoría. El valor va
//   a cargo_manual (override; el original queda en `cargo` y sobrevive al re-volcado del LOG). Una
//   fila editada se pinta en ROJO si su cargo no coincide con a_cobrar de liquidacion_idadmon del mes.
// VERSION: v6 · 2026-07-23 · LA CAUSA REAL: fmtNum() se usaba en la columna Saldo de la Cartola
//   por IDADMON pero NUNCA se definió (se coló en la v4 del 21/07). Cualquier IDADMON con
//   movimientos reventaba al pintar. Definida aquí. El salvavidas de la v5 se queda como red.
// VERSION: v5 · 2026-07-23 · Estabilidad:
//   · loadMore() se protegía con un estado (loadingMore) que es asíncrono, así que un scroll
//     rápido disparaba N consultas idénticas antes de que React actualizara el flag: las mismas
//     50 filas se añadían N veces y la tabla crecía sin control hasta tumbar la pestaña.
//     Ahora el candado es un ref (síncrono) + deduplicado por id + tope de filas en memoria.
//   · Cartola por IDADMON: avisa del estado P (antes solo Q y N) y deja ver siempre lo que haya
//     en CUENTAS aunque el contrato no tenga todavía datos de INICIOS.
//   · Un error de pintado ya no deja la pantalla en blanco: se muestra el motivo.
// VERSION: v4 · 2026-07-21 · Todos los números (Cartola IDADMON y Tabla) en fuente monoespaciada; saldo de fila sin $ (fmtNum).
// VERSION: v3 · 2026-07-21 · Cartola IDADMON: proporcional colapsado (details), números sin $ con separador de miles y fuente monoespaciada, más altura para movimientos (cabeceras ya sticky).
// VERSION: v2 · 2026-07-20 · Aviso de proporcional: coteja el cargo contra datos_arriendos.proporcional (el dato con que se carga el inicio), no contra el recálculo. Recálculo de calendario queda como info. Tolerancia ±100; avisa si falta respaldo en LOG.

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Component, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import TopNav from '@/app/components/ui/TopNav'
import MorosidadCartola from '@/app/components/MorosidadCartola'

const num = (v) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d.-]/g, '')) || 0)
const fmt = (v) => { const n = num(v); return n ? n.toLocaleString('es-CL') : (String(v ?? '').trim() === '0' ? '0' : '') }
const money = (v) => { const n = num(v); return n ? '$' + n.toLocaleString('es-CL') : '$0' }
// Número con separador de miles y SIN símbolo de moneda. Se usa en la columna Saldo de la
// cartola por IDADMON: ahí el 0 sí debe verse, así que no se devuelve cadena vacía.
const fmtNum = (v) => num(v).toLocaleString('es-CL')
const LIMITE = 50
const MAX_FILAS = 3000   // techo de filas en memoria; evita que la pestaña se quede sin RAM

const EDITABLES = ['idadmon', 'concepto', 'comentarios', 'calif', 'estado']
const EDITORES = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']

const COLS = [
  { key: 'fecha',         h: 'Fecha',        w: 90,  align: 'left'  },
  { key: 'idadmon',       h: 'IDADMON',      w: 84,  align: 'left'  },
  { key: 'concepto',      h: 'Concepto',     w: 240, align: 'left', wrap: true },
  { key: 'cargo',         h: 'Cargo',        w: 90,  align: 'right', money: true, color: '#9B1C1C' },
  { key: 'abono',         h: 'Abono',        w: 90,  align: 'right', money: true, color: '#085041' },
  { key: 'saldo',         h: 'Saldo',        w: 90,  align: 'right', money: true },
  { key: 'comentarios',   h: 'Comentarios',  w: 170, align: 'left', wrap: true },
  { key: 'calif',         h: 'Calif',        w: 88,  align: 'left'  },
  { key: 'justificantes', h: 'Justificantes',w: 120, align: 'left'  },
  { key: 'estado',        h: 'Estado',       w: 70,  align: 'left'  },
  { key: 'propietario',   h: 'Propietario',  w: 190, align: 'left', wrap: true },
  { key: 'inmueble',      h: 'Inmueble',     w: 200, align: 'left', wrap: true },
  { key: 'updated_at',    h: 'updated_at',   w: 130, align: 'left'  },
  { key: 'sync_hash',     h: 'sync_hash',    w: 120, align: 'left'  },
  { key: 'sync_id',       h: 'sync_id',      w: 110, align: 'left'  },
]

// parsea "dd/mm/aaaa" -> número comparable (aaaammdd); vacío -> 0
const fechaOrden = (s) => {
  const m = String(s ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return 0
  return Number(m[3]) * 10000 + Number(m[2]) * 100 + Number(m[1])
}

/* Red de seguridad: si algo revienta al pintar, se muestra el motivo en vez de dejar la
   pantalla en blanco. Sin esto, un dato inesperado tumba la vista entera sin decir por qué. */
class Salvavidas extends Component {
  constructor(props) { super(props); this.state = { err: null } }
  static getDerivedStateFromError(err) { return { err } }
  componentDidCatch(err, info) { console.error('Cartolas · error al pintar:', err, info) }
  render() {
    if (!this.state.err) return this.props.children
    return (
      <div style={{ margin: '20px auto', maxWidth: 720, padding: 20, borderRadius: 10, background: '#FDECEC', border: '0.5px solid #F1B0B0' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#9B1C1C', marginBottom: 6 }}>No se ha podido mostrar esta vista</div>
        <div style={{ fontSize: 13, color: '#5F5E5A', marginBottom: 12 }}>
          El resto de la página sigue funcionando. Copia este mensaje y pásalo a soporte:
        </div>
        <pre style={{ fontSize: 11, background: '#fff', padding: 10, borderRadius: 6, overflow: 'auto', margin: 0, color: '#9B1C1C' }}>
          {String(this.state.err?.message || this.state.err)}
        </pre>
        <button onClick={() => this.setState({ err: null })}
          style={{ marginTop: 12, fontSize: 13, fontWeight: 600, padding: '7px 16px', borderRadius: 8, border: 'none', background: '#1D9E75', color: '#fff', cursor: 'pointer' }}>
          Reintentar
        </button>
      </div>
    )
  }
}

export default function CartolasPage() {
  const [vista, setVista] = useState('tabla')   // 'tabla' | 'idadmon'
  const [idadmonReq, setIdadmonReq] = useState('')   // IDADMON a abrir desde el buscador de la vista Tabla
  // Desde la barra de la Tabla: fija el IDADMON pedido y salta a la vista de cartola (que lo carga sola).
  const abrirCartola = (id) => {
    const v = String(id || '').trim().toUpperCase()
    if (!v) return
    setIdadmonReq(v); setVista('idadmon')
  }
  return (
    <>
      <TopNav />
      <Salvavidas key={vista}>
        {vista === 'tabla'
          ? <TablaVista vista={vista} setVista={setVista} abrirCartola={abrirCartola} />
          : <CartolaIdadmonVista vista={vista} setVista={setVista} initialId={idadmonReq} onConsumed={() => setIdadmonReq('')} />}
      </Salvavidas>
    </>
  )
}

/* ============================================================
   VISTA 1 — TABLA (espejo de cuentas, scroll infinito + filtros)
   ============================================================ */
// Selector de vista compacto (segmentado), para vivir dentro de la barra sticky de cada vista.
function TabsCartola({ vista, setVista }) {
  return (
    <div style={{ display: 'inline-flex', background: '#ECEAE3', borderRadius: 10, padding: 3, gap: 3, flexShrink: 0 }}>
      {[['tabla', 'Tabla'], ['idadmon', 'Cartola por IDADMON']].map(([k, label]) => (
        <button key={k} onClick={() => setVista(k)}
          style={{ fontSize: 13, fontWeight: 600, padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: vista === k ? '#fff' : 'transparent', color: vista === k ? '#2C2C2A' : '#7A7870',
            boxShadow: vista === k ? '0 1px 2px rgba(0,0,0,0.10)' : 'none' }}>
          {label}
        </button>
      ))}
    </div>
  )
}

function TablaVista({ vista, setVista, abrirCartola }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [idBusca, setIdBusca] = useState('')   // IDADMON tecleado en la barra para abrir su cartola
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [noMore, setNoMore] = useState(false)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [filtros, setFiltros] = useState({})
  const [openF, setOpenF] = useState(null)
  const [draft, setDraft] = useState({})
  const [savingId, setSavingId] = useState(null)
  const [toast, setToast] = useState(null)
  // Chequeo de duplicados (modal)
  const [dupOpen, setDupOpen] = useState(false)
  const [dupLoading, setDupLoading] = useState(false)
  const [dupErr, setDupErr] = useState(null)
  const [dupGrupos, setDupGrupos] = useState([])
  const [dupSel, setDupSel] = useState(() => new Set())   // ids marcados para borrar
  const [dupBorrando, setDupBorrando] = useState(false)
  const [dupDesde, setDupDesde] = useState('')            // YYYY-MM-DD (input date)
  const [dupHasta, setDupHasta] = useState('')            // YYYY-MM-DD (input date)
  const [dupEscaneado, setDupEscaneado] = useState(false) // ya se corrió al menos un escaneo
  const [dupResumen, setDupResumen] = useState(null)      // { totalGrupos, totalSobrantes }
  const scrollRef = useRef(null)
  const anclarAbajo = useRef(false)
  const pendingAdjust = useRef(null)
  const cargando = useRef(false)   // candado SÍNCRONO: el estado llega tarde y deja pasar N llamadas

  const rol = session?.user?.role
  const puedeEditar = rol === 'direccion' || rol === 'finanzas'

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(null), 1400) }

  useEffect(() => { if (status === 'unauthenticated') router.push('/api/auth/signin') }, [status, router])

  const buildQuery = (fActuales) => {
    let q = supabase.from('cuentas').select('*')
    for (const [key, f] of Object.entries(fActuales)) {
      if (!f) continue
      const col = COLS.find(c => c.key === key)
      if (col?.money) {
        if ((f.min ?? '') !== '') q = q.gte(key, Number(f.min))
        if ((f.max ?? '') !== '') q = q.lte(key, Number(f.max))
      } else if ((f.search ?? '') !== '') {
        q = q.ilike(key, `%${f.search}%`)
      }
    }
    return q
  }

  const fetchInitial = async (fActuales = filtros) => {
    cargando.current = false
    setRefreshing(true); setError(null); setNoMore(false)
    const { data, error } = await buildQuery(fActuales).order('id', { ascending: false }).limit(LIMITE)
    if (error) { setError(error.message); setRefreshing(false); setLoading(false); return }
    const arr = (data || []).reverse()
    anclarAbajo.current = true
    setRows(arr)
    setNoMore((data || []).length < LIMITE)
    setRefreshing(false); setLoading(false)
  }
  useEffect(() => { fetchInitial({}) }, [])

  const loadMore = async () => {
    // El candado va en un ref, no en el estado: setLoadingMore no surte efecto hasta el siguiente
    // render, y mientras tanto el scroll dispara decenas de llamadas con el mismo minId.
    if (cargando.current || noMore || loading || rows.length === 0) return
    if (rows.length >= MAX_FILAS) { setNoMore(true); return }
    cargando.current = true
    setLoadingMore(true)
    try {
      const minId = rows[0].id
      const el = scrollRef.current
      const prevH = el ? el.scrollHeight : 0
      const prevT = el ? el.scrollTop : 0
      const { data, error } = await buildQuery(filtros).lt('id', minId).order('id', { ascending: false }).limit(LIMITE)
      if (error) { setError(error.message); return }
      const nuevos = (data || []).reverse()
      if (nuevos.length > 0) {
        pendingAdjust.current = { prevH, prevT }
        setRows(rs => {
          // Deduplicar por id: si alguna llamada se coló, no se repiten filas.
          const vistos = new Set(rs.map(r => r.id))
          const limpios = nuevos.filter(r => !vistos.has(r.id))
          return limpios.length ? [...limpios, ...rs] : rs
        })
      }
      if ((data || []).length < LIMITE) setNoMore(true)
    } finally {
      cargando.current = false
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (pendingAdjust.current) {
      const { prevH, prevT } = pendingAdjust.current
      el.scrollTop = prevT + (el.scrollHeight - prevH)
      pendingAdjust.current = null
    } else if (anclarAbajo.current) {
      el.scrollTop = el.scrollHeight
      anclarAbajo.current = false
    }
  }, [rows])

  const onScroll = (e) => { if (e.currentTarget.scrollTop <= 40) loadMore() }

  const activo = (key) => {
    const f = filtros[key]
    return !!f && ((f.search ?? '') !== '' || (f.min ?? '') !== '' || (f.max ?? '') !== '')
  }
  const hayFiltros = Object.keys(filtros).some(k => activo(k))

  const filaEsBI = (r) => String(r.comentarios || '').trim().toUpperCase() === 'BI'
  const celdaEditable = (r, c) => puedeEditar && !filaEsBI(r) && EDITABLES.includes(c.key)

  const guardarCelda = async (id, k, valor) => {
    const v = valor === '' ? null : valor
    setSavingId(id)
    const { error } = await supabase.from('cuentas').update({ [k]: v }).eq('id', id)
    setSavingId(null)
    if (error) { setError('No se pudo guardar: ' + error.message); return }
    setRows(rs => rs.map(r => r.id === id ? { ...r, [k]: v } : r))
    flash('✓ Guardado')
  }
  const onLocal = (id, k, v) => setRows(rs => rs.map(r => r.id === id ? { ...r, [k]: v } : r))

  // ── Chequeo de duplicados ─────────────────────────────────────────────
  // Duplicado = fila idéntica a otra en fecha·idadmon·concepto·cargo·abono·saldo·comentarios
  // (NO se compara el folio `calif` ni `justificantes`). Se conserva la de menor id.
  // Se busca por RANGO de fechas para revisar y borrar por tramos (nunca todo de golpe).
  const abrirDuplicados = () => {
    setDupOpen(true); setDupErr(null); setDupGrupos([]); setDupSel(new Set())
    setDupEscaneado(false); setDupResumen(null)
  }

  const escanearDuplicados = async () => {
    setDupLoading(true); setDupErr(null); setDupGrupos([]); setDupSel(new Set()); setDupResumen(null)
    try {
      const params = new URLSearchParams()
      if (dupDesde) params.set('desde', dupDesde)
      if (dupHasta) params.set('hasta', dupHasta)
      const res = await fetch('/api/cartolas/duplicados?' + params.toString())
      const data = await res.json()
      if (!res.ok) { setDupErr(data.error || 'Error al detectar'); setDupLoading(false); setDupEscaneado(true); return }
      const grupos = data.grupos || []
      const sel = new Set()
      for (const g of grupos) g.filas.slice(1).forEach(f => sel.add(f.id))
      setDupGrupos(grupos); setDupSel(sel)
      setDupResumen({ totalGrupos: data.totalGrupos || grupos.length, totalSobrantes: data.totalSobrantes || sel.size })
    } catch { setDupErr('Error de conexión') }
    setDupLoading(false); setDupEscaneado(true)
  }

  const toggleDup = (id) => setDupSel(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
  })

  const eliminarDuplicados = async () => {
    const ids = [...dupSel]
    if (ids.length === 0) return
    if (!window.confirm(`Se eliminarán ${ids.length} fila(s) duplicada(s) de CUENTAS en el rango elegido. Se conserva siempre la primera (id más bajo) de cada grupo. Esta acción no se puede deshacer. ¿Continuar?`)) return
    setDupBorrando(true); setDupErr(null)
    try {
      const res = await fetch('/api/cartolas/duplicados', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      const data = await res.json()
      if (!res.ok) { setDupErr(data.error || 'Error al eliminar'); setDupBorrando(false); return }
      flash(`✓ ${data.borrados} fila(s) eliminada(s)`)
      setDupBorrando(false)
      await escanearDuplicados()   // re-escanea el mismo rango para ver lo que quede
      fetchInitial()               // refresca la tabla principal
    } catch { setDupErr('Error de conexión'); setDupBorrando(false) }
  }

  // Borrado MASIVO por rango: no manda ids (evita el cuelgue del navegador con miles
  // de checkboxes). El servidor recalcula los sobrantes del rango y los borra en lotes.
  const eliminarRango = async () => {
    const total = dupResumen?.totalSobrantes || 0
    if (!total) return
    if (!window.confirm(`Se eliminarán TODOS los sobrantes del rango ${dupDesde || '(inicio)'} → ${dupHasta || '(fin)'}: ${total} fila(s). Se conserva siempre la primera (id más bajo) de cada grupo. Esta acción no se puede deshacer. ¿Continuar?`)) return
    setDupBorrando(true); setDupErr(null)
    try {
      const res = await fetch('/api/cartolas/duplicados', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modo: 'rango', desde: dupDesde, hasta: dupHasta }),
      })
      const data = await res.json()
      if (!res.ok) { setDupErr(data.error || 'Error al eliminar'); setDupBorrando(false); return }
      flash(`✓ ${data.borrados} fila(s) eliminada(s)`)
      setDupBorrando(false)
      await escanearDuplicados()   // re-escanea el rango (debería quedar limpio)
      fetchInitial()
    } catch { setDupErr('Error de conexión'); setDupBorrando(false) }
  }

  if (status === 'loading' || loading)
    return (<div style={{ padding: 60, textAlign: 'center', color: '#888', fontSize: 14 }}>Cargando cuentas…</div>)

  const bgCelda = (r, c) => {
    if (String(r.calif || '').trim().toUpperCase() === 'INICIO' && (c.key === 'idadmon' || c.key === 'concepto' || c.key === 'cargo'))
      return '#E9F4E4'
    return '#fff'
  }
  const estiloTexto = (r, c) => {
    if (filaEsBI(r)) {
      if (c.key === 'comentarios') return { fontWeight: 700 }
      if (c.key === 'calif') return { color: '#B8860B', fontWeight: 600 }
    }
    return {}
  }

  // Columnas cuyo contenido se muestra completo en un tooltip al pasar el ratón.
  const COLS_TOOLTIP = new Set(['concepto', 'comentarios', 'justificantes', 'propietario', 'inmueble', 'updated_at'])
  const tooltipCelda = (r, c) => {
    if (!COLS_TOOLTIP.has(c.key)) return undefined
    let v = r[c.key]
    if (v == null || v === '') return undefined
    if (c.key === 'updated_at') { const d = String(v); return d.length >= 16 ? (d.slice(0, 10) + ' ' + d.slice(11, 16)) : d }
    return String(v)
  }

  const cell = (r, c) => {
    if (celdaEditable(r, c)) return (
      <input value={r[c.key] ?? ''} onChange={e => onLocal(r.id, c.key, e.target.value)}
        onBlur={e => { if ((r[c.key] ?? '') !== e.target.value) guardarCelda(r.id, c.key, e.target.value) }}
        onFocus={e => { e.target.style.border = '1px solid #1D9E75'; e.target.style.background = '#fff' }}
        onBlurCapture={e => { e.target.style.border = '1px solid transparent'; e.target.style.background = 'transparent' }}
        style={{ width: '100%', border: '1px solid transparent', borderRadius: 4, padding: '2px 4px', fontSize: 11, background: 'transparent', textAlign: c.align, color: '#2C2C2A', boxSizing: 'border-box' }} />
    )
    if (c.money) { const s = fmt(r[c.key]); return <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: s && c.color ? c.color : '#2C2C2A' }}>{s || '—'}</span> }
    return <span style={estiloTexto(r, c)}>{r[c.key] ?? '—'}</span>
  }

  const popCol = openF ? COLS.find(c => c.key === openF.key) : null
  const abrirFiltro = (c, e) => {
    const rc = e.currentTarget.getBoundingClientRect()
    setDraft(filtros[c.key] || {})
    setOpenF(openF && openF.key === c.key ? null : { key: c.key, x: rc.left, y: rc.bottom + 2 })
  }
  const aplicarFiltro = () => {
    const nf = { ...filtros, [openF.key]: draft }
    setFiltros(nf); setOpenF(null); fetchInitial(nf)
  }
  const quitarFiltro = () => {
    const nf = { ...filtros }; delete nf[openF.key]
    setFiltros(nf); setOpenF(null); fetchInitial(nf)
  }
  const renderPop = () => {
    if (!openF || !popCol) return null
    const c = popCol
    const left = Math.min(openF.x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 260)
    return (
      <>
        <div onClick={() => setOpenF(null)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
        <div style={{ position: 'fixed', left, top: openF.y, width: 248, background: '#fff', border: '0.5px solid #B4B2A9', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,.15)', zIndex: 41, fontSize: 12 }}>
          <div style={{ padding: 10 }}>
            <div style={{ fontWeight: 600, color: '#5F5E5A', marginBottom: 6 }}>Filtrar: {c.h}</div>
            {c.money ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={draft.min ?? ''} onChange={e => setDraft(d => ({ ...d, min: e.target.value }))} placeholder="≥ min" inputMode="numeric"
                  style={{ width: '50%', fontSize: 12, padding: '5px 6px', border: '0.5px solid #D3D1C7', borderRadius: 5, boxSizing: 'border-box' }} />
                <input value={draft.max ?? ''} onChange={e => setDraft(d => ({ ...d, max: e.target.value }))} placeholder="≤ max" inputMode="numeric"
                  style={{ width: '50%', fontSize: 12, padding: '5px 6px', border: '0.5px solid #D3D1C7', borderRadius: 5, boxSizing: 'border-box' }} />
              </div>
            ) : (
              <input autoFocus value={draft.search ?? ''} onChange={e => setDraft(d => ({ ...d, search: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') aplicarFiltro() }} placeholder="contiene…"
                style={{ width: '100%', fontSize: 12, padding: '5px 6px', border: '0.5px solid #D3D1C7', borderRadius: 5, boxSizing: 'border-box' }} />
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', borderTop: '0.5px solid #EDEBE4' }}>
            <button onClick={quitarFiltro} style={{ fontSize: 11, border: '0.5px solid #D3D1C7', background: '#fff', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>Quitar</button>
            <button onClick={aplicarFiltro} style={{ fontSize: 11, border: 'none', background: '#1D9E75', color: '#fff', borderRadius: 6, padding: '4px 14px', cursor: 'pointer' }}>Aplicar</button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div style={{ maxWidth: 1760, margin: '0 auto', padding: '8px 20px 30px' }}>
        <div style={{ position: 'sticky', top: 52, zIndex: 40, background: '#fff', margin: '0 -20px 12px', padding: '8px 20px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid #E3E1D8', boxShadow: '0 4px 10px -8px rgba(0,0,0,0.25)' }}>
          <TabsCartola vista={vista} setVista={setVista} />
          <span style={{ width: 1, height: 24, background: '#D3D1C7' }} />
          <input value={idBusca} onChange={e => setIdBusca(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') abrirCartola(idBusca) }}
            placeholder="IDADMON (ej. A00857)"
            style={{ fontSize: 13, padding: '7px 11px', border: '0.5px solid #B4B2A9', borderRadius: 8, width: 180, textTransform: 'uppercase' }} />
          <button onClick={() => abrirCartola(idBusca)}
            title="Abrir la cartola de este IDADMON"
            style={{ fontSize: 13, fontWeight: 600, padding: '7px 16px', borderRadius: 8, border: 'none', background: '#1D9E75', color: '#fff', cursor: 'pointer' }}>
            Ver cuenta
          </button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            {!puedeEditar && <span style={{ fontSize: 11, color: '#888780' }}>solo lectura</span>}
            <button onClick={abrirDuplicados}
              title="Buscar filas duplicadas en CUENTAS (por rango de fechas)"
              style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: '0.5px solid #D3D1C7', background: '#fff', color: '#5F5E5A', cursor: 'pointer' }}>
              🔍 Duplicados
            </button>
            <button onClick={() => fetchInitial()} disabled={refreshing}
              style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: 'none', background: '#1D9E75', color: '#fff', cursor: 'pointer' }}>
              {refreshing ? 'Refrescando…' : 'Refrescar'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 10, fontSize: 11, color: '#5F5E5A', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><i style={{ width: 12, height: 12, background: '#fff', border: '0.5px solid #D3D1C7', borderRadius: 2 }} /> <b style={{ fontWeight: 700 }}>BI</b> = del banco (bloqueada)</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><i style={{ width: 12, height: 12, background: '#E9F4E4', border: '0.5px solid #C4E0BC', borderRadius: 2 }} /> INICIO = datos iniciales</span>
          {savingId && <span style={{ color: '#1D9E75' }}>guardando…</span>}
        </div>

        {error && <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: '#FDECEC', border: '0.5px solid #F1B0B0', color: '#9B1C1C', fontSize: 12 }}>{error}</div>}

        <div ref={scrollRef} onScroll={onScroll} style={{ overflow: 'auto', maxHeight: '74vh', border: '0.5px solid #D3D1C7', borderRadius: 8 }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, fontSize: 11, minWidth: 1700, fontVariantNumeric: 'tabular-nums' }}>
            <thead>
              <tr style={{ background: '#F1EFE8' }}>
                {COLS.map((c, i) => (
                  <th key={i} style={{ padding: '6px 8px', textAlign: c.align, fontWeight: 600, color: '#5F5E5A', whiteSpace: 'nowrap', minWidth: c.w, position: 'sticky', top: 0, background: '#F1EFE8', zIndex: 3, borderBottom: '0.5px solid #D3D1C7' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {c.h}
                      <button onClick={(e) => abrirFiltro(c, e)} title="Filtrar"
                        style={{ border: 'none', background: activo(c.key) ? '#1D9E75' : 'transparent', color: activo(c.key) ? '#fff' : '#888780', borderRadius: 4, cursor: 'pointer', fontSize: 10, lineHeight: 1, padding: '2px 4px' }}>▾</button>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loadingMore && <tr><td colSpan={COLS.length} style={{ padding: 8, textAlign: 'center', color: '#888780' }}>Cargando más…</td></tr>}
              {!loadingMore && noMore && rows.length > 0 && <tr><td colSpan={COLS.length} style={{ padding: 6, textAlign: 'center', color: '#B4B2A9', fontSize: 10 }}>— inicio de la tabla —</td></tr>}
              {rows.map((r) => (
                <tr key={r.id}>
                  {COLS.map((c, ci) => (
                    <td key={ci} title={tooltipCelda(r, c)} style={{ padding: celdaEditable(r, c) ? '2px 4px' : '5px 8px', textAlign: c.align, whiteSpace: c.wrap ? 'normal' : 'nowrap', background: bgCelda(r, c), color: '#2C2C2A', borderBottom: '0.5px solid #EDEBE4', maxWidth: c.w + 60, overflow: 'hidden', textOverflow: c.wrap ? 'clip' : 'ellipsis' }}>
                      {cell(r, c)}
                    </td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={COLS.length} style={{ padding: 24, textAlign: 'center', color: '#888780' }}>Sin resultados con esos filtros.</td></tr>}
            </tbody>
          </table>
        </div>

        <div style={{ fontSize: 11, color: '#888780', marginTop: 8 }}>
          {rows.length} fila(s) cargada(s){hayFiltros ? ' (filtradas)' : ''} · {noMore ? 'no hay más hacia atrás' : 'sube para cargar más'}.
        </div>
      </div>
      {renderPop()}
      {dupOpen && (
        <>
          <div onClick={() => !dupBorrando && setDupOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 70 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(1040px, 96vw)', maxHeight: '88vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.25)', zIndex: 71 }}>
            <div style={{ padding: '14px 18px', borderBottom: '0.5px solid #E4E2DA', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#2C2C2A' }}>Duplicados en CUENTAS</div>
                <div style={{ fontSize: 11, color: '#888780' }}>Idénticas en fecha · IDADMON · concepto · cargo · abono · comentarios · calif (no se comparan saldo ni justificantes). Se conserva la de menor id.</div>
              </div>
              <button onClick={() => !dupBorrando && setDupOpen(false)}
                style={{ border: 'none', background: '#F1EFE8', color: '#5F5E5A', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Cerrar</button>
            </div>

            {/* Rango de fechas + Escanear */}
            <div style={{ padding: '12px 18px', borderBottom: '0.5px solid #E4E2DA', display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
              <label style={{ fontSize: 11, color: '#5F5E5A', display: 'flex', flexDirection: 'column', gap: 3 }}>
                Desde
                <input type="date" value={dupDesde} onChange={e => setDupDesde(e.target.value)}
                  style={{ fontSize: 12, padding: '5px 8px', border: '0.5px solid #D3D1C7', borderRadius: 6 }} />
              </label>
              <label style={{ fontSize: 11, color: '#5F5E5A', display: 'flex', flexDirection: 'column', gap: 3 }}>
                Hasta
                <input type="date" value={dupHasta} onChange={e => setDupHasta(e.target.value)}
                  style={{ fontSize: 12, padding: '5px 8px', border: '0.5px solid #D3D1C7', borderRadius: 6 }} />
              </label>
              <button onClick={escanearDuplicados} disabled={dupLoading}
                style={{ fontSize: 12, fontWeight: 700, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#1D9E75', color: '#fff', cursor: 'pointer' }}>
                {dupLoading ? 'Escaneando…' : '🔍 Escanear'}
              </button>
              <div style={{ fontSize: 10.5, color: '#888780', flex: 1, minWidth: 180 }}>
                Deja las fechas en blanco para escanear TODO (no recomendado: son ~29.000 sobrantes). Revisa y borra por tramos (año a año).
              </div>
            </div>

            {/* Resumen */}
            {dupResumen && !dupLoading && (
              <div style={{ padding: '8px 18px', background: '#FBF7EC', borderBottom: '0.5px solid #E4E2DA', fontSize: 12, color: '#8a6d1e', fontWeight: 600 }}>
                Rango {dupDesde || '(inicio)'} → {dupHasta || '(fin)'}: {dupResumen.totalGrupos} grupo(s) con duplicados · {dupResumen.totalSobrantes} fila(s) sobrante(s).
              </div>
            )}

            <div style={{ padding: '14px 18px', overflow: 'auto' }}>
              {dupLoading && <div style={{ padding: 30, textAlign: 'center', color: '#888780', fontSize: 13 }}>Escaneando el rango…</div>}
              {dupErr && <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: '#FDECEC', border: '0.5px solid #F1B0B0', color: '#9B1C1C', fontSize: 12 }}>{dupErr}</div>}
              {!dupLoading && !dupErr && !dupEscaneado && (
                <div style={{ padding: 30, textAlign: 'center', color: '#888780', fontSize: 13 }}>Elige un rango de fechas y pulsa <b>Escanear</b>.</div>
              )}
              {!dupLoading && !dupErr && dupEscaneado && dupGrupos.length === 0 && (
                <div style={{ padding: 30, textAlign: 'center', color: '#1D9E75', fontSize: 14, fontWeight: 600 }}>✓ No se encontraron duplicados en este rango.</div>
              )}
              {!dupLoading && dupGrupos.length > 150 && (
                <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: '#EFF6FF', border: '0.5px solid #93C5FD', color: '#1447C3', fontSize: 12 }}>
                  Mostrando los primeros 150 de {dupGrupos.length} grupos (para no saturar el navegador). El botón <b>“Eliminar TODOS los sobrantes del rango”</b> borra el total, no solo lo que ves aquí.
                </div>
              )}
              {!dupLoading && dupGrupos.slice(0, 150).map((g, gi) => (
                <div key={gi} style={{ border: '0.5px solid #E4E2DA', borderRadius: 8, marginBottom: 10, overflow: 'hidden' }}>
                  <div style={{ background: '#FBF7EC', padding: '6px 10px', fontSize: 11, color: '#8a6d1e', fontWeight: 600 }}>
                    Grupo {gi + 1} · {g.filas.length} filas idénticas · {g.filas[0].fecha} · {g.filas[0].idadmon || '—'}
                  </div>
                  {/* Cabecera de columnas (hasta CALIF) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 10px', background: '#F7F5EF', fontSize: 9.5, fontWeight: 700, color: '#888780', textTransform: 'uppercase' }}>
                    <div style={{ width: 78, flexShrink: 0 }}>Acción</div>
                    <div style={{ width: 74, flexShrink: 0 }}>Fecha</div>
                    <div style={{ width: 64, flexShrink: 0 }}>IDADMON</div>
                    <div style={{ flex: 1, minWidth: 0 }}>Concepto</div>
                    <div style={{ width: 78, textAlign: 'right', flexShrink: 0 }}>Cargo</div>
                    <div style={{ width: 78, textAlign: 'right', flexShrink: 0 }}>Abono</div>
                    <div style={{ width: 130, flexShrink: 0 }}>Comentarios</div>
                    <div style={{ width: 70, flexShrink: 0 }}>Calif</div>
                    <div style={{ width: 44, textAlign: 'right', flexShrink: 0 }}>id</div>
                  </div>
                  {g.filas.map((f, fi) => {
                    const conservar = fi === 0
                    const marcado = dupSel.has(f.id)
                    return (
                      <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', borderTop: '0.5px solid #EDEBE4', background: conservar ? '#F3FAF0' : (marcado ? '#FDF3F3' : '#fff'), fontSize: 11, color: '#2C2C2A' }}>
                        <div style={{ width: 78, flexShrink: 0 }}>
                          {conservar
                            ? <span style={{ fontSize: 10, fontWeight: 700, color: '#1D9E75' }}>CONSERVAR</span>
                            : <label style={{ fontSize: 10, fontWeight: 700, color: '#9B1C1C', display: 'flex', alignItems: 'center', gap: 5, cursor: puedeEditar ? 'pointer' : 'default' }}>
                                <input type="checkbox" checked={marcado} disabled={!puedeEditar} onChange={() => toggleDup(f.id)} /> BORRAR
                              </label>}
                        </div>
                        <div style={{ width: 74, flexShrink: 0 }}>{f.fecha || '—'}</div>
                        <div style={{ width: 64, flexShrink: 0 }}>{f.idadmon || '—'}</div>
                        <div style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={f.concepto || ''}>{f.concepto || '—'}</div>
                        <div style={{ width: 78, textAlign: 'right', color: '#9B1C1C', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{fmt(f.cargo) || '—'}</div>
                        <div style={{ width: 78, textAlign: 'right', color: '#085041', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{fmt(f.abono) || '—'}</div>
                        <div style={{ width: 130, flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={f.comentarios || ''}>{f.comentarios || '—'}</div>
                        <div style={{ width: 70, flexShrink: 0, color: '#B8860B', fontWeight: 600 }}>{f.calif || '—'}</div>
                        <div style={{ width: 44, textAlign: 'right', fontSize: 10, color: '#B4B2A9', flexShrink: 0 }}>#{f.id}</div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>

            {!dupLoading && dupGrupos.length > 0 && (
              <div style={{ padding: '12px 18px', borderTop: '0.5px solid #E4E2DA', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 12, color: '#5F5E5A' }}>
                  {dupResumen?.totalGrupos ?? dupGrupos.length} grupo(s) · {dupResumen?.totalSobrantes ?? 0} sobrante(s) en el rango
                  {!puedeEditar && <span style={{ color: '#9B1C1C' }}> · solo lectura (no puedes borrar)</span>}
                </div>
                {puedeEditar && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button onClick={eliminarDuplicados} disabled={dupBorrando || dupSel.size === 0}
                      title="Borra solo las filas marcadas con la casilla BORRAR en la muestra visible"
                      style={{ fontSize: 12, fontWeight: 600, padding: '8px 14px', borderRadius: 8, border: '0.5px solid #D3D1C7', background: '#fff', color: dupSel.size === 0 ? '#B4B2A9' : '#C0392B', cursor: dupSel.size === 0 ? 'default' : 'pointer' }}>
                      {dupBorrando ? '…' : `Borrar marcados (${dupSel.size})`}
                    </button>
                    <button onClick={eliminarRango} disabled={dupBorrando || !(dupResumen?.totalSobrantes)}
                      title="Borra TODOS los sobrantes del rango (no solo lo visible). Conserva el id más bajo de cada grupo."
                      style={{ fontSize: 12, fontWeight: 700, padding: '8px 16px', borderRadius: 8, border: 'none', background: !(dupResumen?.totalSobrantes) ? '#D3D1C7' : '#C0392B', color: '#fff', cursor: !(dupResumen?.totalSobrantes) ? 'default' : 'pointer' }}>
                      {dupBorrando ? 'Eliminando…' : `🗑 Eliminar TODOS los sobrantes del rango (${dupResumen?.totalSobrantes ?? 0})`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#2C2C2A', color: '#fff', fontSize: 13, padding: '10px 18px', borderRadius: 8, zIndex: 60, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          {toast}
        </div>
      )}
    </>
  )
}

/* ============================================================
   VISTA 2 — CARTOLA POR IDADMON (= hoja ENTRADA del Excel)
   ============================================================ */
const MCOLS = [
  { key: 'fecha',     h: 'Fecha',     w: 90,  align: 'left'  },
  { key: 'concepto',  h: 'Concepto',  w: 320, align: 'left'  },
  { key: 'cargo',     h: 'Cargo',     w: 100, align: 'right', money: true, color: '#9B1C1C' },
  { key: 'abono',     h: 'Abono',     w: 100, align: 'right', money: true, color: '#085041' },
  { key: '_saldo',    h: 'Saldo',     w: 110, align: 'right', money: true },
  { key: 'comentarios', h: 'Comentarios', w: 160, align: 'left' },
  { key: 'calif',     h: 'Calif',     w: 90,  align: 'left'  },
  { key: 'justificantes', h: 'Justificantes', w: 130, align: 'left' },
]

// Proporcional del PRIMER mes, calculado desde datos_arriendos:
//  - día de inicio inclusive · base = días reales del mes
//  - condición especial (cantidad): SIEMPRE en pesos (no se convierte por UF)
//  - cuota normal: si unid='UF' se convierte con la UF del mes de inicio (indices_mensuales)
const MESES_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
function calcProporcional(f, ufMesInicio) {
  if (!f || !f.fecha_inicio) return null
  const s = String(f.fecha_inicio).slice(0, 10)          // 'YYYY-MM-DD'
  const [Y, M, D] = s.split('-').map(Number)
  if (!Y || !M || !D) return null
  const diasMes = new Date(Y, M, 0).getDate()            // último día del mes M (1-based)
  const diasCobrar = diasMes - D + 1                     // inclusive
  const especial = num(f.cantidad) > 0
  const esUF = String(f.unid || '').trim().toUpperCase() === 'UF'

  let renta, faltaUF = false
  if (especial) {
    renta = num(f.cantidad)                              // condición especial: siempre pesos
  } else if (esUF) {
    if (!ufMesInicio) { faltaUF = true; renta = 0 }      // no hay UF del mes de inicio en indices_mensuales
    else renta = Math.round(num(f.cuota) * ufMesInicio)
  } else {
    renta = num(f.cuota)                                 // cuota en pesos
  }
  if (renta <= 0 && !faltaUF) return null

  const prop = faltaUF ? null : Math.round(renta * diasCobrar / diasMes)
  return {
    prop, renta, diasCobrar, diasMes, especial, esUF, faltaUF,
    ufMesInicio: ufMesInicio || null, cuotaUF: esUF ? num(f.cuota) : null,
    mesNombre: MESES_ES[M - 1], anio: Y, dia: D,
    inicioDia1: D === 1,
  }
}

function CartolaIdadmonVista({ vista, setVista, initialId, onConsumed }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [idInput, setIdInput] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState(null)
  const [ficha, setFicha] = useState(null)      // fila de datos_arriendos
  const [movs, setMovs] = useState([])          // movimientos con _saldo corrido
  const [consultado, setConsultado] = useState(false)
  const [aviso, setAviso] = useState(null)      // "en TÉRMINO" / "HISTÓRICO"
  const [ufMesInicio, setUfMesInicio] = useState(null)   // valor_uf del mes de inicio (indices_mensuales)
  const [liqMap, setLiqMap] = useState({})               // AAMM -> a_cobrar (liquidacion_idadmon)
  const [editRow, setEditRow] = useState(null)
  const [editVal, setEditVal] = useState('')
  const [editMotivo, setEditMotivo] = useState('')
  const [savingCargo, setSavingCargo] = useState(false)
  const [cargoErr, setCargoErr] = useState(null)
  // Movimientos manuales (alta / edición / anulación) — solo Dirección + Karina.
  const [showAlta, setShowAlta] = useState(false)
  const [altaForm, setAltaForm] = useState({ fecha: '', concepto: '', tipo: 'cargo', monto: '', calif: '', comentarios: '', motivo: '' })
  const [manualEdit, setManualEdit] = useState(null)   // fila MANUAL en edición
  const [manualForm, setManualForm] = useState({ fecha: '', concepto: '', tipo: 'cargo', monto: '', comentarios: '', motivo: '' })
  const [anulRow, setAnulRow] = useState(null)         // fila MANUAL a anular/reactivar
  const [anulMotivo, setAnulMotivo] = useState('')
  const [savingMov, setSavingMov] = useState(false)
  const [movErr, setMovErr] = useState(null)
  const rol = session?.user?.role
  const email = session?.user?.email
  const puedeEditarCargo = rol === 'direccion' || EDITORES.includes(email)
  const esDireccion = rol === 'direccion'
  // AÑADIR líneas (cargo/abono): Dirección y Karina. (Editar/anular cargos: Dirección + Alberto/Luis/Karina.)
  const puedeAnadir = esDireccion || email === 'karina.morales@fondocapital.com'
  const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'
  // Fecha: la cartola guarda dd/mm/aaaa (texto); los <input type=date> usan ISO. Conversores:
  const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
  const isoADMY = (s) => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : '' }
  const dmyAISO = (s) => { const m = String(s || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '' }
  const normMes = (v) => String(v ?? '').replace(/\D/g, '').slice(-4)
  const mesDeFila = (f) => { const m = String(f ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); return m ? m[3].slice(2) + m[2].padStart(2, '0') : null }
  const cargoEfectivo = (m) => (m.cargo_manual != null && m.cargo_manual !== '') ? num(m.cargo_manual) : num(m.cargo)
  const fmtFechaHora = (iso) => { const d = String(iso ?? ''); return d ? (d.slice(0, 10) + ' ' + d.slice(11, 16)) : '' }

  useEffect(() => { if (status === 'unauthenticated') router.push('/api/auth/signin') }, [status, router])

  // Blindaje anti-scroll-horizontal: mientras esta página esté montada, la página NUNCA scrollea en horizontal.
  // Se usa overflow-x:clip (no 'hidden') para no romper el scroll vertical ni los headers sticky de las tablas,
  // que conservan su propio scroll interno. Se restaura al desmontar.
  useEffect(() => {
    const de = document.documentElement, b = document.body
    const pde = de.style.overflowX, pb = b.style.overflowX
    de.style.overflowX = 'clip'; b.style.overflowX = 'clip'
    return () => { de.style.overflowX = pde; b.style.overflowX = pb }
  }, [])

  const buscar = async (idOverride) => {
    const id = String(idOverride ?? idInput).trim().toUpperCase()
    if (!id || buscando) return
    setBuscando(true); setError(null); setAviso(null); setConsultado(true)
    setFicha(null); setMovs([]); setUfMesInicio(null)
    try {

    // 1) ficha en datos_arriendos (idadmon es único -> una fila)
    const { data: da, error: e1 } = await supabase
      .from('datos_arriendos')
      .select('idadmon, estado, propietario, arrendatario, avalista, inmueble, garantia_pedida, quien_tiene_garantia, fecha_inicio, cuota, meses, cantidad, unid, proporcional')
      .eq('idadmon', id)
      .limit(1)
    if (e1) { setError('Error leyendo ficha: ' + e1.message); setBuscando(false); return }
    const f = (da && da[0]) || null
    setFicha(f)
    if (f) {
      const est = String(f.estado || '').trim().toUpperCase()
      if (est === 'Q') setAviso('Este IDADMON está en ESTADO Q (TÉRMINO).')
      else if (est === 'N' || est === 'N-DICOM') setAviso('Este IDADMON está en ESTADO N (HISTÓRICO).')
      else if (est === 'P') setAviso('Este IDADMON está en ESTADO P (EN INICIO). Los cargos de inicio —garantía, comisión y proporcional— se generan cuando Anthony activa el contrato (P→S). Abajo se muestra lo que ya haya en CUENTAS: los abonos sí se pueden registrar estando en P.')

      // UF del mes de inicio (origen: indices_mensuales, día 1 del mes de inicio)
      // Solo se necesita si el contrato es UF y no hay condición especial.
      if (f.fecha_inicio && String(f.unid || '').trim().toUpperCase() === 'UF' && !(num(f.cantidad) > 0)) {
        const mes1 = String(f.fecha_inicio).slice(0, 7) + '-01'   // 'YYYY-MM-01'
        const { data: im } = await supabase
          .from('indices_mensuales')
          .select('valor_uf')
          .eq('mes', mes1)
          .limit(1)
        if (im && im[0]) setUfMesInicio(num(im[0].valor_uf))
      }
    }

    // 2) movimientos en cuentas
    const { data: cu, error: e2 } = await supabase
      .from('cuentas')
      .select('id, fecha, concepto, cargo, abono, comentarios, calif, justificantes, cargo_manual, cargo_editado_por, cargo_editado_motivo, cargo_editado_en, manual, anulado')
      .eq('idadmon', id)
      .limit(2000)
    if (e2) { setError('Error leyendo movimientos: ' + e2.message); setBuscando(false); return }

    // 3) liquidación por mes (a_cobrar), para el cotejo del rojo
    const { data: li } = await supabase
      .from('liquidacion_idadmon').select('mes, a_cobrar').eq('idadmon', id).limit(2000)
    const lm = {}
    for (const rr of (li || [])) { const k = normMes(rr.mes); if (k) lm[k] = num(rr.a_cobrar) }
    setLiqMap(lm)

    // ordenar por fecha real ascendente (fecha es texto dd/mm/aaaa); empate -> por id
    const ordenados = (cu || []).slice().sort((a, b) => {
      const fa = fechaOrden(a.fecha), fb = fechaOrden(b.fecha)
      if (fa !== fb) return fa - fb
      return (a.id || 0) - (b.id || 0)
    })
    // saldo corrido desde 0: saldo = saldo_anterior + cargo - abono. Las filas ANULADAS no cuentan (saldo = null).
    let saldo = 0
    const conSaldo = ordenados.map(m => {
      if (m.anulado) return { ...m, _saldo: null }
      saldo = saldo + cargoEfectivo(m) - num(m.abono)
      return { ...m, _saldo: saldo }
    })
    setMovs(conSaldo)
    } catch (err) {
      setError('No se pudo cargar la cuenta: ' + (err?.message || String(err)))
    } finally {
      setBuscando(false)
    }
  }

  const onKey = (e) => { if (e.key === 'Enter') buscar() }

  // Si se llega desde el buscador de la vista Tabla (initialId), precargar y buscar ese IDADMON
  // de una vez, para no mostrar la pantalla en blanco. Se ejecuta una sola vez al montar la vista.
  useEffect(() => {
    const id0 = String(initialId || '').trim().toUpperCase()
    if (id0) { setIdInput(id0); buscar(id0) }
    if (onConsumed) onConsumed()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filaEsBI = (r) => String(r.comentarios || '').trim().toUpperCase() === 'BI'
  const esInicio = (r) => String(r.calif || '').trim().toUpperCase() === 'INICIO'
  const saldoTotal = movs.filter(m => !m.anulado).reduce((a, m) => a + cargoEfectivo(m) - num(m.abono), 0)
  const idsEditables = new Set(movs.slice(-5).map(m => m.id))
  const estadoLiq = (m) => {
    if (m.cargo_editado_en == null) return null
    const mes = mesDeFila(m.fecha)
    const a = mes != null ? liqMap[mes] : undefined
    if (a == null) return 'sin_liq'
    return Math.abs(cargoEfectivo(m) - Math.round(num(a))) <= 1 ? 'ok' : 'no_cuadra'
  }
  const abrirEdicion = (m) => { setEditRow(m); setEditVal(String(cargoEfectivo(m) || '')); setEditMotivo(''); setCargoErr(null) }
  const guardarCargo = async () => {
    if (!editRow) return
    const cargoNuevo = Math.round(num(editVal))
    const motivo = editMotivo.trim()
    if (motivo.length < 3) { setCargoErr('El motivo es obligatorio (mínimo 3 caracteres).'); return }
    setSavingCargo(true); setCargoErr(null)
    try {
      const res = await fetch('/api/cartolas/editar-cargo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editRow.id, cargo: cargoNuevo, motivo }) })
      const d = await res.json()
      if (!res.ok) { setCargoErr(d.error || 'No se pudo guardar.'); setSavingCargo(false); return }
      setMovs(prev => {
        const upd = prev.map(m => m.id === editRow.id ? { ...m, cargo_manual: cargoNuevo, cargo_editado_por: d.cargo_editado_por, cargo_editado_motivo: d.cargo_editado_motivo, cargo_editado_en: d.cargo_editado_en } : m)
        let sAc = 0
        return upd.map(m => { sAc = sAc + cargoEfectivo(m) - num(m.abono); return { ...m, _saldo: sAc } })
      })
      setEditRow(null); setSavingCargo(false)
    } catch { setCargoErr('Error de conexión'); setSavingCargo(false) }
  }

  // ── Movimientos manuales ──────────────────────────────────────────────
  const refrescar = async () => { await buscar() }   // relee la cuenta tras alta/edición/anulación

  const abrirAlta = () => { setAltaForm({ fecha: hoyISO(), concepto: '', tipo: 'cargo', monto: '', calif: '', comentarios: '', motivo: '' }); setMovErr(null); setShowAlta(true) }
  const guardarAlta = async () => {
    const f = altaForm
    if (!f.fecha) { setMovErr('Falta la fecha.'); return }
    if ((f.concepto || '').trim().length < 2) { setMovErr('El concepto es obligatorio.'); return }
    if (!(num(f.monto) > 0)) { setMovErr('El monto debe ser mayor que 0.'); return }
    if ((f.motivo || '').trim().length < 3) { setMovErr('El motivo es obligatorio (mínimo 3 caracteres).'); return }
    setSavingMov(true); setMovErr(null)
    try {
      const res = await fetch('/api/cartolas/movimiento', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'alta', idadmon: ficha.idadmon, fecha: isoADMY(f.fecha), concepto: f.concepto.trim(), tipo: f.tipo, monto: num(f.monto), calif: f.calif.trim(), comentarios: f.comentarios.trim(), motivo: f.motivo.trim() }) })
      const d = await res.json()
      if (!res.ok) { setMovErr(d.error || 'No se pudo guardar.'); setSavingMov(false); return }
      setShowAlta(false); setSavingMov(false); await refrescar()
    } catch { setMovErr('Error de conexión'); setSavingMov(false) }
  }

  const abrirManualEdit = (m) => {
    const esAbono = num(m.abono) > 0 && !(cargoEfectivo(m) > 0)
    setManualForm({ fecha: dmyAISO(m.fecha) || hoyISO(), concepto: m.concepto || '', tipo: esAbono ? 'abono' : 'cargo', monto: String(esAbono ? num(m.abono) : cargoEfectivo(m)), comentarios: m.comentarios || '', motivo: '' })
    setManualEdit(m); setMovErr(null)
  }
  const guardarManualEdit = async () => {
    const f = manualForm
    if (!f.fecha) { setMovErr('Falta la fecha.'); return }
    if ((f.concepto || '').trim().length < 2) { setMovErr('El concepto es obligatorio.'); return }
    if (!(num(f.monto) > 0)) { setMovErr('El monto debe ser mayor que 0.'); return }
    if ((f.motivo || '').trim().length < 3) { setMovErr('El motivo es obligatorio (mínimo 3 caracteres).'); return }
    setSavingMov(true); setMovErr(null)
    try {
      const res = await fetch('/api/cartolas/movimiento', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'edicion', id: manualEdit.id, fecha: isoADMY(f.fecha), concepto: f.concepto.trim(), tipo: f.tipo, monto: num(f.monto), comentarios: f.comentarios.trim(), motivo: f.motivo.trim() }) })
      const d = await res.json()
      if (!res.ok) { setMovErr(d.error || 'No se pudo guardar.'); setSavingMov(false); return }
      setManualEdit(null); setSavingMov(false); await refrescar()
    } catch { setMovErr('Error de conexión'); setSavingMov(false) }
  }

  const confirmarAnular = async () => {
    if (!anulRow) return
    if ((anulMotivo || '').trim().length < 3) { setMovErr('El motivo es obligatorio (mínimo 3 caracteres).'); return }
    setSavingMov(true); setMovErr(null)
    try {
      const res = await fetch('/api/cartolas/movimiento', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'anulacion', id: anulRow.id, motivo: anulMotivo.trim() }) })
      const d = await res.json()
      if (!res.ok) { setMovErr(d.error || 'No se pudo procesar.'); setSavingMov(false); return }
      setAnulRow(null); setAnulMotivo(''); setSavingMov(false); await refrescar()
    } catch { setMovErr('Error de conexión'); setSavingMov(false) }
  }

  // Proporcional del primer mes.
  //  - propCalc: recálculo estándar de calendario (cuota × UF × días) → SOLO informativo.
  //  - propLog: datos_arriendos.proporcional → es el dato REAL con el que cc1Inicios carga el
  //    inicio, así que el cotejo de descuadre se hace contra ESTE, no contra el recálculo.
  const propCalc = calcProporcional(ficha, ufMesInicio)
  const propLog = num(ficha?.proporcional)
  const filaPropCartola = movs.find(m => esInicio(m) && /PROPORCIONAL/i.test(String(m.concepto || '')))
  const TOL_PROP = 100   // misma tolerancia que cc1Inicios (redondeos)
  const cargoProp = filaPropCartola ? num(filaPropCartola.cargo) : null
  const faltaRespaldoLog = !!filaPropCartola && !(propLog > 0)   // hay línea en cartola pero LOG sin proporcional
  const descuadre = !!filaPropCartola && !(propCalc && propCalc.inicioDia1) && (
    faltaRespaldoLog ? true : Math.abs(cargoProp - propLog) > TOL_PROP
  )

  const Dato = ({ label, value, strong }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minWidth: 0 }}>
      <span style={{ fontSize: 9.5, color: '#888780', textTransform: 'uppercase', letterSpacing: '.03em', lineHeight: 1.25 }}>{label}</span>
      <span style={{ fontSize: 12, color: '#2C2C2A', fontWeight: strong ? 700 : 500, whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.25 }}>{value || '—'}</span>
    </div>
  )

  const cellMov = (r, c) => {
    if (c.key === '_saldo') { if (r._saldo == null) return <span style={{ color: '#B4B2A9' }}>—</span>; return <span style={{ fontWeight: 600, fontFamily: MONO, color: r._saldo < 0 ? '#9B1C1C' : '#2C2C2A' }}>{fmtNum(r._saldo)}</span> }
    if (c.key === 'concepto') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ textDecoration: r.anulado ? 'line-through' : 'none', color: r.anulado ? '#B4B2A9' : 'inherit' }}>{r.concepto ?? '—'}</span>
          {r.manual && <span title="Movimiento manual" style={{ fontSize: 9, fontWeight: 700, color: '#0C447C', background: '#E6F1FB', borderRadius: 4, padding: '0 5px' }}>MANUAL</span>}
          {r.anulado && <span style={{ fontSize: 9, fontWeight: 700, color: '#9B1C1C', background: '#FDECEC', borderRadius: 4, padding: '0 5px' }}>ANULADO</span>}
          {/* v14: editar (solo MANUAL) / anular (MANUAL o cualquier línea de cargo) / reactivar (cualquier anulada) */}
          {r.manual && puedeEditarCargo && !r.anulado && (
            <button onClick={() => abrirManualEdit(r)} title="Editar este movimiento manual (queda registrado)"
              style={{ border: '0.5px solid #D3D1C7', background: '#fff', borderRadius: 5, cursor: 'pointer', color: '#0C447C', fontSize: 10, padding: '1px 6px', lineHeight: 1.4 }}>editar</button>
          )}
          {puedeEditarCargo && !r.anulado && (r.manual || num(r.cargo) > 0 || (r.cargo_manual != null && r.cargo_manual !== '')) && (
            <button onClick={() => { setAnulRow(r); setAnulMotivo(''); setMovErr(null) }} title="Anular esta línea (reversible, queda registrado)"
              style={{ border: '0.5px solid #E7B4B4', background: '#fff', borderRadius: 5, cursor: 'pointer', color: '#9B1C1C', fontSize: 10, padding: '1px 6px', lineHeight: 1.4 }}>anular</button>
          )}
          {puedeEditarCargo && r.anulado && (
            <button onClick={() => { setAnulRow(r); setAnulMotivo(''); setMovErr(null) }} title="Reactivar esta línea (queda registrado)"
              style={{ border: '0.5px solid #B4D8CB', background: '#fff', borderRadius: 5, cursor: 'pointer', color: '#085041', fontSize: 10, padding: '1px 6px', lineHeight: 1.4 }}>reactivar</button>
          )}
        </span>
      )
    }
    if (c.key === 'cargo') {
      const val = cargoEfectivo(r); const s = val ? val.toLocaleString('es-CL') : ''
      // v14: editable en CUALQUIER línea de cargo (no solo las 5 recientes), salvo anuladas.
      const editable = puedeEditarCargo && !r.anulado && (num(r.cargo) > 0 || (r.cargo_manual != null && r.cargo_manual !== ''))
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end', width: '100%' }}>
          {r.cargo_editado_en != null && (
            <span title={`Cargo editado por ${r.cargo_editado_por || '—'} el ${fmtFechaHora(r.cargo_editado_en)} · Motivo: ${r.cargo_editado_motivo || '—'} · Original: ${fmt(r.cargo) || '0'}`}
              style={{ color: '#B8860B', fontSize: 11, cursor: 'help' }}>✎</span>
          )}
          <span style={{ fontFamily: MONO, color: s ? '#9B1C1C' : '#2C2C2A' }}>{s || '—'}</span>
          {editable && (
            <button onClick={() => abrirEdicion(r)} title="Editar cargo (excepcional · queda registrado)"
              style={{ border: '0.5px solid #D3D1C7', background: '#fff', borderRadius: 5, cursor: 'pointer', color: '#0C447C', fontSize: 10, padding: '1px 6px', lineHeight: 1.4 }}>editar</button>
          )}
        </span>
      )
    }
    if (c.money) { const s = fmt(r[c.key]); return <span style={{ fontFamily: MONO, color: s && c.color ? c.color : '#2C2C2A' }}>{s || '—'}</span> }
    if (c.key === 'comentarios') {
      const full = String(r[c.key] ?? '').trim()
      const corto = full.length > 15 ? full.slice(0, 15) + '…' : (full || '—')
      return <span title={full || undefined} style={{ fontWeight: filaEsBI(r) ? 700 : 400, cursor: full.length > 15 ? 'help' : 'default' }}>{corto}</span>
    }
    if (c.key === 'calif') return <span title={String(r[c.key] ?? '') || undefined} style={{ color: filaEsBI(r) ? '#B8860B' : '#2C2C2A', fontWeight: filaEsBI(r) ? 600 : 400 }}>{r[c.key] ?? '—'}</span>
    return <span title={String(r[c.key] ?? '') || undefined}>{r[c.key] ?? '—'}</span>
  }
  const bgMov = (r, c) => (esInicio(r) && (c.key === 'concepto' || c.key === 'cargo')) ? '#E9F4E4' : '#fff'

  if (status === 'loading')
    return (<div style={{ padding: 60, textAlign: 'center', color: '#888', fontSize: 14 }}>Cargando…</div>)

  return (
    <>
    <div style={{ maxWidth: 1760, margin: '0 auto', padding: '8px 20px 30px', overflowX: 'clip' }}>
      {/* BARRA ÚNICA STICKY: pestañas + buscador + añadir (bajo el TopNav) */}
      <div style={{ position: 'sticky', top: 52, zIndex: 40, background: '#fff', margin: '0 -20px 14px', padding: '8px 20px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid #E3E1D8', boxShadow: '0 4px 10px -8px rgba(0,0,0,0.25)' }}>
        <TabsCartola vista={vista} setVista={setVista} />
        <span style={{ width: 1, height: 24, background: '#D3D1C7' }} />
        <input value={idInput} onChange={e => setIdInput(e.target.value)} onKeyDown={onKey}
          placeholder="IDADMON (ej. A00857)" autoFocus
          style={{ fontSize: 14, padding: '8px 12px', border: '0.5px solid #B4B2A9', borderRadius: 8, width: 200, textTransform: 'uppercase' }} />
        <button onClick={() => buscar()} disabled={buscando}
          style={{ fontSize: 13, fontWeight: 600, padding: '8px 18px', borderRadius: 8, border: 'none', background: '#1D9E75', color: '#fff', cursor: 'pointer' }}>
          {buscando ? 'Buscando…' : 'Ver cuenta'}
        </button>
        {ficha && puedeAnadir && (
          <button onClick={abrirAlta} title="Añadir una línea manual (cargo o abono) a esta cuenta — Dirección y Karina, queda registrado quién y cuándo"
            style={{ fontSize: 13, fontWeight: 600, padding: '8px 14px', borderRadius: 8, border: '0.5px solid #1D9E75', background: '#EAF7F1', color: '#0F6D4E', cursor: 'pointer' }}>
            ➕ Añadir línea
          </button>
        )}
      </div>

      {error && <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: '#FDECEC', border: '0.5px solid #F1B0B0', color: '#9B1C1C', fontSize: 12 }}>{error}</div>}
      {aviso && <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: '#FEF3C7', border: '0.5px solid #FCD34D', color: '#92400E', fontSize: 12, fontWeight: 600 }}>⚠ {aviso}</div>}

      {consultado && !buscando && !ficha && !error && (
        <div style={{ padding: 16, borderRadius: 8, background: '#F1EFE8', color: '#5F5E5A', fontSize: 13 }}>
          No se encontró el IDADMON <b>{idInput.trim().toUpperCase()}</b> en datos_arriendos.
        </div>
      )}

      {ficha && (
        <>
          {/* CABECERA */}
          <div style={{ border: '0.5px solid #D3D1C7', borderRadius: 10, padding: '8px 14px', marginBottom: 10, background: '#F8FAFC' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#0C447C' }}>{ficha.idadmon}</span>
                <span style={{ fontSize: 10.5, fontWeight: 600, padding: '1px 8px', borderRadius: 20, background: '#E6F1FB', color: '#0C447C' }}>Estado: {ficha.estado || '—'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 10, color: '#888780', textTransform: 'uppercase', letterSpacing: '.03em' }}>Saldo total</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: saldoTotal < 0 ? '#9B1C1C' : '#085041' }}>{money(saldoTotal)}</span>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '4px 16px' }}>
              <Dato label="Propietario" value={ficha.propietario} strong />
              <Dato label="Arrendatario" value={ficha.arrendatario} strong />
              <Dato label="Avalista" value={ficha.avalista} />
              <Dato label="Inmueble" value={ficha.inmueble} />
              <Dato label="Garantía" value={ficha.garantia_pedida ? money(ficha.garantia_pedida) : null} />
              <Dato label="Quién" value={ficha.quien_tiene_garantia} />
            </div>
          </div>

          {/* MOROSIDAD — comportamiento de pago a partir de la cartola */}
          <div style={{ marginBottom: 10 }}>
            <MorosidadCartola idadmon={ficha.idadmon} />
          </div>

          {/* MOVIMIENTOS · el proporcional del primer mes va a la derecha, en la misma línea */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '4px 0 8px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#2C2C2A' }}>Movimientos</div>
            {propCalc && (
            <details style={{ marginLeft: 'auto', border: '0.5px solid ' + (descuadre ? '#FCD34D' : '#CDE3CD'), borderRadius: 8, background: descuadre ? '#FEF3C7' : '#F0F7F0' }}>
              <summary style={{ cursor: 'pointer', padding: '5px 12px', fontSize: 12, color: descuadre ? '#92400E' : '#5F5E5A', fontWeight: 600, listStyle: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{descuadre ? '⚠ Proporcional del primer mes — revisar' : '✓ Proporcional del primer mes'}</span>
                <span style={{ fontWeight: 400, color: '#888780' }}>· ver detalle</span>
              </summary>
              <div style={{ padding: '4px 16px 12px' }}>
              <div style={{ fontSize: 10, color: '#888780', textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 6 }}>Proporcional del primer mes · calculado desde datos_arriendos</div>
              {propCalc.inicioDia1 ? (
                <div style={{ fontSize: 13, color: '#5F5E5A' }}>El contrato inicia el día 1 de {propCalc.mesNombre}: mes completo, sin proporcional.</div>
              ) : propCalc.faltaUF ? (
                <div style={{ fontSize: 13, color: '#92400E', fontWeight: 600 }}>
                  ⚠ Contrato en UF (cuota {propCalc.cuotaUF} UF) pero no hay valor_uf para {propCalc.mesNombre} {propCalc.anio} en indices_mensuales. No se puede calcular el proporcional.
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 13, color: '#2C2C2A' }}>
                    Renta base <b>{money(propCalc.renta)}</b>{' '}
                    {propCalc.especial
                      ? '(condición especial)'
                      : propCalc.esUF
                        ? `(${propCalc.cuotaUF} UF × ${money(propCalc.ufMesInicio)} UF de ${propCalc.mesNombre})`
                        : '(cuota normal)'} · {propCalc.diasCobrar} de {propCalc.diasMes} días de {propCalc.mesNombre} {propCalc.anio}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0C447C', marginTop: 2 }}>
                    Proporcional en el LOG (datos_arriendos): {propLog > 0 ? money(propLog) : '—'}
                  </div>
                  {filaPropCartola ? (
                    descuadre ? (
                      faltaRespaldoLog ? (
                        <div style={{ marginTop: 8, fontSize: 12, color: '#92400E', fontWeight: 600 }}>
                          ⚠ En la cartola figura {money(cargoProp)} ("{filaPropCartola.concepto}") pero el LOG no tiene proporcional cargado. Revisar el origen (datos_arriendos → campo proporcional), no aquí.
                        </div>
                      ) : (
                        <div style={{ marginTop: 8, fontSize: 12, color: '#92400E', fontWeight: 600 }}>
                          ⚠ En la cartola figura {money(cargoProp)} ("{filaPropCartola.concepto}"), pero el LOG dice {money(propLog)} (diferencia {money(Math.abs(cargoProp - propLog))}). Si es un error, corrígelo en el origen (datos_arriendos → CUENTAS), no aquí.
                        </div>
                      )
                    ) : (
                      <div style={{ marginTop: 8, fontSize: 12, color: '#085041', fontWeight: 600 }}>✓ El cargo de la cartola coincide con el proporcional del LOG.</div>
                    )
                  ) : (
                    <div style={{ marginTop: 8, fontSize: 12, color: '#888780' }}>No hay línea de proporcional (INICIO) en la cartola para comparar.</div>
                  )}
                  {propCalc.prop != null && (
                    <div style={{ marginTop: 8, fontSize: 11, color: '#888780' }}>
                      Info · proporcional de calendario: {money(propCalc.prop)} ({propCalc.diasCobrar}/{propCalc.diasMes} días de {propCalc.mesNombre}). Puede diferir del pactado si el contrato fija un pago especial (p. ej. incluir otro mes).
                    </div>
                  )}
                </>
              )}
              </div>
            </details>
            )}
          </div>
          {/* RECAP bajo Movimientos: repite IDADMON+Estado, Propietario e Inmueble para saber siempre qué se mira al hacer scroll */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '0 0 8px', padding: '6px 10px', border: '0.5px solid #E3E1D8', borderRadius: 8, background: '#FBFAF6', fontSize: 12 }}>
            <span style={{ fontWeight: 700, color: '#0C447C' }}>{ficha.idadmon}</span>
            <span style={{ fontWeight: 600, padding: '1px 8px', borderRadius: 20, background: '#E6F1FB', color: '#0C447C', fontSize: 11 }}>Estado: {ficha.estado || '—'}</span>
            <span style={{ color: '#C9C7BF' }}>·</span>
            <span style={{ color: '#5F5E5A' }}><span style={{ color: '#888780' }}>Propietario:</span> <b style={{ color: '#2C2C2A' }}>{ficha.propietario || '—'}</b></span>
            <span style={{ color: '#C9C7BF' }}>·</span>
            <span style={{ color: '#5F5E5A' }}><span style={{ color: '#888780' }}>Inmueble:</span> <b style={{ color: '#2C2C2A' }}>{ficha.inmueble || '—'}</b></span>
          </div>
          <div style={{ overflow: 'auto', maxHeight: '72vh', border: '0.5px solid #D3D1C7', borderRadius: 8 }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: 0, fontSize: 12, minWidth: 980, width: '100%', fontVariantNumeric: 'tabular-nums' }}>
              <thead>
                <tr style={{ background: '#F1EFE8' }}>
                  {MCOLS.map((c, i) => (
                    <th key={i} style={{ padding: '7px 10px', textAlign: c.align, fontWeight: 600, color: '#5F5E5A', whiteSpace: 'nowrap', minWidth: c.w, position: 'sticky', top: 0, background: '#F1EFE8', zIndex: 2, borderBottom: '0.5px solid #D3D1C7' }}>{c.h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {movs.map((r) => {
                  const el = estadoLiq(r)
                  // Cambio manual: línea añadida a mano, cargo editado o cargo con override → rojo SUAVE.
                  // "No cuadra con la liquidación" → rojo MÁS FUERTE (prioritario, es el aviso crítico).
                  const manualCambio = !!(r.manual || r.cargo_editado_en != null || (r.cargo_manual != null && r.cargo_manual !== ''))
                  const filaBg = el === 'no_cuadra' ? '#F5B7B1' : manualCambio ? '#FDEBEA' : el === 'sin_liq' ? '#FEF9E7' : null
                  return (
                  <tr key={r.id}>
                    {MCOLS.map((c, ci) => (
                      <td key={ci} style={{ padding: '6px 10px', textAlign: c.align, whiteSpace: c.key === 'concepto' ? 'normal' : 'nowrap', background: filaBg || bgMov(r, c), color: '#2C2C2A', borderBottom: '0.5px solid #EDEBE4' }}>
                        {cellMov(r, c)}
                      </td>
                    ))}
                  </tr>
                  )
                })}
                {movs.length === 0 && <tr><td colSpan={MCOLS.length} style={{ padding: 24, textAlign: 'center', color: '#888780' }}>Sin movimientos en CUENTAS para este IDADMON.</td></tr>}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11, color: '#888780', marginTop: 8 }}>
            {movs.length} movimiento(s) · saldo corrido desde 0 (cargo suma, abono resta) · ordenados por fecha.
          </div>
          {puedeEditarCargo && (
            <div style={{ fontSize: 11, color: '#888780', marginTop: 4 }}>
              Puedes <b>editar el cargo</b> de cualquier línea y <b>anular/reactivar</b> líneas de cargo (no se borran: quedan como ANULADO, es reversible). <b>Añadir líneas</b> (cargo o abono): Dirección y Karina. Todo con motivo obligatorio y registro de quién y cuándo. Una fila editada se marca en <span style={{ background: '#FDECEC', padding: '0 4px', borderRadius: 3, color: '#9B1C1C' }}>rojo</span> si su cargo no coincide con la liquidación (a_cobrar) de ese mes.
            </div>
          )}
        </>
      )}
    </div>

    {editRow && (
      <>
        <div onClick={() => !savingCargo && setEditRow(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 9000 }} />
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(460px, 94vw)', background: '#fff', borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.25)', zIndex: 9001, padding: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#2C2C2A', marginBottom: 4 }}>Editar cargo (excepcional)</div>
          <div style={{ fontSize: 12, color: '#888780', marginBottom: 12 }}>{editRow.fecha} · {editRow.concepto}</div>
          <div style={{ fontSize: 12, color: '#5F5E5A', marginBottom: 12, background: '#F7F5EF', padding: '8px 10px', borderRadius: 8 }}>
            Cargo original: <b style={{ fontFamily: MONO }}>{fmt(editRow.cargo) || '0'}</b>
            {(() => { const mesEd = mesDeFila(editRow.fecha); const a = mesEd != null ? liqMap[mesEd] : undefined; return a != null
              ? <> · En la liquidación (a_cobrar) de este mes: <b style={{ fontFamily: MONO }}>{num(a).toLocaleString('es-CL')}</b></>
              : <> · Sin línea en la liquidación de este mes para comparar</> })()}
          </div>
          <label style={{ fontSize: 12, color: '#888780', display: 'block', marginBottom: 10 }}>Nuevo cargo
            <input value={editVal} onChange={e => setEditVal(e.target.value)} inputMode="numeric" autoFocus
              style={{ width: '100%', marginTop: 4, fontSize: 14, padding: '8px 10px', border: '0.5px solid #B4B2A9', borderRadius: 8, boxSizing: 'border-box', fontFamily: MONO }} />
          </label>
          <label style={{ fontSize: 12, color: '#888780', display: 'block', marginBottom: 8 }}>Motivo (obligatorio)
            <textarea value={editMotivo} onChange={e => setEditMotivo(e.target.value)} rows={3} placeholder="Por qué se cambia este cargo…"
              style={{ width: '100%', marginTop: 4, fontSize: 13, padding: '8px 10px', border: '0.5px solid #B4B2A9', borderRadius: 8, boxSizing: 'border-box', resize: 'vertical' }} />
          </label>
          {cargoErr && <div style={{ fontSize: 12, color: '#9B1C1C', marginBottom: 8 }}>{cargoErr}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
            <button onClick={() => setEditRow(null)} disabled={savingCargo}
              style={{ fontSize: 13, padding: '8px 14px', borderRadius: 8, border: '0.5px solid #D3D1C7', background: '#fff', color: '#5F5E5A', cursor: 'pointer' }}>Cancelar</button>
            <button onClick={guardarCargo} disabled={savingCargo || editMotivo.trim().length < 3}
              style={{ fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 8, border: 'none', background: (savingCargo || editMotivo.trim().length < 3) ? '#B4D8CB' : '#1D9E75', color: '#fff', cursor: (savingCargo || editMotivo.trim().length < 3) ? 'default' : 'pointer' }}>{savingCargo ? 'Guardando…' : 'Guardar cambio'}</button>
          </div>
        </div>
      </>
    )}

    {/* ── Modal: AÑADIR movimiento manual ── */}
    {showAlta && (
      <>
        <div onClick={() => !savingMov && setShowAlta(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 9000 }} />
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(480px, 94vw)', maxHeight: '92vh', overflowY: 'auto', background: '#fff', borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.25)', zIndex: 9001, padding: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#2C2C2A', marginBottom: 4 }}>Añadir movimiento manual</div>
          <div style={{ fontSize: 12, color: '#888780', marginBottom: 12 }}>{ficha?.idadmon} · queda registrado quién, cuándo y el motivo</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <label style={{ flex: 1, fontSize: 12, color: '#888780' }}>Fecha
              <input type="date" value={altaForm.fecha} onChange={e => setAltaForm(f => ({ ...f, fecha: e.target.value }))}
                style={{ width: '100%', marginTop: 4, fontSize: 14, padding: '8px 10px', border: '0.5px solid #B4B2A9', borderRadius: 8, boxSizing: 'border-box' }} />
            </label>
            <div style={{ flex: 1, fontSize: 12, color: '#888780' }}>Tipo
              <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
                {['cargo', 'abono'].map(t => (
                  <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 13 }}>
                    <input type="radio" checked={altaForm.tipo === t} onChange={() => setAltaForm(f => ({ ...f, tipo: t }))} />
                    <span style={{ color: t === 'cargo' ? '#9B1C1C' : '#085041', fontWeight: 600, textTransform: 'capitalize' }}>{t}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <label style={{ fontSize: 12, color: '#888780', display: 'block', marginBottom: 10 }}>Monto
            <input value={altaForm.monto} onChange={e => setAltaForm(f => ({ ...f, monto: e.target.value }))} inputMode="numeric" autoFocus placeholder="0"
              style={{ width: '100%', marginTop: 4, fontSize: 14, padding: '8px 10px', border: '0.5px solid #B4B2A9', borderRadius: 8, boxSizing: 'border-box', fontFamily: MONO }} />
          </label>
          <label style={{ fontSize: 12, color: '#888780', display: 'block', marginBottom: 10 }}>Concepto
            <input value={altaForm.concepto} onChange={e => setAltaForm(f => ({ ...f, concepto: e.target.value }))} placeholder="Descripción del movimiento"
              style={{ width: '100%', marginTop: 4, fontSize: 13, padding: '8px 10px', border: '0.5px solid #B4B2A9', borderRadius: 8, boxSizing: 'border-box' }} />
          </label>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <label style={{ flex: 1, fontSize: 12, color: '#888780' }}>Calif (opcional)
              <input value={altaForm.calif} onChange={e => setAltaForm(f => ({ ...f, calif: e.target.value }))}
                style={{ width: '100%', marginTop: 4, fontSize: 13, padding: '8px 10px', border: '0.5px solid #B4B2A9', borderRadius: 8, boxSizing: 'border-box' }} />
            </label>
            <label style={{ flex: 1, fontSize: 12, color: '#888780' }}>Comentarios (opcional)
              <input value={altaForm.comentarios} onChange={e => setAltaForm(f => ({ ...f, comentarios: e.target.value }))}
                style={{ width: '100%', marginTop: 4, fontSize: 13, padding: '8px 10px', border: '0.5px solid #B4B2A9', borderRadius: 8, boxSizing: 'border-box' }} />
            </label>
          </div>
          <label style={{ fontSize: 12, color: '#888780', display: 'block', marginBottom: 8 }}>Motivo (obligatorio)
            <textarea value={altaForm.motivo} onChange={e => setAltaForm(f => ({ ...f, motivo: e.target.value }))} rows={2} placeholder="Por qué se añade este movimiento…"
              style={{ width: '100%', marginTop: 4, fontSize: 13, padding: '8px 10px', border: '0.5px solid #B4B2A9', borderRadius: 8, boxSizing: 'border-box', resize: 'vertical' }} />
          </label>
          {movErr && <div style={{ fontSize: 12, color: '#9B1C1C', marginBottom: 8 }}>{movErr}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
            <button onClick={() => setShowAlta(false)} disabled={savingMov}
              style={{ fontSize: 13, padding: '8px 14px', borderRadius: 8, border: '0.5px solid #D3D1C7', background: '#fff', color: '#5F5E5A', cursor: 'pointer' }}>Cancelar</button>
            <button onClick={guardarAlta} disabled={savingMov}
              style={{ fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 8, border: 'none', background: savingMov ? '#B4D8CB' : '#1D9E75', color: '#fff', cursor: savingMov ? 'default' : 'pointer' }}>{savingMov ? 'Guardando…' : 'Añadir'}</button>
          </div>
        </div>
      </>
    )}

    {/* ── Modal: EDITAR movimiento manual ── */}
    {manualEdit && (
      <>
        <div onClick={() => !savingMov && setManualEdit(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 9000 }} />
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(480px, 94vw)', maxHeight: '92vh', overflowY: 'auto', background: '#fff', borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.25)', zIndex: 9001, padding: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#2C2C2A', marginBottom: 4 }}>Editar movimiento manual</div>
          <div style={{ fontSize: 12, color: '#888780', marginBottom: 12 }}>{ficha?.idadmon} · cada cambio queda registrado</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <label style={{ flex: 1, fontSize: 12, color: '#888780' }}>Fecha
              <input type="date" value={manualForm.fecha} onChange={e => setManualForm(f => ({ ...f, fecha: e.target.value }))}
                style={{ width: '100%', marginTop: 4, fontSize: 14, padding: '8px 10px', border: '0.5px solid #B4B2A9', borderRadius: 8, boxSizing: 'border-box' }} />
            </label>
            <div style={{ flex: 1, fontSize: 12, color: '#888780' }}>Tipo
              <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
                {['cargo', 'abono'].map(t => (
                  <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 13 }}>
                    <input type="radio" checked={manualForm.tipo === t} onChange={() => setManualForm(f => ({ ...f, tipo: t }))} />
                    <span style={{ color: t === 'cargo' ? '#9B1C1C' : '#085041', fontWeight: 600, textTransform: 'capitalize' }}>{t}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <label style={{ fontSize: 12, color: '#888780', display: 'block', marginBottom: 10 }}>Monto
            <input value={manualForm.monto} onChange={e => setManualForm(f => ({ ...f, monto: e.target.value }))} inputMode="numeric"
              style={{ width: '100%', marginTop: 4, fontSize: 14, padding: '8px 10px', border: '0.5px solid #B4B2A9', borderRadius: 8, boxSizing: 'border-box', fontFamily: MONO }} />
          </label>
          <label style={{ fontSize: 12, color: '#888780', display: 'block', marginBottom: 10 }}>Concepto
            <input value={manualForm.concepto} onChange={e => setManualForm(f => ({ ...f, concepto: e.target.value }))}
              style={{ width: '100%', marginTop: 4, fontSize: 13, padding: '8px 10px', border: '0.5px solid #B4B2A9', borderRadius: 8, boxSizing: 'border-box' }} />
          </label>
          <label style={{ fontSize: 12, color: '#888780', display: 'block', marginBottom: 10 }}>Comentarios (opcional)
            <input value={manualForm.comentarios} onChange={e => setManualForm(f => ({ ...f, comentarios: e.target.value }))}
              style={{ width: '100%', marginTop: 4, fontSize: 13, padding: '8px 10px', border: '0.5px solid #B4B2A9', borderRadius: 8, boxSizing: 'border-box' }} />
          </label>
          <label style={{ fontSize: 12, color: '#888780', display: 'block', marginBottom: 8 }}>Motivo del cambio (obligatorio)
            <textarea value={manualForm.motivo} onChange={e => setManualForm(f => ({ ...f, motivo: e.target.value }))} rows={2} placeholder="Por qué se cambia…"
              style={{ width: '100%', marginTop: 4, fontSize: 13, padding: '8px 10px', border: '0.5px solid #B4B2A9', borderRadius: 8, boxSizing: 'border-box', resize: 'vertical' }} />
          </label>
          {movErr && <div style={{ fontSize: 12, color: '#9B1C1C', marginBottom: 8 }}>{movErr}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
            <button onClick={() => setManualEdit(null)} disabled={savingMov}
              style={{ fontSize: 13, padding: '8px 14px', borderRadius: 8, border: '0.5px solid #D3D1C7', background: '#fff', color: '#5F5E5A', cursor: 'pointer' }}>Cancelar</button>
            <button onClick={guardarManualEdit} disabled={savingMov}
              style={{ fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 8, border: 'none', background: savingMov ? '#B4D8CB' : '#1D9E75', color: '#fff', cursor: savingMov ? 'default' : 'pointer' }}>{savingMov ? 'Guardando…' : 'Guardar cambio'}</button>
          </div>
        </div>
      </>
    )}

    {/* ── Modal: ANULAR / REACTIVAR movimiento manual ── */}
    {anulRow && (
      <>
        <div onClick={() => !savingMov && setAnulRow(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 9000 }} />
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(440px, 94vw)', background: '#fff', borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.25)', zIndex: 9001, padding: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#2C2C2A', marginBottom: 4 }}>{anulRow.anulado ? 'Reactivar movimiento' : 'Anular movimiento'}</div>
          <div style={{ fontSize: 12, color: '#888780', marginBottom: 12 }}>{anulRow.fecha} · {anulRow.concepto}</div>
          <div style={{ fontSize: 12, color: '#5F5E5A', marginBottom: 12, background: '#F7F5EF', padding: '8px 10px', borderRadius: 8 }}>
            {anulRow.anulado ? 'Volverá a contar en el saldo.' : 'Dejará de contar en el saldo. No se borra: queda como ANULADO y es reversible.'}
          </div>
          <label style={{ fontSize: 12, color: '#888780', display: 'block', marginBottom: 8 }}>Motivo (obligatorio)
            <textarea value={anulMotivo} onChange={e => setAnulMotivo(e.target.value)} rows={2} placeholder={anulRow.anulado ? 'Por qué se reactiva…' : 'Por qué se anula…'}
              style={{ width: '100%', marginTop: 4, fontSize: 13, padding: '8px 10px', border: '0.5px solid #B4B2A9', borderRadius: 8, boxSizing: 'border-box', resize: 'vertical' }} />
          </label>
          {movErr && <div style={{ fontSize: 12, color: '#9B1C1C', marginBottom: 8 }}>{movErr}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
            <button onClick={() => setAnulRow(null)} disabled={savingMov}
              style={{ fontSize: 13, padding: '8px 14px', borderRadius: 8, border: '0.5px solid #D3D1C7', background: '#fff', color: '#5F5E5A', cursor: 'pointer' }}>Cancelar</button>
            <button onClick={confirmarAnular} disabled={savingMov || anulMotivo.trim().length < 3}
              style={{ fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 8, border: 'none', background: (savingMov || anulMotivo.trim().length < 3) ? '#D8B4B4' : (anulRow.anulado ? '#1D9E75' : '#C0392B'), color: '#fff', cursor: (savingMov || anulMotivo.trim().length < 3) ? 'default' : 'pointer' }}>{savingMov ? '…' : (anulRow.anulado ? 'Reactivar' : 'Anular')}</button>
          </div>
        </div>
      </>
    )}
    </>
  )
}