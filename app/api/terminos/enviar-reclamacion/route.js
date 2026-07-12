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
  const { idadmon, to, cc, subject, cuerpo, forzar } = body || {}
  if (!idadmon || !to || !subject || !cuerpo) {
    return Response.json({ error: 'Faltan datos (idadmon, to, subject, cuerpo)' }, { status: 400 })
  }
  if (!/@/.test(String(to))) return Response.json({ error: 'Email destinatario no válido: ' + to }, { status: 400 })

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

  // cc = aval (del borrador, si lo hay) + administración@ (constancia interna), igual que enviar-email.
  const ccList = [String(cc || '').trim(), ADMIN_CC].filter(Boolean).join(', ')

  const r = await enviarNotificacion({ subject, to, cc: ccList, cuerpo, autor: email })
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
    detalle: `Reclamación a ${to}${cc ? ' (cc ' + cc + ')' : ''} · saldo $${saldo.toLocaleString('es-CL')}`,
  }])

  return Response.json({ ok: true, enviadoA: to, saldo, reenvio: esReenvio })
}
