// VERSION: v3 · 2026-08-31 · La morosidad usa el CARGO EFECTIVO (cargo_manual ?? cargo) y EXCLUYE las líneas
//   anuladas, igual que la Cartola. Antes ignoraba las ediciones/anulaciones a mano y la deuda no cuadraba. Hereda v2.
// VERSION: v2 · 2026-08-27 · INICIOS rediseñado: entra solo si TODOS los cargos INICIO vencieron (+5d tolerancia) y el saldo corrido al terminar los inicios > umbral. Cartolas sin cambios. Hereda v1.
// VERSION: v1 · 2026-07-21 · Cobranza unificada. GET ?tipo=cartolas|inicios.
//   - cartolas: TODOS los arrendatarios; umbral cobranza_umbral_cartola (8000).
//   - inicios: solo los que tienen cargos INICIO ya vencidos; umbral cobranza_umbral_inicios (2000).
//   Saldo corrido idéntico a la Cartola (orden fecha↑ / empate id↑ / +cargo −abono), deuda VIVA a hoy.
//   Estados: S/SQ = vigente, Q = termino; P y N/N-DICOM fuera. Excluye quien_cobra=DUEÑO; marca sin_cobrador.
//   Añade ultimo_abono (fecha del último movimiento de abono). Reemplaza a /api/cobranza/inicios.
// app/api/cobranza/route.js

import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Ver Cobranza: mismos roles que protege la ruta /op en el middleware.
const PUEDEN_VER = ['direccion', 'administracion', 'finanzas', 'legal']

const num = (v) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d.-]/g, '')) || 0)

// fecha "dd/mm/aaaa" -> timestamp (para ordenar y comparar). 0 si no parsea.
function fechaOrden(f) {
  const m = String(f || '').match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (!m) return 0
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])).getTime()
}
const DIA_MS = 24 * 60 * 60 * 1000

async function leerParametros() {
  const def = { umbralCartola: 8000, umbralInicios: 2000, ventanaInicios: 4, sobrepago: 100000 }
  try {
    const { data } = await admin.from('configuracion').select('clave, valor').like('clave', 'cobranza_%')
    const map = {}
    for (const r of (data || [])) map[r.clave] = r.valor
    return {
      umbralCartola: num(map.cobranza_umbral_cartola ?? def.umbralCartola),
      umbralInicios: num(map.cobranza_umbral_inicios ?? def.umbralInicios),
      ventanaInicios: num(map.cobranza_ventana_inicios_dias ?? def.ventanaInicios),
      sobrepago: num(map.cobranza_umbral_sobrepago ?? def.sobrepago),
    }
  } catch {
    return { umbralCartola: def.umbralCartola, umbralInicios: def.umbralInicios, ventanaInicios: def.ventanaInicios, sobrepago: def.sobrepago }
  }
}

export async function GET(req) {
  const session = await getServerSession(authOptions)
  const rol = session?.user?.role
  if (!session?.user?.email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!PUEDEN_VER.includes(rol)) return Response.json({ error: 'No autorizado' }, { status: 403 })

  const url = new URL(req.url)
  const tipo = (url.searchParams.get('tipo') || 'cartolas').toLowerCase()
  if (tipo !== 'cartolas' && tipo !== 'inicios') return Response.json({ error: 'tipo inválido' }, { status: 400 })

  const P = await leerParametros()
  const umbral = tipo === 'inicios' ? P.umbralInicios : P.umbralCartola
  const ventanaMs = P.ventanaInicios * DIA_MS
  const hoy = Date.now()

  // 1) Todos los movimientos (paginado)
  let movs = []
  const PAGE = 1000
  for (let desde = 0; ; desde += PAGE) {
    const { data, error } = await admin
      .from('cuentas')
      .select('id, idadmon, fecha, concepto, cargo, cargo_manual, abono, calif, anulado')
      .range(desde, desde + PAGE - 1)
    if (error) return Response.json({ error: 'Error leyendo cuentas: ' + error.message }, { status: 500 })
    movs = movs.concat(data || [])
    if (!data || data.length < PAGE) break
  }

  // 2) Agrupar por idadmon
  const porId = new Map()
  for (const m of movs) {
    if (!m.idadmon) continue
    if (!porId.has(m.idadmon)) porId.set(m.idadmon, [])
    porId.get(m.idadmon).push(m)
  }

  // 3) Datos de contrato
  const { data: contratos } = await admin
    .from('datos_arriendos')
    .select('idadmon, propietario, inmueble, arrendatario, estado, quien_cobra')
  const info = {}
  for (const c of (contratos || [])) info[c.idadmon] = c

  const filas = []

  for (const [idadmon, lista] of porId.entries()) {
    const c = info[idadmon] || {}

    // Excluir cuentas anómalas / sin propietario
    if (!c.propietario || String(c.propietario).trim() === '') continue

    // Filtro por estado
    const est = String(c.estado || '').toUpperCase().trim()
    let grupo = null
    if (est === 'S' || est === 'SQ') grupo = 'vigente'
    else if (est === 'Q') grupo = 'termino'
    else continue   // P, N, N-DICOM -> fuera

    // quien_cobra: DUEÑO fuera; vacío -> señalar
    const quienCobra = String(c.quien_cobra || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
    if (quienCobra === 'DUENO') continue
    const sinCobrador = quienCobra === ''

    // Orden idéntico a la Cartola
    const ordenados = lista.slice().sort((a, b) => {
      const fa = fechaOrden(a.fecha), fb = fechaOrden(b.fecha)
      if (fa !== fb) return fa - fb
      return (a.id || 0) - (b.id || 0)
    })
    const conMeta = ordenados.map(m => ({ ...m, _f: fechaOrden(m.fecha) }))

    // INICIOS (rediseño): entra a revisión solo cuando TODOS los cargos INICIO han vencido (+tolerancia).
    // Se evalúa el SALDO CORRIDO al terminar los inicios: si es cero o a favor, el arranque quedó pagado
    // y NO sale; si queda saldo, hay que analizar y reclamar. (No es el saldo global a hoy como Cartolas.)
    const TOL_INI_MS = 5 * 86400000   // 5 días de tolerancia tras el último cargo de inicio
    let fechaUltimoInicio = null, conceptoUltimoInicio = null, saldoInicio = null
    if (tipo === 'inicios') {
      const inicios = conMeta.filter(m => String(m.calif || '').toUpperCase() === 'INICIO' && m._f > 0)
      if (inicios.length === 0) continue                    // sin cargos de inicio -> fuera
      const ui = inicios[inicios.length - 1]                // último cargo de inicio (conMeta va por fecha)
      fechaUltimoInicio = ui.fecha
      conceptoUltimoInicio = ui.concepto || null
      const corte = ui._f + TOL_INI_MS
      if (corte > hoy) continue                             // aún no ha pasado el margen -> no evaluar todavía
      let sIni = 0
      for (const m of conMeta) { if (!m.anulado && m._f > 0 && m._f <= corte) sIni += ((m.cargo_manual != null && m.cargo_manual !== '') ? num(m.cargo_manual) : num(m.cargo)) - num(m.abono) }
      saldoInicio = sIni
      if (sIni <= umbral) continue                          // arranque saldado (cero o a favor) -> fuera
    }

    // Deuda VIVA: saldo corrido hasta hoy (suma de cargo−abono con fecha <= hoy)
    let saldoHoy = 0
    let ultimoAbono = null
    for (const m of conMeta) {
      if (m.anulado) continue   // las líneas anuladas no cuentan (igual que la Cartola)
      if (m._f <= hoy) {
        const cEf = (m.cargo_manual != null && m.cargo_manual !== '') ? num(m.cargo_manual) : num(m.cargo)
        saldoHoy += cEf - num(m.abono)
        if (num(m.abono) > 0 && m._f > 0) ultimoAbono = m.fecha  // último abono cronológico
      }
    }

    // Clasificación (en inicios, sobre el saldo al terminar los inicios; en cartolas, saldo a hoy)
    const deudaEval = tipo === 'inicios' ? saldoInicio : saldoHoy
    let clase = 'al_dia'
    if (deudaEval > umbral) clase = 'moroso'
    else if (deudaEval < -P.sobrepago) clase = 'sobrepago'

    filas.push({
      grupo,
      sin_cobrador: sinCobrador,
      idadmon,
      propietario: c.propietario || null,
      inmueble: c.inmueble || null,
      arrendatario: c.arrendatario || null,
      estado: c.estado || null,
      ultimo_abono: ultimoAbono,
      fecha_ultimo_inicio: fechaUltimoInicio,        // solo en tipo=inicios
      concepto_ultimo_inicio: conceptoUltimoInicio,  // solo en tipo=inicios
      deuda: Math.round(deudaEval),
      clase,
    })
  }

  // Orden: vigente antes que termino; dentro, moroso (mayor→menor), sobrepago, al día
  const rankGrupo = { vigente: 0, termino: 1 }
  const rank = { moroso: 0, sobrepago: 1, al_dia: 2 }
  filas.sort((a, b) => {
    if (rankGrupo[a.grupo] !== rankGrupo[b.grupo]) return rankGrupo[a.grupo] - rankGrupo[b.grupo]
    if (rank[a.clase] !== rank[b.clase]) return rank[a.clase] - rank[b.clase]
    if (a.clase === 'moroso') return b.deuda - a.deuda
    if (a.clase === 'sobrepago') return a.deuda - b.deuda
    return (a.idadmon || '').localeCompare(b.idadmon || '')
  })

  const resumenDe = (g) => {
    const sub = filas.filter(f => f.grupo === g)
    return {
      total: sub.length,
      con_deuda: sub.filter(f => f.clase === 'moroso').length,
      al_dia: sub.filter(f => f.clase === 'al_dia').length,
      sobrepago: sub.filter(f => f.clase === 'sobrepago').length,
      total_deuda: sub.filter(f => f.clase === 'moroso').reduce((a, f) => a + f.deuda, 0),
    }
  }

  return Response.json({
    ok: true,
    tipo,
    generado: new Date().toISOString(),
    parametros: { umbral, sobrepago: P.sobrepago },
    resumen: { vigente: resumenDe('vigente'), termino: resumenDe('termino') },
    filas,
  })
}
