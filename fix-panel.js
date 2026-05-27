const fs = require('fs');
const file = 'app/panel/page.js';
let c = fs.readFileSync(file, 'utf8');

// Corregir encoding
c = c.replace(/â‚¬/g, '$');
c = c.replace(/â€"/g, '—');
c = c.replace(/Ã³/g, 'ó');
c = c.replace(/Ã©/g, 'é');
c = c.replace(/Ã¡/g, 'á');
c = c.replace(/Ã­/g, 'í');
c = c.replace(/Ãº/g, 'ú');
c = c.replace(/Ã±/g, 'ñ');
c = c.replace(/Ã/g, 'Á');

// Formato chileno
c = c.replace(/\$120,500/g, '$120.500');
c = c.replace(/\$84,300/g, '$84.300');
c = c.replace(/\$36,200/g, '$36.200');
c = c.replace(/\$78,200/g, '$78.200');
c = c.replace(/\$45,000/g, '$45.000');
c = c.replace(/\$10,500/g, '$10.500');
c = c.replace(/\$6,800/g, '$6.800');
c = c.replace(/\$10,200/g, '$10.200');
c = c.replace(/\$22,500/g, '$22.500');
c = c.replace(/\$95,000/g, '$95.000');
c = c.replace(/\$12,000/g, '$12.000');

fs.writeFileSync(file, c, 'utf8');
console.log('done');