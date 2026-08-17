// VERSION: v1 · 2026-08-17 · Alta de correspondencia CF desde la pantalla /op/comunidad-feliz (fila "Nuevo").
//   Inserta/actualiza en `cf_correspondencias` el enlace comunidad_cf+inmueble_cf → idadmon/idinmue/estado/propietario.
//   Dedup por (comunidad_cf, inmueble_cf) con upsert (misma clave que usa /procesar al sembrar correspondencias).
//   NOTA seguridad: como el resto del circuito CF, este endpoint usa la service-role key y NO valida sesión/rol.
//   Cuando se cierre /op/* por rol, añadir aquí la comprobación de sesión. Ruta: app/api/comunidad-feliz/correspondencia/route.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

export async function POST(req) {
  let body
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }

  const comunidad_cf = String(body?.comunidad_cf || '').trim()
  const inmueble_cf = String(body?.inmueble_cf || '').trim()
  const idadmon = String(body?.idadmon || '').trim().toUpperCase()
  const idinmue = String(body?.idinmue || '').trim()
  const estado = String(body?.estado || '').trim().toUpperCase()
  const propietario = String(body?.propietario || '').trim()

  if (!comunidad_cf || !inmueble_cf) return Response.json({ error: 'Faltan comunidad/inmueble de Comunidad Feliz.' }, { status: 400 })
  if (!idadmon) return Response.json({ error: 'El IDADMON es obligatorio.' }, { status: 400 })
  if (!['S', 'P'].includes(estado)) return Response.json({ error: 'Estado inválido (debe ser S o P).' }, { status: 400 })

  const fila = { comunidad_cf, inmueble_cf, idadmon, idinmue: idinmue || null, estado, propietario: propietario || null, activo: true }

  const { data, error } = await supabase
    .from('cf_correspondencias')
    .upsert(fila, { onConflict: 'comunidad_cf,inmueble_cf' })
    .select('*')
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, correspondencia: data })
}
