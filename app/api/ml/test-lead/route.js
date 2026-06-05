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
      .select('valor')
      .eq('clave', 'ml_access_token')
      .single()
    
    const token = rows?.valor

    const res = await fetch('https://api.mercadolibre.com/categories/MLC183186/attributes', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const data = await res.json()
    
    // Filtrar solo atributos relevantes
    const relevantes = data.filter(a => 
      ['PICTURES', 'BEDROOMS', 'FLOOR', 'ANTIQUITY', 'ORIENTATION', 
       'HAS_BALCONY', 'HAS_TERRACE', 'BUILDING_FLOORS', 'UNITS_PER_FLOOR',
       'APARTMENT_NUMBER', 'PROPERTY_REGISTRATION_NUMBER'].includes(a.id)
    )
    
    return NextResponse.json({ 
      total_atributos: data.length,
      relevantes 
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}