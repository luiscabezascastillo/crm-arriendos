// app/api/servicios/agua/route.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

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
    const mes = searchParams.get('mes')
    const soloPendientes = searchParams.get('solo_pendientes') === 'true'

    if (!mes) return Response.json({ error: 'Parámetro mes requerido' }, { status: 400 })

    let query = supabase
      .from('ggcc_agua_luz')
      .select('idadmon, idinmue, codigo_agua, deuda_vigente_agua, fecha_hecho_agua, edificio_proyecto, inmueble')
      .eq('mes', mes)
      .not('codigo_agua', 'is', null)
      .neq('codigo_agua', '')
      .not('idinmue', 'like', '.%')
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
