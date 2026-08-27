// VERSION: v1 · 2026-08-26 · Cobranza · KPIs de salud del cobro (renta + servicios), serie mensual.
//   GET ?meses=6 -> por cada mes (últimos N, hacia atrás desde el mes en curso ya vencido):
//     RENTA (calcular_liquidacion, excluye quien_cobra=DUEÑO):
//       - pct_cobrado  = recibido / a cobrar  (puntualidad de cobro del mes)
//       - cartera      = lo que falta a cierre ($)  ·  pct_cartera = falta / base
//     SERVICIOS (ggcc_agua_luz, deuda ggcc+luz+agua+gas que amenaza la garantía):
//       - deuda_serv   = suma de la deuda de servicios del mes ($)
//       - pct_serv_aldia = % de contratos sin deuda relevante de servicios
//   Devuelve la serie + el último punto (actual) + metas. Solo lectura.
// Ruta real: app/api/cobranza/kpis/route.js
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const PUEDEN_VER = ['direccion', 'administracion', 'finanzas', 'legal']
const UMBRAL_SERV = 30000   // deuda de servicios por debajo de la cual se considera "al día"
const MESES_TXT = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
const MES_ABR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const n0 = (v) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d.-]/g, '')) || 0)

function hoySantiago() {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const g = (k) => +p.find(x => x.type === k).value
  return { y: g('year'), mo: g('month'), d: g('day') }
}
// último mes ya "cobrable" (renta vencida y pasada la gracia del día 10)
function mesBase() {
  const h = hoySantiago(); let y = h.y, mo = h.mo
  if (h.d <= 10) { mo -= 1; if (mo < 1) { mo = 12; y -= 1 } }
  return { y, mo }
}
const aamm = (y, mo) => String(y).slice(2) + String(mo).padStart(2, '0')
const mesTxtDe = (y, mo) => MESES_TXT[mo - 1] + ' ' + y
const lblDe = (y, mo) => MES_ABR[mo - 1] + " '" + String(y).slice(2)

export async function GET(req) {
  const session = await getServerSession(authOptions)
  const rol = session?.user?.role
  if (!session?.user?.email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!PUEDEN_VER.includes(rol)) return Response.json({ error: 'No autorizado' }, { status: 403 })

  const url = new URL(req.url)
  const N = Math.min(18, Math.max(3, Number(url.searchParams.get('meses')) || 6))

  // set de contratos que cobra el dueño (se excluyen del cobro FCR)
  const { data: arr } = await admin.from('datos_arriendos').select('idadmon, quien_cobra')
  const dueno = new Set((arr || []).filter(a => String(a.quien_cobra || '').toUpperCase() === 'DUEÑO').map(a => a.idadmon))

  // lista de meses (del más antiguo al más reciente)
  const base = mesBase()
  const meses = []
  for (let i = N - 1; i >= 0; i--) {
    let y = base.y, mo = base.mo - i
    while (mo < 1) { mo += 12; y -= 1 }
    meses.push({ y, mo })
  }

  const serie = await Promise.all(meses.map(async ({ y, mo }) => {
    const [liqRes, servRes] = await Promise.all([
      admin.rpc('calcular_liquidacion', { p_mes: aamm(y, mo) }),
      admin.from('ggcc_agua_luz').select('idadmon, deuda_gastos_comunes, deuda_vigente_electricidad, deuda_vigente_agua, deuda_vigente_gas').eq('mes', mesTxtDe(y, mo)),
    ])
    // renta
    let base_t = 0, rec_t = 0, falta_t = 0
    for (const r of (liqRes.data || [])) {
      if (dueno.has(r.idadmon)) continue
      base_t += n0(r.base); rec_t += n0(r.recibido_banco); falta_t += n0(r.falta)
    }
    const pct_cobrado = base_t > 0 ? Math.round((rec_t / base_t) * 1000) / 10 : null
    const cartera = Math.round(Math.max(0, falta_t))
    // servicios
    const rowsS = servRes.data || []
    let deuda_serv = 0, conDeuda = 0, totalS = 0
    for (const r of rowsS) {
      const t = n0(r.deuda_gastos_comunes) + n0(r.deuda_vigente_electricidad) + n0(r.deuda_vigente_agua) + n0(r.deuda_vigente_gas)
      if (dueno.has(r.idadmon)) continue
      totalS++; deuda_serv += Math.max(0, t); if (t > UMBRAL_SERV) conDeuda++
    }
    const pct_serv_aldia = totalS > 0 ? Math.round(((totalS - conDeuda) / totalS) * 1000) / 10 : null
    return {
      aamm: aamm(y, mo), lbl: lblDe(y, mo),
      pct_cobrado, cartera, base: Math.round(base_t),
      deuda_serv: Math.round(deuda_serv), pct_serv_aldia, serv_con_deuda: conDeuda, serv_total: totalS,
    }
  }))

  const actual = serie[serie.length - 1] || null
  return Response.json({ ok: true, meses: N, serie, actual, metas: { pct_cobrado: 100, pct_serv_aldia: 100 } })
}
