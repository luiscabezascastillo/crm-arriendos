'use client'
// VERSION: v1 · 2026-08-26 · Cobranza · Pestaña MULTAS (Tanda 1: bandeja de solo lectura).
//   Consume /api/cobranza/multas: por moroso de arriendo del periodo muestra la multa propuesta
//   (tramo a tramo, cuadrada con el FALTAN) y el perfil detectado (puntual/apretado/cronico/grave).
//   NO envía ni carga en cartola: las acciones (aviso/firme) llegan en la Tanda 2.
// Ruta real: app/op/cobranza/MultasView.js
import { useState, useEffect } from 'react'
import Link from 'next/link'
const C = { txt: '#2C2C2A', sub: '#888780', line: '#D3D1C7', panel: '#F1EFE8', rojo: '#9B1C1C', rojoBg: '#FBEDEC', verde: '#085041', verdeBg: '#E9F4E4', ambar: '#B8860B', ambarBg: '#FBF7EC', acento: '#1D9E75' }

// ══════════════════════════════════════════════════════════════════════════
// PESTAÑA MULTAS — Tanda 1: bandeja de solo lectura (cálculo tramo a tramo + perfil).
//   Muestra, por moroso de arriendo del periodo, la multa propuesta y el perfil detectado.
//   No envía nada ni carga en cartola: eso es la Tanda 2 (acciones aviso/firme).
// ══════════════════════════════════════════════════════════════════════════
function MultasView() {
  const [periodo, setPeriodo] = useState('')
  const [inp, setInp] = useState('')
  const [data, setData] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [abierto, setAbierto] = useState(null)

  const cargar = (p) => {
    setCargando(true); setError('')
    fetch('/api/cobranza/multas' + (p ? '?periodo=' + encodeURIComponent(p) : ''), { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (j.error) setError(j.error); else { setData(j); setPeriodo(j.periodo); setInp(j.periodo) } })
      .catch(e => setError(String(e)))
      .finally(() => setCargando(false))
  }
  useEffect(() => { cargar('') }, [])

  const P = (n) => (Number(n) < 0 ? '-$' : '$') + Math.abs(Math.round(Number(n) || 0)).toLocaleString('es-CL')
  const PERFIL = {
    puntual: { lbl: 'Puntual', bg: '#E9F4E4', fg: '#085041', d: 'Buen pagador, primer atraso' },
    apretado: { lbl: 'Apretado', bg: '#FBF7EC', fg: '#B8860B', d: 'Se atrasa pero regulariza' },
    cronico: { lbl: 'Crónico', bg: '#FBEDEC', fg: '#9B1C1C', d: 'Reincidente, nos hace perseguirlo' },
    grave: { lbl: 'Grave', bg: '#7a1c17', fg: '#fff', d: 'Saldo alto / mala fe' },
  }
  const BUCKET = {
    multa: { lbl: 'Multa', bg: '#FBEDEC', fg: '#9B1C1C' },
    a_tiempo: { lbl: 'A tiempo', bg: '#E9F4E4', fg: '#085041' },
    revisar: { lbl: 'Revisar cartola', bg: '#FBF7EC', fg: '#B8860B' },
    sin_pct: { lbl: 'Sin % pactado', bg: '#EEF4FF', fg: '#1D4ED8' },
  }
  const ESTADO = {
    propuesta: null,
    avisada: { lbl: 'Avisada', bg: '#FBF7EC', fg: '#B8860B' },
    firme: { lbl: 'Firme', bg: '#FBEDEC', fg: '#9B1C1C' },
    regularizada: { lbl: 'Regularizada', bg: '#E9F4E4', fg: '#085041' },
    anulada: { lbl: 'Anulada', bg: '#F1EFE8', fg: '#888780' },
  }
  const badge = (o) => o ? <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: o.bg, color: o.fg, whiteSpace: 'nowrap' }}>{o.lbl}</span> : null

  const th = { textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '.03em', padding: '8px 10px', borderBottom: '1px solid ' + C.line, whiteSpace: 'nowrap' }
  const td = { fontSize: 13, color: C.txt, padding: '9px 10px', borderBottom: '1px solid #EFEDE6', verticalAlign: 'top' }
  const num = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
  const rs = data?.resumen

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>Multas por atraso</span>
        <span style={{ fontSize: 12, color: C.sub }}>· periodo {periodo || '—'}{data?.hoy ? ' · al ' + data.hoy : ''}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <input value={inp} onChange={e => setInp(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} placeholder="AAMM"
            style={{ width: 72, fontSize: 13, padding: '6px 8px', border: '1px solid ' + C.line, borderRadius: 8, textAlign: 'center' }} />
          <button onClick={() => cargar(inp)} style={{ fontSize: 13, fontWeight: 700, padding: '6px 12px', borderRadius: 8, border: '1px solid ' + C.line, background: '#fff', cursor: 'pointer' }}>Ver</button>
        </div>
      </div>

      <div style={{ background: C.ambarBg, border: '1px solid #EADFBE', borderRadius: 8, padding: '8px 12px', fontSize: 12.5, color: '#6b4e05', marginBottom: 14 }}>
        <b>Tanda 1 · solo cálculo.</b> Aquí ves la multa propuesta y el perfil de cada moroso para cuadrarlos con el FALTAN. Todavía <b>no se envía ninguna carta ni se carga nada en la cartola</b>; eso llegará con las acciones (aviso → firme).
      </div>

      {cargando && <div style={{ color: C.sub, fontSize: 13, padding: 20 }}>Calculando multas…</div>}
      {error && <div style={{ color: C.rojo, background: C.rojoBg, border: '1px solid #F0CFCB', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>Error: {error}</div>}

      {!cargando && !error && data && (
        <>
          {rs && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
              {[
                { lab: 'Con multa', val: rs.con_multa, col: C.rojo },
                { lab: 'Suma multas', val: P(rs.suma_multas), col: C.rojo },
                { lab: 'A tiempo (≤ día 10)', val: rs.a_tiempo, col: C.verde },
                { lab: 'A revisar', val: rs.revisar, col: C.ambar },
                { lab: 'Sin % pactado', val: rs.sin_pct, col: '#1D4ED8' },
              ].map((k, i) => (
                <div key={i} style={{ border: '1px solid ' + C.line, borderRadius: 10, padding: '7px 13px', background: '#fff', minWidth: 96 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: C.sub, textTransform: 'uppercase', letterSpacing: '.03em' }}>{k.lab}</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: k.col }}>{k.val}</div>
                </div>
              ))}
            </div>
          )}

          {(!data.morosos || !data.morosos.length) ? (
            <div style={{ color: C.sub, fontSize: 13, padding: 20 }}>No hay morosos de arriendo con falta este periodo.</div>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid ' + C.line, borderRadius: 10 }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 860 }}>
                <thead><tr>
                  <th style={th}>IDADMON</th><th style={th}>Arrendatario</th><th style={th}>Propiedad</th>
                  <th style={th}>Perfil</th><th style={{ ...th, textAlign: 'right' }}>A cobrar</th>
                  <th style={{ ...th, textAlign: 'right' }}>Falta hoy</th><th style={{ ...th, textAlign: 'right' }}>Días</th>
                  <th style={{ ...th, textAlign: 'right' }}>% día</th><th style={{ ...th, textAlign: 'right' }}>Multa propuesta</th>
                  <th style={th}>Situación</th>
                </tr></thead>
                <tbody>
                  {data.morosos.map(m => {
                    const open = abierto === m.idadmon
                    return [
                      <tr key={m.idadmon} onClick={() => setAbierto(open ? null : m.idadmon)} style={{ cursor: 'pointer', background: open ? C.panel : 'transparent' }}>
                        <td style={td}><Link href={'/procesos/cartolas?idadmon=' + m.idadmon} target="_blank" onClick={e => e.stopPropagation()} style={{ color: C.acento, fontWeight: 700, textDecoration: 'none' }}>{m.idadmon}</Link></td>
                        <td style={td}>{m.arrendatario}</td>
                        <td style={{ ...td, maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={m.propiedad}>{m.propiedad}</td>
                        <td style={td}>{badge(PERFIL[m.perfil])}{m.perfil !== m.perfil_auto ? <span title="perfil cambiado manualmente" style={{ fontSize: 10, color: C.sub }}> ✎</span> : null}</td>
                        <td style={num}>{P(m.base)}</td>
                        <td style={num}>{P(m.falta)}</td>
                        <td style={num}>{m.dias_atraso || '—'}</td>
                        <td style={num}>{m.multa_diaria == null ? '—' : m.multa_diaria + '%'}</td>
                        <td style={{ ...num, fontWeight: 800, color: m.multa > 0 ? C.rojo : C.sub }}>{m.multa > 0 ? P(m.multa) : '—'}</td>
                        <td style={td}>{badge(BUCKET[m.bucket])} {badge(ESTADO[m.estado])}</td>
                      </tr>,
                      open ? (
                        <tr key={m.idadmon + '_d'} style={{ background: C.panel }}>
                          <td style={{ ...td, borderBottom: '1px solid ' + C.line }} colSpan={10}>
                            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 12.5 }}>
                              <div>
                                <div style={{ fontWeight: 700, color: C.sub, marginBottom: 4 }}>Perfil ({PERFIL[m.perfil]?.d})</div>
                                <div>Meses con deuda: <b>{m.perfil_metrics.meses_con_deuda}</b></div>
                                <div>Día medio de pago: <b>{m.perfil_metrics.dia_medio ?? '—'}</b></div>
                                <div>Saldo global cartola: <b>{P(m.perfil_metrics.saldo_actual)}</b></div>
                                <div>Renta ref.: <b>{P(m.perfil_metrics.renta_ref)}</b></div>
                              </div>
                              <div style={{ flex: '1 1 340px', minWidth: 260 }}>
                                <div style={{ fontWeight: 700, color: C.sub, marginBottom: 4 }}>Tramos ponderados (desde el día 6)</div>
                                {(!m.tramos || !m.tramos.length) ? <div style={{ color: C.sub }}>Sin tramos con saldo (pagó lo sustancial a tiempo).</div> : (
                                  <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
                                    <thead><tr><th style={{ ...th, padding: '3px 8px' }}>Desde</th><th style={{ ...th, padding: '3px 8px' }}>Hasta</th><th style={{ ...th, padding: '3px 8px', textAlign: 'right' }}>Días</th><th style={{ ...th, padding: '3px 8px', textAlign: 'right' }}>Saldo</th></tr></thead>
                                    <tbody>{m.tramos.map((t, i) => (<tr key={i}><td style={{ ...td, padding: '3px 8px', borderBottom: 'none' }}>{t.desde}</td><td style={{ ...td, padding: '3px 8px', borderBottom: 'none' }}>{t.hasta}</td><td style={{ ...num, padding: '3px 8px', borderBottom: 'none' }}>{t.dias}</td><td style={{ ...num, padding: '3px 8px', borderBottom: 'none' }}>{P(t.saldo)}</td></tr>))}</tbody>
                                  </table>
                                )}
                                {!m.reconcilia_ok && <div style={{ color: C.ambar, marginTop: 6 }}>⚠ El saldo calculado no cuadra con la liquidación (FALTAN): revisar la cartola antes de multar.</div>}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null,
                    ]
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
export default MultasView
