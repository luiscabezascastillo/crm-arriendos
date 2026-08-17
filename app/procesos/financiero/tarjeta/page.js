// RUTA: app/procesos/financiero/tarjeta/page.js
// VERSION: v1 · 2026-08-16 · Tarjeta de crédito Santander (…2494, cuenta 2105-18 propuesta). Arrastra
//   el PDF del estado de cuenta mensual y se cargan los movimientos (dedup por id_transaccion, así una
//   compra en cuotas no se duplica entre meses). Tabla con CCB, Cuenta contable y Comentario editables
//   (se guardan en el acto). Cargo del mes con su signo (compras +, pagos/NC −), cuota y divisa.
//   Dirección + editores.
'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import TopNav from '@/app/components/ui/TopNav'
import FinancieroNav from '@/app/components/ui/FinancieroNav'
import { parseTarjetaCredito } from '@/app/lib/parseTarjetaCredito'

const EDITORES = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']
const CCB = ['', 'CC1', 'CC2', 'CC3', 'BB1', 'BB2', 'GG']
const EXT = /\.pdf$/i
const clp = (n) => (n == null ? '' : Number(n).toLocaleString('es-CL'))
const fmtFecha = (iso) => { const x = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return x ? `${x[3]}/${x[2]}/${x[1]}` : (iso || '—') }
const fmtPeriodo = (p) => { const s = String(p || ''); return /^\d{4}$/.test(s) ? `${s.slice(2)}/20${s.slice(0, 2)}` : (s || '—') }

export default function TarjetaPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const canEdit = EDITORES.includes(session?.user?.email) || String(session?.user?.role || '').toLowerCase() === 'direccion'

  const [rows, setRows] = useState([])
  const [ed, setEd] = useState({})
  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [msg, setMsg] = useState(null)
  const [resumen, setResumen] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => { if (status === 'unauthenticated') router.push('/api/auth/signin') }, [status, router])

  const cargar = async () => {
    setCargando(true)
    try { const r = await fetch('/api/financiero/tarjeta'); const d = await r.json(); if (d.error) setMsg({ error: d.error }); else setRows(d.movimientos || []) }
    catch (e) { setMsg({ error: String(e?.message || e) }) }
    setCargando(false)
  }
  useEffect(() => { if (status === 'authenticated') cargar() }, [status]) // eslint-disable-line
  useEffect(() => { const m = {}; for (const f of rows) m[f.id] = { cuenta_contable: f.cuenta_contable || '', comentario: f.comentario || '' }; setEd(m) }, [rows])

  async function subir(files) {
    if (!canEdit) { setMsg({ error: 'No tienes permiso para cargar.' }); return }
    const file = Array.from(files || []).find(f => EXT.test(f.name))
    if (!file) { setMsg({ error: 'Sube el PDF del estado de cuenta de la tarjeta (.pdf).' }); return }
    setSubiendo(true); setMsg(null)
    try {
      const { movimientos, archivo, resumen: res } = await parseTarjetaCredito(file)
      if (!movimientos.length) { setMsg({ error: 'No encontré movimientos en el estado de cuenta.' }); setSubiendo(false); return }
      setResumen(res || null)
      const r = await fetch('/api/financiero/tarjeta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ movimientos, archivo }) })
      const d = await r.json()
      if (!r.ok) setMsg({ error: d.error || 'no se pudo cargar' })
      else setMsg({ text: `${d.insertados} nuevo(s), ${d.ya_estaban} ya estaban (${d.total_archivo} en el estado).` })
      await cargar()
    } catch (e) { setMsg({ error: String(e?.message || e) }) }
    setSubiendo(false)
  }

  useEffect(() => {
    const over = (e) => { if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) { e.preventDefault(); setDragOver(true) } }
    const leave = (e) => { if (e.clientX <= 0 && e.clientY <= 0) setDragOver(false) }
    const drop = (e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer?.files?.length) subir(e.dataTransfer.files) }
    window.addEventListener('dragover', over); window.addEventListener('dragleave', leave); window.addEventListener('drop', drop)
    return () => { window.removeEventListener('dragover', over); window.removeEventListener('dragleave', leave); window.removeEventListener('drop', drop) }
  }) // eslint-disable-line

  async function guardarCampo(id, campo, valor) {
    try {
      await fetch('/api/financiero/tarjeta', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, [campo]: valor }) })
      setRows(rs => rs.map(f => f.id === id ? { ...f, [campo]: valor } : f))
    } catch { /* silencioso */ }
  }

  if (status === 'loading') return (<><TopNav /><div style={{ padding: 60, textAlign: 'center', color: '#888' }}>Cargando…</div></>)
  const inp = { fontSize: 12, padding: '5px 7px', borderRadius: 6, border: '0.5px solid #E0DED6', boxSizing: 'border-box', width: '100%', background: canEdit ? '#fff' : '#F7F6F2' }
  const compras = rows.reduce((a, m) => a + (Number(m.monto) > 0 ? Number(m.monto) : 0), 0)
  const pagos = rows.reduce((a, m) => a + (Number(m.monto) < 0 ? Number(m.monto) : 0), 0)

  return (
    <>
      <TopNav />
      <FinancieroNav activo="tarjeta" />
      {dragOver && canEdit && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(29,158,117,0.10)', border: '3px dashed #1D9E75', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ background: '#fff', padding: '16px 26px', borderRadius: 12, fontSize: 15, fontWeight: 700, color: '#085041', boxShadow: '0 8px 30px rgba(0,0,0,0.15)' }}>⬆ Suelta el PDF del estado de cuenta</div>
        </div>
      )}
      <div style={{ maxWidth: 1360, margin: '0 auto', padding: '18px 24px 48px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1a1a2e' }}>Tarjeta de crédito <span style={{ fontSize: 13, fontWeight: 500, color: '#888780' }}>· Santander …2494 · cuenta 2105-18</span></h1>
            <div style={{ fontSize: 13, color: '#888780', marginTop: 2 }}>Estado de cuenta mensual. Arrastra el PDF y se cargan los movimientos (sin duplicar).</div>
          </div>
          {canEdit && (
            <div style={{ textAlign: 'right' }}>
              <button onClick={() => fileRef.current?.click()} disabled={subiendo}
                style={{ fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 8, border: 'none', background: subiendo ? '#B4D8CB' : '#1D9E75', color: '#fff', cursor: subiendo ? 'default' : 'pointer' }}>
                ⬆ {subiendo ? 'Leyendo…' : 'Cargar PDF'}
              </button>
              <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => { const fs = e.target.files; e.target.value = ''; if (fs?.length) subir(fs) }} />
              <div style={{ fontSize: 11, color: '#B4B2A9', marginTop: 4 }}>o arrástralo</div>
            </div>
          )}
        </div>

        {msg && (msg.text || msg.error) && (
          <div style={{ marginBottom: 12, fontSize: 12.5, padding: '9px 12px', borderRadius: 8, background: msg.error ? '#FBE9E7' : '#F3FBF8', border: `0.5px solid ${msg.error ? '#F0C9C2' : '#CDEBDF'}`, color: msg.error ? '#B23A3A' : '#085041' }}>
            {msg.text}{msg.text && msg.error ? ' · ' : ''}{msg.error}
          </div>
        )}

        {resumen && (resumen.monto_facturado != null || resumen.pagar_hasta) && (
          <div style={{ marginBottom: 12, fontSize: 12.5, padding: '9px 12px', borderRadius: 8, background: '#F7F6F2', border: '0.5px solid #E5E4DF', color: '#5A5954', display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            {resumen.periodo_facturado && <span>Período: <b>{resumen.periodo_facturado.desde} → {resumen.periodo_facturado.hasta}</b></span>}
            {resumen.monto_facturado != null && <span>Facturado a pagar: <b>${clp(resumen.monto_facturado)}</b></span>}
            {resumen.pagar_hasta && <span>Pagar hasta: <b>{resumen.pagar_hasta}</b></span>}
          </div>
        )}

        <div style={{ border: '0.5px solid #E0DED6', borderRadius: 10, overflow: 'auto', background: '#fff' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12.5, minWidth: 1180 }}>
            <thead>
              <tr style={{ background: '#F1EFE9', color: '#888780' }}>
                {['Período', 'Fecha', 'Lugar', 'Comercio', 'Cuota', 'Moneda', 'Cargo del mes', 'CCB', 'Cuenta contable', 'Comentario'].map((h, i) => (
                  <th key={i} style={{ padding: '9px 10px', fontWeight: 600, textAlign: i === 6 ? 'right' : 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cargando ? <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: '#888' }}>Cargando…</td></tr>
                : rows.length === 0 ? <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: '#888' }}>Aún no hay movimientos. Arrastra el PDF del estado de cuenta.</td></tr>
                  : rows.map(m => (
                    <tr key={m.id} style={{ borderTop: '0.5px solid #F0EFEA' }}>
                      <td style={{ padding: '6px 10px', whiteSpace: 'nowrap', color: '#888780' }}>{fmtPeriodo(m.periodo)}</td>
                      <td style={{ padding: '6px 10px', whiteSpace: 'nowrap', color: '#5A5954' }}>{fmtFecha(m.fecha)}</td>
                      <td style={{ padding: '6px 10px', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#5A5954' }} title={m.lugar}>{m.lugar || '—'}</td>
                      <td style={{ padding: '6px 10px', maxWidth: 230, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.descripcion}>{m.descripcion || '—'}</td>
                      <td style={{ padding: '6px 10px', whiteSpace: 'nowrap', color: '#888780', textAlign: 'center' }}>{m.n_cuota || ''}</td>
                      <td style={{ padding: '6px 10px', whiteSpace: 'nowrap', color: '#888780' }} title={m.monto_divisa ? `${m.moneda} ${m.monto_divisa}` : ''}>{m.moneda === 'USD' ? `USD${m.monto_divisa ? ' ' + m.monto_divisa : ''}` : ''}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: Number(m.monto) < 0 ? '#085041' : '#B23A3A' }}>{clp(m.monto)}</td>
                      <td style={{ padding: '5px 8px' }}>
                        <select value={m.ccb || ''} disabled={!canEdit} onChange={e => guardarCampo(m.id, 'ccb', e.target.value)} style={{ ...inp, width: 66, padding: '5px 4px' }}>
                          {CCB.map(c => <option key={c} value={c}>{c || '—'}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '5px 8px', minWidth: 140 }}>
                        <input value={ed[m.id]?.cuenta_contable ?? ''} disabled={!canEdit}
                          onChange={e => setEd(x => ({ ...x, [m.id]: { ...x[m.id], cuenta_contable: e.target.value } }))}
                          onBlur={() => guardarCampo(m.id, 'cuenta_contable', ed[m.id]?.cuenta_contable ?? '')}
                          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
                          placeholder={canEdit ? 'cuenta…' : ''} style={inp} />
                      </td>
                      <td style={{ padding: '5px 8px', minWidth: 190 }}>
                        <input value={ed[m.id]?.comentario ?? ''} disabled={!canEdit}
                          onChange={e => setEd(x => ({ ...x, [m.id]: { ...x[m.id], comentario: e.target.value } }))}
                          onBlur={() => guardarCampo(m.id, 'comentario', ed[m.id]?.comentario ?? '')}
                          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
                          placeholder={canEdit ? 'comentario…' : ''} style={inp} />
                      </td>
                    </tr>
                  ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr style={{ borderTop: '1px solid #E0DED6', background: '#F7F6F2', fontWeight: 700 }}>
                  <td colSpan={6} style={{ padding: '8px 10px' }}>Total ({rows.length} mov.) · compras {clp(compras)} · pagos/NC {clp(pagos)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{clp(compras + pagos)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <div style={{ fontSize: 11, color: '#B4B2A9', marginTop: 8 }}>
          La tarjeta es un <b>pasivo</b> (cuenta <b>2105-18</b>, a confirmar): cada compra es HABER tarjeta / DEBE gasto por su CCB; el pago del mes (“MONTO CANCELADO”) lo salda B. Santander contra el banco, así que no se duplica. Clasifica cada cargo con su CCB y cuenta.
        </div>
      </div>
    </>
  )
}
