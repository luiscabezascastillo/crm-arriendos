// VERSION: v5 · 2026-07-22 · Cruce sobre el BUSCADOR. Nueva pestaña "No es renta" (ingresos de
//   Paola ajenos al arriendo) y, en "Sin identificar", un desplegable por abono para asignarlo a
//   un contrato o marcarlo como no-renta: esa confirmación alimenta el buscador.
'use client'

import { useState, useEffect, useRef, Fragment } from 'react'
import TopNav from '../../components/ui/TopNav'
import { useRouter } from 'next/navigation'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const COLOR_CONFIANZA = {
  alta: { bg: '#f0fdf4', color: '#16a34a', label: '✓ Alta' },
  media: { bg: '#eff6ff', color: '#1a56db', label: '~ Media' },
  sugerida: { bg: '#fffbeb', color: '#d97706', label: '? Sugerida' },
  baja: { bg: '#fef3c7', color: '#d97706', label: '⚠ Baja' },
}

const num = n => (n == null ? '—' : Number(n).toLocaleString('es-CL'))
const fecha = s => (s ? String(s).split('-').reverse().join('-') : '—')

export default function LiquidacionPaolaPage() {
  const router = useRouter()
  const inputRef = useRef(null)

  const [mes, setMes] = useState('')
  const [archivosDrive, setArchivosDrive] = useState([])
  const [driveId, setDriveId] = useState('')
  const [errorDrive, setErrorDrive] = useState(null)
  const [archivoLocal, setArchivoLocal] = useState(null)
  const [arrastrando, setArrastrando] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('liquidacion')
  const [abierta, setAbierta] = useState(null)
  const [eleccion, setEleccion] = useState({})
  const [confirmando, setConfirmando] = useState(null)

  useEffect(() => {
    const h = new Date()
    setMes(`${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`)
  }, [])

  // Detección automática de la cartola del mes en Drive
  useEffect(() => {
    if (!mes) return
    setDatos(null); setError(null); setArchivoLocal(null); setDriveId('')
    fetch(`/api/liquidacion-paola?mes=${mes}`)
      .then(r => r.json())
      .then(d => {
        if (!d.ok) return
        const files = d.files || []
        setArchivosDrive(files)
        setErrorDrive(d.errorDrive || null)
        const delMes = files.filter(f => f.name.includes(`${mes}-Cartola`))
        if (delMes.length === 1) setDriveId(delMes[0].id)
      })
      .catch(() => {})
  }, [mes])

  const mesLabel = () => {
    if (!mes) return ''
    const [y, m] = mes.split('-')
    return `${MESES[parseInt(m, 10) - 1]} ${y}`
  }

  function aceptarArchivo(f) {
    if (!f) return
    if (!/\.xlsx?$/i.test(f.name)) { setError('La cartola tiene que ser un archivo .xlsx'); return }
    setError(null); setArchivoLocal(f); setDriveId(''); setDatos(null)
  }

  async function procesar() {
    setProcesando(true); setError(null)
    try {
      const body = { mes }
      if (archivoLocal) {
        const bytes = new Uint8Array(await archivoLocal.arrayBuffer())
        let bin = ''
        for (let i = 0; i < bytes.length; i += 8192) {
          bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192))
        }
        body.cartolaBase64 = btoa(bin)
      } else if (driveId) {
        body.cartolaDriveId = driveId
      }
      const res = await fetch('/api/liquidacion-paola', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const d = await res.json()
      if (d.ok) { setDatos(d); setTab('liquidacion'); setAbierta(null) }
      else setError(d.error || 'Error al procesar')
    } catch (e) {
      setError('Error de conexión: ' + e.message)
    }
    setProcesando(false)
  }

  async function confirmar(abono) {
    const valor = eleccion[abono.clave]
    if (!valor) return
    setConfirmando(abono.clave)
    try {
      const res = await fetch('/api/liquidacion-paola', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'confirmar', clave: abono.clave, rut: abono.rut, glosa: abono.detalle,
          idadmon: valor === 'NO_RENTA' ? null : valor,
          clase: valor === 'NO_RENTA' ? 'no_es_renta' : 'renta',
        }),
      })
      const d = await res.json()
      if (!d.ok) { setError(d.error || 'No se pudo guardar'); setConfirmando(null); return }
      await procesar()                    // se vuelve a cruzar ya con el buscador actualizado
    } catch (e) {
      setError('Error de conexión: ' + e.message)
    }
    setConfirmando(null)
  }

  const badge = c => {
    const cfg = COLOR_CONFIANZA[c]
    if (!cfg) return <span style={{ fontSize: 11, color: 'var(--gray-300)' }}>—</span>
    return <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, fontWeight: 600, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
  }

  const th = { padding: '9px 10px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }
  const td = { padding: '8px 10px', fontSize: 12, color: 'var(--gray-800)', borderBottom: '1px solid var(--border-subtle)' }
  const hayCartola = !!(archivoLocal || driveId)
  const cartolasDelMes = archivosDrive.filter(f => f.name.includes(`${mes}-Cartola`))

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      <TopNav />

      <div style={{ padding: '10px 24px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12, color: 'var(--gray-400)', cursor: 'pointer' }} onClick={() => router.back()}>← Volver</span>
        <span style={{ color: 'var(--border)' }}>|</span>
        <div style={{ width: 28, height: 28, background: '#c2410c', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="white" strokeWidth="2" /><polyline points="14 2 14 8 20 8" stroke="white" strokeWidth="2" /></svg>
        </div>
        <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--gray-900)', margin: 0 }}>Preparación Liquidación de Paola</h1>
      </div>

      <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>
            1. Mes a procesar y cartola de Paola
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <input type="month" value={mes} onChange={e => setMes(e.target.value)}
              style={{ padding: '7px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', color: 'var(--gray-800)' }} />
            <span style={{ fontSize: 13, color: 'var(--gray-600)' }}>{mesLabel()}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

            {/* A — la cartola del mes, detectada en Drive */}
            <div style={{
              border: `1px solid ${driveId ? '#16a34a' : 'var(--border)'}`,
              background: driveId ? '#f0fdf4' : 'var(--gray-50)',
              borderRadius: 10, padding: '14px 16px',
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 8 }}>🏦 Cartola del banco · en Drive</div>
              {cartolasDelMes.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                  {errorDrive ? `No se pudo leer Drive (${errorDrive})` : `No hay ninguna cartola de ${mesLabel()} en Drive.`}
                </div>
              ) : (
                cartolasDelMes.map(f => (
                  <div key={f.id} onClick={() => { setDriveId(f.id); setArchivoLocal(null); setDatos(null) }}
                    style={{
                      fontSize: 12, padding: '7px 9px', borderRadius: 7, cursor: 'pointer', marginBottom: 4,
                      background: driveId === f.id ? '#dcfce7' : 'transparent',
                      color: driveId === f.id ? '#15803d' : 'var(--gray-700)',
                      fontWeight: driveId === f.id ? 600 : 400,
                    }}>
                    {driveId === f.id ? '✓ ' : '○ '}{f.name}
                  </div>
                ))
              )}
            </div>

            {/* B — o subirla desde el equipo */}
            <div
              onDragOver={e => { e.preventDefault(); setArrastrando(true) }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={e => { e.preventDefault(); setArrastrando(false); aceptarArchivo(e.dataTransfer.files?.[0]) }}
              onClick={() => inputRef.current?.click()}
              style={{
                border: `2px dashed ${arrastrando ? '#c2410c' : archivoLocal ? '#16a34a' : 'var(--border)'}`,
                background: arrastrando ? '#fff7ed' : archivoLocal ? '#f0fdf4' : 'var(--gray-50)',
                borderRadius: 10, padding: '14px 16px', textAlign: 'center', cursor: 'pointer', transition: 'all .15s',
              }}>
              <input ref={inputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
                onChange={e => aceptarArchivo(e.target.files?.[0])} />
              {archivoLocal ? (
                <>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#16a34a' }}>✓ {archivoLocal.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>
                    {(archivoLocal.size / 1024).toFixed(0)} KB · pincha para cambiarla
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 12, color: 'var(--gray-700)', fontWeight: 500 }}>📎 …o arrastra aquí otra cartola</div>
                  <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>pincha para buscarla en el equipo (.xlsx)</div>
                </>
              )}
            </div>
          </div>

          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={procesar} disabled={!mes || procesando}
              style={{
                padding: '10px 18px', fontSize: 13, fontWeight: 600, color: 'white',
                background: (!mes || procesando) ? 'var(--gray-300)' : '#c2410c',
                border: 'none', borderRadius: 8, cursor: (!mes || procesando) ? 'default' : 'pointer', fontFamily: 'inherit',
              }}>
              {procesando ? 'Procesando…' : '⚡ Procesar liquidación'}
            </button>
            {!hayCartola && <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>Sin cartola se genera igual, pero sin la columna Recibido.</span>}
            {error && <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 500 }}>❌ {error}</span>}
          </div>
        </div>

        {datos && (
          <>
            {datos.avisos?.resincronizarCartas && (
              <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: '#92400e' }}>
                ⚠ CARTAS no conoce {datos.avisos.vacantesNuevas.join(', ')}. La foto del mes es anterior:
                conviene <strong>Resincronizar</strong> en CARTAS y volver a procesar.
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
              {[
                { label: 'Filas', value: datos.resumen.totalFilas },
                { label: 'Con importe', value: datos.resumen.conImporte },
                { label: 'A revisar', value: datos.resumen.revisar, color: datos.resumen.revisar ? '#d97706' : '#16a34a' },
                { label: 'Sin identificar', value: datos.resumen.sinIdentificar, color: datos.resumen.sinIdentificar ? '#dc2626' : '#16a34a' },
                { label: 'No es renta', value: datos.resumen.noEsRenta, color: 'var(--gray-500)' },
                { label: 'A cobrar', value: `$${num(datos.resumen.totalACobrar)}` },
                { label: 'Recibido', value: `$${num(datos.resumen.totalRecibido)}`, color: '#1a56db' },
              ].map((k, i) => (
                <div key={i} style={{ padding: '12px 16px', borderRight: i < 6 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ fontSize: 10, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{k.label}</div>
                  <div style={{ fontSize: 17, fontWeight: 600, color: k.color || 'var(--gray-800)' }}>{k.value}</div>
                </div>
              ))}
            </div>

            {datos.cartola && (
              <div style={{ fontSize: 11, color: 'var(--gray-400)', marginBottom: 12 }}>
                Cartola ({datos.cartola.origen}) · hoja «{datos.cartola.hoja}» · {datos.cartola.movimientos} abonos,
                {datos.cartola.conNota} con anotación manual · total ${num(datos.cartola.totalAbonos)}, de los que
                ${num(datos.resumen.totalRecibido)} son renta y ${num(datos.resumen.totalNoEsRenta)} están marcados
                como ingresos ajenos al arriendo.
              </div>
            )}

            <div style={{ display: 'flex', gap: 2, background: 'var(--surface)', borderRadius: '12px 12px 0 0', border: '1px solid var(--border)', borderBottom: 'none', padding: '0 16px' }}>
              {[
                { key: 'liquidacion', label: `Liquidación (${datos.resultado.length})` },
                { key: 'revisar', label: `Revisar (${datos.resumen.revisar})` },
                { key: 'sin_identificar', label: `Sin identificar (${datos.sinIdentificar.length})` },
                { key: 'no_renta', label: `No es renta (${datos.noEsRenta.length})` },
              ].map(t => (
                <button key={t.key} onClick={() => setTab(t.key)} style={{
                  padding: '10px 16px', fontSize: 12, fontWeight: tab === t.key ? 500 : 400,
                  color: tab === t.key ? '#1a56db' : 'var(--gray-400)', background: 'none', border: 'none',
                  borderBottom: tab === t.key ? '2px solid #1a56db' : '2px solid transparent',
                  cursor: 'pointer', fontFamily: 'inherit', marginBottom: '-1px',
                }}>{t.label}</button>
              ))}
            </div>

            {(tab === 'liquidacion' || tab === 'revisar') && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0 0 12px 12px', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1250 }}>
                  <thead>
                    <tr style={{ background: 'var(--gray-50)' }}>
                      {['', 'Est', 'IdAdmon', 'Propiedad', 'Comienzo', 'Termino', 'Arrendatario', 'RUT',
                        'A Cobrar', 'Recibido', 'Falta', 'Fecha pago', 'G.Comunes', 'Luz', 'Agua', 'Conf.']
                        .map((h, i) => <th key={i} style={th}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {datos.resultado.filter(r => tab === 'liquidacion' || r.revisar).map((r, i) => (
                      <Fragment key={r.idadmon}>
                        <tr onClick={() => setAbierta(abierta === r.idadmon ? null : r.idadmon)}
                          style={{
                            cursor: r.pagos?.length ? 'pointer' : 'default',
                            background: r.revisar ? '#fef2f2' : r.vacante ? '#f5e9da' : r.confianza === 'sugerida' ? '#fffbeb' : 'transparent',
                          }}>
                          <td style={{ ...td, color: 'var(--gray-300)', fontSize: 11 }}>{r.pagos?.length ? (abierta === r.idadmon ? '▾' : '▸') : ''}</td>
                          <td style={{ ...td, fontSize: 11, color: 'var(--gray-500)' }}>{r.estado || '—'}</td>
                          <td style={{ ...td, fontWeight: 600, color: '#1a56db' }}>{r.idadmon}</td>
                          <td style={{ ...td, fontSize: 11 }}>{r.propiedad}</td>
                          <td style={{ ...td, fontSize: 11 }}>{fecha(r.comienzo)}</td>
                          <td style={{ ...td, fontSize: 11 }}>{fecha(r.termino)}</td>
                          <td style={{ ...td, fontSize: 11 }}>{r.arrendatario}</td>
                          <td style={{ ...td, fontSize: 11 }}>{r.rut || '—'}</td>
                          <td style={{ ...td, textAlign: 'right' }}>{num(r.aCobrar)}</td>
                          <td style={{ ...td, textAlign: 'right', fontWeight: r.recibido ? 600 : 400, color: r.vacante ? 'var(--gray-300)' : r.recibido ? '#16a34a' : '#dc2626' }}>
                            {r.vacante ? '—' : r.recibido ? num(r.recibido) : 'NO PAGADO'}
                          </td>
                          <td style={{ ...td, textAlign: 'right', color: r.faltaMes > 0 ? '#dc2626' : r.faltaMes < 0 ? '#d97706' : '#16a34a' }}>
                            {r.faltaMes == null ? '—' : num(r.faltaMes)}
                          </td>
                          <td style={{ ...td, fontSize: 11 }}>{fecha(r.fechaPago)}</td>
                          <td style={{ ...td, textAlign: 'right', fontSize: 11 }}>{num(r.deudaGgcc)}</td>
                          <td style={{ ...td, textAlign: 'right', fontSize: 11 }}>{num(r.deudaLuz)}</td>
                          <td style={{ ...td, textAlign: 'right', fontSize: 11 }}>{num(r.deudaAgua)}</td>
                          <td style={td}>{badge(r.confianza)}</td>
                        </tr>
                        {abierta === r.idadmon && r.pagos?.map((p, j) => (
                          <tr key={`${r.idadmon}-${j}`} style={{ background: 'var(--gray-50)' }}>
                            <td style={td}></td>
                            <td style={{ ...td, fontSize: 11, color: 'var(--gray-400)' }} colSpan={6}>
                              {fecha(p.fecha)} · {p.detalle}
                            </td>
                            <td style={{ ...td, fontSize: 11, color: 'var(--gray-400)' }}>{p.metodo}</td>
                            <td style={td}></td>
                            <td style={{ ...td, textAlign: 'right', fontSize: 11, fontWeight: 600 }}>{num(p.monto)}</td>
                            <td style={td} colSpan={6}></td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
                {tab === 'revisar' && datos.resumen.revisar === 0 && (
                  <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: '#16a34a' }}>✓ Ninguna fila cobra por encima de lo debido</div>
                )}
              </div>
            )}

            {tab === 'sin_identificar' && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
                {datos.sinIdentificar.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: '#16a34a' }}>✓ Todos los abonos quedaron identificados</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--gray-50)' }}>
                        {['Fecha', 'RUT', 'Detalle', 'Monto', 'Por qué', 'Asignar a'].map((h, i) => <th key={i} style={th}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {datos.sinIdentificar.map((a, i) => (
                        <tr key={i} style={{ background: '#fef2f2' }}>
                          <td style={{ ...td, fontSize: 11 }}>{fecha(a.fecha) || String(a.fecha)}</td>
                          <td style={{ ...td, fontSize: 11, color: '#dc2626', fontWeight: 500 }}>{a.rut || '—'}</td>
                          <td style={{ ...td, fontSize: 11 }}>{a.detalle}</td>
                          <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{num(a.monto)}</td>
                          <td style={{ ...td, fontSize: 10, color: 'var(--gray-500)', maxWidth: 260 }}>{a.motivo}</td>
                          <td style={{ ...td, whiteSpace: 'nowrap' }}>
                            <select
                              value={eleccion[a.clave] || (a.sugerencia ? a.sugerencia.idadmon : '')}
                              onChange={e => setEleccion({ ...eleccion, [a.clave]: e.target.value })}
                              style={{ fontSize: 11, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--border)', fontFamily: 'inherit', maxWidth: 210 }}>
                              <option value="">— elegir —</option>
                              <option value="NO_RENTA">No es renta (ingreso de Paola)</option>
                              {(datos.contratos || []).map(c => (
                                <option key={c.idadmon} value={c.idadmon}>
                                  {c.idadmon} · {c.propiedad.replace('Pablo Urzúa 1481- ', '')}
                                </option>
                              ))}
                            </select>
                            <button onClick={() => confirmar(a)}
                              disabled={confirmando === a.clave || !(eleccion[a.clave] || a.sugerencia)}
                              style={{
                                marginLeft: 6, fontSize: 11, padding: '4px 10px', borderRadius: 6, border: 'none',
                                color: 'white', fontFamily: 'inherit',
                                background: (confirmando === a.clave || !(eleccion[a.clave] || a.sugerencia)) ? 'var(--gray-300)' : '#16a34a',
                                cursor: (confirmando === a.clave || !(eleccion[a.clave] || a.sugerencia)) ? 'default' : 'pointer',
                              }}>
                              {confirmando === a.clave ? '…' : 'Confirmar'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {tab === 'no_renta' && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
                <div style={{ padding: '10px 16px', fontSize: 11, color: 'var(--gray-500)', borderBottom: '1px solid var(--border-subtle)' }}>
                  Abonos que el buscador tiene marcados como ingresos de Paola ajenos al arriendo.
                  No cuentan como cobro ni quedan pendientes.
                </div>
                {datos.noEsRenta.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: 'var(--gray-400)' }}>Ninguno</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--gray-50)' }}>
                        {['Fecha', 'RUT', 'Detalle', 'Monto'].map((h, i) => <th key={i} style={th}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {datos.noEsRenta.map((a, i) => (
                        <tr key={i}>
                          <td style={{ ...td, fontSize: 11 }}>{fecha(a.fecha) || String(a.fecha)}</td>
                          <td style={{ ...td, fontSize: 11, color: 'var(--gray-500)' }}>{a.rut || '—'}</td>
                          <td style={{ ...td, fontSize: 11, color: 'var(--gray-500)' }}>{a.detalle}</td>
                          <td style={{ ...td, textAlign: 'right', color: 'var(--gray-500)' }}>{num(a.monto)}</td>
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
