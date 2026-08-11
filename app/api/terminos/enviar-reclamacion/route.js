// VERSION: v3 · 2026-08-11 · ADJUNTOS: admite `adjuntos` = [{ url, nombre }] para adjuntar el PDF definitivo de la
//   liquidación del arrendatario a la reclamación. Se validan contra nuestro bucket público de Supabase (nodemailer
//   descarga el `path` en el servidor). Funciona también en modo PRUEBA. Hereda v2.
// VERSION: v2 · 2026-08-11 · MODO PRUEBA (test:true): manda la reclamación SOLO a `toTest` (o al que envía), con
//   "[PRUEBA]" en el asunto, sin abrir solicitud, sin histórico y sin comprobaciones — para verla sin enviar a nadie.
//   Además admite `bcc` (copia oculta/CCO) en el envío real. Hereda v1 (cc aval + administración@, solicitud, histórico).
// VERSION: v1 · 2026-07-12 · app/api/terminos/enviar-reclamacion/route.js
//   Envía la RECLAMACIÓN de saldo (ya editada por el usuario) al ex-arrendatario, cc al aval
//   (si existe) + administración@. Abre una fila en `solicitudes` (tipo='reclamacion', PENDIENTE)
//   y deja constancia en historico_idadmon. NO cambia el estado (reclamar ≠ DICOM).
//   Salvaguardas:
//     · Gate = igual que Enviar Email (participar en término; observador NO).
//     · Recalcula el saldo desde terminos.resultado_calculado (< 0). No confía en el body.
//     · Evita duplicar solicitud PENDIENTE. Para reenviar sin abrir otra: body { forzar: true }.

import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin.js'
import { enviarNotificacion } from '../../../../lib/cc1Email'

const DIRECCION = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com']
const ADMIN_CC = 'administracion@fondocapital.com'
const n0 = v => { const x = Number(v); return isNaN(x) ? 0 : x }

// Solo adjuntos alojados en NUESTRO bucket público de Supabase (los PDF que genera el propio CRM).
const STORAGE_PREFIX = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/+$/, '') + '/storage/v1/object/public/'
function construirAdjuntos(adjuntos) {
  if (!Array.isArray(adjuntos) || !adjuntos.length) return { list: null, error: null }
  const list = []
  for (const a of adjuntos) {
    const url = String(a?.url || a?.path || '').trim()
    if (!url) continue
    if (!/^https:\/\//i.test(url) || (STORAGE_PREFIX.length > 30 && !url.startsWith(STORAGE_PREFIX))) {
      return { list: null, error: 'Adjunto no permitido (debe ser un PDF generado por el CRM): ' + url }
    }
    const nombre = String(a?.nombre || a?.filename || 'documento.pdf').replace(/[^\w.\- ]/g, '').trim() || 'documento.pdf'
    list.push({ filename: /\.pdf$/i.test(nombre) ? nombre : nombre + '.pdf', path: url })
  }
  return { list: list.length ? list : null, error: null }
}
const fmtFecha = s => {
  if (!s) return '—'
  const m = String(s).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(s)
}

// Mismo gate que enviar-email: Dirección o quien PARTICIPE en un proceso de término
// (responsable/supervisor/colaborador). Observador NO. Los nodos de reclamación (N18/N21)
// involucran a Administración y Legal, por eso no se restringe solo a Karina.
async function puedeEnviar(email) {
  if (DIRECCION.includes(email)) return true
  const { data } = await supabaseAdmin
    .from('proceso_permisos').select('proceso, rol').eq('email', email).eq('activo', true)
  return (data || []).some(p =>
    (p.proceso || '').toLowerCase().includes('termino') &&
    ['responsable', 'supervisor', 'colaborador'].includes((p.rol || '').toLowerCase()))
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!(await puedeEnviar(email))) {
    return Response.json({ error: 'Sin permiso para reclamar (requiere participar en el proceso de término).' }, { status: 403 })
  }

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const { idadmon, to, cc, bcc, subject, cuerpo, forzar, test, toTest, adjuntos } = body || {}
  if (!idadmon || !subject || !cuerpo) {
    return Response.json({ error: 'Faltan datos (idadmon, subject, cuerpo)' }, { status: 400 })
  }
  const { list: attachments, error: advErr } = construirAdjuntos(adjuntos)
  if (advErr) return Response.json({ error: advErr }, { status: 400 })

  // MODO PRUEBA: solo a la dirección de prueba (o al que envía). No abre solicitud, no deja histórico, sin duplicados.
  if (test) {
    const toFinal = (toTest && /@/.test(String(toTest))) ? String(toTest).trim() : email
    if (!/@/.test(String(toFinal))) return Response.json({ error: 'Correo de prueba no válido: ' + toFinal }, { status: 400 })
    const rp = await enviarNotificacion({ subject: '[PRUEBA] ' + subject, to: toFinal, cuerpo, autor: email, attachments })
    if (!rp.ok) return Response.json({ error: 'No se pudo enviar la prueba: ' + (rp.error || 'error') }, { status: 500 })
    return Response.json({ ok: true, enviadoA: toFinal, test: true })
  }

  if (!to || !/@/.test(String(to))) return Response.json({ error: 'Email destinatario no válido: ' + (to || '') }, { status: 400 })

  // Recalcular el saldo desde la liquidación GUARDADA (autoridad; no confiar en el body).
  const { data: term } = await supabaseAdmin
    .from('terminos').select('resultado_calculado, tipo_resultado').eq('idadmon', idadmon).maybeSingle()
  if (!term || term.resultado_calculado === null || term.resultado_calculado === undefined) {
    return Response.json({ error: 'El término no tiene liquidación guardada; no se puede reclamar.' }, { status: 409 })
  }
  const resultado = n0(term.resultado_calculado)
  if (resultado >= 0) {
    return Response.json({ error: 'El término no tiene saldo a reclamar (resultado ≥ 0).' }, { status: 409 })
  }
  const saldo = Math.abs(resultado)

  // ¿Ya hay una reclamación PENDIENTE para este IDADMON? (no duplicar la solicitud)
  const { data: abiertas } = await supabaseAdmin
    .from('solicitudes').select('id, fecha_solicitud')
    .eq('tipo', 'reclamacion').eq('idadmon', idadmon).eq('estado', 'PENDIENTE')
    .order('fecha_solicitud', { ascending: false })
  const yaAbierta = (abiertas && abiertas[0]) || null
  if (yaAbierta && !forzar) {
    return Response.json({
      error: `Ya hay una reclamación abierta para ${idadmon} (del ${fmtFecha(yaAbierta.fecha_solicitud)}). Ciérrala en cobros, o reenvía si el arrendatario no la recibió.`,
      yaAbierta: true,
    }, { status: 409 })
  }

  // cc = aval + copias visibles (del borrador) + administración@ (constancia interna). bcc = copias ocultas (CCO).
  const ccList = [String(cc || '').trim(), ADMIN_CC].filter(Boolean).join(', ')
  const bccList = String(bcc || '').trim() || undefined

  const r = await enviarNotificacion({ subject, to, cc: ccList, bcc: bccList, cuerpo, autor: email, attachments })
  if (!r.ok) return Response.json({ error: 'No se pudo enviar: ' + (r.error || 'error desconocido') }, { status: 500 })

  const esReenvio = !!yaAbierta
  // Abrir la solicitud SOLO si es nueva (el reenvío reutiliza la abierta; no duplica).
  // ⚠ solicitudes.payload debe ser jsonb (se inserta un objeto).
  if (!esReenvio) {
    await supabaseAdmin.from('solicitudes').insert([{
      tipo: 'reclamacion', idadmon, estado: 'PENDIENTE',
      motivo: 'Saldo pendiente de término',
      payload: { saldo_reclamado: saldo, tipo_resultado: term.tipo_resultado || null },
      solicitado_por: email,
      fecha_solicitud: new Date().toISOString().slice(0, 10),
    }])
  }

  // Constancia en historico_idadmon (no es cambio de estado → estados en null).
  await supabaseAdmin.from('historico_idadmon').insert([{
    idadmon,
    evento: esReenvio ? 'reclamacion_reenviada' : 'reclamacion_enviada',
    estado_anterior: null, estado_nuevo: null,
    fecha: new Date().toISOString().slice(0, 10),
    usuario: email, email_subject: subject,
    detalle: `Reclamación a ${to}${cc ? ' (cc ' + cc + ')' : ''} · saldo $${saldo.toLocaleString('es-CL')}` + (attachments ? ' · ' + attachments.length + ' adjunto(s): ' + attachments.map(a => a.filename).join(', ') : ''),
  }])

  return Response.json({ ok: true, enviadoA: to, saldo, reenvio: esReenvio })
}
