import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// --- helpers ---
const num = (v) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d.-]/g, '')) || 0)
const RE_IDADMON = /^A\d{5}$/                                  // IDADMON puro: A + 5 digitos
const esIdadmonValido = (uc) => RE_IDADMON.test(String(uc ?? '').trim())

// timestamp "dd/mm/aaaa HH:MM" en hora de Chile (equivale al Now() del VBA, para JUSTIFICANTES)
function ahoraCL() {
  const partes = new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date())
  const g = (t) => partes.find((p) => p.type === t)?.value || ''
  return `${g('day')}/${g('month')}/${g('year')} ${g('hour')}:${g('minute')}`
}

export async function POST() {
  // 1) leer de bi TODAS las filas marcadas FALTA
  const { data: faltan, error: e1 } = await supabaseAdmin
    .from('bi')
    .select('id, fecha, detalle_movimiento, cargos, abonos, reg, unique_concept')
    .eq('check2_pasar_a_cartola', 'FALTA')
    .order('id', { ascending: true })

  if (e1) return NextResponse.json({ error: 'Error leyendo bi: ' + e1.message }, { status: 500 })
  if (!faltan || faltan.length === 0)
    return NextResponse.json({ ok: true, copiados: 0, invalidos: [], mensaje: 'No hay movimientos en FALTA.' })

  // 2) separar validas (unique_concept = A+5 digitos) de invalidas
  const validas = faltan.filter((r) => esIdadmonValido(r.unique_concept))
  const invalidas = faltan.filter((r) => !esIdadmonValido(r.unique_concept))

  // lista de invalidas para la advertencia (se quedan en FALTA, NO se tocan)
  const detalleInvalidos = invalidas.map((r) => ({
    reg: r.reg, fecha: r.fecha, unique_concept: r.unique_concept,
    detalle: r.detalle_movimiento,
  }))

  if (validas.length === 0) {
    return NextResponse.json({
      ok: true,
      copiados: 0,
      invalidos: detalleInvalidos,
      mensaje: 'Ninguna fila en FALTA tiene un IDADMON valido (A + 5 digitos).',
    })
  }

  // 3) lookup a datos_arriendos por idadmon -> { estado, propietario, inmueble }
  const ids = [...new Set(validas.map((r) => String(r.unique_concept).trim()))]
  const mapa = {}
  if (ids.length) {
    const { data: da, error: e2 } = await supabaseAdmin
      .from('datos_arriendos')
      .select('idadmon, estado, propietario, inmueble')
      .in('idadmon', ids)
      .order('id', { ascending: true })
    if (e2) return NextResponse.json({ error: 'Error leyendo datos_arriendos: ' + e2.message }, { status: 500 })
    for (const d of da || []) if (!mapa[d.idadmon]) mapa[d.idadmon] = d
  }

  // 4) armar las filas de cuentas (solo las validas), guardando su reg para el dedupe
  const ts = ahoraCL()
  const sinMatch = new Set()
  const preparadas = validas.map((r) => {
    const idadmon = String(r.unique_concept).trim()
    const info = mapa[idadmon] || null
    if (!info) sinMatch.add(idadmon)
    const reg = r.reg != null && String(r.reg).trim() !== '' ? String(r.reg).trim() : null
    return {
      biId: r.id,
      reg,
      fila: {
        fecha: r.fecha,
        idadmon,
        concepto: r.detalle_movimiento,
        cargo: num(r.cargos),
        abono: num(r.abonos),
        saldo: null,
        comentarios: 'BI',
        calif: reg,
        justificantes: ts,
        estado: info?.estado ?? null,
        propietario: info?.propietario ?? null,
        inmueble: info?.inmueble ?? null,
        updated_at: new Date().toISOString(),
      },
    }
  })

  // 4b) DEDUPE: comprobar qué reg ya están en cuentas (columna calif) para NO duplicar
  const regs = [...new Set(preparadas.map((p) => p.reg).filter(Boolean))]
  const yaEnCuentas = new Set()
  if (regs.length) {
    const { data: exist, error: eDup } = await supabaseAdmin
      .from('cuentas')
      .select('calif')
      .in('calif', regs)
    if (eDup) return NextResponse.json({ error: 'Error comprobando duplicados en cuentas: ' + eDup.message }, { status: 500 })
    for (const x of exist || []) {
      const c = String(x.calif ?? '').trim()
      if (c) yaEnCuentas.add(c)
    }
  }

  const nuevas   = preparadas.filter((p) => !(p.reg && yaEnCuentas.has(p.reg)))
  const omitidas = preparadas.filter((p) =>   p.reg && yaEnCuentas.has(p.reg))
  const detalleOmitidos = omitidas.map((p) => ({ reg: p.reg, idadmon: p.fila.idadmon }))

  // 5) insertar en cuentas SOLO las nuevas (las omitidas ya estaban: no se duplican)
  let copiados = 0
  if (nuevas.length) {
    const { error: e3, count } = await supabaseAdmin
      .from('cuentas')
      .insert(nuevas.map((p) => p.fila), { count: 'exact' })
    if (e3) return NextResponse.json({ error: 'Error insertando en cuentas: ' + e3.message }, { status: 500 })
    copiados = count ?? nuevas.length
  }

  // 6) marcar PASADO todas las validas procesadas: las nuevas (ya insertadas) y
  //    las omitidas (que ya estaban en cuentas), para que no vuelvan a intentar colarse.
  const idsValidas = preparadas.map((p) => p.biId)
  const { error: e4 } = await supabaseAdmin
    .from('bi')
    .update({ check2_pasar_a_cartola: 'PASADO', updated_at: new Date().toISOString() })
    .in('id', idsValidas)

  if (e4) {
    return NextResponse.json({
      error: 'Se copiaron ' + copiados + ' a cuentas, pero fallo el marcado PASADO: ' + e4.message +
             '. NO reintentar sin revisar (riesgo de duplicar).',
      copiados,
    }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    copiados,
    omitidos_ya_existian: detalleOmitidos,   // mismo reg ya en cuentas: NO se duplicaron
    invalidos: detalleInvalidos,             // sin IDADMON valido: se quedan en FALTA
    idadmons_sin_match: [...sinMatch],
  })
}