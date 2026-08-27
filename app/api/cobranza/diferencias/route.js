// VERSION: v1 · 2026-08-26 · Cobranza · Bandeja de DIFERENCIAS / saldo por cobrar (solo lectura).
//   GET ?periodo=AAMM. Detecta contratos que PAGARON DE MENOS (pagaron algo pero les falta),
//   distinto del que no pagó nada (esos van a Multas/cobranza). Objetivo: cazar el goteo pequeño
//   y recurrente, gran parte por reajustes no aplicados. NO es multa (pagó a tiempo, mal informado).
//   Devuelve por contrato: a cobrar (ya reajustado), recibido, diferencia del mes, saldo global
//   acumulado (cartola), % pagado y pista de reajuste reciente. NO escribe nada.
// Ruta real: app/api/cobranza/diferencias/route.js
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const PUEDEN_VER = ['direccion', 'administracion', 'finanzas', 'legal']
const TOL_PAGO = 10000   // pagó algo real (para separar del que no pagó nada)
const TOL_DIF = 1000     // diferencia mínima a mostrar (ignora redondeos)

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
  const y = g('year'), mo = g('month'), d = g('day')
  return { y, mo, d, t: Date.UTC(y, mo - 1, d) }
}
// periodo por defecto: mes cuya renta ya venció y pasó la gracia del día 10 (días 1-10 -> mes anterior)
function periodoPorDefecto() {
  const h = hoySantiago()
  let y = h.y, mo = h.mo
  if (h.d <= 10) { mo -= 1; if (mo < 1) { mo = 12; y -= 1 } }
  return String(y).slice(2) + String(mo).padStart(2, '0')
}
const isoUTC = (t) => new Date(t).toISOString().slice(0, 10)

// última fecha de reajuste ya aplicada (<= hoy) entre fecha_reajuste y fecha_reajuste1..6
function ultimoReajuste(a, hoyT) {
  const cands = ['fecha_reajuste', 'fecha_reajuste1', 'fecha_reajuste2', 'fecha_reajuste3', 'fecha_reajuste4', 'fecha_reajuste5', 'fecha_reajuste6']
    .map(k => pf(a[k])).filter(t => t && t <= hoyT)
  if (!cands.length) return null
  return Math.max(...cands)
}

export async function GET(req) {
  const session = await getServerSession(authOptions)
  const rol = session?.user?.role
  if (!session?.user?.email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!PUEDEN_VER.includes(rol)) return Response.json({ error: 'No autorizado' }, { status: 403 })

  const url = new URL(req.url)
  let periodo = (url.searchParams.get('periodo') || '').trim()
  if (!/^\d{4}$/.test(periodo)) periodo = periodoPorDefecto()
  const hoy = hoySantiago()

  // 1) verdad del FALTAN por idadmon
  const { data: liq, error: eLiq } = await admin.rpc('calcular_liquidacion', { p_mes: periodo })
  if (eLiq) return Response.json({ error: 'calcular_liquidacion: ' + eLiq.message }, { status: 500 })
  const porId = {}
  for (const r of (liq || [])) {
    const g = porId[r.idadmon] || (porId[r.idadmon] = { idadmon: r.idadmon, propietario: r.propietario || '', inmueble: '', base: 0, recibido: 0, falta: 0 })
    if (!String(r.inmueble || '').startsWith('[proporcional')) g.inmueble = r.inmueble || g.inmueble
    g.base += n0(r.base); g.recibido += n0(r.recibido_banco); g.falta += n0(r.falta)
  }
  // PAGÓ DE MENOS: pagó algo real y aún le falta (distinto del que no pagó nada)
  const cand = Object.values(porId).filter(g => g.recibido > TOL_PAGO && g.falta > TOL_DIF)
  const ids = cand.map(g => g.idadmon)
  if (!ids.length) return Response.json({ ok: true, periodo, hoy: isoUTC(hoy.t), filas: [], resumen: { total: 0, suma_dif: 0, suma_acum: 0, con_reajuste: 0 } })

  const [arrRes, ctasRes] = await Promise.all([
    admin.from('datos_arriendos').select('idadmon, arrendatario, rut, mail_arrendatario, inmueble, propietario, quien_cobra, cuota, fecha_reajuste, fecha_reajuste1, fecha_reajuste2, fecha_reajuste3, fecha_reajuste4, fecha_reajuste5, fecha_reajuste6').in('idadmon', ids),
    admin.from('cuentas').select('idadmon, cargo, cargo_manual, abono, anulado').in('idadmon', ids),
  ])
  if (arrRes.error) return Response.json({ error: 'datos_arriendos: ' + arrRes.error.message }, { status: 500 })
  const arrMap = {}; for (const a of (arrRes.data || [])) arrMap[a.idadmon] = a
  const saldoAcum = {}
  for (const c of (ctasRes.data || [])) { if (c.anulado) continue; saldoAcum[c.idadmon] = (saldoAcum[c.idadmon] || 0) + cargoEf(c) - n0(c.abono) }

  const filas = []
  for (const g of cand) {
    const a = arrMap[g.idadmon] || {}
    if (String(a.quien_cobra || '').toUpperCase() === 'DUEÑO') continue
    const dif = Math.round(g.falta)
    const base = Math.round(g.base)
    const rec = Math.round(g.recibido)
    const uReaj = ultimoReajuste(a, hoy.t)
    const reajusteReciente = uReaj != null && (hoy.t - uReaj) <= 150 * 86400000  // últimos ~5 meses
    filas.push({
      idadmon: g.idadmon, arrendatario: a.arrendatario || '', mail_arrendatario: a.mail_arrendatario || '',
      propiedad: g.inmueble || a.inmueble || '', propietario: g.propietario || a.propietario || '',
      base, recibido: rec, diferencia: dif, pct_pagado: base > 0 ? Math.round((rec / base) * 100) : 0,
      saldo_acumulado: Math.round(saldoAcum[g.idadmon] || 0),
      reajuste_reciente: reajusteReciente, fecha_reajuste: uReaj ? isoUTC(uReaj) : null,
    })
  }
  filas.sort((x, y) => (y.diferencia - x.diferencia))

  const resumen = {
    total: filas.length,
    suma_dif: filas.reduce((s, f) => s + f.diferencia, 0),
    suma_acum: filas.reduce((s, f) => s + Math.max(0, f.saldo_acumulado), 0),
    con_reajuste: filas.filter(f => f.reajuste_reciente).length,
  }
  return Response.json({ ok: true, periodo, hoy: isoUTC(hoy.t), filas, resumen })
}
