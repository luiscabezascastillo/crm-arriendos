'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import  TopNav  from '../../components/ui/TopNav'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const IMG_BASE = 'https://fondocapital.com/propiedades/'

const PORTALES = [
  { key: 'pi',        label: 'Portal Inmobiliario', code: 'PI', bg: '#E6F1FB', color: '#1a56db', apiKey: null,   nota: 'Requiere API MercadoLibre (Fase 3)' },
  { key: 'yapo',      label: 'Yapo',                code: 'Ya', bg: '#FAEEDA', color: '#854F0B', apiKey: 'yapo', nota: null },
  { key: 'goplaceit', label: 'GoPlaceIt',            code: 'Go', bg: '#EAF3DE', color: '#3B6D11', apiKey: null,   nota: 'Pendiente de implementar' },
  { key: 'web',       label: 'Web',                  code: 'We', bg: '#E6F1FB', color: '#0891b2', apiKey: 'web',  nota: null },
  { key: 'proppit',   label: 'Proppit',              code: 'Pr', bg: '#F3E8FF', color: '#7C3AED', apiKey: null,   nota: 'Pendiente de implementar' },
]

const MENU = ['Resumen', 'Editar', 'Imágenes', 'Documentos', 'Estado', 'Bitácora', 'Propietario', 'Publicación']


// ── SECCIÓN EDITAR ──
function SeccionEditar({ pub, id, onGuardado }) {
  const [form, setForm] = React.useState({
    direccion:    pub.direccion    || '',
    numero:       pub.numero       || '',
    comuna:       pub.comuna       || '',
    region:       pub.region       || '',
    objetivo:     pub.objetivo     || '',
    tipo:         pub.tipo         || '',
    valor:        pub.valor != null ? String(pub.valor) : '',
    tipo_moneda:  pub.tipo_moneda  || 'UF',
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
  })
  const [guardando, setGuardando] = React.useState(false)
  const [msg, setMsg] = React.useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function guardar() {
    setGuardando(true)
    setMsg(null)
    const { data, error } = await supabase.from('publicaciones').update(form).eq('id', id).select().single()
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
        {inp('Dirección', 'direccion')}
        {inp('Número', 'numero')}
        {inp('Comuna', 'comuna')}
        {inp('Región', 'region')}
        {inp('Latitud', 'latitud')}
        {inp('Longitud', 'longitud')}

        {sec('Propiedad', '#16a34a')}
        {inp('Operación', 'objetivo', 'text', ['Arriendo','Venta','Arriendo y Venta'])}
        {inp('Tipo', 'tipo', 'text', ['Departamento','Casa','Oficina','Local Comercial','Bodega','Estacionamiento','Terreno','Otro'])}
        {inp('Valor', 'valor', 'number')}
        {inp('Moneda', 'tipo_moneda', 'text', ['UF','CLP','USD'])}
        {inp('Dormitorios', 'dormitorios', 'number')}
        {inp('Baños', 'banos', 'number')}
        {inp('M² construidos', 'mt2_const', 'number')}
        {inp('M² terreno', 'mt2_terreno', 'number')}
        {inp('Estacionamientos', 'estacionamientos', 'number')}
        {inp('Bodegas', 'bodegas', 'number')}
        {inp('GGCC ($)', 'ggcc', 'number')}
        {inp('Amoblado', 'amoblado', 'text', ['No','Sí','Parcial'])}

        {sec('Observaciones', '#7c3aed')}
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

  // ── Publicar en portal ──
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
              {imagenes.length > 0 && (
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
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {[['Propietario',pub.propietario||'—'],['Teléfono',pub.telefono||'—'],['Email',pub.email||'—'],['Dirección',pub.direccion||'—'],['Captador',pub.vendedor||'—'],['IDADMON',pub.idadmon||'—']].map(([l,v]) => (
                  <div key={l}><div style={{ fontSize:10, color:'var(--gray-400)', marginBottom:2 }}>{l}</div><div style={{ fontSize:12, color:'var(--gray-800)', fontWeight:500 }}>{v}</div></div>
                ))}
              </div>
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
                          <button onClick={() => publicarEnPortal(portal.apiKey)} disabled={cargando} style={{
                            width:'100%', padding:'6px 0', borderRadius:7, border:'none',
                            background:cargando?'#9ca3af':portal.color, color:'#fff',
                            fontSize:11, fontWeight:600, cursor:cargando?'not-allowed':'pointer', fontFamily:'inherit',
                          }}>
                            {cargando ? '⏳ Publicando...' : activo ? '🔄 Actualizar feed' : '📤 Publicar'}
                          </button>
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