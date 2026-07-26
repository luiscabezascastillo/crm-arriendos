// VERSION: v1 · 2026-07-25 · Endpoint del módulo CONTAB (comprobantes contables).
//   GET  ?periodo=AAAA-MM  → comprobantes generados del periodo + estado de cuadre por origen
//   GET  ?export=nubox&periodo=AAAA-MM → filas formato Nubox (A-J), en bloques <5000 líneas
//   POST { origen:'ventas', periodo } → genera (idempotente) los comprobantes de ese origen
//
// Los comprobantes se generan con funciones SQL por origen (contab_generar_ventas, etc.)
// y se guardan en contab_comprobantes/contab_lineas. La misma función la llama el botón
// de CONTAB y el botón de la hoja del módulo (ventas...). Número=0: Nubox renumera.
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const EDITORES = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']

// Orígenes disponibles y su función generadora. Se van añadiendo aquí.
const GENERADORES = {
  ventas: 'contab_generar_ventas',
  compras: 'contab_generar_compras',
  // sa:      'contab_generar_sa',         (pendiente)
}

const LIMITE_NUBOX = 5000 // líneas máximas por bloque de importación

export async function GET(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const periodo = searchParams.get('periodo')     // 'AAAA-MM' (un mes)
  const anio = searchParams.get('anio')            // 'AAAA' (año completo)
  const exportar = searchParams.get('export')
  const preview = searchParams.get('preview')

  // rango de periodos según alcance: un mes, o todos los del año con datos
  const periodosRango = async () => {
    if (periodo) return [periodo]
    if (anio) {
      const { data } = await admin
        .from('contab_comprobantes').select('periodo')
        .gte('periodo', `${anio}-01`).lte('periodo', `${anio}-12`)
      return [...new Set((data || []).map(p => p.periodo))].sort()
    }
    return []
  }

  // Previsualización: filas planas A-K, ordenadas por fecha (asientos enteros)
  if (preview) {
    const periodos = await periodosRango()
    if (!periodos.length) return Response.json({ error: 'No hay comprobantes en el alcance elegido.' }, { status: 200 })
    const filas = await filasNubox(periodos, true)  // true = ordenar por fecha
    const totDebe = filas.reduce((s, f) => s + (Number(f.debe) || 0), 0)
    const totHaber = filas.reduce((s, f) => s + (Number(f.haber) || 0), 0)
    return Response.json({
      alcance: periodo ? periodo : `${anio} (${periodos.length} meses)`,
      periodos, filas,
      total_debe: totDebe, total_haber: totHaber,
      cuadra: Math.abs(totDebe - totHaber) < 1, n_lineas: filas.length,
    })
  }

  // Exportación a Nubox: filas ordenadas por fecha, troceadas en bloques <5000
  if (exportar === 'nubox') {
    const periodos = await periodosRango()
    if (!periodos.length) return Response.json({ error: 'No hay comprobantes para exportar.' }, { status: 200 })
    const filas = await filasNubox(periodos, true)
    const bloques = trocear(filas, LIMITE_NUBOX)
    return Response.json({ alcance: periodo || anio, total_filas: filas.length, n_bloques: bloques.length, bloques })
  }

  // Comprobantes de un periodo (mes) o de un año + cuadre por origen
  if (periodo || anio) {
    let q = admin
      .from('vw_contab_cuadre')
      .select('id, origen, periodo, fecha, glosa, ccb, estado, n_lineas, total_debe, total_haber, descuadre, cuadra')
    if (periodo) q = q.eq('periodo', periodo)
    else q = q.gte('periodo', `${anio}-01`).lte('periodo', `${anio}-12`)
    const { data: comp, error } = await q
      .order('periodo', { ascending: true }).order('origen', { ascending: true }).order('ccb', { ascending: true })
    if (error) return Response.json({ error: error.message }, { status: 500 })

    const porOrigen = {}
    for (const c of (comp || [])) {
      const o = porOrigen[c.origen] ||= { origen: c.origen, n_comp: 0, debe: 0, haber: 0, todos_cuadran: true, meses: new Set() }
      o.n_comp++; o.debe += Number(c.total_debe) || 0; o.haber += Number(c.total_haber) || 0
      o.meses.add(c.periodo)
      if (!c.cuadra) o.todos_cuadran = false
    }
    const resumen = Object.values(porOrigen).map(o => ({ ...o, n_meses: o.meses.size, meses: undefined }))
    return Response.json({ alcance: periodo || anio, comprobantes: comp || [], resumen, origenes: Object.keys(GENERADORES) })
  }

  // Sin periodo: lista de periodos con comprobantes + orígenes disponibles
  const { data: periodos } = await admin
    .from('contab_comprobantes').select('periodo').order('periodo', { ascending: false })
  const unicos = [...new Set((periodos || []).map(p => p.periodo))]
  return Response.json({ periodos: unicos, origenes: Object.keys(GENERADORES) })
}

// POST: generar un origen para un periodo (idempotente)
export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!EDITORES.includes(email)) return Response.json({ error: 'No tienes permiso para generar comprobantes.' }, { status: 403 })

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const { origen, periodo } = body || {}
  if (!origen || !periodo) return Response.json({ error: 'Faltan origen y periodo' }, { status: 400 })

  const fn = GENERADORES[origen]
  if (!fn) return Response.json({ error: `Origen '${origen}' no tiene generador todavía.` }, { status: 400 })

  const { data, error } = await admin.rpc(fn, { p_periodo: periodo, p_email: email })
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const cuadran = (data || []).every(r => r.r_cuadra)
  return Response.json({ ok: true, origen, periodo, resultado: data || [], todos_cuadran: cuadran })
}

// Construye filas planas Nubox (A-K) de uno o varios periodos.
// Si ordenarFecha, los comprobantes se ordenan por fecha de cabecera (asientos enteros).
async function filasNubox(periodos, ordenarFecha = false) {
  const lista = Array.isArray(periodos) ? periodos : [periodos]
  const { data: comps } = await admin
    .from('contab_comprobantes')
    .select('id, tipo, fecha, glosa, orden, origen, ccb, periodo')
    .in('periodo', lista)
  if (!comps?.length) return []

  // ordenar comprobantes: por fecha (y luego origen/id) o por origen/orden
  comps.sort((a, b) => {
    if (ordenarFecha) {
      if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1
      if (a.origen !== b.origen) return a.origen < b.origen ? -1 : 1
      return a.id - b.id
    }
    if (a.origen !== b.origen) return a.origen < b.origen ? -1 : 1
    if (a.orden !== b.orden) return a.orden - b.orden
    return a.id - b.id
  })

  const ids = comps.map(c => c.id)
  const { data: lineas } = await admin
    .from('contab_lineas')
    .select('comprobante_id, sub_orden, id, cuenta, glosa_detalle, ccb, debe, haber')
    .in('comprobante_id', ids)
    .order('sub_orden', { ascending: true })
    .order('id', { ascending: true })

  const { data: plan } = await admin
    .from('contab_plan_cuentas').select('codigo, descripcion')
  const descCuenta = {}
  for (const p of (plan || [])) descCuenta[p.codigo] = p.descripcion

  const porComp = {}
  for (const l of (lineas || [])) (porComp[l.comprobante_id] ||= []).push(l)

  const filas = []
  for (const c of comps) {
    const ls = porComp[c.id] || []
    ls.forEach((l, i) => {
      const cabecera = i === 0
      filas.push({
        comp_id: c.id,
        origen: c.origen,               // para filtros
        periodo: c.periodo,
        numero: cabecera ? 0 : '',
        tipo: cabecera ? c.tipo : '',
        fecha: cabecera ? c.fecha : '',
        fecha_orden: c.fecha,           // fecha del asiento en todas sus líneas (para filtrar/ordenar)
        glosa: cabecera ? c.glosa : '',
        cuenta: l.cuenta,
        glosa_detalle: l.glosa_detalle || '',
        centro_costo: l.ccb || '',
        sucursal: '',
        debe: Number(l.debe) || 0,
        haber: Number(l.haber) || 0,
        desc_cuenta: descCuenta[l.cuenta] || '',
      })
    })
  }
  return filas
}

// Trocea en bloques <= limite SIN partir un comprobante por la mitad.
function trocear(filas, limite) {
  const bloques = []
  let actual = []
  let compActual = null
  for (const f of filas) {
    // si empieza comprobante nuevo y el bloque ya se pasaría, cerrar bloque
    if (f.comp_id !== compActual && actual.length >= limite) {
      bloques.push(actual); actual = []
    }
    compActual = f.comp_id
    actual.push(f)
  }
  if (actual.length) bloques.push(actual)
  return bloques
}
