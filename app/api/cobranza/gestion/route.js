// VERSION: v1 · 2026-08-10 · Cobranza · gestiones (CONSTANCIA).
//   GET ?idadmon=  -> contrato + caso abierto + gestiones + plantillas (para el panel de gestion).
//   GET ?log=1     -> ultimas gestiones (para la Bitacora global).
//   POST           -> registra una gestion (append-only) y crea el caso si no existe.
// Ruta real: app/api/cobranza/gestion/route.js
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const PUEDEN_VER = ['direccion', 'administracion', 'finanzas', 'legal']

function guard(session) {
  const rol = session?.user?.role
  if (!session?.user?.email) return { code: 401, msg: 'No autenticado' }
  if (!PUEDEN_VER.includes(rol)) return { code: 403, msg: 'No autorizado' }
  return null
}

export async function GET(req) {
  const session = await getServerSession(authOptions)
  const g = guard(session)
  if (g) return Response.json({ error: g.msg }, { status: g.code })

  const url = new URL(req.url)
  const idadmon = url.searchParams.get('idadmon')
  const log = url.searchParams.get('log')

  if (log) {
    const { data, error } = await admin.from('cobranza_gestiones')
      .select('*').order('fecha', { ascending: false }).limit(200)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true, gestiones: data || [] })
  }

  if (!idadmon) return Response.json({ error: 'Falta idadmon' }, { status: 400 })

  const { data: contrato } = await admin.from('datos_arriendos')
    .select('idadmon, propietario, inmueble, estado, arrendatario, rut, mail_arrendatario, movil, avalista, rut_avalista, mail_avalista, telefono_avalista')
    .eq('idadmon', idadmon).maybeSingle()

  const { data: casos } = await admin.from('cobranza_casos')
    .select('*').eq('idadmon', idadmon).order('fecha_apertura', { ascending: false })

  const { data: gestiones } = await admin.from('cobranza_gestiones')
    .select('*').eq('idadmon', idadmon).order('fecha', { ascending: false })

  const { data: plantillas } = await admin.from('cobranza_plantillas')
    .select('*').eq('activa', true).order('orden', { ascending: true })

  const caso = (casos || []).find(c => c.estado !== 'cerrado') || (casos || [])[0] || null

  return Response.json({
    ok: true,
    contrato: contrato || null,
    caso,
    casos: casos || [],
    gestiones: gestiones || [],
    plantillas: plantillas || [],
  })
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const g = guard(session)
  if (g) return Response.json({ error: g.msg }, { status: g.code })
  const email = session.user.email

  let b
  try { b = await req.json() } catch { return Response.json({ error: 'JSON invalido' }, { status: 400 }) }

  const {
    idadmon, tipo = 'vigente', destinatario, canal, etapa, asunto, contenido,
    resultado, monto_reclamado, acuse, plantilla_id,
    destinatario_rut, destinatario_nombre, monto_adeudado, dias_mora, contrato = {},
  } = b || {}

  if (!idadmon || !destinatario || !canal || !contenido) {
    return Response.json({ error: 'Faltan campos: idadmon, destinatario, canal, contenido' }, { status: 400 })
  }

  // 1) caso abierto del idadmon+tipo; si no existe, se crea
  const { data: abiertos } = await admin.from('cobranza_casos')
    .select('*').eq('idadmon', idadmon).eq('tipo', tipo).neq('estado', 'cerrado').limit(1)
  let caso = abiertos && abiertos[0]
  if (!caso) {
    const { data: nuevo, error: e1 } = await admin.from('cobranza_casos').insert({
      idadmon, tipo,
      estado: (dias_mora && Number(dias_mora) > 30) ? 'mora_grave' : 'mora_leve',
      monto_adeudado: monto_adeudado || 0, dias_mora: dias_mora || 0,
      propietario: contrato.propietario || null, propiedad: contrato.inmueble || null,
      arrendatario: contrato.arrendatario || null, arrendatario_rut: contrato.rut || null,
      aval: contrato.avalista || null, aval_rut: contrato.rut_avalista || null,
      responsable: email, origen: 'manual',
    }).select().single()
    if (e1) return Response.json({ error: 'No se pudo crear el caso: ' + e1.message }, { status: 500 })
    caso = nuevo
  }

  // 2) gestion = constancia (append-only)
  const { data: gestion, error: e2 } = await admin.from('cobranza_gestiones').insert({
    caso_id: caso.id, idadmon, canal, destinatario,
    destinatario_rut: destinatario_rut || null, destinatario_nombre: destinatario_nombre || null,
    plantilla_id: plantilla_id || null, etapa: etapa || null, asunto: asunto || null,
    contenido_snapshot: contenido, acuse: acuse || null, resultado: resultado || 'enviado',
    monto_reclamado: monto_reclamado || null, usuario: email,
  }).select().single()
  if (e2) return Response.json({ error: 'No se pudo registrar la gestion: ' + e2.message }, { status: 500 })

  // 3) refrescar el caso (monto/dias/updated_at)
  await admin.from('cobranza_casos').update({
    monto_adeudado: (monto_adeudado ?? caso.monto_adeudado),
    dias_mora: (dias_mora ?? caso.dias_mora),
    updated_at: new Date().toISOString(),
  }).eq('id', caso.id)

  return Response.json({ ok: true, caso_id: caso.id, gestion })
}
