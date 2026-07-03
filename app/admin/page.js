'use client'

import { useEffect, useState, useRef, useLayoutEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'
import TopNav from '../components/ui/TopNav'
import Link from 'next/link'

/* ── Colores fieles al Excel ── */
const C = {
  headerBg:   '#1a3a6b',
  headerText: '#ffffff',
  subBg:      '#2563a8',
  subText:    '#ffffff',
  labelBg:    '#dbe5f1',
  labelText:  '#1a3a6b',
  inputBg:    '#ffffff',
  border:     '#7a9cc7',
  rowAlt:     '#f0f5fb',
  green:      '#16a34a',
  red:        '#dc2626',
  amber:      '#d97706',
  yellow:     '#fbbf24',
}

const cell = {
  border: `1px solid ${C.border}`,
  padding: '3px 6px',
  fontSize: 11,
  fontFamily: 'inherit',
}
const labelCell = {
  ...cell,
  background: C.labelBg,
  color: C.labelText,
  fontWeight: 600,
  whiteSpace: 'nowrap',
}
const inputCell = {
  ...cell,
  background: C.inputBg,
  color: '#1f2937',
  overflow: 'hidden',
}
const headerCell = {
  ...cell,
  background: C.headerBg,
  color: C.headerText,
  fontWeight: 600,
  textAlign: 'center',
}

const FORM_VACIO = {
  idadmon:'', estado:'', propietario:'', idprop:'', inmueble:'', idlinmue:'',
  tipo:'', bodega:'', estac:'', sub_estado:'', fecha:'', accion:'',
  arrendatario:'', mail_arrendatario:'', movil:'', rut:'', avalista:'',
  mail_avalista:'', telefono_avalista:'', otro_dato:'',
  fecha_inicio:'', termino_inicial:'', en_legal:'', termino_actual:'',
  comentar_renovacion:'', revision:'', unid:'', cuota:'', uf_peso_factor:'',
  fecha_reajuste1:'', cantidad_reajuste1:'', fecha_reajuste2:'', cantidad_reajuste2:'',
  fecha_reajuste3:'', cantidad_reajuste3:'', fecha_reajuste4:'', cantidad_reajuste4:'',
  fecha_reajuste5:'', cantidad_reajuste5:'', fecha_reajuste6:'', cantidad_reajuste6:'',
  genero:'', comentarios:'', tiene_contrato_admon:'', pct_adm:'', si_fijo_admon:'',
  adicionar_iva:'', quien_cobra:'', tiene_termo_mant:'', fecha_mant:'',
  especial_a:'', especial_b:'', especial_c:'', comentarios2:'',
  garantia_pedida:'', protegido:false, deuda_garantia:'', quien_tiene_garantia:'',
  fecha1:'', cuota1:'', cobrada1:'', comment1:'',
  fecha2:'', cuota2:'', cobrada2:'', comment2:'',
  fecha3:'', cuota3:'', cobrada3:'', comment3:'',
  fecha4:'', cuota4:'', cobrada4:'', comment4:'',
  cantidad_aceleracion:'', tipo_aceleracion:'', multa_diaria:'', texto_contrato:'',
  media_retraso:'', comision_base:'', comision_iva:'', comision_total:'',
  c_especiales:'', comentario_comision:'', comision_cobrado:'', meses:'',
  cantidad:'', comentario2b:'', repeticion_idadmon:'', idadmon_siguiente:'',
  aseo1:'', aseo2:'', aseo3:'',
  comision_a_base:'', iva_comision_a:'', comision_a_total:'', comision_a_pagado:'',
  comision_d_base:'', iva_comision_d:'', comision_d_total:'', comision_d_pagado:'',
  responsable:'', proporcional:'', garantia_con:'', idadmo:'',
  mowner:'', c_garantia:'', c_termino:'',
}

/* ── Celda de input editable ── */
function IC({ name, value, onChange, readOnly, type='text', width, bold }) {
  return (
    <input
      type={type} name={name} value={value ?? ''}
      onChange={onChange} readOnly={readOnly}
      style={{
        ...inputCell,
        width: width || '100%',
        fontWeight: bold ? 600 : 400,
        background: readOnly ? '#f8fafc' : C.inputBg,
        border: `1px solid ${C.border}`,
        outline: 'none',
        boxSizing: 'border-box',
      }}
      onFocus={e => { if (!readOnly) e.target.style.background = '#fffbeb' }}
      onBlur={e => e.target.style.background = readOnly ? '#f8fafc' : C.inputBg}
    />
  )
}

/* ── Celda de SOLO LECTURA que muestra un valor del log (Capa 1) ── */
function RO({ value }) {
  return (
    <input
      type="text" value={value ?? ''} readOnly tabIndex={-1}
      style={{
        ...inputCell,
        width: '100%',
        background: '#eef2f7',
        color: '#334155',
        border: `1px solid ${C.border}`,
        outline: 'none',
        boxSizing: 'border-box',
        cursor: 'default',
      }}
    />
  )
}

/* ── Celda de solo lectura: recorta con … y muestra el texto completo en hover (title) ── */
function RT({ value }) {
  const v = value == null ? '' : String(value)
  return (
    <div title={v} style={{
      border: `1px solid ${C.border}`,
      padding: '3px 6px',
      fontSize: 11,
      background: '#fff',
      color: '#1f2937',
      boxSizing: 'border-box',
      width: '100%',
      maxWidth: '100%',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      cursor: 'default',
      minHeight: 22,
      lineHeight: '16px',
    }}>{v}</div>
  )
}

/* ── Celda EDITABLE de persona (arrendatario/aval). A nivel de módulo para NO perder foco.
   - normal: input de una línea con tooltip (title) al pasar el ratón.
   - area=true (domicilios): textarea que se autoexpande en alto + icono ⤢ para abrir pop-up. ── */
function PCell({ value, bloque, campo, onSet, ro, area, onExpand }) {
  const v = value == null ? '' : String(value)
  const ref = useRef(null)
  useLayoutEffect(() => {
    if (area && ref.current) {
      ref.current.style.height = 'auto'
      ref.current.style.height = Math.max(22, ref.current.scrollHeight) + 'px'
    }
  }, [v, area])
  const common = {
    border: `1px solid ${C.border}`, padding: '3px 6px', fontSize: 11,
    background: ro ? '#f8fafc' : '#fff', color: '#1f2937',
    boxSizing: 'border-box', width: '100%', outline: 'none', fontFamily: 'inherit',
  }
  if (area) {
    return (
      <div style={{ position: 'relative', width: '100%' }}>
        <textarea
          ref={ref} value={v} readOnly={ro} title={v} rows={1}
          onChange={e => onSet(bloque, campo, e.target.value)}
          style={{ ...common, resize: 'none', overflow: 'hidden', minHeight: 22, lineHeight: '16px', paddingRight: 16, display: 'block' }}
          onFocus={e => { if (!ro) e.target.style.background = '#fffbeb' }}
          onBlur={e => e.target.style.background = ro ? '#f8fafc' : '#fff'}
        />
        {!ro && onExpand && (
          <button type="button" tabIndex={-1} onClick={() => onExpand(bloque, campo)}
            title="Ampliar para ver/editar todo el texto"
            style={{
              position: 'absolute', top: 2, right: 2, width: 14, height: 14, lineHeight: '12px',
              fontSize: 11, border: 'none', background: 'transparent', color: '#64748b',
              cursor: 'pointer', padding: 0,
            }}>⤢</button>
        )}
      </div>
    )
  }
  return (
    <input
      value={v} readOnly={ro} title={v}
      onChange={e => onSet(bloque, campo, e.target.value)}
      style={{ ...common, height: 22 }}
      onFocus={e => { if (!ro) e.target.style.background = '#fffbeb' }}
      onBlur={e => e.target.style.background = ro ? '#f8fafc' : '#fff'}
    />
  )
}

/* ── Select editable ── */
function SC({ name, value, onChange, readOnly, options, width }) {
  if (readOnly) return <IC name={name} value={value} onChange={() => {}} readOnly width={width} />
  return (
    <select name={name} value={value ?? ''} onChange={onChange}
      style={{ ...inputCell, width: width || '100%', cursor: 'pointer', border: `1px solid ${C.border}` }}>
      <option value=""> </option>
      {options.map(o => <option key={o.v ?? o} value={o.v ?? o}>{o.l ?? o}</option>)}
    </select>
  )
}

/* ── Celda de cabecera de sección ── */
function SH({ children, cols, bg }) {
  return (
    <td colSpan={cols} style={{
      ...headerCell,
      background: bg || C.headerBg,
      padding: '4px 8px',
      fontSize: 11,
      letterSpacing: '0.05em',
    }}>{children}</td>
  )
}

/* ── Etiqueta ── */
function LB({ children, width, right }) {
  return (
    <td style={{
      ...labelCell,
      width: width,
      textAlign: right ? 'right' : 'left',
    }}>{children}</td>
  )
}

/* ── Celda compacta etiqueta+valor para DATOS ECONÓMICOS (fondo gris, estilo Excel) ── */
const ECO = { border: '#9ec79f', labelBg: '#bcdcbd', labelTxt: '#1f5023', valBg: '#e8f4e8', valRo: '#e8f4e8', head: '#2f6b33', sub: '#2f6b33' }
const ECG = { border: '#cbd1d9', labelBg: '#e3e6ea', labelTxt: '#374151', valBg: '#ffffff', valRo: '#f7f8fa', head: '#5b6470', sub: '#8b94a3' }

// Formatea un entero con separador de miles es-CL: 10000 -> "10.000". Vacío -> ''.
function fmtMiles(v) {
  if (v === null || v === undefined || v === '') return ''
  const n = Number(String(v).replace(/\./g, '').replace(/[^\d-]/g, ''))
  if (isNaN(n)) return String(v)
  return n.toLocaleString('es-CL')
}

// Tasa de IVA para comisiones de corretaje (siempre afecto a IVA).
const IVA_TASA = 0.19
// Extrae el porcentaje numérico de un texto de corretaje: "50%", "50% + IVA", "40" -> 50/50/40.
// Sin número reconocible -> 0.
function parsePct(txt) {
  const m = String(txt ?? '').match(/(\d+(?:[.,]\d+)?)/)
  return m ? Number(m[1].replace(',', '.')) : 0
}

// Celda económica. Soporta:
//   money   -> muestra con separador de miles y sin flechas; guarda el número crudo.
//   options -> render como <select> (p. ej. ['', 'BOLETA', 'FACTURA']).
function EcoCell({ label, name, value, onChange, ro, type = 'text', bold, pal = ECO, money, options }) {
  const baseInput = {
    flex: 1, minWidth: 0, width: '100%', boxSizing: 'border-box',
    border: 'none', outline: 'none', background: ro ? pal.valRo : pal.valBg,
    fontSize: 11, fontWeight: bold ? 700 : 400, color: '#1f2937',
    padding: '2px 5px', height: 22, fontFamily: 'inherit',
  }
  let control
  if (options) {
    control = (
      <select name={name} value={value ?? ''} onChange={onChange} disabled={ro}
        style={{ ...baseInput, cursor: ro ? 'default' : 'pointer' }}>
        {options.map(o => <option key={o} value={o}>{o === '' ? '—' : o}</option>)}
      </select>
    )
  } else if (money) {
    control = (
      <input
        type="text" inputMode="numeric" name={name} value={fmtMiles(value)} readOnly={ro}
        onChange={e => { const raw = e.target.value.replace(/\./g, '').replace(/[^\d]/g, ''); onChange({ target: { name, value: raw } }) }}
        style={{ ...baseInput, textAlign: 'right' }}
        onFocus={e => { if (!ro) e.target.style.background = '#fffbeb' }}
        onBlur={e => e.target.style.background = ro ? pal.valRo : pal.valBg}
      />
    )
  } else {
    control = (
      <input
        type={type} name={name} value={value ?? ''} onChange={onChange} readOnly={ro}
        style={baseInput}
        onFocus={e => { if (!ro) e.target.style.background = '#fffbeb' }}
        onBlur={e => e.target.style.background = ro ? pal.valRo : pal.valBg}
      />
    )
  }
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', borderBottom: `1px solid ${pal.border}`, borderRight: `1px solid ${pal.border}` }}>
      <div style={{
        width: 64, flexShrink: 0, fontSize: 10, fontWeight: 600, color: pal.labelTxt,
        background: pal.labelBg, padding: '0 5px', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap',
      }}>{label}</div>
      {control}
    </div>
  )
}

// Transiciones de estado permitidas (circuito de contratos).
// P→S · S→SQ/Q · SQ→Q · Q→N/N-DICOM · N/N-DICOM = fin (sin transiciones).
const TRANSICIONES = {
  P: ['S'],
  S: ['SQ', 'Q'],
  SQ: ['Q'],
  Q: ['N', 'N-DICOM'],
  N: [],
  'N-DICOM': [],
}
const ESTADO_LABEL = {
  S: 'S – Contrato firmado',
  SQ: 'SQ – Aviso de término',
  Q: 'Q – Término (llaves)',
  N: 'N – Cierre término',
  'N-DICOM': 'N-DICOM – Cierre con DICOM',
  P: 'P – Pendiente arrendar',
}

const msgColors = {
  ok:    { bg: '#f0fdf4', color: '#16a34a', border: '#86efac' },
  error: { bg: '#fef2f2', color: '#dc2626', border: '#fca5a5' },
  warn:  { bg: '#fffbeb', color: '#b45309', border: '#fcd34d' },
  info:  { bg: '#eff6ff', color: '#1447c3', border: '#93c5fd' },
}

// Campos de AJUSTE/REAJUSTE MENSUAL: en un contrato activo (S/SQ) se pueden editar
// SIN la advertencia de "datos contractuales". Todo lo demás se considera contractual.
const AJUSTE_MENSUAL = new Set([
  'fecha_reajuste1', 'cantidad_reajuste1', 'fecha_reajuste2', 'cantidad_reajuste2',
  'fecha_reajuste3', 'cantidad_reajuste3', 'fecha_reajuste4', 'cantidad_reajuste4',
  'fecha_reajuste5', 'cantidad_reajuste5', 'fecha_reajuste6', 'cantidad_reajuste6',
  'cuota', 'unid', 'revision',
])
// Estados de contrato ACTIVO firmado: editar datos contractuales dispara la advertencia.
const ESTADOS_ACTIVOS = new Set(['S', 'SQ'])
// Estados de TÉRMINO / CERRADO: cualquier edición (incluso ajustes) dispara advertencia reforzada.
const ESTADOS_CERRADOS = new Set(['Q', 'N', 'N-DICOM', 'N_DICOM'])

// ── Parser del email de inicio (sin IA, por reglas sobre las etiquetas habituales) ──
// Tolerante a acentos, mayúsculas y typos ("Incio"). Devuelve un objeto con lo que encuentre.
function parseInicioEmail(texto) {
  const t = String(texto || '').replace(/\r/g, '')
  const out = { arr: {} }

  // Fecha inicio: "Fecha Incio del contrato: 02-07-2026"
  let m = t.match(/fecha\s+in\w*cio[^:]*:\s*([0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{2,4})/i)
  if (m) out.fecha_inicio = normFecha(m[1])

  // Vigencia: "tiempo de vigencia: 1 año renovable"
  m = t.match(/vigencia[^:]*:\s*([^\n\-–]+)/i)
  if (m) out.vigencia = m[1].trim()

  // Bodega / estacionamiento: "Incluye Estacionamiento y Bodega: BODEGA 502"
  m = t.match(/bodega[^:]*:\s*([^\n\-–]+)/i)
  if (m) {
    const b = m[1].trim()
    const num = b.match(/(\d+)/)
    out.bodega = num ? num[1] : b
  }
  // Estacionamiento explícito (si viniera "Estacionamiento: 12")
  m = t.match(/estacionamiento\s*:\s*([^\n\-–]+)/i)
  if (m) { const num = m[1].match(/(\d+)/); if (num) out.estac = num[1] }

  // Arriendo mensual + moneda: "$25.000" o "UF 10"
  m = t.match(/arriendo\s+mensual[^:]*:\s*(uf)?\s*\$?\s*([0-9][0-9.\,]*)/i)
  if (m) {
    out.unid = (m[1] ? 'UF' : '$')
    out.cuota = String(m[2]).replace(/\./g, '').replace(/,/g, '.').replace(/\.00$/, '')
    if (out.unid === '$') out.cuota = out.cuota.split('.')[0]  // pesos sin decimales
  }

  // Reajuste: "tipo de reajuste IPC cada 6 meses" (con o sin dos puntos) -> literal
  m = t.match(/reajuste[:\s]+([^\n]+)/i)
  if (m) out.revision = m[1].replace(/\.$/, '').trim()

  // Sin garantía
  if (/sin\s+garant[ií]a/i.test(t)) out.sinGarantia = true

  // ── Bloque ARRENDATARIO: etiquetas en orden; el valor va hasta la siguiente etiqueta ──
  const labels = [
    ['nombre',   /nombre\s+completo\s*:/i],
    ['rut',      /\brut\s*:/i],
    ['estado',   /estado\s+civil\s*:/i],
    ['profesion',/profesi[oó]n\s*:/i],
    ['domLab',   /direcci[oó]n\s+laboral\s*:/i],
    ['domHabit', /domicilio\s+actual\s*:/i],
    ['telefono', /tel[eé]fono\s*:/i],
    ['email',    /e-?\s*mail\s*:/i],
  ]
  // localizar cada etiqueta
  const pos = []
  for (const [key, re] of labels) {
    const mm = t.match(re)
    if (mm && mm.index != null) pos.push({ key, start: mm.index, end: mm.index + mm[0].length })
  }
  pos.sort((a, b) => a.start - b.start)
  for (let i = 0; i < pos.length; i++) {
    const desde = pos[i].end
    const hasta = (i + 1 < pos.length) ? pos[i + 1].start : t.length
    let val = t.slice(desde, hasta).trim()
    val = val.replace(/\s*[\-–]\s*$/, '').replace(/\s*\[.*$/, '').trim() // quita colas tipo "[dnmv95@..."
    if (pos[i].key === 'email') { const em = val.match(/[\w.\-+]+@[\w.\-]+/); if (em) val = em[0] }
    if (val) out.arr[pos[i].key] = val
  }

  // Género a partir del estado civil (soltero/M -> H ; soltera/casada/F -> M)
  const ec = (out.arr.estado || '').toLowerCase()
  if (/\bsoltero\b/.test(ec) || ec === 'm ' || ec === 'masculino') out.arr.genero = 'H'
  else if (/\bsoltera\b|\bcasada\b|\bfemenino\b/.test(ec) || ec === 'f') out.arr.genero = 'M'

  // Finalización = inicio + 1 año - 1 día
  if (out.fecha_inicio) out.termino_inicial = masUnAnoMenosUnDia(out.fecha_inicio)

  return out
}
// dd-mm-aaaa (o dd/mm/aa) -> aaaa-mm-dd
function normFecha(s) {
  const p = String(s).split(/[-/]/)
  if (p.length !== 3) return ''
  let [d, mth, y] = p
  if (y.length === 2) y = '20' + y
  return `${y}-${String(mth).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
// aaaa-mm-dd + 1 año - 1 día
function masUnAnoMenosUnDia(iso) {
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d)) return ''
  d.setFullYear(d.getFullYear() + 1)
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

function AdminContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const idParam = (searchParams.get('idadmon') || '').trim().toUpperCase()
  const [idadmonInput, setIdadmonInput] = useState('')
  const [form, setForm] = useState(FORM_VACIO)
  const [logData, setLogData] = useState(null)
  // Campos económicos que viven en el LOG (raw_data): porcentajes de corretaje,
  // C.Especiales y Comentario por parte. Editables solo en P; se guardan en raw_data.
  const [logEcon, setLogEcon] = useState({ porcentD:'', porcentA:'', cEspProp:'', comentProp:'', cEspArr:'', comentArr:'' })
  const [propData, setPropData] = useState(null)   // ficha del propietario (tabla propietarios, por idprop)
  // Estado editable de ARRENDATARIOS y AVALES (1 y 2). 11 campos por persona.
  const [personas, setPersonas] = useState({ arr1:{}, arr2:{}, aval1:{}, aval2:{} })
  const [modalAbierto, setModalAbierto] = useState(false)   // modal de edición de personas
  const [modalEmailAbierto, setModalEmailAbierto] = useState(false)  // modal "Cargar datos email"
  const [textoEmail, setTextoEmail] = useState('')
  const [expandir, setExpandir] = useState(null)            // pop-up de campo largo: {bloque, campo} | null
  const [guardandoModal, setGuardandoModal] = useState(false)
  const [arr2Abierto, setArr2Abierto] = useState(false)
  const [aval2Abierto, setAval2Abierto] = useState(false)
  const [prop2Abierto, setProp2Abierto] = useState(false)
  const [bloqueado, setBloqueado] = useState(false)
  const [isNew, setIsNew] = useState(true)
  // valor_uf del día 1 del mes en curso (indices_mensuales). null = aún no cargado / no existe fila.
  const [ufMes, setUfMes] = useState(null)
  const [msg, setMsg] = useState(null)
  const [saving, setSaving] = useState(false)
  const [adicionalesAbierto, setAdicionalesAbierto] = useState(false)
  // Correcciones excepcionales: desbloquea los campos del contrato (excepto IDADMON
  // y estado) en un contrato activo. Solo Anthony/Dirección. Con motivo y registro.
  const [correccionAbierta, setCorreccionAbierta] = useState(false)
  const [modalCorrAbierto, setModalCorrAbierto] = useState(false)
  const [motivoCorr, setMotivoCorr] = useState('')

  const [cap, setCap] = useState(null)
  const [pendientes, setPendientes] = useState([])
  const [nuevoEstado, setNuevoEstado] = useState('')
  const [fechaEstado, setFechaEstado] = useState('')
  const [cambiando, setCambiando] = useState(false)

  // Helper: leer una clave del raw_data del log (Capa 1)
  const lp = (clave) => (logData && logData[clave] != null ? logData[clave] : '')
  // Helper: setear un campo económico del LOG (editable solo en P)
  const setLogEconCampo = (campo, valor) => setLogEcon(prev => ({ ...prev, [campo]: valor }))
  // Construye el objeto logEcon a partir de un raw_data del log
  const econDesdeRaw = (rd) => ({
    porcentD:   rd?.['Porcent-D'] ?? '',
    porcentA:   rd?.['Porcent-A'] ?? '',
    cEspProp:   rd?.['C.ESPECIALES PROPIETARIO'] ?? '',
    comentProp: rd?.['COMENTARIO PROPIETARIO'] ?? '',
    cEspArr:    rd?.['C.ESPECIALES ARRENDATARIO'] ?? '',
    comentArr:  rd?.['COMENTARIO ARRENDTARIO'] ?? '',
  })
  // Helper: leer un campo de la ficha del propietario (tabla propietarios, por idprop)
  const pp = (campo) => (propData && propData[campo] != null ? propData[campo] : '')

  // Mapeo: campo lógico -> clave en raw_data del log, por persona.
  const SUF = {
    arr1:  { nombre:'Nombre-A',  genero:'Genero-A',  estado:'Estado-A',  nacion:'Nacion-A',  rut:'RUT de A',  pasaporte:'Pasaporte-A',  email:'email de A',  telefono:'telefono de A',  domHabit:'Dom-Habit-A',  domLab:'Dom-Lab-A',  empresa:'Empresa-A' },
    arr2:  { nombre:'Nombre-A2', genero:'Genero-A2', estado:'Estado-A2', nacion:'Nacion-A2', rut:'RUT de A2', pasaporte:'Pasaporte-A2', email:'email de A2', telefono:'telefono de A2', domHabit:'Dom-Habit-A2', domLab:'Dom-Lab-A2', empresa:'Empresa-A2' },
    aval1: { nombre:'Nombre-G',  genero:'Genero-G',  estado:'Estado-G',  nacion:'Nacion-G',  rut:'RUT de G',  pasaporte:'Pasaporte-G',  email:'email de G',  telefono:'telefono de G',  domHabit:'Dom-Habit-G',  domLab:'Dom-Lab-G',  empresa:'Empresa-G' },
    aval2: { nombre:'Nombre-G2', genero:'Genero-G2', estado:'Estado-G2', nacion:'Nacion-G2', rut:'RUT de G2', pasaporte:'Pasaporte-G2', email:'email de G2', telefono:'telefono de G2', domHabit:'Dom-Habit-G2', domLab:'Dom-Lab-G2', empresa:'Empresa-G2' },
  }

  // Construir el estado 'personas' desde el raw_data del log y el resumen de datos_arriendos.
  function construirPersonas(raw, dat) {
    const r = raw || {}
    const leer = (suf) => {
      const o = {}
      for (const campo of Object.keys(suf)) o[campo] = (r[suf[campo]] != null ? String(r[suf[campo]]) : '')
      return o
    }
    const arr1  = leer(SUF.arr1)
    const arr2  = leer(SUF.arr2)
    const aval1 = leer(SUF.aval1)
    const aval2 = leer(SUF.aval2)
    // datos_arriendos manda en los campos compartidos de arrendatario 1 y aval 1
    if (dat) {
      if (dat.arrendatario      != null && dat.arrendatario      !== '') arr1.nombre   = dat.arrendatario
      if (dat.rut               != null && dat.rut               !== '') arr1.rut      = dat.rut
      if (dat.mail_arrendatario != null && dat.mail_arrendatario !== '') arr1.email    = dat.mail_arrendatario
      if (dat.movil             != null && dat.movil             !== '') arr1.telefono = dat.movil
      if (dat.avalista          != null && dat.avalista          !== '') aval1.nombre   = dat.avalista
      if (dat.mail_avalista     != null && dat.mail_avalista     !== '') aval1.email    = dat.mail_avalista
      if (dat.telefono_avalista != null && dat.telefono_avalista !== '') aval1.telefono = dat.telefono_avalista
    }
    return { arr1, arr2, aval1, aval2 }
  }

  // Campos contractuales ya confirmados en esta sesión de edición (para no repetir el aviso).
  const contractOkRef = useRef(new Set())

  // Decide si se permite editar un campo, con confirmación (Opción B) según el estado:
  //   - S/SQ (activo): avisa solo en datos CONTRACTUALES; ajustes mensuales libres.
  //   - Q/N/N-DICOM (término/cerrado): avisa en CUALQUIER edición (aviso reforzado).
  //   - P / nuevo / otros: sin aviso.
  // Devuelve true si se permite el cambio, false si el usuario cancela.
  const permiteEdicionContractual = (clave, esAjuste) => {
    if (ESTADOS_CERRADOS.has(form.estado)) {
      if (contractOkRef.current.has(clave)) return true
      const ok = window.confirm('ATENCIÓN: este contrato está EN TÉRMINO o CERRADO (Q / N / N-DICOM).\n\nSus datos no deberían modificarse. Solo continúa si estás corrigiendo un error.\n\n¿Seguro que quieres modificar este dato?')
      if (ok) { contractOkRef.current.add(clave); return true }
      return false
    }
    if (!ESTADOS_ACTIVOS.has(form.estado)) return true   // P, nuevo... no avisan
    if (esAjuste) return true                             // ajuste/reajuste mensual: sin aviso
    if (contractOkRef.current.has(clave)) return true     // ya confirmado este campo
    const ok = window.confirm('Ojo, estás intentando cambiar los datos contractuales de un contrato activo.\n\n¿Seguro que quieres modificar este dato?')
    if (ok) { contractOkRef.current.add(clave); return true }
    return false
  }

  // Editar un campo de una persona (arrendatario/aval = datos contractuales)
  const setPersona = (bloque, campo, valor) => {
    if (!permiteEdicionContractual('persona:' + bloque + '.' + campo, false)) return
    setPersonas(prev => ({ ...prev, [bloque]: { ...prev[bloque], [campo]: valor } }))
  }

  // Pop-up de expansión para campos largos (domicilios). Guarda { bloque, campo } o null.
  const abrirExpandir = (bloque, campo) => setExpandir({ bloque, campo })

  useEffect(() => { cargarCapacidades() }, [])

  // Carga el valor de la UF del día 1 del mes en curso desde indices_mensuales.
  // Se usa para convertir la cuota UF -> pesos al calcular el corretaje.
  useEffect(() => {
    (async () => {
      const hoy = new Date()
      const mes1 = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`
      const { data } = await supabase
        .from('indices_mensuales').select('valor_uf').eq('mes', mes1).maybeSingle()
      setUfMes(data?.valor_uf != null ? Number(data.valor_uf) : null)
    })()
  }, [])

  // Valores por defecto al abrir un contrato EDITABLE (estado P / corrección):
  // corretaje 50%/50% si están vacíos (no pisa lo heredado). El pct_adm se calcula aparte.
  useEffect(() => {
    const editable = !(bloqueado || (form.estado !== 'P' && !isNew && !correccionAbierta))
    if (!editable) return
    setLogEcon(prev => ({
      ...prev,
      porcentD: String(prev.porcentD ?? '').trim() ? prev.porcentD : '50%',
      porcentA: String(prev.porcentA ?? '').trim() ? prev.porcentA : '50%',
    }))
  }, [bloqueado, form.estado, isNew, correccionAbierta])

  // pct_adm por defecto = % de administración MÁS REPETIDO entre los contratos del mismo
  // idprop en estado S/SQ/Q (empate → el más alto, más beneficio para la empresa). Si el
  // propietario no tiene otros contratos con dato → 8. Sobrescribe UNA vez al cargar el
  // contrato (no repisa lo que se teclee después). Solo en contratos editables.
  const pctAdmRef = useRef(null)
  useEffect(() => {
    const editable = !(bloqueado || (form.estado !== 'P' && !isNew && !correccionAbierta))
    if (!editable) return
    const idprop = String(form.idprop ?? '').trim()
    const clave = `${form.idadmon || ''}|${idprop}`
    if (pctAdmRef.current === clave) return   // ya aplicado para este contrato
    pctAdmRef.current = clave
    ;(async () => {
      let val = '8'   // fallback
      if (idprop) {
        let q = supabase.from('datos_arriendos')
          .select('idadmon, pct_adm').eq('idprop', idprop).in('estado', ['S', 'SQ', 'Q'])
        const { data } = await q
        const counts = new Map()
        for (const d of data || []) {
          if (String(d.idadmon ?? '').trim() === String(form.idadmon ?? '').trim()) continue // excluye el propio
          const n = Number(String(d.pct_adm ?? '').replace(',', '.').replace(/[^\d.-]/g, ''))
          if (!Number.isFinite(n) || String(d.pct_adm ?? '').trim() === '') continue
          counts.set(n, (counts.get(n) || 0) + 1)
        }
        let best = null
        for (const [n, c] of counts) {
          if (!best || c > best.c || (c === best.c && n > best.n)) best = { n, c }
        }
        if (best) val = String(best.n)
      }
      setForm(prev => ({ ...prev, pct_adm: val }))
    })()
  }, [form.idprop, form.idadmon, bloqueado, form.estado, isNew, correccionAbierta])

  // Auto-cálculo del corretaje (solo en contratos editables):
  //   Cantidad = cuota (en pesos) × %   ·   Con IVA = 19% de Cantidad   ·   Total = Cantidad + IVA
  // Si el contrato está en UF y no hay UF del mes en curso -> deja las 3 celdas vacías (se avisa en pantalla).
  useEffect(() => {
    const editable = !(bloqueado || (form.estado !== 'P' && !isNew && !correccionAbierta))
    if (!editable) return
    const cuotaNum = Number(String(form.cuota ?? '').replace(/\./g, '').replace(/[^\d.-]/g, '')) || 0
    const esUF = form.unid === 'UF'
    const cuotaPesos = esUF ? (ufMes ? Math.round(cuotaNum * ufMes) : null) : cuotaNum
    const lado = (pctTxt) => {
      if (!cuotaNum || cuotaPesos == null) return { base: '', iva: '', total: '' }
      const base = Math.round(cuotaPesos * parsePct(pctTxt) / 100)
      const iva = Math.round(base * IVA_TASA)
      return { base: String(base), iva: String(iva), total: String(base + iva) }
    }
    const d = lado(logEcon.porcentD)
    const a = lado(logEcon.porcentA)
    setForm(prev => {
      if (prev.comision_d_base === d.base && prev.iva_comision_d === d.iva && prev.comision_d_total === d.total &&
          prev.comision_a_base === a.base && prev.iva_comision_a === a.iva && prev.comision_a_total === a.total) {
        return prev // sin cambios: evita renders innecesarios
      }
      return {
        ...prev,
        comision_d_base: d.base, iva_comision_d: d.iva, comision_d_total: d.total,
        comision_a_base: a.base, iva_comision_a: a.iva, comision_a_total: a.total,
      }
    })
  }, [form.cuota, form.unid, form.estado, logEcon.porcentD, logEcon.porcentA, ufMes, bloqueado, isNew, correccionAbierta])


  // Al entrar (o si cambia el ?idadmon= de la URL), prioriza el IDADMON de la URL.
  // Solo si no viene ninguno se usa el último visto (localStorage) como respaldo.
  useEffect(() => {
    if (idParam) {
      setIdadmonInput(idParam)
      recuperar(idParam)
    } else {
      const ultimo = localStorage.getItem('ultimo_idadmon')
      if (ultimo) { setIdadmonInput(ultimo); recuperar(ultimo) }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idParam])

  async function cargarCapacidades() {
    try {
      const res = await fetch('/api/cc1/pendientes')
      const data = await res.json()
      if (res.ok) { setCap(data.capacidades); setPendientes(data.pendientes || []) }
    } catch {}
  }

  async function cambiarEstado() {
    if (!form.idadmon) { setMsg({ type: 'warn', text: 'No hay contrato cargado.' }); return }
    if (!nuevoEstado) { setMsg({ type: 'warn', text: 'Elige el nuevo estado.' }); return }
    if (!window.confirm(`¿Cambiar ${form.idadmon} de "${form.estado || '—'}" a "${nuevoEstado}"?\nSe enviará el aviso a cambiosdeestado@ y, si corresponde, se creará el nuevo IDADMON en P.`)) return
    setCambiando(true); setMsg({ type: 'info', text: 'Procesando cambio de estado...' })
    try {
      const res = await fetch('/api/cc1/cambiar-estado', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idadmon: form.idadmon, estadoNuevo: nuevoEstado, fecha: fechaEstado || undefined }),
      })
      const data = await res.json()
      if (!res.ok) { setMsg({ type: 'error', text: data.error || 'Error al cambiar estado' }); setCambiando(false); return }
      setForm(p => ({ ...p, estado: nuevoEstado }))
      let txt = `✓ ${form.idadmon}: ${data.estadoAnterior || '—'} → ${data.estadoNuevo}.`
      if (data.nuevoP) txt += ` Creado ${data.nuevoP} en P (búsqueda de arrendatario).`
      if (data.warning) txt += ` ⚠ ${data.warning}`
      setMsg({ type: data.warning ? 'warn' : 'ok', text: txt })
      setNuevoEstado('')
    } catch (err) {
      setMsg({ type: 'error', text: 'Error de conexión' })
    }
    setCambiando(false)
  }

  async function resolverPendiente(idadmon, accion) {
    if (!window.confirm(`¿${accion === 'aprobar' ? 'Aprobar' : 'Rechazar'} el alta ${idadmon}?`)) return
    try {
      const res = await fetch('/api/cc1/aprobar-alta', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idadmon, accion }),
      })
      const data = await res.json()
      if (!res.ok) { setMsg({ type: 'error', text: data.error || 'Error' }); return }
      setMsg({ type: 'ok', text: data.mensaje })
      cargarCapacidades()
    } catch { setMsg({ type: 'error', text: 'Error de conexión' }) }
  }

  async function recuperar(id) {
    const buscar = (id || idadmonInput).trim().toUpperCase()
    contractOkRef.current = new Set()   // nueva sesión de edición: re-avisar si toca
    if (!buscar) { setMsg({ type: 'warn', text: 'Introduce un IDADMON' }); return }
    setMsg({ type: 'info', text: 'Buscando...' })
    const { data } = await supabase.from('datos_arriendos').select('*').eq('idadmon', buscar).single()
    if (data) {
      setForm(data); setIdadmonInput(buscar); setIsNew(false); setBloqueado(true)
      localStorage.setItem('ultimo_idadmon', buscar)
      // Capa 1: leer también el registro completo del log (raw_data)
      try {
        const { data: lrow } = await supabase.from('log').select('raw_data').eq('id_lcc', buscar).maybeSingle()
        setLogData(lrow?.raw_data || null)
        setLogEcon(econDesdeRaw(lrow?.raw_data))
        setPersonas(construirPersonas(lrow?.raw_data, data))
        const a2 = lrow?.raw_data?.['Nombre-A2']
        const g2 = lrow?.raw_data?.['Nombre-G2']
        const d2 = lrow?.raw_data?.['Nombre-D2']
        setArr2Abierto(!!(a2 && String(a2).trim()))
        setAval2Abierto(!!(g2 && String(g2).trim()))
        setProp2Abierto(!!(d2 && String(d2).trim()))
      } catch { setLogData(null); setLogEcon(econDesdeRaw(null)); setPersonas(construirPersonas(null, data)); setArr2Abierto(false); setAval2Abierto(false); setProp2Abierto(false) }
      // Propietario: leer su ficha de la tabla propietarios por idprop (fuente de verdad)
      try {
        if (data.idprop && String(data.idprop).trim()) {
          const { data: prow } = await supabase.from('propietarios').select('*').eq('idprop', String(data.idprop).trim()).maybeSingle()
          setPropData(prow || null)
        } else { setPropData(null) }
      } catch { setPropData(null) }
      setMsg({ type: 'ok', text: `✓ ${buscar} — ${data.propietario || ''} · ${data.inmueble || ''}` })
    } else {
      setForm({ ...FORM_VACIO, idadmon: buscar }); setIdadmonInput(buscar)
      setLogData(null); setLogEcon(econDesdeRaw(null)); setPropData(null); setPersonas({ arr1:{}, arr2:{}, aval1:{}, aval2:{} }); setArr2Abierto(false); setAval2Abierto(false); setProp2Abierto(false)
      setIsNew(true); setBloqueado(false)
      setMsg({ type: 'warn', text: `"${buscar}" no existe. Puedes crear un contrato nuevo.` })
    }
  }

  function handleChange(e) {
    if (bloqueado) return
    const { name, value, type, checked } = e.target
    if (!permiteEdicionContractual(name, AJUSTE_MENSUAL.has(name))) return
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  // Aplica el email de inicio parseado al formulario. Solo si el contrato está en P.
  function aplicarEmailInicio() {
    if (!form.idadmon && !isNew) { setMsg({ type: 'warn', text: 'Carga primero un IDADMON.' }); return }
    if (form.estado && String(form.estado).trim().toUpperCase() !== 'P') {
      setMsg({ type: 'warn', text: `⚠ Este contrato está en estado "${form.estado}", no en P. Un inicio solo se carga sobre un IDADMON en captación (P). Revisa que el IDADMON sea el correcto.` })
      return
    }
    const p = parseInicioEmail(textoEmail)
    if (!p.fecha_inicio && !p.arr.nombre && !p.cuota) {
      setMsg({ type: 'warn', text: 'No pude extraer datos del texto. Revisa que sea el email de inicio.' })
      return
    }
    // Campos del contrato
    setForm(prev => ({
      ...prev,
      ...(p.fecha_inicio    ? { fecha_inicio: p.fecha_inicio } : {}),
      ...(p.termino_inicial ? { termino_inicial: p.termino_inicial } : {}),
      ...(p.cuota           ? { cuota: p.cuota } : {}),
      ...(p.unid            ? { unid: p.unid } : {}),
      ...(p.bodega          ? { bodega: p.bodega } : {}),
      ...(p.estac           ? { estac: p.estac } : {}),
      ...(p.revision        ? { revision: p.revision } : {}),
      ...(p.sinGarantia     ? { garantia_pedida: '' } : {}),
      // Resumen de arrendatario en datos_arriendos
      ...(p.arr.nombre      ? { arrendatario: p.arr.nombre } : {}),
      ...(p.arr.rut         ? { rut: p.arr.rut } : {}),
      ...(p.arr.email       ? { mail_arrendatario: p.arr.email } : {}),
      ...(p.arr.telefono    ? { movil: p.arr.telefono } : {}),
    }))
    // Detalle del arrendatario 1 (personas.arr1)
    setPersonas(prev => ({
      ...prev,
      arr1: {
        ...prev.arr1,
        ...(p.arr.nombre   ? { nombre: p.arr.nombre } : {}),
        ...(p.arr.rut      ? { rut: p.arr.rut } : {}),
        ...(p.arr.estado   ? { estado: p.arr.estado } : {}),
        ...(p.arr.genero   ? { genero: p.arr.genero } : {}),
        ...(p.arr.email    ? { email: p.arr.email } : {}),
        ...(p.arr.telefono ? { telefono: p.arr.telefono } : {}),
        ...(p.arr.domHabit ? { domHabit: p.arr.domHabit } : {}),
        ...(p.arr.domLab   ? { domLab: p.arr.domLab } : {}),
      },
    }))
    setBloqueado(false)   // desbloquea para que Neika revise y ajuste
    setModalEmailAbierto(false)
    setMsg({ type: 'ok', text: '✓ Datos precargados desde el email. Revisa, completa lo que falte y pulsa GUARDAR.' })
  }

  async function guardar() {
    if (bloqueado) { setMsg({ type: 'warn', text: 'Desbloquea primero.' }); return }
    setSaving(true); setMsg(null)

    if (isNew) {
      try {
        const payload = { ...form }
        delete payload.id
        delete payload.idadmon
        // Postgres rechaza '' en columnas numéricas: convertir cadenas vacías a null
        for (const k in payload) { if (payload[k] === '') payload[k] = null }
        const res = await fetch('/api/cc1/alta', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ form: payload }),
        })
        const data = await res.json()
        if (!res.ok) { setMsg({ type: 'error', text: data.error || 'Error al dar de alta' }); setSaving(false); return }
        setForm(p => ({ ...p, idadmon: data.idadmon }))
        setIdadmonInput(data.idadmon)
        setIsNew(false); setBloqueado(true)
        localStorage.setItem('ultimo_idadmon', data.idadmon)
        setMsg({ type: data.pendiente_aprobacion ? 'warn' : 'ok', text: data.mensaje })
        cargarCapacidades()
      } catch (err) {
        setMsg({ type: 'error', text: 'Error de conexión' })
      }
      setSaving(false)
      return
    }

    const payload = { ...form, updated_at: new Date().toISOString() }
    delete payload.id
    // Postgres rechaza '' en columnas numéricas: convertir cadenas vacías a null
    for (const k in payload) { if (payload[k] === '') payload[k] = null }
    const { error } = await supabase.from('datos_arriendos').update(payload).eq('idadmon', form.idadmon)
    if (error) { setMsg({ type: 'error', text: 'Error: ' + error.message }); setSaving(false); return }

    // Guardar ARRENDATARIOS y AVALES en las dos tablas (log.raw_data completo + resumen en datos_arriendos)
    try {
      const res = await fetch('/api/cc1/guardar-personas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idadmon: form.idadmon, personas, econLog: logEcon }),
      })
      const dataP = await res.json()
      if (!res.ok) {
        setMsg({ type: 'warn', text: 'Contrato guardado, pero error al guardar personas: ' + (dataP.error || '') })
        setSaving(false); return
      }
    } catch {
      setMsg({ type: 'warn', text: 'Contrato guardado, pero fallo de conexión al guardar personas.' })
      setSaving(false); return
    }

    localStorage.setItem('ultimo_idadmon', form.idadmon); setIsNew(false); setBloqueado(true)

    // Si era una corrección excepcional, registrar el motivo en el histórico
    if (correccionAbierta) {
      try {
        await fetch('/api/cc1/registrar-correccion', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idadmon: form.idadmon, motivo: motivoCorr.trim() }),
        })
      } catch { /* el registro no debe romper el guardado */ }
      setCorreccionAbierta(false); setMotivoCorr('')
      setMsg({ type: 'ok', text: '✓ Corrección guardada y registrada.' })
      setSaving(false)
      return
    }

    setMsg({ type: 'ok', text: '✓ Guardado correctamente (contrato + arrendatarios/avales).' })
    setSaving(false)
  }

  // Guardar SOLO arrendatarios y avales (desde el modal). Recibe el 'draft' editado en el modal.
  async function guardarPersonasModal(draft, abiertos) {
    if (!form.idadmon) { setMsg({ type: 'warn', text: 'No hay contrato cargado.' }); return }
    setGuardandoModal(true)
    try {
      const res = await fetch('/api/cc1/guardar-personas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idadmon: form.idadmon, personas: draft }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMsg({ type: 'error', text: 'Error al guardar: ' + (data.error || '') })
        setGuardandoModal(false); return
      }
      // Solo si se guarda bien, aplicamos el draft al estado real (tabla refleja lo guardado)
      setPersonas(draft)
      if (abiertos) { setArr2Abierto(!!abiertos.arr2); setAval2Abierto(!!abiertos.aval2) }
      setGuardandoModal(false); setModalAbierto(false)
      setMsg({ type: 'ok', text: '✓ Arrendatarios y avales guardados.' })
    } catch {
      setGuardandoModal(false)
      setMsg({ type: 'error', text: 'Fallo de conexión al guardar.' })
    }
  }

  async function cerrarYFacturar() {
    if (bloqueado) { setMsg({ type: 'warn', text: 'Desbloquea primero.' }); return }
    if (!form.idadmon) { setMsg({ type: 'warn', text: 'No hay contrato cargado.' }); return }
    if (form.estado !== 'P') { setMsg({ type: 'warn', text: 'Esta acción solo aplica a contratos en estado P.' }); return }
    if (!window.confirm(`¿Cerrar la carga del contrato ${form.idadmon}?\n\nSe guardarán los datos actuales, el estado pasará de P a S, se bloqueará la ficha y se enviará la solicitud de facturación a Finanzas.`)) return
    setCambiando(true)
    try {
      // 1. Guardar la ficha ANTES de facturar, para que el email lleve los datos actuales
      //    (el endpoint de facturación lee desde la BD, no desde la pantalla).
      const payload = { ...form, updated_at: new Date().toISOString() }
      delete payload.id
      const { error: eSave } = await supabase.from('datos_arriendos').update(payload).eq('idadmon', form.idadmon)
      if (eSave) { setMsg({ type: 'error', text: 'No se pudo guardar antes de facturar: ' + eSave.message }); setCambiando(false); return }

      // Guardar también arrendatarios/avales (por si se editaron en línea y no se pulsó GUARDAR)
      try {
        await fetch('/api/cc1/guardar-personas', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idadmon: form.idadmon, personas, econLog: logEcon }),
        })
      } catch { /* no abortamos: el aviso de facturación seguirá con lo que haya en BD */ }

      // 2. Cerrar (P->S) + enviar avisos
      const res = await fetch('/api/cc1/cerrar-facturar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idadmon: form.idadmon }),
      })
      const data = await res.json()
      if (!res.ok) { setMsg({ type: 'error', text: data.error || 'Error al cerrar y facturar' }); setCambiando(false); return }
      setForm(p => ({ ...p, estado: 'S' })); setBloqueado(true)
      let txt = `Contrato ${form.idadmon} cerrado (estado S).`
      const fallo = (data.emailEstado === false) || (data.emailFacturacion === false)
      if (data.emailEstado === false) txt += ' AVISO de cambio de estado: FALLÓ.'
      if (data.emailFacturacion === false) txt += ' Email a Finanzas: FALLÓ.'
      if (!fallo) txt += ' Avisos enviados (cambio de estado + facturación a Finanzas).'
      setMsg({ type: fallo ? 'warn' : 'ok', text: txt })
    } catch { setMsg({ type: 'error', text: 'Error de conexión' }) }
    setCambiando(false)
  }

  const ro = bloqueado
  // ── Permisos de este usuario sobre el formulario (cap viene de /api/cc1/pendientes) ──
  const esResp = !!(cap && (cap.esDireccion || cap.rol === 'responsable' || cap.rol === 'direccion'))
  // Puede editar/guardar AHORA: responsable/Dirección siempre; colaborador (Inicio) solo si estado P.
  const puedeEditarAhora = !!(cap && cap.puedeEditar && (esResp || form.estado === 'P' || isNew))
  const puedeFacturarUsuario = !!(cap && cap.puedeFacturar)
  // Los campos económicos del LOG (porcentajes, C.Esp, Comentario) solo se editan en P,
  // salvo corrección excepcional activa (Anthony/Dirección). IDADMON y estado quedan fuera.
  const roLog = ro || (form.estado !== 'P' && !isNew && !correccionAbierta)
  // ADMON MES "Tipo": composición de si_fijo_admon (F=fijo) + adicionar_iva (SI).
  const tipoAdmon = (form.si_fijo_admon || form.adicionar_iva)
    ? ((form.si_fijo_admon === 'F' ? 'FIJO' : '%') + (form.adicionar_iva === 'SI' ? ' + IVA' : ''))
    : ''
  const setTipoAdmon = (val) => {
    if (!permiteEdicionContractual('tipoAdmon', false)) return
    const fijo = String(val).startsWith('FIJO')
    const iva = String(val).includes('+ IVA')
    setForm(p => ({ ...p, si_fijo_admon: fijo ? 'F' : '', adicionar_iva: iva ? 'SI' : 'NO' }))
  }

  return (
    <div style={{ height: '100vh', overflowY: 'auto', background: '#e8eef5' }}>
      {/* TopNav trae su propio position:sticky (top:0, alto 52px). No anidarlo en otro sticky. */}
      <TopNav />

      {/* ── CABECERA FIJA SECUNDARIA: barra de botones + mensajes + CAMBIAR ESTADO ──
           Va sticky a top:52 (justo debajo del TopNav). Se agrupan para que CAMBIAR ESTADO
           quede pegado debajo de la barra sin depender de alturas fijas (la barra puede ocupar 2 líneas). */}
      <div style={{ position: 'sticky', top: 52, zIndex: 90, background: '#e8eef5' }}>
      {/* ── BARRA DE BOTONES ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        padding: '8px 16px', background: '#f0f4f8',
        borderBottom: `2px solid ${C.headerBg}`,
      }}>
        <Link href="/cc1" style={{
          fontSize: 11, color: '#1a3a6b', textDecoration: 'none',
          display: 'flex', alignItems: 'center', gap: 3, marginRight: 4,
          fontWeight: 600,
        }}>← CC1</Link>

        <span style={{ color: C.border, fontSize: 14 }}>|</span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.headerBg }}>IDADMON</span>
          <input type="text" value={idadmonInput}
            onChange={e => setIdadmonInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && recuperar()}
            placeholder="A00268"
            style={{
              width: 90, padding: '4px 8px', fontSize: 13, fontWeight: 700,
              letterSpacing: '0.05em', border: `2px solid ${C.headerBg}`,
              borderRadius: 5, outline: 'none', color: C.headerBg,
              textTransform: 'uppercase',
            }}
          />
        </div>

        <button onClick={() => recuperar()} style={{
          padding: '5px 14px', borderRadius: 5, border: 'none',
          background: C.green, color: '#fff', fontSize: 12, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.03em',
        }}>RECUPERAR</button>

        <span style={{ color: C.border, fontSize: 14 }}>|</span>

        {puedeEditarAhora && (
        <button onClick={guardar} disabled={saving || bloqueado} style={{
          padding: '5px 14px', borderRadius: 5, border: 'none',
          background: bloqueado ? '#9ca3af' : C.green,
          color: '#fff', fontSize: 12, fontWeight: 700,
          cursor: bloqueado ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
        }}>{saving ? 'GUARDANDO...' : 'GUARDAR'}</button>
        )}

        {form.estado === 'P' && puedeFacturarUsuario && (
          <button onClick={cerrarYFacturar} disabled={bloqueado || cambiando}
            title="Cierra la carga del contrato: pasa de P a S, bloquea la ficha y envía la solicitud de facturación a Finanzas."
            style={{
              padding: '5px 14px', borderRadius: 5, border: 'none',
              background: (bloqueado || cambiando) ? '#9ca3af' : C.red,
              color: '#fff', fontSize: 12, fontWeight: 700,
              cursor: (bloqueado || cambiando) ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            }}>{cambiando ? 'PROCESANDO…' : 'CERRAR Y FACTURAR'}</button>
        )}

        {puedeEditarAhora && (
        <button onClick={() => { setBloqueado(false); setMsg({ type: 'info', text: '🔓 Desbloqueado — puedes editar.' }) }} style={{
          padding: '5px 14px', borderRadius: 5, border: 'none',
          background: bloqueado ? C.amber : '#6b7280',
          color: '#fff', fontSize: 12, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>{bloqueado ? '🔒 DESBLOQUEAR' : '🔓 DESBLOQUEADO'}</button>
        )}

        {puedeEditarAhora && (
          <button onClick={() => { setTextoEmail(''); setModalEmailAbierto(true) }}
            title="Pega el email de inicio de Neika y se rellenan los campos automáticamente"
            style={{
              padding: '5px 14px', borderRadius: 5, border: 'none',
              background: '#2563a8', color: '#fff', fontSize: 12, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>📩 Cargar datos email</button>
        )}

        {cap?.puedeAprobar && form.idadmon && !isNew && form.estado !== 'P' && !correccionAbierta && (
          <button onClick={() => { setMotivoCorr(''); setModalCorrAbierto(true) }} title="Corregir errores en un contrato activo (queda registrado)"
            style={{ padding: '5px 14px', borderRadius: 5, border: 'none',
              background: C.amber, color: '#fff', fontSize: 12, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit' }}>
            ⚠ Correcciones excepcionales
          </button>
        )}
        {correccionAbierta && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 10px', borderRadius: 5,
            background: '#fef3c7', border: '1px solid #fcd34d', fontSize: 12, color: '#92400e' }}>
            ✏ Corrección excepcional activa — edita y pulsa Guardar
            <button onClick={() => { setCorreccionAbierta(false); setMotivoCorr('') }}
              style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid #d6b34a', background: '#fff', cursor: 'pointer', fontSize: 11 }}>
              Cancelar
            </button>
          </span>
        )}

        <button onClick={() => { contractOkRef.current = new Set(); setForm(FORM_VACIO); setIdadmonInput(''); setLogData(null); setLogEcon(econDesdeRaw(null)); setPropData(null); setArr2Abierto(false); setAval2Abierto(false); setProp2Abierto(false); setIsNew(true); setBloqueado(false); setMsg(null); localStorage.removeItem('ultimo_idadmon') }}
          style={{
            marginLeft: 'auto', padding: '5px 12px', borderRadius: 5,
            border: `1px solid ${C.border}`, background: '#fff',
            fontSize: 12, color: C.headerBg, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>+ NUEVO</button>

        {form.idadmon && (
          <span style={{
            padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700,
            background: form.estado === 'S' ? '#dcfce7' : form.estado === 'Q' ? '#fef9c3' : '#f3f4f6',
            color: form.estado === 'S' ? '#15803d' : form.estado === 'Q' ? '#854d0e' : '#6b7280',
            border: '1px solid',
            borderColor: form.estado === 'S' ? '#86efac' : form.estado === 'Q' ? '#fde047' : '#d1d5db',
          }}>
            {form.estado || '—'}
          </span>
        )}
      </div>

      {msg && (
        <div style={{
          margin: '8px 16px 0', padding: '7px 14px', borderRadius: 6,
          fontSize: 11, fontWeight: 500,
          background: msgColors[msg.type]?.bg, color: msgColors[msg.type]?.color,
          border: `1px solid ${msgColors[msg.type]?.border}`,
        }}>{msg.text}</div>
      )}

      {cap?.puedeCambiarEstado && form.idadmon && !isNew && (
        <div style={{
          margin: '8px 16px 0', padding: '8px 14px', borderRadius: 6,
          background: '#eef4fb', border: `1px solid ${C.headerBg}`,
          boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.headerBg }}>CAMBIAR ESTADO:</span>
          <span style={{ fontSize: 11, color: '#6b7280' }}>Actual: <b>{form.estado || '—'}</b> →</span>
          {(() => {
            // Normaliza el estado actual (admite "N DICOM" y "N_DICOM" como "N-DICOM")
            const actual = (form.estado || '').toUpperCase().replace(/[ _]/g, '-')
            const validos = TRANSICIONES[actual] || []
            if (validos.length === 0) {
              return (
                <span style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>
                  Estado final — no admite más cambios.
                </span>
              )
            }
            return (
              <>
                <select value={nuevoEstado} onChange={e => setNuevoEstado(e.target.value)}
                  style={{ ...inputCell, width: 200, cursor: 'pointer', border: `1px solid ${C.border}` }}>
                  <option value="">elegir nuevo estado…</option>
                  {validos.map(s => <option key={s} value={s}>{ESTADO_LABEL[s] || s}</option>)}
                </select>
                <span style={{ fontSize: 10, color: '#9ca3af' }}>Fecha:</span>
                <input type="date" value={fechaEstado} onChange={e => setFechaEstado(e.target.value)}
                  style={{ ...inputCell, width: 140, border: `1px solid ${C.border}` }} />
                <button onClick={cambiarEstado} disabled={cambiando || !nuevoEstado}
                  style={{
                    padding: '5px 14px', borderRadius: 5, border: 'none',
                    background: (cambiando || !nuevoEstado) ? '#9ca3af' : C.headerBg,
                    color: '#fff', fontSize: 12, fontWeight: 700,
                    cursor: (cambiando || !nuevoEstado) ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                  }}>{cambiando ? 'Procesando…' : 'Aplicar cambio'}</button>
              </>
            )
          })()}
          <span style={{ fontSize: 10, color: '#9ca3af', flexBasis: '100%' }}>
            Al pasar a SQ o Q se crea automáticamente el siguiente IDADMON en P y se avisa a cambiosdeestado@.
          </span>
        </div>
      )}
      </div>{/* fin cabecera fija secundaria (sticky top:52) */}

      {cap?.puedeAprobar && pendientes.length > 0 && (
        <div style={{
          margin: '8px 16px 0', padding: '10px 14px', borderRadius: 6,
          background: '#fffbeb', border: '1px solid #fcd34d',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#b45309', marginBottom: 6 }}>
            🔔 Altas pendientes de aprobación ({pendientes.length})
          </div>
          {pendientes.map(p => (
            <div key={p.idadmon} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0',
              borderTop: '1px solid #fde68a', fontSize: 11,
            }}>
              <b style={{ color: C.headerBg, minWidth: 60 }}>{p.idadmon}</b>
              <span style={{ color: '#6b7280', flex: 1 }}>
                {p.propietario || '—'} · {p.inmueble || '—'} · creada por {p.creado_por || '—'}
              </span>
              <button onClick={() => resolverPendiente(p.idadmon, 'aprobar')}
                style={{ padding: '3px 12px', borderRadius: 5, border: 'none', background: C.green, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                Aprobar
              </button>
              <button onClick={() => resolverPendiente(p.idadmon, 'rechazar')}
                style={{ padding: '3px 12px', borderRadius: 5, border: 'none', background: C.red, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                Rechazar
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── FORMULARIO TIPO EXCEL ── */}
      <div style={{ padding: '10px 16px 40px', overflowX: 'auto' }}>
        {form.idadmon && !isNew && (
          <>
            {/* Fila 1: botón de edición + texto de ayuda (alineados a la izquierda) */}
            <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setModalAbierto(true)}
                style={{
                  padding: '6px 14px', borderRadius: 6, border: 'none',
                  background: C.subBg, color: '#fff', fontSize: 12, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                ✏ Editar arrendatarios y avales
              </button>
              <span style={{ fontSize: 11, color: '#6b7280' }}>
                Los datos de arrendatarios y avales se editan en una ventana cómoda. (El propietario se edita en su ficha.)
              </span>
            </div>
            {/* Fila 2: tarjeta de identificación, centrada en su propio bloque (replica el recuadro del Excel) */}
            <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
              <div style={{
                display: 'flex', border: `1px solid ${C.headerBg}`,
                borderRadius: 6, overflow: 'hidden', fontSize: 11,
              }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex' }}>
                    <span style={{ background: C.headerBg, color: '#fff', fontWeight: 700, padding: '3px 8px', minWidth: 78 }}>IDADMON</span>
                    <span style={{ padding: '3px 10px', fontWeight: 700, color: C.headerBg }}>{form.idadmon}</span>
                  </div>
                  <div style={{ display: 'flex', borderTop: `1px solid ${C.border}` }}>
                    <span style={{ background: C.headerBg, color: '#fff', fontWeight: 700, padding: '3px 8px', minWidth: 78 }}>ESTATUS</span>
                    <span style={{ padding: '3px 10px' }}>{form.estado || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', borderTop: `1px solid ${C.border}` }}>
                    <span style={{ background: C.headerBg, color: '#fff', fontWeight: 700, padding: '3px 8px', minWidth: 78 }}>FECHA REG</span>
                    <span style={{ padding: '3px 10px' }}>{lp('FECHA REGISTRO') || '—'}</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
        <table style={{
          borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed',
          fontSize: 11, fontFamily: 'inherit',
        }}>
          <colgroup>
            <col style={{ width: '6.5%' }} />   {/* label */}
            <col style={{ width: '6.5%' }} />    {/* Nombre a */}
            <col style={{ width: '6.5%' }} />    {/* Nombre b */}
            <col style={{ width: '4%' }} />      {/* Género */}
            <col style={{ width: '5.5%' }} />    {/* Estado */}
            <col style={{ width: '6.5%' }} />    {/* Nacionalidad */}
            <col style={{ width: '7.5%' }} />    {/* RUT */}
            <col style={{ width: '6%' }} />      {/* Pasaporte */}
            <col style={{ width: '6.5%' }} />    {/* Email a */}
            <col style={{ width: '6.5%' }} />    {/* Email b */}
            <col style={{ width: '7.5%' }} />    {/* Teléfono */}
            <col style={{ width: '12%' }} />     {/* D. Habitacional */}
            <col style={{ width: '10.5%' }} />   {/* Dom. laboral */}
            <col style={{ width: '6.5%' }} />    {/* Empresa */}
          </colgroup>
          <tbody>
            {/* ══ PROPIETARIO (lee de la tabla 'propietarios' por idprop; 2º propietario desde log) ══ */}
            <tr>
              <td style={{ ...labelCell, width: 90, verticalAlign: 'middle' }} rowSpan={2}>PROPIETARIO</td>
              <SH cols={2} bg={C.subBg}>Nombre</SH>
              <SH cols={1} bg={C.subBg}>Género</SH>
              <SH cols={1} bg={C.subBg}>Estado</SH>
              <SH cols={1} bg={C.subBg}>Nacionalidad</SH>
              <SH cols={1} bg={C.subBg}>RUT</SH>
              <SH cols={1} bg={C.subBg}>Pasaporte</SH>
              <SH cols={2} bg={C.subBg}>Email</SH>
              <SH cols={1} bg={C.subBg}>Teléfono</SH>
              <SH cols={1} bg={C.subBg}>D. Habitacional</SH>
              <SH cols={1} bg={C.subBg}>Dom. laboral</SH>
              <SH cols={1} bg={C.subBg}>Empresa</SH>
            </tr>
            <tr>
              {/* PROPIETARIO: fuente de verdad = tabla 'propietarios' (por idprop).
                  Opción A: solo los campos que esa tabla tiene; el resto queda vacío.
                  Todo en solo lectura en esta capa (se editará en la ficha del propietario, no aquí). */}
              <td colSpan={2} style={inputCell}><RO value={pp('propietario') || form.propietario} /></td>
              <td style={inputCell}><RO value={pp('genero')} /></td>
              <td style={inputCell}><RO value={''} /></td>
              <td style={inputCell}><RO value={''} /></td>
              <td style={inputCell}><RO value={pp('rut')} /></td>
              <td style={inputCell}><RO value={''} /></td>
              <td colSpan={2} style={inputCell}><RO value={pp('mail1')} /></td>
              <td style={inputCell}><RO value={pp('telefono')} /></td>
              <td style={inputCell}><RO value={pp('direccion')} /></td>
              <td style={inputCell}><RO value={''} /></td>
              <td style={inputCell}><RO value={''} /></td>
            </tr>

            {/* Botón: añadir 2º propietario */}
            <tr>
              <td colSpan={14} style={{ ...cell, border: 'none', padding: '4px 0 2px' }}>
                <button type="button" onClick={() => setProp2Abierto(v => !v)}
                  style={{
                    fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 5,
                    border: `1px solid ${C.border}`, background: prop2Abierto ? C.labelBg : '#fff',
                    color: C.headerBg, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  {prop2Abierto ? '− ocultar 2º propietario' : '+ añadir 2º propietario'}
                </button>
                <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 8 }}>
                  {form.idprop
                    ? `Datos del propietario ${form.idprop} (ficha en tabla propietarios). El 2º propietario es muy poco frecuente — datos del LOG, solo lectura.`
                    : '(muy poco frecuente — p. ej. propiedad heredada por dos titulares. Datos del LOG, solo lectura)'}
                </span>
              </td>
            </tr>

            {/* Fila 2º propietario (sufijos IRREGULARES: D2, D3, D4, D5, D6, D7, D8, D9, D10, D11, D12) */}
            {prop2Abierto && (
              <tr>
                <td style={{ ...labelCell, verticalAlign: 'middle', background: '#eef2f7' }}>PROPIETARIO 2</td>
                <td colSpan={2} style={inputCell}><RO value={lp('Nombre-D2')} /></td>
                <td style={inputCell}><RO value={lp('Genero-D3')} /></td>
                <td style={inputCell}><RO value={lp('Estado-D4')} /></td>
                <td style={inputCell}><RO value={lp('Nacion-D5')} /></td>
                <td style={inputCell}><RO value={lp('RUT de D6')} /></td>
                <td style={inputCell}><RO value={lp('Pasaporte-D7')} /></td>
                <td colSpan={2} style={inputCell}><RO value={lp('email de D8')} /></td>
                <td style={inputCell}><RO value={lp('telefono de D9')} /></td>
                <td style={inputCell}><RO value={lp('Dom-Habit-D10')} /></td>
                <td style={inputCell}><RO value={lp('Dom-Lab-D11')} /></td>
                <td style={inputCell}><RO value={lp('Empresa-D12')} /></td>
              </tr>
            )}

            {/* ══ INMUEBLE ══ */}
            <tr>
              <td style={labelCell} rowSpan={3}>INMUEBLE</td>
              <LB>Dirección 1</LB>
              <td colSpan={4} style={inputCell}><IC name="inmueble" value={form.inmueble} onChange={handleChange} readOnly={roLog} /></td>
              <LB right>Moneda</LB>
              <td style={inputCell}><SC name="unid" value={form.unid} onChange={handleChange} readOnly={roLog} options={[{v:'$',l:'Pesos'},{v:'UF',l:'UF'}]} /></td>
              <LB right>Monto</LB>
              <td colSpan={2} style={inputCell}><IC name="cuota" value={form.cuota} onChange={handleChange} readOnly={roLog} type="number" bold /></td>
              <LB right>A quién pagar</LB>
              <td colSpan={2} style={inputCell}><IC name="quien_cobra" value={form.quien_cobra} onChange={handleChange} readOnly={roLog} /></td>
            </tr>
            <tr>
              <LB>Comuna</LB>
              <td colSpan={3} style={inputCell}><IC name="idlinmue" value={form.idlinmue} onChange={handleChange} readOnly={roLog} /></td>
              <LB right>Comienzo</LB>
              <td colSpan={2} style={inputCell}><IC name="fecha_inicio" value={form.fecha_inicio} onChange={handleChange} readOnly={roLog} type="date" /></td>
              <LB right>Finalización</LB>
              <td colSpan={2} style={inputCell}><IC name="termino_inicial" value={form.termino_inicial} onChange={handleChange} readOnly={roLog} type="date" /></td>
              <LB right>Ajuste</LB>
              <td colSpan={2} style={inputCell}><IC name="revision" value={form.revision} onChange={handleChange} readOnly={roLog} /></td>
            </tr>
            <tr>
              <LB>Características</LB>
              <td colSpan={4} style={inputCell}><IC name="tipo" value={form.tipo} onChange={handleChange} readOnly={roLog} /></td>
              <LB right>Bodega</LB>
              <td style={inputCell}><IC name="bodega" value={form.bodega} onChange={handleChange} readOnly={roLog} /></td>
              <LB right>Estacionamiento</LB>
              <td colSpan={2} style={inputCell}><IC name="estac" value={form.estac} onChange={handleChange} readOnly={roLog} /></td>
              <LB right>Proporcional</LB>
              <td colSpan={2} style={inputCell}><IC name="proporcional" value={form.proporcional} onChange={handleChange} readOnly={roLog} /></td>
            </tr>

            {/* ══ ARRENDATARIO (Capa 1: rellenado desde log) ══ */}
            <tr>
              <td style={{ ...labelCell, verticalAlign: 'middle' }} rowSpan={2}>ARRENDATARIO</td>
              <SH cols={2} bg={C.subBg}>Nombres</SH>
              <SH cols={1} bg={C.subBg}>Género</SH>
              <SH cols={1} bg={C.subBg}>Estado</SH>
              <SH cols={1} bg={C.subBg}>Nacionalidad</SH>
              <SH cols={1} bg={C.subBg}>RUT</SH>
              <SH cols={1} bg={C.subBg}>Pasaporte</SH>
              <SH cols={2} bg={C.subBg}>Email</SH>
              <SH cols={1} bg={C.subBg}>Teléfono</SH>
              <SH cols={1} bg={C.subBg}>D. Habitacional</SH>
              <SH cols={1} bg={C.subBg}>Dom. laboral</SH>
              <SH cols={1} bg={C.subBg}>Empresa</SH>
            </tr>
            <tr>
              {/* Todos los campos editan el estado 'personas'. arr1.nombre/rut/email/telefono
                  se guardan también en datos_arriendos (resumen) además de en log. */}
              <td colSpan={2} style={inputCell}><PCell value={personas?.arr1?.nombre} bloque="arr1" campo="nombre" onSet={setPersona} ro={roLog} /></td>
              <td style={inputCell}><PCell value={personas?.arr1?.genero} bloque="arr1" campo="genero" onSet={setPersona} ro={roLog} /></td>
              <td style={inputCell}><PCell value={personas?.arr1?.estado} bloque="arr1" campo="estado" onSet={setPersona} ro={roLog} /></td>
              <td style={inputCell}><PCell value={personas?.arr1?.nacion} bloque="arr1" campo="nacion" onSet={setPersona} ro={roLog} /></td>
              <td style={inputCell}><PCell value={personas?.arr1?.rut} bloque="arr1" campo="rut" onSet={setPersona} ro={roLog} /></td>
              <td style={inputCell}><PCell value={personas?.arr1?.pasaporte} bloque="arr1" campo="pasaporte" onSet={setPersona} ro={roLog} /></td>
              <td colSpan={2} style={inputCell}><PCell value={personas?.arr1?.email} bloque="arr1" campo="email" onSet={setPersona} ro={roLog} /></td>
              <td style={inputCell}><PCell value={personas?.arr1?.telefono} bloque="arr1" campo="telefono" onSet={setPersona} ro={roLog} /></td>
              <td style={inputCell}><PCell value={personas?.arr1?.domHabit} bloque="arr1" campo="domHabit" onSet={setPersona} ro={roLog} area onExpand={abrirExpandir} /></td>
              <td style={inputCell}><PCell value={personas?.arr1?.domLab} bloque="arr1" campo="domLab" onSet={setPersona} ro={roLog} area onExpand={abrirExpandir} /></td>
              <td style={inputCell}><PCell value={personas?.arr1?.empresa} bloque="arr1" campo="empresa" onSet={setPersona} ro={roLog} /></td>
            </tr>

            {/* Botón: añadir 2º arrendatario */}
            <tr>
              <td colSpan={14} style={{ ...cell, border: 'none', padding: '4px 0 2px' }}>
                <button type="button" onClick={() => setArr2Abierto(v => !v)}
                  style={{
                    fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 5,
                    border: `1px solid ${C.border}`, background: arr2Abierto ? C.labelBg : '#fff',
                    color: C.headerBg, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  {arr2Abierto ? '− ocultar 2º arrendatario' : '+ añadir 2º arrendatario'}
                </button>
                <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 8 }}>
                  (poco frecuente — datos del registro LOG)
                </span>
              </td>
            </tr>

            {/* Fila 2º arrendatario (desplegable, editable -> log -A2) */}
            {arr2Abierto && (
              <tr>
                <td style={{ ...labelCell, verticalAlign: 'middle', background: '#eef2f7' }}>ARRENDATARIO 2</td>
                <td colSpan={2} style={inputCell}><PCell value={personas?.arr2?.nombre} bloque="arr2" campo="nombre" onSet={setPersona} ro={roLog} /></td>
                <td style={inputCell}><PCell value={personas?.arr2?.genero} bloque="arr2" campo="genero" onSet={setPersona} ro={roLog} /></td>
                <td style={inputCell}><PCell value={personas?.arr2?.estado} bloque="arr2" campo="estado" onSet={setPersona} ro={roLog} /></td>
                <td style={inputCell}><PCell value={personas?.arr2?.nacion} bloque="arr2" campo="nacion" onSet={setPersona} ro={roLog} /></td>
                <td style={inputCell}><PCell value={personas?.arr2?.rut} bloque="arr2" campo="rut" onSet={setPersona} ro={roLog} /></td>
                <td style={inputCell}><PCell value={personas?.arr2?.pasaporte} bloque="arr2" campo="pasaporte" onSet={setPersona} ro={roLog} /></td>
                <td colSpan={2} style={inputCell}><PCell value={personas?.arr2?.email} bloque="arr2" campo="email" onSet={setPersona} ro={roLog} /></td>
                <td style={inputCell}><PCell value={personas?.arr2?.telefono} bloque="arr2" campo="telefono" onSet={setPersona} ro={roLog} /></td>
                <td style={inputCell}><PCell value={personas?.arr2?.domHabit} bloque="arr2" campo="domHabit" onSet={setPersona} ro={roLog} area onExpand={abrirExpandir} /></td>
                <td style={inputCell}><PCell value={personas?.arr2?.domLab} bloque="arr2" campo="domLab" onSet={setPersona} ro={roLog} area onExpand={abrirExpandir} /></td>
                <td style={inputCell}><PCell value={personas?.arr2?.empresa} bloque="arr2" campo="empresa" onSet={setPersona} ro={roLog} /></td>
              </tr>
            )}

            <tr>
              <td colSpan={14} style={{ ...inputCell, background: C.rowAlt, height: 14, border: 'none' }}></td>
            </tr>

            {/* ══ AVALES (Capa 2: rellenado desde log -G, con 2º aval) ══ */}
            <tr>
              <td style={{ ...labelCell, verticalAlign: 'middle' }} rowSpan={2}>AVALES</td>
              <SH cols={2} bg={C.subBg}>Nombres</SH>
              <SH cols={1} bg={C.subBg}>Género</SH>
              <SH cols={1} bg={C.subBg}>Estado</SH>
              <SH cols={1} bg={C.subBg}>Nacionalidad</SH>
              <SH cols={1} bg={C.subBg}>RUT</SH>
              <SH cols={1} bg={C.subBg}>Pasaporte</SH>
              <SH cols={2} bg={C.subBg}>Email</SH>
              <SH cols={1} bg={C.subBg}>Teléfono</SH>
              <SH cols={1} bg={C.subBg}>D. Habitacional</SH>
              <SH cols={1} bg={C.subBg}>Dom. laboral</SH>
              <SH cols={1} bg={C.subBg}>Empresa</SH>
            </tr>
            <tr>
              {/* aval1.nombre/email/telefono se guardan también en datos_arriendos (resumen) además de log. */}
              <td colSpan={2} style={inputCell}><PCell value={personas?.aval1?.nombre} bloque="aval1" campo="nombre" onSet={setPersona} ro={roLog} /></td>
              <td style={inputCell}><PCell value={personas?.aval1?.genero} bloque="aval1" campo="genero" onSet={setPersona} ro={roLog} /></td>
              <td style={inputCell}><PCell value={personas?.aval1?.estado} bloque="aval1" campo="estado" onSet={setPersona} ro={roLog} /></td>
              <td style={inputCell}><PCell value={personas?.aval1?.nacion} bloque="aval1" campo="nacion" onSet={setPersona} ro={roLog} /></td>
              <td style={inputCell}><PCell value={personas?.aval1?.rut} bloque="aval1" campo="rut" onSet={setPersona} ro={roLog} /></td>
              <td style={inputCell}><PCell value={personas?.aval1?.pasaporte} bloque="aval1" campo="pasaporte" onSet={setPersona} ro={roLog} /></td>
              <td colSpan={2} style={inputCell}><PCell value={personas?.aval1?.email} bloque="aval1" campo="email" onSet={setPersona} ro={roLog} /></td>
              <td style={inputCell}><PCell value={personas?.aval1?.telefono} bloque="aval1" campo="telefono" onSet={setPersona} ro={roLog} /></td>
              <td style={inputCell}><PCell value={personas?.aval1?.domHabit} bloque="aval1" campo="domHabit" onSet={setPersona} ro={roLog} area onExpand={abrirExpandir} /></td>
              <td style={inputCell}><PCell value={personas?.aval1?.domLab} bloque="aval1" campo="domLab" onSet={setPersona} ro={roLog} area onExpand={abrirExpandir} /></td>
              <td style={inputCell}><PCell value={personas?.aval1?.empresa} bloque="aval1" campo="empresa" onSet={setPersona} ro={roLog} /></td>
            </tr>

            {/* Botón: añadir 2º aval */}
            <tr>
              <td colSpan={14} style={{ ...cell, border: 'none', padding: '4px 0 2px' }}>
                <button type="button" onClick={() => setAval2Abierto(v => !v)}
                  style={{
                    fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 5,
                    border: `1px solid ${C.border}`, background: aval2Abierto ? C.labelBg : '#fff',
                    color: C.headerBg, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  {aval2Abierto ? '− ocultar 2º aval' : '+ añadir 2º aval'}
                </button>
                <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 8 }}>
                  (poco frecuente — datos del registro LOG)
                </span>
              </td>
            </tr>

            {/* Fila 2º aval (desplegable, editable -> log -G2) */}
            {aval2Abierto && (
              <tr>
                <td style={{ ...labelCell, verticalAlign: 'middle', background: '#eef2f7' }}>AVAL 2</td>
                <td colSpan={2} style={inputCell}><PCell value={personas?.aval2?.nombre} bloque="aval2" campo="nombre" onSet={setPersona} ro={roLog} /></td>
                <td style={inputCell}><PCell value={personas?.aval2?.genero} bloque="aval2" campo="genero" onSet={setPersona} ro={roLog} /></td>
                <td style={inputCell}><PCell value={personas?.aval2?.estado} bloque="aval2" campo="estado" onSet={setPersona} ro={roLog} /></td>
                <td style={inputCell}><PCell value={personas?.aval2?.nacion} bloque="aval2" campo="nacion" onSet={setPersona} ro={roLog} /></td>
                <td style={inputCell}><PCell value={personas?.aval2?.rut} bloque="aval2" campo="rut" onSet={setPersona} ro={roLog} /></td>
                <td style={inputCell}><PCell value={personas?.aval2?.pasaporte} bloque="aval2" campo="pasaporte" onSet={setPersona} ro={roLog} /></td>
                <td colSpan={2} style={inputCell}><PCell value={personas?.aval2?.email} bloque="aval2" campo="email" onSet={setPersona} ro={roLog} /></td>
                <td style={inputCell}><PCell value={personas?.aval2?.telefono} bloque="aval2" campo="telefono" onSet={setPersona} ro={roLog} /></td>
                <td style={inputCell}><PCell value={personas?.aval2?.domHabit} bloque="aval2" campo="domHabit" onSet={setPersona} ro={roLog} area onExpand={abrirExpandir} /></td>
                <td style={inputCell}><PCell value={personas?.aval2?.domLab} bloque="aval2" campo="domLab" onSet={setPersona} ro={roLog} area onExpand={abrirExpandir} /></td>
                <td style={inputCell}><PCell value={personas?.aval2?.empresa} bloque="aval2" campo="empresa" onSet={setPersona} ro={roLog} /></td>
              </tr>
            )}

            <tr>
              <td colSpan={14} style={{ ...inputCell, background: C.rowAlt, height: 14, border: 'none' }}></td>
            </tr>

            {/* ══ CONDICIONES ══ */}
            <tr>
              <td style={{ ...labelCell, verticalAlign: 'middle' }} rowSpan={5}>CONDICIONES</td>
              <LB>Garantía</LB>
              <td colSpan={2} style={inputCell}><IC name="garantia_pedida" value={form.garantia_pedida} onChange={handleChange} readOnly={roLog} type="number" /></td>
              <LB>A quién</LB>
              <td style={inputCell}><IC name="quien_tiene_garantia" value={form.quien_tiene_garantia} onChange={handleChange} readOnly={roLog} /></td>
              <LB>Extensión</LB>
              <td style={inputCell}><IC name="comentar_renovacion" value={form.comentar_renovacion} onChange={handleChange} readOnly={roLog} /></td>
              <LB>Nuevo final</LB>
              <td colSpan={2} style={inputCell}><IC name="termino_actual" value={form.termino_actual} onChange={handleChange} readOnly={roLog} type="date" bold /></td>
              <LB>Especial primeros meses</LB>
              <td colSpan={3} style={inputCell}><IC name="especial_a" value={form.especial_a} onChange={handleChange} readOnly={roLog} /></td>
            </tr>
            <tr>
              <LB>Plazo 1</LB>
              <td style={inputCell}><IC name="fecha1" value={form.fecha1} onChange={handleChange} readOnly={roLog} type="date" /></td>
              <LB>Cantidad 1</LB>
              <td style={inputCell}><IC name="cuota1" value={form.cuota1} onChange={handleChange} readOnly={roLog} type="number" /></td>
              <LB>Plazo 2</LB>
              <td style={inputCell}><IC name="fecha2" value={form.fecha2} onChange={handleChange} readOnly={roLog} type="date" /></td>
              <LB>Cantidad 2</LB>
              <td style={inputCell}><IC name="cuota2" value={form.cuota2} onChange={handleChange} readOnly={roLog} type="number" /></td>
              <LB>Meses</LB>
              <td style={inputCell}><IC name="meses" value={form.meses} onChange={handleChange} readOnly={roLog} type="number" /></td>
              <td colSpan={3} style={{ ...inputCell, background: C.rowAlt }}></td>
            </tr>
            <tr>
              <LB>Plazo 3</LB>
              <td style={inputCell}><IC name="fecha3" value={form.fecha3} onChange={handleChange} readOnly={roLog} type="date" /></td>
              <LB>Cantidad 3</LB>
              <td style={inputCell}><IC name="cuota3" value={form.cuota3} onChange={handleChange} readOnly={roLog} type="number" /></td>
              <LB>Plazo 4</LB>
              <td style={inputCell}><IC name="fecha4" value={form.fecha4} onChange={handleChange} readOnly={roLog} type="date" /></td>
              <LB>Cantidad 4</LB>
              <td style={inputCell}><IC name="cuota4" value={form.cuota4} onChange={handleChange} readOnly={roLog} type="number" /></td>
              <LB>Cantidad</LB>
              <td style={inputCell}><IC name="cantidad" value={form.cantidad} onChange={handleChange} readOnly={roLog} type="number" bold /></td>
              <td colSpan={3} style={{ ...inputCell, background: C.rowAlt }}></td>
            </tr>
            <tr>
              <LB cols={4}>Cláusula aceleración</LB>
              <td colSpan={4} style={inputCell}><IC name="tipo_aceleracion" value={form.tipo_aceleracion} onChange={handleChange} readOnly={roLog} /></td>
              <LB right>Multas</LB>
              <td style={inputCell}><IC name="multa_diaria" value={form.multa_diaria} onChange={handleChange} readOnly={roLog} type="number" /></td>
              <td colSpan={4} style={{ ...inputCell, background: C.rowAlt }}></td>
            </tr>
            <tr>
              <td colSpan={13} style={{ ...inputCell, background: '#fff', border: `1px solid ${C.border}` }}>
                <textarea name="comentarios" value={form.comentarios ?? ''} onChange={handleChange}
                  readOnly={roLog} rows={2}
                  style={{ width: '100%', border: 'none', background: 'transparent', fontSize: 11, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }}
                  placeholder="COMENTARIOS..." />
              </td>
            </tr>

          </tbody>
        </table>

        {/* ══ DATOS ECONÓMICOS — encabezado verde fuerte; PROP/ARREND en verde; ADMON MES en gris ══ */}
        <div style={{ maxWidth: 820, margin: '16px auto 0' }}>
          <div style={{
            background: ECO.head, color: '#fff', padding: '4px 10px',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textAlign: 'center',
            borderRadius: '6px 6px 0 0',
          }}>
            DATOS ECONÓMICOS
          </div>
          {!roLog && form.unid === 'UF' && String(form.cuota ?? '').trim() && !ufMes && (
            <div style={{
              background: '#fffbeb', color: '#b45309', border: '1px solid #fcd34d', borderTop: 'none',
              fontSize: 10.5, padding: '4px 10px', textAlign: 'center',
            }}>
              ⚠ Falta la UF del mes en curso en indices_mensuales: no se puede calcular la Cantidad del corretaje. Cárgala y vuelve a entrar.
            </div>
          )}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 0.55fr', gap: 0,
            border: `1px solid ${ECO.border}`, borderTop: 'none',
          }}>
            {/* PROPIETARIO — 2 columnas × 4 filas (Porcentaje/C.Esp/Coment vienen del LOG) */}
            <div style={{ borderRight: `1px solid ${ECO.border}` }}>
              <div style={{ background: ECO.sub, color: '#fff', textAlign: 'center', fontSize: 10, fontWeight: 700, padding: '3px 0', letterSpacing: '0.04em' }}>PROPIETARIO</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'repeat(4, auto)', gridAutoFlow: 'column' }}>
                <EcoCell label="Porcentaje" name="porcentD" value={logEcon.porcentD} onChange={e => setLogEconCampo('porcentD', e.target.value)} ro={roLog} />
                <EcoCell label="Cantidad" name="comision_d_base" value={form.comision_d_base} onChange={() => {}} ro money />
                <EcoCell label="Con IVA" name="iva_comision_d" value={form.iva_comision_d} onChange={() => {}} ro money />
                <EcoCell label="Total" name="comision_d_total" value={form.comision_d_total} onChange={() => {}} ro money bold />
                <EcoCell label="C. Esp." name="cEspProp" value={logEcon.cEspProp} onChange={e => setLogEconCampo('cEspProp', e.target.value)} ro={roLog} />
                <EcoCell label="Coment." name="comentProp" value={logEcon.comentProp} onChange={e => setLogEconCampo('comentProp', e.target.value)} ro={roLog} />
                <EcoCell label="Bol/Fac" name="comision_cobrado" value={form.comision_cobrado} onChange={handleChange} ro={roLog} options={['', 'BOLETA', 'FACTURA']} />
              </div>
            </div>
            {/* ARRENDATARIO — 2 columnas × 4 filas (Porcentaje/C.Esp/Coment vienen del LOG) */}
            <div style={{ borderRight: `1px solid ${ECO.border}` }}>
              <div style={{ background: ECO.sub, color: '#fff', textAlign: 'center', fontSize: 10, fontWeight: 700, padding: '3px 0', letterSpacing: '0.04em' }}>ARRENDATARIO</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'repeat(4, auto)', gridAutoFlow: 'column' }}>
                <EcoCell label="Porcentaje" name="porcentA" value={logEcon.porcentA} onChange={e => setLogEconCampo('porcentA', e.target.value)} ro={roLog} />
                <EcoCell label="Cantidad" name="comision_a_base" value={form.comision_a_base} onChange={() => {}} ro money />
                <EcoCell label="Con IVA" name="iva_comision_a" value={form.iva_comision_a} onChange={() => {}} ro money />
                <EcoCell label="Total" name="comision_a_total" value={form.comision_a_total} onChange={() => {}} ro money bold />
                <EcoCell label="C. Esp." name="cEspArr" value={logEcon.cEspArr} onChange={e => setLogEconCampo('cEspArr', e.target.value)} ro={roLog} />
                <EcoCell label="Coment." name="comentArr" value={logEcon.comentArr} onChange={e => setLogEconCampo('comentArr', e.target.value)} ro={roLog} />
                <EcoCell label="Bol/Fac" name="comision_a_pagado" value={form.comision_a_pagado} onChange={handleChange} ro={roLog} options={['', 'BOLETA', 'FACTURA']} />
              </div>
            </div>
            {/* ADMON MES — Cuantía=pct_adm, Tipo=si_fijo_admon+adicionar_iva */}
            <div>
              <div style={{ background: ECG.sub, color: '#fff', textAlign: 'center', fontSize: 10, fontWeight: 700, padding: '3px 0', letterSpacing: '0.04em' }}>ADMON MES</div>
              <EcoCell label="Tipo" name="tipoAdmon" value={tipoAdmon} onChange={e => setTipoAdmon(e.target.value)} ro={roLog} pal={ECG} options={['', '%', '% + IVA', 'FIJO', 'FIJO + IVA']} />
              <EcoCell label="Cuantía" name="pct_adm" value={form.pct_adm} onChange={handleChange} ro={roLog} bold pal={ECG} />
              <EcoCell label="Especial" name="mowner" value={form.mowner} onChange={handleChange} ro={roLog} pal={ECG} />
            </div>
          </div>
        </div>

        {/* ══ DATOS ADICIONALES ══ */}
        <div style={{
          marginTop: 20, background: '#fff',
          border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden',
        }}>
          <button onClick={() => setAdicionalesAbierto(v => !v)}
            style={{
              width: '100%', background: C.headerBg, color: '#fff', padding: '8px 14px',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', border: 'none',
              cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
            <span>DATOS ADICIONALES</span>
            <span style={{ fontSize: 12 }}>{adicionalesAbierto ? '▲ ocultar' : '▼ mostrar'}</span>
          </button>
          {adicionalesAbierto && (
            <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
              {[
                ['Reajuste 1 fecha', 'fecha_reajuste1', 'date'],
                ['Reajuste 1 cant.', 'cantidad_reajuste1', 'number'],
                ['Reajuste 2 fecha', 'fecha_reajuste2', 'date'],
                ['Reajuste 2 cant.', 'cantidad_reajuste2', 'number'],
                ['Reajuste 3 fecha', 'fecha_reajuste3', 'date'],
                ['Reajuste 3 cant.', 'cantidad_reajuste3', 'number'],
                ['Reajuste 4 fecha', 'fecha_reajuste4', 'date'],
                ['Reajuste 4 cant.', 'cantidad_reajuste4', 'number'],
                ['En legal', 'en_legal', 'text'],
                ['Sub-estado', 'sub_estado', 'text'],
                ['Responsable', 'responsable', 'text'],
                ['IDADMON siguiente', 'idadmon_siguiente', 'text'],
                ['Repetición IDADMON', 'repeticion_idadmon', 'text'],
                ['C. Término', 'c_termino', 'text'],
                ['C. Garantía', 'c_garantia', 'text'],
                ['Deuda garantía', 'deuda_garantia', 'text'],
                ['Aseo 1', 'aseo1', 'text'],
                ['Aseo 2', 'aseo2', 'text'],
                ['Aseo 3', 'aseo3', 'text'],
                ['Tiene termo mant.', 'tiene_termo_mant', 'text'],
                ['Fecha mant.', 'fecha_mant', 'date'],
                ['UF/Peso factor', 'uf_peso_factor', 'text'],
                ['ID Admo', 'idadmo', 'text'],
                ['Comisión base', 'comision_base', 'number'],
              ].map(([label, name, type]) => (
                <div key={name}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: C.labelText, marginBottom: 3 }}>{label}</div>
                  <input type={type} name={name} value={form[name] ?? ''} onChange={handleChange}
                    readOnly={roLog}
                    style={{
                      ...fieldInput,
                      width: '100%', padding: '5px 8px', fontSize: 11,
                      background: ro ? '#f8fafc' : '#fff',
                      border: `1px solid ${C.border}`, borderRadius: 4,
                    }} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══ MODAL: Motivo de corrección excepcional ══ */}
      {modalCorrAbierto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setModalCorrAbierto(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 10, padding: 22,
            width: 'min(540px, 92vw)', boxShadow: '0 12px 40px rgba(0,0,0,.25)' }}>
            <h3 style={{ margin: '0 0 8px', color: C.headerBg, fontSize: 17 }}>⚠ Correcciones excepcionales</h3>
            <p style={{ fontSize: 13, color: '#475569', margin: '0 0 14px', lineHeight: 1.5 }}>
              Vas a habilitar la edición de un contrato activo para corregir un error. Esto debería usarse
              muy pocas veces. Escribe el motivo de la corrección: quedará registrado con tu nombre y la fecha.
              <br /><br />
              No se podrán cambiar el IDADMON ni el estado del contrato.
            </p>
            <textarea value={motivoCorr} onChange={e => setMotivoCorr(e.target.value)} rows={3}
              placeholder="Motivo (ej.: la cuota se cargó mal en el alta; corrijo de 250.000 a 265.000)"
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 13,
                border: '1px solid #cbd5e1', borderRadius: 6, fontFamily: 'inherit', resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setModalCorrAbierto(false)}
                style={{ fontSize: 13, padding: '8px 16px', borderRadius: 6, border: '1px solid #cbd5e1',
                  background: '#fff', color: '#475569', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={() => { setCorreccionAbierta(true); setBloqueado(false); setModalCorrAbierto(false); setMsg({ type: 'info', text: 'Edición habilitada. Corrige y pulsa Guardar.' }) }}
                disabled={motivoCorr.trim().length < 5}
                style={{ fontSize: 13, fontWeight: 600, padding: '8px 18px', borderRadius: 6, border: 'none',
                  background: motivoCorr.trim().length < 5 ? '#9ca3af' : C.amber,
                  color: '#fff', cursor: motivoCorr.trim().length < 5 ? 'not-allowed' : 'pointer' }}>
                Habilitar edición
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: Editar arrendatarios y avales ══ */}
      {modalAbierto && (
        <ModalPersonas
          personasIniciales={personas}
          arr2Inicial={arr2Abierto}
          aval2Inicial={aval2Abierto}
          guardando={guardandoModal}
          onGuardar={guardarPersonasModal}
          onCerrar={() => setModalAbierto(false)}
          idadmon={form.idadmon}
        />
      )}

      {/* ══ MODAL: Cargar datos del email de inicio ══ */}
      {modalEmailAbierto && (
        <div onClick={() => setModalEmailAbierto(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 2600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '30px 16px' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 10, width: 'min(680px, 96vw)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
            <div style={{ background: C.headerBg, color: '#fff', padding: '10px 16px', fontSize: 14, fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>📩 Cargar datos del email de inicio {form.idadmon ? `· ${form.idadmon}` : ''}</span>
              <button type="button" onClick={() => setModalEmailAbierto(false)}
                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ fontSize: 12, color: '#555', marginBottom: 8 }}>
                Pega el texto del email de inicio (el que envía Neika). Se rellenarán los campos del contrato y del arrendatario. Después revisa, completa lo que falte y pulsa <b>GUARDAR</b>. Solo funciona si el contrato está en <b>P</b>.
              </div>
              <textarea autoFocus value={textoEmail} onChange={e => setTextoEmail(e.target.value)}
                placeholder="Pega aquí el email…"
                style={{ width: '100%', minHeight: 220, boxSizing: 'border-box', padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', border: `1px solid ${C.border}`, borderRadius: 6, outline: 'none', resize: 'vertical', color: '#1f2937' }}
              />
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" onClick={() => setModalEmailAbierto(false)}
                  style={{ padding: '7px 16px', borderRadius: 6, border: `1px solid ${C.border}`, background: '#fff', color: '#374151', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Cancelar
                </button>
                <button type="button" onClick={aplicarEmailInicio} disabled={!textoEmail.trim()}
                  style={{ padding: '7px 18px', borderRadius: 6, border: 'none', background: textoEmail.trim() ? C.green : '#9ca3af', color: '#fff', fontSize: 13, fontWeight: 700, cursor: textoEmail.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
                  Extraer y precargar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ POP-UP de expansión de campo largo (domicilios) ══ */}
      {expandir && (() => {
        const BL = { arr1: 'Arrendatario 1', arr2: 'Arrendatario 2', aval1: 'Aval 1', aval2: 'Aval 2' }
        const CA = { domHabit: 'Domicilio habitacional', domLab: 'Domicilio laboral' }
        const valor = personas?.[expandir.bloque]?.[expandir.campo] ?? ''
        return (
          <div onClick={() => setExpandir(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 2500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '30px 16px' }}>
            <div onClick={e => e.stopPropagation()}
              style={{ background: '#fff', borderRadius: 10, width: 'min(560px, 96vw)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
              <div style={{ background: C.headerBg, color: '#fff', padding: '10px 16px', fontSize: 14, fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{(CA[expandir.campo] || expandir.campo)} · {(BL[expandir.bloque] || expandir.bloque)}</span>
                <button type="button" onClick={() => setExpandir(null)}
                  style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>✕</button>
              </div>
              <div style={{ padding: 16 }}>
                <textarea
                  autoFocus value={valor} readOnly={roLog}
                  onChange={e => setPersona(expandir.bloque, expandir.campo, e.target.value)}
                  style={{ width: '100%', minHeight: 140, boxSizing: 'border-box', padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', border: `1px solid ${C.border}`, borderRadius: 6, outline: 'none', resize: 'vertical', color: '#1f2937' }}
                />
                <div style={{ marginTop: 12, textAlign: 'right' }}>
                  <button type="button" onClick={() => setExpandir(null)}
                    style={{ padding: '7px 18px', borderRadius: 6, border: 'none', background: C.subBg, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Listo
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

const fieldInput = {
  outline: 'none', fontFamily: 'inherit', color: '#1f2937',
}

/* ══ Estilos del modal (fuera para no recrearlos) ══ */
const M_lab = { fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 3, display: 'block' }
const M_inp = { width: '100%', padding: '7px 9px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }
const M_ta = { ...M_inp, minHeight: 44, resize: 'vertical' }

/* Campo de texto normal — definido FUERA del modal para no perder el foco al teclear */
function MF({ value, onChange, label, col = 1 }) {
  return (
    <div style={{ gridColumn: `span ${col}` }}>
      <label style={M_lab}>{label}</label>
      <input style={M_inp} value={value ?? ''} onChange={onChange} />
    </div>
  )
}
/* Campo largo (domicilios) -> textarea */
function MFT({ value, onChange, label, col = 2 }) {
  return (
    <div style={{ gridColumn: `span ${col}` }}>
      <label style={M_lab}>{label}</label>
      <textarea style={M_ta} value={value ?? ''} onChange={onChange} rows={2} />
    </div>
  )
}
/* Bloque de los 11 campos de una persona; edita el draft vía onCampo(campo, valor) */
function MBloque({ datos, onCampo }) {
  const d = datos || {}
  const set = (campo) => (e) => onCampo(campo, e.target.value)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 4 }}>
      <MF value={d.nombre}    onChange={set('nombre')}    label="Nombre" col={2} />
      <MF value={d.genero}    onChange={set('genero')}    label="Género" />
      <MF value={d.estado}    onChange={set('estado')}    label="Estado civil" />
      <MF value={d.nacion}    onChange={set('nacion')}    label="Nacionalidad" />
      <MF value={d.rut}       onChange={set('rut')}       label="RUT" />
      <MF value={d.pasaporte} onChange={set('pasaporte')} label="Pasaporte" />
      <MF value={d.telefono}  onChange={set('telefono')}  label="Teléfono" />
      <MF value={d.email}     onChange={set('email')}     label="Email" col={2} />
      <MF value={d.empresa}   onChange={set('empresa')}   label="Empresa" col={2} />
      <MFT value={d.domHabit} onChange={set('domHabit')}  label="Domicilio habitacional" col={2} />
      <MFT value={d.domLab}   onChange={set('domLab')}    label="Domicilio laboral" col={2} />
    </div>
  )
}

/* ══ Modal de edición de arrendatarios y avales (con draft interno: Cancelar revierte) ══ */
function ModalPersonas({ personasIniciales, arr2Inicial, aval2Inicial, guardando, onGuardar, onCerrar, idadmon }) {
  // draft = copia local; se edita aquí y solo se confirma al Guardar
  const [draft, setDraft] = useState(() => ({
    arr1:  { ...(personasIniciales?.arr1  || {}) },
    arr2:  { ...(personasIniciales?.arr2  || {}) },
    aval1: { ...(personasIniciales?.aval1 || {}) },
    aval2: { ...(personasIniciales?.aval2 || {}) },
  }))
  const [arr2, setArr2] = useState(!!arr2Inicial)
  const [aval2, setAval2] = useState(!!aval2Inicial)

  const setCampo = (bloque) => (campo, valor) =>
    setDraft(prev => ({ ...prev, [bloque]: { ...prev[bloque], [campo]: valor } }))

  const ov = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 2000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '30px 16px' }
  const card = { background: '#fff', borderRadius: 12, width: '100%', maxWidth: 880, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', fontFamily: '"DM Sans", system-ui, sans-serif', color: '#10183a' }
  const tituloRow = { display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0 8px' }
  const tituloTxt = { fontSize: 13, fontWeight: 700, color: '#1a3a6b' }
  const btnSec = (activo) => ({ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 5, border: '1px solid #c7d2e0', background: activo ? '#dbe5f1' : '#fff', color: '#1a3a6b', cursor: 'pointer' })

  return (
    <div style={ov} onClick={onCerrar}>
      <div style={card} onClick={e => e.stopPropagation()}>
        {/* Cabecera */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #eee' }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Editar arrendatarios y avales <span style={{ color: '#9ca3af', fontWeight: 400, fontSize: 13 }}>· {idadmon}</span></div>
          <button onClick={onCerrar} style={{ border: 'none', background: '#f0eee8', borderRadius: 6, width: 30, height: 30, cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>

        {/* Cuerpo */}
        <div style={{ padding: 20, maxHeight: '70vh', overflowY: 'auto' }}>
          <div style={tituloRow}><div style={tituloTxt}>Arrendatario 1</div></div>
          <MBloque datos={draft.arr1} onCampo={setCampo('arr1')} />

          <div style={tituloRow}>
            <div style={tituloTxt}>Arrendatario 2 <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: 11 }}>(poco frecuente)</span></div>
            <button type="button" onClick={() => setArr2(v => !v)} style={btnSec(arr2)}>
              {arr2 ? '− quitar 2º arrendatario' : '+ añadir 2º arrendatario'}
            </button>
          </div>
          {arr2 && <MBloque datos={draft.arr2} onCampo={setCampo('arr2')} />}

          <div style={{ borderTop: '1px solid #eee', marginTop: 12, paddingTop: 4 }} />

          <div style={tituloRow}><div style={tituloTxt}>Aval 1</div></div>
          <MBloque datos={draft.aval1} onCampo={setCampo('aval1')} />

          <div style={tituloRow}>
            <div style={tituloTxt}>Aval 2 <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: 11 }}>(poco frecuente)</span></div>
            <button type="button" onClick={() => setAval2(v => !v)} style={btnSec(aval2)}>
              {aval2 ? '− quitar 2º aval' : '+ añadir 2º aval'}
            </button>
          </div>
          {aval2 && <MBloque datos={draft.aval2} onCampo={setCampo('aval2')} />}
        </div>

        {/* Pie */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 20px', borderTop: '1px solid #eee' }}>
          <button onClick={onCerrar} disabled={guardando}
            style={{ padding: '8px 18px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={() => onGuardar(draft, { arr2, aval2 })} disabled={guardando}
            style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: guardando ? '#9ca3af' : '#16a34a', color: '#fff', fontSize: 13, fontWeight: 700, cursor: guardando ? 'not-allowed' : 'pointer' }}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>Cargando...</div>}>
      <AdminContent />
    </Suspense>
  )
}