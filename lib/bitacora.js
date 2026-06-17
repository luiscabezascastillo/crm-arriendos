import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * Registra un evento en la bitácora de una publicación.
 * Nunca lanza error: si falla, solo lo loguea (la bitácora no debe romper el flujo principal).
 *
 * @param {Object} params
 * @param {number|string} params.idpublicacion - id de la publicación
 * @param {string} [params.codigo] - código interno (ej. "16912")
 * @param {string} params.evento - tipo corto (ej. "publicar_pi", "cerrar_pi", "republicar")
 * @param {string} [params.detalle] - texto descriptivo del evento
 * @param {string} [params.usuario] - email de quien hace la acción
 */
export async function registrarBitacora({ idpublicacion, codigo, evento, detalle, usuario }) {
  try {
    if (!evento) return
    await supabase.from('bitacora').insert({
      idpublicacion: idpublicacion ? Number(idpublicacion) : null,
      codigo: codigo ? String(codigo) : null,
      evento: String(evento),
      detalle: detalle ? String(detalle) : null,
      usuario: usuario ? String(usuario) : null,
    })
  } catch (e) {
    // No propagar: la bitácora es secundaria
    console.error('[bitacora] error al registrar evento:', e?.message || e)
  }
}