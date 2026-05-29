const fs = require('fs');
const file = 'app/publicaciones/page.js';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(
  "    if (modo === 'activas') query = query.eq('activo', 'SI')",
  "    if (modo === 'activas') query = query.eq('activo', 'active')"
);

fs.writeFileSync(file, c, 'utf8');
console.log('done:', c.includes("'active'"));