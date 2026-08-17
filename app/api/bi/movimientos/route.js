// app/api/bi/movimientos/route.js
// VERSION: v5 · 2026-08-17 · Se AÑADE `comentarios` a la lista blanca de columnas editables: la celda COMENTARIOS
//   se pintaba editable en la pantalla pero el PATCH la rechazaba ("Columna no editable: comentarios"), así que
//   Karina tecleaba y NO se guardaba. Regla acordada: de REG hacia la derecha (UNIQUE CONCEPT, COMENTARIOS,
//   LIQ. MES2) todo editable por Dirección/Karina; REG y lo de su izquierda (importes, saldo, fecha) siguen
//   solo-lectura. Hereda v4.
// VERSION: v4 · 2026-08-15 · El PATCH de UNIQUE_CONCEPT gestiona también el caso "se PIERDE el IDADMON": si el valor
//   pasa de un IDADMON válido a texto libre o vacío, se ELIMINA la línea réplica en `cuentas` (helper quitarDeCuentas:
//   borra la fila calif=reg con comentarios='BI'). Esa línea de cuentas es solo una réplica del BI bajo un contrato:
//   sin contrato, deja de existir (la traza queda en la bitácora bi_idadmon_log). Se limpia además el espejo
//   `bi.idadmon2`. El caso "nuevo IDADMON válido" sigue volcando como en v3. Hereda v3.
// VERSION: v3 · 2026-08-14 · El PATCH de UNIQUE_CONCEPT ahora (1) PROPAGA a `cuentas` el IDADMON —actualiza la
//   fila (calif=reg) o la INSERTA si no existía, cerrando el desincronismo bi→cuentas—; (2) lo registra en la
//   BITÁCORA `bi_idadmon_log` (quién, viejo→nuevo, motivo, origen); (3) marca `bi.idadmon_origen='manual'` (lo puso
//   una persona). Lee la sesión para saber QUIÉN edita. El resto de columnas editables sigue igual (update simple).
//   Requiere: tabla bi_idadmon_log y columna bi.idadmon_origen (ver SQL de esquema). Hereda v2.
// VERSION: v2 · 2026-08-13 · FIX: la lista blanca decía 'liq_mes2' pero la columna real es 'liquidacion_mes2',
//   por lo que el PATCH rechazaba la reasignación del mes de liquidación (no guardaba). Corregido el nombre.
// VERSION: v1 · 2026-07-28 · Lectura y edición de la tabla `bi` por el SERVIDOR con service_role,
//   para que la pantalla BI · Movimientos funcione con RLS activado. El navegador ya no lee `bi`
//   directo con anon (que RLS bloquea → 0 filas); pasa por aquí.
//   GET   → devuelve todas las filas de bi (ordenadas por id asc).
//   PATCH → { id, campo, valor } edita UNA celda, solo columnas de una lista blanca.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Solo estas columnas se pueden editar desde la pantalla. Cualquier otra se rechaza: así la API
// no reabre por la puerta de atrás lo que RLS cierra (no se puede tocar cargos, saldos, fecha…).
const COLUMNAS_EDITABLES = new Set([
  'unique_concept',
  'comentarios',          // v5: de REG a la derecha, Karina/Dirección rellenan los huecos (obligación de identificación)
  'idadmon2',
  'discriminador',
  'check2_pasar_a_cartola',
  'color_manual',
  'liquidacion_mes2',
])

const RE_IDADMON = /^A\d{5}$/
const num = (v) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d.-]/g, '')) || 0)

// timestamp "dd/mm/aaaa HH:MM" en hora de Chile (para JUSTIFICANTES), igual que copiar-cuentas.
function ahoraCL() {
  const partes = new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date())
  const g = (t) => partes.find((p) => p.type === t)?.value || ''
  return `${g('day')}/${g('month')}/${g('year')} ${g('hour')}:${g('minute')}`
}

// GET /api/bi/movimientos → todas las filas de bi
export async function GET() {
  const PAGE = 1000
  let desde = 0
  let todo = []
  for (;;) {
    const { data, error } = await supabaseAdmin
      .from('bi')
      .select('*')
      .order('id', { ascending: true })
      .range(desde, desde + PAGE - 1)
    if (error) return NextResponse.json({ error: 'Error leyendo bi: ' + error.message }, { status: 500 })
    todo = todo.concat(data || [])
    if (!data || data.length < PAGE) break
    desde += PAGE
  }
  return NextResponse.json({ ok: true, filas: todo })
}

// Vuelca a `cuentas` el IDADMON de un movimiento de BI: actualiza la fila (calif=reg) o la inserta si no
// existía. Cierra el desincronismo bi→cuentas cuando se edita el IDADMON a mano. Devuelve un resumen.
async function volcarACuentas(biRow, idadmon) {
  const reg = biRow.reg != null && String(biRow.reg).trim() !== '' ? String(biRow.reg).trim() : null
  if (!reg) return { propagado: false, motivo: 'sin_reg' }

  // ¿Ya existe la fila en cuentas (por calif = reg)?
  const { data: ex, error: eSel } = await supabaseAdmin
    .from('cuentas').select('id, idadmon').eq('calif', reg).limit(1)
  if (eSel) return { propagado: false, error: eSel.message }

  // Datos del contrato para estado/propietario/inmueble.
  const { data: da } = await supabaseAdmin
    .from('datos_arriendos').select('estado, propietario, inmueble').eq('idadmon', idadmon).maybeSingle()

  if (ex && ex.length) {
    // Actualizar la fila existente al nuevo IDADMON (+ propietario/inmueble).
    const { error: eUp } = await supabaseAdmin.from('cuentas').update({
      idadmon,
      propietario: da?.propietario ?? null,
      inmueble: da?.inmueble ?? null,
      updated_at: new Date().toISOString(),
    }).eq('id', ex[0].id)
    if (eUp) return { propagado: false, error: eUp.message }
    return { propagado: true, accion: 'actualizada', cuentaId: ex[0].id }
  }

  // No existía: insertar la fila (misma forma que "Copiar FALTA a CUENTAS").
  const { data: ins, error: eIns } = await supabaseAdmin.from('cuentas').insert([{
    fecha: biRow.fecha,
    idadmon,
    concepto: biRow.detalle_movimiento,
    cargo: num(biRow.cargos),
    abono: num(biRow.abonos),
    saldo: null,
    comentarios: 'BI',
    calif: reg,
    justificantes: ahoraCL(),
    estado: da?.estado ?? null,
    propietario: da?.propietario ?? null,
    inmueble: da?.inmueble ?? null,
    updated_at: new Date().toISOString(),
  }]).select('id').single()
  if (eIns) return { propagado: false, error: eIns.message }
  return { propagado: true, accion: 'insertada', cuentaId: ins?.id }
}

// ELIMINA de `cuentas` la línea volcada desde BI (calif = reg, comentarios = 'BI') cuando el movimiento deja de
// tener un IDADMON válido (se cambió por texto libre o se vació). Esa línea de cuentas es solo una RÉPLICA del BI
// bajo un contrato: si no hay contrato al que pertenecer, deja de existir (se borra). La traza del cambio queda
// en la bitácora `bi_idadmon_log`. Devuelve cuántas filas réplica se eliminaron.
async function quitarDeCuentas(biRow) {
  const reg = biRow.reg != null && String(biRow.reg).trim() !== '' ? String(biRow.reg).trim() : null
  if (!reg) return { propagado: false, motivo: 'sin_reg' }
  const { data: del, error } = await supabaseAdmin
    .from('cuentas').delete().eq('calif', reg).eq('comentarios', 'BI').select('id')
  if (error) return { propagado: false, error: error.message }
  return { propagado: true, accion: 'eliminada_de_cuentas', filas: del?.length || 0 }
}

// PATCH /api/bi/movimientos  body: { id, campo, valor, motivo? }
export async function PATCH(request) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email || null

  let body
  try { body = await request.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const { id, campo, valor, motivo } = body || {}
  if (id == null) return NextResponse.json({ error: 'Falta id' }, { status: 400 })
  if (!COLUMNAS_EDITABLES.has(campo)) {
    return NextResponse.json({ error: 'Columna no editable: ' + campo }, { status: 400 })
  }

  const v = valor === '' ? null : valor

  // ── Camino especial: editar el IDADMON (unique_concept) ──────────────────────────────
  // Además de guardar en bi, se propaga a cuentas, se registra en la bitácora y se marca 'manual'.
  if (campo === 'unique_concept') {
    // Estado actual del movimiento (para el viejo IDADMON y los datos del volcado).
    const { data: biRow, error: eRow } = await supabaseAdmin
      .from('bi').select('id, reg, fecha, detalle_movimiento, cargos, abonos, unique_concept').eq('id', id).single()
    if (eRow || !biRow) return NextResponse.json({ error: 'Movimiento no encontrado: ' + id }, { status: 404 })

    const viejo = biRow.unique_concept
    const nuevo = v
    const esIdadmonValido = RE_IDADMON.test(String(nuevo ?? '').trim())
    const viejoEraValido = RE_IDADMON.test(String(viejo ?? '').trim())
    const cambia = String(viejo ?? '').trim() !== String(nuevo ?? '').trim()

    // 1) Guardar en bi + marcar origen manual (lo puso una persona).
    const patchBi = { unique_concept: nuevo, idadmon_origen: 'manual', updated_at: new Date().toISOString() }
    if (esIdadmonValido) { patchBi.idadmon2 = nuevo; patchBi.check2_pasar_a_cartola = 'CORREGIDO' }
    else { patchBi.idadmon2 = null }   // ya no hay IDADMON válido: se limpia el espejo idadmon2
    const { error: eBi } = await supabaseAdmin.from('bi').update(patchBi).eq('id', id)
    if (eBi) return NextResponse.json({ error: 'No se pudo guardar: ' + eBi.message }, { status: 500 })

    // 2) Propagar a cuentas:
    //    · nuevo IDADMON válido → volcar (actualiza/inserta la línea en la cartola del contrato).
    //    · se PIERDE el IDADMON (antes válido, ahora texto libre o vacío) → ELIMINAR la línea réplica de
    //      cuentas (calif=reg, comentarios='BI'): sin contrato al que pertenecer, esa réplica del BI deja de
    //      existir. La traza queda en la bitácora.
    let propagacion = { propagado: false, motivo: 'sin_cambio' }
    if (cambia) {
      if (esIdadmonValido) propagacion = await volcarACuentas(biRow, String(nuevo).trim())
      else if (viejoEraValido) propagacion = await quitarDeCuentas(biRow)
      else propagacion = { propagado: false, motivo: 'no_afecta_cuentas' }
    }

    // 3) Bitácora (siempre que haya cambio real).
    if (String(viejo ?? '') !== String(nuevo ?? '')) {
      await supabaseAdmin.from('bi_idadmon_log').insert([{
        reg: biRow.reg, bi_id: biRow.id,
        idadmon_viejo: viejo || null, idadmon_nuevo: nuevo || null,
        usuario: email, motivo: (motivo && String(motivo).trim()) ? String(motivo).trim() : null,
        origen: 'manual',
      }])
    }

    return NextResponse.json({ ok: true, propagacion })
  }

  // ── Resto de columnas: update simple, como antes ─────────────────────────────────────
  const { error } = await supabaseAdmin
    .from('bi')
    .update({ [campo]: v, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return NextResponse.json({ error: 'No se pudo guardar: ' + error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
