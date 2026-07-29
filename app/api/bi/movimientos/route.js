// app/api/bi/movimientos/route.js
// VERSION: v1 · 2026-07-28 · Lectura y edición de la tabla `bi` por el SERVIDOR con service_role,
//   para que la pantalla BI · Movimientos funcione con RLS activado. El navegador ya no lee `bi`
//   directo con anon (que RLS bloquea → 0 filas); pasa por aquí.
//   GET   → devuelve todas las filas de bi (ordenadas por id asc).
//   PATCH → { id, campo, valor } edita UNA celda, solo columnas de una lista blanca.
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Solo estas columnas se pueden editar desde la pantalla. Cualquier otra se rechaza: así la API
// no reabre por la puerta de atrás lo que RLS cierra (no se puede tocar cargos, saldos, fecha…).
const COLUMNAS_EDITABLES = new Set([
  'unique_concept',
  'idadmon2',
  'discriminador',
  'check2_pasar_a_cartola',
  'color_manual',
  'liq_mes2',
])

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

// PATCH /api/bi/movimientos  body: { id, campo, valor }
export async function PATCH(request) {
  let body
  try { body = await request.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const { id, campo, valor } = body || {}
  if (id == null) return NextResponse.json({ error: 'Falta id' }, { status: 400 })
  if (!COLUMNAS_EDITABLES.has(campo)) {
    return NextResponse.json({ error: 'Columna no editable: ' + campo }, { status: 400 })
  }

  const v = valor === '' ? null : valor
  const { error } = await supabaseAdmin
    .from('bi')
    .update({ [campo]: v, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: 'No se pudo guardar: ' + error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
