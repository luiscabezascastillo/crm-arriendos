import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET() {
  try {
    const { data: rows } = await supabase
      .from('configuracion')
      .select('clave, valor')
      .in('clave', ['ml_refresh_token', 'ml_access_token'])

    const config = {}
    for (const row of rows || []) config[row.clave] = row.valor

    const refreshToken = config['ml_refresh_token'] || 'TG-6a07b393d1ecc90001d03dc4-330114447'

    const res = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: process.env.ML_CLIENT_ID,
        client_secret: process.env.ML_CLIENT_SECRET,
        refresh_token: refreshToken,
      }),
    })

    const json = await res.json()

    if (!res.ok) {
      return NextResponse.json({ error: json.message || JSON.stringify(json), status: res.status }, { status: 400 })
    }

    const nuevaExpiracion = new Date(Date.now() + (json.expires_in || 21600) * 1000).toISOString()

    await supabase.from('configuracion').upsert([
      { clave: 'ml_access_token',  valor: json.access_token,                 updated_at: new Date().toISOString() },
      { clave: 'ml_refresh_token', valor: json.refresh_token || refreshToken, updated_at: new Date().toISOString() },
      { clave: 'ml_token_expira',  valor: nuevaExpiracion,                    updated_at: new Date().toISOString() },
    ])

    return NextResponse.json({
      ok: true,
      access_token: json.access_token,
      expira: nuevaExpiracion,
      mensaje: 'Token refrescado correctamente'
    })

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}