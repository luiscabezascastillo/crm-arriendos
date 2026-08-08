// VERSION: v7 · 2026-08-07 · AUTO-CLASIFICAR TRANSFERENCIAS A PROPIETARIOS. Al cargar la cartola, todo CARGO cuyo
//   detalle contenga un idprop "P###" (P + 3 dígitos, p. ej. P105) se marca solo con unique_concept='PROPIETARIOS'
//   (así lo cuenta la RPC transferido_propietario sin tener que etiquetarlo a mano). idadmon2 queda null. Hereda v6.
// VERSION: v6 · 2026-08-06 · El match por datos_arriendos.rut TAMBIÉN auto-pasa a cuentas desde el 1er
//   pago (el RUT recibido es el del arrendatario del contrato, fiable), igual que bi_admon. Los ambiguos
//   (varios contratos con ese RUT) siguen en FALTA para el +RUT.
// VERSION: v5 · 2026-08-06 · LOCALIZAR ARRENDATARIOS NUEVOS. sugerir() hace un 2º intento: si el RUT
//   no está en bi_admon, lo cruza con datos_arriendos.rut (contratos activos S/SQ/P). Un único contrato
//   → se SUGIERE el IDADMON (nota "arrendatario nuevo, confirmar +RUT") pero queda en FALTA (no auto-pasa;
//   Karina lo confirma una vez con +RUT y entra en bi_admon → el mes siguiente ya auto). Varios → ambiguo.
//   Solo los match de bi_admon (curados) auto-pasan a cuentas. RUT normalizado en ambos lados.
//   [Para que el match por datos_arriendos también auto-pase desde el 1er pago: en el paso 6 cambiar
//    la condición `mt.fuente === 'bi_admon'` por `(mt.fuente === 'bi_admon' || mt.fuente === 'datos')`.]
// VERSION: v4 · 2026-08-06 · PASO A CUENTAS AUTOMÁTICO al cargar la cartola. Los abonos identificados sin
//   ambigüedad (unique_concept = A##### por match único en bi_admon) se vuelcan solos a `cuentas` (mismo
//   mapeo y dedup por calif=reg que /api/bi/copiar-cuentas) y quedan PASADO. Solo quedan en FALTA los NO
//   identificados y los AMBIGUOS. Seguro: entran como FALTA y pasan a PASADO solo si el volcado fue bien.
// VERSION: v3 · 2026-08-06 · Al guardar la cartola se SELLA liquidacion_mes2 (corte día ≥23 → mes siguiente),
//   necesario para que la RPC calcular_liquidacion cuente los abonos y no salgan en FALTAN. Editable después.
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
// Normaliza un RUT a dígitos + DV sin puntuación ni guion ("27.156.820-7" y "27156820-7" -> "271568207").
const normR = (s) => String(s ?? '').toUpperCase().replace(/[^0-9K]/g, '')

function extraerRut(d) { const m = RUT.exec(String(d || '')); return m ? m[1].toUpperCase() : null }
function aammDe(f) { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(f || '')); return m ? m[3].slice(2) + m[2] : null }

// Mes de liquidación (AAMM): corte día ≥23 → mes siguiente. Mismo criterio que la vista FALTAN y la RPC.
function liqMes2De(f) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(f || ''))
  if (!m) return null
  let dd = parseInt(m[1], 10), mm = parseInt(m[2], 10), yy = parseInt(m[3], 10)
  if (dd >= 23) { mm += 1; if (mm > 12) { mm = 1; yy += 1 } }
  return String(yy).slice(2) + String(mm).padStart(2, '0')
}

// timestamp "dd/mm/aaaa HH:MM" hora de Chile (igual que copiar-cuentas, para JUSTIFICANTES)
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

  // 1) integridad por cadena de saldos
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

  // 3) sugerencia IDADMON para abonos nuevos: 1º bi_admon (curado), 2º datos_arriendos.rut (arrendatario nuevo)
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

  // Fallback: RUT del arrendatario en datos_arriendos (contratos vivos). normR(rut) -> [idadmon...]
  const mapaDA = {}
  {
    const { data: daAct, error: eDA } = await supabaseAdmin
      .from('datos_arriendos').select('idadmon, rut, estado').in('estado', ['S', 'SQ', 'P'])
    if (eDA) return NextResponse.json({ error: 'Error consultando datos_arriendos: ' + eDA.message }, { status: 500 })
    for (const d of daAct || []) {
      const k = normR(d.rut)
      if (!k || !esIdadmonValido(d.idadmon)) continue
      if (!mapaDA[k]) mapaDA[k] = []
      if (!mapaDA[k].includes(d.idadmon)) mapaDA[k].push(d.idadmon)
    }
  }

  // Un CARGO con un idprop "P###" en el detalle es una transferencia a propietario.
  const idpropEnDetalle = (detalle) => { const mm = String(detalle || '').match(/\bP\d{3}\b/i); return mm ? mm[0].toUpperCase() : null }

  const sugerir = (m) => {
    const tipo = m.abono > 0 ? 'abono' : 'cargo'
    const rut = extraerRut(m.detalle)
    let sug = null, ambiguo = false, cands = null, nota = null, fuente = null
    // Cargo con P### → transferencia a propietario: unique_concept = PROPIETARIOS (sin idadmon2).
    if (tipo === 'cargo') {
      const idp = idpropEnDetalle(m.detalle)
      if (idp) return { tipo, rut, sug: null, ambiguo: false, cands: null, nota: `Transferencia a propietario ${idp} — auto`, fuente: 'propietario', uniqueConcept: 'PROPIETARIOS' }
    }
    if (tipo === 'abono' && rut) {
      const a = mapa[rut]
      if (a && a.ids.size > 0) {
        const ids = [...a.ids].sort()
        fuente = 'bi_admon'
        if (ids.length === 1 && !a.ambiguo) sug = ids[0]
        else { sug = ids[0]; ambiguo = true; cands = ids.join('|'); nota = a.nota || 'Varios candidatos' }
      } else {
        // 2º intento: arrendatario nuevo aún no en bi_admon → cruzar con datos_arriendos
        const daIds = mapaDA[normR(rut)] || []
        if (daIds.length === 1) { sug = daIds[0]; fuente = 'datos'; nota = 'Arrendatario nuevo (' + daIds[0] + ') — identificado por RUT del contrato' }
        else if (daIds.length > 1) { sug = daIds[0]; ambiguo = true; cands = daIds.join('|'); fuente = 'datos'; nota = 'Arrendatario nuevo, varios contratos — confirmar' }
        else nota = 'RUT no está en bi_admon — revisar/añadir'
      }
    }
    return { tipo, rut, sug, ambiguo, cands, nota, fuente, uniqueConcept: sug }
  }

  const preview = nuevos.map(m => { const s = sugerir(m); return {
    fecha: m.fecha, detalle: m.detalle, ndoc: m.ndoc, cargo: m.cargo, abono: m.abono, saldo: m.saldo,
    rut: s.rut, idadmon_sugerido: s.sug, unique_concept: s.uniqueConcept, ambiguo: s.ambiguo, candidatos: s.cands,
    tipo: s.tipo, nota: s.nota, fuente: s.fuente,
  }})

  const resumen = {
    recibidos: asc.length, nuevos: nuevos.length, duplicados,
    abonos: preview.filter(p => p.tipo === 'abono').length,
    cargos: preview.filter(p => p.tipo === 'cargo').length,
    propietarios: preview.filter(p => p.unique_concept === 'PROPIETARIOS').length,
    sugeridos: preview.filter(p => p.idadmon_sugerido && !p.ambiguo).length,
    ambiguos: preview.filter(p => p.ambiguo).length,
    sin_match: preview.filter(p => p.tipo === 'abono' && !p.idadmon_sugerido).length,
    arrendatarios_nuevos: preview.filter(p => p.fuente === 'datos' && !p.ambiguo).length,
  }

  // 4) GUARDAR en bi
  let guardados = 0, registro = null, check1_roturas = [], auto_copiados = 0
  if (guardar && nuevos.length > 0) {
    const { data: ult } = await supabaseAdmin.from('bi').select('saldos').order('id', { ascending: false }).limit(1)
    let prev = (ult && ult[0]) ? num(ult[0].saldos) : null
    const ahora = new Date().toISOString()

    // metaFilas alineado con nuevos/filas: abono/sug/ambiguo/fuente para decidir el auto-paso.
    const metaFilas = []
    const filas = nuevos.map(m => {
      const s = sugerir(m)
      metaFilas.push({ ndoc: m.ndoc, saldo: m.saldo, abono: m.abono, sug: s.sug, ambiguo: s.ambiguo, fuente: s.fuente })
      let c1 = 0
      if (prev != null) c1 = Math.round(prev - m.cargo + m.abono - m.saldo)
      if (c1 !== 0) check1_roturas.push({ ndoc: m.ndoc, check1: c1 })
      prev = m.saldo
      return {
        fecha: m.fecha, detalle_movimiento: m.detalle, n_doc: String(m.ndoc),
        cargos: iTxt(m.cargo), abonos: iTxt(m.abono), saldos: iTxt(m.saldo),
        check1: String(c1),
        check2_pasar_a_cartola: m.abono > 0 ? 'FALTA' : null, reg: null,
        unique_concept: s.uniqueConcept, idadmon2: s.sug, comentarios: s.nota || null,
        mes: aammDe(m.fecha),
        liquidacion_mes2: liqMes2De(m.fecha),
        updated_at: ahora,
      }
    })

    const { data: insertadas, error: e3 } = await supabaseAdmin.from('bi').insert(filas).select('id, n_doc, saldos')
    if (e3) return NextResponse.json({ error: 'Error guardando en bi: ' + e3.message, integridad, resumen }, { status: 500 })
    guardados = (insertadas || []).length

    // 5) numerar reg=null por id asc, continuando la serie
    const { data: recientes } = await supabaseAdmin.from('bi').select('reg').not('reg', 'is', null).neq('reg', '').order('id', { ascending: false }).limit(120)
    let maxReg = REG_BASE
    for (const r of recientes || []) { const n = parseInt(String(r.reg).split('-')[0], 10); if (!isNaN(n)) maxReg = Math.max(maxReg, n) }
    const { data: pend } = await supabaseAdmin.from('bi').select('id').is('reg', null).order('id', { ascending: true })
    let nx = maxReg, desde = null, hasta = null
    for (const row of pend || []) { nx += 1; const { error: eu } = await supabaseAdmin.from('bi').update({ reg: String(nx) }).eq('id', row.id); if (eu) return NextResponse.json({ error: 'Error numerando reg: ' + eu.message }, { status: 500 }); if (desde === null) desde = nx; hasta = nx }
    registro = (desde != null) ? { desde, hasta } : null

    // 6) AUTO-PASO A CUENTAS de los abonos identificados y NO ambiguos, tanto por bi_admon (curado)
    //    como por datos_arriendos.rut (arrendatario nuevo; el RUT del pago es el del contrato).
    //    Los AMBIGUOS (varios contratos con ese RUT) NO auto-pasan: se quedan en FALTA para +RUT.
    try {
      const idByKey = {}
      for (const r of insertadas || []) idByKey[`${String(r.n_doc).trim()}|${iTxt(r.saldos)}`] = r.id
      const autoIds = []
      metaFilas.forEach(mt => {
        if (mt.abono > 0 && mt.sug && !mt.ambiguo && (mt.fuente === 'bi_admon' || mt.fuente === 'datos') && esIdadmonValido(mt.sug)) {
          const id = idByKey[`${mt.ndoc}|${iTxt(mt.saldo)}`]
          if (id) autoIds.push(id)
        }
      })

      if (autoIds.length) {
        const { data: rows } = await supabaseAdmin.from('bi')
          .select('id, fecha, detalle_movimiento, cargos, abonos, reg, unique_concept')
          .in('id', autoIds)
        const validas = (rows || []).filter(r => esIdadmonValido(r.unique_concept) && r.reg != null && String(r.reg).trim() !== '')

        if (validas.length) {
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
          const pasIds = prep.map(p => p.biId)
          if (pasIds.length) await supabaseAdmin.from('bi').update({ check2_pasar_a_cartola: 'PASADO', updated_at: new Date().toISOString() }).in('id', pasIds)
        }
      }
    } catch (eAuto) {
      // Si el auto-paso falla, las filas se quedan en FALTA (recuperables con "Copiar FALTA a CUENTAS").
    }
  }

  return NextResponse.json({ ok: true, guardado: guardar, guardados, registro, auto_copiados, check1_roturas, integridad, resumen, movimientos: preview })
}