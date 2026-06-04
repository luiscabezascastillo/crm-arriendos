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
      .eq('clave', 'ml_access_token')
    
    const token = rows?.[0]?.valor
    if (!token) return NextResponse.json({ error: 'Sin token' }, { status: 400 })

    const res = await fetch('https://api.mercadolibre.com/vis/leads/0b238eb5-4a90-44f5-8f80-f692addf96cb', {
      headers: { 'Authorization': `Bearer ${token}` }
    })

    const json = await res.json()
    return NextResponse.json(json)
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}