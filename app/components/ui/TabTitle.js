'use client'
// VERSION: v1 · 2026-08-07 · Pone el título de la pestaña del navegador con el nombre del proceso abierto,
//   para distinguir las pestañas de un vistazo. Se monta una sola vez en app/layout.js.
//   Fuente de nombres: lib/procesos.js (titulo/href) + un mapa EXTRA para subpáginas que no están
//   en el catálogo (cartas, honorarios, DICOM, panel, alertas…). Resuelve por prefijo de ruta más largo;
//   si no encuentra, prettifica el último segmento. No pinta nada (return null).
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { PROCESOS } from '../../../lib/procesos'

// Subpáginas y secciones que NO están (o no con ese detalle) en lib/procesos.js
const EXTRA = [
  { href: '/procesos/liquidaciones/cartas', t: 'Cartas' },
  { href: '/procesos/liquidaciones/faltan', t: 'Faltan' },
  { href: '/procesos/liquidaciones/facturas', t: 'Facturas' },
  { href: '/procesos/liquidaciones/emails', t: 'Emails liquidación' },
  { href: '/procesos/financiero/ventas', t: 'Ventas' },
  { href: '/procesos/financiero/compras', t: 'Compras' },
  { href: '/procesos/financiero/honorarios', t: 'Honorarios' },
  { href: '/procesos/financiero/remuneraciones', t: 'Remuneraciones' },
  { href: '/procesos/financiero/caja-chica', t: 'Caja Chica' },
  { href: '/procesos/financiero/sa', t: 'SA' },
  { href: '/procesos/financiero/contab', t: 'Contabilidad' },
  { href: '/procesos/financiero/dj1835', t: 'DJ 1835' },
  { href: '/procesos/bi', t: 'BI' },
  { href: '/cc1/dicom', t: 'DICOM' },
  { href: '/cc1/propietarios', t: 'Propietarios' },
  { href: '/cc1/inmuebles', t: 'Inmuebles' },
  { href: '/cc1', t: 'LOG' },
  { href: '/panel', t: 'Panel' },
  { href: '/alertas', t: 'Alertas' },
  { href: '/config', t: 'Config' },
  { href: '/admin', t: 'LOG' },
  { href: '/direccion', t: 'Dirección' },
  { href: '/procesos', t: 'Procesos' },
]

// Mapa único (catálogo + extra), ordenado por href más largo primero para que gane la coincidencia más específica.
const MAPA = [
  ...PROCESOS.filter(p => p.href).map(p => ({ href: p.href, t: p.titulo })),
  ...EXTRA,
].sort((a, b) => b.href.length - a.href.length)

function pretty(seg) {
  if (!seg) return ''
  return seg.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function labelFor(path) {
  if (!path || path === '/') return 'CRM'
  const hit = MAPA.find(m => path === m.href || path.startsWith(m.href + '/'))
  if (hit) return hit.t
  const segs = path.split('/').filter(Boolean)
  return segs.length ? pretty(segs[segs.length - 1]) : 'CRM'
}

export default function TabTitle() {
  const path = usePathname()
  useEffect(() => {
    const label = labelFor(path)
    document.title = label ? `${label} · CRM FCR` : 'CRM FCR'
  }, [path])
  return null
}
