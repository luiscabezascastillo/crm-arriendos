import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sincronizarFotos } from '@/lib/fase2/fotos-ml'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ML_API = 'https://api.mercadolibre.com'

// Prefijo de URL pública de las fotos en fondocapital
const FOTOS_BASE_URL = 'https://www.fondocapital.com/propiedades/'

// Traduce la moneda del CRM al currency_id de Mercado Libre: Pesos -> CLP, UF -> CLF
function monedaToCurrency(tipo_moneda) {
  const m = (tipo_moneda || '').toUpperCase()
  if (m === 'UF' || m === 'CLF') return 'CLF'
  if (m === 'USD') return 'USD'
  return 'CLP'
}

// Limpia la descripcion igual que en publicar-pi/descripcion
function construirDescripcion(pub) {
  let descripcion = pub.observaciones || ''
  descripcion += `\n - ${pub.codigo} - \n\nmetros aproximados proporcionados por el dueno`
  return descripcion
    .replace(/<br>/g, '\n ').replace(/<\/br>/g, '\n ')
    .replace(/Ã¡/g, '\u00E1').replace(/Ã©/g, '\u00E9')
    .replace(/Ã/g, '\u00ED').replace(/Ã³/g, '\u00F3')
    .replace(/Ãº/g, '\u00FA').replace(/Ã±/g, '\u00F1')
}

// Lista ordenada de nombres de archivo de fotos (imagen1..imagen30, break al primer hueco).
function listaFotos(pub) {
  const fotos = []
  for (let i = 1; i <= 30; i++) {
    const img = pub[`imagen${i}`]
    if (!img) break
    fotos.push(img)
  }
  return fotos
}

// Firma de las fotos: nombres en orden, unidos por '|'. Detecta cambios de fotos/orden.
// NOTA FASE 2 (futuro): ampliar a imagen38 cuando se cubran las 38.
function calcularFirmaFotos(pub) {
  const partes = []
  for (let i = 1; i <= 30; i++) {
    partes.push(pub[`imagen${i}`] || '')
  }
  return partes.join('|')
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
  const res = await fetch(`${ML_API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.ML_CLIENT_ID,
      client_secret: process.env.ML_CLIENT_SECRET,
      refresh_token: config['ml_refresh_token'],
    }),
  })
  const json = await res.json()
  const newAccess = json.access_token
  const newRefresh = json.refresh_token || config['ml_refresh_token']
  const nuevaExpiracion = new Date(ahora.getTime() + (json.expires_in || 21600) * 1000).toISOString()
  await supabase.from('configuracion').upsert([
    { clave: 'ml_access_token', valor: newAccess, updated_at: new Date().toISOString() },
    { clave: 'ml_refresh_token', valor: newRefresh, updated_at: new Date().toISOString() },
    { clave: 'ml_token_expira', valor: nuevaExpiracion, updated_at: new Date().toISOString() },
  ])
  return newAccess
}

// POST /api/actualizar-pi  body: { publicacionId }
// Sincroniza precio, video, descripcion y (FASE 2) fotos con el item activo en ML.
export async function POST(request) {
  try {
    const { publicacionId } = await request.json()
    if (!publicacionId) return NextResponse.json({ error: 'Falta publicacionId' }, { status: 400 })

    // 1. Leer la publicacion
    const { data: pub, error: errPub } = await supabase
      .from('publicaciones')
      .select('*')
      .eq('id', publicacionId)
      .single()
    if (errPub || !pub) return NextResponse.json({ error: 'Publicación no encontrada' }, { status: 404 })

    // 2. Si no tiene codigo_pi, no esta en PI
    if (!pub.codigo_pi) {
      return NextResponse.json({
        ok: false,
        necesitaPublicar: true,
        error: 'Esta propiedad aún no está publicada en Portal Inmobiliario. Usa el botón Publicar.',
      }, { status: 400 })
    }

    const token = await getValidToken()

    // 3. Consultar el estado REAL del item en ML
    const resGet = await fetch(`${ML_API}/items/${pub.codigo_pi}?attributes=id,status`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
    })

    if (resGet.status === 404) {
      return NextResponse.json({
        ok: false,
        necesitaRepublicar: true,
        mensaje: 'La publicación ya no existe en Portal Inmobiliario. Hay que republicarla con un código nuevo.',
      })
    }

    const itemML = await resGet.json()
    const status = itemML.status

    // 4. Si esta cerrado/inactivo -> NO actualizar, avisar para republicar
    if (status === 'closed' || status === 'inactive') {
      return NextResponse.json({
        ok: false,
        necesitaRepublicar: true,
        statusML: status,
        mensaje: `La publicación está ${status === 'closed' ? 'cerrada' : 'inactiva'} en Portal Inmobiliario. Para volver a publicarla hay que republicarla con un código nuevo.`,
      })
    }

    // 5. Item activo/pausado -> ACTUALIZAR precio, video y descripcion
    if (status === 'active' || status === 'paused' || status === 'under_review') {
      const resultados = {}

      // 5a. Campos de primer nivel: precio+moneda, video
      const body = {}
      if (pub.valor !== undefined && pub.valor !== null && pub.valor !== '') {
        const precioNum = Number(pub.valor)
        if (!isNaN(precioNum)) {
          body.price = precioNum
          body.currency_id = monedaToCurrency(pub.tipo_moneda)
        }
      }
      if (pub.video !== undefined && pub.video !== null) {
        body.video_id = String(pub.video)
      }
      if (pub.titulo && pub.titulo.trim()) body.title = pub.titulo.trim()

      // amenities del edificio -> atributos HAS_* del PI
      const amen = []
      const addAmen = (cond, id) => { if (cond) amen.push({ id, values: [{ id: '242085', name: 'Si' }] }) }
      addAmen(pub.tiene_ascensor, 'HAS_LIFT')
      addAmen(pub.tiene_piscina, 'HAS_SWIMMING_POOL')
      addAmen(pub.tiene_gimnasio, 'HAS_GYM')
      addAmen(pub.tiene_salon_fiestas, 'HAS_PARTY_ROOM')
      addAmen(pub.tiene_sala_multiuso, 'HAS_MULTIPURPOSE_ROOM')
      addAmen(pub.tiene_quincho_parrilla, 'HAS_GRILL')
      addAmen(pub.tiene_juegos_infantiles, 'HAS_PLAYGROUND')
      addAmen(pub.tiene_sauna, 'HAS_SAUNA')
      addAmen(pub.tiene_jacuzzi, 'HAS_JACUZZI')
      addAmen(pub.tiene_cowork, 'HAS_BUSINESS_CENTER')
      addAmen(pub.tiene_cine, 'HAS_CINEMA_HALL')
      addAmen(pub.tiene_playroom, 'HAS_PLAYROOM')
      addAmen(pub.tiene_recepcion, 'HAS_FRONT_DESK')
      addAmen(pub.tiene_lavanderia, 'HAS_COMMON_LAUNDRY')
      addAmen(pub.tiene_estacionamiento_visitas, 'HAS_GUEST_PARKING')
      addAmen(pub.tiene_cancha_paddle, 'HAS_PADDLE_COURT')
      addAmen(pub.tiene_cancha_tenis, 'HAS_TENNIS_COURT')
      addAmen(pub.tiene_cancha_multiuso, 'HAS_MULTIPLE_USE_COURT')
      addAmen(pub.tiene_area_verde, 'WITH_GREEN_AREA')
      addAmen(pub.tiene_azotea, 'HAS_ROOF_GARDEN')
      addAmen(pub.tiene_generador, 'HAS_ELECTRIC_GENERATOR')
      addAmen(pub.tiene_rampa_silla, 'WHEELCHAIR_RAMP')
      if (amen.length > 0) body.attributes = amen

      // PUT 1: campos (precio, titulo, amenities, video). NO incluye fotos.
      if (Object.keys(body).length > 0) {
        const resPut = await fetch(`${ML_API}/items/${pub.codigo_pi}`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(body),
        })
        const jsonPut = await resPut.json()
        if (resPut.status === 200) {
          resultados.campos = { ok: true, actualizados: Object.keys(body) }
        } else {
          resultados.campos = { ok: false, error: `${resPut.status}: ${jsonPut.message || JSON.stringify(jsonPut)}` }
        }
      }

      // 5b. Descripcion (endpoint aparte)
      const descripcion = construirDescripcion(pub)
      const resDesc = await fetch(`${ML_API}/items/${pub.codigo_pi}/description`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ plain_text: descripcion }),
      })
      resultados.descripcion = { ok: resDesc.status === 200 }

      // ───────────────────────────────────────────────────────────────────
      // 5c. FOTOS (FASE 2) — delega en el módulo lib/fase2/fotos-ml.js
      // ───────────────────────────────────────────────────────────────────
      const firmaActual = calcularFirmaFotos(pub)
      const firmaGuardada = pub.fotos_firma || null
      // Hay cambio si la firma guardada difiere de la actual.
      // Si no hay firma guardada (null) pero SÍ hay mapeo fotos_ml, comparamos contra
      // la firma que implican esas fotos: si difieren, hay cambio pendiente que sincronizar.
      let fotosCambiaron = false
      if (firmaGuardada !== null) {
        fotosCambiaron = firmaGuardada !== firmaActual
      } else if (Array.isArray(pub.fotos_ml) && pub.fotos_ml.length > 0) {
        // Reconstruimos la firma "según ML" desde fotos_ml (nombres en orden, padding a 30)
        const nombresMl = pub.fotos_ml.map(f => f && f.imagen ? f.imagen : '')
        while (nombresMl.length < 30) nombresMl.push('')
        const firmaSegunMl = nombresMl.slice(0, 30).join('|')
        fotosCambiaron = firmaSegunMl !== firmaActual
      }

      let nuevaFotosMl = null
      // Marca si la sincronizacion de fotos qued\u00f3 pendiente/fallida, para NO guardar la firma
      // (asi el cambio se vuelve a detectar la proxima vez y no queda enmascarado).
      let fotosPendientes = false

      if (fotosCambiaron) {
        const fotosActuales = listaFotos(pub)
        // fotos_ml puede ser array (mapeo bueno) u objeto _aviso (desajuste al publicar)
        const fotosMl = Array.isArray(pub.fotos_ml) ? pub.fotos_ml : []
        const r = await sincronizarFotos({
          token,
          codigoPi: pub.codigo_pi,
          fotosActuales,
          fotosMl,
          baseUrl: FOTOS_BASE_URL,
        })
        resultados.fotos = r
        if (r.ok && r.nuevaFotosMl) {
          nuevaFotosMl = r.nuevaFotosMl
        } else {
          // La sincronizacion no se complet\u00f3 (sin mapeo, error, o sin nuevaFotosMl):
          // dejamos el cambio como pendiente para no enmascararlo guardando la firma.
          fotosPendientes = true
        }
      }

      // Guardar/actualizar firma (y mapeo si las fotos se sincronizaron con exito).
      // CLAVE: NO guardamos la firma si la sincronizacion de fotos qued\u00f3 pendiente/fallida,
      // para que el cambio se vuelva a detectar la proxima vez (no quede enmascarado).
      const updatePub = {}
      if (firmaGuardada !== firmaActual && !fotosPendientes) updatePub.fotos_firma = firmaActual
      if (nuevaFotosMl) updatePub.fotos_ml = nuevaFotosMl
      if (Object.keys(updatePub).length > 0) {
        await supabase.from('publicaciones').update(updatePub).eq('id', publicacionId)
      }

      // Resultado global
      const fallos = []
      if (resultados.campos && !resultados.campos.ok) fallos.push('campos: ' + resultados.campos.error)
      if (!resultados.descripcion.ok) fallos.push('descripción')
      if (resultados.fotos && !resultados.fotos.ok && resultados.fotos.error) fallos.push('fotos: ' + resultados.fotos.error)

      // Aviso de fotos que no es fallo duro (sin mapeo: hay que republicar una vez)
      const avisoFotos = (resultados.fotos && !resultados.fotos.ok && resultados.fotos.sinMapeo)
        ? resultados.fotos.mensaje
        : null

      if (fallos.length === 0) {
        return NextResponse.json({
          ok: true,
          mensaje: (resultados.fotos && resultados.fotos.ok)
            ? '✓ Cambios actualizados en Portal Inmobiliario (incluidas las fotos)'
            : '✓ Cambios actualizados en Portal Inmobiliario',
          avisoFotos,
          resultados,
        })
      }
      return NextResponse.json({
        ok: false,
        error: 'Algunos cambios no se pudieron aplicar: ' + fallos.join('; '),
        avisoFotos,
        resultados,
      }, { status: 500 })
    }

    // 6. Estado inesperado
    return NextResponse.json({
      ok: false,
      error: `Estado de la publicación en PI no manejado: ${status}`,
      statusML: status,
    }, { status: 400 })

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}