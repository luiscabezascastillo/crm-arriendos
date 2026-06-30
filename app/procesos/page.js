'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import TopNav from '@/app/components/ui/TopNav'

// Orden de las secciones (departamento responsable)
const SECCIONES = ['Ventas', 'Administración', 'Mantención', 'Legal', 'Finanzas']

// Colores por departamento (cabecera de sección)
const DEPTO_COLORS = {
  'Ventas':         { bg: '#E6F1FB', color: '#0C447C' },
  'Administración': { bg: '#FAEEDA', color: '#633806' },
  'Mantención':     { bg: '#FBE9E7', color: '#8A3324' },
  'Legal':          { bg: '#EDE7F6', color: '#4527A0' },
  'Finanzas':       { bg: '#E1F5EE', color: '#085041' },
}

// Chip verde de responsable (como el badge de responsable de antes)
const RESP_CHIP = { bg: '#E1F5EE', color: '#085041' }
// Chip gris de participante
const PART_CHIP = { bg: '#F1EFE8', color: '#888780' }

// Fondo suave para las tarjetas en producción
const PROD_BG = '#F2FBF7'

// Un solo listado, agrupado por `responsable` en el render.
// frecuencia = Mensual | Semanal | Puntual (informativa)
const PROCESOS = [
  // ── VENTAS ──
  { key: 'publicacion', titulo: 'Publicación', responsable: 'Ventas', participa: [], frecuencia: 'Puntual', produccion: true,
    descripcion: 'Depto vacío → candidato',
    etapas: ['Detectar', 'Publicar', 'Visitas', 'Selección', 'Cierre'], conecta: null, href: '/publicaciones' },
  { key: 'inicios', titulo: 'Inicios', responsable: 'Ventas', participa: ['Legal', 'Finanzas'], frecuencia: 'Puntual',
    descripcion: 'Contrato, firma y ciclo mensual',
    etapas: ['Validar', 'Contrato', 'Firma', 'LOG', 'Activar'], conecta: null, href: null },

  // ── ADMINISTRACIÓN ──
  { key: 'servicios', titulo: 'Servicios', responsable: 'Administración', participa: ['Finanzas'], frecuencia: 'Mensual', produccion: true,
    descripcion: 'Consulta y carga mensual deudas de servicios',
    etapas: [], conecta: null, href: '/op/deudas' },
  { key: 'descuentos', titulo: 'Descuentos', responsable: 'Administración', participa: ['Finanzas'], frecuencia: 'Semanal', produccion: true,
    descripcion: 'Descuentos a propietarios',
    etapas: ['Revisar', 'Autorizar', 'Aplicar', 'Confirmar'], conecta: 'Liquidación', href: '/procesos/descuentos' },
  { key: 'cobranza', titulo: 'Cobranza', responsable: 'Administración', participa: ['Finanzas', 'Legal'], frecuencia: 'Puntual',
    descripcion: 'Impago → pago o acción legal',
    etapas: ['Detectar', 'Aviso 1', 'Gestión', 'Legal', 'Cierre'], conecta: null, href: '/op/deudas' },
  { key: 'notificaciones', titulo: 'Notificaciones', responsable: 'Administración', participa: ['Finanzas'], frecuencia: 'Mensual',
    descripcion: 'Avisos automáticos a arrendatarios',
    etapas: ['Generar', 'Enviar', 'Acuses', 'No entregados'], conecta: null, href: '/procesos/notificaciones' },

  // ── MANTENCIÓN ──
  { key: 'incidencia', titulo: 'Incidencia', responsable: 'Mantención', participa: ['Administración', 'Finanzas'], frecuencia: 'Puntual',
    descripcion: 'Reporte, resolución y cierre',
    etapas: ['Reporte', 'Clasificar', 'Validar', 'Resolver', 'Cierre'], conecta: null, href: null },
  { key: 'presupuestos', titulo: 'Presupuestos', responsable: 'Mantención', participa: ['Administración', 'Finanzas'], frecuencia: 'Puntual',
    descripcion: 'Crear y editar presupuestos de reparación',
    etapas: ['Buscar', 'Crear', 'Líneas', 'Revisar', 'PDF'], conecta: 'Término · Incidencia · Inicios', href: '/procesos/presupuestos' },

  // ── LEGAL ──
  { key: 'revision_log', titulo: 'Gestión LOG', responsable: 'Legal', participa: ['Administración', 'Finanzas', 'Ventas'], frecuencia: 'Semanal', produccion: true,
    descripcion: 'BD_LOG Drive → Supabase',
    etapas: ['Leer LOG', 'Validar', 'Aprobar', 'Sincronizar'], conecta: null, href: '/cc1' },
  { key: 'contratos', titulo: 'Contratos', responsable: 'Legal', participa: [], frecuencia: 'Puntual', enConstruccion: true,
    descripcion: 'Redacción de contratos',
    etapas: [], conecta: null, href: null },
  { key: 'valoraciones', titulo: 'Valoraciones', responsable: 'Legal', participa: [], frecuencia: 'Puntual', enConstruccion: true,
    descripcion: 'Validación / evaluación de arrendatarios',
    etapas: [], conecta: null, href: null },
  { key: 'dicom', titulo: 'DICOM', responsable: 'Legal', participa: [], frecuencia: 'Puntual', enConstruccion: true,
    descripcion: 'Consulta comercial del candidato',
    etapas: [], conecta: null, href: null },

  // ── FINANZAS ──
  { key: 'termino', titulo: 'Término', responsable: 'Finanzas', participa: ['Administración', 'Legal'], frecuencia: 'Puntual', produccion: true,
    descripcion: 'Aviso legal, recepción y garantías',
    etapas: ['Aviso', 'Registro', 'Legal', 'Excel', 'Recepción', 'GGCC', 'Garantías', 'Cierre'], conecta: 'Términos', href: '/procesos/terminos' },
  { key: 'liquidacion', titulo: 'Liquidación', responsable: 'Finanzas', participa: ['Administración'], frecuencia: 'Mensual',
    descripcion: 'Cruce cartola, neto propietarios',
    etapas: ['Cruce cartola', 'No pagados', 'Revisión', 'Generar', 'Envío'], conecta: 'Cobranza', href: null },
  { key: 'liquidacion_paola', titulo: 'Liquidación Paola', responsable: 'Administración', participa: ['Finanzas'], frecuencia: 'Mensual', enConstruccion: true,
    descripcion: 'Caso especial de liquidación',
    etapas: [], conecta: null, href: '/op/liquidacion-paola' },
  { key: 'cartolas', titulo: 'Cartolas', responsable: 'Finanzas', participa: ['Administración'], frecuencia: 'Mensual', produccion: true,
    descripcion: 'Cartola de IDADMON (lee/solicita cambios: Administración)',
    etapas: ['Carga', 'Cruce IDADMON', 'No matcheados', 'Deuda'], conecta: null, href: '/procesos/cartolas' },
  { key: 'mandato', titulo: 'Mandato', responsable: 'Finanzas', participa: ['Administración'], frecuencia: 'Mensual',
    descripcion: 'Cuotas esperadas y deuda mensual (resultado visible por Administración)',
    etapas: ['Cuotas', 'Cartola BI', 'Vista deuda', 'Confirmar'], conecta: null, href: null },
  { key: 'nubox', titulo: 'Financiero', responsable: 'Finanzas', participa: ['Administración'], frecuencia: 'Semanal',
    descripcion: 'Tratamiento datos financieros (resultado visible por Administración)',
    etapas: [], conecta: null, href: '/procesos/financiero' },
  { key: 'bi_sa', titulo: 'BI', responsable: 'Finanzas', participa: [], frecuencia: 'Semanal', produccion: true,
    descripcion: 'Cartola Banco Internacional',
    etapas: ['Cargar', 'Sugerir', 'Revisar', 'Volcar'], conecta: null, href: '/procesos/bi' },
]

const ROL_COLORS = {
  responsable: { bg: '#E1F5EE', color: '#085041' },
  colaborador:  { bg: '#E6F1FB', color: '#0C447C' },
  supervisor:   { bg: '#FAEEDA', color: '#633806' },
  observador:   { bg: '#F1EFE8', color: '#444441' },
}

const NOMBRE_BADGE    = { bg: '#E1F5EE', color: '#085041' }
const DIRECCION_BADGE = { bg: '#FAEEDA', color: '#633806' }

function Chips({ proceso }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4, marginTop: 8 }}>
      <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 8px', borderRadius: 20, background: RESP_CHIP.bg, color: RESP_CHIP.color }}>
        {proceso.responsable}
      </span>
      {proceso.participa && proceso.participa.length > 0 && (
        <>
          <span style={{ fontSize: 9, color: '#B4B2A9' }}>participa</span>
          {proceso.participa.map((d, i) => (
            <span key={i} style={{ fontSize: 9, fontWeight: 500, padding: '1px 7px', borderRadius: 20, background: PART_CHIP.bg, color: PART_CHIP.color }}>{d}</span>
          ))}
        </>
      )}
    </div>
  )
}

function FrecBadge({ frecuencia }) {
  if (!frecuencia) return null
  return (
    <span style={{ fontSize: 9, fontWeight: 500, padding: '1px 6px', borderRadius: 20, background: '#F1EFE8', color: '#888780' }}>
      {frecuencia}
    </span>
  )
}

function ProcesCard({ proceso, permiso, responsablePersona, onClick, expanded, onToggle, isMobile, esProduccion }) {
  const tiene = !!permiso
  const nombreResp = responsablePersona?.nombre
  const personaColor = responsablePersona?.esDireccion ? DIRECCION_BADGE : NOMBRE_BADGE

  if (isMobile) {
    return (
      <div style={{
        background: esProduccion ? PROD_BG : '#fff',
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
            <FrecBadge frecuencia={proceso.frecuencia} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 20, background: RESP_CHIP.bg, color: RESP_CHIP.color }}>{proceso.responsable}</span>
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
            <Chips proceso={proceso} />
            {nombreResp && <div style={{ fontSize: 10, color: '#B4B2A9', marginTop: 4 }}>Encargada/o: {nombreResp}</div>}
            {proceso.conecta && <div style={{ fontSize: 11, color: '#1D9E75', marginTop: 6 }}>↳ {proceso.conecta}</div>}
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
        background: esProduccion ? PROD_BG : '#fff',
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
          <FrecBadge frecuencia={proceso.frecuencia} />
        </span>
        <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 8px', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0, background: RESP_CHIP.bg, color: RESP_CHIP.color }}>
          {proceso.responsable}
        </span>
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
      <Chips proceso={proceso} />
      {nombreResp && <div style={{ fontSize: 10, color: '#B4B2A9', marginTop: 4 }}>Encargada/o: {nombreResp}</div>}
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

  const totalDisponibles = PROCESOS.filter(p => permisos[p.key]).length

  if (status === 'loading' || loading) {
    return (
      <>
        <TopNav />
        <div style={{ padding: 60, textAlign: 'center', color: '#888', fontSize: 14 }}>Cargando procesos…</div>
      </>
    )
  }

  const sectionLabel = (texto, disp, total, color) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0 8px' }}>
      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, letterSpacing: '.04em', whiteSpace: 'nowrap', background: color.bg, color: color.color }}>{texto}</span>
      <div style={{ flex: 1, height: '0.5px', background: '#D3D1C7' }}></div>
      <span style={{ fontSize: 10, color: '#B4B2A9', whiteSpace: 'nowrap' }}>{disp}/{total}</span>
    </div>
  )

  const renderGrid = (lista, cols, esProduccion = false) => (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : `repeat(${cols}, 1fr)`, gap: isMobile ? 0 : 10, marginBottom: 8 }}>
      {lista.map(p => (
        <ProcesCard
          key={p.key}
          proceso={p}
          permiso={permisos[p.key]}
          responsablePersona={responsables[p.key]}
          onClick={handleClick}
          expanded={expanded === p.key}
          onToggle={() => setExpanded(expanded === p.key ? null : p.key)}
          isMobile={isMobile}
          esProduccion={esProduccion}
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
            <h1 style={{ fontSize: isMobile ? 18 : 20, fontWeight: 600, margin: '0 0 2px', color: '#2C2C2A' }}>Motor de procesos <span style={{ color: '#DC2626' }}>(en desarrollo)</span></h1>
            <div style={{ fontSize: 12, color: '#888780' }}>
              {session?.user?.name?.split(' ')[0] || session?.user?.email?.split('@')[0]} · {totalDisponibles} procesos disponibles
            </div>
          </div>
          <button onClick={() => router.push('/panel')}
            style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, border: '0.5px solid #D3D1C7', background: '#fff', cursor: 'pointer', color: '#2C2C2A', whiteSpace: 'nowrap' }}>
            ↑ Dashboard
          </button>
        </div>

        {/* LEYENDA */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 4, fontSize: 11, color: '#888780', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#1D9E75', display: 'inline-block' }}></span> Con acceso
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#D3D1C7', display: 'inline-block' }}></span> Sin acceso
          </span>
          <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 8px', borderRadius: 20, background: RESP_CHIP.bg, color: RESP_CHIP.color }}>responsable</span>
          <span style={{ fontSize: 10, fontWeight: 500, padding: '1px 8px', borderRadius: 20, background: PART_CHIP.bg, color: PART_CHIP.color }}>participa</span>
          <span style={{ fontSize: 9, color: '#B4B2A9' }}>· la etiqueta junto al título es la frecuencia (Mensual / Semanal / Puntual)</span>
        </div>

        {/* FRANJA: PROCESOS YA EN PRODUCCIÓN */}
        {(() => {
          const enProd = PROCESOS.filter(p => p.produccion)
          if (!enProd.length) return null
          const dispProd = enProd.filter(p => permisos[p.key]).length
          return (
            <div style={{ marginBottom: 6 }}>
              {sectionLabel('PROCESOS YA EN PRODUCCIÓN', dispProd, enProd.length, { bg: '#E1F5EE', color: '#085041' })}
              {renderGrid(enProd, 3, true)}
            </div>
          )
        })()}

        {/* TODOS LOS PROCESOS (no-producción) EN UNA SOLA REJILLA, sin cabeceras de depto */}
        {(() => {
          const resto = PROCESOS.filter(p => !p.produccion)
          if (!resto.length) return null
          return (
            <div style={{ marginTop: 14 }}>
              {renderGrid(resto, 3)}
            </div>
          )
        })()}

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