// VERSION: v1 · 2026-08-18 · Bitácora de cambios de estado de contratos (auditoría). Lee historico_idadmon con
//   service role. Dos modos: ?idadmon=A00874 (historial completo de un contrato, asc por created_at) o
//   ?dias=60 (cambios de estado recientes, desc). Enriquece con datos_arriendos (propietario/inmueble/estado actual).
//   Solo lectura. Ruta: app/api/bitacora-estados/route.js
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const COLS = 'id, idadmon, evento, estado_anterior, estado_nuevo, idadmon_origen, fecha, usuario, detalle, motivo_cierre, autorizado_por, created_at'

async function enriquecer(rows) {
  const ids = [...new Set((rows || []).map(r => r.idadmon).filter(Boolean))]
  const info = {}
  if (ids.length) {
    const { data } = await admin.from('datos_arriendos').select('idadmon, propietario, inmueble, estado').in('idadmon', ids)
    for (const d of (data || [])) info[d.idadmon] = d
  }
  return (rows || []).map(r => ({
    ...r,
    propietario: info[r.idadmon]?.propietario || '',
    inmueble: info[r.idadmon]?.inmueble || '',
    estado_actual: info[r.idadmon]?.estado || '',
    usuario_corto: String(r.usuario || '').split('@')[0],
    motivo: (r.motivo_cierre && String(r.motivo_cierre).trim()) ? r.motivo_cierre : (r.detalle || ''),
  }))
}

export async function GET(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const idadmon = String(searchParams.get('idadmon') || '').trim()

  try {
    if (idadmon) {
      // Historial COMPLETO de un contrato (todos los eventos), del primero al último.
      const { data, error } = await admin.from('historico_idadmon').select(COLS)
        .eq('idadmon', idadmon).order('created_at', { ascending: true })
      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json({ ok: true, modo: 'contrato', idadmon, eventos: await enriquecer(data) })
    }

    // Cambios de estado recientes (por fecha real de registro).
    const dias = Math.min(365, Math.max(1, Number(searchParams.get('dias')) || 60))
    const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await admin.from('historico_idadmon').select(COLS)
      .eq('evento', 'cambio_estado').gte('created_at', desde)
      .order('created_at', { ascending: false }).limit(1000)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true, modo: 'recientes', dias, eventos: await enriquecer(data) })
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 500 })
  }
}
