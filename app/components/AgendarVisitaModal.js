'use client'
import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
const OPTS_VENDEDOR = ['Alberto', 'Adalis', 'Fabiola', 'Lorena', 'Pedro', 'Neika', 'Tirza', 'Karina']
const ESTADOS_VISITA = ['agendada', 'realizada', 'cancelada']
const RESULTADOS_PROP = ['pendiente', 'interesado', 'descartado']

const sinTildes = s => (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
function opLabel(objetivo) {
  const o = (objetivo || '').toString().toLowerCase()
  if (o.includes('arriendo') || o.includes('renta')) return 'Arriendo'
  if (o.includes('venta')) return 'Venta'
  return ''
}
function etiquetaPub(p) {
  const dir = p.direccionreal || p.direccion || [p.calle, p.numero_calle].filter(Boolean).join(' ') || 'sin direccion'
  const op = opLabel(p.objetivo)
  const dirNorm = sinTildes(dir)
  const comunaYaEnDir = p.comuna && dirNorm.includes(sinTildes(p.comuna))
  const deptoYaEnDir = p.departamento && dirNorm.includes(sinTildes(String(p.departamento)))
  return `${[op, p.tipo].filter(Boolean).join(' \u00b7 ')} \u00b7 ${dir}${(p.departamento && !deptoYaEnDir) ? ' \u00b7 Depto ' + p.departamento : ''}${(p.comuna && !comunaYaEnDir) ? ' \u00b7 ' + p.comuna : ''}`
}

// estilos
const ov = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '40px 16px' }
const card = { background: '#fff', borderRadius: 14, width: '100%', maxWidth: 640, boxShadow: '0 20px 50px rgba(0,0,0,0.25)', fontFamily: '"DM Sans", system-ui, sans-serif', color: '#10183a' }
const input = { padding: '8px 10px', borderRadius: 7, border: '1px solid #E5E7EB', fontSize: 13, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }
const label = { fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4, display: 'block' }
const mini = { fontSize: 11, padding: '3px 8px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid' }

export default function AgendarVisitaModal({ pub = null, contactoInicial = null, onClose = () => {}, onSaved = () => {} }) {
  // cliente
  const [contactoSel, setContactoSel] = useState(contactoInicial)
  const [cQuery, setCQuery] = useState('')
  const [cRes, setCRes] = useState([])
  const [nombre, setNombre] = useState(contactoInicial ? [contactoInicial.nombre, contactoInicial.apellido].filter(Boolean).join(' ') : '')
  const [telefono, setTelefono] = useState(contactoInicial?.telefono || '')
  const [email, setEmail] = useState(contactoInicial?.email || '')
  const [rut, setRut] = useState(contactoInicial?.numero_doc || '')
  // visita
  const [fecha, setFecha] = useState('')
  const [hora, setHora] = useState('')
  const [comercial, setComercial] = useState('')
  const [estado, setEstado] = useState('agendada')
  const [notas, setNotas] = useState('')
  const [genOrden, setGenOrden] = useState(true)
  // propiedades
  const [props, setProps] = useState(pub ? [{ publicacion_id: pub.id, label: etiquetaPub(pub), resultado: 'pendiente', notas: '' }] : [])
  const [pSearch, setPSearch] = useState('')
  const [pRes, setPRes] = useState([])
  // flujo
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)
  const [resultado, setResultado] = useState(null) // { orden, link } tras guardar

  async function buscarContacto(q) {
    setCQuery(q)
    if (!q || q.trim().length < 2) { setCRes([]); return }
    const { data } = await supabase.from('contactos')
      .select('id, nombre, apellido, telefono, email, numero_doc')
      .or(`nombre.ilike.%${q}%,apellido.ilike.%${q}%,telefono.ilike.%${q}%`).limit(8)
    setCRes(data || [])
  }
  function elegirContacto(c) {
    setContactoSel(c)
    setNombre([c.nombre, c.apellido].filter(Boolean).join(' '))
    setTelefono(c.telefono || ''); setEmail(c.email || ''); setRut(c.numero_doc || '')
    setCRes([]); setCQuery('')
  }

  async function buscarPub(q) {
    setPSearch(q)
    if (!q || q.trim().length < 2) { setPRes([]); return }
    const { data } = await supabase.from('publicaciones')
      .select('id, codigo, objetivo, tipo, direccion, direccionreal, calle, numero_calle, departamento, comuna, valor, tipo_moneda')
      .eq('activo', 'active')
      .or(`codigo.ilike.%${q}%,comuna.ilike.%${q}%,direccion.ilike.%${q}%,direccionreal.ilike.%${q}%`).limit(8)
    const ya = new Set(props.map(p => p.publicacion_id))
    setPRes((data || []).filter(p => !ya.has(p.id)))
  }
  function agregarPub(p) {
    setProps(arr => arr.some(x => x.publicacion_id === p.id) ? arr : [...arr, { publicacion_id: p.id, label: etiquetaPub(p), resultado: 'pendiente', notas: '' }])
    setPSearch(''); setPRes([])
  }
  const quitarPub = id => setProps(arr => arr.filter(p => p.publicacion_id !== id))
  const setProp = (id, k, v) => setProps(arr => arr.map(p => p.publicacion_id === id ? { ...p, [k]: v } : p))

  async function resolverContacto() {
    if (contactoSel?.id) return contactoSel.id
    const tel = telefono.trim(), mail = email.trim(), nom = nombre.trim()
    if (!tel && !mail && !nom) return null
    if (tel || mail) {
      const ors = []
      if (tel) ors.push(`telefono.eq.${tel}`)
      if (mail) ors.push(`email.ilike.${mail}`)
      const { data: dup } = await supabase.from('contactos').select('id').or(ors.join(',')).limit(1)
      if (dup && dup.length) return dup[0].id
    }
    const partes = nom.split(' ').filter(Boolean)
    const { data: nuevo, error } = await supabase.from('contactos').insert({
      nombre: partes.shift() || nom || null, apellido: partes.join(' ') || null,
      telefono: tel || null, email: mail || null,
      roles: ['comprador'], origen: 'orden_visita', activo: true,
    }).select('id').single()
    if (error) throw new Error('No se pudo crear el contacto: ' + error.message)
    return nuevo.id
  }

  async function guardar() {
    if (!fecha) { setMsg({ tipo: 'error', txt: 'La fecha es obligatoria.' }); return }
    if (!nombre.trim() && !contactoSel) { setMsg({ tipo: 'error', txt: 'Ingresa el cliente (b\u00fascalo o escribe su nombre).' }); return }
    setGuardando(true); setMsg(null)
    try {
      const contactoId = await resolverContacto()
      const { data: vis, error: e1 } = await supabase.from('visitas').insert({
        requerimiento_id: null, contacto_id: contactoId,
        cliente_nombre: nombre.trim() || null, cliente_telefono: telefono.trim() || null, cliente_email: email.trim() || null, cliente_rut: rut.trim() || null,
        fecha, hora: hora || null, comercial: comercial || null, estado, notas: notas || null,
        updated_at: new Date().toISOString(),
      }).select('id').single()
      if (e1) throw new Error('Error creando la visita: ' + e1.message)

      if (props.length) {
        const detalle = props.map((p, i) => ({ visita_id: vis.id, publicacion_id: p.publicacion_id, orden: i + 1, resultado: p.resultado || null, notas: p.notas || null }))
        await supabase.from('visita_propiedades').insert(detalle)
      }

      let orden = null
      if (genOrden) {
        const res = await fetch('/api/ordenes/generar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visita_id: vis.id }) })
        const j = await res.json()
        if (res.ok) orden = j
      }
      setGuardando(false)
      setResultado({ orden, visitaId: vis.id })
      onSaved()
    } catch (err) {
      setGuardando(false)
      setMsg({ tipo: 'error', txt: err.message })
    }
  }

  function copiarLink(link) {
    if (navigator.clipboard) navigator.clipboard.writeText(link).then(() => setMsg({ tipo: 'ok', txt: 'Link copiado.' }))
    else window.prompt('Copia el link:', link)
  }

  // ---- vista de resultado (tras guardar) ----
  if (resultado) {
    const o = resultado.orden
    const link = o?.token ? `${window.location.origin}/firmar/${o.token}` : null
    return (
      <div style={ov} onClick={onClose}>
        <div style={card} onClick={e => e.stopPropagation()}>
          <div style={{ padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 6 }}>\u2713</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Visita guardada</div>
            {o ? (
              <>
                <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>Orden N\u00b0 {o.orden_id} generada y lista para firmar.</div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 18 }}>
                  {o.pdf_url && <a href={o.pdf_url} target="_blank" rel="noreferrer" style={{ ...mini, textDecoration: 'none', borderColor: '#E5E7EB', background: '#fff', color: '#374151', padding: '8px 14px' }}>Ver PDF</a>}
                  {link && <button onClick={() => copiarLink(link)} style={{ ...mini, borderColor: '#E5E7EB', background: '#fff', color: '#374151', padding: '8px 14px' }}>Copiar link de firma</button>}
                  {link && <a href={link} target="_blank" rel="noreferrer" style={{ ...mini, textDecoration: 'none', borderColor: '#7c3aed', background: '#f5f3ff', color: '#7c3aed', padding: '8px 14px' }}>Abrir firma</a>}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>La visita qued\u00f3 guardada (sin orden).</div>
            )}
            {msg && <div style={{ fontSize: 12, color: msg.tipo === 'error' ? '#dc2626' : '#16a34a', marginBottom: 10 }}>{msg.txt}</div>}
            <button onClick={onClose} style={{ ...input, width: 'auto', cursor: 'pointer', background: '#0C447C', color: '#fff', border: 'none', fontWeight: 600, padding: '10px 22px' }}>Cerrar</button>
          </div>
        </div>
      </div>
    )
  }

  // ---- formulario ----
  return (
    <div style={ov} onClick={onClose}>
      <div style={card} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #EEE' }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Nueva orden de visita</div>
          <button onClick={onClose} style={{ ...input, width: 'auto', cursor: 'pointer', background: '#F0EEE8' }}>\u00d7</button>
        </div>

        <div style={{ padding: 20 }}>
          {msg && <div style={{ marginBottom: 14, padding: 10, borderRadius: 8, fontSize: 13, background: msg.tipo === 'error' ? '#fef2f2' : '#f0fdf4', color: msg.tipo === 'error' ? '#dc2626' : '#16a34a' }}>{msg.txt}</div>}

          {/* Cliente */}
          <div style={{ marginBottom: 14 }}>
            <label style={label}>Cliente</label>
            {contactoSel ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, padding: '6px 10px', background: '#E6F1FB', borderRadius: 7, color: '#185FA5' }}>\ud83d\udd17 {nombre}{telefono ? ' \u00b7 ' + telefono : ''}</span>
                <button onClick={() => { setContactoSel(null); setNombre(''); setTelefono(''); setEmail('') }} style={{ ...mini, borderColor: '#E5E7EB', background: '#fff', color: '#374151' }}>Quitar</button>
              </div>
            ) : (
              <>
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <input style={input} value={cQuery} onChange={e => buscarContacto(e.target.value)} placeholder="Buscar contacto existente (nombre o tel\u00e9fono)\u2026" />
                  {cRes.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, marginTop: 2, zIndex: 20, maxHeight: 200, overflowY: 'auto' }}>
                      {cRes.map(c => (
                        <div key={c.id} onClick={() => elegirContacto(c)} style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', borderBottom: '1px solid #F3F4F6' }}>
                          {c.nombre} {c.apellido || ''} <span style={{ color: '#888' }}>{c.telefono || c.email || ''}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>O escr\u00edbelo a mano (si no existe, se crea solo en contactos al guardar):</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                  <input style={input} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre" />
                  <input style={input} value={rut} onChange={e => setRut(e.target.value)} placeholder="RUT" />
                  <input style={input} value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Tel\u00e9fono" />
                  <input style={input} value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" />
                </div>
              </>
            )}
          </div>

          {/* Cu\u00e1ndo / qui\u00e9n */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div><label style={label}>Fecha *</label><input type="date" style={input} value={fecha} onChange={e => setFecha(e.target.value)} /></div>
            <div><label style={label}>Hora</label><input type="time" style={input} value={hora} onChange={e => setHora(e.target.value)} /></div>
            <div><label style={label}>Comercial</label>
              <select style={input} value={comercial} onChange={e => setComercial(e.target.value)}>
                <option value="">\u2014</option>
                {OPTS_VENDEDOR.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div><label style={label}>Estado</label>
              <select style={input} value={estado} onChange={e => setEstado(e.target.value)}>
                {ESTADOS_VISITA.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Propiedades */}
          <div style={{ marginBottom: 12 }}>
            <label style={label}>Propiedades a mostrar</label>
            {props.length === 0 && <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>Busca y agrega una o varias propiedades abajo.</div>}
            {props.map((p, i) => (
              <div key={p.publicacion_id} style={{ border: '1px solid #E8E6E0', borderRadius: 8, padding: 10, marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{i + 1}. {p.label}</div>
                  <button onClick={() => quitarPub(p.publicacion_id)} style={{ ...mini, borderColor: '#dc2626', background: '#fef2f2', color: '#dc2626', flexShrink: 0 }}>Quitar</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 8 }}>
                  <select style={input} value={p.resultado || 'pendiente'} onChange={e => setProp(p.publicacion_id, 'resultado', e.target.value)}>
                    {RESULTADOS_PROP.map(rp => <option key={rp} value={rp}>{rp}</option>)}
                  </select>
                  <input style={input} value={p.notas || ''} onChange={e => setProp(p.publicacion_id, 'notas', e.target.value)} placeholder="Comentario\u2026" />
                </div>
              </div>
            ))}
            <div style={{ position: 'relative' }}>
              <input style={input} value={pSearch} onChange={e => buscarPub(e.target.value)} placeholder="Buscar propiedad por c\u00f3digo, direcci\u00f3n o comuna\u2026" />
              {pRes.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, marginTop: 2, zIndex: 20, maxHeight: 220, overflowY: 'auto' }}>
                  {pRes.map(p => (
                    <div key={p.id} onClick={() => agregarPub(p)} style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid #F3F4F6' }}>
                      {etiquetaPub(p)}{p.codigo ? ' \u00b7 ' + p.codigo : ''}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Notas */}
          <div style={{ marginBottom: 16 }}>
            <label style={label}>Notas de la visita</label>
            <textarea style={{ ...input, minHeight: 54, resize: 'vertical' }} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Ej. pasar a buscar al cliente, llevar llaves, etc." />
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#374151', cursor: 'pointer' }}>
              <input type="checkbox" checked={genOrden} onChange={e => setGenOrden(e.target.checked)} />
              Generar orden de visita al guardar
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} style={{ ...input, width: 'auto', cursor: 'pointer', background: '#F0EEE8' }}>Cancelar</button>
              <button onClick={guardar} disabled={guardando} style={{ ...input, width: 'auto', cursor: 'pointer', background: '#7c3aed', color: '#fff', border: 'none', fontWeight: 600, opacity: guardando ? 0.6 : 1 }}>
                {guardando ? 'Guardando\u2026' : 'Guardar visita'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
