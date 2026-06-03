const fs = require('fs');
const file = 'app/publicaciones/page.js';
let c = fs.readFileSync(file, 'utf8');

// 1. Import OrdenVisitaModal
c = c.replace(
  "import dynamic from 'next/dynamic'",
  "import dynamic from 'next/dynamic'\nimport OrdenVisitaModal from '../components/ui/OrdenVisitaModal'"
);

// 2. Estado seleccionadas y ovOpen
c = c.replace(
  "const [pubsMapa, setPubsMapa] = useState([])",
  "const [pubsMapa, setPubsMapa] = useState([])\n  const [selPubs, setSelPubs] = useState([])\n  const [ovOpen, setOvOpen] = useState(false)"
);

// 3. Función toggle seleccion
c = c.replace(
  "  const unicos = (campo) =>",
  "  function toggleSel(p) { setSelPubs(s => s.find(x => x.id === p.id) ? s.filter(x => x.id !== p.id) : [...s, p]) }\n  function toggleTodos() { setSelPubs(s => s.length === pubsFiltradas.length ? [] : [...pubsFiltradas]) }\n\n  const unicos = (campo) =>"
);

// 4. Columna checkbox en cabecera - añadir antes de la primera th
c = c.replace(
  "<th style={{ padding:'9px 10px', borderBottom:'1px solid var(--border)', background:'var(--gray-50)', whiteSpace:'nowrap', fontSize:10, fontWeight:600, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Imagen</th>",
  "<th style={{ padding:'9px 10px', borderBottom:'1px solid var(--border)', background:'var(--gray-50)', width:36, textAlign:'center' }}><input type='checkbox' onChange={toggleTodos} checked={selPubs.length === pubsFiltradas.length && pubsFiltradas.length > 0} style={{ margin:0, cursor:'pointer' }} /></th>\n                    <th style={{ padding:'9px 10px', borderBottom:'1px solid var(--border)', background:'var(--gray-50)', whiteSpace:'nowrap', fontSize:10, fontWeight:600, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Imagen</th>"
);

// 5. Añadir checkbox en cada fila - buscar el inicio del tr
c = c.replace(
  "{pubsFiltradas.map((p,i) => {\r\n                    const activos = activoEnPortales(p)\r\n                    const esHistorica = modo === 'historicas'\r\n                    return (",
  "{pubsFiltradas.map((p,i) => {\r\n                    const activos = activoEnPortales(p)\r\n                    const esHistorica = modo === 'historicas'\r\n                    const esSel = !!selPubs.find(x => x.id === p.id)\r\n                    return ("
);

// 6. Barra flotante y modal - añadir antes del cierre de la página
c = c.replace(
  "      {modalOpen && (",
  "      {selPubs.length > 0 && (\r\n        <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', background:'#1a1a2e', color:'#fff', padding:'12px 24px', borderRadius:12, boxShadow:'0 8px 32px rgba(0,0,0,0.25)', display:'flex', alignItems:'center', gap:16, zIndex:200, fontFamily:'inherit' }}>\r\n          <span style={{ fontSize:13 }}>{selPubs.length} propiedad(es) seleccionada(s)</span>\r\n          <button onClick={() => setOvOpen(true)} style={{ padding:'7px 18px', borderRadius:7, border:'none', background:'#0F6E56', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>+ Orden de Visita</button>\r\n          <button onClick={() => setSelPubs([])} style={{ padding:'7px 12px', borderRadius:7, border:'1px solid #555', background:'transparent', color:'#aaa', fontSize:13, cursor:'pointer' }}>× Limpiar</button>\r\n        </div>\r\n      )}\r\n\r\n      {ovOpen && (\r\n        <OrdenVisitaModal\r\n          propiedadesIniciales={selPubs}\r\n          onClose={() => setOvOpen(false)}\r\n          onCreated={() => { setOvOpen(false); setSelPubs([]) }}\r\n        />\r\n      )}\r\n\r\n      {modalOpen && ("
);

fs.writeFileSync(file, c, 'utf8');
console.log('import:', c.includes("import OrdenVisitaModal"));
console.log('estado:', c.includes('selPubs'));
console.log('barra:', c.includes('Orden de Visita'));
console.log('modal:', c.includes('ovOpen && ('));