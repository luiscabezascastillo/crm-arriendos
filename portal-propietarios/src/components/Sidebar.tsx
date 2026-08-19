// VERSION: v3 · 2026-08-19 · Sidebar en AZUL INSTITUCIONAL (degradado profundo anclado en #2B6CB8), en vez del casi
//   negro. Ítem activo más marcado (barra lateral + fondo), logo en blanco, textos con más contraste. Se quitan las
//   etiquetas "Beta" del menú. Hereda v2.
// RUTA: portal-propietarios/src/components/Sidebar.tsx
'use client'
import { usePathname } from 'next/navigation'

type NavItem = { href: string; icon: string; label: string; dev?: boolean }

const NAV: NavItem[] = [
  { href: '/dashboard',     icon: 'ti-layout-dashboard', label: 'Dashboard' },
  { href: '/propiedades',   icon: 'ti-building',         label: 'Mis propiedades' },
  { href: '/liquidaciones', icon: 'ti-file-invoice',     label: 'Liquidaciones', dev: true },
  { href: '/contratos',     icon: 'ti-file-text',        label: 'Contratos' },
  { href: '/facturas',      icon: 'ti-receipt',          label: 'Facturas', dev: true },
  { href: '/dj1835',        icon: 'ti-chart-bar',        label: 'DJ 1835 · SII', dev: true },
]

const grpStyle: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: 'rgba(255,255,255,0.45)',
  textTransform: 'uppercase', padding: '0.8rem 0.5rem 0.4rem',
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <a href={item.href} style={{
      display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 7,
      fontSize: 12, fontWeight: active ? 600 : 500, textDecoration: 'none', marginBottom: 1,
      background: active ? 'rgba(255,255,255,0.16)' : 'transparent',
      boxShadow: active ? 'inset 2px 0 0 0 #BFDBFE' : 'none',
      color: active ? '#fff' : 'rgba(255,255,255,0.72)',
    }}>
      <i className={`ti ${item.icon}`} style={{ fontSize: 16, color: active ? '#BFDBFE' : 'inherit' }} aria-hidden="true" />
      <span style={{ flex: 1 }}>{item.label}</span>
    </a>
  )
}

export default function Sidebar({ idprop, nombre }: { idprop: string; nombre: string }) {
  const pathname = usePathname()

  return (
    <aside style={{ background: 'linear-gradient(180deg, #1D4E8F 0%, #143A6B 55%, #102E56 100%)', width: 210, minHeight: '100vh', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      {/* Logo */}
      <div style={{ padding: '1.2rem', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
        <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
          <path d="M8 28V10L16 4L24 10V16H20V28H8Z" fill="#fff"/>
          <rect x="12" y="18" width="4" height="10" fill="#1D4E8F"/>
        </svg>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 13, letterSpacing: 1 }}>FONDO CAPITAL</span>
      </div>

      {/* Usuario */}
      <div style={{ margin: '0.8rem', background: 'rgba(255,255,255,0.10)', borderRadius: 8, padding: '10px 12px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{nombre}</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{idprop} · Propietario</div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '0 0.8rem' }}>
        <div style={grpStyle}>Principal</div>
        {NAV.slice(0, 2).map(item => <NavLink key={item.href} item={item} active={pathname === item.href} />)}

        <div style={grpStyle}>Documentos</div>
        {NAV.slice(2, 5).map(item => <NavLink key={item.href} item={item} active={pathname === item.href} />)}

        <div style={grpStyle}>Fiscal</div>
        {NAV.slice(5).map(item => <NavLink key={item.href} item={item} active={pathname === item.href} />)}
      </nav>

      {/* Logout */}
      <div style={{ padding: '0.8rem' }}>
        <a href="/api/auth/logout" style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 7,
          fontSize: 12, color: 'rgba(255,255,255,0.55)', textDecoration: 'none',
        }}>
          <i className="ti ti-logout" style={{ fontSize: 15 }} aria-hidden="true" />
          Cerrar sesión
        </a>
      </div>
    </aside>
  )
}
