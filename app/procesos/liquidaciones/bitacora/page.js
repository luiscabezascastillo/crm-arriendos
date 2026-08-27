'use client'
// VERSION: 2026-08-26 · Añadido "← Volver" (BotonVolver, history.back) — convención de retorno. Hereda versión previa.
// RUTA: app/procesos/liquidaciones/bitacora/page.js
// VERSION: v1 · 2026-08-19 · BITÁCORA de facturación (solo lectura). Acceso EXCLUSIVO a Dirección/Karina
//   (alberto.cabezas, luis.cabezas, karina.morales). Lee /api/liquidaciones/bitacora-facturacion y muestra
//   cada línea emitida con quién y cuándo; resalta en rojo los idadmon con MÁS DE UNA emisión en el mes
//   (posible doble facturación). Filtro por mes y por texto (idadmon/propietario).

import { useState, useEffect, useMemo } from 'react'
import BotonVolver from '../../../components/ui/BotonVolver'
import { useSession } from 'next-auth/react'
import TopNav from '@/app/components/ui/TopNav'

const ACCESO = [
  'alberto.cabezas@fondocapital.com',
  'luis.cabezas@fondocapital.com',
  'karina.morales@fondocapital.com',
]
const MONO = '"DM Mono", "Roboto Mono", ui-monospace, Consolas, Menlo, monospace'
const MESES_TXT = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
const aammToTxt = aamm => { if (!aamm || String(aamm).length !== 4) return aamm; const a = String(aamm).slice(0, 2), m = parseInt(String(aamm).slice(2), 10); return `${MESES_TXT[m - 1] || '?'} 20${a}` }
const fmt = n => { const v = Math.round(Number(n) || 0); return v ? v.toLocaleString('es-CL') : '0' }
function mesActual() { const d = new Date(); return String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0') }
function generarMeses() {
  const out = []; const hoy = new Date()
  let d = new Date(2025, 0, 1); const fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1)
  while (d <= fin) { out.push(String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0')); d = new Date(d.getFullYear(), d.getMonth() + 1, 1) }
  return out.reverse()
}

export default function BitacoraFacturacion() {
  const { data: session, status } = useSession()
  const email = (session?.user?.email || '').toLowerCase()
  const permitido = ACCESO.includes(email)

  const [mes, setMes] = useState(mesActual())
  const [rows, setRows] = useState([])
  const [duplicados, setDuplicados] = useState([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [q, setQ] = useState('')

  const meses = useMemo(() => generarMeses(), [])

  useEffect(() => {
    if (status !== 'authenticated' || !permitido) return
    let vivo = true
    setCargando(true); setError(null)
    fetch('/api/liquidaciones/bitacora-facturacion?mes=' + encodeURIComponent(mes))
      .then(r => r.json())
      .then(d => { if (!vivo) return; if (d.error) { setError(d.error); setRows([]); setDuplicados([]) } else { setRows(d.rows || []); setDuplicados(d.duplicados || []) } })
      .catch(e => { if (vivo) setError(e.message) })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [mes, status, permitido])

  const dupSet = useMemo(() => new Set(duplicados), [duplicados])
  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return rows
    return rows.filter(r => (r.idadmon || '').toLowerCase().includes(t) || (r.propietario || '').toLowerCase().includes(t) || (r.idprop || '').toLowerCase().includes(t))
  }, [rows, q])

  const totalNeto = useMemo(() => visibles.reduce((a, r) => a + (Number(r.monto) || 0), 0), [visibles])

  if (status === 'loading') return (<><TopNav /><div style={{ padding: 40, color: '#888' }}>Cargando…</div></>)
  if (!permitido) return (<><TopNav /><div style={{ padding: 40, maxWidth: 700, margin: '0 auto', color: '#991B1B', fontFamily: '"DM Sans", sans-serif' }}>
    <h2>🔒 Bitácora de facturación</h2>
    <p>Acceso restringido a Dirección y Karina. Si necesitas verla, pídeselo a Luis, Alberto o Karina.</p>
  </div></>)

  const th = { textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#475569', padding: '8px 10px', borderBottom: '2px solid #E5E7EB', position: 'sticky', top: 0, background: '#F8FAFC', whiteSpace: 'nowrap' }
  const td = { fontSize: 12, padding: '6px 10px', borderBottom: '1px solid #F1F5F9', whiteSpace: 'nowrap' }
  const rt = { textAlign: 'right', fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }

  return (
    <>
      <TopNav />
      <BotonVolver />
      <div style={{ maxWidth: 1500, margin: '0 auto', padding: 20, fontFamily: '"DM Sans", sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
          <h2 style={{ margin: 0, color: '#1e3a8a' }}>Bitácora de facturación</h2>
          <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: '#E0E7FF', color: '#3730A3' }}>solo lectura · Dirección/Karina</span>
        </div>
        <p style={{ marginTop: 4, color: '#64748B', fontSize: 13 }}>
          Constancia de cada línea de facturación emitida (boletas y facturas), con quién la generó y cuándo. Es append-only: no se borra
          aunque se re-emita un propietario. Los <b style={{ color: '#991B1B' }}>idadmon en rojo</b> aparecen más de una vez en el mes → revisa por posible doble cobro.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', margin: '12px 0' }}>
          <label style={{ fontSize: 13, fontWeight: 600 }}>Mes:&nbsp;
            <select value={mes} onChange={e => setMes(e.target.value)} style={{ fontSize: 13, padding: '5px 8px', borderRadius: 6, border: '1px solid #CBD5E1' }}>
              {meses.map(m => <option key={m} value={m}>{aammToTxt(m)} ({m})</option>)}
            </select>
          </label>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Filtrar por idadmon o propietario…"
            style={{ fontSize: 13, padding: '6px 10px', borderRadius: 6, border: '1px solid #CBD5E1', minWidth: 260 }} />
          <span style={{ fontSize: 12, color: '#64748B' }}>{visibles.length} línea(s) · neto {fmt(totalNeto)}</span>
        </div>

        {dupSet.size > 0 && (
          <div style={{ border: '2px solid #DC2626', background: '#FEF2F2', borderRadius: 10, padding: '10px 14px', marginBottom: 12, color: '#991B1B', fontSize: 13 }}>
            <b>⚠️ {dupSet.size} idadmon con más de una emisión en {aammToTxt(mes)}:</b>{' '}
            {[...dupSet].map(k => k.split('·')[1]).join(', ')}. Revísalos: puede requerir nota de crédito.
          </div>
        )}

        {error && <div style={{ color: '#991B1B', padding: 10, background: '#FEF2F2', borderRadius: 8, marginBottom: 12 }}>Error: {error}</div>}
        {cargando && <div style={{ color: '#888', padding: 10 }}>Cargando bitácora…</div>}

        {!cargando && !error && (
          <div style={{ overflowX: 'auto', border: '1px solid #E5E7EB', borderRadius: 10 }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1100 }}>
              <thead>
                <tr>
                  <th style={th}>Fecha / hora</th><th style={th}>Mes</th><th style={th}>Propietario</th>
                  <th style={th}>IdAdmon</th><th style={th}>Inmueble</th><th style={{ ...th, textAlign: 'right' }}>Neto</th>
                  <th style={{ ...th, textAlign: 'right' }}>IVA</th><th style={th}>Tipo</th><th style={th}>Doc</th>
                  <th style={th}>Compl.</th><th style={th}>Usuario</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map(r => {
                  const dup = dupSet.has(r.mes + '·' + r.idadmon)
                  return (
                    <tr key={r.id} style={{ background: dup ? '#FEF2F2' : undefined }}>
                      <td style={{ ...td, fontFamily: MONO }}>{r.generado_en ? new Date(r.generado_en).toLocaleString('es-CL') : '—'}</td>
                      <td style={td}>{r.mes}</td>
                      <td style={td}>{r.idprop} — {r.propietario}</td>
                      <td style={{ ...td, fontWeight: 700, color: dup ? '#991B1B' : '#111' }}>{r.idadmon}{dup ? ' ⚠️' : ''}</td>
                      <td style={td}>{r.inmueble}</td>
                      <td style={{ ...td, ...rt }}>{fmt(r.monto)}</td>
                      <td style={{ ...td, ...rt }}>{fmt(r.iva)}</td>
                      <td style={td}>{r.tipo}</td>
                      <td style={{ ...td, fontFamily: MONO }}>{r.documento || '—'}</td>
                      <td style={td}>{r.es_complementaria ? 'sí' : ''}</td>
                      <td style={td}>{(r.usuario || '').split('@')[0]}</td>
                    </tr>
                  )
                })}
                {visibles.length === 0 && (
                  <tr><td colSpan={11} style={{ ...td, textAlign: 'center', color: '#94A3B8', padding: 24 }}>Sin emisiones registradas para este mes.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
