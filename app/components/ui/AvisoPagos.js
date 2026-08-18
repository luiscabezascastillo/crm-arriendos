// RUTA: app/components/ui/AvisoPagos.js
// VERSION: v1 · 2026-08-17 · Aviso de pagos por vencer/vencidos. Aparece al entrar (en /panel y /direccion)
//   si hay pendientes; se puede cerrar con la ✕ y desaparece al navegar (es por página). Enlaza a la
//   pantalla de gestión. No bloquea: es un recordatorio para que Alberto no se olvide de los pagos.
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AvisoPagos() {
  const router = useRouter()
  const [pend, setPend] = useState([])
  const [cerrado, setCerrado] = useState(false)

  useEffect(() => {
    let vivo = true
    fetch('/api/pagos-recurrentes')
      .then(r => r.json())
      .then(d => { if (vivo && d?.ok) setPend(d.pendientes || []) })
      .catch(() => {})
    return () => { vivo = false }
  }, [])

  if (cerrado || !pend.length) return null
  const vencidos = pend.filter(p => p.estado === 'vencido').length
  return (
    <div style={{ maxWidth: 1400, margin: '10px auto 0', padding: '0 20px' }}>
      <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ fontSize: 20, lineHeight: '22px' }}>⚠️</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#B91C1C', marginBottom: 4 }}>
            Tienes {pend.length} pago{pend.length === 1 ? '' : 's'} por atender{vencidos ? ` · ${vencidos} ya vencido${vencidos === 1 ? '' : 's'}` : ''}
          </div>
          <div style={{ fontSize: 12.5, color: '#7F1D1D', lineHeight: 1.6 }}>
            {pend.slice(0, 8).map((p, i) => (
              <span key={p.id}>
                <b>{p.proveedor}</b> (vence {p.vence}{p.estado === 'vencido' ? ' · VENCIDO' : ''}){p.monto ? ` · $${Number(p.monto).toLocaleString('es-CL')}` : ''}{i < Math.min(pend.length, 8) - 1 ? ' · ' : ''}
              </span>
            ))}
            {pend.length > 8 ? ` · y ${pend.length - 8} más` : ''}
          </div>
          <button onClick={() => router.push('/procesos/financiero/pagos')}
            style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: '#fff', background: '#DC2626', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
            Ver y marcar pagos →
          </button>
        </div>
        <button onClick={() => setCerrado(true)} title="Cerrar (volverá a salir al reconectar)"
          style={{ border: 'none', background: 'transparent', color: '#B91C1C', fontSize: 18, cursor: 'pointer', lineHeight: '18px' }}>✕</button>
      </div>
    </div>
  )
}
