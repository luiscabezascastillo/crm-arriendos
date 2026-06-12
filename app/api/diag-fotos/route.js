// ⚠️ TEMPORAL - endpoint de diagnostico, eliminar en el futuro proximo
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ML_API = 'https://api.mercadolibre.com'

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

// GET /api/diag-fotos?item=MLC4068284020
// Devuelve el estado, las pictures y el thumbnail del item en ML.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const itemId = searchParams.get('item')
    if (!itemId) {
      return NextResponse.json({ error: 'Falta el parametro ?item=MLCxxxx' }, { status: 400 })
    }

    const token = await getValidToken()
    const res = await fetch(`${ML_API}/items/${itemId}`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
    })
    const item = await res.json()

    if (res.status !== 200) {
      return NextResponse.json({ error: 'ML respondio ' + res.status, detalle: item }, { status: res.status })
    }

    // Resumen claro de las fotos
    const fotos = (item.pictures || []).map((p, i) => ({
      orden: i + 1,
      id: p.id,
      url: p.url,
      secure_url: p.secure_url,
      size: p.size,
      max_size: p.max_size,
      quality: p.quality,
    }))

    return NextResponse.json({
      ok: true,
      item_id: item.id,
      status: item.status,
      sub_status: item.sub_status,
      thumbnail: item.thumbnail,
      thumbnail_id: item.thumbnail_id,
      total_fotos: fotos.length,
      fotos,
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
