'use client'
// VERSION: v8 · 2026-08-15 · Nuevo modo `inline`: el panel se puede incrustar en la fila de la cabecera (raíz como
//   flex-item; título "MOR" en vez de "Morosidad"). Los KPIs, toggles y AL DÍA van en línea; los drawers (gráfico/
//   calendario) se despliegan debajo dentro del propio bloque. Sin cambios de cálculo. Hereda v7.
// VERSION: v7 · 2026-08-15 · Los 4 KPIs (Meses · Día med. · Máx · Actual) suben a la fila del título "Morosidad" como
//   mini-cajas compactas (con el detalle en el tooltip), en vez de ocupar una rejilla propia debajo. Se quita el
//   subtítulo para ganar sitio. Gráfico y calendario siguen como drawers a la derecha. Hereda v6.
// VERSION: v6 · 2026-08-15 · Compactación del panel (mejor uso del espacio en la cartola): KPIs a ~mitad de alto
//   (menos padding, cifra 17px) y los toggles de "Saldo a fin de mes" y "Calendario de pagos" se suben a la
//   cabecera del panel como botones; su contenido (gráfico / calendario) aparece como DRAWER debajo de los KPIs
//   solo al pincharlos, en vez de ocupar dos franjas fijas. Sin cambios de cálculo. Hereda v5.
// VERSION: v5 · 2026-08-12 · FIX morosidad falsa: el panel ahora EXCLUYE las líneas ANULADAS y usa el cargo EFECTIVO
//   (cargo_manual si está editado), igual que la cartola. Antes sumaba cargos anulados → "EN MORA" incorrecto. Hereda v4.
// VERSION: v4 · 2026-08-12 · Calendario de pagos OCULTO por defecto (se pincha "▼ ver meses"); igual que el gráfico.
//   Sigue plegable y con flex-wrap (nunca scroll horizontal). Hereda v3.
// VERSION: v3 · 2026-08-12 · Calendario de pagos PLEGABLE (botón "▲ ocultar/▼ ver meses") y con FLEX-WRAP: las
//   tarjetas saltan de fila SIEMPRE (más filas antes que scroll horizontal). El gráfico sigue plegable/oculto. Hereda v2.
// VERSION: v2 · 2026-08-12 · "Saldo a fin de mes" PLEGABLE y OCULTO por defecto (botón "▼ ver gráfico"); rejillas
//   responsivas (auto-fit/auto-fill) y SVG sin overflow visible → el panel nunca fuerza scroll horizontal. Hereda v1.
// VERSION: v1 · 2026-08-12 · Panel de MOROSIDAD reutilizable a partir de la cartola (`cuentas`) de un idadmon.
//   KPIs (saldo actual, meses con deuda, día medio de pago, deuda máx. a fin de mes), gráfico de saldo a
//   FIN DE MES (sin el ruido intra-mes) y calendario de pagos mes a mes (verde/ámbar/rojo, icono+etiqueta).
//   Afinamientos: excluye cargos de INICIO/garantía del cálculo de mora; el estado del mes usa el saldo a
//   fin de mes. Uso: <MorosidadCartola idadmon="A00749" /> (busca cuentas solo) o pasarle `cuentas` ya cargadas.
// Ruta sugerida: app/components/MorosidadCartola.js
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

const P = (n) => (n < 0 ? '-$' : '$') + Math.abs(Math.round(Number(n) || 0)).toLocaleString('es-CL')
const MES = { '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr', '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Ago', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic' }
const mlbl = (k) => { const [y, m] = k.split('-'); return (MES[m] || m) + ' ' + y.slice(2) }
const parseFecha = (s) => {
  const t = String(s || '').trim()
  let m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})/); if (m) return { y: +m[3], mo: +m[2], d: +m[1] }
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return { y: +m[1], mo: +m[2], d: +m[3] }
  return null
}
const numc = (v) => { const x = Number(String(v ?? '').replace(/[^0-9.-]/g, '')); return isNaN(x) ? 0 : x }
const esInicio = (r) => /INICIO/i.test(String(r.calif || '')) || /garant|comision/i.test(String(r.concepto || ''))

export default function MorosidadCartola({ idadmon, cuentas = null, compact = false, inline = false }) {
  const [rows, setRows] = useState(cuentas)
  const [cargando, setCargando] = useState(!cuentas)
  const [tip, setTip] = useState(null) // {x,y,html}
  const [verSaldo, setVerSaldo] = useState(false) // gráfico "saldo a fin de mes": oculto por defecto
  const [verMeses, setVerMeses] = useState(false) // calendario de meses: OCULTO por defecto (se pincha "▼ ver meses")

  useEffect(() => {
    if (cuentas) { setRows(cuentas); return }
    if (!idadmon) return
    let vivo = true
    setCargando(true)
    supabase.from('cuentas').select('fecha, concepto, cargo, cargo_manual, abono, calif, anulado').eq('idadmon', idadmon)
      .then(({ data }) => { if (vivo) { setRows(data || []); setCargando(false) } })
    return () => { vivo = false }
  }, [idadmon, cuentas])

  const D = useMemo(() => {
    // cargo EFECTIVO = cargo_manual si existe (override editado), si no el cargo original; y se EXCLUYEN las anuladas,
    // igual que la cartola. Así el saldo del panel coincide con el de la cartola (y no cuenta líneas anuladas).
    const movs = (rows || []).map(r => ({ ...r, f: parseFecha(r.fecha), cargo: (r.cargo_manual != null && r.cargo_manual !== '') ? numc(r.cargo_manual) : numc(r.cargo), abono: numc(r.abono) }))
      .filter(m => m.f && !m.anulado)
      .sort((a, b) => (a.f.y - b.f.y) || (a.f.mo - b.f.mo) || (a.f.d - b.f.d))
    let run = 0
    const serie = movs.map(m => { run += m.cargo - m.abono; return { ...m, saldo: run } })
    // renta de referencia: cargo de arriendo más frecuente (excluye inicio/garantía)
    const rentas = movs.filter(m => m.cargo > 0 && !esInicio(m)).map(m => m.cargo)
    const rentaRef = rentas.length ? rentas.sort((a, b) => b - a)[Math.floor(rentas.length / 2)] : 250000
    // agregado mensual
    const meses = {}
    for (const s of serie) {
      const k = `${s.f.y}-${String(s.f.mo).padStart(2, '0')}`
      const mm = meses[k] || (meses[k] = { mes: k, cargos: 0, abonos: 0, diasPago: [], saldoFin: 0 })
      mm.cargos += s.cargo; mm.abonos += s.abono; mm.saldoFin = s.saldo
      if (s.abono > 0) mm.diasPago.push(s.f.d)
    }
    const mlist = Object.keys(meses).sort().map(k => {
      const m = meses[k]; const saldo = m.saldoFin
      const estado = saldo <= rentaRef * 0.1 ? 'good' : saldo <= rentaRef * 1.1 ? 'warning' : 'critical'
      const dia = m.diasPago.length ? Math.round(m.diasPago.reduce((a, b) => a + b, 0) / m.diasPago.length) : null
      return { ...m, saldo, estado, dia }
    })
    const todosDias = mlist.flatMap(m => m.diasPago)
    const kpi = {
      saldoActual: serie.length ? serie[serie.length - 1].saldo : 0,
      mesesConDeuda: mlist.filter(m => m.saldo > rentaRef * 0.1).length,
      maxDeudaMes: mlist.reduce((a, m) => Math.max(a, m.saldo), 0),
      diaMedioPago: todosDias.length ? Math.round(todosDias.reduce((a, b) => a + b, 0) / todosDias.length) : null,
      rentaRef,
    }
    return { serie, meses: mlist, kpi }
  }, [rows])

  if (cargando) return <div style={{ color: '#888', fontSize: 13, padding: 12 }}>Cargando morosidad…</div>
  if (!D.meses.length) return <div style={{ color: '#888', fontSize: 13, padding: 12 }}>Sin movimientos de cartola para {idadmon}.</div>

  const C = { blue: '#2a78d6', good: '#0ca30c', warn: '#fab219', crit: '#d03b3b', greenTxt: '#006300', ink2: '#52514e', muted: '#898781', grid: '#e1e0d9', base: '#c3c2b7', surf: '#fcfcfb' }
  const ST = { good: { c: C.good, i: '✓', t: 'al día' }, warning: { c: C.warn, i: '!', t: 'atraso' }, critical: { c: C.crit, i: '✕', t: 'mora' } }
  const alDia = D.kpi.saldoActual <= D.kpi.rentaRef * 0.1
  const card = { background: C.surf, border: '1px solid ' + C.grid, borderRadius: 14, padding: 16 }
  const kpiCard = { background: C.surf, border: '1px solid ' + C.grid, borderRadius: 10, padding: '7px 11px' }
  // Botón-toggle de los drawers (gráfico / calendario), en la cabecera del panel.
  const btnDrawer = (on) => ({
    fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999, cursor: 'pointer',
    border: '1px solid ' + (on ? C.blue : C.grid), background: on ? 'rgba(42,120,214,.10)' : C.surf,
    color: on ? C.blue : C.ink2, display: 'inline-flex', alignItems: 'center', gap: 5,
  })

  // gráfico saldo a fin de mes
  const S = D.meses
  const W = 900, H = 200, mL = 62, mR = 14, mT = 12, mB = 24
  const ys = S.map(m => m.saldo)
  const yMax = Math.max(...ys, D.kpi.rentaRef * 0.2), yMin = Math.min(...ys, 0)
  const X = (i) => mL + (W - mL - mR) * (S.length > 1 ? i / (S.length - 1) : 0)
  const Y = (v) => mT + (H - mT - mB) * (1 - (v - yMin) / ((yMax - yMin) || 1))
  const y0 = Y(0)
  const line = S.map((m, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(m.saldo).toFixed(1)).join(' ')
  const area = `M ${X(0).toFixed(1)} ${y0.toFixed(1)} ` + S.map((m, i) => 'L ' + X(i).toFixed(1) + ' ' + Y(m.saldo).toFixed(1)).join(' ') + ` L ${X(S.length - 1).toFixed(1)} ${y0.toFixed(1)} Z`
  const ticks = [...new Set([yMin, 0, yMax])]

  const showTip = (e, html) => setTip({ x: e.clientX, y: e.clientY, html })

  return (
    <div style={inline
      ? { fontFamily: 'system-ui,-apple-system,"Segoe UI",sans-serif', color: '#0b0b0b', flex: '1 1 320px', minWidth: 0, boxSizing: 'border-box' }
      : { fontFamily: 'system-ui,-apple-system,"Segoe UI",sans-serif', color: '#0b0b0b', width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: (verSaldo || verMeses) ? 4 : 0 }}>
        <span style={{ fontSize: inline ? 12 : 15, fontWeight: 800, color: inline ? '#52514e' : '#0b0b0b', textTransform: inline ? 'uppercase' : 'none', letterSpacing: inline ? '.03em' : 0 }}>{inline ? 'MOR' : 'Morosidad'}</span>
        {/* 4 KPIs subidos a la fila del título, como mini-cajas (pasa el ratón para el detalle) */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { lab: 'Meses', val: D.kpi.mesesConDeuda, note: 'meses con deuda (de ' + D.meses.length + ')' },
            { lab: 'Día med.', val: D.kpi.diaMedioPago ?? '—', note: 'día medio de pago (vence el 1)' },
            { lab: 'Máx', val: P(D.kpi.maxDeudaMes), note: 'deuda máx. a fin de mes (peor mes)' },
            { lab: 'Actual', val: D.kpi.saldoActual <= 0 ? P(Math.abs(D.kpi.saldoActual)) : P(D.kpi.saldoActual), note: 'saldo actual (' + (D.kpi.saldoActual <= 0 ? 'a favor' : 'a cobrar') + ')', col: D.kpi.saldoActual > D.kpi.rentaRef * 0.1 ? C.crit : C.greenTxt },
          ].map((k, i) => (
            <div key={i} title={k.note} style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1, padding: '3px 9px', border: '1px solid ' + C.grid, borderRadius: 8, background: C.surf }}>
              <span style={{ fontSize: 9, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '.03em' }}>{k.lab}</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: k.col || '#0b0b0b' }}>{k.val}</span>
            </div>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {!compact && (
            <button onClick={() => setVerSaldo(v => !v)} style={btnDrawer(verSaldo)}>
              <span>{verSaldo ? '▲' : '▼'}</span> Saldo fin de mes
            </button>
          )}
          <button onClick={() => setVerMeses(v => !v)} style={btnDrawer(verMeses)}>
            <span>{verMeses ? '▲' : '▼'}</span> Calendario
          </button>
          <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, display: 'inline-flex', gap: 6, alignItems: 'center', background: alDia ? 'rgba(12,163,12,.12)' : 'rgba(208,59,59,.12)', color: alDia ? C.good : C.crit }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: alDia ? C.good : C.crit }} />{alDia ? 'AL DÍA' : 'EN MORA'}
          </span>
        </div>
      </div>

      {!compact && verSaldo && (
        <div style={{ ...card, marginTop: 10 }}>
          <div style={{ fontSize: 12, color: C.ink2, marginBottom: 8 }}><b style={{ color: '#0b0b0b' }}>Saldo a fin de mes</b> · deuda viva al cierre de cada mes (arriba de 0 = debe; abajo = a favor).</div>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%', height: 'auto', overflow: 'hidden' }}>
            {ticks.map((v, i) => (
              <g key={i}>
                <line x1={mL} y1={Y(v)} x2={W - mR} y2={Y(v)} stroke={C.grid} strokeWidth="1" />
                <text x={mL - 8} y={Y(v) + 3} textAnchor="end" fill={C.muted} fontSize="11" style={{ fontVariantNumeric: 'tabular-nums' }}>{P(v)}</text>
              </g>
            ))}
            <path d={area} fill={C.blue} opacity="0.12" />
            <line x1={mL} y1={y0} x2={W - mR} y2={y0} stroke={C.base} strokeWidth="1.5" />
            <path d={line} fill="none" stroke={C.blue} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {S.map((m, i) => (
              <g key={i}>
                <circle cx={X(i)} cy={Y(m.saldo)} r="8" fill="transparent"
                  onMouseMove={(e) => showTip(e, `<div style="color:${C.ink2}">${mlbl(m.mes)}</div>cargos <b>${P(m.cargos)}</b><br>abonos <b>${P(m.abonos)}</b><br>saldo <b>${P(m.saldo)}</b>${m.dia ? '<br>pagó día <b>' + m.dia + '</b>' : ''}`)}
                  onMouseLeave={() => setTip(null)} />
                <circle cx={X(i)} cy={Y(m.saldo)} r="3" fill={C.blue} pointerEvents="none" />
                {(i % 2 === 0 || i === S.length - 1) && <text x={X(i)} y={H - 6} textAnchor="middle" fill={C.muted} fontSize="10">{mlbl(m.mes)}</text>}
              </g>
            ))}
          </svg>
        </div>
      )}

      {verMeses && (
        <div style={{ ...card, marginTop: 10, overflowX: 'hidden' }}>
        <div style={{ fontSize: 12, color: C.ink2, marginBottom: 12 }}><b style={{ color: '#0b0b0b' }}>Calendario de pagos</b> · estado a fin de cada mes: al día, atraso (~1 renta) o mora (2+ rentas).</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, width: '100%', boxSizing: 'border-box' }}>
          {D.meses.map((m) => {
            const s = ST[m.estado]
            const bg = m.estado === 'good' ? 'rgba(12,163,12,.07)' : m.estado === 'warning' ? 'rgba(250,178,25,.10)' : 'rgba(208,59,59,.10)'
            return (
              <div key={m.mes} style={{ flex: '1 1 120px', minWidth: 118, maxWidth: 220, boxSizing: 'border-box', border: '1px solid ' + C.grid, borderRadius: 10, padding: '9px 10px', background: bg }}
                onMouseMove={(e) => showTip(e, `<div style="color:${C.ink2}">${mlbl(m.mes)}</div>cargos <b>${P(m.cargos)}</b><br>abonos <b>${P(m.abonos)}</b><br>saldo <b>${P(m.saldo)}</b>${m.dia ? '<br>pagó día <b>' + m.dia + '</b>' : ''}`)}
                onMouseLeave={() => setTip(null)}>
                <div style={{ fontSize: 11, color: C.ink2, fontWeight: 600 }}>{mlbl(m.mes)}</div>
                <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4, display: 'flex', alignItems: 'center', gap: 5, color: s.c }}><span>{s.i}</span>{s.t}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{m.saldo <= 0 ? 'a favor ' + P(Math.abs(m.saldo)) : 'debe ' + P(m.saldo)}</div>
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: C.ink2, marginTop: 12 }}>
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: C.good }} />✓ al día</span>
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: C.warn }} />! atraso</span>
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: C.crit }} />✕ mora</span>
        </div>
        </div>
      )}

      {tip && (
        <div style={{ position: 'fixed', left: tip.x + 14, top: tip.y + 14, background: C.surf, border: '1px solid ' + C.base, borderRadius: 8, padding: '7px 9px', fontSize: 12, boxShadow: '0 6px 20px rgba(0,0,0,.15)', zIndex: 9, pointerEvents: 'none' }}
          dangerouslySetInnerHTML={{ __html: tip.html }} />
      )}
    </div>
  )
}
