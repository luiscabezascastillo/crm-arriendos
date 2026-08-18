// VERSION: v2 · 2026-08-18 · Liquidaciones REALES: lista/descarga los PDF de Drive por mes (agrupados por año).
//   Paola/P001 (cobro directo) ve una nota (su liquidacion va aparte). // RUTA: portal-propietarios/src/app/(portal)/liquidaciones/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { BadgeDesarrollo } from '@/components/EnDesarrollo'

type Fila = { fileId: string; nombre: string; aamm: string; anio: string; mesNum: string }

const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function FilaLiq({ f }: { f: Fila }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid #F3F4F6' }}>
      <div style={{ width: 36, height: 36, background: '#FEF2F2', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <i className="ti ti-file-type-pdf" style={{ fontSize: 18, color: '#DC2626' }} aria-hidden="true" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{MESES[parseInt(f.mesNum, 10)]} {f.anio}</div>
        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.nombre}</div>
      </div>
      <a href={'https://drive.google.com/file/d/' + f.fileId + '/view'} target="_blank" rel="noopener noreferrer"
        style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#2B6CB8', fontWeight: 500, padding: '6px 12px', border: '1px solid #BFDBFE', borderRadius: 7, background: '#EFF6FF', textDecoration: 'none', whiteSpace: 'nowrap' }}>
        <i className="ti ti-eye" style={{ fontSize: 13 }} aria-hidden="true" /> Ver
      </a>
      <a href={'https://drive.google.com/uc?export=download&id=' + f.fileId}
        style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#059669', fontWeight: 500, padding: '6px 12px', border: '1px solid #A7F3D0', borderRadius: 7, background: '#ECFDF5', textDecoration: 'none', whiteSpace: 'nowrap' }}>
        <i className="ti ti-download" style={{ fontSize: 13 }} aria-hidden="true" /> Descargar
      </a>
    </div>
  )
}

export default function LiquidacionesPage() {
  const [archivos, setArchivos] = useState<Fila[]>([])
  const [esDueno, setEsDueno] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/liquidaciones')
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else { setArchivos(d.archivos || []); setEsDueno(!!d.esDueno) }
      })
      .catch(() => setError('Error al cargar las liquidaciones'))
      .finally(() => setLoading(false))
  }, [])

  // Agrupar por año (desc)
  const porAnio = new Map<string, Fila[]>()
  for (const f of archivos) {
    if (!porAnio.has(f.anio)) porAnio.set(f.anio, [])
    porAnio.get(f.anio)!.push(f)
  }
  const anios = Array.from(porAnio.keys()).sort((a, b) => b.localeCompare(a))

  return (
    <div className="dash-wrap">
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 22, fontWeight: 600, color: '#111827' }}>Liquidaciones</div>
        <BadgeDesarrollo texto="Beta" />
      </div>

      {loading && (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#6B7280', fontSize: 13 }}>
          <i className="ti ti-loader" style={{ fontSize: 24, display: 'block', marginBottom: 8 }} aria-hidden="true" />
          Cargando liquidaciones desde Drive...
        </div>
      )}

      {!loading && error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 10, padding: '1rem 1.5rem', color: '#DC2626', fontSize: 13 }}>{error}</div>
      )}

      {!loading && !error && esDueno && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '14px 18px', maxWidth: 640 }}>
          <i className="ti ti-info-circle" style={{ fontSize: 18, color: '#2B6CB8', marginTop: 1 }} aria-hidden="true" />
          <div style={{ fontSize: 13, color: '#1E40AF', lineHeight: 1.6 }}>
            Como gestionas tú el cobro de la renta, tu liquidación se coordina de forma personalizada con la
            administración. Si necesitas un detalle o documento, contáctanos.
          </div>
        </div>
      )}

      {!loading && !error && !esDueno && archivos.length === 0 && (
        <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: '2rem', textAlign: 'center', color: '#6B7280', fontSize: 13, maxWidth: 640 }}>
          Todavía no hay liquidaciones disponibles. Aparecerán aquí en cuanto se emita la primera.
        </div>
      )}

      {!loading && !error && !esDueno && anios.map(anio => (
        <div key={anio} className="tabla-wrap" style={{ marginBottom: '1.5rem' }}>
          <div className="tabla-head">
            <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{anio}</span>
            <span style={{ fontSize: 12, color: '#6B7280' }}>{porAnio.get(anio)!.length} liquidaciones</span>
          </div>
          <div>{porAnio.get(anio)!.map(f => <FilaLiq key={f.fileId} f={f} />)}</div>
        </div>
      ))}
    </div>
  )
}
