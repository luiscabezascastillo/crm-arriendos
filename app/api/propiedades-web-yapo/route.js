import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET() {
  const { data, error } = await supabase
    .from('publicaciones')
    .select('codigo, direccion, comuna, tipo, objetivo, valor, tipo_moneda, dormitorios, banos, mt2_const, mt2_terreno, estacionamientos, bodegas, ggcc, observaciones, latitud, longitud, vendedor, video, imagen1, imagen2, imagen3, imagen4, imagen5, imagen6, imagen7, imagen8, imagen9, imagen10')
    .eq('yapo', 'SI')
    .order('codigo', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300',
    }
  })
}