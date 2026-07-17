// VERSION: v1 · 2026-07-15 · app/api/cc1/reparar-inicios/route.js
//
// "REPARAR INICIOS" — herramienta de Dirección para contratos que YA están en S y que
// se activaron por un camino que NO escribió los cargos de inicio ni envió la facturación
// (activación manual, "corrección excepcional", o cierre con la versión previa al 11-jul).
//
// NO cambia el estado (el contrato ya está en S). Hace, en dos fases:
//   fase != 'ejecutar' (PREVIO): valida (anti-duplicado + datos), y DEVUELVE el previo de
//      cargos que escribiría, SIN tocar nada.
//   fase == 'ejecutar': escribe los cargos de inicio en `cuentas` y, si se pide, reenvía el
//      correo de facturación a Karina (Anthony en copia). REGISTRA el resultado del envío
//      en historico_idadmon (lo que el flujo normal hoy NO hace).
//
// Diferencias con cerrar-facturar:
//   - Solo Dirección (allowlist), no cualquiera con puedeCambiarEstado.
//   - Exige estado 'S' (cerrar-facturar exige 'P').
//   - No cambia estado ni manda el correo de "cambio de estado" (ese ya salió en su día).
//
// SEGURIDAD: validarInicios() bloquea si el contrato YA tiene filas calif='INICIO'
// (no se duplica). Los tres casos objetivo (A00832/A00834/A00858) tienen 0 inicios.
//
// NOTA (deuda técnica): el builder del email de facturación está duplicado aquí desde
// cerrar-facturar. Cuando se estabilice, extraer a lib/cc1Factura.js y que ambos lo usen.

import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { supabaseAdmin } from '../../../../lib/cc1Permisos'
import { validarInicios, construirCargosInicio } from '../../../../lib/cc1Inicios'
import { enviarNotificacion } from '../../../../lib/cc1Email'

// ─── Solo Dirección ─────────────────────────────────────────────────────────
// Allowlist explícita (mismo criterio que el panel /direccion). Ojo: el email debe
// coincidir EXACTO con el de login. Confirmar que son los correctos antes de desplegar.
const DIRECCION = new Set([
  'luis.cabezas@fondocapital.com',
  'alberto.cabezas@fondocapital.com',
])

// ─── Destinatarios del email de facturación (idénticos a cerrar-facturar) ────
const FACTURACION_TO = 'karina.morales@fondocapital.com'   // Finanzas
const FACTURACION_CC = 'anthony.mendoza@fondocapital.com'  // Legal (copia)

// ─── Helpers de formato/email (copiados verbatim de cerrar-facturar) ─────────
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
function filaHTML(label, val2) {
  return `<tr><td style="padding:1px 8px 1px 24px;color:#444;white-space:nowrap;">${esc(label)}</td><td style="padding:1px 8px;">${esc(val2)}</td></tr>`
}
function bloqueHTML(titulo, p) {
  return `
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
}

// Construye subject/text/html del email de facturación (idéntico a cerrar-facturar).
function construirEmailFacturacion(dat, prop, rawLog, autorEmail) {
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
  const subject = `INFORMACION PARA FACTURACIÓN RELATIVA A IDADMON: ${dat.idadmon}`
  const text = [
    `Estimada Karina, te adjuntamos información para la facturación de las comisiones del IDADMON: ${dat.idadmon}`,
    '',
    bloqueTexto('FACTURACION AL PROPIETARIO', datosProp),
    '',
    bloqueTexto('FACTURACION AL ARRENDATARIO', datosArr),
    '',
    'Ver cuadro de datos económicos en la versión HTML de este correo.',
    '',
    `Enviado por: ${autorEmail} (reenvío de facturación — reparación)`,
    'CRM FCR (mensaje automático).',
  ].join('\n')
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#222;">
    <p>Estimada Karina, te adjuntamos información para la facturación de las comisiones del IDADMON: <b>${esc(dat.idadmon)}</b></p>
    ${bloqueHTML('FACTURACION AL PROPIETARIO', datosProp)}
    ${bloqueHTML('FACTURACION AL ARRENDATARIO', datosArr)}
    <p style="margin-top:16px;">Saludos.</p>
    <p style="margin:0;">Enviado por: ${esc(autorEmail)} (reenvío de facturación — reparación)<br><span style="color:#888;">CRM FCR (mensaje automático).</span></p>
    ${cuadroEconomicoHTML(dat, rawLog)}
  </div>`
  return { subject, text, html }
}

// ─── Helpers de fecha / lectura (copiados de cerrar-facturar) ────────────────
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
  // 1. Sesión + Dirección
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!DIRECCION.has(email)) {
    return Response.json({ error: 'Solo Dirección puede reparar inicios.' }, { status: 403 })
  }

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const { idadmon, fase, dicom, proporcionalNota, reenviarCorreo = true } = body || {}
  if (!idadmon) return Response.json({ error: 'Falta idadmon' }, { status: 400 })

  // 2. Cargar contrato y exigir estado S
  const { data: dat, error: e0 } = await supabaseAdmin
    .from('datos_arriendos').select('*').eq('idadmon', idadmon).single()
  if (e0 || !dat) return Response.json({ error: 'Contrato no encontrado: ' + idadmon }, { status: 404 })
  if (dat.estado !== 'S') {
    return Response.json({
      error: `Esta herramienta solo repara contratos en S. ${idadmon} está en ${dat.estado}. ` +
             `Si está en P, actívalo con "CERRAR Y FACTURAR".`,
    }, { status: 409 })
  }

  // 3. Validación (incluye anti-duplicado: bloquea si ya hay filas INICIO)
  const iniciosExistentes = await leerInicios(idadmon)
  const val = validarInicios(dat, iniciosExistentes)
  if (!val.ok) {
    const yaTiene = iniciosExistentes.length > 0
    return Response.json({
      ok: false, bloqueado: true, idadmon, errores: val.errores,
      mensaje: yaTiene
        ? `${idadmon} ya tiene ${iniciosExistentes.length} línea(s) de INICIO: no se reprocesa (no se duplica).`
        : 'No se puede reparar: corrige los datos de inicio en el LOG antes.',
    }, { status: 422 })
  }

  const yaRenta = await hayRentaDelMesInicio(idadmon, dat.fecha1)

  // 4. FASE PREVIO — muestra lo que escribiría, sin tocar nada
  if (fase !== 'ejecutar') {
    const previo = construirCargosInicio(dat, {
      fechaHoy: fechaDDMMYYYY(new Date().toISOString().slice(0, 10)),
      dicom: dicom || { tiene: false, monto: 0 },
      proporcionalNota: proporcionalNota || null,
      yaHayRentaDelMesInicio: yaRenta,
    })
    return Response.json({
      ok: true, fase: 'previo', idadmon, estado: dat.estado,
      yaHayRentaDelMesInicio: yaRenta,
      reenviaraCorreo: !!reenviarCorreo,
      correoA: FACTURACION_TO, correoCC: FACTURACION_CC,
      comision: Number(dat.comision_a_total) || 0,
      previo: previo.map(f => ({ fecha: f.fecha, concepto: f.concepto, cargo: f.cargo })),
      nLineas: previo.length,
      mensaje: previo.length > 0
        ? 'Revisa el previo. No se ha escrito nada todavía.'
        : 'Este contrato no generaría ninguna línea de inicio (revisa los datos del LOG antes de ejecutar).',
    })
  }

  // 5. FASE EJECUTAR — escribe los inicios
  const fechaEvento = new Date().toISOString().slice(0, 10)
  let iniciosGenerados = null
  try {
    const filas = construirCargosInicio(dat, {
      fechaHoy: fechaDDMMYYYY(new Date().toISOString().slice(0, 10)),
      dicom: dicom || { tiene: false, monto: 0 },
      proporcionalNota: proporcionalNota || null,
      yaHayRentaDelMesInicio: yaRenta,
    })
    if (filas.length > 0) {
      const { error: eIns } = await supabaseAdmin.from('cuentas').insert(filas)
      iniciosGenerados = eIns ? { error: eIns.message } : filas.map(f => ({ fecha: f.fecha, concepto: f.concepto, cargo: f.cargo }))
    } else {
      iniciosGenerados = []
    }
    await supabaseAdmin.from('historico_idadmon').insert([{
      idadmon, evento: 'inicios_reparados',
      estado_anterior: 'S', estado_nuevo: 'S',
      fecha: fechaEvento, usuario: email,
      detalle: `reparación (Dirección): ${Array.isArray(iniciosGenerados) ? iniciosGenerados.length : 'ERROR'} lineas`,
    }])
  } catch (err) {
    iniciosGenerados = { error: String(err?.message || err) }
  }

  // 6. Reenvío del correo de facturación (opcional) + REGISTRO del resultado
  let correo = { intentado: false }
  if (reenviarCorreo) {
    let prop = null
    if (dat.idprop) {
      const { data: pRow } = await supabaseAdmin
        .from('propietarios').select('*').eq('idprop', dat.idprop).single()
      prop = pRow || null
    }
    let rawLog = {}
    try {
      const { data: lRow } = await supabaseAdmin
        .from('log').select('raw_data').eq('id_lcc', idadmon).maybeSingle()
      if (lRow?.raw_data && typeof lRow.raw_data === 'object') rawLog = lRow.raw_data
    } catch { rawLog = {} }

    const { subject, text, html } = construirEmailFacturacion(dat, prop, rawLog, email)
    const rFact = await enviarNotificacion({
      subject, autor: email,
      to: FACTURACION_TO, cc: FACTURACION_CC,
      cuerpo: text, html,
    })
    correo = { intentado: true, ok: !!rFact.ok, error: rFact.error || null, to: FACTURACION_TO }

    // ESTO es lo que el flujo normal hoy NO registra: dejamos rastro del envío.
    await supabaseAdmin.from('historico_idadmon').insert([{
      idadmon, evento: 'facturacion_reenviada',
      estado_anterior: 'S', estado_nuevo: 'S',
      fecha: fechaEvento, usuario: email, email_subject: subject,
      detalle: rFact.ok
        ? `correo de facturación reenviado OK a ${FACTURACION_TO}`
        : `FALLO al reenviar correo de facturación: ${rFact.error || 'desconocido'}`,
    }])
  }

  return Response.json({ ok: true, idadmon, estado: 'S', inicios: iniciosGenerados, correo })
}
