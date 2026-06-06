import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST() {
  // Obtener max codigo y max id
  const { data: maxData } = await supabase
    .from('publicaciones')
    .select('id, codigo')
    .order('id', { ascending: false })
    .limit(1)
    .single()

  const newId = (maxData?.id || 0) + 1
  const newCodigo = String((parseInt(maxData?.codigo || '16891') + 1))

  const { data, error } = await supabase
    .from('publicaciones')
    .insert({
      id: newId,
      codigo: newCodigo,
      tipo: 'DEPARTAMENTO',
      objetivo: 'Arriendo',
      tipo_moneda: 'UF',
      activo: 'CREAR',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id })
}