import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const ML_CLIENT_ID     = '2049193411681689'
const ML_CLIENT_SECRET = 'y6mb9ngfRImWakAsg8YIViuGAsCp2pqr'
const ML_API           = 'https://api.mercadolibre.com'

const EJECUTIVOS = {
  'Alberto': { nombre: 'Alberto Cabezas',  phone: '+56 9 5357 7235', email: 'alberto.cabezas@fondocapital.com' },
  'Adalis':  { nombre: 'Adalis',            phone: '+56 9 5334 5848', email: 'admon@fondocapital.com' },
  'Tirza':   { nombre: 'Tirza Chavez',      phone: '+56 9 3423 1754', email: 'tirza.chavez@fondocapital.com' },
  'Lorena':  { nombre: 'Lorena Sanmartín', phone: '+56 9 7618 3560', email: 'lorena.sanmartin@fondocapital.com' },
  'Pedro':   { nombre: 'Pedro Perdomo',     phone: '+56 9 3445 6944', email: 'pedro.perdomo@fondocapital.com' },
  'Neika':   { nombre: 'Neika Duque',       phone: '+56 9 4274 9624', email: 'neika.duque@fondocapital.com' },
}

function getCategoryId(objetivo, tipo) {
  const esVenta = (objetivo || '').toLowerCase().includes('venta')
  const t = (tipo || '').toUpperCase()
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
  'ÑUÑOA': { id: 'TUxDQ9FV0WU0MmM2', name: 'Ñuñoa', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'Ñuñoa': { id: 'TUxDQ9FV0WU0MmM2', name: 'Ñuñoa', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'LA REINA': { id: 'TUxDQ0xBIDZlMWI5', name: 'La Reina', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'La Reina': { id: 'TUxDQ0xBIDZlMWI5', name: 'La Reina', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'LO BARNECHEA': { id: 'TUxDQ0xPIGUzZDM3', name: 'Lo Barnechea', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'Lo Barnechea': { id: 'TUxDQ0xPIGUzZDM3', name: 'Lo Barnechea', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'HUECHURABA': { id: 'TUxDQ0hVRTdmZjlm', name: 'Huechuraba', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'Huechuraba': { id: 'TUxDQ0hVRTdmZjlm', name: 'Huechuraba', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'MACUL': { id: 'TUxDQ01BQ3VsNGI0', name: 'Macul', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'Macul': { id: 'TUxDQ01BQ3VsNGI0', name: 'Macul', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'Independencia': { id: 'TUxDQ0lORDIxMmU0', name: 'Independencia', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'Recoleta': { id: 'TUxDQ1JFQzY4YjIw', name: 'Recoleta', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'Peñalolén': { id: 'TUxDQ1BF0TRkNzFj', name: 'Peñalolén', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'La Florida': { id: 'TUxDQ0xBIGM5NzMz', name: 'La Florida', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'Maipú': { id: 'TUxDQ01BSWI5Y2M2', name: 'Maipú', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'Puente Alto': { id: 'TUxDQ1BVRTZmOGZl', name: 'Puente Alto', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'San Miguel': { id: 'TUxDQ1NBTjcwNDU0', name: 'San Miguel', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'San Bernardo': { id: 'TUxDQ1NBTmIyZDBh', name: 'San Bernardo', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'Quilicura': { id: 'TUxDQ1FVSTY5YTdl', name: 'Quilicura', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'Colina': { id: 'TUxDQ0NPTGNkMWZj', name: 'Colina', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'COLINA': { id: 'TUxDQ0NPTGNkMWZj', name: 'Colina', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'Estación Central': { id: 'TUxDQ0VTVDY1ODUw', name: 'Estación Central', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'Pudahuel': { id: 'TUxDQ1BVRDg4OWIx', name: 'Pudahuel', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'Curarrehue': { id: 'TUxDQ0NVUjkwYzI4', name: 'Curarrehue', state_id: 'TUxDUEFSQUE3YzVk', state_name: 'La Araucanía' },
  'Pucón': { id: 'TUxDQ1BVQzU2NDFm', name: 'Pucón', state_id: 'TUxDUEFSQUE3YzVk', state_name: 'La Araucanía' },
  'Villarrica': { id: 'TUxDQ1ZJTGMyNWU3', name: 'Villarrica', state_id: 'TUxDUEFSQUE3YzVk', state_name: 'La Araucanía' },
  'Antofagasta': { id: 'TUxDQ0FOVDc1YzM', name: 'Antofagasta', state_id: 'TUxDUEFOVEE3NWZk', state_name: 'Antofagasta' },
  'Puerto Varas': { id: 'TUxDQ1BVRTE5NDc3', name: 'Puerto Varas', state_id: 'TUxDUExPU1NmYjk5', state_name: 'Los Lagos' },
  'Valparaíso': { id: 'TUxDQ1ZBTDk4ZTg', name: 'Valparaíso', state_id: 'TUxDUFZBTE84MDVj', state_name: 'Valparaíso' },
  'Viña del Mar': { id: 'TUxDQ1ZJ0TkzYzA', name: 'Viña del Mar', state_id: 'TUxDUFZBTE84MDVj', state_name: 'Valparaíso' },
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

function buildPayload(p) {
  const ejec = EJECUTIVOS[p.vendedor] || EJECUTIVOS['Alberto']
  const comuna = getComuna(p.comuna)
  const esUF = (p.tipo_moneda || '').toUpperCase() === 'UF'
  const titulo = `${p.objetivo || ''}, ${p.tipo || ''}, ${p.comuna || ''}. ${p.dormitorios || '0'}D/${p.banos || '0'}B`

  let descripcion = p.observaciones || ''
  descripcion += `<br>- ${p.codigo} - <br><br>metros aproximados proporcionados por el dueño`
  descripcion = descripcion
    .replace(/<br>/g, '\n ').replace(/<\/br>/g, '\n ')
    .replace(/á/g, '\u00E1').replace(/é/g, '\u00E9')
    .replace(/í/g, '\u00ED').replace(/ó/g, '\u00F3')
    .replace(/ú/g, '\u00FA').replace(/ñ/g, '\u00F1')
    .replace(/Á/g, '\u00C1').replace(/É/g, '\u00C9')
    .replace(/Í/g, '\u00CD').replace(/Ó/g, '\u00D3')
    .replace(/Ú/g, '\u00DA').replace(/Ñ/g, '\u00D1')

  const imagenes = []
  for (let i = 1; i <= 30; i++) {
    const img = p[`imagen${i}`]
    if (!img) break
    imagenes.push({ source: `https://www.fondocapital.com/propiedades/${img}` })
  }

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
    attributes: [
      { id: 'CMG_SITE', value_name: 'POI', attribute_group_id: 'OTHERS', attribute_group_name: 'Otros' },
      { id: 'PROPERTY_CODE', value_name: String(p.codigo), hierarchy: 'ITEM', relevance: 1, value_type: 'string' },
      { id: 'BEDROOMS',             value_name: String(p.dormitorios      || '0') },
      { id: 'FULL_BATHROOMS',       value_name: String(p.banos            || '0') },
      { id: 'PARKING_LOTS',         value_name: String(p.estacionamientos || '0') },
      { id: 'WAREHOUSES',           value_name: String(p.bodegas          || '0') },
      { id: 'COVERED_AREA',         value_name: `${p.mt2_const || '0'} m²` },
      { id: 'TOTAL_AREA',           value_name: `${p.mt2_terreno || p.mt2_const || '0'} m²` },
      { id: 'MAINTENANCE_FEE',      value_name: String(p.ggcc             || '0') },
      { id: 'IS_SUITABLE_FOR_PETS', value_name: p.ksuitable_for_pets      || 'No' },
      {
        id: 'FURNISHED',
        values: [{
          id:   (p.amoblado || '').toUpperCase() === 'SI' ? '242085' : '242084',
          name: (p.amoblado || '').toUpperCase() === 'SI' ? 'Si' : 'No',
        }]
      },
    ],
    description: descripcion,
  }
}

export async function POST(request) {
  try {
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
      return NextResponse.json({ error: `Error ML ${res.status}: ${json.message || JSON.stringify(json)}` }, { status: 500 })
    }

    await supabase.from('publicaciones').update({
      pi: 'SI',
      codigo_pi: json.id,
      activo: 'active',
      url_pi: json.permalink || '',
      updated_at: new Date().toISOString(),
    }).eq('id', publicacionId)

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
