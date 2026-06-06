'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import TopNav from '../../components/ui/TopNav'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const IMG_BASE = 'https://fondocapital.com/propiedades/'

const PORTALES = [
  { key: 'pi',        label: 'Portal Inmobiliario', code: 'PI', bg: '#E6F1FB', color: '#1a56db', apiKey: 'pi',   nota: null },
  { key: 'yapo',      label: 'Yapo',                code: 'Ya', bg: '#FAEEDA', color: '#854F0B', apiKey: 'yapo', nota: null },
  { key: 'goplaceit', label: 'GoPlaceIt',            code: 'Go', bg: '#EAF3DE', color: '#3B6D11', apiKey: null,   nota: 'Pendiente' },
  { key: 'web',       label: 'Web',                  code: 'We', bg: '#E6F1FB', color: '#0891b2', apiKey: 'web',  nota: null },
  { key: 'proppit',   label: 'Proppit',              code: 'Pr', bg: '#F3E8FF', color: '#7C3AED', apiKey: null,   nota: 'Pendiente' },
]

const MENU = ['Resumen', 'Editar', 'Imágenes', 'Documentos', 'Estado', 'Bitácora', 'Propietario', 'Publicación']

const EJECUTIVOS = ['Alberto', 'Adalis', 'Tirza', 'Lorena', 'Pedro', 'Neika']
const TIPOS = ['DEPARTAMENTO', 'CASA', 'OFICINA', 'LOCAL', 'BODEGA', 'ESTACIONAMIENTO', 'PARCELA', 'TERRENO', 'INDUSTRIAL', 'SITIO', 'AGRICOLA']
const COMUNAS = ['LAS CONDES', 'PROVIDENCIA', 'VITACURA', 'ÑUÑOA', 'LA REINA', 'LO BARNECHEA', 'HUECHURABA', 'MACUL', 'SANTIAGO', 'COLINA', 'Independencia', 'Recoleta', 'Peñalolén', 'La Florida', 'Maipú', 'Puente Alto', 'San Miguel', 'San Bernardo', 'Quilicura', 'Estación Central', 'Pudahuel', 'Curarrehue', 'Pucón', 'Villarrica', 'Antofagasta', 'Puerto Varas', 'Valparaíso', 'Viña del Mar']

function MapaLeaflet({ lat, lng, onChange }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markerRef = useRef(null)

  useEffect(() => {
    if (typeof window === 'undefined' || mapInstanceRef.current) return
    const initMap = async () => {
      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')
      delete L.Icon.Default.prototype._getIconUrl
      L.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })
      const centerLat = lat && !isNaN(Number(lat)) ? Number(lat) : -33.4489
      const centerLng = lng && !isNaN(Number(lng)) ? Number(lng) : -70.6693
      const map = L.map(mapRef.current).setView([centerLat, centerLng], 15)
      mapInstanceRef.current = map
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' }).addTo(map)
      const marker = L.marker([centerLat, centerLng], { draggable: true }).addTo(map)
      markerRef.current = marker
      marker.on('dragend', () => { const pos = marker.getLatLng(); onChange(pos.lat.toFixed(6), pos.lng.toFixed(6)) })
      map.on('click', (e) => { marker.setLatLng(e.latlng); onChange(e.latlng.lat.toFixed(6), e.latlng.lng.toFixed(6)) })
    }
    initMap()
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        markerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!markerRef.current || !mapInstanceRef.current) return
    const newLat = lat && !isNaN(Number(lat)) ? Number(lat) : null
    const newLng = lng && !isNaN(Number(lng)) ? Number(lng) : null
    if (newLat && newLng) { markerRef.current.setLatLng([newLat, newLng]); mapInstanceRef.current.setView([newLat, newLng], mapInstanceRef.current.getZoom()) }
  }, [lat, lng])

  return <div ref={mapRef} style={{ width: '100%', height: 320, borderRadius: 10, overflow: 'hidden', zIndex: 0 }} />
}

function sinBr(txt) { return (txt||'').split(/<br\s*\/?>/i).join('\n'); }

export default function FichaPage() {
  const { id } = useParams()
  const router = useRouter()
  const [pub, setPub] = useState(null)
  const [loading, setLoading] = useState(true)
  const [valorUF, setValorUF] = useState(null)
  const [seccion, setSeccion] = useState('Resumen')
  const [imagenes, setImagenes] = useState([])
  const [imgSeleccionada, setImgSeleccionada] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [msgGuardado, setMsgGuardado] = useState(null)
  const [msgSubida, setMsgSubida] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [publicando, setPublicando] = useState({})
  const [msgPublicacion, setMsgPublicacion] = useState(null)
  const [form, setForm] = useState(null)
  const [guardandoEditar, setGuardandoEditar] = useState(false)
  const [msgEditar, setMsgEditar] = useState(null)
  const [actualizandoDesc, setActualizandoDesc] = useState(false)
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
          setForm({
            tipo: data.tipo || '', objetivo: data.objetivo || '',
            direccion: data.direccion || '', comuna: data.comuna || '',
            region: data.region || '', numero: data.numero || '',
            latitud: data.latitud || '', longitud: data.longitud || '',
            dormitorios: data.dormitorios || '', banos: data.banos || '',
            mt2_const: data.mt2_const || '', mt2_terreno: data.mt2_terreno || '',
            estacionamientos: data.estacionamientos || '', bodegas: data.bodegas || '',
            orientacion: data.orientacion || '', amoblado: data.amoblado || '',
            valor: data.valor || '', tipo_moneda: data.tipo_moneda || 'UF',
            ggcc: data.ggcc || '', vendedor: data.vendedor || '', captador: data.captador || '',
            observaciones: data.observaciones || '', video: data.video || '',
            ksuitable_for_pets: data.ksuitable_for_pets || '',
          })
        }
        setLoading(false)
      })
  }, [id])

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

  async function guardarOrden() {
    setGuardando(true); setMsgGuardado(null)
    const payload = {}
    for (let i = 0; i < 50; i++) payload[`imagen${i+1}`] = imagenes[i] || null
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
    try {
      const res = await fetch('/api/upload-imagen', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.ok) {
        const nuevas = [...imagenes, data.nombreArchivo]
        setImagenes(nuevas)
        setImgSeleccionada(data.nombreArchivo)
        const payload = {}
        for (let i = 0; i < 50; i++) payload[`imagen${i+1}`] = nuevas[i] || null
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

  async function eliminarImagen(idx) {
    if (!window.confirm(`¿Eliminar la imagen ${idx+1}? Solo se elimina de Supabase, no del servidor.`)) return
    const nuevas = imagenes.filter((_, i) => i !== idx)
    setImagenes(nuevas)
    setImgSeleccionada(nuevas[0] || null)
    const payload = {}
    for (let i = 0; i < 50; i++) payload[`imagen${i+1}`] = nuevas[i] || null
    await supabase.from('publicaciones').update(payload).eq('id', id)
    setMsgGuardado({ ok: true, text: '✓ Imagen eliminada' })
    setTimeout(() => setMsgGuardado(null), 3000)
  }

  async function toggleWeb() {
    const nuevoEstado = pub.web === 'SI' ? 'NO' : 'SI'
    setPublicando(prev => ({ ...prev, web: true }))
    setMsgPublicacion(null)
    const { error } = await supabase.from('publicaciones').update({ web: nuevoEstado, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) {
      setMsgPublicacion({ ok: false, text: 'Error: ' + error.message })
    } else {
      setPub(prev => ({ ...prev, web: nuevoEstado }))
      setMsgPublicacion({ ok: true, text: nuevoEstado === 'SI' ? '✓ Publicado en Web fondocapital.com' : '✓ Retirado de la Web' })
      setTimeout(() => setMsgPublicacion(null), 4000)
    }
    setPublicando(prev => ({ ...prev, web: false }))
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
        setPub(prev => ({ ...prev, [apiKey]: 'SI', ...(data.codigoPI ? { codigo_pi: data.codigoPI, activo: 'active', url_pi: data.permalink || prev.url_pi } : {}) }))
        setTimeout(() => setMsgPublicacion(null), 6000)
      } else {
        setMsgPublicacion({ ok: false, text: data.error || 'Error al publicar' })
      }
    } catch (e) {
      setMsgPublicacion({ ok: false, text: 'Error de conexión: ' + e.message })
    }
    setPublicando(prev => ({ ...prev, [apiKey]: false }))
  }

  async function guardarEditar() {
    setGuardandoEditar(true); setMsgEditar(null)
    const { error } = await supabase.from('publicaciones').update({
      tipo: form.tipo, objetivo: form.objetivo, direccion: form.direccion,
      comuna: form.comuna, region: form.region, numero: form.numero,
      latitud: form.latitud, longitud: form.longitud,
      dormitorios: form.dormitorios ? Number(form.dormitorios) : null,
      banos: form.banos ? Number(form.banos) : null,
      mt2_const: form.mt2_const ? Number(form.mt2_const) : null,
      mt2_terreno: form.mt2_terreno ? Number(form.mt2_terreno) : null,
      estacionamientos: form.estacionamientos ? Number(form.estacionamientos) : null,
      bodegas: form.bodegas ? Number(form.bodegas) : null,
      orientacion: form.orientacion, amoblado: form.amoblado,
      valor: form.valor ? Number(form.valor) : null, tipo_moneda: form.tipo_moneda,
      ggcc: form.ggcc ? Number(form.ggcc) : null, vendedor: form.vendedor, captador: form.captador,
      observaciones: form.observaciones, video: form.video,
      ksuitable_for_pets: form.ksuitable_for_pets,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    setGuardandoEditar(false)
    if (error) { setMsgEditar({ ok: false, text: 'Error: ' + error.message }) }
    else { setPub(prev => ({ ...prev, ...form })); setMsgEditar({ ok: true, text: '✓ Cambios guardados correctamente' }); setTimeout(() => setMsgEditar(null), 4000) }
  }

  async function actualizarDescripcionPI() {
    setActualizandoDesc(true); setMsgEditar(null)
    try {
      const res = await fetch('/api/actualizar-descripcion-pi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ publicacionId: id }) })
      const data = await res.json()
      setMsgEditar(data.ok ? { ok: true, text: data.mensaje } : { ok: false, text: data.error })
      setTimeout(() => setMsgEditar(null), 5000)
    } catch (e) { setMsgEditar({ ok: false, text: 'Error: ' + e.message }) }
    setActualizandoDesc(false)
  }

  async function cerrarEnPI() {
    setPublicando(prev => ({ ...prev, cerrar_pi: true }))
    setMsgPublicacion(null)
    try {
      const res = await fetch('/api/cerrar-pi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicacionId: id }),
      })
      const data = await res.json()
      if (data.ok) {
        setMsgPublicacion({ ok: true, text: data.mensaje })
        setPub(prev => ({ ...prev, pi: 'NO', activo: 'CLOSE' }))
        setTimeout(() => setMsgPublicacion(null), 5000)
      } else {
        setMsgPublicacion({ ok: false, text: data.error || 'Error al cerrar' })
      }
    } catch (e) {
      setMsgPublicacion({ ok: false, text: 'Error: ' + e.message })
    }
    setPublicando(prev => ({ ...prev, cerrar_pi: false }))
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

          {/* Cabecera */}
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
                  <p style={{ fontSize:13, color:'var(--gray-700)', lineHeight:1.6, margin:0, whiteSpace:'pre-line' }}>{sinBr(pub.observaciones)}</p>
                </div>
              )}
              {imagenes.length > 0 && (
                <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 20px' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                    <div style={{ fontSize:11, fontWeight:600, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'0.05em' }}>{imagenes.length} imágenes</div>
                    <button onClick={() => setSeccion('Imágenes')} style={{ fontSize:11, color:'#1a56db', background:'transparent', border:'none', cursor:'pointer', fontFamily:'inherit' }}>Ver todas →</button>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px,1fr))', gap:8 }}>
                    {imagenes.slice(0,6).map((img,i) => (
                      <img key={i} src={IMG_BASE+img} alt={`Imagen ${i+1}`} onClick={() => { setSeccion('Imágenes'); setImgSeleccionada(img) }} style={{ width:'100%', height:100, objectFit:'cover', borderRadius:8, cursor:'pointer' }} onError={e => e.target.style.display='none'} />
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
                  <div style={{ fontSize:11, color:'var(--gray-400)', marginTop:3 }}>Arrastra para reordenar · La primera imagen (★) es la portada</div>
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                  {msgSubida && <span style={{ fontSize:11, fontWeight:500, padding:'4px 10px', borderRadius:6, background:msgSubida.ok===true?'#f0fdf4':msgSubida.ok===false?'#fef2f2':'#eff6ff', color:msgSubida.ok===true?'#16a34a':msgSubida.ok===false?'#dc2626':'#1a56db' }}>{msgSubida.text}</span>}
                  {msgGuardado && <span style={{ fontSize:11, fontWeight:500, color:msgGuardado.ok?'#16a34a':'#dc2626' }}>{msgGuardado.text}</span>}
                  <input ref={fileInputRef} type="file" accept=".jpg,.jpeg" style={{ display:'none' }} onChange={e => { if (e.target.files[0]) subirImagen(e.target.files[0]); e.target.value='' }} />
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
                <div style={{ textAlign:'center', padding:40, color:'var(--gray-400)', fontSize:12 }}>No hay imágenes</div>
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
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {[['Propietario',pub.propietario||'—'],['Teléfono',pub.telefono||'—'],['Email',pub.email||'—'],['Dirección',pub.direccion||'—'],['Vendedor',pub.vendedor||'—'],['Captador',pub.captador||'—'],['IDADMON',pub.idadmon||'—']].map(([l,v]) => (
                  <div key={l}><div style={{ fontSize:10, color:'var(--gray-400)', marginBottom:2 }}>{l}</div><div style={{ fontSize:12, color:'var(--gray-800)', fontWeight:500 }}>{v}</div></div>
                ))}
              </div>
            </div>
          )}

          {/* PUBLICACIÓN */}
          {seccion === 'Publicación' && (
            <div>
              {msgPublicacion && (
                <div style={{ marginBottom:16, padding:'10px 16px', borderRadius:8, background:msgPublicacion.ok?'#f0fdf4':'#fef2f2', color:msgPublicacion.ok?'#16a34a':'#dc2626', border:`1px solid ${msgPublicacion.ok?'#86efac':'#fca5a5'}`, fontSize:12, fontWeight:500 }}>
                  {msgPublicacion.text}
                </div>
              )}

              <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 20px', marginBottom:16 }}>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:14 }}>
                  Estado y publicación en portales
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16 }}>
                  {PORTALES.map(portal => {
                    const activo = pub[portal.key] === 'SI'
                    const cargando = publicando[portal.key]

                    // Portal Inmobiliario — lógica especial con botón cerrar
                    if (portal.key === 'pi') {
                      const tieneCodigo = !!pub.codigo_pi
                      const cargandoCerrar = publicando['cerrar_pi']
                      return (
                        <div key="pi" style={{ padding:'14px 16px', borderRadius:10, background:activo?portal.bg:'var(--gray-50)', border:`1px solid ${activo?portal.color+'40':'var(--border)'}` }}>
                          <div style={{ fontSize:12, fontWeight:600, color:activo?portal.color:'var(--gray-500)', marginBottom:2 }}>{portal.label}</div>
                          {pub.codigo_pi && <div style={{ fontSize:10, color:'var(--gray-400)', marginBottom:4 }}>Código: {pub.codigo_pi}</div>}
                          {pub.url_pi && <a href={pub.url_pi} target="_blank" rel="noopener noreferrer" style={{ fontSize:10, color:'#1a56db', marginBottom:6, display:'block' }}>🔗 Ver en Portal Inmobiliario</a>}
                          <div style={{ fontSize:11, color:activo?portal.color:'var(--gray-400)', fontWeight:500, marginBottom:10 }}>
                            {activo ? '✓ Publicado' : pub.activo === 'CLOSE' ? '⏸ Cerrado' : '— No publicado'}
                          </div>
                          {!tieneCodigo ? (
                            <button onClick={() => publicarEnPortal('pi')} disabled={cargando} style={{ width:'100%', padding:'6px 0', borderRadius:7, border:'none', background:cargando?'#9ca3af':portal.color, color:'#fff', fontSize:11, fontWeight:600, cursor:cargando?'not-allowed':'pointer', fontFamily:'inherit' }}>
                              {cargando ? '⏳ Publicando...' : '📤 Publicar en PI'}
                            </button>
                          ) : (
                            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                              {activo && (
                                <button onClick={cerrarEnPI} disabled={cargandoCerrar} style={{ width:'100%', padding:'6px 0', borderRadius:7, border:'none', background:cargandoCerrar?'#9ca3af':'#dc2626', color:'#fff', fontSize:11, fontWeight:600, cursor:cargandoCerrar?'not-allowed':'pointer', fontFamily:'inherit' }}>
                                  {cargandoCerrar ? '⏳ Cerrando...' : '❌ Cerrar en PI'}
                                </button>
                              )}
                              {!activo && (
                                <button onClick={() => publicarEnPortal('pi')} disabled={cargando} style={{ width:'100%', padding:'6px 0', borderRadius:7, border:'none', background:cargando?'#9ca3af':portal.color, color:'#fff', fontSize:11, fontWeight:600, cursor:cargando?'not-allowed':'pointer', fontFamily:'inherit' }}>
                                  {cargando ? '⏳ Publicando...' : '📤 Republicar en PI'}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    }

                                        // Web — toggle directo
                    if (portal.key === 'web') {
                      return (
                        <div key='web' style={{ padding:'14px 16px', borderRadius:10, background:activo?portal.bg:'var(--gray-50)', border:1px solid \ }}>
                          <div style={{ fontSize:12, fontWeight:600, color:activo?portal.color:'var(--gray-500)', marginBottom:2 }}>{portal.label}</div>
                          <div style={{ fontSize:11, color:activo?portal.color:'var(--gray-400)', fontWeight:500, marginBottom:10 }}>
                            {activo ? '✓ Publicado en Web' : '— No publicado'}
                          </div>
                          <button onClick={toggleWeb} disabled={cargando} style={{ width:'100%', padding:'6px 0', borderRadius:7, border:'none', background:cargando?'#9ca3af':activo?'#dc2626':portal.color, color:'#fff', fontSize:11, fontWeight:600, cursor:cargando?'not-allowed':'pointer', fontFamily:'inherit' }}>
                            {cargando ? '⏳...' : activo ? '🔴 Retirar de Web' : '🌐 Publicar en Web'}
                          </button>
                        </div>
                      )
                    }
                    // Resto de portales
                    return (
                      <div key={portal.key} style={{ padding:'14px 16px', borderRadius:10, background:activo?portal.bg:'var(--gray-50)', border:`1px solid ${activo?portal.color+'40':'var(--border)'}` }}>
                        <div style={{ fontSize:12, fontWeight:600, color:activo?portal.color:'var(--gray-500)', marginBottom:4 }}>{portal.label}</div>
                        <div style={{ fontSize:11, color:activo?portal.color:'var(--gray-400)', fontWeight:500, marginBottom:10 }}>
                          {activo ? '✓ Publicado' : '— No publicado'}
                        </div>
                        {portal.apiKey ? (
                          <button onClick={() => publicarEnPortal(portal.apiKey)} disabled={cargando} style={{ width:'100%', padding:'6px 0', borderRadius:7, border:'none', background:cargando?'#9ca3af':portal.color, color:'#fff', fontSize:11, fontWeight:600, cursor:cargando?'not-allowed':'pointer', fontFamily:'inherit' }}>
                            {cargando ? '⏳ Publicando...' : activo ? '🔄 Actualizar feed' : '📤 Publicar'}
                          </button>
                        ) : (
                          <div style={{ fontSize:10, color:'var(--gray-400)', fontStyle:'italic' }}>{portal.nota}</div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div style={{ padding:'10px 14px', borderRadius:8, background:'#fffbeb', border:'1px solid #fcd34d', fontSize:11, color:'#92400e' }}>
                  <strong>Nota:</strong> Web y Yapo regeneran el feed completo. PI publica directamente en Portal Inmobiliario vía API de MercadoLibre.
                </div>
              </div>
            </div>
          )}

          {/* EDITAR */}
          {seccion === 'Editar' && form && (
            <div>
              {msgEditar && (
                <div style={{ marginBottom:16, padding:'10px 16px', borderRadius:8, background:msgEditar.ok?'#f0fdf4':'#fef2f2', color:msgEditar.ok?'#16a34a':'#dc2626', border:`1px solid ${msgEditar.ok?'#86efac':'#fca5a5'}`, fontSize:12, fontWeight:500 }}>
                  {msgEditar.text}
                </div>
              )}
              {/* Tipo y Operación */}
              <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 20px', marginBottom:14 }}>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:12 }}>Tipo y Operación</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                  {[['Tipo', 'tipo', TIPOS], ['Vendedor', 'vendedor', EJECUTIVOS], ['Captador', 'captador', EJECUTIVOS]].map(([label, field, opts]) => (
                    <div key={field}>
                      <div style={{ fontSize:10, color:'var(--gray-400)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>{label}</div>
                      <select value={form[field] || ''} onChange={e => setForm(prev => ({ ...prev, [field]: e.target.value }))} style={{ width:'100%', padding:'7px 10px', borderRadius:7, border:'1px solid var(--border)', background:'var(--gray-50)', fontSize:12, color:'var(--gray-800)', fontFamily:'inherit', cursor:'pointer' }}>
                        <option value="">— Seleccionar —</option>
                        {opts.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  ))}
                  <div>
                    <div style={{ fontSize:10, color:'var(--gray-400)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>Objetivo</div>
                    <select value={form.objetivo || ''} onChange={e => setForm(prev => ({ ...prev, objetivo: e.target.value }))} style={{ width:'100%', padding:'7px 10px', borderRadius:7, border:'1px solid var(--border)', background:'var(--gray-50)', fontSize:12, color:'var(--gray-800)', fontFamily:'inherit', cursor:'pointer' }}>
                      <option value="">— Seleccionar —</option>
                      <option value="Arriendo">Arriendo</option>
                      <option value="Venta">Venta</option>
                      <option value="Arriendo con opción a compra">Arriendo con opción a compra</option>
                    </select>
                  </div>
                </div>
              </div>
              {/* Precio */}
              <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 20px', marginBottom:14 }}>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:12 }}>Precio</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                  {[['Valor', 'valor'], ['GG.CC. (Pesos)', 'ggcc']].map(([label, field]) => (
                    <div key={field}>
                      <div style={{ fontSize:10, color:'var(--gray-400)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>{label}</div>
                      <input type="number" value={form[field] || ''} onChange={e => setForm(prev => ({ ...prev, [field]: e.target.value }))} style={{ width:'100%', padding:'7px 10px', borderRadius:7, border:'1px solid var(--border)', background:'var(--gray-50)', fontSize:12, color:'var(--gray-800)', fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} />
                    </div>
                  ))}
                  <div>
                    <div style={{ fontSize:10, color:'var(--gray-400)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>Moneda</div>
                    <select value={form.tipo_moneda || 'UF'} onChange={e => setForm(prev => ({ ...prev, tipo_moneda: e.target.value }))} style={{ width:'100%', padding:'7px 10px', borderRadius:7, border:'1px solid var(--border)', background:'var(--gray-50)', fontSize:12, color:'var(--gray-800)', fontFamily:'inherit', cursor:'pointer' }}>
                      <option value="UF">UF</option>
                      <option value="Pesos">Pesos</option>
                    </select>
                  </div>
                </div>
              </div>
              {/* Características */}
              <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 20px', marginBottom:14 }}>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:12 }}>Características</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
                  {[['Dormitorios','dormitorios'],['Baños','banos'],['M² construidos','mt2_const'],['M² terreno','mt2_terreno'],['Estacionamientos','estacionamientos'],['Bodegas','bodegas'],['Orientación','orientacion'],['Video YouTube','video']].map(([label, field]) => (
                    <div key={field}>
                      <div style={{ fontSize:10, color:'var(--gray-400)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>{label}</div>
                      <input type={['dormitorios','banos','mt2_const','mt2_terreno','estacionamientos','bodegas'].includes(field)?'number':'text'} value={form[field] || ''} onChange={e => setForm(prev => ({ ...prev, [field]: e.target.value }))} style={{ width:'100%', padding:'7px 10px', borderRadius:7, border:'1px solid var(--border)', background:'var(--gray-50)', fontSize:12, color:'var(--gray-800)', fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} />
                    </div>
                  ))}
                  {[['Amoblado','amoblado',['SI','NO']], ['Apto mascotas','ksuitable_for_pets',['Si','No']]].map(([label, field, opts]) => (
                    <div key={field}>
                      <div style={{ fontSize:10, color:'var(--gray-400)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>{label}</div>
                      <select value={form[field] || ''} onChange={e => setForm(prev => ({ ...prev, [field]: e.target.value }))} style={{ width:'100%', padding:'7px 10px', borderRadius:7, border:'1px solid var(--border)', background:'var(--gray-50)', fontSize:12, color:'var(--gray-800)', fontFamily:'inherit', cursor:'pointer' }}>
                        <option value="">—</option>
                        {opts.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
              {/* Ubicación + Mapa */}
              <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 20px', marginBottom:14 }}>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:12 }}>Ubicación</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                  {[['Dirección','direccion'],['Número / Depto','numero'],['Región','region']].map(([label, field]) => (
                    <div key={field}>
                      <div style={{ fontSize:10, color:'var(--gray-400)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>{label}</div>
                      <input type="text" value={form[field] || ''} onChange={e => setForm(prev => ({ ...prev, [field]: e.target.value }))} style={{ width:'100%', padding:'7px 10px', borderRadius:7, border:'1px solid var(--border)', background:'var(--gray-50)', fontSize:12, color:'var(--gray-800)', fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} />
                    </div>
                  ))}
                  <div>
                    <div style={{ fontSize:10, color:'var(--gray-400)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>Comuna</div>
                    <select value={form.comuna || ''} onChange={e => setForm(prev => ({ ...prev, comuna: e.target.value }))} style={{ width:'100%', padding:'7px 10px', borderRadius:7, border:'1px solid var(--border)', background:'var(--gray-50)', fontSize:12, color:'var(--gray-800)', fontFamily:'inherit', cursor:'pointer' }}>
                      <option value="">— Seleccionar —</option>
                      {COMUNAS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                  {[['Latitud','latitud'],['Longitud','longitud']].map(([label, field]) => (
                    <div key={field}>
                      <div style={{ fontSize:10, color:'var(--gray-400)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>{label}</div>
                      <input type="number" step="0.000001" value={form[field] || ''} onChange={e => setForm(prev => ({ ...prev, [field]: e.target.value }))} style={{ width:'100%', padding:'7px 10px', borderRadius:7, border:'1px solid var(--border)', background:'var(--gray-50)', fontSize:12, color:'var(--gray-800)', fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} />
                    </div>
                  ))}
                </div>
                <div style={{ fontSize:11, color:'var(--gray-400)', marginBottom:8 }}>Arrastra el pin o haz clic en el mapa para ajustar la ubicación exacta</div>
                <MapaLeaflet lat={form.latitud} lng={form.longitud} onChange={(lat, lng) => setForm(prev => ({ ...prev, latitud: lat, longitud: lng }))} />
              </div>
              {/* Descripción */}
              <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 20px', marginBottom:14 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                  <div style={{ fontSize:11, fontWeight:600, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Descripción</div>
                  {pub.codigo_pi && (
                    <button onClick={actualizarDescripcionPI} disabled={actualizandoDesc} style={{ padding:'6px 14px', borderRadius:7, border:'none', background:actualizandoDesc?'#9ca3af':'#1a56db', color:'#fff', fontSize:11, fontWeight:600, cursor:actualizandoDesc?'not-allowed':'pointer', fontFamily:'inherit' }}>
                      {actualizandoDesc ? '⏳ Actualizando...' : '📤 Actualizar descripción en PI'}
                    </button>
                  )}
                </div>
                <textarea value={form.observaciones || ''} onChange={e => setForm(prev => ({ ...prev, observaciones: e.target.value }))} rows={8} style={{ width:'100%', padding:'10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--gray-50)', fontSize:12, color:'var(--gray-800)', fontFamily:'inherit', outline:'none', resize:'vertical', boxSizing:'border-box', lineHeight:1.6 }} placeholder="Descripción de la propiedad..." />
                {!pub.codigo_pi && <div style={{ fontSize:10, color:'var(--gray-400)', marginTop:4, fontStyle:'italic' }}>El botón "Actualizar descripción en PI" aparece cuando la propiedad está publicada en Portal Inmobiliario</div>}
              </div>
              {/* Atributos PI */}
              <div style={{ background:'var(--surface)', border:'1px solid #BFDBFE', borderRadius:12, padding:'16px 20px', marginBottom:14 }}>
                <div style={{ fontSize:11, fontWeight:600, color:'#1D4ED8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>Atributos Portal Inmobiliario</div>
                <div style={{ fontSize:11, color:'#6B7280', marginBottom:12 }}>Estos campos mejoran el score de calidad en PI (Estándar → Profesional)</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:14 }}>
                  {[['Piso unidad','unit_floor','number'],['Antigüedad (años)','property_age','number'],['Pisos edificio','floors','number'],['Deptos por piso','apartments_per_floor','number'],['Nº departamento','apartment_number','text'],['ROL inmueble','property_registration_code','text']].map(([label, field, type]) => (
                    <div key={field}>
                      <div style={{ fontSize:10, color:'var(--gray-400)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>{label}</div>
                      <input type={type} value={form[field] || ''} onChange={e => setForm(prev => ({ ...prev, [field]: e.target.value }))} style={{ width:'100%', padding:'7px 10px', borderRadius:7, border:'1px solid #BFDBFE', background:'#EFF6FF', fontSize:12, color:'var(--gray-800)', fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} />
                    </div>
                  ))}
                </div>
                <div style={{ fontSize:10, color:'var(--gray-400)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>Amenities (Sí / No)</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:14 }}>
                  {[['Balcón','has_balcony'],['Logia','has_laundry'],['Dorm. servicio','has_maid_room'],['Baño visitas','has_half_bath'],['Conserjería','has_security']].map(([label, field]) => (
                    <div key={field}>
                      <div style={{ fontSize:10, color:'var(--gray-400)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>{label}</div>
                      <select value={form[field] || ''} onChange={e => setForm(prev => ({ ...prev, [field]: e.target.value }))} style={{ width:'100%', padding:'7px 10px', borderRadius:7, border:'1px solid #BFDBFE', background:'#EFF6FF', fontSize:12, color:'var(--gray-800)', fontFamily:'inherit', cursor:'pointer' }}>
                        <option value=''>—</option>
                        <option value='SI'>Sí</option>
                        <option value='NO'>No</option>
                      </select>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize:10, color:'var(--gray-400)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>Privacidad</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
                  <div>
                    <div style={{ fontSize:10, color:'var(--gray-400)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>Ocultar dirección</div>
                    <select value={form.hide_address || ''} onChange={e => setForm(prev => ({ ...prev, hide_address: e.target.value }))} style={{ width:'100%', padding:'7px 10px', borderRadius:7, border:'1px solid #BFDBFE', background:'#EFF6FF', fontSize:12, color:'var(--gray-800)', fontFamily:'inherit', cursor:'pointer' }}>
                      <option value=''>— No ocultar —</option>
                      <option value='SI'>Sí, ocultar</option>
                    </select>
                  </div>
                </div>
              </div>
              {/* Botones */}
              <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
                <button onClick={() => setForm({ tipo:pub.tipo||'', objetivo:pub.objetivo||'', direccion:pub.direccion||'', comuna:pub.comuna||'', region:pub.region||'', numero:pub.numero||'', latitud:pub.latitud||'', longitud:pub.longitud||'', dormitorios:pub.dormitorios||'', banos:pub.banos||'', mt2_const:pub.mt2_const||'', mt2_terreno:pub.mt2_terreno||'', estacionamientos:pub.estacionamientos||'', bodegas:pub.bodegas||'', orientacion:pub.orientacion||'', amoblado:pub.amoblado||'', valor:pub.valor||'', tipo_moneda:pub.tipo_moneda||'UF', ggcc:pub.ggcc||'', vendedor:pub.vendedor||'', captador:pub.captador||'', observaciones:pub.observaciones||'', video:pub.video||'', ksuitable_for_pets:pub.ksuitable_for_pets||'' })} style={{ padding:'9px 20px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:'inherit', color:'var(--gray-500)' }}>
                  Descartar cambios
                </button>
                <button onClick={guardarEditar} disabled={guardandoEditar} style={{ padding:'9px 24px', borderRadius:8, border:'none', background:guardandoEditar?'#9ca3af':'#16a34a', color:'#fff', fontSize:12, fontWeight:600, cursor:guardandoEditar?'not-allowed':'pointer', fontFamily:'inherit' }}>
                  {guardandoEditar ? 'Guardando...' : '💾 Guardar cambios'}
                </button>
              </div>
            </div>
          )}

          {!['Resumen','Editar','Imágenes','Propietario','Publicación'].includes(seccion) && (
            <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:40, textAlign:'center' }}>
              <div style={{ fontSize:13, color:'var(--gray-400)' }}>Sección <strong>{seccion}</strong> en desarrollo</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
