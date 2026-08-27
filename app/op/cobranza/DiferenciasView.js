'use client'
// VERSION: v1 · 2026-08-26 · Cobranza · Pestaña DIFERENCIAS / saldo por cobrar (Tanda 1, solo lectura).
//   Muestra quién PAGÓ DE MENOS este periodo (pagó algo pero le falta), la diferencia del mes,
//   el saldo acumulado de su cartola, el % pagado y si hubo reajuste reciente. Sin envíos.
//   Consume /api/cobranza/diferencias. Objetivo: ver con datos reales cuánto se escapa por el goteo.
// Ruta real: app/op/cobranza/DiferenciasView.js
import { useState, useEffect } from 'react'
import Link from 'next/link'
const C = { txt: '#2C2C2A', sub: '#888780', line: '#D3D1C7', panel: '#F1EFE8', rojo: '#9B1C1C', rojoBg: '#FBEDEC', verde: '#085041', verdeBg: '#E9F4E4', ambar: '#B8860B', ambarBg: '#FBF7EC', acento: '#1D9E75' }
const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
const P = (n) => (Number(n) < 0 ? '-$' : '$') + Math.abs(Math.round(Number(n) || 0)).toLocaleString('es-CL')
const ddmm = (iso) => { const [y, m, d] = String(iso || '').split('-'); return d && m ? `${d}/${m}/${y}` : iso }

function DiferenciasView() {
  const [periodo, setPeriodo] = useState('')
  const [inp, setInp] = useState('')
  const [data, setData] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const cargar = (p) => {
    setCargando(true); setError('')
    fetch('/api/cobranza/diferencias' + (p ? '?periodo=' + encodeURIComponent(p) : ''), { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (j.error) setError(j.error); else { setData(j); setPeriodo(j.periodo); setInp(j.periodo) } })
      .catch(e => setError(String(e)))
      .finally(() => setCargando(false))
  }
  useEffect(() => { cargar('') }, [])
  const mesLbl = periodo ? (MESES[Number(periodo.slice(2)) - 1] + ' 20' + periodo.slice(0, 2)) : ''

  const th = { textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '.03em', padding: '8px 10px', borderBottom: '1px solid ' + C.line, whiteSpace: 'nowrap' }
  const td = { fontSize: 13, color: C.txt, padding: '9px 10px', borderBottom: '1px solid #EFEDE6' }
  const numTd = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
  const rs = data?.resumen

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>Diferencias / saldo por cobrar</span>
        <span style={{ fontSize: 12, color: C.sub }}>· {mesLbl || '—'}{data?.hoy ? ' · al ' + ddmm(data.hoy) : ''}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <input value={inp} onChange={e => setInp(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} placeholder="AAMM"
            style={{ width: 72, fontSize: 13, padding: '6px 8px', border: '1px solid ' + C.line, borderRadius: 8, textAlign: 'center' }} />
          <button onClick={() => cargar(inp)} style={{ fontSize: 13, fontWeight: 700, padding: '6px 12px', borderRadius: 8, border: '1px solid ' + C.line, background: '#fff', cursor: 'pointer' }}>Ver</button>
        </div>
      </div>

      <div style={{ background: '#EEF4FF', border: '1px solid #CFE0FF', borderRadius: 8, padding: '8px 12px', fontSize: 12.5, color: '#1D4ED8', marginBottom: 14 }}>
        <b>Pagó de menos, no es multa.</b> Estos contratos <b>pagaron algo pero les falta</b> (a menudo por reajustes no aplicados). Pagaron a tiempo, solo por debajo del monto real: aquí el paso es un <b>recordatorio de saldo</b>, sin penalización. El que <b>no pagó nada</b> va a Multas / cobranza, no aquí. <b>Tanda 1 · solo lectura.</b>
      </div>

      {cargando && <div style={{ color: C.sub, fontSize: 13, padding: 20 }}>Calculando diferencias…</div>}
      {error && <div style={{ color: C.rojo, background: C.rojoBg, border: '1px solid #F0CFCB', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>Error: {error}</div>}

      {!cargando && !error && data && (
        <>
          {rs && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
              {[
                { lab: 'Contratos', val: rs.total, col: C.txt },
                { lab: 'Se escapa este mes', val: P(rs.suma_dif), col: C.rojo },
                { lab: 'Saldo acumulado', val: P(rs.suma_acum), col: C.rojo },
                { lab: 'Con reajuste reciente', val: rs.con_reajuste, col: '#1D4ED8' },
              ].map((k, i) => (
                <div key={i} style={{ border: '1px solid ' + C.line, borderRadius: 10, padding: '7px 13px', background: '#fff', minWidth: 110 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: C.sub, textTransform: 'uppercase', letterSpacing: '.03em' }}>{k.lab}</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: k.col }}>{k.val}</div>
                </div>
              ))}
            </div>
          )}

          {(!data.filas || !data.filas.length) ? (
            <div style={{ color: C.sub, fontSize: 13, padding: 20 }}>Nadie pagó de menos este periodo (o las diferencias son inferiores al umbral).</div>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid ' + C.line, borderRadius: 10 }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 900 }}>
                <thead><tr>
                  <th style={th}>IDADMON</th><th style={th}>Arrendatario</th><th style={th}>Propiedad</th>
                  <th style={{ ...th, textAlign: 'right' }}>A cobrar</th><th style={{ ...th, textAlign: 'right' }}>Recibido</th>
                  <th style={{ ...th, textAlign: 'right' }}>% pag.</th><th style={{ ...th, textAlign: 'right' }}>Diferencia mes</th>
                  <th style={{ ...th, textAlign: 'right' }}>Saldo acumulado</th><th style={th}>Reajuste</th>
                </tr></thead>
                <tbody>
                  {data.filas.map(f => (
                    <tr key={f.idadmon}>
                      <td style={td}><Link href={'/procesos/cartolas?idadmon=' + f.idadmon} target="_blank" style={{ color: C.acento, fontWeight: 700, textDecoration: 'none' }}>{f.idadmon}</Link></td>
                      <td style={td}>{f.arrendatario}</td>
                      <td style={{ ...td, maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={f.propiedad}>{f.propiedad}</td>
                      <td style={numTd}>{P(f.base)}</td>
                      <td style={numTd}>{P(f.recibido)}</td>
                      <td style={{ ...numTd, color: f.pct_pagado >= 90 ? C.verde : f.pct_pagado >= 60 ? C.ambar : C.rojo, fontWeight: 700 }}>{f.pct_pagado}%</td>
                      <td style={{ ...numTd, fontWeight: 800, color: C.rojo }}>{P(f.diferencia)}</td>
                      <td style={{ ...numTd, color: f.saldo_acumulado > 0 ? C.rojo : C.verde }}>{P(f.saldo_acumulado)}</td>
                      <td style={td}>{f.reajuste_reciente ? <span title={'último reajuste ' + ddmm(f.fecha_reajuste)} style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#EEF4FF', color: '#1D4ED8', whiteSpace: 'nowrap' }}>reajuste {ddmm(f.fecha_reajuste)}</span> : <span style={{ color: C.sub, fontSize: 12 }}>—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
export default DiferenciasView
