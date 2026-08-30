'use client'
// VERSION: v1 · 2026-08-30 · Resumen semanal (últimos 2 meses) reutilizable. Teórica L-V del calendario (menos
//   vacaciones/licencias/permisos; sábado/domingo = 0), Realizadas (incluye sábados), Diferencia y Resumen.
//   Cada semana se despliega a sus días con la incidencia. Se usa en la ficha (Control de asistencia) y en Mi Portal.
import { useState } from 'react'

const thF = { padding: 8 }
function numero(v) { return Number(v || 0).toFixed(2) }
function hora(v) { if (!v) return '-'; return String(v).slice(11, 16) }
function lunesDe(fechaStr) {
  const d = new Date(String(fechaStr).slice(0, 10) + 'T00:00:00')
  const dow = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - dow)
  return d.toISOString().slice(0, 10)
}
function ddmm(fechaStr) { const x = String(fechaStr).slice(0, 10).split('-'); return `${x[2]}/${x[1]}` }
const INCID = {
  OK: 'OK', SIN_FIN_JORNADA: 'Sin marcar salida', SIN_INICIO_JORNADA: 'Sin marcar entrada',
  REGULARIZACION_AUTOMATICA_COLACION: 'Colación regularizada',
  COLACION_MENOR_60_IMPUTADA_60: 'Colación < 60 (imputada 60)',
  JORNADA_LIMITADA_A_10_HORAS: 'Jornada limitada a 10h',
}
const incidLabel = (c) => INCID[c] || c || '—'

export default function ResumenSemanal({ detalle, calendario, ausencias, cargando }) {
  const [semanaOpen, setSemanaOpen] = useState(null)
  if (cargando) return <div style={{ color: '#888', fontSize: 13 }}>Cargando…</div>

  const det = detalle || []
  const aus = ausencias || []
  const hace2m = new Date(); hace2m.setMonth(hace2m.getMonth() - 2)
  const limite2m = hace2m.toISOString().slice(0, 10)

  const calDia = {}
  for (const c of calendario || []) calDia[String(c.fecha).slice(0, 10)] = c.es_habil ? (Number(c.horas_esperadas) || 0) : 0
  const enAusencia = (f) => aus.some((a) => f >= String(a.fecha_inicio).slice(0, 10) && f <= String(a.fecha_fin).slice(0, 10))
  const teoDia = (f) => { const dow = new Date(f + 'T00:00:00').getDay(); if (dow === 0 || dow === 6) return 0; return enAusencia(f) ? 0 : (calDia[f] || 0) }

  const wk = {}
  for (const d of det) {
    const f = String(d.fecha).slice(0, 10)
    if (f < limite2m) continue
    const k = lunesDe(f)
    if (!wk[k]) wk[k] = { lunes: k, horas: 0, teoricas: 0, dias: 0, incid: 0, filas: [] }
    const h = Number(d.horas_trabajadas_netas) || 0
    wk[k].horas += h
    if (h > 0) wk[k].dias += 1
    if (d.cumplimiento_reglamento && d.cumplimiento_reglamento !== 'OK') wk[k].incid += 1
    wk[k].filas.push(d)
  }
  for (const k of Object.keys(wk)) {
    let teo = 0; const base = new Date(k + 'T00:00:00')
    for (let i = 0; i < 7; i++) { const dt = new Date(base); dt.setDate(dt.getDate() + i); teo += teoDia(dt.toISOString().slice(0, 10)) }
    wk[k].teoricas = teo
  }
  const arr = Object.values(wk).sort((a, b) => (a.lunes < b.lunes ? 1 : -1))
  if (arr.length === 0) return <div style={{ color: '#888', fontSize: 13 }}>Sin datos de asistencia en los últimos 2 meses.</div>

  const rows = []
  arr.forEach((w) => {
    const dom = new Date(w.lunes + 'T00:00:00'); dom.setDate(dom.getDate() + 6)
    const domStr = dom.toISOString().slice(0, 10)
    const abierta = semanaOpen === w.lunes
    const diff = w.horas - w.teoricas
    const resumen = Math.abs(diff) < 0.25 ? '✓ OK' : (diff < 0 ? `Déficit ${numero(-diff)} h` : `Superávit ${numero(diff)} h`)
    rows.push(
      <tr key={w.lunes} onClick={() => setSemanaOpen(abierta ? null : w.lunes)} style={{ borderBottom: '1px solid #eee', cursor: 'pointer', background: abierta ? '#f5f7ff' : 'transparent' }}>
        <td style={thF}>{abierta ? '▾' : '▸'} Semana {ddmm(w.lunes)} – {ddmm(domStr)} <span style={{ color: '#9ca3af', fontWeight: 400 }}>({w.dias} d)</span></td>
        <td align="right" style={thF}>{numero(w.teoricas)}</td>
        <td align="right" style={thF}><b>{numero(w.horas)}</b></td>
        <td align="right" style={{ ...thF, fontWeight: 600, color: diff < -0.25 ? '#b91c1c' : diff > 0.25 ? '#166534' : '#374151' }}>{diff >= 0 ? '+' : ''}{numero(diff)}</td>
        <td style={thF}>{resumen}{w.incid > 0 ? ` · ${w.incid} inc.` : ''}</td>
      </tr>
    )
    if (abierta) {
      w.filas.slice().sort((a, b) => (String(a.fecha) < String(b.fecha) ? -1 : 1)).forEach((d, idx) => {
        const fd = String(d.fecha).slice(0, 10)
        rows.push(
          <tr key={`${w.lunes}-${idx}`} style={{ borderBottom: '1px solid #f3f4f6', background: '#fafbff' }}>
            <td style={{ ...thF, paddingLeft: 30 }}>{fd} · {hora(d.inicio_jornada)}–{hora(d.fin_jornada)}</td>
            <td align="right" style={thF}>{numero(teoDia(fd))}</td>
            <td align="right" style={thF}>{d.horas_trabajadas_netas !== null ? numero(d.horas_trabajadas_netas) : '-'}</td>
            <td align="right" style={thF}></td>
            <td style={{ ...thF, color: d.cumplimiento_reglamento && d.cumplimiento_reglamento !== 'OK' ? '#b45309' : '#6b7280' }}>{incidLabel(d.cumplimiento_reglamento)}</td>
          </tr>
        )
      })
    }
  })

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
        <thead><tr style={{ borderBottom: '1px solid #ddd' }}>
          <th align="left" style={thF}>Semana (toca para ver los días)</th>
          <th align="right" style={thF}>Teóricas</th>
          <th align="right" style={thF}>Realizadas</th>
          <th align="right" style={thF}>Diferencia</th>
          <th align="left" style={thF}>Resumen</th>
        </tr></thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  )
}
