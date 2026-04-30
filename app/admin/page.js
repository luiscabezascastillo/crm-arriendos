'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { TopNav } from '../components/ui/TopNav'
import Link from 'next/link'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

/* ── Colores fieles al Excel ── */
const C = {
  headerBg:   '#1a3a6b',   // azul oscuro cabeceras
  headerText: '#ffffff',
  subBg:      '#2563a8',   // azul medio subencabezados
  subText:    '#ffffff',
  labelBg:    '#dbe5f1',   // azul claro etiquetas
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
  const [bloqueado, setBloqueado] = useState(false)
  const [isNew, setIsNew] = useState(true)
  const [msg, setMsg] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const ultimo = localStorage.getItem('ultimo_idadmon')
    if (ultimo) { setIdadmonInput(ultimo); recuperar(ultimo) }
  }, [])

  async function recuperar(id) {
    const buscar = (id || idadmonInput).trim().toUpperCase()
    if (!buscar) { setMsg({ type: 'warn', text: 'Introduce un IDADMON' }); return }
    setMsg({ type: 'info', text: 'Buscando...' })
    const { data } = await supabase.from('datos_arriendos').select('*').eq('idadmon', buscar).single()
    if (data) {
      setForm(data); setIdadmonInput(buscar); setIsNew(false); setBloqueado(true)
      localStorage.setItem('ultimo_idadmon', buscar)
      setMsg({ type: 'ok', text: `✓ ${buscar} — ${data.propietario || ''} · ${data.inmueble || ''}` })
    } else {
      setForm({ ...FORM_VACIO, idadmon: buscar }); setIdadmonInput(buscar)
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
    const payload = { ...form, updated_at: new Date().toISOString() }
    delete payload.id
    const { error } = isNew
      ? await supabase.from('datos_arriendos').insert([payload])
      : await supabase.from('datos_arriendos').update(payload).eq('idadmon', form.idadmon)
    if (error) { setMsg({ type: 'error', text: 'Error: ' + error.message }) }
    else { localStorage.setItem('ultimo_idadmon', form.idadmon); setIsNew(false); setBloqueado(true); setMsg({ type: 'ok', text: '✓ Guardado correctamente.' }) }
    setSaving(false)
  }

  async function terminar() {
    if (bloqueado) { setMsg({ type: 'warn', text: 'Desbloquea primero.' }); return }
    if (!form.idadmon) { setMsg({ type: 'warn', text: 'No hay contrato cargado.' }); return }
    if (!window.confirm(`¿Terminar el contrato ${form.idadmon}? Estado pasará a Q.`)) return
    const { error } = await supabase.from('datos_arriendos').update({ estado: 'Q', updated_at: new Date().toISOString() }).eq('idadmon', form.idadmon)
    if (error) setMsg({ type: 'error', text: 'Error: ' + error.message })
    else { setForm(p => ({ ...p, estado: 'Q' })); setBloqueado(true); setMsg({ type: 'ok', text: `Contrato ${form.idadmon} terminado.` }) }
  }

  const ro = bloqueado

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

        {/* IDADMON input */}
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

        {/* RECUPERAR */}
        <button onClick={() => recuperar()} style={{
          padding: '5px 14px', borderRadius: 5, border: 'none',
          background: C.green, color: '#fff', fontSize: 12, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.03em',
        }}>RECUPERAR</button>

        <span style={{ color: C.border, fontSize: 14 }}>|</span>

        {/* GUARDAR */}
        <button onClick={guardar} disabled={saving || bloqueado} style={{
          padding: '5px 14px', borderRadius: 5, border: 'none',
          background: bloqueado ? '#9ca3af' : C.green,
          color: '#fff', fontSize: 12, fontWeight: 700,
          cursor: bloqueado ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
        }}>{saving ? 'GUARDANDO...' : 'GUARDAR'}</button>

        {/* TERMINAR */}
        <button onClick={terminar} disabled={bloqueado} style={{
          padding: '5px 14px', borderRadius: 5, border: 'none',
          background: bloqueado ? '#9ca3af' : C.red,
          color: '#fff', fontSize: 12, fontWeight: 700,
          cursor: bloqueado ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
        }}>TERMINAR</button>

        {/* DESBLOQUEAR */}
        <button onClick={() => { setBloqueado(false); setMsg({ type: 'info', text: '🔓 Desbloqueado — puedes editar.' }) }} style={{
          padding: '5px 14px', borderRadius: 5, border: 'none',
          background: bloqueado ? C.amber : '#6b7280',
          color: '#fff', fontSize: 12, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>{bloqueado ? '🔒 DESBLOQUEAR' : '🔓 DESBLOQUEADO'}</button>

        {/* EXPORT (pendiente) */}
        <button disabled title="Pendiente de definir para la versión web" style={{
          padding: '5px 14px', borderRadius: 5, border: '1px dashed #9ca3af',
          background: 'transparent', color: '#9ca3af', fontSize: 12, fontWeight: 700,
          cursor: 'not-allowed', fontFamily: 'inherit',
        }}>EXPORT</button>

        {/* + NUEVO */}
        <button onClick={() => { setForm(FORM_VACIO); setIdadmonInput(''); setIsNew(true); setBloqueado(false); setMsg(null); localStorage.removeItem('ultimo_idadmon') }}
          style={{
            marginLeft: 'auto', padding: '5px 12px', borderRadius: 5,
            border: `1px solid ${C.border}`, background: '#fff',
            fontSize: 12, color: C.headerBg, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>+ NUEVO</button>

        {/* Estado badge */}
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

      {/* Mensaje */}
      {msg && (
        <div style={{
          margin: '8px 16px 0', padding: '7px 14px', borderRadius: 6,
          fontSize: 11, fontWeight: 500,
          background: msgColors[msg.type]?.bg, color: msgColors[msg.type]?.color,
          border: `1px solid ${msgColors[msg.type]?.border}`,
        }}>{msg.text}</div>
      )}

      {/* ── FORMULARIO TIPO EXCEL ── */}
      <div style={{ padding: '10px 16px 40px', overflowX: 'auto' }}>
        <table style={{
          borderCollapse: 'collapse', width: '100%',
          tableLayout: 'fixed', fontSize: 11,
          fontFamily: 'inherit',
        }}>

          {/* ══ FILA 1: HECHO ══ */}
          <tbody>
            <tr>
              <td colSpan={14} style={{ ...cell, background: '#fff', border: 'none', padding: '4px 0' }}>
                <span style={{
                  fontSize: 16, fontWeight: 700, color: C.red,
                  letterSpacing: '0.1em',
                }}>
                  {form.accion || 'HECHO'}
                </span>
              </td>
            </tr>

            {/* ══ PROPIETARIO cabecera ══ */}
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
              <td colSpan={2} style={inputCell}><IC name="propietario" value={form.propietario} onChange={handleChange} readOnly={ro} /></td>
              <td style={inputCell}><IC name="genero" value={form.genero} onChange={handleChange} readOnly={ro} /></td>
              <td style={inputCell}><IC name="estado" value={form.estado} onChange={handleChange} readOnly={ro} bold /></td>
              <td style={inputCell}></td>
              <td style={inputCell}><IC name="rut" value={form.rut} onChange={handleChange} readOnly={ro} /></td>
              <td style={inputCell}></td>
              <td colSpan={2} style={inputCell}><IC name="mail_arrendatario" value={form.mail_arrendatario} onChange={handleChange} readOnly={ro} /></td>
              <td style={inputCell}><IC name="movil" value={form.movil} onChange={handleChange} readOnly={ro} /></td>
              <td colSpan={2} style={inputCell}><IC name="otro_dato" value={form.otro_dato} onChange={handleChange} readOnly={ro} /></td>
              <td style={inputCell}></td>
            </tr>

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

            {/* ══ ARRENDATARIO cabecera ══ */}
            <tr>
              <td style={{ ...labelCell, verticalAlign: 'middle' }} rowSpan={3}>ARRENDATARIO</td>
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
              <td colSpan={2} style={inputCell}><IC name="arrendatario" value={form.arrendatario} onChange={handleChange} readOnly={ro} /></td>
              <td style={inputCell}></td>
              <td style={inputCell}><IC name="sub_estado" value={form.sub_estado} onChange={handleChange} readOnly={ro} /></td>
              <td style={inputCell}></td>
              <td style={inputCell}><IC name="idprop" value={form.idprop} onChange={handleChange} readOnly={ro} /></td>
              <td style={inputCell}></td>
              <td colSpan={2} style={inputCell}><IC name="mail_arrendatario" value={form.mail_arrendatario} onChange={handleChange} readOnly={ro} /></td>
              <td style={inputCell}><IC name="movil" value={form.movil} onChange={handleChange} readOnly={ro} /></td>
              <td colSpan={2} style={inputCell}></td>
              <td style={inputCell}></td>
            </tr>
            <tr>
              <td colSpan={13} style={{ ...inputCell, background: C.rowAlt, height: 22 }}></td>
            </tr>

            {/* ══ AVALES ══ */}
            <tr>
              <td style={{ ...labelCell, verticalAlign: 'middle' }} rowSpan={3}>AVALES</td>
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
              <td colSpan={2} style={inputCell}><IC name="avalista" value={form.avalista} onChange={handleChange} readOnly={ro} /></td>
              <td style={inputCell}></td>
              <td style={inputCell}></td>
              <td style={inputCell}></td>
              <td style={inputCell}><IC name="rut" value={form.rut} onChange={handleChange} readOnly={ro} /></td>
              <td style={inputCell}></td>
              <td colSpan={2} style={inputCell}><IC name="mail_avalista" value={form.mail_avalista} onChange={handleChange} readOnly={ro} /></td>
              <td style={inputCell}><IC name="telefono_avalista" value={form.telefono_avalista} onChange={handleChange} readOnly={ro} /></td>
              <td colSpan={2} style={inputCell}></td>
              <td style={inputCell}></td>
            </tr>
            <tr>
              <td colSpan={13} style={{ ...inputCell, background: C.rowAlt, height: 22 }}></td>
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
              <td colSpan={13} style={{ ...inputCell, background: '#fff9c4', border: `1px solid ${C.border}` }}>
                <textarea name="comentarios" value={form.comentarios ?? ''} onChange={handleChange}
                  readOnly={ro} rows={2}
                  style={{ width: '100%', border: 'none', background: 'transparent', fontSize: 11, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }}
                  placeholder="COMENTARIOS..." />
              </td>
            </tr>

            {/* ══ DATOS ECONÓMICOS (fila derecha) ══ */}
            <tr>
              <td colSpan={14} style={{ padding: '6px 0 2px', border: 'none' }}>
                <table style={{ borderCollapse: 'collapse', float: 'right', fontSize: 11 }}>
                  <tbody>
                    <tr>
                      <td colSpan={4} style={{ ...headerCell, background: C.headerBg, textAlign: 'center', padding: '4px 20px' }}>
                        DATOS ECONÓMICOS
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={4} style={{ ...labelCell, background: C.subBg, color: '#fff', textAlign: 'center' }}>PROPIETARIO</td>
                    </tr>
                    <tr>
                      <LB>Porcentaje</LB><td style={inputCell}><IC name="pct_adm" value={form.pct_adm} onChange={handleChange} readOnly={ro} /></td>
                      <LB>+ IVA</LB><td style={inputCell}><IC name="adicionar_iva" value={form.adicionar_iva} onChange={handleChange} readOnly={ro} /></td>
                    </tr>
                    <tr>
                      <LB>Cantidad</LB><td style={inputCell}><IC name="comision_d_base" value={form.comision_d_base} onChange={handleChange} readOnly={ro} type="number" /></td>
                      <LB>Con IVA</LB><td style={inputCell}><IC name="iva_comision_d" value={form.iva_comision_d} onChange={handleChange} readOnly={ro} type="number" /></td>
                    </tr>
                    <tr>
                      <LB>Total</LB><td colSpan={3} style={{ ...inputCell, fontWeight: 700 }}><IC name="comision_d_total" value={form.comision_d_total} onChange={handleChange} readOnly={ro} type="number" bold /></td>
                    </tr>
                    <tr>
                      <LB>C. Especiales</LB><td colSpan={3} style={inputCell}><IC name="c_especiales" value={form.c_especiales} onChange={handleChange} readOnly={ro} /></td>
                    </tr>
                    <tr>
                      <LB>Comentario</LB><td colSpan={3} style={inputCell}><IC name="comentario_comision" value={form.comentario_comision} onChange={handleChange} readOnly={ro} /></td>
                    </tr>
                    <tr>
                      <LB>Boleta/Factura</LB><td colSpan={3} style={{ ...inputCell, fontWeight: 700, color: C.red }}><IC name="comision_cobrado" value={form.comision_cobrado} onChange={handleChange} readOnly={ro} /></td>
                    </tr>
                    <tr>
                      <td colSpan={4} style={{ ...labelCell, background: C.subBg, color: '#fff', textAlign: 'center' }}>ARRENDATARIO</td>
                    </tr>
                    <tr>
                      <LB>Porcentaje</LB><td style={inputCell}><IC name="si_fijo_admon" value={form.si_fijo_admon} onChange={handleChange} readOnly={ro} /></td>
                      <LB>+ IVA</LB><td style={inputCell}><IC name="tiene_contrato_admon" value={form.tiene_contrato_admon} onChange={handleChange} readOnly={ro} /></td>
                    </tr>
                    <tr>
                      <LB>Cantidad</LB><td style={inputCell}><IC name="comision_a_base" value={form.comision_a_base} onChange={handleChange} readOnly={ro} type="number" /></td>
                      <LB>Con IVA</LB><td style={inputCell}><IC name="iva_comision_a" value={form.iva_comision_a} onChange={handleChange} readOnly={ro} type="number" /></td>
                    </tr>
                    <tr>
                      <LB>Total</LB><td colSpan={3} style={inputCell}><IC name="comision_a_total" value={form.comision_a_total} onChange={handleChange} readOnly={ro} type="number" bold /></td>
                    </tr>
                    <tr>
                      <LB>C. Especiales</LB><td colSpan={3} style={inputCell}><IC name="especial_b" value={form.especial_b} onChange={handleChange} readOnly={ro} /></td>
                    </tr>
                    <tr>
                      <LB>Comentario</LB><td colSpan={3} style={inputCell}><IC name="especial_c" value={form.especial_c} onChange={handleChange} readOnly={ro} /></td>
                    </tr>
                    <tr>
                      <LB>Boleta/Factura</LB><td colSpan={3} style={{ ...inputCell, fontWeight: 700, color: C.red }}><IC name="comision_a_pagado" value={form.comision_a_pagado} onChange={handleChange} readOnly={ro} /></td>
                    </tr>
                    <tr>
                      <td colSpan={4} style={{ ...labelCell, background: C.subBg, color: '#fff', textAlign: 'center' }}>ADMON MES</td>
                    </tr>
                    <tr>
                      <LB>Tipo</LB><td colSpan={3} style={inputCell}><IC name="quien_cobra" value={form.quien_cobra} onChange={handleChange} readOnly={ro} /></td>
                    </tr>
                    <tr>
                      <LB>Cuantía</LB><td colSpan={3} style={inputCell}><IC name="cuota" value={form.cuota} onChange={handleChange} readOnly={ro} type="number" bold /></td>
                    </tr>
                    <tr>
                      <LB>Especial</LB><td colSpan={3} style={inputCell}><IC name="mowner" value={form.mowner} onChange={handleChange} readOnly={ro} /></td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>

            {/* ══ BOTONES INFERIORES ══ */}
            <tr>
              <td colSpan={14} style={{ padding: '10px 0 0', border: 'none' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
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
              </td>
            </tr>

          </tbody>
        </table>

        {/* ══ SECCIÓN ADICIONAL — campos no visibles en la vista principal ══ */}
        <div style={{
          marginTop: 20, background: '#fff',
          border: `1px solid ${C.border}`, borderRadius: 8,
          overflow: 'hidden',
        }}>
          <div style={{
            background: C.headerBg, color: '#fff', padding: '6px 14px',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
          }}>
            DATOS ADICIONALES
          </div>
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
        </div>
      </div>
    </div>
  )
}

const fieldInput = {
  outline: 'none', fontFamily: 'inherit',
  color: '#1f2937',
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>Cargando...</div>}>
      <AdminContent />
    </Suspense>
  )
}
