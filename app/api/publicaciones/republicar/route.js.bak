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
export async function POST(request) {
  const { sourceId, publicacionId } = await request.json()
  // Obtener publicacion original
  const { data: original, error: errOrig } = await supabase
    .from('publicaciones').select('*').eq('id', sourceId || publicacionId).single()
  if (errOrig || !original) return NextResponse.json({ error: 'Publicacion no encontrada' }, { status: 404 })
  const portalesActivos = {
    pi:   original.pi === 'SI',
    yapo: original.yapo === 'SI',
    web:  original.web === 'SI',
  }
  // 1. Cerrar en PI via API ML (pausar primero, luego cerrar)
  if (original.codigo_pi && (original.activo === 'active' || original.pi === 'SI')) {
    try {
      const token = await getValidToken()
      // Paso 1: pausar (ML no permite active -> closed directo)
      await fetch(`${ML_API}/items/${original.codigo_pi}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paused' })
      })
      // Paso 2: cerrar y verificar la respuesta
      const resClose = await fetch(`${ML_API}/items/${original.codigo_pi}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'closed' })
      })
      if (resClose.status !== 200) {
        const errJson = await resClose.json()
        console.log('Error cerrando PI:', resClose.status, JSON.stringify(errJson))
      }
    } catch(e) { console.log('Error cerrando PI:', e.message) }
  }
  // 2. Marcar original como cerrada
  await supabase.from('publicaciones').update({
    pi: 'NO', yapo: 'NO', web: 'NO', activo: 'CLOSE',
  }).eq('id', sourceId || publicacionId)
  // 3. Obtener max id y codigo
  const { data: maxData } = await supabase
    .from('publicaciones').select('id, codigo').order('id', { ascending: false }).limit(1).single()
  const newId = (maxData?.id || 0) + 1
  const newCodigo = String((parseInt(maxData?.codigo || '16891') + 1))
  // 4. Crear nueva publicacion
  const { id, codigo, codigo_pi, url_pi, url_yapo, url_web, url_goplaceit, url_proppit,
          pi, yapo, web, goplaceit, proppit, activo, fecha_vencimiento_pi,
          sync_id, created_at, updated_at, ...resto } = original
  const { data: nueva, error: errNueva } = await supabase
    .from('publicaciones')
    .insert({ ...resto, id: newId, codigo: newCodigo, activo: 'CREAR', pi: 'NO', yapo: 'NO', web: 'NO', codigo_pi: null, url_pi: null })
    .select('id').single()
  if (errNueva) return NextResponse.json({ error: errNueva.message }, { status: 500 })
  const nuevoId = nueva.id
  const resultados = {}
  // 5. Publicar en PI si estaba activa
  if (portalesActivos.pi) {
    try {
      const res = await fetch(`${process.env.NEXTAUTH_URL || 'https://crm-arriendos.vercel.app'}/api/publicar-pi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicacionId: nuevoId })
      })
      const data = await res.json()
      resultados.pi = data.ok ? '✓' : '✗ ' + data.error
    } catch(e) { resultados.pi = '✗ ' + e.message }
  }
  // 6. Publicar en Web si estaba activa
  if (portalesActivos.web) {
    await supabase.from('publicaciones').update({ web: 'SI' }).eq('id', nuevoId)
    resultados.web = '✓'
  }
  // 7. Publicar en Yapo si estaba activa
  if (portalesActivos.yapo) {
    await supabase.from('publicaciones').update({ yapo: 'SI' }).eq('id', nuevoId)
    resultados.yapo = '✓'
  }
  return NextResponse.json({
    ok: true,
    id: nuevoId,
    codigo: newCodigo,
    portalesActivos,
    resultados,
    mensaje: `✓ Republicado con código ${newCodigo}`
  })
}