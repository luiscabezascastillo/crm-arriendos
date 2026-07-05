import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function getMlToken() {
  const { data: rows } = await supabase
    .from('configuracion').select('valor').eq('clave', 'ml_access_token').single()
  return rows?.valor || null
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') || 'departamento venta providencia'
    const token = await getMlToken()

    const url = `https://api.mercadolibre.com/sites/MLC/search?category=MLC1459`
              + `&q=${encodeURIComponent(q)}&limit=5`
    const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })

    const text = await res.text()
    let json = null
    try { json = JSON.parse(text) } catch {}

    return NextResponse.json({
      status: res.status,
      con_token: !!token,
      total: json?.paging?.total ?? null,
      ml_body: json ?? text.slice(0, 800),   // <-- ahora SIEMPRE mostramos lo que dijo ML
      muestra: (json?.results || []).slice(0, 5).map((r) => ({
        id: r.id, title: r.title, price: r.price, currency: r.currency_id, comuna: r.address?.city_name,
      })),
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}