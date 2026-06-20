import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabaseClient'
import { registrarBitacora } from '@/lib/bitacora'
import { getServerSession } from 'next-auth'

const ML_CLIENT_ID = process.env.ML_CLIENT_ID
const ML_CLIENT_SECRET = process.env.ML_CLIENT_SECRET
const ML_API           = 'https://api.mercadolibre.com'

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

  const refreshToken = config['ml_refresh_token'] || 'TG-6a07b393d1ecc90001d03dc4-330114447'

  const res = await fetch(`${ML_API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token', client_id: ML_CLIENT_ID,
      client_secret: ML_CLIENT_SECRET, refresh_token: refreshToken,
    }),
  })

  if (!res.ok) throw new Error(`Error refrescando token: ${res.status}`)

  const json = await res.json()
  const expiresIn = json.expires_in || 21600
  const nuevaExpiracion = new Date(ahora.getTime() + expiresIn * 1000).toISOString()

  await supabase.from('configuracion').upsert([
    { clave: 'ml_access_token',  valor: json.access_token,                updated_at: new Date().toISOString() },
    { clave: 'ml_refresh_token', valor: json.refresh_token || refreshToken, updated_at: new Date().toISOString() },
    { clave: 'ml_token_expira',  valor: nuevaExpiracion,                   updated_at: new Date().toISOString() },
  ])

  return json.access_token
}

export async function POST(request) {
    try {
      const session = await getServerSession()
      const usuarioBitacora = session?.user?.name || session?.user?.email || null
      const { publicacionId } = await request.json()
    if (!publicacionId) return NextResponse.json({ error: 'Falta publicacionId' }, { status: 400 })

    const { data: p, error } = await supabase
      .from('publicaciones')
      .select('id, codigo, codigo_pi, activo, pi')
      .eq('id', publicacionId).single()

    if (error || !p) return NextResponse.json({ error: 'Propiedad no encontrada' }, { status: 404 })
    if (!p.codigo_pi) return NextResponse.json({ error: 'Esta propiedad no tiene código PI asignado' }, { status: 400 })

    const accessToken = await getValidToken()

    const res = await fetch(`${ML_API}/items/${p.codigo_pi}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ status: 'closed' }),
    })

    if (res.status !== 200) {
      const err = await res.json()
      return NextResponse.json({ error: `Error ML ${res.status}: ${err.message || JSON.stringify(err)}` }, { status: 500 })
    }

    await supabase.from('publicaciones').update({
      pi: 'NO', activo: 'CLOSE',
      updated_at: new Date().toISOString(),
    }).eq('id', publicacionId)

    await registrarBitacora({ idpublicacion: publicacionId, codigo: p.codigo, evento: 'cerrar_pi', detalle: 'Cerrada en Portal Inmobiliario (' + p.codigo_pi + ')', usuario: usuarioBitacora })

      return NextResponse.json({
      ok: true,
      mensaje: `✓ Propiedad ${p.codigo} cerrada en Portal Inmobiliario (${p.codigo_pi})`,
    })

  } catch (error) {
    console.error('Error cerrar-pi:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
