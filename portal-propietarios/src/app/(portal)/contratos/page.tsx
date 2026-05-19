'use client'
import { useEffect, useState } from 'react'

type Archivo = {
  tipo: 'arriendo' | 'administracion'
  nombre: string
  idadmon?: string
  fileId: string
  inmueble?: string
  arrendatario?: string
  fecha_inicio?: string
  termino_actual?: string
  cuota?: number
  unid?: string
}

export default function ContratosPage() {
  const [archivos, setArchivos] = useState<Archivo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/drive')
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setArchivos(d.archivos || [])
      })
      .catch(() => setError('Error al cargar contratos'))
      .finally(() => setLoading(false))
  }, [])

  const admon = archivos.filter(a => a.tipo === 'administracion')
  const arriendo = archivos.filter(a => a.tipo === 'arriendo')

  function fmtFecha(f?: string) {
    if (!f) return '—'
    const d = new Date(f)
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const FilaArchivo = ({ a }: { a: Archivo }) => (
    <div style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, background: '#FEF2F2', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <i className="ti ti-file-type-pdf" style={{ fontSize: 18, color: '#DC2626' }} aria-hidden="true"/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{a.nombre}</div>
          {a.idadmon && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{a.idadmon}</div>}
        </div>
        <a href={'https://drive.google.com/file/d/' + a.fileId + '/view'} target="_blank" rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#2B6CB8', fontWeight: 500, padding: '6px 12px', border: '1px solid #BFDBFE', borderRadius: 7, background: '#EFF6FF', textDecoration: 'none', whiteSpace: 'nowrap' }}>
          <i className="ti ti-eye" style={{ fontSize: 13 }} aria-hidden="true"/>
          Ver
        </a>
        <a href={'https://drive.google.com/uc?export=download&id=' + a.fileId}
          style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#059669', fontWeight: 500, padding: '6px 12px', border: '1px solid #A7F3D0', borderRadius: 7, background: '#ECFDF5', textDecoration: 'none', whiteSpace: 'nowrap' }}>
          <i className="ti ti-download" style={{ fontSize: 13 }} aria-hidden="true"/>
          Descargar
        </a>
      </div>

      {/* Datos del contrato desde Supabase */}
      {(a.inmueble || a.arrendatario) && (
        <div style={{ marginTop: 10, marginLeft: 48, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {a.inmueble && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 2 }}>Inmueble</div>
              <div style={{ fontSize: 11, color: '#374151' }}>{a.inmueble}</div>
            </div>
          )}
          {a.arrendatario && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 2 }}>Arrendatario</div>
              <div style={{ fontSize: 11, color: '#374151' }}>{a.arrendatario}</div>
            </div>
          )}
          {a.fecha_inicio && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 2 }}>Inicio</div>
              <div style={{ fontSize: 11, color: '#374151' }}>{fmtFecha(a.fecha_inicio)}</div>
            </div>
          )}
          {a.termino_actual && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 2 }}>Término</div>
              <div style={{ fontSize: 11, color: '#374151' }}>{fmtFecha(a.termino_actual)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )

  const Tabla = ({ lista, titulo }: { lista: Archivo[]; titulo: string }) => (
    <div className="tabla-wrap" style={{ marginBottom: '1.5rem' }}>
      <div className="tabla-head">
        <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{titulo}</span>
        <span style={{ fontSize: 12, color: '#6B7280' }}>{lista.length} documentos</span>
      </div>
      {lista.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No se encontraron documentos</div>
      ) : (
        <div>{lista.map(a => <FilaArchivo key={a.fileId} a={a} />)}</div>
      )}
    </div>
  )

  return (
    <div className="dash-wrap">
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: 22, fontWeight: 600, color: '#111827' }}>Contratos</div>
        <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>Documentos contractuales disponibles para descarga</div>
      </div>
      {loading && (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#6B7280', fontSize: 13 }}>
          <i className="ti ti-loader" style={{ fontSize: 24, display: 'block', marginBottom: 8 }} aria-hidden="true"/>
          Cargando documentos desde Drive...
        </div>
      )}
      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 10, padding: '1rem 1.5rem', color: '#DC2626', fontSize: 13 }}>{error}</div>
      )}
      {!loading && !error && (
        <>
          <Tabla lista={admon} titulo="Contrato de administracion" />
          <Tabla lista={arriendo} titulo="Contratos de arriendo" />
        </>
      )}
    </div>
  )
}
