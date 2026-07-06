import { NextResponse } from 'next/server'

// Limpia la dirección para Nominatim: quita depto/oficina/casa y nº de unidad.
function limpiarDireccion(d) {
  if (!d) return ''
  let s = String(d)
  s = s.replace(/\b(depto|dpto|dep|departamento|oficina|ofic|of|casa|local|piso|torre|block|blk)\b.*/i, '')
  s = s.replace(/[,;].*$/, '')
  return s.trim()
}

async function geocode(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=cl&q=${encodeURIComponent(q)}`
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'FondoCapitalRent-CRM/1.0', 'Accept-Language': 'es' }, signal: AbortSignal.timeout(6000) })
    if (!r.ok) return null
    const d = await r.json()
    if (Array.isArray(d) && d.length) return { lat: Number(d[0].lat), lng: Number(d[0].lon), display: d[0].display_name || null }
  } catch (e) {}
  return null
}

function proveedoresMapa(lat, lng) {
  const z = 15, w = 460, h = 300
  return [
    `https://maps.wikimedia.org/img/osm-intl,${z},${lat},${lng},${w}x${h}.png`,
    `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=${z}&size=${w}x${h}&maptype=mapnik&markers=${lat},${lng},red-pushpin`,
    `https://static-maps.yandex.ru/1.x/?ll=${lng},${lat}&z=${z}&size=${w},${h}&l=map&pt=${lng},${lat},pm2rdm`,
  ]
}

async function traerMapa(lat, lng) {
  for (const url of proveedoresMapa(lat, lng)) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'FondoCapitalRent-CRM/1.0' }, signal: AbortSignal.timeout(6000) })
      if (!r.ok) continue
      const ct = r.headers.get('content-type') || ''
      const buf = Buffer.from(await r.arrayBuffer())
      if (buf.length < 800) continue
      const mime = ct.includes('jpeg') ? 'image/jpeg' : 'image/png'
      return { mapa: `data:${mime};base64,${buf.toString('base64')}`, fuente: url.split('/')[2] }
    } catch (e) {}
  }
  return { mapa: null, fuente: null }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const direccion = (searchParams.get('direccion') || '').trim()
    const comuna = (searchParams.get('comuna') || '').trim()
    if (!direccion && !comuna) return NextResponse.json({ lat: null, lng: null, mapa: null })

    const calle = limpiarDireccion(direccion)
    // Intento 1: calle limpia + comuna. Intento 2: solo comuna.
    let geo = await geocode([calle, comuna, 'Chile'].filter(Boolean).join(', '))
    let aprox = false
    if (!geo && comuna) { geo = await geocode([comuna, 'Chile'].join(', ')); aprox = true }

    if (!geo) return NextResponse.json({ lat: null, lng: null, mapa: null, sin_resultado: true })

    const { mapa, fuente } = await traerMapa(geo.lat, geo.lng)
    return NextResponse.json({ lat: geo.lat, lng: geo.lng, display_name: geo.display, mapa, fuente_mapa: fuente, aproximado: aprox, consulta: calle })
  } catch (e) {
    return NextResponse.json({ lat: null, lng: null, mapa: null, error: e.message })
  }
}