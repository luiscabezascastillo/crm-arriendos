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

// Trocea un array en lotes de tamaño n
function lotes(arr, n) {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

// POST /api/pi/chequear-estados
// Recorre las publicaciones ACTIVAS con codigo_pi, consulta su status real en ML
// (en lotes de 20 con multiget) y guarda estado_pi + estado_pi_fecha.
// NO mueve nada: solo marca el estado. Devuelve un resumen.
export async function POST() {
  try {
    // 1. Publicaciones activas con codigo_pi
    const { data: pubs, error: errPubs } = await supabase
      .from('publicaciones')
      .select('id, codigo, codigo_pi')
      .eq('activo', 'active')
      .not('codigo_pi', 'is', null)
    if (errPubs) return NextResponse.json({ error: errPubs.message }, { status: 500 })
    if (!pubs || pubs.length === 0) {
      return NextResponse.json({ ok: true, mensaje: 'No hay publicaciones activas con código PI.', resumen: {} })
    }

    const token = await getValidToken()
    const ahora = new Date().toISOString()

    // Mapa codigo_pi -> id de publicación (para guardar luego)
    const porCodigoPi = {}
    for (const p of pubs) porCodigoPi[p.codigo_pi] = p

    // 2. Consultar ML en lotes de 20 (multiget verbose: [{code, body}])
    const codigos = pubs.map(p => p.codigo_pi)
    const estados = {}      // codigo_pi -> status (o 'no_encontrada' / 'error')
    const noEncontradas = []

    for (const lote of lotes(codigos, 20)) {
      const ids = lote.join(',')
      const res = await fetch(`${ML_API}/items?ids=${ids}&attributes=id,status`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
      })
      const data = await res.json()
      // data es un array verbose: [{ code, body: { id, status } }, ...]
      if (Array.isArray(data)) {
        for (const item of data) {
          const code = item.code
          const body = item.body || {}
          const itemId = body.id
          if (code === 200 && itemId && body.status) {
            estados[itemId] = body.status
          } else if (itemId) {
            estados[itemId] = 'no_encontrada'
            noEncontradas.push(itemId)
          }
        }
      }
    }

    // 3. Guardar estado_pi + estado_pi_fecha por cada publicación
    let actualizadas = 0
    const resumen = { active: 0, paused: 0, closed: 0, under_review: 0, inactive: 0, no_encontrada: 0, otros: 0 }
    const detalleProblemas = []  // las que NO están active (para informar)

    for (const p of pubs) {
      const estado = estados[p.codigo_pi] || 'no_encontrada'
      await supabase
        .from('publicaciones')
        .update({ estado_pi: estado, estado_pi_fecha: ahora })
        .eq('id', p.id)
      actualizadas++

      if (resumen[estado] !== undefined) resumen[estado]++
      else resumen.otros++

      if (estado !== 'active') {
        detalleProblemas.push({ codigo: p.codigo, codigo_pi: p.codigo_pi, estado })
      }
    }

    return NextResponse.json({
      ok: true,
      mensaje: `Chequeo completado: ${actualizadas} publicaciones revisadas.`,
      total: pubs.length,
      resumen,
      problemas: detalleProblemas,
      fecha: ahora,
    })

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}