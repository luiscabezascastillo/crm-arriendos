import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabaseClient'
import { registrarBitacora } from '@/lib/bitacora'
import { getServerSession } from 'next-auth'
import { EJECUTIVOS } from '@/lib/ejecutivos'

const ML_CLIENT_ID = process.env.ML_CLIENT_ID
const ML_CLIENT_SECRET = process.env.ML_CLIENT_SECRET
const ML_API           = 'https://api.mercadolibre.com'

// EJECUTIVOS ahora viene de '@/lib/ejecutivos' (fuente unica compartida con actualizar-pi)

function facingValueId(orientacion) {
  if (!orientacion) return null
  let s = String(orientacion).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s\-_.]/g, '')
  s = s.replace(/orientacion/g, '')
  const mapa = {
    'norte': '242327', 'n': '242327',
    'sur': '242328', 's': '242328',
    'oriente': '242329', 'o': '242329',
    'poniente': '242330', 'p': '242330',
    'nororiente': '2730831', 'no': '2730831',
    'norponiente': '2730832', 'np': '2730832',
    'suroriente': '2730833', 'so': '2730833',
    'surponiente': '2730834', 'sp': '2730834',
  }
  return mapa[s] || null
}

function getCategoryId(objetivo, tipo) {
  const esVenta = String(objetivo || '').toLowerCase().includes('venta')
  const t = String(tipo || '').toUpperCase()
  const cats = {
    venta: {
      'DEPARTAMENTO': 'MLC157522', 'CASA': 'MLC157520', 'OFICINA': 'MLC157413',
      'LOCAL': 'MLC50612', 'BODEGA': 'MLC50566', 'PARCELA': 'MLC6405',
      'TERRENO': 'MLC152993', 'ESTACIONAMIENTO': 'MLC50622', 'INDUSTRIAL': 'MLC50619',
      'SITIO': 'MLC183202', 'AGRICOLA': 'MLC50625', 'NEGOCIO': 'MLC50619',
    },
    arriendo: {
      'DEPARTAMENTO': 'MLC183186', 'CASA': 'MLC183184', 'OFICINA': 'MLC183187',
      'LOCAL': 'MLC50611', 'BODEGA': 'MLC50565', 'PARCELA': 'MLC6404',
      'TERRENO': 'MLC152994', 'ESTACIONAMIENTO': 'MLC50621', 'INDUSTRIAL': 'MLC50618',
      'SITIO': 'MLC50614', 'AGRICOLA': 'MLC50624',
    }
  }
  const grupo = esVenta ? cats.venta : cats.arriendo
  return grupo[t] || (esVenta ? 'MLC157522' : 'MLC183186')
}

const COMUNAS_ML = {
  'LAS CONDES': { id: 'TUxDQ0xBUzU2MTEz', name: 'Las Condes', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'Las Condes': { id: 'TUxDQ0xBUzU2MTEz', name: 'Las Condes', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'PROVIDENCIA': { id: 'TUxDQ1BST2NhYjU3', name: 'Providencia', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'Providencia': { id: 'TUxDQ1BST2NhYjU3', name: 'Providencia', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'VITACURA': { id: 'TUxDQ1ZJVDM2MjFj', name: 'Vitacura', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'Vitacura': { id: 'TUxDQ1ZJVDM2MjFj', name: 'Vitacura', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'SANTIAGO': { id: 'TUxDQ1NBTjk4M2M', name: 'Santiago', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'Santiago': { id: 'TUxDQ1NBTjk4M2M', name: 'Santiago', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'ÑUÑOA': { id: 'TUxDQ9FV0WU0MmM2', name: 'Ñuñoa', state_id: 'CL-RM', state_name: 'RM (Metropolitana)'},
  'Ñuñoa': { id: 'TUxDQ9FV0WU0MmM2', name: 'Ñuñoa', state_id: 'CL-RM', state_name: 'RM (Metropolitana)'},
  'LA REINA': { id: 'TUxDQ0xBIDZlMWI5', name: 'La Reina', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'La Reina': { id: 'TUxDQ0xBIDZlMWI5', name: 'La Reina', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'LO BARNECHEA': { id: 'TUxDQ0xPIGUzZDM3', name: 'Lo Barnechea', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'Lo Barnechea': { id: 'TUxDQ0xPIGUzZDM3', name: 'Lo Barnechea', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'HUECHURABA': { id: 'TUxDQ0hVRTdmZjlm', name: 'Huechuraba', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'Huechuraba': { id: 'TUxDQ0hVRTdmZjlm', name: 'Huechuraba', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'MACUL': { id: 'TUxDQ01BQ3VsNGI0', name: 'Macul', state_id: 'CL-RM', state_name: 'RM (Metropolitana)'},
  'Macul': { id: 'TUxDQ01BQ3VsNGI0', name: 'Macul', state_id: 'CL-RM', state_name: 'RM (Metropolitana)'},
  'Independencia': { id: 'TUxDQ0lORDIxMmU0', name: 'Independencia', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'Recoleta': { id: 'TUxDQ1JFQzY4YjIw', name: 'Recoleta', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'Peñalolén': { id: 'TUxDQ1BF0TRkNzFj', name: 'Peñalolén', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'La Florida': { id: 'TUxDQ0xBIGM5NzMz', name: 'La Florida', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'Maipú': { id: 'TUxDQ01BSWI5Y2M2', name: 'Maipú', state_id: 'CL-RM', state_name: 'RM (Metropolitana)'},
  'Puente Alto': { id: 'TUxDQ1BVRTZmOGZl', name: 'Puente Alto', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'San Miguel': { id: 'TUxDQ1NBTjcwNDU0', name: 'San Miguel', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'San Bernardo': { id: 'TUxDQ1NBTmIyZDBh', name: 'San Bernardo', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'Quilicura': { id: 'TUxDQ1FVSTY5YTdl', name: 'Quilicura', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'Colina': { id: 'TUxDQ0NPTGNkMWZj', name: 'Colina', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'COLINA': { id: 'TUxDQ0NPTGNkMWZj', name: 'Colina', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'Estación Central': { id: 'TUxDQ0VTVDY1ODUw', name: 'Estación Central', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'Pudahuel': { id: 'TUxDQ1BVRDg4OWIx', name: 'Pudahuel', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'Curarrehue': { id: 'TUxDQ0NVUjkwYzI4', name: 'Curarrehue', state_id: 'TUxDUEFSQUE3YzVk', state_name:'La Araucanía' },
  'Pucón': { id: 'TUxDQ1BVQzU2NDFm', name: 'Pucón', state_id: 'TUxDUEFSQUE3YzVk', state_name: 'La Araucanía' },
  'Villarrica': { id: 'TUxDQ1ZJTGMyNWU3', name: 'Villarrica', state_id: 'TUxDUEFSQUE3YzVk', state_name:'La Araucanía' },
  'Antofagasta': { id: 'TUxDQ0FOVDc1YzM', name: 'Antofagasta', state_id: 'TUxDUEFOVEE3NWZk', state_name: 'Antofagasta' },
  'Puerto Varas': { id: 'TUxDQ1BVRTE5NDc3', name: 'Puerto Varas', state_id: 'TUxDUExPU1NmYjk5', state_name: 'Los Lagos' },
  'Valparaíso': { id: 'TUxDQ1ZBTDk4ZTg', name: 'Valparaíso', state_id: 'TUxDUFZBTE84MDVj', state_name: 'Valparaíso' },
  'Viña del Mar': { id: 'TUxDQ1ZJ0TkzYzA', name: 'Viña del Mar', state_id: 'TUxDUFZBTE84MDVj', state_name: 'Valparaíso' },
}

function normComuna(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
}

async function resolverComuna(comunaTexto) {
  const nn = normComuna(comunaTexto)
  if (!nn) return { ok: false, motivo: 'vacia' }
  const { data, error } = await supabase.from('comunas_ml').select('nombre, ml_city_id, state_id, state_name').eq('nombre_norm', nn).maybeSingle()
  if (error) return { ok: false, motivo: 'error_db: ' + error.message }
  if (!data) return { ok: false, motivo: 'no_encontrada' }
  return { ok: true, comuna: { id: data.ml_city_id, name: data.nombre, state_id: data.state_id, state_name: data.state_name } }
}

function getComuna(comuna) {
  return COMUNAS_ML[comuna] || { id: 'TUxDQ1NBTjk4M2M', name: 'Santiago', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' }
}

async function getValidToken() {
  const { data: rows } = await supabase
    .from('configuracion')
    .select('clave, valor')
    .in('clave', ['ml_access_token', 'ml_token_expira', 'ml_refresh_token'])

  const config = {}
  for (const row of rows || []) config[row.clave] = row.valor

  const expira = config['ml_token_expira'] ? new Date(config['ml_token_expira']) : null
  const ahora = new Date()

  if (config['ml_access_token'] && expira && expira > new Date(ahora.getTime() + 5 * 60 * 1000)) {
    return config['ml_access_token']
  }

  const refreshToken = config['ml_refresh_token'] || 'TG-6a07b393d1ecc90001d03dc4-330114447'

  const res = await fetch(`${ML_API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      client_id:     ML_CLIENT_ID,
      client_secret: ML_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Error refrescando token ML: ${res.status} - ${err}`)
  }

  const json = await res.json()
  const newAccess  = json.access_token
  const newRefresh = json.refresh_token || refreshToken
  const expiresIn  = json.expires_in || 21600
  const nuevaExpiracion = new Date(ahora.getTime() + expiresIn * 1000).toISOString()

  await supabase.from('configuracion').upsert([
    { clave: 'ml_access_token',  valor: newAccess,       updated_at: new Date().toISOString() },
    { clave: 'ml_refresh_token', valor: newRefresh,      updated_at: new Date().toISOString() },
    { clave: 'ml_token_expira',  valor: nuevaExpiracion, updated_at: new Date().toISOString() },
  ])

  return newAccess
}

function boolPI(val) {
  const s = String(val == null ? '' : val).trim().toLowerCase()
  const si = (s === 'si' || s === 's\u00ed' || s === 'true' || s === '1' || s === 'parcial' || s === 'yes')
  return si ? { id: '242085', name: 'Si' } : { id: '242084', name: 'No' }
}

function maintenanceFeeTypeValueId(txt) {
  const s = String(txt == null ? '' : txt).trim().toLowerCase()
  const mapa = {
    'sin cobro': '13522119',
    'incluidos en el arriendo': '13522120',
    'incluidos': '13522120',
    'fijos': '13522121',
    'aproximados': '13522122',
  }
  return mapa[s] || null
}

function buildPayload(p) {
  const ejec = EJECUTIVOS[p.vendedor] || EJECUTIVOS['Alberto']
  const comuna = p.__comunaResuelta
  const esUF = String(p.tipo_moneda || '').toUpperCase() === 'UF'
 const titulo = (p.titulo && p.titulo.trim()) ? p.titulo.trim() : `${p.objetivo || ''}, ${p.tipo || ''}, ${p.comuna || ''}. ${p.dormitorios || '0'}D/${p.banos|| '0'}B`

  let descripcion = p.observaciones || ''
  descripcion += `<br>- ${p.codigo} - <br><br>metros aproximados proporcionados por el dueno`
  descripcion = descripcion
    .replace(/<br>/g, '\n ').replace(/<\/br>/g, '\n ')
    .replace(/á/g, '\u00E1').replace(/é/g, '\u00E9')
    .replace(/í/g, '\u00ED').replace(/ó/g, '\u00F3')
    .replace(/ú/g, '\u00FA').replace(/ñ/g, '\u00F1')
    .replace(/Á/g, '\u00C1').replace(/É/g, '\u00C9')
    .replace(/Í/g, '\u00CD').replace(/Ó/g, '\u00D3')
    .replace(/Ú/g, '\u00DA').replace(/Ñ/g, '\u00D1')
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}]/gu, '')
    .replace(/ {2,}/g, ' ')

  const imagenes = []
  for (let i = 1; i <= 30; i++) {
    const img = p[`imagen${i}`]
    if (!img) break
    imagenes.push({ source: `https://www.fondocapital.com/propiedades/${img}` })
  }

  const bool = (val) => String(val || '').toUpperCase() === 'SI' ? { id: '242085', name: 'Si' } : { id: '242084', name: 'No' }

  const attributes = [
    { id: 'CMG_SITE', value_name: 'POI', attribute_group_id: 'OTHERS', attribute_group_name: 'Otros' },
    { id: 'PROPERTY_CODE', value_name: String(p.codigo), hierarchy: 'ITEM', relevance: 1, value_type: 'string' },
    { id: 'BEDROOMS',             value_name: String(p.dormitorios      || '0') },
    { id: 'FULL_BATHROOMS',       value_name: String(p.banos            || '0') },
    { id: 'PARKING_LOTS',         value_name: String(p.estacionamientos || '0') },
    { id: 'WAREHOUSES',           value_name: String(p.bodegas          || '0') },
    { id: 'COVERED_AREA',         value_name: `${p.mt2_const || '0'} m²` },
    { id: 'TOTAL_AREA',           value_name: `${p.mt2_terreno || p.mt2_const || '0'} m²` },
    { id: 'MAINTENANCE_FEE',      value_name: String(p.ggcc             || '0') },
    { id: 'IS_SUITABLE_FOR_PETS', values: [boolPI(p.ksuitable_for_pets)] },
    { id: 'FURNISHED',            values: [boolPI(p.amoblado)] },
    ...(p.has_heating          ? [{ id: 'HAS_HEATING',          values: [boolPI(p.has_heating)] }] : []),
    ...(p.has_air_conditioning ? [{ id: 'HAS_AIR_CONDITIONING', values: [boolPI(p.has_air_conditioning)] }] : []),
    ...(maintenanceFeeTypeValueId(p.maintenance_fee_type) ? [{ id: 'MAINTENANCE_FEE_TYPE', value_id: maintenanceFeeTypeValueId(p.maintenance_fee_type) }] : []),
    ...(p.available_from ? [{ id: 'AVAILABLE', value_name: String(p.available_from) }] : []),
    // Nivel Estandar
    ...(p.unit_floor                 ? [{ id: 'UNIT_FLOOR',                 value_name: String(p.unit_floor) }] : []),
    ...(p.property_age               ? [{ id: 'PROPERTY_AGE',               value_name: String(p.property_age) + ' anos' }] : []),
    ...(p.floors                     ? [{ id: 'FLOORS',                     value_name: String(p.floors) }] : []),
    ...(p.apartments_per_floor       ? [{ id: 'APARTMENTS_PER_FLOOR',       value_name: String(p.apartments_per_floor) }] : []),
    ...(p.apartment_number           ? [{ id: 'APARTMENT_NUMBER',           value_name: String(p.apartment_number) }] : []),
    ...(p.property_registration_code ? [{ id: 'PROPERTY_REGISTRATION_CODE', value_name: String(p.property_registration_code) }] : []),
    ...(facingValueId(p.orientacion) ? [{ id: 'FACING', value_id: facingValueId(p.orientacion) }] : []),
    // Nivel Profesional
    ...(p.has_balcony   ? [{ id: 'HAS_BALCONY',   values: [bool(p.has_balcony)]   }] : []),
    ...(p.has_laundry   ? [{ id: 'HAS_LAUNDRY',   values: [bool(p.has_laundry)]   }] : []),
    ...(p.has_maid_room ? [{ id: 'HAS_MAID_ROOM', values: [bool(p.has_maid_room)] }] : []),
    ...(p.has_half_bath ? [{ id: 'HAS_HALF_BATH', values: [bool(p.has_half_bath)] }] : []),
    ...(p.has_security  ? [{ id: 'HAS_SECURITY',  values: [bool(p.has_security)]  }] : []),
    // Amenities del edificio (Grupo A) -> atributos HAS_* del PI
    ...(p.tiene_ascensor ? [{ id: 'HAS_LIFT', values: [bool(p.tiene_ascensor)] }] : []),
    ...(p.tiene_piscina ? [{ id: 'HAS_SWIMMING_POOL', values: [bool(p.tiene_piscina)] }] : []),
    ...(p.tiene_gimnasio ? [{ id: 'HAS_GYM', values: [bool(p.tiene_gimnasio)] }] : []),
    ...(p.tiene_salon_fiestas ? [{ id: 'HAS_PARTY_ROOM', values: [bool(p.tiene_salon_fiestas)] }] : []),
    ...(p.tiene_sala_multiuso ? [{ id: 'HAS_MULTIPURPOSE_ROOM', values: [bool(p.tiene_sala_multiuso)] }] : []),
    ...(p.tiene_quincho_parrilla ? [{ id: 'HAS_GRILL', values: [bool(p.tiene_quincho_parrilla)] }] : []),
    ...(p.tiene_juegos_infantiles ? [{ id: 'HAS_PLAYGROUND', values: [bool(p.tiene_juegos_infantiles)] }] : []),
    ...(p.tiene_sauna ? [{ id: 'HAS_SAUNA', values: [bool(p.tiene_sauna)] }] : []),
    ...(p.tiene_jacuzzi ? [{ id: 'HAS_JACUZZI', values: [bool(p.tiene_jacuzzi)] }] : []),
    ...(p.tiene_cowork ? [{ id: 'HAS_BUSINESS_CENTER', values: [bool(p.tiene_cowork)] }] : []),
    ...(p.tiene_cine ? [{ id: 'HAS_CINEMA_HALL', values: [bool(p.tiene_cine)] }] : []),
    ...(p.tiene_playroom ? [{ id: 'HAS_PLAYROOM', values: [bool(p.tiene_playroom)] }] : []),
    ...(p.tiene_recepcion ? [{ id: 'HAS_FRONT_DESK', values: [bool(p.tiene_recepcion)] }] : []),
    ...(p.tiene_lavanderia ? [{ id: 'HAS_COMMON_LAUNDRY', values: [bool(p.tiene_lavanderia)] }] : []),
    ...(p.tiene_estacionamiento_visitas ? [{ id: 'HAS_GUEST_PARKING', values: [bool(p.tiene_estacionamiento_visitas)] }] : []),
    ...(p.tiene_cancha_paddle ? [{ id: 'HAS_PADDLE_COURT', values: [bool(p.tiene_cancha_paddle)] }] : []),
    ...(p.tiene_cancha_tenis ? [{ id: 'HAS_TENNIS_COURT', values: [bool(p.tiene_cancha_tenis)] }] : []),
    ...(p.tiene_cancha_multiuso ? [{ id: 'HAS_MULTIPLE_USE_COURT', values: [bool(p.tiene_cancha_multiuso)] }] : []),
    ...(p.tiene_area_verde ? [{ id: 'WITH_GREEN_AREA', values: [bool(p.tiene_area_verde)] }] : []),
    ...(p.tiene_azotea ? [{ id: 'HAS_ROOF_GARDEN', values: [bool(p.tiene_azotea)] }] : []),
    ...(p.tiene_generador ? [{ id: 'HAS_ELECTRIC_GENERATOR', values: [bool(p.tiene_generador)] }] : []),
    ...(p.tiene_rampa_silla ? [{ id: 'WHEELCHAIR_RAMP', values: [bool(p.tiene_rampa_silla)] }] : []),
  ]

  return {
    listing_type_id: 'silver',
    condition: 'not_specified',
    title: titulo,
    category_id: getCategoryId(p.objetivo, p.tipo),
    buying_mode: 'classified',
    price: Number(p.valor) || 0,
    currency_id: esUF ? 'CLF' : 'CLP',
    available_quantity: 1,
    location: {
      address_line: p.direccion || '',
      city:    { id: comuna.id,       name: comuna.name },
      state:   { id: comuna.state_id, name: comuna.state_name },
      country: { id: 'CL',            name: 'Chile' },
      latitude:  Number(p.latitud)  || undefined,
      longitude: Number(p.longitud) || undefined,
    },
    pictures: imagenes,
    video_id: p.video || null,
    seller_contact: {
      contact:    ejec.nombre,
      phone:      ejec.phone,
      phone2:     ejec.phone,
      other_info: ejec.email,
      email:      ejec.email,
    },
    attributes,
    description: descripcion,
  }
}
export async function POST(request) {
    try {
      const session = await getServerSession()
      const usuarioBitacora = session?.user?.name || session?.user?.email || null
      const { publicacionId } = await request.json()
    if (!publicacionId) return NextResponse.json({ error: 'Falta publicacionId' }, { status: 400 })

    const { data: p, error: errPub } = await supabase
      .from('publicaciones').select('*').eq('id', publicacionId).single()

    if (errPub || !p) return NextResponse.json({ error: 'Propiedad no encontrada' }, { status: 404 })

    // Bloquear si ya está activa en PI
    if (p.codigo_pi && p.activo === 'active') {
      return NextResponse.json({ error: `Ya publicada en PI con código ${p.codigo_pi}. Ciérrala primero.` }, { status: 400 })
    }

    // Si tiene código PI antiguo cerrado, limpiar antes de crear uno nuevo
    if (p.codigo_pi && p.activo !== 'active') {
      await supabase.from('publicaciones').update({ codigo_pi: null, url_pi: null }).eq('id', publicacionId)
    }

    // Resolver comuna desde el catalogo oficial (comunas_ml). Bloquea si no existe.
    const __rc = await resolverComuna(p.comuna)
    if (!__rc.ok) {
      return NextResponse.json({ error: 'Comuna "' + (p.comuna || '(vacia)') + '" no encontrada en el catalogo (comunas_ml). No se publico para evitar una ubicacion incorrecta. Revisa la comuna de la propiedad.', motivo: __rc.motivo }, { status: 400 })
    }
    p.__comunaResuelta = __rc.comuna

    const accessToken = await getValidToken()
    const payload = buildPayload(p)

    const res = await fetch(`${ML_API}/items`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const json = await res.json()
    if (res.status !== 201) {
      const mlDetalle = json.cause ? JSON.stringify(json.cause) : (json.message || JSON.stringify(json))
      return NextResponse.json({ error: `Error ML ${res.status}: ${json.message || 'error'}`, detalle: mlDetalle, mlRespuesta: json }, { status: 500 })
    }

    // --- FASE 2: capturar el mapeo nombre_de_archivo <-> id de ML ---
    // Reconstruimos la lista de nombres que mandamos (imagen1..30 en orden, break al primer hueco)
    const nombresEnviados = []
    for (let i = 1; i <= 30; i++) {
      const img = p[`imagen${i}`]
      if (!img) break
      nombresEnviados.push(img)
    }
    // Los id que ML asignó, en el orden que devuelve
    const picturesML = json.pictures || []
    // Emparejamos por posición SOLO si coinciden las cantidades (si no, guardamos aviso para revisar)
    const fotosFirma = nombresEnviados.join('|')
    let fotosMl
    if (picturesML.length === nombresEnviados.length) {
      fotosMl = nombresEnviados.map((nombre, idx) => ({
        imagen: nombre,
        ml_id: picturesML[idx].id,
      }))
    } else {
      fotosMl = {
        _aviso: 'Desajuste al publicar: ML devolvió distinto número de fotos que las enviadas. Revisar.',
        enviadas: nombresEnviados.length,
        devueltas: picturesML.length,
        ml_ids: picturesML.map(pic => pic.id),
      }
    }

    await supabase.from('publicaciones').update({
      pi: 'SI',
      codigo_pi: json.id,
      activo: 'active',
      url_pi: json.permalink || '',
      fotos_ml: fotosMl,
      fotos_firma: fotosFirma,
      updated_at: new Date().toISOString(),
    }).eq('id', publicacionId)

    await registrarBitacora({ idpublicacion: publicacionId, codigo: p.codigo, evento: 'publicar_pi', detalle: 'Publicado en Portal Inmobiliario (' + json.id + ')', usuario: usuarioBitacora })

      return NextResponse.json({
      ok: true,
      codigoPI: json.id,
      permalink: json.permalink || '',
      mensaje: `✓ Publicado en Portal Inmobiliario con código ${json.id}`,
    })

  } catch (error) {
    console.error('Error publicar-pi:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}