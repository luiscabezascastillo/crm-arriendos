import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const ML_CLIENT_ID     = '2049193411681689'
const ML_CLIENT_SECRET = 'y6mb9ngfRImWakAsg8YIViuGAsCp2pqr'
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
    { clave: 'ml_access_token',  valor: json.access_token,                 updated_at: new Date().toISOString() },
    { clave: 'ml_refresh_token', valor: json.refresh_token || refreshToken, updated_at: new Date().toISOString() },
    { clave: 'ml_token_expira',  valor: nuevaExpiracion,                    updated_at: new Date().toISOString() },
  ])

  return json.access_token
}

export async function POST(request) {
  try {
    const { publicacionId } = await request.json()
    if (!publicacionId) return NextResponse.json({ error: 'Falta publicacionId' }, { status: 400 })

    const { data: p } = await supabase
      .from('publicaciones')
      .select('codigo, codigo_pi, observaciones, vendedor')
      .eq('id', publicacionId).single()

    if (!p?.codigo_pi) return NextResponse.json({ error: 'Esta propiedad no tiene código PI' }, { status: 400 })

    // Construir descripción con firma ejecutivo
    let descripcion = p.observaciones || ''
    descripcion += `<br>- ${p.codigo} - <br><br>metros aproximados proporcionados por el dueño`
    descripcion = descripcion
      .replace(/<br>/g, '\n ').replace(/<\/br>/g, '\n ')
      .replace(/á/g, '\u00E1').replace(/é/g, '\u00E9')
      .replace(/í/g, '\u00ED').replace(/ó/g, '\u00F3')
      .replace(/ú/g, '\u00FA').replace(/ñ/g, '\u00F1')
      .replace(/Á/g, '\u00C1').replace(/É/g, '\u00C9')
      .replace(/Í/g, '\u00CD').replace(/Ó/g, '\u00D3')
      .replace(/Ú/g, '\u00DA').replace(/Ñ/g, '\u00D1')

    const accessToken = await getValidToken()

    const res = await fetch(`${ML_API}/items/${p.codigo_pi}/description`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ plain_text: descripcion }),
    })

    if (res.status !== 200) {
      const err = await res.json()
      return NextResponse.json({ error: `Error ML ${res.status}: ${err.message || JSON.stringify(err)}` }, { status: 500 })
    }

    return NextResponse.json({ ok: true, mensaje: `✓ Descripción actualizada en PI (${p.codigo_pi})` })

  } catch (error) {
    console.error('Error actualizar-descripcion-pi:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
