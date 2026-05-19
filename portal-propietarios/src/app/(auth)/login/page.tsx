'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [primerAcceso, setPrimerAcceso] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'PRIMER_ACCESO') setPrimerAcceso(true)
        else setError(data.error || 'Error al iniciar sesión')
        return
      }
      router.push('/dashboard')
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (newPassword.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return }
    if (newPassword !== confirmPassword) { setError('Las contraseñas no coinciden'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: newPassword }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error al establecer contraseña'); return }
      router.push('/dashboard')
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const panelIzquierdo = {
    position: 'relative' as const,
    overflow: 'hidden' as const,
    background: 'linear-gradient(160deg, #0B1E35 0%, #0F2D4A 40%, #132840 70%, #0A1A2B 100%)',
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'space-between',
    padding: '2rem',
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>

      {/* Panel izquierdo */}
      <div style={panelIzquierdo}>

        {/* Grid de fondo */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(43,108,184,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(43,108,184,0.06) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}/>

        {/* Skyline SVG */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
          <svg viewBox="0 0 400 180" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMax slice" style={{ width: '100%' }}>
            <rect x="0" y="110" width="30" height="70" fill="rgba(255,255,255,0.04)"/>
            <rect x="25" y="90" width="20" height="90" fill="rgba(255,255,255,0.04)"/>
            <rect x="40" y="100" width="25" height="80" fill="rgba(255,255,255,0.04)"/>
            <rect x="60" y="75" width="18" height="105" fill="rgba(255,255,255,0.05)"/>
            <rect x="310" y="80" width="20" height="100" fill="rgba(255,255,255,0.04)"/>
            <rect x="325" y="95" width="30" height="85" fill="rgba(255,255,255,0.04)"/>
            <rect x="350" y="70" width="18" height="110" fill="rgba(255,255,255,0.05)"/>
            <rect x="383" y="100" width="17" height="80" fill="rgba(255,255,255,0.04)"/>
            <rect x="165" y="20" width="22" height="160" fill="rgba(43,108,184,0.15)" stroke="rgba(43,108,184,0.3)" strokeWidth="0.5"/>
            <rect x="163" y="15" width="2" height="8" fill="rgba(255,255,255,0.4)"/>
            <rect x="168" y="35" width="3" height="4" fill="rgba(255,220,100,0.3)"/>
            <rect x="173" y="35" width="3" height="4" fill="rgba(255,220,100,0.5)"/>
            <rect x="178" y="35" width="3" height="4" fill="rgba(255,220,100,0.2)"/>
            <rect x="168" y="45" width="3" height="4" fill="rgba(255,220,100,0.4)"/>
            <rect x="173" y="45" width="3" height="4" fill="rgba(255,220,100,0.2)"/>
            <rect x="178" y="45" width="3" height="4" fill="rgba(255,220,100,0.6)"/>
            <rect x="168" y="55" width="3" height="4" fill="rgba(255,220,100,0.3)"/>
            <rect x="173" y="55" width="3" height="4" fill="rgba(255,220,100,0.5)"/>
            <rect x="200" y="30" width="28" height="150" fill="rgba(43,108,184,0.12)" stroke="rgba(43,108,184,0.25)" strokeWidth="0.5"/>
            <rect x="211" y="10" width="6" height="10" fill="rgba(43,108,184,0.3)"/>
            <rect x="213" y="5" width="2" height="7" fill="rgba(255,255,255,0.5)"/>
            <rect x="203" y="40" width="4" height="5" fill="rgba(255,220,100,0.4)"/>
            <rect x="209" y="40" width="4" height="5" fill="rgba(255,220,100,0.2)"/>
            <rect x="215" y="40" width="4" height="5" fill="rgba(255,220,100,0.5)"/>
            <rect x="221" y="40" width="4" height="5" fill="rgba(255,220,100,0.3)"/>
            <rect x="203" y="52" width="4" height="5" fill="rgba(255,220,100,0.3)"/>
            <rect x="209" y="52" width="4" height="5" fill="rgba(255,220,100,0.5)"/>
            <rect x="215" y="52" width="4" height="5" fill="rgba(255,220,100,0.2)"/>
            <rect x="221" y="52" width="4" height="5" fill="rgba(255,220,100,0.4)"/>
            <rect x="130" y="60" width="30" height="120" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5"/>
            <rect x="132" y="65" width="5" height="6" fill="rgba(255,220,100,0.25)"/>
            <rect x="139" y="65" width="5" height="6" fill="rgba(255,220,100,0.4)"/>
            <rect x="146" y="65" width="5" height="6" fill="rgba(255,220,100,0.2)"/>
            <rect x="240" y="55" width="32" height="125" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5"/>
            <rect x="243" y="62" width="5" height="6" fill="rgba(255,220,100,0.3)"/>
            <rect x="250" y="62" width="5" height="6" fill="rgba(255,220,100,0.2)"/>
            <rect x="257" y="62" width="5" height="6" fill="rgba(255,220,100,0.45)"/>
            <rect x="95" y="85" width="28" height="95" fill="rgba(255,255,255,0.06)"/>
            <rect x="280" y="80" width="26" height="100" fill="rgba(255,255,255,0.06)"/>
            <rect x="0" y="175" width="400" height="5" fill="rgba(43,108,184,0.15)"/>
          </svg>
        </div>

        {/* Resplandor */}
        <div style={{
          position: 'absolute', bottom: 60, left: '50%', transform: 'translateX(-50%)',
          width: 200, height: 80,
          background: 'radial-gradient(ellipse, rgba(43,108,184,0.2) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}/>

        {/* Logo */}
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="72" height="72" viewBox="0 0 32 32" fill="none">
            <path d="M8 28V10L16 4L24 10V16H20V28H8Z" fill="#2B6CB8"/>
            <rect x="12" y="18" width="4" height="10" fill="white"/>
            <rect x="17" y="14" width="4" height="14" fill="white" opacity="0.6"/>
          </svg>
          <span style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: 2 }}>FONDO CAPITAL</span>
        </div>

        {/* Tagline + pills */}
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ fontSize: 26, fontWeight: 600, color: '#fff', lineHeight: 1.2, marginBottom: '1.5rem' }}>
            Tu portal de<br/><span style={{ color: '#5BA3E8' }}>propietario</span><br/>siempre disponible
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { icon: 'ti-file-invoice', text: 'Liquidaciones mensuales descargables' },
              { icon: 'ti-building',     text: 'Estado actualizado de tus propiedades' },
              { icon: 'ti-receipt',      text: 'Contratos y facturas en un clic' },
              { icon: 'ti-chart-bar',    text: 'Seguimiento DJ 1835 · SII Chile' },
            ].map(item => (
              <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'rgba(255,255,255,0.6)', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <i className={`ti ${item.icon}`} style={{ color: '#5BA3E8', fontSize: 15, flexShrink: 0 }} aria-hidden="true"/>
                {item.text}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ position: 'relative', zIndex: 2, fontSize: 10, color: 'rgba(255,255,255,0.2)', letterSpacing: '.3px' }}>
          © {new Date().getFullYear()} Fondo Capital · Área privada · Conexión segura
        </div>
      </div>

      {/* Panel derecho */}
      <div style={{ background: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '3rem 2.5rem' }}>
        {!primerAcceso ? (
          <>
            <div style={{ fontSize: 22, fontWeight: 600, color: '#111827', marginBottom: 4 }}>Acceder al portal</div>
            <div style={{ fontSize: 13, color: '#6B7280', marginBottom: '2rem' }}>Introduce tus credenciales para entrar a tu área privada</div>
            <form onSubmit={handleLogin}>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#111827', display: 'block', marginBottom: 5 }}>Correo electrónico</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" required
                style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 12px', fontSize: 14, marginBottom: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const }}/>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#111827', display: 'block', marginBottom: 5 }}>Contraseña</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required
                style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 12px', fontSize: 14, marginBottom: 6, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const }}/>
              <div style={{ textAlign: 'right', marginBottom: 16 }}>
                <span style={{ fontSize: 12, color: '#2B6CB8', cursor: 'pointer' }}>¿Olvidaste tu contraseña?</span>
              </div>
              {error && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#DC2626', marginBottom: 14 }}>
                  {error}
                </div>
              )}
              <button type="submit" disabled={loading}
                style={{ width: '100%', background: loading ? '#93C5FD' : '#2B6CB8', color: '#fff', border: 'none', borderRadius: 8, padding: 12, fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                {loading ? 'Entrando...' : 'Entrar →'}
              </button>
            </form>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#9CA3AF', marginTop: '1.5rem' }}>
              🔒 Conexión segura · Datos cifrados
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 22, fontWeight: 600, color: '#111827', marginBottom: 4 }}>Bienvenido/a</div>
            <div style={{ fontSize: 13, color: '#6B7280', marginBottom: '2rem' }}>Es tu primer acceso. Establece tu contraseña personal para continuar.</div>
            <form onSubmit={handleSetPassword}>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#111827', display: 'block', marginBottom: 5 }}>Nueva contraseña</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 8 caracteres" required
                style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 12px', fontSize: 14, marginBottom: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const }}/>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#111827', display: 'block', marginBottom: 5 }}>Confirmar contraseña</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repite la contraseña" required
                style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 12px', fontSize: 14, marginBottom: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const }}/>
              {error && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#DC2626', marginBottom: 14 }}>
                  {error}
                </div>
              )}
              <button type="submit" disabled={loading}
                style={{ width: '100%', background: loading ? '#93C5FD' : '#2B6CB8', color: '#fff', border: 'none', borderRadius: 8, padding: 12, fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                {loading ? 'Guardando...' : 'Establecer contraseña →'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}






