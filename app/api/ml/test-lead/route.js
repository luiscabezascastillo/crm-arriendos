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

    // Intentar varios endpoints VIS
    const [r1, r2] = await Promise.all([
      fetch('https://api.mercadolibre.com/vis/leads/0b238eb5-4a90-44f5-8f80-f692addf96cb', {
        headers: { 'Authorization': `Bearer ${token}` }
      }),
      fetch('https://api.mercadolibre.com/users/330114447/leads', {
        headers: { 'Authorization': `Bearer ${token}` }
      }),
    ])

    return NextResponse.json({
      lead_status: r1.status,
      lead_body: await r1.json(),
      user_leads_status: r2.status,
      user_leads_body: await r2.json(),
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}