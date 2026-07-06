// app/api/valoraciones/geocode/route.js
// 1) Geocodifica dirección+comuna con Nominatim (OSM, gratis, sin key).
// 2) Trae el mapa estático de OSM ya en base64 (server-side, evita CORS).
// Devuelve { lat, lng, mapa } o nulls si algo falla. Nunca rompe el informe.

import { NextResponse } from 'next/server'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const direccion = (searchParams.get('direccion') || '').trim()
    const comuna = (searchParams.get('comuna') || '').trim()
    if (!direccion && !comuna) return NextResponse.json({ lat: null, lng: null, mapa: null })

    // --- 1) Geocode ---
    const q = [direccion, comuna, 'Chile'].filter(Boolean).join(', ')
    const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=cl&q=${encodeURIComponent(q)}`
    let lat = null, lng = null, display = null
    try {
      const gr = await fetch(geoUrl, { headers: { 'User-Agent': 'FondoCapitalRent-CRM/1.0 (valoraciones)', 'Accept-Language': 'es' } })
      if (gr.ok) {
        const gd = await gr.json()
        if (Array.isArray(gd) && gd.length) { lat = Number(gd[0].lat); lng = Number(gd[0].lon); display = gd[0].display_name || null }
      }
    } catch (e) { /* sin geocode */ }

    if (lat == null) return NextResponse.json({ lat: null, lng: null, mapa: null, sin_resultado: true })

    // --- 2) Mapa estático OSM (comunidad, keyless) -> base64 ---
    let mapa = null
    try {
      const mapUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=15&size=460x300&maptype=mapnik&markers=${lat},${lng},red-pushpin`
      const mr = await fetch(mapUrl, { headers: { 'User-Agent': 'FondoCapitalRent-CRM/1.0 (valoraciones)' } })
      if (mr.ok) {
        const buf = Buffer.from(await mr.arrayBuffer())
        if (buf.length > 500) mapa = `data:image/png;base64,${buf.toString('base64')}`
      }
    } catch (e) { /* sin mapa, el PDF sale igual */ }

    return NextResponse.json({ lat, lng, display_name: display, mapa })
  } catch (e) {
    return NextResponse.json({ lat: null, lng: null, mapa: null, error: e.message })
  }
}
