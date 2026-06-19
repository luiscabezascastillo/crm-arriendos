'use client'
import React, { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useSession } from 'next-auth/react'
import TopNav from '../components/ui/TopNav'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
const IMG_BASE = 'https://fondocapital.com/propiedades/'

// Amenities: clave en BD -> etiqueta visible
const AMENITIES = [
  ['tiene_ascensor', 'Ascensor'],
  ['tiene_piscina', 'Piscina'],
  ['tiene_gimnasio', 'Gimnasio'],
  ['tiene_salon_fiestas', 'Salón de fiestas'],
  ['tiene_sala_multiuso', 'Sala multiuso'],
  ['tiene_quincho_parrilla', 'Quincho / parrilla'],
  ['tiene_juegos_infantiles', 'Juegos infantiles'],
  ['tiene_sauna', 'Sauna'],
  ['tiene_jacuzzi', 'Jacuzzi'],
  ['tiene_cowork', 'Cowork'],
  ['tiene_cine', 'Sala de cine'],
  ['tiene_playroom', 'Playroom'],
  ['tiene_recepcion', 'Recepción'],
  ['tiene_lavanderia', 'Lavandería'],
  ['tiene_estacionamiento_visitas', 'Estac. visitas'],
  ['tiene_cancha_paddle', 'Cancha paddle'],
  ['tiene_cancha_tenis', 'Cancha tenis'],
  ['tiene_cancha_multiuso', 'Cancha multiuso'],
  ['tiene_area_verde', 'Área verde'],
  ['tiene_azotea', 'Azotea'],
  ['tiene_generador', 'Generador'],
  ['tiene_rampa_silla', 'Rampa silla ruedas'],
]

export default function EdificiosPage() {
  const { data: session } = useSession()
  const esAdmin = session?.user?.role === 'admin'
  const [edificios, setEdificios] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [sel, setSel] = useState(null) // edificio seleccionado para editar

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase
      .from('edificios')
      .select('*')
      .order('calle', { ascending: true })
    setEdificios(data || [])
    setLoading(false)
  }

  const filtrados = edificios.filter(e => {
    if (!busca.trim()) return true
    const t = busca.toLowerCase()
    return (e.calle || '').toLowerCase().includes(t)
      || (e.comuna || '').toLowerCase().includes(t)
      || (e.codigo_edi || '').toLowerCase().includes(t)
  })

  function nFotos(e) {
    let n = 0
    for (let i = 1; i <= 15; i++) if (e['foto_comun_' + i]) n++
    return n
  }
  function nAmenities(e) {
    return AMENITIES.filter(([k]) => e[k] === true).length
  }

  if (sel) {
    return <FichaEdificio edificio={sel} onVolver={() => { setSel(null); cargar() }} />
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg, #f6f7f9)' }}>
      <TopNav />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text, #111)', margin: 0 }}>Edificios</h1>
            <p style={{ fontSize: 13, color: 'var(--gray-500, #6b7280)', margin: '4px 0 0' }}>
              {edificios.length} edificios · {edificios.filter(e => nFotos(e) > 0).length} con fotos de espacios comunes
            </p>
          </div>
          {esAdmin && (
            <button onClick={() => setSel({})}
              style={{ background: '#1a56db', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              + Nuevo edificio
            </button>
          )}
        </div>

        <input
          type="text"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por calle, comuna o código…"
          style={{ width: '100%', maxWidth: 400, padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border, #e5e7eb)', fontSize: 14, marginBottom: 16, fontFamily: 'inherit' }}
        />

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400, #9ca3af)' }}>Cargando edificios…</div>
        ) : (
          <div style={{ background: 'var(--surface, #fff)', border: '1px solid var(--border, #e5e7eb)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--gray-50, #f9fafb)', textAlign: 'left' }}>
                  <th style={th}>Código</th>
                  <th style={th}>Calle</th>
                  <th style={th}>Nº</th>
                  <th style={th}>Comuna</th>
                  <th style={th}>Admin</th>
                  <th style={th}>Amenities</th>
                  <th style={th}>Fotos</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(e => (
                  <tr key={e.id} onClick={() => setSel(e)}
                    style={{ borderTop: '1px solid var(--border, #eee)', cursor: 'pointer' }}
                    onMouseEnter={ev => ev.currentTarget.style.background = 'var(--gray-50, #f9fafb)'}
                    onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}>
                    <td style={td}>{e.codigo_edi || '—'}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{e.calle || '—'}</td>
                    <td style={td}>{e.numero_calle || '—'}</td>
                    <td style={td}>{e.comuna || '—'}</td>
                    <td style={td}>{e.administrador || e.software_admin ? '✓' : '—'}</td>
                    <td style={td}>{nAmenities(e) > 0 ? nAmenities(e) : '—'}</td>
                    <td style={td}>{nFotos(e) > 0 ? `${nFotos(e)} 📷` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtrados.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400, #9ca3af)' }}>
                No hay edificios que coincidan con la búsqueda.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const th = { padding: '10px 14px', fontSize: 11, fontWeight: 600, color: 'var(--gray-500, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.04em' }
const td = { padding: '10px 14px', color: 'var(--gray-700, #374151)' }

// ---------- FICHA DE EDIFICIO ----------
function FichaEdificio({ edificio, onVolver }) {
  const [form, setForm] = useState({ ...edificio })
  const [idActual, setIdActual] = useState(edificio.id || null)
  const esNuevo = !idActual
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const [subiendoFotos, setSubiendoFotos] = useState(false)
  const [msgFotos, setMsgFotos] = useState(null)
  const dragIdx = useRef(null)
  const dragOverIdx = useRef(null)
  function reordenarFotos() {
    const from = dragIdx.current, to = dragOverIdx.current
    dragIdx.current = null; dragOverIdx.current = null
    if (from === null || to === null || from === to) return
    const fotos = []
    for (let j = 1; j <= 15; j++) if (form['foto_comun_' + j]) fotos.push(form['foto_comun_' + j])
    const [moved] = fotos.splice(from, 1)
    fotos.splice(to, 0, moved)
    const nuevo = {}
    for (let j = 1; j <= 15; j++) nuevo['foto_comun_' + j] = fotos[j - 1] || null
    setForm(f => ({ ...f, ...nuevo }))
  }

  // Devuelve los indices 1..15 que estan vacios
  function huecosLibres() {
    const libres = []
    for (let i = 1; i <= 15; i++) if (!form['foto_comun_' + i]) libres.push(i)
    return libres
  }

  async function subirFotos(fileList) {
    if (!idActual) { setMsgFotos({ ok: false, text: 'Guarda el edificio primero para poder subir fotos.' }); return }
    const files = Array.from(fileList || []).filter(f => f.type.includes('jpeg') || f.type.includes('jpg'))
    if (!files.length) { setMsgFotos({ ok: false, text: 'Solo se admiten archivos JPG.' }); return }
    const libres = huecosLibres()
    if (!libres.length) { setMsgFotos({ ok: false, text: 'Ya hay 15 fotos. Elimina alguna para añadir más.' }); return }

    setSubiendoFotos(true)
    setMsgFotos(null)
    const cambios = {}
    let idx = 0
    for (const file of files) {
      if (idx >= libres.length) break // no hay mas huecos
      const slot = libres[idx]
      const fd = new FormData()
      fd.append('file', file)
      fd.append('publicacionId', 'EDI' + idActual)
      fd.append('slot', slot + '-' + Date.now())
      try {
        const res = await fetch('/api/upload-imagen', { method: 'POST', body: fd })
        const data = await res.json()
        if (data.ok && data.nombreArchivo) {
          cambios['foto_comun_' + slot] = data.nombreArchivo
          setForm(f => ({ ...f, ['foto_comun_' + slot]: data.nombreArchivo }))
          idx++
        }
      } catch (e) { /* sigue con la siguiente */ }
    }
    setSubiendoFotos(false)
    if (Object.keys(cambios).length) {
      setMsgFotos({ ok: true, text: `✓ ${Object.keys(cambios).length} foto(s) subida(s). Recuerda Guardar.` })
    } else {
      setMsgFotos({ ok: false, text: 'No se pudo subir ninguna foto.' })
    }
    setTimeout(() => setMsgFotos(null), 4000)
  }

  function eliminarFoto(i) {
    // quita la foto i y reordena las siguientes hacia arriba para no dejar huecos
    const fotos = []
    for (let j = 1; j <= 15; j++) if (j !== i && form['foto_comun_' + j]) fotos.push(form['foto_comun_' + j])
    const nuevo = {}
    for (let j = 1; j <= 15; j++) nuevo['foto_comun_' + j] = fotos[j - 1] || null
    setForm(f => ({ ...f, ...nuevo }))
  }


  async function guardar() {
    setGuardando(true)
    setMsg(null)
    const { id, created_at, ...datos } = form
    datos.updated_at = new Date().toISOString()
    if (!idActual) {
      // Edificio nuevo: INSERT y quedarse en la ficha con el id generado
      const { data, error } = await supabase.from('edificios').insert(datos).select().single()
      setGuardando(false)
      if (error) { setMsg({ ok: false, text: 'Error: ' + error.message }); return }
      setIdActual(data.id)
      setForm(data)
      setMsg({ ok: true, text: '✓ Edificio creado. Ya puedes subir fotos y seguir editando.' })
      setTimeout(() => setMsg(null), 4000)
    } else {
      const { error } = await supabase.from('edificios').update(datos).eq('id', idActual)
      setGuardando(false)
      if (error) setMsg({ ok: false, text: 'Error: ' + error.message })
      else { setMsg({ ok: true, text: '✓ Guardado correctamente' }); setTimeout(() => setMsg(null), 3000) }
    }
  }

  const inp = (label, key, type = 'text') => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={lbl}>{label}</label>
      <input type={type} value={form[key] || ''} onChange={e => set(key, e.target.value)} style={field} />
    </div>
  )
  const sec = (titulo, color = '#1a56db') => (
    <div style={{ gridColumn: '1/-1', borderBottom: '2px solid ' + color, paddingBottom: 4, marginTop: 12 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{titulo}</span>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg, #f6f7f9)' }}>
      <TopNav />
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24 }}>
        <button onClick={onVolver} style={{ fontSize: 13, color: '#1a56db', background: 'transparent', border: 'none', cursor: 'pointer', marginBottom: 12, fontFamily: 'inherit' }}>← Volver al listado</button>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text, #111)', margin: 0 }}>
            {esNuevo && !form.calle ? 'Nuevo edificio' : <>{form.calle} {form.numero_calle} <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--gray-400)' }}>· {form.comuna}</span></>}
          </h1>
          <button onClick={guardar} disabled={guardando}
            style={{ background: '#1a56db', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>

        {msg && (
          <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 8, background: msg.ok ? '#dcfce7' : '#fee2e2', color: msg.ok ? '#166534' : '#991b1b', fontSize: 13 }}>
            {msg.text}
          </div>
        )}

        <div style={{ background: 'var(--surface, #fff)', border: '1px solid var(--border, #e5e7eb)', borderRadius: 12, padding: 28 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))', gap: 14 }}>
            {sec('Identificación')}
            {inp('Código edificio', 'codigo_edi')}
            {inp('Nombre', 'nombre')}
            {inp('Calle', 'calle')}
            {inp('Número', 'numero_calle')}
            {inp('Comuna', 'comuna')}

            {sec('Administración', '#16a34a')}
            {inp('Tel. conserjería', 'tel_conserjeria')}
            {inp('Nombre mayordomo', 'nombre_mayordomo')}
            {inp('Tel. mayordomo', 'tel_mayordomo')}
            {inp('Software admin', 'software_admin')}
            {inp('Administrador', 'administrador')}
            {inp('Contacto admin', 'contacto_admin')}
            {inp('Teléfono admin', 'telefono_admin')}
            {inp('App gestión', 'app_gestion')}

            {sec('Estructura física', '#854d0e')}
            {inp('Pisos', 'pisos', 'number')}
            {inp('Deptos por piso', 'deptos_por_piso', 'number')}
            {inp('Nº torres', 'numero_torres', 'number')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                 <label style={lbl}>Año de construcción</label>
                 <input type="number" value={form.ano_construccion ?? ''}
                   onChange={e => set('ano_construccion', e.target.value === '' ? null : parseInt(e.target.value, 10))}
                   placeholder="Ej: 2015" style={field} />
               </div>
            {inp('Tipo seguridad', 'tipo_seguridad')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={lbl}>Condominio cerrado</label>
              <select value={form.condominio_cerrado === null ? '' : String(form.condominio_cerrado)} onChange={e => set('condominio_cerrado', e.target.value === '' ? null : e.target.value === 'true')} style={field}>
                <option value="">—</option><option value="true">Sí</option><option value="false">No</option>
              </select>
            </div>

            {sec('Amenities / espacios comunes', '#7c3aed')}
            <div style={{ gridColumn: '1/-1', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px,1fr))', gap: 8 }}>
              {AMENITIES.map(([key, label]) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--gray-700, #374151)', cursor: 'pointer', padding: '4px 0' }}>
                  <input type="checkbox" checked={form[key] === true} onChange={e => set(key, e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                  {label}
                </label>
              ))}
            </div>

            {sec('Complemento de descripción', '#0891b2')}
            <div style={{ gridColumn: '1/-1', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={lbl}>Texto que se añadirá a la descripción de las publicaciones de este edificio</label>
              <textarea value={form.complemento_descripcion || ''} onChange={e => set('complemento_descripcion', e.target.value)} rows={4}
                style={{ ...field, resize: 'vertical', lineHeight: 1.5 }} />
            </div>

            {sec('Entorno / Puntos de interés', '#0d9488')}
            <div style={{ gridColumn: '1/-1', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={lbl}>Datos crudos para el generador de descripciones (NO se publica tal cual). Metro, parques, supermercados, colegios, oficinas cercanas.</label>
              <textarea value={form.puntos_interes || ''} onChange={e => set('puntos_interes', e.target.value)} rows={3}
                placeholder="Ej: Metro Alcántara a 3 cuadras, Parque Araucano, Jumbo, Colegio San Benito, oficinas de Apoquindo"
                style={{ ...field, resize: 'vertical', lineHeight: 1.5 }} />
              <p style={{ fontSize: 11, color: 'var(--gray-500)', margin: '2px 0 0', lineHeight: 1.5 }}>
                Escribe hitos reales separados por coma: metro (con línea y distancia), parques, supermercados, colegios, clínicas, hitos del barrio.
                Ej: «Metro Santa Isabel L5 a 4 cuadras, Parque Bustamante, Líder Express, Clínica Indisa». Mientras más específico, mejor queda la descripción generada.
              </p>
            </div>

         {sec('Fotos de espacios comunes', '#dc2626')}
            <div style={{ gridColumn: '1/-1' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#fff', background: '#dc2626', borderRadius: 7, padding: '8px 14px', cursor: subiendoFotos ? 'default' : 'pointer', opacity: subiendoFotos ? 0.6 : 1 }}>
                  {subiendoFotos ? 'Subiendo…' : '+ Subir fotos'}
                  <input type="file" accept="image/jpeg" multiple disabled={subiendoFotos}
                    onChange={e => { subirFotos(e.target.files); e.target.value = '' }}
                    style={{ display: 'none' }} />
                </label>
                <span style={{ fontSize: 11, color: 'var(--gray-400, #9ca3af)' }}>JPG · hasta 15 fotos · se guardan al pulsar Guardar</span>
              </div>
              {msgFotos && (
                <div style={{ marginBottom: 10, fontSize: 12, color: msgFotos.ok ? '#166534' : '#991b1b' }}>{msgFotos.text}</div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px,1fr))', gap: 10 }}>
                {Array.from({ length: 15 }, (_, i) => i + 1).map(i => {
                  const val = form['foto_comun_' + i]
                  if (!val) return null
                  return (
<div key={i} draggable
                      onDragStart={() => { dragIdx.current = i - 1 }}
                      onDragOver={e => { e.preventDefault(); dragOverIdx.current = i - 1 }}
                      onDrop={e => { e.preventDefault(); reordenarFotos() }}
                      style={{ position: 'relative', cursor: 'grab' }}>                      <img src={IMG_BASE + val} alt={`Foto ${i}`}
                        style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border, #e5e7eb)' }}
                        onError={ev => { ev.target.style.opacity = 0.3 }} />
                      <button onClick={() => eliminarFoto(i)} title="Eliminar foto"
                        style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'rgba(220,38,38,0.9)', color: '#fff', fontSize: 13, lineHeight: '22px', cursor: 'pointer', padding: 0 }}>×</button>
                    </div>
                  )
                })}
              </div>
              {huecosLibres().length === 15 && (
                <div style={{ fontSize: 12, color: 'var(--gray-400, #9ca3af)', padding: '12px 0' }}>Sin fotos de espacios comunes. Usa "+ Subir fotos" para añadir.</div>
              )}
            </div>

            {sec('Notas', '#6b7280')}
            <div style={{ gridColumn: '1/-1', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <textarea value={form.notas || ''} onChange={e => set('notas', e.target.value)} rows={2} style={{ ...field, resize: 'vertical' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const lbl = { fontSize: 11, fontWeight: 600, color: 'var(--gray-500, #6b7280)', textTransform: 'uppercase', letterSpacing: '0.04em' }
const field = { padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border, #e5e7eb)', fontSize: 13, background: 'var(--surface, #fff)', color: 'var(--text, #111)', fontFamily: 'inherit' }
