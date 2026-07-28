// VERSION: v6 · 2026-07-27 · El PUT guarda tambien la glosa contable del movimiento.
// VERSION: v5 · 2026-07-27 · La carga reconcilia por N° MOVIMIENTO, no por posicion.
//   El POST emparejaba por linea_cartola (la posicion en el archivo). Eso solo funciona
//   si cada carga es la cartola COMPLETA desde la primera linea. La Consulta de
//   Movimientos que se sube cada semana es parcial, solapada y de rango libre, asi que
//   la posicion no significa nada: una carga con 5 movimientos nuevos daba "0 nuevos y
//   11 lineas a revisar".
//   Ahora se empareja en dos pasos:
//     1) por n_movimiento (correlativo unico del banco);
//     2) si el guardado aun no lo tiene -los 727 historicos-, por huella
//        fecha + monto + descripcion, y de paso SE LE RELLENA el numero.
//   Asi el historico se va numerando solo conforme se suben archivos.
//   Ademas cada movimiento va a la carga de SU PROPIO MES: el archivo semanal cruza
//   de mes (21/07 a 04/08) y antes todo caia en la cartola del mes del fichero.
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

const COLS = 'id, carga_id, orden, glosa, linea_cartola, fecha, monto, descripcion, cargo_abono, n_lineas, suma_lineas, estado_clasificacion, saldo_calc'

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

  // Glosa propia del movimiento: sustituye a la del banco en los asientos. La del
  // banco NO se toca, es el dato original.
  if (Object.prototype.hasOwnProperty.call(body, 'glosa')) {
    const g = String(body.glosa || '').trim() || null
    const { error: eG } = await admin.from('sa_movimientos').update({ glosa: g }).eq('id', movimientoId)
    if (eG) return Response.json({ error: eG.message }, { status: 500 })
  }

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

// POST: cargar un extracto. Reconcilia por el N° MOVIMIENTO del banco.
export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!EDITORES.includes(email)) return Response.json({ error: 'No tienes permiso para cargar extractos.' }, { status: 403 })

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const movimientos = Array.isArray(body?.movimientos) ? body.movimientos : null
  if (!movimientos || !movimientos.length) return Response.json({ error: 'No hay movimientos' }, { status: 400 })

  const norm = (t) => String(t || '').trim().toUpperCase().replace(/\s+/g, ' ')
  const huella = (m) => `${String(m.fecha).slice(0, 10)}|${Math.round(Number(m.monto))}|${norm(m.descripcion)}`
  const mesDe = (f) => String(f).slice(0, 7)

  try {
    // ---- 1. Lo que ya hay, para emparejar ----
    const yaHay = await leerTodo(() => admin.from('sa_movimientos')
      .select('id, n_movimiento, fecha, monto, descripcion, carga_id')
      .order('id', { ascending: true }))

    const porNumero = new Map()
    const porHuella = new Map()
    for (const m of yaHay) {
      if (m.n_movimiento != null) porNumero.set(Number(m.n_movimiento), m)
      const h = huella(m)
      if (!porHuella.has(h)) porHuella.set(h, [])
      porHuella.get(h).push(m)
    }

    const usados = new Set()
    const nuevos = []
    const numerar = []          // historicos a los que se les rellena el numero
    let existentes = 0

    for (const m of movimientos) {
      if (!m.fecha || m.monto == null) continue
      const nm = m.n_movimiento != null ? Number(m.n_movimiento) : null

      // 1) por el numero del banco
      if (nm != null && porNumero.has(nm)) { existentes++; continue }

      // 2) por huella, para los historicos que aun no tienen numero
      const cands = (porHuella.get(huella(m)) || []).filter(x => !usados.has(x.id) && x.n_movimiento == null)
      if (cands.length) {
        const enc = cands[0]
        usados.add(enc.id)
        existentes++
        if (nm != null) numerar.push({ id: enc.id, n_movimiento: nm })
        continue
      }

      nuevos.push(m)
    }

    // ---- 2. Rellenar el numero en los historicos emparejados ----
    let numerados = 0
    for (const u of numerar) {
      const { error } = await admin.from('sa_movimientos').update({ n_movimiento: u.n_movimiento }).eq('id', u.id)
      if (!error) numerados++
    }

    // ---- 3. Los nuevos, cada uno a la carga de SU mes ----
    const { data: maxRow } = await admin.from('sa_movimientos')
      .select('orden').not('orden', 'is', null).lt('orden', 90000)
      .order('orden', { ascending: false }).limit(1).maybeSingle()
    let nextFolio = maxRow?.orden || 1877

    const cargas = {}
    const getCarga = async (mes) => {
      if (cargas[mes]) return cargas[mes]
      const { data: ex } = await admin.from('sa_cargas').select('id, nro_cartola').eq('periodo', mes).maybeSingle()
      if (ex) { cargas[mes] = ex.id; return ex.id }
      const { data: mx } = await admin.from('sa_cargas').select('nro_cartola')
        .order('nro_cartola', { ascending: false }).limit(1).maybeSingle()
      const nro = (mx?.nro_cartola || 0) + 1
      const { data: nueva, error } = await admin.from('sa_cargas').insert({
        nro_cartola: nro, tipo: body.tipo || 'provisoria', periodo: mes,
        n_movimientos: 0, cargado_por: email, archivo: body.archivo || null,
      }).select('id').single()
      if (error) throw new Error(error.message)
      cargas[mes] = nueva.id
      return nueva.id
    }

    const filas = []
    for (const m of nuevos) {
      const cargaId = await getCarga(mesDe(m.fecha))
      filas.push({
        carga_id: cargaId, fecha: m.fecha, monto: Math.round(Number(m.monto)),
        descripcion: m.descripcion || null, n_documento: m.n_documento || null,
        n_movimiento: m.n_movimiento != null ? Number(m.n_movimiento) : null,
        sucursal: m.sucursal || null,
        cargo_abono: (m.cargo_abono === 'C' || m.cargo_abono === 'A') ? m.cargo_abono : null,
        orden: ++nextFolio,
      })
    }

    if (filas.length) {
      // linea_cartola solo como referencia dentro de su carga; ya no reconcilia nada.
      const porCarga = {}
      for (const f of filas) porCarga[f.carga_id] = (porCarga[f.carga_id] || 0) + 1
      for (const cid of Object.keys(porCarga)) {
        const { count } = await admin.from('sa_movimientos').select('id', { count: 'exact', head: true }).eq('carga_id', cid)
        let k = count || 0
        for (const f of filas) if (String(f.carga_id) === String(cid)) f.linea_cartola = ++k
      }
      for (let i = 0; i < filas.length; i += PAGINA) {
        const { error } = await admin.from('sa_movimientos').insert(filas.slice(i, i + PAGINA))
        if (error) return Response.json({ error: error.message }, { status: 500 })
      }
      for (const cid of Object.keys(porCarga)) {
        const { count } = await admin.from('sa_movimientos').select('id', { count: 'exact', head: true }).eq('carga_id', cid)
        await admin.from('sa_cargas').update({ n_movimientos: count || 0 }).eq('id', cid)
      }
    }

    return Response.json({
      ok: true,
      nuevos: filas.length,
      existentes,
      total: movimientos.length,
      numerados,
      meses: Object.keys(cargas),
      conflictos: [],
    })
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 500 })
  }
}
