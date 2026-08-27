'use client'
// VERSION: v4 · 2026-08-27 · "Cartera por cobrar" en número completo (no millones); es la falta del mes. Hereda v3.
// VERSION: v3 · 2026-08-27 · Selector de liquidacion (por defecto la que toca segun el dia 10); los KPIs muestran la elegida.
// VERSION: v2 · 2026-08-26 · Cobranza · Widget-resumen de KPIs de salud del cobro.
//   5 KPIs (renta: cobrado en plazo · cartera por cobrar; servicios: deuda · al día · garantías en riesgo)
//   con valor actual, color según meta y mini-curva, y enlace a la vista de detalle (/op/cobranza/kpis).
//   Consume /api/cobranza/kpis. v2: cobrado en plazo real (≤día10), metas y KPI de garantías.
// Ruta real: app/op/cobranza/KpisResumen.js
import { useState, useEffect } from 'react'
import Link from 'next/link'
const C = { txt: '#2C2C2A', sub: '#888780', line: '#D3D1C7', verde: '#085041', rojo: '#9B1C1C', ambar: '#B8860B', azul: '#1D4ED8', acento: '#1D9E75' }
const Pk = (n) => { const v = Number(n) || 0; return v >= 1e6 ? '$' + (v / 1e6).toFixed(1) + 'M' : '$' + Math.round(v / 1000) + 'k' }
const P = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CL')

function spark(vals, color, w = 92, h = 24) {
  const xs = vals.filter(v => v != null)
  if (xs.length < 2) return null
  const min = Math.min(...xs), max = Math.max(...xs), rng = (max - min) || 1
  const step = w / (vals.length - 1)
  const pts = vals.map((v, i) => v == null ? null : `${(i * step).toFixed(1)},${(h - 3 - ((v - min) / rng) * (h - 6)).toFixed(1)}`).filter(Boolean).join(' ')
  return <svg width={w} height={h} style={{ display: 'block' }}><polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /></svg>
}
const cumple = (v, meta) => v == null || !meta ? null : (meta.dir === 'up' ? v >= meta.objetivo : v <= meta.objetivo)

export default function KpisResumen() {
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')
  const [sel, setSel] = useState(null)
  useEffect(() => {
    fetch('/api/cobranza/kpis?meses=6', { cache: 'no-store' }).then(r => r.json())
      .then(j => { if (j.error) setErr(j.error); else setD(j) }).catch(e => setErr(String(e)))
  }, [])
  if (err) return null

  const m = d?.metas
  const serie = d?.serie || []
  const idx = (sel != null && sel < serie.length) ? sel : (serie.length ? serie.length - 1 : 0)
  const a = serie[idx]
  const kpis = a ? [
    { lab: 'Cobrado en plazo', big: (a.pct_cobrado ?? '—') + '%', sub: 'meta ' + (m.pct_cobrado.txt), meta: cumple(a.pct_cobrado, m.pct_cobrado), serie: d.serie.map(s => s.pct_cobrado), color: C.verde },
    { lab: 'Cartera por cobrar', big: P(a.cartera), sub: (a.pct_cartera ?? '—') + '% · meta ' + m.pct_cartera.txt, meta: cumple(a.pct_cartera, m.pct_cartera), serie: d.serie.map(s => s.cartera), color: C.rojo },
    { lab: 'Deuda de servicios', big: Pk(a.deuda_serv), sub: 'protege garantías', meta: null, serie: d.serie.map(s => s.deuda_serv), color: C.ambar },
    { lab: 'Servicios al día', big: (a.pct_serv_aldia ?? '—') + '%', sub: 'meta ' + m.pct_serv_aldia.txt, meta: cumple(a.pct_serv_aldia, m.pct_serv_aldia), serie: d.serie.map(s => s.pct_serv_aldia), color: C.azul },
    { lab: 'Garantías en riesgo', big: String(a.garantias_riesgo ?? '—'), sub: 'meta ' + m.garantias_riesgo.txt, meta: cumple(a.garantias_riesgo, m.garantias_riesgo), serie: d.serie.map(s => s.garantias_riesgo), color: '#7a1c17' },
  ] : []

  const box = { background: '#fff', border: '1px solid ' + C.line, borderRadius: 12, padding: '10px 13px', flex: '1 1 165px', minWidth: 155 }
  return (
    <div style={{ background: '#F7F6F1', border: '1px solid ' + C.line, borderRadius: 14, padding: 14, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: C.txt, textTransform: 'uppercase', letterSpacing: '.04em' }}>Salud del cobro</span>
        {serie.length ? (
          <select value={idx} onChange={e => setSel(Number(e.target.value))} title="Elige la liquidación a ver"
            style={{ fontSize: 11.5, color: C.sub, border: '1px solid ' + C.line, borderRadius: 7, padding: '2px 6px', background: '#fff', cursor: 'pointer' }}>
            {serie.map((s, i) => <option key={s.aamm} value={i}>{'Liquidación ' + s.lbl}</option>)}
          </select>
        ) : <span style={{ fontSize: 11.5, color: C.sub }}>cargando…</span>}
        <Link href="/op/cobranza/kpis" style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 700, color: C.acento, textDecoration: 'none' }}>Ver evolución →</Link>
      </div>
      {!a ? <div style={{ color: C.sub, fontSize: 12.5 }}>Calculando indicadores…</div> : (
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
          {kpis.map((k, i) => {
            const valColor = k.meta === null ? k.color : (k.meta ? C.verde : C.rojo)
            return (
              <div key={i} style={{ ...box, borderTop: '3px solid ' + (k.meta === null ? k.color : (k.meta ? C.verde : C.rojo)) }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '.03em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{k.lab}</span>{k.meta === null ? null : <span style={{ color: k.meta ? C.verde : C.rojo, fontSize: 12 }}>{k.meta ? '✓' : '!'}</span>}
                </div>
                <div style={{ fontSize: 21, fontWeight: 800, lineHeight: 1.1, margin: '2px 0', color: valColor }}>{k.big}</div>
                <div style={{ fontSize: 10, color: C.sub, marginBottom: 4 }}>{k.sub}</div>
                {spark(k.serie, valColor) || <span style={{ fontSize: 11, color: C.sub }}>—</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
