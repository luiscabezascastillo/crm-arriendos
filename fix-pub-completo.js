const fs = require('fs');
const file = 'app/publicaciones/page.js';
let c = fs.readFileSync(file, 'utf8');

if (!c.includes('import React')) {
  c = c.replace("'use client'", "'use client'\nimport React from 'react'");
}

c = c.replace(
  "const [pubs, setPubs] = useState([])",
  "const [pubs, setPubs] = useState([])\n  const [pubsMapa, setPubsMapa] = useState([])"
);

const lm = [
  '  async function loadMapa() {',
  '    const { data } = await supabase',
  '      .from(\x27publicaciones\x27)',
  '      .select(\x27id, codigo, direccion, comuna, objetivo, tipo, tipo_moneda, valor, latitud, longitud, dormitorios\x27)',
  '      .eq(\x27activo\x27, \x27active\x27)',
  '      .not(\x27latitud\x27, \x27is\x27, null)',
  '      .neq(\x27latitud\x27, \x27\x27)',
  '    const filtered = (data || []).filter(function(p) {',
  '      if (filtroPortal && p[filtroPortal] !== \x27SI\x27) return false',
  '      if (filtroObjetivo === \x27arriendo\x27 && !(p.objetivo||\x27\x27).toLowerCase().includes(\x27arriendo\x27)) return false',
  '      if (filtroObjetivo === \x27venta\x27 && !(p.objetivo||\x27\x27).toLowerCase().includes(\x27venta\x27)) return false',
  '      return true',
  '    })',
  '    setPubsMapa(filtered)',
  '  }',
  '',
  '  useEffect(function() { if (vista === \x27mapa\x27) loadMapa() }, [vista, filtroPortal, filtroObjetivo])',
  '',
  '  async function loadKpis() {'
].join('\n');
c = c.replace('  async function loadKpis() {', lm);

const btnOld = '\u229e Tarjetas</button>\r\n          </div>';
const btnNew = '\u229e Tarjetas</button>\r\n              <button onClick={function(){ setVista(\x27mapa\x27) }} style={{ padding:\x276px 14px\x27, border:\x27none\x27, fontSize:11, fontWeight:500, cursor:\x27pointer\x27, fontFamily:\x27inherit\x27, background:vista===\x27mapa\x27?\x27#1a56db\x27:\x27transparent\x27, color:vista===\x27mapa\x27?\x27#fff\x27:\x27var(--gray-500)\x27 }}>\ud83d\uddfa Mapa</button>\r\n          </div>';
c = c.replace(btnOld, btnNew);

const mc = [
  '',
  'var _MI = null',
  '',
  'function MapaPublicaciones(props) {',
  '  var pubs = props.pubs',
  '  var ref = React.useRef(null)',
  '',
  '  React.useEffect(function() {',
  '    if (!ref.current || pubs.length === 0) return',
  '    if (_MI) { _MI.remove(); _MI = null }',
  '    var done = false',
  '    Promise.all([import(\x27leaflet\x27), import(\x27leaflet/dist/leaflet.css\x27)]).then(function(r) {',
  '      if (done || !ref.current) return',
  '      var L = r[0].default',
  '      delete L.Icon.Default.prototype._getIconUrl',
  '      L.Icon.Default.mergeOptions({ iconUrl: \x27https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png\x27, iconRetinaUrl: \x27https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png\x27, shadowUrl: \x27https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png\x27 })',
  '      _MI = L.map(ref.current, { center: [-33.45, -70.67], zoom: 11 })',
  '      L.tileLayer(\x27https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png\x27, { attribution: \x27\u00a9 OpenStreetMap\x27 }).addTo(_MI)',
  '      var AB = {BODEGA:\x27BOD\x27,LOCAL:\x27LOC\x27,OFICINA:\x27OFI\x27,ESTACIONAMIENTO:\x27EST\x27,TERRENO:\x27TER\x27,PARCELA:\x27PAR\x27,INDUSTRIAL:\x27IND\x27,SITIO:\x27SIT\x27,AGRICOLA:\x27AGR\x27}',
  '      pubs.forEach(function(p) {',
  '        var lat = parseFloat(p.latitud), lng = parseFloat(p.longitud)',
  '        if (!lat || !lng || isNaN(lat) || isNaN(lng)) return',
  '        var ev = (p.objetivo||\x27\x27).toLowerCase().indexOf(\x27venta\x27) >= 0',
  '        var lbl = p.dormitorios ? p.dormitorios+\x27D\x27 : (AB[(p.tipo||\x27\x27).toUpperCase()] || (p.tipo||\x27\x27).substring(0,3) || \x27?\x27)',
  '        var bg = ev ? \x27#16a34a\x27 : \x27#1a56db\x27',
  '        var html = \x27<div style=\\\x27background:\x27+bg+\x27;color:#fff;padding:3px 7px;border-radius:12px;font-size:11px;font-weight:700\\\x27>\x27+lbl+\x27</div>\x27',
  '        var icon = L.divIcon({ className: \x27\x27, html: html, iconAnchor: [20,10] })',
  '        var pr = p.tipo_moneda===\x27UF\x27 ? \x27UF \x27+Number(p.valor).toLocaleString(\x27es-CL\x27) : \x27$\x27+Number(p.valor).toLocaleString(\x27es-CL\x27)',
  '        var pop = \x27<b>\x27+p.codigo+\x27 \u00b7 \x27+(p.tipo||\x27\x27)+\x27</b><br>\x27+(p.direccion||\x27\x27)+\x27, \x27+(p.comuna||\x27\x27)+\x27<br><b>\x27+pr+\x27</b><br><a href=/publicaciones/\x27+p.id+\x27>Ver ficha</a>\x27',
  '        L.marker([lat,lng],{icon}).addTo(_MI).bindPopup(pop)',
  '      })',
  '    })',
  '    return function() { done = true; if (_MI) { _MI.remove(); _MI = null } }',
  '  }, [pubs])',
  '',
  '  return React.createElement(\x27div\x27, {style:{padding:\x270 24px 24px\x27}},',
  '    React.createElement(\x27div\x27, {style:{padding:\x278px 0 12px\x27,fontSize:12,color:\x27var(--gray-500)\x27}}, pubs.length+\x27 propiedades en el mapa\x27),',
  '    React.createElement(\x27div\x27, {ref:ref, style:{width:\x27100%\x27,height:\x27calc(100vh - 300px)\x27,borderRadius:12,overflow:\x27hidden\x27,border:\x271px solid var(--border)\x27}})',
  '  )',
  '}',
  ''
].join('\n');
c = c.replace('export default function PublicacionesPage() {', mc + 'export default function PublicacionesPage() {');

c = c.replace(
  ") : vista === 'tabla' ? (\r\n",
  ") : vista === 'mapa' ? (\n          React.createElement(MapaPublicaciones, { key: filtroPortal+filtroObjetivo+modo, pubs: pubsMapa })\n        ) : vista === 'tabla' ? (\r\n"
);

fs.writeFileSync(file, c, 'utf8');
console.log('mapa:', c.includes('MapaPublicaciones'));
console.log('btn:', c.includes("'mapa'"));
console.log('load:', c.includes('loadMapa'));