'use client'
import { useEffect, useRef } from 'react'

const ABREV = {
  BODEGA: 'BOD', LOCAL: 'LOC', OFICINA: 'OFI',
  ESTACIONAMIENTO: 'EST', TERRENO: 'TER', PARCELA: 'PAR',
  INDUSTRIAL: 'IND', SITIO: 'SIT', AGRICOLA: 'AGR'
}

export default function MapaPublicaciones({ pubs }) {
  const ref = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])

  // Inicializar mapa una vez
  useEffect(() => {
    if (!ref.current || mapRef.current) return

    let cancelled = false

    async function init() {
      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')

      if (cancelled || !ref.current) return

      delete L.Icon.Default.prototype._getIconUrl
      L.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const map = L.map(ref.current, { center: [-33.45, -70.67], zoom: 11 })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map)

      mapRef.current = map
    }

    init()

    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        markersRef.current = []
      }
    }
  }, [])

  // Actualizar marcadores cuando cambian los datos
  useEffect(() => {
    if (!mapRef.current || pubs.length === 0) return

    async function addMarkers() {
      const L = (await import('leaflet')).default

      // Limpiar marcadores anteriores
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []

      pubs.forEach(p => {
        const lat = parseFloat(p.latitud)
        const lng = parseFloat(p.longitud)
        if (!lat || !lng || isNaN(lat) || isNaN(lng)) return

        const esVenta = (p.objetivo || '').toLowerCase().includes('venta')
        const lbl = p.dormitorios
          ? p.dormitorios + 'D'
          : (ABREV[(p.tipo || '').toUpperCase()] || (p.tipo || '').substring(0, 3) || '?')
        const bg = esVenta ? '#16a34a' : '#1a56db'

        const icon = L.divIcon({
          className: '',
          html: '<div style="background:' + bg + ';color:#fff;padding:3px 7px;border-radius:12px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.25)">' + lbl + '</div>',
          iconAnchor: [20, 10],
        })

        const precio = p.tipo_moneda === 'UF'
          ? 'UF ' + Number(p.valor).toLocaleString('es-CL')
          : '$' + Number(p.valor).toLocaleString('es-CL')

        const popup = '<div style="font-family:sans-serif;min-width:180px">' +
          '<b>' + p.codigo + ' · ' + (p.tipo || '') + '</b><br/>' +
          '<span style="color:#555;font-size:12px">' + (p.direccion || '') + ', ' + (p.comuna || '') + '</span><br/>' +
          '<b style="color:' + bg + '">' + precio + '</b><br/>' +
          '<a href="/publicaciones/' + p.id + '" style="color:#1a56db;font-size:11px">Ver ficha →</a>' +
          '</div>'

        const marker = L.marker([lat, lng], { icon }).addTo(mapRef.current).bindPopup(popup)
        markersRef.current.push(marker)
      })
    }

    addMarkers()
  }, [pubs])

  return (
    <div style={{ padding: '0 24px 24px' }}>
      <div style={{ padding: '8px 0 12px', fontSize: 12, color: 'var(--gray-500)' }}>
        {pubs.length} propiedades en el mapa
      </div>
      <div
        ref={ref}
        style={{
          width: '100%',
          height: 'calc(100vh - 300px)',
          borderRadius: 12,
          overflow: 'hidden',
          border: '1px solid var(--border)',
        }}
      />
    </div>
  )
}
