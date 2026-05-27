const fs = require('fs');
const file = 'app/publicaciones/[id]/page.js';
let lines = fs.readFileSync(file, 'utf8').split('\n');

// Reemplazar líneas 394 y 395 (índices 393 y 394) con versión correcta
lines[393] = "                  <p style={{ fontSize:13, color:'var(--gray-700)', lineHeight:1.6, margin:0, whiteSpace:'pre-line' }}>{sinBr(pub.observaciones)}</p>\r";
lines[394] = null;

const result = lines.filter(l => l !== null).join('\n');
fs.writeFileSync(file, result, 'utf8');
console.log('done:', result.includes('sinBr'));