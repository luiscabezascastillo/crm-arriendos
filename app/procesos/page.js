'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import TopNav from '@/app/components/ui/TopNav'

const PROCESOS_MENSUALES = [
  {
    key: 'servicios',
    titulo: 'Servicios',
    descripcion: 'Consulta y carga mensual de deudas de servicios por contrato',
    etapas: [],
    conecta: null,
    href: '/op/deudas',
    links: [
      { label: '📊 Visualizar Deudas', href: '/op/deudas' },
      { label: '🏢 Cargar ggcc CF-Luis', href: '/op/comunidad-feliz' },
      { label: '⚡ Cargar Luz-Luis', href: '/op/servicios/luz' },
      { label: '💧 Cargar Agua-Luis', href: '/op/servicios/agua' },
      { label: '📧 Email grandes deudores', href: '/op/email-deudores' },
    ]
  },
  { key: 'liquidacion',    titulo: 'Liquidación',    descripcion: 'Cruce cartola, neto propietarios',        etapas: ['Cruce cartola', 'No pagados', 'Revisión', 'Generar', 'Envío'],                  conecta: 'Cobranza',         href: '/op/liquidacion-paola' },
  { key: 'cartolas',       titulo: 'Cartolas',       descripcion: 'Cartola bancaria por IDADMON',            etapas: ['Carga', 'Cruce IDADMON', 'No matcheados', 'Deuda'],                           conecta: 'Mandato · Cobranza', href: null },
  { key: 'mandato',        titulo: 'Mandato',        descripcion: 'Cuotas esperadas y deuda mensual',        etapas: ['Cuotas', 'Cartola BI', 'Vista deuda', 'Confirmar'],                           conecta: null,               href: null },
  { key: 'notificaciones', titulo: 'Notificaciones', descripcion: 'Avisos automáticos a arrendatarios',      etapas: ['Generar', 'Enviar', 'Acuses', 'No entregados'],                               conecta: null,               href: null },
]

const PROCESOS_SEMANALES = [
  { key: 'revision_log',   titulo: 'Revisión Log',   descripcion: 'BD_LOG Drive → Supabase',                etapas: ['Leer LOG', 'Validar', 'Aprobar', 'Sincronizar'],                              conecta: null,               href: null },
  { key: 'nubox',          titulo: 'Financiero',     descripcion: 'Tratamiento datos financieros',           etapas: [],                                                                             conecta: null,               href: '/procesos/financiero' },
  { key: 'descuentos',     titulo: 'Descuentos',     descripcion: 'Descuentos a propietarios',               etapas: ['Revisar', 'Autorizar', 'Aplicar', 'Confirmar'],                               conecta: 'Liquidación',       href: null },
  { key: 'bi_sa',          titulo: 'BI',             descripcion: 'Cartola Banco Internacional',             etapas: ['Cargar', 'Sugerir', 'Revisar', 'Volcar'],                                     conecta: null,               href: '/procesos/bi' },
]

const PROCESOS_PUNTUALES = [
  { key: 'publicacion', titulo: 'Publicación', descripcion: 'Depto vacío → candidato',            etapas: ['Detectar', 'Publicar', 'Visitas', 'Selección', 'Cierre'],                       conecta: 'Inicios',     href: '/publicaciones' },
  { key: 'inicios',     titulo: 'Inicios',     descripcion: 'Contrato, firma y ciclo mensual',    etapas: ['Validar', 'Contrato', 'Firma', 'LOG', 'Activar'],                                conecta: null,          href: null },
  { key: 'termino',     titulo: 'Término',     descripcion: 'Aviso legal, recepción y garantías', etapas: ['Aviso', 'Registro', 'Legal', 'Excel', 'Recepción', 'GGCC', 'Garantías', 'Cierre'], conecta: 'Términos', href: '/procesos/terminos' },
  { key: 'cobranza',    titulo: 'Cobranza',    descripcion: 'Impago → pago o acción legal',       etapas: ['Detectar', 'Aviso 1', 'Gestión', 'Legal', 'Cierre'],                             conecta: null,          href: '/op/deudas' },
  { key: 'incidencia',  titulo: 'Incidencia',  descripcion: 'Reporte, resolución y cierre',       etapas: ['Reporte', 'Clasificar', 'Validar', 'Resolver', 'Cierre'],                        conecta: null,          href: null },
  { key: 'presupuestos', titulo: 'Presupuestos', descripcion: 'Crear y editar presupuestos de reparación', etapas: ['Buscar', 'Crear', 'Líneas', 'Revisar', 'PDF'], conecta: 'Término · Incidencia · Inicios', href: '/procesos/presupuestos' },
]

const ROL_COLORS = {
  responsable: { bg: '#E1F5EE', color: '#085041' },
  colaborador:  { bg: '#E6F1FB', color: '#0C447C' },
  supervisor:   { bg: '#FAEEDA', color: '#633806' },
  observador:   { bg: '#F1EFE8', color: '#444441' },
}

// Colores del badge de responsable (reemplaza al de rol en las tarjetas)
const NOMBRE_BADGE    = { bg: '#E1F5EE', color: '#085041' }  // responsable (verde)
const DIRECCION_BADGE = { bg: '#FAEEDA', color: '#633806' }  // Direccion (ambar)

function ProcesCard({ proceso, permiso, responsable, onClick, expanded, onToggle, isMobile }) {
  const tiene = !!permiso
  const nombreResp = responsable?.nombre
  const badgeColor = responsable?.esDireccion ? DIRECCION_BADGE : NOMBRE_BADGE

  if (isMobile) {
    return (
      <div style={{
        background: '#fff',
        border: `0.5px solid ${tiene ? '#B4B2A9' : '#D3D1C7'}`,
        borderLeft: `3px solid ${tiene ? '#1D9E75' : '#D3D1C7'}`,
        borderRadius: '0 10px 10px 0',
        marginBottom: 6,
        opacity: tiene ? 1 : 0.5,
      }}>
        <div onClick={() => tiene ? onToggle() : null}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', cursor: tiene ? 'pointer' : 'default' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!tiene && <span style={{ fontSize: 13 }}>🔒</span>}
            <span style={{ fontSize: 13, fontWeight: 500, color: '#2C2C2A' }}>{proceso.titulo}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {nombreResp && <span style={{ fontSize: 10, fontWeight: 500, padding: '1px 7px', borderRadius: 20, background: badgeColor.bg, color: badgeColor.color }}>{nombreResp}</span>}
            {tiene && <span style={{ fontSize: 10, color: '#888' }}>{expanded ? '▲' : '▼'}</span>}
          </div>
        </div>
        {expanded && tiene && (
          <div style={{ padding: '0 12px 10px', borderTop: '0.5px solid #F0EEE8' }}>
            <div style={{ fontSize: 12, color: '#5F5E5A', margin: '6px 0 8px' }}>{proceso.descripcion}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {proceso.etapas.map((e, i) => (
                <span key={i} style={{ fontSize: 11, background: '#F1EFE8', color: '#5F5E5A', padding: '2px 8px', borderRadius: 20 }}>{e}</span>
              ))}
            </div>
            {proceso.conecta && <div style={{ fontSize: 11, color: '#1D9E75', marginTop: 8 }}>↳ {proceso.conecta}</div>}
            {proceso.links ? (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {proceso.links.map((l, i) => (
                  <button key={i} onClick={() => onClick({ href: l.href }, true)}
                    style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: '1px solid #D3D1C7', background: i === 0 ? '#1D9E75' : '#fff', color: i === 0 ? '#fff' : '#374151', cursor: 'pointer', textAlign: 'left' }}>
                    {l.label}
                  </button>
                ))}
              </div>
            ) : proceso.href ? (
              <button onClick={() => onClick(proceso, true)}
                style={{ marginTop: 8, fontSize: 12, padding: '5px 12px', borderRadius: 6, border: 'none', background: '#1D9E75', color: '#fff', cursor: 'pointer' }}>
                Abrir →
              </button>
            ) : null}
          </div>
        )}
      </div>
    )
  }

  // Desktop
  return (
    <div onClick={() => !proceso.links && onClick(proceso, tiene)}
      style={{
        background: '#fff',
        border: `0.5px solid ${tiene ? '#B4B2A9' : '#D3D1C7'}`,
        borderLeft: `3px solid ${tiene ? '#1D9E75' : '#D3D1C7'}`,
        borderRadius: '0 10px 10px 0',
        padding: '11px 13px',
        cursor: proceso.links ? 'default' : (tiene ? 'pointer' : 'default'),
        opacity: tiene ? 1 : 0.5,
        transition: 'border-color 0.15s',
        position: 'relative',
      }}
      onMouseEnter={e => { if (tiene) e.currentTarget.style.borderColor = '#888780' }}
      onMouseLeave={e => { if (tiene) e.currentTarget.style.borderColor = '#B4B2A9' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4, gap: 6 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: '#2C2C2A' }}>
          {!tiene && <span style={{ fontSize: 13 }}>🔒</span>}
          {proceso.titulo}
        </span>
        {nombreResp && (
          <span style={{ fontSize: 10, fontWeight: 500, padding: '1px 7px', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0, background: badgeColor.bg, color: badgeColor.color }}>
            {nombreResp}
          </span>
        )}
      </div>
      <div style={{ fontSize: 11, color: '#888780', marginBottom: 6, lineHeight: 1.4 }}>{proceso.descripcion}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {proceso.etapas.map((e, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ fontSize: 10, color: tiene ? '#5F5E5A' : '#B4B2A9' }}>{e}</span>
            {i < proceso.etapas.length - 1 && <span style={{ fontSize: 9, color: '#D3D1C7' }}>›</span>}
          </span>
        ))}
      </div>
      {proceso.conecta && tiene && <div style={{ marginTop: 6, fontSize: 10, color: '#1D9E75' }}>↳ {proceso.conecta}</div>}
      {/* Links múltiples para Servicios */}
      {proceso.links && tiene && (
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }} onClick={e => e.stopPropagation()}>
          {proceso.links.map((l, i) => (
            l.href ? (
              <a key={i} href={l.href}
                style={{ fontSize: 10, padding: '3px 8px', borderRadius: 5, border: '1px solid #D3D1C7',
                  background: i === 0 ? '#E1F5EE' : '#F9FAFB', color: i === 0 ? '#085041' : '#374151',
                  textDecoration: 'none', fontWeight: i === 0 ? 600 : 400 }}>
                {l.label}
              </a>
            ) : (
              <span key={i}
                style={{ fontSize: 10, padding: '3px 8px', borderRadius: 5, border: '1px dashed #D3D1C7',
                  background: '#F9FAFB', color: '#B4B2A9', cursor: 'default' }}>
                {l.label}
              </span>
            )
          ))}
        </div>
      )}
    </div>
  )
}

export default function ProcesosPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [permisos, setPermisos] = useState({})
  const [responsables, setResponsables] = useState({})
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/api/auth/signin')
  }, [status, router])

  useEffect(() => {
    fetch('/api/procesos-responsables')
      .then(r => r.json())
      .then(d => { if (d && !d.error) setResponsables(d) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!session?.user?.email) return
    supabase
      .from('proceso_permisos')
      .select('proceso, rol')
      .eq('email', session.user.email)
      .eq('activo', true)
      .then(({ data, error }) => {
        if (error) { console.error(error); setLoading(false); return }
        const map = {}
        ;(data || []).forEach(p => { map[p.proceso] = { rol: p.rol } })
        setPermisos(map)
        setLoading(false)
      })
  }, [session])

  const handleClick = (proceso, tiene) => {
    if (!tiene) {
      setToast(`Sin acceso a ${proceso.titulo}`)
      setTimeout(() => setToast(null), 2500)
      return
    }
    if (proceso.href) router.push(proceso.href)
    else {
      setToast(`${proceso.titulo} — módulo en construcción`)
      setTimeout(() => setToast(null), 2500)
    }
  }

  const totalMensuales = PROCESOS_MENSUALES.filter(p => permisos[p.key]).length
  const totalSemanales = PROCESOS_SEMANALES.filter(p => permisos[p.key]).length
  const totalPuntuales = PROCESOS_PUNTUALES.filter(p => permisos[p.key]).length

  if (status === 'loading' || loading) {
    return (
      <>
        <TopNav />
        <div style={{ padding: 60, textAlign: 'center', color: '#888', fontSize: 14 }}>Cargando procesos…</div>
      </>
    )
  }

  const sectionLabel = (texto, disp, total) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0 8px' }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#2C2C2A', letterSpacing: '.06em', whiteSpace: 'nowrap' }}>{texto}</span>
      <div style={{ flex: 1, height: '0.5px', background: '#D3D1C7' }}></div>
      <span style={{ fontSize: 10, color: '#B4B2A9', whiteSpace: 'nowrap' }}>{disp}/{total}</span>
    </div>
  )

  const renderGrid = (lista, cols) => (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : `repeat(${cols}, 1fr)`, gap: isMobile ? 0 : 10, marginBottom: 8 }}>
      {lista.map(p => (
        <ProcesCard
          key={p.key}
          proceso={p}
          permiso={permisos[p.key]}
          responsable={responsables[p.key]}
          onClick={handleClick}
          expanded={expanded === p.key}
          onToggle={() => setExpanded(expanded === p.key ? null : p.key)}
          isMobile={isMobile}
        />
      ))}
    </div>
  )

  return (
    <>
      <TopNav />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '16px 14px 40px' : '20px 24px 40px' }}>

        {/* CABECERA */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 10 }}>
          <div>
            <h1 style={{ fontSize: isMobile ? 18 : 20, fontWeight: 600, margin: '0 0 2px', color: '#2C2C2A' }}>Motor de procesos</h1>
            <div style={{ fontSize: 12, color: '#888780' }}>
              {session?.user?.name?.split(' ')[0] || session?.user?.email?.split('@')[0]} · {totalMensuales + totalSemanales + totalPuntuales} procesos disponibles
            </div>
          </div>
          <button onClick={() => router.push('/panel')}
            style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, border: '0.5px solid #D3D1C7', background: '#fff', cursor: 'pointer', color: '#2C2C2A', whiteSpace: 'nowrap' }}>
            ↑ Dashboard
          </button>
        </div>

        {/* LEYENDA */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14, fontSize: 11, color: '#888780', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#1D9E75', display: 'inline-block' }}></span> Con acceso
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#D3D1C7', display: 'inline-block' }}></span> Sin acceso
          </span>
          {Object.entries(ROL_COLORS).map(([rol, c]) => (
            <span key={rol} style={{ fontSize: 10, fontWeight: 500, padding: '1px 8px', borderRadius: 20, background: c.bg, color: c.color }}>{rol}</span>
          ))}
        </div>

        {/* PROCESOS MENSUALES */}
        {sectionLabel('PROCESOS MENSUALES — se abren una vez al mes, cada proceso en un día distinto', totalMensuales, PROCESOS_MENSUALES.length)}
        {renderGrid(PROCESOS_MENSUALES, 3)}

        {/* PROCESOS SEMANALES */}
        {sectionLabel('PROCESOS SEMANALES — se abren cualquier día de la semana y quedan cerrados el viernes', totalSemanales, PROCESOS_SEMANALES.length)}
        {renderGrid(PROCESOS_SEMANALES, 4)}

        {/* PROCESOS PUNTUALES */}
        {sectionLabel('PROCESOS PUNTUALES — se abren cuando ocurre el evento', totalPuntuales, PROCESOS_PUNTUALES.length)}
        {renderGrid(PROCESOS_PUNTUALES, 3)}

      </div>

      {/* TOAST */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#2C2C2A', color: '#fff', fontSize: 13, padding: '10px 20px',
          borderRadius: 8, zIndex: 999, boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
        }}>
          {toast}
        </div>
      )}
    </>
  )
}