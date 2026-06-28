'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
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

/* ── Fila etiqueta+input para los paneles de DATOS ECONÓMICOS (fuera de la tabla) ── */
function EcoRow({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', borderBottom: `1px solid ${C.border}` }}>
      <div style={{
        ...labelCell, width: 110, flexShrink: 0, display: 'flex', alignItems: 'center',
        borderTop: 'none', borderLeft: 'none', borderRight: `1px solid ${C.border}`, borderBottom: 'none',
      }}>{label}</div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#fff' }}>
        {children}
      </div>
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

function AdminContent() {
  const router = useRouter()
  const [idadmonInput, setIdadmonInput] = useState('')
  const [form, setForm] = useState(FORM_VACIO)
  const [logData, setLogData] = useState(null)
  const [propData, setPropData] = useState(null)   // ficha del propietario (tabla propietarios, por idprop)
  // Estado editable de ARRENDATARIOS y AVALES (1 y 2). 11 campos por persona.
  const [personas, setPersonas] = useState({ arr1:{}, arr2:{}, aval1:{}, aval2:{} })
  const [modalAbierto, setModalAbierto] = useState(false)   // modal de edición de personas
  const [guardandoModal, setGuardandoModal] = useState(false)
  const [arr2Abierto, setArr2Abierto] = useState(false)
  const [aval2Abierto, setAval2Abierto] = useState(false)
  const [prop2Abierto, setProp2Abierto] = useState(false)
  const [bloqueado, setBloqueado] = useState(false)
  const [isNew, setIsNew] = useState(true)
  const [msg, setMsg] = useState(null)
  const [saving, setSaving] = useState(false)
  const [adicionalesAbierto, setAdicionalesAbierto] = useState(false)

  const [cap, setCap] = useState(null)
  const [pendientes, setPendientes] = useState([])
  const [nuevoEstado, setNuevoEstado] = useState('')
  const [fechaEstado, setFechaEstado] = useState('')
  const [cambiando, setCambiando] = useState(false)

  // Helper: leer una clave del raw_data del log (Capa 1)
  const lp = (clave) => (logData && logData[clave] != null ? logData[clave] : '')
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

  // Editar un campo de una persona
  const setPersona = (bloque, campo, valor) =>
    setPersonas(prev => ({ ...prev, [bloque]: { ...prev[bloque], [campo]: valor } }))

  useEffect(() => {
    const ultimo = localStorage.getItem('ultimo_idadmon')
    if (ultimo) { setIdadmonInput(ultimo); recuperar(ultimo) }
    cargarCapacidades()
  }, [])

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
        setPersonas(construirPersonas(lrow?.raw_data, data))
        const a2 = lrow?.raw_data?.['Nombre-A2']
        const g2 = lrow?.raw_data?.['Nombre-G2']
        const d2 = lrow?.raw_data?.['Nombre-D2']
        setArr2Abierto(!!(a2 && String(a2).trim()))
        setAval2Abierto(!!(g2 && String(g2).trim()))
        setProp2Abierto(!!(d2 && String(d2).trim()))
      } catch { setLogData(null); setPersonas(construirPersonas(null, data)); setArr2Abierto(false); setAval2Abierto(false); setProp2Abierto(false) }
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
      setLogData(null); setPropData(null); setPersonas({ arr1:{}, arr2:{}, aval1:{}, aval2:{} }); setArr2Abierto(false); setAval2Abierto(false); setProp2Abierto(false)
      setIsNew(true); setBloqueado(false)
      setMsg({ type: 'warn', text: `"${buscar}" no existe. Puedes crear un contrato nuevo.` })
    }
  }

  function handleChange(e) {
    if (bloqueado) return
    const { name, value, type, checked } = e.target
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  async function guardar() {
    if (bloqueado) { setMsg({ type: 'warn', text: 'Desbloquea primero.' }); return }
    setSaving(true); setMsg(null)

    if (isNew) {
      try {
        const payload = { ...form }
        delete payload.id
        delete payload.idadmon
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
    const { error } = await supabase.from('datos_arriendos').update(payload).eq('idadmon', form.idadmon)
    if (error) { setMsg({ type: 'error', text: 'Error: ' + error.message }); setSaving(false); return }

    // Guardar ARRENDATARIOS y AVALES en las dos tablas (log.raw_data completo + resumen en datos_arriendos)
    try {
      const res = await fetch('/api/cc1/guardar-personas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idadmon: form.idadmon, personas }),
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

  async function terminar() {
    if (bloqueado) { setMsg({ type: 'warn', text: 'Desbloquea primero.' }); return }
    if (!form.idadmon) { setMsg({ type: 'warn', text: 'No hay contrato cargado.' }); return }
    if (!window.confirm(`¿Terminar el contrato ${form.idadmon}? Estado pasará a Q y se enviará el aviso.`)) return
    setCambiando(true)
    try {
      const res = await fetch('/api/cc1/cambiar-estado', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idadmon: form.idadmon, estadoNuevo: 'Q' }),
      })
      const data = await res.json()
      if (!res.ok) { setMsg({ type: 'error', text: data.error || 'Error al terminar' }); setCambiando(false); return }
      setForm(p => ({ ...p, estado: 'Q' })); setBloqueado(true)
      let txt = `Contrato ${form.idadmon} terminado (Q).`
      if (data.nuevoP) txt += ` Creado ${data.nuevoP} en P.`
      setMsg({ type: 'ok', text: txt })
    } catch { setMsg({ type: 'error', text: 'Error de conexión' }) }
    setCambiando(false)
  }

  const ro = bloqueado

  const BotonesInferiores = () => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <button onClick={guardar} disabled={saving || bloqueado} style={{
        padding: '7px 20px', borderRadius: 5, border: 'none',
        background: bloqueado ? '#9ca3af' : C.green,
        color: '#fff', fontSize: 12, fontWeight: 700,
        cursor: bloqueado ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
      }}>{saving ? 'GUARDANDO...' : 'GUARDAR (BORRADOR o DATOS)'}</button>

      <button disabled style={{
        padding: '7px 20px', borderRadius: 5,
        border: '1px dashed #9ca3af', background: 'transparent',
        color: '#9ca3af', fontSize: 12, fontWeight: 700,
        cursor: 'not-allowed', fontFamily: 'inherit',
      }}>IMPRIMIR WORD BORRADOR CONTRATO</button>

      <button onClick={terminar} disabled={bloqueado} style={{
        padding: '7px 20px', borderRadius: 5, border: 'none',
        background: bloqueado ? '#9ca3af' : C.red,
        color: '#fff', fontSize: 12, fontWeight: 700,
        cursor: bloqueado ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
        marginLeft: 'auto',
      }}>TERMINAR PARA SACAR INFO DE FACTURACIÓN</button>
    </div>
  )

  return (
    <div style={{ height: '100vh', overflowY: 'auto', background: '#e8eef5' }}>
      <TopNav />

      {/* ── BARRA DE BOTONES ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 1000,
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

        <button onClick={guardar} disabled={saving || bloqueado} style={{
          padding: '5px 14px', borderRadius: 5, border: 'none',
          background: bloqueado ? '#9ca3af' : C.green,
          color: '#fff', fontSize: 12, fontWeight: 700,
          cursor: bloqueado ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
        }}>{saving ? 'GUARDANDO...' : 'GUARDAR'}</button>

        <button onClick={terminar} disabled={bloqueado} style={{
          padding: '5px 14px', borderRadius: 5, border: 'none',
          background: bloqueado ? '#9ca3af' : C.red,
          color: '#fff', fontSize: 12, fontWeight: 700,
          cursor: bloqueado ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
        }}>TERMINAR</button>

        <button onClick={() => { setBloqueado(false); setMsg({ type: 'info', text: '🔓 Desbloqueado — puedes editar.' }) }} style={{
          padding: '5px 14px', borderRadius: 5, border: 'none',
          background: bloqueado ? C.amber : '#6b7280',
          color: '#fff', fontSize: 12, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>{bloqueado ? '🔒 DESBLOQUEAR' : '🔓 DESBLOQUEADO'}</button>

        <button disabled title="Pendiente de definir para la versión web" style={{
          padding: '5px 14px', borderRadius: 5, border: '1px dashed #9ca3af',
          background: 'transparent', color: '#9ca3af', fontSize: 12, fontWeight: 700,
          cursor: 'not-allowed', fontFamily: 'inherit',
        }}>EXPORT</button>

        <button onClick={() => { setForm(FORM_VACIO); setIdadmonInput(''); setLogData(null); setPropData(null); setArr2Abierto(false); setAval2Abierto(false); setProp2Abierto(false); setIsNew(true); setBloqueado(false); setMsg(null); localStorage.removeItem('ultimo_idadmon') }}
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
          position: 'sticky', top: 42, zIndex: 900,
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
            {/* Tarjeta de identificación (replica el recuadro del Excel: IDADMON · Estado · Fecha registro) */}
            <div style={{
              marginLeft: 'auto', display: 'flex', border: `1px solid ${C.headerBg}`,
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
              <td colSpan={4} style={inputCell}><IC name="inmueble" value={form.inmueble} onChange={handleChange} readOnly={ro} /></td>
              <LB right>Moneda</LB>
              <td style={inputCell}><SC name="unid" value={form.unid} onChange={handleChange} readOnly={ro} options={[{v:'$',l:'Pesos'},{v:'UF',l:'UF'}]} /></td>
              <LB right>Monto</LB>
              <td colSpan={2} style={inputCell}><IC name="cuota" value={form.cuota} onChange={handleChange} readOnly={ro} type="number" bold /></td>
              <LB right>A quién pagar</LB>
              <td colSpan={2} style={inputCell}><IC name="quien_cobra" value={form.quien_cobra} onChange={handleChange} readOnly={ro} /></td>
            </tr>
            <tr>
              <LB>Comuna</LB>
              <td colSpan={3} style={inputCell}><IC name="idlinmue" value={form.idlinmue} onChange={handleChange} readOnly={ro} /></td>
              <LB right>Comienzo</LB>
              <td colSpan={2} style={inputCell}><IC name="fecha_inicio" value={form.fecha_inicio} onChange={handleChange} readOnly={ro} type="date" /></td>
              <LB right>Finalización</LB>
              <td colSpan={2} style={inputCell}><IC name="termino_inicial" value={form.termino_inicial} onChange={handleChange} readOnly={ro} type="date" /></td>
              <LB right>Ajuste</LB>
              <td colSpan={2} style={inputCell}><IC name="revision" value={form.revision} onChange={handleChange} readOnly={ro} /></td>
            </tr>
            <tr>
              <LB>Características</LB>
              <td colSpan={4} style={inputCell}><IC name="tipo" value={form.tipo} onChange={handleChange} readOnly={ro} /></td>
              <LB right>Bodega</LB>
              <td style={inputCell}><IC name="bodega" value={form.bodega} onChange={handleChange} readOnly={ro} /></td>
              <LB right>Estacionamiento</LB>
              <td colSpan={2} style={inputCell}><IC name="estac" value={form.estac} onChange={handleChange} readOnly={ro} /></td>
              <LB right>Proporcional</LB>
              <td colSpan={2} style={inputCell}><IC name="proporcional" value={form.proporcional} onChange={handleChange} readOnly={ro} /></td>
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
              <td colSpan={2} style={inputCell}><RT value={personas?.arr1?.nombre} /></td>
              <td style={inputCell}><RT value={personas?.arr1?.genero} /></td>
              <td style={inputCell}><RT value={personas?.arr1?.estado} /></td>
              <td style={inputCell}><RT value={personas?.arr1?.nacion} /></td>
              <td style={inputCell}><RT value={personas?.arr1?.rut} /></td>
              <td style={inputCell}><RT value={personas?.arr1?.pasaporte} /></td>
              <td colSpan={2} style={inputCell}><RT value={personas?.arr1?.email} /></td>
              <td style={inputCell}><RT value={personas?.arr1?.telefono} /></td>
              <td style={inputCell}><RT value={personas?.arr1?.domHabit} /></td>
              <td style={inputCell}><RT value={personas?.arr1?.domLab} /></td>
              <td style={inputCell}><RT value={personas?.arr1?.empresa} /></td>
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
                <td colSpan={2} style={inputCell}><RT value={personas?.arr2?.nombre} /></td>
                <td style={inputCell}><RT value={personas?.arr2?.genero} /></td>
                <td style={inputCell}><RT value={personas?.arr2?.estado} /></td>
                <td style={inputCell}><RT value={personas?.arr2?.nacion} /></td>
                <td style={inputCell}><RT value={personas?.arr2?.rut} /></td>
                <td style={inputCell}><RT value={personas?.arr2?.pasaporte} /></td>
                <td colSpan={2} style={inputCell}><RT value={personas?.arr2?.email} /></td>
                <td style={inputCell}><RT value={personas?.arr2?.telefono} /></td>
                <td style={inputCell}><RT value={personas?.arr2?.domHabit} /></td>
                <td style={inputCell}><RT value={personas?.arr2?.domLab} /></td>
                <td style={inputCell}><RT value={personas?.arr2?.empresa} /></td>
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
              <td colSpan={2} style={inputCell}><RT value={personas?.aval1?.nombre} /></td>
              <td style={inputCell}><RT value={personas?.aval1?.genero} /></td>
              <td style={inputCell}><RT value={personas?.aval1?.estado} /></td>
              <td style={inputCell}><RT value={personas?.aval1?.nacion} /></td>
              <td style={inputCell}><RT value={personas?.aval1?.rut} /></td>
              <td style={inputCell}><RT value={personas?.aval1?.pasaporte} /></td>
              <td colSpan={2} style={inputCell}><RT value={personas?.aval1?.email} /></td>
              <td style={inputCell}><RT value={personas?.aval1?.telefono} /></td>
              <td style={inputCell}><RT value={personas?.aval1?.domHabit} /></td>
              <td style={inputCell}><RT value={personas?.aval1?.domLab} /></td>
              <td style={inputCell}><RT value={personas?.aval1?.empresa} /></td>
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
                <td colSpan={2} style={inputCell}><RT value={personas?.aval2?.nombre} /></td>
                <td style={inputCell}><RT value={personas?.aval2?.genero} /></td>
                <td style={inputCell}><RT value={personas?.aval2?.estado} /></td>
                <td style={inputCell}><RT value={personas?.aval2?.nacion} /></td>
                <td style={inputCell}><RT value={personas?.aval2?.rut} /></td>
                <td style={inputCell}><RT value={personas?.aval2?.pasaporte} /></td>
                <td colSpan={2} style={inputCell}><RT value={personas?.aval2?.email} /></td>
                <td style={inputCell}><RT value={personas?.aval2?.telefono} /></td>
                <td style={inputCell}><RT value={personas?.aval2?.domHabit} /></td>
                <td style={inputCell}><RT value={personas?.aval2?.domLab} /></td>
                <td style={inputCell}><RT value={personas?.aval2?.empresa} /></td>
              </tr>
            )}

            <tr>
              <td colSpan={14} style={{ ...inputCell, background: C.rowAlt, height: 14, border: 'none' }}></td>
            </tr>

            {/* ══ CONDICIONES ══ */}
            <tr>
              <td style={{ ...labelCell, verticalAlign: 'middle' }} rowSpan={5}>CONDICIONES</td>
              <LB>Garantía</LB>
              <td colSpan={2} style={inputCell}><IC name="garantia_pedida" value={form.garantia_pedida} onChange={handleChange} readOnly={ro} type="number" /></td>
              <LB>A quién</LB>
              <td style={inputCell}><IC name="quien_tiene_garantia" value={form.quien_tiene_garantia} onChange={handleChange} readOnly={ro} /></td>
              <LB>Extensión</LB>
              <td style={inputCell}><IC name="comentar_renovacion" value={form.comentar_renovacion} onChange={handleChange} readOnly={ro} /></td>
              <LB>Nuevo final</LB>
              <td colSpan={2} style={inputCell}><IC name="termino_actual" value={form.termino_actual} onChange={handleChange} readOnly={ro} type="date" bold /></td>
              <LB>Especial primeros meses</LB>
              <td colSpan={3} style={inputCell}><IC name="especial_a" value={form.especial_a} onChange={handleChange} readOnly={ro} /></td>
            </tr>
            <tr>
              <LB>Plazo 1</LB>
              <td style={inputCell}><IC name="fecha1" value={form.fecha1} onChange={handleChange} readOnly={ro} type="date" /></td>
              <LB>Cantidad 1</LB>
              <td style={inputCell}><IC name="cuota1" value={form.cuota1} onChange={handleChange} readOnly={ro} type="number" /></td>
              <LB>Plazo 2</LB>
              <td style={inputCell}><IC name="fecha2" value={form.fecha2} onChange={handleChange} readOnly={ro} type="date" /></td>
              <LB>Cantidad 2</LB>
              <td style={inputCell}><IC name="cuota2" value={form.cuota2} onChange={handleChange} readOnly={ro} type="number" /></td>
              <LB>Meses</LB>
              <td style={inputCell}><IC name="meses" value={form.meses} onChange={handleChange} readOnly={ro} type="number" /></td>
              <td colSpan={3} style={{ ...inputCell, background: C.rowAlt }}></td>
            </tr>
            <tr>
              <LB>Plazo 3</LB>
              <td style={inputCell}><IC name="fecha3" value={form.fecha3} onChange={handleChange} readOnly={ro} type="date" /></td>
              <LB>Cantidad 3</LB>
              <td style={inputCell}><IC name="cuota3" value={form.cuota3} onChange={handleChange} readOnly={ro} type="number" /></td>
              <LB>Plazo 4</LB>
              <td style={inputCell}><IC name="fecha4" value={form.fecha4} onChange={handleChange} readOnly={ro} type="date" /></td>
              <LB>Cantidad 4</LB>
              <td style={inputCell}><IC name="cuota4" value={form.cuota4} onChange={handleChange} readOnly={ro} type="number" /></td>
              <LB>Cantidad</LB>
              <td style={inputCell}><IC name="cantidad" value={form.cantidad} onChange={handleChange} readOnly={ro} type="number" bold /></td>
              <td colSpan={3} style={{ ...inputCell, background: C.rowAlt }}></td>
            </tr>
            <tr>
              <LB cols={4}>Cláusula aceleración</LB>
              <td colSpan={4} style={inputCell}><IC name="tipo_aceleracion" value={form.tipo_aceleracion} onChange={handleChange} readOnly={ro} /></td>
              <LB right>Multas</LB>
              <td style={inputCell}><IC name="multa_diaria" value={form.multa_diaria} onChange={handleChange} readOnly={ro} type="number" /></td>
              <td colSpan={4} style={{ ...inputCell, background: C.rowAlt }}></td>
            </tr>
            <tr>
              <td colSpan={13} style={{ ...inputCell, background: '#fff', border: `1px solid ${C.border}` }}>
                <textarea name="comentarios" value={form.comentarios ?? ''} onChange={handleChange}
                  readOnly={ro} rows={2}
                  style={{ width: '100%', border: 'none', background: 'transparent', fontSize: 11, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }}
                  placeholder="COMENTARIOS..." />
              </td>
            </tr>

          </tbody>
        </table>

        {/* ══ DATOS ECONÓMICOS ══ */}
        <div style={{ marginTop: 16 }}>
          <div style={{
            ...headerCell, background: C.headerBg, padding: '5px 10px',
            fontSize: 11, letterSpacing: '0.05em', borderRadius: '6px 6px 0 0',
          }}>
            DATOS ECONÓMICOS
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0,
            border: `1px solid ${C.border}`, borderTop: 'none',
          }}>
            <div style={{ borderRight: `1px solid ${C.border}` }}>
              <div style={{ ...labelCell, background: C.subBg, color: '#fff', textAlign: 'center', borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>PROPIETARIO</div>
              <EcoRow label="Porcentaje"><IC name="pct_adm" value={form.pct_adm} onChange={handleChange} readOnly={ro} /></EcoRow>
              <EcoRow label="+ IVA"><IC name="adicionar_iva" value={form.adicionar_iva} onChange={handleChange} readOnly={ro} /></EcoRow>
              <EcoRow label="Cantidad"><IC name="comision_d_base" value={form.comision_d_base} onChange={handleChange} readOnly={ro} type="number" /></EcoRow>
              <EcoRow label="Con IVA"><IC name="iva_comision_d" value={form.iva_comision_d} onChange={handleChange} readOnly={ro} type="number" /></EcoRow>
              <EcoRow label="Total"><IC name="comision_d_total" value={form.comision_d_total} onChange={handleChange} readOnly={ro} type="number" bold /></EcoRow>
              <EcoRow label="C. Especiales"><IC name="c_especiales" value={form.c_especiales} onChange={handleChange} readOnly={ro} /></EcoRow>
              <EcoRow label="Comentario"><IC name="comentario_comision" value={form.comentario_comision} onChange={handleChange} readOnly={ro} /></EcoRow>
              <EcoRow label="Boleta/Factura"><IC name="comision_cobrado" value={form.comision_cobrado} onChange={handleChange} readOnly={ro} /></EcoRow>
            </div>
            <div style={{ borderRight: `1px solid ${C.border}` }}>
              <div style={{ ...labelCell, background: C.subBg, color: '#fff', textAlign: 'center', borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>ARRENDATARIO</div>
              <EcoRow label="Porcentaje"><IC name="si_fijo_admon" value={form.si_fijo_admon} onChange={handleChange} readOnly={ro} /></EcoRow>
              <EcoRow label="+ IVA"><IC name="tiene_contrato_admon" value={form.tiene_contrato_admon} onChange={handleChange} readOnly={ro} /></EcoRow>
              <EcoRow label="Cantidad"><IC name="comision_a_base" value={form.comision_a_base} onChange={handleChange} readOnly={ro} type="number" /></EcoRow>
              <EcoRow label="Con IVA"><IC name="iva_comision_a" value={form.iva_comision_a} onChange={handleChange} readOnly={ro} type="number" /></EcoRow>
              <EcoRow label="Total"><IC name="comision_a_total" value={form.comision_a_total} onChange={handleChange} readOnly={ro} type="number" bold /></EcoRow>
              <EcoRow label="C. Especiales"><IC name="especial_b" value={form.especial_b} onChange={handleChange} readOnly={ro} /></EcoRow>
              <EcoRow label="Comentario"><IC name="especial_c" value={form.especial_c} onChange={handleChange} readOnly={ro} /></EcoRow>
              <EcoRow label="Boleta/Factura"><IC name="comision_a_pagado" value={form.comision_a_pagado} onChange={handleChange} readOnly={ro} /></EcoRow>
            </div>
            <div>
              <div style={{ ...labelCell, background: C.subBg, color: '#fff', textAlign: 'center', borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>ADMON MES</div>
              <EcoRow label="Tipo"><IC name="quien_cobra" value={form.quien_cobra} onChange={handleChange} readOnly={ro} /></EcoRow>
              <EcoRow label="Cuantía"><IC name="cuota" value={form.cuota} onChange={handleChange} readOnly={ro} type="number" bold /></EcoRow>
              <EcoRow label="Especial"><IC name="mowner" value={form.mowner} onChange={handleChange} readOnly={ro} /></EcoRow>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <BotonesInferiores />
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
                    readOnly={ro}
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