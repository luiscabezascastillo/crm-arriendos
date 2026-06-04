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

    // Consultar info del usuario y sus scopes
    const [resUser, resItem] = await Promise.all([
      fetch('https://api.mercadolibre.com/users/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      }),
      fetch('https://api.mercadolibre.com/items/MLC3995228830', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
    ])

    const user = await resUser.json()
    const item = await resItem.json()

    return NextResponse.json({ user_id: user.id, nickname: user.nickname, item_status: item.status, item_title: item.title })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}