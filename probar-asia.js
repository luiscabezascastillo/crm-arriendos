// probar-asia.js  (v3 - acepta <td> con atributos: colspan, width, etc.)
// Script de PRUEBA (opcion A, sin librerias). No escribe en Supabase.
// Uso:  node probar-asia.js

const URL_PRUEBA = 'https://www.asiapropiedades.cl/propiedad/397_Dpto-Duplex-en-Los-Trapenses'

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
  return decodificarEntidades(String(s).replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ').trim()
}

// <td...><b>ETIQUETA</b></td> <td...>VALOR</td>  (los <td> pueden llevar atributos)
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

async function extraer(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FCR-CRM/1.0)' } })
  if (!res.ok) throw new Error('HTTP ' + res.status + ' al leer ' + url)
  const html = await res.text()

  const codigoOrigen = (url.match(/\/propiedad\/(\d+)_/) || [])[1] || ''

  let titulo = ''
  const mTit = html.match(/<h[12][^>]*>([^<]{3,150})<\/h[12]>/i)
  if (mTit) titulo = limpiar(mTit[1])

  const direccion   = campoTabla(html, 'Direcci[o\u00f3]n')
  const tipo        = campoTabla(html, 'Tipo de propiedad')
  const operacion   = campoTabla(html, 'Operaci[o\u00f3]n')
  const dormitorios = soloNumero(campoTabla(html, 'Dormitorios'))
  const banos       = soloNumero(campoTabla(html, 'Ba[\u00f1n]os'))
  const bodegas     = soloNumero(campoTabla(html, 'Bodega\\(s\\)'))
  const superficie  = campoTabla(html, 'Superficie total')
  const estacTabla  = soloNumero(campoTabla(html, 'Estacionamiento'))

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
    const u = mImg[0]
    const bajo = u.toLowerCase()
    if (bajo.includes('thumb-')) continue
    if (bajo.includes('/logo')) continue
    if (bajo.includes('/social/')) continue
    if (bajo.includes('contactenos')) continue
    if (bajo.includes('whataspp') || bajo.includes('whatsapp')) continue
    if (bajo.includes('icon')) continue
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
    corredor_origen: 'Asia Propiedades',
    codigo_origen: codigoOrigen,
    url_original: url,
    titulo, descripcion, fotos,
    objetivo: (operacion || '').toLowerCase().includes('arriend') ? 'arriendo' : 'venta',
    tipo, tipo_moneda: tipoMoneda, valor, dormitorios, banos,
    estacionamientos: estacTabla,
    mt2_const: soloNumero(superficie) || '',
    mt2_terreno: '', comuna, region: '', direccion, latitud, longitud, bodegas,
  }
}

extraer(URL_PRUEBA)
  .then(datos => {
    console.log('\n===== DATOS EXTRAIDOS (v3) =====\n')
    for (const [k, v] of Object.entries(datos)) {
      if (k === 'fotos') {
        console.log('  ' + k + ': ' + v.length + ' fotos')
      } else if (k === 'descripcion') {
        console.log('  ' + k + ': ' + String(v).slice(0, 160) + (v.length > 160 ? '...' : ''))
      } else {
        console.log('  ' + k + ': ' + v)
      }
    }
    console.log('\n===== FIN =====\n')
  })
  .catch(err => console.error('ERROR:', err.message))