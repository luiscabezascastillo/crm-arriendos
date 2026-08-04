// VERSION: v1 · 2026-08-03 · Pasa un descuento de ARRENDATARIO a la cartola (tabla cuentas):
//   monto >= 0 -> CARGO ; monto < 0 -> ABONO (a favor del arrendatario). El concepto lleva el num
//   y el texto de liquidación. Marca el descuento con pasado_a_cartola/por para no duplicar.
//   Solo Dirección y Karina. Anti-duplicado por el propio marcaje.
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

  // 1) Leer el descuento
  const { data: d, error: eD } = await sb.from('descuentos').select('*').eq('id', id).single()
  if (eD || !d) return Response.json({ error: 'Descuento no encontrado' }, { status: 404 })

  // 2) Validaciones
  const rep = String(d.repercutir_a || '').trim().toUpperCase()
  if (rep !== 'ARRENDATARIO') {
    return Response.json({ error: `Este descuento no es de ARRENDATARIO (es ${rep || 'sin destino'}). Solo se pasan a cartola los del arrendatario.` }, { status: 400 })
  }
  if (String(d.mes_a_imputar || '').startsWith('----')) {
    return Response.json({ error: 'El descuento está anulado (mes ----); no se pasa a cartola.' }, { status: 400 })
  }
  if (d.pasado_a_cartola) {
    return Response.json({ error: `Ya se pasó a cartola el ${new Date(d.pasado_a_cartola).toLocaleString('es-CL')}${d.pasado_a_cartola_por ? ' por ' + d.pasado_a_cartola_por : ''}.`, yaPasado: true }, { status: 409 })
  }

  const monto = n0(d.monto_a_imputar)
  if (monto === 0) return Response.json({ error: 'El monto es 0; nada que cargar.' }, { status: 400 })

  const esCargo = monto > 0
  const abs = Math.abs(monto)
  const texto = String(d.texto_explicativo_para_carta_a_propietario || '').trim()
  const concepto = `${d.num} ${texto}`.trim().slice(0, 250)

  // 3) Insertar en cuentas (cartola)
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
  const { data: ins, error: eIns } = await sb.from('cuentas').insert(fila).select().single()
  if (eIns) return Response.json({ error: 'No se pudo insertar en cartola: ' + eIns.message }, { status: 500 })

  // 4) Marcar el descuento como pasado
  const { error: eUpd } = await sb.from('descuentos')
    .update({ pasado_a_cartola: new Date().toISOString(), pasado_a_cartola_por: email })
    .eq('id', id)
  if (eUpd) {
    // La fila ya se insertó; avisar pero no romper. (Reintentar el marcaje evitaría duplicar en un 2º clic.)
    return Response.json({ ok: true, aviso: 'Se cargó en cartola, pero no se pudo marcar el descuento como pasado: ' + eUpd.message, cuentas_id: ins.id, tipo: esCargo ? 'cargo' : 'abono', monto: abs })
  }

  return Response.json({
    ok: true,
    cuentas_id: ins.id,
    idadmon: d.idadmon,
    tipo: esCargo ? 'cargo' : 'abono',
    monto: abs,
    concepto,
  })
}
