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
    
    // Devolver todos con id y name para identificar los correctos
    const todos = data.map(a => ({ id: a.id, name: a.name, group: a.attribute_group_name, type: a.value_type }))
    
    return NextResponse.json({ total: data.length, atributos: todos })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}