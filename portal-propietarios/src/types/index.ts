export interface SessionPayload {
  idprop: string
  email: string
  propietario: string
}

export const ESTADOS: Record<string, { label: string; color: string; bg: string }> = {
  S:  { label: 'Arrendado al día',              color: '#059669', bg: '#ECFDF5' },
  SQ: { label: 'Arrendado · aviso de término',  color: '#D97706', bg: '#FFFBEB' },
  Q:  { label: 'En proceso de término',         color: '#EA580C', bg: '#FFF7ED' },
  P:  { label: 'Vacante · pendiente arrendar',  color: '#DC2626', bg: '#FEF2F2' },
}
