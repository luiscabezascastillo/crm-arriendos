// app/api/valoraciones/listar/route.js
// GET sin params -> lista todas las valoraciones (resumen para la tabla del historial).
// GET ?id=N        -> devuelve una valoración completa con sus testigos (para reabrir/editar).

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (id) {
      const { data: val, error: e1 } = await supabase.from('valoraciones').select('*').eq('id', id).maybeSingle()
      if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
      if (!val) return NextResponse.json({ error: 'No existe esa valoración' }, { status: 404 })
      const { data: comps } = await supabase.from('valoracion_comparables').select('*').eq('valoracion_id', id)
      return NextResponse.json({ valoracion: val, comparables: comps || [] })
    }

    // listado resumido
    const { data, error } = await supabase
      .from('valoraciones')
      .select('id, created_at, direccion, comuna, tipo, m2_objetivo, valor_uf, valor_clp, uf_m2_mediana, n_comparables, avaluo_fiscal_uf, creado_por')
      .order('id', { ascending: false })
      .limit(500)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ total: (data || []).length, valoraciones: data || [] })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE ?id=N -> elimina una valoración (y sus comparables por cascade)
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })
    const { error } = await supabase.from('valoraciones').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
