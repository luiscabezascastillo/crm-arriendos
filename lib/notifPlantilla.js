// Plantilla compartida del recordatorio de arriendo.
// La usan tanto el endpoint de envío como el de previsualización, para que
// la vista previa sea idéntica al correo que se envía.

export const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('es-CL')

export function splitEmails(s) {
  if (!s) return []
  return String(s).split(';').map((e) => e.trim()).filter(Boolean)
}

export function esUF(revision) {
  return (revision || '').trim().toUpperCase() === 'UF'
}

// Fecha "01/MM/YYYY" a partir de 'YYYY-MM-01'
export function primerDia(mes) {
  if (!mes) return ''
  const [y, m] = String(mes).split('-')
  return `01/${m}/${y}`
}

export function asuntoArriendo(mesLabel) {
  return `RECORDATORIO AUTOMÁTICO DEL PAGO DEL ARRIENDO DEL MES DE ${(mesLabel || '').toUpperCase()}`
}

// n: { idadmon, arrendatario, propiedad, apagar, revision, ajusteTipo, ajusteMonto }
// ctx: { mes, mesLabel, valorUf }
export function plantillaArriendo(n, ctx) {
  const M = (ctx.mesLabel || '').toUpperCase()
  const uf = esUF(n.revision)

  const bloqueUF = uf
    ? `<p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 12px;">
         Como su contrato es en UF, se le ha aplicado el valor de esta al día ${primerDia(ctx.mes)},
         que de acuerdo con el SII es de ${fmt(ctx.valorUf)} pesos.
       </p>`
    : ''

  const bloqueAjuste = (!uf && Number(n.ajusteMonto) > 0)
    ? `<p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 12px;">
         Su contrato especifica un ajuste${n.ajusteTipo ? ` <strong>${n.ajusteTipo}</strong>` : ''}
         que se le aplica desde el ${primerDia(ctx.mes)} que, de acuerdo con el
         incremento de la UF/IPC, le corresponde un ajuste de <strong>${fmt(n.ajusteMonto)}</strong> pesos.
       </p>`
    : ''

  const recuerdo = `
    <div style="border-top:1px solid #E5E7EB;margin-top:18px;padding-top:14px;font-size:12px;color:#6B7280;line-height:1.6;">
      <p style="margin:0 0 8px;font-weight:600;color:#374151;">SI YA HA PAGADO IGNORE ESTE MENSAJE.</p>
      <p style="margin:0 0 6px;">* LE RECORDAMOS QUE LAS FECHAS DE PAGO SON DEL 1 AL 3 O DEL 1 AL 5 DEL MES, AMBOS INCLUSIVE, SEGÚN ESTIPULE SU CONTRATO. El no hacerlo antes puede resultar en cargos de intereses e incluso, en algún caso, multas. Si ya ha realizado este pago le rogamos ignore esta comunicación.</p>
      <p style="margin:0 0 6px;">* POR FAVOR CITE EL CÓDIGO DE SU CONTRATO IDADMON ${n.idadmon} ASIGNADO A SU CONTRATO.</p>
      <p style="margin:0 0 6px;">* IMPORTANTE: para notificar problemas, deficiencias o soporte para su departamento, debe enviar un email a <a href="mailto:incidencias@fondocapital.com">incidencias@fondocapital.com</a>, ya que esto es requerido para iniciar su arreglo o solución.</p>
      <p style="margin:0 0 6px;">* IMPORTANTE: le rogamos que afilie el siguiente correo <a href="mailto:pagoarriendo@fondocapital.com">pagoarriendo@fondocapital.com</a> a la casilla de su entidad bancaria. Esto le evitará molestias, ya que el comprobante que envía el banco reúne características de validez que no tienen otros comprobantes.</p>
      <p style="margin:0;">* Para cualquier duda por favor contacte con su ejecutivo.</p>
    </div>`

  return `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;">
      <div style="background:#1a56db;padding:22px 24px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:19px;letter-spacing:.02em;">FONDO CAPITAL</h1>
        <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:12px;">Administración de Propiedades</p>
      </div>
      <div style="padding:30px 24px;background:#fff;">
        <p style="font-size:15px;color:#111827;margin:0 0 14px;">Estimado/a <strong>${n.arrendatario || ''}</strong>,</p>
        <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 12px;">
          Buenos días. Le rogamos realice el pago del arriendo de <strong>${n.propiedad || ''}</strong>
          y escriba en el concepto del pago: <strong>${n.idadmon} Arriendo de ${M}</strong>.
        </p>
        <div style="background:#F0FDF4;border:1px solid #86EFAC;border-radius:8px;padding:16px 20px;margin:16px 0;text-align:center;">
          <div style="font-size:12px;color:#6B7280;margin-bottom:4px;">CANTIDAD A PAGAR — ${M}</div>
          <div style="font-size:26px;font-weight:700;color:#166534;">$${fmt(n.apagar)}</div>
        </div>
        ${bloqueUF}
        ${bloqueAjuste}
        ${recuerdo}
        <p style="font-size:14px;color:#374151;margin:18px 0 0;">Atentamente le saludamos,</p>
        <p style="font-size:13px;color:#6B7280;margin:6px 0 0;line-height:1.5;">
          Servicio de Información al Cliente<br/>
          <strong>FONDO CAPITAL</strong><br/>
          Badajoz 100 Of. 1014 — Las Condes, Santiago de Chile
        </p>
      </div>
      <div style="background:#F9FAFB;padding:14px 24px;text-align:center;font-size:11px;color:#9CA3AF;">
        Mensaje automático generado por el sistema CRM de Fondo Capital.
      </div>
    </div>`
}
