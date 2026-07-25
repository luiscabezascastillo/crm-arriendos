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
  // compras: 'contab_generar_compras',   (pendiente)
  // sa:      'contab_generar_sa',         (pendiente)
}

const LIMITE_NUBOX = 5000 // líneas máximas por bloque de importación

export async function GET(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const periodo = searchParams.get('periodo')
  const exportar = searchParams.get('export')

  // Exportación a Nubox: filas planas A-J, troceadas en bloques <5000
  if (exportar === 'nubox' && periodo) {
    const filas = await filasNubox(periodo)
    // trocear en bloques respetando que un comprobante no se parta
    const bloques = trocear(filas, LIMITE_NUBOX)
    return Response.json({ periodo, total_filas: filas.length, n_bloques: bloques.length, bloques })
  }

  // Comprobantes de un periodo + cuadre por origen
  if (periodo) {
    const { data: comp, error } = await admin
      .from('vw_contab_cuadre')
      .select('id, origen, periodo, fecha, glosa, ccb, estado, n_lineas, total_debe, total_haber, descuadre, cuadra')
      .eq('periodo', periodo)
      .order('origen', { ascending: true })
      .order('ccb', { ascending: true })
    if (error) return Response.json({ error: error.message }, { status: 500 })

    // resumen por origen
    const porOrigen = {}
    for (const c of (comp || [])) {
      const o = porOrigen[c.origen] ||= { origen: c.origen, n_comp: 0, debe: 0, haber: 0, todos_cuadran: true }
      o.n_comp++; o.debe += Number(c.total_debe) || 0; o.haber += Number(c.total_haber) || 0
      if (!c.cuadra) o.todos_cuadran = false
    }
    return Response.json({ periodo, comprobantes: comp || [], resumen: Object.values(porOrigen), origenes: Object.keys(GENERADORES) })
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

// Construye las filas planas formato Nubox (A-J) de un periodo, todos los orígenes.
async function filasNubox(periodo) {
  const { data: comps } = await admin
    .from('contab_comprobantes')
    .select('id, tipo, fecha, glosa, orden, origen')
    .eq('periodo', periodo)
    .order('origen', { ascending: true })
    .order('orden', { ascending: true })
    .order('id', { ascending: true })
  if (!comps?.length) return []

  const ids = comps.map(c => c.id)
  const { data: lineas } = await admin
    .from('contab_lineas')
    .select('comprobante_id, sub_orden, id, cuenta, glosa_detalle, ccb, debe, haber')
    .in('comprobante_id', ids)
    .order('sub_orden', { ascending: true })
    .order('id', { ascending: true })

  const porComp = {}
  for (const l of (lineas || [])) (porComp[l.comprobante_id] ||= []).push(l)

  const filas = []
  for (const c of comps) {
    const ls = porComp[c.id] || []
    ls.forEach((l, i) => {
      const cabecera = i === 0
      filas.push({
        comp_id: c.id,               // para no partir el comprobante al trocear
        numero: cabecera ? 0 : '',   // Número=0 solo primera línea; Nubox renumera
        tipo: cabecera ? c.tipo : '',
        fecha: cabecera ? c.fecha : '',
        glosa: cabecera ? c.glosa : '',
        cuenta: l.cuenta,
        glosa_detalle: l.glosa_detalle || '',
        centro_costo: l.ccb || '',
        sucursal: '',
        debe: Number(l.debe) || 0,
        haber: Number(l.haber) || 0,
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
