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

    const [rVisitas, rItem] = await Promise.all([
      fetch('https://api.mercadolibre.com/items/visits?ids=MLC3995228830&date_from=2026-06-01&date_to=2026-06-05', {
        headers: { 'Authorization': `Bearer ${token}` }
      }),
      fetch('https://api.mercadolibre.com/items/MLC3995228830', {
        headers: { 'Authorization': `Bearer ${token}` }
      }),
    ])

    return NextResponse.json({
      visitas_status: rVisitas.status,
      visitas: await rVisitas.json(),
      item_status: rItem.status,
      item: await rItem.json(),
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}