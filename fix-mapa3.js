const fs = require('fs');
const file = 'app/publicaciones/page.js';
let c = fs.readFileSync(file, 'utf8');

const old = "\u229e Tarjetas</button>\r\n          </div>";
const neu = "\u229e Tarjetas</button>\r\n              <button onClick={() => setVista('mapa')} style={{ padding:'6px 14px', border:'none', fontSize:11, fontWeight:500, cursor:'pointer', fontFamily:'inherit', background:vista==='mapa'?'#1a56db':'transparent', color:vista==='mapa'?'#fff':'var(--gray-500)' }}>\ud83d\uddfa Mapa</button>\r\n          </div>";

c = c.replace(old, neu);
fs.writeFileSync(file, c, 'utf8');
console.log('done:', c.includes("'mapa'"));