'use client'
// VERSION: v2 · 2026-08-26 · Cobranza · Vista de detalle de KPIs con curvas de evolución.
//   5 gráficos (cobrado en plazo · cartera por cobrar % · deuda de servicios · servicios al día ·
//   garantías en riesgo) sobre /api/cobranza/kpis, con línea de meta y color según cumplimiento.
//   Enlace de retorno a Cobranza.
// Ruta real: app/op/cobranza/kpis/page.js
import { useState, useEffect } from 'react'
import Link from 'next/link'

const C = { txt: '#2C2C2A', sub: '#888780', line: '#D3D1C7', grid: '#ECEAE3', verde: '#085041', rojo: '#9B1C1C', ambar: '#B8860B', azul: '#1D4ED8', acento: '#1D9E75' }
const P = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CL')
const Pk = (n) => { const v = Number(n) || 0; return v >= 1e6 ? '$' + (v / 1e6).toFixed(2) + 'M' : '$' + Math.round(v / 1000) + 'k' }

function Chart({ titulo, subt, serie, campo, color, tipo, meta, dir }) {
  const vals = serie.map(s => s[campo])
  const has = vals.filter(v => v != null)
  if (!has.length) return <div style={{ background: '#fff', border: '1px solid ' + C.line, borderRadius: 14, padding: 18, color: C.sub, fontSize: 13 }}>Sin datos para {titulo}.</div>
  const W = 520, H = 210, mL = 54, mR = 16, mT = 16, mB = 30
  let min, max
  if (tipo === 'pct') { max = Math.max(100, ...has, meta || 0); min = Math.max(0, Math.floor((Math.min(...has, meta ?? 100) - 5) / 10) * 10) }
  else { min = 0; max = Math.max(...has, meta || 0) || 1 }
  const rng = (max - min) || 1
  const X = (i) => mL + (W - mL - mR) * (serie.length > 1 ? i / (serie.length - 1) : 0)
  const Y = (v) => mT + (H - mT - mB) * (1 - (v - min) / rng)
  const pts = serie.map((s, i) => s[campo] == null ? null : `${X(i).toFixed(1)},${Y(s[campo]).toFixed(1)}`).filter(Boolean).join(' ')
  const fmt = tipo === 'pct' ? (v) => v + '%' : tipo === 'num' ? (v) => Math.round(v) : (v) => Pk(v)
  const ticks = [min, min + rng / 2, max]
  const ult = has[has.length - 1]
  const ok = meta == null ? null : (dir === 'up' ? ult >= meta : ult <= meta)
  const valColor = ok == null ? color : (ok ? C.verde : C.rojo)
  const grandeVal = tipo === 'pct' ? ult + '%' : tipo === 'num' ? Math.round(ult) : P(ult)
  return (
    <div style={{ background: '#fff', border: '1px solid ' + C.line, borderRadius: 14, padding: 18, borderTop: '3px solid ' + valColor }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>{titulo}</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: valColor }}>{grandeVal}{ok == null ? null : <span style={{ fontSize: 13, marginLeft: 5 }}>{ok ? '✓' : '!'}</span>}</div>
      </div>
      <div style={{ fontSize: 12, color: C.sub, marginBottom: 8 }}>{subt}{meta != null ? ' · meta ' + (tipo === 'pct' ? meta + '%' : meta) : ''}</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {ticks.map((v, i) => (
          <g key={i}>
            <line x1={mL} y1={Y(v)} x2={W - mR} y2={Y(v)} stroke={C.grid} strokeWidth="1" />
            <text x={mL - 8} y={Y(v) + 3} textAnchor="end" fontSize="11" fill={C.sub}>{fmt(Math.round(v))}</text>
          </g>
        ))}
        {meta != null && meta <= max && meta >= min && <><line x1={mL} y1={Y(meta)} x2={W - mR} y2={Y(meta)} stroke={C.acento} strokeWidth="1.2" strokeDasharray="4 3" /><text x={W - mR} y={Y(meta) - 4} textAnchor="end" fontSize="10" fill={C.acento}>meta</text></>}
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
  const M = d?.metas

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 24px 60px', fontFamily: 'system-ui,-apple-system,"Segoe UI",sans-serif', color: C.txt }}>
      <div style={{ fontSize: 13, color: C.sub, marginBottom: 4 }}><Link href="/op/cobranza" style={{ color: C.acento, textDecoration: 'none' }}>← Volver a Cobranza</Link></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Salud del cobro · evolución</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {[6, 12, 18].map(x => <button key={x} onClick={() => setMeses(x)} style={{ fontSize: 12.5, fontWeight: 700, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', border: '1px solid ' + C.line, background: meses === x ? C.verde : '#fff', color: meses === x ? '#fff' : C.sub }}>{x} meses</button>)}
        </div>
      </div>
      <div style={{ fontSize: 13.5, color: C.sub, marginBottom: 18 }}>Dos cuentas por contrato: la <b>renta</b> (a FCR) y los <b>servicios</b> (a terceros, protegen la garantía). "En plazo" = pagado hasta el día 10. La línea verde discontinua es la meta.</div>

      {err && <div style={{ color: C.rojo, background: '#FBEDEC', border: '1px solid #F0CFCB', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>Error: {err}</div>}
      {!d && !err && <div style={{ color: C.sub, fontSize: 14, padding: 30 }}>Calculando la serie mensual…</div>}
      {d && M && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
          <Chart titulo="Cobrado en plazo" subt="% de la renta pagada hasta el día 10 · sube = mejor" serie={d.serie} campo="pct_cobrado" color={C.verde} tipo="pct" meta={M.pct_cobrado.objetivo} dir="up" />
          <Chart titulo="Cartera por cobrar" subt="% de la renta sin cobrar a cierre · baja = mejor" serie={d.serie} campo="pct_cartera" color={C.rojo} tipo="pct" meta={M.pct_cartera.objetivo} dir="down" />
          <Chart titulo="Deuda de servicios" subt="GGCC + luz + agua + gas impagos · baja = mejor" serie={d.serie} campo="deuda_serv" color={C.ambar} tipo="money" meta={null} dir="down" />
          <Chart titulo="Servicios al día" subt="% de contratos sin deuda relevante de servicios · sube = mejor" serie={d.serie} campo="pct_serv_aldia" color={C.azul} tipo="pct" meta={M.pct_serv_aldia.objetivo} dir="up" />
          <Chart titulo="Garantías en riesgo" subt="contratos cuya deuda de servicios ≥ 50% de su garantía · baja = mejor" serie={d.serie} campo="garantias_riesgo" color="#7a1c17" tipo="num" meta={M.garantias_riesgo.objetivo} dir="down" />
        </div>
      )}
    </div>
  )
}
