// VERSION: v1 · 2026-07-26 · Subnavegación de Financiero.
// Barra de pestañas (icono + texto) que va bajo el TopNav en todas las
// pantallas financieras. Resalta la activa; las sin ruta se ven en gris.
// Uso: <FinancieroNav activo="ventas" />  (el 'activo' = id del módulo actual)
'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

const MODULOS = [
  { id: 'ventas',         icon: '🧾', label: 'Ventas',      href: '/procesos/financiero/ventas' },
  { id: 'compras',        icon: '📥', label: 'Compras',     href: '/procesos/financiero/compras' },
  { id: 'honorarios',     icon: '👤', label: 'Honorarios',  href: '/procesos/financiero/honorarios' },
  { id: 'remuneraciones', icon: '💰', label: 'Remuner.',    href: '/procesos/financiero/remuneraciones' },
  { id: 'caja-chica',     icon: '🪙', label: 'Caja Chica',  href: '/procesos/financiero/caja-chica' },
  { id: 'sa',             icon: '🏦', label: 'B. Santander', href: '/procesos/financiero/sa' },
  { id: 'sii',            icon: '📋', label: 'SII',         href: '/procesos/financiero/sii' },
  { id: 'global66',       icon: '🌐', label: 'Global',      href: '/procesos/financiero/global66' },
  { id: 'dj1835',         icon: '🏘️', label: 'DJ 1835',     href: '/procesos/financiero/dj1835' },
  { id: 'contab',         icon: '📊', label: 'CONTAB',      href: '/procesos/financiero/contab' },
]

const VERDE = '#085041'
const VERDE_CLARO = '#E1F5EE'
const BORDE = '#E5E4DF'
const TENUE = '#888780'

export default function FinancieroNav({ activo }) {
  const router = useRouter()
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check(); window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 30, background: '#fff',
      borderBottom: `1px solid ${BORDE}`, overflowX: 'auto',
    }}>
      <div style={{
        maxWidth: 1400, margin: '0 auto', display: 'flex', gap: 2,
        padding: isMobile ? '0 8px' : '0 20px', minWidth: 'max-content',
      }}>
        <button
          onClick={() => router.push('/procesos/financiero')}
          title="Volver a Financiero"
          style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '11px 12px',
            border: 'none', borderBottom: '2px solid transparent', background: 'transparent',
            cursor: 'pointer', color: TENUE, fontSize: 13, whiteSpace: 'nowrap',
          }}
        >← Financiero</button>

        {MODULOS.map(m => {
          const isActivo = m.id === activo
          return (
            <button
              key={m.id}
              onClick={() => !isActivo && router.push(m.href)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '11px 12px',
                border: 'none', borderBottom: `2px solid ${isActivo ? VERDE : 'transparent'}`,
                background: isActivo ? VERDE_CLARO : 'transparent',
                cursor: isActivo ? 'default' : 'pointer',
                color: isActivo ? VERDE : '#2C2C2A',
                fontSize: 13, fontWeight: isActivo ? 600 : 400, whiteSpace: 'nowrap',
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => { if (!isActivo) e.currentTarget.style.background = '#F7F6F2' }}
              onMouseLeave={e => { if (!isActivo) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ fontSize: 15 }}>{m.icon}</span>
              <span>{m.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
