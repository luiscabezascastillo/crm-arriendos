// VERSION: v2 · 2026-08-21 · Enruta cada visita al calendario de su comercial (tabla gcal_calendarios); respaldo GCAL_VISITAS_ID.
// VERSION: v1 · 2026-08-20 · POST { visita_id } -> sincroniza la visita con Google Calendar "FCR · Visitas".
//   Crea/edita el evento (guarda gcal_event_id) o lo borra si estado='cancelada'. Best-effort:
//   nunca rompe el flujo del CRM (errores de calendario devuelven 200 con ok:false).
import { createClient } from '@supabase/supabase-js'
import { upsertVisita, deleteVisita } from '@/lib/gcalVisitas'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

export async function POST(req) {
  let body
  try { body = await req.json() } catch { return Response.json({ error: 'JSON invalido' }, { status: 400 }) }
  const id = body?.visita_id
  if (!id) return Response.json({ error: 'Falta visita_id' }, { status: 400 })
  if (!process.env.GCAL_VISITAS_ID) return Response.json({ ok: false, skip: 'sin_calendario' })

  const { data: v, error } = await admin.from('visitas')
    .select('id, fecha, hora, cliente_nombre, comercial, estado, notas, gcal_event_id')
    .eq('id', id).single()
  if (error || !v) return Response.json({ error: 'Visita no encontrada' }, { status: 404 })

  // Calendario destino: uno por comercial (tabla gcal_calendarios). Respaldo: GCAL_VISITAS_ID.
  let calendarId = process.env.GCAL_VISITAS_ID || null
  try {
    if (v.comercial) {
      const { data: gc } = await admin.from('gcal_calendarios')
        .select('gcal_id').eq('comercial', v.comercial).eq('activo', true).limit(1)
      if (gc?.[0]?.gcal_id) calendarId = gc[0].gcal_id
    }
  } catch { /* si la tabla no existe aun, se usa el calendario por defecto */ }

  try {
    if (v.estado === 'cancelada') {
      if (v.gcal_event_id) {
        await deleteVisita(v.gcal_event_id, calendarId)
        await admin.from('visitas').update({ gcal_event_id: null }).eq('id', id)
      }
      return Response.json({ ok: true, accion: 'cancelada' })
    }

    // Direccion del inmueble (best-effort; si no se puede, el evento va sin ubicacion)
    let direccion
    try {
      const { data: vp } = await admin.from('visita_propiedades')
        .select('publicacion_id').eq('visita_id', id).order('orden', { ascending: true }).limit(1)
      const pubId = vp?.[0]?.publicacion_id
      if (pubId) {
        const { data: pub } = await admin.from('publicaciones')
          .select('direccionreal, direccion').eq('id', pubId).single()
        direccion = pub?.direccionreal || pub?.direccion || undefined
      }
    } catch { /* opcional */ }

    // Email del comercial (best-effort; solo se usa si GCAL_INVITAR=1)
    let comercialEmail
    try {
      if (v.comercial) {
        const { data: u } = await admin.from('crm_users').select('email').eq('nombre', v.comercial).limit(1)
        comercialEmail = u?.[0]?.email || undefined
      }
    } catch { /* opcional */ }

    const eventId = await upsertVisita(v, { direccion, comercialEmail, calendarId })
    if (eventId && eventId !== v.gcal_event_id) {
      await admin.from('visitas').update({ gcal_event_id: eventId }).eq('id', id)
    }
    return Response.json({ ok: true, accion: v.gcal_event_id ? 'update' : 'create', event_id: eventId })
  } catch (e) {
    return Response.json({ ok: false, error: String(e?.message || e) })
  }
}
