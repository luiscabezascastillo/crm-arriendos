// VERSION: v2 · 2026-08-21 · FIX cierre en Portal Inmobiliario: MercadoLibre NO permite pasar un item de
//   'active' a 'closed' directamente. Hay que PAUSAR primero y luego CERRAR (active → paused → closed).
//   Antes se hacía un PUT directo a status:'closed' sobre un item activo → ML lo rechazaba y el "Dar de
//   baja" dejaba el aviso vivo en PI. Ahora: lee el estado, si está 'closed' no hace nada, si está 'active'
//   lo pausa y lo cierra, si está 'paused' lo cierra. Devuelve error claro si algo falla (ya no en silencio).
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

export async function POST(request) {
  try {
    const { codigoPI } = await request.json()
    if (!codigoPI) return NextResponse.json({ ok: false, error: 'Falta codigoPI' }, { status: 400 })
    const token = await getValidToken()
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Accept': 'application/json' }

    // Estado actual del item
    const g = await fetch(`${ML_API}/items/${codigoPI}?attributes=status`, { headers })
    const gj = await g.json().catch(() => ({}))
    const status = gj.status
    if (g.status === 404) return NextResponse.json({ ok: false, error: `El aviso ${codigoPI} no existe en ML.` }, { status: 404 })
    if (!status) return NextResponse.json({ ok: false, error: `No se pudo leer el estado de ${codigoPI} en ML (${g.status}).`, ml: gj }, { status: 500 })
    if (status === 'closed') return NextResponse.json({ ok: true, ya_cerrado: true })

    const put = async (body) => {
      const r = await fetch(`${ML_API}/items/${codigoPI}`, { method: 'PUT', headers, body: JSON.stringify(body) })
      const j = await r.json().catch(() => ({}))
      return { ok: r.status === 200, http: r.status, body: j }
    }

    // active → paused → closed (ML no cierra directo un activo)
    if (status === 'active') {
      const p = await put({ status: 'paused' })
      if (!p.ok) return NextResponse.json({ ok: false, error: `No se pudo pausar en ML: ${p.body?.message || p.http}`, ml: p.body }, { status: 500 })
    }
    const c = await put({ status: 'closed' })
    if (!c.ok) return NextResponse.json({ ok: false, error: `No se pudo cerrar en ML: ${c.body?.message || c.http}`, ml: c.body }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
