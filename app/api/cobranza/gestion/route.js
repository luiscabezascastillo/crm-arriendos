// VERSION: v5 · 2026-08-10 · GET ?idadmon= ahora incluye datos de multa del contrato (multa_diaria, etc.)
//   para calcular multa/interés automático en la reclamación. Hereda v4/v3/v2/v1.
// VERSION: v4 · 2026-08-10 · Añade GET ?casos=1 (casos abiertos) y POST {accion:'sync_terminos'} que abre
//   automáticamente un caso de cobranza por cada término con déficit (vw_termino_resultado.resultado<0),
//   contra arrendatario + aval. Para el semáforo del propietario. Hereda v3/v2/v1.
// VERSION: v3 · 2026-08-10 · Añade GET ?resumen=1 (gestiones agregadas por idadmon: destinatarios/etapas/última)
//   para la escalera automática y la worklist. Hereda v2 (envío real por email) y v1 (constancia).
// VERSION: v2 · 2026-08-10 · Cobranza · gestiones (CONSTANCIA) + ENVÍO real por email.
//   GET ?idadmon=  -> contrato + caso abierto + gestiones + plantillas (para el panel).
//   GET ?log=1     -> últimas gestiones (Bitácora global).
//   POST           -> si {enviar:true, canal:'email'} manda el correo (nodemailer/Gmail, BCC info@,
//                     marca 'enviado' solo si Gmail acepta) y luego registra la gestión con el acuse real.
//                     Si no, solo registra la constancia (canal manual). Crea el caso si no existe.
// Ruta real: app/api/cobranza/gestion/route.js
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

export const runtime = 'nodejs'
export const maxDuration = 60

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const PUEDEN_VER = ['direccion', 'administracion', 'finanzas', 'legal']
const BCC_ARCHIVO = 'info@fondocapital.com'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
})

const norm = (s) => String(s || '').trim().toLowerCase()
const splitEmails = (s) => String(s || '').split(/[;,\s]+/).map(x => x.trim()).filter(Boolean)
const escapeHtml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const textoAHtml = (t) =>
  '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;line-height:1.6">' +
  escapeHtml(t).replace(/\n/g, '<br>') + '</div>'

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
  const resumen = url.searchParams.get('resumen')
  const casosFlag = url.searchParams.get('casos')

  if (casosFlag) {
    const { data, error } = await admin.from('cobranza_casos')
      .select('*').neq('estado', 'cerrado')
      .order('tipo', { ascending: true }).order('monto_adeudado', { ascending: false })
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true, casos: data || [] })
  }

  if (resumen) {
    // Agregación por idadmon: qué destinatarios/etapas ya se gestionaron (para la worklist/escalera).
    const { data, error } = await admin.from('cobranza_gestiones').select('idadmon, destinatario, etapa, fecha')
    if (error) return Response.json({ error: error.message }, { status: 500 })
    const map = {}
    for (const g of (data || [])) {
      const k = g.idadmon
      if (!map[k]) map[k] = { idadmon: k, n: 0, dest: {}, etapas: {}, ultima: null }
      map[k].n++
      if (g.destinatario) map[k].dest[g.destinatario] = true
      if (g.etapa) map[k].etapas[g.etapa] = true
      if (!map[k].ultima || (g.fecha && g.fecha > map[k].ultima)) map[k].ultima = g.fecha
    }
    const arr = Object.values(map).map(x => ({
      idadmon: x.idadmon, n: x.n, destinatarios: Object.keys(x.dest), etapas: Object.keys(x.etapas), ultima: x.ultima,
    }))
    return Response.json({ ok: true, resumen: arr })
  }

  if (log) {
    const { data, error } = await admin.from('cobranza_gestiones')
      .select('*').order('fecha', { ascending: false }).limit(200)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true, gestiones: data || [] })
  }

  if (!idadmon) return Response.json({ error: 'Falta idadmon' }, { status: 400 })

  const { data: contrato } = await admin.from('datos_arriendos')
    .select('idadmon, propietario, inmueble, estado, arrendatario, rut, mail_arrendatario, movil, avalista, rut_avalista, mail_avalista, telefono_avalista, multa_diaria, cantidad_aceleracion, tipo_aceleracion, media_retraso')
    .eq('idadmon', idadmon).maybeSingle()

  const { data: casos } = await admin.from('cobranza_casos')
    .select('*').eq('idadmon', idadmon).order('fecha_apertura', { ascending: false })

  const { data: gestiones } = await admin.from('cobranza_gestiones')
    .select('*').eq('idadmon', idadmon).order('fecha', { ascending: false })

  const { data: plantillas } = await admin.from('cobranza_plantillas')
    .select('*').eq('activa', true).order('orden', { ascending: true })

  const caso = (casos || []).find(c => c.estado !== 'cerrado') || (casos || [])[0] || null

  return Response.json({
    ok: true, contrato: contrato || null, caso, casos: casos || [],
    gestiones: gestiones || [], plantillas: plantillas || [],
  })
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const g = guard(session)
  if (g) return Response.json({ error: g.msg }, { status: g.code })
  const email = session.user.email

  let b
  try { b = await req.json() } catch { return Response.json({ error: 'JSON invalido' }, { status: 400 }) }

  // Acción: abrir casos de cobranza para todos los términos con déficit (idempotente).
  if (b && b.accion === 'sync_terminos') {
    const { data: vt, error: eVt } = await admin.from('vw_termino_resultado').select('idadmon, resultado').lt('resultado', 0)
    if (eVt) return Response.json({ error: 'vw_termino_resultado: ' + eVt.message }, { status: 500 })
    const { data: existentesT } = await admin.from('cobranza_casos')
      .select('idadmon').eq('tipo', 'termino').neq('estado', 'cerrado')
    const yaHay = new Set((existentesT || []).map(c => c.idadmon))
    let creados = 0
    for (const v of (vt || [])) {
      if (yaHay.has(v.idadmon)) continue
      const { data: c } = await admin.from('datos_arriendos')
        .select('propietario, inmueble, arrendatario, rut, avalista, rut_avalista').eq('idadmon', v.idadmon).maybeSingle()
      const { error: eIns } = await admin.from('cobranza_casos').insert({
        idadmon: v.idadmon, tipo: 'termino', estado: 'mora_grave',
        monto_adeudado: Math.abs(Number(v.resultado)) || 0, dias_mora: 0,
        propietario: c?.propietario || null, propiedad: c?.inmueble || null,
        arrendatario: c?.arrendatario || null, arrendatario_rut: c?.rut || null,
        aval: c?.avalista || null, aval_rut: c?.rut_avalista || null,
        responsable: email, origen: 'auto_termino',
      })
      if (!eIns) creados++
    }
    return Response.json({ ok: true, creados, total_deficit: (vt || []).length })
  }

  const {
    idadmon, tipo = 'vigente', destinatario, canal, etapa, asunto, contenido,
    resultado, monto_reclamado, acuse, plantilla_id,
    destinatario_rut, destinatario_nombre, monto_adeudado, dias_mora, contrato = {},
    enviar = false, email_destino = '',
  } = b || {}

  if (!idadmon || !destinatario || !canal || !contenido) {
    return Response.json({ error: 'Faltan campos: idadmon, destinatario, canal, contenido' }, { status: 400 })
  }

  // 0) Envío real (si corresponde). Si Gmail no acepta, no se registra nada (sin falsos "enviado").
  let acuseFinal = acuse || null
  let resultadoFinal = resultado || 'enviado'
  if (enviar && canal === 'email') {
    const dest = splitEmails(email_destino)
    if (!dest.length) return Response.json({ error: 'No hay email de destino para enviar' }, { status: 400 })
    try {
      const infoMail = await transporter.sendMail({
        from: `"Fondo Capital" <${process.env.GMAIL_USER}>`,
        to: dest.join(', '),
        bcc: BCC_ARCHIVO,
        subject: asunto || 'Comunicación — Fondo Capital',
        html: textoAHtml(contenido),
      })
      const accepted = ((infoMail && infoMail.accepted) || []).map(norm)
      const okDest = dest.some(d => accepted.includes(norm(d)))
      if (!okDest) {
        return Response.json({ error: 'Gmail no aceptó el destinatario (' + (infoMail?.response || 's/r') + ')' }, { status: 502 })
      }
      acuseFinal = 'email · msgId=' + (infoMail.messageId || '') + ' · smtp=' + (infoMail.response || '')
      resultadoFinal = 'enviado'
    } catch (err) {
      return Response.json({ error: 'Error enviando email: ' + ((err && err.message) || 'desconocido') }, { status: 502 })
    }
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

  // 2) gestión = constancia (append-only)
  const { data: gestion, error: e2 } = await admin.from('cobranza_gestiones').insert({
    caso_id: caso.id, idadmon, canal, destinatario,
    destinatario_rut: destinatario_rut || null, destinatario_nombre: destinatario_nombre || null,
    plantilla_id: plantilla_id || null, etapa: etapa || null, asunto: asunto || null,
    contenido_snapshot: contenido, acuse: acuseFinal, resultado: resultadoFinal,
    monto_reclamado: monto_reclamado || null, usuario: email,
  }).select().single()
  if (e2) return Response.json({ error: 'No se pudo registrar la gestion: ' + e2.message }, { status: 500 })

  // 3) refrescar el caso
  await admin.from('cobranza_casos').update({
    monto_adeudado: (monto_adeudado ?? caso.monto_adeudado),
    dias_mora: (dias_mora ?? caso.dias_mora),
    updated_at: new Date().toISOString(),
  }).eq('id', caso.id)

  return Response.json({ ok: true, caso_id: caso.id, gestion, enviado: (enviar && canal === 'email') })
}
