import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ML_API = 'https://api.mercadolibre.com'

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
    .replace(/Ã­/g, '\u00ED').replace(/Ã³/g, '\u00F3')
    .replace(/Ãº/g, '\u00FA').replace(/Ã±/g, '\u00F1')
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
// Sincroniza precio, video y descripcion de la publicacion con el item activo en ML.
export async function POST(request) {
  try {
    const { publicacionId } = await request.json()
    if (!publicacionId) return NextResponse.json({ error: 'Falta publicacionId' }, { status: 400 })

    // 1. Leer la publicacion
    const { data: pub, error: errPub } = await supabase
      .from('publicaciones')
      .select('id, codigo, codigo_pi, activo, tipo_moneda, valor, video, observaciones, imagen1, imagen2, imagen3, imagen4, imagen5, imagen6, imagen7, imagen8, imagen9, imagen10, imagen11, imagen12, imagen13, imagen14, imagen15, imagen16, imagen17, imagen18, imagen19, imagen20, imagen21, imagen22, imagen23, imagen24, imagen25, imagen26, imagen27, imagen28, imagen29, imagen30')
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
      // El campo 'video' ya viene en formato ML: "ID;youtube"
      if (pub.video !== undefined && pub.video !== null) {
        body.video_id = String(pub.video)
      }

      // --- HUECO FASE 2: title, attributes (estacionamiento, bodega, amoblado) ---
      // if (pub.titulo) body.title = pub.titulo
      // if (atributos) body.attributes = atributos

      // Fotos: array 1..30 en orden (igual que publicar-pi, break al primer hueco)
      const imagenesPI = []
      for (let i = 1; i <= 30; i++) {
        const img = pub[`imagen${i}`]
        if (!img) break
        imagenesPI.push({ source: `https://www.fondocapital.com/propiedades/${img}` })
      }
      if (imagenesPI.length > 0) body.pictures = imagenesPI

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

      // Resultado global
      const fallos = []
      if (resultados.campos && !resultados.campos.ok) fallos.push('campos: ' + resultados.campos.error)
      if (!resultados.descripcion.ok) fallos.push('descripción')

      if (fallos.length === 0) {
        return NextResponse.json({
          ok: true,
          mensaje: '✓ Cambios actualizados en Portal Inmobiliario',
          resultados,
        })
      }
      return NextResponse.json({
        ok: false,
        error: 'Algunos cambios no se pudieron aplicar: ' + fallos.join('; '),
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