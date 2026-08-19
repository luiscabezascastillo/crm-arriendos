// VERSION: v1 · 2026-08-19 · Vista Conciliación F29 (SII) vs pago en SA (desfase M->M+1), con export a Excel y cabecera sticky.
'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useMemo } from 'react'
import TopNav from '@/app/components/ui/TopNav'
import FinancieroNav from '@/app/components/ui/FinancieroNav'

const VERDE = '#085041'
const BORDE = '#E5E4DF'
const TENUE = '#888780'
const ROJO_BG = '#FBE9E7'
const ROJO = '#B23A3A'
const clp = (n) => (n == null || n === '' ? '' : Number(n).toLocaleString('es-CL'))

export default function F29SaPage() {
  const { status } = useSession()
  const router = useRouter()
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [filas, setFilas] = useState([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const contentRef = useRef(null)
  const [stickyTop, setStickyTop] = useState(96)

  useEffect(() => { if (status === 'unauthenticated') router.push('/') }, [status, router])

  useEffect(() => {
    const medir = () => {
      let alto = 0
      let el = contentRef.current ? contentRef.current.previousElementSibling : null
      while (el) {
        const pos = window.getComputedStyle(el).position
        if (pos === 'sticky' || pos === 'fixed') alto += Math.round(el.getBoundingClientRect().height)
        el = el.previousElementSibling
      }
      if (alto) setStickyTop(alto)
    }
    medir()
    window.addEventListener('resize', medir)
    const t = setTimeout(medir, 300)
    return () => { window.removeEventListener('resize', medir); clearTimeout(t) }
  }, [])

  const cargar = async () => {
    setCargando(true); setError(null)
    try {
      const r = await fetch(`/api/financiero/contab/f29-sa?anio=${anio}`)
      const j = await r.json()
      if (j.error) { setError(j.error); setFilas([]); return }
      setFilas(j.filas || [])
    } catch (e) { setError('No se pudo cargar.') } finally { setCargando(false) }
  }
  useEffect(() => { if (status === 'authenticated') cargar() }, [anio, status]) // eslint-disable-line

  const resumen = useMemo(() => {
    const cuadran = filas.filter(f => f.cuadra).length
    const difTotal = filas.reduce((s, f) => s + (Number(f.dif) || 0), 0)
    return { n: filas.length, cuadran, difTotal }
  }, [filas])

  const exportarExcel = () => {
    const cab = ['F29 mes', 'Tipo', 'IVA debito', 'IVA credito', 'PPM', 'Retencion', 'Total a pagar', 'Mes pago', 'Pagado SA', 'Diferencia']
    const fl = filas.map(f => [f.mes, f.tipo, f.iva_debito, f.iva_credito, f.ppm, f.retencion, f.total_a_pagar, f.pago_periodo, f.pagado, f.dif])
    const esc = (v) => { const s = String(v == null ? '' : v); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
    const csv = [cab, ...fl].map(r => r.map(esc).join(';')).join('\r\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `conciliacion_F29_SA_${anio}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const thSticky = { ...th, position: 'sticky', top: stickyTop, zIndex: 5 }

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF8' }}>
      <TopNav />
      <FinancieroNav activo="contab" />
      <div ref={contentRef} style={{ maxWidth: 1300, margin: '0 auto', padding: '24px 20px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 13, color: TENUE, marginBottom: 4 }}>
              <span style={{ cursor: 'pointer', color: VERDE }} onClick={() => router.push('/procesos/financiero/contab')}>← CONTAB</span> · Conciliación F29 ↔ SA
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1A1A17', margin: 0 }}>Conciliación F29 ↔ SA</h1>
            <div style={{ fontSize: 14, color: TENUE, marginTop: 4 }}>El F29 del mes M se paga por el Santander en M+1. Aquí se comparan.</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <select value={anio} onChange={e => setAnio(Number(e.target.value))} style={selStyle}>
              {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <button onClick={exportarExcel} disabled={!filas.length} style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: filas.length ? VERDE : '#B4B2A9', color: '#fff', fontSize: 14, fontWeight: 600, cursor: filas.length ? 'pointer' : 'default' }}>Exportar a Excel</button>
          </div>
        </div>

        {error && <div style={{ padding: 14, borderRadius: 10, background: ROJO_BG, color: ROJO, marginBottom: 16 }}>{error}</div>}

        {filas.length > 0 && (
          <div style={{ marginBottom: 16, fontSize: 14, color: '#1A1A17' }}>
            <b>{resumen.cuadran}</b> de <b>{resumen.n}</b> cuadran · diferencia acumulada{' '}
            <b style={{ color: Math.abs(resumen.difTotal) < 1 ? VERDE : ROJO }}>{clp(resumen.difTotal)}</b>
          </div>
        )}

        {cargando ? (
          <div style={{ padding: 40, color: TENUE }}>Cargando…</div>
        ) : filas.length === 0 ? (
          <div style={{ padding: 40, color: TENUE, textAlign: 'center', border: `1px dashed ${BORDE}`, borderRadius: 12 }}>No hay F29 vigentes en {anio}.</div>
        ) : (
          <div style={{ border: `1px solid ${BORDE}`, borderRadius: 12, background: '#fff' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead><tr>
                <th style={thSticky}>F29 mes</th><th style={thSticky}>Tipo</th>
                <th style={{ ...thSticky, textAlign: 'right' }}>IVA déb.</th><th style={{ ...thSticky, textAlign: 'right' }}>IVA créd.</th>
                <th style={{ ...thSticky, textAlign: 'right' }}>PPM</th><th style={{ ...thSticky, textAlign: 'right' }}>Retención</th>
                <th style={{ ...thSticky, textAlign: 'right' }}>Total a pagar</th><th style={thSticky}>Mes pago</th>
                <th style={{ ...thSticky, textAlign: 'right' }}>Pagado SA</th><th style={{ ...thSticky, textAlign: 'right' }}>Diferencia</th><th style={thSticky}>Cuadre</th>
              </tr></thead>
              <tbody>
                {filas.map((f, i) => (
                  <tr key={i}>
                    <td style={td}>{f.mes}</td>
                    <td style={{ ...td, color: TENUE, fontSize: 12 }}>{f.tipo}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{clp(f.iva_debito)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{clp(f.iva_credito)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{clp(f.ppm)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{clp(f.retencion)}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{clp(f.total_a_pagar)}</td>
                    <td style={td}>{f.pago_periodo}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{clp(f.pagado)}</td>
                    <td style={{ ...td, textAlign: 'right', color: f.cuadra ? TENUE : ROJO }}>{f.dif ? clp(f.dif) : ''}</td>
                    <td style={td}>{f.cuadra ? <span style={{ color: VERDE }}>✓</span> : <span style={{ color: ROJO }}>✗</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

const selStyle = { padding: '8px 12px', borderRadius: 8, border: `1px solid ${BORDE}`, fontSize: 15, fontWeight: 600, color: VERDE, background: '#fff' }
const th = { textAlign: 'left', padding: '10px 12px', fontSize: 12, fontWeight: 600, color: TENUE, borderBottom: `1px solid ${BORDE}`, whiteSpace: 'nowrap', background: '#FBFBF9' }
const td = { padding: '9px 12px', fontSize: 13, color: '#1A1A17', borderBottom: `1px solid ${BORDE}`, whiteSpace: 'nowrap' }
