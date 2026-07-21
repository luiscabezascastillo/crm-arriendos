// VERSION: v2 · 2026-07-21 · Cobranza · Inicios. Filtra por estado (S/SQ = vigente, Q = termino; P y N/N-DICOM fuera),
//   excluye cuentas sin propietario/anómalas, y corrige el saldo_en_ventana (no arrastra cargos futuros).
// VERSION: v1 · 2026-07-21 · Cobranza · Inicios. Calcula el saldo corrido (idéntico a la Cartola:
//   orden fecha↑ / empate id↑ / +cargo −abono) para todos los IDADMON con cargos de INICIO, detecta
//   impago del arranque (saldo en la fecha del último inicio VENCIDO + ventana, contra umbral) y
//   devuelve la deuda VIVA (saldo corrido hasta hoy). Parámetros desde la tabla `configuracion`.
// app/api/cobranza/inicios/route.js

import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Solo roles internos con visión de cobranza.
const PUEDEN_VER = ['direccion', 'administracion', 'finanzas', 'legal']

// num(): idéntico al de la Cartola (limpia formato de miles).
const num = (v) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d.-]/g, '')) || 0)

// fecha "dd/mm/aaaa" -> timestamp (para ordenar y comparar). Devuelve 0 si no parsea.
function fechaOrden(f) {
  const s = String(f || '')
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (!m) return 0
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])).getTime()
}
const DIA_MS = 24 * 60 * 60 * 1000

async function leerParametros() {
  const def = {
    cobranza_umbral_inicios: 2000,
    cobranza_ventana_inicios_dias: 4,
    cobranza_umbral_sobrepago: 100000,
  }
  try {
    const { data } = await admin.from('configuracion').select('clave, valor').like('clave', 'cobranza_%')
    const map = {}
    for (const r of (data || [])) map[r.clave] = r.valor
    return {
      umbral: num(map.cobranza_umbral_inicios ?? def.cobranza_umbral_inicios),
      ventanaDias: num(map.cobranza_ventana_inicios_dias ?? def.cobranza_ventana_inicios_dias),
      umbralSobrepago: num(map.cobranza_umbral_sobrepago ?? def.cobranza_umbral_sobrepago),
    }
  } catch {
    return { umbral: def.cobranza_umbral_inicios, ventanaDias: def.cobranza_ventana_inicios_dias, umbralSobrepago: def.cobranza_umbral_sobrepago }
  }
}

export async function GET(req) {
  const session = await getServerSession(authOptions)
  const rol = session?.user?.role
  if (!session?.user?.email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!PUEDEN_VER.includes(rol)) return Response.json({ error: 'No autorizado' }, { status: 403 })

  const { umbral, ventanaDias, umbralSobrepago } = await leerParametros()
  const hoy = Date.now()
  const ventanaMs = ventanaDias * DIA_MS

  // 1) Traer TODOS los movimientos (paginado por seguridad si la tabla es grande).
  let movs = []
  const PAGE = 1000
  for (let desde = 0; ; desde += PAGE) {
    const { data, error } = await admin
      .from('cuentas')
      .select('id, idadmon, fecha, concepto, cargo, abono, calif')
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

  // 3) Datos de contrato para mostrar (propietario/inmueble/arrendatario/estado)
  const { data: contratos } = await admin
    .from('datos_arriendos')
    .select('idadmon, propietario, inmueble, arrendatario, estado')
  const info = {}
  for (const c of (contratos || [])) info[c.idadmon] = c

  const filas = []

  for (const [idadmon, lista] of porId.entries()) {
    // Solo IDADMON que tengan al menos un cargo de INICIO
    const tieneInicio = lista.some(m => String(m.calif || '').toUpperCase() === 'INICIO')
    if (!tieneInicio) continue

    // Orden idéntico a la Cartola: fecha↑, empate id↑
    const ordenados = lista.slice().sort((a, b) => {
      const fa = fechaOrden(a.fecha), fb = fechaOrden(b.fecha)
      if (fa !== fb) return fa - fb
      return (a.id || 0) - (b.id || 0)
    })

    // Saldo corrido desde 0 (+cargo −abono), guardando el saldo tras cada movimiento
    let saldo = 0
    const conSaldo = ordenados.map(m => {
      saldo = saldo + num(m.cargo) - num(m.abono)
      return { ...m, _saldo: saldo, _f: fechaOrden(m.fecha) }
    })

    // Último cargo de INICIO ya VENCIDO (fecha + ventana <= hoy)
    const iniciosVencidos = conSaldo.filter(m =>
      String(m.calif || '').toUpperCase() === 'INICIO' && m._f > 0 && (m._f + ventanaMs) <= hoy
    )
    if (iniciosVencidos.length === 0) continue  // todos sus inicios son futuros: aún no evaluable

    const ultimoInicio = iniciosVencidos[iniciosVencidos.length - 1]
    const finVentana = ultimoInicio._f + ventanaMs

    // Saldo al cierre de la ventana = suma de (cargo − abono) SOLO de los movimientos con fecha <= finVentana.
    // Sumamos directamente (no leemos el saldo corrido global) para que ningún cargo futuro contamine el corte.
    let saldoEnVentana = 0
    for (const m of conSaldo) { if (m._f <= finVentana) saldoEnVentana += num(m.cargo) - num(m.abono) }

    // Deuda VIVA: saldo corrido hasta hoy (suma solo de movimientos con fecha <= hoy; excluye futuros).
    let saldoHoy = 0
    for (const m of conSaldo) { if (m._f <= hoy) saldoHoy += num(m.cargo) - num(m.abono) }

    // Clasificación (detección con el saldo en ventana; importe con el saldo de hoy)
    const impago = saldoEnVentana > umbral
    let clase = 'al_dia'
    if (saldoHoy > umbral) clase = 'moroso'
    else if (saldoHoy < -umbralSobrepago) clase = 'sobrepago'

    const c = info[idadmon] || {}

    // Excluir cuentas anómalas / sin propietario (p. ej. A00PAM, cuentas puente)
    if (!c.propietario || String(c.propietario).trim() === '') continue

    // Filtro por estado: S/SQ = vigente ; Q = termino ; P y N/N-DICOM quedan fuera de Cobranza
    const est = String(c.estado || '').toUpperCase().trim()
    let grupo = null
    if (est === 'S' || est === 'SQ') grupo = 'vigente'
    else if (est === 'Q') grupo = 'termino'
    else continue   // P, N, N-DICOM y cualquier otro -> fuera

    filas.push({
      grupo,
      idadmon,
      propietario: c.propietario || null,
      inmueble: c.inmueble || null,
      arrendatario: c.arrendatario || null,
      estado: c.estado || null,
      fecha_ultimo_inicio: ultimoInicio.fecha,
      concepto_ultimo_inicio: ultimoInicio.concepto || null,
      saldo_en_ventana: Math.round(saldoEnVentana),
      deuda: Math.round(saldoHoy),      // deuda viva (saldo de hoy)
      impago_inicio: impago,            // el arranque no cuadró en su ventana
      clase,                            // 'moroso' | 'al_dia' | 'sobrepago'
    })
  }

  // Orden: morosos de mayor a menor deuda; luego sobrepagos; al día al final.
  const rankGrupo = { vigente: 0, termino: 1 }
  const rank = { moroso: 0, sobrepago: 1, al_dia: 2 }
  filas.sort((a, b) => {
    if (rankGrupo[a.grupo] !== rankGrupo[b.grupo]) return rankGrupo[a.grupo] - rankGrupo[b.grupo]
    if (rank[a.clase] !== rank[b.clase]) return rank[a.clase] - rank[b.clase]
    if (a.clase === 'moroso') return b.deuda - a.deuda            // mayor deuda primero
    if (a.clase === 'sobrepago') return a.deuda - b.deuda          // mayor sobrepago (más negativo) primero
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
    parametros: { umbral, ventanaDias, umbralSobrepago },
    resumen: { vigente: resumenDe('vigente'), termino: resumenDe('termino') },
    filas,
  })
}
