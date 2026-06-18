import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// GET /api/portal?email=xxx[&incluirOcultos=1]  -> devuelve las 4 secciones del portal
// incluirOcultos=1 (vista Direccion) muestra TODOS los procesos; sin el flag, oculta
// los procesos marcados con oculto_personal en workflow_definitions.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')
    const incluirOcultos = searchParams.get('incluirOcultos') === '1'
    if (!email) return NextResponse.json({ error: 'Falta email' }, { status: 400 })

    // Resolver trabajador por email (para asistencia y ausencias)
    const { data: trabajador } = await supabase
      .from('control_asistencia_trabajadores')
      .select('id, nombre_real, email')
      .eq('email', email)
      .eq('activo', true)
      .maybeSingle()

    const trabajadorId = trabajador?.id || null

    // 1 - Tareas ex-profeso (por email)
    const { data: tareas } = await supabase
      .from('tareas')
      .select('*')
      .eq('responsable', email)
      .order('fecha_limite', { ascending: true, nullsFirst: false })

    // 2 - Tareas de workflow (por email)
    const { data: areasResp } = await supabase
      .from('workflow_area_responsables')
      .select('area')
      .eq('email', email)
    const misAreas = (areasResp || []).map(a => a.area)
    let workflow = []
    if (misAreas.length) {
      const { data: wfTasks } = await supabase
        .from('workflow_tasks')
        .select('*')
        .in('responsable', misAreas)
        .order('fecha_limite', { ascending: true, nullsFirst: false })
      const tasks = wfTasks || []

      const instIds = [...new Set(tasks.map(t => t.workflow_instance_id).filter(Boolean))]
      const nodeCods = [...new Set(tasks.map(t => t.node_codigo).filter(Boolean))]

      const { data: insts } = instIds.length
        ? await supabase.from('workflow_instances').select('id, idadmon, workflow_codigo').in('id', instIds)
        : { data: [] }
      const { data: nodes } = nodeCods.length
        ? await supabase.from('workflow_nodes').select('codigo, nombre').in('codigo', nodeCods)
        : { data: [] }

      const idadmonPorInst = {}
      const codigoPorInst = {}
      for (const i of (insts || [])) { idadmonPorInst[i.id] = i.idadmon; codigoPorInst[i.id] = i.workflow_codigo }
      const nombrePorNodo = {}
      for (const n of (nodes || [])) nombrePorNodo[n.codigo] = n.nombre

      workflow = tasks.map(t => ({
        ...t,
        idadmon: idadmonPorInst[t.workflow_instance_id] || null,
        workflow_codigo: codigoPorInst[t.workflow_instance_id] || null,
        nodo_nombre: nombrePorNodo[t.node_codigo] || t.node_codigo,
      }))

      // Ocultar procesos marcados como oculto_personal (salvo en la vista de Direccion)
      if (!incluirOcultos) {
        const { data: defsOcultas } = await supabase
          .from('workflow_definitions')
          .select('codigo')
          .eq('oculto_personal', true)
        const codigosOcultos = (defsOcultas || []).map(d => d.codigo)
        if (codigosOcultos.length) {
          workflow = workflow.filter(w => !codigosOcultos.includes(w.workflow_codigo))
        }
      }
    }

    // 3 - Actividades periodicas (por email)
    const { data: periodicas } = await supabase
      .from('tareas_periodicas')
      .select('*')
      .eq('responsable', email)
      .eq('activo', true)
      .order('created_at', { ascending: true })

    // 4a - Asistencia (por trabajador_id, desde la vista dashboard)
    let asistencia = null
    if (trabajadorId) {
      const { data: asis } = await supabase
        .from('vw_control_asistencia_dashboard')
        .select('*')
        .eq('trabajador_id', trabajadorId)
        .maybeSingle()
      asistencia = asis || null
    }

    // 4b - Ausencias (por trabajador_id)
    let ausencias = []
    if (trabajadorId) {
      const { data: aus } = await supabase
        .from('control_asistencia_ausencias')
        .select('id, tipo, fecha_inicio, fecha_fin, dias_habiles, recuperable, motivo')
        .eq('trabajador_id', trabajadorId)
        .order('fecha_inicio', { ascending: false })
      ausencias = aus || []
    }

    // Lista de procesos (solo para el panel de visibilidad de Direccion)
    let procesos = []
    if (incluirOcultos) {
      const { data: defs } = await supabase
        .from('workflow_definitions')
        .select('codigo, nombre, oculto_personal, activo')
        .order('codigo')
      procesos = defs || []
    }

    return NextResponse.json({
      trabajador: trabajador || { nombre_real: email, email },
      tareas: tareas || [],
      workflow: workflow || [],
      periodicas: periodicas || [],
      asistencia,
      ausencias,
      procesos,
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/portal -> acciones del portal
// body: { accion: 'periodica_hecha' | 'tarea_guardar' | 'tarea_crear' | 'proceso_visibilidad', ... }
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

    if (body.accion === 'tarea_guardar') {
      const upd = {
        estado: body.estado,
        comentario_cierre: body.comentario_cierre || null,
        link_resultado: body.link_resultado || null,
      }
      if (body.estado === 'COMPLETADA') upd.fecha_cierre = new Date().toISOString()
      else upd.fecha_cierre = null
      const { error } = await supabase.from('tareas').update(upd).eq('id', body.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    if (body.accion === 'tarea_crear') {
      if (!body.titulo || !body.responsable) return NextResponse.json({ error: 'Falta titulo o responsable' }, { status: 400 })
      const { error } = await supabase.from('tareas').insert({
        titulo: body.titulo,
        descripcion: body.descripcion || null,
        responsable: body.responsable,
        estado: 'PENDIENTE',
        prioridad: body.prioridad || 'MEDIA',
        fecha_limite: body.fecha_limite || null,
        created_by: body.created_by || null,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    if (body.accion === 'proceso_visibilidad') {
      if (!body.codigo) return NextResponse.json({ error: 'Falta codigo' }, { status: 400 })
      const { error } = await supabase
        .from('workflow_definitions')
        .update({ oculto_personal: !!body.oculto_personal })
        .eq('codigo', body.codigo)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Accion no reconocida' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}