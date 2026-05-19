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
        if (data.error === 'PRIMER_ACCESO') {
          setPrimerAcceso(true)
        } else {
          setError(data.error || 'Error al iniciar sesión')
        }
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

    if (newPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: newPassword }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Error al establecer contraseña')
        return
      }

      router.push('/dashboard')
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      {/* Panel izquierdo */}
      <div style={{ background: '#0F1923', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M8 28V10L16 4L24 10V16H20V28H8Z" fill="#2B6CB8"/>
            <rect x="12" y="18" width="4" height="10" fill="white"/>
            <rect x="17" y="14" width="4" height="14" fill="white" opacity="0.6"/>
          </svg>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: 1 }}>FONDO CAPITAL</span>
        </div>

        <div>
          <div style={{ fontSize: 24, fontWeight: 600, color: '#fff', lineHeight: 1.3, marginBottom: '1.5rem' }}>
            Tu portal de<br /><span style={{ color: '#2B6CB8' }}>propietario</span><br />siempre disponible
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              'Liquidaciones mensuales descargables',
              'Estado actualizado de tus propiedades',
              'Contratos y facturas en un clic',
              'Seguimiento DJ 1835 · SII Chile',
            ].map((item) => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'rgba(255,255,255,0.55)', paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ color: '#2B6CB8', fontSize: 16 }}>✓</span>
                {item}
              </div>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
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
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 12px', fontSize: 14, marginBottom: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
              />

              <label style={{ fontSize: 12, fontWeight: 500, color: '#111827', display: 'block', marginBottom: 5 }}>Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 12px', fontSize: 14, marginBottom: 6, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
              />

              <div style={{ textAlign: 'right', marginBottom: 16 }}>
                <span style={{ fontSize: 12, color: '#2B6CB8', cursor: 'pointer' }}>¿Olvidaste tu contraseña?</span>
              </div>

              {error && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#DC2626', marginBottom: 14 }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{ width: '100%', background: loading ? '#93C5FD' : '#2B6CB8', color: '#fff', border: 'none', borderRadius: 8, padding: 12, fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
              >
                {loading ? 'Entrando...' : 'Entrar →'}
              </button>
            </form>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#9CA3AF', marginTop: '1.5rem' }}>
              <span>🔒</span> Conexión segura · Datos cifrados
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 22, fontWeight: 600, color: '#111827', marginBottom: 4 }}>Bienvenido/a</div>
            <div style={{ fontSize: 13, color: '#6B7280', marginBottom: '2rem' }}>
              Es tu primer acceso. Por favor establece tu contraseña personal para continuar.
            </div>

            <form onSubmit={handleSetPassword}>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#111827', display: 'block', marginBottom: 5 }}>Nueva contraseña</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                required
                style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 12px', fontSize: 14, marginBottom: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
              />

              <label style={{ fontSize: 12, fontWeight: 500, color: '#111827', display: 'block', marginBottom: 5 }}>Confirmar contraseña</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repite la contraseña"
                required
                style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 12px', fontSize: 14, marginBottom: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
              />

              {error && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#DC2626', marginBottom: 14 }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{ width: '100%', background: loading ? '#93C5FD' : '#2B6CB8', color: '#fff', border: 'none', borderRadius: 8, padding: 12, fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
              >
                {loading ? 'Guardando...' : 'Establecer contraseña →'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
