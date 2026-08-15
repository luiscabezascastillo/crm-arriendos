// VERSION: v3 · 2026-08-15 · Además del cargo, se puede editar el CONCEPTO (texto) de la línea (solo estos dos campos,
//   nada más). El cargo sigue siendo override en cargo_manual; el concepto se actualiza en `concepto` y el cambio
//   queda en la bitácora `cuentas_bitacora` (campo='concepto', viejo→nuevo). Hereda v2.
// VERSION: v2 · 2026-08-12 · Se ELIMINA el límite de "solo los 5 movimientos más recientes": Dirección + los tres
//   editores (Alberto, Luis, Karina) pueden editar el cargo de CUALQUIER línea. Sigue siendo override en
//   cargo_manual (deja `cargo` intacto → sobrevive al re-volcado) con motivo obligatorio y auditoría. Hereda v1.
// VERSION: v1 · 2026-07-28 · Editar el CARGO de una fila de cartola (override manual + auditoría).
//   Solo Dirección + Karina. Solo en los 5 movimientos más recientes del IDADMON (incl. Término).
//   Guarda el nuevo valor en cargo_manual (deja `cargo` intacto → sobrevive al re-volcado del LOG)
//   y registra quién, cuándo y el motivo (obligatorio). El "quién" sale de la sesión del servidor,
//   no del navegador. Ruta: app/api/cartolas/editar-cargo/route.js
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const EDITORES = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']

// "dd/mm/aaaa" -> aaaammdd (para ordenar por fecha real); vacío -> 0
const fechaOrden = (s) => {
  const m = String(s ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  return m ? Number(m[3]) * 10000 + Number(m[2]) * 100 + Number(m[1]) : 0
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  const rol = session?.user?.role
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!(rol === 'direccion' || EDITORES.includes(email)))
    return Response.json({ error: 'No tienes permiso para editar cargos.' }, { status: 403 })

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const id = body?.id
  const motivo = String(body?.motivo || '').trim()
  const cargoNuevo = Math.round(Number(body?.cargo))
  // Concepto opcional: solo se actualiza si llega un texto no vacío.
  const conceptoNuevo = body?.concepto != null ? String(body.concepto).trim() : null
  if (!id) return Response.json({ error: 'Falta id' }, { status: 400 })
  if (motivo.length < 3) return Response.json({ error: 'El motivo es obligatorio.' }, { status: 400 })
  if (!Number.isFinite(cargoNuevo) || cargoNuevo < 0) return Response.json({ error: 'Cargo inválido' }, { status: 400 })

  // Fila objetivo
  const { data: fila, error: eF } = await admin
    .from('cuentas').select('id, idadmon, cargo, concepto').eq('id', id).maybeSingle()
  if (eF) return Response.json({ error: eF.message }, { status: 500 })
  if (!fila) return Response.json({ error: 'No existe la fila' }, { status: 404 })
  if (!fila.idadmon) return Response.json({ error: 'La fila no tiene IDADMON' }, { status: 400 })

  // v2: sin restricción de "5 más recientes" — se puede editar el cargo de cualquier línea
  // (queda registrado quién/cuándo/motivo y el original se conserva en `cargo`).
  // v3: SOLO se tocan cargo (override) y concepto (texto). Ningún otro campo.

  const cuando = new Date().toISOString()
  const cambiaConcepto = !!conceptoNuevo && conceptoNuevo !== String(fila.concepto ?? '').trim()
  const patch = {
    cargo_manual: cargoNuevo,
    cargo_editado_por: email,
    cargo_editado_motivo: motivo,
    cargo_editado_en: cuando,
  }
  if (cambiaConcepto) patch.concepto = conceptoNuevo

  const { error: eU } = await admin.from('cuentas').update(patch).eq('id', id)
  if (eU) return Response.json({ error: eU.message }, { status: 500 })

  // Auditoría del cambio de concepto en la bitácora (best-effort: no bloquea si falla).
  if (cambiaConcepto) {
    try {
      await admin.from('cuentas_bitacora').insert([{
        cuenta_id: id, idadmon: fila.idadmon, accion: 'edicion', campo: 'concepto',
        valor_anterior: fila.concepto ?? null, valor_nuevo: conceptoNuevo, motivo, usuario: email,
      }])
    } catch { /* la bitácora es opcional; el cambio ya quedó guardado */ }
  }

  return Response.json({
    ok: true, id,
    cargo_manual: cargoNuevo, cargo_original: fila.cargo,
    concepto: cambiaConcepto ? conceptoNuevo : (fila.concepto ?? null),
    cargo_editado_por: email, cargo_editado_motivo: motivo, cargo_editado_en: cuando,
  })
}
