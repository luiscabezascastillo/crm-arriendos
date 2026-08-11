// VERSION: v2 · 2026-08-11 · app/api/terminos/borrador-email/route.js
//   REDISEÑO de los textos (los antiguos no gustaban) y NUEVOS modos. Arma el BORRADOR editable del correo del
//   término. Solo LEE y devuelve { to, cc, subject, cuerpo, saldo, aFavor, sinEmail, contactos } — NO envía nada.
//   Modos (destinatario):
//     · arrendatario → si hay saldo a cobrar: texto de invitación a pagar + DATOS DE PAGO (Banco Internacional).
//                       si sale a favor: texto de DEVOLUCIÓN. cc = email del aval (si lo hay).
//     · propietario  → texto informativo.
//     · presupuesto  → texto para enviar el presupuesto; `to` vacío (se elige destinatario en la UI) y `contactos`
//                       trae los correos de arrendatario / propietario / aval para elegir.
//   Salvaguarda: arrendatario/propietario exigen liquidación GUARDADA (terminos.resultado_calculado). Hereda v1.

import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin.js'

const n0 = v => { const x = Number(v); return isNaN(x) ? 0 : x }
const fmtPesos = n => '$' + n0(n).toLocaleString('es-CL')
const nombreUsuario = u => { const p = String(u || '').split('@')[0]; return p ? p.replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '' }

// Datos de pago estándar de FCR (Banco Internacional). Editable siempre en la UI antes de enviar.
const DATOS_PAGO = [
  'Datos para la transferencia:',
  '  Titular            : Fondo Capital Rent SpA',
  '  RUT                : 76.828.712-0',
  '  Banco              : Banco Internacional',
  '  Cuenta corriente   : 9021362',
  '  Enviar comprobante : administracion@fondocapital.com',
].join('\n')

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  const remitente = nombreUsuario(email)

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const { idadmon, destinatario } = body || {}
  if (!idadmon || !['arrendatario', 'propietario', 'presupuesto'].includes(destinatario)) {
    return Response.json({ error: 'Faltan idadmon o destinatario válido (arrendatario|propietario|presupuesto)' }, { status: 400 })
  }

  // 1. Contrato
  const { data: arr, error: eA } = await supabaseAdmin
    .from('datos_arriendos').select('*').eq('idadmon', idadmon).single()
  if (eA || !arr) return Response.json({ error: 'Contrato no encontrado: ' + idadmon }, { status: 404 })
  const inmueble = arr.inmueble || ''

  // Correos de las partes (para destinatario y para el selector de presupuesto).
  const mailArr = arr.mail_arrendatario || ''
  const mailAval = String(arr.mail_avalista || arr.email_avalista || arr.mail_aval || '').trim()
  let mailProp = '', nombreProp = arr.propietario || ''
  if (arr.idprop) {
    const { data: p } = await supabaseAdmin
      .from('propietarios').select('mail1, email_2, propietario').eq('idprop', arr.idprop).maybeSingle()
    mailProp = p?.mail1 || p?.email_2 || ''
    if (p?.propietario) nombreProp = p.propietario
  }
  const contactos = { arrendatario: mailArr, propietario: mailProp, aval: mailAval }

  const firma = ['', 'Atentamente,', remitente || 'Fondo Capital Rent', 'Fondo Capital Rent SpA'].join('\n')

  // ── MODO PRESUPUESTO ── (no exige liquidación guardada; el destinatario se elige en la UI)
  if (destinatario === 'presupuesto') {
    const cuerpo = [
      'Estimado/a:',
      '',
      `Junto con saludar, adjuntamos el presupuesto de reparaciones correspondiente al inmueble ${inmueble}, para su revisión.`,
      '',
      'Quedamos atentos a sus comentarios.',
      firma,
    ].join('\n')
    return Response.json({
      ok: true, destinatario, to: '', cc: '',
      subject: `Presupuesto de reparaciones — ${inmueble} (${idadmon})`,
      cuerpo, saldo: 0, aFavor: false, sinEmail: false, contactos,
    })
  }

  // ── MODO ARRENDATARIO / PROPIETARIO ── (exigen liquidación guardada)
  const { data: term } = await supabaseAdmin
    .from('terminos').select('*').eq('idadmon', idadmon).maybeSingle()
  if (!term || term.resultado_calculado === null || term.resultado_calculado === undefined) {
    return Response.json({
      error: 'Este término no tiene liquidación guardada. Guarda el término (botón ✔ Guardar) antes de enviar el correo, para no mandar cifras sin confirmar.',
    }, { status: 409 })
  }
  const resultado = n0(term.resultado_calculado)
  const aFavor = resultado >= 0
  const saldo = Math.abs(resultado)

  if (destinatario === 'arrendatario') {
    const L = [`Estimado/a ${arr.arrendatario || ''}:`, '',
      `Junto con saludar, adjuntamos la liquidación final de su contrato de arriendo del inmueble ${inmueble}, una vez recibido el inmueble y realizadas las revisiones correspondientes.`, '']
    if (aFavor) {
      L.push(`Según el detalle adjunto, resulta un saldo a su favor de ${fmtPesos(saldo)}, que le será devuelto. Nos pondremos en contacto para coordinar la devolución.`)
      L.push('')
      L.push('Quedamos atentos a cualquier consulta.')
    } else {
      L.push(`Según el detalle adjunto, queda un saldo pendiente a su cargo de ${fmtPesos(saldo)}, que le agradeceremos regularizar dentro de los próximos 5 días hábiles mediante transferencia a:`)
      L.push('')
      L.push(DATOS_PAGO)
      L.push('')
      L.push('Una vez recibido el pago le haremos llegar el comprobante correspondiente. Quedamos atentos a cualquier consulta.')
    }
    L.push(firma)
    return Response.json({
      ok: true, destinatario, to: mailArr, cc: mailAval || '',
      subject: `Liquidación final de arriendo — ${inmueble} (${idadmon})`,
      cuerpo: L.join('\n'), saldo, aFavor, sinEmail: !mailArr, contactos,
    })
  }

  // propietario
  const L = [`Estimado/a ${nombreProp || ''}:`, '',
    `Junto con saludar, le informamos que hemos cerrado la liquidación del término de contrato del inmueble ${inmueble}. Adjuntamos el detalle para su información.`, '',
    'Quedamos atentos a cualquier consulta.', firma]
  return Response.json({
    ok: true, destinatario, to: mailProp, cc: '',
    subject: `Liquidación de término — ${inmueble} (${idadmon})`,
    cuerpo: L.join('\n'), saldo, aFavor, sinEmail: !mailProp, contactos,
  })
}
