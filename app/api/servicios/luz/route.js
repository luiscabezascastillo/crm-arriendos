// app/api/servicios/luz/route.js
import { createClient } from '@supabase/supabase-js'
import { consultarEnel } from '../../../../lib/scraping-servicios'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Guarda la deuda de luz de un inmueble (todas las columnas son text)
async function guardar(mes, idadmon, idinmue, deuda, fecha) {
  const { error } = await supabase
    .from('ggcc_agua_luz')
    .update({
      deuda_vigente_electricidad: deuda == null ? null : String(deuda),
      fecha_hecho_luz: fecha == null ? null : String(fecha),
      updated_at: new Date().toISOString(),
    })
    .eq('mes', mes)
    .eq('idadmon', idadmon)
    .eq('idinmue', idinmue)
  if (error) throw new Error(error.message)
}

export async function POST(request) {
  try {
    const body = await request.json()

    // Consulta la deuda de un código en Servipag (sin guardar)
    if (body.action === 'consultar') {
      const { codigo } = body
      if (!codigo) return Response.json({ error: 'Falta el código' }, { status: 400 })
      const res = await consultarEnel(codigo)
      return Response.json(res)
    }

    // Consulta y guarda en un solo paso
    if (body.action === 'consultar_guardar') {
      const { mes, idadmon, idinmue, codigo } = body
      if (!codigo) return Response.json({ error: 'Falta el código' }, { status: 400 })
      const res = await consultarEnel(codigo)
      if (res.omitido) return Response.json({ omitido: true })
      if (res.error) return Response.json({ error: res.error })
      // Guardar también cuando la deuda es 0 (sin deuda) — fecha = hoy
      const hoy = new Date().toISOString().split('T')[0]
      const fecha = res.fecha || hoy
      await guardar(mes, idadmon, idinmue, res.deuda, fecha)
      return Response.json({ ok: true, deuda: res.deuda, fecha })
    }

    if (body.action === 'guardar') {
      const { mes, idadmon, idinmue, deuda, fecha } = body
      await guardar(mes, idadmon, idinmue, deuda, fecha)
      return Response.json({ ok: true })
    }

    return Response.json({ error: 'Acción no reconocida' }, { status: 400 })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

// GET /api/servicios/luz?mes=ABRIL 2026&solo_pendientes=true
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const mes = searchParams.get('mes')
    const soloPendientes = searchParams.get('solo_pendientes') === 'true'
    if (!mes) return Response.json({ error: 'Parámetro mes requerido' }, { status: 400 })

    let query = supabase
      .from('ggcc_agua_luz')
      .select('idadmon, idinmue, codigo_ele, deuda_vigente_electricidad, fecha_hecho_luz, edificio_proyecto, inmueble')
      .eq('mes', mes)
      .not('codigo_ele', 'is', null)
      .neq('codigo_ele', '')
      .not('idinmue', 'like', '.%')
      .order('idadmon')

    if (soloPendientes) {
      query = query.is('fecha_hecho_luz', null)
    }

    const { data, error } = await query
    if (error) return Response.json({ error: error.message }, { status: 500 })

    // Solo códigos con formato válido (número-DV); descarta bodega/estacionamiento/etc.
    const filtrado = (data || []).filter((row) => {
      if (!row.codigo_ele) return false
      return /^[\d-]+[\dkK]?$/.test(row.codigo_ele.trim())
    })

    return Response.json({ codigos: filtrado, total: filtrado.length })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
