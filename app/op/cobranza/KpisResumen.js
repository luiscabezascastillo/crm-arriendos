'use client'
// VERSION: v1 · 2026-08-26 · Cobranza · Widget-resumen de KPIs de salud del cobro.
//   4 KPIs (renta: cobrado en plazo · cartera por cobrar; servicios: deuda · al día) con el valor
//   actual y una mini-curva, y enlace a la vista de detalle (/op/cobranza/kpis). Consume /api/cobranza/kpis.
// Ruta real: app/op/cobranza/KpisResumen.js
import { useState, useEffect } from 'react'
import Link from 'next/link'
const C = { txt: '#2C2C2A', sub: '#888780', line: '#D3D1C7', verde: '#085041', rojo: '#9B1C1C', ambar: '#B8860B', azul: '#1D4ED8', acento: '#1D9E75' }
const P = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CL')
const Pk = (n) => { const v = Number(n) || 0; return v >= 1e6 ? '$' + (v / 1e6).toFixed(1) + 'M' : '$' + Math.round(v / 1000) + 'k' }

function spark(vals, color, w = 96, h = 26) {
  const xs = vals.filter(v => v != null)
  if (xs.length < 2) return null
  const min = Math.min(...xs), max = Math.max(...xs), rng = (max - min) || 1
  const step = w / (vals.length - 1)
  const pts = vals.map((v, i) => v == null ? null : `${(i * step).toFixed(1)},${(h - 3 - ((v - min) / rng) * (h - 6)).toFixed(1)}`).filter(Boolean).join(' ')
  return <svg width={w} height={h} style={{ display: 'block' }}><polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /></svg>
}
const tendencia = (vals) => { const xs = vals.filter(v => v != null); if (xs.length < 2) return 0; return xs[xs.length - 1] - xs[0] }

export default function KpisResumen() {
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    fetch('/api/cobranza/kpis?meses=6', { cache: 'no-store' }).then(r => r.json())
      .then(j => { if (j.error) setErr(j.error); else setD(j) }).catch(e => setErr(String(e)))
  }, [])

  const box = { background: '#fff', border: '1px solid ' + C.line, borderRadius: 12, padding: '10px 14px', flex: '1 1 180px', minWidth: 168 }
  const lab = { fontSize: 10.5, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '.03em' }
  const val = { fontSize: 22, fontWeight: 800, lineHeight: 1.1, margin: '2px 0' }

  if (err) return null
  const a = d?.actual
  const col = (v, dir) => v == null ? C.sub : (dir === 'up' ? (v >= 0 ? C.verde : C.rojo) : (v <= 0 ? C.verde : C.rojo))
  const kpis = a ? [
    { lab: 'Cobrado en plazo', big: (a.pct_cobrado ?? '—') + '%', color: C.verde, serie: d.serie.map(s => s.pct_cobrado), dir: 'up' },
    { lab: 'Cartera por cobrar', big: Pk(a.cartera), color: C.rojo, serie: d.serie.map(s => s.cartera), dir: 'down' },
    { lab: 'Deuda de servicios', big: Pk(a.deuda_serv), color: C.ambar, serie: d.serie.map(s => s.deuda_serv), dir: 'down' },
    { lab: 'Servicios al día', big: (a.pct_serv_aldia ?? '—') + '%', color: C.azul, serie: d.serie.map(s => s.pct_serv_aldia), dir: 'up' },
  ] : []

  return (
    <div style={{ background: '#F7F6F1', border: '1px solid ' + C.line, borderRadius: 14, padding: 14, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: C.txt, textTransform: 'uppercase', letterSpacing: '.04em' }}>Salud del cobro</span>
        <span style={{ fontSize: 11.5, color: C.sub }}>{a ? 'al mes ' + a.lbl : 'cargando…'}</span>
        <Link href="/op/cobranza/kpis" style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 700, color: C.acento, textDecoration: 'none' }}>Ver evolución →</Link>
      </div>
      {!a ? <div style={{ color: C.sub, fontSize: 12.5 }}>Calculando indicadores…</div> : (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {kpis.map((k, i) => {
            const t = tendencia(k.serie)
            return (
              <div key={i} style={box}>
                <div style={lab}>{k.lab}</div>
                <div style={{ ...val, color: k.color }}>{k.big}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  {spark(k.serie, k.color) || <span style={{ fontSize: 11, color: C.sub }}>—</span>}
                  <span style={{ fontSize: 11, fontWeight: 700, color: col(k.dir === 'up' ? t : -t, 'up') }}>{t === 0 ? '' : (t > 0 ? '▲' : '▼')}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
