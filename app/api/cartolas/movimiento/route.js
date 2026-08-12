// VERSION: v3 · 2026-08-12 · ALTA (añadir líneas cargo/abono) restringida a SOLO Dirección. Edición completa sigue
//   solo en MANUALES; anulación/reactivación sigue abierta a líneas de cargo (Dirección + editores). Hereda v2.
// VERSION: v2 · 2026-08-12 · ANULACIÓN abierta a cualquier LÍNEA DE CARGO (además de las manuales): Dirección +
//   los tres editores pueden anular/reactivar filas con cargo (soft, reversible, con motivo y bitácora). La EDICIÓN
//   completa (fecha/concepto/monto) sigue restringida a filas MANUALES; el cargo de filas no manuales se cambia por
//   /editar-cargo (override en cargo_manual). Hereda v1.
// VERSION: v1 · 2026-08-11 · Movimientos manuales de cartola (tabla `cuentas`): ALTA / EDICIÓN / ANULACIÓN.
//   Solo Dirección + Karina (mismos 3 correos que editar-cargo). Deja RASTRO COMPLETO en `cuentas_bitacora`
//   (acción, campo, antes/después, motivo obligatorio, usuario de la sesión, fecha). La fila manual se marca
//   con manual=true; "anular" es soft (anulado=true, no se borra) y es reversible (reactivar). El "quién" sale
//   SIEMPRE de la sesión del servidor, nunca del navegador. Ruta: app/api/cartolas/movimiento/route.js
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const EDITORES = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']

const money = (v) => Math.round(Number(String(v ?? '').replace(/[^\d.-]/g, '')) || 0)
const okFecha = (s) => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(String(s || '').trim())

async function anotar(rows) { if (rows && rows.length) await admin.from('cuentas_bitacora').insert(rows) }

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  const rol = session?.user?.role
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!(rol === 'direccion' || EDITORES.includes(email)))
    return Response.json({ error: 'No tienes permiso para gestionar movimientos de cartola.' }, { status: 403 })

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const accion = String(body?.accion || '').trim()
  const motivo = String(body?.motivo || '').trim()
  if (motivo.length < 3) return Response.json({ error: 'El motivo es obligatorio (mínimo 3 caracteres).' }, { status: 400 })

  // ───────────────────────── ALTA ─────────────────────────
  if (accion === 'alta') {
    // v3: AÑADIR líneas (cargo o abono) es SOLO de Dirección (editar/anular siguen abiertos a los editores).
    if (rol !== 'direccion') return Response.json({ error: 'Solo Dirección puede añadir líneas a la cartola.' }, { status: 403 })
    const idadmon = String(body?.idadmon || '').trim().toUpperCase()
    const fecha = String(body?.fecha || '').trim()          // dd/mm/aaaa (el resto de la cartola usa ese formato)
    const concepto = String(body?.concepto || '').trim()
    const tipo = String(body?.tipo || '').trim()            // 'cargo' | 'abono'
    const monto = money(body?.monto)
    const calif = String(body?.calif || '').trim() || null
    const comentarios = String(body?.comentarios || '').trim() || null
    if (!idadmon) return Response.json({ error: 'Falta IDADMON' }, { status: 400 })
    if (!okFecha(fecha)) return Response.json({ error: 'Fecha inválida (dd/mm/aaaa)' }, { status: 400 })
    if (!concepto) return Response.json({ error: 'El concepto es obligatorio' }, { status: 400 })
    if (!['cargo', 'abono'].includes(tipo)) return Response.json({ error: 'Tipo inválido (cargo/abono)' }, { status: 400 })
    if (!(monto > 0)) return Response.json({ error: 'El monto debe ser mayor que 0' }, { status: 400 })

    const insert = {
      idadmon, fecha, concepto,
      cargo: tipo === 'cargo' ? monto : null,
      abono: tipo === 'abono' ? monto : null,
      calif, comentarios, manual: true, anulado: false,
    }
    const { data, error } = await admin.from('cuentas').insert(insert).select('*').single()
    if (error) return Response.json({ error: error.message }, { status: 500 })
    await anotar([{
      cuenta_id: data.id, idadmon, accion: 'alta', campo: null, valor_anterior: null,
      valor_nuevo: `${tipo.toUpperCase()} ${monto} · ${concepto}`, motivo, usuario: email,
    }])
    return Response.json({ ok: true, fila: data })
  }

  // ─────────────────────── EDICIÓN ───────────────────────
  if (accion === 'edicion') {
    const id = body?.id
    if (!id) return Response.json({ error: 'Falta id' }, { status: 400 })
    const { data: fila, error: eF } = await admin.from('cuentas').select('*').eq('id', id).maybeSingle()
    if (eF) return Response.json({ error: eF.message }, { status: 500 })
    if (!fila) return Response.json({ error: 'No existe la fila' }, { status: 404 })
    if (!fila.manual) return Response.json({ error: 'Solo se pueden editar movimientos MANUALES. Las filas del banco (BI) o de inicio se corrigen en el origen.' }, { status: 403 })
    if (fila.anulado) return Response.json({ error: 'La fila está anulada; reactívala antes de editarla.' }, { status: 400 })

    const fecha = String(body?.fecha || '').trim()
    const concepto = String(body?.concepto || '').trim()
    const tipo = String(body?.tipo || '').trim()
    const monto = money(body?.monto)
    const comentarios = (body?.comentarios == null) ? fila.comentarios : (String(body.comentarios).trim() || null)
    if (!okFecha(fecha)) return Response.json({ error: 'Fecha inválida (dd/mm/aaaa)' }, { status: 400 })
    if (!concepto) return Response.json({ error: 'El concepto es obligatorio' }, { status: 400 })
    if (!['cargo', 'abono'].includes(tipo)) return Response.json({ error: 'Tipo inválido (cargo/abono)' }, { status: 400 })
    if (!(monto > 0)) return Response.json({ error: 'El monto debe ser mayor que 0' }, { status: 400 })

    const nuevo = {
      fecha, concepto,
      cargo: tipo === 'cargo' ? monto : null,
      abono: tipo === 'abono' ? monto : null,
      comentarios,
    }
    // Un registro de bitácora por cada campo que cambie (antes → después).
    const campos = ['fecha', 'concepto', 'cargo', 'abono', 'comentarios']
    const rows = []
    for (const k of campos) {
      const antes = fila[k] == null ? '' : String(fila[k])
      const despues = nuevo[k] == null ? '' : String(nuevo[k])
      if (antes !== despues) rows.push({ cuenta_id: id, idadmon: fila.idadmon, accion: 'edicion', campo: k, valor_anterior: antes, valor_nuevo: despues, motivo, usuario: email })
    }
    if (rows.length === 0) return Response.json({ ok: true, fila, sinCambios: true })
    const { data, error } = await admin.from('cuentas').update(nuevo).eq('id', id).select('*').single()
    if (error) return Response.json({ error: error.message }, { status: 500 })
    await anotar(rows)
    return Response.json({ ok: true, fila: data })
  }

  // ─────────────────────── ANULACIÓN / REACTIVACIÓN ───────────────────────
  if (accion === 'anulacion') {
    const id = body?.id
    if (!id) return Response.json({ error: 'Falta id' }, { status: 400 })
    const { data: fila, error: eF } = await admin.from('cuentas').select('*').eq('id', id).maybeSingle()
    if (eF) return Response.json({ error: eF.message }, { status: 500 })
    if (!fila) return Response.json({ error: 'No existe la fila' }, { status: 404 })
    // v2: se permite anular/reactivar filas MANUALES o cualquier LÍNEA DE CARGO (soft, reversible, auditado).
    const esCargo = Number(fila.cargo) > 0 || (fila.cargo_manual != null && fila.cargo_manual !== '')
    if (!fila.manual && !esCargo)
      return Response.json({ error: 'Solo se pueden anular movimientos MANUALES o líneas de CARGO.' }, { status: 403 })
    const nuevoEstado = !fila.anulado
    const { data, error } = await admin.from('cuentas').update({ anulado: nuevoEstado }).eq('id', id).select('*').single()
    if (error) return Response.json({ error: error.message }, { status: 500 })
    await anotar([{
      cuenta_id: id, idadmon: fila.idadmon, accion: nuevoEstado ? 'anulacion' : 'reactivacion', campo: 'anulado',
      valor_anterior: String(fila.anulado), valor_nuevo: String(nuevoEstado), motivo, usuario: email,
    }])
    return Response.json({ ok: true, fila: data })
  }

  return Response.json({ error: 'Acción no reconocida (alta | edicion | anulacion)' }, { status: 400 })
}
