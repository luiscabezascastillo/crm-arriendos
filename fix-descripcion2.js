const fs = require('fs');
const file = 'app/publicaciones/[id]/page.js';
let c = fs.readFileSync(file, 'utf8');

// Revertir el cambio anterior
c = c.replace(
  "{(pub.observaciones||'').replace(/<br\\s*\\/?>/gi, '\\n')}",
  "{pub.observaciones}"
);

// Añadir función helper al inicio del componente FichaPage
c = c.replace(
  "export default function FichaPage() {",
  "function sinBr(txt) { return (txt||'').split(/<br\\s*\\/?>/i).join('\\n'); }\n\nexport default function FichaPage() {"
);

// Usar la función helper en el renderizado
c = c.replace(
  "<p style={{ fontSize:13, color:'var(--gray-700)', lineHeight:1.6, margin:0, whiteSpace:'pre-line' }}>{pub.observaciones}</p>",
  "<p style={{ fontSize:13, color:'var(--gray-700)', lineHeight:1.6, margin:0, whiteSpace:'pre-line' }}>{sinBr(pub.observaciones)}</p>"
);

fs.writeFileSync(file, c, 'utf8');
console.log('done:', c.includes('sinBr'));