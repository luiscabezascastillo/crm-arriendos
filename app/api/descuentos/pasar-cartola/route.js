// VERSION: v2 · 2026-08-04 · Pasa/actualiza un descuento de ARRENDATARIO en la cartola (tabla cuentas).
//   Idempotente por num: si NO existe el movimiento (concepto empieza por "{num} ") lo CREA; si YA existe,
//   lo ACTUALIZA con el signo/importe actual del descuento (cargo si +, abono si −). Esto permite:
//   (1) la carga AUTOMÁTICA al crear el descuento, y (2) el botón "Modificar cargo/abono Cartola" para
//   corregir el signo si Karina detecta que era abono en vez de cargo (o al revés).
//   Marca pasado_a_cartola/por. Solo Dirección y Karina.
// app/api/descuentos/pasar-cartola/route.js

import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

const EMAILS_OK = [
  'alberto.cabezas@fondocapital.com',
  'luis.cabezas@fondocapital.com',
  'karina.morales@fondocapital.com',
]

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
}
const n0 = v => { const x = Number(v); return Number.isFinite(x) ? Math.round(x) : 0 }
function fechaHoy() {
  const d = new Date()
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

// Lógica central reutilizable: crea o actualiza el movimiento en cuentas para un descuento ARRENDATARIO.
// Devuelve { ok, accion:'crear'|'actualizar', tipo:'cargo'|'abono', monto } o { error }.
export async function pasarDescuentoACartola(sb, descuento, email) {
  const d = descuento
  const rep = String(d.repercutir_a || '').trim().toUpperCase()
  if (rep !== 'ARRENDATARIO') return { error: `No es ARRENDATARIO (es ${rep || 'sin destino'}).` }
  if (String(d.mes_a_imputar || '').startsWith('----')) return { error: 'Descuento anulado (mes ----).' }

  const monto = n0(d.monto_a_imputar)
  if (monto === 0) return { error: 'El monto es 0; nada que cargar.' }
  const esCargo = monto > 0
  const abs = Math.abs(monto)
  const texto = String(d.texto_explicativo_para_carta_a_propietario || '').trim()
  const concepto = `${d.num} ${texto}`.trim().slice(0, 250)

  // ¿ya existe el movimiento de este num en cuentas? (concepto empieza por "{num} ")
  const { data: existentes } = await sb.from('cuentas')
    .select('id, cargo, abono, concepto')
    .eq('idadmon', d.idadmon)
    .ilike('concepto', `${d.num} %`)
    .limit(5)
  const movimiento = (existentes || []).find(c => String(c.concepto || '').startsWith(`${d.num} `))

  if (movimiento) {
    // ACTUALIZAR (corregir signo/importe)
    const { error: eU } = await sb.from('cuentas')
      .update({
        concepto,
        cargo: esCargo ? abs : 0,
        abono: esCargo ? 0 : abs,
        updated_at: new Date().toISOString(),
      })
      .eq('id', movimiento.id)
    if (eU) return { error: 'No se pudo actualizar en cartola: ' + eU.message }
    return { ok: true, accion: 'actualizar', tipo: esCargo ? 'cargo' : 'abono', monto: abs, cuentas_id: movimiento.id }
  }

  // CREAR
  const fila = {
    fecha: fechaHoy(),
    idadmon: d.idadmon,
    concepto,
    cargo: esCargo ? abs : 0,
    abono: esCargo ? 0 : abs,
    estado: 'S',
    propietario: d.propietario || '',
    inmueble: d.inmueble || '',
    updated_at: new Date().toISOString(),
  }
  const { data: ins, error: eI } = await sb.from('cuentas').insert(fila).select().single()
  if (eI) return { error: 'No se pudo insertar en cartola: ' + eI.message }
  return { ok: true, accion: 'crear', tipo: esCargo ? 'cargo' : 'abono', monto: abs, cuentas_id: ins.id }
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!EMAILS_OK.includes(email)) return Response.json({ error: 'Solo Dirección y Karina pueden pasar a cartola.' }, { status: 403 })

  let body = {}
  try { body = await req.json() } catch {}
  const id = body.id
  if (!id) return Response.json({ error: 'Falta id del descuento' }, { status: 400 })

  const sb = svc()
  const { data: d, error: eD } = await sb.from('descuentos').select('*').eq('id', id).single()
  if (eD || !d) return Response.json({ error: 'Descuento no encontrado' }, { status: 404 })

  const res = await pasarDescuentoACartola(sb, d, email)
  if (res.error) return Response.json({ error: res.error }, { status: 400 })

  // marcar pasado (si aún no lo estaba)
  if (!d.pasado_a_cartola) {
    await sb.from('descuentos').update({ pasado_a_cartola: new Date().toISOString(), pasado_a_cartola_por: email }).eq('id', id)
  }
  return Response.json({ ok: true, ...res })
}
