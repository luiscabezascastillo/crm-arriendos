// VERSION: v2 · 2026-07-26 · FinancieroNav: se pega DEBAJO del TopNav (top medido, no 0).
//   El v1 usaba top: 0, que es la misma coordenada a la que ya esta clavado el TopNav:
//   al hacer scroll la barra se metia detras (el TopNav tiene mas z-index) y desaparecia
//   en TODAS las pantallas financieras. Ahora mide la altura de las barras superiores
//   pegajosas y se coloca justo debajo. Sin numeros fijos: si el TopNav cambia de alto
//   (movil, wrap, menu desplegado) se recalcula solo via ResizeObserver.
//
// Barra de pestañas (icono + texto) que va bajo el TopNav en todas las
// pantallas financieras. Resalta la activa; las sin ruta se ven en gris.
// Uso: <FinancieroNav activo="ventas" />  (el 'activo' = id del módulo actual)
'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useLayoutEffect, useRef } from 'react'

// useLayoutEffect avisa en SSR; en servidor cae a useEffect.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

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
  const ref = useRef(null)
  const [isMobile, setIsMobile] = useState(false)
  const [top, setTop] = useState(0)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check(); window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Suma la altura de TODOS los hermanos anteriores que sean sticky/fixed
  // (normalmente solo el TopNav) y se pega justo debajo.
  useIsoLayoutEffect(() => {
    const medir = () => {
      let alto = 0
      let el = ref.current?.previousElementSibling
      while (el) {
        const pos = window.getComputedStyle(el).position
        if (pos === 'sticky' || pos === 'fixed') {
          alto += Math.round(el.getBoundingClientRect().height)
        }
        el = el.previousElementSibling
      }
      setTop(alto)
    }

    medir()
    window.addEventListener('resize', medir)
    const t = setTimeout(medir, 300)   // por si las fuentes recolocan el TopNav

    let ro = null
    const prev = ref.current?.previousElementSibling
    if (prev && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(medir)
      ro.observe(prev)
    }

    return () => {
      window.removeEventListener('resize', medir)
      clearTimeout(t)
      if (ro) ro.disconnect()
    }
  }, [])

  return (
    <div ref={ref} style={{
      position: 'sticky', top, zIndex: 20, background: '#fff',
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
