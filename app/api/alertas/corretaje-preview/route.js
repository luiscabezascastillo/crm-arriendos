// VERSION: v1 · 2026-08-03 · PREVIEW del corretaje de inicio de contrato (para el panel de la alerta).
//   Reúne, sin ejecutar nada: comisión del propietario (comision_d_total) y del arrendatario
//   (comision_a_total), si ya existe el cargo COMISION del arrendatario en cartola (cuentas),
//   si ya existe el descuento de corretaje, y los datos de facturación (propietario desde
//   'propietarios' por idprop; arrendatario desde 'datos_arriendos'). Solo Dirección y Karina.
// app/api/alertas/corretaje-preview/route.js

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

export async function GET(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!EMAILS_OK.includes(email)) return Response.json({ error: 'Solo Dirección y Karina.' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const idadmon = String(searchParams.get('idadmon') || '').trim()
  if (!idadmon) return Response.json({ error: 'Falta idadmon' }, { status: 400 })

  const sb = svc()

  // 1) Ficha del contrato
  const { data: da, error: eDa } = await sb.from('datos_arriendos')
    .select('idadmon, idprop, estado, propietario, arrendatario, inmueble, rut, mail_arrendatario, comision_d_total, comision_a_total, comision_d_base, iva_comision_d, comision_a_base, iva_comision_a')
    .eq('idadmon', idadmon).maybeSingle()
  if (eDa) return Response.json({ error: 'datos_arriendos: ' + eDa.message }, { status: 500 })
  if (!da) return Response.json({ error: `IDADMON ${idadmon} no encontrado` }, { status: 404 })

  const comisionProp = n0(da.comision_d_total)
  const comisionArr = n0(da.comision_a_total)

  // 2) Datos del propietario (para su línea de factura) desde 'propietarios' por idprop
  let prop = null
  if (da.idprop) {
    const { data: p } = await sb.from('propietarios')
      .select('idprop, propietario, rut, mail1, email_2, direccion, comuna, tipo_factura')
      .eq('idprop', da.idprop).maybeSingle()
    prop = p || null
  }

  // 3) ¿Ya existe el cargo COMISION del arrendatario en cartola (cuentas)?
  const { data: cargos } = await sb.from('cuentas')
    .select('id, fecha, concepto, cargo, estado')
    .eq('idadmon', idadmon).ilike('concepto', '%COMISION%')
  const cargoArrExiste = (cargos || []).length > 0

  // 4) ¿Ya existe un descuento de corretaje (CORRETAJES) para este idadmon?
  const { data: descs } = await sb.from('descuentos')
    .select('num, tipo, repercutir_a, monto_a_imputar, mes_a_imputar')
    .eq('idadmon', idadmon).eq('tipo', 'CORRETAJES')
  const descuentoExiste = (descs || []).length > 0

  return Response.json({
    ok: true,
    idadmon,
    estado: da.estado,
    propietario: {
      idprop: da.idprop || null,
      nombre: prop?.propietario || da.propietario || '',
      rut: prop?.rut || '',
      direccion: prop?.direccion || '',
      comuna: prop?.comuna || '',
      email: prop?.mail1 || prop?.email_2 || '',
      tipo_factura: (prop?.tipo_factura || '').trim() || '33',   // 33/39 desde propietarios
      comision: comisionProp,
      tieneDatos: !!prop,
    },
    arrendatario: {
      nombre: da.arrendatario || '',
      rut: da.rut || '',
      direccion: da.inmueble || '',       // dirección = inmueble arrendado
      email: da.mail_arrendatario || '',
      tipo_factura_sugerido: '39',        // BOLETA por defecto; Karina puede cambiarlo
      comision: comisionArr,
      aplica: comisionArr > 0,            // si 0, no hay corretaje de arrendatario (ej. A00889)
    },
    inmueble: da.inmueble || '',
    cargoArrendatario: {
      existe: cargoArrExiste,
      registros: (cargos || []).map(c => ({ fecha: c.fecha, concepto: c.concepto, cargo: n0(c.cargo) })),
    },
    descuentoCorretaje: {
      existe: descuentoExiste,
      registros: (descs || []).map(d => ({ num: d.num, monto: n0(d.monto_a_imputar), mes: d.mes_a_imputar })),
    },
  })
}
