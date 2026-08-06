// VERSION: v4 · 2026-08-06 · PASO A CUENTAS AUTOMÁTICO al cargar la cartola. Los abonos que quedan
//   identificados sin ambigüedad (unique_concept = A##### por match único en bi_admon) se vuelcan
//   solos a `cuentas` (mismo mapeo y dedup por calif=reg que /api/bi/copiar-cuentas) y quedan PASADO,
//   sin el clic extra de "Copiar FALTA a CUENTAS". Solo quedan en FALTA los NO identificados y los
//   AMBIGUOS (varios candidatos) → para el ➕RUT. Seguro: todo entra como FALTA y solo pasa a PASADO
//   si el volcado a cuentas fue bien; si algo falla, quedan en FALTA recuperables con el botón.
// VERSION: v3 · 2026-08-06 · Al guardar la cartola se SELLA liquidacion_mes2 (mes de liquidación AAMM,
//   corte día ≥23 → mes siguiente). Antes solo se ponía `mes` (mes natural) y liquidacion_mes2 quedaba
//   en null, de modo que la RPC calcular_liquidacion (que empareja los abonos por liquidacion_mes2 = p_mes)
//   no los contaba como recibidos y salían en FALTAN aunque el pago estuviera. Queda editable en BI·movimientos.
// VERSION: v2 · 2026-07-21 · El check2 'FALTA' se pone solo en los ABONOS. Antes se marcaba todo,
//   y los cargos se quedaban en FALTA para siempre (nunca pasan a cuentas), ensuciando la lista.
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// --- helpers ---
const RUT = /(\d{6,9}-[\dkK])/
const num = (v) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d.-]/g, '')) || 0)
const iTxt = (n) => String(Math.round(num(n)))           // importe -> texto entero (como en bi)
const REG_BASE = 22714                                    // último reg numerado conocido
const RE_IDADMON = /^A\d{5}$/                             // IDADMON puro: A + 5 dígitos
const esIdadmonValido = (uc) => RE_IDADMON.test(String(uc ?? '').trim())

function extraerRut(d) { const m = RUT.exec(String(d || '')); return m ? m[1].toUpperCase() : null }
function aammDe(f) { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(f || '')); return m ? m[3].slice(2) + m[2] : null }

// Mes de liquidación (AAMM) al que pertenece el pago: corte día ≥23 → mes siguiente.
// Mismo criterio que mesEnCurso() en la vista FALTAN y que la RPC calcular_liquidacion.
// Se sella como valor por defecto al subir; sigue siendo editable en BI·movimientos.
function liqMes2De(f) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(f || ''))
  if (!m) return null
  let dd = parseInt(m[1], 10), mm = parseInt(m[2], 10), yy = parseInt(m[3], 10)
  if (dd >= 23) { mm += 1; if (mm > 12) { mm = 1; yy += 1 } }
  return String(yy).slice(2) + String(mm).padStart(2, '0')
}

// timestamp "dd/mm/aaaa HH:MM" en hora de Chile (igual que copiar-cuentas, para JUSTIFICANTES)
function ahoraCL() {
  const partes = new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date())
  const g = (t) => partes.find((p) => p.type === t)?.value || ''
  return `${g('day')}/${g('month')}/${g('year')} ${g('hour')}:${g('minute')}`
}

export async function POST(req) {
  let body
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const movimientos = Array.isArray(body?.movimientos) ? body.movimientos : null
  const guardar = !!body?.guardar
  if (!movimientos || movimientos.length === 0)
    return NextResponse.json({ error: 'No se recibieron movimientos. Revisa el archivo.' }, { status: 400 })

  // normalizar; la cartola viene reciente-arriba (desc) -> invertir a ascendente (cronológico)
  const asc = movimientos
    .map(m => ({
      fecha: String(m.fecha || '').trim(),
      detalle: String(m.detalle || '').trim(),
      ndoc: Math.trunc(num(m.ndoc)),
      cargo: num(m.cargo), abono: num(m.abono), saldo: num(m.saldo),
    }))
    .filter(m => m.fecha)
    .reverse()

  if (asc.length === 0) return NextResponse.json({ error: 'Ninguna fila válida en el archivo.' }, { status: 400 })

  // 1) integridad por cadena de saldos sobre lo subido
  const roturasArchivo = []
  for (let i = 1; i < asc.length; i++) {
    const esp = asc[i - 1].saldo + asc[i].abono - asc[i].cargo
    if (Math.round(esp) !== Math.round(asc[i].saldo)) roturasArchivo.push({ ndoc: asc[i].ndoc, saldo: asc[i].saldo, esperado: Math.round(esp) })
  }
  const integridad = { intacta: roturasArchivo.length === 0, roturas: roturasArchivo }

  // 2) dedup por (n_doc + saldos) contra bi
  const ndocs = [...new Set(asc.map(m => String(m.ndoc)))]
  const { data: exist, error: e1 } = await supabaseAdmin.from('bi').select('n_doc, saldos').in('n_doc', ndocs)
  if (e1) return NextResponse.json({ error: 'Error consultando bi: ' + e1.message }, { status: 500 })
  const claves = new Set((exist || []).map(r => `${String(r.n_doc).trim()}|${iTxt(r.saldos)}`))
  const nuevos = asc.filter(m => !claves.has(`${m.ndoc}|${iTxt(m.saldo)}`))
  const duplicados = asc.length - nuevos.length

  // 3) sugerencia IDADMON para abonos nuevos (desde bi_admon)
  const ruts = [...new Set(nuevos.map(m => extraerRut(m.detalle)).filter(Boolean))]
  let mapa = {}
  if (ruts.length) {
    const { data: ad, error: e2 } = await supabaseAdmin
      .from('bi_admon').select('rut, idadmon, ambiguo, idadmon_cands, nota').in('rut', ruts).eq('activo', true)
    if (e2) return NextResponse.json({ error: 'Error consultando bi_admon: ' + e2.message }, { status: 500 })
    for (const a of ad || []) {
      const acc = mapa[a.rut] || { ids: new Set(), ambiguo: false, nota: null }
      if (a.idadmon) acc.ids.add(a.idadmon)
      if (a.idadmon_cands) String(a.idadmon_cands).split('|').filter(Boolean).forEach(c => acc.ids.add(c))
      if (a.ambiguo) acc.ambiguo = true
      if (a.nota && !acc.nota) acc.nota = a.nota
      mapa[a.rut] = acc
    }
  }
  const sugerir = (m) => {
    const tipo = m.abono > 0 ? 'abono' : 'cargo'
    const rut = extraerRut(m.detalle)
    let sug = null, ambiguo = false, cands = null, nota = null
    if (tipo === 'abono' && rut) {
      const a = mapa[rut]
      if (!a || a.ids.size === 0) nota = 'RUT no está en bi_admon — revisar/añadir'
      else { const ids = [...a.ids].sort(); if (ids.length === 1 && !a.ambiguo) sug = ids[0]; else { sug = ids[0]; ambiguo = true; cands = ids.join('|'); nota = a.nota || 'Varios candidatos' } }
    }
    return { tipo, rut, sug, ambiguo, cands, nota }
  }

  const preview = nuevos.map(m => { const s = sugerir(m); return {
    fecha: m.fecha, detalle: m.detalle, ndoc: m.ndoc, cargo: m.cargo, abono: m.abono, saldo: m.saldo,
    rut: s.rut, idadmon_sugerido: s.sug, unique_concept: s.sug, ambiguo: s.ambiguo, candidatos: s.cands, tipo: s.tipo, nota: s.nota,
  }})

  const resumen = {
    recibidos: asc.length, nuevos: nuevos.length, duplicados,
    abonos: preview.filter(p => p.tipo === 'abono').length,
    cargos: preview.filter(p => p.tipo === 'cargo').length,
    sugeridos: preview.filter(p => p.idadmon_sugerido && !p.ambiguo).length,
    ambiguos: preview.filter(p => p.ambiguo).length,
    sin_match: preview.filter(p => p.tipo === 'abono' && !p.idadmon_sugerido).length,
  }

  // 4) GUARDAR en bi
  let guardados = 0, registro = null, check1_roturas = [], auto_copiados = 0
  if (guardar && nuevos.length > 0) {
    // saldo de la fila más reciente ya existente (ancla del check1)
    const { data: ult } = await supabaseAdmin.from('bi').select('saldos').order('id', { ascending: false }).limit(1)
    let prev = (ult && ult[0]) ? num(ult[0].saldos) : null
    const ahora = new Date().toISOString()

    // metaFilas queda alineado por índice con `nuevos`/`filas`: guarda abono/sug/ambiguo para
    // decidir luego qué abonos se auto-pasan (identificado único) y cuáles se quedan en FALTA.
    const metaFilas = []
    const filas = nuevos.map(m => {
      const s = sugerir(m)
      metaFilas.push({ ndoc: m.ndoc, saldo: m.saldo, abono: m.abono, sug: s.sug, ambiguo: s.ambiguo })
      let c1 = 0
      if (prev != null) c1 = Math.round(prev - m.cargo + m.abono - m.saldo)
      if (c1 !== 0) check1_roturas.push({ ndoc: m.ndoc, check1: c1 })
      prev = m.saldo
      return {
        fecha: m.fecha, detalle_movimiento: m.detalle, n_doc: String(m.ndoc),
        cargos: iTxt(m.cargo), abonos: iTxt(m.abono), saldos: iTxt(m.saldo),
        check1: String(c1),
        // Todo abono entra como FALTA; el auto-paso (paso 6) mueve a PASADO solo los identificados
        // sin ambigüedad. Así, si el volcado a cuentas fallara, quedan en FALTA recuperables.
        check2_pasar_a_cartola: m.abono > 0 ? 'FALTA' : null, reg: null,
        unique_concept: s.sug, idadmon2: s.sug, comentarios: s.nota || null,
        mes: aammDe(m.fecha),
        // Mes de liquidación al que pertenece el pago (corte día ≥23). Sin esto la RPC
        // calcular_liquidacion no lo cuenta como recibido y sale en FALTAN. Editable después.
        liquidacion_mes2: liqMes2De(m.fecha),
        updated_at: ahora,
      }
    })

    const { data: insertadas, error: e3 } = await supabaseAdmin.from('bi').insert(filas).select('id, n_doc, saldos')
    if (e3) return NextResponse.json({ error: 'Error guardando en bi: ' + e3.message, integridad, resumen }, { status: 500 })
    guardados = (insertadas || []).length

    // 5) numerar TODOS los reg=null (los 6 pendientes + los recién insertados), por id asc, continuando la serie
    const { data: recientes } = await supabaseAdmin.from('bi').select('reg').not('reg', 'is', null).neq('reg', '').order('id', { ascending: false }).limit(120)
    let maxReg = REG_BASE
    for (const r of recientes || []) { const n = parseInt(String(r.reg).split('-')[0], 10); if (!isNaN(n)) maxReg = Math.max(maxReg, n) }
    const { data: pend } = await supabaseAdmin.from('bi').select('id').is('reg', null).order('id', { ascending: true })
    let nx = maxReg, desde = null, hasta = null
    for (const row of pend || []) { nx += 1; const { error: eu } = await supabaseAdmin.from('bi').update({ reg: String(nx) }).eq('id', row.id); if (eu) return NextResponse.json({ error: 'Error numerando reg: ' + eu.message }, { status: 500 }); if (desde === null) desde = nx; hasta = nx }
    registro = (desde != null) ? { desde, hasta } : null

    // 6) AUTO-PASO A CUENTAS de los abonos de ESTA carga identificados y NO ambiguos.
    //    Mismo mapeo y dedup por calif=reg que /api/bi/copiar-cuentas → idempotente.
    //    Los ambiguos y los sin identificar se quedan en FALTA (no se tocan aquí).
    try {
      // id de cada fila insertada, mapeado por (n_doc|saldos) para no depender del orden del insert
      const idByKey = {}
      for (const r of insertadas || []) idByKey[`${String(r.n_doc).trim()}|${iTxt(r.saldos)}`] = r.id
      const autoIds = []
      metaFilas.forEach(mt => {
        if (mt.abono > 0 && mt.sug && !mt.ambiguo && esIdadmonValido(mt.sug)) {
          const id = idByKey[`${mt.ndoc}|${iTxt(mt.saldo)}`]
          if (id) autoIds.push(id)
        }
      })

      if (autoIds.length) {
        // releer esas filas ya con su reg asignado
        const { data: rows } = await supabaseAdmin.from('bi')
          .select('id, fecha, detalle_movimiento, cargos, abonos, reg, unique_concept')
          .in('id', autoIds)
        const validas = (rows || []).filter(r => esIdadmonValido(r.unique_concept) && r.reg != null && String(r.reg).trim() !== '')

        if (validas.length) {
          // lookup datos_arriendos por idadmon
          const idsDA = [...new Set(validas.map(r => String(r.unique_concept).trim()))]
          const daMap = {}
          const { data: da } = await supabaseAdmin.from('datos_arriendos')
            .select('idadmon, estado, propietario, inmueble').in('idadmon', idsDA)
          for (const d of da || []) if (!daMap[d.idadmon]) daMap[d.idadmon] = d

          const tsCL = ahoraCL()
          const prep = validas.map(r => {
            const idadmon = String(r.unique_concept).trim()
            const info = daMap[idadmon] || null
            const reg = String(r.reg).trim()
            return { biId: r.id, reg, fila: {
              fecha: r.fecha, idadmon, concepto: r.detalle_movimiento,
              cargo: num(r.cargos), abono: num(r.abonos), saldo: null,
              comentarios: 'BI', calif: reg, justificantes: tsCL,
              estado: info?.estado ?? null, propietario: info?.propietario ?? null,
              inmueble: info?.inmueble ?? null, updated_at: new Date().toISOString(),
            } }
          })

          // dedup por calif=reg (no duplicar si ya está en cuentas)
          const regs = [...new Set(prep.map(p => p.reg).filter(Boolean))]
          const existentes = {}
          if (regs.length) {
            const { data: exC } = await supabaseAdmin.from('cuentas').select('calif').in('calif', regs)
            for (const x of exC || []) { const c = String(x.calif ?? '').trim(); if (c) existentes[c] = true }
          }
          const nuevasC = prep.filter(p => !existentes[p.reg])
          if (nuevasC.length) {
            const { count } = await supabaseAdmin.from('cuentas').insert(nuevasC.map(p => p.fila), { count: 'exact' })
            auto_copiados = count ?? nuevasC.length
          }
          // marcar PASADO las procesadas (nuevas + las que ya estaban por su reg)
          const pasIds = prep.map(p => p.biId)
          if (pasIds.length) await supabaseAdmin.from('bi').update({ check2_pasar_a_cartola: 'PASADO', updated_at: new Date().toISOString() }).in('id', pasIds)
        }
      }
    } catch (eAuto) {
      // Si el auto-paso falla, las filas se quedan en FALTA (recuperables con "Copiar FALTA a CUENTAS").
      // No rompemos la carga: el guardado en bi ya está hecho.
    }
  }

  return NextResponse.json({ ok: true, guardado: guardar, guardados, registro, auto_copiados, check1_roturas, integridad, resumen, movimientos: preview })
}