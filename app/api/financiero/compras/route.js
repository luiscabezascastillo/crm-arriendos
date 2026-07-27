// VERSION: v2 · 2026-07-27 · Cuatro arreglos.
//   1) El POST montaba la fila campo a campo y NO incluia otro_impuesto ni
//      cod_otro_impuesto: los impuestos adicionales de los CSV del SII (codigo 28,
//      combustibles) llegaban de la pagina y se tiraban en silencio. La contabilidad
//      cuadraba igual porque el generador usa total-iva, pero el dato se perdia.
//   2) El GET no devolvia origen_clasificacion, asi que la pantalla no podia saber
//      que habia puesto la maquina y que habia revisado una persona.
//   3) Supabase corta en 1000 filas y aqui no se paginaba, ni en compras ni en la
//      lectura de meses. Mismo fallo que tenia Ventas.
//   4) El GET devuelve ademas el PLAN DE CUENTAS de detalle y la MEMORIA POR RUT
//      (vw_compras_memoria), para el buscador de cuentas y las sugerencias.
// VERSION: v1 · 2026-07-13 · API Compras (Financiero). GET: meses / compras · PUT: editar · POST: cargar mes (dedup por rut+folio).
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const EDITORES = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']
const COLS = 'id, folio, tipo_doc, fecha, rut, proveedor, ccb, cuenta, pagado_por, exento, neto, iva, total, estado, glosa, mes, otro_impuesto, cod_otro_impuesto, origen_clasificacion'

const PAGINA = 1000
const TOPE = 200000

// Lee por bloques hasta que uno venga incompleto. Recibe una FUNCION: los query
// builders de Supabase son de un solo uso.
async function leerTodo(construir) {
  const filas = []
  for (let desde = 0; desde < TOPE; desde += PAGINA) {
    const { data, error } = await construir().range(desde, desde + PAGINA - 1)
    if (error) throw new Error(error.message)
    const lote = data || []
    filas.push(...lote)
    if (lote.length < PAGINA) break
  }
  return filas
}

export async function GET(req) {
  const session = await getServerSession(authOptions); const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const mes = searchParams.get('mes'); const todas = searchParams.get('todas')
  try {
    if (mes || todas) {
      const compras = await leerTodo(() => {
        let q = admin.from('compras').select(COLS)
        if (mes) q = q.eq('mes', mes)
        // 'id' de desempate: sin orden estable, paginar puede repetir o saltar filas.
        return q.order('fecha', { ascending: true }).order('folio', { ascending: true }).order('id', { ascending: true })
      })

      // Plan de cuentas imputables, para el buscador del panel.
      let plan = []
      try {
        plan = await leerTodo(() => admin.from('contab_plan_cuentas')
          .select('codigo, descripcion').eq('es_detalle', true).eq('activa', true)
          .order('codigo', { ascending: true }))
      } catch { plan = [] }

      // Memoria por RUT (vista creada en memoria.sql). Si aun no existe, se sigue sin ella.
      let memoria = []
      try {
        memoria = await leerTodo(() => admin.from('vw_compras_memoria')
          .select('rut, ccb_sugerido, ccb_base, ccb_pct, cuenta_sugerida, cta_base, cta_pct')
          .order('rut', { ascending: true }))
      } catch { memoria = [] }

      return Response.json({ compras, plan, memoria, total: compras.length })
    }

    const filas = await leerTodo(() => admin.from('compras').select('mes').order('id', { ascending: true }))
    const counts = {}
    for (const r of filas) { if (r.mes) counts[r.mes] = (counts[r.mes] || 0) + 1 }
    const meses = Object.entries(counts).map(([mes, n]) => ({ mes, n })).sort((a, b) => b.mes.localeCompare(a.mes))
    return Response.json({ meses, total: filas.length })
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 500 })
  }
}

export async function PUT(req) {
  const session = await getServerSession(authOptions); const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!EDITORES.includes(email)) return Response.json({ error: 'No tienes permiso para editar compras.' }, { status: 403 })
  let body; try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  if (!body?.id) return Response.json({ error: 'Falta id' }, { status: 400 })
  const patch = {
    ccb: (body.ccb || '').trim() || null, cuenta: (body.cuenta || '').trim() || null,
    pagado_por: (body.pagado_por || '').trim() || null, estado: (body.estado || '').trim() || null,
    glosa: (body.glosa || '').trim() || null,
  }
  const { error } = await admin.from('compras').update(patch).eq('id', body.id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export async function POST(req) {
  const session = await getServerSession(authOptions); const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!EDITORES.includes(email)) return Response.json({ error: 'No tienes permiso para cargar compras.' }, { status: 403 })
  let body; try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const compras = Array.isArray(body?.compras) ? body.compras : null
  if (!compras || !compras.length) return Response.json({ error: 'No hay compras para cargar' }, { status: 400 })
  const seen = new Set(); const rows = []
  for (const c of compras) {
    if (!c.folio || !c.fecha || !c.rut) continue
    const k = `${c.rut}-${c.folio}`; if (seen.has(k)) continue; seen.add(k)
    rows.push({
      folio: Math.round(Number(c.folio)), tipo_doc: c.tipo_doc || null, fecha: c.fecha, rut: c.rut || null,
      proveedor: c.proveedor || null, ccb: c.ccb || null, cuenta: c.cuenta || null, pagado_por: c.pagado_por || null,
      exento: c.exento == null ? null : Math.round(Number(c.exento)), neto: c.neto == null ? null : Math.round(Number(c.neto)),
      iva: c.iva == null ? null : Math.round(Number(c.iva)), total: c.total == null ? null : Math.round(Number(c.total)),
      // Impuestos adicionales del SII (cod. 28 combustibles, peajes...): total = exento + neto + iva + otro.
      otro_impuesto: c.otro_impuesto == null ? 0 : Math.round(Number(c.otro_impuesto)),
      cod_otro_impuesto: c.cod_otro_impuesto || null,
      estado: c.estado || null, glosa: c.glosa || null, mes: c.mes || null, cargado_por: email, archivo: body.archivo || null,
    })
  }
  if (!rows.length) return Response.json({ error: 'No hay compras válidas (con rut, folio y fecha)' }, { status: 400 })
  // El upsert tambien tiene el tope de 1000: se manda por lotes.
  let nuevas = 0
  for (let i = 0; i < rows.length; i += PAGINA) {
    const lote = rows.slice(i, i + PAGINA)
    const { data, error } = await admin.from('compras').upsert(lote, { onConflict: 'rut,folio', ignoreDuplicates: true }).select('id')
    if (error) return Response.json({ error: error.message }, { status: 500 })
    nuevas += (data || []).length
  }
  return Response.json({ ok: true, nuevas, duplicadas: rows.length - nuevas, total: rows.length })
}
