// VERSION: v3 · 2026-08-12 · app/api/captaciones/gestion/route.js — Separa CAPTADO de FACTURADO (captar ≠ facturar):
//   · resultado 'captado'  → estado 'captado'  + guarda negocio_tipo + valor_estimado (pipeline; aún $0 de comisión).
//   · resultado 'facturado' → estado 'facturado' + guarda negocio_tipo + negocio_monto (comisión real) + fecha_cierre.
//   Ambos salen del ciclo de +45 días. Hereda v2/v1 (registra la gestión y avanza el estado).
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin.js'

const AUTORIZADOS = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com']
// resultado → nuevo estado del pipeline
const ESTADO = {
  contactado: 'contactado', respondio: 'en_conversacion', interesado: 'interesado',
  agendada: 'valoracion_agendada', no_ahora: 'en_pausa',
  captado: 'captado', facturado: 'facturado', no_molestar: 'no_molestar',
}
const SIN_PROXIMA = new Set(['captado', 'facturado', 'no_molestar'])
const hoy = () => new Date().toISOString().slice(0, 10)
const enDias = d => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10) }
const aMonto = v => { const n = Number(String(v ?? '').replace(/[^\d.-]/g, '')); return isNaN(n) || n === 0 ? null : n }
const aTipo = v => { const t = String(v || '').toLowerCase(); return ['venta', 'arriendo'].includes(t) ? t : null }
const aFecha = v => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? v : hoy())

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!AUTORIZADOS.includes(email)) return Response.json({ error: 'Sin permiso.' }, { status: 403 })

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const { captacion_id, canal, plantilla, resultado, nota, negocio_tipo, negocio_monto, valor_estimado, fecha_cierre } = body || {}
  if (!captacion_id || !resultado) return Response.json({ error: 'Faltan captacion_id o resultado' }, { status: 400 })
  if (!ESTADO[resultado]) return Response.json({ error: 'resultado no válido' }, { status: 400 })

  const g = await supabaseAdmin.from('captacion_gestiones').insert({
    captacion_id, canal: canal || 'whatsapp', plantilla: plantilla || null, resultado, nota: nota || null, usuario: email,
  })
  if (g.error) return Response.json({ error: 'No se pudo registrar la gestión: ' + g.error.message }, { status: 500 })

  const patch = { estado: ESTADO[resultado], ultima_gestion: hoy(), updated_at: new Date().toISOString(), proxima_gestion: SIN_PROXIMA.has(resultado) ? null : enDias(45) }
  // Captado = mandato conseguido: tipo objetivo + valor estimado (pipeline). Sin comisión todavía.
  if (resultado === 'captado') {
    const t = aTipo(negocio_tipo); if (t) patch.negocio_tipo = t
    patch.valor_estimado = aMonto(valor_estimado)
  }
  // Facturado = operación cerrada: tipo final + comisión real + fecha de cierre.
  if (resultado === 'facturado') {
    const t = aTipo(negocio_tipo); if (t) patch.negocio_tipo = t
    patch.negocio_monto = aMonto(negocio_monto)
    patch.fecha_cierre = aFecha(fecha_cierre)
  }
  const up = await supabaseAdmin.from('captaciones').update(patch).eq('id', captacion_id)
  if (up.error) return Response.json({ error: 'Gestión guardada, pero no se pudo actualizar el estado: ' + up.error.message }, { status: 500 })

  return Response.json({
    ok: true, estado: patch.estado, proxima_gestion: patch.proxima_gestion,
    negocio_tipo: patch.negocio_tipo ?? null, negocio_monto: patch.negocio_monto ?? null,
    valor_estimado: patch.valor_estimado ?? null, fecha_cierre: patch.fecha_cierre ?? null,
  })
}
