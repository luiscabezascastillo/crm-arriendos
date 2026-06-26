// app/api/canje/importar-asia/route.js
// Importador de propiedades de VENTA de Asia Propiedades -> tabla propiedades_canje
// Version PRUEBA: limita a LIMITE propiedades. Quitar el limite cuando este validado.

import { createClient } from '@supabase/supabase-js'

const CORREDOR = 'Asia Propiedades'
const BASE = 'https://www.asiapropiedades.cl'
const URL_LISTA = BASE + '/venta'
const LIMITE = null   // sin limite: procesa todas

const HEADERS_NAVEGADOR = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-CL,es;q=0.9',
}

// Lista oficial de comunas del CRM (de lib/comunas.js). Orden = prioridad de deteccion.
const COMUNAS_LISTA = ['Alhué','Buin','Calera de Tango','Cerrillos','Cerro Navia','Colina','Conchalí','Curacaví','El Bosque','El Monte','Estación Central','Huechuraba','Independencia','Isla de Maipo','La Cisterna','La Florida','La Granja','La Pintana','La Reina','Lampa','Las Condes','Lo Barnechea','Lo Espejo','Lo Prado','Macul','Maipú','María Pinto','Melipilla','Ñuñoa','Padre Hurtado','Paine','Pedro Aguirre Cerda','Peñaflor','Peñalolén','Pirque','Providencia','Pudahuel','Puente Alto','Quilicura','Quinta Normal','Recoleta','Renca','San Bernardo','San Joaquín','San José de Maipo','San José de Melipilla','San Miguel','San Pedro','San Ramón','Santiago','Talagante','Tiltil','Vitacura','Antofagasta','Curarrehue','Pucón','Villarrica','Puerto Varas','Valparaíso','Viña del Mar']

function sinTildes(s) {
  return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

// Detecta la comuna real cruzando la direccion contra la lista oficial.
// Estrategia: la PRIMERA comuna de la lista que aparezca en la direccion.
// (En "Los Trapenses, Lo Barnechea - Las Condes" detecta Lo Barnechea, la correcta.)
function detectarComuna(direccion) {
  const dir = sinTildes(direccion)
  if (!dir) return ''
  // buscamos posicion de cada comuna; nos quedamos con la que aparece ANTES en el texto
  let mejor = '', mejorPos = Infinity
  for (const com of COMUNAS_LISTA) {
    const pos = dir.indexOf(sinTildes(com))
    if (pos !== -1 && pos < mejorPos) { mejorPos = pos; mejor = com }
  }
  return mejor
}

function decodificarEntidades(s) {
  if (s == null) return ''
  return String(s)
    .replace(/&sup2;/g, '2')
    .replace(/&aacute;/gi, 'a').replace(/&eacute;/gi, 'e').replace(/&iacute;/gi, 'i')
    .replace(/&oacute;/gi, 'o').replace(/&uacute;/gi, 'u')
    .replace(/&Aacute;/g, 'A').replace(/&Eacute;/g, 'E').replace(/&Iacute;/g, 'I')
    .replace(/&Oacute;/g, 'O').replace(/&Uacute;/g, 'U')
    .replace(/&ntilde;/gi, 'n').replace(/&Ntilde;/g, 'N')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&deg;/g, ' ')
}
function limpiar(s) {
  if (s == null) return ''
  return decodificarEntidades(String(s).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}
function campoTabla(html, etiqueta) {
  const re = new RegExp('<b>\\s*' + etiqueta + '\\s*</b>\\s*</td>\\s*<td[^>]*>([\\s\\S]*?)</td>', 'i')
  const m = html.match(re)
  return m ? limpiar(m[1]) : ''
}
function soloNumero(s) {
  if (!s) return ''
  const m = String(s).replace(/\./g, '').match(/-?\d+/)
  return m ? m[0] : ''
}
function parsearPrecio(html) {
  const campo = campoTabla(html, 'Precio')
  let tipo_moneda = '', valor = ''
  if (campo) {
    if (/UF/i.test(campo)) { tipo_moneda = 'UF'; valor = soloNumero(campo) }
    else if (campo.includes('$')) { tipo_moneda = 'CLP'; valor = soloNumero(campo) }
    else { valor = soloNumero(campo) }
  }
  return { tipo_moneda, valor }
}

function parsearFicha(html, url) {
  const codigoOrigen = (url.match(/\/propiedad\/(\d+)_/) || [])[1] || ''

  let titulo = ''
  const mTit = html.match(/<h[12][^>]*>([^<]{3,150})<\/h[12]>/i)
  if (mTit) titulo = limpiar(mTit[1])

  const direccion   = campoTabla(html, 'Direcci[o\u00f3]n')
  const tipo        = campoTabla(html, 'Tipo de propiedad')
  const operacion   = campoTabla(html, 'Operaci[o\u00f3]n')
  const dormitorios = soloNumero(campoTabla(html, 'Dormitorios'))
  const banos       = soloNumero(campoTabla(html, 'Ba[\u00f1n]os'))
  const superficie  = campoTabla(html, 'Superficie total')
  const estac       = soloNumero(campoTabla(html, 'Estacionamiento'))

  const { tipo_moneda, valor } = parsearPrecio(html)

  let descripcion = ''
  const mDesc = html.match(/Descripci[o\u00f3]n\s*<\/h4>\s*([\s\S]*?)<\/(?:p|div)>/i)
  if (mDesc) descripcion = limpiar(mDesc[1])
  if (!descripcion) {
    const mP = html.match(/<p[^>]*>([\s\S]{120,}?)<\/p>/i)
    if (mP) descripcion = limpiar(mP[1])
  }

  const fotos = []
  const reImg = /https?:\/\/www\.asiapropiedades\.cl\/images\/[\w-]+\.(?:jpg|jpeg|png)/gi
  let mImg
  while ((mImg = reImg.exec(html)) !== null) {
    const u = mImg[0], bajo = u.toLowerCase()
    if (bajo.includes('thumb-') || bajo.includes('/logo') || bajo.includes('/social/') ||
        bajo.includes('contactenos') || bajo.includes('whataspp') || bajo.includes('whatsapp') ||
        bajo.includes('icon')) continue
    if (!fotos.includes(u)) fotos.push(u)
  }

  let latitud = '', longitud = ''
  const mLng = html.match(/!2d(-?\d+\.\d+)/)
  const mLat = html.match(/!3d(-?\d+\.\d+)/)
  if (mLat) latitud = mLat[1]
  if (mLng) longitud = mLng[1]

  const comuna = detectarComuna(direccion)

  return {
    corredor_origen: CORREDOR,
    codigo_origen: codigoOrigen,
    url_original: url,
    titulo, descripcion,
    fotos: fotos,
    objetivo: (operacion || '').toLowerCase().includes('arriend') ? 'arriendo' : 'venta',
    tipo, tipo_moneda, valor, dormitorios, banos,
    estacionamientos: estac,
    mt2_const: soloNumero(superficie) || '',
    comuna, direccion, latitud, longitud,
    activa: true,
    updated_at: new Date().toISOString(),
  }
}

export async function GET() {
  const log = []
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const resLista = await fetch(URL_LISTA, { headers: HEADERS_NAVEGADOR })
    if (!resLista.ok) {
      return Response.json({ ok: false, paso: 'leer lista', status: resLista.status }, { status: 502 })
    }
    const htmlLista = await resLista.text()

    const slugs = [...new Set((htmlLista.match(/\/propiedad\/\d+_[^\s"'<>]+/g) || []))]
    let urls = slugs.map(s => BASE + s)
    log.push('Propiedades encontradas en la lista: ' + urls.length)

    if (LIMITE) { urls = urls.slice(0, LIMITE); log.push('LIMITE de prueba: procesando ' + urls.length) }

    const resultados = []
    for (const url of urls) {
      try {
        const r = await fetch(url, { headers: HEADERS_NAVEGADOR })
        if (!r.ok) { resultados.push({ url, ok: false, status: r.status }); continue }
        const html = await r.text()
        const datos = parsearFicha(html, url)
        if (!datos.codigo_origen) { resultados.push({ url, ok: false, motivo: 'sin codigo' }); continue }

        const { error } = await supabase
          .from('propiedades_canje')
          .upsert(datos, { onConflict: 'corredor_origen,codigo_origen' })

        if (error) resultados.push({ url, ok: false, error: error.message })
        else resultados.push({ codigo: datos.codigo_origen, titulo: datos.titulo, precio: datos.tipo_moneda + ' ' + datos.valor, comuna: datos.comuna, ok: true })
      } catch (e) {
        resultados.push({ url, ok: false, error: e.message })
      }
    }

    const okCount = resultados.filter(r => r.ok).length
    return Response.json({
      ok: true, corredor: CORREDOR, log,
      importadas: okCount, total_procesadas: resultados.length, detalle: resultados,
    })
  } catch (err) {
    return Response.json({ ok: false, error: err.message, log }, { status: 500 })
  }
}