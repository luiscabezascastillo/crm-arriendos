// VERSION: v2 · 2026-07-18 · Normaliza el mes a ISO (AAAA-MM) antes de filtrar, tras unificar el
//   campo `mes` de ggcc_agua_luz. Acepta "JULIO 2026", "2026-07" o "2607". Aplica en guardar y en GET.
// app/api/servicios/luz/route.js
import { createClient } from '@supabase/supabase-js'
import { consultarEnel } from '../../../../lib/scraping-servicios'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Normaliza el mes al formato ISO 'AAAA-MM' que ahora tiene la columna `mes`.
// Acepta 'JULIO 2026' | '2026-07' | '2607' (aamm). Si no reconoce, lo deja igual.
function normalizarMes(m) {
  if (!m) return m
  const s = String(m).trim()
  if (/^\d{4}-\d{2}$/.test(s)) return s
  if (/^\d{4}$/.test(s)) return '20' + s.slice(0, 2) + '-' + s.slice(2)
  const MESES = { enero:'01', febrero:'02', marzo:'03', abril:'04', mayo:'05', junio:'06',
    julio:'07', agosto:'08', septiembre:'09', setiembre:'09', octubre:'10', noviembre:'11', diciembre:'12' }
  const mm = s.toLowerCase().match(/^([a-záéíóúñ]+)\s+(\d{4})$/)
  if (mm && MESES[mm[1]]) return mm[2] + '-' + MESES[mm[1]]
  return s
}

// Guarda la deuda de luz de un inmueble (todas las columnas son text)
async function guardar(mes, idadmon, idinmue, deuda, fecha) {
  mes = normalizarMes(mes)
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
      if (res.error) return Response.json({ error: res.error, textoDebug: res.textoDebug })
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
    const mes = normalizarMes(searchParams.get('mes'))
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
