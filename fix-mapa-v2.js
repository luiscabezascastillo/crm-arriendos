const fs = require('fs');
const file = 'app/publicaciones/page.js';
let c = fs.readFileSync(file, 'utf8');

// 1. Añadir import del componente mapa (dynamic para evitar SSR)
c = c.replace(
  "'use client'\nimport { useState, useEffect } from 'react'",
  "'use client'\nimport { useState, useEffect } from 'react'\nimport dynamic from 'next/dynamic'\nconst MapaPublicaciones = dynamic(() => import('./MapaPublicaciones'), { ssr: false })"
);

// 2. Añadir estado pubsMapa
c = c.replace(
  "const [pubs, setPubs] = useState([])",
  "const [pubs, setPubs] = useState([])\n  const [pubsMapa, setPubsMapa] = useState([])"
);

// 3. Añadir función loadMapa y useEffect antes de loadKpis
const insertBefore = "  async function loadKpis() {";
const loadMapaCode = [
  "  async function loadMapa() {",
  "    let query = supabase",
  "      .from('publicaciones')",
  "      .select('id, codigo, direccion, comuna, objetivo, tipo, tipo_moneda, valor, latitud, longitud, dormitorios')",
  "      .eq('activo', 'active')",
  "      .not('latitud', 'is', null)",
  "      .neq('latitud', '')",
  "    if (filtroPortal) query = query.eq(filtroPortal, 'SI')",
  "    if (filtroObjetivo === 'arriendo') query = query.ilike('objetivo', '%arriendo%')",
  "    if (filtroObjetivo === 'venta') query = query.ilike('objetivo', '%venta%')",
  "    const { data } = await query",
  "    setPubsMapa(data || [])",
  "  }",
  "",
  "  useEffect(() => { if (vista === 'mapa') loadMapa() }, [vista, filtroPortal, filtroObjetivo])",
  "",
  "  async function loadKpis() {"
].join('\n');

c = c.replace(insertBefore, loadMapaCode);

// 4. Añadir botón Mapa en el toggle de vistas
// Buscar el patrón del botón tarjetas
const btnTarjetasOld = "\u229e Tarjetas</button>\r\n          </div>";
const btnTarjetasNew = "\u229e Tarjetas</button>\r\n              <button onClick={() => setVista('mapa')} style={{ padding:'6px 14px', border:'none', fontSize:11, fontWeight:500, cursor:'pointer', fontFamily:'inherit', background:vista==='mapa'?'#1a56db':'transparent', color:vista==='mapa'?'#fff':'var(--gray-500)' }}>\uD83D\uDDFA Mapa</button>\r\n          </div>";
c = c.replace(btnTarjetasOld, btnTarjetasNew);

// 5. Añadir renderizado del mapa en el ternario de vistas
c = c.replace(
  ") : vista === 'tabla' ? (\r\n",
  ") : vista === 'mapa' ? (\n          <MapaPublicaciones key={filtroPortal + '|' + filtroObjetivo + '|' + modo} pubs={pubsMapa} />\n        ) : vista === 'tabla' ? (\r\n"
);

fs.writeFileSync(file, c, 'utf8');

// Verificaciones
console.log('1. import dynamic:', c.includes('dynamic'));
console.log('2. pubsMapa:', c.includes('pubsMapa'));
console.log('3. loadMapa:', c.includes('loadMapa'));
console.log('4. btn mapa:', c.includes("'mapa'"));
console.log('5. render mapa:', c.includes('MapaPublicaciones key='));
