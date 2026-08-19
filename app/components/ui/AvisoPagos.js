// RUTA: app/components/ui/AvisoPagos.js
// VERSION: v3 · 2026-08-18 · VISIBILIDAD RESTRINGIDA. El aviso SOLO lo ven Alberto (actúa), Luis y Karina (info).
//   Antes se mostraba a cualquiera que abriera /panel (p. ej. Anthony lo veía). Ahora, si el usuario no está en la
//   lista, no se renderiza ni se pide la API. Hereda v2.
// VERSION: v2 · 2026-08-17 · A quien NO es Alberto (Luis, Karina, resto) el aviso se muestra como "alerta de
//   Alberto" con la coletilla "MOSTRADA A ALBERTO · DESAPARECE CUANDO PAGUE", para que quede claro de quién es
//   la acción. A Alberto le sale en primera persona ("Tienes N pagos..."). Hereda v1.
// VERSION: v1 · 2026-08-17 · Aviso de pagos por vencer/vencidos. Aparece al entrar (en /panel y /direccion)
//   si hay pendientes; se puede cerrar con la ✕ y desaparece al navegar (es por página). Enlaza a la
//   pantalla de gestión. No bloquea: es un recordatorio para que Alberto no se olvide de los pagos.
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

const ALBERTO = 'alberto.cabezas@fondocapital.com'
// Solo estos ven el aviso: Alberto (actúa), Luis y Karina (información). El resto NO lo ve.
const VISIBLE = [ALBERTO, 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']

export default function AvisoPagos() {
  const router = useRouter()
  const { data: session } = useSession()
  const email = (session?.user?.email || '').toLowerCase()
  const esAlberto = email === ALBERTO
  const puedeVer = VISIBLE.includes(email)
  const [pend, setPend] = useState([])
  const [cerrado, setCerrado] = useState(false)

  useEffect(() => {
    if (!puedeVer) return
    let vivo = true
    fetch('/api/pagos-recurrentes')
      .then(r => r.json())
      .then(d => { if (vivo && d?.ok) setPend(d.pendientes || []) })
      .catch(() => {})
    return () => { vivo = false }
  }, [puedeVer])

  if (!puedeVer || cerrado || !pend.length) return null
  const vencidos = pend.filter(p => p.estado === 'vencido').length
  return (
    <div style={{ maxWidth: 1400, margin: '10px auto 0', padding: '0 20px' }}>
      <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ fontSize: 20, lineHeight: '22px' }}>⚠️</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#B91C1C', marginBottom: 4 }}>
            {esAlberto
              ? `Tienes ${pend.length} pago${pend.length === 1 ? '' : 's'} por atender`
              : `Alberto tiene ${pend.length} pago${pend.length === 1 ? '' : 's'} por atender`}
            {vencidos ? ` · ${vencidos} ya vencido${vencidos === 1 ? '' : 's'}` : ''}
          </div>
          {!esAlberto && (
            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#9A3412', background: '#FFEDD5', border: '1px solid #FED7AA', borderRadius: 6, padding: '2px 8px', display: 'inline-block', marginBottom: 6 }}>
              🔔 ALERTA MOSTRADA A ALBERTO · DESAPARECE CUANDO PAGUE
            </div>
          )}
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
            {esAlberto ? 'Ver y marcar pagos →' : 'Ver estado de pagos →'}
          </button>
        </div>
        <button onClick={() => setCerrado(true)} title="Cerrar (volverá a salir al reconectar)"
          style={{ border: 'none', background: 'transparent', color: '#B91C1C', fontSize: 18, cursor: 'pointer', lineHeight: '18px' }}>✕</button>
      </div>
    </div>
  )
}
