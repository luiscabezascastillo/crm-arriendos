const fs = require('fs');
const file = 'app/publicaciones/page.js';
let lines = fs.readFileSync(file, 'utf8').split('\n');

// Línea 443 (índice 442) es ") : vista === 'tabla' ? ("
// La reemplazamos para añadir el caso mapa
lines[442] = "        ) : vista === 'mapa' ? (\r\n          <MapaPublicaciones pubs={pubsMapa} />\r\n        ) : vista === 'tabla' ? (\r";

fs.writeFileSync(file, lines.join('\n'), 'utf8');
console.log('done:', lines[442].includes('MapaPublicaciones'));