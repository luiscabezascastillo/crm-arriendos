// VERSION: v1 · 2026-07-11 · Validación + construcción de cargos de INICIO al pasar P→S
//
// lib/cc1Inicios.js
//
// Corazón de la automatización de inicios. NO toca la BD: son funciones puras
// que (a) validan si un contrato está listo para extraer sus inicios a `cuentas`,
// y (b) construyen las filas de cargo. El endpoint cambiar-estado las usa.
//
// Reglas fijadas en la auditoría del Cubo A + directivas de Legal (jul-2026):
//  - Garantía SIEMPRE en pesos (directiva Legal). Nunca en UF sin convertir.
//  - Garantía se carga por el valor del contrato, en sus N cuotas con sus fechas.
//  - Proporcional se toma de datos_arriendos.proporcional (Legal puede ajustarlo
//    con NOTA obligatoria por retraso de entrega).
//  - Comisión se carga desde comision_a_total (LOG) si > 0.
//  - DICOM NO se deduce: lo declara Anthony en el paso (tiene / monto).
//  - quien_cobra no exime de cargar garantía/proporcional.
//  - Anti-duplicado: si ya hay filas calif='INICIO', no se reprocesa.

// ── Umbrales (confirmados con Luis, jul-2026) ──
const UMBRAL_GARANTIA_UF = 1000        // garantía < 1000 => sospecha de estar en UF
const FACTOR_PROPORCIONAL_ABSURDO = 2  // proporcional > 2× renta mensual => absurdo
const TOLERANCIA_DESCUADRE = 100       // ±100 pesos por redondeos

// Número seguro desde texto/num (admite "1.143.270", "440000", 12345, null)
function num(v) {
  if (v == null) return 0
  if (typeof v === 'number') return isFinite(v) ? v : 0
  const s = String(v).trim().replace(/\./g, '').replace(/,/g, '.')
  const n = parseFloat(s)
  return isFinite(n) ? n : 0
}

// Renta mensual estimada del contrato (para validar el proporcional).
// Si es UF: cuota(UF) × uf_peso_factor. Si es $: cuota tal cual.
function rentaMensual(c) {
  const cuota = num(c.cuota)
  const rev = String(c.revision || '').toUpperCase()
  const unid = String(c.unid || '').toUpperCase()
  const esUF = rev === 'UF' || unid === 'UF'
  if (esUF) {
    const factor = num(c.uf_peso_factor)
    return Math.round(cuota * factor)
  }
  return Math.round(cuota)
}

// Cuotas de garantía declaradas (cuota1..5 con fecha1..5), solo las > 0.
function cuotasGarantia(c) {
  const out = []
  for (let i = 1; i <= 5; i++) {
    const monto = num(c['cuota' + i])
    const fecha = c['fecha' + i]
    if (monto > 0) out.push({ i, monto, fecha: fecha || null })
  }
  return out
}

// Formatea una fecha (date ISO o texto) a dd/mm/yyyy (formato de las filas INICIO).
function fechaDDMMYYYY(f) {
  if (!f) return null
  const s = String(f)
  // ya viene dd/mm/yyyy
  const m1 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (m1) return `${m1[1]}/${m1[2]}/${m1[3]}`
  // viene ISO yyyy-mm-dd
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m2) return `${m2[3]}/${m2[2]}/${m2[1]}`
  return s
}

/**
 * validarInicios(contrato, cuentasInicioExistentes)
 * @param contrato   fila de datos_arriendos
 * @param cuentasInicioExistentes  array de filas de `cuentas` con calif='INICIO' de este idadmon
 * @returns { ok: true } | { ok: false, errores: [{codigo, mensaje, campo?}] }
 *
 * Si ok=false, el endpoint NO cambia el estado: el contrato se queda en P.
 */
export function validarInicios(contrato, cuentasInicioExistentes = []) {
  const c = contrato || {}
  const errores = []

  // A. Anti-duplicado
  if (Array.isArray(cuentasInicioExistentes) && cuentasInicioExistentes.length > 0) {
    errores.push({
      codigo: 'YA_TIENE_INICIOS',
      mensaje: `${c.idadmon}: ya existen ${cuentasInicioExistentes.length} línea(s) de INICIO en cuentas. ` +
               `Revisar antes de reprocesar (no se duplica).`,
    })
    // Si ya tiene inicios, no seguimos validando: es el bloqueo prioritario.
    return { ok: false, errores }
  }

  // B. Campos mínimos
  if (num(c.cuota) <= 0) {
    errores.push({ codigo: 'SIN_CUOTA', mensaje: `${c.idadmon}: falta la cuota (renta). Corregir en LOG.`, campo: 'cuota' })
  }
  if (!c.revision || String(c.revision).trim() === '') {
    errores.push({ codigo: 'SIN_REVISION', mensaje: `${c.idadmon}: falta el tipo de revisión. Corregir en LOG.`, campo: 'revision' })
  }
  const cuotas = cuotasGarantia(c)
  const tieneFechaInicio = cuotas.some(q => q.fecha) || c.fecha1
  if (!tieneFechaInicio) {
    errores.push({ codigo: 'SIN_FECHA_INICIO', mensaje: `${c.idadmon}: falta la fecha de inicio (fecha1). Corregir en LOG.`, campo: 'fecha1' })
  }

  // C. Garantía en UF (directiva Legal: SIEMPRE en pesos)
  const garantiaPedida = num(c.garantia_pedida)
  const valoresGarantia = [garantiaPedida, ...cuotas.map(q => q.monto)].filter(v => v > 0)
  for (const v of valoresGarantia) {
    if (v > 0 && v < UMBRAL_GARANTIA_UF) {
      errores.push({
        codigo: 'GARANTIA_EN_UF',
        mensaje: `${c.idadmon}: garantía sospechosa de estar en UF (valor ${v}). ` +
                 `Legal exige garantía en PESOS. Corregir en LOG antes de activar.`,
        campo: 'garantia_pedida',
      })
      break
    }
  }

  // D. Garantía descuadrada (pedida vs suma de cuotas)
  const sumaCuotas = cuotas.reduce((a, q) => a + q.monto, 0)
  if (garantiaPedida > 0 && sumaCuotas > 0) {
    if (Math.abs(garantiaPedida - sumaCuotas) > TOLERANCIA_DESCUADRE) {
      errores.push({
        codigo: 'GARANTIA_DESCUADRADA',
        mensaje: `${c.idadmon}: garantía descuadrada. Pedida ${garantiaPedida.toLocaleString('es-CL')}, ` +
                 `cuotas suman ${sumaCuotas.toLocaleString('es-CL')}. Corregir en LOG (revisar cuota1..5).`,
        campo: 'garantia',
      })
    }
  } else if (garantiaPedida > 0 && sumaCuotas === 0) {
    // Hay garantía pedida pero ninguna cuota: no sabemos cómo fraccionarla.
    // Aceptable como 1 cuota, NO se bloquea (se cargará como cuota única). Ver construir.
  }

  // E. Proporcional absurdo
  const prop = num(c.proporcional)
  const renta = rentaMensual(c)
  if (prop > 0 && renta > 0 && prop > FACTOR_PROPORCIONAL_ABSURDO * renta) {
    errores.push({
      codigo: 'PROPORCIONAL_ABSURDO',
      mensaje: `${c.idadmon}: proporcional sospechoso (${prop.toLocaleString('es-CL')} vs renta ` +
               `${renta.toLocaleString('es-CL')}). Revisar en LOG el campo proporcional.`,
      campo: 'proporcional',
    })
  }

  // F. Factor UF inválido
  const rev = String(c.revision || '').toUpperCase()
  const unid = String(c.unid || '').toUpperCase()
  const esUF = rev === 'UF' || unid === 'UF'
  if (esUF) {
    const factor = num(c.uf_peso_factor)
    if (factor <= 1) {
      errores.push({
        codigo: 'FACTOR_UF_INVALIDO',
        mensaje: `${c.idadmon}: revisión UF pero uf_peso_factor = ${c.uf_peso_factor}. ` +
                 `Debe ser el valor de la UF del mes. Corregir en LOG.`,
        campo: 'uf_peso_factor',
      })
    }
  }

  return errores.length === 0 ? { ok: true } : { ok: false, errores }
}

/**
 * construirCargosInicio(contrato, opciones)
 * Solo debe llamarse DESPUÉS de que validarInicios devuelva ok=true.
 * @param opciones {
 *   fechaHoy: 'dd/mm/yyyy' para el sello,
 *   dicom: { tiene: bool, monto: number },       // declarado por Anthony
 *   proporcionalNota: string | null,             // si Legal ajustó el proporcional
 *   proporcionalOverride: number | null,         // valor ajustado (si aplica)
 *   yaHayRentaDelMesInicio: bool,                 // si existe fila de renta del mes de inicio
 * }
 * @returns array de filas listas para insertar en `cuentas`.
 */
export function construirCargosInicio(contrato, opciones = {}) {
  const c = contrato || {}
  const {
    fechaHoy = fechaDDMMYYYY(new Date().toISOString().slice(0, 10)),
    dicom = { tiene: false, monto: 0 },
    proporcionalNota = null,
    proporcionalOverride = null,
    yaHayRentaDelMesInicio = false,
  } = opciones

  const filas = []
  const selloAuto = `[AUTO-INICIOS ${fechaHoy}]`
  const comentBase = `${c.idadmon}-DATOS INICIALES`
  const base = {
    idadmon: c.idadmon,
    calif: 'INICIO',
    abono: null,
    saldo: null,
    estado: c.estado || 'S',
    propietario: c.propietario || null,
    inmueble: c.inmueble || null,
    updated_at: new Date().toISOString(),
  }

  // ── 1. GARANTÍA (siempre, en pesos, por cuotas con sus fechas) ──
  const cuotas = cuotasGarantia(c)
  const garantiaPedida = num(c.garantia_pedida)
  const fechaInicio = fechaDDMMYYYY(c.fecha1) || fechaHoy

  if (cuotas.length > 0) {
    cuotas.forEach((q) => {
      filas.push({
        ...base,
        fecha: fechaDDMMYYYY(q.fecha) || fechaInicio,
        concepto: cuotas.length === 1
          ? `GARANTIA FCR ${q.monto.toLocaleString('es-CL')}`
          : `GARANTIA FCR cuota ${q.i}/${cuotas.length} (${q.monto.toLocaleString('es-CL')})`,
        cargo: q.monto,
        justificantes: `${selloAuto} garantia por contrato`,
        comentarios: comentBase,
      })
    })
  } else if (garantiaPedida > 0) {
    // No hay cuotas fraccionadas: cargar la garantía como cuota única.
    filas.push({
      ...base,
      fecha: fechaInicio,
      concepto: `GARANTIA FCR ${garantiaPedida.toLocaleString('es-CL')}`,
      cargo: garantiaPedida,
      justificantes: `${selloAuto} garantia por contrato (cuota unica)`,
      comentarios: comentBase,
    })
  }
  // Si no hay ni pedida ni cuotas => contrato sin garantía. No se carga nada (raro, pero no inventamos).

  // ── 2. PROPORCIONAL (salvo que ya exista renta del mes de inicio) ──
  const propContrato = num(c.proporcional)
  const propFinal = proporcionalOverride != null ? num(proporcionalOverride) : propContrato
  if (propFinal > 0 && !yaHayRentaDelMesInicio) {
    let comentProp = comentBase
    let justProp = `${selloAuto} proporcional por contrato`
    if (proporcionalNota && String(proporcionalNota).trim() !== '') {
      // Nota de Legal por ajuste de fecha de entrega
      justProp = `${selloAuto} PROPORCIONAL cambiado por legal por cambio fecha entrega: ${String(proporcionalNota).trim()}`
    }
    filas.push({
      ...base,
      fecha: fechaInicio,
      concepto: `PROPORCIONAL INICIO`,
      cargo: propFinal,
      justificantes: justProp,
      comentarios: comentProp,
    })
  }

  // ── 3. COMISIÓN (desde comision_a_total del LOG, si > 0) ──
  const comision = num(c.comision_a_total)
  if (comision > 0) {
    filas.push({
      ...base,
      fecha: fechaInicio,
      concepto: `COMISION`,
      cargo: comision,
      justificantes: `${selloAuto} comision por LOG`,
      comentarios: comentBase,
    })
  }

  // ── 4. DICOM (solo si Anthony lo declara) ──
  if (dicom && dicom.tiene && num(dicom.monto) > 0) {
    filas.push({
      ...base,
      fecha: fechaInicio,
      concepto: `DICOM`,
      cargo: num(dicom.monto),
      justificantes: `${selloAuto} DICOM declarado por Legal en activacion`,
      comentarios: comentBase,
    })
  }

  return filas
}

// Exports auxiliares para pruebas/uso del endpoint
export const _internos = { num, rentaMensual, cuotasGarantia, fechaDDMMYYYY }
