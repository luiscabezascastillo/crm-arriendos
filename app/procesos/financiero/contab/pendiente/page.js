// VERSION: v1 · 2026-08-19 · Vista "Pendiente de clasificar": lo que cae en el puente 1104-98, por unidad, con export a Excel (CSV).
'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import TopNav from '@/app/components/ui/TopNav'
import FinancieroNav from '@/app/components/ui/FinancieroNav'

const VERDE = '#085041'
const BORDE = '#E5E4DF'
const TENUE = '#888780'
const ROJO_BG = '#FBE9E7'
const ROJO = '#B23A3A'
const clp = (n) => (n == null || n === '' ? '' : Number(n).toLocaleString('es-CL'))

function fechaCL(f) {
  if (!f) return ''
  const d = new Date(f); if (isNaN(d)) return String(f)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

export default function PendientePage() {
  const { status } = useSession()
  const router = useRouter()
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [items, setItems] = useState([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => { if (status === 'unauthenticated') router.push('/') }, [status, router])

  const cargar = async () => {
    setCargando(true); setError(null)
    try {
      const r = await fetch(`/api/financiero/contab/pendiente?anio=${anio}`)
      const j = await r.json()
      if (j.error) { setError(j.error); setItems([]); return }
      setItems(j.items || [])
    } catch (e) { setError('No se pudo cargar.') } finally { setCargando(false) }
  }
  useEffect(() => { if (status === 'authenticated') cargar() }, [anio, status]) // eslint-disable-line

  const porOrigen = useMemo(() => {
    const m = {}
    for (const it of items) {
      const o = (m[it.origen] ||= { origen: it.origen, n: 0, monto: 0 })
      o.n += 1; o.monto += Number(it.monto) || 0
    }
    return Object.values(m).sort((a, b) => b.monto - a.monto)
  }, [items])

  const exportarExcel = () => {
    const cab = ['Unidad', 'Periodo', 'Fecha', 'Folio', 'Glosa', 'CCB', 'Monto', 'Cuenta a asignar']
    const filas = items.map(it => [it.origen, it.periodo, fechaCL(it.fecha), it.orden, it.glosa, it.ccb || '', it.monto, ''])
    const esc = (v) => { const s = String(v == null ? '' : v); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
    const csv = [cab, ...filas].map(r => r.map(esc).join(';')).join('\r\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `pendiente_clasificar_${anio}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF8' }}>
      <TopNav />
      <FinancieroNav activo="contab" />
      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '24px 20px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 13, color: TENUE, marginBottom: 4 }}>
              <span style={{ cursor: 'pointer', color: VERDE }} onClick={() => router.push('/procesos/financiero/contab')}>← CONTAB</span> · Pendiente de clasificar
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1A1A17', margin: 0 }}>Pendiente de clasificar</h1>
            <div style={{ fontSize: 14, color: TENUE, marginTop: 4 }}>Movimientos que caen en el puente 1104-98, por unidad. Al asignarles cuenta salen del puente.</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <select value={anio} onChange={e => setAnio(Number(e.target.value))} style={selStyle}>
              {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <button onClick={exportarExcel} disabled={!items.length} style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: items.length ? VERDE : '#B4B2A9', color: '#fff', fontSize: 14, fontWeight: 600, cursor: items.length ? 'pointer' : 'default' }}>Exportar a Excel</button>
          </div>
        </div>

        {error && <div style={{ padding: 14, borderRadius: 10, background: ROJO_BG, color: ROJO, marginBottom: 16 }}>{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {porOrigen.map(o => (
            <div key={o.origen} style={{ border: `1px solid ${BORDE}`, borderRadius: 10, background: '#fff', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1A1A17', textTransform: 'uppercase' }}>{o.origen}</div>
              <div style={{ fontSize: 13, color: TENUE }}>{o.n} mov · <b style={{ color: ROJO }}>{clp(o.monto)}</b></div>
            </div>
          ))}
          {!porOrigen.length && !cargando && (
            <div style={{ gridColumn: '1 / -1', padding: 30, textAlign: 'center', color: VERDE, border: `1px dashed ${BORDE}`, borderRadius: 12 }}>Nada pendiente en {anio}. El puente está a cero ✓</div>
          )}
        </div>

        {cargando ? (
          <div style={{ padding: 40, color: TENUE }}>Cargando…</div>
        ) : items.length > 0 && (
          <div style={{ overflowX: 'auto', border: `1px solid ${BORDE}`, borderRadius: 12, background: '#fff' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead><tr>
                <th style={th}>Unidad</th><th style={th}>Periodo</th><th style={th}>Fecha</th><th style={th}>Folio</th>
                <th style={th}>Glosa</th><th style={th}>CCB</th><th style={{ ...th, textAlign: 'right' }}>Monto</th>
              </tr></thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i}>
                    <td style={{ ...td, textTransform: 'uppercase', color: TENUE }}>{it.origen}</td>
                    <td style={td}>{it.periodo}</td>
                    <td style={td}>{fechaCL(it.fecha)}</td>
                    <td style={td}>{it.orden}</td>
                    <td style={td}>{it.glosa}</td>
                    <td style={td}>{it.ccb}</td>
                    <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{clp(it.monto)}</td>
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
