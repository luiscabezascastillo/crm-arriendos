// VERSION: v4 · 2026-07-27 · Lectura paginada + plan de cuentas para el buscador.
//   1) Supabase devuelve 1000 filas como maximo por peticion y aqui no se paginaba:
//      con mas de 1000 movimientos (o lineas) se perdian silenciosamente los ultimos.
//      Ahora se lee por bloques con .range() y orden estable (id de desempate).
//   2) Las consultas de lineas y marcas usaban .in('movimiento_id', ids) con TODOS los
//      ids de golpe: eso viaja en la querystring y con unos miles revienta por longitud.
//      Ahora va en trozos de 300.
//   3) El GET de movimientos devuelve tambien el PLAN DE CUENTAS de detalle, para que
//      el panel de clasificacion pueda ofrecer un buscador en vez de pedir el codigo
//      de memoria (asi no se vuelve a teclear 1103-01 por 1101-03).
// VERSION: v3 · 2026-07-22 · Dos cambios:
//   1) nextFolio ignoraba que el 99999 (comisiones de mantención del banco) es el máximo de la
//      tabla, así que la siguiente carga habría empezado a numerar en 100000. Ahora se excluye.
//   2) El GET devuelve además las MARCAS de auditoría (tabla sa_marcas): sufijo de folio, color
//      de fila y nota. Va aparte para no tocar la vista vw_sa_movimientos.
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const EDITORES = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']

const PAGINA = 1000
const TROZO = 300
const TOPE = 200000

// Lee por bloques hasta que uno venga incompleto. Recibe una FUNCION porque los
// query builders de Supabase son de un solo uso.
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

// .in() con muchos ids viaja en la URL: se trocea.
async function enTrozos(ids, construir) {
  const out = []
  for (let i = 0; i < ids.length; i += TROZO) {
    const parte = ids.slice(i, i + TROZO)
    const filas = await leerTodo(() => construir(parte))
    out.push(...filas)
  }
  return out
}

const COLS = 'id, carga_id, orden, linea_cartola, fecha, monto, descripcion, cargo_abono, n_lineas, suma_lineas, estado_clasificacion, saldo_calc'

export async function GET(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const carga = searchParams.get('carga')
  const movimiento = searchParams.get('movimiento')
  const todas = searchParams.get('todas')

  // Líneas de UN movimiento (para el drawer)
  if (movimiento) {
    const { data, error } = await admin
      .from('sa_lineas')
      .select('id, sub_orden, monto, ccb, cuenta_1, cuenta_2, concepto')
      .eq('movimiento_id', movimiento)
      .order('sub_orden', { ascending: true })
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ lineas: data })
  }

  // Movimientos: de una cartola, o TODAS (vista continua). Incluye sus líneas para el desglose inline.
  if (carga || todas) {
    try {
      const movs = await leerTodo(() => {
        let q = admin.from('vw_sa_movimientos').select(COLS)
        if (carga) q = q.eq('carga_id', carga).order('linea_cartola', { ascending: true })
        else q = q.order('fecha', { ascending: true }).order('carga_id', { ascending: true }).order('linea_cartola', { ascending: true })
        return q.order('id', { ascending: true })   // desempate: sin orden estable, paginar salta filas
      })

      const ids = movs.map(m => m.id)

      const lineas = ids.length ? await enTrozos(ids, (parte) =>
        admin.from('sa_lineas')
          .select('id, movimiento_id, sub_orden, monto, ccb, cuenta_1, cuenta_2, concepto')
          .in('movimiento_id', parte)
          .order('movimiento_id', { ascending: true })
          .order('sub_orden', { ascending: true })
      ) : []

      // Marcas de auditoría. Si la tabla aún no existe se sigue sin ellas.
      let marcas = []
      if (ids.length) {
        try {
          marcas = await enTrozos(ids, (parte) =>
            admin.from('sa_marcas')
              .select('movimiento_id, sufijo_orden, color_fondo, nota_auditoria')
              .in('movimiento_id', parte)
              .order('movimiento_id', { ascending: true })
          )
        } catch { marcas = [] }
      }

      // Plan de cuentas imputables, para el buscador del panel de clasificación.
      let plan = []
      try {
        plan = await leerTodo(() =>
          admin.from('contab_plan_cuentas')
            .select('codigo, descripcion')
            .eq('es_detalle', true).eq('activa', true)
            .order('codigo', { ascending: true })
        )
      } catch { plan = [] }

      return Response.json({ movimientos: movs, lineas, marcas, plan })
    } catch (e) {
      return Response.json({ error: String(e?.message || e) }, { status: 500 })
    }
  }

  // Lista de cartolas para el selector
  const { data, error } = await admin
    .from('sa_cargas')
    .select('id, nro_cartola, periodo, tipo, fecha_desde, fecha_hasta, n_movimientos, saldo_inicial')
    .order('nro_cartola', { ascending: false })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ cargas: data })
}

export async function PUT(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!EDITORES.includes(email)) return Response.json({ error: 'No tienes permiso para editar la clasificación.' }, { status: 403 })

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const movimientoId = body?.movimiento_id
  const lineas = Array.isArray(body?.lineas) ? body.lineas : null
  if (!movimientoId || !lineas) return Response.json({ error: 'Faltan movimiento_id o lineas' }, { status: 400 })

  const { error: delErr } = await admin.from('sa_lineas').delete().eq('movimiento_id', movimientoId)
  if (delErr) return Response.json({ error: delErr.message }, { status: 500 })

  if (lineas.length) {
    const filas = lineas.map((l, i) => ({
      movimiento_id: movimientoId,
      sub_orden: l.sub_orden ?? (i + 1),
      monto: Math.abs(Math.round(Number(l.monto))) || 0,
      ccb: l.ccb || null,
      cuenta_1: l.cuenta_1 || null,
      cuenta_2: l.cuenta_2 || null,
      concepto: l.concepto || null,
      creado_por: email,
    }))
    const { error: insErr } = await admin.from('sa_lineas').insert(filas)
    if (insErr) return Response.json({ error: insErr.message }, { status: 500 })
  }

  return Response.json({ ok: true, n: lineas.length })
}

// POST: cargar un extracto (provisoria o definitiva). Reconcilia por posición y asigna folio a los nuevos.
export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!EDITORES.includes(email)) return Response.json({ error: 'No tienes permiso para cargar extractos.' }, { status: 403 })

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const { nro_cartola, tipo, periodo, fecha_desde, fecha_hasta, saldo_inicial } = body || {}
  const movimientos = Array.isArray(body?.movimientos) ? body.movimientos : null
  if (!nro_cartola || !movimientos || !movimientos.length) return Response.json({ error: 'Faltan nro_cartola o movimientos' }, { status: 400 })

  const { data: cargaEx, error: e0 } = await admin.from('sa_cargas').select('id, tipo, n_movimientos').eq('nro_cartola', nro_cartola).maybeSingle()
  if (e0) return Response.json({ error: e0.message }, { status: 500 })

  // OJO: el 99999 es el número especial de las comisiones de mantención del banco, no el último
  // folio de la serie. Sin el .lt() la siguiente cartola empezaría a numerar en 100000.
  const { data: maxRow } = await admin.from('sa_movimientos')
    .select('orden').not('orden', 'is', null).lt('orden', 90000)
    .order('orden', { ascending: false }).limit(1).maybeSingle()
  let nextFolio = maxRow?.orden || 1877   // el primero de 2026 será 1878

  const mkRow = (cargaId, m, i, folio) => ({
    carga_id: cargaId, linea_cartola: i + 1, fecha: m.fecha, monto: Math.round(Number(m.monto)),
    descripcion: m.descripcion || null, n_documento: m.n_documento || null, sucursal: m.sucursal || null,
    cargo_abono: (m.cargo_abono === 'C' || m.cargo_abono === 'A') ? m.cargo_abono : null, orden: folio,
  })

  // CARTOLA NUEVA
  if (!cargaEx) {
    const { data: nueva, error: e1 } = await admin.from('sa_cargas').insert({
      nro_cartola, tipo: tipo || 'definitiva', periodo: periodo || null,
      fecha_desde: fecha_desde || null, fecha_hasta: fecha_hasta || null,
      saldo_inicial: (saldo_inicial != null ? Math.round(Number(saldo_inicial)) : null),
      n_movimientos: movimientos.length, cargado_por: email, archivo: body.archivo || null,
    }).select('id').single()
    if (e1) return Response.json({ error: e1.message }, { status: 500 })
    const rows = movimientos.map((m, i) => mkRow(nueva.id, m, i, ++nextFolio))
    const { error: e2 } = await admin.from('sa_movimientos').insert(rows)
    if (e2) return Response.json({ error: e2.message }, { status: 500 })
    return Response.json({ ok: true, cartola_nueva: true, nro_cartola, nuevos: rows.length, existentes: 0, total: movimientos.length, conflictos: [] })
  }

  // RECARGA: reconciliar por posición (linea_cartola)
  const cargaId = cargaEx.id
  const { data: exMovs, error: e3 } = await admin.from('sa_movimientos').select('linea_cartola, fecha, monto').eq('carga_id', cargaId)
  if (e3) return Response.json({ error: e3.message }, { status: 500 })
  const exByLinea = {}
  for (const m of (exMovs || [])) exByLinea[m.linea_cartola] = m

  const nuevos = []; const conflictos = []
  movimientos.forEach((m, i) => {
    const linea = i + 1
    const ex = exByLinea[linea]
    if (ex) {
      if (String(ex.fecha).slice(0, 10) !== String(m.fecha).slice(0, 10) || Math.round(Number(ex.monto)) !== Math.round(Number(m.monto))) {
        conflictos.push({ linea })
      }
      // ya existía → se conserva su folio y su clasificación (no se toca)
    } else {
      nuevos.push(mkRow(cargaId, m, i, ++nextFolio))
    }
  })
  if (nuevos.length) {
    const { error: e4 } = await admin.from('sa_movimientos').insert(nuevos)
    if (e4) return Response.json({ error: e4.message }, { status: 500 })
  }
  await admin.from('sa_cargas').update({ tipo: tipo || cargaEx.tipo, fecha_hasta: fecha_hasta || null, n_movimientos: movimientos.length }).eq('id', cargaId)

  return Response.json({ ok: true, cartola_nueva: false, nro_cartola, nuevos: nuevos.length, existentes: (exMovs?.length || 0), total: movimientos.length, conflictos })
}
