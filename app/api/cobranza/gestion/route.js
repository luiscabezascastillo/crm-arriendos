// VERSION: v6 · 2026-08-24 · Compositor de email por DEPARTAMENTO (Cobranzas/Legal).
//   - `from` segun departamento (alias de info@: cobranza@ / legal@; override por env EMAIL_COBRANZA/EMAIL_LEGAL).
//   - MODO PRUEBA (test:true): manda [PRUEBA] solo a `toTest` (o al que envia), con adjuntos, SIN dejar constancia.
//   - MULTIDESTINATARIO: `destinos`=[{party,email}] (arrendatario/aval/propietario). Se envia UN correo (to=todos)
//     y se registra UNA constancia POR PARTE (para que la escalera/semaforo marquen a cada uno).
//   - CC / CCO: copias visibles y ocultas. Si cco_propietario -> el propietario va en CCO y se registra su constancia
//     (resultado 'cco'), para demostrar diligencia al dueno. BCC de archivo a info@ siempre.
//   - ADJUNTOS: `adjuntos`=[{path,nombre}] alojados en el bucket privado 'cobranza-adjuntos'; se descargan e
//     INCRUSTAN en el correo (viajan con el, el receptor los abre aunque el bucket sea privado).
//   Hereda v5/v4/v3/v2/v1 (GET idadmon/log/resumen/casos, POST sync_terminos, caso append-only).
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
const BUCKET_ADJ = 'cobranza-adjuntos'

// Remitente por departamento. Son alias de info@ (Google Workspace), asi que salen con la MISMA
// contraseña de aplicacion; solo cambia el From/replyTo. Se pueden sobreescribir por variable de entorno.
const EMAIL_COBRANZA = process.env.EMAIL_COBRANZA || 'cobranza@fondocapital.com'
const EMAIL_LEGAL = process.env.EMAIL_LEGAL || 'legal@fondocapital.com'
const DEPT = {
  cobranza: { from: `"Fondo Capital · Cobranzas" <${EMAIL_COBRANZA}>`, replyTo: EMAIL_COBRANZA },
  legal:    { from: `"Fondo Capital · Area Legal" <${EMAIL_LEGAL}>`, replyTo: EMAIL_LEGAL },
}
const deptOf = (d) => (d === 'legal' ? 'legal' : 'cobranza')

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

// Descarga los adjuntos del bucket privado y los devuelve como attachments Nodemailer ({filename, content}).
async function construirAdjuntos(adjuntos) {
  if (!Array.isArray(adjuntos) || !adjuntos.length) return []
  const out = []
  for (const a of adjuntos) {
    if (!a || !a.path) continue
    const { data, error } = await admin.storage.from(BUCKET_ADJ).download(a.path)
    if (error || !data) continue
    const buf = Buffer.from(await data.arrayBuffer())
    const nombre = String(a.nombre || 'adjunto').replace(/[^\w.\- ]/g, '').trim() || 'adjunto'
    out.push({ filename: nombre, content: buf })
  }
  return out
}

function datosParte(party, contrato) {
  if (party === 'aval') return { nombre: contrato.avalista || null, rut: contrato.rut_avalista || null }
  if (party === 'propietario') return { nombre: contrato.propietario || null, rut: null }
  return { nombre: contrato.arrendatario || null, rut: contrato.rut || null }
}

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

  // Accion: abrir casos de cobranza para todos los terminos con deficit (idempotente).
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
    idadmon, tipo = 'vigente', departamento = 'cobranza', canal = 'email',
    destinos = [], asunto, contenido, etapa, plantilla_id,
    cc = '', cco = '', cco_propietario = false, propietario_email = '',
    resultado, monto_reclamado, acuse, adjuntos = [],
    monto_adeudado, dias_mora, contrato = {},
    enviar = false, test = false, toTest = '',
  } = b || {}

  const dept = deptOf(departamento)
  const remit = DEPT[dept]

  // ── MODO PRUEBA: solo al que prueba, con adjuntos, sin constancia ni caso. ──
  if (test) {
    const toFinal = (toTest && /@/.test(String(toTest))) ? String(toTest).trim() : email
    if (!/@/.test(toFinal)) return Response.json({ error: 'Correo de prueba no valido: ' + toFinal }, { status: 400 })
    try {
      const attachments = await construirAdjuntos(adjuntos)
      await transporter.sendMail({
        from: remit.from, replyTo: remit.replyTo, to: toFinal,
        subject: '[PRUEBA] ' + (asunto || 'Comunicacion — Fondo Capital'),
        html: textoAHtml(contenido || ''), attachments,
      })
      return Response.json({ ok: true, test: true, enviadoA: toFinal, adjuntos: attachments.length })
    } catch (err) {
      return Response.json({ error: 'No se pudo enviar la prueba: ' + ((err && err.message) || 'error') }, { status: 502 })
    }
  }

  if (!idadmon || !contenido) {
    return Response.json({ error: 'Faltan campos: idadmon, contenido' }, { status: 400 })
  }

  // Partes a las que se dirige (constancia por cada una). Copia oculta al propietario = tambien constancia.
  const partes = []
  for (const d of (destinos || [])) {
    if (d && d.party) partes.push({ party: d.party, email: (d.email || '').trim(), viaCco: false })
  }
  if (cco_propietario) partes.push({ party: 'propietario', email: String(propietario_email || '').trim(), viaCco: true })
  if (!partes.length) return Response.json({ error: 'Elige al menos un destinatario' }, { status: 400 })

  const vaAEnviar = enviar && canal === 'email'
  let acuseFinal = acuse || null
  let resultadoBase = resultado || (vaAEnviar ? 'enviado' : 'registrado')

  // ── Envio real (una sola vez) ──
  if (vaAEnviar) {
    const toList = partes.filter(p => !p.viaCco).map(p => p.email).filter(e => /@/.test(e))
    const ccList = splitEmails(cc)
    if (!toList.length && !ccList.length) {
      return Response.json({ error: 'No hay email de destino (To/CC) para enviar' }, { status: 400 })
    }
    const bccList = [BCC_ARCHIVO, ...splitEmails(cco)]
    if (cco_propietario && /@/.test(String(propietario_email))) bccList.push(String(propietario_email).trim())
    try {
      const attachments = await construirAdjuntos(adjuntos)
      const infoMail = await transporter.sendMail({
        from: remit.from, replyTo: remit.replyTo,
        to: toList.join(', ') || undefined,
        cc: ccList.length ? ccList.join(', ') : undefined,
        bcc: bccList.join(', '),
        subject: asunto || 'Comunicacion — Fondo Capital',
        html: textoAHtml(contenido), attachments,
      })
      const accepted = ((infoMail && infoMail.accepted) || []).map(norm)
      const okDest = toList.concat(ccList).some(d => accepted.includes(norm(d)))
      if (!okDest) {
        return Response.json({ error: 'Gmail no acepto el destinatario (' + (infoMail?.response || 's/r') + ')' }, { status: 502 })
      }
      acuseFinal = 'email · dep=' + dept + ' · msgId=' + (infoMail.messageId || '') + ' · smtp=' + (infoMail.response || '')
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

  // 2) constancia (append-only) — UNA por parte
  const adjMeta = Array.isArray(adjuntos) ? adjuntos.map(a => ({ path: a.path, nombre: a.nombre })) : []
  const filas = []
  for (const p of partes) {
    const dd = datosParte(p.party, contrato)
    filas.push({
      caso_id: caso.id, idadmon, canal,
      departamento: dept, remitente: remit.replyTo,
      destinatario: p.party, destino_email: p.email || null,
      destinatario_rut: dd.rut, destinatario_nombre: dd.nombre,
      cc: cc || null, cco: cco || (p.viaCco ? p.email : null) || null,
      plantilla_id: plantilla_id || null, etapa: etapa || null, asunto: asunto || null,
      contenido_snapshot: contenido, adjuntos: adjMeta.length ? adjMeta : null,
      acuse: acuseFinal, resultado: p.viaCco ? 'cco' : resultadoBase,
      monto_reclamado: monto_reclamado || null, usuario: email,
    })
  }
  const { data: gestion, error: e2 } = await admin.from('cobranza_gestiones').insert(filas).select()
  if (e2) return Response.json({ error: 'No se pudo registrar la gestion: ' + e2.message }, { status: 500 })

  // 3) refrescar el caso
  await admin.from('cobranza_casos').update({
    monto_adeudado: (monto_adeudado ?? caso.monto_adeudado),
    dias_mora: (dias_mora ?? caso.dias_mora),
    updated_at: new Date().toISOString(),
  }).eq('id', caso.id)

  return Response.json({ ok: true, caso_id: caso.id, gestiones: gestion, enviado: vaAEnviar })
}
