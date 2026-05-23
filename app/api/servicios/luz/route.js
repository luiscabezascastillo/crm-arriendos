import { createClient } from '@supabase/supabase-js'
import { consultarEnel } from '../../../../lib/scraping-servicios.js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const EXCLUIR = ['estacionamiento','bodega','llega con ggcc','llega con g.c','pendiente ubicar','']

export async function POST(req) {
  try {
    const { mes, soloUno } = await req.json()
    const mesActual = mes || 'MAYO 2026'

    const { data: registros, error } = await supabase
      .from('ggcc_agua_luz')
      .select('id, idadmon, codigo_ele')
      .eq('mes', mesActual)
      .not('idadmon', 'like', '.%')
      .not('codigo_ele', 'is', null)

    if (error) throw new Error(error.message)

    const todosAConsultar = registros.filter(r =>
      !EXCLUIR.includes((r.codigo_ele || '').toLowerCase().trim())
    )

    const aConsultar = soloUno ? todosAConsultar.slice(0, 1) : todosAConsultar

    const resultados = []
    let ok = 0, errores = 0, omitidos = 0
    const LOTE = 3

    for (let i = 0; i < aConsultar.length; i += LOTE) {
      const lote = aConsultar.slice(i, i + LOTE)
      await Promise.all(lote.map(async (reg) => {
        try {
          const res = await consultarEnel(reg.codigo_ele)
          if (res.omitido) {
            omitidos++
            resultados.push({ idadmon: reg.idadmon, codigo: reg.codigo_ele, estado: 'omitido' })
            return
          }
          if (res.error) {
            errores++
            resultados.push({ idadmon: reg.idadmon, codigo: reg.codigo_ele, estado: 'error', detalle: res.error })
            return
          }
          if (res.deuda !== null) {
            await supabase.from('ggcc_agua_luz').update({
              deuda_vigente_electricidad: String(res.deuda ?? 0),
              fecha_hecho_luz: res.fecha || new Date().toLocaleDateString('es-CL'),
              updated_at: new Date().toISOString()
            }).eq('id', reg.id)
          }
          ok++
          resultados.push({
            idadmon: reg.idadmon,
            codigo: reg.codigo_ele,
            estado: 'ok',
            deuda: res.deuda,
            fecha: res.fecha,
            sinDeuda: res.sinDeuda || false,
            debug: res.textoDebug || null
          })
        } catch(e) {
          errores++
          resultados.push({ idadmon: reg.idadmon, codigo: reg.codigo_ele, estado: 'error', detalle: e.message })
        }
      }))
      if (i + LOTE < aConsultar.length) await new Promise(r => setTimeout(r, 1500))
    }

    return Response.json({
      ok: true,
      stats: { total: todosAConsultar.length, procesados: aConsultar.length, ok, errores, omitidos },
      resultados
    })
  } catch(e) {
    console.error('servicios/luz error:', e)
    return Response.json({ error: e.message }, { status: 500 })
  }
}