// VERSION: v1 · 2026-08-11 · lib/bb2Log.js — Lectura TOLERANTE del LOG (tabla `log`) para BB2 (arriendo sin
//   administración, id_lcc 'R%') y, más adelante, BB1 (venta, 'V%').
//   ⚠ Las COLUMNAS PROMOVIDAS de `log` están DESALINEADAS y NO son fiables (moneda/cantidad/dueño/arrendatario
//   salen corridas una posición y `estatus` trae la FECHA END). La FUENTE DE VERDAD es `raw_data`, que sí cuadra
//   con el mapeo de BB-Operaciones-mapeo-log. Se lee con FALLBACK a las claves históricas. Los registros nuevos se
//   guardarán con claves LIMPIAS (los 1577 viejos se normalizan al editarlos). Aquí SOLO se lee.

// Primer valor no vacío entre varias claves de raw_data.
export function g(raw, ...keys) {
  for (const k of keys) {
    const v = raw?.[k]
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim()
  }
  return ''
}

// Comisión de una parte: 'D' = propietario/vendedor · 'A' = arrendatario/comprador.
function comision(raw, x) {
  const esD = x === 'D'
  return {
    neto: g(raw, `NETO-${x}`),
    iva: g(raw, `IVA-${x}`),
    total: g(raw, `TOTAL-${x}`),
    pct: g(raw, `Porcent-${x}`),
    // La comisión A usa la clave histórica 'COBRADO' (sin sufijo); la D usa 'COBRADO-D'.
    tipo_doc: esD ? g(raw, 'COBRADO-D') : g(raw, 'COBRADO'),
    c_especiales: g(raw, esD ? 'C.ESPECIALES PROPIETARIO' : 'C.ESPECIALES ARRENDATARIO'),
    // 'COMENTARIO ARRENDTARIO' está mal escrito en el histórico; se acepta también la forma limpia.
    comentario: esD ? g(raw, 'COMENTARIO PROPIETARIO') : g(raw, 'COMENTARIO ARRENDTARIO', 'COMENTARIO ARRENDATARIO'),
  }
}

// Fila del LOG -> objeto de LISTA (lo justo para el listado BB2). La ficha completa vendrá en el paso 2.
export function mapFilaLista(row) {
  const raw = row?.raw_data || {}
  const hechoTxt = g(raw, 'HECHO/PENDIENTE2')
  return {
    id: g(raw, 'ID-LCC') || row?.id_lcc || '',
    tipo: g(raw, 'TIPO') || row?.tipo || '',
    inmueble: g(raw, 'INMUEBLE') || row?.inmueble || '',
    comuna: g(raw, 'COMUNA INMUEBLE'),
    ejecutivo: g(raw, 'EJECUTIVO VENTA') || row?.ejecutivo_venta || '',
    propietario: g(raw, 'Nombre-D', 'DUEÑO/VENDEDOR') || row?.dueno_vendedor || '',
    arrendatario: g(raw, 'Nombre-A', 'ARRENDATARIO/COMPRADOR') || row?.arrendatario_comprador || '',
    moneda: g(raw, 'MONEDA'),
    monto: g(raw, 'CANTIDAD CONTRATO2'),
    garantia: g(raw, 'GARANTIA', 'GARANTIA ($/UF)'),
    inicio: g(raw, 'FECHA START/PROMESA') || row?.fecha_start_promesa || '',
    fin: g(raw, 'FECHA END'),
    fecha_registro: g(raw, 'FECHA REGISTRO') || row?.fecha_registro || '',
    comD: comision(raw, 'D'),
    comA: comision(raw, 'A'),
    hecho: /HECHO/i.test(hechoTxt),
    hecho_txt: hechoTxt,
  }
}
