'use client'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/dashboard',     icon: 'ti-layout-dashboard', label: 'Dashboard' },
  { href: '/propiedades',   icon: 'ti-building',         label: 'Mis propiedades' },
  { href: '/liquidaciones', icon: 'ti-file-invoice',     label: 'Liquidaciones' },
  { href: '/contratos',     icon: 'ti-file-text',        label: 'Contratos' },
  { href: '/facturas',      icon: 'ti-receipt',          label: 'Facturas' },
  { href: '/dj1835',        icon: 'ti-chart-bar',        label: 'DJ 1835 · SII' },
]

export default function Sidebar({ idprop, nombre }: { idprop: string; nombre: string }) {
  const pathname = usePathname()

  return (
    <aside style={{ background: '#0F1923', width: 210, minHeight: '100vh', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      {/* Logo */}
      <div style={{ padding: '1.2rem', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
          <path d="M8 28V10L16 4L24 10V16H20V28H8Z" fill="#2B6CB8"/>
          <rect x="12" y="18" width="4" height="10" fill="white"/>
        </svg>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 13, letterSpacing: 1 }}>FONDO CAPITAL</span>
      </div>

      {/* Usuario */}
      <div style={{ margin: '0.8rem', background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 12px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{nombre}</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{idprop} · Propietario</div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '0 0.8rem' }}>
        <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1.5, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', padding: '0.8rem 0.5rem 0.4rem' }}>Principal</div>
        {NAV.slice(0, 2).map(item => (
          <a key={item.href} href={item.href} style={{
            display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 7,
            fontSize: 12, fontWeight: 500, textDecoration: 'none', marginBottom: 1,
            background: pathname === item.href ? 'rgba(43,108,184,0.25)' : 'transparent',
            color: pathname === item.href ? '#fff' : 'rgba(255,255,255,0.55)',
          }}>
            <i className={`ti ${item.icon}`} style={{ fontSize: 16, color: pathname === item.href ? '#2B6CB8' : 'inherit' }} aria-hidden="true"/>
            {item.label}
          </a>
        ))}

        <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1.5, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', padding: '0.8rem 0.5rem 0.4rem' }}>Documentos</div>
        {NAV.slice(2, 5).map(item => (
          <a key={item.href} href={item.href} style={{
            display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 7,
            fontSize: 12, fontWeight: 500, textDecoration: 'none', marginBottom: 1,
            background: pathname === item.href ? 'rgba(43,108,184,0.25)' : 'transparent',
            color: pathname === item.href ? '#fff' : 'rgba(255,255,255,0.55)',
          }}>
            <i className={`ti ${item.icon}`} style={{ fontSize: 16, color: pathname === item.href ? '#2B6CB8' : 'inherit' }} aria-hidden="true"/>
            {item.label}
          </a>
        ))}

        <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1.5, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', padding: '0.8rem 0.5rem 0.4rem' }}>Fiscal</div>
        {NAV.slice(5).map(item => (
          <a key={item.href} href={item.href} style={{
            display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 7,
            fontSize: 12, fontWeight: 500, textDecoration: 'none', marginBottom: 1,
            background: pathname === item.href ? 'rgba(43,108,184,0.25)' : 'transparent',
            color: pathname === item.href ? '#fff' : 'rgba(255,255,255,0.55)',
          }}>
            <i className={`ti ${item.icon}`} style={{ fontSize: 16, color: pathname === item.href ? '#2B6CB8' : 'inherit' }} aria-hidden="true"/>
            {item.label}
          </a>
        ))}
      </nav>

      {/* Logout */}
      <div style={{ padding: '0.8rem' }}>
        <a href="/api/auth/logout" style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 7,
          fontSize: 12, color: 'rgba(255,255,255,0.3)', textDecoration: 'none',
        }}>
          <i className="ti ti-logout" style={{ fontSize: 15 }} aria-hidden="true"/>
          Cerrar sesión
        </a>
      </div>
    </aside>
  )
}

