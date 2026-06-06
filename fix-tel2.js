const fs = require('fs');
const file = 'app/contactos/page.js';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(
  /\/\[\\s\\-\(\)\.+\]\/g/g,
  '/[\\s\\-().+]/g'
);

// Más simple - reemplazar la regex problemática directamente
c = c.replace(
  "tel.replace(/[\\s\\-().+]/g, '')",
  "tel.replace(/[^0-9]/g, '')"
);
c = c.replace(
  "tel.replace(/[\\s\\-().+]/g, '')",
  "tel.replace(/[^0-9]/g, '')"
);
c = c.replace(
  "tel.replace(/[\\s\\-().]/g, '').replace(/^\\+?56/, '')",
  "tel.replace(/[^0-9]/g, '').replace(/^56/, '')"
);

fs.writeFileSync(file, c, 'utf8');
console.log('done:', !c.includes('[\\s\\-'));