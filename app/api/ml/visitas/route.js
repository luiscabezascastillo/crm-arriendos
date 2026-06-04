import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })

  const { data: rows } = await supabase.from('configuracion').select('valor').eq('clave', 'ml_access_token').single()
  const token = rows?.valor

  const hoy = new Date()
  const hace7 = new Date(hoy.getTime() - 7 * 24 * 60 * 60 * 1000)
  const from = hace7.toISOString().split('T')[0]
  const to = hoy.toISOString().split('T')[0]

  const res = await fetch(`https://api.mercadolibre.com/items/visits?ids=${id}&date_from=${from}&date_to=${to}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  const data = await res.json()
  const total = Array.isArray(data) ? (data[0]?.total_visits || 0) : 0
  return NextResponse.json({ total })
}