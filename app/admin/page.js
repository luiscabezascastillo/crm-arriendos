// app/api/cc1/cerrar-facturar/route.js
//
// "CERRAR Y FACTURAR" — cierre de la carga de un contrato que está en P.
// Recibe { idadmon }. Solo procede si el contrato está en estado P.
//
// Hace, en orden:
//   1. Valida sesión + permiso (puedeCambiarEstado, igual que el circuito de estados).
//   2. Verifica que el contrato exista y esté en P (si no, no hace nada).
//   3. Cambia el estado P -> S en datos_arriendos (P->S NO crea ningún IDADMON nuevo).
//   4. Registra el evento en historico_idadmon y envía el email de cambio de estado
//      a cambiosdeestado@ (subject "11 inicio-contrato"), igual que /cambiar-estado.
//   5. Lee la ficha del propietario (tabla propietarios, por idprop) y construye el
//      email de facturación con los datos de comisiones (propietario + arrendatario).
//   6. Envía ese email a Finanzas (Karina), con Legal en copia, indicando en el cuerpo
//      quién operó el botón (autor).
//
// Devuelve { ok, idadmon, estadoNuevo:'S', emailEstado, emailFacturacion }.

import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { supabaseAdmin, getCapacidades } from '../../../../lib/cc1Permisos'
import { buildSubject, enviarNotificacion } from '../../../../lib/cc1Email'

// ─── Destinatarios del email de facturación ─────────────────────────────────
// Si en el futuro cambian, editar aquí.
const FACTURACION_TO = 'karina.morales@fondocapital.com'   // Finanzas
const FACTURACION_CC = 'anthony.mendoza@fondocapital.com'  // Legal (copia)

// Muestra un valor o '' si está vacío.
function v(x) {
  if (x === null || x === undefined || x === '') return ''
  return String(x)
}
// Importe con separador de miles es-CL (10000 -> "10.000"). Vacío -> ''.
function m(x) {
  if (x === null || x === undefined || x === '') return ''
  const n = Number(String(x).replace(/\./g, '').replace(/[^\d-]/g, ''))
  if (isNaN(n)) return String(x)
  return n.toLocaleString('es-CL')
}
// Escapa para HTML.
function esc(x) {
  return v(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Concepto de la factura: "COMISION ARRENDAMIENTO {inmueble}[, Estacionamiento {estac}]"
function conceptoFactura(dat) {
  let c = `COMISION ARRENDAMIENTO ${v(dat.inmueble)}`.trim()
  if (v(dat.estac)) c += `, Estacionamiento ${v(dat.estac)}`
  return c
}

// Bloque de texto plano para una de las partes (propietario / arrendatario).
function bloqueTexto(titulo, p) {
  return [
    titulo,
    `    NOMBRE:    ${p.nombre}`,
    `    RUT:       ${p.rut}`,
    `    DIRECCION: ${p.direccion}`,
    `    EMAIL:     ${p.email}`,
    `    TELEFONO:  ${p.telefono}`,
    `    BASE IMP.: ${p.base}`,
    `    IVA:       ${p.iva}`,
    `    TOTAL:     ${p.total}`,
    `    CONCEPTO:  ${p.concepto}`,
  ].join('\n')
}

// Fila del cuadro económico (HTML).
function filaEco(label, valor, bold) {
  const tdL = 'padding:2px 6px;font-size:11px;color:#1f5023;background:#bcdcbd;font-weight:600;white-space:nowrap;'
  const tdV = `padding:2px 6px;font-size:11px;background:#e8f4e8;${bold ? 'font-weight:700;' : ''}`
  return `<tr><td style="${tdL}">${esc(label)}</td><td style="${tdV}">${esc(valor)}</td></tr>`
}

// Cuadro DATOS ECONÓMICOS (HTML, verde) replicando el del Excel.
function cuadroEconomicoHTML(dat, raw) {
  const rd = raw || {}
  const sub = 'padding:3px 6px;background:#2f6b33;color:#fff;font-size:11px;font-weight:700;text-align:center;'
  const prop = `
    <tr><td colspan="2" style="${sub}">PROPIETARIO</td></tr>
    ${filaEco('Porcentaje', rd['Porcent-D'])}
    ${filaEco('Cantidad', m(dat.comision_d_base))}
    ${filaEco('Con IVA', m(dat.iva_comision_d))}
    ${filaEco('Total', m(dat.comision_d_total), true)}
    ${filaEco('C. Especiales', rd['C.ESPECIALES PROPIETARIO'])}
    ${filaEco('Comentario', rd['COMENTARIO PROPIETARIO'])}
    ${filaEco('Boleta/Factura', dat.comision_cobrado)}`
  const arr = `
    <tr><td colspan="2" style="${sub}">ARRENDATARIO</td></tr>
    ${filaEco('Porcentaje', rd['Porcent-A'])}
    ${filaEco('Cantidad', m(dat.comision_a_base))}
    ${filaEco('Con IVA', m(dat.iva_comision_a))}
    ${filaEco('Total', m(dat.comision_a_total), true)}
    ${filaEco('C. Especiales', rd['C.ESPECIALES ARRENDATARIO'])}
    ${filaEco('Comentario', rd['COMENTARIO ARRENDTARIO'])}
    ${filaEco('Boleta/Factura', dat.comision_a_pagado)}`
  return `
  <table style="border-collapse:collapse;border:1px solid #9ec79f;width:280px;margin-top:8px;">
    <tr><td colspan="2" style="padding:4px 6px;background:#2f6b33;color:#fff;font-size:11px;font-weight:700;text-align:center;">DATOS ECONÓMICOS</td></tr>
    ${prop}
    <tr><td colspan="2" style="height:6px;background:#e8f4e8;"></td></tr>
    ${arr}
  </table>`
}

export async function POST(req) {
  // 1. Sesión + permiso
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })

  const cap = await getCapacidades(email)
  if (!cap.puedeFacturar) {
    return Response.json({ error: 'Sin permiso para cerrar y facturar (solo responsable/Dirección).' }, { status: 403 })
  }

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const { idadmon } = body || {}
  if (!idadmon) return Response.json({ error: 'Falta idadmon' }, { status: 400 })

  // 2. Cargar contrato y verificar que está en P
  const { data: dat, error: e0 } = await supabaseAdmin
    .from('datos_arriendos').select('*').eq('idadmon', idadmon).single()
  if (e0 || !dat) return Response.json({ error: 'Contrato no encontrado: ' + idadmon }, { status: 404 })
  if (dat.estado !== 'P') {
    return Response.json({ error: `El contrato ${idadmon} no está en estado P (está en ${dat.estado}). Esta acción solo cierra contratos en P.` }, { status: 409 })
  }

  const fechaEvento = new Date().toISOString().slice(0, 10)

  // 3. Cambiar estado P -> S
  const { error: e1 } = await supabaseAdmin
    .from('datos_arriendos')
    .update({ estado: 'S', updated_at: new Date().toISOString() })
    .eq('idadmon', idadmon)
  if (e1) return Response.json({ error: 'Error al cambiar estado: ' + e1.message }, { status: 500 })

  // 4. Histórico + email de cambio de estado (a cambiosdeestado@)
  const subjectCambio = buildSubject({
    idadmon, estadoNuevo: 'S',
    propietario: dat.propietario, inmueble: dat.inmueble, fecha: fechaEvento,
  })
  await supabaseAdmin.from('historico_idadmon').insert([{
    idadmon, evento: 'cambio_estado',
    estado_anterior: 'P', estado_nuevo: 'S',
    fecha: fechaEvento, usuario: email, email_subject: subjectCambio,
    detalle: 'cierre de carga (CERRAR Y FACTURAR)',
  }])
  const rEstado = await enviarNotificacion({
    subject: subjectCambio,
    autor: email,
    idadmon, estadoAnterior: 'P', estadoNuevo: 'S',
    propietario: dat.propietario, inmueble: dat.inmueble, fecha: fechaEvento,
  })

  // 5. Ficha del propietario (tabla propietarios, por idprop)
  let prop = null
  if (dat.idprop) {
    const { data: pRow } = await supabaseAdmin
      .from('propietarios').select('*').eq('idprop', dat.idprop).single()
    prop = pRow || null
  }

  // 5b. raw_data del LOG (porcentajes de corretaje, C.Especiales y Comentario por parte)
  let rawLog = {}
  try {
    const { data: lRow } = await supabaseAdmin
      .from('log').select('raw_data').eq('id_lcc', idadmon).maybeSingle()
    if (lRow?.raw_data && typeof lRow.raw_data === 'object') rawLog = lRow.raw_data
  } catch { rawLog = {} }

  const concepto = conceptoFactura(dat)
  const datosProp = {
    nombre: v(dat.propietario || prop?.propietario),
    rut: v(prop?.rut),
    direccion: v(prop?.direccion),
    email: v(prop?.mail1),
    telefono: v(prop?.telefono),
    base: m(dat.comision_d_base),
    iva: m(dat.iva_comision_d),
    total: m(dat.comision_d_total),
    concepto,
  }
  const datosArr = {
    nombre: v(dat.arrendatario),
    rut: v(dat.rut),
    direccion: '',
    email: v(dat.mail_arrendatario),
    telefono: v(dat.movil),
    base: m(dat.comision_a_base),
    iva: m(dat.iva_comision_a),
    total: m(dat.comision_a_total),
    concepto,
  }

  // 6. Construir y enviar el email de facturación
  const subjectFact = `INFORMACION PARA FACTURACIÓN RELATIVA A IDADMON: ${idadmon}`

  const textoFact = [
    `Estimada Karina, te adjuntamos información para la facturación de las comisiones del IDADMON: ${idadmon}`,
    '',
    bloqueTexto('FACTURACION AL PROPIETARIO', datosProp),
    '',
    bloqueTexto('FACTURACION AL ARRENDATARIO', datosArr),
    '',
    'Ver cuadro de datos económicos en la versión HTML de este correo.',
    '',
    `Enviado por: ${email}`,
    'CRM FCR (mensaje automático).',
  ].join('\n')

  const filaHTML = (label, val) =>
    `<tr><td style="padding:1px 8px 1px 24px;color:#444;white-space:nowrap;">${esc(label)}</td><td style="padding:1px 8px;">${esc(val)}</td></tr>`
  const bloqueHTML = (titulo, p) => `
    <p style="margin:14px 0 4px;font-weight:700;">${esc(titulo)}</p>
    <table style="border-collapse:collapse;font-size:13px;">
      ${filaHTML('NOMBRE:', p.nombre)}
      ${filaHTML('RUT:', p.rut)}
      ${filaHTML('DIRECCION:', p.direccion)}
      ${filaHTML('EMAIL:', p.email)}
      ${filaHTML('TELEFONO:', p.telefono)}
      ${filaHTML('BASE IMP.:', p.base)}
      ${filaHTML('IVA:', p.iva)}
      ${filaHTML('TOTAL:', p.total)}
      ${filaHTML('CONCEPTO:', p.concepto)}
    </table>`

  const htmlFact = `
  <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#222;">
    <p>Estimada Karina, te adjuntamos información para la facturación de las comisiones del IDADMON: <b>${esc(idadmon)}</b></p>
    ${bloqueHTML('FACTURACION AL PROPIETARIO', datosProp)}
    ${bloqueHTML('FACTURACION AL ARRENDATARIO', datosArr)}
    <p style="margin-top:16px;">Saludos.</p>
    <p style="margin:0;">Enviado por: ${esc(email)}<br><span style="color:#888;">CRM FCR (mensaje automático).</span></p>
    ${cuadroEconomicoHTML(dat, rawLog)}
  </div>`

  const rFact = await enviarNotificacion({
    subject: subjectFact,
    autor: email,
    to: FACTURACION_TO,
    cc: FACTURACION_CC,
    cuerpo: textoFact,
    html: htmlFact,
  })

  return Response.json({
    ok: true,
    idadmon,
    estadoNuevo: 'S',
    emailEstado: rEstado.ok,
    emailFacturacion: rFact.ok,
  })
}