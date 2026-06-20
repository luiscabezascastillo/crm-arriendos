'use client'
import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { COMUNAS_LISTA } from '../../lib/comunas.js'
import { buscarMatches } from '../../lib/matching.js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const DIRECCION_EMAILS = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com']

const TIPOS = ['Departamento', 'Casa', 'Oficina', 'Local', 'Terreno', 'Parcela', 'Bodega', 'Industrial']
const OPTS_VENDEDOR = ['Alberto', 'Adalis', 'Fabiola', 'Lorena', 'Pedro', 'Neika', 'Tirza', 'Karina']
const FUENTES = ['manual', 'PI', 'web', 'landing', 'redes', 'referido']

// Amenities: nombre interno (mapea a lib/matching.js) -> etiqueta bonita
const AMENITIES = [
  ['piscina', 'Piscina'], ['gimnasio', 'Gimnasio'], ['quincho', 'Quincho / Parrilla'],
  ['terraza', 'Terraza'], ['balcon', 'Balcón'], ['jardin', 'Jardín / Área verde'],
  ['patio', 'Patio'], ['logia', 'Logia'], ['walking_closet', 'Walk-in closet'],
  ['bodega', 'Bodega'], ['calefaccion', 'Calefacción'], ['aire_acondicionado', 'Aire acondicionado'],
  ['sauna', 'Sauna'], ['jacuzzi', 'Jacuzzi'], ['cowork', 'Cowork'], ['cine', 'Sala de cine'],
  ['playroom', 'Playroom'], ['salon_fiestas', 'Salón de fiestas'], ['sala_multiuso', 'Sala multiuso'],
  ['juegos_infantiles', 'Juegos infantiles'], ['cancha_paddle', 'Cancha de paddle'],
  ['cancha_tenis', 'Cancha de tenis'], ['cancha_multiuso', 'Cancha multiuso'],
  ['azotea', 'Azotea'], ['ascensor', 'Ascensor'], ['conserjeria', 'Conserjería'],
  ['lavanderia', 'Lavandería'], ['estac_visitas', 'Estac. visitas'], ['generador', 'Generador'],
  ['rampa_silla', 'Acceso silla ruedas'], ['condominio_cerrado', 'Condominio cerrado'],
  ['seguridad', 'Seguridad'], ['amoblado', 'Amoblado'], ['acepta_mascotas', 'Acepta mascotas'],
  ['pieza_servicio', 'Pieza de servicio'],
]
const LABEL_AMENITY = Object.fromEntries(AMENITIES)

// helper para buscar comunas sin importar tildes / mayusculas
const sinTildes = s => (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

// valor UF usado para convertir precios en el matching (mismo criterio que /propiedades)
const VALOR_UF = 40790

// formatea el precio de una publicacion con su moneda
function fmtPrecio(p) {
  if (p.valor == null || p.valor === '') return '—'
  const m = String(p.tipo_moneda || '').toUpperCase()
  const simbolo = (m === 'UF' || m === 'CLF') ? 'UF ' : '$'
  const n = Number(p.valor)
  if (isNaN(n)) return String(p.valor)
  return simbolo + n.toLocaleString('es-CL')
}

// jamas mostrar el form vacio sin defaults
const FORM_VACIO = {
  contacto_id: null, nombre_suelto: '', telefono_suelto: '', email_suelto: '',
  operacion: 'venta', tipos: [], precio_min: '', precio_max: '', moneda: 'UF',
  dorm_min: '', banos_min: '', estac_min: '', mt2_const_min: '', mt2_terreno_min: '',
  amenities_oblig: [], amenities_desea: [], comunas: [],
  notas: '', fuente: 'manual', estado: 'activo', vendedor: '',
}

export default function RequerimientosPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const email = session?.user?.email
  const rol = session?.user?.role
  const esAdmin = rol === 'admin' || DIRECCION_EMAILS.includes(email)

  const [reqs, setReqs] = useState([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(null) // null = lista; {} o {...} = form
  const [form, setForm] = useState(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)

  // buscador de contacto
  const [contactoQuery, setContactoQuery] = useState('')
  const [contactoResultados, setContactoResultados] = useState([])
  const [contactoSel, setContactoSel] = useState(null)

  // buscador de comunas (combobox)
  const [comunaQuery, setComunaQuery] = useState('')

  // matches (Entrega 2): vista de propiedades que calzan
  const [viendoMatches, setViendoMatches] = useState(null)
  const [cartera, setCartera] = useState({ pubs: [], edis: [], cargada: false, cargando: false })

  useEffect(() => {
    if (status === 'authenticated' && !esAdmin) router.replace('/')
  }, [status, esAdmin, router])

  useEffect(() => {
    if (esAdmin) cargar()
  }, [esAdmin])

  async function cargar() {
    setLoading(true)
    const { data, error } = await supabase
      .from('requerimientos')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) setReqs(data || [])
    setLoading(false)
  }

  // carga (una vez por sesion) las publicaciones de venta activas + edificios para el matching
  async function cargarCartera() {
    if (cartera.cargada || cartera.cargando) return
    setCartera(c => ({ ...c, cargando: true }))
    const { data: edis } = await supabase.from('edificios').select('*')
    const cols = 'id, codigo, comuna, region, calle, numero_calle, departamento, direccion, direccionreal, objetivo, tipo, tipo_moneda, valor, dormitorios, banos, estacionamientos, mt2_const, mt2_terreno, activo, tiene_piscina_propia, tiene_quincho_propio, tiene_jardin, tiene_terraza, tiene_patio, tiene_logia, tiene_walking_closet, tiene_bodega_propia, tiene_calefaccion, tiene_aire_acondicionado, has_laundry, has_security, has_balcony, amoblado, ksuitable_for_pets, has_maid_room'
    let todas = []
    let desde = 0
    const lote = 1000
    while (true) {
      const { data, error } = await supabase
        .from('publicaciones').select(cols)
        .eq('activo', 'active')
        .order('codigo', { ascending: false })
        .range(desde, desde + lote - 1)
      if (error) { console.error(error); break }
      if (!data || data.length === 0) break
      todas = todas.concat(data)
      if (data.length < lote) break
      desde += lote
      if (desde > 20000) break
    }
    // solo venta (el motor igual descarta arriendo, pero filtramos para no traer "otro")
    const venta = todas.filter(p => sinTildes(p.objetivo).includes('venta'))
    setCartera({ pubs: venta, edis: edis || [], cargada: true, cargando: false })
  }

  async function verMatches(r) {
    setMsg(null)
    setViendoMatches(r)
    await cargarCartera()
  }

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function toggleEnArray(campo, valor) {
    setForm(f => {
      const arr = f[campo] || []
      return { ...f, [campo]: arr.includes(valor) ? arr.filter(x => x !== valor) : [...arr, valor] }
    })
  }

  // amenity tri-estado: ninguno -> obligatoria -> deseable -> ninguno
  function estadoAmenity(k) {
    if ((form.amenities_oblig || []).includes(k)) return 'oblig'
    if ((form.amenities_desea || []).includes(k)) return 'desea'
    return 'none'
  }
  function ciclarAmenity(k) {
    setForm(f => {
      const oblig = new Set(f.amenities_oblig || [])
      const desea = new Set(f.amenities_desea || [])
      if (oblig.has(k)) { oblig.delete(k); desea.add(k) }      // obligatoria -> deseable
      else if (desea.has(k)) { desea.delete(k) }               // deseable -> ninguno
      else { oblig.add(k) }                                    // ninguno -> obligatoria
      return { ...f, amenities_oblig: [...oblig], amenities_desea: [...desea] }
    })
  }

  function nuevo() {
    setForm(FORM_VACIO)
    setContactoSel(null); setContactoQuery(''); setContactoResultados([])
    setComunaQuery('')
    setMsg(null)
    setEditando({})
  }

  function editar(r) {
    setForm({
      ...FORM_VACIO, ...r,
      precio_min: r.precio_min ?? '', precio_max: r.precio_max ?? '',
      dorm_min: r.dorm_min ?? '', banos_min: r.banos_min ?? '', estac_min: r.estac_min ?? '',
      mt2_const_min: r.mt2_const_min ?? '', mt2_terreno_min: r.mt2_terreno_min ?? '',
      tipos: r.tipos || [], amenities_oblig: r.amenities_oblig || [],
      amenities_desea: r.amenities_desea || [], comunas: r.comunas || [],
    })
    setContactoSel(r.contacto_id ? { id: r.contacto_id, nombre: r.nombre_suelto || '(contacto ligado)' } : null)
    setContactoQuery(''); setContactoResultados([])
    setComunaQuery('')
    setMsg(null)
    setEditando(r)
  }

  async function buscarContacto(q) {
    setContactoQuery(q)
    if (!q || q.trim().length < 2) { setContactoResultados([]); return }
    const { data } = await supabase
      .from('contactos')
      .select('id, nombre, apellido, telefono, email')
      .or(`nombre.ilike.%${q}%,apellido.ilike.%${q}%,telefono.ilike.%${q}%`)
      .limit(8)
    setContactoResultados(data || [])
  }

  function elegirContacto(c) {
    setContactoSel(c)
    set('contacto_id', c.id)
    set('nombre_suelto', [c.nombre, c.apellido].filter(Boolean).join(' '))
    set('telefono_suelto', c.telefono || '')
    set('email_suelto', c.email || '')
    setContactoResultados([]); setContactoQuery('')
  }

  function quitarContacto() {
    setContactoSel(null)
    set('contacto_id', null)
  }

  async function guardar() {
    setGuardando(true); setMsg(null)

    // 1) Resolver contacto: usar el ligado, o buscar/crear en la BD de contactos
    let contactoIdFinal = form.contacto_id || null
    if (!contactoIdFinal) {
      const tel = (form.telefono_suelto || '').trim()
      const mail = (form.email_suelto || '').trim()
      const nom = (form.nombre_suelto || '').trim()
      if (tel || mail || nom) {
        // a) buscar duplicado por telefono o email
        if (tel || mail) {
          const ors = []
          if (tel) ors.push(`telefono.eq.${tel}`)
          if (mail) ors.push(`email.ilike.${mail}`)
          const { data: dup } = await supabase
            .from('contactos').select('id').or(ors.join(',')).limit(1)
          if (dup && dup.length) contactoIdFinal = dup[0].id
        }
        // b) si no existe, crearlo
        if (!contactoIdFinal) {
          const partes = nom.split(' ').filter(Boolean)
          const nombre = partes.shift() || nom || null
          const apellido = partes.join(' ') || null
          const { data: nuevoC, error: errC } = await supabase
            .from('contactos')
            .insert({
              nombre, apellido,
              telefono: tel || null,
              email: mail || null,
              roles: ['comprador'],
              comercial_asignado: form.vendedor || null,
              origen: 'requerimiento',
              activo: true,
            })
            .select('id').single()
          if (errC) {
            setMsg({ tipo: 'error', txt: 'Error creando contacto: ' + errC.message })
            setGuardando(false); return
          }
          contactoIdFinal = nuevoC.id
        }
      }
    }

    // 2) Guardar el requerimiento ligado al contacto resuelto
    const payload = {
      contacto_id: contactoIdFinal,
      nombre_suelto: form.nombre_suelto || null,
      telefono_suelto: form.telefono_suelto || null,
      email_suelto: form.email_suelto || null,
      operacion: 'venta',
      tipos: form.tipos || [],
      precio_min: form.precio_min === '' ? null : Number(form.precio_min),
      precio_max: form.precio_max === '' ? null : Number(form.precio_max),
      moneda: form.moneda || 'UF',
      dorm_min: form.dorm_min === '' ? null : Number(form.dorm_min),
      banos_min: form.banos_min === '' ? null : Number(form.banos_min),
      estac_min: form.estac_min === '' ? null : Number(form.estac_min),
      mt2_const_min: form.mt2_const_min === '' ? null : Number(form.mt2_const_min),
      mt2_terreno_min: form.mt2_terreno_min === '' ? null : Number(form.mt2_terreno_min),
      amenities_oblig: form.amenities_oblig || [],
      amenities_desea: form.amenities_desea || [],
      comunas: form.comunas || [],
      notas: form.notas || null,
      fuente: form.fuente || 'manual',
      estado: form.estado || 'activo',
      vendedor: form.vendedor || null,
      updated_at: new Date().toISOString(),
    }
    let error
    if (editando && editando.id) {
      ({ error } = await supabase.from('requerimientos').update(payload).eq('id', editando.id))
    } else {
      ({ error } = await supabase.from('requerimientos').insert(payload))
    }
    if (error) { setMsg({ tipo: 'error', txt: 'Error: ' + error.message }); setGuardando(false); return }
    setGuardando(false)
    setEditando(null)
    await cargar()
  }

  async function eliminar(r) {
    if (!window.confirm(`¿Eliminar el requerimiento de ${r.nombre_suelto || 'cliente'}?`)) return
    await supabase.from('requerimientos').delete().eq('id', r.id)
    await cargar()
  }

  // resumen legible de un requerimiento para el listado
  function resumen(r) {
    const partes = []
    if (r.tipos?.length) partes.push(r.tipos.join('/'))
    if (r.precio_max) partes.push(`hasta ${r.moneda} ${Number(r.precio_max).toLocaleString('es-CL')}`)
    if (r.dorm_min) partes.push(`${r.dorm_min}D+`)
    if (r.banos_min) partes.push(`${r.banos_min}B+`)
    return partes.join(' · ') || '—'
  }

  // matches calculados al vuelo para el requerimiento abierto
  const matches = useMemo(() => {
    if (!viendoMatches || !cartera.cargada) return null
    const res = buscarMatches(viendoMatches, cartera.pubs, cartera.edis, VALOR_UF)
    // dedupe: una misma propiedad puede tener varias publicaciones activas
    const vistos = new Set()
    const unicos = []
    for (const m of res) {
      const k = [sinTildes(m.pub.comuna), sinTildes(m.pub.direccionreal || m.pub.direccion), sinTildes(m.pub.departamento)].join('|')
      if (vistos.has(k)) continue
      vistos.add(k)
      unicos.push(m)
    }
    return unicos
  }, [viendoMatches, cartera])

  if (status === 'loading') return <div style={{ padding: 40, color: '#888' }}>Cargando…</div>
  if (status === 'authenticated' && !esAdmin) return null

  // estilos breves
  const input = { padding: '8px 10px', borderRadius: 7, border: '1px solid #E5E7EB', fontSize: 13, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }
  const label = { fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4, display: 'block' }
  const card = { background: '#fff', border: '1px solid #E8E6E0', borderRadius: 12, padding: 20, marginBottom: 16 }
  const chipRojo = { fontSize: 12, padding: '3px 8px', borderRadius: 20, background: '#fef2f2', color: '#dc2626', border: '1px solid #dc2626' }
  const chipVerde = { fontSize: 12, padding: '3px 8px', borderRadius: 20, background: '#f0fdf4', color: '#16a34a', border: '1px solid #16a34a' }

  // ───────────── MATCHES (Entrega 2) ─────────────
  if (viendoMatches !== null) {
    const r = viendoMatches
    const cliente = r.nombre_suelto || (r.contacto_id ? '(contacto ligado)' : 'Cliente')
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24, fontFamily: '"DM Sans", sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>
            Matches de {cliente} <span style={{ fontSize: 13, color: '#888', fontWeight: 400 }}>· Venta</span>
          </h1>
          <button onClick={() => setViendoMatches(null)} style={{ ...input, width: 'auto', cursor: 'pointer', background: '#F0EEE8' }}>← Volver</button>
        </div>

        {/* resumen del requerimiento */}
        <div style={card}>
          <div style={{ fontSize: 13, color: '#374151', marginBottom: 6 }}>{resumen(r)}</div>
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: (r.amenities_oblig?.length || r.amenities_desea?.length) ? 8 : 0 }}>
            Zona: {r.comunas?.length ? r.comunas.join(', ') : 'cualquier comuna'}
          </div>
          {(r.amenities_oblig?.length || r.amenities_desea?.length) ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(r.amenities_oblig || []).map(a => <span key={'o' + a} style={chipRojo}>● {LABEL_AMENITY[a] || a}</span>)}
              {(r.amenities_desea || []).map(a => <span key={'d' + a} style={chipVerde}>+ {LABEL_AMENITY[a] || a}</span>)}
            </div>
          ) : null}
        </div>

        {/* resultados */}
        {(!cartera.cargada || cartera.cargando) ? (
          <div style={{ ...card, color: '#888' }}>Calculando matches…</div>
        ) : !matches || matches.length === 0 ? (
          <div style={{ ...card, textAlign: 'center', color: '#888', padding: 40 }}>
            0 propiedades calzan con este requerimiento.<br />
            Prueba aflojando criterios: precio, amenities obligatorias o zona.
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: '#374151', margin: '4px 2px 12px' }}>
              {matches.length} {matches.length === 1 ? 'propiedad calza' : 'propiedades calzan'} · ordenadas por grado
            </div>
            <div style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#FAFAF8', borderBottom: '1px solid #E8E6E0' }}>
                    {['Grado', 'Propiedad', 'Comuna', 'Precio', 'D/B/E', 'M² const', 'Por qué calza', ''].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: .5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matches.map(m => {
                    const p = m.pub
                    const dir = p.direccionreal || p.direccion || [p.calle, p.numero_calle].filter(Boolean).join(' ') || '—'
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#EAF3DE', color: '#3B6D11' }}>{m.grado}</span>
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1a1a2e' }}>
                          {p.tipo || '—'}<div style={{ fontWeight: 400, color: '#888', fontSize: 11 }}>{dir}{p.departamento ? ' · Depto ' + p.departamento : ''}</div>
                        </td>
                        <td style={{ padding: '10px 12px', color: '#555' }}>{p.comuna || '—'}</td>
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{fmtPrecio(p)}</td>
                        <td style={{ padding: '10px 12px', color: '#555', whiteSpace: 'nowrap' }}>{(p.dormitorios ?? '—')}/{(p.banos ?? '—')}/{(p.estacionamientos ?? '—')}</td>
                        <td style={{ padding: '10px 12px', color: '#555' }}>{p.mt2_const || '—'}</td>
                        <td style={{ padding: '10px 12px', color: '#555', fontSize: 11 }}>
                          {(m.motivos && m.motivos.length) ? (
                            m.motivos.map((mo, i) => <span key={i} style={{ display: 'inline-block', background: '#F0EEE8', borderRadius: 10, padding: '2px 8px', marginRight: 4, marginBottom: 3 }}>{mo}</span>)
                          ) : (
                            <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>cumple tipo, precio y zona</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button onClick={() => router.push('/publicaciones/' + p.id)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #185FA5', background: '#E6F1FB', color: '#185FA5', cursor: 'pointer', fontFamily: 'inherit' }}>Ver ficha →</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    )
  }

  // ───────────── FORMULARIO ─────────────
  if (editando !== null) {
    // comunas que calzan con lo que se escribe y aun no estan elegidas
    const comunasSugeridas = comunaQuery.trim()
      ? COMUNAS_LISTA.filter(c => sinTildes(c).includes(sinTildes(comunaQuery)) && !form.comunas.includes(c)).slice(0, 12)
      : []

    return (
      <div style={{ maxWidth: 920, margin: '0 auto', padding: 24, fontFamily: '"DM Sans", sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>
            {editando.id ? 'Editar requerimiento' : 'Nuevo requerimiento'} <span style={{ fontSize: 13, color: '#888', fontWeight: 400 }}>· Venta</span>
          </h1>
          <button onClick={() => setEditando(null)} style={{ ...input, width: 'auto', cursor: 'pointer', background: '#F0EEE8' }}>← Volver</button>
        </div>

        {msg && <div style={{ ...card, background: msg.tipo === 'error' ? '#fef2f2' : '#f0fdf4', color: msg.tipo === 'error' ? '#dc2626' : '#16a34a', padding: 12 }}>{msg.txt}</div>}

        {/* Cliente */}
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 12 }}>Cliente</div>
          {contactoSel ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 13, padding: '6px 10px', background: '#E6F1FB', borderRadius: 7, color: '#185FA5' }}>
                🔗 {contactoSel.nombre} {contactoSel.apellido || ''} {contactoSel.telefono ? '· ' + contactoSel.telefono : ''}
              </span>
              <button onClick={quitarContacto} style={{ ...input, width: 'auto', cursor: 'pointer', fontSize: 11 }}>Quitar</button>
            </div>
          ) : (
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <label style={label}>Buscar contacto existente</label>
              <input style={input} value={contactoQuery} onChange={e => buscarContacto(e.target.value)} placeholder="Nombre, apellido o teléfono…" />
              {contactoResultados.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, marginTop: 2, zIndex: 10, maxHeight: 200, overflowY: 'auto' }}>
                  {contactoResultados.map(c => (
                    <div key={c.id} onClick={() => elegirContacto(c)} style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', borderBottom: '1px solid #F3F4F6' }}>
                      {c.nombre} {c.apellido || ''} <span style={{ color: '#888' }}>{c.telefono || c.email || ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>O ingresa los datos sueltos (si no está en contactos, se agrega solo a la BD al guardar):</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div><label style={label}>Nombre</label><input style={input} value={form.nombre_suelto} onChange={e => set('nombre_suelto', e.target.value)} /></div>
            <div><label style={label}>Teléfono</label><input style={input} value={form.telefono_suelto} onChange={e => set('telefono_suelto', e.target.value)} /></div>
            <div><label style={label}>Email</label><input style={input} value={form.email_suelto} onChange={e => set('email_suelto', e.target.value)} /></div>
          </div>
        </div>

        {/* Qué busca */}
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 12 }}>Qué busca</div>
          <div style={{ marginBottom: 12 }}>
            <label style={label}>Tipo de propiedad</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {TIPOS.map(t => (
                <button key={t} onClick={() => toggleEnArray('tipos', t)} style={{
                  padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                  border: '1px solid ' + (form.tipos.includes(t) ? '#185FA5' : '#E5E7EB'),
                  background: form.tipos.includes(t) ? '#E6F1FB' : '#fff',
                  color: form.tipos.includes(t) ? '#185FA5' : '#555',
                }}>{t}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div><label style={label}>Precio mínimo</label><input style={input} type="number" value={form.precio_min} onChange={e => set('precio_min', e.target.value)} /></div>
            <div><label style={label}>Precio máximo</label><input style={input} type="number" value={form.precio_max} onChange={e => set('precio_max', e.target.value)} /></div>
            <div><label style={label}>Moneda</label>
              <select style={input} value={form.moneda} onChange={e => set('moneda', e.target.value)}>
                <option value="UF">UF</option><option value="CLP">Pesos</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
            <div><label style={label}>Dorm. mín</label><input style={input} type="number" value={form.dorm_min} onChange={e => set('dorm_min', e.target.value)} /></div>
            <div><label style={label}>Baños mín</label><input style={input} type="number" value={form.banos_min} onChange={e => set('banos_min', e.target.value)} /></div>
            <div><label style={label}>Estac. mín</label><input style={input} type="number" value={form.estac_min} onChange={e => set('estac_min', e.target.value)} /></div>
            <div><label style={label}>M² const. mín</label><input style={input} type="number" value={form.mt2_const_min} onChange={e => set('mt2_const_min', e.target.value)} /></div>
            <div><label style={label}>M² terreno mín</label><input style={input} type="number" value={form.mt2_terreno_min} onChange={e => set('mt2_terreno_min', e.target.value)} /></div>
          </div>
        </div>

        {/* Zona (combobox) */}
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 12 }}>Zona (comunas)</div>
          {form.comunas.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {form.comunas.map(c => (
                <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px 4px 10px', borderRadius: 20, fontSize: 12, background: '#E6F1FB', color: '#185FA5', border: '1px solid #185FA5' }}>
                  {c}
                  <span onClick={() => toggleEnArray('comunas', c)} title="Quitar" style={{ cursor: 'pointer', fontWeight: 700, lineHeight: 1, fontSize: 14 }}>×</span>
                </span>
              ))}
            </div>
          )}
          <div style={{ position: 'relative' }}>
            <input
              style={input}
              value={comunaQuery}
              onChange={e => setComunaQuery(e.target.value)}
              placeholder="Escribe una comuna para agregarla…"
            />
            {comunasSugeridas.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, marginTop: 2, zIndex: 10, maxHeight: 220, overflowY: 'auto' }}>
                {comunasSugeridas.map(c => (
                  <div key={c} onClick={() => { toggleEnArray('comunas', c); setComunaQuery('') }} style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', borderBottom: '1px solid #F3F4F6' }}>{c}</div>
                ))}
              </div>
            )}
            {comunaQuery.trim() && comunasSugeridas.length === 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, marginTop: 2, zIndex: 10, padding: '8px 12px', fontSize: 12, color: '#888' }}>Sin coincidencias</div>
            )}
          </div>
          {form.comunas.length === 0 && <div style={{ fontSize: 11, color: '#888', marginTop: 8 }}>Sin comunas = cualquier comuna.</div>}
        </div>

        {/* Amenities (un solo bloque, tri-estado) */}
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>Amenities</div>
          <div style={{ fontSize: 11, marginBottom: 12, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <span style={{ color: '#dc2626' }}>● obligatoria (1 clic)</span>
            <span style={{ color: '#16a34a' }}>+ deseable (2 clics)</span>
            <span style={{ color: '#9ca3af' }}>○ quitar (3 clics)</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {AMENITIES.map(([k, lab]) => {
              const st = estadoAmenity(k)
              const col = st === 'oblig' ? '#dc2626' : st === 'desea' ? '#16a34a' : '#555'
              const bg = st === 'oblig' ? '#fef2f2' : st === 'desea' ? '#f0fdf4' : '#fff'
              const bd = st === 'oblig' ? '#dc2626' : st === 'desea' ? '#16a34a' : '#E5E7EB'
              const pre = st === 'oblig' ? '● ' : st === 'desea' ? '+ ' : ''
              return (
                <button key={k} onClick={() => ciclarAmenity(k)} style={{
                  padding: '4px 10px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                  border: '1px solid ' + bd, background: bg, color: col,
                  fontWeight: st === 'none' ? 400 : 600,
                }}>{pre}{lab}</button>
              )
            })}
          </div>
        </div>

        {/* Gestión */}
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 12 }}>Gestión</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div><label style={label}>Fuente</label>
              <select style={input} value={form.fuente} onChange={e => set('fuente', e.target.value)}>
                {FUENTES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div><label style={label}>Comercial</label>
              <select style={input} value={form.vendedor} onChange={e => set('vendedor', e.target.value)}>
                <option value="">—</option>
                {OPTS_VENDEDOR.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div><label style={label}>Estado</label>
              <select style={input} value={form.estado} onChange={e => set('estado', e.target.value)}>
                <option value="activo">Activo</option><option value="pausado">Pausado</option><option value="cerrado">Cerrado</option>
              </select>
            </div>
          </div>
          <div><label style={label}>Notas</label><textarea style={{ ...input, minHeight: 60, resize: 'vertical' }} value={form.notas} onChange={e => set('notas', e.target.value)} placeholder="Ej. cerca de metro, colegio X, orientación norte…" /></div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={() => setEditando(null)} style={{ ...input, width: 'auto', cursor: 'pointer', background: '#F0EEE8' }}>Cancelar</button>
          <button onClick={guardar} disabled={guardando} style={{ ...input, width: 'auto', cursor: 'pointer', background: '#185FA5', color: '#fff', border: 'none', fontWeight: 600, opacity: guardando ? 0.6 : 1 }}>
            {guardando ? 'Guardando…' : (editando.id ? 'Guardar cambios' : 'Crear requerimiento')}
          </button>
        </div>
      </div>
    )
  }

  // ───────────── LISTADO ─────────────
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24, fontFamily: '"DM Sans", sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>Requerimientos</h1>
        <button onClick={nuevo} style={{ padding: '8px 16px', borderRadius: 8, background: '#185FA5', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>+ Nuevo requerimiento</button>
      </div>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>Lo que buscan los clientes · operación venta</div>

      {loading ? (
        <div style={{ color: '#888' }}>Cargando…</div>
      ) : reqs.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: '#888', padding: 40 }}>
          No hay requerimientos aún. Crea el primero con "+ Nuevo requerimiento".
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#FAFAF8', borderBottom: '1px solid #E8E6E0' }}>
                {['Cliente', 'Qué busca', 'Zona', 'Amenities', 'Fuente', 'Comercial', 'Estado', ''].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: .5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reqs.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{r.nombre_suelto || (r.contacto_id ? '(contacto ligado)' : '—')}<div style={{ fontWeight: 400, color: '#888', fontSize: 11 }}>{r.telefono_suelto || ''}</div></td>
                  <td style={{ padding: '10px 12px' }}>{resumen(r)}</td>
                  <td style={{ padding: '10px 12px', color: '#555' }}>{r.comunas?.length ? r.comunas.join(', ') : 'Cualquiera'}</td>
                  <td style={{ padding: '10px 12px', color: '#555', fontSize: 11 }}>
                    {r.amenities_oblig?.length ? <span style={{ color: '#dc2626' }}>{r.amenities_oblig.map(a => LABEL_AMENITY[a] || a).join(', ')}</span> : null}
                    {r.amenities_oblig?.length && r.amenities_desea?.length ? <span style={{ color: '#bbb' }}> · </span> : null}
                    {r.amenities_desea?.length ? <span style={{ color: '#16a34a' }}>{r.amenities_desea.map(a => LABEL_AMENITY[a] || a).join(', ')}</span> : null}
                    {!r.amenities_oblig?.length && !r.amenities_desea?.length ? '—' : null}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#555' }}>{r.fuente || '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#555' }}>{r.vendedor || '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: r.estado === 'activo' ? '#EAF3DE' : '#f3f4f6', color: r.estado === 'activo' ? '#3B6D11' : '#6b7280' }}>{r.estado}</span>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button onClick={() => verMatches(r)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #3B6D11', background: '#EAF3DE', color: '#3B6D11', cursor: 'pointer', marginRight: 6, fontFamily: 'inherit' }}>Matches</button>
                    <button onClick={() => editar(r)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #185FA5', background: '#E6F1FB', color: '#185FA5', cursor: 'pointer', marginRight: 6, fontFamily: 'inherit' }}>Editar</button>
                    <button onClick={() => eliminar(r)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #dc2626', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontFamily: 'inherit' }}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
