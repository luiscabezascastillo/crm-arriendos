// RUTA: app/api/liquidacion-paola/historico/route.js
// VERSION: v1 · 2026-08-16 · Hoja HISTÓRICA de Liquidación Paola (solo lectura). Sirve tres cosas:
//   1) matriz A cobrar por idadmon × mes (foto congelada `liquidacion_idadmon`, P001, 2501→hoy),
//   2) el estado de congelado por mes (`paola_cierres`),
//   3) el buscador RUT/glosa → idadmon (`pagadores_idadmon`) para la vista de correspondencias,
//      enriquecido con inmueble/arrendatario/estado del contrato (`datos_arriendos`).
//   NO escribe nada. El "Recibido" histórico NO está en BD (se recalcula de la cartola de Drive):
//   esta hoja muestra el A cobrar, que sí es dato firme. Lee con anon (RLS revertido en internas).
import { NextResponse } from 'next/server'
import { supabase } from '../../../../lib/supabaseClient'

const IDPROP_PAOLA = 'P001'

// paola_cierres usa 'YYYY-MM'; liquidacion_idadmon usa AAMM ('2501'). Normalizamos todo a AAMM.
function aAamm(mes) {
  const s = String(mes || '').trim()
  if (/^\d{4}$/.test(s)) return s
  const m = s.match(/^(\d{4})-(\d{2})$/)
  return m ? m[1].slice(2) + m[2] : s
}
const numOf = (v) => { if (v == null || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null }

export async function GET() {
  try {
    const [foto, cierres, pagadores, contratos] = await Promise.all([
      supabase.from('liquidacion_idadmon')
        .select('mes, idadmon, inmueble, arrendatario, a_cobrar')
        .eq('idprop', IDPROP_PAOLA),
      supabase.from('paola_cierres').select('mes, congelado'),
      supabase.from('pagadores_idadmon').select('clave, rut, glosa, idadmon, clase, vigente'),
      supabase.from('datos_arriendos')
        .select('idadmon, inmueble, arrendatario, estado, rut')
        .eq('idprop', IDPROP_PAOLA),
    ])
    for (const r of [foto, cierres, pagadores, contratos]) if (r.error) throw new Error(r.error.message)

    // Matriz A cobrar: filas por idadmon, valores por mes (AAMM).
    const historico = (foto.data || []).map(r => ({
      mes: aAamm(r.mes), idadmon: r.idadmon, inmueble: r.inmueble || null,
      arrendatario: r.arrendatario || null, aCobrar: numOf(r.a_cobrar),
    }))

    // Congelado por mes (AAMM → bool).
    const cierre = {}
    for (const c of (cierres.data || [])) cierre[aAamm(c.mes)] = !!c.congelado

    // Contratos de Paola (para enriquecer la vista RUT↔idadmon y la matriz).
    const contrato = {}
    for (const c of (contratos.data || [])) contrato[c.idadmon] = {
      inmueble: c.inmueble || null, arrendatario: c.arrendatario || null,
      estado: c.estado || null, rut: c.rut || null,
    }

    return NextResponse.json({
      ok: true,
      historico,
      cierre,
      pagadores: pagadores.data || [],
      contrato,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}
