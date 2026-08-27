'use client'
// VERSION: v5 · 2026-08-27 · Registrar gestión (llamada/WhatsApp/presencial) en el modal → Bitácora, además de la carta. Hereda v4.
// VERSION: v4 · 2026-08-27 · "Probar (a mí)" abre la MISMA ventana de revisión; la prueba se lanza desde ahí (sin cargar cartola). Hereda v3.
// VERSION: v3 · 2026-08-27 · Paso de confirmación antes de enviar aviso/firme (revisar, añadir CC/aval, cancelar); copia a administración. Hereda v2.
// VERSION: v2 · 2026-08-26 · Cobranza · Pestaña MULTAS con acciones (Tanda 2).
//   Bandeja + modal de carta: elige perfil/redacción, multa editable, Probar / Enviar aviso / Hacer firme.
//   Estados: propuesta -> avisada (plazo 3 días hábiles) -> firme (carga en cartola) | regularizada | anulada.
//   Consume /api/cobranza/multas (GET cálculo · POST acciones aviso/firme/regularizar/anular).
// Ruta real: app/op/cobranza/MultasView.js
import { useState, useEffect } from 'react'
import Link from 'next/link'
import RegistroGestion from '../../components/ui/RegistroGestion'
const C = { txt: '#2C2C2A', sub: '#888780', line: '#D3D1C7', panel: '#F1EFE8', rojo: '#9B1C1C', rojoBg: '#FBEDEC', verde: '#085041', verdeBg: '#E9F4E4', ambar: '#B8860B', ambarBg: '#FBF7EC', acento: '#1D9E75' }
const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']

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
  avisada: { lbl: 'Avisada', bg: '#FBF7EC', fg: '#B8860B' },
  firme: { lbl: 'Multa firme', bg: '#FBEDEC', fg: '#9B1C1C' },
  regularizada: { lbl: 'Regularizada', bg: '#E9F4E4', fg: '#085041' },
  anulada: { lbl: 'Anulada', bg: '#F1EFE8', fg: '#888780' },
}
const badge = (o) => o ? <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: o.bg, color: o.fg, whiteSpace: 'nowrap' }}>{o.lbl}</span> : null

// suma n días hábiles a una fecha ISO (YYYY-MM-DD), saltando sáb/dom
function addHabiles(iso, n) {
  const [y, m, d] = String(iso || '').split('-').map(Number)
  let t = Date.UTC(y, m - 1, d), added = 0
  while (added < n) { t += 86400000; const wd = new Date(t).getUTCDay(); if (wd !== 0 && wd !== 6) added++ }
  return new Date(t).toISOString().slice(0, 10)
}
const ddmm = (iso) => { const [y, m, d] = String(iso || '').split('-'); return d && m ? `${d}/${m}/${y}` : iso }

function MultasView() {
  const [periodo, setPeriodo] = useState('')
  const [inp, setInp] = useState('')
  const [data, setData] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [abierto, setAbierto] = useState(null)
  const [modal, setModal] = useState(null)

  const cargar = (p) => {
    setCargando(true); setError('')
    fetch('/api/cobranza/multas' + (p ? '?periodo=' + encodeURIComponent(p) : ''), { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (j.error) setError(j.error); else { setData(j); setPeriodo(j.periodo); setInp(j.periodo) } })
      .catch(e => setError(String(e)))
      .finally(() => setCargando(false))
  }
  useEffect(() => { cargar('') }, [])

  const mesLbl = periodo ? (MESES[Number(periodo.slice(2)) - 1] + ' 20' + periodo.slice(0, 2)) : ''
  const plazoTxt = data?.hoy ? `3 días hábiles (hasta el ${ddmm(addHabiles(data.hoy, 3))})` : '3 días hábiles'

  const plantillaDe = (perfil, tipo) => (data?.plantillas || []).find(p => p.etapa === 'multa_' + tipo + '_' + perfil)
  const sustituir = (txt, m, monto) => String(txt || '')
    .replaceAll('{{arrendatario}}', m.arrendatario || '')
    .replaceAll('{{propiedad}}', m.propiedad || '')
    .replaceAll('{{mes}}', mesLbl)
    .replaceAll('{{dias_atraso}}', String(m.dias_atraso || 0))
    .replaceAll('{{multa}}', P(monto))
    .replaceAll('{{deuda_pendiente}}', P(m.falta))
    .replaceAll('{{plazo}}', plazoTxt)
    .replaceAll('{{multa_diaria}}', (m.multa_diaria == null ? '—' : m.multa_diaria + '%'))

  const abrirModal = (m, tipo) => {
    const perfil = m.perfil || 'apretado'
    const pl = plantillaDe(perfil, tipo)
    const monto = Math.round(Number(m.monto_guardado ?? m.multa) || 0)
    setModal({
      m, tipo, perfil, monto,
      dept: pl?.departamento || (perfil === 'grave' ? 'legal' : 'cobranza'),
      asunto: sustituir(pl?.asunto, m, monto), cuerpo: sustituir(pl?.cuerpo, m, monto),
      email: m.mail_arrendatario || '', cc: '', confirmar: null, enviando: false, msg: '',
    })
  }
  const regenerar = (mod, patch) => {
    const next = { ...mod, ...patch }
    const pl = plantillaDe(next.perfil, next.tipo)
    next.dept = pl?.departamento || (next.perfil === 'grave' ? 'legal' : 'cobranza')
    next.asunto = sustituir(pl?.asunto, next.m, next.monto)
    next.cuerpo = sustituir(pl?.cuerpo, next.m, next.monto)
    return next
  }

  const ejecutar = async (accion, extra = {}) => {
    const mod = modal
    const body = {
      accion, idadmon: mod.m.idadmon, periodo, perfil: mod.perfil, monto: mod.monto,
      base: mod.m.base, dias_atraso: mod.m.dias_atraso, multa_diaria: mod.m.multa_diaria, tramos: mod.m.tramos,
      departamento: mod.dept, asunto: mod.asunto, contenido: mod.cuerpo, destino_email: mod.email, cc: mod.cc || '', ...extra,
    }
    setModal({ ...mod, enviando: true, msg: '' })
    try {
      const r = await fetch('/api/cobranza/multas', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const j = await r.json()
      if (j.error) { setModal({ ...mod, enviando: false, msg: '⚠ ' + j.error }); return }
      if (extra.test) { setModal({ ...mod, enviando: false, msg: '✓ Prueba enviada a ti mismo.' }); return }
      setModal(null); cargar(periodo)
    } catch (e) { setModal({ ...mod, enviando: false, msg: '⚠ ' + String(e) }) }
  }

  const accionSimple = async (m, accion, motivo) => {
    const body = { accion, idadmon: m.idadmon, periodo }
    if (motivo != null) body.motivo = motivo
    const r = await fetch('/api/cobranza/multas', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const j = await r.json()
    if (j.error) { alert(j.error); return }
    cargar(periodo)
  }

  const th = { textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '.03em', padding: '8px 10px', borderBottom: '1px solid ' + C.line, whiteSpace: 'nowrap' }
  const td = { fontSize: 13, color: C.txt, padding: '9px 10px', borderBottom: '1px solid #EFEDE6', verticalAlign: 'top' }
  const numTd = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
  const btn = (bg, fg, bd) => ({ fontSize: 12, fontWeight: 700, padding: '5px 10px', borderRadius: 7, border: '1px solid ' + (bd || bg), background: bg, color: fg, cursor: 'pointer', whiteSpace: 'nowrap' })
  const rs = data?.resumen

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>Multas por atraso</span>
        <span style={{ fontSize: 12, color: C.sub }}>· {mesLbl || '—'}{data?.hoy ? ' · al ' + ddmm(data.hoy) : ''}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <input value={inp} onChange={e => setInp(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} placeholder="AAMM"
            style={{ width: 72, fontSize: 13, padding: '6px 8px', border: '1px solid ' + C.line, borderRadius: 8, textAlign: 'center' }} />
          <button onClick={() => cargar(inp)} style={{ fontSize: 13, fontWeight: 700, padding: '6px 12px', borderRadius: 8, border: '1px solid ' + C.line, background: '#fff', cursor: 'pointer' }}>Ver</button>
        </div>
      </div>

      <div style={{ background: C.ambarBg, border: '1px solid #EADFBE', borderRadius: 8, padding: '8px 12px', fontSize: 12.5, color: '#6b4e05', marginBottom: 14 }}>
        <b>Aviso → firme.</b> El <b>aviso</b> manda la carta y abre un plazo de {plazoTxt}, sin tocar la cartola. Si no regulariza en plazo, <b>Hacer firme</b> repite la carta y carga la multa en la cartola (rojo claro, anulable). Perfil <b>grave</b>: multa directa.
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
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 960 }}>
                <thead><tr>
                  <th style={th}>IDADMON</th><th style={th}>Arrendatario</th><th style={th}>Propiedad</th>
                  <th style={th}>Perfil</th><th style={{ ...th, textAlign: 'right' }}>A cobrar</th>
                  <th style={{ ...th, textAlign: 'right' }}>Falta hoy</th><th style={{ ...th, textAlign: 'right' }}>Días</th>
                  <th style={{ ...th, textAlign: 'right' }}>% día</th><th style={{ ...th, textAlign: 'right' }}>Multa</th>
                  <th style={th}>Situación</th><th style={th}>Acción</th>
                </tr></thead>
                <tbody>
                  {data.morosos.map(m => {
                    const open = abierto === m.idadmon
                    const vencido = m.estado === 'avisada' && m.plazo_hasta && data.hoy > m.plazo_hasta
                    return [
                      <tr key={m.idadmon} style={{ background: open ? C.panel : 'transparent' }}>
                        <td style={td}><Link href={'/procesos/cartolas?idadmon=' + m.idadmon} target="_blank" style={{ color: C.acento, fontWeight: 700, textDecoration: 'none' }}>{m.idadmon}</Link></td>
                        <td style={{ ...td, cursor: 'pointer' }} onClick={() => setAbierto(open ? null : m.idadmon)}>{m.arrendatario}</td>
                        <td style={{ ...td, maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }} title={m.propiedad} onClick={() => setAbierto(open ? null : m.idadmon)}>{m.propiedad}</td>
                        <td style={td}>{badge(PERFIL[m.perfil])}</td>
                        <td style={numTd}>{P(m.base)}</td>
                        <td style={numTd}>{P(m.falta)}</td>
                        <td style={numTd}>{m.dias_atraso || '—'}</td>
                        <td style={numTd}>{m.multa_diaria == null ? '—' : m.multa_diaria + '%'}</td>
                        <td style={{ ...numTd, fontWeight: 800, color: m.multa > 0 ? C.rojo : C.sub }}>{m.multa > 0 ? P(m.multa) : '—'}</td>
                        <td style={td}>{badge(BUCKET[m.bucket])} {badge(ESTADO[m.estado])}{vencido ? <span style={{ fontSize: 10, color: C.rojo, fontWeight: 700, display: 'block', marginTop: 2 }}>plazo vencido</span> : (m.estado === 'avisada' && m.plazo_hasta ? <span style={{ fontSize: 10, color: C.ambar, display: 'block', marginTop: 2 }}>hasta {ddmm(m.plazo_hasta)}</span> : null)}</td>
                        <td style={td}>
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                            {(m.estado === 'propuesta' && m.bucket === 'multa') && (
                              m.perfil === 'grave'
                                ? <button onClick={() => abrirModal(m, 'firme')} style={btn(C.rojoBg, C.rojo, '#F0CFCB')}>Multa directa</button>
                                : <button onClick={() => abrirModal(m, 'aviso')} style={btn(C.verdeBg, C.verde, '#CBE6BE')}>Preparar aviso</button>
                            )}
                            {m.estado === 'avisada' && <>
                              <button onClick={() => abrirModal(m, 'firme')} style={btn(vencido ? C.rojoBg : '#fff', vencido ? C.rojo : C.sub, vencido ? '#F0CFCB' : C.line)}>Hacer firme</button>
                              <button onClick={() => { if (confirm('¿Marcar como regularizada (pagó dentro del plazo, sin multa)?')) accionSimple(m, 'regularizar') }} style={btn('#fff', C.verde, '#CBE6BE')}>Regularizar</button>
                            </>}
                            {m.estado === 'firme' && <button onClick={() => { const mo = prompt('Motivo de la anulación de la multa:'); if (mo && mo.trim().length >= 3) accionSimple(m, 'anular', mo.trim()) }} style={btn('#fff', C.sub, C.line)}>Anular</button>}
                          </div>
                        </td>
                      </tr>,
                      open ? (
                        <tr key={m.idadmon + '_d'} style={{ background: C.panel }}>
                          <td style={{ ...td, borderBottom: '1px solid ' + C.line }} colSpan={11}>
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
                                    <tbody>{m.tramos.map((t, i) => (<tr key={i}><td style={{ ...td, padding: '3px 8px', borderBottom: 'none' }}>{ddmm(t.desde)}</td><td style={{ ...td, padding: '3px 8px', borderBottom: 'none' }}>{ddmm(t.hasta)}</td><td style={{ ...numTd, padding: '3px 8px', borderBottom: 'none' }}>{t.dias}</td><td style={{ ...numTd, padding: '3px 8px', borderBottom: 'none' }}>{P(t.saldo)}</td></tr>))}</tbody>
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

      {/* ── Modal de composición de la carta ── */}
      {modal && (
        <div onClick={() => !modal.enviando && setModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, boxShadow: '0 18px 50px rgba(0,0,0,0.25)', width: 'min(680px, 96vw)', maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>{modal.tipo === 'aviso' ? 'Aviso de multa' : 'Multa firme'} · {modal.m.idadmon}</h2>
              <button onClick={() => !modal.enviando && setModal(null)} style={{ border: 'none', background: 'transparent', fontSize: 20, color: '#9ca3af', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ fontSize: 12.5, color: C.sub, marginBottom: 12 }}>{modal.m.arrendatario} · {modal.m.propiedad}</div>

            {modal.tipo === 'firme' && (
              <div style={{ background: C.rojoBg, border: '1px solid #F0CFCB', borderRadius: 8, padding: '8px 12px', fontSize: 12.5, color: C.rojo, marginBottom: 12 }}>
                <b>Hacer firme</b> carga la multa de <b>{P(modal.monto)}</b> en la cartola del arrendatario (rojo claro, anulable) y envía la carta.
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              <label style={{ fontSize: 12.5 }}>
                <div style={{ color: C.sub, fontWeight: 700, marginBottom: 3 }}>Redacción (perfil)</div>
                <select value={modal.perfil} onChange={e => setModal(regenerar(modal, { perfil: e.target.value }))} style={{ fontSize: 13, padding: '6px 8px', border: '1px solid ' + C.line, borderRadius: 8 }}>
                  {Object.keys(PERFIL).map(k => <option key={k} value={k}>{PERFIL[k].lbl}</option>)}
                </select>
              </label>
              <label style={{ fontSize: 12.5 }}>
                <div style={{ color: C.sub, fontWeight: 700, marginBottom: 3 }}>Multa ($)</div>
                <input type="number" value={modal.monto} onChange={e => setModal(regenerar(modal, { monto: Math.round(Number(e.target.value) || 0) }))} style={{ width: 120, fontSize: 13, padding: '6px 8px', border: '1px solid ' + C.line, borderRadius: 8, textAlign: 'right' }} />
              </label>
              <label style={{ fontSize: 12.5, flex: '1 1 200px' }}>
                <div style={{ color: C.sub, fontWeight: 700, marginBottom: 3 }}>Email del arrendatario</div>
                <input value={modal.email} onChange={e => setModal({ ...modal, email: e.target.value })} style={{ width: '100%', fontSize: 13, padding: '6px 8px', border: '1px solid ' + C.line, borderRadius: 8 }} />
              </label>
            </div>

            <div style={{ fontSize: 12.5, marginBottom: 8 }}>
              <div style={{ color: C.sub, fontWeight: 700, marginBottom: 3 }}>Asunto</div>
              <input value={modal.asunto} onChange={e => setModal({ ...modal, asunto: e.target.value })} style={{ width: '100%', fontSize: 13, padding: '7px 9px', border: '1px solid ' + C.line, borderRadius: 8 }} />
            </div>
            <div style={{ fontSize: 12.5, marginBottom: 6 }}>
              <div style={{ color: C.sub, fontWeight: 700, marginBottom: 3 }}>Cuerpo <span style={{ fontWeight: 400 }}>· sale desde {modal.dept === 'legal' ? 'legal@' : 'cobranza@'}</span></div>
              <textarea value={modal.cuerpo} onChange={e => setModal({ ...modal, cuerpo: e.target.value })} rows={11} style={{ width: '100%', fontSize: 13, padding: '9px 11px', border: '1px solid ' + C.line, borderRadius: 8, fontFamily: 'inherit', lineHeight: 1.5, resize: 'vertical' }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <RegistroGestion idadmon={modal.m.idadmon} arrendatario={modal.m.arrendatario} propietario={modal.m.propietario} inmueble={modal.m.propiedad} rut={modal.m.rut} aval={modal.m.aval} rut_avalista={modal.m.rut_avalista} deuda={modal.m.falta} departamento={modal.dept} />
            </div>
            {modal.msg && <div style={{ fontSize: 12.5, color: modal.msg[0] === '✓' ? C.verde : C.rojo, marginBottom: 8 }}>{modal.msg}</div>}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 6 }}>
              <button disabled={modal.enviando} onClick={() => setModal(null)} style={{ ...btn('#fff', C.sub, C.line), padding: '8px 14px' }}>Cancelar</button>
              <button disabled={modal.enviando} onClick={() => setModal({ ...modal, confirmar: modal.tipo, msg: '' })} style={{ ...btn('#EEF4FF', '#1D4ED8', '#CFE0FF'), padding: '8px 14px' }}>Probar (a mí)…</button>
              {modal.tipo === 'aviso'
                ? <button disabled={modal.enviando} onClick={() => setModal({ ...modal, confirmar: 'aviso', msg: '' })} style={{ ...btn(C.acento, '#fff', C.acento), padding: '8px 16px' }}>Enviar aviso…</button>
                : <button disabled={modal.enviando} onClick={() => setModal({ ...modal, confirmar: 'firme', msg: '' })} style={{ ...btn(C.rojo, '#fff', C.rojo), padding: '8px 16px' }}>Hacer firme y cargar…</button>}
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmación antes de enviar (aviso / firme) ── */}
      {modal && modal.confirmar && (
        <div onClick={() => !modal.enviando && setModal({ ...modal, confirmar: null })} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, boxShadow: '0 18px 50px rgba(0,0,0,0.3)', width: 'min(560px, 96vw)', maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 2 }}>Revisa antes de enviar</div>
            <div style={{ fontSize: 12.5, color: C.sub, marginBottom: 12 }}>{modal.confirmar === 'aviso' ? ('El aviso va a salir al arrendatario y abre el plazo de ' + plazoTxt + '.') : ('La carta va a salir y se cargará la multa de ' + P(modal.monto) + ' en la cartola.')}</div>
            {modal.confirmar === 'firme' && (
              <div style={{ background: C.rojoBg, border: '1px solid #F0CFCB', borderRadius: 8, padding: '8px 12px', fontSize: 12.5, color: C.rojo, marginBottom: 12 }}>Al confirmar se carga <b>{P(modal.monto)}</b> en la cartola de {modal.m.idadmon} (rojo claro, anulable después).</div>
            )}
            <div style={{ display: 'grid', gap: 8, fontSize: 12.5 }}>
              <div><span style={{ color: C.sub }}>Para:</span> <b>{modal.email || '—'}</b> <span style={{ color: C.sub }}>· sale desde {modal.dept === 'legal' ? 'legal@' : 'cobranza@'}</span></div>
              <div>
                <div style={{ color: C.sub, marginBottom: 3 }}>Con copia (CC · opcional — aval u otros, separa por comas)</div>
                <input value={modal.cc} onChange={e => setModal({ ...modal, cc: e.target.value })} placeholder={modal.m.aval ? ('aval: ' + (modal.m.mail_avalista || modal.m.aval)) : 'correo@ejemplo.com, otro@ejemplo.com'} style={{ width: '100%', fontSize: 13, padding: '7px 9px', border: '1px solid ' + C.line, borderRadius: 8, boxSizing: 'border-box' }} />
              </div>
              <div><span style={{ color: C.sub }}>Asunto:</span> <b>{modal.asunto}</b></div>
              <div>
                <div style={{ color: C.sub, marginBottom: 3 }}>Cuerpo</div>
                <div style={{ background: '#F7F6F1', border: '1px solid ' + C.line, borderRadius: 8, padding: '10px 12px', whiteSpace: 'pre-wrap', lineHeight: 1.5, maxHeight: 220, overflowY: 'auto' }}>{modal.cuerpo}</div>
              </div>
              <div style={{ fontSize: 11.5, color: C.sub }}>Se envía una copia oculta a administración@fondocapital.com.</div>
            </div>
            {modal.msg && <div style={{ fontSize: 12.5, color: modal.msg[0] === '✓' ? C.verde : C.rojo, marginTop: 10 }}>{modal.msg}</div>}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 16 }}>
              <button disabled={modal.enviando} onClick={() => setModal({ ...modal, confirmar: null, msg: '' })} style={{ ...btn('#fff', C.sub, C.line), padding: '8px 14px', marginRight: 'auto' }}>Volver a editar</button>
              <button disabled={modal.enviando} onClick={() => ejecutar(modal.confirmar, { test: true })} style={{ ...btn('#EEF4FF', '#1D4ED8', '#CFE0FF'), padding: '8px 14px' }}>{modal.enviando ? 'Enviando…' : 'Enviar prueba a mí'}</button>
              <button disabled={modal.enviando} onClick={() => ejecutar(modal.confirmar)} style={{ ...btn(modal.confirmar === 'firme' ? C.rojo : C.acento, '#fff', modal.confirmar === 'firme' ? C.rojo : C.acento), padding: '8px 16px' }}>{modal.enviando ? (modal.confirmar === 'firme' ? 'Procesando…' : 'Enviando…') : 'Confirmar y enviar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default MultasView
