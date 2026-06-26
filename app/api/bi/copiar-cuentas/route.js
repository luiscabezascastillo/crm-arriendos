import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// --- helpers ---
const num = (v) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d.-]/g, '')) || 0)
const idadmonDe = (uc) => String(uc ?? '').trim().slice(0, 6)   // clave de 6 = LEFT(unique_concept, 6)

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
  // 1) leer de bi las filas marcadas FALTA (las que el VBA copiaba)
  const { data: faltan, error: e1 } = await supabaseAdmin
    .from('bi')
    .select('id, fecha, detalle_movimiento, cargos, abonos, reg, unique_concept')
    .eq('check2_pasar_a_cartola', 'FALTA')
    .order('id', { ascending: true })

  if (e1) return NextResponse.json({ error: 'Error leyendo bi: ' + e1.message }, { status: 500 })
  if (!faltan || faltan.length === 0)
    return NextResponse.json({ ok: true, copiados: 0, mensaje: 'No hay movimientos en FALTA.' })

  // 2) lookup a datos_arriendos por idadmon -> { estado, propietario, inmueble }
  //    (equivale a los 3 VLOOKUP del VBA contra el LOG)
  const ids = [...new Set(faltan.map((r) => idadmonDe(r.unique_concept)).filter(Boolean))]
  const mapa = {}
  if (ids.length) {
    const { data: da, error: e2 } = await supabaseAdmin
      .from('datos_arriendos')
      .select('idadmon, estado, propietario, inmueble')
      .in('idadmon', ids)
      .order('id', { ascending: true })   // determinista: nos quedamos con la primera, como VLOOKUP
    if (e2) return NextResponse.json({ error: 'Error leyendo datos_arriendos: ' + e2.message }, { status: 500 })
    for (const d of da || []) if (!mapa[d.idadmon]) mapa[d.idadmon] = d
  }

  // 3) armar las filas de cuentas (mapeo cerrado del VBA)
  const ts = ahoraCL()
  const sinMatch = new Set()
  const filas = faltan.map((r) => {
    const idadmon = idadmonDe(r.unique_concept)
    const info = idadmon ? mapa[idadmon] : null
    if (idadmon && !info) sinMatch.add(idadmon)
    return {
      fecha: r.fecha,                                   // A
      idadmon: idadmon || null,                         // B  <- LEFT(unique_concept,6)
      concepto: r.detalle_movimiento,                   // C
      cargo: num(r.cargos),                             // D  (text -> numeric)
      abono: num(r.abonos),                             // E  (text -> numeric)
      saldo: null,                                      // F  (campo a calcular despues)
      comentarios: 'BI',                                // G  marca de origen
      calif: r.reg != null && String(r.reg) !== '' ? String(r.reg) : null, // H  <- reg
      justificantes: ts,                                // I  <- Now()
      estado: info?.estado ?? null,                     // J  (del lookup)
      propietario: info?.propietario ?? null,           // K  (del lookup)
      inmueble: info?.inmueble ?? null,                 // L  (del lookup)
      updated_at: new Date().toISOString(),
      // sync_id / sync_hash: en desuso -> se quedan null
    }
  })

  // 4) insertar en cuentas
  const { error: e3, count } = await supabaseAdmin
    .from('cuentas')
    .insert(filas, { count: 'exact' })
  if (e3) return NextResponse.json({ error: 'Error insertando en cuentas: ' + e3.message }, { status: 500 })
  const copiados = count ?? filas.length

  // 5) (opcion A) marcar PASADO SOLO despues de que el insert haya ido OK
  const idsBi = faltan.map((r) => r.id)
  const { error: e4 } = await supabaseAdmin
    .from('bi')
    .update({ check2_pasar_a_cartola: 'PASADO', updated_at: new Date().toISOString() })
    .in('id', idsBi)

  if (e4) {
    // caso raro: copio bien pero fallo al marcar -> avisar para revisar antes de reintentar
    return NextResponse.json({
      error: 'Se copiaron ' + copiados + ' a cuentas, pero fallo el marcado PASADO: ' + e4.message +
             '. NO reintentar sin revisar (riesgo de duplicar en cuentas).',
      copiados,
    }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    copiados,
    idadmons_sin_match: [...sinMatch],
  })
}