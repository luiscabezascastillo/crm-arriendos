const fs = require('fs');
const file = 'app/contactos/page.js';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(
  'autoComplete="off"',
  'autoComplete="new-password"'
);

fs.writeFileSync(file, c, 'utf8');
console.log('done:', c.includes('new-password'));