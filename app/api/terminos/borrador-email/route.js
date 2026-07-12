// VERSION: v1 · 2026-07-12 · app/api/terminos/borrador-email/route.js
//   Arma el BORRADOR editable de la notificación de liquidación de término (N16/N17).
//   Solo LEE datos y devuelve { to, subject, cuerpo } para que la UI lo muestre editable.
//   NO envía nada. Salvaguarda: exige que la liquidación esté GUARDADA (terminos.resultado_calculado);
//   así el correo nunca lleva cifras que solo están en pantalla sin confirmar.

import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin.js'

const n0 = v => { const x = Number(v); return isNaN(x) ? 0 : x }
const fmtPesos = n => '$' + n0(n).toLocaleString('es-CL')
const fmtFecha = s => {
  if (!s) return '—'
  const str = String(s).slice(0, 10)
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : str
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const { idadmon, destinatario } = body || {}
  if (!idadmon || !['arrendatario', 'propietario'].includes(destinatario)) {
    return Response.json({ error: 'Faltan idadmon o destinatario válido (arrendatario|propietario)' }, { status: 400 })
  }

  // 1. Contrato
  const { data: arr, error: eA } = await supabaseAdmin
    .from('datos_arriendos').select('*').eq('idadmon', idadmon).single()
  if (eA || !arr) return Response.json({ error: 'Contrato no encontrado: ' + idadmon }, { status: 404 })

  // 2. Liquidación guardada (SALVAGUARDA). Sin resultado_calculado => no enviar.
  const { data: term } = await supabaseAdmin
    .from('terminos').select('*').eq('idadmon', idadmon).maybeSingle()
  if (!term || term.resultado_calculado === null || term.resultado_calculado === undefined) {
    return Response.json({
      error: 'Este término no tiene liquidación guardada. Guarda el término (botón ✔ Guardar) antes de enviar el correo, para no mandar cifras sin confirmar.',
    }, { status: 409 })
  }

  // 3. Líneas guardadas -> totales por bloque
  const { data: lineas } = await supabaseAdmin
    .from('termino_lineas').select('bloque, concepto, monto').eq('idadmon', idadmon).order('orden')
  const porBloque = { garantia: [], servicios: [], reparaciones: [] }
  ;(lineas || []).forEach(l => { if (porBloque[l.bloque]) porBloque[l.bloque].push(l) })
  const sumB = b => (porBloque[b] || []).reduce((a, l) => a + n0(l.monto), 0)

  // 4. Destinatario y nombre
  let to = null, nombre = ''
  if (destinatario === 'arrendatario') {
    to = arr.mail_arrendatario || null
    nombre = arr.arrendatario || ''
  } else {
    nombre = arr.propietario || ''
    if (arr.idprop) {
      const { data: p } = await supabaseAdmin
        .from('propietarios').select('mail1, email_2, propietario').eq('idprop', arr.idprop).maybeSingle()
      to = p?.mail1 || p?.email_2 || null
      if (p?.propietario) nombre = p.propietario
    }
  }

  // 5. Cuerpo (texto plano, editable en la UI)
  const garantia = n0(arr.garantia_pedida)
  const quien = arr.quien_tiene_garantia || arr.garantia_con || '—'
  const resultado = n0(term.resultado_calculado)
  const aFavor = resultado >= 0

  const L = []
  L.push(`Estimado/a ${nombre || ''},`)
  L.push('')
  L.push(destinatario === 'arrendatario'
    ? `Le comunicamos la liquidación del término de su contrato de arriendo (${idadmon}), correspondiente al inmueble ${arr.inmueble || ''}.`
    : `Le informamos la liquidación del término del contrato (${idadmon}) de su propiedad ${arr.inmueble || ''}.`)
  L.push('')
  L.push(`Fecha de entrega   : ${fmtFecha(term.fecha_entrega)}`)
  L.push(`Garantía entregada : ${fmtPesos(garantia)} (en poder de: ${quien})`)
  L.push('')
  L.push('Detalle de cargos:')
  L.push(`  · Datos económicos / garantía : ${fmtPesos(sumB('garantia'))}`)
  L.push(`  · Servicios                   : ${fmtPesos(sumB('servicios'))}`)
  L.push(`  · Reparaciones                : ${fmtPesos(sumB('reparaciones'))}`)
  if (n0(term.markup_fcr) > 0) L.push(`  · Gestión FCR                 : ${fmtPesos(term.markup_fcr)}`)
  L.push('')
  L.push(aFavor
    ? `Resultado: saldo a favor de ${fmtPesos(Math.abs(resultado))}. Se procederá a la devolución correspondiente.`
    : `Resultado: saldo pendiente de ${fmtPesos(Math.abs(resultado))} a regularizar.`)
  L.push('')
  L.push('Ante cualquier duda, quedamos a su disposición.')
  L.push('')
  L.push('Atentamente,')
  L.push('Fondo Capital Rent SpA')

  const subject = destinatario === 'arrendatario'
    ? `Liquidación de término ${idadmon} — ${arr.inmueble || ''}`
    : `Liquidación de término ${idadmon} (propietario) — ${arr.inmueble || ''}`

  return Response.json({
    ok: true,
    destinatario,
    to: to || '',
    subject,
    cuerpo: L.join('\n'),
    sinEmail: !to,   // la UI avisa si no hay email en ficha (se puede escribir a mano)
  })
}
