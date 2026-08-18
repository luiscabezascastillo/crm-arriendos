// VERSION: v2 · 2026-08-18 · DJ 1835 REAL: rentas de arrendamiento por año y propiedad (vista vw_dj1835).
//   Selector de año, tabla por propiedad (rol, arrendatario, meses, monto anual) y total.
// RUTA: portal-propietarios/src/app/(portal)/dj1835/page.tsx
'use client'
import { useEffect, useMemo, useState } from 'react'
import { BadgeDesarrollo } from '@/components/EnDesarrollo'

type Linea = {
  idadmon: string; anio: number; rol: string | null; comuna_nombre: string | null
  rut_arrendatario: string | null; arrendatario: string | null; inmueble: string | null
  monto_anual: number | null; meses_arrendados: number | null
}

function fmtPeso(v: number): string {
  if (!v) return '—'
  return '$' + Math.round(Math.abs(v)).toLocaleString('es-CL')
}

export default function DJ1835Page() {
  const [lineas, setLineas] = useState<Linea[]>([])
  const [congelado, setCongelado] = useState<Record<string, boolean>>({})
  const [anioSel, setAnioSel] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/dj1835')
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return }
        const ls = (d.lineas || []) as Linea[]
        setLineas(ls)
        setCongelado(d.congeladoPorAnio || {})
        const anios = [...new Set(ls.map(l => String(l.anio)))].sort((a, b) => b.localeCompare(a))
        if (anios.length) setAnioSel(anios[0])
      })
      .catch(() => setError('Error al cargar el DJ 1835'))
      .finally(() => setLoading(false))
  }, [])

  const anios = useMemo(
    () => [...new Set(lineas.map(l => String(l.anio)))].sort((a, b) => b.localeCompare(a)),
    [lineas]
  )
  const delAnio = useMemo(() => lineas.filter(l => String(l.anio) === anioSel), [lineas, anioSel])
  const totalAnio = delAnio.reduce((s, l) => s + (Number(l.monto_anual) || 0), 0)

  const th: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.5px', padding: '10px 12px', textAlign: 'left', background: '#FAFAFA', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { fontSize: 12, color: '#111827', padding: '10px 12px', borderBottom: '1px solid #F3F4F6', verticalAlign: 'middle' }
  const tdMono: React.CSSProperties = { ...td, fontFamily: 'DM Mono, monospace', textAlign: 'right' }

  return (
    <div className="dash-wrap">
      <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 22, fontWeight: 600, color: '#111827' }}>DJ 1835 · SII</div>
        <BadgeDesarrollo texto="Beta" />
      </div>

      <div style={{ fontSize: 13, color: '#6B7280', marginBottom: '1.25rem', maxWidth: 720, lineHeight: 1.6 }}>
        Rentas de arrendamiento por propiedad, para tu Declaración Jurada 1835 del SII. El monto anual es la suma
        de lo cobrado en los meses arrendados de cada año. Es información <b>referencial</b> de apoyo a tu declaración.
      </div>

      {loading && (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#6B7280', fontSize: 13 }}>
          <i className="ti ti-loader" style={{ fontSize: 24, display: 'block', marginBottom: 8 }} aria-hidden="true" /> Cargando...
        </div>
      )}

      {!loading && error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 10, padding: '1rem 1.5rem', color: '#DC2626', fontSize: 13 }}>{error}</div>
      )}

      {!loading && !error && lineas.length === 0 && (
        <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: '2rem', textAlign: 'center', color: '#6B7280', fontSize: 13, maxWidth: 640 }}>
          Todavía no hay datos de arrendamiento para declarar.
        </div>
      )}

      {!loading && !error && lineas.length > 0 && (
        <>
          {/* Selector de año */}
          <div style={{ display: 'flex', gap: 8, marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            {anios.map(a => {
              const activo = a === anioSel
              return (
                <button key={a} onClick={() => setAnioSel(a)} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, border: `1px solid ${activo ? '#2B6CB8' : '#E5E7EB'}`,
                  background: activo ? '#2B6CB8' : '#fff', color: activo ? '#fff' : '#374151',
                }}>
                  {a}
                  {congelado[a] && (
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', padding: '1px 6px', borderRadius: 4, background: activo ? 'rgba(255,255,255,0.2)' : '#ECFDF5', color: activo ? '#fff' : '#059669', border: activo ? 'none' : '1px solid #A7F3D0' }}>Declarado</span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="tabla-wrap">
            <div className="tabla-head">
              <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Rentas {anioSel}</span>
              <span style={{ fontSize: 12, color: '#6B7280' }}>{delAnio.length} propiedades</span>
            </div>
            <div className="tabla-scroll">
              <table>
                <thead>
                  <tr>
                    <th style={th}>Inmueble</th>
                    <th style={th}>Rol SII</th>
                    <th style={th}>Comuna</th>
                    <th style={th}>Arrendatario</th>
                    <th style={th}>RUT arrendatario</th>
                    <th style={{ ...th, textAlign: 'center' }}>Meses</th>
                    <th style={{ ...th, textAlign: 'right' }}>Renta anual</th>
                  </tr>
                </thead>
                <tbody>
                  {delAnio.map(l => (
                    <tr key={l.idadmon}>
                      <td style={td}>
                        <div style={{ fontWeight: 500 }}>{l.inmueble || l.idadmon}</div>
                        <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{l.idadmon}</div>
                      </td>
                      <td style={{ ...td, fontFamily: 'DM Mono, monospace', color: l.rol ? '#111827' : '#DC2626' }}>{l.rol || 'sin rol'}</td>
                      <td style={{ ...td, fontSize: 11, color: '#6B7280' }}>{l.comuna_nombre || '—'}</td>
                      <td style={{ ...td, fontSize: 11, color: '#6B7280', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.arrendatario || '—'}</td>
                      <td style={{ ...td, fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#6B7280' }}>{l.rut_arrendatario || '—'}</td>
                      <td style={{ ...td, textAlign: 'center' }}>{l.meses_arrendados ?? '—'}</td>
                      <td style={tdMono}>{fmtPeso(Number(l.monto_anual) || 0)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#F9FAFB' }}>
                    <td colSpan={6} style={{ padding: '10px 12px', fontSize: 12, fontWeight: 700, color: '#111827', borderTop: '2px solid #E5E7EB' }}>Total {anioSel}</td>
                    <td style={{ ...tdMono, fontWeight: 700, color: '#111827', borderTop: '2px solid #E5E7EB' }}>{fmtPeso(totalAnio)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
