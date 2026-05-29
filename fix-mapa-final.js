const fs = require('fs');
const file = 'app/publicaciones/page.js';
let lines = fs.readFileSync(file, 'utf8').split('\n');

const newComp = `let _mapInstance = null
let _mapL = null

function MapaPublicaciones({ pubs }) {
  const ref = React.useRef(null)

  React.useEffect(() => {
    if (!ref.current || pubs.length === 0) return

    const init = async () => {
      // Limpiar mapa anterior si existe
      if (_mapInstance) { _mapInstance.remove(); _mapInstance = null; _mapL = null }

      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')
      delete L.Icon.Default.prototype._getIconUrl
      L.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })
      _mapL = L
      _mapInstance = L.map(ref.current, { center: [-33.45, -70.67], zoom: 11 })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '\u00a9 OpenStreetMap' }).addTo(_mapInstance)

      const ABREV = {'BODEGA':'BOD','LOCAL':'LOC','OFICINA':'OFI','ESTACIONAMIENTO':'EST','TERRENO':'TER','PARCELA':'PAR','INDUSTRIAL':'IND','SITIO':'SIT','AGRICOLA':'AGR'}
      pubs.forEach(p => {
        const lat = parseFloat(p.latitud), lng = parseFloat(p.longitud)
        if (!lat || !lng || isNaN(lat) || isNaN(lng)) return
        const esVenta = (p.objetivo||'').toLowerCase().includes('venta')
        const label = p.dormitorios ? p.dormitorios+'D' : (ABREV[p.tipo?.toUpperCase()] || p.tipo?.substring(0,3) || '?')
        const icon = L.divIcon({ className: '', html: `<div style="background:${esVenta?'#16a34a':'#1a56db'};color:#fff;padding:3px 7px;border-radius:12px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.25)">${label}</div>`, iconAnchor:[20,10] })
        const precio = p.tipo_moneda==='UF' ? `UF ${Number(p.valor).toLocaleString('es-CL')}` : `$${Number(p.valor).toLocaleString('es-CL')}`
        L.marker([lat,lng],{icon}).addTo(_mapInstance).bindPopup(`<div style="font-family:sans-serif;min-width:180px"><b>${p.codigo} \u00b7 ${p.tipo||''}</b><br/><span style="color:#555;font-size:12px">${p.direccion||''}, ${p.comuna||''}</span><br/><b style="color:${esVenta?'#16a34a':'#1a56db'}">${precio}</b><br/><a href="/publicaciones/${p.id}" style="color:#1a56db;font-size:11px">Ver ficha \u2192</a></div>`)
      })
    }

    init()

    return () => { if (_mapInstance) { _mapInstance.remove(); _mapInstance = null; _mapL = null } }
  }, [pubs])

  return (
    <div style={{padding:'0 24px 24px'}}>
      <div style={{padding:'8px 0 12px',fontSize:12,color:'var(--gray-500)'}}>{pubs.length} propiedades en el mapa</div>
      <div ref={ref} style={{width:'100%',height:'calc(100vh - 300px)',borderRadius:12,overflow:'hidden',border:'1px solid var(--border)'}} />
    </div>
  )
}
`.split('\n');

// Reemplazar líneas 59-109 (índices 58-108)
lines.splice(58, 51, ...newComp);
fs.writeFileSync(file, lines.join('\n'), 'utf8');
console.log('done, total lines:', lines.length);
