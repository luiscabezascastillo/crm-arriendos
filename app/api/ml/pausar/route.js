import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    const { codigo_pi } = await request.json()
    const { data: rows } = await supabase.from('configuracion').select('valor').eq('clave', 'ml_access_token').single()
    const token = rows?.valor

    const res = await fetch(`https://api.mercadolibre.com/items/${codigo_pi}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'paused' })
    })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data.message }, { status: 400 })

    await supabase.from('publicaciones').update({ activo: 'paused', updated_at: new Date().toISOString() }).eq('codigo_pi', codigo_pi)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}