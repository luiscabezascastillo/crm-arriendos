// app/api/liquidaciones/complementaria/route.js
// VERSION: v1 · 2026-08-10 · Detección + registro de LIQUIDACIONES COMPLEMENTARIAS.
//   Un IDADMON dejado EN ESPERA (moroso, en liquidacion_retenidos) genera una complementaria cuando entra su pago:
//   se detecta que en `bi` hay abonos para ese IDADMON imputados a un mes POSTERIOR al de la espera (LIQ. MES2) que
//   cubren la renta (>= renta − 50.000). La detección NO mueve nada: solo marca "cobrado". Un humano confirma con POST
//   {accion:'generar'} → snapshot de los importes debidos (de calcular_liquidacion del mes de espera) en
//   liquidacion_complementaria, con el mes_cobro = LIQ. MES2 del abono. De ahí cuelgan TRANSFER/CARTAS/EMAILS/FACTURAS.
//
//   GET  ?mes_cobro=AAMM (opcional)  -> { ok, umbral, candidatos:[...] }
//        candidato: { idadmon, mes_espera, idprop, propietario, inmueble, renta, comision, iva, neto,
//                     recibido, mes_cobro, cobrado, estado, complementaria|null }
//   POST { idadmon, mes_espera, accion:'generar'|'anular', mes_cobro?, motivo?, forzar? }
//   Solo Alberto, Luis, Karina.

import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

const EMAILS_OK = [
  'alberto.cabezas@fondocapital.com',
  'luis.cabezas@fondocapital.com',
  'karina.morales@fondocapital.com',
]
const UMBRAL = 50000   // desvíos de pago menores a esto se consideran cubiertos (mismo criterio que CARTAS)

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
}
// bi.abonos viene como TEXTO ("550.020"): se limpia a número.
const num = v => { const n = Number(String(v ?? '').replace(/[^\d.-]/g, '')); return isNaN(n) ? 0 : n }
// Extrae el IDADMON (Axxxxx) de un texto libre de UNIQUE CONCEPT.
const extraIdadmon = s => { const m = String(s ?? '').match(/A\d{5}/); return m ? m[0] : '' }

function autorizado(session) {
  const email = session?.user?.email
  const rol = session?.user?.role
  return !!email && (rol === 'admin' || EMAILS_OK.includes(email))
}

// Núcleo de detección: para cada moroso EN ESPERA, ¿ya entró su pago (abonos en bi imputados a un mes posterior)?
// Devuelve un array de candidatos con los importes debidos (snapshot del mes de espera) y el flag `cobrado`.
async function detectar(sb) {
  // 1) Morosos actualmente en espera
  const { data: ret, error: eRet } = await sb.from('liquidacion_retenidos')
    .select('idadmon, mes, creado_at').eq('retenido', true).is('liberado_at', null)
  if (eRet) throw new Error('retenidos: ' + eRet.message)
  const morosos = ret || []
  if (!morosos.length) return []
  const mesEsperaDe = {}; for (const m of morosos) mesEsperaDe[m.idadmon] = String(m.mes)
  const idset = new Set(morosos.map(m => m.idadmon))

  // 2) Complementarias ya registradas (para saber cuáles ya se generaron)
  const { data: compl } = await sb.from('liquidacion_complementaria').select('*')
  const complByKey = {}; for (const c of compl || []) complByKey[c.idadmon + '|' + c.mes_espera] = c

  // 3) Importes debidos: calcular_liquidacion de cada mes de espera distinto
  const meses = [...new Set(morosos.map(m => String(m.mes)))]
  const renta = {}
  for (const mes of meses) {
    const { data: liq, error: eLiq } = await sb.rpc('calcular_liquidacion', { p_mes: mes })
    if (eLiq) throw new Error('calcular_liquidacion(' + mes + '): ' + eLiq.message)
    for (const r of liq || []) renta[r.idadmon] = {
      idprop: r.idprop, propietario: r.propietario, inmueble: r.inmueble,
      renta: Math.round(num(r.base)), comision: Math.round(num(r.comision)),
      iva: Math.round(num(r.iva_comision)), neto: Math.round(num(r.neto_transferir)),
    }
  }

  // 4) Abonos en bi para esos IDADMON, imputados a un mes POSTERIOR al de la espera (LIQ. MES2 > mes_espera)
  const { data: bi, error: eBi } = await sb.from('bi').select('idadmon2, unique_concept, abonos, fecha, liquidacion_mes2')
  if (eBi) throw new Error('bi: ' + eBi.message)
  const abo = {}
  for (const b of bi || []) {
    const id = (b.idadmon2 && String(b.idadmon2).trim()) || extraIdadmon(b.unique_concept)
    if (!id || !idset.has(id)) continue
    const ab = num(b.abonos); if (ab <= 0) continue
    const lm = String(b.liquidacion_mes2 || '').trim()
    if (!lm || lm <= mesEsperaDe[id]) continue   // solo pagos imputados a un mes posterior al de la espera
    const a = abo[id] || (abo[id] = { recibido: 0, meses: new Set(), ultima: null })
    a.recibido += ab; a.meses.add(lm)
    if (!a.ultima || String(b.fecha) > String(a.ultima)) a.ultima = b.fecha
  }

  // 5) Candidatos
  return morosos.map(m => {
    const r = renta[m.idadmon] || {}
    const a = abo[m.idadmon] || { recibido: 0, meses: new Set(), ultima: null }
    const cobrado = a.recibido > 0 && a.recibido >= (r.renta || 0) - UMBRAL
    const mes_cobro = a.meses.size ? [...a.meses].sort().slice(-1)[0] : null   // el LIQ. MES2 más reciente
    const c = complByKey[m.idadmon + '|' + String(m.mes)] || null
    return {
      idadmon: m.idadmon, mes_espera: String(m.mes),
      idprop: r.idprop || null, propietario: r.propietario || null, inmueble: r.inmueble || null,
      renta: r.renta ?? null, comision: r.comision ?? null, iva: r.iva ?? null, neto: r.neto ?? null,
      recibido: a.recibido, ultima_fecha: a.ultima, mes_cobro, cobrado,
      complementaria: c ? { id: c.id, estado: c.estado, mes_cobro: c.mes_cobro } : null,
      estado: c ? c.estado : (cobrado ? 'cobrado' : 'pendiente_cobro'),
    }
  })
}

export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!autorizado(session)) return Response.json({ error: 'Solo Direccion y Karina.' }, { status: 403 })
  try {
    const sb = svc()
    let candidatos = await detectar(sb)
    // Filtro opcional por mes de cobro (para las vistas de un mes concreto)
    const url = new URL(req.url)
    const mesCobro = (url.searchParams.get('mes_cobro') || '').trim()
    if (mesCobro) candidatos = candidatos.filter(c => c.mes_cobro === mesCobro || c.complementaria?.mes_cobro === mesCobro)
    return Response.json({ ok: true, umbral: UMBRAL, candidatos })
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 500 })
  }
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!autorizado(session)) return Response.json({ error: 'Solo Direccion y Karina.' }, { status: 403 })

  let body = {}
  try { body = await req.json() } catch {}
  const idadmon = String(body.idadmon || '').trim().toUpperCase()
  const mes_espera = String(body.mes_espera || '').trim()
  const accion = String(body.accion || 'generar').trim()
  if (!/^A\d{5}$/.test(idadmon)) return Response.json({ error: 'IDADMON invalido.' }, { status: 400 })
  if (!/^\d{4}$/.test(mes_espera)) return Response.json({ error: 'mes_espera invalido (AAMM).' }, { status: 400 })

  const sb = svc()
  const nowIso = new Date().toISOString()

  try {
    if (accion === 'anular') {
      const { data, error } = await sb.from('liquidacion_complementaria')
        .update({ estado: 'anulada', motivo: String(body.motivo || '').trim() || null, actualizado_por: email, actualizado_at: nowIso })
        .eq('idadmon', idadmon).eq('mes_espera', mes_espera).select().maybeSingle()
      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json({ ok: true, row: data })
    }

    // accion 'generar': verifica que esté cobrado (salvo forzar) y hace snapshot de los importes debidos.
    const candidatos = await detectar(sb)
    const cand = candidatos.find(c => c.idadmon === idadmon && c.mes_espera === mes_espera)
    if (!cand) return Response.json({ error: 'Ese IDADMON no figura en espera para ese mes.' }, { status: 404 })
    if (!cand.cobrado && !body.forzar) {
      return Response.json({ error: 'Aun no consta el cobro (abono que cubra la renta). Usa forzar:true para registrarla igualmente.', candidato: cand }, { status: 409 })
    }
    const mes_cobro = String(body.mes_cobro || cand.mes_cobro || '').trim() || null

    const fila = {
      idadmon, idprop: cand.idprop, mes_espera, mes_cobro,
      neto: cand.neto, comision: cand.comision, iva: cand.iva,
      abono_monto: Math.round(cand.recibido) || null,
      estado: 'pendiente',
      actualizado_por: email, actualizado_at: nowIso,
    }
    // Upsert por (idadmon, mes_espera). Si es nueva, marca creado_por.
    const { data: prev } = await sb.from('liquidacion_complementaria')
      .select('id').eq('idadmon', idadmon).eq('mes_espera', mes_espera).maybeSingle()
    let row
    if (!prev) {
      const { data, error } = await sb.from('liquidacion_complementaria')
        .insert({ ...fila, creado_por: email }).select().single()
      if (error) return Response.json({ error: error.message }, { status: 500 })
      row = data
    } else {
      const { data, error } = await sb.from('liquidacion_complementaria')
        .update(fila).eq('id', prev.id).select().single()
      if (error) return Response.json({ error: error.message }, { status: 500 })
      row = data
    }
    return Response.json({ ok: true, row })
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 500 })
  }
}
