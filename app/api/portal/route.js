import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// GET /api/portal?email=xxx  → devuelve las 4 secciones del portal para ese email
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')
    if (!email) return NextResponse.json({ error: 'Falta email' }, { status: 400 })

    // Resolver trabajador por email (para asistencia y ausencias)
    const { data: trabajador } = await supabase
      .from('control_asistencia_trabajadores')
      .select('id, nombre_real, email')
      .eq('email', email)
      .eq('activo', true)
      .maybeSingle()

    const trabajadorId = trabajador?.id || null

    // 1 — Tareas ex-profeso (por email)
    const { data: tareas } = await supabase
      .from('tareas')
      .select('*')
      .eq('responsable', email)
      .order('fecha_limite', { ascending: true, nullsFirst: false })

    // 2 — Tareas de workflow (por email)
    const { data: workflow } = await supabase
      .from('workflow_tasks')
      .select('*')
      .eq('responsable', email)
      .order('fecha_limite', { ascending: true, nullsFirst: false })

    // 3 — Actividades periódicas (por email)
    const { data: periodicas } = await supabase
      .from('tareas_periodicas')
      .select('*')
      .eq('responsable', email)
      .eq('activo', true)
      .order('created_at', { ascending: true })

    // 4a — Asistencia (por trabajador_id, desde la vista dashboard)
    let asistencia = null
    if (trabajadorId) {
      const { data: asis } = await supabase
        .from('vw_control_asistencia_dashboard')
        .select('*')
        .eq('trabajador_id', trabajadorId)
        .maybeSingle()
      asistencia = asis || null
    }

    // 4b — Ausencias (por trabajador_id)
    let ausencias = []
    if (trabajadorId) {
      const { data: aus } = await supabase
        .from('control_asistencia_ausencias')
        .select('id, tipo, fecha_inicio, fecha_fin, dias_habiles, recuperable, motivo')
        .eq('trabajador_id', trabajadorId)
        .order('fecha_inicio', { ascending: false })
      ausencias = aus || []
    }

    return NextResponse.json({
      trabajador: trabajador || { nombre_real: email, email },
      tareas: tareas || [],
      workflow: workflow || [],
      periodicas: periodicas || [],
      asistencia,
      ausencias,
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/portal  → acción "Hecho" en una actividad periódica
// body: { accion: 'periodica_hecha', id, por }
export async function POST(request) {
  try {
    const body = await request.json()
    if (body.accion === 'periodica_hecha') {
      const { error } = await supabase
        .from('tareas_periodicas')
        .update({ ultima_ejecucion: new Date().toISOString(), ultima_por: body.por || null })
        .eq('id', body.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
