// VERSION: v2 · 2026-07-18 · Normaliza el mes a ISO (AAAA-MM) antes de filtrar (campo `mes` unificado).
//   Acepta "JULIO 2026", "2026-07" o "2607".
import { createClient } from '@supabase/supabase-js'
import { consultarServicio } from '../../../../lib/scraping-servicios.js'

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

const EXCLUIR = ['estacionamiento','bodega','pendiente ubicar','']

export async function POST(req) {
  try {
    const { mes } = await req.json()
    const mesActual = normalizarMes(mes || 'MAYO 2026')

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
