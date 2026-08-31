// VERSION: v1 · 2026-08-31 · Calendario laboral: GET (lista por año) + POST (upsert de un día). Candado de rol en POST
//   (Alberto/Luis/Karina). Un día no hábil fuerza horas_esperadas=0. Tabla control_asistencia_calendario.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const EDITORES = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']

// GET /api/control-asistencia/calendario?anio=2026
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const anio = (searchParams.get('anio') || '2026').replace(/[^0-9]/g, '').slice(0, 4) || '2026'
    const { data, error } = await supabase
      .from('control_asistencia_calendario')
      .select('fecha, es_habil, horas_esperadas, motivo')
      .gte('fecha', `${anio}-01-01`)
      .lte('fecha', `${anio}-12-31`)
      .order('fecha', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ calendario: data || [] })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/control-asistencia/calendario  → upsert de un día { fecha, es_habil, horas_esperadas, motivo }
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    const email = session?.user?.email
    if (!email) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    if (!EDITORES.includes(email)) return NextResponse.json({ error: 'Solo Direccion y Karina pueden editar el calendario.' }, { status: 403 })

    const body = await request.json()
    const fecha = String(body.fecha || '').slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return NextResponse.json({ error: 'Fecha inválida (AAAA-MM-DD)' }, { status: 400 })
    const es_habil = body.es_habil === true
    let horas = Number(body.horas_esperadas)
    if (!Number.isFinite(horas) || horas < 0) horas = 0
    if (!es_habil) horas = 0
    const motivo = (body.motivo || '').toString().trim() || null

    // Update-or-insert por fecha (no depende de un constraint único para ON CONFLICT).
    const row = { es_habil, horas_esperadas: horas, motivo }
    const { data: upd, error: eUpd } = await supabase
      .from('control_asistencia_calendario')
      .update(row).eq('fecha', fecha).select('fecha')
    if (eUpd) return NextResponse.json({ error: eUpd.message }, { status: 500 })
    if (!upd || upd.length === 0) {
      const { error: eIns } = await supabase
        .from('control_asistencia_calendario')
        .insert({ fecha, ...row })
      if (eIns) return NextResponse.json({ error: eIns.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
