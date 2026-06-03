const fs = require('fs');
const file = 'app/contactos/page.js';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(
  "const payload = {\n      ...form,",
  "const formLimpio = { ...form }\n    if (!formLimpio.fecha_nacimiento) formLimpio.fecha_nacimiento = null\n    const payload = {\n      ...formLimpio,"
);

fs.writeFileSync(file, c, 'utf8');
console.log('done:', c.includes('fecha_nacimiento = null'));