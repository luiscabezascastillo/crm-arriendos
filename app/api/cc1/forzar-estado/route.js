// app/api/cc1/forzar-estado/route.js
// Fuerza el estado de un IDADMON a cualquier valor. SOLO Dirección (Luis y Alberto).
// UPDATE en crudo: NO dispara efectos del circuito (ni siguiente P, ni emails, ni workflow).
// Registra el forzado en historico_idadmon para trazabilidad.

import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const DIRECCION = ['luis.cabezas@fondocapital.com', 'alberto.cabezas@fondocapital.com']
const ESTADOS_VALIDOS = ['P', 'S', 'SQ', 'Q', 'N', 'N-DICOM', 'Inactiva']

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!DIRECCION.includes(email)) {
    return Response.json({ error: 'Solo Dirección (Luis o Alberto) puede forzar estados' }, { status: 403 })
  }

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const { idadmon, nuevoEstado, estadoAnterior } = body || {}
  if (!idadmon) return Response.json({ error: 'Falta idadmon' }, { status: 400 })
  if (!ESTADOS_VALIDOS.includes(nuevoEstado)) return Response.json({ error: 'Estado no válido' }, { status: 400 })

  // 1) UPDATE en crudo del estado (sin efectos secundarios)
  const { error: eUp } = await admin.from('datos_arriendos').update({ estado: nuevoEstado }).eq('idadmon', idadmon)
  if (eUp) return Response.json({ error: eUp.message }, { status: 500 })

  // 2) Registro en histórico (no bloquea el forzado si falla el insert)
  let avisoHist = null
  try {
    const { error: eHist } = await admin.from('historico_idadmon').insert({
      idadmon,
      evento: 'forzado',
      estado_anterior: estadoAnterior || null,
      estado_nuevo: nuevoEstado,
      usuario: email,
      fecha: new Date().toISOString(),
    })
    if (eHist) avisoHist = eHist.message
  } catch (e) { avisoHist = e?.message || 'no registrado' }

  return Response.json({ ok: true, idadmon, estado: nuevoEstado, aviso_historico: avisoHist })
}
