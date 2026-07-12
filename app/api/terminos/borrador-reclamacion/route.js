// VERSION: v1 · 2026-07-12 · app/api/terminos/borrador-reclamacion/route.js
//   Arma el BORRADOR editable de la RECLAMACIÓN de saldo pendiente al ex-arrendatario (y aval).
//   Solo LEE datos y devuelve { to, cc, subject, cuerpo, saldo }. NO envía nada.
//   Salvaguardas: (1) la liquidación debe estar GUARDADA (terminos.resultado_calculado);
//   (2) solo hay reclamación si el resultado es NEGATIVO (queda saldo a cobrar). Si es ≥ 0 → aviso.
//   cc al aval es CONDICIONAL: si no hay avalista, va sin cc (solo al arrendatario).

import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin.js'

const n0 = v => { const x = Number(v); return isNaN(x) ? 0 : x }
const fmtPesos = n => '$' + n0(n).toLocaleString('es-CL')

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const { idadmon } = body || {}
  if (!idadmon) return Response.json({ error: 'Falta idadmon' }, { status: 400 })

  // 1. Contrato
  const { data: arr, error: eA } = await supabaseAdmin
    .from('datos_arriendos').select('*').eq('idadmon', idadmon).single()
  if (eA || !arr) return Response.json({ error: 'Contrato no encontrado: ' + idadmon }, { status: 404 })

  // 2. Liquidación guardada + saldo negativo (SALVAGUARDAS)
  const { data: term } = await supabaseAdmin
    .from('terminos').select('resultado_calculado, tipo_resultado').eq('idadmon', idadmon).maybeSingle()
  if (!term || term.resultado_calculado === null || term.resultado_calculado === undefined) {
    return Response.json({
      error: 'Este término no tiene liquidación guardada. Guarda el término (✔ Guardar) antes de reclamar, para no reclamar cifras sin confirmar.',
    }, { status: 409 })
  }
  const resultado = n0(term.resultado_calculado)
  if (resultado >= 0) {
    return Response.json({
      error: 'Este término no tiene saldo a reclamar (el resultado es a favor / cero). La reclamación solo aplica cuando queda saldo pendiente del arrendatario.',
    }, { status: 409 })
  }
  const saldo = Math.abs(resultado)

  // 3. Destinatarios: arrendatario (to) + aval (cc, CONDICIONAL)
  //    ⚠ CONFIRMAR contra Supabase los nombres reales de las columnas del aval en datos_arriendos.
  //    Si no hay avalista, cc queda vacío y el correo sale solo al arrendatario.
  const to = arr.mail_arrendatario || ''
  const nombreArr = arr.arrendatario || ''
  const cc = arr.mail_avalista || arr.email_avalista || arr.mail_aval || ''
  const nombreAval = arr.avalista || arr.nombre_avalista || arr.aval || ''
  const hayAval = !!cc

  // 4. Cuerpo (texto plano editable en la UI)
  const L = []
  L.push(`Estimado/a ${nombreArr || ''}${hayAval && nombreAval ? ' y ' + nombreAval + ' (aval)' : ''},`)
  L.push('')
  L.push(`Tras la liquidación del término de su contrato de arriendo (${idadmon}), correspondiente al inmueble ${arr.inmueble || ''}, se ha determinado un saldo pendiente a su cargo.`)
  L.push('')
  L.push(`Saldo pendiente a regularizar: ${fmtPesos(saldo)}`)
  L.push('')
  if (hayAval) L.push('Como aval del contrato, esta comunicación se dirige también al garante, solidariamente responsable de la deuda.')
  L.push('Le solicitamos regularizar el importe indicado en un plazo de 10 días corridos desde la recepción de este correo.')
  L.push('')
  L.push('De no recibirse el pago en el plazo señalado, Fondo Capital Rent SpA se reserva el derecho de iniciar las gestiones de cobranza que correspondan.')
  L.push('')
  L.push('Quedamos atentos a su respuesta para acordar la forma de pago.')
  L.push('')
  L.push('Atentamente,')
  L.push('Fondo Capital Rent SpA')

  const subject = `Reclamación de saldo pendiente — término ${idadmon}${arr.inmueble ? ' (' + arr.inmueble + ')' : ''}`

  return Response.json({
    ok: true,
    to,
    cc,
    subject,
    cuerpo: L.join('\n'),
    saldo,
    hayAval,
    sinEmail: !to,   // la UI avisa si el arrendatario no tiene email en ficha
  })
}
