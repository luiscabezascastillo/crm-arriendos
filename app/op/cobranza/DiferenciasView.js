'use client'
// VERSION: 2026-08-31b · 'Enviados' cuenta los envíos reales del mes (incluye los que ya pagaron y salieron de la lista), con nota de cuáles fueron. Hereda lo anterior.
// VERSION: 2026-08-31 · Anti-doble-envío: la etiqueta muestra 'Enviado dd/mm', el drawer avisa si ya se envió este mes y el 2º envío exige marcar una casilla (a propósito). Hereda lo anterior.
// VERSION: 2026-08-30 · Cabecera de tabla STICKY bajo TopNav+pestañas (top 103).
// VERSION: v7 · 2026-08-28 · Filtros por columna estilo Excel (motor lib/filtroExcel, como CC1/SA) + Limpiar filtros + contador. Hereda v6.
// VERSION: v6 · 2026-08-27 · Registrar gestión (llamada/WhatsApp/presencial) en el drawer → Bitácora, además del email. Hereda v5.
// VERSION: v5 · 2026-08-27 · "Probar (a mí)" y "Enviar" abren la MISMA ventana de revisión; la prueba se lanza desde ahí. Hereda v4.
// VERSION: v4 · 2026-08-27 · Paso de confirmación antes de enviar (revisar, añadir CC/aval, cancelar); copia a administración. Hereda v3.
// VERSION: v3 · 2026-08-27 · Email suave afinado + trozo condicional del reajuste (solo si lo hubo). Hereda v2.
// VERSION: v2 · 2026-08-27 · Cobranza · Pestaña DIFERENCIAS (Tanda 2: drawer de gestión).
//   Al pulsar una fila se abre un DRAWER lateral con el retrato del arrendatario (a cobrar/recibido,
//   reajuste, perfil de pagador, deuda de servicios) y el email suave ya redactado (revisar y enviar).
//   Columna de estado (pendiente/enviado/pospuesto/investigar). Ya NO salta a Cartolas.
//   Consume /api/cobranza/diferencias (GET retrato · POST enviar/estado).
// Ruta real: app/op/cobranza/DiferenciasView.js
import { useState, useEffect, useMemo } from 'react'
import RegistroGestion from '../../components/ui/RegistroGestion'
import { HeaderFilter, filtroActivo, aplicarFiltros } from '@/lib/filtroExcel'
const C = { txt: '#2C2C2A', sub: '#888780', line: '#D3D1C7', panel: '#F1EFE8', rojo: '#9B1C1C', rojoBg: '#FBEDEC', verde: '#085041', verdeBg: '#E9F4E4', ambar: '#B8860B', ambarBg: '#FBF7EC', azul: '#1D4ED8', azulBg: '#EEF4FF', acento: '#1D9E75', naranja: '#E8820C', naranjaBg: '#FFF1DF' }
const P = (n) => (Number(n) < 0 ? '-$' : '$') + Math.abs(Math.round(Number(n) || 0)).toLocaleString('es-CL')
const ddmm = (iso) => { const [y, m, d] = String(iso || '').split('-'); return d && m ? `${d}/${m}/${y}` : iso }
const PERFIL = {
  puntual: { lbl: 'Buen pagador', bg: C.verdeBg, fg: C.verde, d: 'historial limpio, primer desajuste' },
  apretado: { lbl: 'Se atrasa', bg: C.ambarBg, fg: C.ambar, d: 'se atrasa pero regulariza' },
  cronico: { lbl: 'Crónico', bg: C.rojoBg, fg: C.rojo, d: 'reincidente' },
  grave: { lbl: 'Grave', bg: '#7a1c17', fg: '#fff', d: 'saldo alto' },
}
const ESTADO = {
  pendiente: { lbl: 'Pendiente', bg: '#F1EFE8', fg: '#888780' },
  enviado: { lbl: 'Enviado', bg: C.verdeBg, fg: C.verde },
  pospuesto: { lbl: 'Pospuesto', bg: C.ambarBg, fg: C.ambar },
  investigar: { lbl: 'A investigar', bg: C.azulBg, fg: C.azul },
}
const badge = (o) => o ? <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: o.bg, color: o.fg, whiteSpace: 'nowrap' }}>{o.lbl}</span> : null
// Etiqueta de estado en la tabla: si está 'enviado', añade la fecha del envío (dd/mm) para que se vea de un vistazo.
const badgeEstado = (f) => {
  const o = ESTADO[f.estado]; if (!o) return null
  const txt = f.estado === 'enviado' && f.fecha_estado ? (o.lbl + ' ' + ddmm(String(f.fecha_estado).slice(0, 10))) : o.lbl
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: o.bg, color: o.fg, whiteSpace: 'nowrap' }}>{txt}</span>
}

const numV = (v) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d.-]/g, '')) || 0)
const DIF_COLS = [
  { key: 'idadmon', label: 'IDADMON', tipo: 'texto', fkey: f => f.idadmon || '', flabel: k => k || '(vacías)' },
  { key: 'arrendatario', label: 'Arrendatario', tipo: 'texto', fkey: f => f.arrendatario || '', flabel: k => k || '(vacías)' },
  { key: 'propiedad', label: 'Propiedad', tipo: 'texto', fkey: f => f.propiedad || '', flabel: k => k || '(vacías)' },
  { key: 'base', label: 'A cobrar', tipo: 'num', fkey: f => String(numV(f.base)), flabel: k => k === '' ? '(vacías)' : P(k) },
  { key: 'recibido', label: 'Recibido', tipo: 'num', fkey: f => String(numV(f.recibido)), flabel: k => k === '' ? '(vacías)' : P(k) },
  { key: 'pct_pagado', label: '% pag.', tipo: 'num', fkey: f => String(numV(f.pct_pagado)), flabel: k => k === '' ? '(vacías)' : (k + '%') },
  { key: 'diferencia', label: 'Diferencia', tipo: 'num', fkey: f => String(numV(f.diferencia)), flabel: k => k === '' ? '(vacías)' : P(k) },
  { key: 'saldo_acumulado', label: 'Saldo acum.', tipo: 'num', fkey: f => String(numV(f.saldo_acumulado)), flabel: k => k === '' ? '(vacías)' : P(k) },
  { key: 'reajuste', label: 'Reajuste', tipo: 'texto', fkey: f => f.reajuste_reciente ? 'Con reajuste' : 'Sin reajuste', flabel: k => k || '(vacías)' },
  { key: 'estado', label: 'Estado', tipo: 'texto', fkey: f => f.estado || 'pendiente', flabel: k => (ESTADO[k] && ESTADO[k].lbl) || k },
]

export default function DiferenciasView() {
  const [periodo, setPeriodo] = useState(''); const [inp, setInp] = useState('')
  const [data, setData] = useState(null); const [cargando, setCargando] = useState(true); const [error, setError] = useState('')
  const [dw, setDw] = useState(null)  // drawer

  const cargar = (p) => {
    setCargando(true); setError('')
    fetch('/api/cobranza/diferencias' + (p ? '?periodo=' + encodeURIComponent(p) : ''), { cache: 'no-store' })
      .then(r => r.json()).then(j => { if (j.error) setError(j.error); else { setData(j); setPeriodo(j.periodo); setInp(j.periodo) } })
      .catch(e => setError(String(e))).finally(() => setCargando(false))
  }
  useEffect(() => { cargar('') }, [])

  const [filters, setFilters] = useState({})
  const [openFilter, setOpenFilter] = useState(null)
  const [orden, setOrden] = useState(null)
  const setFiltroCol = (key, val) => setFilters(f => { const n = { ...f }; if (val == null) delete n[key]; else n[key] = val; return n })
  const limpiarTodo = () => { setFilters({}); setOrden(null) }
  const hayAlguno = DIF_COLS.some(c => filtroActivo(filters[c.key])) || !!orden?.key
  const _filas = data?.filas || []
  const filtradas = useMemo(() => aplicarFiltros(_filas, DIF_COLS, filters, orden), [_filas, filters, orden])
  const HF = (key) => (
    <HeaderFilter col={DIF_COLS.find(c => c.key === key)} movs={_filas}
      state={filters[key]} setState={v => setFiltroCol(key, v)}
      open={openFilter} setOpen={setOpenFilter} orden={orden} setOrden={setOrden}
      limpiarTodo={limpiarTodo} hayAlguno={hayAlguno} flotante />
  )
  const HFL = (key) => {
    const c = DIF_COLS.find(x => x.key === key)
    return (<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span>{c?.label}</span>{HF(key)}</span>)
  }

  const sustituir = (txt, f) => String(txt || '')
    .replaceAll('{{arrendatario}}', f.arrendatario || '').replaceAll('{{propiedad}}', f.propiedad || '')
    .replaceAll('{{mes}}', data?.mes_lbl || '').replaceAll('{{a_cobrar}}', P(f.base))
    .replaceAll('{{recibido}}', P(f.recibido)).replaceAll('{{diferencia}}', P(f.diferencia))
    .replaceAll('{{idadmon}}', f.idadmon || '')
    .replaceAll('{{reajuste}}', f.reajuste_reciente ? ('La diferencia se debe, muy probablemente, a la actualización (reajuste) de su arriendo aplicada el ' + ddmm(f.fecha_reajuste) + ', que quizá aún no estaba reflejada en su pago. ') : '')

  const abrir = (f) => {
    const pl = data.plantilla || { asunto: '', cuerpo: '' }
    setDw({ f, asunto: sustituir(pl.asunto, f), cuerpo: sustituir(pl.cuerpo, f), email: f.mail_arrendatario || '', cc: '', confirmar: false, enviando: false, msg: '' })
  }
  const enviar = async (test) => {
    const d = dw; setDw({ ...d, enviando: true, msg: '' })
    try {
      const r = await fetch('/api/cobranza/diferencias', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ accion: 'enviar', idadmon: d.f.idadmon, periodo, asunto: d.asunto, contenido: d.cuerpo, destino_email: d.email, cc: d.cc || '', diferencia: d.f.diferencia, test }) })
      const j = await r.json()
      if (j.error) { setDw({ ...d, enviando: false, msg: '⚠ ' + j.error }); return }
      if (test) { setDw({ ...d, enviando: false, msg: '✓ Prueba enviada a ti.' }); return }
      setDw(null); cargar(periodo)
    } catch (e) { setDw({ ...d, enviando: false, msg: '⚠ ' + String(e) }) }
  }
  const marcar = async (estado) => {
    const d = dw
    const r = await fetch('/api/cobranza/diferencias', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ accion: 'estado', idadmon: d.f.idadmon, periodo, estado, diferencia: d.f.diferencia }) })
    const j = await r.json(); if (j.error) { alert(j.error); return }
    setDw(null); cargar(periodo)
  }

  const th = { textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '.03em', padding: '8px 10px', borderBottom: '1px solid ' + C.line, whiteSpace: 'nowrap' }
  const thS = { ...th, position: 'sticky', top: 103, zIndex: 40, background: '#f4f6f9' }   // cabecera sticky bajo TopNav(52)+pestañas(51)
  const td = { fontSize: 13, color: C.txt, padding: '9px 10px', borderBottom: '1px solid #EFEDE6' }
  const numTd = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
  const rs = data?.resumen
  const inpS = { fontSize: 13, padding: '6px 8px', border: '1px solid ' + C.line, borderRadius: 8, width: '100%', boxSizing: 'border-box' }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>Diferencias / Recientes · saldo por cobrar</span>
        <span style={{ fontSize: 12, color: C.sub }}>· {data?.mes_lbl || '—'}{data?.hoy ? ' · al ' + ddmm(data.hoy) : ''}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <input value={inp} onChange={e => setInp(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} placeholder="AAMM" style={{ ...inpS, width: 72, textAlign: 'center' }} />
          <button onClick={() => cargar(inp)} style={{ fontSize: 13, fontWeight: 700, padding: '6px 12px', borderRadius: 8, border: '1px solid ' + C.line, background: '#fff', cursor: 'pointer' }}>Ver</button>
        </div>
      </div>

      <div style={{ background: C.azulBg, border: '1px solid #CFE0FF', borderRadius: 8, padding: '8px 12px', fontSize: 12.5, color: C.azul, marginBottom: 14 }}>
        <b>Pagó de menos, no es multa.</b> Pulsa una fila para ver el retrato del arrendatario y revisar/enviar un <b>recordatorio de saldo</b> suave. Marca cada uno como <b>enviado</b>, <b>pospuesto</b> o <b>a investigar</b>.
      </div>

      {cargando && <div style={{ color: C.sub, fontSize: 13, padding: 20 }}>Calculando diferencias…</div>}
      {error && <div style={{ color: C.rojo, background: C.rojoBg, border: '1px solid #F0CFCB', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>Error: {error}</div>}

      {!cargando && !error && data && (
        <>
          {rs && (<>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: (rs.enviados_resueltos && rs.enviados_resueltos.length) ? 6 : 14 }}>
              {[{ lab: 'Contratos', val: rs.total, col: C.txt }, { lab: 'Se escapa este mes', val: P(rs.suma_dif), col: C.rojo }, { lab: 'Saldo acumulado', val: P(rs.suma_acum), col: C.naranja }, { lab: 'Con reajuste reciente', val: rs.con_reajuste, col: C.azul }, { lab: 'Enviados', val: rs.enviados ?? 0, col: C.verde, sub: (rs.enviados_resueltos && rs.enviados_resueltos.length) ? (rs.enviados_en_lista + ' en lista · ' + rs.enviados_resueltos.length + ' ya pagó') : null }].map((k, i) => (
                <div key={i} style={{ border: '1px solid ' + C.line, borderRadius: 10, padding: '7px 13px', background: '#fff', minWidth: 100 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: C.sub, textTransform: 'uppercase', letterSpacing: '.03em' }}>{k.lab}</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: k.col }}>{k.val}</div>
                  {k.sub ? <div style={{ fontSize: 10, color: C.sub, marginTop: 1 }}>{k.sub}</div> : null}
                </div>
              ))}
            </div>
            {rs.enviados_resueltos && rs.enviados_resueltos.length ? (
              <div style={{ background: C.verdeBg, border: '1px solid #CBE6BE', borderRadius: 8, padding: '7px 12px', fontSize: 12, color: C.verde, marginBottom: 14 }}>
                También se envió recordatorio este mes a {rs.enviados_resueltos.length === 1 ? '1 contrato que ya regularizó' : rs.enviados_resueltos.length + ' contratos que ya regularizaron'} (fuera de la lista): {rs.enviados_resueltos.map(e => `${e.idadmon}${e.arrendatario ? ' · ' + e.arrendatario : ''} (${ddmm(String(e.fecha_estado || '').slice(0, 10))}${e.usuario ? ', ' + e.usuario : ''})`).join(' · ')}.
              </div>
            ) : null}
          </>)}

          {(!data.filas || !data.filas.length) ? (
            <div style={{ color: C.sub, fontSize: 13, padding: 20 }}>Nadie pagó de menos este periodo.</div>
          ) : (
            <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginBottom: 8 }}>
              {hayAlguno && <button onClick={limpiarTodo} style={{ padding: '6px 11px', borderRadius: 7, border: '1px solid ' + C.line, background: C.ambarBg, fontSize: 12, color: C.ambar, cursor: 'pointer', fontWeight: 700 }}>✕ Limpiar filtros</button>}
              <span style={{ fontSize: 12, color: C.sub }}>{filtradas.length} de {_filas.length}</span>
            </div>
            <div style={{ border: '1px solid ' + C.line, borderRadius: 10 }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 980 }}>
                <thead><tr>
                  <th style={thS}>{HFL('idadmon')}</th><th style={thS}>{HFL('arrendatario')}</th><th style={thS}>{HFL('propiedad')}</th>
                  <th style={{ ...thS, textAlign: 'right' }}>{HFL('base')}</th><th style={{ ...thS, textAlign: 'right' }}>{HFL('recibido')}</th>
                  <th style={{ ...thS, textAlign: 'right' }}>{HFL('pct_pagado')}</th><th style={{ ...thS, textAlign: 'right' }}>{HFL('diferencia')}</th>
                  <th style={{ ...thS, textAlign: 'right', background: C.naranjaBg }}>{HFL('saldo_acumulado')}</th><th style={thS}>{HFL('reajuste')}</th><th style={thS}>{HFL('estado')}</th>
                </tr></thead>
                <tbody>
                  {filtradas.length === 0 ? (
                    <tr><td colSpan={10} style={{ ...td, color: C.sub, padding: 16 }}>Sin resultados con estos filtros.</td></tr>
                  ) : filtradas.map(f => (
                    <tr key={f.idadmon} onClick={() => abrir(f)} style={{ cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background = '#FAF9F5'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ ...td, color: C.acento, fontWeight: 700 }}>{f.idadmon}</td>
                      <td style={td}>{f.arrendatario}</td>
                      <td style={{ ...td, maxWidth: 190, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={f.propiedad}>{f.propiedad}</td>
                      <td style={numTd}>{P(f.base)}</td>
                      <td style={numTd}>{P(f.recibido)}</td>
                      <td style={{ ...numTd, color: f.pct_pagado >= 90 ? C.verde : f.pct_pagado >= 60 ? C.ambar : C.rojo, fontWeight: 700 }}>{f.pct_pagado}%</td>
                      <td style={{ ...numTd, fontWeight: 800, color: C.rojo }}>{P(f.diferencia)}</td>
                      <td style={{ ...numTd, background: C.naranjaBg, color: f.saldo_acumulado > 0 ? C.naranja : C.verde, fontWeight: 700 }}>{P(f.saldo_acumulado)}</td>
                      <td style={td}>{f.reajuste_reciente ? <span style={{ fontSize: 11, fontWeight: 700, color: C.azul }} title={'último reajuste ' + ddmm(f.fecha_reajuste)}>reaj. {ddmm(f.fecha_reajuste)}</span> : <span style={{ color: C.sub }}>—</span>}</td>
                      <td style={td}>{badgeEstado(f)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </>
      )}

      {/* ── Drawer lateral ── */}
      {dw && (
        <div onClick={() => !dw.enviando && setDw(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.30)', zIndex: 9000 }}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 0, right: 0, height: '100%', width: 'min(500px, 96vw)', background: '#fff', boxShadow: '-8px 0 30px rgba(0,0,0,0.18)', overflowY: 'auto', padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>{dw.f.idadmon} · <span style={{ fontWeight: 600 }}>{dw.f.arrendatario}</span></h2>
              <button onClick={() => !dw.enviando && setDw(null)} style={{ border: 'none', background: 'transparent', fontSize: 20, color: '#9ca3af', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ fontSize: 12.5, color: C.sub, marginBottom: 12 }}>{dw.f.propiedad}</div>

            {/* Retrato */}
            <div style={{ background: '#F7F6F1', border: '1px solid ' + C.line, borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 12.5 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                {badge(PERFIL[dw.f.perfil])}
                {dw.f.reajuste_reciente ? <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: C.azulBg, color: C.azul }}>reajuste {ddmm(dw.f.fecha_reajuste)}</span> : null}
                {dw.f.deuda_servicios > 30000 ? <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: C.ambarBg, color: C.ambar }}>deuda servicios {P(dw.f.deuda_servicios)}</span> : null}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 14px' }}>
                <span>A cobrar ({data.mes_lbl}):</span><b style={{ textAlign: 'right' }}>{P(dw.f.base)}</b>
                <span>Recibido:</span><b style={{ textAlign: 'right' }}>{P(dw.f.recibido)} ({dw.f.pct_pagado}%)</b>
                <span style={{ color: C.rojo }}>Diferencia del mes:</span><b style={{ textAlign: 'right', color: C.rojo }}>{P(dw.f.diferencia)}</b>
                <span>Saldo acumulado (cartola):</span><b style={{ textAlign: 'right', color: dw.f.saldo_acumulado > 0 ? C.naranja : C.verde }}>{P(dw.f.saldo_acumulado)}</b>
                <span>Meses con deuda:</span><b style={{ textAlign: 'right' }}>{dw.f.perfil_metrics.meses_con_deuda}</b>
                <span>Día medio de pago:</span><b style={{ textAlign: 'right' }}>{dw.f.perfil_metrics.dia_medio ?? '—'}</b>
              </div>
            </div>

            {/* Email suave */}
            <div style={{ fontSize: 11.5, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 6 }}>Recordatorio de saldo (sale desde cobranza@)</div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11.5, color: C.sub, marginBottom: 3 }}>Email del arrendatario</div>
              <input value={dw.email} onChange={e => setDw({ ...dw, email: e.target.value })} style={inpS} />
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11.5, color: C.sub, marginBottom: 3 }}>Asunto</div>
              <input value={dw.asunto} onChange={e => setDw({ ...dw, asunto: e.target.value })} style={inpS} />
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11.5, color: C.sub, marginBottom: 3 }}>Cuerpo</div>
              <textarea value={dw.cuerpo} onChange={e => setDw({ ...dw, cuerpo: e.target.value })} rows={10} style={{ ...inpS, fontFamily: 'inherit', lineHeight: 1.5, resize: 'vertical' }} />
            </div>
            {dw.msg && <div style={{ fontSize: 12.5, color: dw.msg[0] === '✓' ? C.verde : C.rojo, marginBottom: 8 }}>{dw.msg}</div>}

            {dw.f.estado === 'enviado' && (
              <div style={{ background: C.ambarBg, border: '1px solid #E8D9A8', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: C.ambar, marginTop: 6, marginBottom: 2 }}>
                Ya se envió un recordatorio de este mes el <b>{ddmm(String(dw.f.fecha_estado || '').slice(0, 10))}</b>{dw.f.usuario ? ' (' + dw.f.usuario + ')' : ''}. Envía otro solo si es a propósito.
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              <button disabled={dw.enviando} onClick={() => setDw({ ...dw, confirmar: true, msg: '' })} style={{ fontSize: 12.5, fontWeight: 700, padding: '8px 12px', borderRadius: 8, border: '1px solid #CFE0FF', background: C.azulBg, color: C.azul, cursor: 'pointer' }}>Probar (a mí)…</button>
              <button disabled={dw.enviando} onClick={() => setDw({ ...dw, confirmar: true, msg: '' })} style={{ fontSize: 12.5, fontWeight: 800, padding: '8px 14px', borderRadius: 8, border: 'none', background: dw.f.estado === 'enviado' ? C.ambar : C.acento, color: '#fff', cursor: 'pointer' }}>{dw.f.estado === 'enviado' ? 'Enviar otro recordatorio…' : 'Enviar recordatorio…'}</button>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                <button disabled={dw.enviando} onClick={() => marcar('pospuesto')} style={{ fontSize: 12.5, fontWeight: 700, padding: '8px 12px', borderRadius: 8, border: '1px solid ' + C.line, background: '#fff', color: C.ambar, cursor: 'pointer' }}>Posponer</button>
                <button disabled={dw.enviando} onClick={() => marcar('investigar')} style={{ fontSize: 12.5, fontWeight: 700, padding: '8px 12px', borderRadius: 8, border: '1px solid ' + C.line, background: '#fff', color: C.azul, cursor: 'pointer' }}>A investigar</button>
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <RegistroGestion idadmon={dw.f.idadmon} arrendatario={dw.f.arrendatario} propietario={dw.f.propietario} inmueble={dw.f.propiedad} aval={dw.f.aval} deuda={dw.f.saldo_acumulado} onDone={() => cargar(periodo)} />
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmación antes de enviar ── */}
      {dw && dw.confirmar && (
        <div onClick={() => !dw.enviando && setDw({ ...dw, confirmar: false })} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, boxShadow: '0 18px 50px rgba(0,0,0,0.3)', width: 'min(560px, 96vw)', maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 2 }}>Revisa antes de enviar</div>
            <div style={{ fontSize: 12.5, color: C.sub, marginBottom: 14 }}>Este correo va a salir de verdad al arrendatario. Compruébalo, añade copias si quieres, y confirma.</div>
            <div style={{ display: 'grid', gap: 8, fontSize: 12.5 }}>
              <div><span style={{ color: C.sub }}>Para:</span> <b>{dw.email || '—'}</b></div>
              <div>
                <div style={{ color: C.sub, marginBottom: 3 }}>Con copia (CC · opcional — aval u otros, separa por comas)</div>
                <input value={dw.cc} onChange={e => setDw({ ...dw, cc: e.target.value })} placeholder={dw.f.aval ? ('aval: ' + dw.f.aval) : 'correo@ejemplo.com, otro@ejemplo.com'} style={inpS} />
              </div>
              <div><span style={{ color: C.sub }}>Asunto:</span> <b>{dw.asunto}</b></div>
              <div>
                <div style={{ color: C.sub, marginBottom: 3 }}>Cuerpo</div>
                <div style={{ background: '#F7F6F1', border: '1px solid ' + C.line, borderRadius: 8, padding: '10px 12px', whiteSpace: 'pre-wrap', lineHeight: 1.5, maxHeight: 220, overflowY: 'auto' }}>{dw.cuerpo}</div>
              </div>
              <div style={{ fontSize: 11.5, color: C.sub }}>Se envía una copia oculta a administración@fondocapital.com.</div>
              {dw.f.estado === 'enviado' && (
                <div style={{ background: C.ambarBg, border: '1px solid #E8D9A8', borderRadius: 8, padding: '8px 12px', marginTop: 4 }}>
                  <div style={{ fontSize: 12, color: C.ambar, marginBottom: 6 }}>⚠ Este arrendatario <b>ya recibió</b> un recordatorio de este mes el <b>{ddmm(String(dw.f.fecha_estado || '').slice(0, 10))}</b>{dw.f.usuario ? ' (' + dw.f.usuario + ')' : ''}.</div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: C.txt, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!dw.okReenvio} onChange={e => setDw({ ...dw, okReenvio: e.target.checked })} />
                    Sí, quiero enviar otro recordatorio a propósito.
                  </label>
                </div>
              )}
            </div>
            {dw.msg && <div style={{ fontSize: 12.5, color: dw.msg[0] === '✓' ? C.verde : C.rojo, marginTop: 10 }}>{dw.msg}</div>}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 16 }}>
              <button disabled={dw.enviando} onClick={() => setDw({ ...dw, confirmar: false, msg: '' })} style={{ fontSize: 12.5, fontWeight: 700, padding: '8px 14px', borderRadius: 8, border: '1px solid ' + C.line, background: '#fff', color: C.sub, cursor: 'pointer', marginRight: 'auto' }}>Volver a editar</button>
              <button disabled={dw.enviando} onClick={() => enviar(true)} style={{ fontSize: 12.5, fontWeight: 700, padding: '8px 14px', borderRadius: 8, border: '1px solid #CFE0FF', background: C.azulBg, color: C.azul, cursor: 'pointer' }}>{dw.enviando ? 'Enviando…' : 'Enviar prueba a mí'}</button>
              {(() => { const rein = dw.f.estado === 'enviado'; const off = dw.enviando || (rein && !dw.okReenvio); return (<button disabled={off} onClick={() => enviar(false)} style={{ fontSize: 12.5, fontWeight: 800, padding: '8px 16px', borderRadius: 8, border: 'none', background: off ? '#C9C7BE' : (rein ? C.ambar : C.acento), color: '#fff', cursor: off ? 'default' : 'pointer' }}>{dw.enviando ? 'Enviando…' : (rein ? 'Enviar otro' : 'Confirmar y enviar')}</button>) })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
