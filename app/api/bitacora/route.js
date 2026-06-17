import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const idpublicacion = searchParams.get('idpublicacion')
    const codigo = searchParams.get('codigo')

    if (!idpublicacion && !codigo) {
      return NextResponse.json({ error: 'Falta idpublicacion o codigo' }, { status: 400 })
    }

    let query = supabase
      .from('bitacora')
      .select('id, idpublicacion, codigo, evento, detalle, usuario, created_at')
      .order('created_at', { ascending: false })

    if (idpublicacion) query = query.eq('idpublicacion', Number(idpublicacion))
    else query = query.eq('codigo', String(codigo))

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, eventos: data || [] })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}