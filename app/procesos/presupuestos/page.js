'use client'
// VERSION: v10 · 2026-08-25 · INTERNO nunca lleva markup. (1) lineaConMarkup fuerza markup 0 en líneas INTERNO,
//   ignorando cualquier markup_pct heredado (presupuestos antiguos guardados con 20% antes de la etiqueta). (2) Al
//   cambiar el TIPO de una línea, el markup se ajusta solo: INTERNO⇒0, EXTERNO⇒default 20%. Así Adalis/Fabiola pueden
//   marcar una línea como interna, el markup queda en cero y guardan sin tocar la columna de markup (que no ven).
//   Requiere api/presupuestos/pdf v2 (mismo criterio en el PDF). Hereda v9.
// VERSION: v9 · 2026-08-11 · DEEP-LINK: /procesos/presupuestos?codigo=Cxxx (o ?num=) abre ese presupuesto al
//   cargar la lista (para enlazarlo desde la hoja del término). Aditivo, no cambia el resto. Hereda v8.
// VERSION: v8 · 2026-08-07 · PDF + Email del presupuesto CON markup, desde la hoja (como en Términos). Botón "PDF con
//   markup + email" disponible para cualquiera con acceso al proceso presupuestos (Adalis, Fabiola, Christian, Karina,
//   Dirección). Llama a /api/presupuestos/pdf (markup por línea, Interno=0), abre el PDF en pestaña nueva y un borrador
//   de email (mailto) al propietario con el enlace del PDF, editable antes de enviar. NUNCA genera el PDF de coste
//   (sin markup): ese sigue siendo solo la vista en pantalla de Karina/Dirección. Hereda v7.
// VERSION: v7 · 2026-08-07 · TIPO por línea (INTERNO/EXTERNO). Nueva columna "Tipo" editable por cualquiera con acceso
//   al proceso presupuestos (Adalis, Cristhian, Fabiola, Karina, Dirección). En las líneas marcadas INTERNO el markup
//   POR DEFECTO es 0% (trabajo propio de FCR, sin margen sobre coste); EXTERNO sigue con 20% por defecto. El markup
//   sigue siendo editable solo por Karina/Dirección y, si ponen un valor explícito, ese manda sobre el default.
//   Persiste presupuesto_detalle.tipo_ejecucion ('INTERNO'/'EXTERNO', default 'EXTERNO'). Hereda v6.
// VERSION: v6 · 2026-08-04 · MARKUP por línea (patrón de Términos): en edición, Karina/Dirección ven y editan
//   una columna "Markup %" por fila y el "Total cliente" (coste × (1+markup), default 20%). El coste original
//   se conserva en base_imponible; el precio al cliente se calcula al vuelo con lineaConMarkup. Guarda markup_pct.
//   PENDIENTE: vista cliente por defecto al abrir + lista con total markup + PDF profesional.
// VERSION: v5 · 2026-07-31 · Nuevo motivo COTIZACIÓN: presupuesto para un inmueble que aún NO
//   administramos (cliente potencial). No exige IDADMON. Se guarda con en_termino = null
//   (true=término, false=incidencia, null=cotización). Ubicación y propietario a mano.
// VERSION: v4 · 2026-07-28 · El aviso de "ya existe presupuesto" ahora distingue por INCIDENCIA,
//   no por IDADMON. Un depto puede tener varias incidencias a lo largo de su vida, y cada una
//   lleva su propio presupuesto: eso NO es duplicado. Solo se avisa si ya hay un presupuesto para
//   la MISMA incidencia (o, sin incidencia, si ya hay otro sin incidencia asignada). Sigue sin
//   bloquear: es un recordatorio.
// VERSION: v3 · 2026-07-20 · Al teclear el IDADMON (S/SQ/P/Q) autocompleta Ubicación+Propietario desde datos_arriendos (solo si vacíos), como ya hacía Q
// VERSION: v2 · 2026-07-20 · Presupuestos para cualquier estado activo (S/SQ/P/Q, no solo Q): guarda estado_idadmon (foto de datos_arriendos al crear) + Nº de incidencia (incidencia_id) cuando el motivo es Incidencia; badge de estado del IDADMON.
import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabaseClient'
import TopNav from '@/app/components/ui/TopNav'

const DIRECCION_EMAILS = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com']
const FINANZAS_EMAILS = ['karina.morales@fondocapital.com']   // ve/edita el markup, como Dirección
const MARKUP_DEFAULT = 20

// normaliza texto para buscar sin tildes ni mayusculas
const norm = s => (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

// ── Estado del IDADMON (cruce con datos_arriendos) ──
// N y "N DICOM" => historico => presupuesto NO editable
const normEstado = e => (e || '').toString().toUpperCase().replace(/\s+/g, ' ').trim()
const esHistorico = e => { const x = normEstado(e); return x === 'N' || x === 'N DICOM' }

const fmtPesos = n => {
  const v = Number(n)
  if (isNaN(v)) return '—'
  return '$' + v.toLocaleString('es-CL')
}
const fmtFecha = s => {
  if (!s) return '—'
  const d = new Date(s)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// linea con totales recalculados (COSTE, sin markup). El markup se aplica en la presentación.
function calcLinea(l) {
  const cant = Number(l.cantidad) || 0
  const cu = Number(l.coste_unit) || 0
  const base = cant * cu
  const iva = Math.round(base * 0.19)
  return { ...l, base_imponible: base, iva, total: base + iva }
}
// Tipo de ejecución de la línea. INTERNO = trabajo propio de FCR (sin margen sobre coste => markup 0 por defecto).
// EXTERNO = proveedor externo (markup 20% por defecto). Normaliza cualquier valor guardado.
const esInterno = (l) => norm(l?.tipo_ejecucion) === 'interno'
const tipoDe = (l) => (esInterno(l) ? 'INTERNO' : 'EXTERNO')
// Markup por defecto de la línea según su tipo: INTERNO => 0, EXTERNO => MARKUP_DEFAULT.
const markupDefault = (l) => (esInterno(l) ? 0 : MARKUP_DEFAULT)
// Precio de una línea CON markup aplicado (precio al cliente). Mismo patrón que Términos.
// REGLA FIRME: una línea INTERNO (trabajo propio de FCR) NUNCA lleva markup — se ignora cualquier markup_pct
// heredado (p. ej. presupuestos antiguos que se guardaron con 20% antes de existir la etiqueta INTERNO/EXTERNO).
// Solo las EXTERNO usan markup_pct explícito, o el default (20%) si no lo tienen.
function lineaConMarkup(l) {
  const base = Number(l.base_imponible) || 0
  const mk = esInterno(l) ? 0 : ((l.markup_pct === '' || l.markup_pct == null) ? markupDefault(l) : (Number(l.markup_pct) || 0))
  const baseMk = Math.round(base * (1 + mk / 100))
  const ivaMk = Math.round(baseMk * 0.19)
  return { base: baseMk, iva: ivaMk, total: baseMk + ivaMk, markup: mk }
}
const LINEA_VACIA = { descripcion: '', cantidad: '', coste_unit: '', base_imponible: 0, iva: 0, total: 0, markup_pct: '', tipo_ejecucion: 'EXTERNO' }

function hoyISO() { return new Date().toISOString().slice(0, 10) }

const FORM_VACIO = {
  numero: '', fecha: hoyISO(), id_admon_new: '', id_admon_old: '',
  ubicacion: '', propietario: '', descripcion: '', motivo: 'termino', incidencia_id: '',
}

export default function PresupuestosPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const email = session?.user?.email
  const rol = session?.user?.role

  const [accesoOk, setAccesoOk] = useState(null) // null = verificando · true/false
  const [lista, setLista] = useState([])
  const [estados, setEstados] = useState({})     // idadmon -> estado (datos_arriendos)
  const [estadoLive, setEstadoLive] = useState('') // estado del IDADMON tecleado (lectura en vivo)
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [editando, setEditando] = useState(null) // null = listado; {} o {...} = form
  const [soloLectura, setSoloLectura] = useState(false) // historico => no editable
  const [form, setForm] = useState(FORM_VACIO)
  const [lineas, setLineas] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [qRaw, setQRaw] = useState([])        // IDADMON estado Q (datos_arriendos)
  const [qCargado, setQCargado] = useState(false)
  const [qBusca, setQBusca] = useState('')

  // Acceso: admin (Direccion) o quien tenga permiso ACTIVO del proceso 'presupuestos'
  useEffect(() => {
    if (status !== 'authenticated' || !email) return
    if (rol === 'admin' || DIRECCION_EMAILS.includes(email)) { setAccesoOk(true); return }
    supabase
      .from('proceso_permisos')
      .select('proceso')
      .eq('email', email)
      .eq('proceso', 'presupuestos')
      .eq('activo', true)
      .limit(1)
      .then(({ data }) => setAccesoOk(!!(data && data.length)))
  }, [status, email, rol])

  useEffect(() => { if (accesoOk === false) router.replace('/') }, [accesoOk, router])
  useEffect(() => { if (accesoOk === true) cargar() }, [accesoOk])

  // Deep-link: /procesos/presupuestos?codigo=Cxxx (o ?num=) abre ese presupuesto al cargar la lista.
  const deepCodeRef = useRef(null)
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search)
      deepCodeRef.current = sp.get('codigo') || sp.get('num')
    } catch { deepCodeRef.current = null }
  }, [])
  useEffect(() => {
    const code = (deepCodeRef.current || '').trim().toUpperCase()
    if (!code || !lista || lista.length === 0) return
    const row = lista.find(r => String(r.numero || '').trim().toUpperCase() === code)
    if (row) { editar(row); deepCodeRef.current = null }
  }, [lista])

  async function cargar() {
    setLoading(true)
    const { data, error } = await supabase
      .from('presupuestos')
      .select('id, numero, fecha, id_admon_new, id_admon_old, ubicacion, propietario, descripcion, neto, iva, total, en_termino, incidencia_id, estado_idadmon')
      .order('id', { ascending: false })
    const filas = error ? [] : (data || [])
    setLista(filas)

    // traer el estado de cada IDADMON desde datos_arriendos (cruce id_admon_new <-> idadmon)
    const ids = [...new Set(filas.map(r => (r.id_admon_new || '').trim()).filter(Boolean))]
    if (ids.length) {
      const { data: da } = await supabase
        .from('datos_arriendos')
        .select('idadmon, estado')
        .in('idadmon', ids)
      const map = {}
      ;(da || []).forEach(d => { const k = (d.idadmon || '').trim(); if (k) map[k] = d.estado })
      setEstados(map)
    } else {
      setEstados({})
    }
    setLoading(false)
  }

  // estado del IDADMON de una fila/form
  function estadoDe(idadmon) { return estados[(idadmon || '').trim()] }

  // lee de datos_arriendos el estado del IDADMON tecleado (para el badge y la foto del momento)
  // y autocompleta Ubicación (inmueble) y Propietario, igual que las sugerencias de Q.
  // Solo rellena los campos que estén vacíos: nunca pisa lo que ya escribió el usuario.
  async function leerEstado(idadmon) {
    const k = (idadmon || '').trim()
    if (!k) { setEstadoLive(''); return }
    try {
      const { data } = await supabase.from('datos_arriendos').select('estado, inmueble, propietario').eq('idadmon', k).limit(1).maybeSingle()
      setEstadoLive(data?.estado || '')
      if (data) {
        setForm(f => ({
          ...f,
          ubicacion: (f.ubicacion || '').trim() ? f.ubicacion : (data.inmueble || ''),
          propietario: (f.propietario || '').trim() ? f.propietario : (data.propietario || ''),
        }))
      }
    } catch { setEstadoLive('') }
  }

  // IDADMONs en estado Q (para sugerir los pendientes al crear)
  async function cargarQ() {
    if (qCargado) return
    const { data } = await supabase
      .from('datos_arriendos')
      .select('idadmon, propietario, inmueble')
      .eq('estado', 'Q')
    const vistos = new Set(); const out = []
    ;(data || []).forEach(d => {
      const k = (d.idadmon || '').trim()
      if (!k || vistos.has(k)) return
      vistos.add(k); out.push({ idadmon: k, propietario: d.propietario || '', inmueble: d.inmueble || '' })
    })
    out.sort((a, b) => a.idadmon.localeCompare(b.idadmon))
    setQRaw(out); setQCargado(true)
  }

  // elegir un IDADMON sugerido => autocompleta IDADMON, ubicacion y propietario
  function pickQ(q) {
    setForm(f => ({
      ...f,
      id_admon_new: q.idadmon,
      ubicacion: q.inmueble || f.ubicacion,
      propietario: q.propietario || f.propietario,
    }))
    setEstadoLive('Q')
  }

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  // ── lineas ──
  function setLinea(i, k, v) {
    setLineas(ls => ls.map((l, j) => j === i ? calcLinea({ ...l, [k]: v }) : l))
  }
  // Cambiar el TIPO ajusta también el markup: INTERNO => 0 (trabajo propio, sin margen); EXTERNO => '' (usa el
  // 20% por defecto). Así, si Adalis/Fabiola marcan una línea como interna, el markup queda en cero y pueden
  // guardar sin tocar la columna de markup (que no ven). Corrige también presupuestos antiguos al re-etiquetar.
  function cambiarTipo(i, tipo) {
    setLineas(ls => ls.map((l, j) => j === i
      ? calcLinea({ ...l, tipo_ejecucion: tipo, markup_pct: tipo === 'INTERNO' ? 0 : '' })
      : l))
  }
  function agregarLinea() { setLineas(ls => [...ls, { ...LINEA_VACIA }]) }
  function quitarLinea(i) { setLineas(ls => ls.filter((_, j) => j !== i)) }

  const totBase = lineas.reduce((a, l) => a + (Number(l.base_imponible) || 0), 0)
  const totIva = lineas.reduce((a, l) => a + (Number(l.iva) || 0), 0)
  const totTotal = totBase + totIva
  // Markup: lo ven/editan solo Karina y Dirección. Total al cliente (con markup, línea a línea).
  const puedeMarkup = rol === 'admin' || DIRECCION_EMAILS.includes(email) || FINANZAS_EMAILS.includes(email)
  const totClienteMk = lineas.reduce((a, l) => a + lineaConMarkup(l).total, 0)

  async function siguienteNumero() {
    const { data } = await supabase.from('presupuestos').select('numero')
    let max = 0
    ;(data || []).forEach(x => {
      const m = /^[Cc](\d+)$/.exec((x.numero || '').trim())
      if (m) max = Math.max(max, parseInt(m[1], 10))
    })
    return 'C' + String(max + 1).padStart(3, '0')
  }

  async function nuevo() {
    setMsg(null)
    setSoloLectura(false)
    setQBusca('')
    cargarQ()
    const num = await siguienteNumero()
    setForm({ ...FORM_VACIO, numero: num })
    setEstadoLive('')
    setLineas([{ ...LINEA_VACIA }])
    setEditando({})
  }

  async function editar(r) {
    setMsg(null)
    setSoloLectura(esHistorico(estadoDe(r.id_admon_new)))
    leerEstado(r.id_admon_new)
    setForm({
      ...FORM_VACIO, ...r,
      fecha: r.fecha ? String(r.fecha).slice(0, 10) : hoyISO(),
      id_admon_new: r.id_admon_new || '', id_admon_old: r.id_admon_old || '',
      ubicacion: r.ubicacion || '', propietario: r.propietario || '', descripcion: r.descripcion || '',
      motivo: r.en_termino == null ? 'cotizacion' : (r.en_termino === false ? 'incidencia' : 'termino'),
    })
    const { data } = await supabase
      .from('presupuesto_detalle')
      .select('orden, descripcion, cantidad, coste_unit, base_imponible, iva, total, markup_pct, tipo_ejecucion')
      .eq('presupuesto_id', r.id)
      .order('orden')
    setLineas((data && data.length ? data : [{ ...LINEA_VACIA }]).map(l => calcLinea({ ...l, tipo_ejecucion: tipoDe(l) })))
    setEditando(r)
  }

  function aamm(fecha) {
    const d = new Date(fecha)
    if (isNaN(d.getTime())) return null
    return (d.getFullYear() % 100) * 100 + (d.getMonth() + 1)
  }

  // PDF con markup (precio cliente) + borrador de email. Disponible para todos los del proceso.
  // Usa lo GUARDADO en BD (no los cambios sin guardar): si acabas de editar, guarda primero.
  async function generarPDFyEmail() {
    if (!editando || !editando.id) { setMsg({ tipo: 'error', txt: 'Guarda el presupuesto antes de generar el PDF.' }); return }
    setPdfBusy(true); setMsg(null)
    try {
      const res = await fetch('/api/presupuestos/pdf', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presupuesto_id: editando.id }),
      })
      const j = await res.json()
      if (!res.ok || !j.ok) { setMsg({ tipo: 'error', txt: j.error || 'No se pudo generar el PDF.' }); setPdfBusy(false); return }
      const url = j.pdf_url
      if (url) window.open(url, '_blank', 'noopener,noreferrer')   // PDF (con markup) descargable en pestaña nueva
      // Borrador de email al propietario con el enlace del PDF, editable antes de enviar.
      const nombre = j?.para?.nombre || form.propietario || ''
      const to = j?.para?.to || ''
      const asunto = `Presupuesto ${j.numero || form.numero || ''} · ${j.inmueble || form.ubicacion || ''}`.trim()
      const cuerpo = [
        `Estimado/a ${nombre || ''},`, '',
        `Adjuntamos el presupuesto ${j.numero || form.numero || ''}${j.inmueble ? ' correspondiente a ' + j.inmueble : ''}.`,
        url ? `\nPresupuesto (PDF): ${url}` : '',
        '', 'Un saludo,', 'Fondo Capital Rent',
      ].join('\n')
      const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`
      window.location.href = mailto
      setMsg({ tipo: 'ok', txt: url ? 'PDF con markup generado (abierto en otra pestaña). Se abrió el borrador de email; revisa el destinatario antes de enviar.' : 'PDF generado.' })
    } catch (e) {
      setMsg({ tipo: 'error', txt: 'Error al generar el PDF: ' + (e?.message || e) })
    }
    setPdfBusy(false)
  }

  async function guardar() {
    // seguridad: nunca guardar un presupuesto historico
    if (soloLectura) { setMsg({ tipo: 'error', txt: 'Presupuesto histórico: no editable.' }); return }
    // seguridad: no crear un presupuesto NUEVO sobre un IDADMON historico (N / N DICOM)
    if (!(editando && editando.id) && form.motivo !== 'cotizacion' && esHistorico(estadoDe(form.id_admon_new))) {
      setMsg({ tipo: 'error', txt: 'El IDADMON está en estado histórico (N / N DICOM): no se pueden crear presupuestos nuevos sobre él.' })
      return
    }
    // IDADMON obligatorio al crear, EXCEPTO en cotizaciones (inmueble aún no administrado).
    const esNuevo = !(editando && editando.id)
    if (esNuevo && form.motivo !== 'cotizacion' && !((form.id_admon_new || '').trim())) {
      setMsg({ tipo: 'error', txt: 'Debes asignar un IDADMON al presupuesto.' })
      return
    }
    // En cotización conviene al menos una referencia para reconocerla luego.
    if (form.motivo === 'cotizacion' && !((form.ubicacion || '').trim()) && !((form.propietario || '').trim())) {
      setMsg({ tipo: 'error', txt: 'En una cotización indica al menos la ubicación o el cliente/propietario.' })
      return
    }
    setGuardando(true); setMsg(null)
    const validas = lineas.filter(l => (l.descripcion || '').trim())
    const cab = {
      numero: (form.numero || '').trim() || null,
      fecha: form.fecha || null,
      aamm: aamm(form.fecha),
      id_admon_new: (form.id_admon_new || '').trim() || null,
      id_admon_old: (form.id_admon_old || '').trim() || null,
      ubicacion: form.ubicacion || null,
      propietario: form.propietario || null,
      descripcion: form.descripcion || null,
      neto: totBase, iva: totIva, total: totTotal,
      en_termino: form.motivo === 'cotizacion' ? null : (form.motivo === 'incidencia' ? false : true),
      incidencia_id: (form.motivo === 'incidencia' && String(form.incidencia_id || '').trim()) ? Number(String(form.incidencia_id).trim()) : null,
      updated_at: new Date().toISOString(),
    }

    let presupuestoId = editando && editando.id ? editando.id : null
    if (presupuestoId) {
      const { error } = await supabase.from('presupuestos').update(cab).eq('id', presupuestoId)
      if (error) { setMsg({ tipo: 'error', txt: 'Error: ' + error.message }); setGuardando(false); return }
      await supabase.from('presupuesto_detalle').delete().eq('presupuesto_id', presupuestoId)
    } else {
      // foto del estado del IDADMON en el momento de crear (de la tabla madre datos_arriendos)
      try {
        const { data: da } = await supabase.from('datos_arriendos').select('estado').eq('idadmon', (form.id_admon_new || '').trim()).limit(1).maybeSingle()
        cab.estado_idadmon = da?.estado || estadoDe(form.id_admon_new) || null
      } catch { cab.estado_idadmon = estadoDe(form.id_admon_new) || null }
      const { data, error } = await supabase.from('presupuestos').insert(cab).select('id').single()
      if (error) { setMsg({ tipo: 'error', txt: 'Error: ' + error.message }); setGuardando(false); return }
      presupuestoId = data.id
    }

    if (validas.length) {
      const filas = validas.map((l, i) => ({
        presupuesto_id: presupuestoId,
        orden: i + 1,
        descripcion: l.descripcion.trim(),
        cantidad: l.cantidad === '' ? null : Number(l.cantidad),
        coste_unit: l.coste_unit === '' ? null : Number(l.coste_unit),
        base_imponible: Number(l.base_imponible) || 0,
        iva: Number(l.iva) || 0,
        total: Number(l.total) || 0,
        markup_pct: (l.markup_pct === '' || l.markup_pct == null) ? null : Number(l.markup_pct),
        tipo_ejecucion: tipoDe(l),
      }))
      const { error } = await supabase.from('presupuesto_detalle').insert(filas)
      if (error) { setMsg({ tipo: 'error', txt: 'Guardó la cabecera pero falló el detalle: ' + error.message }); setGuardando(false); return }
    }

    setGuardando(false)
    setEditando(null)
    await cargar()
  }

  // ── filtrado del listado ──
  const filtradas = (() => {
    const q = norm(busca)
    if (!q) return lista
    return lista.filter(r => norm([r.numero, r.id_admon_new, r.id_admon_old, r.ubicacion, r.propietario, r.descripcion].join(' ')).includes(q))
  })()

  if (status === 'loading' || accesoOk === null) return (<><TopNav /><div style={{ padding: 40, color: '#888' }}>Cargando…</div></>)
  if (accesoOk === false) return null

  // estilos
  const input = { padding: '8px 10px', borderRadius: 7, border: '1px solid #E5E7EB', fontSize: 13, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }
  const inputRo = { ...input, background: '#FAFAF8', color: '#555', cursor: 'not-allowed' }
  const label = { fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4, display: 'block' }
  const card = { background: '#fff', border: '1px solid #E8E6E0', borderRadius: 12, padding: 20, marginBottom: 16 }
  const tdNum = { padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap' }

  // badge del estado del IDADMON
  function BadgeEstado({ estado }) {
    if (!estado) return <span style={{ fontSize: 11, color: '#9ca3af' }}>—</span>
    const hist = esHistorico(estado)
    return (
      <span style={{
        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap',
        background: hist ? '#f3f4f6' : '#EAF3DE', color: hist ? '#6b7280' : '#3B6D11',
        border: '1px solid ' + (hist ? '#e5e7eb' : '#cfe3b4'),
      }}>
        {normEstado(estado)}{hist ? ' · histórico' : ''}
      </span>
    )
  }

  // ───────────── FORMULARIO ─────────────
  if (editando !== null) {
    const ro = soloLectura
    const estForm = estadoDe(form.id_admon_new)
    // Aviso Opcion A: en un NUEVO presupuesto, si el IDADMON ya tiene presupuestos
    const idTrim = (form.id_admon_new || '').trim()
    // Un presupuesto es "duplicado" solo si es del MISMO IDADMON y la MISMA incidencia. Varias
    // incidencias del mismo depto son reparaciones distintas, cada una con su presupuesto.
    const incTrim = String(form.incidencia_id || '').trim()
    const dupes = (!editando.id && idTrim)
      ? lista.filter(x => {
          if (norm(x.id_admon_new) !== norm(idTrim)) return false
          const xInc = String(x.incidencia_id ?? '').trim()
          // Con incidencia indicada: choca solo con la misma incidencia.
          // Sin incidencia (p. ej. término): choca solo con otro que tampoco tenga incidencia.
          return incTrim ? (xInc === incTrim) : (xInc === '')
        })
      : []
    // IDADMON (old) es lastre historico: solo se muestra (read-only) en registros antiguos que lo tengan
    const mostrarOld = !!(editando.id && (form.id_admon_old || '').trim())
    // Bloqueo: no permitir crear un presupuesto NUEVO sobre un IDADMON historico (N / N DICOM)
    const histNuevo = !editando.id && idTrim && esHistorico(estForm)
    // IDADMON obligatorio al crear
    const esNuevoForm = !editando.id
    const faltaId = esNuevoForm && !idTrim
    // sugerencias: IDADMON en estado Q que aun no tienen presupuesto
    const setExistentes = new Set(lista.map(r => (r.id_admon_new || '').trim()).filter(Boolean))
    const qPend = qRaw.filter(q => !setExistentes.has(q.idadmon))
    const qFiltradas = (() => {
      const s = norm(qBusca)
      if (!s) return qPend
      return qPend.filter(q => norm([q.idadmon, q.propietario, q.inmueble].join(' ')).includes(s))
    })()

    return (
      <>
        <TopNav />
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24, fontFamily: '"DM Sans", sans-serif' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>
              {ro ? 'Ver presupuesto' : (editando.id ? 'Editar presupuesto' : 'Nuevo presupuesto')} <span style={{ fontSize: 13, color: '#888', fontWeight: 400 }}>· {form.numero}</span>
            </h1>
            <button onClick={() => setEditando(null)} style={{ ...input, width: 'auto', cursor: 'pointer', background: '#F0EEE8' }}>← Volver</button>
          </div>

          {msg && <div style={{ ...card, background: msg.tipo === 'error' ? '#fef2f2' : '#f0fdf4', color: msg.tipo === 'error' ? '#dc2626' : '#16a34a', padding: 12 }}>{msg.txt}</div>}

          {/* Banner historico (solo lectura) */}
          {ro && (
            <div style={{ ...card, background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#4b5563', padding: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>🔒</span>
              <span style={{ fontSize: 13 }}>Presupuesto <b>histórico</b> (IDADMON en estado <b>{normEstado(estForm)}</b>). Solo lectura: no se puede modificar.</span>
            </div>
          )}

          {/* Bloqueo: IDADMON historico en alta nueva */}
          {histNuevo && (
            <div style={{ ...card, background: '#fef2f2', border: '1px solid #dc2626', color: '#b91c1c', padding: 12 }}>
              <b>🚫 No permitido:</b> el IDADMON <b>{idTrim}</b> está en estado <b>{normEstado(estForm)}</b> (histórico).
              No se pueden crear presupuestos nuevos sobre un IDADMON histórico. Usa un IDADMON activo.
            </div>
          )}

          {/* Aviso duplicado (Opcion A, no bloqueante) */}
          {!ro && !histNuevo && dupes.length > 0 && (
            <div style={{ ...card, background: '#FEF9E7', border: '1px solid #F1C40F', color: '#8a6d00', padding: 12 }}>
              <b>⚠️ Atención:</b> {incTrim
                ? <>la incidencia <b>#{incTrim}</b> de este IDADMON ya tiene {dupes.length} presupuesto{dupes.length > 1 ? 's' : ''} ({dupes.map(d => d.numero).join(', ')}). Cada incidencia debería tener <b>un solo presupuesto válido</b>.</>
                : <>este IDADMON ya tiene {dupes.length} presupuesto{dupes.length > 1 ? 's' : ''} sin incidencia ({dupes.map(d => d.numero).join(', ')}). Si es para una incidencia distinta, indica su número arriba y este aviso desaparecerá.</>}
            </div>
          )}

          {/* Sugerencias: IDADMON en estado Q sin presupuesto (solo en alta nueva) */}
          {esNuevoForm && !ro && (
            <div style={card}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>Sugerencias · IDADMON en estado Q sin presupuesto</div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 10 }}>
                Elige uno para autocompletar IDADMON, ubicación y propietario.{qCargado ? ` ${qPend.length} pendiente${qPend.length === 1 ? '' : 's'}.` : ' Cargando…'}
              </div>
              <input value={qBusca} onChange={e => setQBusca(e.target.value)} placeholder="Filtrar por IDADMON, propietario o dirección…" style={{ ...input, marginBottom: 8 }} />
              <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #F0EEE8', borderRadius: 8 }}>
                {qFiltradas.length === 0 ? (
                  <div style={{ padding: 12, fontSize: 12, color: '#999' }}>{qCargado ? 'Sin coincidencias.' : 'Cargando…'}</div>
                ) : qFiltradas.map(q => {
                  const sel = norm(form.id_admon_new) === norm(q.idadmon)
                  return (
                    <div key={q.idadmon} onClick={() => pickQ(q)} style={{
                      padding: '8px 12px', fontSize: 13, cursor: 'pointer', borderBottom: '1px solid #F3F4F6',
                      background: sel ? '#E6F1FB' : '#fff', display: 'flex', justifyContent: 'space-between', gap: 12,
                    }}>
                      <span style={{ whiteSpace: 'nowrap' }}><b style={{ color: '#185FA5' }}>{q.idadmon}</b> · {q.propietario || '—'}</span>
                      <span style={{ color: '#888', textAlign: 'right' }}>{q.inmueble || '—'}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Datos */}
          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 12 }}>Datos del presupuesto</div>
            <div style={{ display: 'grid', gridTemplateColumns: mostrarOld ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div><label style={label}>Número</label><input style={ro ? inputRo : input} value={form.numero} disabled={ro} onChange={e => set('numero', e.target.value)} /></div>
              <div><label style={label}>Fecha</label><input style={ro ? inputRo : input} type="date" value={form.fecha} disabled={ro} onChange={e => set('fecha', e.target.value)} /></div>
              <div><label style={label}>IDADMON {form.motivo === 'cotizacion' ? <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 600, color: '#6B7280' }}>(no requerido en cotización)</span> : ((estadoLive || estForm) ? <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 999, background: '#EEF2FF', color: '#3730A3' }}>estado: {estadoLive || estForm}</span> : null)}</label><input style={ro ? inputRo : input} value={form.id_admon_new} disabled={ro} onChange={e => set('id_admon_new', e.target.value)} onBlur={e => leerEstado(e.target.value)} placeholder={form.motivo === 'cotizacion' ? '(sin IDADMON)' : 'A00600'} /></div>
              {mostrarOld && (
                <div><label style={label}>IDADMON (old) · histórico</label><input style={inputRo} value={form.id_admon_old} disabled readOnly /></div>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 12 }}>
              <div><label style={label}>Ubicación (copiar de APP-VISION)</label><input style={ro ? inputRo : input} value={form.ubicacion} disabled={ro} onChange={e => set('ubicacion', e.target.value)} /></div>
              <div><label style={label}>Propietario</label><input style={ro ? inputRo : input} value={form.propietario} disabled={ro} onChange={e => set('propietario', e.target.value)} /></div>
            </div>
            <div><label style={label}>Descripción</label><input style={ro ? inputRo : input} value={form.descripcion} disabled={ro} onChange={e => set('descripcion', e.target.value)} placeholder="Ej. REPARACION DEPTO" /></div>

            <div style={{ marginTop: 12 }}>
              <label style={label}>Motivo del presupuesto</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[['termino', 'Término'], ['incidencia', 'Incidencia'], ['cotizacion', 'Cotización']].map(([k, lab]) => (
                  <button key={k} disabled={ro} onClick={() => set('motivo', k)} style={{
                    padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                    cursor: ro ? 'not-allowed' : 'pointer',
                    border: '1px solid ' + (form.motivo === k ? '#185FA5' : '#E5E7EB'),
                    background: form.motivo === k ? '#E6F1FB' : '#fff',
                    color: form.motivo === k ? '#185FA5' : '#555', opacity: ro ? 0.7 : 1,
                  }}>{lab}</button>
                ))}
              </div>
            </div>
            {form.motivo === 'incidencia' && (
              <div style={{ marginTop: 12, maxWidth: 260 }}>
                <label style={label}>Nº de incidencia</label>
                <input style={ro ? inputRo : input} value={form.incidencia_id} disabled={ro}
                  onChange={e => set('incidencia_id', e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="Ej. 1234" inputMode="numeric" />
              </div>
            )}
          </div>

          {/* Lineas */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>Líneas del presupuesto</div>
              {!ro && <button onClick={agregarLinea} style={{ ...input, width: 'auto', cursor: 'pointer', background: '#E6F1FB', color: '#185FA5', border: '1px solid #185FA5', fontWeight: 600 }}>+ Agregar línea</button>}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#FAFAF8' }}>
                    {['Descripción', 'Cant.', 'Coste unit.', 'Base imp.', 'IVA', 'Total', 'Tipo', ...(puedeMarkup ? ['Markup %', 'Total cliente'] : []), ''].map((h, i) => (
                      <th key={i} style={{ padding: '8px', textAlign: (h && h !== 'Descripción' && h !== 'Tipo' && h !== '') ? 'right' : 'left', fontSize: 10, fontWeight: 600, color: h === 'Markup %' || h === 'Total cliente' ? '#185FA5' : '#888', textTransform: 'uppercase', letterSpacing: .4 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((l, i) => {
                    const cli = lineaConMarkup(l)
                    return (
                    <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ padding: '4px 6px' }}><input style={{ ...(ro ? inputRo : input), padding: '6px 8px' }} value={l.descripcion} disabled={ro} onChange={e => setLinea(i, 'descripcion', e.target.value)} /></td>
                      <td style={{ padding: '4px 6px', width: 70 }}><input style={{ ...(ro ? inputRo : input), padding: '6px 8px', textAlign: 'right' }} type="number" value={l.cantidad} disabled={ro} onChange={e => setLinea(i, 'cantidad', e.target.value)} /></td>
                      <td style={{ padding: '4px 6px', width: 110 }}><input style={{ ...(ro ? inputRo : input), padding: '6px 8px', textAlign: 'right' }} type="number" value={l.coste_unit} disabled={ro} onChange={e => setLinea(i, 'coste_unit', e.target.value)} /></td>
                      <td style={{ ...tdNum, color: '#555' }}>{Number(l.base_imponible).toLocaleString('es-CL')}</td>
                      <td style={{ ...tdNum, color: '#888' }}>{Number(l.iva).toLocaleString('es-CL')}</td>
                      <td style={{ ...tdNum, fontWeight: 600 }}>{Number(l.total).toLocaleString('es-CL')}</td>
                      <td style={{ padding: '4px 6px', width: 110 }}>
                        {ro ? (
                          <span style={{ fontSize: 12, fontWeight: 600, color: esInterno(l) ? '#0f766e' : '#185FA5' }}>{tipoDe(l)}</span>
                        ) : (
                          <select style={{ ...input, padding: '6px 8px', cursor: 'pointer', color: esInterno(l) ? '#0f766e' : '#185FA5', fontWeight: 600 }}
                            value={tipoDe(l)} onChange={e => cambiarTipo(i, e.target.value)}>
                            <option value="EXTERNO">Externo</option>
                            <option value="INTERNO">Interno</option>
                          </select>
                        )}
                      </td>
                      {puedeMarkup && (
                        <td style={{ padding: '4px 6px', width: 80 }}>
                          <input style={{ ...(ro ? inputRo : input), padding: '6px 8px', textAlign: 'right' }} type="number"
                            value={l.markup_pct === '' || l.markup_pct == null ? '' : l.markup_pct}
                            placeholder={String(markupDefault(l))} disabled={ro}
                            onChange={e => setLinea(i, 'markup_pct', e.target.value)} />
                        </td>
                      )}
                      {puedeMarkup && (
                        <td style={{ ...tdNum, fontWeight: 700, color: '#185FA5' }}>{cli.total.toLocaleString('es-CL')}</td>
                      )}
                      <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                        {!ro && <button onClick={() => quitarLinea(i)} title="Quitar" style={{ border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>}
                      </td>
                    </tr>
                    )
                  })}
                  {lineas.length === 0 && (
                    <tr><td colSpan={puedeMarkup ? 10 : 8} style={{ padding: 16, textAlign: 'center', color: '#888' }}>Sin líneas.{!ro && ' Agrega la primera con "+ Agregar línea".'}</td></tr>
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid #E8E6E0' }}>
                    <td style={{ padding: '10px 8px', fontWeight: 700, color: '#1a1a2e' }}>TOTALES</td>
                    <td></td><td></td>
                    <td style={{ ...tdNum, fontWeight: 700 }}>{totBase.toLocaleString('es-CL')}</td>
                    <td style={{ ...tdNum, fontWeight: 700, color: '#888' }}>{totIva.toLocaleString('es-CL')}</td>
                    <td style={{ ...tdNum, fontWeight: 700, color: '#185FA5' }}>{totTotal.toLocaleString('es-CL')}</td>
                    <td></td>
                    {puedeMarkup && <td></td>}
                    {puedeMarkup && <td style={{ ...tdNum, fontWeight: 700, color: '#185FA5' }}>{totClienteMk.toLocaleString('es-CL')}</td>}
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 8 }}>Base imponible = cantidad × coste unitario · IVA = 19% · Total = base + IVA (se calculan solos).</div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center' }}>
            {!ro && faltaId && <span style={{ fontSize: 12, color: '#b91c1c' }}>Asigna un IDADMON para poder crear.</span>}
            {editando && editando.id && (
              <button onClick={generarPDFyEmail} disabled={pdfBusy}
                title="Genera el PDF con markup (precio al cliente) y abre el borrador de email al propietario. Usa lo guardado: si acabas de cambiar algo, guarda primero."
                style={{ ...input, width: 'auto', cursor: pdfBusy ? 'not-allowed' : 'pointer', background: '#065f46', color: '#fff', border: 'none', fontWeight: 600, opacity: pdfBusy ? 0.6 : 1 }}>
                {pdfBusy ? 'Generando…' : '📄 PDF con markup + email'}
              </button>
            )}
            <button onClick={() => setEditando(null)} style={{ ...input, width: 'auto', cursor: 'pointer', background: '#F0EEE8' }}>{ro ? 'Cerrar' : 'Cancelar'}</button>
            {!ro && (
              <button onClick={guardar} disabled={guardando || histNuevo || faltaId} style={{ ...input, width: 'auto', cursor: (guardando || histNuevo || faltaId) ? 'not-allowed' : 'pointer', background: (histNuevo || faltaId) ? '#9ca3af' : '#185FA5', color: '#fff', border: 'none', fontWeight: 600, opacity: (guardando || histNuevo || faltaId) ? 0.6 : 1 }}>
                {guardando ? 'Guardando…' : (editando.id ? 'Guardar cambios' : 'Crear presupuesto')}
              </button>
            )}
          </div>
        </div>
      </>
    )
  }

  // ───────────── LISTADO ─────────────
  return (
    <>
      <TopNav />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24, fontFamily: '"DM Sans", sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>Presupuestos</h1>
          <button onClick={nuevo} style={{ padding: '8px 16px', borderRadius: 8, background: '#185FA5', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>+ Nuevo presupuesto</button>
        </div>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>Presupuestos de reparación · proceso de administraciones</div>

        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por IDADMON, número, dirección o propietario…"
          style={{ ...input, marginBottom: 14, maxWidth: 520 }} />

        {loading ? (
          <div style={{ color: '#888' }}>Cargando…</div>
        ) : filtradas.length === 0 ? (
          <div style={{ ...card, textAlign: 'center', color: '#888', padding: 40 }}>
            {busca ? 'Sin resultados para esa búsqueda.' : 'No hay presupuestos aún. Crea el primero con "+ Nuevo presupuesto".'}
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#FAFAF8', borderBottom: '1px solid #E8E6E0' }}>
                  {['N°', 'Fecha', 'IDADMON', 'Estado', 'Ubicación', 'Descripción', 'Neto', 'Total', ''].map((h, i) => (
                    <th key={i} style={{ padding: '10px 12px', textAlign: (h === 'Neto' || h === 'Total') ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: .5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtradas.map(r => {
                  const est = estadoDe(r.id_admon_new)
                  const ro = esHistorico(est)
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{r.numero}</td>
                      <td style={{ padding: '10px 12px', color: '#555', whiteSpace: 'nowrap' }}>{fmtFecha(r.fecha)}</td>
                      <td style={{ padding: '10px 12px', color: '#185FA5', fontWeight: 600 }}>{r.id_admon_new || '—'}</td>
                      <td style={{ padding: '10px 12px' }}><BadgeEstado estado={est} /></td>
                      <td style={{ padding: '10px 12px', color: '#555' }}>{r.ubicacion || '—'}</td>
                      <td style={{ padding: '10px 12px', color: '#555' }}>{r.descripcion || '—'}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtPesos(r.neto)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600 }}>{fmtPesos(r.total)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button onClick={() => editar(r)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #185FA5', background: '#E6F1FB', color: '#185FA5', cursor: 'pointer', fontFamily: 'inherit' }}>{ro ? 'Ver' : 'Ver / Editar'}</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
