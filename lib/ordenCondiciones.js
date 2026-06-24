// =====================================================================
// Texto de la ORDEN DE VISITA (condensado del Word original).
// Editable: si cambian las clausulas, se ajustan aqui y todas las
// ordenes nuevas las toman. Las ordenes ya generadas guardan su propio
// snapshot, asi que no cambian retroactivamente.
// =====================================================================

export const CORREDOR = {
  razon: 'Fondo Capital Rent Spa',
  oficina: 'Badajoz 100, oficina 1014, Las Condes',
}

export const CONDICIONES = [
  {
    n: 1, titulo: 'Confidencialidad',
    texto: 'La información entregada pertenece a Fondo Capital Rent Spa, es confidencial, personal e intransferible, y solo puede usarse para continuar el negocio por intermedio de este corredor.',
  },
  {
    n: 2, titulo: 'Obligaciones del CLIENTE',
    texto: 'De interesarse por alguna propiedad, el CLIENTE se obliga a: a) informar a Fondo Capital Rent Spa de su interés; b) efectuar los trámites de compra, arriendo o gestión por intermedio de Fondo Capital Rent Spa; c) al cerrar el negocio, pagar la comisión e impuestos correspondientes, especialmente si ha expirado el plazo del mandato del propietario y/o de la orden de visita, o si no pudiera continuarse el negocio sin intervención directa del corredor; d) documentar con cheque la oferta o reserva; e) responder ante el propietario por los perjuicios que cause al inmueble con ocasión de las visitas; f) si solicita esta orden para un tercero, declara bajo juramento que cuenta con su expresa autorización para recibirla en señal de aceptación.',
  },
  {
    n: 3, titulo: 'Comisión de corretaje',
    texto: 'El CLIENTE y el propietario pagarán al corredor: a) 2% más IVA del valor de la transacción en compraventa; b) 2% más IVA en permuta, por cada propiedad involucrada; c) 50% más IVA de la primera renta mensual en arriendo, o 2% más IVA sobre el monto total del contrato cuando este supere los dos años; d) en arriendo con opción de compra o con promesa de compra, 2% más IVA del valor de venta convenido, pagadero a más tardar a la fecha de suscripción de la compraventa. La comisión se devenga al producirse el acuerdo entre las partes y se paga al contado al firmarse el contrato respectivo, o en la oportunidad en que debió firmarse. Si el CLIENTE realiza el negocio directamente con los dueños o entrega información a un tercero para concretarlo prescindiendo del CORREDOR, pagará a título de multa la comisión normal del negocio más dos veces su monto, con sus impuestos, intereses y costas. El CLIENTE declara que esta es la primera oficina que le ha ofrecido estos negocios y se compromete a efectuar toda transacción de las propiedades ofrecidas por su intermedio.',
  },

  {
    n: 5, titulo: 'Aceptación y jurisdicción',
    texto: 'Cualquier dificultad sobre el cobro de la comisión será resuelta por la justicia ordinaria. Si esta orden es enviada por cualquier medio, transcurridas 48 horas sin reclamo por escrito al destinatario, se entenderá irrevocablemente aceptada. El CLIENTE declara haber solicitado y recibido esta orden de la oficina de Fondo Capital Rent Spa, ubicada en Badajoz 100, oficina 1014, Las Condes, y que cuenta con su autorización y encargo.',
  },
]

export function introTexto(c = {}) {
  const g = v => v || '__________'
  const docLabel = c.docLabel || 'R.U.T.'
  return `Fondo Capital Rent Spa (en adelante, el CORREDOR) autoriza a ${g(c.nombre)}, ${docLabel} ${g(c.rut)}, domiciliado en ${g(c.domicilio)}, comuna de ${g(c.comuna)}, correo ${g(c.email)}, teléfono ${g(c.telefono)} (en adelante, el CLIENTE), a visitar las propiedades en venta y/o arriendo que se individualizan más abajo. El CORREDOR entrega esta información en cumplimiento de sus servicios de intermediación, en los términos y condiciones que siguen, los que el CLIENTE acepta íntegramente.`
}
