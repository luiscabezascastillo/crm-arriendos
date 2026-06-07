import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    const { sourceId } = await request.json()
    if (!sourceId) {
      return NextResponse.json({ error: 'Falta sourceId' }, { status: 400 })
    }

    // 1 — Traer la propiedad original
    const { data: original, error: errGet } = await supabase
      .from('publicaciones')
      .select('*')
      .eq('id', sourceId)
      .single()
    if (errGet) return NextResponse.json({ error: errGet.message }, { status: 500 })
    if (!original) return NextResponse.json({ error: 'No se encontró la propiedad original' }, { status: 404 })

    // 2 — Calcular el código siguiente desde codigo (texto), única fuente de verdad.
    //     Traemos los codigos más altos y sacamos el máximo numérico en JS.
    const { data: codigos, error: errMax } = await supabase
      .from('publicaciones')
      .select('codigo')
      .order('codigo', { ascending: false })
      .limit(50)
    if (errMax) return NextResponse.json({ error: errMax.message }, { status: 500 })

    let maxCodigo = 16891
    for (const row of (codigos || [])) {
      const n = parseInt(row.codigo, 10)
      if (!isNaN(n) && n > maxCodigo) maxCodigo = n
    }
    const nuevoCodigo = String(maxCodigo + 1)

    // 3 — Clonar datos. NO se toca el id (identity → lo genera Supabase).
    //     NO se escribe codigo_num (columna en desuso, se eliminará).
    const nueva = { ...original }
    delete nueva.id
    delete nueva.codigo_num
    nueva.codigo     = nuevoCodigo
    nueva.fecha      = new Date().toISOString().split('T')[0]
    nueva.pi         = 'NO'
    nueva.web        = 'NO'
    nueva.yapo       = 'NO'
    nueva.goplaceit  = 'NO'
    nueva.proppit    = 'NO'
    nueva.activo     = 'CREAR'
    nueva.estado_2   = ''
    nueva.updated_at = new Date().toISOString()
    nueva.sync_hash  = null
    nueva.sync_id    = null

    // La copia nace sin fotos (imagen1–imagen38)
    for (let i = 1; i <= 38; i++) nueva[`imagen${i}`] = null

    // 4 — Insertar
    const { data: creada, error: errCreate } = await supabase
      .from('publicaciones')
      .insert([nueva])
      .select('id, codigo')
      .single()
    if (errCreate) return NextResponse.json({ error: errCreate.message }, { status: 500 })

    return NextResponse.json({ id: creada.id, codigo: creada.codigo })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}