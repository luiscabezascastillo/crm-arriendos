import { createClient } from '@supabase/supabase-js'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/*
  POST /api/cc1/guardar-personas
  Body: { idadmon, personas: { arr1:{...}, arr2:{...}, aval1:{...}, aval2:{...} } }

  Guarda los datos de ARRENDATARIOS (1 y 2) y AVALES (1 y 2) replicando el VBA:
   - log.raw_data  -> registro COMPLETO (los 11 campos de cada persona, claves del mapeo)
   - datos_arriendos -> RESUMEN (arrendatario 1 y aval 1, campos básicos)

  El PROPIETARIO no se toca aquí (su fuente es la tabla 'propietarios').
  El raw_data se FUSIONA: solo se reescriben las claves de arrendatarios/avales;
  todas las demás claves del JSON se conservan intactas.
*/

// Mapeo: campo lógico -> clave en raw_data, por persona.
// Los 11 campos: nombre, genero, estado, nacion, rut, pasaporte, email, telefono, domHabit, domLab, empresa.
const SUFIJOS = {
  arr1:  { nombre:'Nombre-A',  genero:'Genero-A',  estado:'Estado-A',  nacion:'Nacion-A',  rut:'RUT de A',  pasaporte:'Pasaporte-A',  email:'email de A',  telefono:'telefono de A',  domHabit:'Dom-Habit-A',  domLab:'Dom-Lab-A',  empresa:'Empresa-A' },
  arr2:  { nombre:'Nombre-A2', genero:'Genero-A2', estado:'Estado-A2', nacion:'Nacion-A2', rut:'RUT de A2', pasaporte:'Pasaporte-A2', email:'email de A2', telefono:'telefono de A2', domHabit:'Dom-Habit-A2', domLab:'Dom-Lab-A2', empresa:'Empresa-A2' },
  aval1: { nombre:'Nombre-G',  genero:'Genero-G',  estado:'Estado-G',  nacion:'Nacion-G',  rut:'RUT de G',  pasaporte:'Pasaporte-G',  email:'email de G',  telefono:'telefono de G',  domHabit:'Dom-Habit-G',  domLab:'Dom-Lab-G',  empresa:'Empresa-G' },
  aval2: { nombre:'Nombre-G2', genero:'Genero-G2', estado:'Estado-G2', nacion:'Nacion-G2', rut:'RUT de G2', pasaporte:'Pasaporte-G2', email:'email de G2', telefono:'telefono de G2', domHabit:'Dom-Habit-G2', domLab:'Dom-Lab-G2', empresa:'Empresa-G2' },
}

// Claves redundantes del Excel que conviene mantener sincronizadas (trazabilidad).
// Se actualizan SOLO para arrendatario 1 y aval... en realidad el VBA las mantiene; las sincronizamos
// para no dejar el JSON incoherente. Si la persona está vacía, no tocamos las redundantes.
function aplicarPersona(raw, sufijos, datos) {
  for (const campo of Object.keys(sufijos)) {
    const clave = sufijos[campo]
    const val = datos?.[campo]
    // Solo escribimos si viene definido (string). Permite vaciar con cadena vacía explícita.
    if (val !== undefined && val !== null) raw[clave] = String(val)
  }
}

export async function POST(req) {
  // Sesión (quién edita) — opcional pero la registramos si está
  let email = null
  try {
    const session = await getServerSession(authOptions)
    email = session?.user?.email || null
  } catch { email = null }

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }

  const idadmon = (body?.idadmon || '').toString().trim().toUpperCase()
  const personas = body?.personas || {}
  if (!idadmon) return Response.json({ error: 'Falta idadmon' }, { status: 400 })

  // 1) Leer el raw_data actual del log (NO sobrescribir lo que no tocamos)
  const { data: lrow, error: eRead } = await supabase
    .from('log').select('raw_data').eq('id_lcc', idadmon).maybeSingle()
  if (eRead) return Response.json({ error: 'Error leyendo log: ' + eRead.message }, { status: 500 })

  const raw = (lrow?.raw_data && typeof lrow.raw_data === 'object') ? { ...lrow.raw_data } : {}

  // 2) Fusionar SOLO las claves de arrendatarios y avales
  if (personas.arr1)  aplicarPersona(raw, SUFIJOS.arr1,  personas.arr1)
  if (personas.arr2)  aplicarPersona(raw, SUFIJOS.arr2,  personas.arr2)
  if (personas.aval1) aplicarPersona(raw, SUFIJOS.aval1, personas.aval1)
  if (personas.aval2) aplicarPersona(raw, SUFIJOS.aval2, personas.aval2)

  // 3) Guardar el raw_data fusionado de vuelta en log
  //    Si la fila de log no existía, la creamos (id_lcc = idadmon).
  let logResult
  if (lrow) {
    logResult = await supabase.from('log')
      .update({ raw_data: raw, updated_at: new Date().toISOString() })
      .eq('id_lcc', idadmon)
  } else {
    logResult = await supabase.from('log')
      .insert({ id_lcc: idadmon, raw_data: raw, updated_at: new Date().toISOString() })
  }
  if (logResult.error) return Response.json({ error: 'Error guardando log: ' + logResult.error.message }, { status: 500 })

  // 4) Actualizar el RESUMEN en datos_arriendos (arrendatario 1 + aval 1)
  const resumen = {}
  if (personas.arr1) {
    if (personas.arr1.nombre   !== undefined) resumen.arrendatario      = personas.arr1.nombre || null
    if (personas.arr1.rut      !== undefined) resumen.rut               = personas.arr1.rut || null
    if (personas.arr1.email    !== undefined) resumen.mail_arrendatario = personas.arr1.email || null
    if (personas.arr1.telefono !== undefined) resumen.movil             = personas.arr1.telefono || null
  }
  if (personas.aval1) {
    if (personas.aval1.nombre   !== undefined) resumen.avalista          = personas.aval1.nombre || null
    if (personas.aval1.email    !== undefined) resumen.mail_avalista     = personas.aval1.email || null
    if (personas.aval1.telefono !== undefined) resumen.telefono_avalista = personas.aval1.telefono || null
  }
  if (Object.keys(resumen).length > 0) {
    resumen.updated_at = new Date().toISOString()
    const { error: eUpd } = await supabase.from('datos_arriendos').update(resumen).eq('idadmon', idadmon)
    if (eUpd) return Response.json({ error: 'Error guardando resumen: ' + eUpd.message }, { status: 500 })
  }

  return Response.json({ ok: true, idadmon, editado_por: email })
}
