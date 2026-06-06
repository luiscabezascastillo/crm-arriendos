import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  const { publicacionId } = await request.json()

  const { data: original, error: errOrig } = await supabase
    .from('publicaciones')
    .select('*')
    .eq('id', publicacionId)
    .single()

  if (errOrig || !original) return NextResponse.json({ error: 'Publicacion no encontrada' }, { status: 404 })

  const { data: maxData } = await supabase
    .from('publicaciones')
    .select('id, codigo')
    .order('id', { ascending: false })
    .limit(1)
    .single()

  const newId = (maxData?.id || 0) + 1
  const newCodigo = String((parseInt(maxData?.codigo || '16891') + 1))

  // Excluir campos que no deben copiarse
  const { id, codigo, codigo_pi, url_pi, url_yapo, url_web, url_goplaceit, url_proppit,
          pi, yapo, web, goplaceit, proppit, activo, fecha_vencimiento_pi,
          sync_id, created_at, updated_at, ...resto } = original

  const { data, error } = await supabase
    .from('publicaciones')
    .insert({
      ...resto,
      id: newId,
      codigo: newCodigo,
      activo: 'CREAR',
      pi: 'NO',
      yapo: 'NO',
      web: 'NO',
      codigo_pi: null,
      url_pi: null,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id, codigo: newCodigo })
}