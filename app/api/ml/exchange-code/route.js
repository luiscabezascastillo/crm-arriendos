import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  if (!code) return NextResponse.json({ error: 'Falta code' }, { status: 400 })

  const res = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.ML_CLIENT_ID,
      client_secret: process.env.ML_CLIENT_SECRET,
      code,
      redirect_uri: 'https://fcr2022-4.herokuapp.com/',
    }),
  })

  const json = await res.json()
  if (!res.ok) return NextResponse.json({ error: json }, { status: 400 })

  const expira = new Date(Date.now() + (json.expires_in || 21600) * 1000).toISOString()

  await supabase.from('configuracion').upsert([
    { clave: 'ml_access_token',  valor: json.access_token,  updated_at: new Date().toISOString() },
    { clave: 'ml_refresh_token', valor: json.refresh_token, updated_at: new Date().toISOString() },
    { clave: 'ml_token_expira',  valor: expira,             updated_at: new Date().toISOString() },
  ])

  return NextResponse.json({ ok: true, expira, mensaje: 'Token guardado correctamente' })
}