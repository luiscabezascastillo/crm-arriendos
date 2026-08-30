// VERSION: v11 · 2026-08-27 · DELETE /api/financiero/contab: ?todo=1 borra TODO lo generado (o ?periodo/?anio para acotar); comprobantes+lineas, solo EDITORES, regenerable. Hereda v10.
// VERSION: v10 · 2026-08-20 · cuentaNubox: si la cuenta trae el nombre pegado ("4201-46 CONSERVADOR...") se queda solo con el codigo (Nubox no lo encontraba). Hereda v9.
// VERSION: v10 · 2026-08-30 · Origen 'alberto' -> contab_generar_alberto (c/c del socio: Aporte DEBE 2107-02/HABER 2112-01; Descuento admin DEBE 2112-01/HABER 1104-02-0001). Hereda v9.
// VERSION: v9 · 2026-08-20 · cuentaNubox: en vez de truncar el 3er nivel al padre, RELLENA la analitica a 4 digitos (4201-01-02 -> 4201-01-0002). Nubox tiene las hijas dadas de alta y obliga a imputar en ellas, no en el padre. Hereda v8.
// VERSION: v8 · 2026-08-20 · Previsualizacion: columna centro_costo tambien en blanco (coincide con lo que va a Nubox; el CC real queda en campo ccb solo de referencia). Hereda v7.
// VERSION: v8 · 2026-08-26 · Origen 'mandato' -> contab_generar_mandato (nivel 2: Debe 2107-02 / Haber 1104-01 por CCB). Hereda v7.
// VERSION: v7 · 2026-08-20 · Export Nubox: (a) excluye comprobantes con cuenta puente (1104-98/4201-99): no imputables, van a Pendiente; (b) trunca cuentas de 3er nivel analitico al padre imputable (4201-01-07 -> 4201-01) en campo cuenta_nubox, el detalle por empleado se conserva en glosa/preview. Hereda v6.
// VERSION: v6 · 2026-08-19 · Límite de bloque Nubox a 4950 (antes 5000). Hereda v5.
// VERSION: v5 · 2026-08-19 · filasNubox: lee TODAS las lineas paginando (antes se cortaba a 1000 -> falso descuadre y export incompleto). Hereda v4.
// VERSION: v4 · 2026-08-19 · Caja Chica enchufada ('caja_chica' -> contab_generar_caja_chica). Hereda v3.
// VERSION: v3 · 2026-08-19 · Honorarios enchufado ('honorarios' -> contab_generar_honorarios). Hereda v2.
// VERSION: v2 · 2026-08-19 · SA enchufado: 'sa' -> contab_generar_sa en GENERADORES (habilita Regenerar de B. Santander). Hereda v1.
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
  honorarios: 'contab_generar_honorarios',
  sa:      'contab_generar_sa',
  caja_chica: 'contab_generar_caja_chica',
  mandato: 'contab_generar_mandato',
  alberto: 'contab_generar_alberto',
}

const LIMITE_NUBOX = 4950 // líneas máximas por bloque de importación (Nubox admite <5000; margen)

// Cuentas puente internas: NO son imputables en Nubox (van a "Pendiente de clasificar").
// Se excluye el COMPROBANTE entero que las contenga, para no romper el cuadre del asiento.
const CUENTAS_PUENTE = ['1104-98', '4201-99']

// 3er nivel analitico (la persona): Nubox lo tiene dado de alta a 4 digitos y OBLIGA a imputar en la hija.
// El CRM lo guarda a 2 digitos (4201-01-02); se rellena a 4 -> 4201-01-0002. NO se trunca al padre.
function cuentaNubox(c) {
  c = (c || '').trim()
  // Si viene "CODIGO NOMBRE" (codigo pegado a su descripcion), quedarse con el codigo.
  // No colapsa si el 2o token es OTRO codigo (p.ej. "1104-04 2105-07" -> lo maneja el generador -> puente).
  const mm = /^(\d{4}-\d{2}(?:-\w+)?)\s+(\S+)/.exec(c)
  if (mm && !/^\d{4}-\d{2}/.test(mm[2])) c = mm[1]
  // 3er nivel analitico: rellenar a 4 digitos (4201-01-02 -> 4201-01-0002).
  const m = /^(\d{4}-\d{2})-(\d{1,4})$/.exec(c)
  return m ? `${m[1]}-${m[2].padStart(4, '0')}` : c
}

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
      excluidos_puente: filas.excluidos || 0,
    })
  }

  // Exportación a Nubox: filas ordenadas por fecha, troceadas en bloques <5000
  if (exportar === 'nubox') {
    const periodos = await periodosRango()
    if (!periodos.length) return Response.json({ error: 'No hay comprobantes para exportar.' }, { status: 200 })
    const filas = await filasNubox(periodos, true)
    const bloques = trocear(filas, LIMITE_NUBOX)
    return Response.json({ alcance: periodo || anio, total_filas: filas.length, n_bloques: bloques.length, excluidos_puente: filas.excluidos || 0, bloques })
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

// DELETE: borra los comprobantes (y sus lineas). ?todo=1 borra TODO lo generado; ?periodo=AAAA-MM o ?anio=AAAA acotan.
//   Los asientos son derivados: se pueden volver a generar con "Regenerar". Solo EDITORES.
export async function DELETE(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!EDITORES.includes(email)) return Response.json({ error: 'No tienes permiso para borrar comprobantes.' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const periodo = searchParams.get('periodo')
  const anio = searchParams.get('anio')
  const todo = searchParams.get('todo')   // ?todo=1 -> borra TODO lo generado (todos los periodos)

  // TODO: borrado global sin enumerar ids (no lo limita el cap de 1000 filas).
  if (todo) {
    const { count } = await admin.from('contab_comprobantes').select('*', { count: 'exact', head: true })
    const e1 = await admin.from('contab_lineas').delete().gte('id', 0)
    if (e1.error) return Response.json({ error: 'lineas: ' + e1.error.message }, { status: 500 })
    const e2 = await admin.from('contab_comprobantes').delete().gte('id', 0)
    if (e2.error) return Response.json({ error: 'comprobantes: ' + e2.error.message }, { status: 500 })
    return Response.json({ ok: true, borrados: count || 0, alcance: 'todo' })
  }

  // Alcance acotado (periodo o ano): enumera ids paginando y borra en trozos.
  const ids = []
  let desde = 0
  for (;;) {
    let q = admin.from('contab_comprobantes').select('id').order('id', { ascending: true }).range(desde, desde + 999)
    if (periodo) q = q.eq('periodo', periodo)
    else if (anio) q = q.gte('periodo', `${anio}-01`).lte('periodo', `${anio}-12`)
    else return Response.json({ error: 'Falta el alcance (periodo, anio o todo).' }, { status: 400 })
    const { data, error } = await q
    if (error) return Response.json({ error: error.message }, { status: 500 })
    if (!data || !data.length) break
    ids.push(...data.map(c => c.id))
    if (data.length < 1000) break
    desde += 1000
  }
  if (!ids.length) return Response.json({ ok: true, borrados: 0 })

  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await admin.from('contab_lineas').delete().in('comprobante_id', ids.slice(i, i + 200))
    if (error) return Response.json({ error: 'lineas: ' + error.message }, { status: 500 })
  }
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await admin.from('contab_comprobantes').delete().in('id', ids.slice(i, i + 200))
    if (error) return Response.json({ error: 'comprobantes: ' + error.message }, { status: 500 })
  }
  return Response.json({ ok: true, borrados: ids.length, alcance: periodo || anio })
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
  // Leer TODAS las lineas paginando. Supabase limita a 1000 filas por consulta: sin esto,
  // la previsualizacion/exportacion se cortaba a 1000 lineas y partia comprobantes (falso descuadre
  // y export incompleto). Troceo de ids (<=200) para no reventar la querystring + .range() por bloques.
  const lineas = []
  for (let i = 0; i < ids.length; i += 200) {
    const trozo = ids.slice(i, i + 200)
    let desde = 0
    for (;;) {
      const { data, error } = await admin
        .from('contab_lineas')
        .select('comprobante_id, sub_orden, id, cuenta, glosa_detalle, ccb, debe, haber')
        .in('comprobante_id', trozo)
        .order('id', { ascending: true })
        .range(desde, desde + 999)
      if (error || !data || !data.length) break
      lineas.push(...data)
      if (data.length < 1000) break
      desde += 1000
    }
  }

  const { data: plan } = await admin
    .from('contab_plan_cuentas').select('codigo, descripcion')
  const descCuenta = {}
  for (const p of (plan || [])) descCuenta[p.codigo] = p.descripcion

  const porComp = {}
  for (const l of (lineas || [])) (porComp[l.comprobante_id] ||= []).push(l)

  const filas = []
  let excluidos = 0
  for (const c of comps) {
    const ls = (porComp[c.id] || []).slice().sort((a, b) => (a.sub_orden - b.sub_orden) || (a.id - b.id))
    // Comprobante con cuenta puente -> NO va a Nubox (queda en Pendiente de clasificar). Se salta entero para no descuadrar.
    if (ls.some(l => CUENTAS_PUENTE.includes((l.cuenta || '').trim()))) { excluidos++; continue }
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
        cuenta_nubox: cuentaNubox(l.cuenta),   // lo que se imputa en Nubox (3er nivel truncado al padre)
        glosa_detalle: l.glosa_detalle || '',
        centro_costo: '',              // columna Nubox Centro Costo: SIEMPRE vacia (el CC viaja en 4301-XX / en la desc de cuenta)
        ccb: l.ccb || '',               // CC real de la linea, solo referencia interna (no va a Nubox)
        sucursal: '',
        debe: Number(l.debe) || 0,
        haber: Number(l.haber) || 0,
        desc_cuenta: descCuenta[l.cuenta] || '',
      })
    })
  }
  filas.excluidos = excluidos
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
