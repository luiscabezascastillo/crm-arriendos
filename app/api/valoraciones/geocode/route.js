import { NextResponse } from 'next/server'

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
    const q = [direccion, comuna, 'Chile'].filter(Boolean).join(', ')
    const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=cl&q=${encodeURIComponent(q)}`
    let lat = null, lng = null, display = null
    try {
      const gr = await fetch(geoUrl, { headers: { 'User-Agent': 'FondoCapitalRent-CRM/1.0', 'Accept-Language': 'es' }, signal: AbortSignal.timeout(6000) })
      if (gr.ok) { const gd = await gr.json(); if (Array.isArray(gd) && gd.length) { lat = Number(gd[0].lat); lng = Number(gd[0].lon); display = gd[0].display_name || null } }
    } catch (e) {}
    if (lat == null) return NextResponse.json({ lat: null, lng: null, mapa: null, sin_resultado: true })
    const { mapa, fuente } = await traerMapa(lat, lng)
    return NextResponse.json({ lat, lng, display_name: display, mapa, fuente_mapa: fuente })
  } catch (e) {
    return NextResponse.json({ lat: null, lng: null, mapa: null, error: e.message })
  }
}