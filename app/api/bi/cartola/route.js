import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// --- helpers ---
const RUT = /(\d{6,9}-[\dkK])/
const num = (v) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d.-]/g, '')) || 0)
const iTxt = (n) => String(Math.round(num(n)))           // importe -> texto entero (como en bi)
const REG_BASE = 22714                                    // último reg numerado conocido

function extraerRut(d) { const m = RUT.exec(String(d || '')); return m ? m[1].toUpperCase() : null }
function aammDe(f) { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(f || '')); return m ? m[3].slice(2) + m[2] : null }

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
  let guardados = 0, registro = null, check1_roturas = []
  if (guardar && nuevos.length > 0) {
    // saldo de la fila más reciente ya existente (ancla del check1)
    const { data: ult } = await supabaseAdmin.from('bi').select('saldos').order('id', { ascending: false }).limit(1)
    let prev = (ult && ult[0]) ? num(ult[0].saldos) : null
    const ahora = new Date().toISOString()

    const filas = nuevos.map(m => {
      const s = sugerir(m)
      let c1 = 0
      if (prev != null) c1 = Math.round(prev - m.cargo + m.abono - m.saldo)
      if (c1 !== 0) check1_roturas.push({ ndoc: m.ndoc, check1: c1 })
      prev = m.saldo
      return {
        fecha: m.fecha, detalle_movimiento: m.detalle, n_doc: String(m.ndoc),
        cargos: iTxt(m.cargo), abonos: iTxt(m.abono), saldos: iTxt(m.saldo),
        check1: String(c1), check2_pasar_a_cartola: 'FALTA', reg: null,
        unique_concept: s.sug, idadmon2: s.sug, comentarios: s.nota || null,
        mes: aammDe(m.fecha), updated_at: ahora,
      }
    })

    const { error: e3, count } = await supabaseAdmin.from('bi').insert(filas, { count: 'exact' })
    if (e3) return NextResponse.json({ error: 'Error guardando en bi: ' + e3.message, integridad, resumen }, { status: 500 })
    guardados = count ?? filas.length

    // 5) numerar TODOS los reg=null (los 6 pendientes + los recién insertados), por id asc, continuando la serie
    const { data: recientes } = await supabaseAdmin.from('bi').select('reg').not('reg', 'is', null).neq('reg', '').order('id', { ascending: false }).limit(120)
    let maxReg = REG_BASE
    for (const r of recientes || []) { const n = parseInt(String(r.reg).split('-')[0], 10); if (!isNaN(n)) maxReg = Math.max(maxReg, n) }
    const { data: pend } = await supabaseAdmin.from('bi').select('id').is('reg', null).order('id', { ascending: true })
    let nx = maxReg, desde = null, hasta = null
    for (const row of pend || []) { nx += 1; const { error: eu } = await supabaseAdmin.from('bi').update({ reg: String(nx) }).eq('id', row.id); if (eu) return NextResponse.json({ error: 'Error numerando reg: ' + eu.message }, { status: 500 }); if (desde === null) desde = nx; hasta = nx }
    registro = (desde != null) ? { desde, hasta } : null
  }

  return NextResponse.json({ ok: true, guardado: guardar, guardados, registro, check1_roturas, integridad, resumen, movimientos: preview })
}
