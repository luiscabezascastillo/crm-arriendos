'use client'

import { signIn } from 'next-auth/react'

export default function LoginPage() {
  return (
    <main style={{
      minHeight: '100vh',
      background: 'var(--background)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      position: 'relative',
    }}>

      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(circle at 1px 1px, var(--gray-200) 1px, transparent 0)',
        backgroundSize: '28px 28px',
        opacity: 0.6,
      }} />

      <div className="anim-fade-up" style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '40px 44px',
        width: '100%',
        maxWidth: '390px',
        position: 'relative',
        zIndex: 1,
      }}>

        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: 52, height: 52,
            background: 'var(--brand-600)',
            marginBottom: 14,
          }}>
            <img src="/logo-fcr.png" alt="Fondo Capital" style={{ width: 120, height: "auto" }} />
          </div>
          <h1 style={{
            fontSize: '22px', fontWeight: 600,
            color: 'var(--gray-900)', margin: '0 0 4px',
            letterSpacing: '-0.3px',
          }}>
            CRM Arriendos
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--gray-500)', margin: 0 }}>
            Fondo Capital � Gesti�n de propiedades
          </p>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', marginBottom: '26px' }} />

        <p style={{
          fontSize: '12px', color: 'var(--gray-400)',
          marginBottom: '14px', textAlign: 'center',
        }}>
          Accede con tu cuenta corporativa
        </p>

        <button
          onClick={() => signIn('google', { callbackUrl: '/panel' })}
          style={{
            width: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '10px',
            padding: '11px 16px',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            background: 'var(--surface)',
            fontSize: '14px', fontWeight: 500,
            color: 'var(--gray-800)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'background 0.15s, border-color 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--gray-50)'
            e.currentTarget.style.borderColor = 'var(--gray-300)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'var(--surface)'
            e.currentTarget.style.borderColor = 'var(--border)'
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continuar con Google Workspace
        </button>

        <div style={{ textAlign: 'center', marginTop: '18px' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: '11px', color: 'var(--gray-400)',
            background: 'var(--gray-50)',
            border: '1px solid var(--border)',
            borderRadius: '20px',
            padding: '3px 12px',
          }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2"/>
              <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Acceso restringido a @fondocapital.com
          </span>
        </div>

        <p style={{
          textAlign: 'center', marginTop: '30px',
          fontSize: '11px', color: 'var(--gray-300)',
        }}>
          CRM Arriendos · LOG 2.0.7
        </p>
      </div>
    </main>
  )
}


