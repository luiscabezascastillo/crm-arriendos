// app/api/cc1/generar-borrador/route.js
//
// SISTEMA B (auto-marcado). Recibe (multipart/form-data): idadmon (el NUEVO, que se
// está facturando) + file (.docx de un contrato CUALQUIERA ya relleno que sirve de base).
//
// Flujo:
//   1. Lee el .docx, detecta el IDADMON de ORIGEN escrito dentro (A + 5 dígitos).
//   2. Carga la ficha de ORIGEN (valores viejos) y la del contrato NUEVO (valores nuevos).
//   3. Sustituye en el texto los valores viejos por los nuevos (nombre, RUT, email,
//      teléfono, IDADMON, renta nº, inmueble, domicilios). Best-effort: renta en palabras
//      y género (doña/don, arrendataria/o). Las fechas quedan del origen (se corrigen).
//   4. Devuelve "IDADMON_nuevo Borrador.docx".

import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { supabaseAdmin, getCapacidades } from '../../../../lib/cc1Permisos'
import PizZip from 'pizzip'

const UNI = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve']
const DEC = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
const CEN = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos']
function seccion(n) {
  if (n === 0) return ''
  if (n === 100) return 'cien'
  let s = ''; const c = Math.floor(n / 100), r = n % 100
  if (c) s += CEN[c]
  if (r) { if (s) s += ' '; if (r < 30) s += UNI[r]; else { const d = Math.floor(r / 10), u = r % 10; s += DEC[d]; if (u) s += ' y ' + UNI[u] } }
  return s
}
function numeroAPalabras(num) {
  num = Math.round(Number(String(num).replace(/[^\d-]/g, '')))
  if (isNaN(num) || num === 0) return ''
  const mi = Math.floor(num / 1000000), m = Math.floor((num % 1000000) / 1000), r = num % 1000
  const p = []
  if (mi) p.push(mi === 1 ? 'un millón' : seccion(mi) + ' millones')
  if (m) p.push(m === 1 ? 'mil' : seccion(m) + ' mil')
  if (r) p.push(seccion(r))
  return p.join(' ')
}
function numMiles(x) { const n = Number(String(x ?? '').replace(/\./g, '').replace(/[^\d.-]/g, '')); return isNaN(n) ? '' : n.toLocaleString('es-CL') }
function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }
function escRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

// Fusiona runs adyacentes con el MISMO formato real (rPr, ignorando rsid), para que
// valores partidos por Word (p.ej. "A008"+"5"+"7") queden como texto contiguo y se puedan
// localizar/sustituir. Preserva el formato (negrita, subrayado…).
function normRpr(r) { return (r || '').replace(/\sw:rsid\w+="[^"]*"/g, '') }
function fusionarRuns(xml) {
  let prev
  do {
    prev = xml
    xml = xml.replace(/<w:r\b[^>]*>(<w:rPr>.*?<\/w:rPr>)?<w:t( xml:space="preserve")?>([^<]*)<\/w:t><\/w:r><w:r\b[^>]*>(<w:rPr>.*?<\/w:rPr>)?<w:t( xml:space="preserve")?>([^<]*)<\/w:t><\/w:r>/gs,
      (m, rpr1, sp1, t1, rpr2, sp2, t2) => (normRpr(rpr1) === normRpr(rpr2))
        ? `<w:r>${rpr1 || ''}<w:t xml:space="preserve">${t1}${t2}</w:t></w:r>` : m)
  } while (xml !== prev)
  return xml
}

async function cargarFicha(idadmon) {
  const { data: dat } = await supabaseAdmin.from('datos_arriendos').select('*').eq('idadmon', idadmon).single()
  if (!dat) return null
  let raw = {}
  try {
    const { data: l } = await supabaseAdmin.from('log').select('raw_data').eq('id_lcc', idadmon).maybeSingle()
    if (l?.raw_data && typeof l.raw_data === 'object') raw = l.raw_data
  } catch {}
  const rg = (k) => (raw[k] != null ? String(raw[k]) : '')
  return {
    idadmon,
    nombre: dat.arrendatario || rg('Nombre-A') || '',
    rut: dat.rut || rg('RUT de A') || '',
    email: dat.mail_arrendatario || rg('email de A') || '',
    telefono: dat.movil || rg('telefono de A') || '',
    inmueble: dat.inmueble || '',
    domHabit: rg('Dom-Habit-A') || '',
    domLab: rg('Dom-Lab-A') || '',
    renta: dat.cuota || '',
    genero: (rg('Genero-A') || '').toUpperCase(),
  }
}

function sust(xml, viejo, nuevo) {
  const v = String(viejo || '').trim()
  if (!v) return [xml, 0]
  const re = new RegExp(escRe(v), 'g')
  let n = 0
  const out = xml.replace(re, () => { n++; return esc(nuevo) })
  return [out, n]
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  const cap = await getCapacidades(email)
  if (!cap.puedeFacturar) return Response.json({ error: 'Sin permiso (solo responsable/Dirección).' }, { status: 403 })

  let idadmonNuevo, fileBuf
  try {
    const fd = await req.formData()
    idadmonNuevo = String(fd.get('idadmon') || '').trim().toUpperCase()
    const file = fd.get('file')
    if (!idadmonNuevo) return Response.json({ error: 'Falta idadmon (contrato nuevo)' }, { status: 400 })
    if (!file || typeof file.arrayBuffer !== 'function') return Response.json({ error: 'Falta el .docx de base' }, { status: 400 })
    fileBuf = Buffer.from(await file.arrayBuffer())
  } catch (e) {
    return Response.json({ error: 'No se pudo leer el formulario: ' + e.message }, { status: 400 })
  }

  let zip, xml
  try {
    zip = new PizZip(fileBuf)
    xml = zip.file('word/document.xml').asText()
    xml = fusionarRuns(xml)   // fusiona runs partidos para poder localizar los valores
  } catch (e) {
    return Response.json({ error: 'El archivo no es un .docx válido.' }, { status: 400 })
  }

  const encontrados = [...new Set((xml.match(/A\d{5}/g) || []))]
  let idadmonOrigen = encontrados.find(x => x !== idadmonNuevo) || encontrados[0]
  if (!idadmonOrigen) return Response.json({ error: 'No encontré ningún IDADMON dentro del documento. ¿Es un contrato válido?' }, { status: 422 })
  if (idadmonOrigen === idadmonNuevo) return Response.json({ error: `El documento subido ya es del contrato ${idadmonNuevo}. Sube un contrato de OTRO IDADMON como base.` }, { status: 422 })

  const origen = await cargarFicha(idadmonOrigen)
  if (!origen) return Response.json({ error: `No encuentro el contrato de origen ${idadmonOrigen} en la base. Sube un contrato que exista en el CRM.` }, { status: 404 })
  const nuevo = await cargarFicha(idadmonNuevo)
  if (!nuevo) return Response.json({ error: `No encuentro el contrato nuevo ${idadmonNuevo} en la base.` }, { status: 404 })

  const cambios = []
  const pares = [
    ['IDADMON', origen.idadmon, nuevo.idadmon],
    ['Arrendatario', origen.nombre, nuevo.nombre],
    ['RUT', origen.rut, nuevo.rut],
    ['Email', origen.email, nuevo.email],
    ['Teléfono', origen.telefono, nuevo.telefono],
    ['Inmueble', origen.inmueble, nuevo.inmueble],
    ['Domicilio', origen.domHabit, nuevo.domHabit],
    ['Domicilio laboral', origen.domLab, nuevo.domLab],
  ]
  for (const [et, vv, nv] of pares) {
    let n1 = 0, n2 = 0
    ;[xml, n1] = sust(xml, vv, nv)
    if (et === 'Arrendatario' && vv && vv.toUpperCase() !== vv) {
      ;[xml, n2] = sust(xml, vv.toUpperCase(), String(nv).toUpperCase())
    }
    if (n1 + n2 > 0) cambios.push(`${et}: ${n1 + n2}`)
  }

  const rentaViejaMiles = numMiles(origen.renta)
  const rentaNuevaMiles = numMiles(nuevo.renta)
  if (rentaViejaMiles && rentaNuevaMiles) {
    let n = 0;[xml, n] = sust(xml, rentaViejaMiles, rentaNuevaMiles)
    if (n) cambios.push(`Renta: ${n}`)
  }

  const palVieja = numeroAPalabras(origen.renta)
  const palNueva = numeroAPalabras(nuevo.renta)
  if (palVieja && palNueva) {
    let n = 0;[xml, n] = sust(xml, palVieja, palNueva)
    if (n) cambios.push(`Renta en palabras: ${n}`)
  }

  if (origen.genero && nuevo.genero && origen.genero !== nuevo.genero) {
    const aFem = nuevo.genero === 'M'
    const swaps = aFem
      ? [['\\bdon\\b', 'doña'], ['Arrendatario', 'Arrendataria'], ['arrendatario', 'arrendataria']]
      : [['\\bdoña\\b', 'don'], ['Arrendataria', 'Arrendatario'], ['arrendataria', 'arrendatario']]
    for (const [re, to] of swaps) {
      try { xml = xml.replace(new RegExp(re, 'g'), to) } catch {}
    }
    cambios.push('Género: ajustado (revisar)')
  }

  let out
  try {
    zip.file('word/document.xml', xml)
    out = zip.generate({ type: 'nodebuffer' })
  } catch (e) {
    return Response.json({ error: 'Error al reconstruir el documento: ' + e.message }, { status: 500 })
  }

  const filename = `${idadmonNuevo} Borrador.docx`
  return new Response(out, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'X-Origen': idadmonOrigen,
      'X-Cambios': encodeURIComponent(cambios.join(' · ')),
    },
  })
}