// VERSION: v1 · 2026-08-26 · Cobranza · Bandeja de MULTAS por atraso (solo lectura / cálculo).
//   GET ?periodo=AAMM (por defecto el mes en curso según la ventana 23→22, igual que FALTAN).
//   Para cada moroso de arriendo (falta>0 en calcular_liquidacion, quien_cobra≠DUEÑO):
//     - base / recibido / falta EXACTOS del FALTAN (RPC calcular_liquidacion, agrupado por idadmon).
//     - multa TRAMO A TRAMO: gracia si pagó lo sustancial ≤ día 10; si no, se pondera el saldo vivo
//       por los días de cada tramo desde el día 6 (pagos parciales incluidos) × multa_diaria (%/día).
//     - PERFIL del moroso desde su cartola (meses con deuda, día medio de pago, saldo que arrastra):
//       puntual | apretado | cronico | grave.
//     - estado guardado en cobranza_multas (propuesta/avisada/firme/regularizada/anulada) + plazo.
//   NO escribe nada. Las acciones (aviso/firme/cargo a cartola) van en un endpoint POST aparte (Tanda 2).
// Ruta real: app/api/cobranza/multas/route.js
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const PUEDEN_VER = ['direccion', 'administracion', 'finanzas', 'legal']
const TOL = 10000            // tolerancia de saldo (pesos): por debajo se considera "al día"
const DIA_MS = 86400000

const n0 = (v) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d.-]/g, '')) || 0)

// fecha "dd/mm/aaaa" o "aaaa-mm-dd" -> {y,mo,d} y timestamp UTC (medianoche). null si no parsea.
function pf(s) {
  const t = String(s || '').trim()
  let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) { const y = +m[3], mo = +m[2], d = +m[1]; return { y, mo, d, t: Date.UTC(y, mo - 1, d) } }
  m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) { const y = +m[1], mo = +m[2], d = +m[3]; return { y, mo, d, t: Date.UTC(y, mo - 1, d) } }
  return null
}
const isoUTC = (t) => new Date(t).toISOString().slice(0, 10)
const esInicio = (r) => /INICIO/i.test(String(r.calif || '')) || /garant|comision|comisión/i.test(String(r.concepto || ''))
const cargoEf = (r) => (r.cargo_manual != null && r.cargo_manual !== '') ? n0(r.cargo_manual) : n0(r.cargo)

// "hoy" en America/Santiago como componentes de fecha
function hoySantiago() {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const g = (k) => +p.find(x => x.type === k).value
  const y = g('year'), mo = g('month'), d = g('day')
  return { y, mo, d, t: Date.UTC(y, mo - 1, d) }
}

// periodo AAMM por defecto (ventana 23→22: desde el 23 cuenta el mes siguiente), igual que FALTAN.
function periodoPorDefecto() {
  const h = hoySantiago()
  let y = h.y, mo = h.mo
  if (h.d >= 23) { mo += 1; if (mo > 12) { mo = 1; y += 1 } }
  return String(y).slice(2) + String(mo).padStart(2, '0')
}

// ── perfil del moroso a partir de su cartola (cuentas) ──
function perfilDesdeCuentas(rows) {
  const movs = (rows || []).map(r => ({ f: pf(r.fecha), cargo: cargoEf(r), abono: n0(r.abono), inicio: esInicio(r) }))
    .filter(m => m.f && !m._anul).sort((a, b) => a.f.t - b.f.t)
  if (!movs.length) return { perfil: 'puntual', mesesConDeuda: 0, diaMedio: null, saldoActual: 0, rentaRef: 0 }
  const rentas = movs.filter(m => m.cargo > 0 && !m.inicio).map(m => m.cargo).sort((a, b) => b - a)
  const rentaRef = rentas.length ? rentas[Math.floor(rentas.length / 2)] : 250000
  let run = 0; const meses = {}
  for (const m of movs) {
    run += m.cargo - m.abono
    const k = `${m.f.y}-${String(m.f.mo).padStart(2, '0')}`
    const mm = meses[k] || (meses[k] = { saldoFin: 0, dias: [] })
    mm.saldoFin = run
    if (m.abono > 0) mm.dias.push(m.f.d)
  }
  const ml = Object.keys(meses).sort().map(k => meses[k])
  const mesesConDeuda = ml.filter(m => m.saldoFin > rentaRef * 0.1).length
  const todosDias = ml.flatMap(m => m.dias)
  const diaMedio = todosDias.length ? Math.round(todosDias.reduce((a, b) => a + b, 0) / todosDias.length) : null
  const saldoActual = run
  let perfil
  if (saldoActual > rentaRef * 1.5) perfil = 'grave'
  else if (mesesConDeuda >= 4) perfil = 'cronico'
  else if (mesesConDeuda >= 1 || (diaMedio != null && diaMedio >= 12)) perfil = 'apretado'
  else perfil = 'puntual'
  return { perfil, mesesConDeuda, diaMedio, saldoActual: Math.round(saldoActual), rentaRef: Math.round(rentaRef) }
}

export async function GET(req) {
  const session = await getServerSession(authOptions)
  const rol = session?.user?.role
  if (!session?.user?.email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!PUEDEN_VER.includes(rol)) return Response.json({ error: 'No autorizado' }, { status: 403 })

  const url = new URL(req.url)
  let periodo = (url.searchParams.get('periodo') || '').trim()
  if (!/^\d{4}$/.test(periodo)) periodo = periodoPorDefecto()
  const anio = 2000 + Number(periodo.slice(0, 2))
  const mes = Number(periodo.slice(2))
  const t5 = Date.UTC(anio, mes - 1, 5)
  const t6 = Date.UTC(anio, mes - 1, 6)
  const t10 = Date.UTC(anio, mes - 1, 10)
  const ventanaIni = Date.UTC(anio, mes - 2, 23)   // 23 del mes anterior (rollover automático)
  const hoy = hoySantiago()
  const tHoy = Math.max(hoy.t, t10)                 // no computar antes del día 10

  // 1) Verdad del FALTAN: RPC agrupado por idadmon, falta>0
  const { data: liq, error: eLiq } = await admin.rpc('calcular_liquidacion', { p_mes: periodo })
  if (eLiq) return Response.json({ error: 'calcular_liquidacion: ' + eLiq.message }, { status: 500 })
  const porId = {}
  for (const r of (liq || [])) {
    const g = porId[r.idadmon] || (porId[r.idadmon] = { idadmon: r.idadmon, propietario: r.propietario || '', inmueble: '', base: 0, recibido: 0, falta: 0 })
    if (!String(r.inmueble || '').startsWith('[proporcional')) g.inmueble = r.inmueble || g.inmueble
    g.base += n0(r.base); g.recibido += n0(r.recibido_banco); g.falta += n0(r.falta)
  }
  const conFalta = Object.values(porId).filter(g => g.falta > TOL)
  const ids = conFalta.map(g => g.idadmon)
  if (!ids.length) return Response.json({ ok: true, periodo, hoy: isoUTC(hoy.t), morosos: [], plantillas: [], resumen: { total: 0 } })

  // 2) Datos del contrato + 3) cuentas + 4) estado guardado (en paralelo)
  const [arrRes, ctasRes, mmRes, plaRes] = await Promise.all([
    admin.from('datos_arriendos').select('idadmon, estado, arrendatario, rut, mail_arrendatario, movil, avalista, rut_avalista, mail_avalista, telefono_avalista, inmueble, propietario, multa_diaria, quien_cobra, media_retraso').in('idadmon', ids),
    admin.from('cuentas').select('id, idadmon, fecha, concepto, cargo, cargo_manual, abono, calif, anulado').in('idadmon', ids),
    admin.from('cobranza_multas').select('*').eq('periodo', periodo).in('idadmon', ids),
    admin.from('cobranza_plantillas').select('id, etapa, perfil, destinatario, departamento, asunto, cuerpo').like('etapa', 'multa_%'),
  ])
  if (arrRes.error) return Response.json({ error: 'datos_arriendos: ' + arrRes.error.message }, { status: 500 })
  if (ctasRes.error) return Response.json({ error: 'cuentas: ' + ctasRes.error.message }, { status: 500 })

  const arrMap = {}; for (const a of (arrRes.data || [])) arrMap[a.idadmon] = a
  const ctasMap = {}; for (const c of (ctasRes.data || [])) (ctasMap[c.idadmon] || (ctasMap[c.idadmon] = [])).push(c)
  const mmMap = {}; for (const m of (mmRes.data || [])) mmMap[m.idadmon] = m

  const morosos = []
  for (const g of conFalta) {
    const a = arrMap[g.idadmon] || {}
    if (String(a.quien_cobra || '').toUpperCase() === 'DUEÑO') continue   // lo cobra el dueño, fuera de multas FCR

    const todas = ctasMap[g.idadmon] || []
    const noAnul = todas.filter(c => !c.anulado)
    const aCobrar = Math.round(g.base)

    // abonos de la ventana (para el timing de los tramos)
    const abonosV = noAnul.map(c => ({ f: pf(c.fecha), monto: n0(c.abono) }))
      .filter(x => x.f && x.monto > 0 && x.f.t >= ventanaIni && x.f.t <= tHoy)
      .sort((x, y) => x.f.t - y.f.t)
    const cum = (tl) => { let s = 0; for (const x of abonosV) { if (x.f.t <= tl) s += x.monto } return s }
    const ob = (tl) => Math.max(0, aCobrar - Math.min(cum(tl), aCobrar))
    const obPagadoV = cum(tHoy)
    const obHoy = ob(tHoy)
    const obDia10 = ob(t10)

    // ponderación de tramos desde el día 6
    const puntos = [t6, ...abonosV.map(x => x.f.t).filter(t => t > t6 && t <= tHoy), tHoy].sort((x, y) => x - y)
    let peso = 0, diasAtraso = 0; const tramos = []
    for (let i = 0; i < puntos.length - 1; i++) {
      const ini = puntos[i], fin = puntos[i + 1]
      const nd = Math.round((fin - ini) / DIA_MS)
      if (nd <= 0) continue
      const bal = ob(ini)
      if (bal > TOL) { peso += bal * nd; diasAtraso += nd; tramos.push({ desde: isoUTC(ini), hasta: isoUTC(fin), dias: nd, saldo: Math.round(bal) }) }
    }
    const md = (a.multa_diaria == null || a.multa_diaria === '') ? null : n0(a.multa_diaria)
    const multa = (md && md > 0) ? Math.round(peso * (md / 100)) : 0

    // reconciliación con el FALTAN
    const recDif = Math.abs(obPagadoV - g.recibido)
    const saldoDif = Math.abs(obHoy - g.falta)
    const reconciliaOk = recDif <= TOL && saldoDif <= TOL

    // bucket de cálculo
    let bucket
    if (obDia10 <= TOL) bucket = 'a_tiempo'                 // pagó lo sustancial ≤ día 10 → sin multa
    else if (!reconciliaOk) bucket = 'revisar'             // no cuadra con la liquidación → revisar cartola
    else if (md == null || md <= 0) bucket = 'sin_pct'     // contrato sin % de multa pactado
    else bucket = 'multa'

    const perf = perfilDesdeCuentas(noAnul)
    const guardado = mmMap[g.idadmon] || null

    morosos.push({
      idadmon: g.idadmon,
      arrendatario: a.arrendatario || '', rut: a.rut || '', mail_arrendatario: a.mail_arrendatario || '',
      aval: a.avalista || '', rut_avalista: a.rut_avalista || '', mail_avalista: a.mail_avalista || '',
      propiedad: g.inmueble || a.inmueble || '', propietario: g.propietario || a.propietario || '',
      base: aCobrar, recibido: Math.round(g.recibido), falta: Math.round(g.falta),
      pagado_ventana: Math.round(obPagadoV), saldo_hoy: Math.round(obHoy),
      multa_diaria: md, dias_atraso: diasAtraso, multa, tramos,
      perfil: guardado?.perfil || perf.perfil, perfil_auto: perf.perfil,
      perfil_metrics: { meses_con_deuda: perf.mesesConDeuda, dia_medio: perf.diaMedio, saldo_actual: perf.saldoActual, renta_ref: perf.rentaRef, media_retraso: a.media_retraso ?? null },
      bucket, reconcilia_ok: reconciliaOk,
      estado: guardado?.estado || 'propuesta',
      plazo_hasta: guardado?.plazo_hasta || null, fecha_aviso: guardado?.fecha_aviso || null,
      fecha_firme: guardado?.fecha_firme || null, cuenta_id: guardado?.cuenta_id || null,
      monto_guardado: guardado?.monto ?? null,
    })
  }

  // orden: primero MULTA por importe desc; luego revisar/sin_pct; a_tiempo al final
  const ordBucket = { multa: 0, sin_pct: 1, revisar: 2, a_tiempo: 3 }
  morosos.sort((x, y) => (ordBucket[x.bucket] - ordBucket[y.bucket]) || (y.multa - x.multa) || (y.falta - x.falta))

  const resumen = {
    total: morosos.length,
    con_multa: morosos.filter(m => m.bucket === 'multa').length,
    a_tiempo: morosos.filter(m => m.bucket === 'a_tiempo').length,
    revisar: morosos.filter(m => m.bucket === 'revisar').length,
    sin_pct: morosos.filter(m => m.bucket === 'sin_pct').length,
    suma_multas: morosos.filter(m => m.bucket === 'multa').reduce((s, m) => s + m.multa, 0),
  }

  return Response.json({ ok: true, periodo, hoy: isoUTC(hoy.t), ventana_ini: isoUTC(ventanaIni), morosos, plantillas: plaRes.data || [], resumen })
}
