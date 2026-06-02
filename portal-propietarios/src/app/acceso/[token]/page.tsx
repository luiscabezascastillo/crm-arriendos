'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'

export default function AccesoTokenPage() {
  const router = useRouter()
  const params = useParams()
  const token = params.token as string
  const [estado, setEstado] = useState<'cargando' | 'error'>('cargando')
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    if (!token) return
    async function validar() {
      try {
        const res = await fetch('/api/auth/acceso', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const data = await res.json()
        if (res.ok && data.ok) {
          router.replace('/dashboard')
        } else {
          setMensaje(data.error || 'Token invalido o expirado')
          setEstado('error')
        }
      } catch {
        setMensaje('Error de conexion. Intentalo de nuevo.')
        setEstado('error')
      }
    }
    validar()
  }, [token, router])

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#F9FAFB', fontFamily:"'DM Sans', sans-serif" }}>
      <div style={{ background:'#fff', borderRadius:16, padding:'3rem 2.5rem', boxShadow:'0 4px 24px rgba(0,0,0,0.08)', maxWidth:400, width:'90%', textAlign:'center' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:'2rem' }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M8 28V10L16 4L24 10V16H20V28H8Z" fill="#2B6CB8"/>
            <rect x="12" y="18" width="4" height="10" fill="white"/>
            <rect x="17" y="14" width="4" height="14" fill="white" opacity="0.6"/>
          </svg>
          <span style={{ fontSize:16, fontWeight:700, color:'#0F2D4A', letterSpacing:1 }}>FONDO CAPITAL</span>
        </div>
        {estado === 'cargando' ? (
          <>
            <div style={{ width:48, height:48, border:'3px solid #E5E7EB', borderTopColor:'#2B6CB8', borderRadius:'50%', margin:'0 auto 1.5rem', animation:'spin 0.8s linear infinite' }}/>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            <div style={{ fontSize:16, fontWeight:600, color:'#111827', marginBottom:8 }}>Verificando acceso...</div>
            <div style={{ fontSize:13, color:'#6B7280' }}>Estamos validando tu enlace</div>
          </>
        ) : (
          <>
            <div style={{ fontSize:40, marginBottom:'1rem' }}>⚠️</div>
            <div style={{ fontSize:16, fontWeight:600, color:'#111827', marginBottom:8 }}>Enlace no valido</div>
            <div style={{ fontSize:13, color:'#6B7280', marginBottom:'2rem' }}>{mensaje}</div>
            <button onClick={() => router.push('/login')} style={{ background:'#2B6CB8', color:'#fff', border:'none', borderRadius:8, padding:'10px 24px', fontSize:14, fontWeight:600, cursor:'pointer' }}>
              Ir al login
            </button>
          </>
        )}
      </div>
    </div>
  )
}