// Fuente de verdad de comunas para el CRM.
// Cada comuna tiene: la grafia que se guarda/muestra (la clave), el id de ciudad de ML,
// y el state_id / state_name (region) que ML necesita para publicar en el Portal Inmobiliario.
// El Portal Inmobiliario usa estos IDs (no el texto), por eso la grafia de la clave es libre,
// pero debe coincidir con lo que se guarda en la columna `comuna` para encontrar el ID al republicar.

export const COMUNAS = {
  // --- Region Metropolitana ---
  'Las Condes':       { id: 'TUxDQ0xBUzU2MTEz', name: 'Las Condes',       state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'Providencia':      { id: 'TUxDQ1BST2NhYjU3', name: 'Providencia',      state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'Vitacura':         { id: 'TUxDQ1ZJVDM2MjFj', name: 'Vitacura',         state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'Santiago':         { id: 'TUxDQ1NBTjk4M2M',  name: 'Santiago',         state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'Ñuñoa':            { id: 'TUxDQ9FV0WU0MmM2', name: 'Ñuñoa',            state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'La Reina':         { id: 'TUxDQ0xBIDZlMWI5', name: 'La Reina',         state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'Lo Barnechea':     { id: 'TUxDQ0xPIGUzZDM3', name: 'Lo Barnechea',     state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'Huechuraba':       { id: 'TUxDQ0hVRTdmZjlm', name: 'Huechuraba',       state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'Macul':            { id: 'TUxDQ01BQ3VsNGI0', name: 'Macul',            state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'Independencia':    { id: 'TUxDQ0lORDIxMmU0', name: 'Independencia',    state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'Recoleta':         { id: 'TUxDQ1JFQzY4YjIw', name: 'Recoleta',         state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'Peñalolén':        { id: 'TUxDQ1BF0TRkNzFj', name: 'Peñalolén',        state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'La Florida':       { id: 'TUxDQ0xBIGM5NzMz', name: 'La Florida',       state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'Maipú':            { id: 'TUxDQ01BSWI5Y2M2', name: 'Maipú',            state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'Puente Alto':      { id: 'TUxDQ1BVRTZmOGZl', name: 'Puente Alto',      state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'San Miguel':       { id: 'TUxDQ1NBTjcwNDU0', name: 'San Miguel',       state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'San Bernardo':     { id: 'TUxDQ1NBTmIyZDBh', name: 'San Bernardo',     state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'Quilicura':        { id: 'TUxDQ1FVSTY5YTdl', name: 'Quilicura',        state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'Colina':           { id: 'TUxDQ0NPTGNkMWZj', name: 'Colina',           state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'Estación Central': { id: 'TUxDQ0VTVDY1ODUw', name: 'Estación Central', state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  'Pudahuel':         { id: 'TUxDQ1BVRDg4OWIx', name: 'Pudahuel',         state_id: 'CL-RM', state_name: 'RM (Metropolitana)' },
  // --- La Araucania ---
  'Curarrehue':       { id: 'TUxDQ0NVUjkwYzI4', name: 'Curarrehue',       state_id: 'TUxDUEFSQUE3YzVk', state_name: 'La Araucanía' },
  'Pucón':            { id: 'TUxDQ1BVQzU2NDFm', name: 'Pucón',            state_id: 'TUxDUEFSQUE3YzVk', state_name: 'La Araucanía' },
  'Villarrica':       { id: 'TUxDQ1ZJTGMyNWU3', name: 'Villarrica',       state_id: 'TUxDUEFSQUE3YzVk', state_name: 'La Araucanía' },
  // --- Antofagasta ---
  'Antofagasta':      { id: 'TUxDQ0FOVDc1YzM',  name: 'Antofagasta',      state_id: 'TUxDUEFOVEE3NWZk', state_name: 'Antofagasta' },
  // --- Los Lagos ---
  'Puerto Varas':     { id: 'TUxDQ1BVRTE5NDc3', name: 'Puerto Varas',     state_id: 'TUxDUExPU1NmYjk5', state_name: 'Los Lagos' },
  // --- Valparaiso ---
  'Valparaíso':       { id: 'TUxDQ1ZBTDk4ZTg',  name: 'Valparaíso',       state_id: 'TUxDUFZBTE84MDVj', state_name: 'Valparaíso' },
  'Viña del Mar':     { id: 'TUxDQ1ZJ0TkzYzA',  name: 'Viña del Mar',     state_id: 'TUxDUFZBTE84MDVj', state_name: 'Valparaíso' },
}

// Lista de nombres de comuna ordenada alfabeticamente, para el dropdown.
export const COMUNAS_LISTA = Object.keys(COMUNAS).sort((a, b) => a.localeCompare(b, 'es'))

// Dada una comuna (en cualquier grafia conocida), devuelve su region (state_name) o ''.
export function regionDeComuna(comuna) {
  const c = COMUNAS[comuna]
  return c ? c.state_name : ''
}