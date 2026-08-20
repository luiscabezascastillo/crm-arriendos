// VERSION: v2 · 2026-08-20 · Empareja el GIRO COMPLEMENTARIO de las rectificatorias: si una rectificatoria
//   no cuadra en M+1, busca un pago al SII 'suelto' (mes sin F29) posterior cuyo importe ~= la diferencia
//   (tolerando recargos hasta +30%). Lo marca cuadra y expone el giro. Hereda v1.
// VERSION: v1 · 2026-08-19 · GET conciliacion F29 (sii_f29) vs pago S.I.I. en SA, con desfase M->M+1.
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const pad2 = (n) => String(n).padStart(2, '0')
const MESES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

// periodo F29 'YYYYMM' -> periodo de pago en SA 'YYYY-MM' (mes siguiente)
function pagoPeriodo(per) {
  const y = parseInt(String(per).slice(0, 4), 10)
  const m = parseInt(String(per).slice(4, 6), 10)
  return m >= 12 ? `${y + 1}-01` : `${y}-${pad2(m + 1)}`
}
function f29Label(per) {
  const y = String(per).slice(0, 4)
  const m = parseInt(String(per).slice(4, 6), 10)
  return `${MESES[m] || ''} ${y}`
}

export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const anio = searchParams.get('anio') || String(new Date().getFullYear())

  const { data: f29, error: e1 } = await admin
    .from('sii_f29')
    .select('periodo, total_a_pagar, iva_debito, iva_credito, iva_a_pagar, ppm, retencion_honorarios, tipo_declaracion, folio')
    .eq('vigente', true)
    .like('periodo', `${anio}%`)
  if (e1) return Response.json({ error: e1.message }, { status: 500 })

  const { data: mov, error: e2 } = await admin
    .from('sa_movimientos')
    .select('carga_id, monto')
    .ilike('descripcion', '%S.I.I%')
  if (e2) return Response.json({ error: e2.message }, { status: 500 })

  const { data: cargas, error: e3 } = await admin.from('sa_cargas').select('id, periodo')
  if (e3) return Response.json({ error: e3.message }, { status: 500 })

  const perDe = {}
  for (const c of (cargas || [])) perDe[c.id] = c.periodo

  // Pagos individuales al SII, con su periodo de carga SA (en positivo)
  const pagos = []
  for (const m of (mov || [])) {
    const p = perDe[m.carga_id]
    if (!p) continue
    pagos.push({ per: p, monto: -(Number(m.monto) || 0) })
  }
  const pagoPorPeriodo = {}
  for (const g of pagos) pagoPorPeriodo[g.per] = (pagoPorPeriodo[g.per] || 0) + g.monto

  // Meses de pago "esperados" = M+1 de cada F29. Un pago en un mes NO esperado es un pago suelto
  // (candidato a giro complementario de una rectificatoria, que se paga tarde y con recargos).
  const mesesEsperados = new Set((f29 || []).map(f => pagoPeriodo(f.periodo)))
  const sueltos = pagos.filter(g => !mesesEsperados.has(g.per))

  const filas = (f29 || [])
    .sort((a, b) => (String(a.periodo) < String(b.periodo) ? -1 : 1))
    .map(f => {
      const pp = pagoPeriodo(f.periodo)
      const pagado = pagoPorPeriodo[pp] || 0
      const total = Number(f.total_a_pagar) || 0
      const dif = total - pagado
      const row = {
        periodo: f.periodo, mes: f29Label(f.periodo), tipo: f.tipo_declaracion, folio: f.folio,
        iva_debito: Number(f.iva_debito) || 0, iva_credito: Number(f.iva_credito) || 0,
        ppm: Number(f.ppm) || 0, retencion: Number(f.retencion_honorarios) || 0,
        total_a_pagar: total, pago_periodo: pp, pagado, dif, cuadra: Math.abs(dif) < 1, giro: null,
      }
      // Rectificatoria que no cuadra en M+1: buscar el giro complementario en un pago suelto POSTERIOR,
      // tolerando recargos (reajuste + intereses) de hasta +30% sobre la diferencia.
      if (!row.cuadra && dif > 1 && /rectificat/i.test(String(f.tipo_declaracion || ''))) {
        const idx = sueltos.findIndex(sg => sg.per > pp && sg.monto >= dif - 1 && sg.monto <= dif * 1.3)
        if (idx >= 0) {
          const g = sueltos.splice(idx, 1)[0]   // consumir: que no lo empareje otra fila
          row.giro = { periodo: g.per, monto: g.monto, recargo: Math.round(g.monto - dif) }
          row.cuadra = true                       // la diferencia queda cubierta por el giro
        }
      }
      return row
    })

  return Response.json({ ok: true, anio, filas })
}
