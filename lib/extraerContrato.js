// VERSION: v1 · 2026-08-01 · Extrae los campos de la plantilla de contrato FCR desde su texto.
// lib/extraerContrato.js — función PURA (no toca BD, no envía nada). La usa el endpoint
// /api/cc1/extraer-contrato para prerellenar la ficha; SIEMPRE lo revisa Anthony antes de activar.

const MESES = {
  enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06',
  julio: '07', agosto: '08', septiembre: '09', setiembre: '09',
  octubre: '10', noviembre: '11', diciembre: '12',
}

// "01 de julio de 2026" -> "2026-07-01"
function fechaIso(s) {
  if (!s) return null
  const m = String(s).match(/(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})/i)
  if (!m) return null
  const mes = MESES[m[2].toLowerCase()]
  if (!mes) return null
  return `${m[3]}-${mes}-${String(m[1]).padStart(2, '0')}`
}

/**
 * extraerDatosContrato(texto) -> { datos, deducidos, aviso }
 *  - datos: campos extraídos (solo los que aparecen)
 *  - deducidos: nombres de campos INFERIDOS (no literales) que conviene revisar
 *  - aviso: null o mensaje si no parece un contrato FCR
 */
export function extraerDatosContrato(texto) {
  const T = String(texto || '').replace(/\s+/g, ' ').trim()
  const datos = {}
  const deducidos = []
  const g = (re) => { const m = T.match(re); return m ? m[1].trim() : null }

  // IDADMON
  datos.idadmon =
    g(/CONTRATO DE ARRENDAMIENTO N[°º]\s*(A\d{5})/i) ||
    g(/IDADMON\)?:?\s*(A\d{5})/i) || null

  // Arrendatario: nombre, nacionalidad, RUT, teléfono, email, domicilio, comuna
  const m = T.match(
    /y don\s+(.+?),\s*([a-záéíóúñ]+),\s*c[eé]dula de identidad\s*N[°º]?\s*([\d.\-kK]+),\s*n[uú]mero telef[oó]nico\s*([+\d ]+?),\s*correo electr[oó]nico\s*([^\s,]+@[^\s,]+),\s*con domicilio actual en\s*(?:la calle\s*)?(.+?),\s*comuna de\s*([A-Za-zÁÉÍÓÚÑ ]+?)\s+de la/i
  )
  if (m) {
    datos.arrendatario = m[1].trim()
    datos.nacionalidad = m[2].trim()
    datos.rut_arrendatario = m[3].trim()
    datos.telefono = m[4].replace(/\s+/g, ' ').trim()
    datos.email = m[5].trim()
    datos.domicilio = m[6].trim()
    datos.comuna_domicilio = m[7].trim()
  }

  // Inmueble
  datos.inmueble = g(/por el\s+(.+?),\s*ubicado en el Edificio/i)
  datos.direccion_edificio = g(/acceso principal por\s+(.+?)\s+de la comuna/i)

  // Fechas del contrato
  const mf = T.match(/contados desde el\s*(.+?)\s*hasta el d[ií]a\s*(.+?)\./i)
  if (mf) {
    datos.fecha_inicio = fechaIso(mf[1])
    datos.fecha_fin = fechaIso(mf[2])
  }

  // Renta y moneda
  const mr = T.match(/renta de arrendamiento mensual ser[aá] de\s*(UF\s*)?\$?\s*([\d.]+)/i)
  if (mr) {
    datos.moneda = mr[1] ? 'UF' : '$'
    datos.monto = Number(mr[2].replace(/\./g, '')) || null
  }

  // Reajuste / revisión
  let per = null
  if (/reajustar[aá] cada seis|cada seis \(06\) meses|cada 6\b/i.test(T)) per = 'semestral'
  else if (/cada tres|cada 3\b/i.test(T)) per = 'trimestral'
  else if (/cada doce|\banual\b|cada 12\b/i.test(T)) per = 'anual'
  const conUf = /reajustar[aá][^.]{0,120}(UF|Unidad de Fomento)/i.test(T)
  if (per) datos.revision = (conUf && per === 'semestral') ? 'Semestral con UF' : 'IPC ' + per

  // Primera fecha de ajuste (deducida: alimenta el cálculo de reajustes)
  const fr1 = fechaIso(g(/primera fecha de ajuste ser[aá] el d[ií]a\s*(.+?)\s*y la/i))
  if (fr1) { datos.fecha_reajuste1 = fr1; deducidos.push('fecha_reajuste1') }

  // Cuenta de pago (si va a cuenta del propietario => la renta la cobra el DUEÑO)
  const mc = T.match(
    /Cuenta Corriente N[º°]?\s*([\d-]+)\s*del Banco\s*([A-ZÁÉÍÓÚÑ ]+?),\s*a nombre de\s*(.+?),\s*RUT N[º°]?\s*([\d.\-kK]+)/i
  )
  if (mc) {
    datos.pago_cuenta = mc[1].trim()
    datos.pago_banco = mc[2].trim()
    datos.pago_titular = mc[3].trim()
    datos.pago_rut_titular = mc[4].trim()
    datos.quien_cobra_sugerido = 'DUEÑO'   // sugerencia, NO se autorellena el campo
  }

  // Indemnización por término anticipado (informativo)
  if (/dos \(02\) meses de renta/i.test(T)) datos.indemnizacion_meses = 2

  const aviso = (!datos.idadmon && !datos.arrendatario && !datos.monto)
    ? 'No parece un contrato con la plantilla FCR (no se encontraron IDADMON, arrendatario ni renta).'
    : null

  return { datos, deducidos, aviso }
}
