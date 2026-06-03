const fs = require('fs');
const c = fs.readFileSync('app/contactos/[id]/page.js', 'utf8');
const i = c.indexOf("['Comercial'");
console.log(JSON.stringify(c.substring(i-5, i+200)));