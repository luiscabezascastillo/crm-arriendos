// app/api/bi/validar-idadmon/route.js
// VERSION: v1 · 2026-08-14 · VALIDAR un IDADMON auto-asignado. POST { id } marca el movimiento de BI como
//   validado por una persona: idadmon_origen pasa de 'auto' a 'manual' y queda registrado en la bitácora
//   `bi_idadmon_log` (usuario, viejo=nuevo=IDADMON actual, motivo 'validado', origen 'validacion'). No cambia
//   el IDADMON ni toca `cuentas`: solo confirma que el que puso el sistema es correcto, para que salga de
//   «Por validar». Requiere la tabla bi_idadmon_log y la columna bi.idadmon_origen.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(request) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email || null

  let body
  try { body = await request.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const { id } = body || {}
  if (id == null) return NextResponse.json({ error: 'Falta id' }, { status: 400 })

  // Estado actual del movimiento (para dejar constancia de QUÉ IDADMON se validó).
  const { data: biRow, error: eRow } = await supabaseAdmin
    .from('bi').select('id, reg, unique_concept, idadmon_origen').eq('id', id).single()
  if (eRow || !biRow) return NextResponse.json({ error: 'Movimiento no encontrado: ' + id }, { status: 404 })

  // Marcar como validado por una persona.
  const { error: eUp } = await supabaseAdmin.from('bi')
    .update({ idadmon_origen: 'manual', updated_at: new Date().toISOString() })
    .eq('id', id)
  if (eUp) return NextResponse.json({ error: 'No se pudo validar: ' + eUp.message }, { status: 500 })

  // Bitácora: quién validó y qué IDADMON (sin cambio de valor).
  await supabaseAdmin.from('bi_idadmon_log').insert([{
    reg: biRow.reg, bi_id: biRow.id,
    idadmon_viejo: biRow.unique_concept || null,
    idadmon_nuevo: biRow.unique_concept || null,
    usuario: email, motivo: 'validado (auto→manual, sin cambio)', origen: 'validacion',
  }])

  return NextResponse.json({ ok: true, validado: biRow.unique_concept || null })
}
