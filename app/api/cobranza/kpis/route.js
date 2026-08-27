// VERSION: v2 · 2026-08-26 · Cobranza · KPIs de salud del cobro (renta + servicios), serie mensual.
//   Cambios v2: (1) "cobrado en plazo" REAL = abonos con fecha ≤ día 10 (gracia) / a cobrar del mes,
//   contando fecha de cada abono (ya no proxy). (2) Metas por defecto (estándar gestión inmobiliaria).
//   (3) Nuevo KPI "garantías en riesgo": contratos cuya deuda de servicios ≥ 50% de su garantía.
//   GET ?meses=6 -> serie[{aamm,lbl,pct_cobrado,cartera,pct_cartera,deuda_serv,pct_serv_aldia,garantias_riesgo,base}]
// Ruta real: app/api/cobranza/kpis/route.js
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const PUEDEN_VER = ['direccion', 'administracion', 'finanzas', 'legal']
const UMBRAL_SERV = 30000          // deuda de servicios por debajo de la cual se considera "al día"
const RIESGO_GARANTIA = 0.5        // deuda de servicios ≥ 50% de la garantía => garantía en riesgo
const MESES_TXT = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
const MES_ABR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const DIA_MS = 86400000
const n0 = (v) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d.-]/g, '')) || 0)

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
const mesTxtDe = (y, mo) => MESES_TXT[mo - 1] + ' ' + y
const lblDe = (y, mo) => MES_ABR[mo - 1] + " '" + String(y).slice(2)

// trae TODOS los abonos (paginado; PostgREST limita a 1000 por página)
async function todosAbonos() {
  const out = []; let from = 0; const page = 1000
  for (let i = 0; i < 60; i++) {
    const { data, error } = await admin.from('cuentas').select('idadmon, fecha, abono, anulado').not('abono', 'is', null).range(from, from + page - 1)
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

  const url = new URL(req.url)
  const N = Math.min(18, Math.max(3, Number(url.searchParams.get('meses')) || 6))

  // contratos: quien_cobra (excluir DUEÑO) y garantía
  const { data: arr } = await admin.from('datos_arriendos').select('idadmon, quien_cobra, garantia_pedida')
  const dueno = new Set(), garantia = {}
  for (const a of (arr || [])) {
    if (String(a.quien_cobra || '').toUpperCase() === 'DUEÑO') dueno.add(a.idadmon)
    garantia[a.idadmon] = n0(a.garantia_pedida)
  }

  // abonos con fecha (una sola vez) para el "cobrado en plazo"
  const abonos = (await todosAbonos())
    .filter(r => !r.anulado && n0(r.abono) > 0)
    .map(r => ({ idadmon: r.idadmon, t: pf(r.fecha), abono: n0(r.abono) }))
    .filter(r => r.t && !dueno.has(r.idadmon))

  // meses (del más antiguo al más reciente)
  const base = mesBase(); const meses = []
  for (let i = N - 1; i >= 0; i--) { let y = base.y, mo = base.mo - i; while (mo < 1) { mo += 12; y -= 1 } meses.push({ y, mo }) }

  const serie = await Promise.all(meses.map(async ({ y, mo }) => {
    const [liqRes, servRes] = await Promise.all([
      admin.rpc('calcular_liquidacion', { p_mes: aamm(y, mo) }),
      admin.from('ggcc_agua_luz').select('idadmon, deuda_gastos_comunes, deuda_vigente_electricidad, deuda_vigente_agua, deuda_vigente_gas').eq('mes', mesTxtDe(y, mo)),
    ])
    // renta a cobrar
    let base_t = 0, falta_t = 0
    for (const r of (liqRes.data || [])) { if (dueno.has(r.idadmon)) continue; base_t += n0(r.base); falta_t += n0(r.falta) }
    // cobrado EN PLAZO: abonos con fecha entre 23 del mes anterior y el día 10 de este mes
    const ini = Date.UTC(y, mo - 2, 23), corte = Date.UTC(y, mo - 1, 10)
    let cobradoPlazo = 0
    for (const a of abonos) { if (a.t >= ini && a.t <= corte) cobradoPlazo += a.abono }
    const pct_cobrado = base_t > 0 ? Math.min(100, Math.round((cobradoPlazo / base_t) * 1000) / 10) : null
    const cartera = Math.round(Math.max(0, falta_t))
    const pct_cartera = base_t > 0 ? Math.round((cartera / base_t) * 1000) / 10 : null
    // servicios
    let deuda_serv = 0, conDeuda = 0, totalS = 0, riesgo = 0
    for (const r of (servRes.data || [])) {
      if (dueno.has(r.idadmon)) continue
      const t = n0(r.deuda_gastos_comunes) + n0(r.deuda_vigente_electricidad) + n0(r.deuda_vigente_agua) + n0(r.deuda_vigente_gas)
      totalS++; deuda_serv += Math.max(0, t); if (t > UMBRAL_SERV) conDeuda++
      const g = garantia[r.idadmon] || 0
      if (g > 0 && t >= RIESGO_GARANTIA * g) riesgo++
    }
    const pct_serv_aldia = totalS > 0 ? Math.round(((totalS - conDeuda) / totalS) * 1000) / 10 : null
    return {
      aamm: aamm(y, mo), lbl: lblDe(y, mo), base: Math.round(base_t),
      pct_cobrado, cartera, pct_cartera,
      deuda_serv: Math.round(deuda_serv), pct_serv_aldia, garantias_riesgo: riesgo,
    }
  }))

  const metas = {
    pct_cobrado: { objetivo: 95, dir: 'up', txt: '≥ 95%' },     // puntualidad de cobro
    pct_cartera: { objetivo: 5, dir: 'down', txt: '≤ 5%' },      // morosidad / cartera vencida
    pct_serv_aldia: { objetivo: 90, dir: 'up', txt: '≥ 90%' },   // servicios al día
    garantias_riesgo: { objetivo: 0, dir: 'down', txt: '0' },    // ninguna garantía comprometida
  }
  return Response.json({ ok: true, meses: N, serie, actual: serie[serie.length - 1] || null, metas })
}
