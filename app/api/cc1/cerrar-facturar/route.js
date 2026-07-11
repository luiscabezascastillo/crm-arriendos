// VERSION: v2 · 2026-07-11 · P→S (CERRAR Y FACTURAR) ahora valida + escribe INICIOS en cuentas (dos fases)
//
// app/api/cc1/cerrar-facturar/route.js
//
// "CERRAR Y FACTURAR" — cierre de la carga de un contrato que está en P.
// Recibe { idadmon, fase?, dicom?, proporcionalNota? }. Solo procede si el contrato está en P.
//
// Hace, en orden:
//   1. Valida sesión + permiso (puedeCambiarEstado).
//   2. Verifica que el contrato exista y esté en P.
//   NUEVO 2b. VALIDA los datos de inicio (garantía en pesos, sin descuadre, proporcional
//      coherente, factor UF válido, sin duplicados). Si falla -> 422, NO cambia estado.
//      Si fase != 'ejecutar' -> devuelve validación + previo + pide DICOM (no cambia estado).
//   3. Cambia el estado P -> S en datos_arriendos.
//   4. Registra el evento y envía el email de cambio de estado a cambiosdeestado@.
//   NUEVO 4b. ESCRIBE los cargos de inicio en `cuentas` (garantía/proporcional/comisión/DICOM).
//   5. Lee la ficha del propietario y construye el email de facturación.
//   6. Envía ese email a Finanzas (Karina), con Legal en copia.
//
// Devuelve { ok, idadmon, estadoNuevo:'S', emailEstado, emailFacturacion, inicios } o,
// en fase 'validar', { ok, validado, necesitaDicom, previo, ... } / { bloqueado, errores }.

import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { supabaseAdmin, getCapacidades } from '../../../../lib/cc1Permisos'
import { buildSubject, enviarNotificacion } from '../../../../lib/cc1Email'
import { validarInicios, construirCargosInicio } from '../../../../lib/cc1Inicios'

// ─── Destinatarios del email de facturación ─────────────────────────────────
const FACTURACION_TO = 'karina.morales@fondocapital.com'   // Finanzas
const FACTURACION_CC = 'anthony.mendoza@fondocapital.com'  // Legal (copia)

function v(x) {
  if (x === null || x === undefined || x === '') return ''
  return String(x)
}
function m(x) {
  if (x === null || x === undefined || x === '') return ''
  const n = Number(String(x).replace(/\./g, '').replace(/[^\d-]/g, ''))
  if (isNaN(n)) return String(x)
  return n.toLocaleString('es-CL')
}
function esc(x) {
  return v(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function conceptoFactura(dat) {
  let c = `COMISION ARRENDAMIENTO ${v(dat.inmueble)}`.trim()
  if (v(dat.estac)) c += `, Estacionamiento ${v(dat.estac)}`
  return c
}
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
function filaEco(label, valor, bold) {
  const tdL = 'padding:2px 6px;font-size:11px;color:#1f5023;background:#bcdcbd;font-weight:600;white-space:nowrap;'
  const tdV = `padding:2px 6px;font-size:11px;background:#e8f4e8;${bold ? 'font-weight:700;' : ''}`
  return `<tr><td style="${tdL}">${esc(label)}</td><td style="${tdV}">${esc(valor)}</td></tr>`
}
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

function fechaDDMMYYYY(f) {
  if (!f) return null
  const s = String(f)
  const m1 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (m1) return `${m1[1]}/${m1[2]}/${m1[3]}`
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m2) return `${m2[3]}/${m2[2]}/${m2[1]}`
  return s
}
function mesAnio(f) {
  if (!f) return null
  const s = String(f)
  const m1 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (m1) return `${m1[2]}/${m1[3]}`
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m2) return `${m2[2]}/${m2[1]}`
  return null
}
async function leerInicios(idadmon) {
  const { data } = await supabaseAdmin
    .from('cuentas').select('id, concepto, calif')
    .eq('idadmon', idadmon).eq('calif', 'INICIO')
  return data || []
}
// Conservador: ante la duda devuelve TRUE (=> NO carga proporcional; mejor que falte a que duplique).
async function hayRentaDelMesInicio(idadmon, fechaInicio) {
  const mesIni = mesAnio(fechaInicio)
  if (!mesIni) return true
  const { data } = await supabaseAdmin
    .from('cuentas').select('fecha, concepto, calif, cargo').eq('idadmon', idadmon)
  if (!data) return false
  const [mm, yyyy] = mesIni.split('/')
  const nombresMes = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE']
  const nombreMes = nombresMes[parseInt(mm, 10) - 1] || ''
  for (const r of data) {
    if (r.calif === 'INICIO') continue
    if (!(Number(r.cargo) > 0)) continue
    if (mesAnio(r.fecha) === mesIni) return true
    const con = String(r.concepto || '').toUpperCase()
    if (nombreMes && con.includes(nombreMes) && (con.includes(yyyy) || con.includes(yyyy.slice(2)))) return true
  }
  return false
}

export async function POST(req) {
  // 1. Sesión + permiso
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })

  const cap = await getCapacidades(email)
  if (!cap.puedeCambiarEstado) {
    return Response.json({ error: 'Sin permiso para cerrar contratos (requiere responsable/supervisor en Gestión LOG).' }, { status: 403 })
  }

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const { idadmon, fase, dicom, proporcionalNota } = body || {}
  if (!idadmon) return Response.json({ error: 'Falta idadmon' }, { status: 400 })

  // 2. Cargar contrato y verificar que está en P
  const { data: dat, error: e0 } = await supabaseAdmin
    .from('datos_arriendos').select('*').eq('idadmon', idadmon).single()
  if (e0 || !dat) return Response.json({ error: 'Contrato no encontrado: ' + idadmon }, { status: 404 })
  if (dat.estado !== 'P') {
    return Response.json({ error: `El contrato ${idadmon} no está en estado P (está en ${dat.estado}). Esta acción solo cierra contratos en P.` }, { status: 409 })
  }

  // ─────────────────────────────────────────────────────────────
  // 2b. NUEVO — VALIDACIÓN DE INICIOS (bloqueante, antes de cambiar estado)
  // ─────────────────────────────────────────────────────────────
  const iniciosExistentes = await leerInicios(idadmon)
  const val = validarInicios(dat, iniciosExistentes)

  if (!val.ok) {
    // BLOQUEO: el estado NO cambia. Corregir en el LOG.
    return Response.json({
      ok: false, bloqueado: true, fase: 'validar', idadmon,
      errores: val.errores,
      mensaje: 'No se puede activar (P→S): corrige los datos de inicio en el LOG antes.',
    }, { status: 422 })
  }

  if (fase !== 'ejecutar') {
    // Validación OK pero aún NO ejecutamos: pedimos DICOM y mostramos el previo.
    const yaRenta = await hayRentaDelMesInicio(idadmon, dat.fecha1)
    const previo = construirCargosInicio(dat, {
      fechaHoy: fechaDDMMYYYY(new Date().toISOString().slice(0, 10)),
      dicom: { tiene: false, monto: 0 },
      yaHayRentaDelMesInicio: yaRenta,
    })
    return Response.json({
      ok: true, fase: 'validar', validado: true, necesitaDicom: true,
      yaHayRentaDelMesInicio: yaRenta,
      previo: previo.map(f => ({ fecha: f.fecha, concepto: f.concepto, cargo: f.cargo })),
      mensaje: 'Datos de inicio válidos. Confirma el DICOM para completar la activación.',
    })
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
    subject: subjectCambio, autor: email,
    idadmon, estadoAnterior: 'P', estadoNuevo: 'S',
    propietario: dat.propietario, inmueble: dat.inmueble, fecha: fechaEvento,
  })

  // ─────────────────────────────────────────────────────────────
  // 4b. NUEVO — ESCRIBIR CARGOS DE INICIO EN `cuentas`
  // ─────────────────────────────────────────────────────────────
  let iniciosGenerados = null
  try {
    const yaRenta = await hayRentaDelMesInicio(idadmon, dat.fecha1)
    const filas = construirCargosInicio(dat, {
      fechaHoy: fechaDDMMYYYY(new Date().toISOString().slice(0, 10)),
      dicom: dicom || { tiene: false, monto: 0 },
      proporcionalNota: proporcionalNota || null,
      yaHayRentaDelMesInicio: yaRenta,
    })
    if (filas.length > 0) {
      const { error: eIns } = await supabaseAdmin.from('cuentas').insert(filas)
      if (eIns) {
        // El estado YA cambió a S; reportamos que faltó escribir inicios (no abortamos la facturación).
        iniciosGenerados = { error: eIns.message }
      } else {
        iniciosGenerados = filas.map(f => ({ fecha: f.fecha, concepto: f.concepto, cargo: f.cargo }))
      }
    } else {
      iniciosGenerados = []
    }
    await supabaseAdmin.from('historico_idadmon').insert([{
      idadmon, evento: 'inicios_generados',
      estado_anterior: 'P', estado_nuevo: 'S',
      fecha: fechaEvento, usuario: email,
      detalle: `inicios auto: ${Array.isArray(iniciosGenerados) ? iniciosGenerados.length : 'ERROR'} lineas`,
    }])
  } catch (err) {
    iniciosGenerados = { error: String(err?.message || err) }
  }

  // 5. Ficha del propietario (tabla propietarios, por idprop)
  let prop = null
  if (dat.idprop) {
    const { data: pRow } = await supabaseAdmin
      .from('propietarios').select('*').eq('idprop', dat.idprop).single()
    prop = pRow || null
  }

  // 5b. raw_data del LOG
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

  const filaHTML = (label, val2) =>
    `<tr><td style="padding:1px 8px 1px 24px;color:#444;white-space:nowrap;">${esc(label)}</td><td style="padding:1px 8px;">${esc(val2)}</td></tr>`
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
    subject: subjectFact, autor: email,
    to: FACTURACION_TO, cc: FACTURACION_CC,
    cuerpo: textoFact, html: htmlFact,
  })

  return Response.json({
    ok: true,
    idadmon,
    estadoNuevo: 'S',
    emailEstado: rEstado.ok,
    emailFacturacion: rFact.ok,
    inicios: iniciosGenerados,   // array de cargos, [], o {error}
  })
}
