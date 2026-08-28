// VERSION: v6 · 2026-08-27 · FIX saldo acumulado y perfil: `cuentas` se traía sin paginar (>1000 filas truncaba). Ahora paginado -> el saldo cuadra con la cartola. Hereda v5.
// VERSION: v5 · 2026-08-27 · Envío con CC (aval u otros) y copia oculta a administración@ en todos los envíos reales (no en pruebas). Hereda v4.
// VERSION: v4 · 2026-08-27 · Email suave afinado: pide regularizar hoy/mañana, con concepto de pago y mención del reajuste (placeholder). Hereda v3.
// VERSION: v3 · 2026-08-27 · Cobranza · DIFERENCIAS / saldo por cobrar (Tanda 2: retrato + envío + estado).
//   GET: por moroso "pagó de menos" devuelve el retrato completo (a cobrar, recibido, diferencia, %,
//        saldo cartola, reajuste, PERFIL de pagador, deuda de servicios) + estado guardado + plantilla suave.
//   POST: 'enviar' (email suave de recordatorio de saldo + constancia + estado=enviado) | 'estado'
//        (pospuesto/investigar/pendiente). No aplica multa (pagó a tiempo, mal informado).
// Ruta real: app/api/cobranza/diferencias/route.js
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

export const runtime = 'nodejs'
export const maxDuration = 60

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const PUEDEN_VER = ['direccion', 'administracion', 'finanzas', 'legal']
const TOL_PAGO = 10000, TOL_DIF = 1000, UMBRAL_SERV = 30000
const BCC_ARCHIVO = 'info@fondocapital.com'
const ADMIN_COPIA = 'administracion@fondocapital.com'   // copia interna de TODOS los envíos reales
const parseCC = (v) => { const arr = Array.isArray(v) ? v : String(v || '').split(/[,;\s]+/); const seen = new Set(), out = []; for (const e of arr) { const s = String(e || '').trim().toLowerCase(); if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) && !seen.has(s)) { seen.add(s); out.push(s) } } return out }
const EMAIL_COBRANZA = process.env.EMAIL_COBRANZA || 'cobranza@fondocapital.com'
const EMAIL_LEGAL = process.env.EMAIL_LEGAL || 'legal@fondocapital.com'
const DEPT = { cobranza: { from: `"Fondo Capital · Cobranzas" <${EMAIL_COBRANZA}>`, replyTo: EMAIL_COBRANZA }, legal: { from: `"Fondo Capital · Area Legal" <${EMAIL_LEGAL}>`, replyTo: EMAIL_LEGAL } }
const deptOf = (d) => (d === 'legal' ? 'legal' : 'cobranza')
const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } })
const escapeHtml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const textoAHtml = (t) => '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;line-height:1.6">' + escapeHtml(t).replace(/\n/g, '<br>') + '</div>'
const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']

const n0 = (v) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d.-]/g, '')) || 0)
const cargoEf = (r) => (r.cargo_manual != null && r.cargo_manual !== '') ? n0(r.cargo_manual) : n0(r.cargo)
const esInicio = (r) => /INICIO/i.test(String(r.calif || '')) || /garant|comision|comisión/i.test(String(r.concepto || ''))
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
function periodoPorDefecto() {
  const h = hoySantiago(); let y = h.y, mo = h.mo
  if (h.d <= 10) { mo -= 1; if (mo < 1) { mo = 12; y -= 1 } }
  return String(y).slice(2) + String(mo).padStart(2, '0')
}
const isoUTC = (t) => new Date(t).toISOString().slice(0, 10)
const isoMes = (y, mo) => y + '-' + String(mo).padStart(2, '0')

function ultimoReajuste(a, hoyT) {
  const cands = ['fecha_reajuste1', 'fecha_reajuste2', 'fecha_reajuste3', 'fecha_reajuste4', 'fecha_reajuste5', 'fecha_reajuste6']
    .map(k => pf(a[k])).filter(t => t && t <= hoyT)
  return cands.length ? Math.max(...cands) : null
}
// perfil del pagador desde su cartola (buen pagador / se atrasa / crónico / grave)
function perfilDesdeCuentas(rows) {
  const movs = (rows || []).map(r => ({ f: pf(r.fecha), cargo: cargoEf(r), abono: n0(r.abono), inicio: esInicio(r) }))
    .filter(m => m.f).sort((a, b) => a.f - b.f)
  if (!movs.length) return { perfil: 'puntual', meses_con_deuda: 0, dia_medio: null, saldo_actual: 0 }
  const rentas = movs.filter(m => m.cargo > 0 && !m.inicio).map(m => m.cargo).sort((a, b) => b - a)
  const rentaRef = rentas.length ? rentas[Math.floor(rentas.length / 2)] : 250000
  let run = 0; const meses = {}
  for (const m of movs) {
    run += m.cargo - m.abono
    const d = new Date(m.f), k = d.getUTCFullYear() + '-' + (d.getUTCMonth() + 1)
    const mm = meses[k] || (meses[k] = { saldoFin: 0, dias: [] })
    mm.saldoFin = run
    if (m.abono > 0) mm.dias.push(d.getUTCDate())
  }
  const ml = Object.values(meses)
  const mesesConDeuda = ml.filter(m => m.saldoFin > rentaRef * 0.1).length
  const dias = ml.flatMap(m => m.dias)
  const diaMedio = dias.length ? Math.round(dias.reduce((a, b) => a + b, 0) / dias.length) : null
  let perfil
  if (run > rentaRef * 1.5) perfil = 'grave'
  else if (mesesConDeuda >= 4) perfil = 'cronico'
  else if (mesesConDeuda >= 1 || (diaMedio != null && diaMedio >= 12)) perfil = 'apretado'
  else perfil = 'puntual'
  return { perfil, meses_con_deuda: mesesConDeuda, dia_medio: diaMedio, saldo_actual: Math.round(run) }
}

async function asegurarCaso(idadmon, contrato, email) {
  const { data: ab } = await admin.from('cobranza_casos').select('id').eq('idadmon', idadmon).eq('tipo', 'vigente').neq('estado', 'cerrado').limit(1)
  if (ab && ab[0]) return ab[0].id
  const { data: nuevo, error } = await admin.from('cobranza_casos').insert({
    idadmon, tipo: 'vigente', estado: 'mora_leve', monto_adeudado: 0, dias_mora: 0,
    propietario: contrato.propietario || null, propiedad: contrato.inmueble || null,
    arrendatario: contrato.arrendatario || null, arrendatario_rut: contrato.rut || null,
    responsable: email, origen: 'auto_mora',
  }).select('id').single()
  if (error) throw new Error('No se pudo crear el caso: ' + error.message)
  return nuevo.id
}

// trae TODAS las filas de `cuentas` de los idadmon dados (paginado). PostgREST corta a 1000 filas y con
// muchos morosos truncaba -> el saldo acumulado y el perfil salían mal (p.ej. A00308: 3.351 en vez de 95.372).
async function cuentasDe(ids) {
  const out = []; const page = 1000
  for (let from = 0; from < 300000; from += page) {
    const { data, error } = await admin.from('cuentas')
      .select('idadmon, fecha, concepto, cargo, cargo_manual, abono, calif, anulado')
      .in('idadmon', ids).order('id', { ascending: true }).range(from, from + page - 1)
    if (error || !data || !data.length) break
    out.push(...data)
    if (data.length < page) break
  }
  return out
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
  const mesLbl = MESES[Number(periodo.slice(2)) - 1] + ' 20' + periodo.slice(0, 2)

  const { data: liq, error: eLiq } = await admin.rpc('calcular_liquidacion', { p_mes: periodo })
  if (eLiq) return Response.json({ error: 'calcular_liquidacion: ' + eLiq.message }, { status: 500 })
  const porId = {}
  for (const r of (liq || [])) {
    const g = porId[r.idadmon] || (porId[r.idadmon] = { idadmon: r.idadmon, propietario: r.propietario || '', inmueble: '', base: 0, recibido: 0, falta: 0 })
    if (!String(r.inmueble || '').startsWith('[proporcional')) g.inmueble = r.inmueble || g.inmueble
    g.base += n0(r.base); g.recibido += n0(r.recibido_banco); g.falta += n0(r.falta)
  }
  const cand = Object.values(porId).filter(g => g.recibido > TOL_PAGO && g.falta > TOL_DIF)
  const ids = cand.map(g => g.idadmon)
  const plantilla = plantillaSuave()
  if (!ids.length) return Response.json({ ok: true, periodo, mes_lbl: mesLbl, hoy: isoUTC(hoy.t), filas: [], plantilla, resumen: { total: 0, suma_dif: 0, suma_acum: 0, con_reajuste: 0 } })

  const [arrRes, servRes, estRes, ctasAll] = await Promise.all([
    admin.from('datos_arriendos').select('idadmon, arrendatario, rut, mail_arrendatario, movil, avalista, mail_avalista, inmueble, propietario, quien_cobra, fecha_reajuste1, fecha_reajuste2, fecha_reajuste3, fecha_reajuste4, fecha_reajuste5, fecha_reajuste6').in('idadmon', ids),
    admin.from('ggcc_agua_luz').select('idadmon, deuda_gastos_comunes, deuda_vigente_electricidad, deuda_vigente_agua, deuda_vigente_gas').like('mes', isoMes(hoy.y, hoy.mo) + '%').in('idadmon', ids),
    admin.from('cobranza_diferencias').select('*').eq('periodo', periodo).in('idadmon', ids),
    cuentasDe(ids),
  ])
  const arrMap = {}; for (const a of (arrRes.data || [])) arrMap[a.idadmon] = a
  const ctasMap = {}; for (const c of ctasAll) (ctasMap[c.idadmon] || (ctasMap[c.idadmon] = [])).push(c)
  const servMap = {}; for (const r of (servRes.data || [])) { servMap[r.idadmon] = (servMap[r.idadmon] || 0) + n0(r.deuda_gastos_comunes) + n0(r.deuda_vigente_electricidad) + n0(r.deuda_vigente_agua) + n0(r.deuda_vigente_gas) }
  const estMap = {}; for (const e of (estRes.data || [])) estMap[e.idadmon] = e

  const filas = []
  for (const g of cand) {
    const a = arrMap[g.idadmon] || {}
    if (String(a.quien_cobra || '').toUpperCase() === 'DUEÑO') continue
    const noAnul = (ctasMap[g.idadmon] || []).filter(c => !c.anulado)
    const saldoAcum = noAnul.reduce((s, c) => s + cargoEf(c) - n0(c.abono), 0)
    const uReaj = ultimoReajuste(a, hoy.t)
    const perf = perfilDesdeCuentas(noAnul)
    const est = estMap[g.idadmon] || null
    filas.push({
      idadmon: g.idadmon, arrendatario: a.arrendatario || '', mail_arrendatario: a.mail_arrendatario || '',
      movil: a.movil || '', aval: a.avalista || '', propiedad: g.inmueble || a.inmueble || '', propietario: g.propietario || a.propietario || '',
      base: Math.round(g.base), recibido: Math.round(g.recibido), diferencia: Math.round(g.falta),
      pct_pagado: g.base > 0 ? Math.round((g.recibido / g.base) * 100) : 0,
      saldo_acumulado: Math.round(saldoAcum),
      reajuste_reciente: uReaj != null && (hoy.t - uReaj) <= 150 * 86400000, fecha_reajuste: uReaj ? isoUTC(uReaj) : null,
      perfil: perf.perfil, perfil_metrics: { meses_con_deuda: perf.meses_con_deuda, dia_medio: perf.dia_medio, saldo_actual: perf.saldo_actual },
      deuda_servicios: Math.round(servMap[g.idadmon] || 0),
      estado: est?.estado || 'pendiente', nota: est?.nota || null, fecha_estado: est?.fecha_estado || null,
    })
  }
  filas.sort((x, y) => (y.diferencia - x.diferencia))
  const resumen = {
    total: filas.length,
    suma_dif: filas.reduce((s, f) => s + f.diferencia, 0),
    suma_acum: filas.reduce((s, f) => s + Math.max(0, f.saldo_acumulado), 0),
    con_reajuste: filas.filter(f => f.reajuste_reciente).length,
    enviados: filas.filter(f => f.estado === 'enviado').length,
  }
  return Response.json({ ok: true, periodo, mes_lbl: mesLbl, hoy: isoUTC(hoy.t), filas, plantilla, resumen })
}

function plantillaSuave() {
  return {
    asunto: 'Diferencia pendiente del arriendo de {{mes}} — {{propiedad}}',
    cuerpo: 'Estimado/a {{arrendatario}}:\n\nGracias por su pago del arriendo de {{propiedad}} correspondiente a {{mes}}. Al revisar la cuenta hemos detectado una pequeña diferencia: el monto que correspondía era {{a_cobrar}} y se recibió {{recibido}}, por lo que queda pendiente {{diferencia}}.\n\n{{reajuste}}Le agradeceríamos regularizar esta diferencia de {{diferencia}} hoy o mañana, indicando en el concepto del pago: «{{idadmon}} diferencia arriendo {{mes}}». Es una cantidad pequeña, pero preferimos avisarle a tiempo para que su cuenta quede al día y no se acumule.\n\nSi ya realizó el pago o cree que hay un error, respóndanos a este correo y lo revisamos enseguida.\n\nUn cordial saludo,\nFondo Capital · Cobranzas',
  }
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  const rol = session?.user?.role
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!PUEDEN_VER.includes(rol)) return Response.json({ error: 'No autorizado' }, { status: 403 })

  let body; try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const accion = String(body.accion || '').trim()
  const idadmon = String(body.idadmon || '').trim().toUpperCase()
  const periodo = String(body.periodo || '').trim()
  if (!idadmon || !/^\d{4}$/.test(periodo)) return Response.json({ error: 'Falta idadmon o periodo.' }, { status: 400 })

  // marcar estado (pospuesto / investigar / pendiente)
  if (accion === 'estado') {
    const estado = String(body.estado || '').trim()
    if (!['pendiente', 'pospuesto', 'investigar'].includes(estado)) return Response.json({ error: 'Estado inválido' }, { status: 400 })
    const { error } = await admin.from('cobranza_diferencias')
      .upsert({ idadmon, periodo, estado, nota: body.nota || null, diferencia: body.diferencia || null, usuario: email, fecha_estado: new Date().toISOString() }, { onConflict: 'idadmon,periodo' })
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true, estado })
  }

  // enviar el email suave + registrar constancia + estado=enviado
  if (accion === 'enviar') {
    const asunto = String(body.asunto || '').trim()
    const contenido = String(body.contenido || '').trim()
    const destino = String(body.destino_email || '').trim()
    const test = body.test === true
    if (!asunto || !contenido) return Response.json({ error: 'Falta asunto o contenido.' }, { status: 400 })
    if (!test && !destino) return Response.json({ error: 'No hay email del arrendatario; edítalo antes de enviar.' }, { status: 400 })

    const remit = DEPT.cobranza
    const html = textoAHtml(contenido)
    try {
      if (test) {
        await transporter.sendMail({ from: remit.from, replyTo: remit.replyTo, to: email, subject: '[PRUEBA] ' + asunto, html })
        return Response.json({ ok: true, test: true })
      }
      const ccList = parseCC(body.cc)
      const info = await transporter.sendMail({ from: remit.from, replyTo: remit.replyTo, to: destino, cc: ccList.length ? ccList : undefined, bcc: [BCC_ARCHIVO, ADMIN_COPIA], subject: asunto, html })
      if (!info || info.rejected?.length) return Response.json({ error: 'Gmail no aceptó el destinatario (' + (info?.response || 's/r') + ')' }, { status: 502 })

      const { data: arr } = await admin.from('datos_arriendos').select('idadmon, arrendatario, rut, inmueble, propietario').eq('idadmon', idadmon).limit(1)
      const contrato = (arr && arr[0]) || {}
      const caso_id = await asegurarCaso(idadmon, contrato, email)
      const { data: gestion } = await admin.from('cobranza_gestiones').insert({
        caso_id, idadmon, canal: 'email', departamento: 'cobranza', remitente: remit.replyTo,
        destinatario: 'arrendatario', destino_email: destino, destinatario_rut: contrato.rut || null, destinatario_nombre: contrato.arrendatario || null,
        etapa: 'diferencia_saldo', asunto, contenido_snapshot: contenido, acuse: info?.messageId || 'ok', resultado: 'enviado',
        monto_reclamado: body.diferencia || null, usuario: email,
      }).select('id').single()
      const { error: eEst } = await admin.from('cobranza_diferencias')
        .upsert({ idadmon, periodo, estado: 'enviado', diferencia: body.diferencia || null, gestion_id: gestion?.id || null, usuario: email, fecha_estado: new Date().toISOString() }, { onConflict: 'idadmon,periodo' })
      if (eEst) return Response.json({ error: 'estado: ' + eEst.message }, { status: 500 })
      return Response.json({ ok: true, estado: 'enviado' })
    } catch (e) { return Response.json({ error: String(e.message || e) }, { status: 500 }) }
  }

  return Response.json({ error: 'Acción no reconocida' }, { status: 400 })
}
