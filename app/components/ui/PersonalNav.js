'use client'
// VERSION: v3 · 2026-08-31 · Añade 3ª pestaña "Calendario laboral" (/direccion/calendario-laboral). Hereda v2.
// VERSION: v2 · 2026-08-30 · Sub-nav del hub "Control del personal". Prop fin: si viene del módulo Financiero,
//   propaga ?fin=1 para que la FinancieroNav siga apareciendo al saltar entre vistas. Botones entre las
//   vistas del personal (Vacaciones/ausencias y Control de asistencia). Vista por defecto: ausencias.
//   Prop: activo = 'ausencias' | 'asistencia'.
import { useRouter } from 'next/navigation'

const VERDE = '#085041'
const VERDE_CLARO = '#E1F5EE'
const BORDE = '#E5E4DF'

const VISTAS = [
  { id: 'ausencias',  icon: '🌴', label: 'Vacaciones y ausencias', href: '/ausencias' },
  { id: 'asistencia', icon: '🕘', label: 'Control de asistencia',  href: '/direccion/control-asistencia' },
  { id: 'calendario', icon: '📅', label: 'Calendario laboral',     href: '/direccion/calendario-laboral' },
]

export default function PersonalNav({ activo, fin }) {
  const router = useRouter()
  const href = b => (fin ? `${b}?fin=1` : b)
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#8a8a8a', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
        Control del personal
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {VISTAS.map(v => {
          const on = v.id === activo
          return (
            <button key={v.id} onClick={() => { if (!on) router.push(href(v.href)) }}
              style={{
                fontSize: 14, fontWeight: 600, padding: '8px 14px', borderRadius: 8,
                border: on ? `1px solid ${VERDE}` : `1px solid ${BORDE}`,
                background: on ? VERDE_CLARO : '#fff', color: on ? VERDE : '#555',
                cursor: on ? 'default' : 'pointer', whiteSpace: 'nowrap',
              }}>
              {v.icon} {v.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
