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
// P→S: solo responsable (validar inicio).
// S→SQ, S→Q, SQ→Q: responsable o supervisor (aviso / entrega de llaves).
// Q/N-Liquidación → N-DICOM: abrir reclamación → responsable o supervisor
//     (no es irreversible: de N-DICOM se puede volver a N).
// Q → N-Liquidación: cierre económico (liquidado, pendiente de cobro/pago)
//     → responsable o supervisor.
// *→N (cierre FINAL, acto irreversible): MAKER-CHECKER.
//     - responsable / Dirección: siempre.
//     - supervisor (p. ej. Karina): SOLO si el cierre NO es de alto riesgo, o si
//       consta autorización aprobada de Dirección para ese IDADMON.
// colaborador / observador: ninguna.
//
// ctx (OPCIONAL) lo aporta route.js, que conoce el IDADMON y sus cifras:
//   ctx.altoRiesgo -> true si el cierre pierde dinero por encima del umbral, condona
//                     deuda, o abandona una reclamación cobrable. Lo calcula route.js
//                     desde datos duros (terminos.perdida_garantia, deuda en cuentas),
//                     NUNCA lo declara quien ejecuta el cierre. Si NO llega el dato,
//                     se asume alto riesgo por seguridad (la puerta no se abre por
//                     falta de contexto).
//   ctx.autorizado -> true si existe una autorización aprobada por Dirección para ese
//                     IDADMON (con autorizador ≠ ejecutor; eso lo garantiza route.js).
//
// Devuelve true si las capacidades `cap` permiten ir de estadoAnterior a estadoNuevo.
export function puedeTransicion(cap, estadoAnterior, estadoNuevo, ctx = {}) {
  if (!cap || !cap.puedeCambiarEstado) return false
  const esResponsable = cap.esDireccion || cap.rol === 'responsable' || cap.rol === 'direccion'
  const esSupervisor = cap.rol === 'supervisor'
  const norm = (s) => String(s || '').trim().toUpperCase()
    .replace('N_DICOM', 'N-DICOM').replace('N DICOM', 'N-DICOM')
    .replace('N_LIQUIDACION', 'N-LIQUIDACION').replace('N LIQUIDACION', 'N-LIQUIDACION')
  const de = norm(estadoAnterior)
  const a = norm(estadoNuevo)

  // ── Cierre FINAL a N (irreversible): maker-checker ──
  // Desde cualquier origen (Q, N-Liquidación, N-DICOM). El gate va por DESTINO, no por
  // origen: así no se puede esquivar la firma pasando antes por N-DICOM.
  if (a === 'N') {
    if (esResponsable) return true
    if (!esSupervisor) return false
    const altoRiesgo = ctx.altoRiesgo !== false   // undefined o true => se trata como alto riesgo
    return !altoRiesgo || ctx.autorizado === true
  }

  // ── Cierre económico (N-Liquidación) y apertura de reclamación (N-DICOM) ──
  // No son irreversibles → responsable o supervisor, sin firma.
  if (a === 'N-LIQUIDACION' || a === 'N-DICOM') {
    return esResponsable || esSupervisor
  }

  // ── Validar inicio (P→S): solo responsable ──
  if (de === 'P' && a === 'S') return esResponsable

  // ── Aviso y entrega de llaves (responsable o supervisor) ──
  const terminoCompartido = (
    (de === 'S' && (a === 'SQ' || a === 'Q')) ||
    (de === 'SQ' && a === 'Q')
  )
  if (terminoCompartido) return esResponsable || esSupervisor

  // Cualquier otra transición no contemplada: solo responsable (conservador)
  return esResponsable
}

export { supabaseAdmin }