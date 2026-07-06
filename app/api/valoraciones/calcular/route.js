// app/api/valoraciones/calcular/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { filtrarOutliersIQR, resumenEstadistico } from '../../../../lib/valoracionStats'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { sujeto = {}, testigos = [], guardar = false, creado_por = null } = body

    if (!sujeto.comuna) {
      return NextResponse.json({ error: 'Falta la comuna del sujeto' }, { status: 400 })
    }

    const { data: idx } = await supabase
      .from('indices_mensuales').select('valor_uf').order('mes', { ascending: false }).limit(1).maybeSingle()
    const valorUf = idx?.valor_uf ? Number(idx.valor_uf) : null

    const norm = []
    for (const t of testigos) {
      const m2 = Number(t.m2)
      const precio = Number(t.precio)
      if (!isFinite(m2) || m2 <= 0 || !isFinite(precio) || precio <= 0) continue
      const moneda = (t.moneda || 'UF').toUpperCase()
      let precio_uf = moneda === 'UF' ? precio : (valorUf ? precio / valorUf : null)
      if (!precio_uf) continue
      norm.push({
        link: t.link || null,
        m2, precio, moneda,
        precio_uf, uf_m2: precio_uf / m2,
        dormitorios: (t.dormitorios != null && t.dormitorios !== '') ? Number(t.dormitorios) : null,
      })
    }

    if (norm.length < 1) {
      return NextResponse.json({ error: 'Ingresa al menos un testigo con m2 y precio validos' }, { status: 400 })
    }

    const { conservados, descartados, limites } = filtrarOutliersIQR(norm, (c) => c.uf_m2, 1.5)
    const stat_uf_m2 = resumenEstadistico(conservados.map((c) => c.uf_m2))
    const stat_m2 = resumenEstadistico(conservados.map((c) => c.m2))

    const m2obj = sujeto.m2 ? Number(sujeto.m2) : null
    let estimacion = null
    if (m2obj && stat_uf_m2) {
      const valUf = Math.round(stat_uf_m2.mediana * m2obj)
      estimacion = {
        uf_m2_mediana: stat_uf_m2.mediana,
        valor_uf: valUf,
        rango_uf: [Math.round(stat_uf_m2.p25 * m2obj), Math.round(stat_uf_m2.p75 * m2obj)],
        valor_clp: valorUf ? Math.round(valUf * valorUf) : null,
      }
    }

    const avaluo = sujeto.avaluo_fiscal_uf ? Number(sujeto.avaluo_fiscal_uf) : null
    const vs_avaluo = (avaluo && estimacion) ? { avaluo_uf: avaluo, ratio: estimacion.valor_uf / avaluo } : null

    const resultado = {
      valorUf,
      totales: { testigos: norm.length, usados: conservados.length, descartados: descartados.length },
      limites_iqr: limites,
      stat_uf_m2, stat_m2, estimacion, vs_avaluo,
      comparables: conservados,
      comparables_descartados: descartados,
    }

    let valoracion_id = null
    if (guardar) {
      const { data: val, error: e1 } = await supabase.from('valoraciones').insert({
        rol: sujeto.rol || null,
        direccion: sujeto.direccion || null,
        comuna: sujeto.comuna,
        tipo: sujeto.tipo || 'departamento',
        operacion: sujeto.operacion || 'venta',
        m2_objetivo: m2obj,
        dormitorios: sujeto.dormitorios ? Number(sujeto.dormitorios) : null,
        uf_m2_mediana: stat_uf_m2?.mediana ?? null,
        valor_uf: estimacion?.valor_uf ?? null,
        valor_min_uf: estimacion?.rango_uf?.[0] ?? null,
        valor_max_uf: estimacion?.rango_uf?.[1] ?? null,
        valor_clp: estimacion?.valor_clp ?? null,
        n_comparables: conservados.length,
        n_descartados: descartados.length,
        avaluo_fiscal_uf: avaluo,
        metodologia_json: { limites_iqr: limites, stat_uf_m2, stat_m2, valorUf },
        creado_por: creado_por || null,
      }).select('id').single()

      if (e1) return NextResponse.json({ error: 'Error guardando: ' + e1.message, resultado }, { status: 500 })
      valoracion_id = val.id

      const filas = [
        ...conservados.map((c) => ({ ...c, usado: true })),
        ...descartados.map((c) => ({ ...c, usado: false })),
      ].map((c) => ({
        valoracion_id, fuente: 'manual', usado: c.usado,
        titulo: null, permalink: c.link,
        precio: c.precio, moneda: c.moneda, precio_uf: c.precio_uf,
        m2: c.m2, uf_m2: c.uf_m2, dormitorios: c.dormitorios, comuna: sujeto.comuna,
      }))
      await supabase.from('valoracion_comparables').insert(filas)
    }

    return NextResponse.json({ ok: true, valoracion_id, resultado })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}