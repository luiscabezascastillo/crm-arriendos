'use client'
import { useEffect, useRef, useState } from 'react'

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'

function loadCss(href) {
  if (!document.querySelector(`link[href="${href}"]`)) {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l)
  }
}
function loadJs(src) {
  return new Promise((res, rej) => {
    if (window.L) { res(); return }
    const ex = document.querySelector(`script[src="${src}"]`)
    if (ex) { ex.addEventListener('load', () => res()); if (window.L) res(); return }
    const s = document.createElement('script'); s.src = src
    s.onload = () => res(); s.onerror = () => rej(new Error('No se pudo cargar el mapa'))
    document.body.appendChild(s)
  })
}

export default function ZonaModal({ open, onClose, valor, centro, onSave }) {
  const elRef = useRef(null)
  const mapRef = useRef(null)
  const layerRef = useRef(null)
  const markersRef = useRef([])
  const ptsRef = useRef([])
  const [npts, setNpts] = useState(0)

  function redraw() {
    const L = window.L
    if (!mapRef.current || !L) return
    if (layerRef.current) { mapRef.current.removeLayer(layerRef.current); layerRef.current = null }
    markersRef.current.forEach(m => mapRef.current.removeLayer(m)); markersRef.current = []
    const pts = ptsRef.current
    pts.forEach(p => {
      const mk = L.circleMarker(p, { radius: 5, color: '#7c3aed', fillColor: '#7c3aed', fillOpacity: 1, weight: 2 })
      mk.addTo(mapRef.current); markersRef.current.push(mk)
    })
    if (pts.length >= 2) {
      layerRef.current = pts.length >= 3
        ? L.polygon(pts, { color: '#7c3aed', weight: 2, fillOpacity: 0.12 })
        : L.polyline(pts, { color: '#7c3aed', weight: 2 })
      layerRef.current.addTo(mapRef.current)
    }
    setNpts(pts.length)
  }

  useEffect(() => {
    if (!open) return
    let cancel = false
    loadCss(LEAFLET_CSS)
    loadJs(LEAFLET_JS).then(() => {
      if (cancel) return
      setTimeout(() => {
        if (cancel || !elRef.current) return
        const L = window.L
        if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
        const c = (centro && centro.length === 2) ? centro : [-33.45, -70.66]
        const map = L.map(elRef.current).setView(c, 13)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map)
        mapRef.current = map
        ptsRef.current = (Array.isArray(valor) && valor.length >= 3) ? valor.map(p => [p[0], p[1]]) : []
        map.on('click', e => { ptsRef.current = [...ptsRef.current, [e.latlng.lat, e.latlng.lng]]; redraw() })
        redraw()
        if (ptsRef.current.length >= 3) { try { map.fitBounds(L.polygon(ptsRef.current).getBounds(), { padding: [20, 20] }) } catch (e) { } }
        setTimeout(() => map.invalidateSize(), 80)
      }, 60)
    }).catch(e => alert(e.message))
    return () => {
      cancel = true
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
      ptsRef.current = []; markersRef.current = []; layerRef.current = null
    }
  }, [open])

  if (!open) return null

  const btn = { padding: '7px 12px', borderRadius: 7, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid #E5E7EB', background: '#fff', color: '#374151' }

  function deshacer() { ptsRef.current = ptsRef.current.slice(0, -1); redraw() }
  function limpiar() { ptsRef.current = []; redraw() }
  function guardar() {
    if (ptsRef.current.length < 3) { alert('Marca al menos 3 puntos para formar una zona.'); return }
    onSave(ptsRef.current.map(p => [p[0], p[1]]))
    onClose()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 760, overflow: 'hidden', fontFamily: '"DM Sans", sans-serif', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #EEE', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>Definir zona del requerimiento</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Haz clic en el mapa para marcar los vértices de la zona.</div>
          </div>
          <button onClick={onClose} style={{ ...btn, border: 'none', fontSize: 20, color: '#999' }}>×</button>
        </div>

        <div ref={elRef} style={{ height: 440, width: '100%', background: '#eee' }} />

        <div style={{ padding: '12px 18px', borderTop: '1px solid #EEE', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: npts >= 3 ? '#16a34a' : '#888', fontWeight: 600 }}>
            {npts === 0 ? 'Sin puntos' : npts < 3 ? `${npts} punto(s) · faltan ${3 - npts} para cerrar` : `Zona de ${npts} puntos ✓`}
          </span>
          <div style={{ flex: 1 }} />
          <button onClick={deshacer} style={btn} disabled={npts === 0}>Deshacer punto</button>
          <button onClick={limpiar} style={btn} disabled={npts === 0}>Limpiar</button>
          <button onClick={onClose} style={btn}>Cancelar</button>
          <button onClick={guardar} style={{ ...btn, border: '1px solid #7c3aed', background: '#7c3aed', color: '#fff', fontWeight: 600 }}>Guardar zona</button>
        </div>
      </div>
    </div>
  )
}
