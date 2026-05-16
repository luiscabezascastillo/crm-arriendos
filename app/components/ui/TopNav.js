'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { label: 'Panel',           href: '/panel' },
  { label: 'CC1 Admin',       href: '/cc1' },
  { label: 'CC2 Arr. Admon',  href: '/cc2' },
  { label: 'CC3 Mant.',       href: '/cc3' },
  { label: 'BB1 Ventas',      href: '/bb1' },
  { label: 'BB2 Arriendos',   href: '/bb2' },
  { label: 'Config',          href: '/config' },
]

export function TopNav() {
  const pathname = usePathname()
  const enPublicaciones = pathname === '/publicaciones' || pathname.startsWith('/publicaciones/')

  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '0 20px',
      height: '52px',
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
    }}>

      {/* Logo */}
      <Link href="/panel" style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        textDecoration: 'none', marginRight: '8px',
      }}>
        <div style={{
          width: 30, height: 30,
          background: 'var(--brand-600)',
          borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"
              stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <span style={{
          fontSize: '13px', fontWeight: 600,
          color: 'var(--gray-800)', letterSpacing: '-0.2px',
        }}>
          CRM Arriendos
        </span>
      </Link>

      {/* Links */}
      <div style={{ display: 'flex', gap: '2px', flex: 1 }}>
        {navItems.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link key={item.href} href={item.href} style={{
              padding: '5px 11px',
              borderRadius: 7,
              fontSize: '12px',
              fontWeight: active ? 500 : 400,
              color: active ? 'var(--brand-700)' : 'var(--gray-500)',
              background: active ? 'var(--brand-50)' : 'transparent',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              transition: 'background 0.12s, color 0.12s',
            }}>
              {item.label}
            </Link>
          )
        })}
      </div>

      {/* Publicaciones — botón destacado */}
      <Link href="/publicaciones" style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 14px',
        borderRadius: 8,
        fontSize: '12px',
        fontWeight: 600,
        color: enPublicaciones ? '#fff' : '#1a56db',
        background: enPublicaciones ? '#1a56db' : '#eff6ff',
        border: '1px solid #1a56db',
        textDecoration: 'none',
        whiteSpace: 'nowrap',
        transition: 'background 0.12s, color 0.12s',
        marginRight: 8,
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Publicaciones
      </Link>

      {/* Avatar */}
      <div title="cabez@fondocapital.com" style={{
        width: 32, height: 32, borderRadius: '50%',
        background: 'var(--brand-50)',
        border: '1px solid var(--brand-100)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '11px', fontWeight: 600,
        color: 'var(--brand-600)', cursor: 'pointer', flexShrink: 0,
      }}>
        CA
      </div>
    </nav>
  )
}