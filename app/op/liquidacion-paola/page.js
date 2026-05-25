'use client'

import { useState, useEffect } from 'react'
import TopNav from '../../components/ui/TopNav'
import { useRouter } from 'next/navigation'

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
]

const COLOR_CONFIANZA = {
  alta:     { bg: '#f0fdf4', color: '#16a34a', label: '✓ Alta' },
  media:    { bg: '#eff6ff', color: '#1a56db', label: '~ Media' },
  sugerida: { bg: '#fffbeb', color: '#d97706', label: '? Sugerida' },
  baja:     { bg: '#fef3c7', color: '#d97706', label: '⚠ Baja' },
}

export default function LiquidacionPaolaPage() {
  const router = useRouter()
  const [archivos, setArchivos] = useState([])
  const [loadingArchivos, setLoadingArchivos] = useState(true)
  const [mesSeleccionado, setMesSeleccionado] = useState('')
  const [controlId, setControlId] = useState('')
  const [cartolaId, setCartolaId] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('contratos')
  const [guardadoOk, setGuardadoOk] = useState(false)

  useEffect(() => {
    const ahora = new Date()
    setMesSeleccionado(`${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`)
  }, [])

  useEffect(() => {
    setLoadingArchivos(true)
    fetch('/api/liquidacion-paola')
      .then(r => r.json())
      .then(d => { if (d.ok) setArchivos(d.files || []) })
      .catch(() => {})
      .finally(() => setLoadingArchivos(false))
  }, [])

  const archivosControl = archivos.filter(f => f.name.includes(`${mesSeleccionado}-Control`))
  const archivosCartola = archivos.filter(f => f.name.includes(`${mesSeleccionado}-Cartola`))

  useEffect(() => {
    setControlId(archivosControl.length === 1 ? archivosControl[0].id : '')
    setCartolaId(archivosCartola.length === 1 ? archivosCartola[0].id : '')
    setResultado(null)
    setGuardadoOk(false)
  }, [mesSeleccionado, archivos])

  const mesLabel = () => {
    if (!mesSeleccionado) return ''
    const [y, m] = mesSeleccionado.split('-')
    return `${MESES[parseInt(m) - 1]} ${y}`
  }

  async function procesar(guardarEnDrive = false) {
    if (guardarEnDrive) { setGuardando(true) } else { setProcesando(true) }
    setError(null)
    if (!guardarEnDrive) { setResultado(null); setGuardadoOk(false) }

    try {
      const body = { guardarEnDrive }
      if (controlId && cartolaId) {
        body.controlId = controlId
        body.cartolaId = cartolaId
      } else {
        body.mes = mesSeleccionado
      }

      const res = await fetch('/api/liquidacion-paola', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.ok) {
        setResultado(data)
        setTab('contratos')
        if (data.guardadoEnDrive) setGuardadoOk(true)
      } else {
        setError(data.error || 'Error al procesar')
      }
    } catch (e) {
      setError('Error de conexión: ' + e.message)
    }
    setProcesando(false)
    setGuardando(false)
  }

  function descargarExcel() {
    if (!resultado?.excelBase64) return
    const blob = new Blob(
      [Uint8Array.from(atob(resultado.excelBase64), c => c.charCodeAt(0))],
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${mesSeleccionado}-Control_${mesLabel()}_PROCESADO.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  const badgeConf = (c) => {
    const cfg = COLOR_CONFIANZA[c]
    if (!cfg) return null
    return <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, fontWeight: 600, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
  }

  const listo = mesSeleccionado && archivosControl.length > 0 && archivosCartola.length > 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      <TopNav />

      <div style={{ padding: '10px 24px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12, color: 'var(--gray-400)', cursor: 'pointer' }} onClick={() => router.back()}>← Volver</span>
        <span style={{ color: 'var(--border)' }}>|</span>
        <div style={{ width: 28, height: 28, background: '#c2410c', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="white" strokeWidth="2"/><polyline points="14 2 14 8 20 8" stroke="white" strokeWidth="2"/></svg>
        </div>
        <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--gray-900)', margin: 0 }}>Preparación Liquidación de Paola</h1>
      </div>

      <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>

        {/* Selección mes y archivos */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px', marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>
            1. Selecciona el mes a procesar
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <input type="month" value={mesSeleccionado} onChange={e => setMesSeleccionado(e.target.value)}
              style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--gray-50)', fontSize: 13, color: 'var(--gray-700)', fontFamily: 'inherit' }}
            />
            {mesSeleccionado && <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--gray-700)' }}>{mesLabel()}</span>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div style={{ padding: '12px 14px', borderRadius: 8, border: `1px solid ${archivosControl.length > 0 ? '#86efac' : 'var(--border)'}`, background: archivosControl.length > 0 ? '#f0fdf4' : 'var(--gray-50)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6 }}>📊 Archivo Control</div>
              {loadingArchivos ? (
                <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>Buscando en Drive...</div>
              ) : archivosControl.length === 0 ? (
                <div style={{ fontSize: 12, color: '#d97706' }}>⚠ No encontrado en Drive para {mesLabel()}</div>
              ) : archivosControl.length === 1 ? (
                <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 500 }}>✓ {archivosControl[0].name}</div>
              ) : (
                <select value={controlId} onChange={e => setControlId(e.target.value)}
                  style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12, fontFamily: 'inherit' }}>
                  <option value="">— Seleccionar —</option>
                  {archivosControl.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              )}
            </div>

            <div style={{ padding: '12px 14px', borderRadius: 8, border: `1px solid ${archivosCartola.length > 0 ? '#86efac' : 'var(--border)'}`, background: archivosCartola.length > 0 ? '#f0fdf4' : 'var(--gray-50)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6 }}>🏦 Cartola del banco</div>
              {loadingArchivos ? (
                <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>Buscando en Drive...</div>
              ) : archivosCartola.length === 0 ? (
                <div style={{ fontSize: 12, color: '#d97706' }}>⚠ No encontrada en Drive para {mesLabel()}</div>
              ) : archivosCartola.length === 1 ? (
                <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 500 }}>✓ {archivosCartola[0].name}</div>
              ) : (
                <select value={cartolaId} onChange={e => setCartolaId(e.target.value)}
                  style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12, fontFamily: 'inherit' }}>
                  <option value="">— Seleccionar —</option>
                  {archivosCartola.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={() => procesar(false)} disabled={!listo || procesando || guardando} style={{
              padding: '9px 20px', borderRadius: 8, border: 'none',
              background: (!listo || procesando || guardando) ? '#9ca3af' : '#c2410c',
              color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: (!listo || procesando || guardando) ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            }}>
              {procesando ? '⏳ Procesando...' : '⚡ Procesar liquidación'}
            </button>

            {resultado && (
              <>
                <button onClick={() => procesar(true)} disabled={guardando || procesando} style={{
                  padding: '9px 20px', borderRadius: 8, border: 'none',
                  background: guardando ? '#9ca3af' : '#1a56db',
                  color: '#fff', fontSize: 13, fontWeight: 600,
                  cursor: guardando ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                }}>
                  {guardando ? '⏳ Guardando...' : '☁️ Guardar en Drive'}
                </button>

                <button onClick={descargarExcel} style={{
                  padding: '9px 20px', borderRadius: 8, border: '1px solid var(--border)',
                  background: 'transparent', color: 'var(--gray-700)',
                  fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  📥 Descargar Excel
                </button>
              </>
            )}

            {guardadoOk && (
              <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
                ✓ Guardado en Drive correctamente
              </span>
            )}
            {error && <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 500 }}>❌ {error}</span>}
          </div>
        </div>

        {/* Resultados */}
        {resultado && (
          <>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
              {[
                { label: 'Contratos',       value: resultado.resumen.totalContratos,                              color: 'var(--gray-800)' },
                { label: 'Identificados',   value: resultado.resumen.identificados,                               color: '#16a34a' },
                { label: 'Sin pago',        value: resultado.resumen.sinPago,                                     color: '#d97706' },
                { label: 'Sin identificar', value: resultado.resumen.sinIdentificar,                              color: '#dc2626' },
                { label: 'Total recibido',  value: `$${resultado.resumen.totalRecibido.toLocaleString('es-CL')}`, color: '#1a56db' },
              ].map((k, i) => (
                <div key={i} style={{ padding: '12px 16px', borderRight: i < 4 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ fontSize: 10, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{k.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: k.color }}>{k.value}</div>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 2, background: 'var(--surface)', borderRadius: '12px 12px 0 0', border: '1px solid var(--border)', borderBottom: 'none', padding: '0 16px' }}>
              {[
                { key: 'contratos',       label: `Contratos (${resultado.resultado.length})` },
                { key: 'sin_identificar', label: `Sin identificar (${resultado.sinIdentificar.length})` },
              ].map(t => (
                <button key={t.key} onClick={() => setTab(t.key)} style={{
                  padding: '10px 16px', fontSize: 12,
                  fontWeight: tab === t.key ? 500 : 400,
                  color: tab === t.key ? '#1a56db' : 'var(--gray-400)',
                  background: 'none', border: 'none',
                  borderBottom: tab === t.key ? '2px solid #1a56db' : '2px solid transparent',
                  cursor: 'pointer', fontFamily: 'inherit', marginBottom: '-1px',
                }}>{t.label}</button>
              ))}
            </div>

            {/* Tabla contratos */}
            {tab === 'contratos' && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: 80 }} /><col style={{ width: 180 }} />
                    <col style={{ width: 100 }} /><col style={{ width: 100 }} />
                    <col style={{ width: 100 }} /><col style={{ width: 110 }} />
                    <col style={{ width: 90 }} /><col />
                  </colgroup>
                  <thead>
                    <tr style={{ background: 'var(--gray-50)' }}>
                      {['IDADMON','Arrendatario','A Cobrar','Recibido','Falta','Fecha(s) pago','Confianza','Detalle'].map((h,i) => (
                        <th key={i} style={{ padding: '9px 10px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.resultado.map((r, i) => {
                      const rowBg = r.confianza === 'sugerida' ? '#fffbeb' : r.confianza === 'baja' ? '#fef3c7' : !r.recibido ? '#fef2f2' : 'transparent'
                      return (
                        <tr key={i} style={{ background: rowBg }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-50)'}
                          onMouseLeave={e => e.currentTarget.style.background = rowBg}
                        >
                          <td style={{ padding: '8px 10px', fontSize: 12, fontWeight: 600, color: '#1a56db', borderBottom: '1px solid var(--border-subtle)' }}>{r.idadmon}</td>
                          <td style={{ padding: '8px 10px', fontSize: 11, color: 'var(--gray-700)', borderBottom: '1px solid var(--border-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.arrendatario}</td>
                          <td style={{ padding: '8px 10px', fontSize: 12, color: 'var(--gray-800)', borderBottom: '1px solid var(--border-subtle)', textAlign: 'right' }}>
                            {r.aCobrar ? `${r.unid === 'UF' ? 'UF ' : '$'}${Number(r.aCobrar).toLocaleString('es-CL')}` : '—'}
                          </td>
                          <td style={{ padding: '8px 10px', fontSize: 12, fontWeight: r.recibido ? 600 : 400, color: r.recibido ? '#16a34a' : '#dc2626', borderBottom: '1px solid var(--border-subtle)', textAlign: 'right' }}>
                            {r.recibido ? `$${r.recibido.toLocaleString('es-CL')}` : 'NO PAGADO'}
                          </td>
                          <td style={{ padding: '8px 10px', fontSize: 12, color: r.faltaMes > 0 ? '#dc2626' : '#16a34a', fontWeight: 500, borderBottom: '1px solid var(--border-subtle)', textAlign: 'right' }}>
                            {r.faltaMes !== null ? (r.faltaMes > 0 ? `$${r.faltaMes.toLocaleString('es-CL')}` : '✓ OK') : '—'}
                          </td>
                          <td style={{ padding: '8px 10px', fontSize: 11, color: 'var(--gray-600)', borderBottom: '1px solid var(--border-subtle)' }}>
                            {r.fechas.join(' / ') || '—'}
                          </td>
                          <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
                            {r.confianza ? badgeConf(r.confianza) : <span style={{ fontSize: 11, color: 'var(--gray-300)' }}>—</span>}
                          </td>
                          <td style={{ padding: '8px 10px', fontSize: 10, color: 'var(--gray-400)', borderBottom: '1px solid var(--border-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.pagos.map((p, j) => (
                              <span key={j} style={{ marginRight: 6 }}>
                                ${p.monto.toLocaleString('es-CL')} <span style={{ color: 'var(--gray-300)' }}>({p.metodo})</span>
                              </span>
                            ))}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tabla sin identificar */}
            {tab === 'sin_identificar' && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
                {resultado.sinIdentificar.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: '#16a34a' }}>✓ Todos los abonos fueron identificados</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--gray-50)' }}>
                        {['Fecha','RUT','Detalle','Monto'].map((h,i) => (
                          <th key={i} style={{ padding: '9px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {resultado.sinIdentificar.map((a, i) => (
                        <tr key={i} style={{ background: '#fef2f2' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-50)'}
                          onMouseLeave={e => e.currentTarget.style.background = '#fef2f2'}
                        >
                          <td style={{ padding: '8px 12px', fontSize: 11, color: 'var(--gray-600)', borderBottom: '1px solid var(--border-subtle)' }}>
                            {a.fecha instanceof Date ? a.fecha.toLocaleDateString('es-CL') : String(a.fecha).slice(0,10)}
                          </td>
                          <td style={{ padding: '8px 12px', fontSize: 11, fontWeight: 500, color: '#dc2626', borderBottom: '1px solid var(--border-subtle)' }}>{a.rut || '—'}</td>
                          <td style={{ padding: '8px 12px', fontSize: 11, color: 'var(--gray-700)', borderBottom: '1px solid var(--border-subtle)' }}>{a.detalle}</td>
                          <td style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, color: 'var(--gray-800)', borderBottom: '1px solid var(--border-subtle)', textAlign: 'right' }}>
                            ${a.monto.toLocaleString('es-CL')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
