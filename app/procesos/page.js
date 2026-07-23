'use client'
// VERSION: v2 · 2026-07-23 · La rejilla de tarjetas pasa a lista de FILAS de exactamente dos
//   líneas, ordenadas alfabéticamente por título. Los 16 procesos caben de un vistazo.
//   Line 1: acceso · título · frecuencia · responsable · participa · encargada/o
//   Line 2: descripción · etapas · proceso conectado  (recortada con … si no cabe)
//   AGRUPAR_POR_PRODUCCION arriba: false = una sola lista A-Z · true = producción aparte.

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import TopNav from '@/app/components/ui/TopNav'
import { PROCESOS } from '../../lib/procesos'

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

// false → una sola lista alfabética con los 16 · true → «ya en producción» en su propio bloque
const AGRUPAR_POR_PRODUCCION = false

// Alfabético por título, respetando acentos y mayúsculas del español
const porTitulo = (a, b) => String(a.titulo || '').localeCompare(String(b.titulo || ''), 'es', { sensitivity: 'base' })


const ROL_COLORS = {
  responsable: { bg: '#E1F5EE', color: '#085041' },
  colaborador:  { bg: '#E6F1FB', color: '#0C447C' },
  supervisor:   { bg: '#FAEEDA', color: '#633806' },
  observador:   { bg: '#F1EFE8', color: '#444441' },
}

const NOMBRE_BADGE    = { bg: '#E1F5EE', color: '#085041' }
const DIRECCION_BADGE = { bg: '#FAEEDA', color: '#633806' }

function FrecBadge({ frecuencia }) {
  if (!frecuencia) return null
  return (
    <span style={{ fontSize: 9, fontWeight: 500, padding: '1px 6px', borderRadius: 20, background: '#F1EFE8', color: '#888780' }}>
      {frecuencia}
    </span>
  )
}

/* Una fila = exactamente DOS líneas. La segunda se recorta con … antes que saltar a una tercera,
   así la altura es siempre la misma y los 16 procesos se recorren de un vistazo. */
function ProcesoFila({ proceso, permiso, responsablePersona, onClick, isMobile, esProduccion }) {
  const tiene = !!permiso
  const nombreResp = responsablePersona?.nombre
  const etapas = (proceso.etapas || []).join(' › ')
  const linea2 = [proceso.descripcion, etapas].filter(Boolean).join('  ·  ')

  return (
    <div
      onClick={() => !proceso.links && onClick(proceso, tiene)}
      title={tiene ? linea2 : `Sin acceso a ${proceso.titulo}`}
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'minmax(0,1fr) auto',
        gap: isMobile ? 2 : 12,
        alignItems: 'center',
        background: esProduccion ? PROD_BG : '#fff',
        border: `0.5px solid ${tiene ? '#B4B2A9' : '#E0DED6'}`,
        borderLeft: `3px solid ${tiene ? '#1D9E75' : '#D3D1C7'}`,
        borderRadius: '0 8px 8px 0',
        padding: isMobile ? '8px 10px' : '8px 12px',
        marginBottom: 4,
        cursor: proceso.links ? 'default' : (tiene ? 'pointer' : 'default'),
        opacity: tiene ? 1 : 0.55,
        transition: 'border-color .15s, background .15s',
      }}
      onMouseEnter={e => { if (tiene) e.currentTarget.style.borderColor = '#888780' }}
      onMouseLeave={e => { if (tiene) e.currentTarget.style.borderColor = '#B4B2A9' }}>

      <div style={{ minWidth: 0 }}>
        {/* LÍNEA 1 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          {!tiene && <span style={{ fontSize: 11, flexShrink: 0 }}>🔒</span>}
          <span style={{ fontSize: 13, fontWeight: 500, color: '#2C2C2A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {proceso.titulo}
          </span>
          <FrecBadge frecuencia={proceso.frecuencia} />
          {proceso.conecta && tiene && (
            <span style={{ fontSize: 10, color: '#1D9E75', whiteSpace: 'nowrap', flexShrink: 0 }}>↳ {proceso.conecta}</span>
          )}
        </div>

        {/* LÍNEA 2 — nunca salta a una tercera */}
        <div style={{
          fontSize: 11, color: tiene ? '#888780' : '#B4B2A9', lineHeight: 1.45, marginTop: 1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {linea2}
        </div>
      </div>

      {/* DERECHA — responsable, participantes y encargada/o */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
        marginTop: isMobile ? 5 : 0, flexWrap: isMobile ? 'wrap' : 'nowrap',
      }}>
        <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 8px', borderRadius: 20, whiteSpace: 'nowrap', background: RESP_CHIP.bg, color: RESP_CHIP.color }}>
          {proceso.responsable}
        </span>
        {!isMobile && proceso.participa?.length > 0 && (
          <span style={{ fontSize: 9, color: '#B4B2A9', whiteSpace: 'nowrap' }} title={'Participa: ' + proceso.participa.join(', ')}>
            +{proceso.participa.length}
          </span>
        )}
        {nombreResp && (
          <span style={{ fontSize: 10, color: '#B4B2A9', whiteSpace: 'nowrap' }}>{nombreResp}</span>
        )}
        {proceso.links && tiene && (
          <span style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
            {proceso.links.map((l, i) => (
              l.href
                ? <a key={i} href={l.href} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, border: '1px solid #D3D1C7', background: i === 0 ? '#E1F5EE' : '#F9FAFB', color: i === 0 ? '#085041' : '#374151', textDecoration: 'none', whiteSpace: 'nowrap' }}>{l.label}</a>
                : <span key={i} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, border: '1px dashed #D3D1C7', background: '#F9FAFB', color: '#B4B2A9', whiteSpace: 'nowrap' }}>{l.label}</span>
            ))}
          </span>
        )}
      </div>
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

  const renderLista = (lista, esProduccion = false) => (
    <div style={{ marginBottom: 8 }}>
      {[...lista].sort(porTitulo).map(p => (
        <ProcesoFila
          key={p.key}
          proceso={p}
          permiso={permisos[p.key]}
          responsablePersona={responsables[p.key]}
          onClick={handleClick}
          isMobile={isMobile}
          esProduccion={esProduccion ?? !!p.produccion}
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
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: PROD_BG, border: '0.5px solid #B4B2A9', display: 'inline-block' }}></span> Ya en producción
          </span>
          <span style={{ fontSize: 9, color: '#B4B2A9' }}>· la etiqueta junto al título es la frecuencia (Mensual / Semanal / Puntual)</span>
        </div>

        {/* LISTA ALFABÉTICA */}
        {AGRUPAR_POR_PRODUCCION ? (
          <>
            {(() => {
              const enProd = PROCESOS.filter(p => p.produccion)
              if (!enProd.length) return null
              const dispProd = enProd.filter(p => permisos[p.key]).length
              return (
                <div style={{ marginBottom: 6 }}>
                  {sectionLabel('PROCESOS YA EN PRODUCCIÓN', dispProd, enProd.length, { bg: '#E1F5EE', color: '#085041' })}
                  {renderLista(enProd, true)}
                </div>
              )
            })()}
            {(() => {
              const resto = PROCESOS.filter(p => !p.produccion)
              if (!resto.length) return null
              const dispResto = resto.filter(p => permisos[p.key]).length
              return (
                <div style={{ marginTop: 14 }}>
                  {sectionLabel('EN PREPARACIÓN', dispResto, resto.length, { bg: '#F1EFE8', color: '#5F5E5A' })}
                  {renderLista(resto, false)}
                </div>
              )
            })()}
          </>
        ) : (
          <div style={{ marginTop: 12 }}>
            {sectionLabel('TODOS LOS PROCESOS · A-Z', totalDisponibles, PROCESOS.length, { bg: '#E1F5EE', color: '#085041' })}
            {renderLista(PROCESOS, null)}
          </div>
        )}

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