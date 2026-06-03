import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(req) {
  try {
    const body = await req.json()
    const { contacto_id, contacto_nombre, contacto_rut, contacto_email, contacto_tel, propiedades, comercial, comercial_email, notas } = body

    // Obtener siguiente número correlativo
    const { data: numData } = await supabase.rpc('nextval', { sequence_name: 'ov_numero_seq' })
    const numero = numData || 3000

    const { data, error } = await supabase.from('ordenes_visita').insert({
      numero,
      contacto_id,
      contacto_nombre,
      contacto_rut,
      contacto_email,
      contacto_tel,
      propiedades,
      comercial,
      comercial_email,
      estado: 'borrador',
      notas,
    }).select().single()

    if (error) return Response.json({ error: error.message }, { status: 500 })

    // Registrar en historial del contacto
    if (contacto_id) {
      await supabase.from('contactos_historial').insert({
        contacto_id,
        tipo: 'visita',
        descripcion: `Orden de Visita OV-${String(numero).padStart(4,'0')} generada con ${propiedades.length} propiedad(es)`,
        usuario: comercial,
      })
    }

    return Response.json({ ok: true, ov: data })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
