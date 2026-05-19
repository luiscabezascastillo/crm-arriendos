export interface Propietario {
  idprop: string
  propietario: string
  nombre: string
  apellidos: string
  mail1: string
  telefono: string
  rut: string
  direccion: string
  comuna: string
  genero: string
  para_uso_futuro: string
}

export interface PortalUser {
  id: string
  idprop: string
  email: string
  activo: boolean
  debe_cambiar_password: boolean
  ultimo_acceso: string | null
}

export interface DatoArriendo {
  id: number
  idadmon: string
  estado: 'S' | 'SQ' | 'Q' | 'P'
  propietario: string
  idprop: string
  inmueble: string
  idlinmue: string
  tipo: string
  bodega: string
  estac: string
  sub_estado: string
  arrendatario: string
  mail_arrendatario: string
  cuota: number
  unid: string
  termino_actual: string | null
  fecha_inicio: string | null
}

export interface GgccAguaLuz {
  idadmon: string
  aamm: string
  arrendatario: string
  deuda_gastos_comunes: number | null
  deuda_vigente_electricidad: number | null
  deuda_vigente_agua: number | null
  deuda_vigente: number | null
  fecha_hecho_ggcc: string | null
  fecha_hecho_luz: string | null
  fecha_hecho_agua: string | null
}

export interface Cuentas {
  id: number
  idadmon: string
  fecha: string
  concepto: string
  cargo: number | null
  abono: number | null
  saldo: number | null
  calif: string | null
  propietario: string
  inmueble: string
}

export interface SessionPayload {
  idprop: string
  email: string
  propietario: string
}

export const ESTADOS: Record<string, { label: string; color: string; bg: string }> = {
  S:  { label: 'Arrendado al día',         color: '#059669', bg: '#ECFDF5' },
  SQ: { label: 'Arrendado · aviso término', color: '#D97706', bg: '#FFFBEB' },
  Q:  { label: 'En proceso de término',    color: '#EA580C', bg: '#FFF7ED' },
  P:  { label: 'Vacante · pendiente arrendar', color: '#DC2626', bg: '#FEF2F2' },
}
