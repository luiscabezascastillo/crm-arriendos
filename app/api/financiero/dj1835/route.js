// VERSION: v1 · 2026-07-25 · Endpoint del módulo DJ 1835 (arriendos SII).
//   GET  → años disponibles · líneas de un año (desde vw_dj1835) · estado de carga
//   POST → congela un año declarado (guarda snapshot en dj1835_cargas)
//
// La DJ 1835 se genera desde vw_dj1835 (una línea por contrato/año). No hay carga de
// archivo: los datos crecen solos desde liquidacion_idadmon al cerrar liquidaciones.
// El monto anual = suma de a_cobrar de los meses arrendados. Comuna y RUT dueño ya
// vienen resueltos en la vista. Las 4 representaciones (SALIDA_SII, F1835_IMPORT,
// CSVF1835, CSVF1835_LINEAS) las arma la page.js a partir de estas líneas.
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const EDITORES = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']

// Se lee de la VISTA vw_dj1835. Añadir columna a una tabla no la trae aquí:
// hay que recrear la vista.
const COLS = [
  'idadmon', 'anio', 'rol', 'comuna_sii', 'comuna_nombre',
  'rut_propietario', 'rut_arrendatario', 'arrendatario', 'propietario',
  'idprop', 'inmueble', 'monto_anual', 'meses_arrendados',
  'declarable', 'motivo_no_declarable', 'falta_comuna', 'falta_rut_propietario',
  'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
].join(', ')

export async function GET(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const anio = searchParams.get('anio')

  // Líneas de un año concreto
  if (anio) {
    const { data: lineas, error } = await admin
      .from('vw_dj1835')
      .select(COLS)
      .eq('anio', anio)
      .order('propietario', { ascending: true })
      .order('inmueble', { ascending: true })
    if (error) return Response.json({ error: error.message }, { status: 500 })

    // Estado de la carga (¿congelado?) de ese año
    const { data: carga } = await admin
      .from('dj1835_cargas')
      .select('anio, n_casos, total_monto, folio_sii, estado_sii, congelado, snapshot')
      .eq('anio', anio)
      .maybeSingle()

    return Response.json({ lineas: lineas || [], carga: carga || null })
  }

  // Lista de años disponibles en la vista + estado de carga de cada uno
  const { data: aniosVista, error: eA } = await admin
    .from('vw_dj1835')
    .select('anio')
  if (eA) return Response.json({ error: eA.message }, { status: 500 })
  const anios = [...new Set((aniosVista || []).map(r => r.anio))].sort((a, b) => b - a)

  const { data: cargas } = await admin
    .from('dj1835_cargas')
    .select('anio, n_casos, total_monto, folio_sii, estado_sii, congelado')
    .order('anio', { ascending: false })

  return Response.json({ anios, cargas: cargas || [] })
}

// POST: congela un año declarado. Guarda snapshot de las líneas declarables.
// body: { anio: 2025, folio_sii?, estado_sii?, nota? }
export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!EDITORES.includes(email)) return Response.json({ error: 'No tienes permiso para congelar.' }, { status: 403 })

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const anio = body?.anio
  if (!anio) return Response.json({ error: 'Falta anio' }, { status: 400 })

  // ¿Ya congelado?
  const { data: existe } = await admin
    .from('dj1835_cargas').select('anio, congelado').eq('anio', anio).maybeSingle()
  if (existe?.congelado) {
    return Response.json({ error: `El año ${anio} ya está congelado.` }, { status: 409 })
  }

  // Snapshot de las líneas declarables de ese año
  const { data: lineas, error: eL } = await admin
    .from('vw_dj1835').select(COLS).eq('anio', anio).eq('declarable', true)
  if (eL) return Response.json({ error: eL.message }, { status: 500 })

  const nCasos = (lineas || []).length
  const totalMonto = (lineas || []).reduce((s, l) => s + (Number(l.monto_anual) || 0), 0)

  const row = {
    anio,
    n_casos: nCasos,
    total_monto: totalMonto,
    folio_sii: body?.folio_sii || null,
    estado_sii: body?.estado_sii || null,
    congelado: true,
    snapshot: lineas,
    creado_por: email,
    nota: body?.nota || null,
  }

  const { error: eU } = await admin
    .from('dj1835_cargas')
    .upsert(row, { onConflict: 'anio' })
  if (eU) return Response.json({ error: eU.message }, { status: 500 })

  return Response.json({ ok: true, anio, n_casos: nCasos, total_monto: totalMonto })
}
