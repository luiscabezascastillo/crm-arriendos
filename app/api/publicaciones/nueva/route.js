import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getServerSession } from 'next-auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST() {
  const session = await getServerSession()
  const nombre = session?.user?.name || null
  const rol = session?.user?.role || null
  const esComercial = rol === 'comercial' || rol === 'ventas'

  const { data: newCodigo, error: errCod } = await supabase.rpc('siguiente_codigo')
  if (errCod) return NextResponse.json({ error: errCod.message }, { status: 500 })

  const registro = {
    codigo: newCodigo,
    tipo: 'DEPARTAMENTO',
    objetivo: 'Arriendo',
    tipo_moneda: 'UF',
    activo: 'CREAR',
  }
  if (esComercial && nombre) registro.vendedor = nombre.trim()

  const { data, error } = await supabase
    .from('publicaciones')
    .insert(registro)
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id })
}