// VERSION: v12 · 2026-07-19 · Dropdown del filtro acotado a la altura de pantalla: la lista de casillas
//   hace scroll y los botones Limpiar/Ver todos quedan siempre fijos abajo (sin bajar el zoom).
// VERSION: v11 · 2026-07-19 · Tooltip al hover: cada celda muestra su texto completo en la burbuja del
//   navegador (title en el <td>), para leer lo que se corta (UNIQUE CONCEPT, COMENTARIOS, DISCRIMINADOR…).
// VERSION: v10 · 2026-07-19 · Fix amarillo UNIQUE CONCEPT: un texto libre identificado (ej. "PO64-
//   PAVEZ, JUANA") quita el aviso amarillo "falta teclear IDADMON", igual que un IDADMON válido.
//   Vacío o IDADMON a medio teclear siguen en amarillo. (Complementa v9.)
// VERSION: v9 · 2026-07-19 · ➕RUT flexible: acepta IDADMON (Axxxxx) para todos los asociadores, y
//   además TEXTO LIBRE (ingreso de propietario, etc., sin límite) solo para Dirección/Karina. El texto
//   libre rellena UNIQUE CONCEPT y se asocia en bi_admon para reconocer ingresos futuros del mismo RUT.
// VERSION: v8 · 2026-07-19 · PARTE 2 colores manuales: columna bi.color_manual. Dirección/Karina pintan
//   la fila con un punto a la derecha de UNIQUE CONCEPT (Negocio SA naranja fuerte / A corregir amarillo /
//   Sin color / Automático). colorFila da prioridad al manual (naranja SA manda). El filtro de UNIQUE
//   CONCEPT pasa a filtrar por COLOR real (Abono / A corregir / Cargo / Negocio SA). Solo filtra/pinta.
// VERSION: v7 · 2026-07-18 · PARTE 1 filtros LOG: sustituye el filtro propio por el mecanismo del LOG
//   (ordenar A→Z/Z→A + casillas estilo Excel + buscador + "Seleccionar todo") en cada cabecera.
//   Se mantienen los chips de categoría en UNIQUE CONCEPT. Filtra en cliente sobre las 6.7k. Solo filtra/ordena.
// VERSION: v6 · 2026-07-15 · ASOCIA_EMAILS con los 4 emails reales (Anthony, Neika, Fabiola, Adalis).
//   Sin cambios de lógica respecto a v5; corrige la lista que se había quedado con placeholders.
// VERSION: v5 · 2026-07-15 · PARTE 2 (filtros): sustituye el filtro "contiene" por filtro tipo Excel
//   (casillas de valores + buscador + "solo" / "mostrar todos") en cada cabecera, filtrando en cliente
//   sobre las 6.7k ya cargadas. En UNIQUE CONCEPT, además, chips de categoría de color (Todos /
//   Identificados / Sin identificar / Cargos), combinables con las casillas. Los filtros SOLO filtran.
// VERSION: v4 · 2026-07-15 · PARTE 1 (cimiento de filtros): carga TODAS las filas de `bi` (paginado
//   por rangos), muestra por defecto solo las recientes con "Ver todo" (no vuelca 6.7k inputs de golpe),
//   y DESACTIVA el autorelleno de LIQ. MES2 (abrir la vista ya NO escribe nada). Solo lectura de datos.
// VERSION: v3 · 2026-07-15 · Segundo nivel de permiso: Anthony/Neika/Adalis/Fabiola pueden IDENTIFICAR
//   abonos (asociar RUT→IDADMON) por el drawer "➕ RUT" en modo manual (sin sugerencias). El rellenado
//   del movimiento lo hace el endpoint asociar-rut (server-side), así no dependen de escritura en `bi`.
//   Edición libre del resto del BI sigue siendo solo Dirección/Karina. Resto igual que v2.
// VERSION: v2 · 2026-07-09 · gate de escritura (solo Dirección y Karina) + columna LIQ. MES2 editable con validación AAMM
'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import TopNav from '@/app/components/ui/TopNav'

// ── Permisos de ESCRITURA del BI ──────────────────────────────────────────
// Ver la tabla bi lo puede hacer cualquiera con acceso al proceso (proceso_permisos).
// EDITAR (celdas, asociar RUT, copiar a CUENTAS, reasignar LIQ. MES2) queda
// reservado a Dirección y Karina, la MISMA lista que preparar-mes y EMAILS.
// El match es case-insensitive y sin espacios (evita el caso de correos con
// variantes que ya rompió permisos antes). Nota: este gate es de INTERFAZ;
// el blindaje server-side de los endpoints (cartola, asociar-rut, copiar-cuentas)
// es una segunda entrega pendiente.
const EDIT_EMAILS = [
  'alberto.cabezas@fondocapital.com',
  'luis.cabezas@fondocapital.com',
  'karina.morales@fondocapital.com',
]
// ── Segundo nivel: SOLO pueden IDENTIFICAR abonos (asociar RUT→IDADMON por el drawer
// "➕ RUT", en modo manual sin sugerencias). NO editan nada más del BI.
// Emails confirmados con crm_users (15-jul-2026). Coincidencia EXACTA, en minúsculas.
const ASOCIA_EMAILS = [
  'anthony.mendoza@fondocapital.com',
  'neika.duque@fondocapital.com',
  'fabiola.guerra@fondocapital.com',
  'adalis@fondocapital.com',
]
// AAMM de 4 dígitos, meses 01–12 (para validar la reasignación de LIQ. MES2).
const esAAMM = (v) => /^\d{2}(0[1-9]|1[0-2])$/.test(String(v ?? '').trim())

const num = (v) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d.-]/g, '')) || 0)
const fmt = (v) => { const n = num(v); return n ? n.toLocaleString('es-CL') : (String(v ?? '').trim() === '0' ? '0' : '') }
const LIMITE = 50
// Con la carga completa, por defecto se PINTAN solo las N más recientes (para no volcar miles de
// inputs de golpe). "Ver todo" pinta las 6.7k. El filtrado (Parte 2) mostrará todas las que casen.
const TOPE_DEFECTO = 300

// Extrae el RUT (dígitos-guión-verificador) del texto del detalle del movimiento.
// "Transferencia de otro banco 16111735-8" -> "16111735-8". Sin RUT -> ''.
function extraerRut(txt) {
  const m = String(txt ?? '').match(/(\d{5,9})-([\dkK])/)
  return m ? `${m[1]}-${m[2].toUpperCase()}` : ''
}

const COLS = [
  { key: 'fecha',                  h: 'Fecha',          ro: true, w: 84,  align: 'left',  filt: true },
  { key: 'detalle_movimiento',     h: 'Detalle mov.',   ro: true, w: 230, align: 'left',  filt: true, wrap: true },
  { key: 'n_doc',                  h: 'N° Doc',         ro: true, w: 86,  align: 'left',  filt: true },
  { key: 'cargos',                 h: 'Cargo',          ro: true, w: 84,  align: 'right', money: true, color: '#9B1C1C', filt: true },
  { key: 'abonos',                 h: 'Abono',          ro: true, w: 84,  align: 'right', money: true, color: '#085041', filt: true },
  { key: 'saldos',                 h: 'Saldo',          ro: true, w: 92,  align: 'right', money: true, filt: true },
  { key: '_check1',                h: 'check1',         ro: true, w: 60,  align: 'right' },
  { key: 'check2_pasar_a_cartola', h: 'check2',         w: 78,  align: 'left',  filt: true },
  { key: 'reg',                    h: 'Reg',            ro: true, w: 62,  align: 'left',  filt: true },
  { key: 'unique_concept',         h: 'UNIQUE CONCEPT', w: 130, align: 'left', filt: true },
  { key: 'comentarios',            h: 'COMENTARIOS',    w: 180, align: 'left', filt: true, wrap: true },
  { key: 'liquidacion_mes2',       h: 'LIQ. MES2',      w: 80,  align: 'left', filt: true },
  { key: 'idadmon2',               h: 'IDADMON',        w: 84,  align: 'left', filt: true },
  { key: 'discriminador',          h: 'DISCRIMINADOR',  w: 110, align: 'left', filt: true },
  { key: '_descuentos',            h: 'Descuento',      ro: true, w: 76, align: 'center' },
  { key: '_asociar',               h: 'bi_admon',       ro: true, w: 74, align: 'center' },
]
const I_REG = COLS.findIndex(c => c.key === 'reg')
const I_UC = COLS.findIndex(c => c.key === 'unique_concept')

// Paleta de colores del BI:
//   Naranja fuerte #F4A73B = negocio SA (manual, MANDA) · Amarillo #FEF7D6 = a corregir (auto+manual)
//   Azul #EAF2FB = abono identificado (auto) · Naranja clarito #FBECEC = cargo (auto)
const COLOR = { naranja_sa: '#F4A73B', amarillo: '#FEF7D6', abono: '#EAF2FB', cargo: '#FBECEC', ninguno: '#fff' }

function colorFila(m) {
  // 1) Color MANUAL guardado — tiene prioridad sobre el automático.
  const cm = String(m.color_manual || '').trim()
  if (cm === 'naranja_sa') return COLOR.naranja_sa   // negocio SA manda sobre todo
  if (cm === 'amarillo') return COLOR.amarillo
  if (cm === 'sin_color') return COLOR.ninguno        // fuerza quitar el automático
  // 2) Automático (cuando no hay marca manual).
  const ab = num(m.abonos), ca = num(m.cargos)
  if (ab > 0) return String(m.idadmon2 || m.unique_concept || '').trim() ? COLOR.abono : COLOR.amarillo
  if (ca > 0) return COLOR.cargo
  return COLOR.ninguno
}
// IDADMON válido: A + 5 dígitos (ej. A00819).
const esIdadmonValido = (uc) => /^A\d{5}$/.test(String(uc ?? '').trim().toUpperCase())
// ¿La celda de UNIQUE CONCEPT está IDENTIFICADA? (quita el amarillo de "falta teclear IDADMON")
//   vacío -> no · empieza por A+dígito -> debe ser Axxxxx completo · texto libre no vacío -> sí.
const estaIdentificado = (uc) => {
  const s = String(uc ?? '').trim()
  if (!s) return false
  if (/^A\d/i.test(s)) return esIdadmonValido(s)   // parece IDADMON: exige formato completo
  return true                                       // texto libre (ingreso de propietario, etc.): identificado
}

// LIQ. MES2 (AAMM) según la fecha de hoy (hora de Chile):
//   día >= 23 -> mes actual + 1   ·   día <= 22 -> mes actual
// Ej.: 23-jun -> 2607 · del 24-jun al 22-jul -> 2607 · 23-jul -> 2608.
function liqMes2Actual(base = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(base)
  const g = (t) => Number(partes.find((p) => p.type === t)?.value)
  let y = g('year'), m = g('month')
  const day = g('day')
  if (day >= 23) { m += 1; if (m > 12) { m = 1; y += 1 } }
  return `${String(y).slice(-2)}${String(m).padStart(2, '0')}`
}
function bgCelda(ci, r) {
  if (ci === I_REG) return '#C19A6B'
  if (ci >= I_UC) return colorFila(r)
  return '#fff'
}

// ── Filtro de cabecera estilo LOG: ordenar A→Z/Z→A + casillas Excel + buscador ──
// Opcional: `chips` renderiza una fila de botones de categoría arriba (para UNIQUE CONCEPT).
function ColFilterExcel({ label, col, sortCol, sortDir, onSort, opciones, value, onApply, align = 'left', chips, catFiltro, onCat }) {
  const [open, setOpen] = useState(false)
  const [buscar, setBuscar] = useState('')
  const [pending, setPending] = useState(null)
  const ref = useRef(null)
  useEffect(() => {
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])
  useEffect(() => { if (open) { setBuscar(''); setPending(new Set(value || [])) } }, [open]) // eslint-disable-line
  const norm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const activo = (value && value.length > 0) || sortCol === col || (chips && catFiltro && catFiltro !== 'todos')
  const visibles = (opciones || []).filter(o => !buscar || norm(o).includes(norm(buscar)))
  const p = pending || new Set()
  const todasVisiblesMarcadas = visibles.length > 0 && visibles.every(o => p.has(o))
  const toggle = o => { const n = new Set(p); n.has(o) ? n.delete(o) : n.add(o); setPending(n) }
  const toggleTodas = () => { const n = new Set(p); todasVisiblesMarcadas ? visibles.forEach(o => n.delete(o)) : visibles.forEach(o => n.add(o)); setPending(n) }
  const aplicar = () => { const arr = [...p]; onApply(col, (arr.length === 0 || arr.length === (opciones || []).length) ? [] : arr); setOpen(false) }
  const limpiar = () => { setPending(new Set()); onApply(col, []); setOpen(false) }
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      <button onClick={() => setOpen(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: activo ? '#1a56db' : '#5F5E5A', letterSpacing: '0.03em' }}>
        {label}
        <span style={{ fontSize: 9, color: activo ? '#1a56db' : '#B4B2A9' }}>
          {value && value.length ? ' ⧩' : sortCol === col && sortDir === 'asc' ? ' ↑' : sortCol === col && sortDir === 'desc' ? ' ↓' : ' ⯬'}
        </span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', [align === 'right' ? 'right' : 'left']: 0, marginTop: 4, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', width: 250, maxHeight: 'calc(100vh - 150px)', display: 'flex', flexDirection: 'column', zIndex: 300, padding: 8, boxSizing: 'border-box' }}>
          {chips && (
            <>
              <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 500, marginBottom: 6, textTransform: 'uppercase' }}>Categoría</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #F3F4F6' }}>
                {chips.map(([k, lab, col]) => (
                  <button key={k} onClick={() => onCat(k)} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, padding: '3px 8px', borderRadius: 12, cursor: 'pointer', border: '1px solid ' + (catFiltro === k ? '#1a56db' : '#E5E7EB'), background: catFiltro === k ? '#1a56db' : '#fff', color: catFiltro === k ? '#fff' : '#374151', fontWeight: catFiltro === k ? 600 : 400 }}>
                    {col && <span style={{ width: 10, height: 10, borderRadius: '50%', border: '1px solid #9A968C', background: col, flexShrink: 0 }} />}
                    {lab}
                  </button>
                ))}
              </div>
            </>
          )}
          <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 500, marginBottom: 6, textTransform: 'uppercase' }}>Ordenar</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {[['asc', 'A → Z'], ['desc', 'Z → A']].map(([dir, lbl]) => (
              <button key={dir} onClick={() => { onSort(col, dir); setOpen(false) }} style={{ flex: 1, padding: '4px 8px', borderRadius: 6, border: '1px solid', fontSize: 11, cursor: 'pointer', background: sortCol === col && sortDir === dir ? '#EFF6FF' : '#F9FAFB', borderColor: sortCol === col && sortDir === dir ? '#BFDBFE' : '#E5E7EB', color: sortCol === col && sortDir === dir ? '#1D4ED8' : '#374151' }}>{lbl}</button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 500, marginBottom: 4, textTransform: 'uppercase' }}>Filtrar</div>
          <div style={{ fontSize: 10.5, color: '#94A3B8', marginBottom: 6 }}>Marca los que quieres ver (vacío = todos).</div>
          <input placeholder={`Buscar ${String(label).toLowerCase()}...`} value={buscar} onChange={e => setBuscar(e.target.value)} style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #E5E7EB', fontSize: 12, boxSizing: 'border-box', marginBottom: 6 }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#374151', borderBottom: '1px solid #F3F4F6' }}>
            <input type="checkbox" checked={todasVisiblesMarcadas} onChange={toggleTodas} style={{ margin: 0 }} />
            (Seleccionar todo){buscar ? ' (lo visible)' : ''}
          </label>
          <div style={{ flex: 1, minHeight: 40, overflowY: 'auto', margin: '2px 0 8px' }}>
            {visibles.length === 0
              ? <div style={{ fontSize: 12, color: '#9CA3AF', padding: '8px 4px' }}>Sin coincidencias</div>
              : visibles.map(o => (
                <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: '#374151' }}>
                  <input type="checkbox" checked={p.has(o)} onChange={() => toggle(o)} style={{ margin: 0, flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={o}>{o}</span>
                </label>
              ))}
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button onClick={limpiar} style={{ flex: 1, padding: 5, borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', fontSize: 12, cursor: 'pointer', color: '#6B7280' }}>Limpiar</button>
            <button onClick={aplicar} style={{ flex: 1, padding: 5, borderRadius: 6, border: 'none', background: '#1a56db', fontSize: 12, cursor: 'pointer', color: '#fff', fontWeight: 500 }}>{[...p].length ? `Aplicar (${[...p].length})` : 'Ver todos'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function BiVista() {
  const { data: session, status } = useSession()
  const router = useRouter()
  // ¿El usuario logueado puede EDITAR el BI? (Dirección y Karina). Normalizado.
  const emailSesion = (session?.user?.email || '').trim().toLowerCase()
  const puedeEditar = EDIT_EMAILS.includes(emailSesion)
  // Puede IDENTIFICAR abonos (asociar RUT): edición total, o el segundo nivel (los 4).
  const puedeAsociar = puedeEditar || ASOCIA_EMAILS.includes(emailSesion)
  const [rows, setRows] = useState([])               // ascendente por id: antiguos arriba, recientes abajo
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [noMore, setNoMore] = useState(false)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [verTodos, setVerTodos] = useState(false)   // false = solo recientes (TOPE_DEFECTO); true = todas
  const [filtros, setFiltros] = useState({})        // { col: [valores marcados] } — filtro Excel del LOG
  const [catFiltro, setCatFiltro] = useState('todos') // chips: todos|identificados|sinid|cargos
  const [sortCol, setSortCol] = useState(null)      // columna de ordenación (key)
  const [sortDir, setSortDir] = useState('asc')     // 'asc' | 'desc'
  const [savingId, setSavingId] = useState(null)
  const [colorOpen, setColorOpen] = useState(null)   // { row, x, y } — selector de color de fila
  const [toast, setToast] = useState(null)
  const [copiando, setCopiando] = useState(false)
  const [descOpen, setDescOpen] = useState(null)   // { row, x, y, modo } popover de descuentos
  const [descRows, setDescRows] = useState([])
  const [descLoading, setDescLoading] = useState(false)
  const [descQuery, setDescQuery] = useState('')   // buscador libre dentro del popover
  // Drawer "Asociar RUT" (busca en cuentas y escribe en bi_admon)
  const [asocOpen, setAsocOpen] = useState(null)   // { row, rut }
  const [asocLoading, setAsocLoading] = useState(false)
  const [asocCands, setAsocCands] = useState([])   // [{ idadmon, veces }]
  const [asocErr, setAsocErr] = useState(null)
  const [asocId, setAsocId] = useState('')         // idadmon escrito a mano
  const [asocGuardando, setAsocGuardando] = useState(false)
  const scrollRef = useRef(null)
  const anclarAbajo = useRef(false)
  const pendingAdjust = useRef(null)

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(null), 1400) }

  useEffect(() => { if (status === 'unauthenticated') router.push('/api/auth/signin') }, [status, router])

  // Con la carga completa, el filtrado es EN CLIENTE. buildQuery solo trae todo.
  const buildQuery = () => supabase.from('bi').select('*')

  // Valor de una celda para el filtro (vacío -> "(vacío)").
  const valorCelda = (r, key) => { const v = r[key]; return (v ?? '') === '' ? '(vacío)' : String(v) }
  // Valores distintos de una columna (sobre TODAS las filas cargadas), ordenados.
  const valoresUnicos = (key) => {
    const s = new Set()
    rows.forEach(r => s.add(valorCelda(r, key)))
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'es'))
  }
  // Categoría de la fila para los chips de color (misma lógica que colorFila / la leyenda).
  const categoriaFila = (r) => {
    const ab = num(r.abonos), ca = num(r.cargos)
    if (ab > 0) return String(r.idadmon2 || r.unique_concept || '').trim() ? 'identificados' : 'sinid'
    if (ca > 0) return 'cargos'
    return 'otros'
  }
  // ¿La columna tiene un filtro de casillas activo? (array con valores)
  const colFiltrada = (key) => { const a = filtros[key]; return Array.isArray(a) && a.length > 0 }
  const hayFiltroActivo = catFiltro !== 'todos' || COLS.some(c => colFiltrada(c.key)) || !!sortCol
  const onSort = (col, dir) => { setSortCol(col); setSortDir(dir) }
  const onApply = (col, arr) => setFiltros(prev => {
    const n = { ...prev }
    if (!arr || arr.length === 0) delete n[col]; else n[col] = arr
    return n
  })

  const fetchInitial = async (fActuales = filtros) => {
    setRefreshing(true); setError(null); setNoMore(true)
    // Carga completa: Supabase devuelve máx. 1000 por consulta, así que paginamos por rangos
    // hasta traerlas todas. Ascendente por id => antiguas arriba, recientes abajo.
    const PAGE = 1000
    let desde = 0
    let todo = []
    let errFinal = null
    for (;;) {
      const { data, error } = await buildQuery()
        .order('id', { ascending: true })
        .range(desde, desde + PAGE - 1)
      if (error) { errFinal = error; break }
      todo = todo.concat(data || [])
      if (!data || data.length < PAGE) break
      desde += PAGE
    }
    if (errFinal) { setError(errFinal.message); setRefreshing(false); setLoading(false); return }
    anclarAbajo.current = true
    setRows(todo)
    setRefreshing(false); setLoading(false)
  }
  useEffect(() => { fetchInitial({}) }, [])

  // ── Autorelleno de LIQ. MES2: DESACTIVADO (Parte 1, opción A) ──────────────
  // Antes, al abrir la vista se escribía el mes en curso a las filas sin valor. Con la carga
  // completa eso dispararía miles de escrituras al abrir. Como esta vista pasa a ser de solo
  // lectura para el filtrado, NO se autorellena nada. (La reasignación manual de LIQ. MES2 por
  // Dirección/Karina en su celda sigue funcionando igual.)
  const liqDoneRef = useRef(new Set())   // conservado por compatibilidad; ya no se usa para escribir

  // Guarda primero lo que se esté editando (celda con foco) y LUEGO refresca.
  // Sin esto, si el usuario escribe en una celda y pulsa el botón sin salir
  // de ella, el onBlur no llega a dispararse y la recarga borra lo escrito.
  const guardarYRefrescar = async () => {
    const ae = document.activeElement
    if (ae && ae.tagName === 'INPUT') {
      ae.blur()                                   // dispara el onBlur -> guardarCelda
      await new Promise(res => setTimeout(res, 350)) // esperar a que guarde en Supabase
    }
    fetchInitial()
  }

  const loadMore = async () => {
    if (loadingMore || noMore || loading || rows.length === 0) return
    setLoadingMore(true)
    const minId = rows[0].id
    const el = scrollRef.current
    const prevH = el ? el.scrollHeight : 0
    const prevT = el ? el.scrollTop : 0
    const { data, error } = await buildQuery(filtros).lt('id', minId).order('id', { ascending: false }).limit(LIMITE)
    if (error) { setError(error.message); setLoadingMore(false); return }
    const nuevos = (data || []).reverse()
    if (nuevos.length > 0) {
      pendingAdjust.current = { prevH, prevT }
      setRows(rs => [...nuevos, ...rs])
    }
    if ((data || []).length < LIMITE) setNoMore(true)
    setLoadingMore(false)
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

  // check1 (saltos/duplicados) sobre la secuencia COMPLETA, siempre — así es correcto.
  const conCheck = useMemo(() => {
    return rows.map((r, i) => {
      if (i === 0) return { ...r, _check1: null }
      const prev = rows[i - 1]
      const c1 = Math.round(num(prev.saldos) - num(r.cargos) + num(r.abonos) - num(r.saldos))
      return { ...r, _check1: c1 }
    })
  }, [rows])

  // Aplica los filtros: categoría (chips) + casillas por columna (arrays) + ordenación.
  // Si hay filtro/orden activo, se oculta check1 (deja de tener sentido sobre un subconjunto/reordenado).
  const filas = useMemo(() => {
    let out = conCheck
    if (catFiltro !== 'todos') out = out.filter(r => colorFila(r) === catFiltro)
    const activos = Object.entries(filtros).filter(([, a]) => Array.isArray(a) && a.length > 0)
    if (activos.length) out = out.filter(r => activos.every(([k, a]) => a.includes(valorCelda(r, k))))
    if (sortCol) {
      const dir = sortDir === 'asc' ? 1 : -1
      out = [...out].sort((x, y) => valorCelda(x, sortCol).localeCompare(valorCelda(y, sortCol), 'es', { numeric: true }) * dir)
    }
    if (hayFiltroActivo) out = out.map(r => ({ ...r, _check1: null }))
    return out
  }, [conCheck, catFiltro, filtros, sortCol, sortDir, hayFiltroActivo])

  // Qué filas se PINTAN. check1 se calcula sobre TODA la secuencia (arriba), pero por defecto
  // solo mostramos las recientes para no volcar miles de inputs. "Ver todo" las pinta todas.
  // (En la Parte 2, con filtro activo se mostrarán todas las que casen.)
  const visibles = useMemo(() => {
    return (verTodos || hayFiltroActivo) ? filas : filas.slice(-TOPE_DEFECTO)
  }, [filas, verTodos, hayFiltroActivo])

  const onLocal = (id, k, v) => setRows(rs => rs.map(r => r.id === id ? { ...r, [k]: v } : r))
  const guardarCelda = async (id, k, valor) => {
    if (!puedeEditar) { flash('Solo Dirección y Karina pueden editar el BI'); return }
    const v = valor === '' ? null : valor
    setSavingId(id)
    const { error } = await supabase.from('bi').update({ [k]: v }).eq('id', id)
    setSavingId(null)
    if (error) { setError('No se pudo guardar: ' + error.message); return }
    setRows(rs => rs.map(r => r.id === id ? { ...r, [k]: v } : r))
    flash('✓ Guardado')
  }

  // ── Selector de color manual de la fila (solo Dirección/Karina) ──────────
  const abrirColor = (r, e) => {
    e.stopPropagation()
    const rc = e.currentTarget.getBoundingClientRect()
    setColorOpen(colorOpen && colorOpen.row.id === r.id ? null : { row: r, x: rc.left, y: rc.bottom + 2 })
  }
  // val: 'naranja_sa' | 'amarillo' | 'sin_color' | 'auto' (auto = null, vuelve al automático)
  const aplicarColor = async (id, val) => {
    setColorOpen(null)
    await guardarCelda(id, 'color_manual', val === 'auto' ? '' : val)
  }

  // ── Asociar RUT a IDADMON en bi_admon (origen: cuentas) ──────────────────
  const abrirAsociar = async (r) => {
    if (!puedeAsociar) { flash('No tienes permiso para asociar RUT en el BI'); return }
    const rut = extraerRut(r.detalle_movimiento)
    if (!rut) { flash('No se encontró un RUT en el detalle'); return }
    // Los del segundo nivel (no editores totales) van en modo MANUAL: sin sugerencias de IDADMON.
    const soloManual = !puedeEditar
    setAsocOpen({ row: r, rut, soloManual }); setAsocCands([]); setAsocErr(null); setAsocId('')
    if (soloManual) { setAsocLoading(false); return }   // no se buscan candidatos
    setAsocLoading(true)
    try {
      const res = await fetch('/api/bi/asociar-rut?rut=' + encodeURIComponent(rut))
      const d = await res.json()
      if (!res.ok) { setAsocErr(d.error || 'Error al buscar'); setAsocLoading(false); return }
      setAsocCands(d.candidatos || [])
    } catch { setAsocErr('Error de conexión') }
    setAsocLoading(false)
  }

  const asociarRut = async (entrada) => {
    const raw = String(entrada || '').trim()
    if (!raw) { setAsocErr('Escribe un IDADMON o un texto de identificación'); return }
    let valor
    if (/^a\d/i.test(raw)) {
      // Parece IDADMON -> exigir formato Axxxxx (6 caracteres).
      const id = raw.toUpperCase()
      if (!/^A\d{5}$/.test(id)) { setAsocErr('IDADMON no válido (debe ser Axxxxx, ej. A00819)'); return }
      valor = id
    } else {
      // Texto libre (ingreso de propietario, etc.) -> SOLO Dirección/Karina, sin límite de caracteres.
      if (!puedeEditar) { setAsocErr('Solo puedes asociar un IDADMON (Axxxxx). El texto libre está reservado a Dirección/Karina.'); return }
      valor = raw
    }
    const { row, rut } = asocOpen
    setAsocGuardando(true); setAsocErr(null)
    try {
      // Pasamos biId: el endpoint asocia en bi_admon Y rellena este movimiento (server-side).
      const res = await fetch('/api/bi/asociar-rut', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rut, idadmon: valor, biId: row.id }),
      })
      const d = await res.json()
      if (!res.ok) { setAsocErr(d.error || 'Error al asociar'); setAsocGuardando(false); return }
      if (d.rellenado === false && d.errorRelleno) {
        setAsocErr('Se asoció el RUT pero no se pudo rellenar el movimiento: ' + d.errorRelleno)
        setAsocGuardando(false); return
      }
      // Reflejar en la vista el valor que el endpoint ya escribió en unique_concept.
      setRows(rs => rs.map(r => r.id === row.id ? { ...r, unique_concept: valor } : r))
      flash(d.yaExistia ? `Ya estaba asociado (${rut} → ${valor})` : `✓ Asociado ${rut} → ${valor}`)
      setAsocGuardando(false); setAsocOpen(null)
    } catch { setAsocErr('Error de conexión'); setAsocGuardando(false) }
  }

  const copiarFaltan = async () => {
    if (!puedeEditar) { flash('Solo Dirección y Karina pueden editar el BI'); return }
    if (copiando) return
    if (!confirm('¿Copiar a CUENTAS todos los movimientos en FALTA con IDADMON válido?')) return
    setCopiando(true); setError(null)
    try {
      const r = await fetch('/api/bi/copiar-cuentas', { method: 'POST' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Error en el servidor')
      if (d.invalidos?.length) {
        const regs = d.invalidos.map(x => x.reg).filter(Boolean).join(', ')
        setError(
          `ERROR: se ha colocado "FALTA" a ${d.invalidos.length} movimiento(s) NO asociado(s) a un IDADMON válido (Axxxxx). ` +
          `NO se han pasado a CARTOLAS y siguen en FALTA. Corrígelos en BI` + (regs ? ` (Reg: ${regs}).` : '.')
        )
      }
      flash(`✓ ${d.copiados} copiado(s) a CUENTAS`)
      fetchInitial()
    } catch (err) {
      setError('No se pudo copiar: ' + err.message)
    } finally { setCopiando(false) }
  }

  // Parte B: localizar el descuento que justifica un movimiento y pegar su
  // texto_para_contabilidad en UNIQUE CONCEPT. Dos modos:
  //  - abono con IDADMON  -> descuentos de ese IDADMON
  //  - egreso (cargo)     -> descuentos con monto_a_transferir = cargo (candidatos por importe)
  // Lectura server-side (service role) para no depender del RLS de descuentos.
  const buscarDescuentos = async ({ monto, q }) => {
    setDescLoading(true)
    try {
      const p = new URLSearchParams()
      if (monto != null) p.set('monto', String(monto))
      if (q) p.set('q', q)
      const res = await fetch(`/api/descuentos/buscar?${p.toString()}`)
      const d = await res.json()
      setDescRows(d.rows || [])
    } catch { setDescRows([]) }
    finally { setDescLoading(false) }
  }

  const abrirDescuentos = async (r, e) => {
    const rc = e.currentTarget.getBoundingClientRect()
    if (descOpen && descOpen.row?.id === r.id) { setDescOpen(null); return }
    const idadmon = String(r.idadmon2 || '').trim().toUpperCase()
    const cargo = num(r.cargos)
    const modo = cargo > 0 ? 'importe' : 'idadmon'
    setDescOpen({ row: r, x: rc.left, y: rc.bottom + 2, modo })
    setDescRows([]); setDescQuery('')
    if (modo === 'importe') await buscarDescuentos({ monto: Math.round(cargo) })
    else if (idadmon) {
      setDescLoading(true)
      try {
        const res = await fetch(`/api/descuentos/por-idadmon?idadmon=${encodeURIComponent(idadmon)}`)
        const d = await res.json()
        setDescRows(d.rows || [])
      } catch { setDescRows([]) }
      finally { setDescLoading(false) }
    }
  }

  // Pega el texto_para_contabilidad del descuento elegido en UNIQUE CONCEPT de la fila.
  const usarEnUniqueConcept = async (d) => {
    if (!descOpen?.row) return
    const txt = String(d.texto_para_contabilidad || '').trim()
    if (!txt) return
    const actual = String(descOpen.row.unique_concept || '').trim()
    // si ya hay un texto de contabilidad (empieza por "num Axxxxx"), pedir confirmación
    const yaTieneTexto = /^\d+\s+A\d{5}\b/.test(actual)
    if (yaTieneTexto && !confirm(`UNIQUE CONCEPT ya tiene:\n\n${actual}\n\n¿Reemplazar por?\n\n${txt}`)) return
    await guardarCelda(descOpen.row.id, 'unique_concept', txt)
    setDescOpen(null)
  }

  const copiarTexto = async (t) => {
    const txt = String(t ?? '')
    if (!txt) return
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(txt)
      } else {
        const ta = document.createElement('textarea')
        ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0'
        document.body.appendChild(ta); ta.select()
        document.execCommand('copy'); document.body.removeChild(ta)
      }
      flash('✓ Texto copiado')
    } catch { /* si falla, no rompemos nada */ }
  }

  if (status === 'loading' || loading)
    return (<><TopNav /><div style={{ padding: 60, textAlign: 'center', color: '#888', fontSize: 14 }}>Cargando movimientos…</div></>)

  const abonos = rows.filter(r => num(r.abonos) > 0).length
  const cargos = rows.filter(r => num(r.cargos) > 0).length
  const sinId = rows.filter(r => num(r.abonos) > 0 && !String(r.idadmon2 || r.unique_concept || '').trim()).length
  const errChk = conCheck.filter(r => r._check1 != null && r._check1 !== 0).length

  const cell = (r, c) => {
    if (c.key === '_check1') return r._check1 == null
      ? <span style={{ color: '#B4B2A9' }}>—</span>
      : <span style={{ fontWeight: 600, color: r._check1 === 0 ? '#1D9E75' : '#9B1C1C' }}>{r._check1}</span>
    if (c.key === '_descuentos') {
      const tieneId = String(r.idadmon2 || '').trim() !== ''
      const esEgreso = num(r.cargos) > 0
      if (!tieneId && !esEgreso) return <span style={{ color: '#B4B2A9' }}>—</span>
      if (!puedeEditar) return <span style={{ color: '#B4B2A9' }}>—</span>
      const abierto = descOpen && descOpen.row?.id === r.id
      return (
        <button onClick={(e) => abrirDescuentos(r, e)}
          title={esEgreso
            ? 'Buscar el descuento que justifica este egreso (por importe) y pegar su texto en UNIQUE CONCEPT'
            : 'Ver el/los texto(s) para contabilidad del descuento de este IDADMON'}
          style={{ border: '0.5px solid #C8C5BC', background: abierto ? '#E6F1FB' : '#fff', borderRadius: 6, cursor: 'pointer', fontSize: 11, padding: '2px 7px' }}>📋</button>
      )
    }
    if (c.key === '_asociar') {
      const esAbono = num(r.abonos) > 0
      const rut = extraerRut(r.detalle_movimiento)
      if (!esAbono || !rut) return <span style={{ color: '#B4B2A9' }}>—</span>
      if (!puedeAsociar) return <span style={{ color: '#B4B2A9' }}>—</span>
      const resuelto = String(r.idadmon2 || r.unique_concept || '').trim() !== ''
      const abierto = asocOpen && asocOpen.row?.id === r.id
      return (
        <button onClick={() => abrirAsociar(r)}
          title={`Asociar el RUT ${rut} a un IDADMON en bi_admon (busca en CUENTAS a qué contrato pagó antes)`}
          style={{ border: '0.5px solid ' + (resuelto ? '#C8C5BC' : '#9BD7C2'), background: abierto ? '#E1F5EE' : (resuelto ? '#fff' : '#F0FAF6'), color: resuelto ? '#8A8780' : '#085041', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700, padding: '2px 7px' }}>➕ RUT</button>
      )
    }
    // LIQ. MES2: mes de liquidación al que se imputa el pago. Editable SOLO por
    // Dirección/Karina (reasignar excepciones del corte del día 23). Valida AAMM.
    // Si la celda está vacía, muestra en gris el valor que le tocaría por la regla
    // del día (liqMes2Actual), sin escribirlo aquí (de eso se ocupa el autollenado).
    if (c.key === 'liquidacion_mes2') {
      const actual = String(r.liquidacion_mes2 ?? '').trim()
      if (!puedeEditar) {
        const v = actual || liqMes2Actual()
        return <span title={v} style={{ color: '#5F5E5A' }}>{v}</span>
      }
      const vacio = actual === ''
      return (
        <input value={actual} title={vacio ? `Sin asignar (por regla: ${liqMes2Actual()})` : actual}
          placeholder={liqMes2Actual()} inputMode="numeric" maxLength={4}
          onChange={e => onLocal(r.id, c.key, e.target.value.replace(/[^\d]/g, '').slice(0, 4))}
          onFocus={e => { e.target.dataset.orig = actual; e.target.style.border = '1px solid #1D9E75'; e.target.style.background = '#fff' }}
          onBlur={e => {
            const orig = e.target.dataset.orig ?? ''
            const val = (e.target.value ?? '').trim()
            e.target.style.border = '1px solid transparent'
            e.target.style.background = 'transparent'
            if (val === orig) return                                  // sin cambios
            if (val !== '' && !esAAMM(val)) {                          // formato inválido -> revertir
              onLocal(r.id, c.key, orig)
              flash('LIQ. MES2 debe ser AAMM (p. ej. 2607)')
              return
            }
            guardarCelda(r.id, c.key, val)                            // válido o vaciado
          }}
          style={{ width: '100%', border: '1px solid transparent', borderRadius: 4, padding: '2px 4px', fontSize: 11, background: 'transparent', textAlign: c.align, color: vacio ? '#B4B2A9' : '#2C2C2A', boxSizing: 'border-box' }} />
      )
    }
    if (!c.ro) {
      // Columnas editables (unique_concept, idadmon2, discriminador, check2):
      // en modo lectura (observador) se muestran como texto, sin input.
      if (!puedeEditar) {
        const s = String(r[c.key] ?? '').trim()
        return <span title={s}>{s || '—'}</span>
      }
      const esUC = c.key === 'unique_concept'
      const baseAm = esUC && num(r.abonos) > 0 && ['FALTA', 'REVISAR'].includes(String(r.check2_pasar_a_cartola ?? '').trim().toUpperCase())
      const amarillo = baseAm && !estaIdentificado(r[c.key])
      const inputUC = (
        <input value={r[c.key] ?? ''} title={amarillo ? 'Falta teclear el IDADMON (A+5 dígitos)' : (r[c.key] ?? '')}
          placeholder={amarillo ? 'IDADMON…' : ''}
          onChange={e => onLocal(r.id, c.key, e.target.value)}
          onFocus={e => { e.target.dataset.orig = (r[c.key] ?? ''); e.target.style.border = '1px solid #1D9E75'; e.target.style.background = '#fff' }}
          onBlur={e => {
            const orig = e.target.dataset.orig ?? ''
            const actual = e.target.value ?? ''
            const sigueAm = baseAm && !estaIdentificado(actual)
            e.target.style.border = '1px solid transparent'
            e.target.style.background = sigueAm ? '#FFE84D' : 'transparent'
            if (orig !== actual) guardarCelda(r.id, c.key, actual)
          }}
          style={{ width: '100%', border: '1px solid transparent', borderRadius: 4, padding: '2px 4px', fontSize: 11, fontWeight: amarillo ? 700 : 400, background: amarillo ? '#FFE84D' : 'transparent', textAlign: c.align, color: '#2C2C2A', boxSizing: 'border-box' }} />
      )
      if (!esUC) return inputUC
      // En UNIQUE CONCEPT: input + punto de color a la derecha (compacto) para pintar la fila.
      const cm = String(r.color_manual || '').trim()
      const dot = cm === 'naranja_sa' ? COLOR.naranja_sa : cm === 'amarillo' ? COLOR.amarillo : cm === 'sin_color' ? '#fff' : null
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <div style={{ flex: 1, minWidth: 0 }}>{inputUC}</div>
          <button onClick={(e) => abrirColor(r, e)} title="Color de la fila (Dirección/Karina)"
            style={{ flexShrink: 0, width: 13, height: 13, borderRadius: '50%', cursor: 'pointer', padding: 0,
              border: '1px solid #9A968C', background: dot || 'repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 50% / 6px 6px' }} />
        </div>
      )
    }
    if (c.money) { const s = fmt(r[c.key]); return <span title={s || ''} style={{ color: s && c.color ? c.color : '#2C2C2A' }}>{s || '—'}</span> }
    return <span title={r[c.key] ?? ''}>{r[c.key] ?? '—'}</span>
  }

  // Los filtros de cabecera los dibuja el componente <ColFilterExcel> (patrón del LOG),
  // definido fuera de este componente. Aquí solo se pasan onSort / onApply y el estado.
  const CHIPS_CAT = [['todos', 'Todos', null], [COLOR.abono, 'Abono', COLOR.abono], [COLOR.amarillo, 'A corregir', COLOR.amarillo], [COLOR.cargo, 'Cargo', COLOR.cargo], [COLOR.naranja_sa, 'Negocio SA', COLOR.naranja_sa]]


  // ---- popover de descuentos (texto para contabilidad, con copiar) ----
  // Popover del selector de color de fila
  const renderColorPicker = () => {
    if (!colorOpen) return null
    const { row, x, y } = colorOpen
    const W = 168
    const left = Math.min(x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - W - 12)
    const opciones = [
      ['naranja_sa', 'Negocio SA', COLOR.naranja_sa],
      ['amarillo', 'A corregir', COLOR.amarillo],
      ['sin_color', 'Sin color', '#fff'],
      ['auto', 'Automático', null],
    ]
    const actual = String(row.color_manual || '').trim() || 'auto'
    return (
      <>
        <div onClick={() => setColorOpen(null)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
        <div style={{ position: 'fixed', left, top: y, width: W, background: '#fff', border: '0.5px solid #B4B2A9', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,.15)', zIndex: 41, fontSize: 12, padding: 6 }}>
          <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', padding: '2px 4px 6px' }}>Color de la fila</div>
          {opciones.map(([val, lab, col]) => (
            <button key={val} onClick={() => aplicarColor(row.id, val)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
                border: actual === val ? '1px solid #1a56db' : '1px solid transparent', background: actual === val ? '#EFF6FF' : 'transparent', color: '#374151', marginBottom: 2 }}>
              <span style={{ width: 14, height: 14, borderRadius: '50%', flexShrink: 0, border: '1px solid #9A968C',
                background: col === null ? 'repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 50% / 6px 6px' : col }} />
              {lab}
            </button>
          ))}
        </div>
      </>
    )
  }

  const renderPopDescuentos = () => {
    if (!descOpen) return null
    const W = 460
    const left = Math.min(descOpen.x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - W - 12)
    const r = descOpen.row
    const cargo = num(r?.cargos)
    const esImporte = descOpen.modo === 'importe'
    const unico = !descLoading && descRows.length === 1   // precarga: único candidato
    return (
      <>
        <div onClick={() => setDescOpen(null)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
        <div style={{ position: 'fixed', left, top: descOpen.y, width: W, maxHeight: 420, overflow: 'auto', background: '#fff', border: '0.5px solid #B4B2A9', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,.15)', zIndex: 41, fontSize: 12 }}>
          <div style={{ padding: '8px 10px', borderBottom: '0.5px solid #EDEBE4', fontWeight: 600, color: '#5F5E5A', position: 'sticky', top: 0, background: '#fff' }}>
            {esImporte
              ? <>Egreso de <b>{fmt(cargo)}</b> · descuentos con transferir = {fmt(cargo)}</>
              : <>Descuentos de {String(r?.idadmon2 || '').trim().toUpperCase()}</>}
          </div>

          {/* buscador para navegar (por IDADMON, N° o texto) */}
          <div style={{ padding: '8px 10px', borderBottom: '0.5px solid #F0EEE8', display: 'flex', gap: 6 }}>
            <input value={descQuery} onChange={e => setDescQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && descQuery.trim()) buscarDescuentos({ q: descQuery.trim() }) }}
              placeholder="Buscar por IDADMON, N° o texto…"
              style={{ flex: 1, border: '1px solid #C8C5BC', borderRadius: 6, padding: '4px 8px', fontSize: 12 }} />
            <button onClick={() => descQuery.trim() && buscarDescuentos({ q: descQuery.trim() })}
              style={{ border: 'none', background: '#5F6B7A', color: '#fff', borderRadius: 6, cursor: 'pointer', fontSize: 11, padding: '4px 10px' }}>Buscar</button>
            {esImporte && (
              <button onClick={() => { setDescQuery(''); buscarDescuentos({ monto: Math.round(cargo) }) }}
                title="Volver a los candidatos por importe"
                style={{ border: '0.5px solid #C8C5BC', background: '#fff', color: '#5F5E5A', borderRadius: 6, cursor: 'pointer', fontSize: 11, padding: '4px 8px' }}>↺ importe</button>
            )}
          </div>

          {descLoading
            ? <div style={{ padding: 12, color: '#888780' }}>Cargando…</div>
            : descRows.length === 0
              ? <div style={{ padding: 12, color: '#888780' }}>
                  {esImporte ? 'Ningún descuento con ese importe. Usa el buscador para localizarlo.' : 'Sin resultados.'}
                </div>
              : descRows.map((d, i) => (
                <div key={i} style={{ padding: '8px 10px', borderBottom: '0.5px solid #F0EEE8', display: 'flex', gap: 8, alignItems: 'flex-start', background: unico ? '#F3FAF6' : '#fff' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: '#888780', marginBottom: 2 }}>
                      N° {d.num || '—'} · {d.idadmon || ''} · {d.tipo || ''} · transferir {fmt(d.monto_a_transferir)}{unico ? ' · (único candidato)' : ''}
                    </div>
                    <div style={{ color: '#2C2C2A', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                      {d.texto_para_contabilidad || <span style={{ color: '#B4B2A9' }}>(sin texto de contabilidad)</span>}
                    </div>
                  </div>
                  {d.texto_para_contabilidad && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                      <button onClick={() => usarEnUniqueConcept(d)} title="Pegar este texto en UNIQUE CONCEPT de la fila"
                        style={{ border: 'none', background: '#1D9E75', color: '#fff', borderRadius: 6, cursor: 'pointer', fontSize: 11, padding: '4px 8px', whiteSpace: 'nowrap' }}>Usar este</button>
                      <button onClick={() => copiarTexto(d.texto_para_contabilidad)} title="Solo copiar al portapapeles"
                        style={{ border: 'none', background: '#E6F1FB', color: '#0C447C', borderRadius: 6, cursor: 'pointer', fontSize: 11, padding: '4px 8px' }}>📋</button>
                    </div>
                  )}
                </div>
              ))
          }
        </div>
      </>
    )
  }

  return (
    <>
      <TopNav />
      <div style={{ maxWidth: 1640, margin: '0 auto', padding: '18px 20px 30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 10, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 2px', color: '#2C2C2A' }}>BI · Movimientos (tabla bi)</h1>
            <div style={{ fontSize: 12, color: '#888780' }}>recientes abajo · carga completa{hayFiltroActivo ? ' · filtrado (check1 oculto)' : ''}{puedeEditar ? ' · edita desde UNIQUE CONCEPT · los cambios se guardan solos al salir de la celda (✓ Guardado)' : ' · modo solo lectura'}</div>
          </div>
          <button onClick={() => router.push('/procesos/bi')}
            style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, border: '0.5px solid #D3D1C7', background: '#fff', cursor: 'pointer', color: '#2C2C2A', whiteSpace: 'nowrap' }}>← Cargar cartola</button>
        </div>

        {!puedeEditar && (
          <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: '#FBF7EC', border: '0.5px solid #E6D58A', color: '#8a6d1e', fontSize: 12 }}>
            Modo solo lectura — la edición del BI (asociar RUT, IDADMON, mes de liquidación, copiar a CUENTAS) está reservada a Dirección y Karina.
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 10, fontSize: 11, color: '#5F5E5A', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><i style={{ width: 12, height: 12, background: '#EAF2FB', border: '0.5px solid #B9D4EE', borderRadius: 2 }} /> Abono ({abonos})</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><i style={{ width: 12, height: 12, background: '#FBECEC', border: '0.5px solid #E9B9B9', borderRadius: 2 }} /> Cargo ({cargos})</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><i style={{ width: 12, height: 12, background: '#FEF7D6', border: '0.5px solid #E6D58A', borderRadius: 2 }} /> Sin identificar ({sinId})</span>
          {!hayFiltroActivo && errChk > 0 && <span style={{ color: '#9B1C1C', fontWeight: 600 }}>⚠ check1 ≠ 0 en {errChk}</span>}
          {savingId && <span style={{ color: '#1D9E75' }}>guardando…</span>}
        </div>

        {error && <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: '#FDECEC', border: '0.5px solid #F1B0B0', color: '#9B1C1C', fontSize: 12 }}>{error}</div>}

        {/* BARRA DE ACCIONES */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12, alignItems: 'center' }}>
          <button onClick={guardarYRefrescar} disabled={refreshing}
            style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: 'none', background: '#1D9E75', color: '#fff', cursor: 'pointer' }}>
            {refreshing ? 'Actualizando…' : '🔄 Refrescar lista'}
          </button>
          <span style={{ width: 1, height: 22, background: '#D3D1C7', margin: '0 4px' }} />
          {[
            ['Verificar si en CUENTAS', 'Verifica qué ingresos ya están en CUENTAS', null],
            ['Copiar FALTAN a CUENTAS', 'Exporta a CUENTAS los marcados FALTA (solo IDADMON válido)', copiarFaltan],
            ['Corregir en CUENTAS', 'Corrige en CUENTAS los marcados CORREGIR', null],
          ].map(([label, hint, accion], i) => {
            const habilitado = !!accion && !copiando && puedeEditar
            return (
              <button key={i} title={hint} disabled={!habilitado}
                onClick={() => { if (accion) accion() }}
                style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: '1px solid ' + (habilitado ? '#6B4423' : '#C8C5BC'), background: habilitado ? '#8A5A2B' : '#D3D1C7', color: '#fff', cursor: habilitado ? 'pointer' : 'default' }}>
                {label}
              </button>
            )
          })}
          <span style={{ width: 1, height: 22, background: '#D3D1C7', margin: '0 4px' }} />
          <button onClick={() => setVerTodos(v => !v)}
            title={verTodos ? 'Mostrar solo las más recientes' : 'Mostrar las 6.7k filas (puede ir más lento)'}
            style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: '1px solid #6B4423', background: verTodos ? '#8A5A2B' : '#fff', color: verTodos ? '#fff' : '#6B4423', cursor: 'pointer' }}>
            {verTodos ? `Ver recientes (${TOPE_DEFECTO})` : `Ver todo (${filas.length})`}
          </button>
        </div>

        <div ref={scrollRef} onScroll={onScroll} style={{ overflow: 'auto', maxHeight: '72vh', border: '0.5px solid #D3D1C7', borderRadius: 8 }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, fontSize: 11, minWidth: 1600 }}>
            <thead>
              <tr style={{ background: '#F1EFE8' }}>
                {COLS.map((c, i) => (
                  <th key={i} style={{ padding: '6px 8px', textAlign: c.align, fontWeight: 600, color: '#5F5E5A', whiteSpace: 'nowrap', minWidth: c.w, position: 'sticky', top: 0, background: '#F1EFE8', zIndex: 3, borderBottom: '0.5px solid #D3D1C7' }}>
                    {c.filt ? (
                      <ColFilterExcel
                        label={c.h} col={c.key} align={c.align === 'right' ? 'right' : 'left'}
                        sortCol={sortCol} sortDir={sortDir} onSort={onSort}
                        opciones={valoresUnicos(c.key)} value={filtros[c.key] || []} onApply={onApply}
                        chips={c.key === 'unique_concept' ? CHIPS_CAT : null}
                        catFiltro={catFiltro} onCat={setCatFiltro}
                      />
                    ) : (
                      <span>{c.h}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!verTodos && filas.length > TOPE_DEFECTO && <tr><td colSpan={COLS.length} style={{ padding: 6, textAlign: 'center', color: '#B4B2A9', fontSize: 10 }}>— mostrando las {TOPE_DEFECTO} más recientes de {filas.length} · «Ver todo» arriba —</td></tr>}
              {(verTodos || filas.length <= TOPE_DEFECTO) && filas.length > 0 && <tr><td colSpan={COLS.length} style={{ padding: 6, textAlign: 'center', color: '#B4B2A9', fontSize: 10 }}>— inicio de la tabla —</td></tr>}
              {visibles.map((r) => (
                <tr key={r.id}>
                  {COLS.map((c, ci) => {
                    // Tooltip (burbuja del navegador) con el texto completo de la celda al hacer hover,
                    // para poder leer lo que se corta. Columnas de botón/check no llevan.
                    const tdTitle = c.key.startsWith('_') ? undefined : (c.money ? (fmt(r[c.key]) || undefined) : (String(r[c.key] ?? '').trim() || undefined))
                    return (
                    <td key={ci} title={tdTitle} style={{ padding: c.ro ? '5px 8px' : '2px 4px', textAlign: c.align, whiteSpace: c.wrap ? 'normal' : 'nowrap', background: bgCelda(ci, r), color: ci === I_REG ? '#1A1A1A' : '#2C2C2A', fontWeight: ci === I_REG ? 600 : 400, borderBottom: '0.5px solid #EDEBE4', maxWidth: c.w + 60, overflow: 'hidden', textOverflow: c.wrap ? 'clip' : 'ellipsis' }}>
                      {cell(r, c)}
                    </td>
                    )
                  })}
                </tr>
              ))}
              {visibles.length === 0 && <tr><td colSpan={COLS.length} style={{ padding: 24, textAlign: 'center', color: '#888780' }}>Sin resultados con esos filtros.</td></tr>}
            </tbody>
          </table>
        </div>

        <div style={{ fontSize: 11, color: '#888780', marginTop: 8 }}>
          {visibles.length} de {filas.length} fila(s){hayFiltroActivo ? ' (filtradas)' : ''} · carga completa · check1 0 (verde) ok; rojo = posible línea saltada/duplicada (solo sin filtros).
        </div>
      </div>
      {/* filtros: ahora en las cabeceras vía ColFilterExcel */}
      {renderPopDescuentos()}
      {renderColorPicker()}
      {asocOpen && (
        <>
          <div onClick={() => !asocGuardando && setAsocOpen(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 70 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(520px, 94vw)', maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.25)', zIndex: 71 }}>
            <div style={{ padding: '14px 18px', borderBottom: '0.5px solid #E4E2DA', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#2C2C2A' }}>Asociar RUT a IDADMON</div>
                <div style={{ fontSize: 12, color: '#5F5E5A' }}>RUT <b>{asocOpen.rut}</b> — se guardará en <code>bi_admon</code> para autocompletar sus abonos futuros.</div>
              </div>
              <button onClick={() => !asocGuardando && setAsocOpen(null)}
                style={{ border: 'none', background: '#F1EFE8', color: '#5F5E5A', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Cerrar</button>
            </div>

            <div style={{ padding: '14px 18px', overflow: 'auto' }}>
              {asocErr && <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: '#FDECEC', border: '0.5px solid #F1B0B0', color: '#9B1C1C', fontSize: 12 }}>{asocErr}</div>}

              {asocOpen.soloManual ? (
                <div style={{ padding: '10px 12px', borderRadius: 8, background: '#F1EFE8', color: '#5F5E5A', fontSize: 12, marginBottom: 4 }}>
                  Escribe el IDADMON del contrato al que pertenece este abono. Al guardar, este RUT
                  quedará asociado y sus abonos futuros se reconocerán solos.
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 12, color: '#5F5E5A', fontWeight: 600, marginBottom: 6 }}>Según pagos anteriores en CUENTAS:</div>
                  {asocLoading && <div style={{ padding: 16, textAlign: 'center', color: '#888780', fontSize: 13 }}>Buscando en el historial…</div>}
                  {!asocLoading && asocCands.length === 0 && (
                    <div style={{ padding: '10px 12px', borderRadius: 8, background: '#FBF7EC', color: '#8a6d1e', fontSize: 12, marginBottom: 12 }}>
                      Este RUT no aparece en CUENTAS con ningún IDADMON. Escríbelo a mano abajo.
                    </div>
                  )}
                  {!asocLoading && asocCands.map((c) => (
                    <button key={c.idadmon} onClick={() => asociarRut(c.idadmon)} disabled={asocGuardando}
                      style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 12px', marginBottom: 6, border: '0.5px solid #9BD7C2', background: '#F0FAF6', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                      <span style={{ fontWeight: 700, color: '#085041' }}>{c.idadmon}</span>
                      <span style={{ fontSize: 11, color: '#5F5E5A' }}>pagó {c.veces} vez(ces) · asociar →</span>
                    </button>
                  ))}
                </>
              )}

              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '0.5px solid #EDEBE4' }}>
                <div style={{ fontSize: 12, color: '#5F5E5A', fontWeight: 600, marginBottom: 6 }}>
                  {asocOpen.soloManual ? 'IDADMON del contrato:' : 'IDADMON o texto de identificación:'}
                </div>
                {!asocOpen.soloManual && (
                  <div style={{ fontSize: 11, color: '#888780', marginBottom: 6 }}>
                    Un IDADMON (ej. A00819) o un texto libre (ej. ingreso de un propietario: "PO64-PAVEZ, JUANA").
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={asocId} onChange={e => setAsocId(e.target.value)}
                    placeholder={asocOpen.soloManual ? 'A00819' : 'A00819  o  texto de identificación'}
                    style={{ flex: 1, fontSize: 13, padding: '7px 10px', border: '0.5px solid #D3D1C7', borderRadius: 8 }} />
                  <button onClick={() => asociarRut(asocId)} disabled={asocGuardando || !asocId.trim()}
                    style={{ fontSize: 13, fontWeight: 700, padding: '7px 16px', borderRadius: 8, border: 'none', background: asocId.trim() ? '#1D9E75' : '#D3D1C7', color: '#fff', cursor: asocId.trim() ? 'pointer' : 'default' }}>
                    {asocGuardando ? 'Asociando…' : 'Asociar'}
                  </button>
                </div>
              </div>
            </div>
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