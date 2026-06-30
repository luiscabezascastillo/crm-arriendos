// lib/descuentosPermisos.js
// Capacidades del proceso "descuentos" en el CRM.
//
// Dos fuentes (igual patrón que lib/cc1Permisos.js):
//   1) Dirección por hardcode de email (acceso total). Solo Luis y Alberto.
//   2) El resto por su rol en proceso_permisos (proceso = 'descuentos').
//
// IMPORTANTE — excepción documentada:
//   Adalis figura como 'responsable' SOLO para que la tarjeta del proceso
//   la siga mostrando como "Encargada". Pero en DESCUENTOS un responsable que
//   NO es Dirección puede ÚNICAMENTE crear (no corrige ni verifica).
//   Por eso aquí NO deducimos "todo" del rol responsable: el "todo" lo da
//   exclusivamente la lista DIRECCION. Si en el futuro se quiere que algún
//   responsable corrija, súbelo a 'supervisor' o añádelo a DIRECCION.

const DIRECCION = [
  'luis.cabezas@fondocapital.com',
  'alberto.cabezas@fondocapital.com',
];

// Capacidades por rol de proceso_permisos (para quien NO es Dirección).
//   crear     -> dar de alta filas nuevas
//   corregir  -> editar filas existentes
//   verificar -> marcar como verificado (visto bueno)
const CAPS_POR_ROL = {
  responsable: { crear: true,  corregir: false, verificar: false }, // Adalis (no-Dirección)
  supervisor:  { crear: true,  corregir: true,  verificar: true  }, // Karina
  colaborador: { crear: true,  corregir: false, verificar: false }, // Fabiola
  observador:  { crear: false, corregir: false, verificar: false },
};

const SIN_ACCESO = { crear: false, corregir: false, verificar: false };
const TODO       = { crear: true,  corregir: true,  verificar: true  };

function norm(email) {
  return (email || '').trim().toLowerCase();
}

export function esDireccion(email) {
  return DIRECCION.includes(norm(email));
}

// Devuelve { crear, corregir, verificar } para un email + su rol en proceso_permisos.
// `rol` puede venir null (sin fila) => sin acceso, salvo Dirección.
export function capacidadesDescuentos(email, rol) {
  if (esDireccion(email)) return { ...TODO };
  const caps = CAPS_POR_ROL[(rol || '').toLowerCase()];
  return caps ? { ...caps } : { ...SIN_ACCESO };
}

// Nombre legible para guardar en `ingresado_por` (mayúsculas, como el Excel).
// Toma la parte antes del @, antes del primer punto. adalis@ -> ADALIS,
// karina.morales@ -> KARINA, fabiola.guerra@ -> FABIOLA.
export function nombreCorto(email) {
  const local = norm(email).split('@')[0] || '';
  const primero = local.split('.')[0] || local;
  return primero.toUpperCase();
}

export const TIPOS = [
  'ARREGLOS', 'CORRETAJES', 'COSTES-CC2', 'DESCUENTO', 'DEVOLUCIONES',
  'GARANTIAS', 'LIMPIEZAS', 'MULTAS', 'NOTARIOS', 'SEGUROS', 'SERVICIOS', 'TERMINO',
];

export const REPERCUTIR_A = [
  'PROPIETARIO', 'ARRENDATARIO', 'T-CON SALDO-FCR', 'T-SIN SALDO-FCR',
  'T-CON SALDO-DUEÑO', 'T-SIN SALDO-DUEÑO', 'ARREGLO-EXTERNO', 'FCR',
];
