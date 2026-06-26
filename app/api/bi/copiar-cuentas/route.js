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

  // 4) armar las filas de cuentas (solo las validas)
  const ts = ahoraCL()
  const sinMatch = new Set()
  const filas = validas.map((r) => {
    const idadmon = String(r.unique_concept).trim()
    const info = mapa[idadmon] || null
    if (!info) sinMatch.add(idadmon)
    return {
      fecha: r.fecha,
      idadmon: idadmon,
      concepto: r.detalle_movimiento,
      cargo: num(r.cargos),
      abono: num(r.abonos),
      saldo: null,
      comentarios: 'BI',
      calif: r.reg != null && String(r.reg) !== '' ? String(r.reg) : null,
      justificantes: ts,
      estado: info?.estado ?? null,
      propietario: info?.propietario ?? null,
      inmueble: info?.inmueble ?? null,
      updated_at: new Date().toISOString(),
    }
  })

  // 5) insertar en cuentas
  const { error: e3, count } = await supabaseAdmin
    .from('cuentas')
    .insert(filas, { count: 'exact' })
  if (e3) return NextResponse.json({ error: 'Error insertando en cuentas: ' + e3.message }, { status: 500 })
  const copiados = count ?? filas.length

  // 6) marcar PASADO SOLO las validas (las invalidas se quedan en FALTA, intactas)
  const idsValidas = validas.map((r) => r.id)
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
    invalidos: detalleInvalidos,          // las que se quedaron en FALTA por no tener IDADMON valido
    idadmons_sin_match: [...sinMatch],
  })
}
