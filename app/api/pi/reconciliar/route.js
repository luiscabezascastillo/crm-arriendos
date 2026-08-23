// VERSION: v2 · 2026-08-21 · Reconciliación CRM ↔ Portal Inmobiliario (MercadoLibre).
//   GET  → informe (solo lectura): cruza tus publicaciones activas reales de ML (por PROPERTY_CODE = codigo
//          del CRM) contra el CRM. Listas: desincronizadas, crm_dice_baja_pero_viva, fantasmas, huerfanas.
//   POST → aplica acciones que SOLO tocan el CRM (nunca PI): pone el CRM al día con lo que hay en PI.
//          body { action, items:[{id, mlc_real, permalink}] }.
//          - 'sync_links'   → codigo_pi/url_pi = valor real de ML (solo metadato).
//          - 'reactivar'    → pi='SI', activo='active', codigo_pi/url_pi reales, estado_pi='active'.
//          - 'marcar_caida' → pi='NO', activo='closed', estado_pi='closed' (refleja que en PI está caída).
//   Ninguna acción crea/cierra nada en Portal Inmobiliario: solo copia el estado real de PI hacia el CRM.
// VERSION: v1 · 2026-08-21 · GET de reconciliación (solo lectura).
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const ML_API = 'https://api.mercadolibre.com'

async function getValidToken() {
  const { data: rows } = await supabase
    .from('configuracion').select('clave, valor')
    .in('clave', ['ml_access_token', 'ml_token_expira', 'ml_refresh_token'])
  const config = {}
  for (const row of rows || []) config[row.clave] = row.valor
  const expira = config['ml_token_expira'] ? new Date(config['ml_token_expira']) : null
  const ahora = new Date()
  if (config['ml_access_token'] && expira && expira > new Date(ahora.getTime() + 5 * 60 * 1000)) {
    return config['ml_access_token']
  }
  const res = await fetch(`${ML_API}/oauth/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token', client_id: process.env.ML_CLIENT_ID,
      client_secret: process.env.ML_CLIENT_SECRET, refresh_token: config['ml_refresh_token'],
    }),
  })
  const json = await res.json()
  const nuevaExpiracion = new Date(ahora.getTime() + (json.expires_in || 21600) * 1000).toISOString()
  await supabase.from('configuracion').upsert([
    { clave: 'ml_access_token', valor: json.access_token, updated_at: new Date().toISOString() },
    { clave: 'ml_refresh_token', valor: json.refresh_token || config['ml_refresh_token'], updated_at: new Date().toISOString() },
    { clave: 'ml_token_expira', valor: nuevaExpiracion, updated_at: new Date().toISOString() },
  ])
  return json.access_token
}

function lotes(arr, n) { const o = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o }
const propertyCodeDe = (item) => {
  const a = (item.attributes || []).find(x => x.id === 'PROPERTY_CODE')
  return a ? String(a.value_name || '').trim() : ''
}

export async function GET() {
  try {
    const token = await getValidToken()
    const auth = { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' } }

    const meRes = await fetch(`${ML_API}/users/me`, auth)
    const me = await meRes.json()
    const userId = me.id
    if (!userId) return NextResponse.json({ error: 'No se pudo obtener el user_id de ML', detalle: me }, { status: 500 })

    // IDs de todas las publicaciones activas del vendedor (paginado)
    const activeIds = []
    let offset = 0
    for (let guard = 0; guard < 60; guard++) {
      const r = await fetch(`${ML_API}/users/${userId}/items/search?status=active&limit=50&offset=${offset}`, auth)
      const j = await r.json()
      const results = j.results || []
      activeIds.push(...results)
      const total = j.paging?.total ?? results.length
      offset += 50
      if (results.length === 0 || offset >= total) break
    }

    // Detalle: id, status, permalink, PROPERTY_CODE
    const mlItems = []
    for (const lote of lotes(activeIds, 20)) {
      const r = await fetch(`${ML_API}/items?ids=${lote.join(',')}&attributes=id,status,permalink,attributes`, auth)
      const data = await r.json()
      if (Array.isArray(data)) {
        for (const it of data) {
          const b = it.body || {}
          if (it.code === 200 && b.id) mlItems.push({ mlc: b.id, status: b.status, permalink: b.permalink || '', codigo: propertyCodeDe(b) })
        }
      }
    }

    // CRM (todas, paginado)
    let crm = []
    let cfrom = 0
    for (let guard = 0; guard < 20; guard++) {
      const { data } = await supabase.from('publicaciones')
        .select('id, codigo, codigo_pi, url_pi, pi, activo').range(cfrom, cfrom + 999)
      if (!data || data.length === 0) break
      crm = crm.concat(data)
      if (data.length < 1000) break
      cfrom += 1000
    }
    const crmPorCodigo = new Map()
    for (const p of crm) if (p.codigo) crmPorCodigo.set(String(p.codigo).trim(), p)
    const codigosMLactivas = new Set(mlItems.filter(m => m.codigo).map(m => m.codigo))

    const desincronizadas = []
    const crm_dice_baja_pero_viva = []
    const huerfanas = []
    let sincronizadas = 0

    for (const m of mlItems) {
      const pub = m.codigo ? crmPorCodigo.get(m.codigo) : null
      if (!pub) { huerfanas.push({ mlc: m.mlc, property_code: m.codigo || null, permalink: m.permalink }); continue }
      const igualMLC = String(pub.codigo_pi || '') === String(m.mlc)
      if (!igualMLC) desincronizadas.push({ id: pub.id, codigo: pub.codigo, codigo_pi_crm: pub.codigo_pi || null, mlc_real: m.mlc, permalink: m.permalink })
      else sincronizadas++
      if (pub.pi !== 'SI' || pub.activo !== 'active') {
        crm_dice_baja_pero_viva.push({ id: pub.id, codigo: pub.codigo, crm_pi: pub.pi, crm_activo: pub.activo, mlc_real: m.mlc, permalink: m.permalink })
      }
    }

    const fantasmas = crm
      .filter(p => p.pi === 'SI' && p.activo === 'active' && p.codigo && !codigosMLactivas.has(String(p.codigo).trim()))
      .map(p => ({ id: p.id, codigo: p.codigo, codigo_pi_crm: p.codigo_pi || null }))

    return NextResponse.json({
      ok: true,
      resumen: {
        ml_activas: mlItems.length,
        crm_pi_si_activas: crm.filter(p => p.pi === 'SI' && p.activo === 'active').length,
        sincronizadas,
        desincronizadas: desincronizadas.length,
        crm_dice_baja_pero_viva: crm_dice_baja_pero_viva.length,
        fantasmas: fantasmas.length,
        huerfanas: huerfanas.length,
      },
      desincronizadas, crm_dice_baja_pero_viva, fantasmas, huerfanas,
      fecha: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Aplica acciones. SOLO toca el CRM (nunca Portal Inmobiliario).
export async function POST(request) {
  try {
    const body = await request.json()
    const action = String(body?.action || '')
    const items = Array.isArray(body?.items) ? body.items : []
    if (!items.length) return NextResponse.json({ error: 'No hay filas para aplicar.' }, { status: 400 })
    const now = new Date().toISOString()
    let n = 0
    for (const it of items) {
      const id = it.id
      if (!id) continue
      let patch = null
      if (action === 'sync_links') {
        patch = { codigo_pi: it.mlc_real, url_pi: it.permalink || '', updated_at: now }
      } else if (action === 'reactivar') {
        patch = { pi: 'SI', activo: 'active', codigo_pi: it.mlc_real, url_pi: it.permalink || '', estado_pi: 'active', estado_pi_fecha: now, updated_at: now }
      } else if (action === 'marcar_caida') {
        patch = { pi: 'NO', activo: 'closed', estado_pi: 'closed', estado_pi_fecha: now, updated_at: now }
      } else {
        return NextResponse.json({ error: 'Acción no válida: ' + action }, { status: 400 })
      }
      const { error } = await supabase.from('publicaciones').update(patch).eq('id', id)
      if (!error) n++
    }
    return NextResponse.json({ ok: true, action, actualizadas: n })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
