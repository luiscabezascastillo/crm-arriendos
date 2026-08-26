// VERSION: v4 · 2026-08-26 · POST acciones: aviso (plazo 3 días hábiles, no toca cuentas), firme (2ª carta + cargo MULTA en cuentas, anulable), regularizar, anular. Hereda v3.
// VERSION: v3 · 2026-08-26 · Periodo por defecto respeta la gracia del día 10 (días 1-10 -> mes anterior). Hereda v2.
// VERSION: v2 · 2026-08-26 · FIX periodo por defecto: mes de la renta ya vencida, no la ventana 23→22 del FALTAN. Hereda v1.
// VERSION: v1 · 2026-08-26 · Cobranza · Bandeja de MULTAS por atraso (cálculo tramo a tramo + perfil).
//   GET ?periodo=AAMM (por defecto el mes cuya renta ya venció y pasó la gracia del día 10).
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
import nodemailer from 'nodemailer'

export const runtime = 'nodejs'
export const maxDuration = 60

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const PUEDEN_VER = ['direccion', 'administracion', 'finanzas', 'legal']
const TOL = 10000            // tolerancia de saldo (pesos): por debajo se considera "al día"
const DIA_MS = 86400000

// ── Envío de correo (mismo patrón que /api/cobranza/gestion: alias de info@, misma app password) ──
const BCC_ARCHIVO = 'info@fondocapital.com'
const EMAIL_COBRANZA = process.env.EMAIL_COBRANZA || 'cobranza@fondocapital.com'
const EMAIL_LEGAL = process.env.EMAIL_LEGAL || 'legal@fondocapital.com'
const DEPT = {
  cobranza: { from: `"Fondo Capital · Cobranzas" <${EMAIL_COBRANZA}>`, replyTo: EMAIL_COBRANZA },
  legal: { from: `"Fondo Capital · Area Legal" <${EMAIL_LEGAL}>`, replyTo: EMAIL_LEGAL },
}
const deptOf = (d) => (d === 'legal' ? 'legal' : 'cobranza')
const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } })
const escapeHtml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const textoAHtml = (t) => '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;line-height:1.6">' + escapeHtml(t).replace(/\n/g, '<br>') + '</div>'
const MESES_TXT = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']

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

// periodo AAMM por defecto para MULTAS: el mes cuya renta YA venció (vence el día 5).
// Hasta pasado el día 10 (gracia) un mes NO entra en multas -> se apunta al mes anterior.
// (Ojo: NO se usa la ventana 23→22 del FALTAN, que se adelanta al mes siguiente para liquidar.)
function periodoPorDefecto() {
  const h = hoySantiago()
  let y = h.y, mo = h.mo
  if (h.d <= 10) { mo -= 1; if (mo < 1) { mo = 12; y -= 1 } }
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

// ════════════════════════════════════════════════════════════════════════════
// POST — acciones sobre una multa: aviso | firme | regularizar | anular.
//   aviso  -> envía la carta del perfil (plazo 3 días hábiles). NO toca cuentas.
//   firme  -> envía la 2ª carta Y carga la multa en `cuentas` (calif=MULTA, anulable).
//   regularizar -> cierra sin multa (pagó dentro del plazo).
//   anular -> anula la multa; si era firme, anula también el cargo en `cuentas` (soft).
// Emitir aviso y firme: roles que operan Cobranza (Dirección/Administración/Finanzas/Legal),
//   incluidas Adalis y Fabiola. Cada carga a cartola deja rastro en cuentas_bitacora con el usuario.
// ════════════════════════════════════════════════════════════════════════════
function hoyTxtSantiago() {
  const h = hoySantiago()
  return String(h.d).padStart(2, '0') + '/' + String(h.mo).padStart(2, '0') + '/' + h.y
}
function plazoHabil(nHab) {
  const h = hoySantiago()
  let t = h.t, added = 0
  while (added < nHab) { t += DIA_MS; const wd = new Date(t).getUTCDay(); if (wd !== 0 && wd !== 6) added++ }
  return isoUTC(t)
}
async function asegurarCaso(idadmon, contrato, dias) {
  const tipo = String(contrato.estado || '').toUpperCase().startsWith('Q') ? 'termino' : 'vigente'
  const { data: ab } = await admin.from('cobranza_casos').select('*').eq('idadmon', idadmon).eq('tipo', tipo).neq('estado', 'cerrado').limit(1)
  if (ab && ab[0]) return ab[0].id
  const { data: nuevo, error } = await admin.from('cobranza_casos').insert({
    idadmon, tipo, estado: 'mora_leve', monto_adeudado: 0, dias_mora: dias || 0,
    propietario: contrato.propietario || null, propiedad: contrato.inmueble || null,
    arrendatario: contrato.arrendatario || null, arrendatario_rut: contrato.rut || null,
    aval: contrato.avalista || null, aval_rut: contrato.rut_avalista || null,
    responsable: contrato._email, origen: 'auto_mora',
  }).select().single()
  if (error) throw new Error('No se pudo crear el caso: ' + error.message)
  return nuevo.id
}
async function enviarCorreo({ dept, to, subject, html, test, remitenteEmail }) {
  const remit = DEPT[deptOf(dept)]
  if (test) {
    const info = await transporter.sendMail({ from: remit.from, replyTo: remit.replyTo, to: remitenteEmail, subject: '[PRUEBA] ' + subject, html })
    return { acuse: info?.messageId || 'prueba', response: info?.response || '' }
  }
  const info = await transporter.sendMail({ from: remit.from, replyTo: remit.replyTo, to, bcc: BCC_ARCHIVO, subject, html })
  if (!info || info.rejected?.length) throw new Error('Gmail no aceptó el destinatario (' + (info?.response || 's/r') + ')')
  return { acuse: info?.messageId || 'ok', response: info?.response || '' }
}
async function registrarGestion({ caso_id, idadmon, dept, contrato, destino_email, etapa, asunto, contenido, acuse, monto }) {
  const remit = DEPT[deptOf(dept)]
  const { data, error } = await admin.from('cobranza_gestiones').insert({
    caso_id, idadmon, canal: 'email', departamento: deptOf(dept), remitente: remit.replyTo,
    destinatario: 'arrendatario', destino_email: destino_email || null,
    destinatario_rut: contrato.rut || null, destinatario_nombre: contrato.arrendatario || null,
    plantilla_id: null, etapa: etapa || null, asunto: asunto || null,
    contenido_snapshot: contenido || null, acuse: acuse || null, resultado: 'enviado',
    monto_reclamado: monto || null, usuario: contrato._email,
  }).select('id').single()
  if (error) throw new Error('No se pudo registrar la gestión: ' + error.message)
  return data.id
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  const rol = session?.user?.role
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!PUEDEN_VER.includes(rol)) return Response.json({ error: 'No autorizado' }, { status: 403 })

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const accion = String(body.accion || '').trim()
  const idadmon = String(body.idadmon || '').trim().toUpperCase()
  const periodo = String(body.periodo || '').trim()
  if (!idadmon || !/^\d{4}$/.test(periodo)) return Response.json({ error: 'Falta idadmon o periodo (AAMM).' }, { status: 400 })

  // contrato (para remitente, destinatario y caso)
  const { data: arr } = await admin.from('datos_arriendos')
    .select('idadmon, estado, arrendatario, rut, mail_arrendatario, avalista, rut_avalista, propietario, inmueble')
    .eq('idadmon', idadmon).limit(1)
  const contrato = (arr && arr[0]) || {}
  contrato._email = email
  const mesTxt = MESES_TXT[Number(periodo.slice(2)) - 1] + ' 20' + periodo.slice(0, 2)

  try {
    // ── AVISO ───────────────────────────────────────────────────────────────
    if (accion === 'aviso' || accion === 'firme') {
      const dept = deptOf(body.departamento)
      const asunto = String(body.asunto || '').trim()
      const contenido = String(body.contenido || '').trim()
      const monto = Math.round(Number(body.monto) || 0)
      const perfil = String(body.perfil || '').trim() || null
      const dias = Math.round(Number(body.dias_atraso) || 0)
      const destino = String(body.destino_email || contrato.mail_arrendatario || '').trim()
      const test = body.test === true
      if (!asunto || !contenido) return Response.json({ error: 'Falta asunto o contenido de la carta.' }, { status: 400 })
      if (!test && !destino) return Response.json({ error: 'No hay email del arrendatario; edítalo antes de enviar.' }, { status: 400 })
      if (accion === 'firme' && !(monto > 0)) return Response.json({ error: 'La multa debe ser mayor que 0 para hacerla firme.' }, { status: 400 })

      const html = textoAHtml(contenido)
      const env = await enviarCorreo({ dept, to: destino, subject: asunto, html, test, remitenteEmail: email })
      if (test) return Response.json({ ok: true, test: true, response: env.response })

      const caso_id = await asegurarCaso(idadmon, contrato, dias)
      const etapa = (accion === 'aviso' ? 'multa_aviso_' : 'multa_firme_') + (perfil || 'apretado')
      const gestion_id = await registrarGestion({ caso_id, idadmon, dept, contrato, destino_email: destino, etapa, asunto, contenido, acuse: env.acuse, monto })

      if (accion === 'aviso') {
        const plazo = plazoHabil(3)
        const fila = {
          idadmon, periodo, perfil, base_multa: Math.round(Number(body.base) || 0), dias_atraso: dias,
          multa_diaria: (body.multa_diaria == null ? null : Number(body.multa_diaria)), monto,
          tramos: body.tramos || null, estado: 'avisada',
          fecha_aviso: new Date().toISOString(), plazo_hasta: plazo, gestion_aviso_id: gestion_id, usuario: email,
        }
        const { error } = await admin.from('cobranza_multas').upsert(fila, { onConflict: 'idadmon,periodo' })
        if (error) return Response.json({ error: 'cobranza_multas: ' + error.message }, { status: 500 })
        return Response.json({ ok: true, estado: 'avisada', plazo_hasta: plazo, gestion_id })
      }

      // ── FIRME: carga el cargo en cuentas ──
      const fecha = hoyTxtSantiago()
      const concepto = `MULTA ATRASO RENTA ${mesTxt}`
      const comentarios = `Multa por atraso ${dias} día(s) · periodo ${periodo} · perfil ${perfil || '—'}`
      const { data: cargo, error: eCargo } = await admin.from('cuentas').insert({
        idadmon, fecha, concepto, cargo: monto, calif: 'MULTA', comentarios,
        manual: true, anulado: false, estado: contrato.estado || 'S',
      }).select('id').single()
      if (eCargo) return Response.json({ error: 'INSERT cuentas (multa): ' + eCargo.message }, { status: 500 })
      await admin.from('cuentas_bitacora').insert({
        cuenta_id: cargo.id, idadmon, accion: 'alta', campo: null, valor_anterior: null,
        valor_nuevo: `MULTA ${monto} · ${concepto}`, motivo: `Multa por atraso ${mesTxt}`, usuario: email,
      })
      const fila = {
        idadmon, periodo, perfil, base_multa: Math.round(Number(body.base) || 0), dias_atraso: dias,
        multa_diaria: (body.multa_diaria == null ? null : Number(body.multa_diaria)), monto,
        tramos: body.tramos || null, estado: 'firme',
        fecha_firme: new Date().toISOString(), cuenta_id: cargo.id, gestion_firme_id: gestion_id, usuario: email,
      }
      const { error } = await admin.from('cobranza_multas').upsert(fila, { onConflict: 'idadmon,periodo' })
      if (error) return Response.json({ error: 'cobranza_multas: ' + error.message }, { status: 500 })
      return Response.json({ ok: true, estado: 'firme', cuenta_id: cargo.id, gestion_id })
    }

    // ── REGULARIZAR ───────────────────────────────────────────────────────────
    if (accion === 'regularizar') {
      const { error } = await admin.from('cobranza_multas')
        .upsert({ idadmon, periodo, estado: 'regularizada', fecha_regularizada: new Date().toISOString(), usuario: email }, { onConflict: 'idadmon,periodo' })
      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json({ ok: true, estado: 'regularizada' })
    }

    // ── ANULAR ────────────────────────────────────────────────────────────────
    if (accion === 'anular') {
      const motivo = String(body.motivo || '').trim()
      if (motivo.length < 3) return Response.json({ error: 'El motivo de anulación es obligatorio.' }, { status: 400 })
      const { data: m } = await admin.from('cobranza_multas').select('*').eq('idadmon', idadmon).eq('periodo', periodo).limit(1)
      const prev = m && m[0]
      if (prev?.cuenta_id) {
        await admin.from('cuentas').update({ anulado: true }).eq('id', prev.cuenta_id)
        await admin.from('cuentas_bitacora').insert({
          cuenta_id: prev.cuenta_id, idadmon, accion: 'anula', campo: 'anulado', valor_anterior: 'false',
          valor_nuevo: 'true', motivo: 'Anulación de multa: ' + motivo, usuario: email,
        })
      }
      const { error } = await admin.from('cobranza_multas')
        .upsert({ idadmon, periodo, estado: 'anulada', fecha_anulada: new Date().toISOString(), motivo_anulada: motivo, usuario: email }, { onConflict: 'idadmon,periodo' })
      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json({ ok: true, estado: 'anulada' })
    }

    return Response.json({ error: 'Acción no reconocida: ' + accion }, { status: 400 })
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 500 })
  }
}
