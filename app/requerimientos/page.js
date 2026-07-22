'use client'
// VERSION: v2 · 2026-07-21 · Los comerciales (roles comercial/ventas) entran y trabajan aquí, viendo
//   SOLO sus propios requerimientos. Dirección/admin ven todos. Antes solo entraba Dirección.
import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'
import { COMUNAS_LISTA } from '../../lib/comunas.js'
import { buscarMatches } from '../../lib/matching.js'
import ZonaModal from '../components/ZonaModal'

const DIRECCION_EMAILS = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com']
// Roles que usan esta pantalla como herramienta de trabajo (entran y gestionan lo suyo).
const ROLES_COMERCIAL = ['comercial', 'ventas']
// Puente email -> nombre del comercial (los datos guardan el NOMBRE en requerimientos.vendedor).
const COMERCIAL_POR_EMAIL = {
  'lorena.sanmartin@fondocapital.com': 'Lorena',
  'tirza.chavez@fondocapital.com':     'Tirza',
  'neika.duque@fondocapital.com':      'Neika',
}
const nombreComercial = (em) => {
  if (!em) return ''
  if (COMERCIAL_POR_EMAIL[em]) return COMERCIAL_POR_EMAIL[em]
  const p = String(em).split('@')[0].split('.')[0]
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : ''
}

const TIPOS = ['Departamento', 'Casa', 'Oficina', 'Local', 'Terreno', 'Parcela', 'Bodega', 'Industrial']
const OPTS_VENDEDOR = ['Alberto', 'Adalis', 'Fabiola', 'Lorena', 'Pedro', 'Neika', 'Tirza', 'Karina']
const FUENTES = ['manual', 'PI', 'web', 'landing', 'redes', 'referido']

// ===== PIPELINE: etapas (configurables: agregar/quitar aqui) =====
const ETAPAS = [
  { key: 'nuevo',      label: 'Nuevo',      color: '#6b7280' },
  { key: 'contactado', label: 'Contactado', color: '#0C447C' },
  { key: 'visita',     label: 'Visita',     color: '#7c3aed' },
  { key: 'oferta',     label: 'Oferta',     color: '#d97706' },
  { key: 'cerrado',    label: 'Cerrado',    color: '#16a34a' },
  { key: 'descartado', label: 'Descartado', color: '#dc2626' },
]
const ETAPA_DEFAULT = 'nuevo'

// ===== CAPA 2: ordenes de visita =====
const ESTADOS_VISITA = ['agendada', 'realizada', 'cancelada']
const COLOR_ESTADO_VISITA = { agendada: '#7c3aed', realizada: '#16a34a', cancelada: '#dc2626' }
const RESULTADOS_PROP = ['pendiente', 'interesado', 'descartado']
const hoyISO = () => new Date().toISOString().slice(0, 10)

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

// fecha corta dd/mm/aa
const fmtFechaCorta = s => {
  if (!s) return ''
  const d = new Date(s)
  if (isNaN(d)) return ''
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

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
  zona_poligono: null,
  notas: '', fuente: 'manual', estado: 'activo', vendedor: '',
}

export default function RequerimientosPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const email = session?.user?.email
  const rol = session?.user?.role
  const esAdmin = rol === 'admin' || DIRECCION_EMAILS.includes(email)
  const puedeUsar = esAdmin || ROLES_COMERCIAL.includes(rol)   // entrar y actuar
  const miNombre = rol === 'comercial' ? nombreComercial(email) : ''   // 'ventas' y Dirección ven todo        // '' = ve todos (Dirección)

  const [reqs, setReqs] = useState([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(null) // null = lista; {} o {...} = form
  const [form, setForm] = useState(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)

  // vista del listado: 'lista' (tabla) | 'pipeline' (kanban)
  const [vista, setVista] = useState('lista')
  const [dragId, setDragId] = useState(null)
  const [filtroComercial, setFiltroComercial] = useState('')

  // buscador de contacto
  const [contactoQuery, setContactoQuery] = useState('')
  const [contactoResultados, setContactoResultados] = useState([])
  const [contactoSel, setContactoSel] = useState(null)

  // buscador de comunas (combobox)
  const [comunaQuery, setComunaQuery] = useState('')
  const [zonaOpen, setZonaOpen] = useState(false)

  // matches (Entrega 2): vista de propiedades que calzan
  const [viendoMatches, setViendoMatches] = useState(null)
  const [cartera, setCartera] = useState({ pubs: [], edis: [], canje: [], cargada: false, cargando: false })

  // visitas (Capa 2)
  const [visitas, setVisitas] = useState([])
  const [agendando, setAgendando] = useState(null)   // requerimiento al que se le agenda
  const [vForm, setVForm] = useState(null)           // form de la orden de visita
  const [guardandoVisita, setGuardandoVisita] = useState(false)
  const [generandoOrden, setGenerandoOrden] = useState(null)  // id de visita generando orden
  const [pubPicker, setPubPicker] = useState('')     // id seleccionado en el picker de propiedades
  const [pubSearch, setPubSearch] = useState('')     // búsqueda manual de cualquier propiedad activa

  useEffect(() => {
    if (status === 'authenticated' && !puedeUsar) router.replace('/')
  }, [status, puedeUsar, router])

  useEffect(() => {
    if (puedeUsar) { cargar(); cargarVisitas() }
  }, [puedeUsar])

  // al entrar al pipeline, cargar la cartera para poder contar matches por tarjeta
  useEffect(() => {
    if (vista === 'pipeline') cargarCartera()
  }, [vista])

  async function cargar() {
    setLoading(true)
    const { data, error } = await supabase
      .from('requerimientos')
      .select('*')
      .order('created_at', { ascending: false })
    // Comercial/ventas: solo sus requerimientos. Dirección (miNombre = '') ve todos.
    const lista = data || []
    if (!error) setReqs(miNombre ? lista.filter(r => String(r.vendedor || '') === miNombre) : lista)
    setLoading(false)
  }

  // carga (una vez por sesion) las publicaciones de venta activas + edificios para el matching
  async function cargarCartera() {
    if (cartera.cargada || cartera.cargando) return
    setCartera(c => ({ ...c, cargando: true }))
    const { data: edis } = await supabase.from('edificios').select('*')
    const cols = 'id, codigo, latitud, longitud, comuna, region, calle, numero_calle, departamento, direccion, direccionreal, objetivo, tipo, tipo_moneda, valor, dormitorios, banos, estacionamientos, mt2_const, mt2_terreno, activo, tiene_piscina_propia, tiene_quincho_propio, tiene_jardin, tiene_terraza, tiene_patio, tiene_logia, tiene_walking_closet, tiene_bodega_propia, tiene_calefaccion, tiene_aire_acondicionado, has_laundry, has_security, has_balcony, amoblado, ksuitable_for_pets, has_maid_room'
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
    // propiedades de canje (otros corredores). Mismos nombres de campo que publicaciones,
    // por eso el motor las procesa igual. Las marcamos con _origen y _corredor.
    let canje = []
    try {
      const { data: pc } = await supabase
        .from('propiedades_canje').select('*').eq('activa', true)
      canje = (pc || [])
        .filter(p => sinTildes(p.objetivo).includes('venta'))
        .map(p => ({ ...p, _origen: 'canje', _corredor: p.corredor_origen || 'Canje' }))
    } catch (e) { console.error('canje:', e) }
    setCartera({ pubs: venta, edis: edis || [], canje, cargada: true, cargando: false })
  }

  async function verMatches(r) {
    setMsg(null)
    setViendoMatches(r)
    await cargarCartera()
  }

  // ===== CAPA 2: visitas =====
  async function cargarVisitas() {
    const { data, error } = await supabase
      .from('visitas')
      .select('*, visita_propiedades(*), ordenes_visita(*)')
      .order('fecha', { ascending: true })
    if (!error) setVisitas(data || [])
  }

  const visitasDeReq = (reqId) => visitas.filter(v => v.requerimiento_id === reqId)

  // proxima visita agendada (de hoy en adelante) de un requerimiento, para el badge del kanban
  const proximaVisita = (reqId) => {
    const h = hoyISO()
    return visitasDeReq(reqId)
      .filter(v => v.estado === 'agendada' && v.fecha >= h)
      .sort((a, b) => (a.fecha + (a.hora || '')).localeCompare(b.fecha + (b.hora || '')))[0] || null
  }

  function etiquetaPub(p) {
    const dir = p.direccionreal || p.direccion || [p.calle, p.numero_calle].filter(Boolean).join(' ') || 'sin direccion'
    return `${p.tipo || 'Propiedad'} · ${dir}${p.departamento ? ' · Depto ' + p.departamento : ''}${p.comuna ? ' · ' + p.comuna : ''}`
  }

  // abre el modal de orden de visita; pub opcional (cuando se agenda desde un match)
  function abrirAgenda(req, pub) {
    setMsg(null)
    setAgendando(req)
    setPubPicker('')
    setPubSearch('')
    setVForm({
      fecha: '', hora: '', comercial: req.vendedor || '', estado: 'agendada', notas: '',
      propiedades: pub ? [{ publicacion_id: pub.id, label: etiquetaPub(pub), resultado: 'pendiente', notas: '' }] : [],
      generarOrden: true,
    })
    cargarCartera() // para poder elegir propiedades desde los matches del req
  }
  function cerrarAgenda() { setAgendando(null); setVForm(null); setPubPicker(''); setPubSearch('') }

  function agregarPubAVisita(pub) {
    setVForm(f => {
      if (!f) return f
      if (f.propiedades.some(p => p.publicacion_id === pub.id)) return f
      return { ...f, propiedades: [...f.propiedades, { publicacion_id: pub.id, label: etiquetaPub(pub), resultado: 'pendiente', notas: '' }] }
    })
    setPubPicker('')
    setPubSearch('')
  }
  function quitarPubDeVisita(id) {
    setVForm(f => f ? { ...f, propiedades: f.propiedades.filter(p => p.publicacion_id !== id) } : f)
  }
  function setPropCampo(id, campo, valor) {
    setVForm(f => f ? { ...f, propiedades: f.propiedades.map(p => p.publicacion_id === id ? { ...p, [campo]: valor } : p) } : f)
  }

  async function guardarVisita() {
    if (!vForm.fecha) { setMsg({ tipo: 'error', txt: 'La fecha de la visita es obligatoria.' }); return }
    setGuardandoVisita(true); setMsg(null)
    const req = agendando
    const cab = {
      requerimiento_id: req.id,
      contacto_id: req.contacto_id || null,
      cliente_nombre: req.nombre_suelto || null,
      cliente_telefono: req.telefono_suelto || null,
      cliente_email: req.email_suelto || null,
      fecha: vForm.fecha,
      hora: vForm.hora || null,
      comercial: vForm.comercial || null,
      estado: vForm.estado || 'agendada',
      notas: vForm.notas || null,
      updated_at: new Date().toISOString(),
    }
    const { data: vis, error: e1 } = await supabase.from('visitas').insert(cab).select('id').single()
    if (e1) { setMsg({ tipo: 'error', txt: 'Error creando la visita: ' + e1.message }); setGuardandoVisita(false); return }
    if (vForm.propiedades.length) {
      const detalle = vForm.propiedades.map((p, i) => ({
        visita_id: vis.id, publicacion_id: p.publicacion_id, orden: i + 1,
        resultado: p.resultado || null, notas: p.notas || null,
      }))
      const { error: e2 } = await supabase.from('visita_propiedades').insert(detalle)
      if (e2) setMsg({ tipo: 'error', txt: 'Visita creada, pero fallo el detalle de propiedades: ' + e2.message })
    }
    // al agendar, llevar la tarjeta a "Visita" si venia antes en el pipeline
    const etapaActual = req.etapa || ETAPA_DEFAULT
    if (etapaActual === 'nuevo' || etapaActual === 'contactado') {
      await supabase.from('requerimientos').update({ etapa: 'visita', updated_at: new Date().toISOString() }).eq('id', req.id)
    }
    // auto-generar la orden de visita (no romper el guardado si falla)
    let ordenOk = false
    if (vForm.generarOrden) {
      try {
        const res = await fetch('/api/ordenes/generar', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visita_id: vis.id }),
        })
        ordenOk = res.ok
      } catch (_) { /* la visita igual quedo guardada */ }
    }
    setGuardandoVisita(false)
    // dejar el modal abierto mostrando la visita + su orden (para firmar en el momento si se quiere)
    setVForm({ fecha: '', hora: '', comercial: req.vendedor || '', estado: 'agendada', notas: '', propiedades: [], generarOrden: true })
    setPubPicker(''); setPubSearch('')
    setMsg({ tipo: 'ok', txt: vForm.generarOrden ? (ordenOk ? 'Visita guardada y orden generada. Abajo puedes copiar el link o abrir la firma.' : 'Visita guardada (no se pudo generar la orden; puedes generarla con el botón).') : 'Visita guardada.' })
    await Promise.all([cargar(), cargarVisitas()])
  }

  async function cambiarEstadoVisita(v, estado) {
    await supabase.from('visitas').update({ estado, updated_at: new Date().toISOString() }).eq('id', v.id)
    await cargarVisitas()
  }
  async function eliminarVisita(v) {
    if (!window.confirm('¿Eliminar esta visita? Se borra también su detalle de propiedades.')) return
    await supabase.from('visitas').delete().eq('id', v.id) // el detalle cae por ON DELETE CASCADE
    await cargarVisitas()
  }

  // genera (o regenera) la orden de visita en PDF y la deja lista para firmar
  async function generarOrden(v) {
    setGenerandoOrden(v.id); setMsg(null)
    try {
      const res = await fetch('/api/ordenes/generar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visita_id: v.id }),
      })
      const j = await res.json()
      if (!res.ok) setMsg({ tipo: 'error', txt: j.error || 'No se pudo generar la orden.' })
      else await cargarVisitas()
    } catch (e) {
      setMsg({ tipo: 'error', txt: 'Error: ' + e.message })
    }
    setGenerandoOrden(null)
  }

  function copiarLinkFirma(orden) {
    const link = `${window.location.origin}/firmar/${orden.token}`
    if (navigator.clipboard) navigator.clipboard.writeText(link).then(() => setMsg({ tipo: 'ok', txt: 'Link de firma copiado al portapapeles.' }))
    else window.prompt('Copia el link de firma:', link)
  }

  // mover un requerimiento de etapa (drag & drop). Update optimista + persistir.
  async function moverEtapa(id, etapa) {
    const antes = reqs.find(r => r.id === id)
    if (!antes || (antes.etapa || ETAPA_DEFAULT) === etapa) return
    setReqs(rs => rs.map(r => r.id === id ? { ...r, etapa } : r))
    const { error } = await supabase
      .from('requerimientos')
      .update({ etapa, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) {
      // revertir si falla
      setReqs(rs => rs.map(r => r.id === id ? { ...r, etapa: antes.etapa || ETAPA_DEFAULT } : r))
      setMsg({ tipo: 'error', txt: 'No se pudo mover: ' + error.message })
    }
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
      zona_poligono: r.zona_poligono || null,
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
      zona_poligono: (Array.isArray(form.zona_poligono) && form.zona_poligono.length >= 3) ? form.zona_poligono : null,
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
      // etapa NO se envia en alta: la BD pone el default ('nuevo')
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

  // resumen compacto para la tarjeta del pipeline (tipo + precio max)
  function resumenCorto(r) {
    const partes = []
    if (r.tipos?.length) partes.push(r.tipos.join('/'))
    if (r.precio_max) partes.push(`${r.moneda} ${Number(r.precio_max).toLocaleString('es-CL')}`)
    return partes.join(' · ') || '—'
  }

  // matches calculados al vuelo para el requerimiento abierto
  const matches = useMemo(() => {
    if (!viendoMatches || !cartera.cargada) return null
    const resPropias = buscarMatches(viendoMatches, cartera.pubs, cartera.edis, VALOR_UF)
    const resCanje = buscarMatches(viendoMatches, cartera.canje, [], VALOR_UF)
    const res = [...resPropias, ...resCanje] // propias primero, luego canje
    // dedupe: una misma propiedad puede tener varias publicaciones activas
    const vistos = new Set()
    const unicos = []
    for (const m of res) {
      const k = m.pub._origen === 'canje'
        ? 'canje:' + m.pub.id
        : [sinTildes(m.pub.comuna), sinTildes(m.pub.direccionreal || m.pub.direccion), sinTildes(m.pub.departamento)].join('|')
      if (vistos.has(k)) continue
      vistos.add(k)
      unicos.push(m)
    }
    return unicos
  }, [viendoMatches, cartera])

  // conteo de matches por requerimiento (para la tarjeta del pipeline)
  const matchesCount = useMemo(() => {
    if (!cartera.cargada) return {}
    const out = {}
    for (const r of reqs) {
      const res = [
        ...buscarMatches(r, cartera.pubs, cartera.edis, VALOR_UF),
        ...buscarMatches(r, cartera.canje, [], VALOR_UF),
      ]
      const vistos = new Set()
      let n = 0
      for (const m of res) {
        const k = [sinTildes(m.pub.comuna), sinTildes(m.pub.direccionreal || m.pub.direccion), sinTildes(m.pub.departamento)].join('|')
        if (vistos.has(k)) continue
        vistos.add(k)
        n++
      }
      out[r.id] = n
    }
    return out
  }, [reqs, cartera])

  // matches del requerimiento que se esta agendando (para el picker de propiedades del modal)
  const matchesAgenda = useMemo(() => {
    if (!agendando || !cartera.cargada) return []
    const res = buscarMatches(agendando, cartera.pubs, cartera.edis, VALOR_UF)
    const vistos = new Set()
    const unicos = []
    for (const m of res) {
      const k = [sinTildes(m.pub.comuna), sinTildes(m.pub.direccionreal || m.pub.direccion), sinTildes(m.pub.departamento)].join('|')
      if (vistos.has(k)) continue
      vistos.add(k)
      unicos.push(m)
    }
    return unicos
  }, [agendando, cartera])

  if (status === 'loading') return <div style={{ padding: 40, color: '#888' }}>Cargando…</div>
  if (status === 'authenticated' && !puedeUsar) return null

  // estilos breves
  const input = { padding: '8px 10px', borderRadius: 7, border: '1px solid #E5E7EB', fontSize: 13, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }
  const label = { fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4, display: 'block' }
  const card = { background: '#fff', border: '1px solid #E8E6E0', borderRadius: 12, padding: 20, marginBottom: 16 }
  const chipRojo = { fontSize: 12, padding: '3px 8px', borderRadius: 20, background: '#fef2f2', color: '#dc2626', border: '1px solid #dc2626' }
  const chipVerde = { fontSize: 12, padding: '3px 8px', borderRadius: 20, background: '#f0fdf4', color: '#16a34a', border: '1px solid #16a34a' }

  // ===== CAPA 2: modal "orden de visita" (overlay; se inserta en pipeline y en matches) =====
  const modalAgenda = (agendando && vForm) ? (() => {
    const req = agendando
    const cliente = req.nombre_suelto || (req.contacto_id ? '(contacto ligado)' : 'Cliente')
    const tel = (req.telefono_suelto || '').trim()
    const existentes = visitasDeReq(req.id)
    const yaElegidas = new Set(vForm.propiedades.map(p => p.publicacion_id))
    const opcionesPub = matchesAgenda.filter(m => !yaElegidas.has(m.pub.id))
    // búsqueda manual: cualquier propiedad activa de la cartera (no solo los matches)
    const qPub = sinTildes(pubSearch)
    const pubResultados = qPub.length < 2 ? [] : cartera.pubs
      .filter(p => !yaElegidas.has(p.id))
      .filter(p => {
        const dir = sinTildes(p.direccionreal || p.direccion || [p.calle, p.numero_calle].filter(Boolean).join(' '))
        return sinTildes(p.codigo).includes(qPub) || dir.includes(qPub) || sinTildes(p.comuna).includes(qPub)
      })
      .slice(0, 8)
    const miniBtn = { fontSize: 11, padding: '3px 8px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid' }
    return (
      <div onClick={cerrarAgenda} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '40px 16px' }}>
        <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 640, boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}>
          {/* header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #EEE' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>Agendar visita</div>
              <div style={{ fontSize: 12, color: '#888' }}>{cliente}{tel ? ' · ' + tel : ''}</div>
            </div>
            <button onClick={cerrarAgenda} style={{ ...input, width: 'auto', cursor: 'pointer', background: '#F0EEE8' }}>×</button>
          </div>

          <div style={{ padding: 20 }}>
            {msg && <div style={{ marginBottom: 14, padding: 10, borderRadius: 8, fontSize: 13, background: msg.tipo === 'error' ? '#fef2f2' : '#f0fdf4', color: msg.tipo === 'error' ? '#dc2626' : '#16a34a' }}>{msg.txt}</div>}

            {/* visitas ya agendadas para este requerimiento */}
            {existentes.length > 0 && (
              <div style={{ marginBottom: 18, border: '1px solid #EEE', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: .5, padding: '8px 12px', background: '#FAFAF8' }}>Visitas de este cliente ({existentes.length})</div>
                {existentes.map(v => {
                  const orden = (v.ordenes_visita || [])[0]
                  return (
                  <div key={v.id} style={{ padding: '8px 12px', borderTop: '1px solid #F3F4F6' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ fontSize: 12, color: '#374151' }}>
                        <span style={{ fontWeight: 700 }}>{fmtFechaCorta(v.fecha)}{v.hora ? ' ' + v.hora.slice(0, 5) : ''}</span>
                        {v.comercial ? <span style={{ color: '#9ca3af' }}> · {v.comercial}</span> : null}
                        {v.visita_propiedades?.length ? <span style={{ color: '#9ca3af' }}> · {v.visita_propiedades.length} prop.</span> : null}
                        <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 20, color: COLOR_ESTADO_VISITA[v.estado] || '#6b7280', background: '#fff', border: '1px solid ' + (COLOR_ESTADO_VISITA[v.estado] || '#ddd') }}>{v.estado}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                        {v.estado !== 'realizada' && <button onClick={() => cambiarEstadoVisita(v, 'realizada')} style={{ ...miniBtn, borderColor: '#16a34a', background: '#f0fdf4', color: '#16a34a' }}>Realizada</button>}
                        {v.estado !== 'cancelada' && <button onClick={() => cambiarEstadoVisita(v, 'cancelada')} style={{ ...miniBtn, borderColor: '#d97706', background: '#fffbeb', color: '#b45309' }}>Cancelar</button>}
                        <button onClick={() => eliminarVisita(v)} style={{ ...miniBtn, borderColor: '#dc2626', background: '#fef2f2', color: '#dc2626' }}>Eliminar</button>
                      </div>
                    </div>

                    {/* orden de visita (PDF + firma) */}
                    <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed #EFEFEF', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {!orden ? (
                        <button onClick={() => generarOrden(v)} disabled={generandoOrden === v.id} style={{ ...miniBtn, borderColor: '#0C447C', background: '#E6F1FB', color: '#0C447C', opacity: generandoOrden === v.id ? 0.6 : 1 }}>
                          {generandoOrden === v.id ? 'Generando…' : '📄 Generar orden'}
                        </button>
                      ) : (
                        <>
                          <span style={{ fontSize: 11, color: '#6B7280' }}>Orden N° {orden.id}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 20, color: orden.estado === 'firmada' ? '#16a34a' : '#b45309', background: '#fff', border: '1px solid ' + (orden.estado === 'firmada' ? '#bbf7d0' : '#fde68a') }}>{orden.estado === 'firmada' ? 'firmada ✓' : orden.estado}</span>
                          {orden.pdf_url && <a href={orden.pdf_url} target="_blank" rel="noreferrer" style={{ ...miniBtn, textDecoration: 'none', borderColor: '#E5E7EB', background: '#fff', color: '#374151' }}>Ver PDF</a>}
                          {orden.estado !== 'firmada' && <>
                            <button onClick={() => copiarLinkFirma(orden)} style={{ ...miniBtn, borderColor: '#E5E7EB', background: '#fff', color: '#374151' }}>Copiar link firma</button>
                            <a href={`/firmar/${orden.token}`} target="_blank" rel="noreferrer" style={{ ...miniBtn, textDecoration: 'none', borderColor: '#7c3aed', background: '#f5f3ff', color: '#7c3aed' }}>Abrir firma</a>
                            <button onClick={() => generarOrden(v)} disabled={generandoOrden === v.id} style={{ ...miniBtn, borderColor: '#E5E7EB', background: '#fff', color: '#9ca3af' }}>Regenerar</button>
                          </>}
                        </>
                      )}
                    </div>
                  </div>
                  )
                })}
              </div>
            )}

            {/* cuando / quien */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div><label style={label}>Fecha *</label><input type="date" style={input} value={vForm.fecha} onChange={e => setVForm(f => ({ ...f, fecha: e.target.value }))} /></div>
              <div><label style={label}>Hora</label><input type="time" style={input} value={vForm.hora} onChange={e => setVForm(f => ({ ...f, hora: e.target.value }))} /></div>
              <div><label style={label}>Comercial</label>
                <select style={input} value={vForm.comercial} onChange={e => setVForm(f => ({ ...f, comercial: e.target.value }))}>
                  <option value="">—</option>
                  {OPTS_VENDEDOR.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div><label style={label}>Estado</label>
                <select style={input} value={vForm.estado} onChange={e => setVForm(f => ({ ...f, estado: e.target.value }))}>
                  {ESTADOS_VISITA.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* propiedades de la salida */}
            <div style={{ marginBottom: 12 }}>
              <label style={label}>Propiedades a mostrar</label>
              {vForm.propiedades.length === 0 && <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>Sin propiedades aún. Agrégalas desde los matches del cliente o búscalas abajo (o deja la visita sin propiedad).</div>}
              {vForm.propiedades.map((p, i) => (
                <div key={p.publicacion_id} style={{ border: '1px solid #E8E6E0', borderRadius: 8, padding: 10, marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e' }}>{i + 1}. {p.label}</div>
                    <button onClick={() => quitarPubDeVisita(p.publicacion_id)} title="Quitar" style={{ ...miniBtn, borderColor: '#dc2626', background: '#fef2f2', color: '#dc2626', flexShrink: 0 }}>Quitar</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 8 }}>
                    <select style={input} value={p.resultado || 'pendiente'} onChange={e => setPropCampo(p.publicacion_id, 'resultado', e.target.value)}>
                      {RESULTADOS_PROP.map(rp => <option key={rp} value={rp}>{rp}</option>)}
                    </select>
                    <input style={input} value={p.notas || ''} onChange={e => setPropCampo(p.publicacion_id, 'notas', e.target.value)} placeholder="Comentario de esta propiedad…" />
                  </div>
                </div>
              ))}

              {/* opcion rapida: matches del requerimiento */}
              {!cartera.cargada ? (
                <div style={{ fontSize: 12, color: '#9ca3af' }}>Cargando propiedades…</div>
              ) : (
                <>
                  {opcionesPub.length > 0 && (
                    <select
                      style={{ ...input, marginBottom: 8 }}
                      value={pubPicker}
                      onChange={e => {
                        const m = opcionesPub.find(o => String(o.pub.id) === e.target.value)
                        if (m) agregarPubAVisita(m.pub)
                      }}
                    >
                      <option value="">+ Agregar desde los matches del cliente…</option>
                      {opcionesPub.map(m => (
                        <option key={m.pub.id} value={m.pub.id}>{etiquetaPub(m.pub)} · {fmtPrecio(m.pub)}</option>
                      ))}
                    </select>
                  )}

                  {/* busqueda manual: cualquier propiedad activa, aunque no calce */}
                  <div style={{ position: 'relative' }}>
                    <input
                      style={input}
                      value={pubSearch}
                      onChange={e => setPubSearch(e.target.value)}
                      placeholder="…o busca otra propiedad por código, dirección o comuna"
                    />
                    {pubResultados.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, marginTop: 2, zIndex: 20, maxHeight: 220, overflowY: 'auto' }}>
                        {pubResultados.map(p => (
                          <div key={p.id} onClick={() => agregarPubAVisita(p)} style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid #F3F4F6' }}>
                            {etiquetaPub(p)} · {fmtPrecio(p)}{p.codigo ? ' · ' + p.codigo : ''}
                          </div>
                        ))}
                      </div>
                    )}
                    {pubSearch.trim().length >= 2 && pubResultados.length === 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, marginTop: 2, zIndex: 20, padding: '8px 12px', fontSize: 12, color: '#888' }}>Sin coincidencias entre las propiedades activas.</div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* notas generales */}
            <div style={{ marginBottom: 16 }}>
              <label style={label}>Notas de la visita</label>
              <textarea style={{ ...input, minHeight: 54, resize: 'vertical' }} value={vForm.notas} onChange={e => setVForm(f => ({ ...f, notas: e.target.value }))} placeholder="Ej. pasar a buscar al cliente, llevar llaves, etc." />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#374151', cursor: 'pointer' }}>
                <input type="checkbox" checked={vForm.generarOrden} onChange={e => setVForm(f => ({ ...f, generarOrden: e.target.checked }))} />
                Generar orden de visita al guardar
              </label>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={cerrarAgenda} style={{ ...input, width: 'auto', cursor: 'pointer', background: '#F0EEE8' }}>Cerrar</button>
                <button onClick={guardarVisita} disabled={guardandoVisita} style={{ ...input, width: 'auto', cursor: 'pointer', background: '#7c3aed', color: '#fff', border: 'none', fontWeight: 600, opacity: guardandoVisita ? 0.6 : 1 }}>
                  {guardandoVisita ? 'Guardando…' : 'Guardar visita'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  })() : null

  // ===== MATCHES (Entrega 2) =====
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
                    const esCanje = p._origen === 'canje'
                    const dir = esCanje ? (p.titulo || p.direccion || '—') : (p.direccionreal || p.direccion || [p.calle, p.numero_calle].filter(Boolean).join(' ') || '—')                                         
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#EAF3DE', color: '#3B6D11' }}>{m.grado}</span>
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1a1a2e' }}>
                        <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 20, marginRight: 6, background: esCanje ? '#E6F1FB' : '#EAF3DE', color: esCanje ? '#185FA5' : '#3B6D11', border: '1px solid ' + (esCanje ? '#bcdcf7' : '#cfe3b4') }}>{esCanje ? 'Canje · ' + (p._corredor || '') : 'Propia'}</span>
                          {p.tipo || '—'}<div style={{ fontWeight: 400, color: '#888', fontSize: 11 }}>{dir}{(!esCanje && p.departamento) ? ' · Depto ' + p.departamento : ''}{esCanje ? ' · dirección a confirmar' : ''}</div>                        </td>
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
                          {esCanje ? (
                            p.url_original
                              ? <a href={p.url_original} target="_blank" rel="noreferrer" style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #185FA5', background: '#E6F1FB', color: '#185FA5', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' }}>Ver en {p._corredor || 'corredor'} →</a>
                              : <span style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>contactar corredor</span>
                          ) : (
                            <>
                              <button onClick={() => abrirAgenda(viendoMatches, p)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #7c3aed', background: '#f5f3ff', color: '#7c3aed', cursor: 'pointer', marginRight: 6, fontFamily: 'inherit' }}>Agendar</button>
                              <button onClick={() => router.push('/publicaciones/' + p.id)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #185FA5', background: '#E6F1FB', color: '#185FA5', cursor: 'pointer', fontFamily: 'inherit' }}>Ver ficha →</button>
                            </>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
        {modalAgenda}
      </div>
    )
  }

  // ===== FORMULARIO =====
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
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #F3F4F6' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Zona exacta en el mapa (opcional)</div>
            {Array.isArray(form.zona_poligono) && form.zona_poligono.length >= 3 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 7, background: '#F5F3FF', color: '#7c3aed', border: '1px solid #d8b4fe', fontSize: 13, fontWeight: 600 }}>Zona definida ({form.zona_poligono.length} puntos)</span>
                <button type="button" onClick={() => setZonaOpen(true)} style={{ ...input, width: 'auto', cursor: 'pointer', fontSize: 12 }}>Editar zona</button>
                <button type="button" onClick={() => set('zona_poligono', null)} style={{ ...input, width: 'auto', cursor: 'pointer', fontSize: 12, color: '#dc2626' }}>Quitar zona</button>
                <span style={{ fontSize: 11, color: '#888' }}>Con zona, el matching usa coordenadas y manda sobre la comuna.</span>
              </div>
            ) : (
              <button type="button" onClick={() => setZonaOpen(true)} style={{ ...input, width: 'auto', cursor: 'pointer', fontSize: 13, background: '#EDE9FE', color: '#7c3aed', border: '1px solid #d8b4fe', fontWeight: 600 }}>Definir zona en el mapa</button>
            )}
          </div>
          {zonaOpen && (
            <ZonaModal
              open={zonaOpen}
              valor={form.zona_poligono}
              onClose={() => setZonaOpen(false)}
              onSave={(poly) => set('zona_poligono', poly)}
            />
          )}
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

  // ===== LISTADO + PIPELINE =====
  // toggle de vista (compartido por ambas vistas)
  const toggle = (
    <div style={{ display: 'inline-flex', border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
      {[['lista', 'Lista'], ['pipeline', 'Pipeline']].map(([v, lab]) => (
        <button key={v} onClick={() => setVista(v)} style={{
          padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', fontFamily: 'inherit',
          background: vista === v ? '#185FA5' : '#fff', color: vista === v ? '#fff' : '#555',
        }}>{lab}</button>
      ))}
    </div>
  )

  const header = (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>Requerimientos</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {toggle}
          <button onClick={nuevo} style={{ padding: '8px 16px', borderRadius: 8, background: '#185FA5', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>+ Nuevo requerimiento</button>
        </div>
      </div>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>Lo que buscan los clientes · operación venta</div>
      {msg && <div style={{ ...card, background: msg.tipo === 'error' ? '#fef2f2' : '#f0fdf4', color: msg.tipo === 'error' ? '#dc2626' : '#16a34a', padding: 12 }}>{msg.txt}</div>}
    </>
  )

  // ===== PIPELINE (kanban) =====
  if (vista === 'pipeline') {
    const reqsPipe = filtroComercial ? reqs.filter(r => r.vendedor === filtroComercial) : reqs
    return (
      <div style={{ maxWidth: '100%', margin: '0 auto', padding: 24, fontFamily: '"DM Sans", sans-serif' }}>
        {header}

        {/* filtro por comercial + estado de carga de matches */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <select value={filtroComercial} onChange={e => setFiltroComercial(e.target.value)} style={{ ...input, width: 'auto', minWidth: 180 }}>
            <option value="">Todos los comerciales</option>
            {OPTS_VENDEDOR.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          {!cartera.cargada && <span style={{ fontSize: 12, color: '#888' }}>Calculando matches…</span>}
        </div>

        {loading ? (
          <div style={{ color: '#888' }}>Cargando…</div>
        ) : (
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 10 }}>
            {ETAPAS.map(et => {
              const enEtapa = reqsPipe.filter(r => (r.etapa || ETAPA_DEFAULT) === et.key)
              return (
                <div
                  key={et.key}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => { if (dragId != null) { moverEtapa(dragId, et.key); setDragId(null) } }}
                  style={{ minWidth: 248, width: 248, flexShrink: 0, background: '#FAFAF8', border: '1px solid #EFEDE7', borderRadius: 10, padding: 8, alignSelf: 'flex-start' }}
                >
                  {/* cabecera de columna */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px 10px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: .4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: et.color, display: 'inline-block' }} />
                      {et.label}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', background: '#fff', border: '1px solid #E8E6E0', borderRadius: 20, padding: '1px 8px' }}>{enEtapa.length}</span>
                  </div>

                  {/* tarjetas */}
                  {enEtapa.length === 0 ? (
                    <div style={{ fontSize: 11, color: '#c4c1b8', textAlign: 'center', padding: '16px 4px' }}>—</div>
                  ) : enEtapa.map(r => {
                    const cliente = r.nombre_suelto || (r.contacto_id ? '(contacto ligado)' : '—')
                    const comuna = r.comunas?.length ? (r.comunas[0] + (r.comunas.length > 1 ? ` +${r.comunas.length - 1}` : '')) : 'Cualquiera'
                    const tel = (r.telefono_suelto || '').trim()
                    const telWa = tel.replace(/[^\d]/g, '')
                    const nMatches = cartera.cargada ? (matchesCount[r.id] ?? 0) : null
                    const pv = proximaVisita(r.id)
                    return (
                      <div
                        key={r.id}
                        draggable
                        onDragStart={() => setDragId(r.id)}
                        onDragEnd={() => setDragId(null)}
                        style={{
                          background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8, padding: 10, marginBottom: 8,
                          cursor: 'grab', opacity: dragId === r.id ? 0.45 : 1, boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                        }}
                      >
                        {/* cliente + nº matches */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
                          <span onClick={() => editar(r)} title="Editar" style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', cursor: 'pointer', lineHeight: 1.25 }}>{cliente}</span>
                          <span
                            onClick={() => verMatches(r)}
                            title="Ver matches"
                            style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, cursor: 'pointer', background: '#EAF3DE', color: '#3B6D11', border: '1px solid #cfe3b4' }}
                          >
                            {nMatches == null ? '…' : `${nMatches} ✓`}
                          </span>
                        </div>

                        {/* resumen + comuna */}
                        <div style={{ fontSize: 12, color: '#374151', marginBottom: 2 }}>{resumenCorto(r)}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: pv ? 6 : 8 }}>{comuna}</div>

                        {/* badge de proxima visita agendada */}
                        {pv && (
                          <div style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, color: '#6d28d9', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 6, padding: '2px 7px', marginBottom: 8 }}>
                            📅 {fmtFechaCorta(pv.fecha)}{pv.hora ? ' ' + pv.hora.slice(0, 5) : ''}
                          </div>
                        )}

                        {/* footer: comercial + fecha + acciones */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                          <div style={{ fontSize: 10, color: '#9ca3af', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            <span style={{ color: '#6b7280', fontWeight: 600 }}>{r.vendedor || 'sin asignar'}</span>
                            {r.created_at ? <span> · {fmtFechaCorta(r.created_at)}</span> : null}
                          </div>
                          {telWa ? (
                            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                              <button onClick={e => { e.stopPropagation(); abrirAgenda(r) }} title="Agendar visita" style={{ cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, padding: '3px 7px', borderRadius: 6, border: '1px solid #7c3aed', background: '#f5f3ff', color: '#7c3aed' }}>Agendar</button>
                              <a href={`tel:${tel}`} title="Llamar" onClick={e => e.stopPropagation()} style={{ textDecoration: 'none', fontSize: 11, padding: '3px 7px', borderRadius: 6, border: '1px solid #185FA5', background: '#E6F1FB', color: '#185FA5' }}>Llamar</a>
                              <a href={`https://wa.me/${telWa}`} target="_blank" rel="noreferrer" title="WhatsApp" onClick={e => e.stopPropagation()} style={{ textDecoration: 'none', fontSize: 11, padding: '3px 7px', borderRadius: 6, border: '1px solid #16a34a', background: '#f0fdf4', color: '#16a34a' }}>WA</a>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                              <button onClick={e => { e.stopPropagation(); abrirAgenda(r) }} title="Agendar visita" style={{ cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, padding: '3px 7px', borderRadius: 6, border: '1px solid #7c3aed', background: '#f5f3ff', color: '#7c3aed' }}>Agendar</button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}
        {modalAgenda}
      </div>
    )
  }

  // ===== LISTA (tabla) =====
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24, fontFamily: '"DM Sans", sans-serif' }}>
      {header}

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
