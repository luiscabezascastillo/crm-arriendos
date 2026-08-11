// VERSION: v2 · 2026-08-11 · lib/bb2Log.js — Mapeo COMPLETO del LOG (tabla `log`) para BB2 (arriendo sin admón).
//   Lectura TOLERANTE con FALLBACK: primero la clave LIMPIA (la que escribe el CRM), y si no está, la clave
//   HISTÓRICA del Excel (BB-Operaciones-mapeo-log). Escritura con claves LIMPIAS (para normalizar al editar).
//   ⚠ Corrección v2: en el LOG las columnas COBRADO/COBRADO-D van CRUZADAS respecto al doc. Verificado con
//   R00348 y R00521 (propietario empresa→FACTURA, arrendatario persona→BOLETA): el doc del PROPIETARIO está en
//   `COBRADO` y el del ARRENDATARIO en `COBRADO-D`. Se mapea así. Hereda v1.

// Lectura de un campo: si la clave LIMPIA está presente (aunque sea ''), manda esa (permite BORRAR un dato).
// Si no está, se cae al primer valor NO vacío de las claves históricas.
function readField(raw, cleanKey, histKeys) {
  if (raw && Object.prototype.hasOwnProperty.call(raw, cleanKey)) return String(raw[cleanKey] ?? '').trim()
  for (const k of (histKeys || [])) {
    const v = raw?.[k]
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim()
  }
  return ''
}

// Compat: primer valor no vacío entre varias claves (se usa en otros sitios).
export function g(raw, ...keys) {
  for (const k of keys) { const v = raw?.[k]; if (v != null && String(v).trim() !== '') return String(v).trim() }
  return ''
}

// ── Configuración de campos ─────────────────────────────────────────────────────────────────────
const PCAMPOS = ['nombre', 'genero', 'estado', 'nacionalidad', 'rut', 'pasaporte', 'email', 'telefono', 'direccion', 'dom_laboral', 'empresa', 'comuna']
// Bloques de personas: D (propietario), D2 (co-prop), A (arr1), A2 (arr2), G (aval). El D2 tiene sufijos irregulares.
const BLOQUES = [
  { key: 'prop', pref: 'prop', suf: 'D', comuna: 'COMUNA PROP', label: 'Propietario' },
  {
    key: 'coprop', pref: 'coprop', suf: 'D2', comuna: 'COMUNA CEO', label: 'Co-propietario',
    hist: { genero: 'Genero-D3', estado: 'Estado-D4', nacionalidad: 'Nacion-D5', rut: 'RUT de D6', pasaporte: 'Pasaporte-D7', email: 'email de D8', telefono: 'telefono de D9', direccion: 'Dom-Habit-D10', dom_laboral: 'Dom-Lab-D11', empresa: 'Empresa-D12' },
  },
  { key: 'arr', pref: 'arr', suf: 'A', comuna: 'COMUNA AR1', label: 'Arrendatario 1' },
  { key: 'arr2', pref: 'arr2', suf: 'A2', comuna: 'COMUNA AR2', label: 'Arrendatario 2' },
  { key: 'aval', pref: 'aval', suf: 'G', comuna: 'COMUNA AV1', label: 'Aval' },
]
function histPersona(b, campo) {
  if (b.hist && b.hist[campo]) return [b.hist[campo]]
  const S = b.suf
  switch (campo) {
    case 'nombre': return [`Nombre-${S}`]
    case 'genero': return [`Genero-${S}`]
    case 'estado': return [`Estado-${S}`]
    case 'nacionalidad': return [`Nacion-${S}`]
    case 'rut': return [`RUT de ${S}`, `RUT-${S}`]
    case 'pasaporte': return [`Pasaporte-${S}`]
    case 'email': return [`email de ${S}`, `EMAIL-${S}`]
    case 'telefono': return [`telefono de ${S}`, `FONO-${S}`]
    case 'direccion': return [`Dom-Habit-${S}`]
    case 'dom_laboral': return [`Dom-Lab-${S}`]
    case 'empresa': return [`Empresa-${S}`]
    case 'comuna': return [b.comuna]
    default: return []
  }
}
const cleanPersona = (b, campo) => `${b.pref}_${campo}`

const INM = [
  ['direccion', ['INMUEBLE']], ['comuna', ['COMUNA INMUEBLE']], ['moneda', ['MONEDA']],
  ['monto', ['CANTIDAD CONTRATO2']], ['garantia', ['GARANTIA', 'GARANTIA ($/UF)']],
  ['inicio', ['FECHA START/PROMESA']], ['fin', ['FECHA END']], ['multas', ['MULTAS']],
  ['bodega', ['BODECA']], ['estacionamiento', ['ESTACIONAMIENTO']],
  ['caracteristicas', ['CARACTERISTICAS INMUEBLE']], ['proporcional', ['PROPORCIONAL']],
  ['plantilla', ['PLANTILLA CONTRATO']],
  ['pre_aviso', []], ['ajuste', []], ['renovacion', []],   // campos nuevos del CRM
]
const COM_D = [['pct', ['Porcent-D']], ['neto', ['NETO-D']], ['iva', ['IVA-D']], ['total', ['TOTAL-D']], ['cesp', ['C.ESPECIALES PROPIETARIO']], ['com', ['COMENTARIO PROPIETARIO']], ['doc', ['COBRADO']]]
const COM_A = [['pct', ['Porcent-A']], ['neto', ['NETO-A']], ['iva', ['IVA-A']], ['total', ['TOTAL-A']], ['cesp', ['C.ESPECIALES ARRENDATARIO']], ['com', ['COMENTARIO ARRENDTARIO', 'COMENTARIO ARRENDATARIO']], ['doc', ['COBRADO-D']]]
const CAB = [['tipo', ['TIPO']], ['ejecutivo', ['EJECUTIVO VENTA']], ['fecha_registro', ['FECHA REGISTRO']], ['comentarios', ['COMENTARIOS']], ['otros_comentarios', ['OTROS COMENTARIOS']]]
const HECHO_KEY = 'HECHO/PENDIENTE2'

// raw_data -> modelo estructurado (lo que consume la ficha).
export function modelDesdeRaw(raw = {}) {
  const rf = (clean, hist) => readField(raw, clean, hist)
  const personas = {}
  for (const b of BLOQUES) { const o = {}; for (const c of PCAMPOS) o[c] = rf(cleanPersona(b, c), histPersona(b, c)); personas[b.key] = o }
  const inmueble = {}; for (const [n, h] of INM) inmueble[n] = rf('inm_' + n, h)
  const comD = {}; for (const [n, h] of COM_D) comD[n] = rf('com_d_' + n, h)
  const comA = {}; for (const [n, h] of COM_A) comA[n] = rf('com_a_' + n, h)
  const cab = {}; for (const [n, h] of CAB) cab[n] = rf(n, h)
  const hechoTxt = readField(raw, HECHO_KEY, [])
  return {
    tipo: cab.tipo, ejecutivo: cab.ejecutivo, fecha_registro: cab.fecha_registro,
    comentarios: cab.comentarios, otros_comentarios: cab.otros_comentarios,
    personas, inmueble, comD, comA,
    hecho: /HECHO/i.test(hechoTxt), hecho_txt: hechoTxt,
  }
}

// modelo -> objeto plano de claves LIMPIAS (todas, incluidas vacías → así BORRAR un dato persiste). Para merge en raw_data.
export function rawDesdeModel(model = {}) {
  const out = {}
  for (const b of BLOQUES) { const o = model.personas?.[b.key] || {}; for (const c of PCAMPOS) out[cleanPersona(b, c)] = String(o[c] ?? '').trim() }
  for (const [n] of INM) out['inm_' + n] = String(model.inmueble?.[n] ?? '').trim()
  for (const [n] of COM_D) out['com_d_' + n] = String(model.comD?.[n] ?? '').trim()
  for (const [n] of COM_A) out['com_a_' + n] = String(model.comA?.[n] ?? '').trim()
  out['tipo'] = String(model.tipo ?? '').trim()
  out['ejecutivo'] = String(model.ejecutivo ?? '').trim()
  out['fecha_registro'] = String(model.fecha_registro ?? '').trim()
  out['comentarios'] = String(model.comentarios ?? '').trim()
  out['otros_comentarios'] = String(model.otros_comentarios ?? '').trim()
  return out
}

// Modelo vacío (para "Nueva operación").
export function modelVacio() { return modelDesdeRaw({}) }

// Fila del LOG -> objeto de LISTA (usa el modelo, así lista y ficha leen igual). Corrige COBRADO/COBRADO-D.
export function mapFilaLista(row) {
  const raw = row?.raw_data || {}
  const m = modelDesdeRaw(raw)
  return {
    id: row?.id_lcc || readField(raw, 'id', ['ID-LCC']) || '',
    tipo: m.tipo,
    inmueble: m.inmueble.direccion || row?.inmueble || '',
    comuna: m.inmueble.comuna,
    ejecutivo: m.ejecutivo || row?.ejecutivo_venta || '',
    propietario: m.personas.prop.nombre || row?.dueno_vendedor || '',
    arrendatario: m.personas.arr.nombre || row?.arrendatario_comprador || '',
    moneda: m.inmueble.moneda,
    monto: m.inmueble.monto,
    garantia: m.inmueble.garantia,
    inicio: m.inmueble.inicio || row?.fecha_start_promesa || '',
    fin: m.inmueble.fin,
    fecha_registro: m.fecha_registro || row?.fecha_registro || '',
    comD: { total: m.comD.total, tipo_doc: m.comD.doc },
    comA: { total: m.comA.total, tipo_doc: m.comA.doc },
    hecho: m.hecho, hecho_txt: m.hecho_txt,
  }
}

// Promovidas de la tabla `log` a partir del modelo (para mantenerlas coherentes al guardar).
export function columnasPromovidas(model) {
  return {
    tipo: model.tipo || null,
    ejecutivo_venta: model.ejecutivo || null,
    inmueble: model.inmueble?.direccion || null,
    fecha_registro: model.fecha_registro || null,
    fecha_start_promesa: model.inmueble?.inicio || null,
    moneda: model.inmueble?.moneda || null,
    cantidad_contrato2: model.inmueble?.monto || null,
    dueno_vendedor: model.personas?.prop?.nombre || null,
    arrendatario_comprador: model.personas?.arr?.nombre || null,
  }
}

export const HECHO_RAW_KEY = HECHO_KEY
