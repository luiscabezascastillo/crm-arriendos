// VERSION: v4 · 2026-08-18 · 4 vistas como el CRM financiero (Legible / Formato SII / Valores CSV / Líneas CSV),
//   meses MARCADOS (A/·, comprobacion de verdadero) y botón "Descargar .csv". Fuente: vw_dj1835 filtrada por idprop.
// RUTA: portal-propietarios/src/app/(portal)/dj1835/page.tsx
'use client'
import { useEffect, useMemo, useState } from 'react'
import { BadgeDesarrollo } from '@/components/EnDesarrollo'

type Linea = {
  idadmon: string; anio: number
  rol: string | null; comuna_sii: string | null; comuna_nombre: string | null
  rut_propietario: string | null; rut_arrendatario: string | null
  arrendatario: string | null; propietario: string | null; inmueble: string | null
  monto_anual: number | null; meses_arrendados: number | null
  falta_comuna?: boolean | null; falta_rut_propietario?: boolean | null
  [k: string]: unknown
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MES_UP = MESES.map(m => m.toUpperCase())
const RUT_FCR = { num: '76828712', dv: '0' }

const CAB_SII = [
  'MANZANA', 'PREDIO', 'COD_COMUNA', 'RUT_PROPIETARIO',
  'RUT_FCR', 'DV_FCR', 'RUT_ARREND', 'DV_ARREND', 'MONTO_ANUAL',
  ...MES_UP, 'AMOBLADO', 'DESTINO', 'DFL2', 'NATURALEZA',
]

const clp = (n: unknown): string => (n == null || n === '' ? '' : Number(n).toLocaleString('es-CL'))

function partirRol(rol: string | null) {
  if (!rol) return { manzana: '', predio: '' }
  const m = String(rol).match(/(\d+)\s*-\s*(\d+)/)
  if (!m) return { manzana: rol, predio: '' }
  return { manzana: m[1].padStart(5, '0'), predio: String(parseInt(m[2], 10)) }
}
function rutConGuion(rut: string | null) {
  if (!rut || rut === '') return '11111111-1'
  return String(rut).replace(/\./g, '').replace(/\s/g, '')
}
function rutPartido(rut: string | null) {
  if (!rut || rut === '') return { num: '11111111', dv: '1' }
  const s = String(rut).replace(/\./g, '').replace(/\s/g, '')
  const m = s.match(/(\d+)\s*-\s*([\dkK])/)
  if (!m) return { num: s, dv: '' }
  return { num: m[1], dv: m[2].toUpperCase() }
}

function filaSII(f: Linea): (string | number)[] {
  const { manzana, predio } = partirRol(f.rol)
  const arr = rutPartido(f.rut_arrendatario)
  return [
    manzana, predio, f.comuna_sii || '',
    rutConGuion(f.rut_propietario),
    RUT_FCR.num, RUT_FCR.dv,
    arr.num, arr.dv,
    f.monto_anual ?? 0,
    ...MESES.map(m => (f[m] ? 'A' : '')),
    1, 1, '', 2,
  ]
}

// Meses marcados: A si el mes tiene arriendo (comprobacion de verdadero, como en el CRM).
function mesesStr(f: Linea): string {
  return MESES.map(m => (f[m] ? 'A' : '·')).join('')
}

const AZUL = '#2B6CB8'
const BORDE = '#E5E7EB'

export default function DJ1835Page() {
  const [lineas, setLineas] = useState<Linea[]>([])
  const [congelado, setCongelado] = useState<Record<string, boolean>>({})
  const [anioSel, setAnioSel] = useState<string>('')
  const [vista, setVista] = useState<'LEGIBLE' | 'SII' | 'CSV' | 'LINEAS'>('LEGIBLE')
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

  const descargar = () => {
    const txt = delAnio.map(f => filaSII(f).join(';')).join('\r\n')
    const blob = new Blob([txt], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `DJ1835_${anioSel}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const th: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.5px', padding: '10px 12px', textAlign: 'left', background: '#FAFAFA', borderBottom: `1px solid ${BORDE}`, whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { fontSize: 12, color: '#111827', padding: '10px 12px', borderBottom: '1px solid #F3F4F6', verticalAlign: 'middle', whiteSpace: 'nowrap' }
  const tdMono: React.CSSProperties = { ...td, fontFamily: 'DM Mono, monospace', textAlign: 'right' }

  return (
    <div className="dash-wrap">
      <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 22, fontWeight: 600, color: '#111827' }}>DJ 1835 · SII</div>
        <BadgeDesarrollo texto="Beta" />
      </div>

      <div style={{ fontSize: 13, color: '#6B7280', marginBottom: '1.25rem', maxWidth: 760, lineHeight: 1.6 }}>
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
        <div style={{ background: '#F9FAFB', border: `1px solid ${BORDE}`, borderRadius: 10, padding: '2rem', textAlign: 'center', color: '#6B7280', fontSize: 13, maxWidth: 640 }}>
          Todavía no hay datos de arrendamiento para declarar.
        </div>
      )}

      {!loading && !error && lineas.length > 0 && (
        <>
          {/* Selector de año */}
          <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap' }}>
            {anios.map(a => {
              const activo = a === anioSel
              return (
                <button key={a} onClick={() => setAnioSel(a)} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, border: `1px solid ${activo ? AZUL : BORDE}`,
                  background: activo ? AZUL : '#fff', color: activo ? '#fff' : '#374151',
                }}>
                  {a}
                  {congelado[a] && (
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', padding: '1px 6px', borderRadius: 4, background: activo ? 'rgba(255,255,255,0.2)' : '#ECFDF5', color: activo ? '#fff' : '#059669', border: activo ? 'none' : '1px solid #A7F3D0' }}>Declarado</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Selector de vista + descargar */}
          <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {([['LEGIBLE', 'Legible'], ['SII', 'Formato SII'], ['CSV', 'Valores CSV'], ['LINEAS', 'Líneas CSV']] as const).map(([v, txt]) => {
              const activo = vista === v
              return (
                <button key={v} onClick={() => setVista(v)} style={{
                  padding: '7px 13px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${activo ? AZUL : BORDE}`, background: activo ? AZUL : '#fff', color: activo ? '#fff' : '#374151',
                }}>{txt}</button>
              )
            })}
            <div style={{ flex: 1 }} />
            <button onClick={descargar} style={{ padding: '7px 13px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: '#059669', color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className="ti ti-download" style={{ fontSize: 14 }} aria-hidden="true" /> Descargar .csv
            </button>
          </div>

          <div className="tabla-wrap">
            <div className="tabla-head">
              <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Rentas {anioSel}</span>
              <span style={{ fontSize: 12, color: '#6B7280' }}>{delAnio.length} propiedades · Total {clp(totalAnio) || '0'}</span>
            </div>
            <div className="tabla-scroll">

              {vista === 'LEGIBLE' && (
                <table>
                  <thead><tr>
                    <th style={th}>Inmueble</th>
                    <th style={th}>Rol SII</th>
                    <th style={th}>Comuna</th>
                    <th style={th}>Arrendatario</th>
                    <th style={th}>RUT arrendatario</th>
                    <th style={{ ...th, textAlign: 'center' }} title="A = mes arrendado · = sin arriendo">Meses (E→D)</th>
                    <th style={{ ...th, textAlign: 'right' }}>Renta anual</th>
                    <th style={{ ...th, textAlign: 'center' }}>Estado</th>
                  </tr></thead>
                  <tbody>
                    {delAnio.map((l, i) => (
                      <tr key={l.idadmon + i}>
                        <td style={td}>
                          <div style={{ fontWeight: 500, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.inmueble || l.idadmon}</div>
                          <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{l.idadmon}</div>
                        </td>
                        <td style={{ ...td, fontFamily: 'DM Mono, monospace', color: l.rol ? '#111827' : '#DC2626' }}>{l.rol || 'sin rol'}</td>
                        <td style={{ ...td, fontSize: 11, color: '#6B7280' }}>{l.comuna_nombre || '—'} <span style={{ color: '#9CA3AF' }}>{l.comuna_sii || ''}</span></td>
                        <td style={{ ...td, fontSize: 11, color: '#6B7280', maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.arrendatario || <span style={{ color: '#9CA3AF' }}>(extranjero)</span>}</td>
                        <td style={{ ...td, fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#6B7280' }}>{l.rut_arrendatario || <span style={{ color: '#9CA3AF' }}>11111111-1</span>}</td>
                        <td style={{ ...td, textAlign: 'center', fontFamily: 'DM Mono, monospace', letterSpacing: 2, color: AZUL }} title={`${l.meses_arrendados ?? 0} meses arrendados`}>{mesesStr(l)}</td>
                        <td style={tdMono}>{clp(l.monto_anual) ? '$' + clp(l.monto_anual) : '—'}</td>
                        <td style={{ ...td, textAlign: 'center' }}>
                          {(l.falta_comuna || l.falta_rut_propietario)
                            ? <span style={{ fontSize: 11, color: '#D97706' }}>faltan datos</span>
                            : <span style={{ fontSize: 11, color: '#059669' }}>ok</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#F9FAFB' }}>
                      <td colSpan={6} style={{ padding: '10px 12px', fontSize: 12, fontWeight: 700, color: '#111827', borderTop: `2px solid ${BORDE}` }}>Total {anioSel}</td>
                      <td style={{ ...tdMono, fontWeight: 700, borderTop: `2px solid ${BORDE}` }}>${clp(totalAnio) || '0'}</td>
                      <td style={{ borderTop: `2px solid ${BORDE}` }} />
                    </tr>
                  </tfoot>
                </table>
              )}

              {vista === 'SII' && (
                <table>
                  <thead><tr>{CAB_SII.map(c => <th key={c} style={th}>{c}</th>)}</tr></thead>
                  <tbody>
                    {delAnio.map((l, i) => (
                      <tr key={l.idadmon + i}>{filaSII(l).map((v, j) => <td key={j} style={j === 8 ? tdMono : td}>{v}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              )}

              {vista === 'CSV' && (
                <table>
                  <thead><tr>{CAB_SII.map((c, i) => <th key={c} style={{ ...th, textAlign: 'center' }}>{i + 1}</th>)}</tr></thead>
                  <tbody>
                    {delAnio.map((l, i) => (
                      <tr key={l.idadmon + i}>{filaSII(l).map((v, j) => <td key={j} style={td}>{v === '' ? '' : v}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              )}

              {vista === 'LINEAS' && (
                <table>
                  <thead><tr><th style={th}>#</th><th style={th}>LINEA_CSV</th></tr></thead>
                  <tbody>
                    {delAnio.map((l, i) => (
                      <tr key={l.idadmon + i}>
                        <td style={{ ...td, color: '#9CA3AF' }}>{i + 1}</td>
                        <td style={{ ...td, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12, whiteSpace: 'nowrap' }}>{filaSII(l).join(';')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

            </div>
          </div>

          {vista !== 'LEGIBLE' && (
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 8 }}>
              Formato de exportación al SII. RUT_FCR ({RUT_FCR.num}-{RUT_FCR.dv}) = Fondo Capital como administrador. La columna 9 es el monto anual; las 12 siguientes (ENE…DIC) marcan con “A” los meses arrendados.
            </div>
          )}
        </>
      )}
    </div>
  )
}
