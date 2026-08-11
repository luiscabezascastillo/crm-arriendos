'use client'
// VERSION: v38 · 2026-08-11 · FASE 2 — EXCLUSIÓN AL PROPIETARIO: cada línea (garantía/servicios/reparaciones) tiene un
//   tick "🚫 Excl. prop." que la marca para NO incluirla en la liquidación del propietario (p.ej. la deuda de arriendo,
//   que no se le abonó). Se guarda en termino_lineas.excluir_propietario. El botón del PDF se desdobla en "🧾 PDF
//   arrendatario" (todo) y "🧾 PDF propietario" (excluye las marcadas y RECALCULA su resultado, sin nota). Requiere el
//   SQL: alter table termino_lineas add column excluir_propietario. Hereda v37.
// VERSION: v37 · 2026-08-11 · "Enviar Presupuesto" disponible también para Adalis y Fabiola (antes solo Karina +
//   Dirección). El PDF del presupuesto muestra precio final (nunca el markup). Se acompaña del rediseño profesional
//   del PDF de presupuesto (lib/pdfPresupuesto v2) y del gate ampliado en generar-presupuesto-pdf. Hereda v36.
// VERSION: v36 · 2026-08-11 · Panel de RECLAMACIÓN mejorado: colores profesionales (slate, no rojo agresivo), sin el
//   hueco vacío de la derecha (tarjeta acotada), campo CCO (copia oculta) además de CC, botón de PRUEBA a tu correo
//   sin enviar a nadie, y DOBLE confirmación antes del envío real. Requiere enviar-reclamacion v2 + cc1Email v5 (bcc).
//   Hereda v35.
// VERSION: v35 · 2026-08-11 · Envío seguro de la liquidación: (1) DOBLE confirmación antes de enviar de verdad
//   (ver → "¿enviar a X?" → confirmar/volver) en ambos correos. (2) Botón de PRUEBA que manda el borrador a la
//   dirección que elijas (por defecto la tuya), para ver ambas visiones sin tocar al destinatario real. (3) Copia
//   al aval en el correo del arrendatario (la añade el endpoint). (4) "Ver PDF del término" y el envío disponibles
//   también para Adalis y Fabiola (Administración). Hereda v34.
// VERSION: v34 · 2026-08-11 · PDF del término: (1) Reparaciones = una sola línea "Arreglos segun presupuesto" (sin el
//   total en negrita ni el bloque duplicado "Otras reparaciones"); se excluye la línea AUTO del bloque para no repetir.
//   (2) La GARANTÍA ya no se lista en "Descuentos aplicados" (está en la cabecera): se filtran los descuentos de familia
//   garantía. Se añade `tipo` a la consulta de descuentos del resumen para poder filtrarlos. Hereda v33.
// VERSION: v33 · 2026-08-11 · Proceso del término: en cada paso HECHO se muestra "✓ quién · fecha" (quién lo completó,
//   de workflow_task_logs.usuario, y la fecha de cierre). Además la tarjeta "Acciones realizadas" ya lista de verdad
//   quién completó cada paso, cuándo y con qué comentario (antes decía "próximamente"). Hereda v32.
// VERSION: v32 · 2026-08-11 · Botón "🧾 Ver PDF del término": genera un PDF PROFESIONAL de la liquidación (datos
//   económicos, servicios, reparaciones + presupuesto con detalle, descuentos aplicados cercanos al cierre y
//   resultado), lo abre en pestaña para revisarlo (marca de agua BORRADOR) y engancha el enlace a los borradores
//   de email para poder enviarlo. Gate: Karina + Dirección (puedeVerMarkup). Endpoint /api/terminos/generar-termino-pdf.
//   Hereda v31.
// VERSION: v31 · 2026-08-11 · Descuentos del término: se OCULTAN los descuentos iniciales (de años atrás). El panel
//   "Descuentos de este término" (y el del inmueble sucesor) muestra SOLO los cercanos al cierre: con F.Cont desde
//   2 meses ANTES de la fecha de entrega en adelante. Los descuentos sin fecha (garantía, estructurales) se mantienen.
//   Es solo de VISTA: lo que cuenta en el resultado son los descuentos "T-…" del término, que no cambia. Hereda v30.
// VERSION: v30 · 2026-08-11 · FIX del "Balance de pagos del arrendatario": ahora usa EL MISMO cálculo que la Cartola por
//   IDADMON → cargoEfectivo = cargo_manual (override) si existe, si no cargo; balance = Σ(cargoEfectivo − abono). Antes sumaba
//   el `cargo` crudo e ignoraba los overrides de `cargo_manual`, por eso daba el total sin descontar los cargos editados
//   (p.ej. A00717: mostraba $480.893 en vez del último saldo de la cartola $39.425). Se lee `cargo_manual` de cuentas y el
//   parser numérico replica el de la cartola. Hereda v29 (recálculo SIEMPRE al abrir + botón 🔄 Recargar).
// VERSION: v29 · 2026-08-11 · FIX "no se actualiza el balance": el "Balance de pagos del arrendatario" (Σcargo−Σabono de
//   `cuentas`) se recalcula SIEMPRE al abrir el panel, aunque ya haya líneas guardadas (antes solo la 1ª vez → se quedaba
//   congelado con el valor guardado y no reflejaba movimientos nuevos). Además, botón "🔄 Recargar" en el panel que vuelve a
//   leer cuentas/descuentos/servicios sin salir de la vista. Hereda v28.
// VERSION: v28 · 2026-08-07 · Panel de Término: refleja TODOS los cargos al propietario derivados del término (idadmon_relacionado=término, repercutir_a=PROPIETARIO): saldo sin saldo, complementos y devolución de garantía. Lista Nº/monto/destino. Hereda v27.
// VERSION: v27 · 2026-08-07 · Panel de Término: refleja si el SALDO SIN SALDO ya se cargó al propietario (descuento
//   origen='termino_sin_saldo' con idadmon_relacionado = este término). Aviso verde "Saldo cargado al propietario ·
//   Nº X" (o gris si se quitó). El cargo se crea/quita desde Cartas. Hereda v26.
// VERSION: v26 · 2026-08-07 · LISTA de Términos: columnas nuevas desde vw_termino_resultado en el orden pedido —
//   Garantía entregada · Quién la tiene · Datos económicos (balance) · Total servicios · Total reparaciones · Resultado.
//   La vista ya exponía garantia/quien/servicios/balance; solo se piden y se pintan (cero cambios en BD). Export y
//   orden actualizados; ancho del contenedor a 1600. Hereda v25.
// VERSION: v25 · 2026-08-07 · Botón "Enviar Presupuesto" ACTIVADO (antes disabled placeholder). Al pulsar: genera el PDF del presupuesto (descargable, se abre en pestaña nueva) y abre los borradores de email con el enlace del PDF añadido, para enviarlo si se quiere. Gate: solo Karina + Dirección (puedeVerMarkup), igual que el endpoint generar-presupuesto-pdf. Hereda v24.
// VERSION: v24 · 2026-08-07 · Fix del desplegable de filtro: los botones "Más antiguas / Más recientes primero" se apilan bien. El `white-space: nowrap` de la cabecera se heredaba dentro del menú y ponía los dos botones en la misma línea (el 2º se salía a la derecha y parecía no existir). Se fuerza white-space normal en el menú y display block en los botones de orden. Hereda v23.
// VERSION: v23 · 2026-08-07 · LISTA de Términos: (1) cabecera + fila de filtros FIJA al hacer scroll (sticky bajo el TopNav 52px); (2) filtros estilo Excel en TODAS las columnas (buscador + recuento + ordenar ↑↓, como Compras); (3) botón "⬇ Exportar a Excel" que baja lo filtrado. Hereda v22.
// VERSION: v22 · 2026-07-19 · MARKUP ÚNICO: el presupuesto del término se muestra CON markup
//   (precio al cliente) como principal; el resultado del término usa ese total con markup (repPresu
//   con markup, se jubila el markup como monto suelto). El % (terminos.markup_fcr, default 20) es
//   editable solo por Karina/Dirección, con drop-down "ver coste sin markup" y el margen FCR. Los
//   demás solo ven el presupuesto comunicable. Hereda v21.
//   ('use client' debe ir 1º; VERSION en línea 2.)
import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabaseClient'
import TopNav from '@/app/components/ui/TopNav'

const DIRECCION_EMAILS = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com']
const FINANZAS_EMAILS = ['karina.morales@fondocapital.com']
// Administración (Adalis y Fabiola): pueden generar el PDF del término y enviar los correos de liquidación.
const ADMIN_EMAILS = ['adalis@fondocapital.com', 'fabiola.guerra@fondocapital.com']

const norm = s => (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
const up = s => (s || '').toString().toUpperCase().replace(/\s+/g, ' ').trim()
const n0 = v => { const x = Number(v); return isNaN(x) ? 0 : x }
// Parser numérico IDÉNTICO al de la Cartola por IDADMON (app/procesos/cartolas), para que el
// "Balance de pagos del arrendatario" cuadre al peso con el último saldo que muestra la cartola.
const numC = v => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d.-]/g, '')) || 0)
// Cargo EFECTIVO = cargo_manual (override editado en la cartola) si existe; si no, el cargo original.
// La cartola calcula su saldo corrido con este valor, no con el `cargo` crudo.
const cargoEfectivo = m => (m.cargo_manual != null && m.cargo_manual !== '') ? numC(m.cargo_manual) : numC(m.cargo)
const fmtPesos = n => { const v = Number(n); if (isNaN(v) || n === null || n === '') return '—'; return '$' + v.toLocaleString('es-CL') }
const fmtFecha = s => { if (!s) return '—'; const str = String(s); if (/^\d{4}-\d{2}-\d{2}/.test(str)) { const [y, m, d] = str.slice(0, 10).split('-'); return `${d}/${m}/${y}` } return str }
// Nombre legible a partir del email (karina.morales@… -> "Karina Morales").
const nombreUsuario = u => { const p = String(u || '').split('@')[0]; return p ? p.replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '—' }

// Clasificación canónica de "quién tiene la garantía" (traspaso 2026-07-12):
//   'FCR' EXACTO  = la tiene la empresa.
//   cualquier otro valor no vacío = la tiene el dueño (canónico: 'DUEÑO').
//   blanco / NO / NOHAY = sin garantía (se trata como "no FCR" a efectos del tipo).
// BUG corregido: antes se usaba includes('FCR'), que clasificaba mal "FCR PARA EL DUEÑO"
// (228 filas) como si la tuviera FCR. Los datos ya se normalizaron a 'DUEÑO'; esto blinda
// el código para que no reincida si entran grafías nuevas.
const esGarantiaFCR = quien => up(quien) === 'FCR'

function familiaDe(tipo) {
  const t = up(tipo)
  if (['SERVICIOS', 'IMPUESTOS', 'COSTES-CC2'].includes(t)) return 'servicios'
  if (['ARREGLOS', 'LIMPIEZAS'].includes(t)) return 'reparaciones'
  if (['MULTAS', 'DEMANDAS', 'DEUDAS', 'DESCUENTO'].includes(t)) return 'financiero'
  if (['NOTARIOS', 'CORRETAJES', 'SEGUROS', 'SALVOCONDUCTO', 'TERMINO'].includes(t)) return 'gestion'
  if (['GARANTIAS', 'DEVOLUCIONES'].includes(t)) return 'garantia'
  return 'otros'
}
function estadoTarea(t) {
  if (!t) return 'pendiente'
  if (t.fecha_cierre) return 'hecho'
  const e = up(t.estado)
  if (['COMPLETADO', 'COMPLETADA', 'HECHO', 'HECHA', 'CERRADO', 'CERRADA', 'OK', 'DONE', 'FINALIZADO', 'FINALIZADA', 'TERMINADO', 'TERMINADA', 'REALIZADO', 'REALIZADA', 'SI'].includes(e)) return 'hecho'
  if (['ACTIVO', 'EN CURSO', 'EN_CURSO', 'EN PROGRESO', 'EN_PROGRESO', 'PROCESO', 'CURSO'].includes(e)) return 'curso'
  return 'pendiente'
}

// conceptos fijos por bloque (plantilla). 'Arreglos presupuesto' es automatico.
const PLANTILLA = {
  garantia: ['Balance de pagos del arrendatario', 'Intereses de retraso en pagos', 'Multas aplicables (si procede)', 'Pérdida de garantía', 'Otros Liquidación 1', 'Otros Liquidación 2'],
  servicios: ['Gastos Comunes Atrasados', 'Gastos Comunes Pendientes', 'Luz', 'Agua', 'Acuerdos especiales deudas', 'Otros Servicios 1', 'Otros Servicios 2'],
  reparaciones: ['Arreglos presupuesto', 'Reparaciones extras', 'Limpieza General del dpto.', 'Mantención de TERMO', 'Limpieza de alfombras', 'Otros Reparaciones 1', 'Otros Reparaciones 2', 'Otros Reparaciones 3'],
}
const AUTO_CONCEPTO = 'Arreglos presupuesto'
const FORM_T = { fecha_entrega: '', valoracion_legal: '', decision_actuacion: '', lectura_agua: '', lectura_luz: '', markup_fcr: '', comentarios_arrendatario: '', comentarios_internos: '', notas_finanzas_1: '', notas_finanzas_2: '', notas_finanzas_3: '', notas_finanzas_4: '',
  // Aprobación bilateral del presupuesto (Etapa 4). Columnas ya existentes en `terminos`.
  aprob_arrendatario_fecha: '', aprob_arrendatario_via: '', aprob_propietario_fecha: '', aprob_propietario_via: '' }

// Precio de una línea de presupuesto CON markup aplicado (factura: sobre neto; honorario: sobre bruto).
// Devuelve { base, iva, total } ya con markup. mkDefault = % por defecto del término.
function lineaConMarkup(l, mkDefault) {
  const base = n0(l.base_imponible)
  const mk = (l.markup_pct === '' || l.markup_pct == null) ? n0(mkDefault) : n0(l.markup_pct)
  const baseMk = Math.round(base * (1 + mk / 100))
  const ivaMk = Math.round(baseMk * 0.19)
  return { base: baseMk, iva: ivaMk, total: baseMk + ivaMk, markup: mk }
}
function calcResult(L, markup, garantia, repPresu, quien) {
  const sumB = b => (L[b] || []).reduce((a, l) => a + (l.auto ? repPresu : n0(l.monto)), 0)
  const sg = sumB('garantia'), ss = sumB('servicios'), sr = sumB('reparaciones')
  const totalCargos = sg + ss + sr + n0(markup)
  const resultado = n0(garantia) - totalCargos
  const conSaldo = resultado >= 0
  const esFCR = esGarantiaFCR(quien)   // match EXACTO (antes includes → clasificaba mal "FCR PARA EL DUEÑO")
  const tipo = `T-${conSaldo ? 'CON' : 'SIN'} SALDO-${esFCR ? 'FCR' : 'DUENO'}`
  return { sg, ss, sr, markup: n0(markup), garantia: n0(garantia), totalCargos, resultado, conSaldo, esFCR, tipo }
}

// Columnas de la LISTA de términos (con accesor get() y formato para el filtro numérico)
const fmtMoneyCol = v => v === '' ? '(vacío)' : fmtPesos(v)
const getMoney = k => r => r[k] == null ? '' : String(Math.round(Number(r[k])))
const COLDEFS_T = [
  { key: 'idadmon', label: 'IDADMON', get: r => String(r.idadmon || '') },
  { key: 'fecha_entrega', label: 'F. Entrega', get: r => r.fecha_entrega ? fmtFecha(r.fecha_entrega) : '' },
  { key: 'propietario', label: 'Propietario', get: r => r.propietario || '' },
  { key: 'arrendatario', label: 'Arrendatario', get: r => r.arrendatario || '' },
  { key: 'inmueble', label: 'Inmueble', get: r => r.inmueble || '' },
  { key: 'estado', label: 'Estado', get: r => String(r.estado || '') },
  { key: 'garantia', label: 'Garantía entregada', get: getMoney('garantia'), fmt: fmtMoneyCol, num: true, alignR: true },
  { key: 'quien', label: 'Quién la tiene', get: r => r.quien || '' },
  { key: 'balance', label: 'Datos económicos', get: getMoney('balance'), fmt: fmtMoneyCol, num: true, alignR: true },
  { key: 'servicios', label: 'Total servicios', get: getMoney('servicios'), fmt: fmtMoneyCol, num: true, alignR: true },
  { key: 'reparaciones', label: 'Total reparaciones', get: getMoney('reparaciones'), fmt: fmtMoneyCol, num: true, alignR: true },
  { key: 'resultado', label: 'Resultado término', get: getMoney('resultado'), fmt: fmtMoneyCol, num: true, alignR: true },
]

// Filtro estilo Excel (idéntico al de Compras/Honorarios): ordenar ↑↓ + buscador + valores con recuento.
function HeaderFilterT({ col, movs, state, setState, open, setOpen, orden, setOrden }) {
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
  const asc = col.key === 'fecha_entrega' ? 'Más antiguas primero' : col.num ? 'Menor a mayor' : 'A → Z'
  const desc = col.key === 'fecha_entrega' ? 'Más recientes primero' : col.num ? 'Mayor a menor' : 'Z → A'
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

export default function TerminosPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const email = session?.user?.email
  const rol = session?.user?.role

  const [accesoOk, setAccesoOk] = useState(null)
  const [modo, setModo] = useState('lista')
  const [listaIds, setListaIds] = useState([])
  const [listaCargada, setListaCargada] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtros, setFiltros] = useState({ idadmon: '', fecha_entrega: '', propietario: '', arrendatario: '', inmueble: '', estado: 'Q' })
  const [sortCol, setSortCol] = useState('idadmon')
  const [sortDir, setSortDir] = useState('desc')
  // Filtros estilo Excel de la LISTA (col.key -> {text, sel}). Estado arranca en 'Q' (como antes).
  const [filters, setFilters] = useState({ estado: { text: '', sel: ['Q'] } })
  const [openFilter, setOpenFilter] = useState(null)
  const [orden, setOrden] = useState({ key: 'idadmon', dir: 'asc' })

  const [idadmonSel, setIdadmonSel] = useState('')
  const [panel, setPanel] = useState(null)
  const [loadingPanel, setLoadingPanel] = useState(false)
  const [nodos, setNodos] = useState([])
  const [etapas, setEtapas] = useState([])
  const [wfExpandido, setWfExpandido] = useState(false)
  const [sucesorExpandido, setSucesorExpandido] = useState(false)  // descuentos del inmueble siguiente (colapsado por defecto)
  const [costeExpandido, setCosteExpandido] = useState(false)  // drop-down "ver coste sin markup" (solo Karina/Dir)
  const [lineas, setLineas] = useState({ garantia: [], servicios: [], reparaciones: [] })

  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState(FORM_T)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)
  const [presuGen, setPresuGen] = useState(false)   // generando/enviando presupuesto
  const [pdfTermGen, setPdfTermGen] = useState(false)   // generando el PDF profesional del término
  const [testTo, setTestTo] = useState('')              // dirección para envíos de PRUEBA (por defecto, la del usuario)
  const [completandoWf, setCompletandoWf] = useState(false)
  const [emailPanel, setEmailPanel] = useState(null) // { loading, error?, drafts:{ arrendatario:{...}, propietario:{...} } }
  const [reclamPanel, setReclamPanel] = useState(null) // { loading, aviso?, draft:{ to, cc, subject, cuerpo, saldo, ... } }

  useEffect(() => {
    if (status !== 'authenticated' || !email) return
    if (rol === 'admin' || DIRECCION_EMAILS.includes(email)) { setAccesoOk(true); return }
    supabase.from('proceso_permisos').select('proceso').eq('email', email).eq('activo', true)
      .then(({ data }) => setAccesoOk(!!(data || []).some(p => (p.proceso || '').toLowerCase().includes('termino'))))
  }, [status, email, rol])
  useEffect(() => { if (accesoOk === false) router.replace('/') }, [accesoOk, router])
  useEffect(() => { if (accesoOk === true) { cargarLista(); cargarNodos() } }, [accesoOk])

  async function completarPaso(nodo) {
    if (!nodo) return
    if (!panel?.instanceId) { setMsg('Este término no tiene instancia de workflow.'); return }
    const comentario = window.prompt('Comentario para completar ' + nodo.codigo + ' · ' + nodo.nombre + ' (opcional):', '')
    if (comentario === null) return
    setCompletandoWf(true); setMsg(null)
    try {
      const res = await fetch('/api/workflow/completar-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow_instance_id: panel.instanceId,
          node_codigo: nodo.codigo,
          comentarios: comentario || null,
          usuario_email: email,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setMsg('Error: ' + (data.error || res.status)); setCompletandoWf(false); return }
      await abrir(idadmonSel)
      setMsg('Paso ' + nodo.codigo + ' completado.')
    } catch (e) {
      setMsg('Error: ' + e.message)
    }
    setCompletandoWf(false)
  }

  async function cargarNodos() {
    const { data } = await supabase.from('workflow_nodes').select('codigo, nombre, area_responsable, orden_visual, etapa_numero, tipo, bloquea_cierre').eq('workflow_codigo', 'TERMINO').order('orden_visual')
    setNodos(data || [])
    const { data: et } = await supabase.from('workflow_etapas').select('numero, nombre, compuerta_dura').eq('workflow_codigo', 'TERMINO').order('numero')
    setEtapas(et || [])
  }
  async function cargarLista() {
    // Origen: datos_arriendos por estado de termino. Q (en término), N-DICOM (derivados a legal),
    // y los cierres N / N-Liquidacion para poder ver el HISTÓRICO de términos ya cerrados.
    // NOTA: el valor canónico del circuito es 'N-DICOM' (con guion). La base se normalizó
    // desde las grafías históricas ('N DICOM', 'N_DICOM') a 'N-DICOM'.
    const ESTADOS_TERMINO = ['Q', 'N', 'N-DICOM', 'N-Liquidacion']
    const { data: da } = await supabase
      .from('datos_arriendos')
      .select('idadmon, arrendatario, inmueble, estado, propietario, termino_actual')
      .in('estado', ESTADOS_TERMINO)
    const base = (da || [])
      .map(r => ({ idadmon: (r.idadmon || '').trim(), arrendatario: r.arrendatario, inmueble: r.inmueble, estado: r.estado, propietario: r.propietario, termino_actual: r.termino_actual }))
      .filter(r => r.idadmon)
    // cruzar fecha_entrega desde 'terminos'
    const ids = base.map(r => r.idadmon)
    const fechas = {}
    for (let i = 0; i < ids.length; i += 300) {
      const { data: tt } = await supabase.from('terminos').select('idadmon, fecha_entrega').in('idadmon', ids.slice(i, i + 300))
      ;(tt || []).forEach(t => { fechas[(t.idadmon || '').trim()] = t.fecha_entrega })
    }
    // garantía, quién, servicios, reparaciones, datos económicos (balance) y resultado
    // desde la vista vw_termino_resultado (defensivo: si no existe, quedan null)
    const calc = {}
    try {
      for (let i = 0; i < ids.length; i += 300) {
        const { data: vr } = await supabase.from('vw_termino_resultado').select('idadmon, garantia, quien, servicios, reparaciones, balance, resultado').in('idadmon', ids.slice(i, i + 300))
        ;(vr || []).forEach(v => { calc[(v.idadmon || '').trim()] = { garantia: v.garantia, quien: v.quien, servicios: v.servicios, reparaciones: v.reparaciones, balance: v.balance, resultado: v.resultado } })
      }
    } catch (e) { /* vista no disponible aún: las columnas mostrarán — */ }
    // fecha_entrega: terminos.fecha_entrega, con respaldo en datos_arriendos.termino_actual
    base.forEach(r => {
      r.fecha_entrega = fechas[r.idadmon] || r.termino_actual || null
      const c = calc[r.idadmon] || {}
      r.garantia = c.garantia ?? null
      r.quien = c.quien ?? null
      r.balance = c.balance ?? null
      r.servicios = c.servicios ?? null
      r.resultado = c.resultado ?? null
      r.reparaciones = c.reparaciones ?? null
    })
    setListaIds(base.sort((a, b) => a.idadmon.localeCompare(b.idadmon)))
    setListaCargada(true)
  }

  async function abrir(idadmon) {
    setLoadingPanel(true); setIdadmonSel(idadmon); setModo('panel'); setPanel(null); setEditando(false); setMsg(null); setWfExpandido(false)
    const [arrRes, descRes, presRes, termRes, linRes, instRes, ggccRes, cuentasRes, cargoRes] = await Promise.all([
      supabase.from('datos_arriendos').select('*').eq('idadmon', idadmon).limit(1),
      supabase.from('descuentos').select('id, num, fecha, tipo, repercutir_a, monto_a_imputar, texto_explicativo_para_carta_a_propietario').eq('idadmon', idadmon).like('repercutir_a', 'T-%'),
      supabase.from('presupuestos').select('id, numero, fecha, neto, iva, total, descripcion').eq('id_admon_new', idadmon),
      supabase.from('terminos').select('*').eq('idadmon', idadmon).limit(1),
      supabase.from('termino_lineas').select('*').eq('idadmon', idadmon).order('orden'),
      supabase.from('workflow_instances').select('id').eq('idadmon', idadmon).eq('workflow_codigo', 'TERMINO').limit(1),
      supabase.from('ggcc_agua_luz').select('id, aamm, mes, deuda_gastos_comunes, deuda_vigente_electricidad, deuda_vigente_agua').eq('idadmon', idadmon).order('aamm', { ascending: false }).limit(1),
      supabase.from('cuentas').select('cargo, abono, cargo_manual').eq('idadmon', idadmon),
      // Cargos al PROPIETARIO derivados de este término (saldo sin saldo, complementos, devolución de garantía…):
      // descuentos con idadmon_relacionado = este término y repercutir_a = PROPIETARIO.
      supabase.from('descuentos').select('num, mes_a_imputar, monto_a_imputar, idadmon, tipo, texto_explicativo_para_carta_a_propietario').eq('idadmon_relacionado', idadmon).eq('repercutir_a', 'PROPIETARIO'),
    ])
    const cargosProp = ((cargoRes && cargoRes.data) || [])
      .filter(r => String(r.mes_a_imputar || '') !== '----MES')
      .map(r => ({ num: r.num, monto: n0(r.monto_a_imputar), idadmon: r.idadmon, mes: r.mes_a_imputar, tipo: r.tipo, texto: r.texto_explicativo_para_carta_a_propietario || '' }))
    const ggcc = (ggccRes.data && ggccRes.data[0]) || null
    const cuentasMovs = cuentasRes ? (cuentasRes.data || []) : []
    // MISMO cálculo que la Cartola por IDADMON: saldo = Σ(cargoEfectivo − abono), con cargoEfectivo
    // = cargo_manual (override) si existe. Así el balance cuadra al peso con el último saldo de la cartola.
    const balanceCuentas = cuentasMovs.reduce((a, r) => a + cargoEfectivo(r) - numC(r.abono), 0)
    const arriendo = (arrRes.data && arrRes.data[0]) || null
    const descuentos = descRes.data || []
    const presupuestos = presRes.data || []
    let detalle = []
    if (presupuestos.length) {
      const { data: det } = await supabase.from('presupuesto_detalle').select('presupuesto_id, orden, descripcion, cantidad, coste_unit, base_imponible, iva, total, markup_pct, tipo_comprobante').in('presupuesto_id', presupuestos.map(p => p.id)).order('orden')
      detalle = det || []
    }
    let wfTasks = []
    let wfLogs = []
    const inst = (instRes.data && instRes.data[0]) || null
    if (inst) {
      const { data: tk } = await supabase.from('workflow_tasks').select('node_codigo, estado, responsable, fecha_inicio, fecha_limite, fecha_cierre').eq('workflow_instance_id', inst.id)
      wfTasks = tk || []
      // Quién completó cada paso: vive en workflow_task_logs (usuario, comentario, accion). select('*') para no
      // romper si cambia el esquema; en render se toma el último COMPLETADO por nodo.
      const { data: lg } = await supabase.from('workflow_task_logs').select('*').eq('workflow_instance_id', inst.id)
      wfLogs = lg || []
    }
    const t = (termRes.data && termRes.data[0]) || null
    const saved = linRes.data || []
    const g = (k, d = '') => (t && t[k] != null ? t[k] : d)
    setForm({
      fecha_entrega: t?.fecha_entrega ? String(t.fecha_entrega).slice(0, 10) : (arriendo?.termino_actual ? String(arriendo.termino_actual).slice(0, 10) : ''),
      valoracion_legal: g('valoracion_legal'), decision_actuacion: g('decision_actuacion'),
      lectura_agua: g('lectura_agua'), lectura_luz: g('lectura_luz'), markup_fcr: g('markup_fcr'),
      comentarios_arrendatario: g('comentarios_arrendatario'), comentarios_internos: g('comentarios_internos'),
      notas_finanzas_1: g('notas_finanzas_1'), notas_finanzas_2: g('notas_finanzas_2'), notas_finanzas_3: g('notas_finanzas_3'), notas_finanzas_4: g('notas_finanzas_4'),
      aprob_arrendatario_fecha: t?.aprob_arrendatario_fecha ? String(t.aprob_arrendatario_fecha).slice(0, 10) : '',
      aprob_arrendatario_via: g('aprob_arrendatario_via'),
      aprob_propietario_fecha: t?.aprob_propietario_fecha ? String(t.aprob_propietario_fecha).slice(0, 10) : '',
      aprob_propietario_via: g('aprob_propietario_via'),
    })

    // repPresu = total del presupuesto CON markup (precio al cliente). El markup por defecto es
    // terminos.markup_fcr (%, default 20). Se aplica línea a línea sobre el detalle.
    const mkDefault = (() => { const v = n0(g('markup_fcr')); return v > 0 ? v : 20 })()
    const repPresu = detalle.reduce((a, l) => a + lineaConMarkup(l, mkDefault).total, 0)
    const arreglosRef = presupuestos.map(p => p.numero).filter(Boolean).join(', ') || '0'
    const buildBloque = bk => {
      const out = []
      PLANTILLA[bk].forEach(concepto => {
        if (bk === 'reparaciones' && concepto === AUTO_CONCEPTO) {
          const sv = saved.find(s => s.bloque === bk && s.concepto === concepto && s.es_fijo)
          // Prellenar con el TOTAL del presupuesto, pero EDITABLE (auto:false): si el usuario
          // guardó un valor propio (override), se usa ese; si no, arranca con el del presupuesto.
          // No se toca el presupuesto: solo el importe de esta línea de la liquidación.
          const montoInit = (sv && sv.monto != null && sv.monto !== '') ? sv.monto : repPresu
          out.push({ concepto, monto: montoInit, comentario: sv?.comentario || '', ref: sv?.ref || arreglosRef, es_fijo: true, auto: false, excluir_prop: !!sv?.excluir_propietario })
          return
        }
        const sv = saved.find(s => s.bloque === bk && s.concepto === concepto && s.es_fijo)
        out.push({ concepto, monto: sv ? sv.monto : '', comentario: sv?.comentario || '', ref: sv?.ref || '', es_fijo: true, auto: false, excluir_prop: !!sv?.excluir_propietario })
      })
      saved.filter(s => s.bloque === bk && !s.es_fijo).forEach(s => out.push({ concepto: s.concepto || '', monto: s.monto ?? '', comentario: s.comentario || '', ref: s.ref || '', es_fijo: false, auto: false, excluir_prop: !!s.excluir_propietario }))
      return out
    }
    const L = { garantia: buildBloque('garantia'), servicios: buildBloque('servicios'), reparaciones: buildBloque('reparaciones') }
    // El "Balance de pagos del arrendatario" = ÚLTIMO SALDO de la Cartola por IDADMON: valor DERIVADO
    // Σ(cargoEfectivo − abono) de `cuentas`, con cargoEfectivo = cargo_manual (override) si existe.
    // Se recalcula SIEMPRE al abrir el panel —aunque ya haya líneas guardadas— para que refleje los
    // movimientos nuevos. Antes solo se calculaba la 1ª vez y se quedaba congelado con el valor guardado.
    {
      const linBal = L.garantia.find(x => x.concepto === 'Balance de pagos del arrendatario' && x.es_fijo)
      if (linBal) { linBal.monto = balanceCuentas; linBal.ref = 'Saldo cartola (' + cuentasMovs.length + ' mov.)' }
    }
    // sembrar desde descuentos SOLO la primera vez (sin lineas guardadas)
    if (saved.length === 0) {
      // Los servicios del TÉRMINO vienen SOLO de descuentos (proporcionales que pone Adalis/Fabiola).
      // Los GGCC/luz/agua del mes NO se meten en el cálculo (se mostrarán como referencia informativa aparte).
      const MAP = {
        servicios: [], // servicios vienen de ggcc; los descuentos servicios se listan como lineas aparte
        reparaciones: [
          ['Limpieza de alfombras', ['alfombra']],
          ['Mantención de TERMO', ['termo', 'anodo']],
          ['Limpieza General del dpto.', ['limpieza general', 'limpieza profunda', 'aseo general', 'limpieza del dpto', 'limpieza dpto']],
        ],
      }
      const mapear = (bk, texto) => {
        const tx = norm(texto)
        for (const [concepto, kws] of (MAP[bk] || [])) { if (kws.some(k => tx.includes(norm(k)))) return concepto }
        return null
      }
      descuentos.forEach(d => {
        const fam = familiaDe(d.tipo)
        if (fam === 'garantia') return // informativo
        const bk = fam === 'servicios' ? 'servicios' : 'reparaciones'
        const texto = d.texto_explicativo_para_carta_a_propietario || d.tipo || '(descuento)'
        const monto = n0(d.monto_a_imputar)
        const ref = 'Descto. ' + (d.num || '')
        const conceptoFijo = mapear(bk, texto)
        if (conceptoFijo) {
          const fija = L[bk].find(x => x.concepto === conceptoFijo && x.es_fijo)
          if (fija) { fija.monto = n0(fija.monto) + monto; fija.ref = fija.ref ? (fija.ref + ', ' + ref) : ref; return }
        }
        L[bk].push({ concepto: texto, monto, comentario: '', ref, es_fijo: false, auto: false })
      })
    }
    setLineas(L)

    // asociado = IDADMON inmediatamente mas nuevo del mismo inmueble (idlinmue)
    let asociado = null
    if (arriendo?.idlinmue != null && arriendo.idlinmue !== '') {
      const { data: hermanos } = await supabase.from('datos_arriendos').select('idadmon').eq('idlinmue', arriendo.idlinmue)
      const masNuevos = (hermanos || []).map(h => (h.idadmon || '').trim()).filter(x => x && x > idadmon).sort()
      if (masNuevos.length) asociado = masNuevos[0]
    }
    const idsResumen = asociado ? [idadmon, asociado] : [idadmon]
    const { data: descResumen } = await supabase.from('descuentos')
      .select('num, fecha_contable, idadmon, inmueble, propietario, repercutir_a, monto_a_imputar, texto_explicativo_para_carta_a_propietario, tipo')
      .in('idadmon', idsResumen).order('num')

    setPanel({ arriendo, descuentos, presupuestos, detalle, termino: t, wfTasks, wfLogs, instanceId: inst?.id || null, repPresu, arreglosRef, asociado, descResumen: descResumen || [], ggcc, cargosProp })
    setLoadingPanel(false)
  }

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setLinea = (bk, idx, field, v) => setLineas(L => ({ ...L, [bk]: L[bk].map((l, i) => i === idx ? { ...l, [field]: v } : l) }))
  const addLinea = bk => setLineas(L => ({ ...L, [bk]: [...L[bk], { concepto: '', monto: '', comentario: '', ref: '', es_fijo: false, auto: false }] }))
  const removeLinea = (bk, idx) => setLineas(L => ({ ...L, [bk]: L[bk].filter((_, i) => i !== idx) }))

  async function guardar() {
    setGuardando(true); setMsg(null)
    const arr = panel.arriendo
    const garantia = n0(arr?.garantia_pedida)
    const quien = arr?.quien_tiene_garantia || arr?.garantia_con || ''
    const mkDef = (() => { const v = n0(form.markup_fcr); return v > 0 ? v : 20 })()
    const repPresu = (panel.detalle || []).reduce((a, l) => a + lineaConMarkup(l, mkDef).total, 0)
    const arreglosRef = panel.arreglosRef
    const R = calcResult(lineas, 0, garantia, repPresu, quien)

    const rows = []
    ;['garantia', 'servicios', 'reparaciones'].forEach(bk => {
      (lineas[bk] || []).forEach((l, idx) => {
        const monto = l.auto ? repPresu : n0(l.monto)
        const ref = l.auto ? arreglosRef : (l.ref || null)
        const keep = l.auto || monto !== 0 || (l.comentario && l.comentario.trim()) || (l.ref && l.ref.trim()) || !l.es_fijo
        if (!keep) return
        if (!l.es_fijo && !(l.concepto && l.concepto.trim()) && monto === 0) return // linea añadida vacia
        rows.push({ idadmon: idadmonSel, bloque: bk, concepto: l.concepto || '(sin concepto)', monto, comentario: l.comentario || null, ref, orden: idx, es_fijo: l.es_fijo, excluir_propietario: !!l.excluir_prop })
      })
    })

    const delR = await supabase.from('termino_lineas').delete().eq('idadmon', idadmonSel)
    if (delR.error) { setMsg({ tipo: 'error', txt: 'Error (borrado líneas): ' + delR.error.message }); setGuardando(false); return }
    if (rows.length) {
      const insR = await supabase.from('termino_lineas').insert(rows)
      if (insR.error) { setMsg({ tipo: 'error', txt: 'Error (líneas): ' + insR.error.message }); setGuardando(false); return }
    }
    const num = k => form[k] === '' || form[k] == null ? 0 : Number(form[k])
    const txt = k => form[k] || null
    const payload = {
      idadmon: idadmonSel, fecha_entrega: form.fecha_entrega || null,
      valoracion_legal: txt('valoracion_legal'), decision_actuacion: txt('decision_actuacion'),
      lectura_agua: txt('lectura_agua'), lectura_luz: txt('lectura_luz'), markup_fcr: num('markup_fcr'),
      comentarios_arrendatario: txt('comentarios_arrendatario'), comentarios_internos: txt('comentarios_internos'),
      notas_finanzas_1: txt('notas_finanzas_1'), notas_finanzas_2: txt('notas_finanzas_2'), notas_finanzas_3: txt('notas_finanzas_3'), notas_finanzas_4: txt('notas_finanzas_4'),
      aprob_arrendatario_fecha: form.aprob_arrendatario_fecha || null, aprob_arrendatario_via: txt('aprob_arrendatario_via'),
      aprob_propietario_fecha: form.aprob_propietario_fecha || null, aprob_propietario_via: txt('aprob_propietario_via'),
      resultado_calculado: R.resultado, tipo_resultado: R.tipo, updated_at: new Date().toISOString(),
    }
    const upR = await supabase.from('terminos').upsert(payload, { onConflict: 'idadmon' })
    if (upR.error) { setMsg({ tipo: 'error', txt: 'Error (terminos): ' + upR.error.message }); setGuardando(false); return }
    // Propagar la fecha de entrega a datos_arriendos.termino_actual (la fecha real del término,
    // que es la que lee la vista LOG). Solo si hay fecha: no pisamos con null si el campo está vacío.
    if (form.fecha_entrega) {
      const upDA = await supabase.from('datos_arriendos')
        .update({ termino_actual: form.fecha_entrega }).eq('idadmon', idadmonSel)
      if (upDA.error) { setMsg({ tipo: 'error', txt: 'Guardado el término, pero no se pudo actualizar la fecha en LOG: ' + upDA.error.message }); setGuardando(false); return }
    }
    setEditando(false); setGuardando(false); setMsg({ tipo: 'ok', txt: 'Guardado.' })
  }

  // ── Borradores de email (notificación de liquidación, N16/N17) ──
  // Enviar Presupuesto: genera el PDF (descargable) y abre los borradores de email con el enlace añadido.
  // Gate real en el endpoint (solo Karina + Dirección); aquí se refuerza con puedeVerMarkup.
  async function generarYEnviarPresupuesto() {
    if (!puedeTerminoDocs) return
    setPresuGen(true); setMsg(null)
    try {
      const res = await fetch('/api/terminos/generar-presupuesto-pdf', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idadmon: idadmonSel }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setMsg({ tipo: 'error', txt: data.error || ('Error ' + res.status) }); return }
      const url = data.pdf_url || null
      if (url) window.open(url, '_blank', 'noopener,noreferrer')   // PDF descargable en pestaña nueva
      setMsg({ tipo: 'ok', txt: url ? 'PDF del presupuesto generado (abierto en otra pestaña para descargar). Abajo tienes el email por si quieres enviarlo.' : 'Presupuesto generado.' })
      // Abrir los borradores de email y añadir el enlace del PDF al cuerpo de cada uno.
      await abrirBorradores()
      if (url) {
        setEmailPanel(p => {
          if (!p || !p.drafts) return p
          const nd = {}
          for (const k of Object.keys(p.drafts)) {
            const d = p.drafts[k]; const cuerpo = d.cuerpo || ''
            nd[k] = { ...d, cuerpo: cuerpo.includes(url) ? cuerpo : (cuerpo + `\n\nPresupuesto detallado (PDF): ${url}`) }
          }
          return { ...p, drafts: nd }
        })
      }
    } catch (e) {
      setMsg({ tipo: 'error', txt: String(e?.message || e) })
    } finally {
      setPresuGen(false)
    }
  }

  async function abrirBorradores() {
    setEmailPanel({ loading: true, drafts: {} })
    setTestTo(prev => prev || session?.user?.email || '')   // por defecto, las pruebas van a mi propio correo
    const dests = ['arrendatario', 'propietario']
    const drafts = {}
    for (const d of dests) {
      try {
        const res = await fetch('/api/terminos/borrador-email', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idadmon: idadmonSel, destinatario: d }),
        })
        const data = await res.json()
        drafts[d] = (res.ok && !data.error)
          ? { to: data.to || '', subject: data.subject || '', cuerpo: data.cuerpo || '', sinEmail: !!data.sinEmail, error: null, enviando: false, enviado: false }
          : { to: '', subject: '', cuerpo: '', sinEmail: true, error: data.error || ('Error ' + res.status), enviando: false, enviado: false }
      } catch (e) {
        drafts[d] = { to: '', subject: '', cuerpo: '', sinEmail: true, error: e.message, enviando: false, enviado: false }
      }
    }
    setEmailPanel({ loading: false, drafts })
  }
  const setDraft = (dest, field, v) => setEmailPanel(p => p ? ({ ...p, drafts: { ...p.drafts, [dest]: { ...p.drafts[dest], [field]: v } } }) : p)
  // Envío del borrador. Con { test:true } manda una PRUEBA a `testTo` (no toca al destinatario real ni deja rastro).
  // El envío REAL solo se dispara desde el botón "✓ Confirmar y enviar" (doble validación en la UI).
  async function enviarBorrador(dest, { test = false } = {}) {
    const dr = emailPanel?.drafts?.[dest]
    if (!dr) return
    const destino = test ? String(testTo || '').trim() : String(dr.to || '').trim()
    if (!destino || !/@/.test(destino)) { setDraft(dest, 'error', test ? 'Pon un correo de prueba válido.' : 'Falta un destinatario válido.'); return }
    if (!dr.subject || !dr.cuerpo) { setDraft(dest, 'error', 'Falta asunto o cuerpo.'); return }
    setDraft(dest, 'enviando', true); setDraft(dest, 'error', null); setDraft(dest, 'pruebaMsg', null)
    try {
      const res = await fetch('/api/terminos/enviar-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idadmon: idadmonSel, destinatario: dest, to: dr.to, subject: dr.subject, cuerpo: dr.cuerpo, test, toTest: test ? destino : undefined }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setDraft(dest, 'enviando', false); setDraft(dest, 'error', data.error || ('Error ' + res.status)); return }
      if (test) {
        setEmailPanel(p => ({ ...p, drafts: { ...p.drafts, [dest]: { ...p.drafts[dest], enviando: false, error: null, pruebaMsg: '✓ Prueba enviada a ' + (data.enviadoA || destino) } } }))
      } else {
        setEmailPanel(p => ({ ...p, drafts: { ...p.drafts, [dest]: { ...p.drafts[dest], enviando: false, enviado: true, confirmando: false, error: null } } }))
      }
    } catch (e) {
      setDraft(dest, 'enviando', false); setDraft(dest, 'error', e.message)
    }
  }

  // ── Reclamación de saldo pendiente (N18/N21) ──
  // Un solo correo al ex-arrendatario, cc CONDICIONAL al aval. No cambia el estado.
  async function abrirReclamacion() {
    setReclamPanel({ loading: true, draft: null, aviso: null })
    try {
      const res = await fetch('/api/terminos/borrador-reclamacion', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idadmon: idadmonSel }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setReclamPanel({ loading: false, draft: null, aviso: data.error || ('Error ' + res.status) }); return }
      setReclamPanel({ loading: false, aviso: null, draft: {
        to: data.to || '', cc: data.cc || '', bcc: '', subject: data.subject || '', cuerpo: data.cuerpo || '',
        saldo: n0(data.saldo), hayAval: !!data.hayAval, sinEmail: !!data.sinEmail,
        error: null, yaAbierta: false, enviando: false, enviado: false, reenvio: false, pruebaMsg: null, confirmando: false,
      } })
      setTestTo(prev => prev || session?.user?.email || '')
    } catch (e) {
      setReclamPanel({ loading: false, draft: null, aviso: e.message })
    }
  }
  const setReclam = (field, v) => setReclamPanel(p => (p && p.draft) ? ({ ...p, draft: { ...p.draft, [field]: v } }) : p)
  // Con { test:true } manda una PRUEBA a `testTo` (no abre solicitud ni deja rastro). El envío real solo se dispara
  // desde "✓ Confirmar y enviar" (doble validación).
  async function enviarReclamacion(forzar, { test = false } = {}) {
    const dr = reclamPanel?.draft
    if (!dr) return
    const destino = test ? String(testTo || '').trim() : String(dr.to || '').trim()
    if (!destino || !/@/.test(destino)) { setReclam('error', test ? 'Pon un correo de prueba válido.' : 'Falta un destinatario válido.'); return }
    if (!dr.subject || !dr.cuerpo) { setReclam('error', 'Falta asunto o cuerpo.'); return }
    setReclamPanel(p => p ? ({ ...p, draft: { ...p.draft, enviando: true, error: null, pruebaMsg: null } }) : p)
    try {
      const res = await fetch('/api/terminos/enviar-reclamacion', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idadmon: idadmonSel, to: dr.to, cc: dr.cc, bcc: dr.bcc, subject: dr.subject, cuerpo: dr.cuerpo, forzar: !!forzar, test, toTest: test ? destino : undefined }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setReclamPanel(p => p ? ({ ...p, draft: { ...p.draft, enviando: false, error: data.error || ('Error ' + res.status), yaAbierta: !!data.yaAbierta } }) : p)
        return
      }
      if (test) {
        setReclamPanel(p => p ? ({ ...p, draft: { ...p.draft, enviando: false, error: null, pruebaMsg: '✓ Prueba enviada a ' + (data.enviadoA || destino) } }) : p)
      } else {
        setReclamPanel(p => p ? ({ ...p, draft: { ...p.draft, enviando: false, enviado: true, error: null, confirmando: false, reenvio: !!data.reenvio } }) : p)
      }
    } catch (e) {
      setReclamPanel(p => p ? ({ ...p, draft: { ...p.draft, enviando: false, error: e.message } }) : p)
    }
  }

  if (status === 'loading' || accesoOk === null) return (<><TopNav /><div style={{ padding: 40, color: '#888' }}>Cargando…</div></>)
  if (accesoOk === false) return null

  const card = { background: '#fff', border: '1px solid #E8E6E0', borderRadius: 12, padding: 16, marginBottom: 16 }
  const input = { padding: '8px 10px', borderRadius: 7, border: '1px solid #E5E7EB', fontSize: 13, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }
  const lbl = { fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 1, lineHeight: 1.2 }
  const val = { fontSize: 13, color: '#1a1a2e', fontWeight: 600, lineHeight: 1.25 }
  const inEd = { ...input, padding: '4px 7px', fontSize: 12 }
  const inNum = { ...inEd, textAlign: 'right', width: 100 }

  // ───────── LISTA ─────────
  if (modo === 'lista') {
    const q = norm(busca)
    const valOrden = (key, r) => {
      if (key === 'fecha_entrega') return r.fecha_entrega || ''
      if (['resultado', 'reparaciones', 'garantia', 'balance', 'servicios'].includes(key)) return r[key] == null ? -Infinity : Number(r[key])
      const c = COLDEFS_T.find(x => x.key === key)
      return norm(c ? c.get(r) : (r[key] || ''))
    }
    let rows = listaIds.filter(r => {
      for (const c of COLDEFS_T) {
        const f = filters[c.key]; if (!f) continue
        const val = String(c.get(r) ?? '')
        if (f.text && !val.toLowerCase().includes(f.text.toLowerCase())) return false
        if (f.sel && f.sel.length && !f.sel.includes(val)) return false
      }
      if (q && !norm([r.idadmon, r.arrendatario, r.inmueble].join(' ')).includes(q)) return false
      return true
    }).sort((a, b) => {
      const va = valOrden(orden.key, a), vb = valOrden(orden.key, b)
      let cmp = va < vb ? -1 : va > vb ? 1 : 0
      if (cmp === 0) cmp = norm(a.idadmon) < norm(b.idadmon) ? -1 : (norm(a.idadmon) > norm(b.idadmon) ? 1 : 0)
      return orden.dir === 'desc' ? -cmp : cmp
    })
    const estSel = (filters.estado && filters.estado.sel) || []
    const estadoLbl = estSel.length ? estSel.join(', ') : 'todos'
    const exportar = async () => {
      if (!rows.length) return
      const XLSX = await import('xlsx')
      const filas = rows.map(r => ({
        IDADMON: r.idadmon || '',
        'F. Entrega': r.fecha_entrega ? fmtFecha(r.fecha_entrega) : '',
        Propietario: r.propietario || '',
        Arrendatario: r.arrendatario || '',
        Inmueble: r.inmueble || '',
        Estado: r.estado || '',
        'Garantía entregada': r.garantia == null ? '' : Math.round(Number(r.garantia)),
        'Quién la tiene': r.quien || '',
        'Datos económicos': r.balance == null ? '' : Math.round(Number(r.balance)),
        'Total servicios': r.servicios == null ? '' : Math.round(Number(r.servicios)),
        'Total reparaciones': r.reparaciones == null ? '' : Math.round(Number(r.reparaciones)),
        'Resultado término': r.resultado == null ? '' : Math.round(Number(r.resultado)),
      }))
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), 'Terminos')
      const sello = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(wb, `Terminos-${sello}.xlsx`)
    }
    return (
      <>
        <TopNav />
        <div style={{ maxWidth: 1600, margin: '0 auto', padding: 24, fontFamily: '"DM Sans", sans-serif' }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', margin: '0 0 6px' }}>Términos</h1>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>Panel de término · arriendo, descuentos, presupuesto y workflow</div>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Búsqueda rápida…" style={{ ...input, marginBottom: 14, maxWidth: 520 }} />
          {!listaCargada ? <div style={{ color: '#888' }}>Cargando…</div> : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: '#888' }}>{rows.length} resultado{rows.length === 1 ? '' : 's'} · estado: <b>{estadoLbl}</b></div>
                <button onClick={exportar} disabled={!rows.length} title="Exporta a Excel lo que ves filtrado"
                  style={{ fontSize: 12, fontWeight: 700, padding: '7px 14px', borderRadius: 8, border: '1px solid #D3D1C7', background: '#fff', color: rows.length ? '#185FA5' : '#B4B2A9', cursor: rows.length ? 'pointer' : 'default', fontFamily: 'inherit' }}>⬇ Exportar a Excel</button>
              </div>
              <div style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 12, overflow: 'visible' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead><tr>
                    {COLDEFS_T.map(c => (
                      <th key={c.key} style={{ position: 'sticky', top: 52, zIndex: 20, background: '#FAFAF8', borderBottom: '1px solid #E8E6E0', padding: '10px 12px', textAlign: c.alignR ? 'right' : 'left', whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: .5 }}>
                          <span>{c.label}</span>
                          <HeaderFilterT col={c} movs={listaIds} state={filters[c.key]} setState={(v) => setFilters(f => ({ ...f, [c.key]: v }))} open={openFilter} setOpen={setOpenFilter} orden={orden} setOrden={setOrden} />
                        </span>
                      </th>
                    ))}<th style={{ position: 'sticky', top: 52, zIndex: 20, background: '#FAFAF8', borderBottom: '1px solid #E8E6E0', width: 1 }}></th>
                  </tr></thead>
                  <tbody>
                    {rows.length === 0 ? <tr><td colSpan={13} style={{ padding: 30, textAlign: 'center', color: '#888' }}>Sin resultados.</td></tr>
                      : rows.map(r => (
                        <tr key={r.idadmon} style={{ borderBottom: '1px solid #F3F4F6' }}>
                          <td style={{ padding: '10px 12px' }}><span onClick={() => abrir(r.idadmon)} title="Abrir término" style={{ color: '#185FA5', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>{r.idadmon}</span></td>
                          <td style={{ padding: '10px 12px', color: '#555', whiteSpace: 'nowrap' }}>{r.fecha_entrega ? fmtFecha(r.fecha_entrega) : '—'}</td>
                          <td style={{ padding: '10px 12px', color: '#1a1a2e' }}>{r.propietario || '—'}</td>
                          <td style={{ padding: '10px 12px', color: '#1a1a2e' }}>{r.arrendatario || '—'}</td>
                          <td style={{ padding: '10px 12px', color: '#555' }}>{r.inmueble || '—'}</td>
                          <td style={{ padding: '10px 12px', color: '#888' }}>{r.estado || '—'}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap', color: '#1a1a2e', fontWeight: 600 }}>{r.garantia == null ? '—' : fmtPesos(r.garantia)}</td>
                          <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 600, color: r.quien ? '#374151' : '#bbb' }}>{r.quien || '—'}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap', color: '#555' }}>{r.balance == null ? '—' : fmtPesos(r.balance)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap', color: '#555' }}>{r.servicios == null ? '—' : fmtPesos(r.servicios)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap', color: '#555' }}>{r.reparaciones == null ? '—' : fmtPesos(r.reparaciones)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700, color: r.resultado == null ? '#bbb' : (Number(r.resultado) < 0 ? '#dc2626' : '#16a34a') }}>{r.resultado == null ? '—' : fmtPesos(r.resultado)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}><button onClick={() => abrir(r.idadmon)} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, border: '1px solid #185FA5', background: '#E6F1FB', color: '#185FA5', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, whiteSpace: 'nowrap' }}>Abrir término →</button></td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </>
    )
  }

  // ───────── PANEL ─────────
  const A = panel?.arriendo
  const cargosProp = panel?.cargosProp || []   // reflejo: cargos al propietario derivados de este término
  const presupuestos = panel?.presupuestos || []
  const detalle = panel?.detalle || []
  const descuentos = panel?.descuentos || []
  const wfTasks = panel?.wfTasks || []
  const wfLogs = panel?.wfLogs || []
  // Último COMPLETADO por nodo -> quién (usuario) y comentario. La fecha se toma de fecha_cierre de la tarea.
  const logPorNodo = {}
  for (const lg of wfLogs) {
    if (String(lg.accion || '').toUpperCase() !== 'COMPLETADO') continue
    const k = lg.node_codigo
    const prev = logPorNodo[k]
    if (!prev) { logPorNodo[k] = lg; continue }
    const a = lg.created_at ? new Date(lg.created_at).getTime() : 0
    const b = prev.created_at ? new Date(prev.created_at).getTime() : 0
    if (a >= b) logPorNodo[k] = lg
  }
  const nodoNombre = {}; nodos.forEach(nn => { nodoNombre[nn.codigo] = nn.nombre })
  const repPresu = panel?.repPresu || 0
  const arreglosRef = panel?.arreglosRef || '0'
  const asociado = panel?.asociado || null
  const descResumen = panel?.descResumen || []
  // FILTRO "cerca del cierre": los descuentos INICIALES (de años atrás) no interesan en el término. Se conservan solo
  // los con F.Cont desde 2 meses ANTES de la fecha de entrega en adelante. Los descuentos SIN fecha (garantía y demás
  // estructurales) se mantienen siempre. Ancla = fecha de entrega (form.fecha_entrega; si no, termino_actual del contrato).
  const parseFechaDesc = s => {
    if (!s) return null
    let m = String(s).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return new Date(+m[1], +m[2] - 1, +m[3])
    m = String(s).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return new Date(+m[3], +m[2] - 1, +m[1])
    return null
  }
  const fEntregaStr = form?.fecha_entrega || (panel?.arriendo?.termino_actual ? String(panel.arriendo.termino_actual).slice(0, 10) : '')
  const fLimiteInf = (() => { const d = parseFechaDesc(fEntregaStr); if (!d) return null; const l = new Date(d); l.setMonth(l.getMonth() - 2); return l })()
  const cercaDelCierre = d => {
    if (!fLimiteInf) return true                 // sin fecha de entrega fiable: no filtramos (no romper la vista)
    const fc = parseFechaDesc(d.fecha_contable)
    if (!fc) return true                          // descuento sin fecha (garantía…): se mantiene
    return fc >= fLimiteInf
  }
  const ordenImputar = r => { const x = up(r.repercutir_a); if (!x) return 0; if (x.startsWith('T-')) return 1; if (x === 'PROPIETARIO') return 2; return 3 }
  const descResumenOrd = [...descResumen].filter(cercaDelCierre).sort((a, b) => ordenImputar(a) - ordenImputar(b) || (n0(a.num) - n0(b.num)))
  // Separar: los de ESTE término (idadmonSel) vs los del INMUEBLE SIGUIENTE (sucesor) — para chequeo de gastos compartidos
  const descDelTermino = descResumenOrd.filter(d => d.idadmon === idadmonSel)
  const descDelSucesor = descResumenOrd.filter(d => d.idadmon !== idadmonSel)
  const totDelTermino = descDelTermino.reduce((s, d) => s + n0(d.monto_a_imputar), 0)
  const quienGar = A?.quien_tiene_garantia || A?.garantia_con || '—'
  const garantiaVal = n0(A?.garantia_pedida)
  const R = panel ? calcResult(lineas, 0, garantiaVal, repPresu, quienGar) : null
  const etiq = R ? `T. ${R.conSaldo ? 'CON' : 'SIN'} SALDO - ${R.esFCR ? 'FCR' : 'DUEÑO'}` : ''
  const descGarantia = descuentos.filter(d => familiaDe(d.tipo) === 'garantia')
  const tareasPorNodo = {}; wfTasks.forEach(t => { tareasPorNodo[t.node_codigo] = t })
  let pasoActual = null
  for (const nd of nodos) { if (estadoTarea(tareasPorNodo[nd.codigo]) !== 'hecho') { pasoActual = nd; break } }
  // Paso HUMANO actual: primer nodo no-hecho cuyo tipo no sea AUTO (los AUTO se completan solos)
  let pasoHumano = null
  for (const nd of nodos) {
    if (estadoTarea(tareasPorNodo[nd.codigo]) === 'hecho') continue
    if (String(nd.tipo || '').toUpperCase() === 'AUTO') continue
    pasoHumano = nd; break
  }
  // ¿Es el turno de quien mira? Dirección/admin ve todo; si no, compara el área del nodo con su perfil.
  const esDireccion = rol === 'admin' || DIRECCION_EMAILS.includes(email)
  const puedeVerMarkup = esDireccion || FINANZAS_EMAILS.includes(email)  // Karina + Dirección ven/editan el markup
  // PDF del término y envío de correos: Dirección + Karina + Adalis + Fabiola (Administración). El PDF muestra precio
  // final (nunca el markup), por eso Adalis/Fabiola pueden generarlo aunque no vean/editen el % de markup.
  const puedeTerminoDocs = esDireccion || FINANZAS_EMAILS.includes(email) || ADMIN_EMAILS.includes(email)
  const areaDelUsuario = (session?.user?.area || '').toLowerCase()  // si existe; si no, Dirección ve todo igualmente
  const esMiTurno = (nd) => {
    if (!nd) return false
    if (esDireccion) return true
    const area = String(nd.area_responsable || '').toLowerCase()
    return areaDelUsuario && area.includes(areaDelUsuario)
  }

  // ── PDF profesional del término ──────────────────────────────────────────
  // Arma el documento con los MISMOS datos que se ven en pantalla (líneas, resultado, descuentos ya filtrados
  // a "cercanos al cierre") y lo abre para revisarlo. Solo Karina + Dirección (muestra presupuesto a precio cliente).
  async function generarPdfTerminoBtn(variante = 'arrendatario') {
    if (!puedeTerminoDocs || !panel) return
    setPdfTermGen(true); setMsg(null)
    try {
      const esProp = variante === 'propietario'
      const mkDef = (() => { const v = n0(form?.markup_fcr); return v > 0 ? v : 20 })()
      // Versión del PROPIETARIO: se EXCLUYEN las líneas marcadas (🚫 excluir_prop) y se recalcula su resultado.
      const inc = l => !(esProp && l.excluir_prop)
      const lg = (lineas.garantia || []).filter(inc)
      const ls = (lineas.servicios || []).filter(inc)
      const lr = (lineas.reparaciones || []).filter(inc)
      const Rv = calcResult({ garantia: lg, servicios: ls, reparaciones: lr }, 0, garantiaVal, repPresu, quienGar)
      // La AUTO ("Arreglos presupuesto") representa el presupuesto: si el propietario la excluye, no se muestra su detalle.
      const autoIncluida = lr.some(l => l.concepto === AUTO_CONCEPTO)
      const datos = {
        idadmon: idadmonSel,
        inmueble: A?.inmueble || '',
        arrendatario: A?.arrendatario || '',
        propietario: A?.propietario || '',
        fechaEntrega: form?.fecha_entrega ? fmtFecha(form.fecha_entrega) : '',
        garantia: { monto: garantiaVal, quien: quienGar },
        resultado: { tipo: Rv?.tipo || '', valor: Rv?.resultado || 0, label: (Rv?.resultado ?? 0) >= 0 ? 'A favor del arrendatario (a devolver)' : 'A cobrar al arrendatario' },
        datosEconomicos: lg.map(l => ({ concepto: l.concepto, monto: l.auto ? repPresu : n0(l.monto), comentario: l.comentario || '' })).filter(x => n0(x.monto) !== 0),
        servicios: ls.map(l => ({ concepto: l.concepto, monto: l.auto ? repPresu : n0(l.monto), comentario: l.comentario || '' })).filter(x => n0(x.monto) !== 0),
        reparaciones: {
          total: Rv?.sr || 0,
          lineas: lr.filter(l => l.concepto !== AUTO_CONCEPTO).map(l => ({ concepto: l.concepto, monto: n0(l.monto), comentario: l.comentario || '' })).filter(x => n0(x.monto) !== 0),
          presupuesto: autoIncluida ? { total: repPresu, detalle: (panel?.detalle || []).map(l => ({ descripcion: l.descripcion, importe: lineaConMarkup(l, mkDef).total })) } : { total: 0, detalle: [] },
        },
        // La GARANTÍA ya sale en la cabecera del PDF: se excluye de "Descuentos aplicados" (familia garantía o texto de garantía).
        descuentos: (descDelTermino || []).filter(dd => familiaDe(dd.tipo) !== 'garantia' && !/garant[ií]a/i.test(String(dd.texto_explicativo_para_carta_a_propietario || ''))).map(dd => ({ num: dd.num, fecha: fmtFecha(dd.fecha_contable), imputarA: dd.repercutir_a || '', monto: n0(dd.monto_a_imputar), comentario: dd.texto_explicativo_para_carta_a_propietario || '' })),
      }
      const res = await fetch('/api/terminos/generar-termino-pdf', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idadmon: idadmonSel, datos, variante }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setMsg({ tipo: 'error', txt: data.error || ('Error ' + res.status) }); return }
      const url = data.pdf_url || null
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
      setMsg({ tipo: 'ok', txt: url ? `PDF ${esProp ? 'del PROPIETARIO (sin las líneas marcadas)' : 'del arrendatario'} generado — abierto en otra pestaña para revisarlo.` : 'PDF generado.' })
    } catch (e) {
      setMsg({ tipo: 'error', txt: String(e?.message || e) })
    } finally {
      setPdfTermGen(false)
    }
  }
  // Etiqueta y color del tipo de nodo (AUTO / TAREA / VERIFICACION / DECISION)
  const tipoInfo = (tp) => {
    switch (String(tp || '').toUpperCase()) {
      case 'DECISION': return { txt: 'Decisión', bg: '#FEF3C7', col: '#92400e' }
      case 'VERIFICACION': return { txt: 'Verificar', bg: '#DBEAFE', col: '#1e40af' }
      case 'TAREA': return { txt: 'Tarea', bg: '#E5E7EB', col: '#374151' }
      case 'AUTO': return { txt: 'Auto', bg: '#F3F4F6', col: '#9ca3af' }
      default: return { txt: '', bg: '#F3F4F6', col: '#9ca3af' }
    }
  }
  // Nodos agrupados por etapa (para la vista de 6 etapas)
  const nodosPorEtapa = {}; nodos.forEach(nd => { (nodosPorEtapa[nd.etapa_numero] ??= []).push(nd) })

  const btn = (bg, dis) => ({ padding: '7px 12px', borderRadius: 7, border: 'none', background: dis ? '#cbd5e1' : bg, color: '#fff', fontSize: 12, fontWeight: 700, cursor: dis ? 'not-allowed' : 'pointer', fontFamily: 'inherit' })
  const th = { padding: '4px 6px', textAlign: 'left', fontSize: 9, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: .3 }
  const tdL = { padding: '4px 6px', fontSize: 12, color: '#374151' }
  const tdR = { padding: '4px 6px', fontSize: 12, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600 }

  function renderBloque(bk, titulo, headColor, bg, bd, subtitulo) {
    const rows = lineas[bk] || []
    return (
      <div style={{ background: bg, border: '1px solid ' + bd, borderRadius: 10, padding: 12, marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: headColor, textTransform: 'uppercase', marginBottom: subtitulo ? 2 : 8 }}>{titulo}</div>
        {subtitulo && <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 8 }}>{subtitulo}</div>}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={th}>Concepto</th><th style={{ ...th, textAlign: 'right' }}>Cantidad</th><th style={th}>Comentarios</th><th style={th}>Ref</th><th style={{ ...th, width: 58, textAlign: 'center' }} title="Excluir esta línea de la liquidación del PROPIETARIO">Excl. prop.</th>{editando && <th style={{ width: 18 }}></th>}
          </tr></thead>
          <tbody>
            {rows.filter(l => editando || !l.es_fijo || l.auto || n0(l.monto) !== 0 || (l.comentario && l.comentario.trim()) || (l.ref && String(l.ref).trim())).map((l, idx0) => {
              const idx = rows.indexOf(l)
              return (
              <tr key={idx} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                <td style={tdL}>{(!l.es_fijo && editando) ? <input style={{ ...inEd, fontSize: 11, minWidth: 110 }} value={l.concepto} placeholder="(concepto)" onChange={e => setLinea(bk, idx, 'concepto', e.target.value)} /> : (l.concepto || '—')}</td>
                <td style={tdR}>{l.auto ? fmtPesos(repPresu) : (editando ? <input style={inNum} type="number" value={l.monto} onChange={e => setLinea(bk, idx, 'monto', e.target.value)} /> : fmtPesos(n0(l.monto)))}</td>
                <td style={tdL}>{editando ? <input style={{ ...inEd, fontSize: 11 }} value={l.comentario} onChange={e => setLinea(bk, idx, 'comentario', e.target.value)} /> : (l.comentario || '')}</td>
                <td style={{ ...tdL, color: '#9ca3af', width: 82 }}>{l.auto ? ('Pres. ' + arreglosRef) : (editando ? <input style={{ ...inEd, fontSize: 11, width: 72 }} value={l.ref} onChange={e => setLinea(bk, idx, 'ref', e.target.value)} /> : (l.ref || ''))}</td>
                <td style={{ textAlign: 'center', width: 58 }}>
                  {editando
                    ? <input type="checkbox" checked={!!l.excluir_prop} onChange={e => setLinea(bk, idx, 'excluir_prop', e.target.checked)} title="No incluir esta línea en el PDF/correo del propietario" />
                    : (l.excluir_prop ? <span title="Excluida de la liquidación del propietario" style={{ color: '#b45309', fontSize: 12 }}>🚫</span> : '')}
                </td>
                {editando && <td style={{ textAlign: 'center' }}>{!l.es_fijo ? <button onClick={() => removeLinea(bk, idx)} style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>×</button> : null}</td>}
              </tr>
              )
            })}
          </tbody>
        </table>
        {editando && <button onClick={() => addLinea(bk)} style={{ marginTop: 8, fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px dashed ' + bd, background: '#fff', color: headColor, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>+ línea</button>}
      </div>
    )
  }

  return (
    <>
      <TopNav />
      <style>{`
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: 18, fontFamily: '"DM Sans", sans-serif' }}>
        {/* B1 — cabecera fija al hacer scroll (debajo del TopNav, que mide 52px) */}
        <div style={{ position: 'sticky', top: 52, zIndex: 50, background: '#f4f6f9', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 12, padding: '12px 0', borderBottom: '1px solid #E8E6E0' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: .5 }}>Término</span>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1a1a2e', margin: 0 }}>{idadmonSel}</h1>
            <span style={{ fontSize: 13, color: '#666' }}>{A?.inmueble || '—'}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button onClick={abrirBorradores} style={btn('#2563eb')}>✉ Enviar Email</button>
            <button onClick={puedeTerminoDocs ? generarYEnviarPresupuesto : undefined} disabled={!puedeTerminoDocs || presuGen}
              title={puedeTerminoDocs ? 'Genera el PDF del presupuesto (descargable) y abre el email para enviarlo' : 'Solo Dirección, Karina, Adalis y Fabiola pueden generar/enviar presupuestos'}
              style={btn('#7c3aed', !puedeTerminoDocs || presuGen)}>{presuGen ? 'Generando…' : 'Enviar Presupuesto'}</button>
            <button onClick={puedeTerminoDocs ? () => generarPdfTerminoBtn('arrendatario') : undefined} disabled={!puedeTerminoDocs || pdfTermGen}
              title={puedeTerminoDocs ? 'PDF de la liquidación para el ARRENDATARIO (todas las líneas)' : 'Solo Dirección, Karina, Adalis y Fabiola pueden generar el PDF'}
              style={btn('#0891b2', !puedeTerminoDocs || pdfTermGen)}>{pdfTermGen ? '…' : '🧾 PDF arrendatario'}</button>
            <button onClick={puedeTerminoDocs ? () => generarPdfTerminoBtn('propietario') : undefined} disabled={!puedeTerminoDocs || pdfTermGen}
              title={puedeTerminoDocs ? 'PDF para el PROPIETARIO — excluye las líneas marcadas con 🚫 y recalcula su resultado' : 'Solo Dirección, Karina, Adalis y Fabiola pueden generar el PDF'}
              style={btn('#0e7490', !puedeTerminoDocs || pdfTermGen)}>{pdfTermGen ? '…' : '🧾 PDF propietario'}</button>
            <button onClick={abrirReclamacion} style={btn('#dc2626')}>Hacer Reclamación</button>
            <button onClick={() => router.push('/admin?idadmon=' + idadmonSel + '&volver=termino')} title="Cambiar el estado del término (Q → N / N-Liquidación / N-DICOM; SQ → Q). Abre el LOG con este IDADMON ya cargado, con sus mismas restricciones. Al salir vuelve aquí." style={btn('#0f766e')}>Cambiar estado →</button>
            {!editando ? <button onClick={() => { setEditando(true); setMsg(null) }} style={btn('#185FA5')}>✎ Editar</button>
              : <button onClick={guardar} disabled={guardando} style={btn('#16a34a', guardando)}>{guardando ? 'Guardando…' : '✔ Guardar'}</button>}
            {!editando && <button onClick={() => abrir(idadmonSel)} disabled={loadingPanel}
              title="Vuelve a leer cuentas, descuentos y servicios y recalcula el balance del arrendatario"
              style={{ ...input, width: 'auto', cursor: loadingPanel ? 'wait' : 'pointer', background: '#EEF2FF', color: '#3730A3', fontWeight: 700 }}>{loadingPanel ? '…' : '🔄 Recargar'}</button>}
            <button onClick={() => { setModo('lista'); setPanel(null); setEditando(false) }} style={{ ...input, width: 'auto', cursor: 'pointer', background: '#F0EEE8' }}>← Volver</button>
          </div>
        </div>
        {msg && <div style={{ ...card, padding: 10, marginBottom: 12, background: msg.tipo === 'error' ? '#fef2f2' : '#f0fdf4', color: msg.tipo === 'error' ? '#dc2626' : '#16a34a' }}>{msg.txt}</div>}

        {emailPanel && (
          <div style={{ ...card, border: '2px solid #2563eb', background: '#F5F8FF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#1a1a2e' }}>✉ Notificación de liquidación — borradores editables</div>
              <button onClick={() => setEmailPanel(null)} style={{ ...input, width: 'auto', cursor: 'pointer', background: '#fff' }}>Cerrar ✕</button>
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 12 }}>Revisa y edita cada correo antes de enviarlo. Sale desde info@fondocapital.com con copia a administración@; si alguien responde, le llega a ti (reply-to). Nada se envía sin tu clic.</div>
            {emailPanel.loading ? <div style={{ color: '#888', fontSize: 13 }}>Cargando borradores…</div> : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {['arrendatario', 'propietario'].map(dest => {
                  const dr = emailPanel.drafts?.[dest]
                  const titulo = dest === 'arrendatario' ? 'Ex-arrendatario' : 'Propietario'
                  if (!dr) return <div key={dest} style={{ ...card, marginBottom: 0 }}>Sin datos.</div>
                  return (
                    <div key={dest} style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 10, padding: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', marginBottom: 8 }}>{titulo}</div>
                      {dr.enviado ? (
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#16a34a', padding: '10px 0' }}>✓ Enviado a {dr.to}</div>
                      ) : (
                        <>
                          {dr.error && <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 8, background: '#fef2f2', padding: 8, borderRadius: 6 }}>{dr.error}</div>}
                          {dr.pruebaMsg && <div style={{ fontSize: 12, color: '#16a34a', marginBottom: 8, background: '#F0FDF4', padding: 8, borderRadius: 6, fontWeight: 700 }}>{dr.pruebaMsg}</div>}
                          {dr.sinEmail && !dr.error && <div style={{ fontSize: 11, color: '#b45309', marginBottom: 8 }}>⚠ No hay email en la ficha. Escríbelo a mano abajo.</div>}
                          <div style={lbl}>Para</div>
                          <input style={{ ...inEd, marginBottom: 8 }} value={dr.to} onChange={e => setDraft(dest, 'to', e.target.value)} placeholder="correo@…" />
                          <div style={lbl}>Asunto</div>
                          <input style={{ ...inEd, marginBottom: 8 }} value={dr.subject} onChange={e => setDraft(dest, 'subject', e.target.value)} />
                          <div style={lbl}>Cuerpo</div>
                          <textarea style={{ ...inEd, minHeight: 220, resize: 'vertical', fontFamily: 'monospace', whiteSpace: 'pre' }} value={dr.cuerpo} onChange={e => setDraft(dest, 'cuerpo', e.target.value)} />

                          {/* PRUEBA: manda este borrador a la dirección que elijas (por defecto la tuya). No toca al destinatario real. */}
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 10 }}>
                            <input style={{ ...inEd, flex: 1, marginBottom: 0 }} value={testTo} onChange={e => setTestTo(e.target.value)} placeholder="correo de prueba" />
                            <button onClick={() => enviarBorrador(dest, { test: true })} disabled={dr.enviando}
                              title="Envía este borrador a la dirección de prueba (no al destinatario real)"
                              style={{ ...btn('#6b7280', dr.enviando), width: 'auto', whiteSpace: 'nowrap' }}>🧪 Prueba</button>
                          </div>

                          {/* ENVÍO REAL con DOBLE confirmación: ver → confirmar/volver. Nada sale sin este segundo clic. */}
                          {!dr.confirmando ? (
                            <button onClick={() => { setDraft(dest, 'error', null); setDraft(dest, 'confirmando', true) }} disabled={dr.enviando}
                              style={{ ...btn('#2563eb', dr.enviando), marginTop: 8, width: '100%' }}>✉ Enviar a {titulo}</button>
                          ) : (
                            <div style={{ marginTop: 8, border: '1px solid #f59e0b', background: '#fffbeb', borderRadius: 8, padding: 10 }}>
                              <div style={{ fontSize: 12, color: '#92400e', fontWeight: 800, marginBottom: 6 }}>⚠ Vas a enviar este correo DE VERDAD a:</div>
                              <div style={{ fontSize: 13, color: '#1a1a2e', marginBottom: 2, fontWeight: 700 }}>{dr.to || '(sin destinatario)'}</div>
                              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>En copia: administración@{dest === 'arrendatario' ? ' y al aval (si tiene email en ficha)' : ''}. Revisa el correo de arriba antes de confirmar.</div>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={() => enviarBorrador(dest, { test: false })} disabled={dr.enviando} style={{ ...btn('#16a34a', dr.enviando), flex: 1 }}>{dr.enviando ? 'Enviando…' : '✓ Confirmar y enviar'}</button>
                                <button onClick={() => setDraft(dest, 'confirmando', false)} disabled={dr.enviando} style={{ ...btn('#6b7280', dr.enviando), flex: 1 }}>← Volver</button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {reclamPanel && (
          <div style={{ ...card, maxWidth: 780, borderColor: '#cbd5e1', background: '#F8FAFC' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#1e293b' }}>⚖ Reclamación de saldo pendiente</div>
              <button onClick={() => setReclamPanel(null)} style={{ ...input, width: 'auto', cursor: 'pointer', background: '#fff' }}>Cerrar ✕</button>
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>Un solo correo al ex-arrendatario, con copia al aval (si existe) y a administración@. No cambia el estado del contrato; abre una reclamación que cierra Cobranzas al pagar. Nada se envía sin tu doble confirmación.</div>
            {reclamPanel.loading ? <div style={{ color: '#888', fontSize: 13 }}>Cargando borrador…</div>
              : reclamPanel.aviso ? <div style={{ fontSize: 13, color: '#b45309', background: '#FFFBEB', border: '1px solid #FDE68A', padding: 10, borderRadius: 8 }}>{reclamPanel.aviso}</div>
              : reclamPanel.draft ? (
                reclamPanel.draft.enviado ? (
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#16a34a', padding: '10px 0' }}>✓ Reclamación {reclamPanel.draft.reenvio ? 'reenviada' : 'enviada'} a {reclamPanel.draft.to}{reclamPanel.draft.cc ? ' (cc ' + reclamPanel.draft.cc + ')' : ''}</div>
                ) : (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#334155', marginBottom: 10 }}>Saldo a reclamar: <span style={{ color: '#9B1C1C' }}>{fmtPesos(reclamPanel.draft.saldo)}</span></div>
                    {reclamPanel.draft.pruebaMsg && <div style={{ fontSize: 12, color: '#16a34a', marginBottom: 8, background: '#F0FDF4', padding: 8, borderRadius: 6, fontWeight: 700 }}>{reclamPanel.draft.pruebaMsg}</div>}
                    {reclamPanel.draft.error && (
                      <div style={{ fontSize: 12, color: '#9B1C1C', marginBottom: 8, background: '#fef2f2', padding: 8, borderRadius: 6 }}>
                        {reclamPanel.draft.error}
                        {reclamPanel.draft.yaAbierta && <button onClick={() => enviarReclamacion(true)} disabled={reclamPanel.draft.enviando} style={{ ...btn('#334155', reclamPanel.draft.enviando), marginLeft: 8, padding: '3px 8px' }}>↻ Reenviar de todas formas</button>}
                      </div>
                    )}
                    {reclamPanel.draft.sinEmail && !reclamPanel.draft.error && <div style={{ fontSize: 11, color: '#b45309', marginBottom: 8 }}>⚠ El arrendatario no tiene email en la ficha. Escríbelo a mano abajo.</div>}
                    {!reclamPanel.draft.hayAval && !reclamPanel.draft.error && <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>Sin avalista registrado: se envía solo al arrendatario (puedes añadir copias a mano).</div>}
                    <div style={lbl}>Para (arrendatario)</div>
                    <input style={{ ...inEd, marginBottom: 8 }} value={reclamPanel.draft.to} onChange={e => setReclam('to', e.target.value)} placeholder="correo@…" />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={lbl}>Cc — copias visibles (aval, etc.)</div>
                        <input style={{ ...inEd, marginBottom: 8 }} value={reclamPanel.draft.cc} onChange={e => setReclam('cc', e.target.value)} placeholder="correo1, correo2…" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={lbl}>Cco — copias ocultas</div>
                        <input style={{ ...inEd, marginBottom: 8 }} value={reclamPanel.draft.bcc} onChange={e => setReclam('bcc', e.target.value)} placeholder="no visibles para los demás…" />
                      </div>
                    </div>
                    <div style={lbl}>Asunto</div>
                    <input style={{ ...inEd, marginBottom: 8 }} value={reclamPanel.draft.subject} onChange={e => setReclam('subject', e.target.value)} />
                    <div style={lbl}>Cuerpo</div>
                    <textarea style={{ ...inEd, minHeight: 240, resize: 'vertical', fontFamily: 'monospace', whiteSpace: 'pre' }} value={reclamPanel.draft.cuerpo} onChange={e => setReclam('cuerpo', e.target.value)} />

                    {/* PRUEBA interna: manda una copia a tu correo (o al que pongas), sin enviar al arrendatario ni al aval. */}
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 10 }}>
                      <input style={{ ...inEd, flex: 1, marginBottom: 0 }} value={testTo} onChange={e => setTestTo(e.target.value)} placeholder="correo de prueba" />
                      <button onClick={() => enviarReclamacion(false, { test: true })} disabled={reclamPanel.draft.enviando} title="Envía una copia de prueba (no al arrendatario ni al aval)" style={{ ...btn('#6b7280', reclamPanel.draft.enviando), width: 'auto', whiteSpace: 'nowrap' }}>🧪 Prueba</button>
                    </div>

                    {/* ENVÍO REAL con DOBLE confirmación */}
                    {!reclamPanel.draft.confirmando ? (
                      <button onClick={() => { setReclam('error', null); setReclam('confirmando', true) }} disabled={reclamPanel.draft.enviando} style={{ ...btn('#334155', reclamPanel.draft.enviando), marginTop: 8, width: '100%' }}>⚖ Enviar reclamación</button>
                    ) : (
                      <div style={{ marginTop: 8, border: '1px solid #94a3b8', background: '#F1F5F9', borderRadius: 8, padding: 10 }}>
                        <div style={{ fontSize: 12, color: '#334155', fontWeight: 800, marginBottom: 6 }}>⚠ Vas a enviar esta reclamación DE VERDAD a:</div>
                        <div style={{ fontSize: 13, color: '#1e293b', marginBottom: 2, fontWeight: 700 }}>{reclamPanel.draft.to || '(sin destinatario)'}</div>
                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>Cc: {reclamPanel.draft.cc || '(ninguna)'} + administración@{reclamPanel.draft.bcc ? ' · Cco: ' + reclamPanel.draft.bcc : ''}. Revisa el correo antes de confirmar.</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => enviarReclamacion(false, { test: false })} disabled={reclamPanel.draft.enviando} style={{ ...btn('#334155', reclamPanel.draft.enviando), flex: 1 }}>{reclamPanel.draft.enviando ? 'Enviando…' : '✓ Confirmar y enviar'}</button>
                          <button onClick={() => setReclam('confirmando', false)} disabled={reclamPanel.draft.enviando} style={{ ...btn('#6b7280', reclamPanel.draft.enviando), flex: 1 }}>← Volver</button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              ) : null}
          </div>
        )}

        {loadingPanel || !panel ? <div style={{ ...card, color: '#888' }}>Cargando término…</div>
          : !A ? <div style={{ ...card, color: '#b91c1c' }}>No se encontró {idadmonSel} en datos_arriendos.</div>
            : (
              <>
                <div style={{ ...card, display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', gap: 16, alignItems: 'center' }}>
                  <div><div style={lbl}>Estado del término</div><div style={{ fontSize: 17, fontWeight: 800, color: R.conSaldo ? '#16a34a' : '#dc2626' }}>{etiq}</div></div>
                  <div><div style={lbl}>Resultado del término</div><div style={{ fontSize: 20, fontWeight: 800, color: R.resultado < 0 ? '#dc2626' : '#16a34a' }}>{fmtPesos(R.resultado)} <span style={{ fontSize: 11, fontWeight: 500, color: '#888' }}>{R.resultado < 0 ? 'a cobrar' : 'a devolver'}</span></div></div>
                  <div><div style={lbl}>Quién tiene la garantía</div><div style={{ ...val, fontSize: 16 }}>{quienGar}</div></div>
                  <div><div style={lbl}>Garantía entregada</div><div style={{ ...val, fontSize: 16 }}>{fmtPesos(garantiaVal)}</div></div>
                </div>
                <div style={{ ...card, padding: 10, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px 14px' }}>
                  <div><div style={lbl}>Arrendatario</div><div style={val}>{A.arrendatario || '—'}</div><div style={{ fontSize: 11, color: '#888' }}>{A.movil || ''} {A.mail_arrendatario || ''}</div></div>
                  <div><div style={lbl}>Aval</div><div style={val}>{A.avalista || '—'}</div><div style={{ fontSize: 11, color: '#888' }}>{A.telefono_avalista || ''}</div></div>
                  <div><div style={lbl}>Propietario</div><div style={val}>{A.propietario || '—'}</div></div>
                  <div><div style={lbl}>Estado (LOG)</div><div style={{ ...val, display: 'inline-block', padding: '2px 10px', borderRadius: 6, fontWeight: 700, background: '#EEF2FF', color: '#3730a3', border: '1px solid #C7D2FE' }}>{A.estado || '—'}</div></div>
                  <div><div style={lbl}>Fecha de entrega</div>{editando ? <input type="date" style={inEd} value={form.fecha_entrega} onChange={e => setF('fecha_entrega', e.target.value)} /> : <div style={val}>{fmtFecha(form.fecha_entrega)}</div>}</div>
                  <div><div style={lbl}>Valoración legal</div>{editando ? <input style={inEd} value={form.valoracion_legal} onChange={e => setF('valoracion_legal', e.target.value)} /> : <div style={val}>{form.valoracion_legal || '—'}</div>}</div>
                  <div><div style={lbl}>Decisión actuación</div>{editando ? <input style={inEd} value={form.decision_actuacion} onChange={e => setF('decision_actuacion', e.target.value)} /> : <div style={val}>{form.decision_actuacion || '—'}</div>}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div><div style={lbl}>Cont. Agua</div>{editando ? <input style={inEd} value={form.lectura_agua} onChange={e => setF('lectura_agua', e.target.value)} /> : <div style={val}>{form.lectura_agua || '—'}</div>}</div>
                    <div><div style={lbl}>Cont. Luz</div>{editando ? <input style={inEd} value={form.lectura_luz} onChange={e => setF('lectura_luz', e.target.value)} /> : <div style={val}>{form.lectura_luz || '—'}</div>}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 16, alignItems: 'start' }}>
                  {/* COLUMNA IZQUIERDA: Excel del término + resultado + estado proceso */}
                  <div>
                    {/* Garantía (mismo formato que el resultado; rojo si no es FCR) */}
                    {(() => {
                      const garFCR = esGarantiaFCR(quienGar)   // match EXACTO (mismo bug que en calcResult)
                      const garColor = garFCR ? '#185FA5' : '#dc2626'
                      const garBg = garFCR ? '#EAF2FB' : '#FDECEC'
                      return (
                        <div style={{ background: garBg, border: '2px solid ' + garColor, borderRadius: 10, padding: '14px 16px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: '#1a1a2e', textTransform: 'uppercase', letterSpacing: .5 }}>Garantía entregada</div>
                            <div style={{ fontSize: 13, fontWeight: 800, marginTop: 2, color: garColor }}>Quién la tiene: {quienGar}</div>
                          </div>
                          <div style={{ fontSize: 30, fontWeight: 800, color: garColor }}>{fmtPesos(garantiaVal)}</div>
                        </div>
                      )
                    })()}

                    {/* Compuerta de reversión: si la garantía la tiene el DUEÑO, no se libera la
                        liquidación hasta comunicar la reversión a FCR. Guardia visible (Etapa 4). */}
                    {(() => {
                      const garFCR = esGarantiaFCR(quienGar)
                      if (garFCR || garantiaVal <= 0) return null   // FCR la tiene, o no hay garantía → sin compuerta
                      return (
                        <div style={{ background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#8a5a00' }}>
                          <b>⚠ Compuerta de reversión de garantía.</b> La garantía la tiene el <b>propietario</b> ({quienGar}).
                          No se libera la liquidación hasta comunicar la reversión a FCR (email al propietario) y/o cargarla
                          al siguiente arriendo. El botón para proponer ese email queda pendiente de su endpoint.
                        </div>
                      )
                    })()}

                    {renderBloque('garantia', 'Datos económicos', '#185FA5', '#EAF2FB', '#CBE0F5')}
                    {renderBloque('servicios', 'Servicios', '#185FA5', '#F2F8FE', '#D8E9F8', 'Servicios del término (desde descuentos)')}
                    {renderBloque('reparaciones', 'Reparaciones', '#b45309', '#FCF4E7', '#F1E0BD')}

                    {/* RESULTADO resaltado (estilo Excel) */}
                    <div style={{ background: R.resultado < 0 ? '#FDECEC' : '#ECFDF3', border: '2px solid ' + (R.resultado < 0 ? '#dc2626' : '#16a34a'), borderRadius: 10, padding: '14px 16px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#1a1a2e', textTransform: 'uppercase', letterSpacing: .5 }}>Resultado del término</div>
                        <div style={{ fontSize: 11, color: '#777' }}>(si + transferir, si − reclamar)</div>
                        <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2, color: R.conSaldo ? '#16a34a' : '#dc2626' }}>{etiq} · {R.resultado < 0 ? 'a cobrar al arrendatario' : 'a devolver'}</div>
                      </div>
                      <div style={{ fontSize: 30, fontWeight: 800, color: R.resultado < 0 ? '#dc2626' : '#16a34a' }}>{fmtPesos(R.resultado)}</div>
                    </div>

                    {/* Reflejo: cargos al propietario derivados de este término */}
                    {cargosProp.length > 0 && (
                      <div style={{ background: '#F0FDF4', border: '1px solid #16a34a', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12.5, color: '#166534' }}>
                        <div style={{ fontWeight: 800, marginBottom: 4 }}>✓ Cargado al propietario ({cargosProp.length})</div>
                        {cargosProp.map((c, i) => (
                          <div key={i} style={{ display: 'flex', gap: 8, padding: '2px 0' }}>
                            <span style={{ fontWeight: 700, minWidth: 44 }}>Nº {c.num}</span>
                            <span style={{ fontFamily: 'monospace', minWidth: 90, textAlign: 'right' }}>{fmtPesos(c.monto)}</span>
                            <span style={{ color: '#166534' }}>→ {c.idadmon}{c.mes ? ` (${c.mes})` : ''}{c.texto ? ` · ${String(c.texto).slice(0, 60)}` : ''}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ESTADO DEL PROCESO — barra de 6 etapas + acción actual (lo justo para actuar) */}
                    <div style={card}>
                      {nodos.length === 0 ? <div style={{ color: '#888', fontSize: 12 }}>Cargando proceso…</div>
                        : !wfTasks.length ? <div style={{ color: '#9ca3af', fontSize: 12 }}>Sin instancia de workflow para este IDADMON.</div>
                          : (() => {
                            const etapaActual = pasoHumano ? pasoHumano.etapa_numero : (pasoActual ? pasoActual.etapa_numero : 5)
                            const listaEt = etapas.length ? etapas : [...Array(6)].map((_, i) => ({ numero: i, nombre: 'Etapa ' + i }))
                            return (
                              <>
                                {/* Barra de 6 etapas */}
                                <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                                  {listaEt.map(et => {
                                    const done = et.numero < etapaActual
                                    const now = et.numero === etapaActual
                                    return (
                                      <div key={et.numero} title={`${et.numero}. ${et.nombre}`} style={{ flex: 1, height: 6, borderRadius: 3, background: done ? '#16a34a' : now ? '#185FA5' : '#E5E7EB' }} />
                                    )
                                  })}
                                </div>
                                <div style={{ fontSize: 11, color: '#888', marginBottom: 10 }}>
                                  Etapa {etapaActual} de 5 · <b style={{ color: '#185FA5' }}>{(listaEt.find(e => e.numero === etapaActual) || {}).nombre || '—'}</b>
                                </div>

                                {/* Tarjeta de acción: qué toca ahora */}
                                {!pasoHumano ? (
                                  <div style={{ fontSize: 13, color: '#16a34a', fontWeight: 700, padding: 8, background: '#F0FDF4', borderRadius: 8 }}>✓ Proceso completado</div>
                                ) : esMiTurno(pasoHumano) ? (
                                  <div style={{ padding: 12, background: '#EAF2FB', borderRadius: 8, border: '1px solid #C9DEF5' }}>
                                    <div style={{ fontSize: 10, color: '#185FA5', fontWeight: 800, textTransform: 'uppercase', letterSpacing: .5 }}>Ahora te toca a ti</div>
                                    <div style={{ fontSize: 15, fontWeight: 800, color: '#1a1a2e', margin: '3px 0' }}>{pasoHumano.nombre}{pasoHumano.bloquea_cierre ? <span title="Control anti-pérdida" style={{ color: '#dc2626', marginLeft: 6, fontSize: 12 }}>● crítico</span> : null}</div>
                                    {pasoHumano.descripcion && <div style={{ fontSize: 12, color: '#555', marginBottom: 8 }}>{pasoHumano.descripcion}</div>}
                                    <button onClick={() => completarPaso(pasoHumano)} disabled={completandoWf} style={{ marginTop: 4, fontSize: 13, fontWeight: 700, padding: '8px 18px', borderRadius: 6, border: 'none', background: completandoWf ? '#9ca3af' : '#185FA5', color: '#fff', cursor: completandoWf ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                                      {completandoWf ? 'Guardando…' : '✓ Hacer y avanzar'}
                                    </button>
                                  </div>
                                ) : (
                                  <div style={{ padding: 12, background: '#FAFAF8', borderRadius: 8, border: '1px solid #EEE' }}>
                                    <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>Esperando a otro equipo</div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: '#666', margin: '3px 0' }}>{pasoHumano.nombre}</div>
                                    <div style={{ fontSize: 12, color: '#999' }}>Responsable: {pasoHumano.area_responsable}</div>
                                  </div>
                                )}

                                {/* Detalle completo, plegado */}
                                <div style={{ marginTop: 10 }}>
                                  <span onClick={() => setWfExpandido(x => !x)} style={{ fontSize: 11, color: '#9ca3af', cursor: 'pointer', fontWeight: 600 }}>{wfExpandido ? '▾ Ocultar el proceso completo' : '▸ Ver el proceso completo (6 etapas)'}</span>
                                </div>

                                {wfExpandido && listaEt.map(et => {
                                  const nds = nodosPorEtapa[et.numero] || []
                                  if (!nds.length) return null
                                  const hechos = nds.filter(nd => estadoTarea(tareasPorNodo[nd.codigo]) === 'hecho').length
                                  return (
                                    <div key={et.numero} style={{ marginTop: 8 }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3, paddingBottom: 2, borderBottom: '1px solid #E8EEF6' }}>
                                        <span style={{ fontSize: 11, fontWeight: 800, color: '#185FA5' }}>{et.numero}. {et.nombre}{et.compuerta_dura ? ' 🔒' : ''}</span>
                                        <span style={{ fontSize: 10, color: '#9ca3af' }}>{hechos}/{nds.length}</span>
                                      </div>
                                      {nds.map(nd => {
                                        const t = tareasPorNodo[nd.codigo]; const st = estadoTarea(t)
                                        const dot = st === 'hecho' ? '#16a34a' : st === 'curso' ? '#2563eb' : '#d1d5db'
                                        const ti = tipoInfo(nd.tipo)
                                        const quienNodo = logPorNodo[nd.codigo]
                                        return (
                                          <div key={nd.codigo} style={{ padding: '2px 0' }}>
                                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                              <span style={{ width: 10, height: 10, borderRadius: '50%', background: dot, flexShrink: 0 }} />
                                              <span style={{ flex: 1, fontSize: 11, color: st === 'pendiente' ? '#9ca3af' : '#444' }}>{nd.nombre}{nd.bloquea_cierre ? <span style={{ color: '#dc2626', marginLeft: 3 }}>●</span> : null}</span>
                                              {ti.txt && <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 6, background: ti.bg, color: ti.col }}>{ti.txt}</span>}
                                            </div>
                                            {st === 'hecho' && (quienNodo || t?.fecha_cierre) && (
                                              <div style={{ fontSize: 9.5, color: '#16a34a', marginLeft: 16, marginTop: 1 }} title={quienNodo?.comentario || ''}>
                                                ✓ {quienNodo?.usuario ? nombreUsuario(quienNodo.usuario) : '—'}{t?.fecha_cierre ? ' · ' + fmtFecha(t.fecha_cierre) : ''}
                                              </div>
                                            )}
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )
                                })}
                              </>
                            )
                          })()}
                    </div>
                    <div style={card}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', marginBottom: 6 }}>Acciones realizadas</div>
                      {wfLogs.length === 0 ? <div style={{ fontSize: 12, color: '#9ca3af' }}>Aún no hay acciones registradas.</div> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {[...wfLogs].sort((a, b) => (b.created_at ? new Date(b.created_at).getTime() : 0) - (a.created_at ? new Date(a.created_at).getTime() : 0)).map((lg, i) => (
                            <div key={i} style={{ fontSize: 11, color: '#444', borderBottom: '1px solid #F3F4F6', paddingBottom: 3 }}>
                              <span style={{ color: '#16a34a', fontWeight: 700 }}>{nombreUsuario(lg.usuario)}</span> {String(lg.accion || '').toLowerCase()} <b>{nodoNombre[lg.node_codigo] || lg.node_codigo}</b>
                              {lg.created_at ? <span style={{ color: '#9ca3af' }}> · {fmtFecha(lg.created_at)}</span> : null}
                              {lg.comentario ? <div style={{ color: '#6b7280', fontStyle: 'italic' }}>{lg.comentario}</div> : null}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {descGarantia.length > 0 && (
                      <div style={{ ...card, padding: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', marginBottom: 6 }}>Movimientos de garantía (informativo, no suma)</div>
                        {descGarantia.map(d => <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0' }}><span style={{ color: '#555' }}>{d.texto_explicativo_para_carta_a_propietario || d.tipo} <span style={{ color: '#bbb' }}>Dto. {d.num}</span></span><span style={{ fontWeight: 600 }}>{fmtPesos(d.monto_a_imputar)}</span></div>)}
                      </div>
                    )}
                    <div style={card}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', marginBottom: 6 }}>Comentarios sobre el arrendatario</div>
                      {editando ? <textarea style={{ ...input, minHeight: 50, resize: 'vertical' }} value={form.comentarios_arrendatario} onChange={e => setF('comentarios_arrendatario', e.target.value)} /> : <div style={{ fontSize: 12, color: '#374151', whiteSpace: 'pre-wrap' }}>{form.comentarios_arrendatario || '—'}</div>}
                    </div>
                  </div>

                  {/* COLUMNA DERECHA (ancha): descuentos relacionados + presupuesto */}
                  <div>
                    {/* Resumen de descuentos relacionados (para el controller) */}
                    <div style={card}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>Descuentos de este término</span>
                        <span style={{ fontSize: 11, color: '#888' }}>{idadmonSel} · {descDelTermino.length} · {fmtPesos(totDelTermino)}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>Descuentos imputados a este IDADMON. Solo lectura.</div>
                      {descDelTermino.length === 0 ? <div style={{ fontSize: 12, color: '#9ca3af' }}>Sin descuentos.</div> : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead><tr style={{ background: '#FAFAF8' }}>
                            <th style={th}>Num</th><th style={th}>F.Cont</th><th style={th}>Imputar a</th><th style={{ ...th, textAlign: 'right' }}>Cantidad</th><th style={th}>Comentario</th>
                          </tr></thead>
                          <tbody>
                            {descDelTermino.map((d, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                                <td style={{ ...tdL, color: '#185FA5', fontWeight: 700 }}>{d.num}</td>
                                <td style={{ ...tdL, color: '#888', whiteSpace: 'nowrap' }}>{fmtFecha(d.fecha_contable)}</td>
                                <td style={{ ...tdL, color: '#666' }}>{d.repercutir_a || '—'}</td>
                                <td style={tdR}>{fmtPesos(d.monto_a_imputar)}</td>
                                <td style={{ ...tdL, color: '#555' }}>{d.texto_explicativo_para_carta_a_propietario || ''}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>

                    {/* Descuentos del INMUEBLE SIGUIENTE (sucesor) — referencia para gastos compartidos, colapsable */}
                    {asociado && descDelSucesor.length > 0 && (
                      <div style={{ ...card, background: '#FBFAF7', borderColor: '#EDE7D9' }}>
                        <div onClick={() => setSucesorExpandido(v => !v)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#8a6d3b' }}>{sucesorExpandido ? '▾' : '▸'} Descuentos del inmueble siguiente ({asociado}) — referencia</span>
                          <span style={{ fontSize: 11, color: '#a08a5b' }}>{descDelSucesor.length} · gastos compartidos</span>
                        </div>
                        {sucesorExpandido && (
                          <>
                            <div style={{ fontSize: 11, color: '#a08a5b', margin: '6px 0 8px' }}>Del contrato sucesor de la misma propiedad. NO cuentan en esta liquidación; sirven para chequear el reparto de gastos compartidos (término / período desocupado / nuevo arrendatario).</div>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead><tr style={{ background: '#F5F1E8' }}>
                                <th style={th}>Num</th><th style={th}>F.Cont</th><th style={th}>Imputar a</th><th style={{ ...th, textAlign: 'right' }}>Cantidad</th><th style={th}>Comentario</th>
                              </tr></thead>
                              <tbody>
                                {descDelSucesor.map((d, i) => (
                                  <tr key={i} style={{ borderBottom: '1px solid #EDE7D9' }}>
                                    <td style={{ ...tdL, color: '#8a6d3b', fontWeight: 700 }}>{d.num}</td>
                                    <td style={{ ...tdL, color: '#a08a5b', whiteSpace: 'nowrap' }}>{fmtFecha(d.fecha_contable)}</td>
                                    <td style={{ ...tdL, color: '#8a6d3b' }}>{d.repercutir_a || '—'}</td>
                                    <td style={tdR}>{fmtPesos(d.monto_a_imputar)}</td>
                                    <td style={{ ...tdL, color: '#8a6d3b' }}>{d.texto_explicativo_para_carta_a_propietario || ''}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </>
                        )}
                      </div>
                    )}

                    <div style={card}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>Presupuesto de reparaciones</span>
                        {puedeVerMarkup && presupuestos.length > 0 && (
                          <span style={{ fontSize: 11, color: '#888' }}>
                            Markup FCR:{' '}
                            <input type="number" value={form.markup_fcr === '' || form.markup_fcr == null ? 20 : form.markup_fcr}
                              onChange={e => setF('markup_fcr', e.target.value)}
                              style={{ width: 48, padding: '2px 6px', border: '1px solid #C9DEF5', borderRadius: 5, fontSize: 12, textAlign: 'right', fontFamily: 'inherit' }} />% 
                          </span>
                        )}
                      </div>
                      {presupuestos.length === 0 ? <div style={{ color: '#9ca3af', fontSize: 12, padding: '8px 0' }}>Sin presupuesto registrado. (Se valora desde el módulo Presupuestos.)</div>
                        : presupuestos.map(p => {
                          const lineas2 = detalle.filter(d => d.presupuesto_id === p.id)
                          const mkDef = (() => { const v = n0(form.markup_fcr); return v > 0 ? v : 20 })()
                          const conMk = lineas2.map(l => ({ l, m: lineaConMarkup(l, mkDef) }))
                          const totBaseMk = conMk.reduce((a, x) => a + x.m.base, 0)
                          const totIvaMk = conMk.reduce((a, x) => a + x.m.iva, 0)
                          const totTotalMk = conMk.reduce((a, x) => a + x.m.total, 0)
                          return (
                            <div key={p.id} style={{ marginBottom: 12 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: '#185FA5', marginBottom: 4 }}>{p.numero} · {p.descripcion || 'presupuesto'}</div>
                              {/* Presupuesto CON markup (precio al cliente) — el comunicable */}
                              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead><tr style={{ background: '#FAFAF8' }}><th style={th}>Descripción</th><th style={{ ...th, textAlign: 'right' }}>Cant</th><th style={{ ...th, textAlign: 'right' }}>Base</th><th style={{ ...th, textAlign: 'right' }}>IVA</th><th style={{ ...th, textAlign: 'right' }}>Total</th></tr></thead>
                                <tbody>
                                  {conMk.map(({ l, m }, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                                      <td style={tdL}>{l.descripcion}</td><td style={{ ...tdR, fontWeight: 400 }}>{l.cantidad ?? ''}</td>
                                      <td style={{ ...tdR, fontWeight: 400, color: '#666' }}>{m.base.toLocaleString('es-CL')}</td>
                                      <td style={{ ...tdR, fontWeight: 400, color: '#999' }}>{m.iva.toLocaleString('es-CL')}</td>
                                      <td style={tdR}>{m.total.toLocaleString('es-CL')}</td>
                                    </tr>
                                  ))}
                                  <tr style={{ borderTop: '2px solid #E8E6E0' }}><td style={{ ...tdL, fontWeight: 700 }}>TOTALES</td><td></td><td style={{ ...tdR, fontWeight: 700 }}>{totBaseMk.toLocaleString('es-CL')}</td><td style={{ ...tdR, fontWeight: 700, color: '#888' }}>{totIvaMk.toLocaleString('es-CL')}</td><td style={{ ...tdR, fontWeight: 700, color: '#185FA5' }}>{totTotalMk.toLocaleString('es-CL')}</td></tr>
                                </tbody>
                              </table>
                              {/* Drop-down: coste sin markup (solo Karina/Dirección) */}
                              {puedeVerMarkup && (
                                <>
                                  <span onClick={() => setCosteExpandido(x => !x)} style={{ fontSize: 10, color: '#9ca3af', cursor: 'pointer', fontWeight: 600, display: 'inline-block', marginTop: 4 }}>{costeExpandido ? '▾ ocultar coste sin markup' : '▸ ver coste sin markup'}</span>
                                  {costeExpandido && (
                                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 4, background: '#FBFAF7' }}>
                                      <thead><tr style={{ background: '#F5F1E8' }}><th style={th}>Descripción</th><th style={{ ...th, textAlign: 'right' }}>Cant</th><th style={{ ...th, textAlign: 'right' }}>Base</th><th style={{ ...th, textAlign: 'right' }}>IVA</th><th style={{ ...th, textAlign: 'right' }}>Total</th></tr></thead>
                                      <tbody>
                                        {lineas2.map((l, i) => (
                                          <tr key={i} style={{ borderBottom: '1px solid #EDE7D9' }}>
                                            <td style={{ ...tdL, color: '#8a6d3b' }}>{l.descripcion}</td><td style={{ ...tdR, color: '#a08a5b' }}>{l.cantidad ?? ''}</td>
                                            <td style={{ ...tdR, color: '#a08a5b' }}>{n0(l.base_imponible).toLocaleString('es-CL')}</td>
                                            <td style={{ ...tdR, color: '#a08a5b' }}>{n0(l.iva).toLocaleString('es-CL')}</td>
                                            <td style={{ ...tdR, color: '#8a6d3b' }}>{n0(l.total).toLocaleString('es-CL')}</td>
                                          </tr>
                                        ))}
                                        <tr style={{ borderTop: '2px solid #EDE7D9' }}><td style={{ ...tdL, fontWeight: 700, color: '#8a6d3b' }}>COSTE</td><td></td><td style={{ ...tdR, fontWeight: 700, color: '#8a6d3b' }}>{n0(p.neto).toLocaleString('es-CL')}</td><td style={{ ...tdR, fontWeight: 700, color: '#a08a5b' }}>{n0(p.iva).toLocaleString('es-CL')}</td><td style={{ ...tdR, fontWeight: 700, color: '#8a6d3b' }}>{n0(p.total).toLocaleString('es-CL')}</td></tr>
                                        <tr><td style={{ ...tdL, fontSize: 10, color: '#a08a5b', fontStyle: 'italic' }} colSpan={5}>Margen FCR: {(totTotalMk - n0(p.total)).toLocaleString('es-CL')} (markup {mkDef}%)</td></tr>
                                      </tbody>
                                    </table>
                                  )}
                                </>
                              )}
                            </div>
                          )
                        })}
                    </div>

                    {/* Aprobación bilateral del presupuesto (Etapa 4) */}
                    <div style={card}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>Aprobación del presupuesto (bilateral)</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 10 }}>El presupuesto (con markup FCR) requiere el visto bueno del <b>ex-arrendatario</b> y del <b>propietario</b>, por separado. Registra cuándo y por qué vía se obtuvo cada uno.</div>
                      {[
                        { lbl: 'Ex-arrendatario', kf: 'aprob_arrendatario_fecha', kv: 'aprob_arrendatario_via' },
                        { lbl: 'Propietario', kf: 'aprob_propietario_fecha', kv: 'aprob_propietario_via' },
                      ].map(row => {
                        const aprobado = !!form[row.kf]
                        return (
                          <div key={row.kf} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.3fr', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #F6F5F2' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 9, height: 9, borderRadius: '50%', background: aprobado ? '#16a34a' : '#d1d5db', flexShrink: 0 }} />
                              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{row.lbl}</span>
                            </div>
                            {editando
                              ? <input type="date" style={inEd} value={form[row.kf]} onChange={e => setF(row.kf, e.target.value)} />
                              : <div style={{ fontSize: 12, color: aprobado ? '#16a34a' : '#9ca3af', fontWeight: 600 }}>{aprobado ? fmtFecha(form[row.kf]) : 'pendiente'}</div>}
                            {editando
                              ? <input style={inEd} placeholder="vía (email, WhatsApp, verbal…)" value={form[row.kv]} onChange={e => setF(row.kv, e.target.value)} />
                              : <div style={{ fontSize: 12, color: '#6b7280' }}>{form[row.kv] || '—'}</div>}
                          </div>
                        )
                      })}
                      {(() => {
                        const ambas = !!form.aprob_arrendatario_fecha && !!form.aprob_propietario_fecha
                        return (
                          <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: ambas ? '#16a34a' : '#b45309' }}>
                            {ambas ? '✓ Presupuesto aprobado por ambas partes — se puede ejecutar la reparación.' : '⚠ Sin ambas aprobaciones no se ejecuta gasto (N09).'}
                          </div>
                        )
                      })()}
                    </div>

                    {/* Notas de Finanzas (4 cajas de texto libre) */}
                    <div style={card}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 10 }}>Notas de Finanzas</div>
                      {[1, 2, 3, 4].map(i => {
                        const k = 'notas_finanzas_' + i
                        return (
                          <div key={k} style={{ marginBottom: 10 }}>
                            <div style={lbl}>Nota Finanzas {i}</div>
                            {editando
                              ? <textarea style={{ ...input, minHeight: 50, resize: 'vertical' }} value={form[k]} onChange={e => setF(k, e.target.value)} />
                              : <div style={{ fontSize: 12, color: '#374151', whiteSpace: 'pre-wrap' }}>{form[k] || '—'}</div>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <div style={{ ...card, background: '#FEF9E7', border: '1px solid #F1C40F', color: '#8a6d00', fontSize: 12 }}>
                  <b>Panel editable (líneas).</b> Conceptos fijos siempre visibles + líneas añadibles. “Arreglos presupuesto” es automático (= total del presupuesto). Servicios y reparaciones se siembran desde <i>descuentos</i> la primera vez (editables). Pendiente: conectar Servicios a la tabla de GGCC/agua/luz (último mes) y cablear los botones Email/PDF/Reclamación (endpoints por crear). Ya activos: aprobación bilateral del presupuesto y compuerta de reversión de garantía.
                </div>
              </>
            )}
      </div>
    </>
  )
}

function Row({ k, v, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 13 }}>
      <span style={{ color: bold ? '#1a1a2e' : '#555', fontWeight: bold ? 700 : 400 }}>{k}</span>
      <span style={{ color: '#1a1a2e', fontWeight: bold ? 700 : 600, whiteSpace: 'nowrap' }}>{v}</span>
    </div>
  )
}