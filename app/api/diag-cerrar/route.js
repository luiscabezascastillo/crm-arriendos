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

async function putStatus(itemId, status, token) {
  const res = await fetch(`${ML_API}/items/${itemId}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ status }),
  })
  const json = await res.json()
  return { http: res.status, status_devuelto: json.status, error: json.message || json.error || null, detalle: json.cause || null }
}

// GET /api/diag-cerrar?item=MLCxxxx
// Prueba pausar y luego cerrar un item, devolviendo la respuesta de cada paso.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const itemId = searchParams.get('item')
    if (!itemId) return NextResponse.json({ error: 'Falta ?item=MLCxxxx' }, { status: 400 })

    const token = await getValidToken()

    // Estado inicial
    const resGet = await fetch(`${ML_API}/items/${itemId}?attributes=id,status`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
    })
    const itemAntes = await resGet.json()

    // Paso 1: pausar
    const pausar = await putStatus(itemId, 'paused', token)

    // Paso 2: cerrar
    const cerrar = await putStatus(itemId, 'closed', token)

    // Estado final
    const resGet2 = await fetch(`${ML_API}/items/${itemId}?attributes=id,status`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
    })
    const itemDespues = await resGet2.json()

    return NextResponse.json({
      ok: true,
      item: itemId,
      status_inicial: itemAntes.status,
      paso1_pausar: pausar,
      paso2_cerrar: cerrar,
      status_final: itemDespues.status,
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
