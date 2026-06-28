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
  minWidth: 60,
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
  const [propData, setPropData] = useState(null)   // ficha del propietario (tabla propietarios)
  const [propData, setPropData] = useState(null)   // ficha del propietario (tabla propietarios, por idprop)
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
  // Helper: leer un campo de la ficha del propietario (tabla propietarios)
  const pp = (campo) => (propData && propData[campo] != null ? propData[campo] : '')
  // Helper: leer un campo de la ficha del propietario (tabla propietarios, por idprop)
  const pp = (campo) => (propData && propData[campo] != null ? propData[campo] : '')

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
        const a2 = lrow?.raw_data?.['Nombre-A2']
        const g2 = lrow?.raw_data?.['Nombre-G2']
        const d2 = lrow?.raw_data?.['Nombre-D2']
        setArr2Abierto(!!(a2 && String(a2).trim()))
        setAval2Abierto(!!(g2 && String(g2).trim()))
        setProp2Abierto(!!(d2 && String(d2).trim()))
      } catch { setLogData(null); setArr2Abierto(false); setAval2Abierto(false); setProp2Abierto(false) }
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
      setLogData(null); setPropData(null); setArr2Abierto(false); setAval2Abierto(false); setProp2Abierto(false)
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
    if (error) { setMsg({ type: 'error', text: 'Error: ' + error.message }) }
    else { localStorage.setItem('ultimo_idadmon', form.idadmon); setIsNew(false); setBloqueado(true); setMsg({ type: 'ok', text: '✓ Guardado correctamente.' }) }
    setSaving(false)
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
    <div style={{ minHeight: '100vh', background: '#e8eef5' }}>
      <TopNav />

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
          margin: '8px 16px 0', padding: '8px 14px', borderRadius: 6,
          background: '#f8fafc', border: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.headerBg }}>CAMBIAR ESTADO:</span>
          <span style={{ fontSize: 11, color: '#6b7280' }}>Actual: <b>{form.estado || '—'}</b> →</span>
          <select value={nuevoEstado} onChange={e => setNuevoEstado(e.target.value)}
            style={{ ...inputCell, width: 150, cursor: 'pointer', border: `1px solid ${C.border}` }}>
            <option value="">elegir nuevo estado…</option>
            <option value="S">S – Contrato firmado</option>
            <option value="SQ">SQ – Aviso de término</option>
            <option value="Q">Q – Término (llaves)</option>
            <option value="N">N – Cierre término</option>
            <option value="N-DICOM">N-DICOM – Cierre con DICOM</option>
            <option value="P">P – Pendiente arrendar</option>
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
        <table style={{
          borderCollapse: 'collapse', width: '100%',
          fontSize: 11, fontFamily: 'inherit',
        }}>
          <tbody>
            <tr>
              <td colSpan={14} style={{ ...cell, background: '#fff', border: 'none', padding: '4px 0' }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: C.red, letterSpacing: '0.1em' }}>
                  {form.accion || 'HECHO'}
                </span>
              </td>
            </tr>

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
              <SH cols={2} bg={C.subBg}>D. Habitacional</SH>
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
              <td colSpan={2} style={inputCell}><RO value={pp('direccion')} /></td>
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
                    : '(muy poco frecuente — p. ej. propiedad heredada por dos titulares. Datos del LOG, por ahora de solo lectura)'}
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
                <td colSpan={2} style={inputCell}><RO value={lp('Dom-Habit-D10')} /></td>
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
              <td colSpan={4} style={inputCell}><IC name="idlinmue" value={form.idlinmue} onChange={handleChange} readOnly={ro} /></td>
              <LB right>Comienzo</LB>
              <td style={inputCell}><IC name="fecha_inicio" value={form.fecha_inicio} onChange={handleChange} readOnly={ro} type="date" /></td>
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
              <SH cols={2} bg={C.subBg}>D. Habitacional</SH>
              <SH cols={1} bg={C.subBg}>Empresa</SH>
            </tr>
            <tr>
              {/* Nombre, RUT, Email, Teléfono -> de datos_arriendos (manda). Resto -> de log (solo lectura) */}
              <td colSpan={2} style={inputCell}><IC name="arrendatario" value={form.arrendatario} onChange={handleChange} readOnly={ro} /></td>
              <td style={inputCell}><RO value={lp('Genero-A')} /></td>
              <td style={inputCell}><RO value={lp('Estado-A')} /></td>
              <td style={inputCell}><RO value={lp('Nacion-A')} /></td>
              <td style={inputCell}><IC name="rut" value={form.rut} onChange={handleChange} readOnly={ro} /></td>
              <td style={inputCell}><RO value={lp('Pasaporte-A')} /></td>
              <td colSpan={2} style={inputCell}><IC name="mail_arrendatario" value={form.mail_arrendatario} onChange={handleChange} readOnly={ro} /></td>
              <td style={inputCell}><IC name="movil" value={form.movil} onChange={handleChange} readOnly={ro} /></td>
              <td colSpan={2} style={inputCell}><RO value={lp('Dom-Habit-A')} /></td>
              <td style={inputCell}><RO value={lp('Empresa-A')} /></td>
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
                  (poco frecuente — datos del registro LOG, por ahora de solo lectura)
                </span>
              </td>
            </tr>

            {/* Fila 2º arrendatario (desplegable, solo lectura desde log -A2) */}
            {arr2Abierto && (
              <tr>
                <td style={{ ...labelCell, verticalAlign: 'middle', background: '#eef2f7' }}>ARRENDATARIO 2</td>
                <td colSpan={2} style={inputCell}><RO value={lp('Nombre-A2')} /></td>
                <td style={inputCell}><RO value={lp('Genero-A2')} /></td>
                <td style={inputCell}><RO value={lp('Estado-A2')} /></td>
                <td style={inputCell}><RO value={lp('Nacion-A2')} /></td>
                <td style={inputCell}><RO value={lp('RUT de A2')} /></td>
                <td style={inputCell}><RO value={lp('Pasaporte-A2')} /></td>
                <td colSpan={2} style={inputCell}><RO value={lp('email de A2')} /></td>
                <td style={inputCell}><RO value={lp('telefono de A2')} /></td>
                <td colSpan={2} style={inputCell}><RO value={lp('Dom-Habit-A2')} /></td>
                <td style={inputCell}><RO value={lp('Empresa-A2')} /></td>
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
              <SH cols={2} bg={C.subBg}>D. Habitacional</SH>
              <SH cols={1} bg={C.subBg}>Empresa</SH>
            </tr>
            <tr>
              {/* Nombre, Email, Teléfono -> de datos_arriendos (manda). Resto -> de log (solo lectura) */}
              <td colSpan={2} style={inputCell}><IC name="avalista" value={form.avalista} onChange={handleChange} readOnly={ro} /></td>
              <td style={inputCell}><RO value={lp('Genero-G')} /></td>
              <td style={inputCell}><RO value={lp('Estado-G')} /></td>
              <td style={inputCell}><RO value={lp('Nacion-G')} /></td>
              <td style={inputCell}><RO value={lp('RUT de G')} /></td>
              <td style={inputCell}><RO value={lp('Pasaporte-G')} /></td>
              <td colSpan={2} style={inputCell}><IC name="mail_avalista" value={form.mail_avalista} onChange={handleChange} readOnly={ro} /></td>
              <td style={inputCell}><IC name="telefono_avalista" value={form.telefono_avalista} onChange={handleChange} readOnly={ro} /></td>
              <td colSpan={2} style={inputCell}><RO value={lp('Dom-Habit-G')} /></td>
              <td style={inputCell}><RO value={lp('Empresa-G')} /></td>
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
                  (poco frecuente — datos del registro LOG, por ahora de solo lectura)
                </span>
              </td>
            </tr>

            {/* Fila 2º aval (desplegable, solo lectura desde log -G2) */}
            {aval2Abierto && (
              <tr>
                <td style={{ ...labelCell, verticalAlign: 'middle', background: '#eef2f7' }}>AVAL 2</td>
                <td colSpan={2} style={inputCell}><RO value={lp('Nombre-G2')} /></td>
                <td style={inputCell}><RO value={lp('Genero-G2')} /></td>
                <td style={inputCell}><RO value={lp('Estado-G2')} /></td>
                <td style={inputCell}><RO value={lp('Nacion-G2')} /></td>
                <td style={inputCell}><RO value={lp('RUT de G2')} /></td>
                <td style={inputCell}><RO value={lp('Pasaporte-G2')} /></td>
                <td colSpan={2} style={inputCell}><RO value={lp('email de G2')} /></td>
                <td style={inputCell}><RO value={lp('telefono de G2')} /></td>
                <td colSpan={2} style={inputCell}><RO value={lp('Dom-Habit-G2')} /></td>
                <td style={inputCell}><RO value={lp('Empresa-G2')} /></td>
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
    </div>
  )
}

const fieldInput = {
  outline: 'none', fontFamily: 'inherit', color: '#1f2937',
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>Cargando...</div>}>
      <AdminContent />
    </Suspense>
  )
}