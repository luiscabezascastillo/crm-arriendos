'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import TopNav from '@/app/components/ui/TopNav'

const SUBPROCESOS = [
  { icon: '🧾', titulo: 'Cargar Ventas mes con CCB',                 desc: 'Importar las ventas del mes y asignar Centro de Coste/Beneficio', cadencia: 'mensual', href: '/procesos/financiero/ventas' },
  { icon: '📥', titulo: 'Cargar Compras mes con CCB',                desc: 'Importar las compras del mes y asignar CCB',                     cadencia: 'mensual', href: '/procesos/financiero/compras' },
  { icon: '👤', titulo: 'Cargar Boletas honorarios con CCB',         desc: 'Boletas de honorarios del mes con su CCB',                       cadencia: 'mensual', href: '/procesos/financiero/honorarios' },
  { icon: '💰', titulo: 'Cargar Remuneraciones con CCB',             desc: 'Remuneraciones del mes con CCB asignado',                        cadencia: 'mensual', href: '/procesos/financiero/remuneraciones' },
  { icon: '🏦', titulo: 'Cargar SA con CCB',                         desc: 'Movimientos del Banco Santander con CCB',                        cadencia: 'semanal', href: '/procesos/financiero/sa' },
  { icon: '🪙', titulo: 'Cargar Caja Chica con CCB',                 desc: 'Movimientos de caja chica con CCB',                              cadencia: 'mensual', href: '/procesos/financiero/caja-chica' },
  { icon: '🌐', titulo: 'Cargar Global 66 con CCB',                  desc: 'Movimientos de la cuenta Global 66 con CCB',                     cadencia: 'mensual', href: '/procesos/financiero/global66' },
  { icon: '🏛️', titulo: 'Cargar Internacional con CCB',             desc: 'Movimientos del Banco Internacional con CCB',                    cadencia: 'mensual', href: '/procesos/financiero/internacional' },
  { icon: '📤', titulo: 'Cargar liquidaciones en Portal Propietarios', desc: 'Subir las liquidaciones de propietarios al Portal',             cadencia: 'mensual', href: '/procesos/financiero/liquidaciones-portal', muted: true },
  { icon: '📋', titulo: 'Cargar datos SII (F29 y similares)',        desc: 'Cargar F29 y declaraciones del SII',                             cadencia: 'mensual', href: '/procesos/financiero/sii' },
]

const CAD_BADGE = {
  mensual: { bg: '#E6F1FB', color: '#0C447C' },
  semanal: { bg: '#E1F5EE', color: '#085041' },
}

function SubCard({ sub, onClick, isMobile }) {
  const badge = CAD_BADGE[sub.cadencia] || CAD_BADGE.mensual
  const muted = sub.muted
  return (
    <div onClick={() => onClick(sub.href)}
      style={{
        background: muted ? '#F0EFEA' : '#fff',
        border: '0.5px solid #B4B2A9',
        borderLeft: muted ? '3px solid #B4B2A9' : '3px solid #1D9E75',
        borderRadius: '0 10px 10px 0',
        padding: isMobile ? '12px 13px' : '13px 15px',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#888780' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#B4B2A9' }}>
      <span style={{ fontSize: 22, flexShrink: 0, opacity: muted ? 0.6 : 1 }}>{sub.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: muted ? '#888780' : '#2C2C2A' }}>{sub.titulo}</span>
          <span style={{ fontSize: 10, fontWeight: 500, padding: '1px 8px', borderRadius: 20, background: badge.bg, color: badge.color }}>{sub.cadencia}</span>
        </div>
        <div style={{ fontSize: 12, color: '#888780', marginTop: 3, lineHeight: 1.4 }}>{sub.desc}</div>
      </div>
      <span style={{ fontSize: 16, color: '#B4B2A9', flexShrink: 0 }}>→</span>
    </div>
  )
}

export default function FinancieroPage() {
  const { status } = useSession()
  const router = useRouter()
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/api/auth/signin')
  }, [status, router])

  const go = (href) => router.push(href)

  if (status === 'loading') {
    return (
      <>
        <TopNav />
        <div style={{ padding: 60, textAlign: 'center', color: '#888', fontSize: 14 }}>Cargando…</div>
      </>
    )
  }

  return (
    <>
      <TopNav />
      <div style={{ maxWidth: 860, margin: '0 auto', padding: isMobile ? '16px 14px 40px' : '20px 24px 40px' }}>

        {/* CABECERA */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 10 }}>
          <div>
            <h1 style={{ fontSize: isMobile ? 18 : 20, fontWeight: 600, margin: '0 0 2px', color: '#2C2C2A' }}>Financiero</h1>
            <div style={{ fontSize: 12, color: '#888780' }}>Cargas contables con CCB · elige un subproceso</div>
          </div>
          <button onClick={() => router.push('/procesos')}
            style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, border: '0.5px solid #D3D1C7', background: '#fff', cursor: 'pointer', color: '#2C2C2A', whiteSpace: 'nowrap' }}>
            ← Procesos
          </button>
        </div>

        {/* SUBPROCESOS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SUBPROCESOS.map((s, i) => (
            <SubCard key={i} sub={s} onClick={go} isMobile={isMobile} />
          ))}
        </div>

      </div>
    </>
  )
}
