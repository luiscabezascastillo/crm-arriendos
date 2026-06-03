const fs = require('fs');
const file = 'app/contactos/[id]/page.js';
let c = fs.readFileSync(file, 'utf8');

const old = "          <button onClick={() => setEditando(true)} style={{ padding: '7px 16px', borderRadius: 7, border: '1px solid #1D4ED8', background: '#EFF6FF', color: '#1D4ED8', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>\n            Editar\n          </button>";

const neu = "          <div style={{ display: 'flex', gap: 8 }}>\n            <button onClick={() => setOvOpen(true)} style={{ padding: '7px 16px', borderRadius: 7, border: '1px solid #0F6E56', background: '#E1F5EE', color: '#0F6E56', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Orden de Visita</button>\n            <button onClick={() => setEditando(true)} style={{ padding: '7px 16px', borderRadius: 7, border: '1px solid #1D4ED8', background: '#EFF6FF', color: '#1D4ED8', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>Editar</button>\n          </div>";

c = c.replace(old, neu);
fs.writeFileSync(file, c, 'utf8');
console.log('done:', c.includes('Orden de Visita'));