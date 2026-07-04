'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabaseClient'
import TopNav from '@/app/components/ui/TopNav'

const DIRECCION_EMAILS = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']

export default function EmailsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const email = session?.user?.email
  const rol = session?.user?.role
  const [accesoOk, setAccesoOk] = useState(null)

  useEffect(() => {
    if (status !== 'authenticated' || !email) return
    if (rol === 'admin' || DIRECCION_EMAILS.includes(email)) { setAccesoOk(true); return }
    supabase.from('proceso_permisos').select('proceso').eq('email', email).eq('activo', true)
      .then(({ data }) => setAccesoOk(!!(data || []).some(p => (p.proceso || '').toLowerCase().includes('liquidac'))))
  }, [status, email, rol])
  useEffect(() => { if (accesoOk === false) router.replace('/') }, [accesoOk, router])

  if (status === 'loading' || accesoOk === null) return (<><TopNav /><div style={{ padding: 40, color: '#888' }}>Cargando…</div></>)
  if (accesoOk === false) return null

  const navBtn = (label, href, activo) => (
    <button onClick={() => router.push(href)}
      style={{ fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 8,
        border: '1px solid ' + (activo ? '#A7F3D0' : '#D3D1C7'),
        background: activo ? '#ECFDF5' : '#fff', color: activo ? '#065F46' : '#2C2C2A', cursor: 'pointer' }}>
      {label}
    </button>
  )

  return (
    <>
      <TopNav />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24, fontFamily: '"DM Sans", sans-serif' }}>

        {/* Barra de navegación TRANSFER · CARTAS · EMAILS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
          {navBtn('← TRANSFER', '/procesos/liquidaciones', false)}
          {navBtn('📄 CARTAS', '/procesos/liquidaciones/cartas', false)}
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>EMAILS · envío de liquidaciones</h1>
        </div>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>
          Envío de las cartas de liquidación a los propietarios por email (PDF adjunto + candado anti-reenvío).
        </div>

        {/* Aviso: módulo en construcción */}
        <div style={{ background: '#FEF9C3', border: '1px solid #FDE68A', borderRadius: 12, padding: '18px 20px', color: '#92400E' }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>🚧 Módulo en construcción</div>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>
            EMAILS será la hoja dedicada al envío de las liquidaciones (selección · vista previa ·
            confirmación · PDF por email · candado). Mientras terminamos de montarlo aquí, el envío
            sigue disponible dentro de la hoja <b>CARTAS</b>.
          </div>
          <div style={{ marginTop: 14 }}>
            <button onClick={() => router.push('/procesos/liquidaciones/cartas')}
              style={{ fontSize: 13, fontWeight: 700, padding: '8px 16px', borderRadius: 8, border: 'none',
                background: '#1D9E75', color: '#fff', cursor: 'pointer' }}>
              Ir a CARTAS →
            </button>
          </div>
        </div>

      </div>
    </>
  )
}
