// ⚠️ TEMPORAL - endpoint de diagnostico de atributos, eliminar en el futuro proximo
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

// GET /api/diag-atributos?item=MLCxxxx
// Compara los atributos del item con los que admite su categoria, y marca los que faltan.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const itemId = searchParams.get('item')
    if (!itemId) return NextResponse.json({ error: 'Falta ?item=MLCxxxx' }, { status: 400 })

    const token = await getValidToken()
    const headers = { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }

    // 1. Item: atributos actuales + categoria + tags
    const resItem = await fetch(`${ML_API}/items/${itemId}`, { headers })
    const item = await resItem.json()
    if (resItem.status !== 200) {
      return NextResponse.json({ error: 'ML respondio ' + resItem.status, detalle: item }, { status: resItem.status })
    }

    const categoryId = item.category_id
    const atributosItem = {}
    for (const a of item.attributes || []) {
      atributosItem[a.id] = a.value_name || (a.values && a.values[0] && a.values[0].name) || null
    }

    // 2. Atributos que admite la categoria
    const resCat = await fetch(`${ML_API}/categories/${categoryId}/attributes`, { headers })
    const catAttrs = await resCat.json()

    // 3. Clasificar: cuales tiene el item, cuales faltan, cuales son requeridos para posicionamiento
    const presentes = []
    const faltantes = []
    for (const attr of (Array.isArray(catAttrs) ? catAttrs : [])) {
      const tags = attr.tags || {}
      const esRequerido = tags.required || tags.catalog_required || false
      const afectaPosicion = tags.required || false
      const tieneValor = atributosItem[attr.id] != null && atributosItem[attr.id] !== ''
      const info = {
        id: attr.id,
        name: attr.name,
        value_type: attr.value_type,
        requerido: esRequerido,
        valor_actual: atributosItem[attr.id] || null,
      }
      if (tieneValor) presentes.push(info)
      else faltantes.push(info)
    }

    return NextResponse.json({
      ok: true,
      item_id: item.id,
      category_id: categoryId,
      status: item.status,
      tags_item: item.tags || [],
      incomplete_technical_specs: (item.tags || []).includes('incomplete_technical_specs'),
      total_atributos_categoria: Array.isArray(catAttrs) ? catAttrs.length : 0,
      total_presentes: presentes.length,
      total_faltantes: faltantes.length,
      faltantes,
      presentes,
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
