'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function SinAcceso() {
  const { data: session } = useSession()
  const router = useRouter()
  const rol = session?.user?.role

  // A dónde mandar a cada rol cuando llega aquí
  const destino =
    rol === 'ventas' ? { href: '/procesos', label: 'Ir a Procesos' }
    : rol === 'comercial' ? { href: '/publicaciones', label: 'Ir a Publicaciones' }
    : { href: '/panel', label: 'Ir al Panel' }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F6F2', fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <div style={{ background: '#fff', border: '1px solid #E5E3DB', borderRadius: 16, padding: '40px 36px', maxWidth: 440, textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#2C2C2A', margin: '0 0 10px' }}>No tienes acceso a esta sección</h1>
        <p style={{ fontSize: 14, color: '#5F5E5A', lineHeight: 1.5, margin: '0 0 24px' }}>
          Tu cuenta no tiene permiso para ver esta parte del CRM. Si crees que deberías tener acceso, comunícate con la dirección.
        </p>
        <button
          onClick={() => router.push(destino.href)}
          style={{ fontSize: 14, fontWeight: 500, padding: '10px 20px', borderRadius: 8, border: 'none', background: '#1D9E75', color: '#fff', cursor: 'pointer' }}>
          {destino.label}
        </button>
      </div>
    </div>
  )
}