// app/api/bb2/ficha/route.js
// VERSION: v1 · 2026-08-11 · BB2 · ficha (mapeador raw_data↔modelo limpio + recuperar/guardar). Lee/escribe la tabla `log`.
//   GET  ?idop=R00xxx  → { ok, existe, form }          (recuperar; mapea raw_data histórico con fallback)
//   GET  ?nuevo=1      → { ok, siguiente, form:vacío }  (siguiente Id = último R usado + 1)
//   POST { accion:'guardar', form }      → upsert en log (raw_data con claves LIMPIAS + columnas promovidas). No toca HECHO.
//   POST { accion:'desbloquear', idop }  → quita la protección HECHO/PENDIENTE2.
//   (Terminar → cola de facturación + email va en la próxima versión.)
//   Service role (log con RLS). Solo Dirección (Alberto, Luis) y Legal (Anthony).

import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

const ACCESO_EMAILS = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'anthony.mendoza@fondocapital.com']
function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
}
function autorizado(session) {
  const email = (session?.user?.email || '').toLowerCase()
  return session?.user?.role === 'direccion' || ACCESO_EMAILS.includes(email)
}
// lee la 1ª clave con valor: primero la LIMPIA (nueva), luego las históricas (fallback)
function pick(raw, ...keys) {
  for (const k of keys) { const v = raw && raw[k]; if (v != null && String(v).trim() !== '') return String(v) }
  return ''
}

// Campos por parte. clave limpia = `${p}_${field}`. Históricas: D/A/G por sufijo; D2/A2/G2 irregulares (mapa explícito).
const PARTE_FIELDS = ['nombre', 'genero', 'estado_civil', 'nacionalidad', 'rut', 'pasaporte', 'email', 'telefono', 'dom_habitacional', 'dom_laboral', 'empresa', 'comuna']
const COMUNA_HIST = { D: 'COMUNA PROP', D2: 'COMUNA CEO', A: 'COMUNA AR1', A2: 'COMUNA AR2', G: 'COMUNA AV1', G2: 'COMUNA AV2' }
const D2_HIST = { nombre: 'Nombre-D2', genero: 'Genero-D3', estado_civil: 'Estado-D4', nacionalidad: 'Nacion-D5', rut: 'RUT de D6', pasaporte: 'Pasaporte-D7', email: 'email de D8', telefono: 'telefono de D9', dom_habitacional: 'Dom-Habit-D10', dom_laboral: 'Dom-Lab-D11', empresa: 'Empresa-D12' }
// devuelve la(s) clave(s) histórica(s) de un campo de una parte
function histKeys(p, field) {
  if (field === 'comuna') return [COMUNA_HIST[p]]
  if (p === 'D2') return [D2_HIST[field]].filter(Boolean)
  const suf = p // D, A, G, A2, G2
  switch (field) {
    case 'nombre': return [`Nombre-${suf}`]
    case 'genero': return [`Genero-${suf}`]
    case 'estado_civil': return [`Estado-${suf}`]
    case 'nacionalidad': return [`Nacion-${suf}`]
    case 'rut': return [`RUT de ${suf}`, `RUT-${suf}`]
    case 'pasaporte': return [`Pasaporte-${suf}`]
    case 'email': return [`email de ${suf}`, `EMAIL-${suf}`]
    case 'telefono': return [`telefono de ${suf}`, `FONO-${suf}`]
    case 'dom_habitacional': return [`Dom-Habit-${suf}`]
    case 'dom_laboral': return [`Dom-Lab-${suf}`]
    case 'empresa': return [`Empresa-${suf}`]
    default: return []
  }
}
const PARTES = ['D', 'D2', 'A', 'A2', 'G', 'G2']

function leerParte(raw, p) {
  const o = {}
  for (const f of PARTE_FIELDS) o[f] = pick(raw, `${p}_${f}`, ...histKeys(p, f))
  return o
}

function leerForm(row) {
  const raw = row.raw_data || {}
  const form = {
    idop: row.id_lcc,
    tipo: row.tipo || pick(raw, 'tipo', 'TIPO') || 'arriendo',
    hecho: String(pick(raw, 'hecho', 'HECHO/PENDIENTE2')).trim().toUpperCase() === 'HECHO',
    vendedor: row.ejecutivo_venta || pick(raw, 'vendedor', 'EJECUTIVO VENTA'),
    fecha_registro: row.fecha_registro || pick(raw, 'fecha_registro', 'FECHA REGISTRO'),
    comentarios: pick(raw, 'comentarios', 'COMENTARIOS', 'OTROS COMENTARIOS'),
    inm: {
      direccion: row.inmueble || pick(raw, 'inm_direccion', 'INMUEBLE'),
      comuna: pick(raw, 'inm_comuna', 'COMUNA INMUEBLE'),
      moneda: row.moneda || pick(raw, 'inm_moneda', 'MONEDA'),
      monto: row.cantidad_contrato2 || pick(raw, 'inm_monto', 'CANTIDAD CONTRATO2'),
      garantia: pick(raw, 'inm_garantia', 'GARANTIA', 'GARANTIA ($/UF)'),
      bodega: pick(raw, 'inm_bodega', 'BODECA'),
      estacionamiento: pick(raw, 'inm_estac', 'ESTACIONAMIENTO'),
      multas: pick(raw, 'inm_multas', 'MULTAS'),
      inicio: pick(raw, 'inm_inicio', 'FECHA START/PROMESA'),
      fin: pick(raw, 'inm_fin', 'FECHA END'),
      ajuste: pick(raw, 'inm_ajuste', 'AJUSTE'),
      renovacion: pick(raw, 'inm_renovacion', 'RENOVACION'),
      preaviso: pick(raw, 'inm_preaviso', 'PRE-AVISO'),
      plantilla: pick(raw, 'plantilla', 'PLANTILLA CONTRATO'),
      caracteristicas: pick(raw, 'caracteristicas', 'CARACTERISTICAS INMUEBLE'),
    },
    partes: {},
    comD: {
      base: pick(raw, 'comD_base', 'NETO-D'), iva: pick(raw, 'comD_iva', 'IVA-D'), total: pick(raw, 'comD_total', 'TOTAL-D'),
      pct: pick(raw, 'comD_pct', 'Porcent-D'), tipo_doc: pick(raw, 'comD_tipodoc', 'COBRADO-D'),
      c_especiales: pick(raw, 'comD_cesp', 'C.ESPECIALES PROPIETARIO'), comentario: pick(raw, 'comD_coment', 'COMENTARIO PROPIETARIO'),
    },
    comA: {
      base: pick(raw, 'comA_base', 'NETO-A'), iva: pick(raw, 'comA_iva', 'IVA-A'), total: pick(raw, 'comA_total', 'TOTAL-A'),
      pct: pick(raw, 'comA_pct', 'Porcent-A'), tipo_doc: pick(raw, 'comA_tipodoc', 'COBRADO'),
      c_especiales: pick(raw, 'comA_cesp', 'C.ESPECIALES ARRENDATARIO'), comentario: pick(raw, 'comA_coment', 'COMENTARIO ARRENDTARIO'),
    },
  }
  for (const p of PARTES) form.partes[p] = leerParte(raw, p)
  return form
}

// Construye el raw_data (MERGE sobre el existente, con claves LIMPIAS) + columnas promovidas.
function escribir(form, rawPrev) {
  const raw = { ...(rawPrev || {}) }
  const set = (k, v) => { raw[k] = v == null ? '' : String(v) }
  set('idop', form.idop); set('ID-LCC', form.idop)
  set('tipo', form.tipo); set('vendedor', form.vendedor); set('fecha_registro', form.fecha_registro); set('comentarios', form.comentarios)
  const i = form.inm || {}
  set('inm_direccion', i.direccion); set('inm_comuna', i.comuna); set('inm_moneda', i.moneda); set('inm_monto', i.monto)
  set('inm_garantia', i.garantia); set('inm_bodega', i.bodega); set('inm_estac', i.estacionamiento); set('inm_multas', i.multas)
  set('inm_inicio', i.inicio); set('inm_fin', i.fin); set('inm_ajuste', i.ajuste); set('inm_renovacion', i.renovacion)
  set('inm_preaviso', i.preaviso); set('plantilla', i.plantilla); set('caracteristicas', i.caracteristicas)
  for (const p of PARTES) { const pa = (form.partes && form.partes[p]) || {}; for (const f of PARTE_FIELDS) set(`${p}_${f}`, pa[f]) }
  for (const [pre, c] of [['comD', form.comD || {}], ['comA', form.comA || {}]]) {
    set(`${pre}_base`, c.base); set(`${pre}_iva`, c.iva); set(`${pre}_total`, c.total); set(`${pre}_pct`, c.pct)
    set(`${pre}_tipodoc`, c.tipo_doc); set(`${pre}_cesp`, c.c_especiales); set(`${pre}_coment`, c.comentario)
  }
  const promoted = {
    id_lcc: form.idop, tipo: form.tipo || 'arriendo', fecha_registro: form.fecha_registro || null,
    inmueble: i.direccion || null, moneda: i.moneda || null, cantidad_contrato2: i.monto || null,
    ejecutivo_venta: form.vendedor || null,
    dueno_vendedor: (form.partes?.D?.nombre) || null, arrendatario_comprador: (form.partes?.A?.nombre) || null,
    raw_data: raw, updated_at: new Date().toISOString(),
  }
  return promoted
}

async function siguienteId(sb) {
  const { data } = await sb.from('log').select('id_lcc').ilike('id_lcc', 'R%')
  let max = 0
  for (const r of (data || [])) { const n = parseInt(String(r.id_lcc).replace(/\D/g, ''), 10); if (!isNaN(n) && n > max) max = n }
  return 'R' + String(max + 1).padStart(5, '0')
}

export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!autorizado(session)) return Response.json({ error: 'Sin acceso (solo Dirección y Legal).' }, { status: 403 })
  try {
    const sb = svc()
    const url = new URL(req.url)
    if (url.searchParams.get('nuevo')) {
      const sig = await siguienteId(sb)
      return Response.json({ ok: true, siguiente: sig, form: leerForm({ id_lcc: sig, raw_data: {} }) })
    }
    const idop = (url.searchParams.get('idop') || '').trim().toUpperCase()
    if (!/^R\d{5}$/.test(idop)) return Response.json({ error: 'IdArriendo inválido (Rxxxxx).' }, { status: 400 })
    const { data, error } = await sb.from('log')
      .select('id_lcc, tipo, fecha_registro, inmueble, moneda, cantidad_contrato2, ejecutivo_venta, raw_data')
      .eq('id_lcc', idop).limit(1)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    if (!data || !data.length) return Response.json({ ok: true, existe: false, form: leerForm({ id_lcc: idop, raw_data: {} }) })
    return Response.json({ ok: true, existe: true, form: leerForm(data[0]) })
  } catch (e) { return Response.json({ error: String(e?.message || e) }, { status: 500 }) }
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!autorizado(session)) return Response.json({ error: 'Sin acceso (solo Dirección y Legal).' }, { status: 403 })

  let body = {}
  try { body = await req.json() } catch {}
  const accion = String(body.accion || 'guardar')
  const sb = svc()

  try {
    if (accion === 'desbloquear') {
      const idop = String(body.idop || '').trim().toUpperCase()
      if (!/^R\d{5}$/.test(idop)) return Response.json({ error: 'IdArriendo inválido.' }, { status: 400 })
      const { data } = await sb.from('log').select('id, raw_data').eq('id_lcc', idop).limit(1)
      if (!data || !data.length) return Response.json({ error: 'No existe ' + idop }, { status: 404 })
      const raw = { ...(data[0].raw_data || {}) }; raw['HECHO/PENDIENTE2'] = ''; raw['hecho'] = ''
      const { error } = await sb.from('log').update({ raw_data: raw, updated_at: new Date().toISOString() }).eq('id', data[0].id)
      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json({ ok: true, desbloqueado: true })
    }

    // accion 'guardar' (borrador). No toca HECHO; si ya está HECHO, exige desbloquear antes.
    const form = body.form || {}
    const idop = String(form.idop || '').trim().toUpperCase()
    if (!/^R\d{5}$/.test(idop)) return Response.json({ error: 'IdArriendo inválido (Rxxxxx).' }, { status: 400 })
    const { data: prev } = await sb.from('log').select('id, raw_data').eq('id_lcc', idop).limit(1)
    const existe = prev && prev.length
    if (existe) {
      const hecho = String((prev[0].raw_data || {})['HECHO/PENDIENTE2'] || '').trim().toUpperCase() === 'HECHO'
      if (hecho) return Response.json({ error: 'Operación PROTEGIDA (HECHO). Desbloquea antes de guardar.' }, { status: 409 })
    }
    const promoted = escribir({ ...form, idop }, existe ? prev[0].raw_data : {})
    if (existe) {
      const { error } = await sb.from('log').update(promoted).eq('id', prev[0].id)
      if (error) return Response.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await sb.from('log').insert({ ...promoted, sync_hash: null })
      if (error) return Response.json({ error: error.message }, { status: 500 })
    }
    return Response.json({ ok: true, guardado: true, idop, nuevo: !existe })
  } catch (e) { return Response.json({ error: String(e?.message || e) }, { status: 500 }) }
}
