import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// GET /api/portal-externo?email=xxx → datos del colaborador externo (solo tareas + workflows)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')
    if (!email) return NextResponse.json({ error: 'Falta email' }, { status: 400 })

    // Verificar que el email pertenece a un colaborador externo activo
    const { data: externo } = await supabase
      .from('colaboradores_externos')
      .select('id, nombre, email, categoria, pais')
      .eq('email', email)
      .eq('activo', true)
      .maybeSingle()

    if (!externo) {
      return NextResponse.json({ error: 'No es un colaborador externo', esExterno: false }, { status: 404 })
    }

    // Tareas (por email)
    const { data: tareas } = await supabase
      .from('tareas')
      .select('*')
      .eq('responsable', email)
      .order('fecha_limite', { ascending: true, nullsFirst: false })

    // Workflow (por email)
    const { data: workflow } = await supabase
      .from('workflow_tasks')
      .select('*')
      .eq('responsable', email)
      .order('fecha_limite', { ascending: true, nullsFirst: false })

    return NextResponse.json({
      esExterno: true,
      colaborador: externo,
      tareas: tareas || [],
      workflow: workflow || [],
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
