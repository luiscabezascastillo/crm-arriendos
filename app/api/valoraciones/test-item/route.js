// app/api/valoraciones/test-item/route.js
// PRUEBA: ¿puedo traer un item de Portal Inmobiliario por su id (link pegado)?
// Uso: /api/valoraciones/test-item?url=<pega aquí la URL de la propiedad>
//
// El buscador (/sites/search) nos dio 403, pero traer UN item público por id
// (/items/{id}) es otro endpoint y suele estar permitido. Esto lo confirma.

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function getMlToken() {
  const { data: rows } = await supabase
    .from('configuracion').select('valor').eq('clave', 'ml_access_token').single()
  return rows?.valor || null
}

// Saca el item_id de cualquier URL de Portal Inmobiliario / MercadoLibre.
// Acepta MLC-983000857 , MLC983000857 , con o sin guion.
function extraerItemId(url) {
  if (!url) return null
  const m = String(url).match(/MLC-?(\d+)/i)
  return m ? `MLC${m[1]}` : null
}

function attr(item, ...ids) {
  const attrs = item.attributes || []
  for (const id of ids) {
    const a = attrs.find((x) => x.id === id)
    if (!a) continue
    if (a.value_struct && a.value_struct.number != null) return Number(a.value_struct.number)
    const raw = String(a.value_name || '').replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.')
    const n = parseFloat(raw)
    if (isFinite(n)) return n
  }
  return null
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url') || ''
    const itemId = extraerItemId(url)
    if (!itemId) {
      return NextResponse.json({ error: 'No pude extraer el id de esa URL. Pega el link de la propiedad (debe contener MLC-...).' }, { status: 400 })
    }

    const token = await getMlToken()
    const res = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    const text = await res.text()
    let it = null
    try { it = JSON.parse(text) } catch {}

    if (!res.ok) {
      return NextResponse.json({
        status: res.status, con_token: !!token, item_id: itemId,
        ml_body: it ?? text.slice(0, 600),
      })
    }

    return NextResponse.json({
      status: res.status,
      con_token: !!token,
      item_id: itemId,
      datos: {
        titulo: it.title,
        precio: it.price,
        moneda: it.currency_id,               // CLF = UF , CLP = pesos
        m2: attr(it, 'COVERED_AREA', 'TOTAL_AREA', 'AREA'),
        dormitorios: attr(it, 'BEDROOMS', 'ROOMS'),
        banos: attr(it, 'FULL_BATHROOMS', 'BATHROOMS'),
        comuna: it.address?.city_name || it.location?.city?.name,
        lat: it.location?.latitude || it.geolocation?.latitude,
        lng: it.location?.longitude || it.geolocation?.longitude,
        permalink: it.permalink,
        estado: it.status,
      },
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}