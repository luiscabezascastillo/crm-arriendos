'use client'
// VERSION: v5 · 2026-08-27 · Servicios en curva SEMANAL (corte a corte, domingos): las 3 curvas de servicios usan serie_serv (eje X = fecha del corte); la renta sigue mensual. Panel de riesgo = ultimo corte. Hereda v4.
// VERSION: 2026-08-27 · Gráfico Cartera: escala automática (0..~meta*1.3) y cifra en millones sobre cada mes. Hereda versión previa.
// VERSION: v4 · 2026-08-27 · Selector por defecto = "Año en curso" (Ene..mes base); se mantienen 6/12/18. Hereda v3.
// VERSION: v3 · 2026-08-27 · Listado de IDADMON en riesgo (2 columnas, con su deuda de servicios) junto a la tarjeta de garantias. Hereda v2.
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

function Chart({ titulo, subt, serie, campo, color, tipo, meta, dir, escalaAuto, campoMonto }) {
  const vals = serie.map(s => s[campo])
  const has = vals.filter(v => v != null)
  if (!has.length) return <div style={{ background: '#fff', border: '1px solid ' + C.line, borderRadius: 14, padding: 18, color: C.sub, fontSize: 13 }}>Sin datos para {titulo}.</div>
  const W = 520, H = 210, mL = 54, mR = 16, mT = 16, mB = 30
  let min, max
  if (tipo === 'pct' && escalaAuto) { max = Math.ceil((Math.max(...has, meta || 0) || 1) * 1.3); min = 0 }
  else if (tipo === 'pct') { max = Math.max(100, ...has, meta || 0); min = Math.max(0, Math.floor((Math.min(...has, meta ?? 100) - 5) / 10) * 10) }
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
        {campoMonto && serie.map((s, i) => s[campo] == null ? null : <text key={'m' + i} x={X(i)} y={Y(s[campo]) - 7} textAnchor="middle" fontSize="9" fontWeight="700" fill={color}>{(Number(s[campoMonto]) / 1e6).toFixed(3).replace('.', ',')}</text>)}
      </svg>
    </div>
  )
}

// meses del año en curso por defecto (Ene..mes base); respeta la gracia del día 10.
const _h = new Date()
let _ay = _h.getFullYear(), _am = _h.getMonth() + 1
if (_h.getDate() <= 10) { _am--; if (_am < 1) { _am = 12; _ay-- } }
const ANIO_ACTUAL = _ay
const N_ANIO = _am

export default function KpisPage() {
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')
  const [meses, setMeses] = useState(N_ANIO)
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
          {[{ lbl: 'Año ' + ANIO_ACTUAL, val: N_ANIO }, { lbl: '6 meses', val: 6 }, { lbl: '12 meses', val: 12 }, { lbl: '18 meses', val: 18 }].map(o => <button key={o.lbl} onClick={() => setMeses(o.val)} style={{ fontSize: 12.5, fontWeight: 700, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', border: '1px solid ' + C.line, background: meses === o.val ? C.verde : '#fff', color: meses === o.val ? '#fff' : C.sub }}>{o.lbl}</button>)}
        </div>
      </div>
      <div style={{ fontSize: 13.5, color: C.sub, marginBottom: 18 }}>Dos cuentas por contrato: la <b>renta</b> (a FCR) y los <b>servicios</b> (a terceros, protegen la garantía). "En plazo" = pagado hasta el día 10. La línea verde discontinua es la meta.</div>

      {err && <div style={{ color: C.rojo, background: '#FBEDEC', border: '1px solid #F0CFCB', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>Error: {err}</div>}
      {!d && !err && <div style={{ color: C.sub, fontSize: 14, padding: 30 }}>Calculando la serie mensual…</div>}
      {d && M && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
          <Chart titulo="Cobrado en plazo" subt="% de la renta pagada hasta el día 10 · sube = mejor" serie={d.serie} campo="pct_cobrado" color={C.verde} tipo="pct" meta={M.pct_cobrado.objetivo} dir="up" />
          <Chart titulo="Cartera por cobrar" subt="% de la renta sin cobrar a cierre (cifra = millones $) · baja = mejor" serie={d.serie} campo="pct_cartera" color={C.rojo} tipo="pct" meta={M.pct_cartera.objetivo} dir="down" escalaAuto campoMonto="cartera" />
          <Chart titulo="Deuda de servicios" subt="GGCC + luz + agua + gas impagos · corte semanal (domingos) · baja = mejor" serie={d.serie_serv || []} campo="deuda_serv" color={C.ambar} tipo="money" meta={null} dir="down" />
          <Chart titulo="Servicios al día" subt="% de contratos sin deuda relevante · corte semanal (domingos) · sube = mejor" serie={d.serie_serv || []} campo="pct_serv_aldia" color={C.azul} tipo="pct" meta={M.pct_serv_aldia.objetivo} dir="up" />
          <Chart titulo="Garantías en riesgo" subt="deuda de servicios ≥ 50% de su garantía · corte semanal (domingos) · baja = mejor" serie={d.serie_serv || []} campo="garantias_riesgo" color="#7a1c17" tipo="num" meta={M.garantias_riesgo.objetivo} dir="down" />
          {(() => {
            const ss = d.serie_serv || []; const ult = (ss.length ? ss[ss.length - 1] : (d.serie[d.serie.length - 1] || {}))
            const fmt = (n) => '$' + (Number(n) || 0).toLocaleString('es-CL')
            const rl = (ult.riesgo_ids || []).slice().sort((a, b) => b.deuda - a.deuda)
            return (
              <div style={{ background: '#fff', border: '1px solid ' + C.line, borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>IDADMON en riesgo <span style={{ color: '#7a1c17' }}>({rl.length})</span></div>
                <div style={{ fontSize: 12.5, color: C.sub, marginBottom: 10 }}>deuda de servicios ≥ 50% de su garantía · {ult.lbl || ''}</div>
                {rl.length === 0 ? <div style={{ color: C.sub, fontSize: 13 }}>Ninguno.</div> : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 16px' }}>
                    {rl.map(x => (
                      <Link key={x.id} href={'/procesos/cartolas?idadmon=' + x.id} title={'Deuda servicios ' + fmt(x.deuda) + ' · garantía ' + fmt(x.gar)}
                        style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, textDecoration: 'none', borderBottom: '1px solid ' + C.grid, padding: '2px 0' }}>
                        <span style={{ fontFamily: 'monospace', color: C.acento }}>{x.id}</span>
                        <span style={{ color: C.sub }}>{fmt(x.deuda)}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
