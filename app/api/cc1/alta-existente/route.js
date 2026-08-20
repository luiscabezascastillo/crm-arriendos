// VERSION: v2 · 2026-08-20 · La columna `tipo` de inmuebles_norm se guarda con los valores REALES de la
//   tabla (`depto` / `bodega` / `estac`), no con el código corto. El resto igual. Hereda v1.
// VERSION: v1 · 2026-08-20 · Alta de un IDADMON NUEVO para un PROPIETARIO YA EXISTENTE, creando además
//   la unidad en el ORIGEN (inmuebles_norm). Flujo (b): (1) valida el propietario (idprop) contra la tabla
//   `propietarios` y toma su nombre real; (2) genera el siguiente IDINMUE del propietario según el rango del
//   tipo (dep 01-49, bod 51-79, est 81-99), reutilizando el prefijo de sus IDINMUE existentes; (3) registra
//   la unidad en `inmuebles_norm`; (4) crea el contrato en `datos_arriendos` en estado P (siguiente correlativo
//   MAX(idadmon)+1) para que siga el flujo normal; (5) email "00 nuevo" + histórico. Si algo falla tras crear
//   el inmueble, se revierte. Anthony/Dirección (responsable) → alta directa; colaborador (Neika) → pendiente.
// app/api/cc1/alta-existente/route.js

import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { supabaseAdmin, getCapacidades } from '../../../../lib/cc1Permisos'
import { buildSubject, enviarNotificacion } from '../../../../lib/cc1Email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Rangos del número del IDINMUE por tipo (mismo criterio que la agrupación de inmuebles).
const RANGOS = { dep: [1, 49], bod: [51, 79], est: [81, 99] }
const TIPO_LABEL = { dep: 'departamento', bod: 'bodega', est: 'estacionamiento' }
// Valor que se guarda en inmuebles_norm.tipo (convención real de la tabla: depto/bodega/estac).
const TIPO_DB = { dep: 'depto', bod: 'bodega', est: 'estac' }

function siguienteIdadmon(maxId) {
  const m = String(maxId || '').match(/^([A-Za-z]*)(\d+)$/)
  if (!m) return null
  const prefijo = m[1] || 'A'
  const num = parseInt(m[2], 10) + 1
  return prefijo + String(num).padStart(m[2].length, '0')
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })

  const cap = await getCapacidades(email)
  if (!cap.puedeAltaDirecta && !cap.puedeAltaPendiente) {
    return Response.json({ error: 'Sin permiso para dar de alta contratos (requiere responsable o colaborador en Gestión LOG).' }, { status: 403 })
  }

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }

  const idprop = String(body?.idprop || '').trim()
  const tipo = String(body?.tipo || '').trim().toLowerCase()
  const inmueble = String(body?.inmueble || '').trim()
  const rol = String(body?.rol || '').trim()

  if (!idprop) return Response.json({ error: 'Falta el propietario (idprop).' }, { status: 400 })
  if (!RANGOS[tipo]) return Response.json({ error: 'Tipo de unidad no válido (dep, bod o est).' }, { status: 400 })
  if (inmueble.length < 3) return Response.json({ error: 'Escribe la dirección / descripción del inmueble.' }, { status: 400 })

  // 1) Propietario debe existir; el NOMBRE se toma de la ficha (fuente de verdad), no del cliente.
  const { data: prop, error: eProp } = await supabaseAdmin
    .from('propietarios').select('idprop, propietario, nombre, apellidos').eq('idprop', idprop).maybeSingle()
  if (eProp) return Response.json({ error: 'Error al leer propietario: ' + eProp.message }, { status: 500 })
  if (!prop) return Response.json({ error: `El propietario ${idprop} no existe en la tabla propietarios.` }, { status: 404 })
  const nombreProp = (prop.propietario || [prop.apellidos, prop.nombre].filter(Boolean).join(', ') || idprop).trim()

  // 2) Siguiente IDINMUE del propietario en el rango del tipo. Se reutiliza el prefijo de sus IDINMUE
  //    ya existentes (por si el idprop lleva padding, p. ej. P059-01) y se rellenan huecos si los hay.
  const { data: units, error: eU } = await supabaseAdmin
    .from('inmuebles_norm').select('idinmue').eq('idprop', idprop)
  if (eU) return Response.json({ error: 'Error al leer inmuebles: ' + eU.message }, { status: 500 })

  let prefijo = idprop
  const usados = new Set()
  for (const u of units || []) {
    const s = String(u.idinmue || '')
    const idx = s.lastIndexOf('-')
    if (idx > 0) {
      if (prefijo === idprop) prefijo = s.slice(0, idx)   // adoptar el prefijo real de esta familia
      const n = parseInt(s.slice(idx + 1), 10)
      if (!isNaN(n)) usados.add(n)
    }
  }
  const [lo, hi] = RANGOS[tipo]
  let n = lo
  while (n <= hi && usados.has(n)) n++
  if (n > hi) {
    return Response.json({ error: `No quedan números libres para ${TIPO_LABEL[tipo]} (${lo}-${hi}) en ${idprop}.` }, { status: 409 })
  }
  const idinmue = `${prefijo}-${String(n).padStart(2, '0')}`

  // 3) Correlativo del contrato (MAX(idadmon)+1).
  const { data: maxRows } = await supabaseAdmin
    .from('datos_arriendos').select('idadmon').order('idadmon', { ascending: false }).limit(1)
  const nuevoId = siguienteIdadmon(maxRows?.[0]?.idadmon)
  if (!nuevoId) return Response.json({ error: 'No se pudo calcular el correlativo del contrato.' }, { status: 500 })

  const pendiente = !cap.puedeAltaDirecta  // colaborador -> pendiente ; responsable/Dirección -> directo

  // 4) Registrar la unidad en el ORIGEN (inmuebles_norm).
  const { error: eIns } = await supabaseAdmin.from('inmuebles_norm').insert([{
    idinmue, idprop, tipo: TIPO_DB[tipo], inmueble, rol: rol || null, propietario: nombreProp,
  }])
  if (eIns) return Response.json({ error: 'Error al crear el inmueble: ' + eIns.message }, { status: 500 })

  // 5) Crear el contrato en datos_arriendos (estado P). Si falla, revertir el inmueble.
  const fila = {
    idadmon: nuevoId,
    estado: 'P',
    idprop,
    propietario: nombreProp,
    inmueble,
    idlinmue: idinmue,
    pendiente_aprobacion: pendiente,
    creado_por: email,
    updated_at: new Date().toISOString(),
  }
  const { error: eDA } = await supabaseAdmin.from('datos_arriendos').insert([fila])
  if (eDA) {
    await supabaseAdmin.from('inmuebles_norm').delete().eq('idinmue', idinmue)   // rollback
    return Response.json({ error: 'Error al crear el contrato (inmueble revertido): ' + eDA.message }, { status: 500 })
  }

  // 6) Email "00 nuevo" + histórico.
  const subject = buildSubject({
    idadmon: nuevoId, estadoNuevo: 'P',
    propietario: nombreProp, inmueble,
    fecha: new Date().toISOString().slice(0, 10),
  })
  await supabaseAdmin.from('historico_idadmon').insert([{
    idadmon: nuevoId, evento: 'creado_P',
    estado_anterior: null, estado_nuevo: 'P',
    fecha: new Date().toISOString().slice(0, 10),
    usuario: email, email_subject: subject,
    detalle: `alta ${pendiente ? '(pendiente de aprobación) ' : ''}propietario existente ${idprop} · inmueble ${idinmue}`,
  }])
  const r = await enviarNotificacion({
    subject: pendiente ? `[PENDIENTE APROBACIÓN] ${subject}` : subject,
  })

  return Response.json({
    ok: true,
    idadmon: nuevoId,
    idinmue,
    idprop,
    propietario: nombreProp,
    pendiente_aprobacion: pendiente,
    email_ok: r.ok,
    mensaje: pendiente
      ? `Contrato ${nuevoId} e inmueble ${idinmue} creados, pendientes de aprobación de Anthony.`
      : `Contrato ${nuevoId} creado en estado P con el inmueble ${idinmue}.`,
  })
}
