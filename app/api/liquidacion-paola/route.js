// VERSION: v22 · 2026-08-23 · Roster de garantías = TODOS los arriendos de Paola (con arrendatario, no vacantes) desde
//   datos_arriendos, con moneda/cuota/reajustes + garantía pedida/cuotas 1-4/quién/deuda + contacto, para la hoja
//   "Garantías" (ledger agrupado, ordenado por inmueble). Hereda v21.
// VERSION: v21 · 2026-08-23 · Hoja "Garantías" del Excel = roster de TODOS los contratos S/SQ desde datos_arriendos
//   (garantía pedida, entregada = Σ cobradas, cuotas 1-4, quién, deuda, contacto), ordenado por inmueble + resumen del
//   mes. Nuevo helper cargarGarantiasRoster(); 'excel'/'enviar' pasan garantiasRoster a generarExcelPaola. Hereda v20.
// VERSION: v20 · 2026-08-23 · garantias_upsert numera la cuota sola cuando el nº viene vacío (mayor del contrato + 1),
//   para que la clave (idadmon, mes, nº) sea siempre única y editable. Hereda v19.
// VERSION: v19 · 2026-08-23 · Control de garantías CRUD (acciones garantias_list/_upsert/_delete sobre paola_garantias)
//   para registrar cuotas desde la pantalla; y las acciones 'excel'/'enviar' pasan las cuotas a generarExcelPaola
//   para la nueva hoja "Garantías". Hereda v18.
// VERSION: v18 · 2026-08-23 · TOPE DE ARRIENDO en pagos combinados. Nuevo control de garantías por cuotas (tabla
//   paola_garantias): cuando un arrendatario paga junto arriendo + cuota de garantía (+ bodega), la cartola trae
//   un solo abono mayor que el arriendo. Si hay cuota registrada para el mes, se TOPA (Recibido = A cobrar, FALTA = 0,
//   topado=true) y se sugiere el Comentario 1 con el desglose (arriendo + garantía cuota N + bodega). Sin cuota
//   registrada NO se topa (así no se ocultan sobrepagos ajenos como intereses de atraso). Expone recibidoBruto,
//   excedente, garantiaPedida y quien_tiene_garantia (para la hoja Garantías del Excel). Hereda v17.
// VERSION: v17 · 2026-08-19 · Carta EDITABLE antes de enviar (acción 'preview' devuelve el texto preescrito; 'enviar' admite
//   asunto/cuerpo editados). Morosos refinados: se separan los CRÍTICOS (no han pagado nada o deben ≥50%) con aviso de
//   gestiones de cobranza + llamadas + informe en una semana. Hereda v16.
// VERSION: v16 · 2026-08-19 · PERSISTENCIA de la cartola del mes (tabla paola_cartola): al procesar una cartola se guarda,
//   y al reabrir el mes (procesar sin cartola o "Ver lo guardado") se recupera sola → la hoja "Movimientos cuenta"
//   sale llena sin volver a subirla. Hereda v15.
// VERSION: v15 · 2026-08-19 · En modo PRUEBA el archivo también se guarda en Drive con prefijo PRUEBA- (para borrarlo luego).
// VERSION: v14 · 2026-08-19 · Envío a Paola por email (acción 'enviar'): 1º/2º/3º del mes con el progreso de cobranza
//   (a cobrar, recibido, %, morosos, multas) en el cuerpo + Excel adjunto; archiva en Drive y registra en paola_envios.
//   Acción 'envios' lista lo ya enviado. Admite correo de PRUEBA (no toca a Paola ni Drive). Hereda v13.
// VERSION: v13 · 2026-08-19 · La cartola se captura COMPLETA (cargos y abonos) en `cartolaRows`, con el IDADMON
//   reconocido por abono, y se pasa a generarExcelPaola para la hoja "Movimientos cuenta" (toda la cartola + IdAdmon
//   e Inmueble). parsearCartola devuelve filasCartola. Hereda v12.
// VERSION: v12 · 2026-08-19 · La acción 'excel' recibe y pasa `movimientos` (cartola del mes) a generarExcelPaola,
//   para la nueva hoja "Movimientos cuenta" del diseño profesional (lib/paolaExcel v4). Hereda v11.
// VERSION: v11 · 2026-08-18 · Estado de pago por contrato (columnas manuales estado_pago + nota_pago en
//   liquidacion_paola): Administración marca PAGADO / ATRASADO (el abono visto es de un mes anterior) /
//   NO_PAGADO, con una nota. Se persiste, se relee al recargar/cargar-guardado y sale en el Excel. Hereda v10.
// VERSION: v10 · 2026-08-17 · "cargar_guardado" ahora, en un mes NO congelado, REFRESCA los servicios
//   (GGCC/agua/luz) con lo último de ggcc_agua_luz, aunque el mes se guardara antes de cargarlos. Hereda v9.
// VERSION: v9 · 2026-08-17 · (1) Acción "cargar_guardado": abre el mes ya guardado (liquidacion_paola) sin
//   re-procesar la cartola, para que otra persona (Fabiola) revise/continúe lo de Adalis. (2) FIX servicios:
//   se elige la fila de ggcc_agua_luz MÁS RECIENTE con clave de período numérica (AAMM/mes) — antes el orden
//   por texto mezclaba '2608' y '2026-08' y podía coger una fila vieja sin GGCC → salía en blanco. Hereda v8.
// VERSION: v8 · 2026-08-17 · GUARDAR el mes en el CRM (escritura con SERVICE_ROLE para que RLS no la bloquee
//   en silencio). (1) Acción "guardar": upsert de la liquidación del mes
//   en liquidacion_paola por (mes, idadmon), con las columnas manuales (multas_deudas, especial, cantidad,
//   comentarios_1/2) que ahora edita Adalis en la pantalla — así deja el Excel. Guarda también la foto
//   (a_cobrar/recibido/falta/servicios) para que el mes en curso NO desaparezca. Candado: no escribe un mes
//   congelado (paola_cierres.congelado). (2) FIX de formato de mes: liquidacion_paola y paola_cierres se
//   guardan como 'AAAA-MM' (p.ej. 2026-08), NO AAMM; el overlay de columnas manuales leía con AAMM y nunca
//   casaba. Nueva utilidad aYYYYMM(). liquidacion_idadmon sigue en AAMM (correcto). Hereda v7.
// VERSION: v7 · 2026-08-16 · A COBRAR EN VIVO cuando el mes no está congelado. La foto liquidacion_idadmon solo
//   existe tras cerrar el mes (día 23); antes está vacía y salían 0 filas con importe. Ahora, si no hay foto del
//   mes, se calcula con el mismo RPC que CARTAS (calcular_liquidacion → base = A cobrar), filtrando a Paola (P001)
//   y enriqueciendo arrendatario/RUT desde el LOG. avisos.enVivo indica que el A cobrar es del cálculo en vivo.
//   Hereda v6.
// VERSION: v6 · 2026-07-22 · Añade la acción "excel": genera el Control con lib/paolaExcel y lo
//   guarda en la carpeta de Drive P001 PAOLA con la nomenclatura de la carpeta
//   ("2026-07-Control Jul 2026.xlsx"), creándolo o sobrescribiéndolo. Recupera el ámbito
//   drive.file, necesario para escribir. Requiere: npm i exceljs
// v5 · Cruce sobre el BUSCADOR (pagadores_idadmon):
//   1) nota manual de la cartola (col. de Adalis) · 2) buscador por clave · 3) ambiguos por
//   importe · 4) no_es_renta se aparta · 5) nombre parecido = SUGERENCIA, no asigna.
//   Eliminado el nivel por importe suelto (repartía ingresos ajenos de Paola).
//   Nueva acción "confirmar": lo que Adalis/Fabiola apuntan alimenta el buscador.
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '../../../lib/supabaseClient'
import { google } from 'googleapis'
import { generarExcelPaola, nombreArchivo, etiquetaMes } from '../../../lib/paolaExcel'
import { enviarNotificacion } from '../../../lib/cc1Email'

// Cliente de servicio (service_role) SOLO para escrituras server-side: evita que RLS bloquee en
// silencio el guardado del mes (mismo patrón que Global 66 / Tarjeta / SA). Nunca sale al navegador.
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const FOLDER_ID = '1zg3-H02UMhkVVDlF3OZjoE18x0eLLiXh'
const IDPROP_PAOLA = 'P001'
const ESTADOS_LIQUIDABLES = ['S', 'SQ', 'P', 'Q']

// Roster de garantías para la hoja "Garantías" del Excel: TODOS los contratos S/SQ de Paola con sus
// datos de garantía tal como viven en datos_arriendos (pedida, cuotas 1-4 con fecha/monto/cobrado, quién,
// deuda, contacto). La hoja lo ordena por inmueble. Fuente única = datos_arriendos.
async function cargarGarantiasRoster() {
  const { data, error } = await admin.from('datos_arriendos')
    .select('idadmon, estado, inmueble, idinmue, unid, cuota, uf_peso_factor, ' +
      'cantidad_reajuste1, cantidad_reajuste2, cantidad_reajuste3, cantidad_reajuste4, cantidad_reajuste5, cantidad_reajuste6, ' +
      'garantia_pedida, deuda_garantia, quien_tiene_garantia, garantia_con, ' +
      'fecha1, cuota1, cobrada1, fecha2, cuota2, cobrada2, fecha3, cuota3, cobrada3, fecha4, cuota4, cobrada4, ' +
      'fecha_inicio, termino_actual, arrendatario, mail_arrendatario, movil')
    .eq('idprop', IDPROP_PAOLA)
  if (error) { console.error('cargarGarantiasRoster:', error.message); return [] }
  // Todos los arriendos reales (con arrendatario), no las vacantes; la hoja los ordena por inmueble.
  return (data || []).filter(r => String(r.arrendatario || '').trim() && String(r.estado || '').toUpperCase() !== 'P')
}
const TOLERANCIA_MONTO = 500
const TOLERANCIA_EXCESO = 1000
const UMBRAL_NOMBRE = 65

// ── Drive ────────────────────────────────────────────────────────────────────
function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}')
  return new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.file',   // necesario para guardar el Control
    ],
  })
}

async function descargarDeDrive(fileId) {
  const drive = google.drive({ version: 'v3', auth: getAuth() })
  const res = await drive.files.get({ fileId, alt: 'media', supportsAllDrives: true }, { responseType: 'arraybuffer' })
  return Buffer.from(res.data)
}

// Crea el archivo en la carpeta, o sobrescribe el que ya exista con ese nombre.
async function subirADrive(nombre, buffer) {
  const drive = google.drive({ version: 'v3', auth: getAuth() })
  const { Readable } = await import('stream')
  const media = {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    body: Readable.from(buffer),
  }
  const existe = await drive.files.list({
    q: `'${FOLDER_ID}' in parents and name = '${nombre.replace(/'/g, "\\'")}' and trashed = false`,
    fields: 'files(id, name)', supportsAllDrives: true, includeItemsFromAllDrives: true,
  })
  const previo = existe.data.files?.[0]
  if (previo) {
    await drive.files.update({ fileId: previo.id, media, supportsAllDrives: true })
    return { id: previo.id, nombre, accion: 'sobrescrito' }
  }
  const creado = await drive.files.create({
    requestBody: { name: nombre, parents: [FOLDER_ID] },
    media, fields: 'id, name', supportsAllDrives: true,
  })
  return { id: creado.data.id, nombre, accion: 'creado' }
}

// ── utilidades ───────────────────────────────────────────────────────────────
function aAamm(mes) {
  const s = String(mes || '').trim()
  if (/^\d{4}$/.test(s)) return s
  const m = s.match(/^(\d{4})-(\d{2})$/)
  if (m) return m[1].slice(2) + m[2]
  throw new Error(`Mes no reconocido: "${mes}"`)
}

// paola_cierres y liquidacion_paola guardan el mes como 'AAAA-MM' (p.ej. 2026-08), NO como AAMM.
function aYYYYMM(mes) {
  const s = String(mes || '').trim()
  if (/^\d{4}-\d{2}$/.test(s)) return s
  const a = s.match(/^(\d{2})(\d{2})$/)
  if (a) return '20' + a[1] + '-' + a[2]
  throw new Error(`Mes no reconocido: "${mes}"`)
}
const txtOrNull = (v) => { const s = String(v ?? '').trim(); return s === '' ? null : s }

// Período de una fila de ggcc_agua_luz como número AAAAMM (para elegir la más reciente sin mezclar formatos).
function periodoNum(s) {
  const a = String(s?.aamm ?? '').replace(/[^\d]/g, '')
  if (/^\d{4}$/.test(a)) return parseInt('20' + a, 10)            // '2608' -> 202608
  const m = String(s?.mes ?? '').match(/^(\d{4})-?(\d{2})$/)
  if (m) return parseInt(m[1] + m[2], 10)                          // '2026-08' -> 202608
  return 0
}

function aNumero(v) {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const limpio = String(v).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
  if (limpio === '' || limpio === '-') return null
  const n = Number(limpio)
  return Number.isFinite(n) ? n : null
}

function sinTildes(s) {
  return String(s || '').replace(/\u00a0/g, ' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// La cartola rellena los RUT a 10 dígitos con ceros: "026951793K" = 26.951.793-K.
function extraerRut(detalle) {
  const d = sinTildes(detalle).trim()
  let m = d.match(/^(\d{1,3}(?:\.\d{3}){1,3}-[\dkK])/)          // 77.390.737-4
  if (m) return m[1].replace(/[^0-9kK]/g, '').toUpperCase().replace(/^0+/, '')
  m = d.match(/^(\d{7,11}[Kk]?)/)                                // 026951793K
  if (m) return m[1].toUpperCase().replace(/^0+/, '')
  return null
}

function claveGlosa(detalle) {
  return sinTildes(detalle).replace(/[^A-Za-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase()
}

// La clave del buscador: el RUT si lo hay; si no (depósitos Servipag), la glosa normalizada.
function claveDe(detalle) {
  return extraerRut(detalle) || claveGlosa(detalle)
}

function normalizarNombre(s) {
  return sinTildes(s)
    .replace(/[^a-zA-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase()
    .replace(/^\d+[Kk]?\s*/, '').replace(/^TRANSF[. ]+/, '').replace(/^DE\s+/, '')
}

function similitud(a, b) {
  const ta = new Set(a.split(' ').filter(x => x.length > 2))
  const tb = new Set(b.split(' ').filter(x => x.length > 2))
  if (ta.size === 0 || tb.size === 0) return 0
  const comunes = [...ta].filter(t => tb.has(t)).length
  const union = new Set([...ta, ...tb]).size
  return comunes >= 2 ? (comunes / union) * 100 + 10 : (comunes / union) * 100
}

function ordenNatural(a, b) {
  const trozos = s => String(s || '').toLowerCase().split(/(\d+)/).filter(x => x !== '')
  const ta = trozos(a), tb = trozos(b)
  for (let i = 0; i < Math.max(ta.length, tb.length); i++) {
    const x = ta[i], y = tb[i]
    if (x === undefined) return -1
    if (y === undefined) return 1
    const nx = /^\d+$/.test(x), ny = /^\d+$/.test(y)
    if (nx && ny) { if (Number(x) !== Number(y)) return Number(x) - Number(y) }
    else if (x !== y) return x < y ? -1 : 1
  }
  return 0
}

function aFechaISO(v) {
  if (!v) return null
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10)
  const s = String(v).trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (m) return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`
  return null
}

// ── unidades de una propiedad ────────────────────────────────────────────────
// "Pablo Urzúa 1481- dep 903A- est 41" → ['dep903a', 'est41']
function unidadesDePropiedad(txt) {
  const s = sinTildes(txt).toLowerCase()
  const out = []
  const re = /\b(dep|dpto|depto|est|bod)\s*\.?\s*(\d+)\s*-?\s*([a-z])?/g
  let m
  while ((m = re.exec(s)) !== null) {
    const tipo = m[1].startsWith('d') ? 'dep' : m[1]
    out.push(`${tipo}${m[2]}${m[3] || ''}`)
  }
  return out
}

// La nota que escribe Adalis en la cartola: "Dpto 903-A", "Est 40", "Bod 9".
function unidadDeNota(nota) {
  const u = unidadesDePropiedad(nota)
  return u.length ? u[0] : null
}

// ── parseo de la cartola ─────────────────────────────────────────────────────
function parsearCartola(XLSX, buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const hoja = wb.SheetNames.find(n => /movimiento|cartola/i.test(n)) || wb.SheetNames[0]
  const raw = XLSX.utils.sheet_to_json(wb.Sheets[hoja], { header: 1, defval: null, blankrows: true })

  let filaCab = -1, cols = {}
  for (let i = 0; i < Math.min(raw.length, 25); i++) {
    const fila = (raw[i] || []).map(c => String(c || '').trim().toLowerCase())
    const iFecha = fila.findIndex(c => c === 'fecha')
    const iDet = fila.findIndex(c => c.startsWith('detalle'))
    const iAbono = fila.findIndex(c => c.includes('abono'))
    if (iFecha >= 0 && iDet >= 0 && iAbono >= 0) {
      filaCab = i
      // La última columna es "Saldo", pero Adalis la usa para anotar la propiedad a mano.
      cols = { fecha: iFecha, detalle: iDet, cargo: fila.findIndex(c => c.includes('cargo')), abono: iAbono, nota: fila.findIndex(c => c.includes('saldo')) }
      break
    }
  }
  if (filaCab < 0) throw new Error('No se reconoce la cartola: falta una cabecera con Fecha, Detalle y Monto abono.')

  const abonos = []
  const filasCartola = []   // TODAS las filas de la cartola (cargos y abonos) para la hoja "Movimientos cuenta"
  for (let i = filaCab + 1; i < raw.length; i++) {
    const fila = raw[i]
    if (!fila || !fila[cols.fecha]) continue
    const detalle = String(fila[cols.detalle] || '')
    const cargo = cols.cargo >= 0 ? aNumero(fila[cols.cargo]) : null
    const abono = aNumero(fila[cols.abono])
    const notaCruda = cols.nota >= 0 ? fila[cols.nota] : null
    const nota = typeof notaCruda === 'string' ? notaCruda.trim() : null
    let abonoIdx = null
    if (abono && abono > 10) {   // solo los ABONOS entran en la liquidación (los cargos solo se listan)
      abonoIdx = abonos.length
      abonos.push({
        fila: abonos.length, fecha: fila[cols.fecha], detalle, monto: abono,
        rut: extraerRut(fila[cols.detalle]), clave: claveDe(fila[cols.detalle]), nota,
      })
    }
    filasCartola.push({ fecha: fila[cols.fecha], detalle, cargo, abono, nota, abonoIdx })
  }
  return { hoja, abonos, filasCartola }
}

// ── GET ──────────────────────────────────────────────────────────────────────
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const mes = searchParams.get('mes')
    let files = [], errorDrive = null
    try {
      const drive = google.drive({ version: 'v3', auth: getAuth() })
      const res = await drive.files.list({
        q: `'${FOLDER_ID}' in parents and mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' and trashed=false`,
        fields: 'files(id, name, modifiedTime, size)', orderBy: 'name desc',
        supportsAllDrives: true, includeItemsFromAllDrives: true,
      })
      files = (res.data.files || []).filter(f => /cartola/i.test(f.name))
    } catch (e) { errorDrive = e.message }

    let cierre = null
    if (mes) {
      const { data } = await supabase.from('paola_cierres').select('*').eq('mes', aAamm(mes)).maybeSingle()
      cierre = data || null
    }
    return NextResponse.json({ ok: true, files, errorDrive, cierre, congelado: !!cierre?.congelado })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Redacta la carta de envío a Paola (texto preescrito, editable después por quien envía).
// Distingue morosos "pendientes" de los CRÍTICOS (no han pagado nada o deben gran parte),
// para los que se anuncia gestión de cobranza + llamadas personales + informe en una semana.
function componerCartaPaola(filas, mes, n) {
  const num = v => Number(v) || 0
  const fmt = v => '$' + Math.round(v).toLocaleString('es-CL')
  const { texto: mesTxt } = etiquetaMes(mes)
  const noVac = (filas || []).filter(f => String(f.estado || '').toUpperCase() !== 'P' && !f.vacante)
  const aCobrar = noVac.reduce((s, f) => s + num(f.aCobrar), 0)
  const recibido = noVac.reduce((s, f) => s + num(f.recibido), 0)
  const falta = aCobrar - recibido
  const pct = aCobrar ? Math.round(recibido * 100 / aCobrar) : 0
  const multas = (filas || []).reduce((s, f) => s + num(f.multasDeudas), 0)
  const desc = f => `${f.idadmon}${f.arrendatario ? ' — ' + f.arrendatario : ''}`
  // Críticos: no han pagado nada, o deben la mitad o más de su renta del mes.
  const criticos = noVac.filter(f => num(f.aCobrar) > 0 && (num(f.recibido) === 0 || (num(f.aCobrar) - num(f.recibido)) >= num(f.aCobrar) * 0.5))
  const critIds = new Set(criticos.map(c => c.idadmon))
  const pendientes = noVac.filter(f => num(f.aCobrar) - num(f.recibido) > 1000 && !critIds.has(f.idadmon))

  const ETAPA = { 1: 'primer envío, recién recibida la cartola', 2: 'segundo envío, avance de cobranza', 3: 'envío definitivo del mes' }
  const L = ['Hola Paola:', '', `Te adjunto la liquidación de ${mesTxt} (${ETAPA[n]}).`, '',
    'Estado de la cobranza a día de hoy:',
    `  · A cobrar del mes : ${fmt(aCobrar)}`,
    `  · Recibido         : ${fmt(recibido)}  (${pct}%)`,
    `  · Pendiente        : ${fmt(falta)}`,
    `  · Multas aplicadas : ${fmt(multas)}`]
  if (pendientes.length) L.push('', `Pagos pendientes (${pendientes.length}): ${pendientes.map(desc).join(' · ')}.`)
  if (criticos.length) {
    L.push('', 'PRIORIDAD DE COBRANZA:')
    for (const c of criticos) {
      const f2 = num(c.aCobrar) - num(c.recibido)
      L.push(`  · ${desc(c)} — ${num(c.recibido) === 0 ? 'no ha pagado nada del mes' : 'debe ' + fmt(f2) + ' (una parte importante)'}.`)
    }
    L.push('Con estos casos vamos a hacer todas las gestiones de cobranza necesarias, incluidas llamadas personales, y te informaré del resultado en una semana.')
  }
  L.push('', n < 3 ? 'Seguimos gestionando el cobro de lo que queda pendiente y te enviaré una actualización durante el mes.' : 'Con esto cerramos la liquidación del mes.',
    '', 'Un saludo,', 'Adalis · Fondo Capital Rent')
  const asunto = `Liquidación ${mesTxt} · P001 Paola — ${n === 1 ? 'envío 1' : n === 2 ? 'envío 2' : 'envío final'}`
  return { asunto, cuerpo: L.join('\n'), resumen: { aCobrar, recibido, falta, pct, multas, morosos: pendientes.length + criticos.length, criticos: criticos.length } }
}

// ── POST ─────────────────────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const body = await request.json()

    // ── acción: confirmar una identificación (alimenta el buscador) ─────────
    if (body.accion === 'confirmar') {
      const { clave, rut, glosa, idadmon, clase, email } = body
      if (!clave) return NextResponse.json({ error: 'Falta la clave del pagador' }, { status: 400 })
      const fila = {
        clave, rut: rut || null, glosa: glosa || null,
        idadmon: clase === 'no_es_renta' ? null : (idadmon || null),
        clase: clase === 'no_es_renta' ? 'no_es_renta' : 'renta',
        vigente: true, origen: 'confirmado', confirmado_por: email || null,
      }
      if (fila.clase === 'renta' && !fila.idadmon) {
        return NextResponse.json({ error: 'Elige un contrato o marca "no es renta"' }, { status: 400 })
      }
      const { error } = await supabase.from('pagadores_idadmon').insert(fila)
      if (error && !String(error.message).includes('duplicate')) throw new Error(error.message)
      return NextResponse.json({ ok: true, guardado: fila })
    }

    // ── acción: GUARDAR la liquidación del mes en el CRM (upsert liquidacion_paola) ──
    //   Persiste la foto del mes + las columnas manuales que edita Adalis, para que deje el Excel.
    //   Clave única (mes, idadmon). No escribe un mes congelado.
    if (body.accion === 'guardar') {
      const { mes, filas, email } = body
      if (!mes) return NextResponse.json({ error: 'Falta el mes' }, { status: 400 })
      if (!Array.isArray(filas) || filas.length === 0) {
        return NextResponse.json({ error: 'No hay filas que guardar: procesa la liquidación primero' }, { status: 400 })
      }
      const mesYM = aYYYYMM(mes)
      const { data: cierre } = await admin.from('paola_cierres').select('congelado').eq('mes', mesYM).maybeSingle()
      if (cierre?.congelado) {
        return NextResponse.json({ error: 'El mes está congelado: no se puede modificar.' }, { status: 409 })
      }
      const rows = filas.filter(f => f && f.idadmon).map(f => ({
        mes: mesYM, idadmon: f.idadmon,
        propiedad: txtOrNull(f.propiedad), arrendatario: txtOrNull(f.arrendatario), estado: txtOrNull(f.estado),
        comienzo: f.comienzo || null, termino: f.termino || null, rut: txtOrNull(f.rut),
        a_cobrar: aNumero(f.aCobrar), recibido: aNumero(f.recibido), falta_mes: aNumero(f.faltaMes),
        fechas_pago: txtOrNull(f.fechaPago), confianza: txtOrNull(f.confianza),
        detalle_pagos: Array.isArray(f.pagos) ? f.pagos : null,
        deuda_ggcc: aNumero(f.deudaGgcc), deuda_luz: aNumero(f.deudaLuz), deuda_agua: aNumero(f.deudaAgua),
        multas_deudas: aNumero(f.multasDeudas), especial: txtOrNull(f.especial), cantidad: aNumero(f.cantidad),
        comentarios_1: txtOrNull(f.comentarios1), comentarios_2: txtOrNull(f.comentarios2),
        estado_pago: txtOrNull(f.estadoPago), nota_pago: txtOrNull(f.notaPago),
        origen: 'crm', generado_por: email || null, updated_at: new Date().toISOString(),
      }))
      const { error } = await admin.from('liquidacion_paola').upsert(rows, { onConflict: 'mes,idadmon' })
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true, guardadas: rows.length })
    }

    // ── acciones: CONTROL DE GARANTÍAS por cuotas (tabla paola_garantias) ─────────
    //   Adalis registra las cuotas de garantía que se pagan a plazos. Sirven para TOPAR el arriendo
    //   en pagos combinados y para la hoja "Garantías" del Excel.
    if (body.accion === 'garantias_list') {
      const filtro = admin.from('paola_garantias')
        .select('id, idadmon, garantia_total, n_cuota, monto, bodega_monto, fecha, mes, pagada, nota')
        .order('idadmon', { ascending: true }).order('mes', { ascending: true }).order('n_cuota', { ascending: true })
      const { data, error } = body.idadmon ? await filtro.eq('idadmon', body.idadmon) : await filtro
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, garantias: data || [] })
    }

    if (body.accion === 'garantias_upsert') {
      const g = body.cuota || {}
      if (!g.idadmon) return NextResponse.json({ error: 'Falta el idadmon' }, { status: 400 })
      if (!g.mes) return NextResponse.json({ error: 'Falta el mes de la cuota' }, { status: 400 })
      const idadmonG = String(g.idadmon).trim()
      // Nº de cuota: si viene vacío, se numera solo (la mayor registrada de ese contrato + 1, o 1 si es la primera).
      let nCuota = g.n_cuota != null && g.n_cuota !== '' ? parseInt(g.n_cuota, 10) : null
      if (nCuota == null || isNaN(nCuota)) {
        const { data: prev } = await admin.from('paola_garantias')
          .select('n_cuota').eq('idadmon', idadmonG).not('n_cuota', 'is', null)
          .order('n_cuota', { ascending: false }).limit(1)
        nCuota = (prev && prev.length ? (parseInt(prev[0].n_cuota, 10) || 0) : 0) + 1
      }
      const fila = {
        idadmon: idadmonG,
        mes: aYYYYMM(g.mes),
        n_cuota: nCuota,
        monto: aNumero(g.monto) || 0,
        bodega_monto: aNumero(g.bodega_monto),
        garantia_total: aNumero(g.garantia_total),
        fecha: g.fecha || null,
        pagada: g.pagada === false ? false : true,
        nota: txtOrNull(g.nota),
      }
      const { data, error } = await admin.from('paola_garantias')
        .upsert(fila, { onConflict: 'idadmon,mes,n_cuota' }).select().maybeSingle()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, cuota: data || fila })
    }

    if (body.accion === 'garantias_delete') {
      if (!body.id) return NextResponse.json({ error: 'Falta el id de la cuota' }, { status: 400 })
      const { error } = await admin.from('paola_garantias').delete().eq('id', body.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    // ── acción: ABRIR el mes ya GUARDADO (sin re-procesar la cartola) ────────────
    //   Para que otra persona (p.ej. Fabiola) entre a revisar/continuar lo que dejó Adalis.
    if (body.accion === 'cargar_guardado') {
      const { mes } = body
      if (!mes) return NextResponse.json({ error: 'Falta el mes' }, { status: 400 })
      const { data: g, error } = await admin.from('liquidacion_paola').select('*').eq('mes', aYYYYMM(mes))
      if (error) throw new Error(error.message)
      if (!g || !g.length) return NextResponse.json({ ok: true, vacio: true, mes: aYYYYMM(mes) })
      const num = (v) => (v == null || v === '' ? null : Number(v))
      const resultado = g.map(r => ({
        idadmon: r.idadmon, estado: r.estado, propiedad: r.propiedad || '', comienzo: r.comienzo, termino: r.termino,
        arrendatario: r.arrendatario || '', rut: r.rut || '', aCobrar: num(r.a_cobrar),
        vacante: r.estado === 'P' || (!r.arrendatario && r.a_cobrar == null),
        recibido: num(r.recibido), faltaMes: num(r.falta_mes), fechaPago: r.fechas_pago || null,
        confianza: r.confianza || null, pagos: Array.isArray(r.detalle_pagos) ? r.detalle_pagos : [],
        deudaGgcc: num(r.deuda_ggcc), deudaLuz: num(r.deuda_luz), deudaAgua: num(r.deuda_agua),
        multasDeudas: num(r.multas_deudas), especial: r.especial ?? null, cantidad: num(r.cantidad),
        comentarios1: r.comentarios_1 ?? null, comentarios2: r.comentarios_2 ?? null,
        estadoPago: r.estado_pago ?? null, notaPago: r.nota_pago ?? null,
      }))
      resultado.sort((a, b) => ordenNatural(a.propiedad, b.propiedad))

      // Si el mes NO está congelado (p.ej. agosto), refrescamos servicios con lo último de ggcc_agua_luz
      // aunque se guardara antes de cargarlos. En un mes congelado se respeta la foto guardada.
      const { data: cierreG } = await admin.from('paola_cierres').select('congelado').eq('mes', aYYYYMM(mes)).maybeSingle()
      if (!cierreG?.congelado) {
        const { data: serv } = await admin.from('ggcc_agua_luz')
          .select('idadmon, mes, aamm, deuda_gastos_comunes, deuda_vigente_electricidad, deuda_vigente_agua')
          .in('idadmon', resultado.map(r => r.idadmon))
        const sm = {}
        for (const s of serv || []) { const k = periodoNum(s); if (!sm[s.idadmon] || k >= sm[s.idadmon]._k) sm[s.idadmon] = { ...s, _k: k } }
        for (const r of resultado) {
          const s = sm[r.idadmon]
          if (s) { r.deudaGgcc = aNumero(s.deuda_gastos_comunes); r.deudaLuz = aNumero(s.deuda_vigente_electricidad); r.deudaAgua = aNumero(s.deuda_vigente_agua) }
        }
      }

      // Cartola del mes persistida (para que "Movimientos cuenta" salga llena sin volver a subir la cartola).
      let cartolaGuardada = []
      try { const { data: pc } = await admin.from('paola_cartola').select('rows').eq('mes', aYYYYMM(mes)).maybeSingle(); if (pc?.rows) cartolaGuardada = pc.rows } catch (e) { /* secundario */ }

      const suma = (k) => resultado.reduce((s, r) => s + (Number(r[k]) || 0), 0)
      return NextResponse.json({
        ok: true, mes: aYYYYMM(mes), cargadoDeGuardado: true, cartola: null,
        resultado, sinIdentificar: [], noEsRenta: [], movimientos: [], cartolaRows: cartolaGuardada, aprender: [], contratos: [],
        resumen: {
          totalFilas: resultado.length, conImporte: resultado.filter(r => r.aCobrar != null).length,
          revisar: 0, sinIdentificar: 0, noEsRenta: 0,
          totalACobrar: suma('aCobrar'), totalRecibido: suma('recibido'), totalNoEsRenta: 0,
        },
        avisos: { enVivo: false, guardado: true },
      })
    }

    // ── acción: generar el Excel (y guardarlo en Drive si se pide) ──────────
    if (body.accion === 'excel') {
      const { mes, filas, guardarEnDrive, sufijo, email, movimientos, cartolaRows } = body
      if (!mes) return NextResponse.json({ error: 'Falta el mes' }, { status: 400 })
      if (!Array.isArray(filas) || filas.length === 0) {
        return NextResponse.json({ error: 'No hay filas que volcar: procesa la liquidación primero' }, { status: 400 })
      }
      // El mes congelado no se sobrescribe.
      const { data: cierre } = await supabase
        .from('paola_cierres').select('congelado').eq('mes', aAamm(mes)).maybeSingle()
      if (cierre?.congelado && guardarEnDrive) {
        return NextResponse.json({ error: 'El mes está congelado: no se puede sobrescribir en Drive' }, { status: 409 })
      }

      const garantiasRoster = await cargarGarantiasRoster()
      const buffer = await generarExcelPaola({ mes, filas, movimientos: Array.isArray(movimientos) ? movimientos : [], cartolaRows: Array.isArray(cartolaRows) ? cartolaRows : [], garantiasRoster })
      const nombre = nombreArchivo(mes, 'Control', sufijo || '')

      let drive = null, errorDrive = null
      if (guardarEnDrive) {
        try { drive = await subirADrive(nombre, buffer) }
        catch (e) { errorDrive = e.message }
      }
      return NextResponse.json({
        ok: true, nombre, drive, errorDrive, generadoPor: email || null,
        excelBase64: buffer.toString('base64'),
      })
    }

    // ── acción: LISTAR los envíos ya hechos a Paola de un mes ────────────────
    if (body.accion === 'envios') {
      const { mes } = body
      if (!mes) return NextResponse.json({ error: 'Falta el mes' }, { status: 400 })
      const { data, error } = await admin.from('paola_envios')
        .select('numero, email_dest, asunto, a_cobrar, recibido, falta, morosos, multas, enviado_por, es_prueba, fecha_envio')
        .eq('mes', aYYYYMM(mes)).order('fecha_envio', { ascending: false })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, envios: data || [] })
    }

    // ── acción: VISTA PREVIA de la carta (texto preescrito para revisar/editar antes de enviar) ──
    if (body.accion === 'preview') {
      const { mes, numero, filas } = body
      const n = Number(numero)
      if (!mes || ![1, 2, 3].includes(n) || !Array.isArray(filas) || filas.length === 0) {
        return NextResponse.json({ error: 'Faltan datos para la vista previa (mes, número o liquidación).' }, { status: 400 })
      }
      return NextResponse.json({ ok: true, ...componerCartaPaola(filas, mes, n) })
    }

    // ── acción: ENVIAR a Paola por email (1º rápido / 2º semanal / 3º definitivo) ──
    if (body.accion === 'enviar') {
      const { mes, numero, filas, movimientos, cartolaRows, enviarA, email, cuerpo: cuerpoEdit, asunto: asuntoEdit } = body
      if (!mes) return NextResponse.json({ error: 'Falta el mes' }, { status: 400 })
      const n = Number(numero)
      if (![1, 2, 3].includes(n)) return NextResponse.json({ error: 'Número de envío inválido (1, 2 o 3)' }, { status: 400 })
      if (!Array.isArray(filas) || filas.length === 0) return NextResponse.json({ error: 'No hay liquidación que enviar: procesa el mes primero' }, { status: 400 })

      // Destino: Paola (propietarios P001) o un correo de PRUEBA si se indica.
      let dest = (enviarA || '').trim()
      const esPrueba = !!dest
      if (!dest) {
        const { data: prop } = await admin.from('propietarios').select('mail1, email_2').eq('idprop', IDPROP_PAOLA).maybeSingle()
        dest = (prop?.mail1 || prop?.email_2 || '').trim()
      }
      if (!dest || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(dest)) {
        return NextResponse.json({ error: 'No hay un email válido de Paola (propietarios P001). Ponlo o usa un correo de prueba.' }, { status: 400 })
      }

      const garantiasRoster = await cargarGarantiasRoster()
      const buffer = await generarExcelPaola({
        mes, filas,
        movimientos: Array.isArray(movimientos) ? movimientos : [],
        cartolaRows: Array.isArray(cartolaRows) ? cartolaRows : [],
        garantiasRoster,
      })
      const nombreBase = nombreArchivo(mes, 'Control', '', n)   // 2026-08-1-Control Ago 2026.xlsx
      const nombre = esPrueba ? `PRUEBA-${nombreBase}` : nombreBase   // en prueba, prefijo para borrarlo luego

      // Carta: se usa el texto EDITADO por quien envía si viene; si no, el preescrito. El resumen sale del cálculo.
      const carta = componerCartaPaola(filas, mes, n)
      const { aCobrar, recibido, falta, multas, morosos } = carta.resumen
      const cuerpo = (typeof cuerpoEdit === 'string' && cuerpoEdit.trim()) ? cuerpoEdit : carta.cuerpo
      const asunto = ((typeof asuntoEdit === 'string' && asuntoEdit.trim()) ? asuntoEdit : carta.asunto) + (esPrueba ? ' [PRUEBA]' : '')

      const r1 = await enviarNotificacion({
        to: dest, subject: asunto, cuerpo, autor: email,
        attachments: [{ filename: nombre, content: buffer, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }],
      })
      if (!r1 || r1.ok === false) return NextResponse.json({ error: 'No se pudo enviar el email: ' + (r1?.error || 'motivo desconocido') }, { status: 500 })

      // Archivar en Drive (también en prueba, con el prefijo PRUEBA- para poder borrarlo luego).
      let drive = null, errorDrive = null
      try { drive = await subirADrive(nombre, buffer) } catch (e) { errorDrive = e.message }

      // Registro del envío (no rompe el flujo si falla).
      try {
        await admin.from('paola_envios').insert({
          mes: aYYYYMM(mes), numero: n, email_dest: dest, asunto,
          a_cobrar: Math.round(aCobrar), recibido: Math.round(recibido), falta: Math.round(falta),
          morosos, multas: Math.round(multas),
          enviado_por: email || null, es_prueba: esPrueba,
        })
      } catch (e) { /* registro secundario */ }

      return NextResponse.json({ ok: true, enviado_a: dest, numero: n, esPrueba, drive, errorDrive, resumen: carta.resumen })
    }

    // ── acción por defecto: generar ─────────────────────────────────────────
    const { mes, cartolaBase64, cartolaDriveId, email } = body
    if (!mes) return NextResponse.json({ error: 'Falta el mes' }, { status: 400 })
    const aamm = aAamm(mes)

    const { data: cartas, error: eCartas } = await supabase
      .from('liquidacion_idadmon')
      .select('idadmon, estado, inmueble, arrendatario, rut_arrendatario, fecha_inicio, a_cobrar')
      .eq('mes', aamm).eq('idprop', IDPROP_PAOLA).in('estado', ESTADOS_LIQUIDABLES)
    if (eCartas) throw new Error('CARTAS: ' + eCartas.message)

    const { data: log, error: eLog } = await supabase
      .from('datos_arriendos')
      .select('idadmon, estado, inmueble, arrendatario, rut, fecha_inicio, termino_actual, garantia_pedida, quien_tiene_garantia')
      .eq('idprop', IDPROP_PAOLA).in('estado', ESTADOS_LIQUIDABLES)
    if (eLog) throw new Error('LOG: ' + eLog.message)
    const logMap = {}
    for (const r of log || []) logMap[r.idadmon] = r

    // ── Fuente del "A cobrar" ────────────────────────────────────────────────
    // La foto CONGELADA (liquidacion_idadmon) solo existe cuando el mes se cierra (día 23).
    // Para el mes en curso (aún sin congelar) esa foto está vacía; entonces calculamos EN VIVO
    // con el mismo RPC que usa CARTAS (calcular_liquidacion → base = A cobrar), filtrando a Paola.
    // Así la liquidación de Paola muestra idadmon + inmueble + A cobrar aunque no esté congelada.
    let fuenteACobrar = 'foto'                 // 'foto' (congelada) | 'rpc' (en vivo)
    let cartasEfectivo = cartas || []
    if (cartasEfectivo.length === 0) {
      const { data: liq, error: eRpc } = await supabase.rpc('calcular_liquidacion', { p_mes: aamm })
      if (eRpc) throw new Error('RPC calcular_liquidacion: ' + eRpc.message)
      fuenteACobrar = 'rpc'
      cartasEfectivo = (liq || [])
        .filter(r => r.idprop === IDPROP_PAOLA)                                  // solo Paola
        .filter(r => !String(r.inmueble || '').startsWith('[proporcional'))      // línea normal, no la proporcional
        .filter(r => logMap[r.idadmon])                                          // solo contratos liquidables del LOG
        .map(r => {
          const l = logMap[r.idadmon] || {}
          return {
            idadmon: r.idadmon,
            estado: l.estado ?? null,
            inmueble: r.inmueble || l.inmueble || '',
            arrendatario: l.arrendatario || '',
            rut_arrendatario: l.rut || '',
            fecha_inicio: l.fecha_inicio || null,
            a_cobrar: r.base != null ? Number(r.base) : null,
          }
        })
    }

    const filas = []
    const enFoto = new Set()
    for (const c of cartasEfectivo) {
      enFoto.add(c.idadmon)
      const l = logMap[c.idadmon] || {}
      filas.push({
        idadmon: c.idadmon, estado: l.estado ?? c.estado ?? null,
        propiedad: c.inmueble || l.inmueble || '',
        comienzo: aFechaISO(c.fecha_inicio || l.fecha_inicio),
        termino: aFechaISO(l.termino_actual),
        arrendatario: c.arrendatario || '', rut: c.rut_arrendatario || '',
        aCobrar: c.a_cobrar != null ? Number(c.a_cobrar) : null,
        garantiaPedida: l.garantia_pedida != null ? Number(l.garantia_pedida) : null,
        quienGarantia: l.quien_tiene_garantia ?? null,
      })
    }
    const vacantesNuevas = []
    for (const l of log || []) {
      if (enFoto.has(l.idadmon) || l.estado !== 'P') continue
      vacantesNuevas.push(l.idadmon)
      filas.push({
        idadmon: l.idadmon, estado: 'P', propiedad: l.inmueble || '', comienzo: null,
        termino: null, arrendatario: '', rut: '', aCobrar: null,
        garantiaPedida: null, quienGarantia: null,
      })
    }
    for (const f of filas) {
      f.vacante = (f.estado === 'P') || (!f.arrendatario && f.aCobrar == null)
      if (f.vacante && !f.arrendatario) f.arrendatario = 'EN CAPTACION ARRENDATARIO'
      f.unidades = unidadesDePropiedad(f.propiedad)
    }
    filas.sort((a, b) => ordenNatural(a.propiedad, b.propiedad))

    const { data: serv } = await supabase
      .from('ggcc_agua_luz')
      .select('idadmon, mes, aamm, deuda_gastos_comunes, deuda_vigente_electricidad, deuda_vigente_agua')
      .in('idadmon', filas.map(f => f.idadmon))
    // Nos quedamos con la fila de servicios MÁS RECIENTE de cada contrato. Clave de período NUMÉRICA
    // (AAMM '2608' o mes '2026-08' → 202608) para no mezclar formatos: antes el orden por texto podía
    // elegir una fila vieja sin GGCC y salía en blanco.
    const servMap = {}
    for (const s of serv || []) {
      const k = periodoNum(s)
      if (!servMap[s.idadmon] || k >= servMap[s.idadmon]._k) servMap[s.idadmon] = { ...s, _k: k }
    }

    // Cartola
    let abonos = [], filasCartola = [], infoCartola = null, buffer = null
    if (cartolaBase64) buffer = Buffer.from(cartolaBase64, 'base64')
    else if (cartolaDriveId) buffer = await descargarDeDrive(cartolaDriveId)
    if (buffer) {
      const XLSX = await import('xlsx')
      const p = parsearCartola(XLSX, buffer)
      abonos = p.abonos
      filasCartola = p.filasCartola || []
      infoCartola = {
        hoja: p.hoja, movimientos: abonos.length, origen: cartolaBase64 ? 'subida' : 'drive',
        totalAbonos: abonos.reduce((s, a) => s + a.monto, 0),
        conNota: abonos.filter(a => a.nota && unidadDeNota(a.nota)).length,
      }
    }

    // BUSCADOR
    const { data: buscador, error: eBusc } = await supabase
      .from('pagadores_idadmon').select('clave, rut, glosa, idadmon, clase, vigente')
    if (eBusc) throw new Error('BUSCADOR (¿existe pagadores_idadmon?): ' + eBusc.message)
    const porClave = {}
    for (const b of buscador || []) (porClave[b.clave] = porClave[b.clave] || []).push(b)

    const liquidables = filas.filter(f => !f.vacante)
    const idsVivos = new Set(liquidables.map(f => f.idadmon))
    const buscarFila = id => liquidables.find(f => f.idadmon === id)

    // ── la cascada ──────────────────────────────────────────────────────────
    const pagosMap = {}
    const sinIdentificar = []
    const noEsRenta = []
    const movimientos = []
    const aprender = []          // identificaciones nuevas que conviene guardar en el buscador

    for (const abono of abonos) {
      let idadmon = null, confianza = null, metodo = null
      let sugerencia = null, motivo = null
      const entradas = porClave[abono.clave] || []

      // 1 — la nota manual de la cartola manda: es juicio humano de este mes
      const unidad = abono.nota ? unidadDeNota(abono.nota) : null
      if (unidad) {
        const cand = liquidables.filter(f => f.unidades.includes(unidad))
        if (cand.length === 1) {
          idadmon = cand[0].idadmon; confianza = 'alta'; metodo = 'nota-cartola'
          if (!entradas.some(e => e.idadmon === idadmon && e.clase === 'renta' && e.vigente)) {
            aprender.push({ clave: abono.clave, rut: abono.rut, glosa: abono.detalle, idadmon, clase: 'renta' })
          }
        } else if (cand.length === 0) {
          motivo = `La nota "${abono.nota}" no corresponde a ningún contrato vivo del mes`
        }
      }

      // 2 — buscador, filtrado a los contratos del mes
      if (!idadmon) {
        const vigentes = entradas.filter(e => e.clase === 'renta' && e.vigente && idsVivos.has(e.idadmon))
        if (vigentes.length === 1) { idadmon = vigentes[0].idadmon; confianza = 'alta'; metodo = 'buscador' }
        else if (vigentes.length > 1) {
          const porImporte = vigentes.filter(e => {
            const f = buscarFila(e.idadmon)
            return f?.aCobrar && Math.abs(f.aCobrar - abono.monto) < TOLERANCIA_MONTO
          })
          if (porImporte.length === 1) { idadmon = porImporte[0].idadmon; confianza = 'media'; metodo = 'buscador-importe' }
          else motivo = `El pagador tiene varios contratos vivos (${vigentes.map(v => v.idadmon).join(', ')}) y el importe no desempata`
        }
      }

      // 3 — ambiguos del histórico: desempata el importe entre sus candidatos
      if (!idadmon) {
        const amb = entradas.filter(e => e.clase === 'ambiguo' && idsVivos.has(e.idadmon))
        if (amb.length) {
          const porImporte = amb.filter(e => {
            const f = buscarFila(e.idadmon)
            return f?.aCobrar && Math.abs(f.aCobrar - abono.monto) < TOLERANCIA_MONTO
          })
          if (porImporte.length === 1) { idadmon = porImporte[0].idadmon; confianza = 'media'; metodo = 'ambiguo-importe' }
          else motivo = `Ambiguo en el histórico (${amb.map(a => a.idadmon).join(' ó ')}) y el importe no desempata`
        }
      }

      // 4 — marcado como "no es renta": se aparta, no es un pendiente
      if (!idadmon && entradas.some(e => e.clase === 'no_es_renta')) {
        noEsRenta.push({ ...abono, motivo: 'Marcado en el buscador como ingreso ajeno al arriendo' })
        movimientos.push({ ...abono, idadmon: null, clase: 'no_es_renta', identificado: false })
        continue
      }

      // 5 — nombre parecido: SUGIERE, no asigna
      if (!idadmon) {
        const det = normalizarNombre(abono.detalle)
        let mejor = 0, mejorId = null
        for (const f of liquidables) {
          const s = similitud(det, normalizarNombre(f.arrendatario))
          if (s > mejor) { mejor = s; mejorId = f.idadmon }
        }
        if (mejor >= UMBRAL_NOMBRE) {
          sugerencia = { idadmon: mejorId, score: Math.round(mejor) }
          motivo = motivo || `El nombre se parece al arrendatario de ${mejorId} — hay que confirmarlo`
        }
      }

      if (idadmon) {
        (pagosMap[idadmon] = pagosMap[idadmon] || []).push({ ...abono, confianza, metodo })
      } else {
        sinIdentificar.push({ ...abono, sugerencia, motivo: motivo || 'El pagador no está en el buscador' })
      }
      movimientos.push({
        fila: abono.fila, fecha: aFechaISO(abono.fecha) || String(abono.fecha || ''),
        detalle: abono.detalle, monto: abono.monto, clave: abono.clave, rut_detectado: abono.rut,
        nota_cartola: abono.nota, idadmon, confianza, metodo, identificado: !!idadmon,
      })
    }

    // IDADMON reconocido por abono → se pega a la fila de la cartola (para la hoja "Movimientos cuenta").
    const idadmonPorAbono = {}
    for (const mv of movimientos) if (mv.identificado && mv.idadmon) idadmonPorAbono[mv.fila] = mv.idadmon
    let cartolaRows = (filasCartola || []).map(fc => ({
      fecha: aFechaISO(fc.fecha) || String(fc.fecha || ''),
      detalle: fc.detalle, cargo: fc.cargo, abono: fc.abono, nota: fc.nota,
      idadmon: fc.abonoIdx != null ? (idadmonPorAbono[fc.abonoIdx] || null) : null,
    }))
    // PERSISTENCIA de la cartola del mes: si se procesó una cartola nueva, se guarda; si no,
    // se recupera la última guardada, para no tener que volver a subirla y que la hoja "Movimientos" salga llena.
    if (buffer && cartolaRows.length) {
      try { await admin.from('paola_cartola').upsert({ mes: aYYYYMM(mes), rows: cartolaRows, actualizado_at: new Date().toISOString() }, { onConflict: 'mes' }) } catch (e) { /* secundario */ }
    } else if (!cartolaRows.length) {
      try { const { data: pc } = await admin.from('paola_cartola').select('rows').eq('mes', aYYYYMM(mes)).maybeSingle(); if (pc?.rows) cartolaRows = pc.rows } catch (e) { /* secundario */ }
    }

    const { data: guardado } = await supabase.from('liquidacion_paola').select('*').eq('mes', aYYYYMM(mes))
    const manualMap = {}
    for (const g of guardado || []) manualMap[g.idadmon] = g

    // ── Control de garantías por cuotas (tabla paola_garantias) ────────────────
    // Adalis lleva un control exhaustivo de las garantías que se pagan a plazos. Cuando un arrendatario
    // paga TODO junto (arriendo + cuota de garantía + bodega), la cartola trae un solo abono mayor que
    // el arriendo. Con estas cuotas registradas para el mes sabemos ATRIBUIR el excedente y TOPAR el
    // arriendo (Recibido = A cobrar, FALTA = 0) en vez de mostrar un falso "pagó de más".
    // Se lee a prueba de fallos: si la tabla aún no existe, no rompe nada (el módulo sigue igual).
    const garMap = {}
    try {
      const { data: gar } = await supabase
        .from('paola_garantias')
        .select('idadmon, n_cuota, monto, fecha, mes, bodega_monto, nota')
        .eq('mes', aYYYYMM(mes))
      for (const g of gar || []) {
        const k = g.idadmon
        const acc = garMap[k] || { cuota: 0, bodega: 0, nCuotas: [], notas: [] }
        acc.cuota += num(g.monto)
        acc.bodega += num(g.bodega_monto)
        if (g.n_cuota != null) acc.nCuotas.push(g.n_cuota)
        if (g.nota) acc.notas.push(g.nota)
        garMap[k] = acc
      }
    } catch { /* tabla paola_garantias inexistente todavía: sin tope automático */ }
    const fmtMiles = n => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')

    const resultado = filas.map(f => {
      const pagos = pagosMap[f.idadmon] || []
      const recibidoBruto = pagos.reduce((s, p) => s + p.monto, 0) || null   // lo REAL que entró por cartola
      const s = servMap[f.idadmon] || {}
      const m = manualMap[f.idadmon] || {}
      const fechas = pagos.map(p => aFechaISO(p.fecha)).filter(Boolean).sort()

      // ── Tope de arriendo: solo cuando hay cuota de garantía registrada para el mes y el pago excede
      //    el arriendo (pago combinado). Así NO se topan sobrepagos ajenos (p.ej. intereses de un atraso).
      const gar = garMap[f.idadmon] || null
      const excedente = (recibidoBruto != null && f.aCobrar != null) ? (recibidoBruto - f.aCobrar) : 0
      const topar = !!(gar && excedente > TOLERANCIA_EXCESO)
      const recibido = topar ? f.aCobrar : recibidoBruto
      const faltaMes = f.aCobrar != null ? f.aCobrar - (recibido || 0) : null

      // Comentario 1 sugerido (NO pisa lo que escriba Adalis; el frontend lo precarga si está vacío)
      let comentario1Sugerido = null
      if (topar) {
        const partes = [`arriendo $${fmtMiles(f.aCobrar)}`]
        if (gar.cuota > 0) partes.push(`garantía${gar.nCuotas.length ? ' cuota ' + gar.nCuotas.join('/') : ''} $${fmtMiles(gar.cuota)}`)
        if (gar.bodega > 0) partes.push(`bodega $${fmtMiles(gar.bodega)}`)
        const otros = excedente - gar.cuota - gar.bodega
        if (otros > TOLERANCIA_EXCESO) partes.push(`otros $${fmtMiles(otros)}`)
        comentario1Sugerido = `Pago combinado $${fmtMiles(recibidoBruto)} (${partes.join(' + ')})`
      }

      return {
        idadmon: f.idadmon, estado: f.estado, propiedad: f.propiedad, comienzo: f.comienzo,
        termino: f.termino, arrendatario: f.arrendatario, rut: f.rut, aCobrar: f.aCobrar,
        vacante: f.vacante, recibido, recibidoBruto, faltaMes,
        topado: topar, excedente: excedente > 0 ? excedente : null,
        garantiaPedida: f.garantiaPedida ?? null, quienGarantia: f.quienGarantia ?? null,
        garantiaCuota: gar ? { monto: gar.cuota, bodega: gar.bodega, nCuotas: gar.nCuotas, notas: gar.notas } : null,
        comentario1Sugerido,
        // Ya no marcamos "revisar" cuando el exceso quedó atribuido y topado: es un pago combinado explicado.
        revisar: !!(!topar && faltaMes != null && faltaMes < -TOLERANCIA_EXCESO && pagos.length > 1),
        fechaPago: fechas.length ? fechas[fechas.length - 1] : null,
        confianza: pagos.length
          ? (pagos.every(p => p.confianza === 'alta') ? 'alta' : 'media') : null,
        pagos: pagos.map(p => ({ monto: p.monto, fecha: aFechaISO(p.fecha), detalle: p.detalle, metodo: p.metodo })),
        deudaGgcc: aNumero(s.deuda_gastos_comunes),
        deudaLuz: aNumero(s.deuda_vigente_electricidad),
        deudaAgua: aNumero(s.deuda_vigente_agua),
        serviciosAamm: s.aamm || s.mes || null,
        multasDeudas: m.multas_deudas ?? null, especial: m.especial ?? null,
        cantidad: m.cantidad ?? null,
        comentarios1: m.comentarios_1 ?? null, comentarios2: m.comentarios_2 ?? null,
        estadoPago: m.estado_pago ?? null, notaPago: m.nota_pago ?? null,
      }
    })

    return NextResponse.json({
      ok: true, mes: aamm, generadoPor: email || null, cartola: infoCartola,
      resultado, sinIdentificar, noEsRenta, movimientos, cartolaRows, aprender,
      contratos: liquidables.map(f => ({ idadmon: f.idadmon, propiedad: f.propiedad, arrendatario: f.arrendatario })),
      avisos: {
        vacantesNuevas,
        fuenteACobrar,                          // 'foto' (congelada) | 'rpc' (en vivo)
        enVivo: fuenteACobrar === 'rpc',        // el A cobrar salió del cálculo en vivo (mes sin congelar)
        // Con el cálculo en vivo no hace falta resincronizar; solo se sugiere cuando el dato sale de la
        // foto congelada y aún faltan vacantes por reflejar.
        resincronizarCartas: fuenteACobrar === 'foto' && vacantesNuevas.length > 0,
      },
      resumen: {
        totalFilas: resultado.length,
        conImporte: resultado.filter(r => r.aCobrar != null).length,
        vacantes: resultado.filter(r => r.vacante).length,
        identificados: resultado.filter(r => r.recibido).length,
        sinPago: resultado.filter(r => !r.recibido && !r.vacante).length,
        sinIdentificar: sinIdentificar.length,
        noEsRenta: noEsRenta.length,
        revisar: resultado.filter(r => r.revisar).length,
        porAprender: aprender.length,
        totalACobrar: resultado.reduce((s, r) => s + (r.aCobrar || 0), 0),
        totalRecibido: resultado.reduce((s, r) => s + (r.recibido || 0), 0),
        totalCartola: abonos.reduce((s, a) => s + a.monto, 0),
        totalNoEsRenta: noEsRenta.reduce((s, a) => s + a.monto, 0),
      },
    })
  } catch (error) {
    console.error('Error liquidacion-paola v5:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
