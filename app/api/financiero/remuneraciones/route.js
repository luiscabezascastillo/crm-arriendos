// VERSION: v4 · 2026-08-14 · La carga (accion:'cargar_libro') ahora es APORTES-AWARE: si las líneas
//   traen aportes del empleador (ap_sis/ap_cesantia/ap_mutual/ap_sanna/ap_otros) y un ap_origen,
//   se escriben en rem_lineas y coste_empresa (columna generada) queda COMPLETO. El LRE de Nubox
//   (parseLRE) los aporta con ap_origen='lre'; el PDF antiguo no los trae y sigue igual (ap_* null →
//   falta_previred). El aviso de respuesta es condicional según haya aportes o no. Hereda v3.
// VERSION: v1 · 2026-07-23 · Endpoint del módulo Remuneraciones.
//   GET  → cargas (meses) · líneas de un mes o TODAS · desglose CCB de una línea · maestros
//   PUT  → guarda el desglose CCB de una línea (rem_ccb). Respeta rem_cargas.congelado.
//   POST → hereda el reparto por defecto (rem_empleado_ccb) a todas las líneas de un mes.
//
// v3 · 2026-07-27 · La carga NO escribe coste_empresa: es una columna GENERADA
//   (haberes + aportes patronales) y Postgres la calcula sola. Insertarla daba
//   'cannot insert a non-DEFAULT value into column "coste_empresa"'.
// v2 · 2026-07-27 · POST admite ademas accion:'cargar_libro' (el PDF se parsea en el
//   navegador y llega ya en JSON). Sigue SIN parser propio del formato nuevo: el libro
//   de ene-2026 es Nubox y esta validado; de feb-2026 en adelante cambio el proveedor
//   y ese formato no se ha visto todavia.
//   Reglas de la carga:
//     · mes congelado -> se rechaza;
//     · si el mes ya tiene lineas -> se exige sobrescribir:true, porque recargar borra
//       las lineas y con ellas el reparto por CCB ya hecho (rem_ccb va en cascada);
//     · los RUT nuevos se dan de alta en rem_empleados para que existan en el maestro;
//     · coste_empresa = tot_haberes: los aportes del empleador NO vienen en el libro,
//       llegan de Previred, y hasta entonces falta_previred deja la linea marcada.
// El histórico 2025 se cargó por SQL (rem_carga_2025_v1.sql).
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const EDITORES = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']

// Se lee de la VISTA, no de rem_lineas. Añadir una columna a la tabla no la hace
// aparecer aquí: hay que recrear vw_rem_lineas.
const COLS = [
  'id', 'carga_id', 'periodo', 'congelado', 'rut', 'nombre', 'nombre_libro', 'cod_libro', 'dt',
  'sueldo_base', 'horas_extras', 'grat_legal', 'otros_imp', 'total_imp',
  'asig_fam', 'otros_no_imp', 'tot_no_imp', 'tot_haberes',
  'prevision', 'salud', 'imp_unico', 'seg_ces', 'otros_dleg', 'tot_dleg',
  'desc_varios', 'tot_desc', 'liquido',
  'ap_sis', 'ap_cesantia', 'ap_mutual', 'ap_sanna', 'ap_otros', 'ap_origen',
  'coste_empresa', 'falta_previred', 'n_ccb', 'suma_ccb', 'estado_clasificacion', 'observacion',
].join(', ')

const CCB_COLS = 'id, linea_id, sub_orden, ccb, pct, monto, cuenta_1, cuenta_2, concepto, origen'

export async function GET(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const carga = searchParams.get('carga')
  const linea = searchParams.get('linea')
  const todas = searchParams.get('todas')
  const maestros = searchParams.get('maestros')

  // Desglose CCB de UNA línea (para el drawer)
  if (linea) {
    const { data, error } = await admin
      .from('rem_ccb')
      .select(CCB_COLS)
      .eq('linea_id', linea)
      .order('sub_orden', { ascending: true })
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ccb: data })
  }

  // Maestros: empleados y su reparto por defecto (para el mantenedor y los desplegables)
  if (maestros) {
    const { data: empleados, error: e1 } = await admin
      .from('rem_empleados')
      .select('rut, nombre, cod_libro, activo, observacion')
      .order('nombre', { ascending: true })
    if (e1) return Response.json({ error: e1.message }, { status: 500 })

    const { data: reparto, error: e2 } = await admin
      .from('rem_empleado_ccb')
      .select('id, rut, ccb, pct, desde, hasta, nota')
      .order('rut', { ascending: true })
      .order('desde', { ascending: true })
    if (e2) return Response.json({ error: e2.message }, { status: 500 })

    return Response.json({ empleados, reparto })
  }

  // Líneas de un mes, o TODAS (vista continua). Incluye su desglose CCB para pintarlo inline.
  if (carga || todas) {
    let q = admin.from('vw_rem_lineas').select(COLS)
    if (carga) q = q.eq('carga_id', carga).order('nombre', { ascending: true })
    else q = q.order('periodo', { ascending: true }).order('nombre', { ascending: true })

    const { data: lineas, error } = await q
    if (error) return Response.json({ error: error.message }, { status: 500 })

    const ids = (lineas || []).map(l => l.id)
    let ccb = []
    if (ids.length) {
      const { data: cs, error: e2 } = await admin
        .from('rem_ccb')
        .select(CCB_COLS)
        .in('linea_id', ids)
        .order('sub_orden', { ascending: true })
      if (e2) return Response.json({ error: e2.message }, { status: 500 })
      ccb = cs || []
    }
    return Response.json({ lineas, ccb })
  }

  // Lista de meses para el selector
  const { data, error } = await admin
    .from('rem_cargas')
    .select('id, periodo, mes_texto, archivo_nombre, n_empleados, chk_tot_haberes, chk_tot_desc, chk_liquido, congelado')
    .order('periodo', { ascending: false })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ cargas: data })
}

// PUT: guarda el desglose CCB de una línea. Igual que sa_lineas: borra y reinserta.
export async function PUT(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!EDITORES.includes(email)) return Response.json({ error: 'No tienes permiso para editar la clasificación.' }, { status: 403 })

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const lineaId = body?.linea_id
  const filas = Array.isArray(body?.ccb) ? body.ccb : null
  if (!lineaId || !filas) return Response.json({ error: 'Faltan linea_id o ccb' }, { status: 400 })

  // Mes congelado → no se toca. En SA este bloqueo quedó pendiente; aquí va desde el día uno.
  const { data: ln, error: eL } = await admin
    .from('rem_lineas').select('id, carga_id, coste_empresa').eq('id', lineaId).maybeSingle()
  if (eL) return Response.json({ error: eL.message }, { status: 500 })
  if (!ln) return Response.json({ error: 'La línea no existe' }, { status: 404 })

  const { data: cg, error: eC } = await admin
    .from('rem_cargas').select('periodo, congelado').eq('id', ln.carga_id).maybeSingle()
  if (eC) return Response.json({ error: eC.message }, { status: 500 })
  if (cg?.congelado) {
    return Response.json({ error: `El mes ${String(cg.periodo).slice(0, 7)} está congelado y no se puede modificar.` }, { status: 409 })
  }

  const { error: delErr } = await admin.from('rem_ccb').delete().eq('linea_id', lineaId)
  if (delErr) return Response.json({ error: delErr.message }, { status: 500 })

  let suma = 0
  if (filas.length) {
    const rows = filas.map((c, i) => {
      const monto = Math.round(Number(c.monto)) || 0
      suma += monto
      return {
        linea_id: lineaId,
        sub_orden: c.sub_orden ?? (i + 1),
        ccb: c.ccb || null,
        pct: (c.pct != null && c.pct !== '') ? Number(c.pct) : null,
        monto,
        cuenta_1: c.cuenta_1 || null,
        cuenta_2: c.cuenta_2 || null,
        concepto: c.concepto || null,
        origen: 'MANUAL',
      }
    })
    const { error: insErr } = await admin.from('rem_ccb').insert(rows)
    if (insErr) return Response.json({ error: insErr.message }, { status: 500 })
  }

  return Response.json({
    ok: true,
    n: filas.length,
    suma,
    coste_empresa: ln.coste_empresa,
    cuadra: suma === ln.coste_empresa,
  })
}

// POST: hereda el reparto por defecto a todas las líneas de un mes.
// body: { periodo: '2025-01-01', forzar?: bool, sobrescribir?: bool }
export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!EDITORES.includes(email)) return Response.json({ error: 'No tienes permiso para clasificar.' }, { status: 403 })

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }

  if (body?.accion === 'cargar_libro') return cargarLibro(body, email)

  const periodo = body?.periodo
  if (!periodo) return Response.json({ error: 'Falta periodo (día 1 del mes)' }, { status: 400 })

  const { data: cg, error: eC } = await admin
    .from('rem_cargas').select('id, periodo, congelado').eq('periodo', periodo).maybeSingle()
  if (eC) return Response.json({ error: eC.message }, { status: 500 })
  if (!cg) return Response.json({ error: `No hay ninguna carga con periodo ${periodo}` }, { status: 404 })
  if (cg.congelado) return Response.json({ error: `El mes ${String(periodo).slice(0, 7)} está congelado.` }, { status: 409 })

  const { data: lineas, error: eL } = await admin
    .from('vw_rem_lineas')
    .select('id, rut, nombre, coste_empresa, falta_previred, n_ccb')
    .eq('carga_id', cg.id)
  if (eL) return Response.json({ error: eL.message }, { status: 500 })

  // El coste empresa está INCOMPLETO mientras no se carguen los aportes patronales
  // (Previred). Repartir ahora deja montos que quedarán mal en cuanto lleguen.
  const sinPrevired = (lineas || []).filter(l => l.falta_previred).length
  if (sinPrevired && !body?.forzar) {
    return Response.json({
      error: 'aportes_patronales_pendientes',
      mensaje: `${sinPrevired} de ${lineas.length} líneas no tienen los aportes del empleador cargados. ` +
               'El coste empresa es sólo los haberes, así que el reparto quedaría incompleto. ' +
               'Carga Previred, o repite con forzar:true si aun así quieres repartir.',
      sin_previred: sinPrevired,
      total: lineas.length,
    }, { status: 409 })
  }

  const { data: reparto, error: eR } = await admin.rpc('rem_reparto_vigente', { p_periodo: periodo })
  if (eR) return Response.json({ error: eR.message }, { status: 500 })

  const porRut = {}
  for (const r of (reparto || [])) (porRut[r.rut] ||= []).push(r)

  const filas = []
  const sinReparto = []
  let saltadas = 0

  for (const l of (lineas || [])) {
    if (l.n_ccb > 0 && !body?.sobrescribir) { saltadas++; continue }
    const tramos = porRut[l.rut]
    if (!tramos || !tramos.length) { sinReparto.push({ rut: l.rut, nombre: l.nombre }); continue }

    // El último tramo se lleva el resto para que la suma cuadre EXACTA con el coste empresa.
    const base = Number(l.coste_empresa) || 0
    let acumulado = 0
    tramos.forEach((t, i) => {
      const esUltimo = i === tramos.length - 1
      const monto = esUltimo ? base - acumulado : Math.round(base * Number(t.pct) / 100)
      acumulado += monto
      filas.push({
        linea_id: l.id, sub_orden: i + 1, ccb: t.ccb,
        pct: Number(t.pct), monto, origen: 'HEREDADO',
      })
    })
  }

  if (body?.sobrescribir) {
    const ids = [...new Set(filas.map(f => f.linea_id))]
    if (ids.length) {
      const { error: eD } = await admin.from('rem_ccb').delete().in('linea_id', ids)
      if (eD) return Response.json({ error: eD.message }, { status: 500 })
    }
  }

  if (filas.length) {
    const { error: eI } = await admin.from('rem_ccb').insert(filas)
    if (eI) return Response.json({ error: eI.message }, { status: 500 })
  }

  return Response.json({
    ok: true,
    periodo,
    lineas_clasificadas: [...new Set(filas.map(f => f.linea_id))].length,
    filas_creadas: filas.length,
    saltadas_por_tener_ya: saltadas,
    sin_reparto_definido: sinReparto,
    forzado: !!body?.forzar,
  })
}


// ---------------------------------------------------------------------------
// Carga de un Libro de Remuneraciones ya parseado en el navegador.
// body: { accion:'cargar_libro', periodo:'2026-01-01', mes_texto, archivo,
//         lineas:[{rut, nombre_libro, cod_libro, dt, ...}], totales:{chk_*}, sobrescribir? }
// ---------------------------------------------------------------------------
const N = (v) => (v == null || v === '' ? null : Math.round(Number(v)) || 0)
const limpiarRut = (r) => String(r || '').replace(/[\s.]/g, '').toUpperCase() || null

async function cargarLibro(body, email) {
  const periodo = body?.periodo
  const lineas = Array.isArray(body?.lineas) ? body.lineas : null
  if (!periodo || !/^\d{4}-\d{2}-01$/.test(String(periodo))) {
    return Response.json({ error: 'Falta periodo válido (día 1 del mes, AAAA-MM-01)' }, { status: 400 })
  }
  if (!lineas || !lineas.length) return Response.json({ error: 'El libro no trae líneas' }, { status: 400 })

  // ¿Existe ya el mes?
  const { data: cg, error: eC } = await admin
    .from('rem_cargas').select('id, congelado').eq('periodo', periodo).maybeSingle()
  if (eC) return Response.json({ error: eC.message }, { status: 500 })

  if (cg?.congelado) {
    return Response.json({ error: `El mes ${String(periodo).slice(0, 7)} está congelado y no se puede recargar.` }, { status: 409 })
  }

  if (cg) {
    const { count, error: eN } = await admin
      .from('rem_lineas').select('id', { count: 'exact', head: true }).eq('carga_id', cg.id)
    if (eN) return Response.json({ error: eN.message }, { status: 500 })
    if ((count || 0) > 0 && !body?.sobrescribir) {
      return Response.json({
        error: 'mes_ya_cargado',
        mensaje: `El mes ${String(periodo).slice(0, 7)} ya tiene ${count} líneas cargadas. ` +
                 'Volver a cargarlo las borra, y con ellas el reparto por CCB que se haya hecho. ' +
                 'Repite con sobrescribir:true si es lo que quieres.',
        n_actuales: count,
      }, { status: 409 })
    }
  }

  // Cabecera de la carga
  const t = body?.totales || {}
  const cab = {
    periodo,
    mes_texto: body?.mes_texto || null,
    archivo_nombre: body?.archivo || null,
    n_empleados: lineas.length,
    chk_dt: N(t.chk_dt), chk_tot_imp: N(t.chk_tot_imp), chk_tot_no_imp: N(t.chk_tot_no_imp),
    chk_tot_haberes: N(t.chk_tot_haberes), chk_tot_desc: N(t.chk_tot_desc), chk_liquido: N(t.chk_liquido),
    congelado: false, cargado_por: email,
  }

  let cargaId = cg?.id
  if (cargaId) {
    const { error } = await admin.from('rem_cargas').update(cab).eq('id', cargaId)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    const { error: eD } = await admin.from('rem_lineas').delete().eq('carga_id', cargaId)
    if (eD) return Response.json({ error: eD.message }, { status: 500 })
  } else {
    const { data, error } = await admin.from('rem_cargas').insert(cab).select('id').single()
    if (error) return Response.json({ error: error.message }, { status: 500 })
    cargaId = data.id
  }

  // Alta de los RUT que no estuvieran en el maestro (sin pisar los nombres ya puestos)
  const nuevos = []
  const vistos = new Set()
  for (const l of lineas) {
    const rut = limpiarRut(l.rut)
    if (!rut || vistos.has(rut)) continue
    vistos.add(rut)
    nuevos.push({ rut, nombre: l.nombre_libro || null, cod_libro: N(l.cod_libro), activo: true })
  }
  if (nuevos.length) {
    await admin.from('rem_empleados').upsert(nuevos, { onConflict: 'rut', ignoreDuplicates: true })
  }

  const filas = lineas.map((l, i) => ({
    carga_id: cargaId, periodo, rut: limpiarRut(l.rut),
    fila_libro: i + 1, cod_libro: N(l.cod_libro), nombre_libro: l.nombre_libro || null,
    dt: N(l.dt),
    sueldo_base: N(l.sueldo_base), horas_extras: N(l.horas_extras), grat_legal: N(l.grat_legal),
    otros_imp: N(l.otros_imp), total_imp: N(l.total_imp),
    asig_fam: N(l.asig_fam), otros_no_imp: N(l.otros_no_imp), tot_no_imp: N(l.tot_no_imp),
    tot_haberes: N(l.tot_haberes),
    prevision: N(l.prevision), salud: N(l.salud), imp_unico: N(l.imp_unico), seg_ces: N(l.seg_ces),
    otros_dleg: N(l.otros_dleg), tot_dleg: N(l.tot_dleg), desc_varios: N(l.desc_varios),
    tot_desc: N(l.tot_desc), liquido: N(l.liquido),
    // Aportes del empleador. El LRE (parseLRE) los trae; el PDF no (quedan null → falta_previred).
    // coste_empresa NO se escribe: es columna generada (haberes + aportes) y Postgres la calcula.
    ap_sis: N(l.ap_sis), ap_cesantia: N(l.ap_cesantia),
    ap_mutual: N(l.ap_mutual), ap_sanna: N(l.ap_sanna), ap_otros: N(l.ap_otros),
    ap_origen: (l.ap_origen == null || l.ap_origen === '') ? null : String(l.ap_origen).trim(),
  }))

  const { error: eI } = await admin.from('rem_lineas').insert(filas)
  if (eI) return Response.json({ error: eI.message }, { status: 500 })

  // ¿La carga trajo aportes del empleador? (LRE sí; PDF no.)
  const conAportes = lineas.some(l => l && l.ap_origen)

  return Response.json({
    ok: true, periodo, carga_id: cargaId,
    n_lineas: filas.length,
    empleados_nuevos: nuevos.length,
    sobrescrito: !!cg,
    con_aportes: conAportes,
    aviso: conAportes
      ? 'Aportes del empleador cargados desde el LRE: el coste empresa queda completo.'
      : 'Faltan los aportes del empleador (SIS, cesantía patronal, mutual, SANNA): vienen del LRE o de Previred.',
  })
}
