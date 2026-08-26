// VERSION: v1 · 2026-08-25 · app/api/bb2/terminar/route.js — PASO 3 de BB2: "Terminar e informar".
//   POST { id }. Cuando Anthony (o Dirección) da por terminado un arriendo sin administración (R00xxx),
//   envía a Karina (Finanzas) el correo de facturación de las DOS comisiones (propietario y arrendatario),
//   con Legal en copia, y marca la operación como HECHO (protegida). Espejo del aviso de facturación de CC1
//   (cerrar-facturar), pero sobre el modelo BB2 (tabla `log`, raw_data mapeado por lib/bb2Log).
//   ATÓMICO: solo marca HECHO si el correo salió; si el correo falla, NO marca HECHO (se puede reintentar).
//   Gate: Dirección + Anthony (los mismos que editan BB2).
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin.js'
import { modelDesdeRaw, HECHO_RAW_KEY } from '../../../../lib/bb2Log.js'
import { enviarNotificacion } from '../../../../lib/cc1Email'

const DIRECCION = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com']
const AUTORIZADOS = [...DIRECCION, 'anthony.mendoza@fondocapital.com']

// Destinatarios del correo de facturación (igual criterio que CC1: Finanzas + Legal en copia).
const FACTURACION_TO = 'karina.morales@fondocapital.com'
const FACTURACION_CC = 'legal@fondocapital.com'

const v = (x) => (x === null || x === undefined) ? '' : String(x)
const esc = (x) => v(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
// Formatea un importe a "$ n.nnn" (miles es-CL). Vacío -> ''.
function m(x) {
  const s = v(x).trim()
  if (!s) return ''
  const n = Number(s.replace(/\./g, '').replace(/[^\d-]/g, ''))
  if (isNaN(n)) return s
  return '$' + n.toLocaleString('es-CL')
}

// Junta persona + su comisión en el bloque que necesita Karina para facturar.
function bloqueDatos(titulo, p, com, concepto) {
  p = p || {}; com = com || {}
  return {
    titulo,
    nombre: v(p.nombre), rut: v(p.rut), direccion: v(p.direccion),
    email: v(p.email), telefono: v(p.telefono),
    base: m(com.neto), iva: m(com.iva), total: m(com.total),
    doc: v(com.doc), concepto,
  }
}

function bloqueTexto(d) {
  return [
    d.titulo,
    `  NOMBRE    : ${d.nombre || '—'}`,
    `  RUT       : ${d.rut || '—'}`,
    `  DIRECCION : ${d.direccion || '—'}`,
    `  EMAIL     : ${d.email || '—'}`,
    `  TELEFONO  : ${d.telefono || '—'}`,
    `  BASE IMP. : ${d.base || '—'}`,
    `  IVA       : ${d.iva || '—'}`,
    `  TOTAL     : ${d.total || '—'}`,
    `  DOCUMENTO : ${d.doc || '—'}`,
    `  CONCEPTO  : ${d.concepto || '—'}`,
  ].join('\n')
}

function bloqueHTML(d) {
  const fila = (label, val) =>
    `<tr><td style="padding:1px 8px 1px 24px;color:#444;white-space:nowrap;">${esc(label)}</td><td style="padding:1px 8px;">${esc(val || '—')}</td></tr>`
  return `
    <p style="margin:14px 0 4px;font-weight:700;">${esc(d.titulo)}</p>
    <table style="border-collapse:collapse;font-size:13px;">
      ${fila('NOMBRE:', d.nombre)}
      ${fila('RUT:', d.rut)}
      ${fila('DIRECCIÓN:', d.direccion)}
      ${fila('EMAIL:', d.email)}
      ${fila('TELÉFONO:', d.telefono)}
      ${fila('BASE IMP.:', d.base)}
      ${fila('IVA:', d.iva)}
      ${fila('TOTAL:', d.total)}
      ${fila('DOCUMENTO:', d.doc)}
      ${fila('CONCEPTO:', d.concepto)}
    </table>`
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!AUTORIZADOS.includes(email)) {
    return Response.json({ error: 'Solo Dirección y Anthony pueden terminar una operación BB2.' }, { status: 403 })
  }

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const id = String(body?.id || '').trim().toUpperCase()
  if (!/^R\d+/.test(id)) return Response.json({ error: 'IdArriendo inválido (se espera R00xxx).' }, { status: 400 })

  // 1) Cargar la operación desde el LOG
  const { data: row, error: eRow } = await supabaseAdmin.from('log').select('raw_data').eq('id_lcc', id).maybeSingle()
  if (eRow) return Response.json({ error: 'Error al leer la operación: ' + eRow.message }, { status: 500 })
  if (!row) return Response.json({ error: 'No existe la operación ' + id + '. Guárdala antes de terminar.' }, { status: 404 })
  const raw = row.raw_data || {}
  if (/HECHO/i.test(String(raw[HECHO_RAW_KEY] || ''))) {
    return Response.json({ error: 'La operación ' + id + ' ya estaba terminada (HECHO). Para reenviar el aviso, desbloquéala primero.', yaHecho: true }, { status: 409 })
  }

  // 2) Construir los dos bloques de facturación desde el modelo mapeado
  const model = modelDesdeRaw(raw)
  const concepto = ('COMISION ARRENDAMIENTO ' + v(model.inmueble?.direccion)).trim()
  const dProp = bloqueDatos('FACTURACIÓN AL PROPIETARIO', model.personas?.prop, model.comD, concepto)
  const dArr = bloqueDatos('FACTURACIÓN AL ARRENDATARIO', model.personas?.arr, model.comA, concepto)

  if (!dProp.nombre && !dArr.nombre) {
    return Response.json({ error: 'La operación no tiene propietario ni arrendatario: no hay nada que facturar. Revisa la ficha.' }, { status: 400 })
  }

  // 3) Email a Karina (CC Legal)
  const subject = `INFORMACION PARA FACTURACIÓN RELATIVA A IdArriendo: ${id}`
  const textoFact = [
    `Estimada Karina, te pasamos la información para facturar las comisiones del arriendo sin administración ${id}.`,
    '',
    bloqueTexto(dProp),
    '',
    bloqueTexto(dArr),
    '',
    `Terminado por: ${email}`,
    'CRM FCR (mensaje automático).',
  ].join('\n')

  const htmlFact = `
  <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#222;">
    <p>Estimada Karina, te pasamos la información para facturar las comisiones del arriendo sin administración <b>${esc(id)}</b>.</p>
    ${bloqueHTML(dProp)}
    ${bloqueHTML(dArr)}
    <p style="margin-top:16px;">Saludos.</p>
    <p style="margin:0;">Terminado por: ${esc(email)}<br><span style="color:#888;">CRM FCR (mensaje automático).</span></p>
  </div>`

  const rMail = await enviarNotificacion({
    subject, autor: email,
    to: FACTURACION_TO, cc: FACTURACION_CC,
    cuerpo: textoFact, html: htmlFact,
  })
  if (!rMail.ok) {
    return Response.json({ error: 'No se pudo enviar el correo a Karina: ' + (rMail.error || 'error de envío') + '. La operación NO se marcó como terminada; reinténtalo.' }, { status: 500 })
  }

  // 4) Solo si el correo salió: marcar HECHO (protege la operación)
  const rawHecho = { ...raw, [HECHO_RAW_KEY]: 'HECHO' }
  const up = await supabaseAdmin.from('log').update({ raw_data: rawHecho, updated_at: new Date().toISOString() }).eq('id_lcc', id)
  if (up.error) {
    return Response.json({ error: 'Correo enviado a Karina, pero no se pudo marcar HECHO: ' + up.error.message + '. Márcala/termínala de nuevo o avisa a Dirección.', emailOk: true }, { status: 500 })
  }

  return Response.json({ ok: true, id, emailOk: true, to: FACTURACION_TO, cc: FACTURACION_CC })
}
