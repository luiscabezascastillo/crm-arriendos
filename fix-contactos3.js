const fs = require('fs');
const file = 'app/contactos/[id]/page.js';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(
  "['Comercial', contacto.comercial_asignado || '\u2014'],\n                ['Origen', contacto.origen || '\u2014'],\n                ['Empresa', contacto.empresa || '\u2014'],\n                ['Cargo', contacto.cargo || '\u2014'],",
  "['Comercial', contacto.comercial_asignado || '\u2014'],\n                ['Origen', contacto.origen || '\u2014'],\n                ['Empresa', contacto.empresa || '\u2014'],\n                ['Cargo', contacto.cargo || '\u2014'],\n                ['Creado por', contacto.creado_por || '\u2014'],\n                ['Modificado por', contacto.modificado_por || '\u2014'],"
);

fs.writeFileSync(file, c, 'utf8');
console.log('done:', c.includes('Creado por'));