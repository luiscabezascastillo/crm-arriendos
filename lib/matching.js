// lib/matching.js
// Motor de matching de requerimientos (Fase 1, VENTA).
// Funcion pura y aislada: recibe datos, devuelve matches. Sin dependencias de React ni Supabase.
// El dia que se migre al servidor, esta misma logica se copia a un endpoint.

// ─────────────────────────────────────────────────────────────
// Helpers de normalizacion
// ─────────────────────────────────────────────────────────────

// Lee un booleano que puede venir como boolean real, 'SI'/'NO', 'true'/'false', 1/0, etc.
function esVerdadero(v) {
  if (v === true) return true
  if (v === false || v == null) return false
  const s = String(v).trim().toLowerCase()
  return s === 'true' || s === 'si' || s === 'sí' || s === '1' || s === 'x' || s === 'yes'
}

// Numero tolerante (los campos de publicaciones son text)
function num(v) {
  if (v == null || v === '') return null
  const n = Number(String(v).replace(',', '.').replace(/[^0-9.\-]/g, ''))
  return isNaN(n) ? null : n
}

// Normaliza texto: minusculas, sin tildes, trim
function norm(s) {
  return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

// ─────────────────────────────────────────────────────────────
// Mapa de amenities: nombre del requerimiento -> columnas reales.
// edi = columna en edificios; prop = columna en publicaciones.
// Si una amenity tiene ambas, calza si el edificio O la propiedad la tiene.
// ─────────────────────────────────────────────────────────────

const MAPA_AMENITIES = {
  piscina:            { edi: 'tiene_piscina',                 prop: 'tiene_piscina_propia' },
  gimnasio:           { edi: 'tiene_gimnasio',                 prop: null },
  quincho:            { edi: 'tiene_quincho_parrilla',         prop: 'tiene_quincho_propio' },
  sauna:              { edi: 'tiene_sauna',                    prop: null },
  jacuzzi:            { edi: 'tiene_jacuzzi',                  prop: null },
  cowork:             { edi: 'tiene_cowork',                   prop: null },
  cine:               { edi: 'tiene_cine',                     prop: null },
  playroom:           { edi: 'tiene_playroom',                 prop: null },
  salon_fiestas:      { edi: 'tiene_salon_fiestas',            prop: null },
  sala_multiuso:      { edi: 'tiene_sala_multiuso',            prop: null },
  juegos_infantiles:  { edi: 'tiene_juegos_infantiles',        prop: null },
  cancha_paddle:      { edi: 'tiene_cancha_paddle',            prop: null },
  cancha_tenis:       { edi: 'tiene_cancha_tenis',             prop: null },
  cancha_multiuso:    { edi: 'tiene_cancha_multiuso',          prop: null },
  area_verde:         { edi: 'tiene_area_verde',               prop: 'tiene_jardin' },
  azotea:             { edi: 'tiene_azotea',                   prop: null },
  ascensor:           { edi: 'tiene_ascensor',                 prop: null },
  conserjeria:        { edi: 'tiene_recepcion',                prop: null },
  lavanderia:         { edi: 'tiene_lavanderia',               prop: 'has_laundry' },
  estac_visitas:      { edi: 'tiene_estacionamiento_visitas',  prop: null },
  generador:          { edi: 'tiene_generador',                prop: null },
  rampa_silla:        { edi: 'tiene_rampa_silla',              prop: null },
  condominio_cerrado: { edi: 'condominio_cerrado',             prop: null },
  seguridad:          { edi: 'tiene_recepcion',                prop: 'has_security' },
  // Solo propiedad
  terraza:            { edi: null,                             prop: 'tiene_terraza' },
  balcon:             { edi: null,                             prop: 'has_balcony' },
  patio:              { edi: null,                             prop: 'tiene_patio' },
  logia:              { edi: null,                             prop: 'tiene_logia' },
  walking_closet:     { edi: null,                             prop: 'tiene_walking_closet' },
  bodega:             { edi: null,                             prop: 'tiene_bodega_propia' },
  calefaccion:        { edi: null,                             prop: 'tiene_calefaccion' },
  aire_acondicionado: { edi: null,                             prop: 'tiene_aire_acondicionado' },
  amoblado:           { edi: null,                             prop: 'amoblado' },
  acepta_mascotas:    { edi: null,                             prop: 'ksuitable_for_pets' },
  pieza_servicio:     { edi: null,                             prop: 'has_maid_room' },
}

// Lista de amenities disponibles (para construir la UI del formulario)
const AMENITIES_DISPONIBLES = Object.keys(MAPA_AMENITIES)

// ¿La propiedad (con su edificio) tiene la amenity pedida?
function propiedadTieneAmenity(nombreAmenity, pub, edificio) {
  const mapa = MAPA_AMENITIES[nombreAmenity]
  if (!mapa) return false
  // Edificio
  if (mapa.edi && edificio && esVerdadero(edificio[mapa.edi])) return true
  // Propiedad
  if (mapa.prop && esVerdadero(pub[mapa.prop])) return true
  return false
}

// ─────────────────────────────────────────────────────────────
// Cruce publicacion <-> edificio (por comuna + calle + numero, sin tildes)
// ─────────────────────────────────────────────────────────────

// Extrae calle y numero desde la publicacion (usa direccion: "Calle 123")
function parseDireccion(pub) {
  const dir = norm(pub.direccion || pub.direccionreal || '')
  // separa el ultimo numero de la cadena
  const m = dir.match(/^(.*?)\s+(\d+)\b/)
  if (m) return { calle: m[1].trim(), numero: m[2] }
  return { calle: dir, numero: '' }
}

// Busca el edificio que corresponde a una publicacion
function edificioDePublicacion(pub, edificios) {
  if (!edificios || !edificios.length) return null
  const comunaPub = norm(pub.comuna)
  const { calle, numero } = parseDireccion(pub)
  if (!calle) return null
  return edificios.find(e => {
    if (norm(e.comuna) !== comunaPub) return false
    const calleEdi = norm(e.calle)
    const numEdi = String(e.numero_calle || '').trim()
    // calle coincide (una contiene a la otra) y numero igual si ambos existen
    const calleOk = calleEdi && (calleEdi === calle || calle.includes(calleEdi) || calleEdi.includes(calle))
    const numOk = !numero || !numEdi || numero === numEdi
    return calleOk && numOk
  }) || null
}

// ─────────────────────────────────────────────────────────────
// Match de UNA propiedad contra UN requerimiento
// Devuelve { match: bool, grado: number, motivos: [...], falla: '...' }
// ─────────────────────────────────────────────────────────────

function matchPropiedad(req, pub, edificio, valorUF) {
  const motivos = []

  // 0) Operacion: solo venta (Fase 1)
  if (norm(pub.objetivo).includes('arriendo')) return { match: false, falla: 'es arriendo' }

  // 1) Tipo
  if (req.tipos && req.tipos.length) {
    const tiposReq = req.tipos.map(norm)
    if (!tiposReq.includes(norm(pub.tipo))) return { match: false, falla: 'tipo no calza' }
  }

  // 2) Precio (convertir todo a pesos para comparar)
  const ufVal = valorUF || 1
  const precioPub = pub.tipo_moneda && String(pub.tipo_moneda).toUpperCase() === 'UF'
    ? (num(pub.valor) || 0) * ufVal
    : (num(pub.valor) || 0)
  const minReq = req.precio_min != null ? (String(req.moneda).toUpperCase() === 'UF' ? req.precio_min * ufVal : req.precio_min) : null
  const maxReq = req.precio_max != null ? (String(req.moneda).toUpperCase() === 'UF' ? req.precio_max * ufVal : req.precio_max) : null
  if (minReq != null && precioPub < minReq) return { match: false, falla: 'bajo precio min' }
  if (maxReq != null && precioPub > maxReq) return { match: false, falla: 'sobre precio max' }

  // 3) Dormitorios, banos, estacionamientos, m2
  if (req.dorm_min != null && (num(pub.dormitorios) || 0) < req.dorm_min) return { match: false, falla: 'pocos dormitorios' }
  if (req.banos_min != null && (num(pub.banos) || 0) < req.banos_min) return { match: false, falla: 'pocos banos' }
  if (req.estac_min != null && (num(pub.estacionamientos) || 0) < req.estac_min) return { match: false, falla: 'pocos estacionamientos' }
  if (req.mt2_const_min != null && (num(pub.mt2_const) || 0) < req.mt2_const_min) return { match: false, falla: 'm2 const insuficiente' }
  if (req.mt2_terreno_min != null && (num(pub.mt2_terreno) || 0) < req.mt2_terreno_min) return { match: false, falla: 'm2 terreno insuficiente' }

  // 4) Zona: comuna (Fase 1)
  if (req.comunas && req.comunas.length) {
    const comunasReq = req.comunas.map(norm)
    if (!comunasReq.includes(norm(pub.comuna))) return { match: false, falla: 'comuna fuera de zona' }
  }

  // 5) Amenities obligatorias: TODAS deben estar
  if (req.amenities_oblig && req.amenities_oblig.length) {
    for (const a of req.amenities_oblig) {
      if (!propiedadTieneAmenity(a, pub, edificio)) {
        return { match: false, falla: 'falta amenity obligatoria: ' + a }
      }
    }
    motivos.push('cumple ' + req.amenities_oblig.length + ' amenities obligatorias')
  }

  // --- Si llego aqui, ES MATCH. Calcular grado ---
  let grado = 100

  // +puntos por amenities deseables presentes
  let deseadasOk = 0
  if (req.amenities_desea && req.amenities_desea.length) {
    for (const a of req.amenities_desea) {
      if (propiedadTieneAmenity(a, pub, edificio)) { deseadasOk++; grado += 5 }
    }
    motivos.push(deseadasOk + '/' + req.amenities_desea.length + ' amenities deseables')
  }

  // pequeño bonus si el precio esta holgado bajo el tope
  if (maxReq != null && precioPub <= maxReq * 0.9) { grado += 3; motivos.push('precio holgado') }

  return { match: true, grado, motivos, deseadasOk }
}

// ─────────────────────────────────────────────────────────────
// Buscar todas las propiedades que matchean un requerimiento
// ─────────────────────────────────────────────────────────────

function buscarMatches(req, publicaciones, edificios, valorUF) {
  const resultados = []
  for (const pub of (publicaciones || [])) {
    const edi = edificioDePublicacion(pub, edificios)
    const r = matchPropiedad(req, pub, edi, valorUF)
    if (r.match) {
      resultados.push({ pub, edificio: edi, grado: r.grado, motivos: r.motivos, deseadasOk: r.deseadasOk })
    }
  }
  // ordenar por grado desc
  resultados.sort((a, b) => b.grado - a.grado)
  return resultados
}

// ─────────────────────────────────────────────────────────────
// Match inverso: dada una propiedad, que requerimientos calzan
// ─────────────────────────────────────────────────────────────

function buscarRequerimientosParaPropiedad(pub, edificio, requerimientos, valorUF) {
  const resultados = []
  for (const req of (requerimientos || [])) {
    if (req.estado && req.estado !== 'activo') continue
    const r = matchPropiedad(req, pub, edificio, valorUF)
    if (r.match) resultados.push({ req, grado: r.grado, motivos: r.motivos })
  }
  resultados.sort((a, b) => b.grado - a.grado)
  return resultados
}

export {
  MAPA_AMENITIES,
  AMENITIES_DISPONIBLES,
  propiedadTieneAmenity,
  edificioDePublicacion,
  matchPropiedad,
  buscarMatches,
  buscarRequerimientosParaPropiedad,
  esVerdadero,
  num,
  norm,
}
