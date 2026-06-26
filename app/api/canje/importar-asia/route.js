// app/api/canje/importar-asia/route.js
// Importador de propiedades de VENTA de Asia Propiedades -> tabla propiedades_canje
// Version PRUEBA: limita a LIMITE propiedades. Quitar el limite cuando este validado.
// Lee la lista /venta, extrae cada ficha y hace upsert por (corredor_origen, codigo_origen).

import { createClient } from '@supabase/supabase-js'

const CORREDOR = 'Asia Propiedades'
const BASE = 'https://www.asiapropiedades.cl'
const URL_LISTA = BASE + '/venta'
const LIMITE = 4   // <<< PRUEBA: solo las primeras 4. Poner null para todas.

const HEADERS_NAVEGADOR = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-CL,es;q=0.9',
}

// ── helpers de parseo (validados en el script de prueba) ──
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

// ── extrae los datos de UNA ficha ──
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

  let tipoMoneda = '', valor = ''
  const mUF = html.match(/UF\s*([\d.,]+)/i)
  const mCLP = html.match(/\$\s*([\d.]{4,})/)
  if (mUF) { tipoMoneda = 'UF'; valor = soloNumero(mUF[1]) }
  else if (mCLP) { tipoMoneda = 'CLP'; valor = soloNumero(mCLP[1]) }

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

  let comuna = ''
  if (direccion) {
    const partes = direccion.split(/[,\-]/).map(s => s.trim()).filter(Boolean)
    if (partes.length >= 2) comuna = partes[partes.length - 2]
    else if (partes.length === 1) comuna = partes[0]
  }

  return {
    corredor_origen: CORREDOR,
    codigo_origen: codigoOrigen,
    url_original: url,
    titulo, descripcion,
    fotos: JSON.stringify(fotos),
    objetivo: (operacion || '').toLowerCase().includes('arriend') ? 'arriendo' : 'venta',
    tipo, tipo_moneda: tipoMoneda, valor, dormitorios, banos,
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

    // 1) Leer la lista /venta
    const resLista = await fetch(URL_LISTA, { headers: HEADERS_NAVEGADOR })
    if (!resLista.ok) {
      return Response.json({ ok: false, paso: 'leer lista', status: resLista.status }, { status: 502 })
    }
    const htmlLista = await resLista.text()

    // 2) Extraer URLs unicas de propiedades
    const slugs = [...new Set((htmlLista.match(/\/propiedad\/\d+_[^\s"'<>]+/g) || []))]
    let urls = slugs.map(s => BASE + s)
    log.push('Propiedades encontradas en la lista: ' + urls.length)

    // PRUEBA: limitar
    if (LIMITE) { urls = urls.slice(0, LIMITE); log.push('LIMITE de prueba: procesando ' + urls.length) }

    // 3) Procesar cada ficha
    const resultados = []
    for (const url of urls) {
      try {
        const r = await fetch(url, { headers: HEADERS_NAVEGADOR })
        if (!r.ok) { resultados.push({ url, ok: false, status: r.status }); continue }
        const html = await r.text()
        const datos = parsearFicha(html, url)
        if (!datos.codigo_origen) { resultados.push({ url, ok: false, motivo: 'sin codigo' }); continue }

        // 4) Upsert por (corredor_origen, codigo_origen)
        const { error } = await supabase
          .from('propiedades_canje')
          .upsert(datos, { onConflict: 'corredor_origen,codigo_origen' })

        if (error) resultados.push({ url, ok: false, error: error.message })
        else resultados.push({ codigo: datos.codigo_origen, titulo: datos.titulo, ok: true })
      } catch (e) {
        resultados.push({ url, ok: false, error: e.message })
      }
    }

    const okCount = resultados.filter(r => r.ok).length
    return Response.json({
      ok: true,
      corredor: CORREDOR,
      log,
      importadas: okCount,
      total_procesadas: resultados.length,
      detalle: resultados,
    })
  } catch (err) {
    return Response.json({ ok: false, error: err.message, log }, { status: 500 })
  }
}