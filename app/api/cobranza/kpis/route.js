// VERSION: v9 · 2026-08-27 · "Cartera por cobrar" = FALTA de la liquidación del mes (verdad del FALTAN, ~2,3M ago), no el saldo vivo acumulado. Meta 5%. Hereda v8.
// VERSION: v8 · 2026-08-27 · "Cobrado en plazo" POR CONTRATO: se capa lo pagado en la ventana a la cuota del mes de cada IDADMON
//   (antes sumaba abonos sin tope -> atrasos/sobrepagos lo inflaban y topaba en 100% en meses viejos; era un artefacto). Hereda v7.
// VERSION: v7 · 2026-08-27 · Meses SIN datos de servicios (ggcc vacio ese mes) -> deuda_serv y garantias_riesgo = null (hueco en la curva),
//   no 0 (que dibujaba un valle falso, p.ej. Junio 2026). Hereda v6.
// VERSION: v6 · 2026-08-27 · Devuelve tambien la LISTA de IDADMON en riesgo (id, deuda servicios, garantia) por mes, para el listado. Hereda v5.
// VERSION: v5 · 2026-08-27 · FIX "Cartera por cobrar" (v4 daba ~0 por ventana): ahora = saldo vivo (cargado-abonado) a fin de mes
//   SOLO de contratos ACTIVOS que cobra FCR (S/SQ/Q, no dueno). = la misma deuda real de la pagina; excluye morosidad de terminados
//   (por eso ya no sale 102M) y no es 0. Hereda v4.
// VERSION: v4 · 2026-08-27 · FIX "Cartera por cobrar": era el saldo vivo ACUMULADO de todos los meses (morosidad historica, ~102M).
//   Ahora es POR LIQUIDACION: base del mes - lo cobrado en su ciclo de cobro (dia 23 mes anterior -> dia 23 del mes), acotado a >=0.
//   Asi refleja lo que falta por cobrar de ESA liquidacion (nunca mas que su base). Hereda v3.
// VERSION: v3 · 2026-08-27 · Cobranza · KPIs de salud del cobro (renta + servicios), serie mensual.
//   FIX v3: (1) servicios: el campo ggcc_agua_luz.mes es ISO "AAAA-MM" (no "AGOSTO 2026") -> se consultaba
//   vacío (deuda $0, al día —%, garantías 0). Ahora filtra por "AAAA-MM" y agrupa por idadmon.
//   (2) "Cartera por cobrar" = DEUDA ACUMULADA real (saldo vivo de cuentas a fin de mes), no la falta del
//   mes en curso (que sale ~0). (3) "cobrado en plazo" real (abonos ≤ día 10). Metas + garantías en riesgo.
// Ruta real: app/api/cobranza/kpis/route.js
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const PUEDEN_VER = ['direccion', 'administracion', 'finanzas', 'legal']
const UMBRAL_SERV = 30000
const RIESGO_GARANTIA = 0.5
const MES_ABR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const n0 = (v) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d.-]/g, '')) || 0)
const cargoEf = (r) => (r.cargo_manual != null && r.cargo_manual !== '') ? n0(r.cargo_manual) : n0(r.cargo)

function pf(s) {
  const t = String(s || '').trim()
  let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return Date.UTC(+m[3], +m[2] - 1, +m[1])
  m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3])
  return null
}
function hoySantiago() {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const g = (k) => +p.find(x => x.type === k).value
  return { y: g('year'), mo: g('month'), d: g('day') }
}
function mesBase() {
  const h = hoySantiago(); let y = h.y, mo = h.mo
  if (h.d <= 10) { mo -= 1; if (mo < 1) { mo = 12; y -= 1 } }
  return { y, mo }
}
const aamm = (y, mo) => String(y).slice(2) + String(mo).padStart(2, '0')
const isoMes = (y, mo) => y + '-' + String(mo).padStart(2, '0')
const lblDe = (y, mo) => MES_ABR[mo - 1] + " '" + String(y).slice(2)

// trae TODAS las filas de `cuentas` (paginado; PostgREST limita a 1000 por página)
async function todasCuentas() {
  const out = []; let from = 0; const page = 1000
  for (let i = 0; i < 60; i++) {
    const { data, error } = await admin.from('cuentas').select('idadmon, fecha, cargo, cargo_manual, abono, anulado').range(from, from + page - 1)
    if (error || !data || !data.length) break
    out.push(...data)
    if (data.length < page) break
    from += page
  }
  return out
}

export async function GET(req) {
  const session = await getServerSession(authOptions)
  const rol = session?.user?.role
  if (!session?.user?.email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!PUEDEN_VER.includes(rol)) return Response.json({ error: 'No autorizado' }, { status: 403 })

  const N = Math.min(18, Math.max(3, Number(new URL(req.url).searchParams.get('meses')) || 6))

  const { data: arr } = await admin.from('datos_arriendos').select('idadmon, quien_cobra, garantia_pedida, estado')
  const dueno = new Set(), garantia = {}, activo = new Set()
  for (const a of (arr || [])) {
    const esDueno = String(a.quien_cobra || '').toUpperCase() === 'DUEÑO'
    if (esDueno) dueno.add(a.idadmon)
    garantia[a.idadmon] = n0(a.garantia_pedida)
    const est = String(a.estado || '').toUpperCase()
    if (!esDueno && (est === 'S' || est === 'SQ' || est === 'Q')) activo.add(a.idadmon)
  }

  // movimientos de cuentas (una vez): para "cobrado en plazo" (abonos) y "cartera" (saldo acumulado)
  const cuentas = await todasCuentas()
  const abonos = [], movs = []
  for (const r of cuentas) {
    if (r.anulado || dueno.has(r.idadmon)) continue
    const t = pf(r.fecha); if (!t) continue
    const ab = n0(r.abono), ca = cargoEf(r)
    if (ab > 0) abonos.push({ idadmon: r.idadmon, t, ab })
    if (ca !== 0 || ab !== 0) movs.push({ idadmon: r.idadmon, t, delta: ca - ab })
  }
  movs.sort((a, b) => a.t - b.t)

  const base = mesBase(); const meses = []
  for (let i = N - 1; i >= 0; i--) { let y = base.y, mo = base.mo - i; while (mo < 1) { mo += 12; y -= 1 } meses.push({ y, mo }) }

  // 1) renta (RPC) y servicios (ggcc) en paralelo por mes
  const rentaServ = await Promise.all(meses.map(async ({ y, mo }) => {
    const [liqRes, servRes] = await Promise.all([
      admin.rpc('calcular_liquidacion', { p_mes: aamm(y, mo) }),
      admin.from('ggcc_agua_luz').select('idadmon, deuda_gastos_comunes, deuda_vigente_electricidad, deuda_vigente_agua, deuda_vigente_gas').like('mes', isoMes(y, mo) + '%'),
    ])
    const baseById = {}
    let falta_t = 0
    for (const r of (liqRes.data || [])) { if (!dueno.has(r.idadmon)) { baseById[r.idadmon] = (baseById[r.idadmon] || 0) + n0(r.base); falta_t += n0(r.falta) } }
    let base_t = 0; for (const id in baseById) base_t += baseById[id]
    const ini = Date.UTC(y, mo - 2, 23), corte = Date.UTC(y, mo - 1, 10)
    // pagado en plazo POR CONTRATO, capado a su cuota del mes (atrasos/sobrepagos no inflan el %)
    const pagById = {}
    for (const a of abonos) { if (a.t >= ini && a.t <= corte && baseById[a.idadmon] != null) pagById[a.idadmon] = (pagById[a.idadmon] || 0) + a.ab }
    let cobradoPlazo = 0
    for (const id in baseById) cobradoPlazo += Math.min(baseById[id], pagById[id] || 0)
    // servicios agrupados por idadmon (un contrato puede tener varios inmuebles)
    const porId = {}
    for (const r of (servRes.data || [])) {
      if (dueno.has(r.idadmon)) continue
      const t = n0(r.deuda_gastos_comunes) + n0(r.deuda_vigente_electricidad) + n0(r.deuda_vigente_agua) + n0(r.deuda_vigente_gas)
      porId[r.idadmon] = (porId[r.idadmon] || 0) + Math.max(0, t)
    }
    let deuda_serv = 0, conDeuda = 0, riesgo = 0; const totalS = Object.keys(porId).length; const riesgoIds = []
    for (const id in porId) {
      const t = porId[id]; deuda_serv += t
      if (t > UMBRAL_SERV) conDeuda++
      const g = garantia[id] || 0; if (g > 0 && t >= RIESGO_GARANTIA * g) { riesgo++; riesgoIds.push({ id, deuda: Math.round(t), gar: Math.round(g) }) }
    }
    const pct_serv_aldia = totalS > 0 ? Math.round(((totalS - conDeuda) / totalS) * 1000) / 10 : null
    return { y, mo, base_t, falta_t: Math.round(Math.max(0, falta_t)), cobradoPlazo, deuda_serv: totalS > 0 ? Math.round(deuda_serv) : null, pct_serv_aldia, garantias_riesgo: totalS > 0 ? riesgo : null, riesgo_ids: riesgoIds }
  }))

  // 2) cartera = FALTA de la liquidación de CADA mes (lo que falta cobrar de ESA renta) = verdad del FALTAN.
  const serie = rentaServ.map(r => {
    const cartera = r.falta_t || 0
    return {
      aamm: aamm(r.y, r.mo), lbl: lblDe(r.y, r.mo), base: Math.round(r.base_t),
      pct_cobrado: r.base_t > 0 ? Math.min(100, Math.round((r.cobradoPlazo / r.base_t) * 1000) / 10) : null,
      cartera, pct_cartera: r.base_t > 0 ? Math.round((cartera / r.base_t) * 1000) / 10 : null,
      deuda_serv: r.deuda_serv, pct_serv_aldia: r.pct_serv_aldia, garantias_riesgo: r.garantias_riesgo, riesgo_ids: r.riesgo_ids || [],
    }
  })

  const metas = {
    pct_cobrado: { objetivo: 95, dir: 'up', txt: '≥ 95%' },
    pct_cartera: { objetivo: 5, dir: 'down', txt: '≤ 5%' },   // morosidad del mes (falta / a cobrar)
    pct_serv_aldia: { objetivo: 90, dir: 'up', txt: '≥ 90%' },
    garantias_riesgo: { objetivo: 0, dir: 'down', txt: '0' },
  }
  return Response.json({ ok: true, meses: N, serie, actual: serie[serie.length - 1] || null, metas })
}
