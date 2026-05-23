import { createClient } from '@supabase/supabase-js'
import { consultarServicio } from '../../../../lib/scraping-servicios.js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const EXCLUIR = ['estacionamiento','bodega','llega con ggcc','llega con g.c','pendiente ubicar','']

export async function POST(req) {
  try {
    const { mes } = await req.json()
    const mesActual = mes || 'MAYO 2026'

    const { data: registros, error } = await supabase
      .from('ggcc_agua_luz')
      .select('id, idadmon, codigo_agua')
      .eq('mes', mesActual)
      .not('idadmon', 'like', '.%')
      .not('codigo_agua', 'is', null)

    if (error) throw new Error(error.message)

    const aConsultar = registros.filter(r =>
      !EXCLUIR.includes((r.codigo_agua || '').toLowerCase().trim())
    )

    const resultados = []
    let ok = 0, errores = 0, omitidos = 0
    const LOTE = 3

    for (let i = 0; i < aConsultar.length; i += LOTE) {
      const lote = aConsultar.slice(i, i + LOTE)
      await Promise.all(lote.map(async (reg) => {
        try {
          const res = await consultarAguasAndinas(reg.codigo_agua)
          if (res.omitido) { omitidos++; resultados.push({ idadmon: reg.idadmon, codigo: reg.codigo_agua, estado: 'omitido' }); return }
          if (res.error) { errores++; resultados.push({ idadmon: reg.idadmon, codigo: reg.codigo_agua, estado: 'error', detalle: res.error }); return }
          await supabase.from('ggcc_agua_luz').update({
            deuda_vigente_agua: String(res.deuda ?? 0),
            fecha_hecho_agua: res.fecha || new Date().toLocaleDateString('es-CL'),
            updated_at: new Date().toISOString()
          }).eq('id', reg.id)
          ok++
          resultados.push({ idadmon: reg.idadmon, codigo: reg.codigo_agua, estado: 'ok', deuda: res.deuda, fecha: res.fecha })
        } catch(e) {
          errores++
          resultados.push({ idadmon: reg.idadmon, codigo: reg.codigo_agua, estado: 'error', detalle: e.message })
        }
      }))
      if (i + LOTE < aConsultar.length) await new Promise(r => setTimeout(r, 1500))
    }

    return Response.json({ ok: true, stats: { total: aConsultar.length, ok, errores, omitidos }, resultados })
  } catch(e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
