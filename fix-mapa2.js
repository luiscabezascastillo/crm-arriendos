const fs = require('fs');
const file = 'app/publicaciones/page.js';
let c = fs.readFileSync(file, 'utf8');

// 1. Añadir estado pubsMapa
c = c.replace(
  "const [pubs, setPubs] = useState([])",
  "const [pubs, setPubs] = useState([])\r\n  const [pubsMapa, setPubsMapa] = useState([])"
);

// 2. Cargar pubsMapa cuando vista === 'mapa'
c = c.replace(
  "useEffect(() => { loadData() }, [page, search, filtroPortal, filtroObjetivo, modo])",
  "useEffect(() => { loadData() }, [page, search, filtroPortal, filtroObjetivo, modo])\r\n  useEffect(() => { if (vista === 'mapa') loadMapa() }, [vista, modo])"
);

// 3. Añadir función loadMapa después de loadData
c = c.replace(
  "async function loadData() {",
  `async function loadMapa() {
    let query = supabase
      .from('publicaciones')
      .select('id, codigo, direccion, comuna, objetivo, tipo, tipo_moneda, valor, latitud, longitud')
      .not('latitud', 'is', null)
      .neq('latitud', '')
    if (modo === 'activas') query = query.eq('activo', 'SI')
    else query = query.neq('activo', 'SI')
    const { data } = await query
    setPubsMapa(data || [])
  }

  async function loadData() {`
);

// 4. Añadir botón Mapa en el toggle
c = c.replace(
  "background:vista==='tarjetas'?'#1a56db':'transparent', color:vista==='tarjetas'?'#fff':'var(--gray-500)' }}>\u229e Tarjetas</button>\r\n            </div>",
  "background:vista==='tarjetas'?'#1a56db':'transparent', color:vista==='tarjetas'?'#fff':'var(--gray-500)' }}>\u229e Tarjetas</button>\r\n              <button onClick={() => setVista('mapa')} style={{ padding:'6px 14px', border:'none', fontSize:11, fontWeight:500, cursor:'pointer', fontFamily:'inherit', background:vista==='mapa'?'#1a56db':'transparent', color:vista==='mapa'?'#fff':'var(--gray-500)' }}>\ud83d\uddfa Mapa</button>\r\n            </div>"
);

// 5. Añadir componente MapaPublicaciones antes del export default
const mapaComponent = `
function MapaPublicaciones({ pubs }) {
  const mapRef = React.useRef(null)
  const mapInstanceRef = React.useRef(null)
  const markersRef = React.useRef([])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    if (mapInstanceRef.current) {
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []
      addMarkers(mapInstanceRef.current)
      return
    }
    const initMap = async () => {
      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')
      delete L.Icon.Default.prototype._getIconUrl
      L.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })
      const map = L.map(mapRef.current).setView([-33.45, -70.67], 11)
      mapInstanceRef.current = map
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '\u00a9 OpenStreetMap contributors'
      }).addTo(map)
      addMarkers(map)
    }
    initMap()
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        markersRef.current = []
      }
    }
  }, [])

  React.useEffect(() => {
    if (!mapInstanceRef.current) return
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []
    addMarkers(mapInstanceRef.current)
  }, [pubs])

  async function addMarkers(map) {
    const L = (await import('leaflet')).default
    pubs.forEach(p => {
      const lat = parseFloat(p.latitud)
      const lng = parseFloat(p.longitud)
      if (!lat || !lng || isNaN(lat) || isNaN(lng)) return
      const esVenta = (p.objetivo||'').toLowerCase().includes('venta')
      const icon = L.divIcon({
        className: '',
        html: \`<div style="background:\${esVenta?'#16a34a':'#1a56db'};color:#fff;padding:3px 7px;border-radius:12px;font-size:11px;font-weight:600;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.25)">\${p.codigo||''}</div>\`,
        iconAnchor: [20, 10],
      })
      const marker = L.marker([lat, lng], { icon }).addTo(map)
      const precio = p.tipo_moneda === 'UF'
        ? \`UF \${Number(p.valor).toLocaleString('es-CL')}\`
        : \`$\${Number(p.valor).toLocaleString('es-CL')}\`
      marker.bindPopup(\`
        <div style="font-family:sans-serif;min-width:180px">
          <div style="font-weight:700;font-size:13px;margin-bottom:4px">\${p.codigo} \u00b7 \${p.tipo||''}</div>
          <div style="font-size:12px;color:#555;margin-bottom:4px">\${p.direccion||''}</div>
          <div style="font-size:12px;color:#555;margin-bottom:6px">\${p.comuna||''}</div>
          <div style="font-size:13px;font-weight:600;color:\${esVenta?'#16a34a':'#1a56db'};margin-bottom:8px">\${precio}</div>
          <a href="/publicaciones/\${p.id}" style="font-size:11px;color:#1a56db;font-weight:600">Ver ficha \u2192</a>
        </div>
      \`)
      markersRef.current.push(marker)
    })
  }

  return (
    <div style={{ padding:'0 24px 24px' }}>
      <div style={{ padding:'8px 0 12px', fontSize:12, color:'var(--gray-500)' }}>
        {pubs.length} propiedades en el mapa
      </div>
      <div ref={mapRef} style={{ width:'100%', height:'calc(100vh - 300px)', borderRadius:12, overflow:'hidden', border:'1px solid var(--border)' }} />
    </div>
  )
}

`;

c = c.replace(
  "export default function PublicacionesPage() {",
  mapaComponent + "export default function PublicacionesPage() {"
);

// 6. Añadir React import
if (!c.includes("import React")) {
  c = c.replace("'use client'", "'use client'\nimport React from 'react'");
}

// 7. Renderizar mapa antes de tarjetas
c = c.replace(
  "      {vista === 'tarjetas' && (",
  "      {vista === 'mapa' && <MapaPublicaciones pubs={pubsMapa} />}\r\n\r\n      {vista === 'tarjetas' && ("
);

fs.writeFileSync(file, c, 'utf8');
console.log('done mapa:', c.includes('MapaPublicaciones'));
console.log('done boton:', c.includes("'mapa'"));
console.log('done loadMapa:', c.includes('loadMapa'));
