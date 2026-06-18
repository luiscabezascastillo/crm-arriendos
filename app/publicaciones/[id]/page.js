'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import  TopNav  from '../../components/ui/TopNav'
import { COMUNAS_LISTA, regionDeComuna } from '../../../lib/comunas.js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const IMG_BASE = 'https://fondocapital.com/propiedades/'

const PORTALES = [
  { key: 'web',       label: 'Web',                  code: 'We', bg: '#E6F1FB', color: '#0891b2', apiKey: 'web',  nota: null },
  { key: 'pi',        label: 'Portal Inmobiliario', code: 'PI', bg: '#E6F1FB', color: '#1a56db', apiKey: 'pi',   nota: null },
  { key: 'yapo',      label: 'Yapo',                code: 'Ya', bg: '#FAEEDA', color: '#854F0B', apiKey: 'yapo', nota: null },
  { key: 'goplaceit', label: 'GoPlaceIt',            code: 'Go', bg: '#EAF3DE', color: '#3B6D11', apiKey: null,   nota: 'Pendiente de implementar' },
  { key: 'proppit',   label: 'Proppit',              code: 'Pr', bg: '#F3E8FF', color: '#7C3AED', apiKey: null,   nota: 'Pendiente de implementar' },
]

const MENU = ['Resumen', 'Editar', 'Imágenes', 'Documentos', 'Estado', 'Bitácora', 'Propietario', 'Publicación']


// ── SECCIÓN EDITAR ──
function SeccionEditar({ pub, id, onGuardado }) {
  const [form, setForm] = React.useState({
    ...pub,
    titulo:       pub.titulo       || '',
    direccion:    pub.direccion    || '',
    calle:        pub.calle        || '',
    numero_calle: pub.numero_calle || '',
    departamento: pub.departamento || '',
    numero:       pub.numero       || '',
    comuna:       pub.comuna       || '',
    region:       pub.region       || '',
    objetivo:     pub.objetivo     || '',
    tipo:         pub.tipo         || '',
    valor:        pub.valor != null ? String(pub.valor) : '',
    tipo_moneda:  pub.tipo_moneda  || '',
    dormitorios:  pub.dormitorios != null ? String(pub.dormitorios) : '',
    banos:        pub.banos != null ? String(pub.banos) : '',
    mt2_const:    pub.mt2_const != null ? String(pub.mt2_const) : '',
    mt2_terreno:  pub.mt2_terreno != null ? String(pub.mt2_terreno) : '',
    estacionamientos: pub.estacionamientos != null ? String(pub.estacionamientos) : '',
    bodegas:      pub.bodegas != null ? String(pub.bodegas) : '',
    ggcc:         pub.ggcc != null ? String(pub.ggcc) : '',
    amoblado:     pub.amoblado     || 'No',
    observaciones: pub.observaciones || '',
    latitud:      pub.latitud      || '',
    longitud:     pub.longitud     || '',
    orientacion:  pub.orientacion  || '',
    unit_floor:   pub.unit_floor != null ? String(pub.unit_floor) : '',
    property_age: pub.property_age != null ? String(pub.property_age) : '',
    floors:       pub.floors != null ? String(pub.floors) : '',
    apartments_per_floor: pub.apartments_per_floor != null ? String(pub.apartments_per_floor) : '',
    apartment_number: pub.apartment_number || '',
    property_registration_code: pub.property_registration_code || '',
    has_balcony:  pub.has_balcony  || false,
    has_laundry:  pub.has_laundry  || false,
    has_maid_room: pub.has_maid_room || false,
    has_half_bath: pub.has_half_bath || false,
    has_security: pub.has_security || false,
    hide_address: pub.hide_address || false,
    vendedor:     pub.vendedor     || '',
    captador:     pub.captador     || '',
  })
  const [guardando, setGuardando] = React.useState(false)
  const [msg, setMsg] = React.useState(null)
  const [usuarios, setUsuarios] = React.useState([])
  React.useEffect(() => {
    supabase.from('crm_users').select('nombre').order('nombre')
      .then(({ data }) => { if (data) setUsuarios(data.map(u => u.nombre).filter(Boolean)) })
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function guardar() {
    setGuardando(true)
    setMsg(null)
    const direccionPublica = [form.calle, form.numero_calle].filter(Boolean).join(' ').trim()
    const { data, error } = await supabase.from('publicaciones').update({ ...form, direccion: direccionPublica || form.direccion }).eq('id', id).select().single()
    setGuardando(false)
    if (error) { setMsg({ ok: false, text: 'Error: ' + error.message }) }
    else { onGuardado(data); setMsg({ ok: true, text: '✓ Guardado correctamente' }); setTimeout(() => setMsg(null), 3000) }
  }

  const inp = (label, key, type='text', opts=null) => (
    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
      <label style={{ fontSize:11, fontWeight:600, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:.5 }}>{label}</label>
      {opts ? (
        <select value={form[key]} onChange={e => set(key, e.target.value)}
          style={{ padding:'8px 10px', borderRadius:7, border:'1px solid var(--border)', fontSize:13, background:'var(--surface)', color:'var(--text)', fontFamily:'inherit' }}>
          {opts.map(o => <option key={o}>{o}</option>)}
        </select>
      ) : (
        <input type="text" value={form[key]} onChange={e => set(key, e.target.value)}
          style={{ padding:'8px 10px', borderRadius:7, border:'1px solid var(--border)', fontSize:13, background:'var(--surface)', color:'var(--text)', fontFamily:'inherit' }} />
      )}
    </div>
  )

  const sec = (titulo, color='#1a56db') => (
    <div style={{ gridColumn:'1/-1', borderBottom:'2px solid '+color, paddingBottom:4, marginTop:8 }}>
      <span style={{ fontSize:12, fontWeight:700, color, textTransform:'uppercase', letterSpacing:.8 }}>{titulo}</span>
    </div>
  )

  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:28 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px,1fr))', gap:14 }}>
        {sec('Ubicación')}
        {inp('Calle', 'calle')}
        {inp('Número', 'numero_calle')}
        {inp('Departamento', 'departamento')}
<div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          <label style={{ fontSize:11, fontWeight:600, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:.5 }}>Comuna</label>
          <select value={form.comuna || ''} onChange={e => { const c = e.target.value; set('comuna', c); if (regionDeComuna(c)) set('region', regionDeComuna(c)) }}
            style={{ padding:'8px 10px', borderRadius:7, border:'1px solid var(--border)', fontSize:13, background:'var(--surface)', color:'var(--text)', fontFamily:'inherit' }}>
            <option value="">— Selecciona comuna —</option>
            {form.comuna && !COMUNAS_LISTA.includes(form.comuna) && <option value={form.comuna}>{form.comuna} (actual)</option>}
            {COMUNAS_LISTA.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          <label style={{ fontSize:11, fontWeight:600, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:.5 }}>Región (automática)</label>
          <input type="text" value={form.region || ''} readOnly
            style={{ padding:'8px 10px', borderRadius:7, border:'1px solid var(--border)', fontSize:13, background:'var(--gray-100)', color:'var(--gray-600)', fontFamily:'inherit' }} />
        </div>
        {inp('Latitud', 'latitud')}
        {inp('Longitud', 'longitud')}

        {sec('Propiedad', '#16a34a')}
        <div style={{ display:'flex', flexDirection:'column', gap:4, gridColumn:'1/-1' }}>
          <label style={{ fontSize:11, fontWeight:600, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:.5 }}>
            Título <span style={{ color: (form.titulo||'').length > 60 ? '#dc2626' : 'var(--gray-400)', fontWeight:400 }}>({(form.titulo||'').length}/60)</span>
          </label>
          <input type="text" value={form.titulo || ''} maxLength={80} onChange={e => set('titulo', e.target.value)}
            placeholder="Si lo dejas vacio se genera automatico"
            style={{ padding:'8px 10px', borderRadius:7, border:(form.titulo||'').length > 60 ? '1px solid #dc2626' : '1px solid var(--border)', fontSize:13, background:'var(--surface)', color:'var(--text)', fontFamily:'inherit' }} />
          <span style={{ fontSize:11, color:'var(--gray-400)' }}>Max. 60 caracteres en Portal Inmobiliario. Vacio = titulo automatico.</span>
        </div>
        {inp('Operación', 'objetivo', 'text', ['Arriendo','Venta','Arriendo y Venta'])}
        {inp('Tipo', 'tipo', 'text', ['Departamento','Casa','Oficina','Local Comercial','Bodega','Estacionamiento','Terreno','Otro'])}
        {inp('Valor', 'valor', 'number')}
        {inp('Moneda', 'tipo_moneda', 'text', ['UF','Pesos','USD','UF/S'])}
        {inp('Dormitorios', 'dormitorios', 'number')}
        {inp('Baños', 'banos', 'number')}
        {inp('M² construidos', 'mt2_const', 'number')}
        {inp('M² terreno', 'mt2_terreno', 'number')}
        {inp('Estacionamientos', 'estacionamientos', 'number')}
        {inp('Bodegas', 'bodegas', 'number')}
        {inp('GGCC ($)', 'ggcc', 'number')}
        {inp('Amoblado', 'amoblado', 'text', ['No','Sí','Parcial'])}
        {inp('Orientación', 'orientacion', 'text', ['','Norte','Sur','Oriente','Poniente','Nororiente','Norponiente','Suroriente','Surponiente'])}

        {sec('Gestion interna', '#7c2d12')}
        {inp('Vendedor', 'vendedor', 'text', ['', ...usuarios])}
        {inp('Captador', 'captador', 'text', ['', ...usuarios])}
        {sec('Atributos Portal Inmobiliario', '#0891b2')}
        {inp('Piso', 'unit_floor')}
        {inp('Antigüedad (años)', 'property_age')}
        {inp('Pisos edificio', 'floors')}
        {inp('Deptos por piso', 'apartments_per_floor')}
        {inp('Nº depto', 'apartment_number')}
        {inp('Rol propiedad', 'property_registration_code')}
        {inp('Admite mascotas', 'ksuitable_for_pets', 'text', ['No','Sí'])}
        {inp('Tipo de gastos comunes', 'maintenance_fee_type', 'text', ['','Sin cobro','Incluidos en el arriendo','Fijos','Aproximados'])}
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          <label style={{ fontSize:11, fontWeight:600, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:.5 }}>Disponible desde</label>
          <input type="date" value={form.available_from || ''} onChange={e => set('available_from', e.target.value)}
            style={{ padding:'8px 10px', borderRadius:7, border:'1px solid var(--border)', fontSize:13, background:'var(--surface)', color:'var(--text)', fontFamily:'inherit' }} />
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          <label style={{ fontSize:11, fontWeight:600, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:.5 }}>Calefacción</label>
          <select value={(form.has_heating ?? false) ? 'true' : 'false'} onChange={e => set('has_heating', e.target.value === 'true')}
            style={{ padding:'8px 10px', borderRadius:7, border:'1px solid var(--border)', fontSize:13, background:'var(--surface)', color:'var(--text)', fontFamily:'inherit' }}>
            <option value="false">No</option>
            <option value="true">Sí</option>
          </select>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          <label style={{ fontSize:11, fontWeight:600, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:.5 }}>Aire acondicionado</label>
          <select value={(form.has_air_conditioning ?? false) ? 'true' : 'false'} onChange={e => set('has_air_conditioning', e.target.value === 'true')}
            style={{ padding:'8px 10px', borderRadius:7, border:'1px solid var(--border)', fontSize:13, background:'var(--surface)', color:'var(--text)', fontFamily:'inherit' }}>
            <option value="false">No</option>
            <option value="true">Sí</option>
          </select>
        </div>

        <div style={{ gridColumn:'1/-1', borderBottom:'2px solid #0891b2', paddingBottom:4, marginTop:8 }}>
          <span style={{ fontSize:12, fontWeight:700, color:'#0891b2', textTransform:'uppercase', letterSpacing:.8 }}>Características adicionales</span>
        </div>
        {[
          ['has_balcony',  'Balcón'],
          ['has_laundry',  'Lavandería'],
          ['has_maid_room','Cuarto de servicio'],
          ['has_half_bath','Baño de visitas'],
          ['has_security', 'Seguridad 24h'],
          ['hide_address', 'Ocultar dirección exacta'],
        ].map(([key, label]) => (
          <div key={key} style={{ display:'flex', flexDirection:'column', gap:4 }}>
            <label style={{ fontSize:11, fontWeight:600, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:.5 }}>{label}</label>
            <select value={form[key] ? 'true' : 'false'} onChange={e => set(key, e.target.value === 'true')}
              style={{ padding:'8px 10px', borderRadius:7, border:'1px solid var(--border)', fontSize:13, background:'var(--surface)', color:'var(--text)', fontFamily:'inherit' }}>
              <option value="false">No</option>
              <option value="true">Sí</option>
            </select>
          </div>
        ))}

        {sec('Amenities del edificio', '#7c3aed')}
        <div style={{ gridColumn:'1/-1' }}>
          <p style={{ fontSize:11, color:'var(--gray-400)', margin:'0 0 10px' }}>Normalmente se importan del edificio. Puedes ajustarlos a mano.</p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(185px,1fr))', gap:8 }}>
            {[
              ['tiene_ascensor','Ascensor'],['tiene_piscina','Piscina'],['tiene_gimnasio','Gimnasio'],
              ['tiene_salon_fiestas','Salón de fiestas'],['tiene_sala_multiuso','Sala multiuso'],
              ['tiene_quincho_parrilla','Quincho / parrilla'],['tiene_juegos_infantiles','Juegos infantiles'],
              ['tiene_sauna','Sauna'],['tiene_jacuzzi','Jacuzzi'],['tiene_cowork','Cowork'],
              ['tiene_cine','Sala de cine'],['tiene_playroom','Playroom'],['tiene_recepcion','Recepción'],
              ['tiene_lavanderia','Lavandería común'],['tiene_estacionamiento_visitas','Estac. visitas'],
              ['tiene_cancha_paddle','Cancha paddle'],['tiene_cancha_tenis','Cancha tenis'],
              ['tiene_cancha_multiuso','Cancha multiuso'],['tiene_area_verde','Área verde'],
              ['tiene_azotea','Azotea'],['tiene_generador','Generador'],['tiene_rampa_silla','Rampa silla ruedas'],
            ].map(([key, label]) => (
              <label key={key} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'var(--gray-700)', cursor:'pointer', padding:'4px 0' }}>
                <input type="checkbox" checked={form[key] === true} onChange={e => set(key, e.target.checked)} style={{ width:16, height:16, cursor:'pointer' }} />
                {label}
              </label>
            ))}
          </div>
        </div>{sec('Observaciones', '#7c3aed')}
        <div style={{ gridColumn:'1/-1', display:'flex', flexDirection:'column', gap:4 }}>
          <label style={{ fontSize:11, fontWeight:600, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:.5 }}>Descripción</label>
          <textarea value={form.observaciones} onChange={e => set('observaciones', e.target.value)} rows={5}
            style={{ padding:'8px 10px', borderRadius:7, border:'1px solid var(--border)', fontSize:13, background:'var(--surface)', color:'var(--text)', fontFamily:'inherit', resize:'vertical' }} />
        </div>
      </div>

      <div style={{ marginTop:20, display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={guardar} disabled={guardando}
          style={{ padding:'9px 24px', borderRadius:8, border:'none', background:'#1a56db', color:'#fff', fontWeight:600, fontSize:13, cursor:guardando?'not-allowed':'pointer', fontFamily:'inherit' }}>
          {guardando ? '⏳ Guardando...' : '💾 Guardar cambios'}
        </button>
        {msg && <span style={{ fontSize:13, color: msg.ok ? '#16a34a' : '#dc2626', fontWeight:500 }}>{msg.text}</span>}
      </div>
    </div>
  )
}
export default function FichaPage() {
  const { id } = useParams()
  const router = useRouter()
  const [pub, setPub] = useState(null)
  const [loading, setLoading] = useState(true)
  const [valorUF, setValorUF] = useState(null)
  const [edificio, setEdificio] = useState(null)
  const [seccion, setSeccion] = useState('Resumen')
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('seccion')
    if (p) setSeccion(p)
  }, [])
  const [imagenes, setImagenes] = useState([])
  const [imgSeleccionada, setImgSeleccionada] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [msgGuardado, setMsgGuardado] = useState(null)
  const [msgSubida, setMsgSubida] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [publicando, setPublicando] = useState({})
  const [descripcionando, setDescripcionando] = useState(false)
  const [msgDescripcion, setMsgDescripcion] = useState(null)
  const [actualizandoPI, setActualizandoPI] = useState(false)
  const [msgActualizarPI, setMsgActualizarPI] = useState(null)
  const [busqProp, setBusqProp] = useState('')
  const [contactosEncontrados, setContactosEncontrados] = useState([])
  const [buscandoProp, setBuscandoProp] = useState(false)
  const [mostrarFormContacto, setMostrarFormContacto] = useState(false)
  const [nuevoContacto, setNuevoContacto] = useState({ nombre:'', telefono:'', email:'' })
  const [msgPublicacion, setMsgPublicacion] = useState(null)
  const dragIdx = useRef(null)
  const dragOverIdx = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    fetch('https://mindicador.cl/api/uf')
      .then(r => r.json())
      .then(d => setValorUF(d.serie?.[0]?.valor || null))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!id) return
    supabase.from('publicaciones').select('*').eq('id', id).single()
      .then(({ data }) => {
        setPub(data)
        if (data) {
          const imgs = Array.from({ length: 50 }, (_, i) => data[`imagen${i+1}`]).filter(Boolean)
          setImagenes(imgs)
          setImgSeleccionada(imgs[0] || null)
        }
        setLoading(false)
      })
  }, [id])
  // ── Buscar edificio asociado por calle + numero ──
     useEffect(() => {
       if (!pub || !pub.calle || !pub.numero_calle) { setEdificio(null); return }
       supabase.from('edificios').select('*')
         .ilike('calle', pub.calle.trim())
         .eq('numero_calle', String(pub.numero_calle).trim())
         .limit(1)
         .then(({ data }) => setEdificio(data && data[0] ? data[0] : null))
     }, [pub])

// ── Importar datos del edificio a la propiedad ──
  const [importando, setImportando] = useState(false)
  const [msgImportar, setMsgImportar] = useState(null)
  async function importarEdificio() {
    if (!edificio || !pub) return
    setImportando(true)
    setMsgImportar(null)
    const cambios = {}

    // 1) Amenities: copiar los 22 tiene_* del edificio (los que esten en true)
    const AMEN = ['tiene_ascensor','tiene_piscina','tiene_gimnasio','tiene_salon_fiestas','tiene_sala_multiuso',
      'tiene_quincho_parrilla','tiene_juegos_infantiles','tiene_sauna','tiene_jacuzzi','tiene_cowork','tiene_cine',
      'tiene_playroom','tiene_recepcion','tiene_lavanderia','tiene_estacionamiento_visitas','tiene_cancha_paddle',
      'tiene_cancha_tenis','tiene_cancha_multiuso','tiene_area_verde','tiene_azotea','tiene_generador','tiene_rampa_silla']
    for (const k of AMEN) if (edificio[k] === true) cambios[k] = true

    // 2) Fotos comunes: anadir al final de imagen1..50 (sin pisar las existentes)
    const fotosEdif = []
    for (let i = 1; i <= 15; i++) if (edificio['foto_comun_' + i]) fotosEdif.push(edificio['foto_comun_' + i])
    if (fotosEdif.length) {
      const actuales = []
      for (let i = 1; i <= 50; i++) if (pub['imagen' + i]) actuales.push(pub['imagen' + i])
      const yaEstan = new Set(actuales)
      const nuevas = fotosEdif.filter(f => !yaEstan.has(f))
      let slot = actuales.length + 1
      for (const f of nuevas) { if (slot > 50) break; cambios['imagen' + slot] = f; slot++ }
    }

    // 3) Complemento de descripcion: anadir al final si no esta ya
    if (edificio.complemento_descripcion && edificio.complemento_descripcion.trim()) {
      const comp = edificio.complemento_descripcion.trim()
     const desc = (pub.observaciones || '').trim()
    if (!desc.includes(comp)) cambios.observaciones = desc ? (desc + '<br>' + comp) : comp    }

    if (Object.keys(cambios).length === 0) {
      setImportando(false)
      setMsgImportar({ ok: true, text: 'No hay datos nuevos que importar del edificio.' })
      setTimeout(() => setMsgImportar(null), 3000)
      return
    }

    const { data, error } = await supabase.from('publicaciones').update(cambios).eq('id', id).select().single()
    setImportando(false)
    if (error) { setMsgImportar({ ok: false, text: 'Error: ' + error.message }) }
    else {
      setPub(data)
      const imgs = Array.from({ length: 50 }, (_, i) => data['imagen' + (i+1)]).filter(Boolean)
      setImagenes(imgs)
      setMsgImportar({ ok: true, text: '✓ Datos del edificio importados. Revisa y ajusta lo que quieras, luego guarda.' })
      setTimeout(() => setMsgImportar(null), 5000)
    }
  }
  // ── Drag & Drop reordenamiento ──
  function onDragStart(e, idx) { dragIdx.current = idx; e.dataTransfer.effectAllowed = 'move' }
  function onDragOver(e, idx) { e.preventDefault(); dragOverIdx.current = idx }
  function onDrop(e, idx) {
    e.preventDefault()
    const from = dragIdx.current, to = dragOverIdx.current
    if (from === null || to === null || from === to) return
    const updated = [...imagenes]
    const [moved] = updated.splice(from, 1)
    updated.splice(to, 0, moved)
    setImagenes(updated)
    setImgSeleccionada(updated[0])
    dragIdx.current = null; dragOverIdx.current = null
  }
  function onDragEnd() { dragIdx.current = null; dragOverIdx.current = null }

  // ── Guardar orden en Supabase ──
  async function guardarOrden() {
    setGuardando(true); setMsgGuardado(null)
    const payload = {}
    for (let i = 0; i < 38; i++) payload[`imagen${i+1}`] = imagenes[i] || null
    const { error } = await supabase.from('publicaciones').update(payload).eq('id', id)
    setGuardando(false)
    if (error) {
      setMsgGuardado({ ok: false, text: 'Error: ' + error.message })
    } else {
      setMsgGuardado({ ok: true, text: '✓ Orden guardado' })
      setPub(prev => ({ ...prev, imagen1: imagenes[0] || null }))
      setTimeout(() => setMsgGuardado(null), 3000)
    }
  }

  // ── Subir imagen al FTP ──
async function subirImagen(file) {
    if (!file) return
    if (!file.type.includes('jpeg') && !file.type.includes('jpg') && !file.name.toLowerCase().endsWith('.jpg')) {
      setMsgSubida({ ok: false, text: 'Solo se admiten archivos JPG' }); return
    }
    if (file.size > 10 * 1024 * 1024) {
      setMsgSubida({ ok: false, text: 'El archivo supera los 10MB' }); return
    }
    setSubiendo(true)
    setMsgSubida({ ok: null, text: `Subiendo "${file.name}"...` })
    const formData = new FormData()
    formData.append('file', file)
    formData.append('publicacionId', pub.codigo || id)
    formData.append('slot', imagenes.length + 1)
    try {
      const res = await fetch('/api/upload-imagen', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.ok) {
        const nuevas = [...imagenes, data.nombreArchivo]
        setImagenes(nuevas)
        setImgSeleccionada(data.nombreArchivo)
        const payload = {}
        for (let i = 0; i < 38; i++) payload[`imagen${i+1}`] = nuevas[i] || null
        await supabase.from('publicaciones').update(payload).eq('id', id)
        setMsgSubida({ ok: true, text: `✓ "${data.nombreArchivo}" subida correctamente` })
        setTimeout(() => setMsgSubida(null), 4000)
      } else {
        setMsgSubida({ ok: false, text: data.error || 'Error al subir' })
      }
    } catch (e) {
      setMsgSubida({ ok: false, text: 'Error de conexión: ' + e.message })
    }
    setSubiendo(false)
  }

  // ── Eliminar imagen ──
  async function eliminarImagen(idx) {
    if (!window.confirm(`¿Eliminar la imagen ${idx+1}? Solo se elimina de Supabase, no del servidor.`)) return
    const nuevas = imagenes.filter((_, i) => i !== idx)
    setImagenes(nuevas)
    setImgSeleccionada(nuevas[0] || null)
    const payload = {}
    for (let i = 0; i < 38; i++) payload[`imagen${i+1}`] = nuevas[i] || null
    await supabase.from('publicaciones').update(payload).eq('id', id)
    setMsgGuardado({ ok: true, text: '✓ Imagen eliminada' })
    setTimeout(() => setMsgGuardado(null), 3000)
  }

  // ── Buscar propietario en contactos ──
  async function buscarPropietario(q) {
    setBusqProp(q)
    if (q.length < 2) { setContactosEncontrados([]); return }
    setBuscandoProp(true)
    const { data } = await supabase.from('contactos')
      .select('id, nombre, telefono, email')
      .ilike('nombre', `%${q}%`)
      .limit(8)
    setContactosEncontrados(data || [])
    setBuscandoProp(false)
  }

  async function seleccionarPropietario(contacto) {
    const { error } = await supabase.from('publicaciones').update({
      propietario: contacto.nombre,
      telefono: contacto.telefono || '',
      email: contacto.email || '',
    }).eq('id', id)
    if (!error) {
      setPub(prev => ({ ...prev, propietario: contacto.nombre, telefono: contacto.telefono || '', email: contacto.email || '' }))
      setBusqProp('')
      setContactosEncontrados([])
      alert(`✓ Propietario actualizado a ${contacto.nombre}`)
    }
  }

  async function crearYAsignarContacto() {
    if (!nuevoContacto.nombre.trim()) return alert('El nombre es obligatorio')
    const { data, error } = await supabase.from('contactos')
      .insert([nuevoContacto])
      .select().single()
    if (error) return alert('Error al crear contacto: ' + error.message)
    await seleccionarPropietario(data)
    setMostrarFormContacto(false)
    setNuevoContacto({ nombre:'', telefono:'', email:'' })
    alert('✓ Contacto creado y asignado')
  }

  // ── Actualizar descripción en PI ──
  async function actualizarDescripcionPI() {
    if (!pub.codigo_pi) return alert('No hay código PI — publica primero en Portal Inmobiliario')
    setDescripcionando(true)
    setMsgDescripcion(null)
    try {
      const res = await fetch('/api/publicar-pi/descripcion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicacionId: id, codigoPI: pub.codigo_pi }),
      })
      const data = await res.json()
      if (data.ok) {
        setMsgDescripcion({ ok: true, text: '✓ Descripción actualizada en Portal Inmobiliario' })
      } else {
        setMsgDescripcion({ ok: false, text: '✗ Error: ' + (data.error || 'Sin respuesta') })
      }
    } catch(e) {
      setMsgDescripcion({ ok: false, text: '✗ Error de conexión: ' + e.message })
    }
    setDescripcionando(false)
    setTimeout(() => setMsgDescripcion(null), 5000)
  }

  // ── Publicar en portal ──
  // -- Actualizar PI (precio, video, descripcion) --
  async function actualizarPI() {
    if (!pub.codigo_pi) return alert('No hay codigo PI -- publica primero en Portal Inmobiliario')
    setActualizandoPI(true)
    setMsgActualizarPI(null)
    try {
      const res = await fetch('/api/actualizar-pi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicacionId: id }),
      })
      const data = await res.json()
      if (data.ok) {
        setMsgActualizarPI({ ok: true, text: data.mensaje || 'Actualizado en Portal Inmobiliario' })
        if (data.avisoFotos) alert(data.avisoFotos)
      } else if (data.necesitaRepublicar) {
        setActualizandoPI(false)
        if (window.confirm(data.mensaje + ' Republicar ahora con un codigo nuevo?')) {
          const resRep = await fetch('/api/publicaciones/republicar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sourceId: id }),
          })
          const dataRep = await resRep.json()
          if (dataRep.ok && dataRep.id) {
            window.location.href = '/publicaciones/' + dataRep.id
          } else {
            setMsgActualizarPI({ ok: false, text: dataRep.error || 'Error al republicar' })
          }
        }
        return
      } else {
        setMsgActualizarPI({ ok: false, text: (data.error || 'Error al actualizar') })
      }
    } catch (e) {
      setMsgActualizarPI({ ok: false, text: 'Error de conexion: ' + e.message })
    }
    setActualizandoPI(false)
    setTimeout(() => setMsgActualizarPI(null), 8000)
  }

  async function publicarEnPortal(apiKey) {
    setPublicando(prev => ({ ...prev, [apiKey]: true }))
    setMsgPublicacion(null)
    try {
      const res = await fetch(`/api/publicar-${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicacionId: id }),
      })
      const data = await res.json()
      if (data.ok) {
        setMsgPublicacion({ ok: true, text: data.mensaje })
        setPub(prev => ({ ...prev, [apiKey]: 'SI' }))
        setTimeout(() => setMsgPublicacion(null), 5000)
      } else {
        setMsgPublicacion({ ok: false, text: data.error || 'Error al publicar' })
      }
    } catch (e) {
      setMsgPublicacion({ ok: false, text: 'Error de conexión: ' + e.message })
    }
    setPublicando(prev => ({ ...prev, [apiKey]: false }))
  }

  if (loading) return <div style={{ minHeight:'100vh', background:'var(--background)' }}><TopNav /><div style={{ padding:60, textAlign:'center', fontSize:13, color:'var(--gray-400)' }}>Cargando ficha...</div></div>
  if (!pub) return <div style={{ minHeight:'100vh', background:'var(--background)' }}><TopNav /><div style={{ padding:60, textAlign:'center', fontSize:13, color:'var(--gray-400)' }}>Propiedad no encontrada.</div></div>

  const portalesActivos = PORTALES.filter(p => pub[p.key] === 'SI')
  const num = Number(pub.valor)
  const esUF = pub.tipo_moneda === 'UF'
  const precioLabel = esUF ? `UF ${num.toLocaleString('es-CL')}` : `$${num.toLocaleString('es-CL')}`
  const precioSecundario = valorUF ? (esUF ? `$${Math.round(num*valorUF).toLocaleString('es-CL')}` : `UF ${(num/valorUF).toFixed(2)}`) : null
  const esVenta = (pub.objetivo||'').toLowerCase().includes('venta')

  return (
    <div style={{ minHeight:'100vh', background:'var(--background)' }}>
      <TopNav />

      {/* Breadcrumb */}
      <div style={{ padding:'8px 24px', background:'var(--surface)', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8, fontSize:11 }}>
        <span style={{ color:'var(--gray-400)', cursor:'pointer' }} onClick={() => router.push('/publicaciones')}>← Publicaciones</span>
        <span style={{ color:'var(--gray-300)' }}>›</span>
        <span style={{ color:'var(--gray-600)' }}>Ficha</span>
        <span style={{ color:'var(--gray-300)' }}>›</span>
        <span style={{ color:'#1a56db', fontWeight:600 }}>Cód. {pub.codigo}</span>
        <span style={{ marginLeft:'auto', fontSize:11, color:'#16a34a' }}>{valorUF && `UF hoy: $${valorUF.toLocaleString('es-CL')}`}</span>
      </div>

      <div style={{ display:'flex', minHeight:'calc(100vh - 100px)' }}>

        {/* Panel izquierdo */}
        <div style={{ width:180, flexShrink:0, background:'var(--surface)', borderRight:'1px solid var(--border)', padding:'16px 0' }}>
          <div style={{ padding:'0 12px 12px' }}>
            {imagenes[0] ? (
              <img src={IMG_BASE+imagenes[0]} alt={pub.direccion} style={{ width:'100%', height:100, objectFit:'cover', borderRadius:8 }} onError={e => e.target.style.display='none'} />
            ) : (
              <div style={{ width:'100%', height:100, background:'var(--gray-100)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="var(--gray-300)" strokeWidth="1.5"/></svg>
              </div>
            )}
          </div>
          <div style={{ padding:'0 12px 12px', borderBottom:'1px solid var(--border)' }}>
            <div style={{ fontSize:10, color:'#1a56db', fontWeight:700, marginBottom:2 }}>Cód. {pub.codigo}</div>
            <div style={{ fontSize:12, fontWeight:600, color:'var(--gray-800)', marginBottom:6 }}>{pub.tipo||'—'}</div>
            <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:4 }}>
              <span style={{ fontSize:10, padding:'2px 7px', borderRadius:8, fontWeight:500, background:esVenta?'#EAF3DE':'#E6F1FB', color:esVenta?'#3B6D11':'#1a56db' }}>{pub.objetivo||'—'}</span>
              {pub.activo && <span style={{ fontSize:10, padding:'2px 7px', borderRadius:8, fontWeight:500, background:'#f3f4f6', color:'#6b7280' }}>{pub.activo}</span>}
            </div>
            <div style={{ fontSize:11, color:'var(--gray-500)' }}>{pub.comuna||''}</div>
          </div>
          <div style={{ padding:'8px 0' }}>
            {MENU.map(m => (
              <button key={m} onClick={() => setSeccion(m)} style={{
                display:'block', width:'100%', textAlign:'left', padding:'7px 16px', border:'none', fontSize:12,
                background:seccion===m?'#eff6ff':'transparent', color:seccion===m?'#1a56db':'var(--gray-600)',
                fontWeight:seccion===m?500:400, cursor:'pointer', fontFamily:'inherit',
                borderLeft:seccion===m?'3px solid #1a56db':'3px solid transparent',
              }}>{m}</button>
            ))}
          </div>
        </div>

        {/* Contenido principal */}
        <div style={{ flex:1, padding:'24px 32px', overflowY:'auto' }}>

          {/* Cabecera ficha */}
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, padding:'16px 20px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12 }}>
            <div>
              <div style={{ fontSize:10, color:'#1a56db', fontWeight:700, marginBottom:4 }}>FICHA DE PROPIEDAD · Cód. {pub.codigo} · {pub.tipo} · {pub.objetivo} · {pub.comuna}</div>
              <h1 style={{ fontSize:22, fontWeight:700, color:'#1a56db', margin:'0 0 8px' }}>{pub.tipo}, {pub.comuna}</h1>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {portalesActivos.map(p => <span key={p.key} style={{ fontSize:10, padding:'2px 8px', borderRadius:6, fontWeight:600, background:p.bg, color:p.color }}>{p.label}</span>)}
              </div>
            </div>
            <div style={{ textAlign:'right', flexShrink:0, marginLeft:20 }}>
              <span style={{ fontSize:11, color:'var(--gray-500)', marginRight:8 }}>{pub.objetivo}</span>
              <span style={{ fontSize:18, fontWeight:700, color:'#fff', background:'#1a56db', padding:'4px 14px', borderRadius:8 }}>{precioLabel}</span>
              {precioSecundario && <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:4 }}>{precioSecundario}</div>}
            </div>
          </div>

          {/* RESUMEN */}
          {seccion === 'Resumen' && (
            <>
              <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 20px', marginBottom:16 }}>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:10 }}>Ubicación</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  {[['Dirección',pub.direccion||pub.direccionreal||'—'],['Comuna',pub.comuna||'—'],['Región',pub.region||'—'],['Número',pub.numero||'—']].map(([l,v]) => (
                    <div key={l}><div style={{ fontSize:10, color:'var(--gray-400)', marginBottom:2 }}>{l}</div><div style={{ fontSize:12, color:'var(--gray-800)', fontWeight:500 }}>{v}</div></div>
                  ))}
                </div>
              </div>
              <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 20px', marginBottom:16 }}>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:10 }}>Características</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
                  {[['Dormitorios',pub.dormitorios||'—'],['Baños',pub.banos||'—'],['Sup. construida',pub.mt2_const?`${pub.mt2_const} m²`:'—'],['Sup. terreno',pub.mt2_terreno?`${pub.mt2_terreno} m²`:'—'],['Estacionamientos',pub.estacionamientos||'—'],['Bodegas',pub.bodegas||'—'],['Orientación',pub.orientacion||'—'],['Amoblado',pub.amoblado||'—'],['GG.CC.',pub.ggcc?`$${Number(pub.ggcc).toLocaleString('es-CL')}`:'—'],['Proporcional',pub.proporcional||'—']].map(([l,v]) => (
                    <div key={l} style={{ padding:'10px 14px', background:'var(--gray-50)', borderRadius:8 }}>
                      <div style={{ fontSize:10, color:'var(--gray-400)', marginBottom:3 }}>{l}</div>
                      <div style={{ fontSize:13, fontWeight:600, color:'var(--gray-800)' }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
              {pub.observaciones && (
                <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 20px', marginBottom:16 }}>
                  <div style={{ fontSize:11, fontWeight:600, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:10 }}>Descripción</div>
                  <p style={{ fontSize:13, color:'var(--gray-700)', lineHeight:1.6, margin:0, whiteSpace:'pre-line' }}>{pub.observaciones}</p>
                </div>
              )}
              {(pub.url_pi || pub.url_web || pub.url_yapo || pub.url_goplaceit || pub.url_proppit) && (
                <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 20px', marginBottom:16 }}>
                  <div style={{ fontSize:11, fontWeight:600, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:10 }}>Enlaces a los avisos</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {[
                      { label:'Portal Inmobiliario', url:pub.url_pi,        color:'#1a56db' },
                      { label:'Web',                 url:pub.url_web,       color:'#0891b2' },
                      { label:'Yapo',                url:pub.url_yapo,      color:'#854F0B' },
                      { label:'GoPlaceIt',           url:pub.url_goplaceit, color:'#3B6D11' },
                      { label:'Proppit',             url:pub.url_proppit,   color:'#7C3AED' },
                    ].filter(e => e.url).map(e => (
                      <div key={e.label} style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <span style={{ fontSize:12, fontWeight:600, color:e.color, minWidth:130 }}>{e.label}</span>
                        <a href={e.url} target="_blank" rel="noopener noreferrer" style={{ fontSize:12, color:'var(--gray-600)', textDecoration:'none', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.url}</a>
                        <button onClick={() => { navigator.clipboard.writeText(e.url); alert('Enlace copiado'); }} style={{ fontSize:11, fontWeight:600, color:e.color, background:'transparent', border:'1px solid '+e.color, borderRadius:6, padding:'3px 10px', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>Copiar</button>
                        <a href={e.url} target="_blank" rel="noopener noreferrer" style={{ fontSize:11, fontWeight:600, color:'#fff', background:e.color, borderRadius:6, padding:'4px 10px', textDecoration:'none', whiteSpace:'nowrap' }}>Abrir</a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
             {edificio && (
                <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 20px', marginBottom:16 }}>
                  <div style={{ fontSize:11, fontWeight:600, color:'#7c3aed', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:10 }}>Edificio asociado</div>
                  <div style={{ fontSize:14, fontWeight:600, color:'var(--gray-700)', marginBottom:8 }}>
                    {edificio.calle} {edificio.numero_calle}
                    {edificio.codigo_edi && <span style={{ fontSize:11, fontWeight:400, color:'var(--gray-400)', marginLeft:8 }}>({edificio.codigo_edi})</span>}
                  </div>
                  {(() => {
                    const amenities = [
                      ['tiene_ascensor','Ascensor'],['tiene_piscina','Piscina'],['tiene_gimnasio','Gimnasio'],
                      ['tiene_salon_fiestas','Salon de fiestas'],['tiene_sala_multiuso','Sala multiuso'],
                      ['tiene_quincho_parrilla','Quincho'],['tiene_juegos_infantiles','Juegos infantiles'],
                      ['tiene_sauna','Sauna'],['tiene_jacuzzi','Jacuzzi'],['tiene_cowork','Cowork'],
                      ['tiene_cine','Cine'],['tiene_playroom','Playroom'],['tiene_recepcion','Recepcion'],
                      ['tiene_lavanderia','Lavanderia'],['tiene_estacionamiento_visitas','Estac. visitas'],
                      ['tiene_cancha_paddle','Paddle'],['tiene_cancha_tenis','Tenis'],['tiene_cancha_multiuso','Cancha multiuso'],
                      ['tiene_area_verde','Area verde'],['tiene_azotea','Azotea'],['tiene_generador','Generador'],
                      ['tiene_rampa_silla','Rampa'],
                    ].filter(([k]) => edificio[k] === true)
                    let nfotos = 0
                    for (let i=1;i<=15;i++) if (edificio['foto_comun_'+i]) nfotos++
                    return (
                      <>
                        {amenities.length > 0 && (
                          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:10 }}>
                            {amenities.map(([k,label]) => (
                              <span key={k} style={{ fontSize:11, background:'#f3e8ff', color:'#7c3aed', borderRadius:6, padding:'3px 8px' }}>{label}</span>
                            ))}
                          </div>
                        )}
                        <div style={{ display:'flex', gap:16, fontSize:12, color:'var(--gray-500)', marginBottom:8 }}>
                          {nfotos > 0 && <span>{nfotos} fotos de espacios comunes</span>}
                          {edificio.administrador && <span>Admin: {edificio.administrador}</span>}
                          {edificio.tel_conserjeria && <span>Conserjeria: {edificio.tel_conserjeria}</span>}
                        </div>
                        {edificio.complemento_descripcion && (
                          <div style={{ fontSize:12, color:'var(--gray-600)', lineHeight:1.5, borderLeft:'3px solid #e9d5ff', paddingLeft:10 }}>{edificio.complemento_descripcion}</div>
                        )}
 <button onClick={importarEdificio} disabled={importando} style={{ marginTop:10, marginRight:8, fontSize:11, color:'#fff', background:'#7c3aed', border:'1px solid #7c3aed', borderRadius:6, padding:'5px 12px', cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>{importando ? 'Importando…' : 'Importar datos del edificio'}</button>
                        <button onClick={() => window.open('/edificios','_blank')} style={{ marginTop:10, fontSize:11, color:'#7c3aed', background:'transparent', border:'1px solid #7c3aed', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontFamily:'inherit' }}>Ver / editar edificio</button>
                        {msgImportar && <div style={{ marginTop:8, fontSize:12, color: msgImportar.ok ? '#166534' : '#991b1b' }}>{msgImportar.text}</div>}
                      </>
                    )
                  })()}
                </div>
              )} {imagenes.length > 0 && (
                <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 20px' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                    <div style={{ fontSize:11, fontWeight:600, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'0.05em' }}>{imagenes.length} imágenes</div>
                    <button onClick={() => setSeccion('Imágenes')} style={{ fontSize:11, color:'#1a56db', background:'transparent', border:'none', cursor:'pointer', fontFamily:'inherit' }}>Ver todas →</button>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px,1fr))', gap:8 }}>
                    {imagenes.slice(0,6).map((img,i) => (
                      <img key={i} src={IMG_BASE+img} alt={`Imagen ${i+1}`}
                        onClick={() => { setSeccion('Imágenes'); setImgSeleccionada(img) }}
                        style={{ width:'100%', height:100, objectFit:'cover', borderRadius:8, cursor:'pointer' }}
                        onError={e => e.target.style.display='none'}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* IMÁGENES */}
          {seccion === 'Imágenes' && (
            <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 20px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:10 }}>
                <div>
                  <div style={{ fontSize:11, fontWeight:600, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'0.05em' }}>{imagenes.length} imágenes</div>
                  <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:3 }}>Arrastra para reordenar · La primera imagen (★) es la portada del listado</div>
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                  {msgSubida && (
                    <span style={{ fontSize:11, fontWeight:500, padding:'4px 10px', borderRadius:6, background:msgSubida.ok===true?'#f0fdf4':msgSubida.ok===false?'#fef2f2':'#eff6ff', color:msgSubida.ok===true?'#16a34a':msgSubida.ok===false?'#dc2626':'#1a56db' }}>
                      {msgSubida.text}
                    </span>
                  )}
                  {msgGuardado && <span style={{ fontSize:11, fontWeight:500, color:msgGuardado.ok?'#16a34a':'#dc2626' }}>{msgGuardado.text}</span>}
                  <input ref={fileInputRef} type="file" accept=".jpg,.jpeg" style={{ display:'none' }}
                    onChange={e => { if (e.target.files[0]) subirImagen(e.target.files[0]); e.target.value='' }}
                  />
                  <button onClick={() => fileInputRef.current?.click()} disabled={subiendo} style={{ padding:'7px 16px', borderRadius:8, border:'none', background:subiendo?'#9ca3af':'#d97706', color:'#fff', fontSize:12, fontWeight:600, cursor:subiendo?'not-allowed':'pointer', fontFamily:'inherit' }}>
                    {subiendo ? 'Subiendo...' : '📤 Subir imagen'}
                  </button>
                  <button onClick={guardarOrden} disabled={guardando} style={{ padding:'7px 16px', borderRadius:8, border:'none', background:guardando?'#9ca3af':'#16a34a', color:'#fff', fontSize:12, fontWeight:600, cursor:guardando?'not-allowed':'pointer', fontFamily:'inherit' }}>
                    {guardando ? 'Guardando...' : '💾 Guardar orden'}
                  </button>
                </div>
              </div>
              <div onDragOver={e => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); const file = e.dataTransfer.files[0]; if (file) subirImagen(file) }}
                onClick={() => fileInputRef.current?.click()}
                style={{ border:`2px dashed ${dragOver?'#1a56db':'var(--border)'}`, borderRadius:10, padding:'16px', textAlign:'center', marginBottom:16, background:dragOver?'#eff6ff':'var(--gray-50)', cursor:'pointer', transition:'all 0.15s' }}
              >
                <div style={{ fontSize:12, color:'var(--gray-400)' }}>{dragOver ? '📥 Suelta aquí para subir' : '📁 Arrastra un JPG aquí o haz clic para seleccionar'}</div>
                <div style={{ fontSize:10, color:'var(--gray-300)', marginTop:4 }}>Máximo 10MB · Solo JPG</div>
              </div>
              {imgSeleccionada && (
                <div style={{ marginBottom:16, position:'relative' }}>
                  <img src={IMG_BASE+imgSeleccionada} alt="Seleccionada" style={{ width:'100%', maxHeight:380, objectFit:'contain', borderRadius:10, background:'var(--gray-50)' }} onError={e => e.target.style.display='none'} />
                  {imagenes[0]===imgSeleccionada && <span style={{ position:'absolute', top:10, left:10, fontSize:11, padding:'3px 10px', borderRadius:8, fontWeight:600, background:'#16a34a', color:'#fff' }}>★ Portada</span>}
                </div>
              )}
              {imagenes.length === 0 ? (
                <div style={{ textAlign:'center', padding:40, color:'var(--gray-400)', fontSize:12 }}>No hay imágenes — sube la primera usando el botón de arriba</div>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(130px,1fr))', gap:8 }}>
                  {imagenes.map((img, i) => (
                    <div key={i} draggable onDragStart={e => onDragStart(e, i)} onDragOver={e => onDragOver(e, i)} onDrop={e => onDrop(e, i)} onDragEnd={onDragEnd} onClick={() => setImgSeleccionada(img)}
                      style={{ cursor:'grab', borderRadius:8, overflow:'hidden', position:'relative', border:imgSeleccionada===img?'2px solid #1a56db':'2px solid transparent', transition:'border-color 0.15s' }}
                    >
                      <img src={IMG_BASE+img} alt={`Imagen ${i+1}`} style={{ width:'100%', height:90, objectFit:'cover', display:'block', pointerEvents:'none' }} onError={e => e.target.parentElement.style.display='none'} />
                      <span style={{ position:'absolute', top:4, left:4, fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:5, background:i===0?'#16a34a':'rgba(0,0,0,0.5)', color:'#fff' }}>{i===0?'★':i+1}</span>
                      <button onClick={e => { e.stopPropagation(); eliminarImagen(i) }} style={{ position:'absolute', top:4, right:4, width:20, height:20, borderRadius:'50%', border:'none', background:'rgba(220,38,38,0.8)', color:'#fff', fontSize:12, lineHeight:'20px', textAlign:'center', cursor:'pointer', padding:0 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* PROPIETARIO */}
          {seccion === 'Propietario' && (
            <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 20px' }}>
              <div style={{ fontSize:11, fontWeight:600, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:12 }}>Datos del propietario</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
                {[['Propietario',pub.propietario||'—'],['Teléfono',pub.telefono||'—'],['Email',pub.email||'—'],['Captador',pub.vendedor||'—'],['IDADMON',pub.idadmon||'—']].map(([l,v]) => (
                  <div key={l}><div style={{ fontSize:10, color:'var(--gray-400)', marginBottom:2 }}>{l}</div><div style={{ fontSize:12, color:'var(--gray-800)', fontWeight:500 }}>{v}</div></div>
                ))}
              </div>

              {/* Buscador de propietario */}
              <div style={{ borderTop:'1px solid var(--border)', paddingTop:16, marginBottom:12 }}>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--gray-500)', textTransform:'uppercase', letterSpacing:.5, marginBottom:8 }}>Cambiar propietario</div>
                <div style={{ position:'relative' }}>
                  <input
                    type="text" value={busqProp} onChange={e => buscarPropietario(e.target.value)}
                    placeholder="Buscar por nombre..."
                    style={{ width:'100%', padding:'8px 10px', borderRadius:7, border:'1px solid var(--border)', fontSize:13, boxSizing:'border-box', fontFamily:'inherit' }}
                  />
                  {buscandoProp && <div style={{ position:'absolute', right:10, top:9, fontSize:11, color:'var(--gray-400)' }}>Buscando...</div>}
                  {contactosEncontrados.length > 0 && (
                    <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'#fff', border:'1px solid var(--border)', borderRadius:8, boxShadow:'0 4px 16px rgba(0,0,0,0.1)', zIndex:100, maxHeight:200, overflowY:'auto' }}>
                      {contactosEncontrados.map(c => (
                        <div key={c.id} onClick={() => seleccionarPropietario(c)}
                          style={{ padding:'8px 12px', cursor:'pointer', fontSize:12, borderBottom:'1px solid var(--border-subtle)' }}
                          onMouseEnter={e => e.currentTarget.style.background='#f3f4f6'}
                          onMouseLeave={e => e.currentTarget.style.background='transparent'}
                        >
                          <div style={{ fontWeight:500 }}>{c.nombre}</div>
                          <div style={{ fontSize:11, color:'var(--gray-400)' }}>{c.email} {c.telefono ? `· ${c.telefono}` : ''}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Crear contacto nuevo */}
              <button onClick={() => setMostrarFormContacto(v => !v)} style={{
                padding:'6px 14px', borderRadius:7, border:'1px solid #16a34a', background:'#f0fdf4',
                color:'#16a34a', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', marginBottom: mostrarFormContacto ? 12 : 0
              }}>
                {mostrarFormContacto ? '✕ Cancelar' : '+ Crear contacto nuevo'}
              </button>

              {mostrarFormContacto && (
                <div style={{ border:'1px solid var(--border)', borderRadius:8, padding:16, background:'var(--gray-50)' }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                    {[['Nombre *','nombre'],['Teléfono','telefono'],['Email','email']].map(([label, key]) => (
                      <div key={key} style={{ gridColumn: key==='nombre' ? '1/-1' : 'auto' }}>
                        <label style={{ fontSize:11, fontWeight:600, color:'var(--gray-500)', textTransform:'uppercase', display:'block', marginBottom:4 }}>{label}</label>
                        <input type="text" value={nuevoContacto[key]} onChange={e => setNuevoContacto(p => ({...p, [key]: e.target.value}))}
                          style={{ width:'100%', padding:'7px 10px', borderRadius:6, border:'1px solid var(--border)', fontSize:12, boxSizing:'border-box', fontFamily:'inherit' }} />
                      </div>
                    ))}
                  </div>
                  <button onClick={crearYAsignarContacto} style={{
                    padding:'7px 18px', borderRadius:7, border:'none', background:'#16a34a', color:'#fff',
                    fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit'
                  }}>💾 Crear y asignar</button>
                </div>
              )}
            </div>
          )}

          {/* PUBLICACIÓN */}
          {seccion === 'Publicación' && (
            <div>
              {/* Mensaje resultado */}
              {msgPublicacion && (
                <div style={{ marginBottom:16, padding:'10px 16px', borderRadius:8, background:msgPublicacion.ok?'#f0fdf4':'#fef2f2', color:msgPublicacion.ok?'#16a34a':'#dc2626', border:`1px solid ${msgPublicacion.ok?'#86efac':'#fca5a5'}`, fontSize:12, fontWeight:500 }}>
                  {msgPublicacion.text}
                </div>
              )}

              {/* Mensaje descripción PI */}
              {msgDescripcion && (
                <div style={{ marginBottom:16, padding:'10px 16px', borderRadius:8, background:msgDescripcion.ok?'#f0fdf4':'#fef2f2', color:msgDescripcion.ok?'#16a34a':'#dc2626', border:`1px solid ${msgDescripcion.ok?'#86efac':'#fca5a5'}`, fontSize:12, fontWeight:500 }}>
                  {msgDescripcion.text}
                </div>
              )}
              {msgActualizarPI && (
                <div style={{ marginBottom:16, padding:'10px 16px', borderRadius:8, background:msgActualizarPI.ok?'#f0fdf4':'#fef2f2', color:msgActualizarPI.ok?'#16a34a':'#dc2626', border:`1px solid ${msgActualizarPI.ok?'#86efac':'#fca5a5'}`, fontSize:12, fontWeight:500 }}>
                  {msgActualizarPI.text}
                </div>
              )}

              {/* Grid de portales */}
              <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 20px', marginBottom:16 }}>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:14 }}>
                  Estado y publicación en portales
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16 }}>
                  {PORTALES.map(portal => {
                    const activo = pub[portal.key] === 'SI'
                    const cargando = publicando[portal.key]
                    const disponible = !!portal.apiKey
                    return (
                      <div key={portal.key} style={{ padding:'14px 16px', borderRadius:10, background:activo?portal.bg:'var(--gray-50)', border:`1px solid ${activo?portal.color+'40':'var(--border)'}` }}>
                        <div style={{ fontSize:12, fontWeight:600, color:activo?portal.color:'var(--gray-500)', marginBottom:4 }}>{portal.label}</div>
                        <div style={{ fontSize:11, color:activo?portal.color:'var(--gray-400)', fontWeight:500, marginBottom:10 }}>
                          {activo ? '✓ Publicado' : '— No publicado'}
                        </div>
                        {disponible ? (
                          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                            <button onClick={() => (portal.key === 'pi' && activo) ? actualizarPI() : publicarEnPortal(portal.apiKey)} disabled={cargando || (portal.key === 'pi' && actualizandoPI)} style={{
                              width:'100%', padding:'6px 0', borderRadius:7, border:'none',
                              background:cargando?'#9ca3af':portal.color, color:'#fff',
                              fontSize:11, fontWeight:600, cursor:cargando?'not-allowed':'pointer', fontFamily:'inherit',
                            }}>
                              {cargando ? '⏳ Publicando...' : actualizandoPI && portal.key === 'pi' ? '⏳ Actualizando...' : portal.key === 'web' ? '📤 Publicar' : (portal.key === 'pi' && activo) ? '🔄 Actualizar PI' : activo ? '🔄 Actualizar feed' : '📤 Publicar'}
                            </button>
                           </div>
                        ) : (
                          <div style={{ fontSize:10, color:'var(--gray-400)', fontStyle:'italic' }}>{portal.nota}</div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Nota informativa */}
                <div style={{ padding:'10px 14px', borderRadius:8, background:'#fffbeb', border:'1px solid #fcd34d', fontSize:11, color:'#92400e' }}>
                  <strong>Nota:</strong> Al publicar en Web o Yapo se regenera el feed completo con todas las propiedades activas en ese portal y se sube automáticamente al servidor FTP.
                </div>
              </div>

              {/* Estado PI */}
              {pub.activo && (
                <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 20px' }}>
                  <div style={{ fontSize:11, fontWeight:600, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:10 }}>Estado en Portal Inmobiliario</div>
                  <span style={{ fontSize:12, padding:'3px 10px', borderRadius:8, fontWeight:500, background:pub.activo==='active'?'#EAF3DE':pub.activo==='CREAR'?'#E6F1FB':'#f3f4f6', color:pub.activo==='active'?'#3B6D11':pub.activo==='CREAR'?'#1a56db':'#6b7280' }}>
                    {pub.activo}
                  </span>
                </div>
              )}
            </div>
          )}

          {seccion === 'Editar' && pub && <SeccionEditar pub={pub} id={id} onGuardado={setPub} />}
              {!['Resumen','Imágenes','Propietario','Publicación','Editar'].includes(seccion) && (
            <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:40, textAlign:'center' }}>
              <div style={{ fontSize:13, color:'var(--gray-400)' }}>Sección <strong>{seccion}</strong> en desarrollo</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}