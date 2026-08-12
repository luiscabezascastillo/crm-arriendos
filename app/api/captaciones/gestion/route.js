// VERSION: v1 · 2026-08-12 · app/api/captaciones/gestion/route.js — Registra una gestión de captación y avanza el
//   estado + reprograma la próxima gestión (+45 días salvo captado/no_molestar). POST { captacion_id, canal,
//   plantilla, resultado, nota }. Gate: Dirección + Administración.
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin.js'

const AUTORIZADOS = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'adalis@fondocapital.com', 'fabiola.guerra@fondocapital.com']
// resultado → nuevo estado del pipeline
const ESTADO = {
  contactado: 'contactado', respondio: 'en_conversacion', interesado: 'interesado',
  agendada: 'valoracion_agendada', no_ahora: 'en_pausa', captado: 'captado', no_molestar: 'no_molestar',
}
const SIN_PROXIMA = new Set(['captado', 'no_molestar'])
const hoy = () => new Date().toISOString().slice(0, 10)
const enDias = d => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10) }

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!AUTORIZADOS.includes(email)) return Response.json({ error: 'Sin permiso.' }, { status: 403 })

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const { captacion_id, canal, plantilla, resultado, nota } = body || {}
  if (!captacion_id || !resultado) return Response.json({ error: 'Faltan captacion_id o resultado' }, { status: 400 })
  if (!ESTADO[resultado]) return Response.json({ error: 'resultado no válido' }, { status: 400 })

  const g = await supabaseAdmin.from('captacion_gestiones').insert({
    captacion_id, canal: canal || 'whatsapp', plantilla: plantilla || null, resultado, nota: nota || null, usuario: email,
  })
  if (g.error) return Response.json({ error: 'No se pudo registrar la gestión: ' + g.error.message }, { status: 500 })

  const patch = { estado: ESTADO[resultado], ultima_gestion: hoy(), updated_at: new Date().toISOString(), proxima_gestion: SIN_PROXIMA.has(resultado) ? null : enDias(45) }
  const up = await supabaseAdmin.from('captaciones').update(patch).eq('id', captacion_id)
  if (up.error) return Response.json({ error: 'Gestión guardada, pero no se pudo actualizar el estado: ' + up.error.message }, { status: 500 })

  return Response.json({ ok: true, estado: patch.estado, proxima_gestion: patch.proxima_gestion })
}
