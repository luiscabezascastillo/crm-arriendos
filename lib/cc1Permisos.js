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
    // Editar/guardar datos del contrato: responsable/Dirección siempre; colaborador
    // (Colaborador de Inicio) también (el formulario lo limita a estado P).
    puedeEditar:        esResponsable || rol === 'colaborador',
    // Facturar (P→S): SOLO responsable/Dirección. Un supervisor (Colaborador de
    // Término) NO puede facturar aunque pueda cambiar otros estados.
    puedeFacturar:      esResponsable,
  }
}

// ── Reglas por transición de estado ──
// P→S y Q→N/N-DICOM: solo responsable (Anthony + Dirección).
// S→SQ, S→Q, SQ→Q: responsable o supervisor (Anthony, Adalis, Fabiola).
// colaborador/observador: ninguna.
//
// Devuelve true si las capacidades `cap` permiten ir de estadoAnterior a estadoNuevo.
export function puedeTransicion(cap, estadoAnterior, estadoNuevo) {
  if (!cap || !cap.puedeCambiarEstado) return false
  const esResponsable = cap.esDireccion || cap.rol === 'responsable' || cap.rol === 'direccion'
  const norm = (s) => String(s || '').trim().toUpperCase().replace('N_DICOM', 'N-DICOM').replace('N DICOM', 'N-DICOM')
  const de = norm(estadoAnterior)
  const a = norm(estadoNuevo)

  // Transiciones exclusivas de responsable
  const soloResponsable = (
    (de === 'P' && a === 'S') ||                       // validar inicio
    (de === 'Q' && (a === 'N' || a === 'N-DICOM'))     // cierre
  )
  if (soloResponsable) return esResponsable

  // Transiciones de término (responsable o supervisor)
  const terminoCompartido = (
    (de === 'S' && (a === 'SQ' || a === 'Q')) ||
    (de === 'SQ' && a === 'Q')
  )
  if (terminoCompartido) return esResponsable || cap.rol === 'supervisor'

  // Cualquier otra transición no contemplada: solo responsable (conservador)
  return esResponsable
}

export { supabaseAdmin }