// VERSION: v1 · 2026-08-07 · Saldo de término SIN SALDO → descuento al propietario, MANUAL desde Cartas.
//   GET  ?mes=AAMM  → lista de saldos de término por idadmon (pendiente/cargado) para pintar el botón por línea.
//   POST { idadmon, mes, accion:'crear'|'quitar' } → crea o anula el descuento PROPIETARIO por el déficit
//     (= -resultado de vw_termino_resultado) sobre el idadmon activo (idadmon_relacionado del término).
//   Idempotente por término. Escribe en descuentos_bitacora. Reflejo en Términos vía idadmon_relacionado.
//   Solo Karina + Dirección.
// app/api/liquidaciones/saldo-termino/route.js

import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

const OK_EMAILS = [
  'alberto.cabezas@fondocapital.com',
  'luis.cabezas@fondocapital.com',
  'karina.morales@fondocapital.com',
]
function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
}
const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
const ANULADO = '----MES'
const TEXTO = 'Saldo no soportado por la garantía en el término. Se está reclamando al ex-arrendatario y si se recupera se abonará en la/s próxima/s liquidación/es.'

function autorizado(session) {
  const email = session?.user?.email
  return { email, ok: !!email && (OK_EMAILS.includes(email) || session?.user?.role === 'admin') }
}

// término -> idadmon_relacionado (contrato activo del dueño), desde los descuentos T- del término
async function relacionadoDe(sb, terminoIds) {
  const map = {}
  if (!terminoIds.length) return map
  const { data } = await sb.from('descuentos').select('idadmon, idadmon_relacionado').in('idadmon', terminoIds).like('repercutir_a', 'T-%')
  for (const d of data || []) {
    const t = String(d.idadmon || '').trim(); const r = String(d.idadmon_relacionado || '').trim()
    if (t && r && !map[t]) map[t] = r
  }
  return map
}

export async function GET() {
  const session = await getServerSession(authOptions)
  const { ok } = autorizado(session)
  if (!ok) return Response.json({ error: 'Solo Dirección y Karina.' }, { status: 403 })
  const sb = svc()

  const { data: negs } = await sb.from('vw_termino_resultado').select('idadmon, resultado').lt('resultado', 0)
  const terms = (negs || []).map(r => ({ t: String(r.idadmon || '').trim(), deficit: Math.round(-Number(r.resultado || 0)) })).filter(x => x.t && x.deficit > 0)
  const rel = await relacionadoDe(sb, terms.map(x => x.t))

  const { data: cargos } = await sb.from('descuentos').select('num, idadmon_relacionado, mes_a_imputar').eq('origen', 'termino_sin_saldo')
  const cargoDe = {}   // término -> { num, anulado }
  for (const c of cargos || []) { const t = String(c.idadmon_relacionado || '').trim(); if (t) cargoDe[t] = { num: c.num, anulado: String(c.mes_a_imputar || '') === ANULADO } }

  const saldos = terms.map(({ t, deficit }) => {
    const R = rel[t] || null
    const cg = cargoDe[t]
    return { termino: t, idadmon: R, deficit, estado: !cg ? 'pendiente' : (cg.anulado ? 'quitado' : 'cargado'), descuento_num: cg ? cg.num : null, sin_relacionado: !R }
  })
  return Response.json({ ok: true, saldos })
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const { email, ok } = autorizado(session)
  if (!ok) return Response.json({ error: 'Solo Dirección y Karina.' }, { status: 403 })

  let body = {}
  try { body = await req.json() } catch {}
  const idadmon = String(body.idadmon || '').trim()   // contrato ACTIVO donde se carga (idadmon_relacionado)
  const mes = String(body.mes || '').trim()
  const accion = String(body.accion || '').trim()
  if (!idadmon) return Response.json({ error: 'Falta idadmon' }, { status: 400 })
  if (!/^\d{4}$/.test(mes)) return Response.json({ error: 'Mes inválido (AAMM)' }, { status: 400 })
  if (!['crear', 'quitar'].includes(accion)) return Response.json({ error: 'Acción inválida' }, { status: 400 })

  const sb = svc()
  const nowIso = new Date().toISOString()

  // ── QUITAR: anula los descuentos termino_sin_saldo ACTIVOS de este idadmon ──
  if (accion === 'quitar') {
    const { data: acts } = await sb.from('descuentos').select('id, num, mes_a_imputar').eq('idadmon', idadmon).eq('origen', 'termino_sin_saldo').neq('mes_a_imputar', ANULADO)
    let quitados = 0
    for (const d of acts || []) {
      const { error } = await sb.from('descuentos').update({ mes_a_imputar: ANULADO, modificado_por: email, modificado_at: nowIso }).eq('id', d.id)
      if (!error) {
        quitados++
        try { await sb.from('descuentos_bitacora').insert({ descuento_id: d.id, num: d.num, accion: 'anular', campo: 'mes_a_imputar', valor_anterior: d.mes_a_imputar, valor_nuevo: ANULADO, usuario: email }) } catch {}
      }
    }
    return Response.json({ ok: true, quitados })
  }

  // ── CREAR: términos con idadmon_relacionado = idadmon, resultado<0, sin cargo previo ──
  const { data: negs } = await sb.from('vw_termino_resultado').select('idadmon, resultado').lt('resultado', 0)
  const terms = (negs || []).map(r => ({ t: String(r.idadmon || '').trim(), deficit: Math.round(-Number(r.resultado || 0)) })).filter(x => x.t && x.deficit > 0)
  const rel = await relacionadoDe(sb, terms.map(x => x.t))
  const mios = terms.filter(x => rel[x.t] === idadmon)
  if (!mios.length) return Response.json({ ok: true, creados: 0, aviso: 'Sin saldo de término pendiente para este idadmon.' })

  // anti-duplicado: términos que YA tienen cargo (activo o anulado) → no re-crear
  const { data: ya } = await sb.from('descuentos').select('idadmon_relacionado').eq('origen', 'termino_sin_saldo').in('idadmon_relacionado', mios.map(x => x.t))
  const yaSet = new Set((ya || []).map(d => String(d.idadmon_relacionado || '').trim()))

  const { data: da } = await sb.from('datos_arriendos').select('propietario, inmueble').eq('idadmon', idadmon).maybeSingle()
  const { data: maxRow } = await sb.from('descuentos').select('num').order('id', { ascending: false }).limit(300)
  let maxNum = 0; (maxRow || []).forEach(r => { const x = parseInt(r.num, 10); if (Number.isFinite(x) && x > maxNum) maxNum = x })

  const _yy = mes.slice(0, 2), _mm = mes.slice(2, 4)
  const mesTxt = `${MESES[parseInt(_mm, 10) - 1]} 20${_yy}`
  const mmdd = `${_yy}${_mm}`
  const fechaContable = `${_mm}/07/20${_yy}`
  const hoy = new Date()
  const fechaHoy = `${String(hoy.getDate()).padStart(2, '0')}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()}`

  const creados = []
  for (const { t, deficit } of mios) {
    if (yaSet.has(t)) continue
    maxNum += 1
    const num = String(maxNum)
    const fila = {
      num, fecha: fechaHoy, mes_a_imputar: mesTxt, ingresado_por: 'SISTEMA',
      idadmon, idadmon_relacionado: t,
      inmueble: da?.inmueble || '', propietario: da?.propietario || '',
      repercutir_a: 'PROPIETARIO', monto_a_imputar: String(deficit), tipo: 'TERMINO',
      texto_explicativo_para_carta_a_propietario: TEXTO,
      texto_para_contabilidad: `${num} ${idadmon} TERMINO PROPIETARIO ${TEXTO}`,
      mmdd, fecha_contable: fechaContable,
      creado_por: email, creado_at: nowIso, verificado: false, origen: 'termino_sin_saldo',
    }
    const { data: ins, error } = await sb.from('descuentos').insert(fila).select().single()
    if (error) return Response.json({ error: 'crear descuento: ' + error.message }, { status: 500 })
    creados.push({ num: ins.num, termino: t, monto: deficit })
    try { await sb.from('descuentos_bitacora').insert({ descuento_id: ins.id, num: ins.num, accion: 'crear', campo: null, valor_anterior: null, valor_nuevo: String(deficit), usuario: email }) } catch {}
  }
  return Response.json({ ok: true, creados: creados.length, detalle: creados })
}
