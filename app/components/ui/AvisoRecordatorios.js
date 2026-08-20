// RUTA: app/components/ui/AvisoRecordatorios.js
// VERSION: v1 · 2026-08-18 · Aviso de RECORDATORIOS personales del usuario (cada uno los suyos). Mismo estilo que
//   AvisoPagos pero con color propio por persona (Luis azul · Alberto teal). Solo se muestra a quien tiene la
//   función activada (RECORDATORIOS_USERS) y solo si tiene recordatorios pendientes. Enlaza a su página de gestión.
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

// Quién tiene recordatorios personales (extensible). Color del aviso por persona.
const COLORES = {
  'luis.cabezas@fondocapital.com':    { bg: '#EFF6FF', bd: '#93C5FD', fg: '#1D4ED8', ico: '🔔', btn: '#1D4ED8' },
  'alberto.cabezas@fondocapital.com': { bg: '#F0FDFA', bd: '#5EEAD4', fg: '#0F766E', ico: '🔔', btn: '#0D9488' },
}
const fmtFecha = (s) => {
  if (!s) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s)); return m ? `${m[3]}/${m[2]}/${m[1]}` : String(s)
}

export default function AvisoRecordatorios() {
  const router = useRouter()
  const { data: session } = useSession()
  const email = (session?.user?.email || '').toLowerCase()
  const col = COLORES[email]
  const [pend, setPend] = useState([])
  const [cerrado, setCerrado] = useState(false)

  useEffect(() => {
    if (!col) return
    let vivo = true
    fetch('/api/recordatorios')
      .then(r => r.json())
      .then(d => { if (vivo && d?.ok) setPend(d.pendientes || []) })
      .catch(() => {})
    return () => { vivo = false }
  }, [col])

  if (!col || cerrado || !pend.length) return null
  const vencidos = pend.filter(p => p.estado === 'vencido').length
  return (
    <div style={{ maxWidth: 1400, margin: '10px auto 0', padding: '0 20px' }}>
      <div style={{ background: col.bg, border: `1px solid ${col.bd}`, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ fontSize: 20, lineHeight: '22px' }}>{col.ico}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: col.fg, marginBottom: 4 }}>
            Tienes {pend.length} recordatorio{pend.length === 1 ? '' : 's'} pendiente{pend.length === 1 ? '' : 's'}
            {vencidos ? ` · ${vencidos} vencido${vencidos === 1 ? '' : 's'}` : ''}
          </div>
          <div style={{ fontSize: 12.5, color: col.fg, lineHeight: 1.6 }}>
            {pend.slice(0, 8).map((p, i) => (
              <span key={p.id}>
                <b>{p.titulo}</b>{p.fecha_venc ? ` (${fmtFecha(p.fecha_venc)}${p.estado === 'vencido' ? ' · VENCIDO' : ''})` : ''}{i < Math.min(pend.length, 8) - 1 ? '  ·  ' : ''}
              </span>
            ))}
            {pend.length > 8 ? ` · y ${pend.length - 8} más` : ''}
          </div>
          <button onClick={() => router.push('/procesos/recordatorios')}
            style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: '#fff', background: col.btn, border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
            Ver y añadir recordatorios →
          </button>
        </div>
        <button onClick={() => setCerrado(true)} title="Cerrar (volverá a salir al recargar)"
          style={{ border: 'none', background: 'transparent', color: col.fg, fontSize: 18, cursor: 'pointer', lineHeight: '18px' }}>✕</button>
      </div>
    </div>
  )
}
