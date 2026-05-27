const fs = require('fs');
const file = 'app/publicaciones/[id]/page.js';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(
  "<p style={{ fontSize:13, color:'var(--gray-700)', lineHeight:1.6, margin:0, whiteSpace:'pre-line' }}>{pub.observaciones}</p>",
  "<p style={{ fontSize:13, color:'var(--gray-700)', lineHeight:1.6, margin:0, whiteSpace:'pre-line' }}>{(pub.observaciones||'').replace(/<br\s*\/?>/gi, '\n')}</p>"
);

fs.writeFileSync(file, c, 'utf8');
console.log('done:', c.includes('replace(/<br'));