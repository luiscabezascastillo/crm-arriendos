// VERSION: v1 · 2026-08-27 · Recordatorio de servicios (GGCC/luz/agua/gas). GET ?idadmon → contactos del contrato.
//   POST 'enviar' → email suave desde cobranza@, con CC (aval u otros), copia oculta a info@ y administración@,
//   y constancia en cobranza_gestiones (etapa 'recordatorio_servicios'). Pruebas: solo a quien envía, sin constancia.
// Ruta real: app/api/cobranza/servicios/route.js
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

export const runtime = 'nodejs'
export const maxDuration = 60

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const PUEDEN_VER = ['direccion', 'administracion', 'finanzas', 'legal']
const BCC_ARCHIVO = 'info@fondocapital.com'
const ADMIN_COPIA = 'administracion@fondocapital.com'
const EMAIL_COBRANZA = process.env.EMAIL_COBRANZA || 'cobranza@fondocapital.com'
const REMIT = { from: `"Fondo Capital · Cobranzas" <${EMAIL_COBRANZA}>`, replyTo: EMAIL_COBRANZA }
const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } })
const escapeHtml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const textoAHtml = (t) => '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;line-height:1.6">' + escapeHtml(t).replace(/\n/g, '<br>') + '</div>'
const parseCC = (v) => { const arr = Array.isArray(v) ? v : String(v || '').split(/[,;\s]+/); const seen = new Set(), out = []; for (const e of arr) { const s = String(e || '').trim().toLowerCase(); if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) && !seen.has(s)) { seen.add(s); out.push(s) } } return out }

async function asegurarCaso(idadmon, contrato, email) {
  const { data: ab } = await admin.from('cobranza_casos').select('id').eq('idadmon', idadmon).eq('tipo', 'vigente').neq('estado', 'cerrado').limit(1)
  if (ab && ab[0]) return ab[0].id
  const { data: nuevo, error } = await admin.from('cobranza_casos').insert({
    idadmon, tipo: 'vigente', estado: 'mora_leve', monto_adeudado: 0, dias_mora: 0,
    propietario: contrato.propietario || null, propiedad: contrato.inmueble || null,
    arrendatario: contrato.arrendatario || null, arrendatario_rut: contrato.rut || null,
    responsable: email, origen: 'auto_mora',
  }).select('id').single()
  if (error) throw new Error('No se pudo crear el caso: ' + error.message)
  return nuevo.id
}

export async function GET(req) {
  const session = await getServerSession(authOptions)
  const rol = session?.user?.role
  if (!session?.user?.email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!PUEDEN_VER.includes(rol)) return Response.json({ error: 'No autorizado' }, { status: 403 })
  const idadmon = (new URL(req.url).searchParams.get('idadmon') || '').trim().toUpperCase()
  if (!idadmon) return Response.json({ error: 'Falta idadmon' }, { status: 400 })
  const { data } = await admin.from('datos_arriendos').select('idadmon, arrendatario, rut, mail_arrendatario, avalista, mail_avalista, inmueble, propietario').eq('idadmon', idadmon).limit(1)
  const c = (data && data[0]) || {}
  return Response.json({ ok: true, idadmon, arrendatario: c.arrendatario || '', mail_arrendatario: c.mail_arrendatario || '', avalista: c.avalista || '', mail_avalista: c.mail_avalista || '', inmueble: c.inmueble || '', propietario: c.propietario || '' })
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  const rol = session?.user?.role
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!PUEDEN_VER.includes(rol)) return Response.json({ error: 'No autorizado' }, { status: 403 })
  let body; try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  if (String(body.accion || '') !== 'enviar') return Response.json({ error: 'Acción no reconocida' }, { status: 400 })
  const idadmon = String(body.idadmon || '').trim().toUpperCase()
  const asunto = String(body.asunto || '').trim()
  const contenido = String(body.contenido || '').trim()
  const destino = String(body.destino_email || '').trim()
  const test = body.test === true
  if (!idadmon) return Response.json({ error: 'Falta idadmon' }, { status: 400 })
  if (!asunto || !contenido) return Response.json({ error: 'Falta asunto o contenido.' }, { status: 400 })
  if (!test && !destino) return Response.json({ error: 'No hay email del arrendatario; edítalo antes de enviar.' }, { status: 400 })
  const html = textoAHtml(contenido)
  try {
    if (test) {
      await transporter.sendMail({ from: REMIT.from, replyTo: REMIT.replyTo, to: email, subject: '[PRUEBA] ' + asunto, html })
      return Response.json({ ok: true, test: true })
    }
    const ccList = parseCC(body.cc)
    const info = await transporter.sendMail({ from: REMIT.from, replyTo: REMIT.replyTo, to: destino, cc: ccList.length ? ccList : undefined, bcc: [BCC_ARCHIVO, ADMIN_COPIA], subject: asunto, html })
    if (!info || info.rejected?.length) return Response.json({ error: 'Gmail no aceptó el destinatario (' + (info?.response || 's/r') + ')' }, { status: 502 })
    const { data: arr } = await admin.from('datos_arriendos').select('idadmon, arrendatario, rut, inmueble, propietario').eq('idadmon', idadmon).limit(1)
    const contrato = (arr && arr[0]) || {}
    const caso_id = await asegurarCaso(idadmon, contrato, email)
    await admin.from('cobranza_gestiones').insert({
      caso_id, idadmon, canal: 'email', departamento: 'cobranza', remitente: REMIT.replyTo,
      destinatario: 'arrendatario', destino_email: destino, destinatario_rut: contrato.rut || null, destinatario_nombre: contrato.arrendatario || null,
      etapa: 'recordatorio_servicios', asunto, contenido_snapshot: contenido, acuse: info?.messageId || 'ok', resultado: 'enviado',
      monto_reclamado: body.monto || null, usuario: email,
    })
    return Response.json({ ok: true })
  } catch (e) { return Response.json({ error: String(e.message || e) }, { status: 500 }) }
}
