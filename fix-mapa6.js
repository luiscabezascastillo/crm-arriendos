const fs = require('fs');
const file = 'app/publicaciones/page.js';
let lines = fs.readFileSync(file, 'utf8').split('\n');

// Insertar loadMapa antes de la línea 166 (índice 165)
const loadMapaFn = [
  "  async function loadMapa() {\r",
  "    let query = supabase\r",
  "      .from('publicaciones')\r",
  "      .select('id, codigo, direccion, comuna, objetivo, tipo, tipo_moneda, valor, latitud, longitud')\r",
  "      .not('latitud', 'is', null)\r",
  "      .neq('latitud', '')\r",
  "    if (modo === 'activas') query = query.eq('activo', 'SI')\r",
  "    const { data } = await query\r",
  "    setPubsMapa(data || [])\r",
  "  }\r",
  "\r"
];

lines.splice(165, 0, ...loadMapaFn);
fs.writeFileSync(file, lines.join('\n'), 'utf8');
console.log('done:', lines.some(l => l.includes('async function loadMapa')));