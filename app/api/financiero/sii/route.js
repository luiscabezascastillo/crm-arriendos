// RUTA: app/api/financiero/sii/route.js
// VERSION: v1 · 2026-08-16 · Endpoint del módulo SII (F29).
//   GET  → lista de F29 (cabeceras) por período, o detalle (líneas) de uno.
//   POST → guarda un F29 ya parseado en el navegador (parseF29). Upsert por folio; marca vigente
//          la última del período (la rectificatoria manda sobre la primitiva).
//   Escritura restringida a Dirección + Alberto/Luis/Karina (dato sensible).
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const EDITORES = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']

function puedeEscribir(session) {
  const rol = String(session?.user?.role || '').toLowerCase()
  return rol === 'direccion' || EDITORES.includes(session?.user?.email)
}
// 'DD/MM/YYYY' -> 'YYYY-MM-DD'
function fechaISO(s) {
  const m = String(s || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}
const numOf = (v) => { if (v == null || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null }
// valor de una línea de detalle: la tasa (115) es decimal; el resto son pesos (quita los puntos).
function valorLinea(codigo, texto) {
  if (texto == null || texto === '') return null
  if (codigo === '115') { const n = parseFloat(texto); return Number.isFinite(n) ? n : null }
  const n = parseInt(String(texto).replace(/\./g, ''), 10)
  return Number.isFinite(n) ? n : null
}

const COLS = 'id, periodo, folio, tipo_declaracion, corrige_folio, vigente, fecha_presentacion, iva_debito, iva_credito, iva_a_pagar, remanente_siguiente, ppm, ppm_base, ppm_tasa, retencion_honorarios, reajustes, intereses, multas, total_a_pagar, n_facturas, n_boletas, n_nc, banco, medio_pago, asiento_id, pago_ref, archivo, observacion, cargado_por, created_at, updated_at'

export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const detalle = searchParams.get('detalle')

  if (detalle) {
    const { data, error } = await admin.from('sii_f29_linea').select('codigo, glosa, valor').eq('f29_id', detalle).order('codigo', { ascending: true })
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ lineas: data || [] })
  }

  const { data, error } = await admin.from('sii_f29').select(COLS).order('periodo', { ascending: false }).order('created_at', { ascending: false })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ f29: data || [] })
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!puedeEscribir(session)) return Response.json({ error: 'Solo Dirección puede cargar F29.' }, { status: 403 })

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const f = body?.f29
  if (!f || !f.periodo || !/^\d{6}$/.test(String(f.periodo))) return Response.json({ error: 'F29 sin período válido (código 15).' }, { status: 400 })
  if (!f.folio) return Response.json({ error: 'F29 sin folio (código 07).' }, { status: 400 })

  const cab = {
    periodo: String(f.periodo), folio: String(f.folio),
    tipo_declaracion: f.tipo_declaracion || 'primitiva', corrige_folio: f.corrige_folio || null,
    vigente: true, fecha_presentacion: fechaISO(f.fecha_presentacion),
    iva_debito: numOf(f.iva_debito), iva_credito: numOf(f.iva_credito), iva_a_pagar: numOf(f.iva_a_pagar),
    remanente_siguiente: numOf(f.remanente_siguiente),
    ppm: numOf(f.ppm), ppm_base: numOf(f.ppm_base), ppm_tasa: numOf(f.ppm_tasa), retencion_honorarios: numOf(f.retencion_honorarios),
    reajustes: numOf(f.reajustes), intereses: numOf(f.intereses), multas: numOf(f.multas), total_a_pagar: numOf(f.total_a_pagar),
    n_facturas: numOf(f.n_facturas), n_boletas: numOf(f.n_boletas), n_nc: numOf(f.n_nc),
    banco: f.banco || null, medio_pago: f.medio_pago || null,
    archivo: f.archivo || null, cargado_por: email, updated_at: new Date().toISOString(),
  }

  // ¿ya existe ese folio? -> update; si no -> insert
  const { data: prev } = await admin.from('sii_f29').select('id').eq('folio', cab.folio).maybeSingle()
  let f29Id
  if (prev?.id) {
    const { error } = await admin.from('sii_f29').update(cab).eq('id', prev.id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    f29Id = prev.id
  } else {
    const { data, error } = await admin.from('sii_f29').insert(cab).select('id').single()
    if (error) return Response.json({ error: error.message }, { status: 500 })
    f29Id = data.id
  }

  // Detalle: se reemplaza
  await admin.from('sii_f29_linea').delete().eq('f29_id', f29Id)
  const lineas = Array.isArray(f.lineas) ? f.lineas : []
  if (lineas.length) {
    const filas = lineas.map(l => ({ f29_id: f29Id, codigo: String(l.codigo), glosa: l.glosa || null, valor: valorLinea(String(l.codigo), l.valor_texto) }))
    const { error } = await admin.from('sii_f29_linea').insert(filas)
    if (error) return Response.json({ error: error.message }, { status: 500 })
  }

  // Vigencia: esta declaración pasa a ser la vigente del período; las demás del mismo período dejan de serlo.
  await admin.from('sii_f29').update({ vigente: false }).eq('periodo', cab.periodo).neq('id', f29Id)
  await admin.from('sii_f29').update({ vigente: true }).eq('id', f29Id)

  return Response.json({ ok: true, id: f29Id, periodo: cab.periodo, folio: cab.folio, tipo: cab.tipo_declaracion })
}
