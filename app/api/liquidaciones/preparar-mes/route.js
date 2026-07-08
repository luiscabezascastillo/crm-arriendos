// app/api/liquidaciones/preparar-mes/route.js
// Prepara/regenera el congelado de un mes en liquidacion_idadmon (lineas) y
// liquidacion_idprop (cabecera por propietario), desde la RPC calcular_liquidacion.
// Solo Alberto, Luis, Karina. Idempotente.
//
// OPCION A (segura): separa INSERT de UPDATE.
//   - Filas NUEVAS  -> INSERT completo.
//   - Filas EXISTENTES (no cerradas) -> UPDATE SOLO de numeros/identidad/servicios.
//     NUNCA toca los campos editados a mano:
//       liquidacion_idadmon: nota_linea, observaciones, comentario_admin, falta_al_cierre, pagado, ajustes, cantidad
//       liquidacion_idprop : facturar, folio, fecha_emision, comentario, transferido, transfer_validado, enviada_at
//   - Filas cerradas (cerrado=true) -> se OMITEN por completo.
//
// POST { mes } -> { ok, mes, lineas:{insert,update}, propietarios:{insert,update}, cerradas_omitidas }

import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

const PREPARAR_EMAILS = [
  'alberto.cabezas@fondocapital.com',
  'luis.cabezas@fondocapital.com',
  'karina.morales@fondocapital.com',
]

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )
}

function numOf(v) {
  if (v == null) return 0
  const s = String(v).trim()
  if (!s) return 0
  const limpio = s.replace(/\./g, '').replace(/,/g, '.').replace(/[^0-9.\-]/g, '')
  const n = Number(limpio)
  return Number.isFinite(n) ? Math.round(n) : 0
}

function primerInmue(idlinmue) {
  if (!idlinmue) return null
  return String(idlinmue).trim().split(/\s+/)[0] || null
}

// yymm ('2607') -> primer dia del mes en ISO date '2026-07-01'
function primerDiaMes(mes) {
  const yy = mes.slice(0, 2)
  const mm = mes.slice(2, 4)
  return `20${yy}-${mm}-01`
}

// Ajuste del mes: busca entre los 6 pares fecha/cantidad de reajuste el que
// cae EXACTAMENTE el primer dia del mes procesado. Devuelve {monto, tipo}.
// (Regla validada 17/17 en notificaciones: solo el incremento que entra ESTE mes.)
function ajusteDelMes(a, dia1) {
  for (let i = 1; i <= 6; i++) {
    const f = a['fecha_reajuste' + i]
    if (f && String(f).slice(0, 10) === dia1) {
      const monto = Number(a['cantidad_reajuste' + i]) || 0
      return { monto, tipo: monto > 0 ? (a.revision || '') : '' }
    }
  }
  return { monto: 0, tipo: '' }
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  const rol = session?.user?.role
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!(rol === 'admin' || PREPARAR_EMAILS.includes(email))) {
    return Response.json({ error: 'Solo Direccion y Karina pueden preparar el mes.' }, { status: 403 })
  }

  let body = {}
  try { body = await req.json() } catch {}
  const mes = String(body.mes || '').trim()
  if (!/^\d{4}$/.test(mes)) return Response.json({ error: 'Mes invalido (AAMM).' }, { status: 400 })

  const sb = svc()

  // ── 1) Motor ──────────────────────────────────────────────────────────────
  const { data: liq, error: eLiq } = await sb.rpc('calcular_liquidacion', { p_mes: mes })
  if (eLiq) return Response.json({ error: 'RPC: ' + eLiq.message }, { status: 500 })
  const rows = (liq || []).filter(r => !String(r.inmueble || '').startsWith('[proporcional'))
  if (rows.length === 0) return Response.json({ ok: true, mes, lineas: { insert: 0, update: 0 }, propietarios: { insert: 0, update: 0 }, aviso: 'La RPC no devolvio filas.' })

  const idadmons = [...new Set(rows.map(r => r.idadmon))]
  const idprops = [...new Set(rows.map(r => r.idprop))]

  // ── 2) Auxiliares + estado actual de las tablas destino ────────────────────
  const [rArr, rProps, rInm, rServ, rExistA, rExistP] = await Promise.all([
    sb.from('datos_arriendos')
      .select('idadmon, estado, idprop, propietario, inmueble, idlinmue, comuna, fecha_inicio, termino_actual, arrendatario, rut, unid, cuota, uf_peso_factor, quien_cobra, especial_a, revision, fecha_reajuste1, cantidad_reajuste1, fecha_reajuste2, cantidad_reajuste2, fecha_reajuste3, cantidad_reajuste3, fecha_reajuste4, cantidad_reajuste4, fecha_reajuste5, cantidad_reajuste5, fecha_reajuste6, cantidad_reajuste6')
      .in('idadmon', idadmons),
    sb.from('propietarios')
      .select('idprop, propietario, nombre, tipo_factura')
      .in('idprop', idprops),
    sb.from('inmuebles').select('idinmue_combinado, raw_data'),
    sb.from('ggcc_agua_luz')
      .select('idadmon, aamm, deuda_gastos_comunes, fecha_hecho_ggcc, deuda_vigente_electricidad, fecha_hecho_luz, deuda_vigente_agua, fecha_hecho_agua, deuda_vigente_gas, fecha_hecho_gas')
      .in('idadmon', idadmons),
    sb.from('liquidacion_idadmon').select('idadmon, cerrado').eq('mes', mes),
    sb.from('liquidacion_idprop').select('idprop, cerrado').eq('mes', mes),
  ])

  const arrDe = {}; for (const d of rArr.data || []) arrDe[d.idadmon] = d
  const propDe = {}; for (const p of rProps.data || []) propDe[p.idprop] = p

  const rolDe = {}
  for (const im of rInm.data || []) {
    const r = im.raw_data && (im.raw_data.ROL || im.raw_data.rol)
    if (r) rolDe[im.idinmue_combinado] = r
  }

  const servDe = {}
  for (const s of rServ.data || []) {
    const a = String(s.aamm || '').trim()
    if (!/^\d{4}$/.test(a) || a > mes) continue
    const prev = servDe[s.idadmon]
    if (!prev || a > prev.aamm) servDe[s.idadmon] = { ...s, aamm: a }
  }

  const estadoLineaA = {}
  for (const x of rExistA.data || []) estadoLineaA[x.idadmon] = { existe: true, cerrado: !!x.cerrado }
  const estadoCabP = {}
  for (const x of rExistP.data || []) estadoCabP[x.idprop] = { existe: true, cerrado: !!x.cerrado }

  const nowIso = new Date().toISOString()
  const dia1 = primerDiaMes(mes)   // primer dia del mes procesado, para el ajuste

  // ── 3) LINEAS: separar INSERT / UPDATE / OMITIR ───────────────────────────
  const lineasInsert = []
  const lineasUpdate = []
  const totalesPorProp = {}
  let omitidasLineas = 0

  for (const r of rows) {
    const a = arrDe[r.idadmon] || {}
    const p = propDe[r.idprop] || {}
    const rolInmue = rolDe[primerInmue(a.idlinmue)] || null
    const sv = servDe[r.idadmon] || null

    const a_cobrar = numOf(r.base)
    const comision = numOf(r.comision)
    const iva = numOf(r.iva_comision)
    const descuentos = numOf(r.total_descuentos)
    const neto = numOf(r.neto_transferir)
    const recibido = numOf(r.recibido_banco)

    const t = totalesPorProp[r.idprop] || { a_cobrar: 0, recibido: 0, comision: 0, iva: 0, descuentos: 0, neto: 0 }
    t.a_cobrar += a_cobrar; t.recibido += recibido; t.comision += comision
    t.iva += iva; t.descuentos += descuentos; t.neto += neto
    totalesPorProp[r.idprop] = t

    const est = estadoLineaA[r.idadmon]
    if (est && est.cerrado) { omitidasLineas++; continue }

    const aj = ajusteDelMes(a, dia1)   // {monto, tipo} del ajuste que entra este mes

    const campos = {
      estado: (a.estado || '').toUpperCase(),
      idprop: r.idprop,
      propietario: r.propietario || a.propietario || p.propietario || '',
      inmueble: r.inmueble || a.inmueble || '',
      idlinmue: a.idlinmue || '',
      rol: rolInmue,
      comuna: a.comuna || '',
      fecha_inicio: a.fecha_inicio || null,
      fecha_fin: a.termino_actual || null,
      arrendatario: a.arrendatario || '',
      rut_arrendatario: a.rut || '',
      a_cobrar, recibido,
      quien_cobra: a.quien_cobra || '',
      comision, iva, descuentos,
      ajustes: aj.monto,
      tipo_ajuste: aj.tipo,
      neto_transferir: neto,
      unid: (a.unid || '').toUpperCase(),
      cuota_uf: (String(a.unid || '').toUpperCase() === 'UF') ? numOf(a.cuota) : null,
      valor_uf: numOf(a.uf_peso_factor) || null,
      especial: a.especial_a || '',
      ggcc: sv ? numOf(sv.deuda_gastos_comunes) : null,
      ggcc_fecha: sv ? (sv.fecha_hecho_ggcc || '') : '',
      luz: sv ? numOf(sv.deuda_vigente_electricidad) : null,
      luz_fecha: sv ? (sv.fecha_hecho_luz || '') : '',
      agua: sv ? numOf(sv.deuda_vigente_agua) : null,
      agua_fecha: sv ? (sv.fecha_hecho_agua || '') : '',
      gas: sv ? numOf(sv.deuda_vigente_gas) : null,
      gas_fecha: sv ? (sv.fecha_hecho_gas || '') : '',
      servicios_aamm: sv ? sv.aamm : '',
      updated_at: nowIso,
    }

    if (est && est.existe) {
      lineasUpdate.push({ idadmon: r.idadmon, patch: campos })
    } else {
      lineasInsert.push({ mes, idadmon: r.idadmon, ...campos, cantidad: null })
    }
  }

  if (lineasInsert.length) {
    const { error } = await sb.from('liquidacion_idadmon').insert(lineasInsert)
    if (error) return Response.json({ error: 'insert lineas: ' + error.message }, { status: 500 })
  }
  for (const u of lineasUpdate) {
    const { error } = await sb.from('liquidacion_idadmon').update(u.patch).eq('mes', mes).eq('idadmon', u.idadmon)
    if (error) return Response.json({ error: 'update linea ' + u.idadmon + ': ' + error.message }, { status: 500 })
  }

  // ── 4) CABECERA por propietario: INSERT / UPDATE / OMITIR ─────────────────
  const cabInsert = []
  const cabUpdate = []
  let omitidasProps = 0

  for (const idprop of Object.keys(totalesPorProp)) {
    const est = estadoCabP[idprop]
    if (est && est.cerrado) { omitidasProps++; continue }
    const t = totalesPorProp[idprop]
    const p = propDe[idprop] || {}

    const campos = {
      nombre: p.nombre || p.propietario || '',
      total_a_cobrar: t.a_cobrar,
      total_recibido: t.recibido,
      total_comision: t.comision,
      total_iva: t.iva,
      total_descuentos: t.descuentos,
      total_a_transferir: t.neto,
      tipo_factura: (p.tipo_factura || '').toString().trim(),
      preparado_por: email,
      preparado_at: nowIso,
      updated_at: nowIso,
    }

    if (est && est.existe) {
      cabUpdate.push({ idprop, patch: campos })
    } else {
      cabInsert.push({ mes, idprop, ...campos })
    }
  }

  if (cabInsert.length) {
    const { error } = await sb.from('liquidacion_idprop').insert(cabInsert)
    if (error) return Response.json({ error: 'insert cabecera: ' + error.message }, { status: 500 })
  }
  for (const u of cabUpdate) {
    const { error } = await sb.from('liquidacion_idprop').update(u.patch).eq('mes', mes).eq('idprop', u.idprop)
    if (error) return Response.json({ error: 'update cabecera ' + u.idprop + ': ' + error.message }, { status: 500 })
  }

  return Response.json({
    ok: true,
    mes,
    lineas: { insert: lineasInsert.length, update: lineasUpdate.length },
    propietarios: { insert: cabInsert.length, update: cabUpdate.length },
    cerradas_omitidas: { lineas: omitidasLineas, propietarios: omitidasProps },
  })
}
