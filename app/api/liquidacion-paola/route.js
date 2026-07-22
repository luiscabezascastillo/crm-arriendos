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
import { supabase } from '../../../lib/supabaseClient'
import { google } from 'googleapis'
import { generarExcelPaola, nombreArchivo } from '../../../lib/paolaExcel'

const FOLDER_ID = '1zg3-H02UMhkVVDlF3OZjoE18x0eLLiXh'
const IDPROP_PAOLA = 'P001'
const ESTADOS_LIQUIDABLES = ['S', 'SQ', 'P', 'Q']
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
      cols = { fecha: iFecha, detalle: iDet, abono: iAbono, nota: fila.findIndex(c => c.includes('saldo')) }
      break
    }
  }
  if (filaCab < 0) throw new Error('No se reconoce la cartola: falta una cabecera con Fecha, Detalle y Monto abono.')

  const abonos = []
  for (let i = filaCab + 1; i < raw.length; i++) {
    const fila = raw[i]
    if (!fila || !fila[cols.fecha]) continue
    const monto = aNumero(fila[cols.abono])      // los CARGOS no se miran nunca
    if (!monto || monto <= 10) continue
    const notaCruda = cols.nota >= 0 ? fila[cols.nota] : null
    abonos.push({
      fila: abonos.length,
      fecha: fila[cols.fecha],
      detalle: String(fila[cols.detalle] || ''),
      monto,
      rut: extraerRut(fila[cols.detalle]),
      clave: claveDe(fila[cols.detalle]),
      nota: typeof notaCruda === 'string' ? notaCruda.trim() : null,
    })
  }
  return { hoja, abonos }
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

    // ── acción: generar el Excel (y guardarlo en Drive si se pide) ──────────
    if (body.accion === 'excel') {
      const { mes, filas, guardarEnDrive, sufijo, email } = body
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

      const buffer = await generarExcelPaola({ mes, filas })
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
      .select('idadmon, estado, inmueble, arrendatario, fecha_inicio, termino_actual')
      .eq('idprop', IDPROP_PAOLA).in('estado', ESTADOS_LIQUIDABLES)
    if (eLog) throw new Error('LOG: ' + eLog.message)
    const logMap = {}
    for (const r of log || []) logMap[r.idadmon] = r

    const filas = []
    const enFoto = new Set()
    for (const c of cartas || []) {
      enFoto.add(c.idadmon)
      const l = logMap[c.idadmon] || {}
      filas.push({
        idadmon: c.idadmon, estado: l.estado ?? c.estado ?? null,
        propiedad: c.inmueble || l.inmueble || '',
        comienzo: aFechaISO(c.fecha_inicio || l.fecha_inicio),
        termino: aFechaISO(l.termino_actual),
        arrendatario: c.arrendatario || '', rut: c.rut_arrendatario || '',
        aCobrar: c.a_cobrar != null ? Number(c.a_cobrar) : null,
      })
    }
    const vacantesNuevas = []
    for (const l of log || []) {
      if (enFoto.has(l.idadmon) || l.estado !== 'P') continue
      vacantesNuevas.push(l.idadmon)
      filas.push({
        idadmon: l.idadmon, estado: 'P', propiedad: l.inmueble || '', comienzo: null,
        termino: null, arrendatario: '', rut: '', aCobrar: null,
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
    const servMap = {}
    for (const s of serv || []) {
      const clave = String(s.aamm || s.mes || '')
      if (!servMap[s.idadmon] || clave > servMap[s.idadmon]._clave) servMap[s.idadmon] = { ...s, _clave: clave }
    }

    // Cartola
    let abonos = [], infoCartola = null, buffer = null
    if (cartolaBase64) buffer = Buffer.from(cartolaBase64, 'base64')
    else if (cartolaDriveId) buffer = await descargarDeDrive(cartolaDriveId)
    if (buffer) {
      const XLSX = await import('xlsx')
      const p = parsearCartola(XLSX, buffer)
      abonos = p.abonos
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

    const { data: guardado } = await supabase.from('liquidacion_paola').select('*').eq('mes', aamm)
    const manualMap = {}
    for (const g of guardado || []) manualMap[g.idadmon] = g

    const resultado = filas.map(f => {
      const pagos = pagosMap[f.idadmon] || []
      const recibido = pagos.reduce((s, p) => s + p.monto, 0) || null
      const s = servMap[f.idadmon] || {}
      const m = manualMap[f.idadmon] || {}
      const fechas = pagos.map(p => aFechaISO(p.fecha)).filter(Boolean).sort()
      const faltaMes = f.aCobrar != null ? f.aCobrar - (recibido || 0) : null
      return {
        idadmon: f.idadmon, estado: f.estado, propiedad: f.propiedad, comienzo: f.comienzo,
        termino: f.termino, arrendatario: f.arrendatario, rut: f.rut, aCobrar: f.aCobrar,
        vacante: f.vacante, recibido, faltaMes,
        revisar: !!(faltaMes != null && faltaMes < -TOLERANCIA_EXCESO && pagos.length > 1),
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
      }
    })

    return NextResponse.json({
      ok: true, mes: aamm, generadoPor: email || null, cartola: infoCartola,
      resultado, sinIdentificar, noEsRenta, movimientos, aprender,
      contratos: liquidables.map(f => ({ idadmon: f.idadmon, propiedad: f.propiedad, arrendatario: f.arrendatario })),
      avisos: { vacantesNuevas, resincronizarCartas: vacantesNuevas.length > 0 },
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
