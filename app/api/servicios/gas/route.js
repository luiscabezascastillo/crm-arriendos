import { createClient } from '@supabase/supabase-js'
import { consultarServicio } from '../../../lib/scraping-servicios.js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const EXCLUIR = ['estacionamiento','bodega','pendiente ubicar','']

export async function POST(req) {
  try {
    const { mes } = await req.json()
    const mesActual = mes || 'MAYO 2026'

    const { data: registros, error } = await supabase
      .from('ggcc_agua_luz')
      .select('id, idadmon, codigo_gas, deuda_anterior_gas')
      .eq('mes', mesActual)
      .not('idadmon', 'like', '.%')
      .not('codigo_gas', 'is', null)

    if (error) throw new Error(error.message)

    const aConsultar = registros.filter(r =>
      !EXCLUIR.includes((r.codigo_gas || '').toLowerCase().trim())
    )

    const resultados = []
    let ok = 0, errores = 0, omitidos = 0

    for (const reg of aConsultar) {
      try {
        const res = await consultarServicio('gas', reg.codigo_gas, reg.deuda_anterior_gas)
        if (res.omitido) { omitidos++; resultados.push({ idadmon: reg.idadmon, codigo: reg.codigo_gas, estado: 'omitido' }); continue }
        if (res.error) { errores++; resultados.push({ idadmon: reg.idadmon, codigo: reg.codigo_gas, estado: 'error', detalle: res.error }); continue }
        await supabase.from('ggcc_agua_luz').update({
          deuda_vigente_gas: String(res.deuda ?? 0),
          fecha_hecho_gas: res.fecha || new Date().toLocaleDateString('es-CL'),
          updated_at: new Date().toISOString()
        }).eq('id', reg.id)
        ok++
        resultados.push({ idadmon: reg.idadmon, codigo: reg.codigo_gas, compania: reg.deuda_anterior_gas, estado: 'ok', deuda: res.deuda, fecha: res.fecha })
      } catch(e) {
        errores++
        resultados.push({ idadmon: reg.idadmon, codigo: reg.codigo_gas, estado: 'error', detalle: e.message })
      }
      await new Promise(r => setTimeout(r, 2000))
    }

    return Response.json({ ok: true, stats: { total: aConsultar.length, ok, errores, omitidos }, resultados })
  } catch(e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
