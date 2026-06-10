import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// GET /api/control-asistencia/ausencias  → lista todas las ausencias con nombre del trabajador
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('control_asistencia_ausencias')
      .select('id, trabajador_id, tipo, fecha_inicio, fecha_fin, dias_habiles, recuperable, motivo, origen, created_by, created_at, control_asistencia_trabajadores(nombre_real, email)')
      .order('fecha_inicio', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ausencias: data })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/control-asistencia/ausencias  → crea una ausencia, calcula dias_habiles
export async function POST(request) {
  try {
    const { trabajador_id, tipo, fecha_inicio, fecha_fin, motivo, recuperable, created_by } = await request.json()

    if (!trabajador_id || !tipo || !fecha_inicio || !fecha_fin) {
      return NextResponse.json({ error: 'Faltan datos obligatorios' }, { status: 400 })
    }
    if (!['VACACIONES', 'LICENCIA', 'PERMISO'].includes(tipo)) {
      return NextResponse.json({ error: 'Tipo no válido' }, { status: 400 })
    }
    if (fecha_fin < fecha_inicio) {
      return NextResponse.json({ error: 'La fecha fin no puede ser anterior a la de inicio' }, { status: 400 })
    }

    // Calcular días hábiles consultando el calendario laboral real
    const { count, error: errCal } = await supabase
      .from('control_asistencia_calendario')
      .select('fecha', { count: 'exact', head: true })
      .gte('fecha', fecha_inicio)
      .lte('fecha', fecha_fin)
      .eq('es_habil', true)
    if (errCal) return NextResponse.json({ error: 'Error calculando días hábiles: ' + errCal.message }, { status: 500 })

    const { data, error } = await supabase
      .from('control_asistencia_ausencias')
      .insert([{
        trabajador_id,
        tipo,
        fecha_inicio,
        fecha_fin,
        dias_habiles: count || 0,
        recuperable: recuperable === true,
        motivo: motivo || null,
        origen: 'CRM',
        created_by: created_by || null,
      }])
      .select('id, dias_habiles')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, id: data.id, dias_habiles: data.dias_habiles })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE /api/control-asistencia/ausencias?id=123  → elimina una ausencia
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })

    const { error } = await supabase
      .from('control_asistencia_ausencias')
      .delete()
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}