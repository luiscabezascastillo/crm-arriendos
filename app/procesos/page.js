'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import TopNav from '@/app/components/ui/TopNav'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const PROCESOS_MASIVOS = [
  { key: 'servicios',      titulo: 'Servicios',      descripcion: 'Carga CF, luz / agua / gas',             etapas: ['Carga CF','Scraping','ValidaciÃ³n','Supabase'],                               conecta: 'LiquidaciÃ³n', href: '/op/comunidad-feliz' },
  { key: 'liquidacion',    titulo: 'LiquidaciÃ³n',    descripcion: 'Cruce cartola, neto propietarios',        etapas: ['Cruce cartola','No pagados','RevisiÃ³n','Generar','EnvÃ­o'],                   conecta: 'Cobranza',    href: '/op/liquidacion-paola' },
  { key: 'cartolas',       titulo: 'Cartolas',       descripcion: 'Cartola bancaria por IDADMON',            etapas: ['Carga','Cruce IDADMON','No matcheados','Deuda'],                             conecta: 'Mandato Â· Cobranza', href: null },
  { key: 'mandato',        titulo: 'Mandato',        descripcion: 'Cuotas esperadas y deuda mensual',        etapas: ['Cuotas','Cartola BI','Vista deuda','Confirmar'],                             conecta: null,          href: null },
  { key: 'revision_log',   titulo: 'RevisiÃ³n Log',   descripcion: 'BD_LOG Drive â†’ Supabase',                etapas: ['Leer LOG','Validar','Aprobar','Sincronizar'],                                conecta: null,          href: null },
  { key: 'nubox',          titulo: 'Nubox',          descripcion: 'ExportaciÃ³n contable mensual',            etapas: ['Exportar','RevisiÃ³n','Carga Nubox','Cierre'],                                conecta: null,          href: null },
  { key: 'bi_sa',          titulo: 'BI y SA',        descripcion: 'KPIs y reportes para direcciÃ³n',          etapas: ['Consolidar','KPIs','RevisiÃ³n','Distribuir'],                                 conecta: null,          href: '/panel' },
  { key: 'descuentos',     titulo: 'Descuentos',     descripcion: 'Descuentos a propietarios',               etapas: ['Revisar','Autorizar','Aplicar','Confirmar'],                                 conecta: 'LiquidaciÃ³n', href: null },
  { key: 'notificaciones', titulo: 'Notificaciones', descripcion: 'Avisos automÃ¡ticos a arrendatarios',      etapas: ['Generar','Enviar','Acuses','No entregados'],                                 conecta: null,          href: null },
]

const PROCESOS_INDIVIDUALES = [
  { key: 'publicacion', titulo: 'Publicación', descripcion: 'Depto vacío → candidato',           etapas: ['Detectar','Publicar','Visitas','Selección','Cierre'],                        conecta: 'Inicios',     href: '/publicaciones' },
  { key: 'inicios',     titulo: 'Inicios',     descripcion: 'Contrato, firma y ciclo mensual',   etapas: ['Validar','Contrato','Firma','LOG','Activar'],                                conecta: null,          href: null },
  { key: 'termino',     titulo: 'TÃ©rmino',     descripcion: 'Aviso legal, recepciÃ³n y garantÃ­as',etapas: ['Aviso','Registro','Legal','Excel','RecepciÃ³n','GGCC','GarantÃ­as','Cierre'],  conecta: 'PublicaciÃ³n', href: null },
  { key: 'cobranza',    titulo: 'Cobranza',    descripcion: 'Impago â†’ pago o acciÃ³n legal',      etapas: ['Detectar','Aviso 1','GestiÃ³n','Legal','Cierre'],                             conecta: null,          href: '/op/deudas' },
  { key: 'incidencia',  titulo: 'Incidencia',  descripcion: 'Reporte, resoluciÃ³n y cierre',      etapas: ['Reporte','Clasificar','Validar','Resolver','Cierre'],                        conecta: null,          href: null },
]

const ROL_COLORS = {
  responsable: { bg: '#E1F5EE', color: '#085041' },
  colaborador:  { bg: '#E6F1FB', color: '#0C447C' },
  supervisor:   { bg: '#FAEEDA', color: '#633806' },
  observador:   { bg: '#F1EFE8', color: '#444441' },
}

function ProcesCard({ proceso, permiso, onClick, expanded, onToggle, isMobile }) {
  const tiene = !!permiso
  const rol = permiso?.rol
  const rolInfo = ROL_COLORS[rol] || null

  if (isMobile) {
    return (
      <div
        style={{
          background: '#fff',
          border: `0.5px solid ${tiene ? '#B4B2A9' : '#D3D1C7'}`,
          borderLeft: `3px solid ${tiene ? '#1D9E75' : '#D3D1C7'}`,
          borderRadius: '0 10px 10px 0',
          marginBottom: 6,
          opacity: tiene ? 1 : 0.5,
        }}
      >
        <div
          onClick={() => tiene ? onToggle() : null}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', cursor: tiene ? 'pointer' : 'default' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!tiene && <span style={{ fontSize: 13 }}>ðŸ”’</span>}
            <span style={{ fontSize: 13, fontWeight: 500, color: '#2C2C2A' }}>{proceso.titulo}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {rolInfo && <span style={{ fontSize: 10, fontWeight: 500, padding: '1px 7px', borderRadius: 20, background: rolInfo.bg, color: rolInfo.color }}>{rol}</span>}
            {tiene && <span style={{ fontSize: 10, color: '#888' }}>{expanded ? 'â–²' : 'â–¼'}</span>}
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
            {proceso.conecta && (
              <div style={{ fontSize: 11, color: '#1D9E75', marginTop: 8 }}>â†³ {proceso.conecta}</div>
            )}
            {proceso.href && (
              <button
                onClick={() => onClick(proceso, true)}
                style={{ marginTop: 8, fontSize: 12, padding: '5px 12px', borderRadius: 6, border: 'none', background: '#1D9E75', color: '#fff', cursor: 'pointer' }}
              >
                Abrir â†’
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  // Desktop
  return (
    <div
      onClick={() => onClick(proceso, tiene)}
      style={{
        background: '#fff',
        border: `0.5px solid ${tiene ? '#B4B2A9' : '#D3D1C7'}`,
        borderLeft: `3px solid ${tiene ? '#1D9E75' : '#D3D1C7'}`,
        borderRadius: '0 10px 10px 0',
        padding: '11px 13px',
        cursor: tiene ? 'pointer' : 'default',
        opacity: tiene ? 1 : 0.5,
        transition: 'border-color 0.15s',
        position: 'relative',
      }}
      onMouseEnter={e => { if (tiene) e.currentTarget.style.borderColor = '#888780' }}
      onMouseLeave={e => { if (tiene) e.currentTarget.style.borderColor = '#B4B2A9' }}
    >
      {!tiene && <span style={{ position: 'absolute', top: 8, right: 10, fontSize: 13 }}>ðŸ”’</span>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4, gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: '#2C2C2A' }}>{proceso.titulo}</span>
        {rolInfo && (
          <span style={{ fontSize: 10, fontWeight: 500, padding: '1px 7px', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0, background: rolInfo.bg, color: rolInfo.color }}>
            {rol}
          </span>
        )}
      </div>
      <div style={{ fontSize: 11, color: '#888780', marginBottom: 6, lineHeight: 1.4 }}>{proceso.descripcion}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {proceso.etapas.map((e, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ fontSize: 10, color: tiene ? '#5F5E5A' : '#B4B2A9' }}>{e}</span>
            {i < proceso.etapas.length - 1 && <span style={{ fontSize: 9, color: '#D3D1C7' }}>â€º</span>}
          </span>
        ))}
      </div>
      {proceso.conecta && tiene && (
        <div style={{ marginTop: 6, fontSize: 10, color: '#1D9E75' }}>â†³ {proceso.conecta}</div>
      )}
    </div>
  )
}

export default function ProcesosPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [permisos, setPermisos] = useState({})
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
      setToast(`${proceso.titulo} â€” mÃ³dulo en construcciÃ³n`)
      setTimeout(() => setToast(null), 2500)
    }
  }

  const totalMasivos = PROCESOS_MASIVOS.filter(p => permisos[p.key]).length
  const totalInd = PROCESOS_INDIVIDUALES.filter(p => permisos[p.key]).length

  if (status === 'loading' || loading) {
    return (
      <>
        <TopNav />
        <div style={{ padding: 60, textAlign: 'center', color: '#888', fontSize: 14 }}>Cargando procesosâ€¦</div>
      </>
    )
  }

  const sectionLabel = (texto, disp, total) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0 8px' }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: '#888780', letterSpacing: '.06em', whiteSpace: 'nowrap' }}>{texto}</span>
      <div style={{ flex: 1, height: '0.5px', background: '#D3D1C7' }}></div>
      <span style={{ fontSize: 10, color: '#B4B2A9', whiteSpace: 'nowrap' }}>{disp}/{total}</span>
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
              {session?.user?.name?.split(' ')[0] || session?.user?.email?.split('@')[0]} Â· {totalMasivos + totalInd} procesos disponibles
            </div>
          </div>
          <button onClick={() => router.push('/panel')} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, border: '0.5px solid #D3D1C7', background: '#fff', cursor: 'pointer', color: '#2C2C2A', whiteSpace: 'nowrap' }}>
            â† Dashboard
          </button>
        </div>

        {/* LEYENDA */}
        {!isMobile && (
          <div style={{ display: 'flex', gap: 14, marginBottom: 14, fontSize: 11, color: '#888780', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#1D9E75', display: 'inline-block' }}></span>Con acceso</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#D3D1C7', display: 'inline-block' }}></span>Sin acceso</div>
            {Object.entries(ROL_COLORS).map(([key, val]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 10, fontWeight: 500, padding: '1px 7px', borderRadius: 20, background: val.bg, color: val.color }}>{key}</span>
              </div>
            ))}
          </div>
        )}

        {/* MASIVOS â€” 3 columnas en desktop */}
        {sectionLabel('PROCESOS MASIVOS â€” arrancan el 1 de cada mes', totalMasivos, PROCESOS_MASIVOS.length)}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 8 }}>
          {PROCESOS_MASIVOS.map(p => (
            <ProcesCard
              key={p.key}
              proceso={p}
              permiso={permisos[p.key]}
              onClick={handleClick}
              expanded={expanded === p.key}
              onToggle={() => setExpanded(expanded === p.key ? null : p.key)}
              isMobile={isMobile}
            />
          ))}
        </div>

        {/* INDIVIDUALES â€” 5 columnas en desktop */}
        {sectionLabel('PROCESOS INDIVIDUALES â€” se abren cuando ocurre el evento', totalInd, PROCESOS_INDIVIDUALES.length)}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(5, 1fr)', gap: 8 }}>
          {PROCESOS_INDIVIDUALES.map(p => (
            <ProcesCard
              key={p.key}
              proceso={p}
              permiso={permisos[p.key]}
              onClick={handleClick}
              expanded={expanded === p.key}
              onToggle={() => setExpanded(expanded === p.key ? null : p.key)}
              isMobile={isMobile}
            />
          ))}
        </div>

        {/* NOTA PIE */}
        <div style={{ marginTop: 20, padding: '10px 14px', background: '#F1EFE8', borderRadius: 8, fontSize: 11, color: '#5F5E5A' }}>
          Los procesos con ðŸ”’ requieren autorizaciÃ³n. Contacta con administraciÃ³n para solicitar acceso.
        </div>
      </div>

      {/* TOAST */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#2C2C2A', color: '#fff', fontSize: 13, padding: '10px 20px', borderRadius: 8, zIndex: 9999, boxShadow: '0 2px 12px rgba(0,0,0,0.15)', whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}
    </>
  )
}
