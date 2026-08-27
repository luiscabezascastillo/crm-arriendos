'use client'
// VERSION: v1 · 2026-08-26 · Cobranza · Vista de detalle de KPIs con curvas de evolución temporal.
//   Cuatro gráficos (renta: cobrado en plazo · cartera por cobrar; servicios: deuda · al día) sobre
//   la serie mensual de /api/cobranza/kpis. Enlace de retorno a Cobranza.
// Ruta real: app/op/cobranza/kpis/page.js
import { useState, useEffect } from 'react'
import Link from 'next/link'

const C = { txt: '#2C2C2A', sub: '#888780', line: '#D3D1C7', grid: '#ECEAE3', verde: '#085041', rojo: '#9B1C1C', ambar: '#B8860B', azul: '#1D4ED8', acento: '#1D9E75' }
const P = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CL')
const Pk = (n) => { const v = Number(n) || 0; return v >= 1e6 ? '$' + (v / 1e6).toFixed(2) + 'M' : '$' + Math.round(v / 1000) + 'k' }

function Chart({ titulo, subt, serie, campo, color, tipo, meta }) {
  const vals = serie.map(s => s[campo])
  const has = vals.filter(v => v != null)
  if (!has.length) return <div style={{ color: C.sub, fontSize: 13, padding: 20 }}>Sin datos para {titulo}.</div>
  const W = 520, H = 220, mL = 54, mR = 16, mT = 16, mB = 30
  let min = Math.min(...has), max = Math.max(...has)
  if (tipo === 'pct') { min = Math.min(min, 100); max = 100; min = Math.floor(Math.min(min, ...has) / 10) * 10 }
  else { min = 0 }
  const rng = (max - min) || 1
  const X = (i) => mL + (W - mL - mR) * (serie.length > 1 ? i / (serie.length - 1) : 0)
  const Y = (v) => mT + (H - mT - mB) * (1 - (v - min) / rng)
  const pts = serie.map((s, i) => s[campo] == null ? null : `${X(i).toFixed(1)},${Y(s[campo]).toFixed(1)}`).filter(Boolean).join(' ')
  const fmt = tipo === 'pct' ? (v) => v + '%' : (v) => Pk(v)
  const ticks = [min, min + rng / 2, max]
  const ult = has[has.length - 1]
  return (
    <div style={{ background: '#fff', border: '1px solid ' + C.line, borderRadius: 14, padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>{titulo}</div>
        <div style={{ fontSize: 22, fontWeight: 800, color }}>{tipo === 'pct' ? ult + '%' : P(ult)}</div>
      </div>
      <div style={{ fontSize: 12, color: C.sub, marginBottom: 8 }}>{subt}</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {ticks.map((v, i) => (
          <g key={i}>
            <line x1={mL} y1={Y(v)} x2={W - mR} y2={Y(v)} stroke={C.grid} strokeWidth="1" />
            <text x={mL - 8} y={Y(v) + 3} textAnchor="end" fontSize="11" fill={C.sub}>{fmt(Math.round(v))}</text>
          </g>
        ))}
        {meta != null && meta <= max && meta >= min && <line x1={mL} y1={Y(meta)} x2={W - mR} y2={Y(meta)} stroke={C.acento} strokeWidth="1" strokeDasharray="4 3" />}
        <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {serie.map((s, i) => s[campo] == null ? null : <circle key={i} cx={X(i)} cy={Y(s[campo])} r="3" fill={color} />)}
        {serie.map((s, i) => (i % Math.ceil(serie.length / 8 || 1) === 0 || i === serie.length - 1) && <text key={'x' + i} x={X(i)} y={H - 8} textAnchor="middle" fontSize="10.5" fill={C.sub}>{s.lbl}</text>)}
      </svg>
    </div>
  )
}

export default function KpisPage() {
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')
  const [meses, setMeses] = useState(12)
  useEffect(() => {
    setD(null)
    fetch('/api/cobranza/kpis?meses=' + meses, { cache: 'no-store' }).then(r => r.json())
      .then(j => { if (j.error) setErr(j.error); else { setErr(''); setD(j) } }).catch(e => setErr(String(e)))
  }, [meses])

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 24px 60px', fontFamily: 'system-ui,-apple-system,"Segoe UI",sans-serif', color: C.txt }}>
      <div style={{ fontSize: 13, color: C.sub, marginBottom: 4 }}><Link href="/op/cobranza" style={{ color: C.acento, textDecoration: 'none' }}>← Volver a Cobranza</Link></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Salud del cobro · evolución</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {[6, 12, 18].map(m => <button key={m} onClick={() => setMeses(m)} style={{ fontSize: 12.5, fontWeight: 700, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', border: '1px solid ' + C.line, background: meses === m ? C.verde : '#fff', color: meses === m ? '#fff' : C.sub }}>{m} meses</button>)}
        </div>
      </div>
      <div style={{ fontSize: 13.5, color: C.sub, marginBottom: 18 }}>Dos cuentas por contrato: la <b>renta</b> (a FCR) y los <b>servicios</b> (a terceros, protegen la garantía). La línea verde discontinua es la meta.</div>

      {err && <div style={{ color: C.rojo, background: '#FBEDEC', border: '1px solid #F0CFCB', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>Error: {err}</div>}
      {!d && !err && <div style={{ color: C.sub, fontSize: 14, padding: 30 }}>Calculando la serie mensual…</div>}
      {d && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
          <Chart titulo="Cobrado en plazo" subt="% de la renta del mes que entra a tiempo · sube = mejor" serie={d.serie} campo="pct_cobrado" color={C.verde} tipo="pct" meta={100} />
          <Chart titulo="Cartera por cobrar" subt="renta que sigue sin entrar a cierre de mes · baja = mejor" serie={d.serie} campo="cartera" color={C.rojo} tipo="money" meta={null} />
          <Chart titulo="Deuda de servicios" subt="GGCC + luz + agua + gas impagos (amenaza la garantía) · baja = mejor" serie={d.serie} campo="deuda_serv" color={C.ambar} tipo="money" meta={null} />
          <Chart titulo="Servicios al día" subt="% de contratos sin deuda relevante de servicios · sube = mejor" serie={d.serie} campo="pct_serv_aldia" color={C.azul} tipo="pct" meta={100} />
        </div>
      )}
    </div>
  )
}
