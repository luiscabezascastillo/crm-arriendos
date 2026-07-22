// VERSION: v3 · 2026-07-22 · Ya NO lee Drive. Genera la liquidación desde el CRM
//   (liquidacion_idadmon + datos_arriendos + ggcc_agua_luz) y recibe la cartola SUBIDA por la
//   pantalla. Correcciones: RUT con cero a la izquierda, falta_mes puede ser negativo, cabecera
//   de la cartola detectada por nombre de columna. SOLO LECTURA: no escribe en Supabase.
import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabaseClient'

const IDPROP_PAOLA = 'P001'
const ESTADOS_LIQUIDABLES = ['S', 'SQ', 'P', 'Q']

// ── utilidades ───────────────────────────────────────────────────────────────

// '2026-07' | '2607' → '2607'
function aAamm(mes) {
  const s = String(mes || '').trim()
  if (/^\d{4}$/.test(s)) return s
  const m = s.match(/^(\d{4})-(\d{2})$/)
  if (m) return m[1].slice(2) + m[2]
  throw new Error(`Mes no reconocido: "${mes}"`)
}

// Los importes de ggcc_agua_luz llegan como texto: "47.320", "$ 12.776", "", null.
function aNumero(v) {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const limpio = String(v).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
  if (limpio === '' || limpio === '-') return null
  const n = Number(limpio)
  return Number.isFinite(n) ? n : null
}

// La cartola rellena los RUT a 10 dígitos con ceros: "026951793K" = 26.951.793-K.
// Sin quitarlos NUNCA cruzan contra pagadores.rut_sin_puntos.
function normalizarRut(v) {
  if (!v) return ''
  const s = String(v).toUpperCase().replace(/[^0-9K]/g, '')
  if (!s) return ''
  return s.replace(/^0+/, '')
}

function extraerRut(detalle) {
  const m = String(detalle || '').trim().match(/^(\d{7,10}[Kk]?)/)
  return m ? normalizarRut(m[1]) : ''
}

function normalizarNombre(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ').trim().toUpperCase()
    .replace(/^\d+[Kk]?\s*/, '')
    .replace(/^TRANSF[. ]+/, '')
    .replace(/^DE\s+/, '')
}

function similitud(a, b) {
  const ta = new Set(a.split(' ').filter(x => x.length > 2))
  const tb = new Set(b.split(' ').filter(x => x.length > 2))
  if (ta.size === 0 || tb.size === 0) return 0
  const comunes = [...ta].filter(t => tb.has(t)).length
  const union = new Set([...ta, ...tb]).size
  return comunes >= 2 ? (comunes / union) * 100 + 10 : (comunes / union) * 100
}

// Orden natural: "dep 903A" antes que "dep 1003A", "est 42" antes que "est 101".
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

// ── parseo de la cartola ─────────────────────────────────────────────────────
// Localiza la cabecera por NOMBRE de columna en vez de por posición fija, para que dé el mismo
// resultado tanto con el archivo suelto de la cartola como con la hoja incrustada en el Control.
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
      cols = {
        fecha: iFecha, detalle: iDet, abono: iAbono,
        cargo: fila.findIndex(c => c.includes('cargo')),
        nota: fila.findIndex(c => c.includes('saldo')),
      }
      break
    }
  }
  if (filaCab < 0) {
    throw new Error('No se reconoce la cartola: no encuentro una cabecera con Fecha, Detalle y Monto abono.')
  }

  const abonos = []
  for (let i = filaCab + 1; i < raw.length; i++) {
    const fila = raw[i]
    if (!fila || !fila[cols.fecha]) continue
    const monto = aNumero(fila[cols.abono])
    if (!monto || monto <= 10) continue   // los cargos (salidas) no son cobros
    abonos.push({
      fila: abonos.length,
      fecha: fila[cols.fecha],
      detalle: String(fila[cols.detalle] || ''),
      monto,
      rut: extraerRut(fila[cols.detalle]),
      notaCartola: cols.nota >= 0 ? (fila[cols.nota] || null) : null,
    })
  }
  return { hoja, abonos, cabeceraFila: filaCab + 1 }
}

// ── GET: estado del mes ──────────────────────────────────────────────────────
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const mes = searchParams.get('mes')
    if (!mes) return NextResponse.json({ ok: true, congelado: false })
    const aamm = aAamm(mes)
    const { data } = await supabase
      .from('paola_cierres').select('*').eq('mes', aamm).maybeSingle()
    return NextResponse.json({ ok: true, mes: aamm, cierre: data || null, congelado: !!data?.congelado })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ── POST: generar la liquidación ─────────────────────────────────────────────
export async function POST(request) {
  try {
    const { mes, cartolaBase64, email } = await request.json()
    if (!mes) return NextResponse.json({ error: 'Falta el mes' }, { status: 400 })
    const aamm = aAamm(mes)

    // 1. Base de CARTAS (foto del mes)
    const { data: cartas, error: eCartas } = await supabase
      .from('liquidacion_idadmon')
      .select('idadmon, estado, inmueble, arrendatario, rut_arrendatario, fecha_inicio, a_cobrar')
      .eq('mes', aamm).eq('idprop', IDPROP_PAOLA).in('estado', ESTADOS_LIQUIDABLES)
    if (eCartas) throw new Error('CARTAS: ' + eCartas.message)

    // 2. LOG en vivo: estado y termino_actual mandan sobre la foto, y de aquí salen las
    //    vacantes nuevas que la foto todavía no conoce.
    const { data: log, error: eLog } = await supabase
      .from('datos_arriendos')
      .select('idadmon, estado, inmueble, arrendatario, fecha_inicio, termino_actual')
      .eq('idprop', IDPROP_PAOLA).in('estado', ESTADOS_LIQUIDABLES)
    if (eLog) throw new Error('LOG: ' + eLog.message)
    const logMap = {}
    for (const r of log || []) logMap[r.idadmon] = r

    // 3. Filas: las de CARTAS + las del LOG que la foto no traiga
    const filas = []
    const vistos = new Set()
    for (const c of cartas || []) {
      vistos.add(c.idadmon)
      const l = logMap[c.idadmon] || {}
      filas.push({
        idadmon: c.idadmon,
        estado: l.estado ?? c.estado ?? null,
        propiedad: c.inmueble || l.inmueble || '',
        comienzo: aFechaISO(c.fecha_inicio || l.fecha_inicio),
        termino: aFechaISO(l.termino_actual),
        arrendatario: c.arrendatario || '',
        rut: c.rut_arrendatario || '',
        aCobrar: c.a_cobrar != null ? Number(c.a_cobrar) : null,
        enCartas: true,
      })
    }
    for (const l of log || []) {
      if (vistos.has(l.idadmon)) continue
      filas.push({
        idadmon: l.idadmon,
        estado: l.estado ?? null,
        propiedad: l.inmueble || '',
        comienzo: aFechaISO(l.fecha_inicio),
        termino: aFechaISO(l.termino_actual),
        arrendatario: l.arrendatario || '',
        rut: '',
        aCobrar: null,
        enCartas: false,       // ⚠ no está en la foto: CARTAS necesita resincronizar
      })
    }
    for (const f of filas) {
      f.vacante = (f.estado === 'P') || (!f.arrendatario && f.aCobrar == null)
      if (f.vacante && !f.arrendatario) f.arrendatario = 'EN CAPTACION ARRENDATARIO'
    }
    filas.sort((a, b) => ordenNatural(a.propiedad, b.propiedad))

    // 4. Servicios: el último dato disponible por contrato
    const ids = filas.map(f => f.idadmon)
    const { data: serv } = await supabase
      .from('ggcc_agua_luz')
      .select('idadmon, mes, aamm, deuda_gastos_comunes, deuda_vigente_electricidad, deuda_vigente_agua')
      .in('idadmon', ids)
    const servMap = {}
    for (const s of serv || []) {
      const clave = String(s.aamm || s.mes || '')
      const prev = servMap[s.idadmon]
      if (!prev || clave > prev._clave) servMap[s.idadmon] = { ...s, _clave: clave }
    }

    // 5. Cruce con la cartola (si se ha subido)
    let abonos = [], infoCartola = null
    if (cartolaBase64) {
      const XLSX = await import('xlsx')
      const buffer = Buffer.from(cartolaBase64, 'base64')
      const p = parsearCartola(XLSX, buffer)
      abonos = p.abonos
      infoCartola = { hoja: p.hoja, movimientos: abonos.length }
    }

    const { data: pagadores } = await supabase.from('pagadores').select('*')
    const rutMap = {}
    for (const p of pagadores || []) {
      const k = normalizarRut(p.rut_sin_puntos || p.rut_con_puntos)
      if (k) rutMap[k] = p
    }

    const pagosMap = {}
    const sinIdentificar = []
    const movimientos = []

    for (const abono of abonos) {
      let encontrado = null, confianza = null, metodo = null

      if (abono.rut && rutMap[abono.rut]) {
        const p = rutMap[abono.rut]
        const posibles = [p.idadmon1, p.idadmon2, p.idadmon3, p.idadmon4, p.idadmon5]
          .filter(Boolean).filter(id => filas.some(f => f.idadmon === id))
        if (posibles.length === 1) { encontrado = posibles[0]; confianza = 'alta'; metodo = 'rut' }
        else if (posibles.length > 1) {
          const exacto = posibles.find(id => {
            const f = filas.find(f => f.idadmon === id)
            return f?.aCobrar && Math.abs(f.aCobrar - abono.monto) < 1000
          })
          encontrado = exacto || posibles[0]
          confianza = exacto ? 'media' : 'baja'
          metodo = 'rut-multi'
        }
      }

      if (!encontrado) {
        const det = normalizarNombre(abono.detalle)
        let mejor = 0, mejorId = null
        for (const f of filas) {
          if (f.vacante) continue
          const s = similitud(det, normalizarNombre(f.arrendatario))
          if (s > mejor) { mejor = s; mejorId = f.idadmon }
        }
        if (mejor >= 65) { encontrado = mejorId; confianza = mejor >= 85 ? 'alta' : 'media'; metodo = 'nombre' }
      }

      if (!encontrado) {
        const porMonto = filas.find(f => f.aCobrar && Math.abs(f.aCobrar - abono.monto) < 500)
        if (porMonto) { encontrado = porMonto.idadmon; confianza = 'sugerida'; metodo = 'monto' }
      }

      if (encontrado) {
        (pagosMap[encontrado] = pagosMap[encontrado] || []).push({ ...abono, confianza, metodo })
      } else {
        sinIdentificar.push(abono)
      }
      movimientos.push({
        fila: abono.fila, fecha: aFechaISO(abono.fecha) || String(abono.fecha || ''),
        detalle: abono.detalle, monto: abono.monto, rut_detectado: abono.rut || null,
        nota_cartola: abono.notaCartola || null,
        idadmon: encontrado || null, confianza, metodo, identificado: !!encontrado,
      })
    }

    // 6. Campos manuales ya guardados (no se pierden al regenerar)
    const { data: guardado } = await supabase
      .from('liquidacion_paola').select('*').eq('mes', aamm)
    const manualMap = {}
    for (const g of guardado || []) manualMap[g.idadmon] = g

    // 7. Montaje final
    const resultado = filas.map(f => {
      const pagos = pagosMap[f.idadmon] || []
      const recibido = pagos.reduce((s, p) => s + p.monto, 0) || null
      const s = servMap[f.idadmon] || {}
      const m = manualMap[f.idadmon] || {}
      const fechas = pagos.map(p => aFechaISO(p.fecha)).filter(Boolean).sort()
      return {
        ...f,
        recibido,
        // Puede salir NEGATIVO si pagaron de más. En el Excel es la fórmula =H-I.
        faltaMes: f.aCobrar != null ? f.aCobrar - (recibido || 0) : null,
        fechaPago: fechas.length ? fechas[fechas.length - 1] : null,
        fechasPago: fechas,
        confianza: pagos.length
          ? (pagos.every(p => p.confianza === 'alta') ? 'alta'
            : pagos.every(p => p.confianza === 'sugerida') ? 'sugerida' : 'media')
          : null,
        pagos,
        deudaGgcc: aNumero(s.deuda_gastos_comunes),
        deudaLuz: aNumero(s.deuda_vigente_electricidad),
        deudaAgua: aNumero(s.deuda_vigente_agua),
        serviciosAamm: s.aamm || s.mes || null,
        multasDeudas: m.multas_deudas ?? null,
        especial: m.especial ?? null,
        cantidad: m.cantidad ?? null,
        comentarios1: m.comentarios_1 ?? null,
        comentarios2: m.comentarios_2 ?? null,
      }
    })

    const desincronizados = resultado.filter(r => !r.enCartas).map(r => r.idadmon)

    return NextResponse.json({
      ok: true, mes: aamm, generadoPor: email || null, cartola: infoCartola,
      resultado, sinIdentificar,
      avisos: {
        // Si hay filas que el LOG conoce y la foto no, CARTAS está desactualizada.
        desincronizados,
        resincronizarCartas: desincronizados.length > 0,
      },
      resumen: {
        totalFilas: resultado.length,
        conImporte: resultado.filter(r => r.aCobrar != null).length,
        vacantes: resultado.filter(r => r.vacante).length,
        identificados: resultado.filter(r => r.recibido).length,
        sinPago: resultado.filter(r => !r.recibido && !r.vacante).length,
        sinIdentificar: sinIdentificar.length,
        totalACobrar: resultado.reduce((s, r) => s + (r.aCobrar || 0), 0),
        totalRecibido: resultado.reduce((s, r) => s + (r.recibido || 0), 0),
      },
    })
  } catch (error) {
    console.error('Error liquidacion-paola v3:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
