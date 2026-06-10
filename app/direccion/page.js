'use client'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'
import TopNav from '../components/ui/TopNav'

const DIRECCION_EMAILS = ['alberto.cabezas@fondocapital.com','luis.cabezas@fondocapital.com']

const palette = {
  blue:   { header: '#1a56db' },
  amber:  { header: '#d97706' },
  red:    { header: '#dc2626' },
  green:  { header: '#16a34a' },
  orange: { header: '#c2410c' },
}

function GridDots() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,5px)', gap: '3px', marginLeft: 'auto' }}>
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} style={{ width: 5, height: 5, borderRadius: 1, background: 'rgba(255,255,255,0.35)' }} />
      ))}
    </div>
  )
}

function AreaCard({ color, icon, title, rows, alert, href, actionLabel }) {
  const { header } = palette[color]
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ background: header, padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: '#fff', opacity: 0.9, display: 'flex' }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#fff', flex: 1 }}>{title}</span>
        <GridDots />
      </div>
      <div style={{ padding: '0 16px' }}>
        {rows.map((row, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < rows.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
            <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>{row.label}</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: row.highlight === 'danger' ? 'var(--danger-600)' : row.highlight === 'warning' ? 'var(--warning-600)' : 'var(--gray-800)' }}>{row.value}</span>
          </div>
        ))}
      </div>
      {alert && (
        <div style={{ margin: '0 16px 12px', padding: '6px 10px', borderRadius: 7, background: alert.type === 'danger' ? 'var(--danger-50)' : 'var(--warning-50)', border: `1px solid ${alert.type === 'danger' ? '#fca5a5' : '#fcd34d'}`, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 500, color: alert.type === 'danger' ? 'var(--danger-700)' : 'var(--warning-700)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2"/><line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="2"/><line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2.5"/></svg>
          {alert.text}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, padding: '0 16px 16px' }}>
        <Link href={href} style={{ flex: 1, padding: '7px 0', borderRadius: 8, background: header, color: '#fff', textAlign: 'center', fontSize: 12, fontWeight: 500, textDecoration: 'none' }}>Ver detalle</Link>
        <button style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', fontSize: 12, color: 'var(--gray-600)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{actionLabel}</button>
      </div>
    </div>
  )
}

const IcoHome    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 22V12h6v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
const IcoKey     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="7.5" cy="15.5" r="5.5" stroke="currentColor" strokeWidth="2"/><path d="M21 2l-9.6 9.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M15.5 7.5L17 9l2.5-2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
const IcoWrench  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="2"/></svg>
const IcoUsers   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
const IcoTrend   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><polyline points="16 7 22 7 22 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>

export default function DireccionPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return
    if (!session || !DIRECCION_EMAILS.includes(session.user?.email)) {
      router.replace('/panel')
    }
  }, [session, status, router])

  if (status === 'loading' || !session) return null
  if (!DIRECCION_EMAILS.includes(session.user?.email)) return null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      <TopNav />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        {[
          { label: 'Ingresos totales', value: '$120.500', color: 'var(--success-600)' },
          { label: 'Costes totales',   value: '$84.300',  color: 'var(--warning-600)' },
          { label: 'Resultado neto',   value: '$36.200',  color: 'var(--success-600)' },
          { label: 'Propiedades',      value: '152',       color: 'var(--gray-800)'   },
          { label: 'Alertas activas',  value: '4',         color: 'var(--danger-600)' },
        ].map((k, i) => (
          <div key={i} style={{ padding: '11px 20px', borderRight: i < 4 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ fontSize: 10, color: 'var(--gray-400)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k.label}</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '20px 24px' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--gray-400)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Operacion</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
          <AreaCard color="blue"  icon={<IcoHome />}   title="CC1 Administracion" href="/cc1" actionLabel="+ Nueva propiedad"
            rows={[
              { label: 'Propiedades', value: '95' },
              { label: 'Ingresos',    value: '$78.200' },
              { label: 'Costes',      value: '$45.000' },
              { label: 'Morosos',     value: '8 (8,4%)', highlight: 'danger' },
            ]}
            alert={{ type: 'danger', text: 'Aviso por morosidad' }}
          />
          <AreaCard color="amber" icon={<IcoKey />}    title="CC2 Arriendos Admon" href="/cc2" actionLabel="+ Nuevo arriendo"
            rows={[
              { label: 'Cerrados',     value: '18' },
              { label: 'Ingresos',     value: '$10.500' },
              { label: 'Conversion',   value: '45%' },
              { label: 'Prop. vacias', value: '6 (6,3%)', highlight: 'warning' },
            ]}
            alert={{ type: 'warning', text: 'Pendientes de firma' }}
          />
          <AreaCard color="red"   icon={<IcoWrench />} title="CC3 Mantenimiento" href="/cc3" actionLabel="+ Nueva incidencia"
            rows={[
              { label: 'Abiertas',    value: '12' },
              { label: 'Facturacion', value: '$6.800' },
              { label: 'Coste',       value: '$10.200' },
              { label: 'Margen',      value: '12%', highlight: 'warning' },
            ]}
            alert={{ type: 'danger', text: '3 urgencias pendientes' }}
          />
        </div>

        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--gray-400)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Comercial</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
          <AreaCard color="green"  icon={<IcoUsers />} title="BB2 Arriendos" href="/bb2" actionLabel="+ Nuevo arriendo"
            rows={[
              { label: 'Operaciones',    value: '24' },
              { label: 'Ingresos',       value: '$22.500' },
              { label: 'Coste',          value: '$8.000' },
              { label: 'Conversion CC1', value: '55%' },
            ]}
          />
          <AreaCard color="orange" icon={<IcoTrend />} title="BB1 Ventas" href="/bb1" actionLabel="+ Nueva venta"
            rows={[
              { label: 'Ventas',         value: '3' },
              { label: 'Ingresos',       value: '$95.000' },
              { label: 'Comision media', value: '$12.000' },
              { label: 'Pipeline',       value: 'Sin activo', highlight: 'warning' },
            ]}
            alert={{ type: 'warning', text: 'Sin pipeline activo' }}
          />
          <Link href='/direccion/control-asistencia' style={{ textDecoration: 'none' }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', cursor: 'pointer' }}>
              <div style={{ background: '#6366f1', padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>👥</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#fff', flex: 1 }}>Control de Asistencia</span>
                <GridDots />
              </div>
              <div style={{ padding: '12px 16px' }}>
                <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 8 }}>Registro y seguimiento de asistencia del personal</div>
                <div style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 6, background: '#6366f1', color: '#fff', fontSize: 12, fontWeight: 500 }}>Ver detalle →</div>
              </div>
            </div>
          </Link>
          <Link href='/op/ml-notificaciones' style={{ textDecoration: 'none' }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', cursor: 'pointer' }}>
              <div style={{ background: '#0891b2', padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>🏢</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#fff', flex: 1 }}>Notificaciones ML</span>
                <GridDots />
              </div>
              <div style={{ padding: '12px 16px' }}>
                <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 8 }}>Actividad Portal Inmobiliario en tiempo real</div>
                <div style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 6, background: '#0891b2', color: '#fff', fontSize: 12, fontWeight: 500 }}>Ver actividad</div>
              </div>
            </div>
          </Link>
        </div>

        {/* TAREAS */}
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--gray-400)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Gestión de tareas</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          {[
            { email: 'karina.morales@fondocapital.com', nombre: 'Karina Morales', area: 'Controller', color: '#7c3aed', icon: '📊' },
            { email: 'adalis@fondocapital.com',         nombre: 'Adalis',         area: 'Administración', color: '#0891b2', icon: '📋' },
            { email: 'fabiola.guerra@fondocapital.com', nombre: 'Fabiola Guerra', area: 'Administración', color: '#0891b2', icon: '📋' },
            { email: 'anthony@fondocapital.com',        nombre: 'Anthony',        area: 'Legal',          color: '#dc2626', icon: '⚖️' },
          ].map(p => (
            <Link key={p.email} href={`/direccion/tareas?responsable=${encodeURIComponent(p.email)}`} style={{ textDecoration: 'none' }}>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', cursor: 'pointer' }}>
                <div style={{ background: p.color, padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{p.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#fff', flex: 1 }}>{p.nombre}</span>
                  <GridDots />
                </div>
                <div style={{ padding: '12px 16px' }}>
                  <div style={{ fontSize: 11, color: 'var(--gray-400)', marginBottom: 8 }}>{p.area}</div>
                  <div style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 6, background: p.color, color: '#fff', fontSize: 12, fontWeight: 500 }}>Ver tareas →</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
