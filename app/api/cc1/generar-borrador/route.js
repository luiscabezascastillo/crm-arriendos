// app/api/cc1/generar-borrador/route.js
//
// Genera el BORRADOR de contrato a partir de una plantilla .docx subida por el usuario.
// Recibe (multipart/form-data): idadmon + file (la plantilla con marcadores {{...}}).
// Rellena los marcadores con los datos de la ficha (datos_arriendos + log.raw_data),
// derivando: renta en palabras, fechas en palabras, fechas de reajuste y género.
// Los marcadores sin dato salen como «⟨FALTA: nombre⟩» para que Anthony los complete.
// Devuelve el .docx con nombre "IDADMON Borrador.docx".
//
// Requiere: npm install docxtemplater pizzip

import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { supabaseAdmin, getCapacidades } from '../../../../lib/cc1Permisos'
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'

// ── Helpers de derivación ───────────────────────────────────────────────────
const UNI = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve']
const DEC = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
const CEN = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function seccion(n) {
  if (n === 0) return ''
  if (n === 100) return 'cien'
  let s = ''
  const c = Math.floor(n / 100), resto = n % 100
  if (c) s += CEN[c]
  if (resto) {
    if (s) s += ' '
    if (resto < 30) s += UNI[resto]
    else { const d = Math.floor(resto / 10), u = resto % 10; s += DEC[d]; if (u) s += ' y ' + UNI[u] }
  }
  return s
}
function numeroAPalabras(num) {
  num = Math.round(Number(String(num).replace(/[^\d-]/g, '')))
  if (isNaN(num)) return ''
  if (num === 0) return 'cero'
  const millones = Math.floor(num / 1000000), miles = Math.floor((num % 1000000) / 1000), resto = num % 1000
  const p = []
  if (millones) p.push(millones === 1 ? 'un millón' : seccion(millones) + ' millones')
  if (miles) p.push(miles === 1 ? 'mil' : seccion(miles) + ' mil')
  if (resto) p.push(seccion(resto))
  return p.join(' ')
}
function anioPunto(a) { const s = String(a); return s.slice(0, 1) + '.' + s.slice(1) }
function fechaPalabras(iso) {
  if (!iso) return ''
  const d = new Date(String(iso).slice(0, 10) + 'T00:00:00'); if (isNaN(d)) return ''
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${anioPunto(d.getFullYear())}`
}
function fechaReajuste(iso, cada, n) {
  if (!iso) return ''
  const d = new Date(String(iso).slice(0, 10) + 'T00:00:00'); if (isNaN(d)) return ''
  d.setMonth(d.getMonth() + cada * n); d.setDate(1)
  return `01 de ${MESES[d.getMonth()]} de ${anioPunto(d.getFullYear())}`
}
// "IPC cada 6 meses" / "semestral" / "trimestral" / "anual" -> nº de meses
function mesesReajuste(revision) {
  const r = String(revision || '').toLowerCase()
  const m = r.match(/cada\s+(\d+)\s*mes/); if (m) return parseInt(m[1], 10)
  if (/trimestr/.test(r)) return 3
  if (/semestr/.test(r)) return 6
  if (/anual|12\s*mes/.test(r)) return 12
  return 6
}
function num(x) { const n = Number(String(x ?? '').replace(/\./g, '').replace(/[^\d.-]/g, '')); return isNaN(n) ? '' : n }
function miles(x) { const n = num(x); return n === '' ? '' : n.toLocaleString('es-CL') }

export async function POST(req) {
  // Permiso: solo quien puede facturar (responsable/Dirección), igual que Cerrar y Facturar
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  const cap = await getCapacidades(email)
  if (!cap.puedeFacturar) return Response.json({ error: 'Sin permiso (solo responsable/Dirección).' }, { status: 403 })

  let idadmon, fileBuf
  try {
    const fd = await req.formData()
    idadmon = String(fd.get('idadmon') || '').trim()
    const file = fd.get('file')
    if (!idadmon) return Response.json({ error: 'Falta idadmon' }, { status: 400 })
    if (!file || typeof file.arrayBuffer !== 'function') return Response.json({ error: 'Falta la plantilla (.docx)' }, { status: 400 })
    fileBuf = Buffer.from(await file.arrayBuffer())
  } catch (e) {
    return Response.json({ error: 'No se pudo leer el formulario: ' + e.message }, { status: 400 })
  }

  // Ficha
  const { data: dat, error } = await supabaseAdmin.from('datos_arriendos').select('*').eq('idadmon', idadmon).single()
  if (error || !dat) return Response.json({ error: 'Contrato no encontrado: ' + idadmon }, { status: 404 })

  // Detalle del arrendatario desde log.raw_data (estado civil, domicilios, género)
  let raw = {}
  try {
    const { data: lRow } = await supabaseAdmin.from('log').select('raw_data').eq('id_lcc', idadmon).maybeSingle()
    if (lRow?.raw_data && typeof lRow.raw_data === 'object') raw = lRow.raw_data
  } catch { raw = {} }
  const rg = (k) => (raw[k] != null ? String(raw[k]) : '')

  const genero = (rg('Genero-A') || '').toUpperCase()  // 'M' femenino, 'H' masculino
  const esF = genero === 'M'
  const cada = mesesReajuste(dat.revision)

  // Marcadores -> valores. Los que no se rellenan salen como «⟨FALTA: x⟩» (nullGetter).
  const data = {
    IDADMON: idadmon,
    ARRENDATARIO: dat.arrendatario || rg('Nombre-A') || undefined,
    RUT_ARRENDATARIO: dat.rut || rg('RUT de A') || undefined,
    EMAIL_ARRENDATARIO: dat.mail_arrendatario || rg('email de A') || undefined,
    TELEFONO_ARRENDATARIO: dat.movil || rg('telefono de A') || undefined,
    ESTADO_CIVIL: rg('Estado-A') || undefined,
    DOMICILIO: rg('Dom-Habit-A') || undefined,
    DOMICILIO_LABORAL: rg('Dom-Lab-A') || undefined,
    INMUEBLE: dat.inmueble || undefined,
    RENTA: miles(dat.cuota) || undefined,
    RENTA_PALABRAS: dat.cuota ? (numeroAPalabras(dat.cuota) + ' pesos chilenos') : undefined,
    FECHA_INICIO: fechaPalabras(dat.fecha_inicio) || undefined,
    FECHA_FIN: fechaPalabras(dat.termino_inicial) || undefined,
    REAJUSTE: dat.revision || undefined,
    FECHA_REAJUSTE_1: dat.fecha_inicio ? fechaReajuste(dat.fecha_inicio, cada, 1) : undefined,
    FECHA_REAJUSTE_2: dat.fecha_inicio ? fechaReajuste(dat.fecha_inicio, cada, 2) : undefined,
    // Género (para concordancia en el texto)
    DONA_DON: esF ? 'doña' : 'don',
    ARRENDATARIA_O: esF ? 'Arrendataria' : 'Arrendatario',
    arrendataria_o: esF ? 'arrendataria' : 'arrendatario',
    // Estos normalmente NO están en la ficha -> saldrán como ⟨FALTA: ...⟩:
    // NACIONALIDAD, PROFESION, COMUNA_INMUEBLE, REGION_INMUEBLE, COMUNA_DOMICILIO, COMUNA_DOMICILIO_LABORAL
  }
  // quitar undefined para que actúe el nullGetter
  for (const k in data) if (data[k] === undefined) delete data[k]

  // Rellenar la plantilla
  let out
  try {
    const zip = new PizZip(fileBuf)
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true, linebreaks: true,
      delimiters: { start: '{{', end: '}}' },
      nullGetter: (part) => (part && part.value ? `⟨FALTA: ${part.value}⟩` : ''),
    })
    doc.render(data)
    out = doc.getZip().generate({ type: 'nodebuffer' })
  } catch (e) {
    const det = e?.properties?.errors ? e.properties.errors.map(x => x.properties?.explanation).join(' | ') : e.message
    return Response.json({ error: 'Error al rellenar la plantilla: ' + det }, { status: 422 })
  }

  const filename = `${idadmon} Borrador.docx`
  return new Response(out, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}