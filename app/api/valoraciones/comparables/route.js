// app/api/valoraciones/comparables/route.js
// Capa 1: comparables de Portal Inmobiliario, quita extremos (IQR) y estima.
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buscarComparablesML } from '../../../../lib/comparablesML'
import { filtrarOutliersIQR, resumenEstadistico } from '../../../../lib/valoracionStats'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function getMlToken() {
  const { data: rows } = await supabase
    .from('configuracion').select('valor').eq('clave', 'ml_access_token').single()
  return rows?.valor || null
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { comuna, tipo = 'departamento', operacion = 'venta', m2_objetivo = null, categoria } = body
    if (!comuna) return NextResponse.json({ error: 'Falta la comuna' }, { status: 400 })

    const accessToken = await getMlToken()

    const { data: idx } = await supabase
      .from('indices_mensuales').select('valor_uf').order('mes', { ascending: false }).limit(1).maybeSingle()
    const valorUf = idx?.valor_uf ? Number(idx.valor_uf) : null

    let crudos = []
    let ml_error = null
    try {
      crudos = await buscarComparablesML({
        accessToken, comuna, tipo, operacion, valorUf,
        categoria: categoria || 'MLC1459', limit: 50,
      })
    } catch (e) {
      ml_error = { status: e.status || null, detalle: e.detalle || e.message }
    }

    const obj = m2_objetivo ? Number(m2_objetivo) : null
    let similares = crudos
    if (obj) {
      const lo = obj * 0.65, hi = obj * 1.35
      similares = crudos.filter((c) => c.m2 >= lo && c.m2 <= hi)
    }

    const conPm2 = similares.map((c) => ({ ...c, uf_m2: c.precio_uf / c.m2 }))
    const { conservados, descartados, limites } = filtrarOutliersIQR(conPm2, (c) => c.uf_m2, 1.5)

    const stat_uf_m2 = resumenEstadistico(conservados.map((c) => c.uf_m2))
    const stat_m2 = resumenEstadistico(conservados.map((c) => c.m2))

    let estimacion = null
    if (obj && stat_uf_m2) {
      const valUf = Math.round(stat_uf_m2.mediana * obj)
      estimacion = {
        uf_m2_mediana: stat_uf_m2.mediana,
        valor_uf: valUf,
        rango_uf: [Math.round(stat_uf_m2.p25 * obj), Math.round(stat_uf_m2.p75 * obj)],
        valor_clp: valorUf ? Math.round(valUf * valorUf) : null,
      }
    }

    return NextResponse.json({
      parametros: { comuna, tipo, operacion, m2_objetivo: obj, valorUf },
      ml_error,
      totales: {
        traidos: crudos.length, similares: similares.length,
        usados: conservados.length, descartados: descartados.length,
      },
      limites_iqr: limites,
      stat_uf_m2, stat_m2, estimacion,
      comparables: conservados,
      comparables_descartados: descartados,
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}