// lib/cc1Permisos.js
// Helper de permisos para el circuito de estados de CC1 (Gestión LOG / revision_log).
// El control se basa en proceso_permisos (key 'revision_log') + lista de Dirección.
//
// Capacidades por rol (sobre revision_log):
//   responsable  -> TODO: cambiar estado, alta directa, aprobar altas
//   supervisor   -> cambiar estado
//   colaborador  -> alta (queda pendiente_aprobacion) ; NO cambia estado
//   observador   -> solo ver
//   (Dirección)  -> TODO, igual que responsable
//
// Dirección se identifica por email (misma lista que el panel /direccion).

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export const DIRECCION = [
  'luis.cabezas@fondocapital.com',
  'alberto.cabezas@fondocapital.com',
]

// Devuelve { rol, esDireccion, puedeCambiarEstado, puedeAltaDirecta, puedeAltaPendiente, puedeAprobar }
export async function getCapacidades(email) {
  const e = (email || '').trim().toLowerCase()
  const esDireccion = DIRECCION.includes(e)

  // rol en revision_log (si hay varias filas, nos quedamos con la de mayor capacidad)
  let rol = null
  if (e) {
    const { data } = await supabaseAdmin
      .from('proceso_permisos')
      .select('rol')
      .eq('email', e)
      .eq('proceso', 'revision_log')
      .eq('activo', true)
    if (data && data.length) {
      const orden = { responsable: 4, supervisor: 3, colaborador: 2, observador: 1 }
      rol = data.map(r => r.rol).sort((a, b) => (orden[b] || 0) - (orden[a] || 0))[0]
    }
  }

  const esResponsable = esDireccion || rol === 'responsable'
  return {
    email: e,
    rol: esDireccion ? 'direccion' : rol,
    esDireccion,
    puedeCambiarEstado: esResponsable || rol === 'supervisor',
    puedeAltaDirecta:   esResponsable,
    puedeAltaPendiente: rol === 'colaborador',
    puedeAprobar:       esResponsable,
  }
}

export { supabaseAdmin }