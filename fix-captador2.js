const fs = require('fs');
const file = 'app/publicaciones/[id]/page.js';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(
  "['Captador',pub.vendedor||'\u2014'],['Captador',pub.captador||'\u2014']",
  "['Vendedor',pub.vendedor||'\u2014'],['Captador',pub.captador||'\u2014']"
);

fs.writeFileSync(file, c, 'utf8');
console.log('done');