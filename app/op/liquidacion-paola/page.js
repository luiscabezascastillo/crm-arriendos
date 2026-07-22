// VERSION: v3 · 2026-07-22 · Fuera el Archivo Control (lo genera el CRM). Solo se sube la
//   CARTOLA de Paola, arrastrando o pinchando. Muestra la liquidación generada desde el CRM.
//   Esta versión es de SOLO LECTURA: no guarda, no genera Excel, no congela.
'use client'

import { useState, useEffect, useRef } from 'react'
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
  const [archivo, setArchivo] = useState(null)
  const [arrastrando, setArrastrando] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('liquidacion')

  useEffect(() => {
    const h = new Date()
    setMes(`${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`)
  }, [])

  useEffect(() => { setDatos(null); setError(null) }, [mes])

  const mesLabel = () => {
    if (!mes) return ''
    const [y, m] = mes.split('-')
    return `${MESES[parseInt(m, 10) - 1]} ${y}`
  }

  function aceptarArchivo(f) {
    if (!f) return
    if (!/\.xlsx?$/i.test(f.name)) { setError('La cartola tiene que ser un archivo .xlsx'); return }
    setError(null)
    setArchivo(f)
    setDatos(null)
  }

  async function procesar() {
    setProcesando(true); setError(null)
    try {
      let cartolaBase64 = null
      if (archivo) {
        const buf = await archivo.arrayBuffer()
        let bin = ''
        const bytes = new Uint8Array(buf)
        for (let i = 0; i < bytes.length; i += 8192) {
          bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192))
        }
        cartolaBase64 = btoa(bin)
      }
      const res = await fetch('/api/liquidacion-paola', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes, cartolaBase64 }),
      })
      const d = await res.json()
      if (d.ok) { setDatos(d); setTab('liquidacion') }
      else setError(d.error || 'Error al procesar')
    } catch (e) {
      setError('Error de conexión: ' + e.message)
    }
    setProcesando(false)
  }

  const badge = c => {
    const cfg = COLOR_CONFIANZA[c]
    if (!cfg) return <span style={{ fontSize: 11, color: 'var(--gray-300)' }}>—</span>
    return <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, fontWeight: 600, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
  }

  const th = { padding: '9px 10px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }
  const td = { padding: '8px 10px', fontSize: 12, color: 'var(--gray-800)', borderBottom: '1px solid var(--border-subtle)' }

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

          {/* Zona de carga de la cartola */}
          <div
            onDragOver={e => { e.preventDefault(); setArrastrando(true) }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={e => { e.preventDefault(); setArrastrando(false); aceptarArchivo(e.dataTransfer.files?.[0]) }}
            onClick={() => inputRef.current?.click()}
            style={{
              border: `2px dashed ${arrastrando ? '#c2410c' : archivo ? '#16a34a' : 'var(--border)'}`,
              background: arrastrando ? '#fff7ed' : archivo ? '#f0fdf4' : 'var(--gray-50)',
              borderRadius: 10, padding: '22px 18px', textAlign: 'center', cursor: 'pointer',
              transition: 'all .15s',
            }}>
            <input ref={inputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
              onChange={e => aceptarArchivo(e.target.files?.[0])} />
            {archivo ? (
              <>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#16a34a' }}>✓ {archivo.name}</div>
                <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>
                  {(archivo.size / 1024).toFixed(0)} KB · pincha para cambiarla
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, color: 'var(--gray-700)', fontWeight: 500 }}>🏦 Arrastra aquí la cartola del banco de Paola</div>
                <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>o pincha para elegir el archivo (.xlsx)</div>
              </>
            )}
          </div>

          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={procesar} disabled={!mes || procesando}
              style={{
                padding: '10px 18px', fontSize: 13, fontWeight: 600, color: 'white',
                background: (!mes || procesando) ? 'var(--gray-300)' : '#c2410c',
                border: 'none', borderRadius: 8, cursor: (!mes || procesando) ? 'default' : 'pointer',
                fontFamily: 'inherit',
              }}>
              {procesando ? 'Procesando…' : '⚡ Procesar liquidación'}
            </button>
            {!archivo && <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>Sin cartola se genera igual, pero sin la columna Recibido.</span>}
            {error && <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 500 }}>❌ {error}</span>}
          </div>
        </div>

        {datos && (
          <>
            {datos.avisos?.resincronizarCartas && (
              <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: '#92400e' }}>
                ⚠ CARTAS no conoce {datos.avisos.desincronizados.join(', ')}. La foto del mes está
                desactualizada: conviene <strong>Resincronizar</strong> en CARTAS y volver a procesar.
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
              {[
                { label: 'Filas', value: datos.resumen.totalFilas },
                { label: 'Con importe', value: datos.resumen.conImporte },
                { label: 'Vacantes', value: datos.resumen.vacantes },
                { label: 'Sin identificar', value: datos.resumen.sinIdentificar, color: datos.resumen.sinIdentificar ? '#dc2626' : '#16a34a' },
                { label: 'A cobrar', value: `$${num(datos.resumen.totalACobrar)}`, color: 'var(--gray-800)' },
                { label: 'Recibido', value: `$${num(datos.resumen.totalRecibido)}`, color: '#1a56db' },
              ].map((k, i) => (
                <div key={i} style={{ padding: '12px 16px', borderRight: i < 5 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ fontSize: 10, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{k.label}</div>
                  <div style={{ fontSize: 17, fontWeight: 600, color: k.color || 'var(--gray-800)' }}>{k.value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 2, background: 'var(--surface)', borderRadius: '12px 12px 0 0', border: '1px solid var(--border)', borderBottom: 'none', padding: '0 16px' }}>
              {[
                { key: 'liquidacion', label: `Liquidación (${datos.resultado.length})` },
                { key: 'sin_identificar', label: `Sin identificar (${datos.sinIdentificar.length})` },
              ].map(t => (
                <button key={t.key} onClick={() => setTab(t.key)} style={{
                  padding: '10px 16px', fontSize: 12, fontWeight: tab === t.key ? 500 : 400,
                  color: tab === t.key ? '#1a56db' : 'var(--gray-400)', background: 'none', border: 'none',
                  borderBottom: tab === t.key ? '2px solid #1a56db' : '2px solid transparent',
                  cursor: 'pointer', fontFamily: 'inherit', marginBottom: '-1px',
                }}>{t.label}</button>
              ))}
            </div>

            {tab === 'liquidacion' && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0 0 12px 12px', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1250 }}>
                  <thead>
                    <tr style={{ background: 'var(--gray-50)' }}>
                      {['Est', 'IdAdmon', 'Propiedad', 'Comienzo', 'Termino', 'Arrendatario', 'RUT',
                        'A Cobrar', 'Recibido', 'Falta', 'Fecha pago', 'G.Comunes', 'Luz', 'Agua', 'Conf.']
                        .map((h, i) => <th key={i} style={th}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {datos.resultado.map((r, i) => (
                      <tr key={i} style={{ background: r.vacante ? '#f5e9da' : r.confianza === 'sugerida' ? '#fffbeb' : 'transparent' }}>
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
                    ))}
                  </tbody>
                </table>
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
                        {['Fecha', 'RUT detectado', 'Detalle', 'Monto'].map((h, i) => <th key={i} style={th}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {datos.sinIdentificar.map((a, i) => (
                        <tr key={i} style={{ background: '#fef2f2' }}>
                          <td style={{ ...td, fontSize: 11 }}>{fecha(a.fecha) || String(a.fecha)}</td>
                          <td style={{ ...td, fontSize: 11, color: '#dc2626', fontWeight: 500 }}>{a.rut || '—'}</td>
                          <td style={{ ...td, fontSize: 11 }}>{a.detalle}</td>
                          <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{num(a.monto)}</td>
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
