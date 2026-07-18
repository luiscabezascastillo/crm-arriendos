// VERSION: v2 · 2026-07-18 · Normaliza el mes a ISO (AAAA-MM) antes de filtrar (campo `mes` unificado).
//   Acepta "JULIO 2026", "2026-07" o "2607". Aplica en guardar y en GET.
// app/api/servicios/agua/route.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Normaliza el mes al formato ISO 'AAAA-MM'. Acepta 'JULIO 2026' | '2026-07' | '2607'.
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

function esCodigoAguaValido(codigo) {
  if (!codigo) return false
  const texto = codigo.trim().toLowerCase()
  // Excluir textos como bodega, estacionamiento, etc.
  if (!/^\d/.test(texto)) return false
  return true
}

// Extrae número sin dígito verificador: "2623638-K" → "2623638"
function normalizarCodigoAgua(codigo) {
  return codigo.trim().split('-')[0]
}

async function guardar(mes, idadmon, idinmue, deuda, fecha) {
  mes = normalizarMes(mes)
  const { error } = await supabase
    .from('ggcc_agua_luz')
    .update({
      deuda_vigente_agua: deuda,
      fecha_hecho_agua: fecha,
      updated_at: new Date().toISOString(),
    })
    .eq('mes', mes)
    .eq('idadmon', idadmon)
    .eq('idinmue', idinmue)
  if (error) throw new Error(error.message)
}

// POST /api/servicios/agua
// Body: { action: 'guardar', mes, idadmon, idinmue, deuda, fecha }
export async function POST(request) {
  try {
    const body = await request.json()

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

// GET /api/servicios/agua?mes=MAYO 2026&solo_pendientes=true
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const mes = normalizarMes(searchParams.get('mes'))
    const soloPendientes = searchParams.get('solo_pendientes') === 'true'

    if (!mes) return Response.json({ error: 'Parámetro mes requerido' }, { status: 400 })

    let query = supabase
      .from('ggcc_agua_luz')
      .select('idadmon, idinmue, codigo_agua, deuda_vigente_agua, fecha_hecho_agua, edificio_proyecto, inmueble')
      .eq('mes', mes)
      .not('codigo_agua', 'is', null)
      .neq('codigo_agua', '')
      .not('idadmon', 'like', '.%')
      .order('idadmon')

      if (soloPendientes) {
        const hoy = new Date().toISOString().split('T')[0]
        const primerDiaMes = hoy.substring(0, 7) + '-01'
        query = query.or(`fecha_hecho_agua.is.null,fecha_hecho_agua.eq.,fecha_hecho_agua.lt.${primerDiaMes}`)
      }

    const { data, error } = await query
    if (error) return Response.json({ error: error.message }, { status: 500 })

    const filtrado = (data || []).filter(row => {
      if (!row.codigo_agua) return false
      return esCodigoAguaValido(row.codigo_agua)
    }).map(row => ({
      ...row,
      codigo_agua_normalizado: normalizarCodigoAgua(row.codigo_agua)
    }))

    return Response.json({ codigos: filtrado, total: filtrado.length })

  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
