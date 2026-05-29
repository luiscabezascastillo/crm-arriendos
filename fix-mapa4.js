const fs = require('fs');
const file = 'app/publicaciones/page.js';
let c = fs.readFileSync(file, 'utf8');

// Buscar donde está el renderizado de tarjetas y añadir mapa antes
const i = c.indexOf("vista === 'tarjetas'");
if (i === -1) { console.log('no encontrado tarjetas'); process.exit(1); }

// Buscar el { antes de vista === 'tarjetas'
const before = c.lastIndexOf('{', i);
const insert = "\r\n      {vista === 'mapa' && <MapaPublicaciones pubs={pubsMapa} />}\r\n\r\n      ";
c = c.slice(0, before) + insert + c.slice(before);

fs.writeFileSync(file, c, 'utf8');
console.log('done:', c.includes("vista === 'mapa' && <MapaPublicaciones"));