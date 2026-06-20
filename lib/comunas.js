// Fuente de verdad de comunas para el CRM (publicaciones).
// Cada comuna tiene: la grafia que se guarda/muestra (la clave), el id de ciudad de ML,
// y el state_id / state_name (region) que ML necesita para publicar en el Portal Inmobiliario.
// IDs obtenidos de la API oficial de Mercado Libre (classified_locations).
// El Portal Inmobiliario usa estos IDs (no el texto), por eso la grafia de la clave es libre,
// pero debe coincidir con lo que se guarda en la columna `comuna` para encontrar el ID al republicar.

export const COMUNAS = {
  // --- RM (Metropolitana) ---
  'Alhué':                 { id: 'TUxDQ0FMSDY5ZGY1', name: 'Alhué', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'Buin':                  { id: 'TUxDQ0JVSTc4MWEw', name: 'Buin', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'Calera de Tango':       { id: 'TUxDQ0NBTDc5N2Rm', name: 'Calera de Tango', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'Cerrillos':             { id: 'TUxDQ0NFUjFjYjRk', name: 'Cerrillos', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'Cerro Navia':           { id: 'TUxDQ0NFUmQxZWJk', name: 'Cerro Navia', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'Colina':                { id: 'TUxDQ0NPTGNkMWZj', name: 'Colina', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'Conchalí':              { id: 'TUxDQ0NPTjFkMmI2', name: 'Conchalí', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'Curacaví':              { id: 'TUxDQ0NVUmFiMWU2', name: 'Curacaví', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'El Bosque':             { id: 'TUxDQ0VMIDU0OTE', name: 'El Bosque', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'El Monte':              { id: 'TUxDQ0VMWjYzYzc0', name: 'El Monte', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'Estación Central':      { id: 'TUxDQ0VTVDY1ODUw', name: 'Estación Central', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'Huechuraba':            { id: 'TUxDQ0hVRTdmZjlm', name: 'Huechuraba', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'Independencia':         { id: 'TUxDQ0lORDIxMmU0', name: 'Independencia', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'Isla de Maipo':         { id: 'TUxDQ0lTTDYwZGEy', name: 'Isla de Maipo', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'La Cisterna':           { id: 'TUxDQ0xBIGFhMjBk', name: 'La Cisterna', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'La Florida':            { id: 'TUxDQ0xBIGM5NzMz', name: 'La Florida', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'La Granja':             { id: 'TUxDQ0xBIGZjNGI', name: 'La Granja', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'La Pintana':            { id: 'TUxDQ0xBIDIxOWE1', name: 'La Pintana', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'La Reina':              { id: 'TUxDQ0xBIDZlMWI5', name: 'La Reina', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'Lampa':                 { id: 'TUxDQ0xBTTk2M2Rj', name: 'Lampa', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'Las Condes':            { id: 'TUxDQ0xBUzU2MTEz', name: 'Las Condes', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'Lo Barnechea':          { id: 'TUxDQ0xPIGUzZDM3', name: 'Lo Barnechea', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'Lo Espejo':             { id: 'TUxDQ0xPIDcwY2Ew', name: 'Lo Espejo', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'Lo Prado':              { id: 'TUxDQ0xPIGFkMzA4', name: 'Lo Prado', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'Macul':                 { id: 'TUxDQ01BQzY4NTYx', name: 'Macul', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'Maipú':                 { id: 'TUxDQ01BSWI5Y2M2', name: 'Maipú', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'María Pinto':           { id: 'TUxDQ01BUmE1MmIy', name: 'María Pinto', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'Melipilla':             { id: 'TUxDQ01FTGI4Yzli', name: 'Melipilla', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'Ñuñoa':                 { id: 'TUxDQ9FV0WU0MmM2', name: 'Ñuñoa', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'Padre Hurtado':         { id: 'TUxDQ1BBRDhkYzM1', name: 'Padre Hurtado', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'Paine':                 { id: 'TUxDQ1BBSWRiMWE5', name: 'Paine', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'Pedro Aguirre Cerda':   { id: 'TUxDQ1BFRGVjZDNm', name: 'Pedro Aguirre Cerda', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'Peñaflor':              { id: 'TUxDQ1BF0TkzM2Fh', name: 'Peñaflor', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'Peñalolén':             { id: 'TUxDQ1BF0TRkNzFj', name: 'Peñalolén', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'Pirque':                { id: 'TUxDQ1BJUmQ2MTQz', name: 'Pirque', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'Providencia':           { id: 'TUxDQ1BST2NhYjU3', name: 'Providencia', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'Pudahuel':              { id: 'TUxDQ1BVRDg4OWIx', name: 'Pudahuel', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'Puente Alto':           { id: 'TUxDQ1BVRTZmOGZl', name: 'Puente Alto', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'Quilicura':             { id: 'TUxDQ1FVSTY5YTdl', name: 'Quilicura', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'Quinta Normal':         { id: 'TUxDQ1FVSTlmODc0', name: 'Quinta Normal', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'Recoleta':              { id: 'TUxDQ1JFQzY4YjIw', name: 'Recoleta', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'Renca':                 { id: 'TUxDQ1JFTjI5MWQ0', name: 'Renca', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'San Bernardo':          { id: 'TUxDQ1NBTmIyZDBh', name: 'San Bernardo', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'San Joaquín':           { id: 'TUxDQ1NBTjk2NjA0', name: 'San Joaquín', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'San José de Maipo':     { id: 'TUxDQ1NBTjE3Y2Zh', name: 'San José de Maipo', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'San José de Melipilla': { id: 'TUxDQ1NBTmI2YzA1', name: 'San José de Melipilla', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'San Miguel':            { id: 'TUxDQ1NBTjcwNDU0', name: 'San Miguel', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'San Pedro':             { id: 'TUxDQ1NBTjgyMWE3', name: 'San Pedro', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'San Ramón':             { id: 'TUxDQ1NBTjk1ZmNj', name: 'San Ramón', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'Santiago':              { id: 'TUxDQ1NBTjk4M2M', name: 'Santiago', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'Talagante':             { id: 'TUxDQ1RBTDgxMDU1', name: 'Talagante', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'Tiltil':                { id: 'TUxDQ1RJTGUyOWI3', name: 'Tiltil', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  'Vitacura':              { id: 'TUxDQ1ZJVDM2MjFj', name: 'Vitacura', state_id: 'TUxDUE1FVEExM2JlYg', state_name: 'RM (Metropolitana)' },
  // --- Antofagasta ---
  'Antofagasta':           { id: 'TUxDQ0FOVDc1YzM', name: 'Antofagasta', state_id: 'TUxDUEFOVEE3NWZk', state_name: 'Antofagasta' },
  // --- La Araucanía ---
  'Curarrehue':            { id: 'TUxDQ0NVUjkwYzI4', name: 'Curarrehue', state_id: 'TUxDUEFSQUE3YzVk', state_name: 'La Araucanía' },
  'Pucón':                 { id: 'TUxDQ1BVQzU2NDFm', name: 'Pucón', state_id: 'TUxDUEFSQUE3YzVk', state_name: 'La Araucanía' },
  'Villarrica':            { id: 'TUxDQ1ZJTGMyNWU3', name: 'Villarrica', state_id: 'TUxDUEFSQUE3YzVk', state_name: 'La Araucanía' },
  // --- Los Lagos ---
  'Puerto Varas':          { id: 'TUxDQ1BVRTE5NDc3', name: 'Puerto Varas', state_id: 'TUxDUExPU1NmYjk5', state_name: 'Los Lagos' },
  // --- Valparaíso ---
  'Valparaíso':            { id: 'TUxDQ1ZBTDk4ZTg', name: 'Valparaíso', state_id: 'TUxDUFZBTE84MDVj', state_name: 'Valparaíso' },
  'Viña del Mar':          { id: 'TUxDQ1ZJ0TkzYzA', name: 'Viña del Mar', state_id: 'TUxDUFZBTE84MDVj', state_name: 'Valparaíso' },
}

// Lista de nombres de comuna ordenada alfabeticamente, para el dropdown.
export const COMUNAS_LISTA = Object.keys(COMUNAS).sort((a, b) => a.localeCompare(b, 'es'))

// Dada una comuna (en cualquier grafia conocida), devuelve su region (state_name) o ''.
export function regionDeComuna(comuna) {
  const c = COMUNAS[comuna]
  return c ? c.state_name : ''
}
