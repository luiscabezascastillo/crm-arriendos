// app/api/valoraciones/calcular/route.js
// Homologación estilo tasador (validada contra Excel de Recoleta):
//   valor_homologado = (oferta_UF + box*estac_faltante + bod*bodega_faltante) * (1 - negociacion)
//   sup_ponderada    = util + terraza * factor_terraza
//   UF/m2            = valor_homologado / sup_ponderada
//   estimacion       = mediana(UF/m2) * sup_ponderada_sujeto
// Quita extremos por UF/m2 (IQR). Si guardar=true, persiste.

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { filtrarOutliersIQR, resumenEstadistico } from '../../../../lib/valoracionStats'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const num = (v) => { const n = Number(v); return isFinite(n) ? n : 0 }

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { sujeto = {}, testigos = [], parametros = {}, guardar = false, creado_por = null } = body

    if (!sujeto.comuna) {
      return NextResponse.json({ error: 'Falta la comuna del sujeto' }, { status: 400 })
    }

    // Parámetros de homologación (con defaults)
    const P = {
      negociacion: parametros.negociacion != null ? Number(parametros.negociacion) : 0.12, // 12%
      uf_estac: parametros.uf_estac != null ? Number(parametros.uf_estac) : 350,
      uf_bodega: parametros.uf_bodega != null ? Number(parametros.uf_bodega) : 80,
      factor_terraza: parametros.factor_terraza != null ? Number(parametros.factor_terraza) : 0.5,
      tol_m2: parametros.tol_m2 != null ? Number(parametros.tol_m2) : 0.40, // ±40% metraje
    }

    // UF más reciente (para convertir testigos en CLP -> UF)
    const { data: idx } = await supabase
      .from('indices_mensuales').select('valor_uf').order('mes', { ascending: false }).limit(1).maybeSingle()
    const valorUf = idx?.valor_uf ? Number(idx.valor_uf) : null

    const sujEstac = num(sujeto.estac)
    const sujBodega = num(sujeto.bodega)
    const supSujeto = num(sujeto.m2_util) + num(sujeto.terraza) * P.factor_terraza

    // Homologar cada testigo
    const norm = []
    for (const t of testigos) {
      const util = num(t.m2_util)
      const precio = num(t.precio)
      if (util <= 0 || precio <= 0) continue

      // precio de oferta a UF
      const moneda = (t.moneda || 'UF').toUpperCase()
      let ofertaUf = moneda === 'UF' ? precio : (valorUf ? precio / valorUf : null)
      if (!ofertaUf) continue

      // homologación de amenidades: llevar el testigo al nivel del sujeto
      const faltaEstac = Math.max(0, sujEstac - num(t.estac))
      const faltaBodega = Math.max(0, sujBodega - num(t.bodega))
      const sobraEstac = Math.max(0, num(t.estac) - sujEstac)
      const sobraBodega = Math.max(0, num(t.bodega) - sujBodega)
      const ajusteAmen = (faltaEstac * P.uf_estac + faltaBodega * P.uf_bodega)
                       - (sobraEstac * P.uf_estac + sobraBodega * P.uf_bodega)

      const valorHomologado = (ofertaUf + ajusteAmen) * (1 - P.negociacion)
      const sup = util + num(t.terraza) * P.factor_terraza
      const uf_m2 = valorHomologado / sup

      norm.push({
        link: t.link || null, titulo: t.titulo || null,
        oferta_uf: Math.round(ofertaUf), moneda,
        m2_util: util, terraza: num(t.terraza), sup_ponderada: +sup.toFixed(1),
        estac: num(t.estac), bodega: num(t.bodega),
        ajuste_amenidades: Math.round(ajusteAmen),
        valor_homologado: Math.round(valorHomologado),
        uf_m2: +uf_m2.toFixed(2),
        dormitorios: t.dormitorios != null && t.dormitorios !== '' ? Number(t.dormitorios) : null,
      })
    }

    if (norm.length < 1) {
      return NextResponse.json({ error: 'Ingresa al menos un testigo con m2 util y precio validos' }, { status: 400 })
    }

    // Filtro por METRAJE: descarta testigos cuya sup. ponderada se aleje mucho del sujeto
    // (evita que un dúplex de 275 m² contamine deptos de 45 m², aunque su UF/m² parezca normal).
    let fueraMetraje = []
    let enRango = norm
    if (supSujeto > 0 && P.tol_m2 > 0) {
      const lo = supSujeto * (1 - P.tol_m2), hi = supSujeto * (1 + P.tol_m2)
      enRango = []
      for (const c of norm) {
        if (c.sup_ponderada >= lo && c.sup_ponderada <= hi) enRango.push(c)
        else fueraMetraje.push({ ...c, motivo: 'metraje' })
      }
      if (enRango.length < 1) { enRango = norm; fueraMetraje = [] } // si deja 0, no filtra
    }

    const { conservados, descartados, limites } = filtrarOutliersIQR(enRango, (c) => c.uf_m2, 1.5)
    const todosDescartados = [...descartados, ...fueraMetraje]
    const stat_uf_m2 = resumenEstadistico(conservados.map((c) => c.uf_m2))
    const stat_sup = resumenEstadistico(conservados.map((c) => c.sup_ponderada))

    let estimacion = null
    if (supSujeto > 0 && stat_uf_m2) {
      const valUf = Math.round(stat_uf_m2.mediana * supSujeto)
      estimacion = {
        uf_m2_mediana: stat_uf_m2.mediana,
        sup_ponderada_sujeto: +supSujeto.toFixed(1),
        valor_uf: valUf,
        rango_uf: [Math.round(stat_uf_m2.p25 * supSujeto), Math.round(stat_uf_m2.p75 * supSujeto)],
        valor_clp: valorUf ? Math.round(valUf * valorUf) : null,
      }
    }

    // avalúo llega en PESOS. El valor estimado en pesos = valor_uf * valorUf. Ratio pesos/pesos.
    const avaluoPesos = sujeto.avaluo_fiscal_pesos ? Number(sujeto.avaluo_fiscal_pesos) : null
    let vs_avaluo = null
    if (avaluoPesos && estimacion && estimacion.valor_clp) {
      vs_avaluo = { avaluo_pesos: avaluoPesos, ratio: +(estimacion.valor_clp / avaluoPesos).toFixed(2) }
    }

    const resultado = {
      parametros: P, valorUf,
      totales: { testigos: norm.length, usados: conservados.length, descartados: todosDescartados.length, fuera_metraje: fueraMetraje.length },
      limites_iqr: limites, stat_uf_m2, stat_sup, estimacion, vs_avaluo,
      comparables: conservados, comparables_descartados: todosDescartados,
    }

    let valoracion_id = null
    if (guardar) {
      const { data: val, error: e1 } = await supabase.from('valoraciones').insert({
        rol: sujeto.rol || null,
        direccion: sujeto.direccion || null,
        comuna: sujeto.comuna,
        tipo: sujeto.tipo || 'departamento',
        operacion: sujeto.operacion || 'venta',
        m2_objetivo: supSujeto || null,
        dormitorios: sujeto.dormitorios ? Number(sujeto.dormitorios) : null,
        uf_m2_mediana: stat_uf_m2?.mediana ?? null,
        valor_uf: estimacion?.valor_uf ?? null,
        valor_min_uf: estimacion?.rango_uf?.[0] ?? null,
        valor_max_uf: estimacion?.rango_uf?.[1] ?? null,
        valor_clp: estimacion?.valor_clp ?? null,
        n_comparables: conservados.length,
        n_descartados: todosDescartados.length,
        avaluo_fiscal_uf: (avaluoPesos && valorUf) ? Math.round(avaluoPesos / valorUf) : null,
        metodologia_json: { parametros: P, limites_iqr: limites, stat_uf_m2, valorUf, sujeto, avaluo_pesos: avaluoPesos },
        creado_por: creado_por || null,
      }).select('id').single()

      if (e1) return NextResponse.json({ error: 'Error guardando: ' + e1.message, resultado }, { status: 500 })
      valoracion_id = val.id

      const filas = [
        ...conservados.map((c) => ({ ...c, usado: true })),
        ...todosDescartados.map((c) => ({ ...c, usado: false })),
      ].map((c) => ({
        valoracion_id, fuente: 'manual', usado: c.usado,
        titulo: c.titulo, permalink: c.link,
        precio: c.oferta_uf, moneda: c.moneda, precio_uf: c.valor_homologado,
        m2: c.sup_ponderada, uf_m2: c.uf_m2, dormitorios: c.dormitorios, comuna: sujeto.comuna,
      }))
      await supabase.from('valoracion_comparables').insert(filas)
    }

    return NextResponse.json({ ok: true, valoracion_id, resultado })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
