// VERSION: v3 · 2026-07-27 · Devuelve tambien origen_clasificacion (auto/manual).
// VERSION: v2 · 2026-07-27 · Tres cambios.
//   1) El PUT ahora guarda tambien 'cuenta'. Sin esto el buscador del plan se veria en
//      pantalla pero no guardaria nada.
//   2) Supabase corta en 1000 filas y aqui no se paginaba, ni en movimientos ni en la
//      lectura de meses. Con 520 movimientos ya se estaba a mitad de camino.
//   3) El GET devuelve el PLAN DE CUENTAS de detalle, para el buscador del panel.
// VERSION: v2 · 2026-08-20 · POST cargar: al recargar ACTUALIZA las filas existentes (quita ignoreDuplicates) para que
//   las correcciones del Excel entren; conserva CCB/cuenta (no van en el payload). Tras cargar, recalcula el saldo corrido
//   desde los importes (rpc caja_chica_recalcular_saldo), asi un error de tecleo en la columna Saldo del Excel no rompe la cadena.
// VERSION: v1 · 2026-07-13 · API Caja Chica (Financiero). GET meses/movimientos · PUT editar CCB · POST cargar (dedup por orden).
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const EDITORES = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']
const COLS = 'id, orden, fecha, detalle, pagado, recibido, monto, n_documento, saldo, ccb, cuenta, mes, origen_clasificacion'

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
  const { searchParams } = new URL(req.url); const mes = searchParams.get('mes'); const todas = searchParams.get('todas')
  try {
    if (mes || todas) {
      const movimientos = await leerTodo(() => {
        let q = admin.from('caja_chica').select(COLS)
        if (mes) q = q.eq('mes', mes)
        // 'orden' ya es unico, asi que el orden de paginacion es estable.
        return q.order('orden', { ascending: true })
      })

      // Plan de cuentas imputables, para el buscador del panel.
      let plan = []
      try {
        plan = await leerTodo(() => admin.from('contab_plan_cuentas')
          .select('codigo, descripcion').eq('es_detalle', true).eq('activa', true)
          .order('codigo', { ascending: true }))
      } catch { plan = [] }

      return Response.json({ movimientos, plan, total: movimientos.length })
    }

    const filas = await leerTodo(() => admin.from('caja_chica').select('mes').order('orden', { ascending: true }))
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
  if (!EDITORES.includes(email)) return Response.json({ error: 'No tienes permiso para editar caja chica.' }, { status: 403 })
  let body; try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  if (!body?.id) return Response.json({ error: 'Falta id' }, { status: 400 })
  const patch = {
    ccb: (body.ccb || '').trim() || null,
    cuenta: (body.cuenta || '').trim() || null,
    detalle: (body.detalle || '').trim() || null,
  }
  const { error } = await admin.from('caja_chica').update(patch).eq('id', body.id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export async function POST(req) {
  const session = await getServerSession(authOptions); const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!EDITORES.includes(email)) return Response.json({ error: 'No tienes permiso para cargar caja chica.' }, { status: 403 })
  let body; try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const movimientos = Array.isArray(body?.movimientos) ? body.movimientos : null
  if (!movimientos || !movimientos.length) return Response.json({ error: 'No hay movimientos para cargar' }, { status: 400 })
  const seen = new Set(); const rows = []
  for (const m of movimientos) {
    if (m.orden == null || !m.fecha) continue
    if (seen.has(m.orden)) continue; seen.add(m.orden)
    const pagado = m.pagado == null ? 0 : Math.round(Number(m.pagado))
    const recibido = m.recibido == null ? 0 : Math.round(Number(m.recibido))
    rows.push({
      orden: Math.round(Number(m.orden)), fecha: m.fecha, detalle: m.detalle || null, pagado, recibido,
      monto: recibido - pagado, n_documento: m.n_documento || null, saldo: m.saldo == null ? null : Math.round(Number(m.saldo)),
      mes: m.mes || null, cargado_por: email, archivo: body.archivo || null,
    })
  }
  if (!rows.length) return Response.json({ error: 'No hay movimientos válidos (con orden y fecha)' }, { status: 400 })
  // El upsert tambien tiene el tope de 1000: se manda por lotes.
  let nuevas = 0
  for (let i = 0; i < rows.length; i += PAGINA) {
    const lote = rows.slice(i, i + PAGINA)
    // onConflict sin ignoreDuplicates -> ACTUALIZA las columnas del payload (importe/detalle/saldo) en las filas ya existentes.
    // ccb/cuenta/origen_clasificacion NO van en el payload, asi que la clasificacion hecha en el CRM se conserva.
    const { data, error } = await admin.from('caja_chica').upsert(lote, { onConflict: 'orden' }).select('id')
    if (error) return Response.json({ error: error.message }, { status: 500 })
    nuevas += (data || []).length
  }
  // El saldo es derivado: se recalcula desde los importes para que un error de tecleo en la columna
  // Saldo del Excel no deje saltos en el CRM.
  const { error: eRec } = await admin.rpc('caja_chica_recalcular_saldo')
  if (eRec) return Response.json({ error: eRec.message }, { status: 500 })

  return Response.json({ ok: true, escritas: nuevas, total: rows.length })
}
