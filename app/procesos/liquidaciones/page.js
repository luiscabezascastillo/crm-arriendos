'use client'
// VERSION: v11 · 2026-08-10 · TRANSFER prep COMPLEMENTARIAS (paso 4, aditivo/sin tocar el cálculo): lee las complementarias
//   REGISTRADAS del mes de cobro (/api/liquidaciones/complementaria?mes_cobro=AAMM) y las muestra como KPI "🧩 Complementarias"
//   y como chip en la fila del propietario ("🧩 +$neto · arriendo de <mes>"), para saber que a ese propietario hay que
//   transferirle también esa cantidad. NO altera a_transferir/validado/transferido (eso se fundirá al probar con un pago
//   real). Fuente adicional: liquidacion_complementaria. Hereda v10.
// VERSION: v10 · 2026-08-10 · TRANSFER: el selector de meses ahora va desde ENERO 2025 (2501) hasta 1 mes por delante del actual, IGUAL que CARTAS (antes usaba una ventana móvil de 6 meses atrás → empezaba en feb-2026, dejando fuera 2501–2601). Solo cambia generarMeses(); el mes por defecto (mesEnCurso, regla día 23) no cambia. Hereda v9.
// VERSION: v9 · 2026-08-07 · TRANSFER: refleja las líneas "en espera" (retenidas en CARTAS por arrendatario moroso).
//   "A transferir" pasa a ser "a transferir AHORA" = total − retenido; se añade KPI "En espera" y chip por propietario;
//   la validación/Transferido usan el importe de ahora (así el propietario con su parte pagada queda ✓ aunque el moroso
//   siga pendiente). Al Congelar, avisa si quedan líneas en espera sin cobrar. Fuente: /api/liquidaciones/retener. Hereda v8.
// VERSION: v8 · 2026-08-07 · TRANSFER: filtros estilo Excel por columna en la cabecera (buscador + recuento + ordenar ↑↓,
//   como Compras/Términos), aplicados a las filas de propietario. El export (⬇ Excel) ya existía y respeta los filtros.
//   Los KPIs siguen sobre el total del mes. Hereda v7.
// VERSION: v7 · 2026-08-07 · TRANSFER por tandas: (1) los ya transferidos muestran chip "Transferido" (azul, no clicable)
//   en vez del botón Validar/✓ — para no desvalidar por error; (2) tarjeta arriba "Validado (tanda)" que suma en vivo
//   lo validado-sin-transferir; (3) filtro de estado (Todos / Sin transferir / Validados / Transferidos); (4) exportar
//   a Excel lo filtrado. Los KPIs de arriba y el contador de propietarios siguen sobre el total del mes. Hereda v6.
// VERSION: v6 · 2026-07-19 · Fase 2b: en mes CONGELADO la columna Validado es solo-lectura (sin botón Validar ni quitar validación)
// VERSION: v5 · 2026-07-19 · Fase 2: mes CONGELADO lee la foto (liquidacion_congelada_propietario + detalle de liquidacion_idadmon); mes en vivo sin cambios
// VERSION: v4 · 2026-07-19 · Fase 1 coherencia: en mes CONGELADO solo se muestra el indicador 🔒 CONGELADA (se ocultan Recalcular fuentes y Congelar mes)
// VERSION: v3 · 2026-07-19 · botón "Congelar mes" (modal de confirmación + indicador 🔒 CONGELADA + aviso "YA CONGELADA"); usa endpoint /api/liquidaciones/congelar-mes
// VERSION: v2 · 2026-07-08 · boton renombrado a 'Recalcular fuentes'
import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabaseClient'
import TopNav from '@/app/components/ui/TopNav'

const DIRECCION_EMAILS = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']

const norm = s => (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
const n0 = v => { const x = Number(v); return isNaN(x) ? 0 : x }
const NUM_FONT = { fontFamily: '"DM Mono", "Roboto Mono", ui-monospace, "SF Mono", "Cascadia Mono", Consolas, Menlo, monospace', fontVariantNumeric: 'tabular-nums' }
const fmtPesos = n => {
  const v = Number(n)
  const s = (isNaN(v) || n === null || n === '') ? '—' : '$' + Math.round(v).toLocaleString('es-CL')
  return <span style={NUM_FONT}>{s}</span>
}
const fmtFecha = s => { if (!s) return '—'; const str = String(s); if (/^\d{4}-\d{2}-\d{2}/.test(str)) { const [y, m, d] = str.slice(0, 10).split('-'); return `${d}/${m}/${y}` } return str }

// Mes AAMM -> etiqueta legible y viceversa
const MESES_TXT = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
const aammToTxt = aamm => { if (!aamm || aamm.length !== 4) return aamm; const a = aamm.slice(0, 2), m = parseInt(aamm.slice(2), 10); return `${MESES_TXT[m - 1] || '?'} 20${a}` }
// Genera la lista de meses AAMM del selector: desde ENERO 2025 (2501) hasta 1 mes por
// delante del actual. Misma lógica que CARTAS (page cartas.js) para que no se desincronicen.
function generarMeses() {
  const out = []; const hoy = new Date()
  const inicioY = 2025, inicioM = 0            // enero 2025
  const finD = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1)   // 1 mes adelante
  let d = new Date(inicioY, inicioM, 1)
  while (d <= finD) {
    out.push(String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0'))
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  }
  return out   // orden cronológico (antiguo → reciente)
}

// Filtro estilo Excel por columna (ordenar ↑↓ + buscador + valores con recuento). Igual que Compras/Términos.
function HeaderFilterTR({ col, movs, state, setState, open, setOpen, orden, setOrden }) {
  const active = state && (state.text || (state.sel && state.sel.length))
  const s = state || { text: '', sel: [] }
  const [busca, setBusca] = useState('')
  const distinct = useMemo(() => {
    const m = new Map()
    for (const v of movs) { const k = String(col.get(v) ?? ''); m.set(k, (m.get(k) || 0) + 1) }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0], 'es', { numeric: true }))
  }, [movs, col])
  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return q ? distinct.filter(([v]) => v.toLowerCase().includes(q) || (col.fmt && String(col.fmt(v)).toLowerCase().includes(q))) : distinct
  }, [distinct, busca]) // eslint-disable-line
  const toggle = (v) => { const sel = s.sel.includes(v) ? s.sel.filter(x => x !== v) : [...s.sel, v]; setState({ ...s, sel }) }
  const ordenar = (dir) => { setOrden({ key: col.key, dir }); setOpen(null) }
  const asc = col.num ? 'Menor a mayor' : 'A → Z'
  const desc = col.num ? 'Mayor a menor' : 'Z → A'
  const activoOrden = orden && orden.key === col.key
  return (
    <span style={{ position: 'relative', marginLeft: 4, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
      <button onClick={(e) => { e.stopPropagation(); setBusca(''); setOpen(open === col.key ? null : col.key) }} title="Ordenar y filtrar"
        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: active ? '#1D9E75' : (activoOrden ? '#0C447C' : '#B4B2A9'), fontSize: 11, padding: 0 }}>
        {activoOrden ? (orden.dir === 'desc' ? '▼' : '▲') : '▼'}
      </button>
      {open === col.key && (<>
        <div onClick={() => setOpen(null)} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
        <div style={{ position: 'absolute', top: 18, left: 0, zIndex: 61, background: '#fff', border: '0.5px solid #D3D1C7', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,0.14)', padding: 10, width: 250, textAlign: 'left', whiteSpace: 'normal' }}>
          <button onClick={() => ordenar('asc')} style={{ display: 'block', width: '100%', textAlign: 'left', fontSize: 12, padding: '5px 6px', border: 'none', borderRadius: 6, background: activoOrden && orden.dir === 'asc' ? '#E1F5EE' : 'transparent', cursor: 'pointer', color: '#2C2C2A' }}>↑ {asc}</button>
          <button onClick={() => ordenar('desc')} style={{ display: 'block', width: '100%', textAlign: 'left', fontSize: 12, padding: '5px 6px', border: 'none', borderRadius: 6, background: activoOrden && orden.dir === 'desc' ? '#E1F5EE' : 'transparent', cursor: 'pointer', color: '#2C2C2A' }}>↓ {desc}</button>
          <div style={{ borderTop: '0.5px solid #ECEAE3', margin: '8px 0' }} />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar en la lista…" autoFocus
            style={{ width: '100%', fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '0.5px solid #D3D1C7', boxSizing: 'border-box', marginBottom: 6 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 5 }}>
            <button onClick={() => setState({ ...s, sel: visibles.map(([v]) => v) })} style={{ border: 'none', background: 'transparent', color: '#0C447C', cursor: 'pointer', padding: 0 }}>Marcar {busca ? `los ${visibles.length} visibles` : 'todos'}</button>
            <button onClick={() => setState({ ...s, sel: [] })} style={{ border: 'none', background: 'transparent', color: '#888780', cursor: 'pointer', padding: 0 }}>Limpiar</button>
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {visibles.length === 0 && <div style={{ fontSize: 11, color: '#B4B2A9', padding: '6px 0' }}>Sin coincidencias</div>}
            {visibles.slice(0, 400).map(([v, n]) => (
              <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '3px 0', cursor: 'pointer' }}>
                <input type="checkbox" checked={s.sel.includes(v)} onChange={() => toggle(v)} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v === '' ? '(vacío)' : (col.fmt ? col.fmt(v) : v)}</span>
                <span style={{ fontSize: 10, color: '#B4B2A9' }}>{n}</span>
              </label>))}
            {visibles.length > 400 && <div style={{ fontSize: 10, color: '#B4B2A9', padding: '4px 0' }}>…y {visibles.length - 400} más. Afina la búsqueda.</div>}
          </div>
          {active ? <button onClick={() => { setState({ text: '', sel: [] }); setBusca(''); setOpen(null) }} style={{ marginTop: 8, width: '100%', fontSize: 12, padding: '5px', borderRadius: 6, border: '0.5px solid #D3D1C7', background: '#F7F6F2', cursor: 'pointer' }}>Quitar filtro</button> : null}
        </div></>)}
    </span>
  )
}

export default function LiquidacionesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const email = session?.user?.email
  const rol = session?.user?.role

  const [accesoOk, setAccesoOk] = useState(null)
  // Mes de liquidación en curso: el mes actual, pero a partir del día 23
  // ya se prepara el mes siguiente (calendario de cierre de FCR).
  function mesEnCurso() {
    const h = new Date()
    let y = h.getFullYear(), m = h.getMonth()  // m: 0-11
    if (h.getDate() >= 23) { m += 1; if (m > 11) { m = 0; y += 1 } }
    return String(y).slice(2) + String(m + 1).padStart(2, '0')
  }
  const [mes, setMes] = useState(mesEnCurso())
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [propietarios, setPropietarios] = useState([])   // resumen por propietario
  const [transf, setTransf] = useState({})   // transferido ya pagado por idprop (RPC)
  const [detalles, setDetalles] = useState({})            // idprop -> [inmuebles]
  const [expandido, setExpandido] = useState(null)        // idprop expandido
  const [pagoAbierto, setPagoAbierto] = useState(null)    // idadmon con desglose de recibido abierto
  const [busca, setBusca] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')   // todos | sin_transferir | validados | transferidos
  const [filtersCol, setFiltersCol] = useState({})            // filtros estilo Excel por columna
  const [openFilterCol, setOpenFilterCol] = useState(null)
  const [ordenCol, setOrdenCol] = useState({ key: null, dir: 'asc' })
  const [ultimaAct, setUltimaAct] = useState(null)   // marca de hora de la última lectura
  const [cobraDueno, setCobraDueno] = useState(new Set())   // idprops cuyos contratos cobra el dueño
  const [retMap, setRetMap] = useState({})     // idprop -> neto retenido (líneas "en espera" este mes)
  const [retList, setRetList] = useState([])   // filas retenidas enriquecidas (para el aviso de congelar)
  const [complMap, setComplMap] = useState({}) // idprop -> { neto, items:[{idadmon, mes_espera, neto, estado}] } complementarias del mes de cobro
  const [validaciones, setValidaciones] = useState({})      // idprop -> {validado, validado_por, validado_at}
  const [valSaving, setValSaving] = useState(null)          // idprop guardándose
  const puedeValidar = rol === 'direccion' || rol === 'administracion' || rol === 'admin' || DIRECCION_EMAILS.includes(email)
  // ── Congelar mes ──
  const [estadoCongelado, setEstadoCongelado] = useState(null)  // 'congelada' | 'abierta' | 'vacia' | null
  const [modalCongelar, setModalCongelar] = useState(false)     // muestra confirmación
  const [congelando, setCongelando] = useState(false)
  const [avisoCongelar, setAvisoCongelar] = useState(null)      // texto de resultado
  const puedeCongelar = rol === 'admin' || DIRECCION_EMAILS.includes(email)
  const nombreCorto = (mail) => { const p = String(mail || '').split('@')[0].split('.')[0]; return p ? p.charAt(0).toUpperCase() + p.slice(1) : '' }

  // Acceso
  useEffect(() => {
    if (status !== 'authenticated' || !email) return
    if (rol === 'admin' || DIRECCION_EMAILS.includes(email)) { setAccesoOk(true); return }
    supabase.from('proceso_permisos').select('proceso').eq('email', email).eq('activo', true)
      .then(({ data }) => setAccesoOk(!!(data || []).some(p => (p.proceso || '').toLowerCase().includes('liquidac'))))
  }, [status, email, rol])
  useEffect(() => { if (accesoOk === false) router.replace('/') }, [accesoOk, router])
  useEffect(() => { if (accesoOk === true) { cargarMes(mes); consultarCongelado(mes); cargarRetenidos(mes); cargarComplementarias(mes) } }, [accesoOk])

  // Líneas "en espera" del mes (retenidas en CARTAS): neto retenido por propietario + lista para el aviso de congelar.
  async function cargarRetenidos(m) {
    try {
      const r = await fetch('/api/liquidaciones/retener?mes=' + encodeURIComponent(m))
      const d = await r.json()
      const list = d.retenidos || []
      const map = {}
      for (const s of list) { const k = s.idprop; if (k) map[k] = n0(map[k]) + n0(s.neto) }
      setRetMap(map); setRetList(list)
    } catch { setRetMap({}); setRetList([]) }
  }

  // Complementarias REGISTRADAS cuyo mes de cobro es el mes visualizado: neto por propietario (a transferir aparte).
  async function cargarComplementarias(m) {
    try {
      const r = await fetch('/api/liquidaciones/complementaria?mes_cobro=' + encodeURIComponent(m))
      const d = await r.json()
      const map = {}
      for (const c of (d.candidatos || [])) {
        if (!c.complementaria || c.complementaria.estado === 'anulada') continue   // solo las registradas y vigentes
        const k = c.idprop; if (!k) continue
        const g = map[k] || (map[k] = { neto: 0, items: [] })
        g.neto += n0(c.neto)
        g.items.push({ idadmon: c.idadmon, mes_espera: c.mes_espera, neto: n0(c.neto), estado: c.complementaria.estado })
      }
      setComplMap(map)
    } catch { setComplMap({}) }
  }

  async function cargarMes(m) {
    setCargando(true); setError(null); setExpandido(null); setDetalles({}); setPagoAbierto(null)
    // ¿El mes está congelado? Si lo está, se lee la FOTO congelada (no se recalcula en vivo).
    let congelado = false
    try {
      const rc = await fetch('/api/liquidaciones/congelar-mes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes: m, check: true }),
      })
      const jc = await rc.json().catch(() => ({}))
      congelado = jc.estado === 'congelada'
      setEstadoCongelado(jc.estado || null)
    } catch { setEstadoCongelado(null) }
    const [rLiq, rTransf] = await Promise.all([
      // Congelado -> resumen desde liquidacion_idadmon; en vivo -> RPC de cálculo.
      supabase.rpc(congelado ? 'liquidacion_congelada_propietario' : 'calcular_liquidacion_propietario', { p_mes: m }),
      // El transferido se lee del bi (estable en meses pasados), igual en ambos casos.
      supabase.rpc('transferido_propietario', { p_mes: m }),
    ])
    if (rLiq.error) { setError(rLiq.error.message); setPropietarios([]); setCargando(false); return }
    setPropietarios(rLiq.data || [])
    const tmap = {}
    for (const t of rTransf.data || []) tmap[t.idprop] = n0(t.transferido)
    setTransf(tmap)
    // "Cobra dueño": propietario cuyos contratos activos son TODOS quien_cobra='DUEÑO' (no se le transfiere)
    const { data: qc } = await supabase.from('datos_arriendos').select('idprop, quien_cobra').in('estado', ['S', 'SQ', 'P'])
    const porProp = {}
    for (const r of qc || []) { const k = r.idprop; (porProp[k] = porProp[k] || []).push(String(r.quien_cobra || '').trim().toUpperCase()) }
    const cd = new Set()
    for (const [k, arr] of Object.entries(porProp)) {
      const hayDueno = arr.some(v => v === 'DUEÑO')
      const hayFCR = arr.some(v => v === 'FCR')
      if (hayDueno && !hayFCR) cd.add(k)   // cobra el dueño si hay DUEÑO y ningún contrato FCR (ignora vacíos)
    }
    setCobraDueno(cd)
    // Validaciones de transferencia del mes (por idprop)
    try {
      const rv = await fetch(`/api/transfer/validar?mes=${m}`, { cache: 'no-store' })
      const jv = await rv.json()
      const vmap = {}
      for (const r of (jv.rows || [])) vmap[r.idprop] = r
      setValidaciones(vmap)
    } catch { setValidaciones({}) }
    setUltimaAct(new Date())
    setCargando(false)
  }

  // Cargar detalle por inmueble + descuentos + comentarios + ajustes del mes
  async function toggle(idprop) {
    if (expandido === idprop) { setExpandido(null); return }
    setExpandido(idprop)
    if (detalles[idprop]) return
    let delProp = []
    if (estadoCongelado === 'congelada') {
      // Mes congelado: leer las líneas de la FOTO (liquidacion_idadmon) y mapear
      // los nombres de columna a los que espera el render (como calcular_liquidacion).
      const { data, error } = await supabase.from('liquidacion_idadmon')
        .select('idadmon, idprop, inmueble, a_cobrar, comision, iva, descuentos, neto_transferir, recibido, falta_al_cierre')
        .eq('mes', mes).eq('idprop', idprop)
      if (error) { setError(error.message); return }
      delProp = (data || []).map(r => ({
        idadmon: r.idadmon, idprop: r.idprop, inmueble: r.inmueble,
        base: n0(r.a_cobrar), comision: n0(r.comision), iva_comision: n0(r.iva),
        total_descuentos: n0(r.descuentos), neto_transferir: n0(r.neto_transferir),
        recibido_banco: n0(r.recibido), falta: n0(r.falta_al_cierre),
        hubo_falta: n0(r.falta_al_cierre) > 0,
      }))
    } else {
      // Mes en vivo: recalcular
      const { data, error } = await supabase.rpc('calcular_liquidacion', { p_mes: mes })
      if (error) { setError(error.message); return }
      delProp = (data || []).filter(d => d.idprop === idprop)
    }
    const ids = delProp.map(d => d.idadmon)
    let descs = [], coments = [], arriendos = [], pagos = []
    if (ids.length) {
      const [rDesc, rCom, rArr, rPag] = await Promise.all([
        supabase.from('descuentos')
          .select('idadmon, monto_a_imputar, texto_explicativo_para_carta_a_propietario')
          .in('idadmon', ids).eq('mes_a_imputar', aammToTxt(mes)).eq('repercutir_a', 'PROPIETARIO'),
        supabase.from('comentarios_liquidacion')
          .select('idadmon, comentario').in('idadmon', ids).eq('mes', mes),
        supabase.from('datos_arriendos')
          .select('idadmon, fecha_inicio, fecha_reajuste1, cantidad_reajuste1, fecha_reajuste2, cantidad_reajuste2, fecha_reajuste3, cantidad_reajuste3, fecha_reajuste4, cantidad_reajuste4, fecha_reajuste5, cantidad_reajuste5, fecha_reajuste6, cantidad_reajuste6')
          .in('idadmon', ids),
        supabase.from('bi')
          .select('idadmon2, fecha, reg, arriendo').eq('liquidacion_mes2', mes).in('idadmon2', ids),
      ])
      descs = rDesc.data || []; coments = rCom.data || []; arriendos = rArr.data || []; pagos = rPag.data || []
    }
    // Ajuste del mes = cantidad_reajusteN cuya fecha cae en el mes AAMM liquidado
    const ajustes = {}
    arriendos.forEach(a => {
      for (let i = 1; i <= 6; i++) {
        const f = a['fecha_reajuste' + i], c = n0(a['cantidad_reajuste' + i])
        if (f && c !== 0) {
          const aamm = String(f).slice(2, 4) + String(f).slice(5, 7)  // YYYY-MM-DD -> AAMM
          if (aamm === mes) ajustes[a.idadmon] = c
        }
      }
    })
    // Pie de textos: IDADMON · cantidad · texto
    const pie = []
    ids.forEach(id => {
      descs.filter(d => d.idadmon === id).forEach(d =>
        pie.push({ idadmon: id, cantidad: n0(d.monto_a_imputar), texto: d.texto_explicativo_para_carta_a_propietario || 'Descuento' }))
      if (ajustes[id]) pie.push({ idadmon: id, cantidad: ajustes[id], texto: 'Ajuste del mes' })
      coments.filter(c => c.idadmon === id && c.comentario).forEach(c =>
        pie.push({ idadmon: id, cantidad: null, texto: c.comentario }))
    })
    const sumaDesc = {}
    descs.forEach(d => { sumaDesc[d.idadmon] = (sumaDesc[d.idadmon] || 0) + n0(d.monto_a_imputar) })
    // pagos del BI agrupados por inmueble (para el desglose al pinchar Recibido)
    const pagosPorInm = {}
    pagos.forEach(pg => { (pagosPorInm[pg.idadmon2] = pagosPorInm[pg.idadmon2] || []).push(pg) })
    // Inicio del contrato (fecha_inicio de datos_arriendos) por inmueble
    const inicios = {}
    arriendos.forEach(a => { inicios[a.idadmon] = a.fecha_inicio })
    setDetalles(prev => ({ ...prev, [idprop]: { inmuebles: delProp, pie, sumaDesc, pagosPorInm, inicios } }))
  }

  function cambiarMes(m) { setMes(m); cargarMes(m); consultarCongelado(m); cargarRetenidos(m); cargarComplementarias(m) }

  // Consulta si el mes está congelado (para el indicador de candado)
  async function consultarCongelado(m) {
    try {
      const res = await fetch('/api/liquidaciones/congelar-mes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes: m, check: true }),
      })
      const j = await res.json().catch(() => ({}))
      setEstadoCongelado(res.ok ? (j.estado || null) : null)
    } catch { setEstadoCongelado(null) }
  }

  // Ejecuta el congelado (tras confirmación del modal)
  async function ejecutarCongelar() {
    setCongelando(true); setAvisoCongelar(null)
    try {
      const res = await fetch('/api/liquidaciones/congelar-mes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        setAvisoCongelar('⚠ Error: ' + (j.error || res.status))
      } else if (j.ya_congelada) {
        setAvisoCongelar('🔒 Liquidación ' + aammToTxt(mes) + ' YA CONGELADA')
        setEstadoCongelado('congelada')
      } else if (j.congelada) {
        setAvisoCongelar('✅ Liquidación ' + aammToTxt(mes) + ' congelada (' + (j.lineas ?? '?') + ' líneas)')
        setEstadoCongelado('congelada')
      }
    } catch (e) {
      setAvisoCongelar('⚠ Error de red al congelar')
    } finally {
      setCongelando(false)
      setModalCongelar(false)
    }
  }

  async function toggleValidar(idprop, ev) {
    if (ev) ev.stopPropagation()
    if (!puedeValidar) return
    const actual = validaciones[idprop]
    const nuevo = !(actual && actual.validado)
    setValSaving(idprop)
    try {
      const res = await fetch('/api/transfer/validar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idprop, mes, validado: nuevo }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Error')
      setValidaciones(prev => ({ ...prev, [idprop]: { idprop, validado: j.validado, validado_por: j.validado_por, validado_at: j.validado_at } }))
    } catch (err) { alert(err.message) }
    setValSaving(null)
  }

  if (status === 'loading' || accesoOk === null) return (<><TopNav /><div style={{ padding: 40, color: '#888' }}>Cargando…</div></>)
  if (accesoOk === false) return null

  // ── Alertas automáticas por propietario ──
  function alertasDe(p) {
    const out = []
    if (n0(p.n_con_falta) > 0) out.push({ tipo: 'falta', txt: `${p.n_con_falta} inmueble${p.n_con_falta > 1 ? 's' : ''} con falta de pago` })
    if (n0(p.n_propiedades) === 1 && n0(p.total_falta) > 0) out.push({ tipo: 'riesgo', txt: 'Propietario de 1 sola propiedad con falta — recuperar adelanto es difícil' })
    return out
  }

  const q = norm(busca)
  // Retenido (en espera) por propietario y "a transferir AHORA" = total − retenido.
  const retDe = (p) => n0(retMap[p.idprop])
  const aTransAhora = (p) => n0(p.total_transferir) - retDe(p)
  const esTransferido = (p) => !cobraDueno.has(p.idprop) && n0(transf[p.idprop]) > 0 && n0(transf[p.idprop]) >= aTransAhora(p)
  const estaValidado = (p) => !!(validaciones[p.idprop] && validaciones[p.idprop].validado)
  // listaBusca = solo búsqueda (para los KPIs y contadores del MES). lista = + filtro de estado (para la tabla/export).
  const listaBusca = (propietarios || []).filter(p => !q || norm([p.propietario, p.idprop].join(' ')).includes(q))
  // Columnas para los filtros estilo Excel de la cabecera (get() cierra sobre el estado del componente)
  const money = v => v === '' ? '—' : fmtPesos(v)
  const COLDEFS_TR = [
    { key: 'propietario', label: 'Propietario', get: p => p.idprop ? `${p.idprop} — ${p.propietario}` : (p.propietario || '') },
    { key: 'a_cobrar', label: 'A cobrar', num: true, alignR: true, fmt: money, get: p => String(n0(p.total_base)) },
    { key: 'recibido', label: 'Recibido', num: true, alignR: true, fmt: money, get: p => String(n0(p.total_recibido)) },
    { key: 'comision', label: 'Comisión', num: true, alignR: true, fmt: money, get: p => String(n0(p.total_comision)) },
    { key: 'iva', label: 'IVA', num: true, alignR: true, fmt: money, get: p => String(n0(p.total_iva)) },
    { key: 'descuentos', label: 'Descuentos', num: true, alignR: true, fmt: money, get: p => String(n0(p.total_descuentos)) },
    { key: 'a_transferir', label: 'A transferir', num: true, alignR: true, fmt: money, get: p => cobraDueno.has(p.idprop) ? '' : String(aTransAhora(p)) },
    { key: 'transferido', label: 'Transferido', num: true, alignR: true, fmt: money, get: p => String(n0(transf[p.idprop])) },
    { key: 'validado', label: 'Validado', center: true, get: p => cobraDueno.has(p.idprop) ? '(cobra dueño)' : (esTransferido(p) ? 'Transferido' : (estaValidado(p) ? `Validado ${nombreCorto(validaciones[p.idprop] && validaciones[p.idprop].validado_por)}` : 'Pendiente')) },
    { key: 'estado', label: 'Estado', center: true, get: p => cobraDueno.has(p.idprop) ? '(cobra dueño)' : (alertasDe(p).length ? '⚠ Con alerta' : '✓ OK') },
  ]
  let lista = listaBusca.filter(p => {
    if (filtroEstado === 'todos') return true
    const t = esTransferido(p), v = estaValidado(p)
    if (filtroEstado === 'sin_transferir') return !cobraDueno.has(p.idprop) && !t
    if (filtroEstado === 'validados') return v && !t
    if (filtroEstado === 'transferidos') return t
    return true
  }).filter(p => {
    for (const c of COLDEFS_TR) {
      const f = filtersCol[c.key]; if (!f) continue
      const val = String(c.get(p) ?? '')
      if (f.text && !val.toLowerCase().includes(f.text.toLowerCase())) return false
      if (f.sel && f.sel.length && !f.sel.includes(val)) return false
    }
    return true
  })
  if (ordenCol.key) {
    const c = COLDEFS_TR.find(x => x.key === ordenCol.key)
    if (c) {
      const vo = p => c.num ? Number(c.get(p) || 0) : norm(c.get(p))
      lista = lista.slice().sort((a, b) => {
        const va = vo(a), vb = vo(b); let cmp = va < vb ? -1 : va > vb ? 1 : 0
        if (cmp === 0) cmp = norm(a.idprop) < norm(b.idprop) ? -1 : (norm(a.idprop) > norm(b.idprop) ? 1 : 0)
        return ordenCol.dir === 'desc' ? -cmp : cmp
      })
    }
  }

  // Totales del mes (sobre la búsqueda, NO sobre el filtro de estado; los "cobra dueño" NO cuentan)
  const totMes = listaBusca.reduce((a, p) => {
    if (cobraDueno.has(p.idprop)) return a
    return {
      transferir: a.transferir + aTransAhora(p),
      transferido: a.transferido + n0(transf[p.idprop]),
      comision: a.comision + n0(p.total_comision) + n0(p.total_iva),
      falta: a.falta + n0(p.total_falta),
    }
  }, { transferir: 0, transferido: 0, comision: 0, falta: 0 })
  const nCobraDueno = listaBusca.filter(p => cobraDueno.has(p.idprop)).length
  const faltaTransferir = Math.max(0, totMes.transferir - totMes.transferido)
  // En espera (morosos): neto retenido total del mes + nº de líneas aún sin cobrar (para el aviso de congelar).
  const totEspera = listaBusca.reduce((a, p) => cobraDueno.has(p.idprop) ? a : a + retDe(p), 0)
  const retenidosPend = (retList || []).filter(r => !r.cobrado)
  // Complementarias registradas del mes de cobro: neto a transferir aparte (informativo, no entra aún en los totales).
  const complList = Object.values(complMap)
  const totCompl = complList.reduce((a, m) => a + n0(m.neto), 0)
  const nCompl = complList.reduce((a, m) => a + (m.items ? m.items.length : 0), 0)
  const complDe = (p) => n0(complMap[p.idprop] && complMap[p.idprop].neto)
  // Tanda en curso: lo VALIDADO que aún NO se ha transferido (suma en vivo al ir validando)
  const validadoTanda = listaBusca.reduce((s, p) => (!cobraDueno.has(p.idprop) && estaValidado(p) && !esTransferido(p)) ? s + aTransAhora(p) : s, 0)
  const nValidadoTanda = listaBusca.filter(p => !cobraDueno.has(p.idprop) && estaValidado(p) && !esTransferido(p)).length

  // Exportar a Excel lo que se ve (con el filtro aplicado)
  async function exportarExcel() {
    const XLSX = await import('xlsx')
    const filas = lista.map(p => {
      const t = esTransferido(p), v = estaValidado(p), cd = cobraDueno.has(p.idprop)
      return {
        Propietario: p.idprop ? `${p.idprop} — ${p.propietario}` : p.propietario,
        'Nº props': n0(p.n_propiedades),
        'A cobrar': n0(p.total_base),
        Recibido: n0(p.total_recibido),
        'Comisión': n0(p.total_comision),
        IVA: n0(p.total_iva),
        Descuentos: n0(p.total_descuentos),
        'A transferir': cd ? '' : n0(p.total_transferir),
        Transferido: n0(transf[p.idprop]) || '',
        'Validado por': (validaciones[p.idprop] && validaciones[p.idprop].validado) ? nombreCorto(validaciones[p.idprop].validado_por) : '',
        Estado: cd ? 'cobra dueño' : (t ? 'Transferido' : (v ? 'Validado' : 'Pendiente')),
      }
    })
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), 'Liquidacion')
    const sello = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `Liquidacion-${aammToTxt(mes).replace(/\s+/g, '-')}-${sello}.xlsx`)
  }

  const card = { background: '#fff', border: '1px solid #E8E6E0', borderRadius: 12, padding: 16, marginBottom: 16 }
  const metric = { flex: 1, minWidth: 130, background: '#FAFAF8', borderRadius: 8, padding: '10px 14px' }
  const metricLbl = { fontSize: 12, color: '#888' }
  const metricVal = { fontSize: 20, fontWeight: 700, color: '#1a1a2e' }

  return (
    <>
      <TopNav />
      {/* Modal de confirmación de congelar */}
      {modalCongelar && (
        <div onClick={() => !congelando && setModalCongelar(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 14, padding: 26, maxWidth: 440, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', fontFamily: '"DM Sans", sans-serif' }}>
            {estadoCongelado === 'congelada' ? (
              <>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#1E40AF', marginBottom: 10 }}>🔒 Liquidación ya congelada</div>
                <div style={{ fontSize: 14, color: '#475569', lineHeight: 1.5, marginBottom: 20 }}>
                  La liquidación de <b>{aammToTxt(mes)}</b> ya está congelada y protegida. No hay nada que hacer.
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => setModalCongelar(false)}
                    style={{ fontSize: 13, fontWeight: 600, padding: '9px 18px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#F9FAFB', color: '#374151', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Entendido
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#92400E', marginBottom: 10 }}>🔒 ¿Congelar la liquidación de {aammToTxt(mes)}?</div>
                <div style={{ fontSize: 14, color: '#475569', lineHeight: 1.55, marginBottom: 8 }}>
                  Al congelar, este mes queda <b>cerrado y protegido</b>: se guarda una foto definitiva con los datos actuales (se recalcula una última vez) y ya <b>no se recalculará automáticamente</b>.
                </div>
                <div style={{ fontSize: 13, color: '#B45309', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '9px 12px', marginBottom: retenidosPend.length > 0 ? 12 : 20 }}>
                  Úsalo solo cuando el mes esté revisado y cuadrado. Si te has equivocado de mes, pulsa Cancelar.
                </div>
                {retenidosPend.length > 0 && (
                  <div style={{ fontSize: 13, color: '#1E40AF', background: '#EFF6FF', border: '1px solid #93C5FD', borderRadius: 8, padding: '9px 12px', marginBottom: 20 }}>
                    ⏸ Quedan <b>{retenidosPend.length}</b> línea(s) <b>en espera sin cobrar</b> (arrendatarios morosos), por <b>{fmtPesos(retenidosPend.reduce((a, r) => a + n0(r.neto), 0))}</b>. Si congelas ahora, ese saldo queda pendiente en la foto del mes. Confirma solo si es lo que quieres.
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button onClick={() => setModalCongelar(false)} disabled={congelando}
                    style={{ fontSize: 13, fontWeight: 600, padding: '9px 18px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Cancelar
                  </button>
                  <button onClick={ejecutarCongelar} disabled={congelando}
                    style={{ fontSize: 13, fontWeight: 700, padding: '9px 18px', borderRadius: 8, border: 'none', background: '#D97706', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {congelando ? 'Congelando…' : `Sí, congelar ${aammToTxt(mes)}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24, fontFamily: '"DM Sans", sans-serif', fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum" 1' }}>
        {avisoCongelar && (
          <div style={{ marginBottom: 14, fontSize: 13, fontWeight: 600, padding: '10px 14px', borderRadius: 8,
            background: avisoCongelar.startsWith('⚠') ? '#FEF2F2' : '#F0FDF4',
            color: avisoCongelar.startsWith('⚠') ? '#B91C1C' : '#166534',
            border: '1px solid ' + (avisoCongelar.startsWith('⚠') ? '#FECACA' : '#BBF7D0') }}>
            {avisoCongelar}
          </div>
        )}

        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', margin: '0 0 6px' }}>TRANSFER</h1>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>Transferencias a propietarios · los datos vienen de sus tablas de origen (datos_arriendos, bi, descuentos)</div>

        {/* CABECERA FIJA (sticky): controles + KPIs + títulos */}
        <div style={{ position: 'sticky', top: 52, zIndex: 20, background: '#F7F7F5', paddingTop: 6 }}>

        {/* Barra: mes + búsqueda */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          <label style={{ fontSize: 13, color: '#666' }}>Mes:</label>
          <select value={mes} onChange={e => cambiarMes(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid #E5E7EB', fontSize: 13, fontFamily: 'inherit' }}>
            {generarMeses().map(m => <option key={m} value={m}>{aammToTxt(m)}</option>)}
          </select>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar propietario…"
            style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid #E5E7EB', fontSize: 13, fontFamily: 'inherit', width: 240 }} />
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} title="Filtrar la tabla por estado de transferencia"
            style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid #E5E7EB', fontSize: 13, fontFamily: 'inherit', background: filtroEstado === 'todos' ? '#fff' : '#EEF2FF', color: filtroEstado === 'todos' ? '#1a1a2e' : '#3730A3', fontWeight: filtroEstado === 'todos' ? 400 : 700 }}>
            <option value="todos">Estado: Todos</option>
            <option value="sin_transferir">Sin transferir</option>
            <option value="validados">Validados (sin transf.)</option>
            <option value="transferidos">Transferidos</option>
          </select>
          <button onClick={exportarExcel} title="Exporta a Excel lo que ves (con el filtro aplicado)"
            style={{ fontSize: 12, fontWeight: 600, padding: '7px 12px', borderRadius: 7, border: '1px solid #C7D2FE', background: '#fff', color: '#185FA5', cursor: 'pointer', fontFamily: 'inherit' }}>⬇ Excel</button>
          {estadoCongelado === 'congelada' ? (
            <span title="Este mes está congelado (cerrado y protegido). No se recalcula."
              style={{ fontSize: 12, fontWeight: 700, padding: '7px 12px', borderRadius: 7, background: '#EFF6FF', color: '#1E40AF', border: '1px solid #BFDBFE' }}>
              🔒 CONGELADA
            </span>
          ) : (
            <>
              <button onClick={() => cargarMes(mes)} disabled={cargando}
                title="Vuelve a leer bi, descuentos y comentarios y recalcula todo"
                style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 7, border: 'none', background: '#1D9E75', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                {cargando ? 'Calculando…' : '🔄 Recalcular fuentes'}
              </button>
              {puedeCongelar && (
                <button onClick={() => { setAvisoCongelar(null); setModalCongelar(true) }} disabled={congelando}
                  title="Congela este mes: guarda una foto definitiva y ya no se recalculará"
                  style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 7, border: '1px solid #FBBF24', background: '#FFFBEB', color: '#92400E', cursor: 'pointer', fontFamily: 'inherit' }}>
                  🔒 Congelar mes
                </button>
              )}
            </>
          )}
          <button onClick={() => router.push('/procesos/liquidaciones/cartas')}
            style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 7, border: '1px solid #C7D2FE', background: '#EEF2FF', color: '#3730A3', cursor: 'pointer', fontFamily: 'inherit' }}>
            📄 CARTAS
          </button>
          <div style={{ width: 1, height: 22, background: '#E5E7EB', margin: '0 2px' }} />
          <button onClick={() => router.push('/procesos/liquidaciones/faltan')}
            style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 7, border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#B91C1C', cursor: 'pointer', fontFamily: 'inherit' }}>
            ⚠ FALTAN
          </button>
          <button onClick={() => router.push('/procesos/liquidaciones/emails')}
            title="EMAILS · envío de liquidaciones a propietarios (módulo en construcción)"
            style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 7, border: '1px solid #A7F3D0', background: '#ECFDF5', color: '#065F46', cursor: 'pointer', fontFamily: 'inherit' }}>
            ✉ EMAILS
          </button>
          <button onClick={() => router.push('/procesos/liquidaciones/facturas')}
            title="FACTURAS · preparación de facturación SimpleFactura"
            style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 7, border: '1px solid #DDD6FE', background: '#F5F3FF', color: '#6D28D9', cursor: 'pointer', fontFamily: 'inherit' }}>
            🧾 FACTURAS
          </button>
          {ultimaAct && <span style={{ fontSize: 11, color: '#94A3B8' }}>Actualizado {ultimaAct.toLocaleTimeString('es-CL')}</span>}
        </div>

        {/* Métricas */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={metric}><div style={metricLbl}>A transferir</div><div style={metricVal}>{fmtPesos(totMes.transferir)}</div></div>
          <div style={metric}><div style={metricLbl}>Transferido</div><div style={{ ...metricVal, color: '#0C447C' }}>{fmtPesos(totMes.transferido)}</div></div>
          <div style={metric}><div style={metricLbl}>Falta transferir</div><div style={{ ...metricVal, color: faltaTransferir > 0 ? '#b45309' : '#166534' }}>{fmtPesos(faltaTransferir)}</div></div>
          {totEspera > 0 && <div style={{ ...metric, background: '#EFF6FF', border: '1px solid #93C5FD' }} title="Neto retenido en espera (arrendatarios morosos) — se transfiere cuando llegue el dinero, antes de congelar"><div style={metricLbl}>En espera (morosos)</div><div style={{ ...metricVal, color: '#1D4ED8' }}>{fmtPesos(totEspera)}{retenidosPend.length > 0 && <span style={{ fontSize: 13, fontWeight: 600, color: '#3B82F6' }}> · {retenidosPend.length} sin cobrar</span>}</div></div>}
          {totCompl > 0 && <div style={{ ...metric, background: '#EEF2FF', border: '1px solid #C7B5FE' }} title="Complementarias registradas cuyo cobro se imputa a este mes — se transfiere al propietario aparte de su liquidación normal"><div style={metricLbl}>🧩 Complementarias</div><div style={{ ...metricVal, color: '#5B21B6' }}>{fmtPesos(totCompl)}<span style={{ fontSize: 13, fontWeight: 600, color: '#7C3AED' }}> · {nCompl}</span></div></div>}
          <div style={metric}><div style={metricLbl}>Comisión + IVA</div><div style={metricVal}>{fmtPesos(totMes.comision)}</div></div>
          <div style={metric}><div style={metricLbl}>Por cobrar (falta)</div><div style={{ ...metricVal, color: '#dc2626' }}>{fmtPesos(totMes.falta)}</div></div>
          <div style={metric}><div style={metricLbl}>Propietarios</div><div style={metricVal}>{listaBusca.length - nCobraDueno}{nCobraDueno > 0 && <span style={{ fontSize: 13, fontWeight: 600, color: '#9CA3AF' }}> (+{nCobraDueno} cobra dueño)</span>}</div></div>
          <div style={{ ...metric, background: nValidadoTanda ? '#F0FDF4' : '#FAFAF8', border: nValidadoTanda ? '1px solid #16a34a' : '1px solid transparent' }} title="Validados que aún NO se han transferido — el importe de la tanda que estás preparando">
            <div style={metricLbl}>Validado (tanda)</div>
            <div style={{ ...metricVal, color: nValidadoTanda ? '#166534' : '#9CA3AF' }}>{fmtPesos(validadoTanda)}{nValidadoTanda > 0 && <span style={{ fontSize: 13, fontWeight: 600, color: '#16a34a' }}> · {nValidadoTanda}</span>}</div>
          </div>
        </div>

        {/* Títulos de columnas (parte de la cabecera fija) */}
        {!cargando && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 0.8fr 0.8fr 0.7fr 0.6fr 0.75fr 0.85fr 0.85fr 0.95fr 0.45fr', gap: 8, padding: '9px 16px', background: '#FAFAF8', border: '1px solid #E8E6E0', borderRadius: '12px 12px 0 0', fontSize: 12, color: '#888', fontWeight: 700 }}>
            {COLDEFS_TR.map(c => (
              <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: c.alignR ? 'flex-end' : (c.center ? 'center' : 'flex-start') }}>
                <span>{c.label}</span>
                <HeaderFilterTR col={c} movs={listaBusca} state={filtersCol[c.key]} setState={v => setFiltersCol(f => ({ ...f, [c.key]: v }))} open={openFilterCol} setOpen={setOpenFilterCol} orden={ordenCol} setOrden={setOrdenCol} />
              </div>
            ))}
          </div>
        )}

        </div>{/* fin cabecera fija */}

        {error && <div style={{ ...card, background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', fontSize: 13, marginTop: 12 }}>Error: {error}</div>}

        {cargando ? <div style={{ color: '#888', padding: 20 }}>Calculando liquidación de {aammToTxt(mes)}…</div> : (
          <div style={{ background: '#fff', borderLeft: '1px solid #E8E6E0', borderRight: '1px solid #E8E6E0', borderBottom: '1px solid #E8E6E0', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>



            {lista.length === 0 && <div style={{ padding: 20, color: '#888', fontSize: 13 }}>No hay propietarios con contratos activos para {aammToTxt(mes)}.</div>}

            {lista.map(p => {
              const alertas = alertasDe(p)
              const abierto = expandido === p.idprop
              const detObj = detalles[p.idprop] || null
              const det = detObj ? detObj.inmuebles : []
              const pie = detObj ? detObj.pie : []
              const sumaDesc = detObj ? detObj.sumaDesc : {}
              const cd = cobraDueno.has(p.idprop)
              const enEspera = retDe(p)
              const pagadoOk = !cd && n0(transf[p.idprop]) > 0 && n0(transf[p.idprop]) >= aTransAhora(p)
              const GRID = '1.4fr 0.75fr 0.75fr 0.65fr 0.6fr 0.75fr 0.85fr 0.55fr 0.75fr'
              return (
                <div key={p.idprop} style={{ borderTop: '1px solid #F0EEE8' }}>
                  {/* Fila propietario */}
                  <div onClick={() => toggle(p.idprop)}
                    style={{ display: 'grid', gridTemplateColumns: '1.5fr 0.8fr 0.8fr 0.7fr 0.6fr 0.75fr 0.85fr 0.85fr 0.95fr 0.45fr', gap: 8, padding: '11px 16px', cursor: 'pointer', alignItems: 'center', background: abierto ? '#F5F9FF' : (cd ? '#FAFAFA' : (pagadoOk ? '#F0FDF4' : '#fff')), fontSize: 13 }}>
                    <div style={{ fontWeight: 600, color: cd ? '#9CA3AF' : '#1a1a2e', display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flexWrap: 'wrap' }}>
                      <span style={{ color: '#9ca3af' }}>{abierto ? '▼' : '▶'}</span>
                      <span>{p.idprop ? `${p.idprop} — ${p.propietario}` : p.propietario}</span>
                      <span style={{ color: '#9ca3af', fontWeight: 400, fontSize: 12 }}>· {p.n_propiedades} prop{p.n_propiedades > 1 ? 's' : ''}</span>
                      {cd && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: '#E5E7EB', color: '#6B7280', whiteSpace: 'nowrap' }}>cobra dueño</span>}
                      {complMap[p.idprop] && <span onClick={(e) => e.stopPropagation()} title={'Transferir aparte (complementaria): ' + complMap[p.idprop].items.map(it => it.idadmon + ' arriendo ' + aammToTxt(it.mes_espera) + ' $' + Math.round(it.neto).toLocaleString('es-CL')).join(' · ')} style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: '#EDE9FE', color: '#5B21B6', whiteSpace: 'nowrap' }}>🧩 +${Math.round(complMap[p.idprop].neto).toLocaleString('es-CL')} compl.</span>}
                      {pagadoOk && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: '#DCFCE7', color: '#166534', whiteSpace: 'nowrap' }}>✓ transferido</span>}
                      {enEspera > 0 && <span title="Tiene un inmueble en espera (arrendatario moroso): su neto no se transfiere hasta que llegue el dinero" style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: '#DBEAFE', color: '#1D4ED8', whiteSpace: 'nowrap' }}>⏸ en espera {fmtPesos(enEspera)}</span>}
                    </div>
                    <div style={{ textAlign: 'right', color: '#666' }}>{fmtPesos(p.total_base)}</div>
                    <div style={{ textAlign: 'right', color: '#666' }}>{fmtPesos(p.total_recibido)}</div>
                    <div style={{ textAlign: 'right', color: '#666' }}>{n0(p.total_comision) === 0 ? '—' : fmtPesos(p.total_comision)}</div>
                    <div style={{ textAlign: 'right', color: '#666' }}>{n0(p.total_iva) === 0 ? '—' : fmtPesos(p.total_iva)}</div>
                    <div style={{ textAlign: 'right', color: n0(p.total_descuentos) ? (n0(p.total_descuentos) < 0 ? '#dc2626' : '#1D9E75') : '#ccc' }}>{n0(p.total_descuentos) ? fmtPesos(p.total_descuentos) : '—'}</div>
                    <div style={{ textAlign: 'right', fontWeight: 700, color: cd ? '#9CA3AF' : '#1a1a2e' }}>{cd ? '—' : fmtPesos(aTransAhora(p))}{enEspera > 0 && <div style={{ fontSize: 10, fontWeight: 600, color: '#1D4ED8' }}>⏸ +{fmtPesos(enEspera)} en espera</div>}</div>
                    <div style={{ textAlign: 'right', color: n0(transf[p.idprop]) ? '#0C447C' : '#ccc' }}>{n0(transf[p.idprop]) ? fmtPesos(transf[p.idprop]) : '—'}</div>
                    <div style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                      {cd ? <span style={{ color: '#D1D5DB' }}>—</span>
                        : pagadoOk
                          /* Ya transferido: sin botón de validar (para no desvalidar por error). Chip azul. */
                          ? <span title="Ya transferido" style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: '#DBEAFE', color: '#1E40AF', whiteSpace: 'nowrap' }}>Transferido</span>
                        : estadoCongelado === 'congelada'
                          /* Mes congelado: solo lectura. Muestra la validación tal como quedó, sin poder cambiarla. */
                          ? (validaciones[p.idprop] && validaciones[p.idprop].validado
                              ? <span title={`Validado por ${nombreCorto(validaciones[p.idprop].validado_por)}${validaciones[p.idprop].validado_at ? ' · ' + new Date(validaciones[p.idprop].validado_at).toLocaleString('es-CL') : ''}`}
                                  style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: '#DCFCE7', color: '#166534', whiteSpace: 'nowrap' }}>
                                  ✓ {nombreCorto(validaciones[p.idprop].validado_por)}
                                </span>
                              : <span style={{ color: '#D1D5DB' }}>—</span>)
                        : (validaciones[p.idprop] && validaciones[p.idprop].validado)
                          ? <span onClick={puedeValidar ? (e => toggleValidar(p.idprop, e)) : undefined}
                              title={`Validado por ${nombreCorto(validaciones[p.idprop].validado_por)}${validaciones[p.idprop].validado_at ? ' · ' + new Date(validaciones[p.idprop].validado_at).toLocaleString('es-CL') : ''}${puedeValidar ? ' (clic para quitar)' : ''}`}
                              style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: '#DCFCE7', color: '#166534', cursor: puedeValidar ? 'pointer' : 'default', whiteSpace: 'nowrap' }}>
                              ✓ {nombreCorto(validaciones[p.idprop].validado_por)}
                            </span>
                          : puedeValidar
                            ? <button onClick={e => toggleValidar(p.idprop, e)} disabled={valSaving === p.idprop}
                                style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 7, border: '1px solid #CBD5E1', background: '#fff', color: '#475569', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                {valSaving === p.idprop ? '…' : 'Validar'}
                              </button>
                            : <span style={{ fontSize: 11, color: '#9CA3AF' }}>Pendiente</span>}
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      {cd ? <span style={{ color: '#D1D5DB' }}>—</span>
                        : alertas.length > 0
                        ? <span title={alertas.map(a => a.txt).join(' · ')} style={{ color: '#dc2626' }}>⚠</span>
                        : <span style={{ color: '#1D9E75' }}>✓</span>}
                    </div>
                  </div>

                  {/* Detalle expandido */}
                  {abierto && (
                    <div style={{ padding: '4px 16px 16px', background: '#F5F9FF' }}>
                      {/* Alertas */}
                      {alertas.map((a, i) => (
                        <div key={i} style={{ background: a.tipo === 'riesgo' ? '#FFF7ED' : '#FEF2F2', border: '1px solid ' + (a.tipo === 'riesgo' ? '#FED7AA' : '#FCA5A5'), borderRadius: 8, padding: '7px 12px', marginBottom: 8, fontSize: 12, color: a.tipo === 'riesgo' ? '#9A3412' : '#991B1B' }}>
                          ⚠ {a.txt}
                        </div>
                      ))}

                      {/* Tabla de inmuebles */}
                      {!detObj ? <div style={{ fontSize: 12, color: '#888', padding: 8 }}>Cargando inmuebles…</div> : (
                        <div style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8, overflow: 'hidden' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 4, padding: '6px 12px', background: '#FAFAF8', fontSize: 11, color: '#9ca3af', fontWeight: 700 }}>
                            <div>Inmueble</div>
                            <div style={{ textAlign: 'right' }}>A cobrar</div>
                            <div style={{ textAlign: 'right' }}>Recibido</div>
                            <div style={{ textAlign: 'right' }}>Comisión</div>
                            <div style={{ textAlign: 'right' }}>IVA</div>
                            <div style={{ textAlign: 'right' }}>Descuentos</div>
                            <div style={{ textAlign: 'right' }}>A transferir</div>
                            <div style={{ textAlign: 'center' }}>Aviso</div>
                            <div style={{ textAlign: 'center' }}>Inicio</div>
                          </div>
                          {det.map(d => {
                            const esProp = (d.inmueble || '').startsWith('[proporcional')
                            const sd = esProp ? 0 : sumaDesc[d.idadmon]
                            const notasInm = esProp ? [] : pie.filter(f => f.idadmon === d.idadmon)
                            const pagosInm = esProp ? [] : ((detObj.pagosPorInm && detObj.pagosPorInm[d.idadmon]) || [])
                            const verPagos = pagoAbierto === 'R' + d.idadmon
                            const verDescs = pagoAbierto === 'D' + d.idadmon
                            const clic = key => setPagoAbierto(prev => prev === key ? null : key)
                            return (
                            <div key={d.idadmon + (esProp ? '·prop' : '')}>
                            <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 4, padding: '7px 12px', borderTop: '1px solid #F0EEE8', fontSize: 12, background: d.hubo_falta ? '#FEF6F6' : '#fff', alignItems: 'center' }}>
                              <div title={d.idadmon + ' · ' + (d.inmueble || '')}><span style={{ fontWeight: 600 }}>{d.idadmon}</span> <span style={{ color: '#9ca3af' }}>{(d.inmueble || '').slice(0, 24)}</span></div>
                              <div style={{ textAlign: 'right' }}>{fmtPesos(d.base)}</div>
                              <div style={{ textAlign: 'right' }}>
                                {n0(d.recibido_banco) > 0 && pagosInm.length > 0
                                  ? <span onClick={() => clic('R' + d.idadmon)} style={{ cursor: 'pointer', color: '#185FA5', borderBottom: '1px dotted #185FA5' }}>{fmtPesos(d.recibido_banco)}</span>
                                  : <span style={{ color: n0(d.recibido_banco) === 0 ? '#dc2626' : '#666' }}>{fmtPesos(d.recibido_banco)}</span>}
                              </div>
                              <div style={{ textAlign: 'right', color: '#666' }}>{n0(d.comision) === 0 ? '—' : fmtPesos(d.comision)}</div>
                              <div style={{ textAlign: 'right', color: '#666' }}>{n0(d.iva_comision) === 0 ? '—' : fmtPesos(d.iva_comision)}</div>
                              <div style={{ textAlign: 'right' }}>
                                {sd
                                  ? <span onClick={() => clic('D' + d.idadmon)} style={{ cursor: 'pointer', color: sd < 0 ? '#dc2626' : '#1D9E75', fontWeight: 600, borderBottom: '1px dotted ' + (sd < 0 ? '#dc2626' : '#1D9E75') }}>{fmtPesos(sd)}</span>
                                  : <span style={{ color: '#ccc' }}>—</span>}
                              </div>
                              <div style={{ textAlign: 'right', fontWeight: 600 }}>{fmtPesos(d.neto_transferir)}</div>
                              <div style={{ textAlign: 'center', fontSize: 10 }}>
                                {d.hubo_falta ? <span style={{ color: '#dc2626' }}>falta</span> : <span style={{ color: '#1D9E75' }}>✓</span>}
                              </div>
                              <div style={{ textAlign: 'center', fontSize: 11, color: '#666' }}>{esProp ? '—' : fmtFecha(detObj.inicios && detObj.inicios[d.idadmon])}</div>
                            </div>
                            {/* Desglose de pagos del BI (al pinchar Recibido) */}
                            {verPagos && pagosInm.map((pg, i) => (
                              <div key={'p' + i} style={{ display: 'flex', gap: 12, padding: '3px 12px 3px 34px', fontSize: 11, background: '#F0F6FC', alignItems: 'baseline' }}>
                                <span style={{ color: '#8Fb4dd', width: 12 }}>↳</span>
                                <span style={{ color: '#666', width: 80 }}>{fmtFecha(pg.fecha)}</span>
                                <span style={{ color: '#9ca3af', width: 70 }}>Reg {pg.reg}</span>
                                <span style={{ color: '#185FA5', fontWeight: 600 }}>{fmtPesos(pg.arriendo)}</span>
                              </div>
                            ))}
                            {/* Detalle de descuentos/ajustes/comentarios (al pinchar Descuentos) */}
                            {verDescs && notasInm.map((f, i) => (
                              <div key={'d' + i} style={{ display: 'flex', gap: 10, padding: '3px 12px 3px 34px', fontSize: 11, background: '#FBFBF9', alignItems: 'baseline' }}>
                                <span style={{ color: '#c0bdb2', width: 12 }}>↳</span>
                                <span style={{ textAlign: 'right', width: 78, fontWeight: 600, color: f.cantidad == null ? '#ccc' : (f.cantidad < 0 ? '#dc2626' : '#1D9E75') }}>{f.cantidad == null ? '—' : fmtPesos(f.cantidad)}</span>
                                <span style={{ color: '#666' }}>{f.texto}</span>
                              </div>
                            ))}
                            </div>
                          )})}
                          {/* Fila TOTALES */}
                          <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 4, padding: '8px 12px', borderTop: '2px solid #E8E6E0', fontSize: 12, fontWeight: 700, background: '#FAFAF8' }}>
                            <div>TOTALES · {p.n_propiedades} inmuebles</div>
                            <div style={{ textAlign: 'right' }}>{fmtPesos(p.total_base)}</div>
                            <div style={{ textAlign: 'right' }}>{fmtPesos(p.total_recibido)}</div>
                            <div style={{ textAlign: 'right' }}>{fmtPesos(p.total_comision)}</div>
                            <div style={{ textAlign: 'right' }}>{fmtPesos(p.total_iva)}</div>
                            <div style={{ textAlign: 'right' }}>{fmtPesos(p.total_descuentos)}</div>
                            <div style={{ textAlign: 'right' }}>{fmtPesos(p.total_transferir)}</div>
                            <div></div>
                            <div></div>
                          </div>
                        </div>
                      )}

                      {/* A transferir destacado */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, padding: '8px 12px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 8 }}>
                        <span style={{ fontSize: 12, color: '#065F46' }}>A transferir a {p.propietario}</span>
                        <span style={{ fontSize: 16, fontWeight: 700, color: '#065F46' }}>{fmtPesos(p.total_transferir)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 10 }}>
          Los datos provienen de sus tablas de origen. Para modificar un valor, hay que cambiarlo en su origen (datos_arriendos, descuentos), no aquí.
        </div>

      </div>
    </>
  )
}