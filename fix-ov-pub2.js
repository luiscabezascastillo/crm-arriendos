const fs = require('fs');
const file = 'app/publicaciones/page.js';
let lines = fs.readFileSync(file, 'utf8').split('\n');

// Insertar barra flotante + modal antes de la línea 698 (índice 697) que es "  )"
const insert = [
  "      {selPubs.length > 0 && (",
  "        <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', background:'#1a1a2e', color:'#fff', padding:'12px 24px', borderRadius:12, boxShadow:'0 8px 32px rgba(0,0,0,0.25)', display:'flex', alignItems:'center', gap:16, zIndex:200, fontFamily:'inherit' }}>",
  "          <span style={{ fontSize:13 }}>{selPubs.length} propiedad(es) seleccionada(s)</span>",
  "          <button onClick={() => setOvOpen(true)} style={{ padding:'7px 18px', borderRadius:7, border:'none', background:'#0F6E56', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>+ Orden de Visita</button>",
  "          <button onClick={() => setSelPubs([])} style={{ padding:'7px 12px', borderRadius:7, border:'1px solid #555', background:'transparent', color:'#aaa', fontSize:13, cursor:'pointer' }}>\u00d7 Limpiar</button>",
  "        </div>",
  "      )}",
  "",
  "      {ovOpen && (",
  "        <OrdenVisitaModal",
  "          propiedadesIniciales={selPubs}",
  "          onClose={() => setOvOpen(false)}",
  "          onCreated={() => { setOvOpen(false); setSelPubs([]) }}",
  "        />",
  "      )}"
];

// Encontrar la línea con "  )" cerca del final
let insertIdx = -1;
for (let i = lines.length - 1; i >= 690; i--) {
  if (lines[i].trim() === ')') { insertIdx = i; break; }
}

if (insertIdx > 0) {
  lines.splice(insertIdx, 0, ...insert);
  fs.writeFileSync(file, lines.join('\n'), 'utf8');
  console.log('done at line:', insertIdx + 1);
  console.log('barra:', lines.some(l => l.includes('Orden de Visita')));
} else {
  console.log('no encontrado');
}