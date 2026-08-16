// RUTA: app/procesos/financiero/sii/page.js
// VERSION: v2 · 2026-08-16 · SII · F29: vista TABLA (todos los meses juntos) + columna Comentario
//   editable (se guarda en observacion vía PATCH). Se alterna con la vista Lista+detalle.
// VERSION: v1 · 2026-08-16 · Módulo SII · F29. Arrastra (o sube) el PDF del F29 y se registra solo:
//   el lector (lib/parseF29) saca los códigos, cuadra 089+062+151=091 y lo guarda. Lista por período,
//   marca la vigente (rectificatoria sobre primitiva) y muestra el asiento contable sugerido.
//   Escritura: Dirección + Alberto/Luis/Karina.
'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import TopNav from '@/app/components/ui/TopNav'
import FinancieroNav from '@/app/components/ui/FinancieroNav'
import { parseF29PDF } from '@/app/lib/parseF29'

const EDITORES = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']
const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const clp = (n) => (n == null ? '—' : '$' + Number(n).toLocaleString('es-CL'))
const perLabel = (p) => { const s = String(p || ''); return s.length === 6 ? `${MESES[Number(s.slice(4))] || '?'} 20${s.slice(2, 4)}` : s }
const fmtFecha = (iso) => { const m = String(iso || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso || '—') }
const TIPO_LABEL = { primitiva: 'Primitiva', rectificatoria_con_giro: 'Rectificatoria c/giro', rectificatoria_sin_giro: 'Rectificatoria s/giro' }

export default function SiiF29Page() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const canEdit = EDITORES.includes(session?.user?.email) || String(session?.user?.role || '').toLowerCase() === 'direccion'

  const [lista, setLista] = useState([])
  const [sel, setSel] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [msg, setMsg] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [vista, setVista] = useState('lista')   // 'lista' | 'tabla'
  const [coments, setComents] = useState({})    // id -> texto del comentario (edición en la tabla)
  const fileRef = useRef(null)

  useEffect(() => { const m = {}; for (const f of lista) m[f.id] = f.observacion || ''; setComents(m) }, [lista])
  async function guardarComent(id) {
    try {
      await fetch('/api/financiero/sii', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, observacion: coments[id] ?? '' }) })
      setLista(ls => ls.map(f => f.id === id ? { ...f, observacion: coments[id] ?? '' } : f))
    } catch { /* silencioso */ }
  }

  useEffect(() => { if (status === 'unauthenticated') router.push('/api/auth/signin') }, [status, router])

  const cargar = async () => {
    setCargando(true)
    try {
      const r = await fetch('/api/financiero/sii')
      const d = await r.json()
      if (d.error) setMsg({ error: d.error }); else setLista(d.f29 || [])
    } catch (e) { setMsg({ error: String(e?.message || e) }) }
    setCargando(false)
  }
  useEffect(() => { if (status === 'authenticated') cargar() }, [status]) // eslint-disable-line

  async function subirUno(file) {
    const f = await parseF29PDF(file)
    if (f.avisos && f.avisos.length) return { archivo: file.name, error: f.avisos.join(' · ') }
    const res = await fetch('/api/financiero/sii', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ f29: f }) })
    const d = await res.json()
    if (!res.ok) return { archivo: file.name, error: d.error || 'no se pudo guardar' }
    return { archivo: file.name, ok: `${perLabel(d.periodo)} · folio ${d.folio}` }
  }

  async function subir(files) {
    if (!canEdit) { setMsg({ error: 'No tienes permiso para cargar F29.' }); return }
    const pdfs = Array.from(files || []).filter(f => /\.pdf$/i.test(f.name))
    if (!pdfs.length) { setMsg({ error: 'Arrastra el PDF del F29 (solo .pdf).' }); return }
    setSubiendo(true); setMsg(null)
    const oks = [], errs = []
    for (const file of pdfs) {
      try { const r = await subirUno(file); if (r.ok) oks.push(r.ok); else errs.push(`${r.archivo}: ${r.error}`) }
      catch (e) { errs.push(`${file.name}: ${String(e?.message || e)}`) }
    }
    setSubiendo(false)
    setMsg({ text: oks.length ? `Cargados: ${oks.join(' · ')}.` : null, error: errs.length ? `Con problemas: ${errs.join(' · ')}` : null })
    await cargar()
  }

  useEffect(() => {
    const over = (e) => { if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) { e.preventDefault(); setDragOver(true) } }
    const leave = (e) => { if (e.clientX <= 0 && e.clientY <= 0) setDragOver(false) }
    const drop = (e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer?.files?.length) subir(e.dataTransfer.files) }
    window.addEventListener('dragover', over); window.addEventListener('dragleave', leave); window.addEventListener('drop', drop)
    return () => { window.removeEventListener('dragover', over); window.removeEventListener('dragleave', leave); window.removeEventListener('drop', drop) }
  }) // eslint-disable-line

  if (status === 'loading') return (<><TopNav /><div style={{ padding: 60, textAlign: 'center', color: '#888' }}>Cargando…</div></>)

  const F = sel
  // asiento sugerido (cuadra: débito+PPM+retención = crédito+total)
  const asiento = F ? {
    debe: [
      ['2108-02', 'IVA Débito Fiscal', F.iva_debito],
      ['1108-01', 'Pagos Provisionales (PPM)', F.ppm],
      ['2108-04', 'Retención Profesionales', F.retencion_honorarios],
    ],
    haber: [
      ['1108-02', 'IVA Crédito Fiscal', F.iva_credito],
      ['2108-09', 'F29 POR PAGAR', F.total_a_pagar],
    ],
  } : null
  const sumDebe = asiento ? asiento.debe.reduce((a, r) => a + (Number(r[2]) || 0), 0) : 0
  const sumHaber = asiento ? asiento.haber.reduce((a, r) => a + (Number(r[2]) || 0), 0) : 0

  return (
    <>
      <TopNav />
      <FinancieroNav activo="sii" />
      {dragOver && canEdit && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(29,158,117,0.10)', border: '3px dashed #1D9E75', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ background: '#fff', padding: '16px 26px', borderRadius: 12, fontSize: 15, fontWeight: 700, color: '#085041', boxShadow: '0 8px 30px rgba(0,0,0,0.15)' }}>⬆ Suelta el/los PDF del F29</div>
        </div>
      )}

      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '18px 24px 48px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1a1a2e' }}>SII · F29</h1>
            <div style={{ fontSize: 13, color: '#888780', marginTop: 2 }}>Declaración mensual de IVA, PPM y retenciones. Arrastra el PDF y se registra solo.</div>
          </div>
          {canEdit && (
            <div>
              <button onClick={() => fileRef.current?.click()} disabled={subiendo}
                style={{ fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 8, border: 'none', background: subiendo ? '#B4D8CB' : '#1D9E75', color: '#fff', cursor: subiendo ? 'default' : 'pointer' }}>
                ⬆ {subiendo ? 'Leyendo…' : 'Cargar F29 (PDF)'}
              </button>
              <input ref={fileRef} type="file" accept=".pdf" multiple style={{ display: 'none' }}
                onChange={e => { const fs = e.target.files; e.target.value = ''; if (fs?.length) subir(fs) }} />
              <div style={{ fontSize: 11, color: '#B4B2A9', marginTop: 4, textAlign: 'right' }}>o arrastra varios a la vez</div>
            </div>
          )}
        </div>

        {msg && (msg.text || msg.error) && (
          <div style={{ marginBottom: 12, fontSize: 12.5, padding: '9px 12px', borderRadius: 8, background: msg.error ? '#FBE9E7' : '#F3FBF8', border: `0.5px solid ${msg.error ? '#F0C9C2' : '#CDEBDF'}`, color: msg.error ? '#B23A3A' : '#085041' }}>
            {msg.text}{msg.text && msg.error ? ' · ' : ''}{msg.error}
          </div>
        )}

        {/* Selector de vista */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {[['lista', 'Lista + detalle'], ['tabla', 'Tabla (todos)']].map(([v, lbl]) => (
            <button key={v} onClick={() => setVista(v)}
              style={{ fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: '0.5px solid #D3D1C7', cursor: 'pointer', background: vista === v ? '#1D9E75' : '#fff', color: vista === v ? '#fff' : '#2C2C2A' }}>{lbl}</button>
          ))}
        </div>

        {vista === 'tabla' && (
          <div style={{ border: '0.5px solid #E0DED6', borderRadius: 10, overflow: 'auto', background: '#fff' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12.5, minWidth: 1000 }}>
              <thead>
                <tr style={{ background: '#F1EFE9', color: '#888780', textAlign: 'right' }}>
                  {['Período', 'Tipo', 'Folio', 'Fecha', 'IVA a pagar', 'PPM', 'Retención', 'Total a pagar', 'Comentario'].map((h, i) => (
                    <th key={h} style={{ padding: '9px 10px', fontWeight: 600, textAlign: i < 4 || i === 8 ? 'left' : 'right', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cargando ? <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: '#888' }}>Cargando…</td></tr>
                  : lista.length === 0 ? <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: '#888' }}>Aún no hay F29. Arrastra los PDF.</td></tr>
                    : lista.map(f => (
                      <tr key={f.id} style={{ borderTop: '0.5px solid #F0EFEA', background: f.vigente ? '#fff' : '#FAFAF7', opacity: f.vigente ? 1 : 0.62 }}>
                        <td style={{ padding: '7px 10px', fontWeight: 600, color: '#0C447C', whiteSpace: 'nowrap' }}>{perLabel(f.periodo)}</td>
                        <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 10, background: f.tipo_declaracion === 'primitiva' ? '#EEF3F8' : '#FDF6E3', color: f.tipo_declaracion === 'primitiva' ? '#0C447C' : '#9A6E00' }}>{TIPO_LABEL[f.tipo_declaracion] || f.tipo_declaracion}</span>
                          {!f.vigente && <span style={{ marginLeft: 5, fontSize: 10, color: '#B4B2A9' }}>reemplazada</span>}
                        </td>
                        <td style={{ padding: '7px 10px', color: '#888780', whiteSpace: 'nowrap' }}>{f.folio}</td>
                        <td style={{ padding: '7px 10px', color: '#888780', whiteSpace: 'nowrap' }}>{fmtFecha(f.fecha_presentacion)}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{clp(f.iva_a_pagar)}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{clp(f.ppm)}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{clp(f.retencion_honorarios)}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{clp(f.total_a_pagar)}</td>
                        <td style={{ padding: '5px 10px', minWidth: 220 }}>
                          <input value={coments[f.id] ?? ''} disabled={!canEdit}
                            onChange={e => setComents(c => ({ ...c, [f.id]: e.target.value }))}
                            onBlur={() => guardarComent(f.id)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur() } }}
                            placeholder={canEdit ? 'comentario…' : ''}
                            style={{ width: '100%', fontSize: 12, padding: '5px 7px', borderRadius: 6, border: '0.5px solid #E0DED6', boxSizing: 'border-box', background: canEdit ? '#fff' : '#F7F6F2' }} />
                        </td>
                      </tr>
                    ))}
              </tbody>
              {lista.length > 0 && (
                <tfoot>
                  <tr style={{ borderTop: '1px solid #E0DED6', background: '#F7F6F2', fontWeight: 700 }}>
                    <td style={{ padding: '8px 10px' }} colSpan={4}>Total (declaraciones vigentes)</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{clp(lista.filter(f => f.vigente).reduce((a, f) => a + (Number(f.iva_a_pagar) || 0), 0))}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{clp(lista.filter(f => f.vigente).reduce((a, f) => a + (Number(f.ppm) || 0), 0))}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{clp(lista.filter(f => f.vigente).reduce((a, f) => a + (Number(f.retencion_honorarios) || 0), 0))}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{clp(lista.filter(f => f.vigente).reduce((a, f) => a + (Number(f.total_a_pagar) || 0), 0))}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {vista === 'lista' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
          {/* Lista */}
          <div style={{ border: '0.5px solid #E0DED6', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 88px 110px 22px', background: '#F1EFE9', padding: '9px 12px', fontSize: 11, fontWeight: 600, color: '#888780' }}>
              <div>Período · tipo</div><div>Folio</div><div style={{ textAlign: 'right' }}>Total a pagar</div><div />
            </div>
            {cargando ? <div style={{ padding: 24, textAlign: 'center', color: '#888' }}>Cargando…</div>
              : lista.length === 0 ? <div style={{ padding: 24, textAlign: 'center', color: '#888', fontSize: 13 }}>Aún no hay F29. Arrastra los PDF.</div>
                : lista.map(f => (
                  <div key={f.id} onClick={() => setSel(f)}
                    style={{ display: 'grid', gridTemplateColumns: '1fr 88px 110px 22px', padding: '9px 12px', fontSize: 13, borderTop: '0.5px solid #F0EFEA', cursor: 'pointer', alignItems: 'center', background: sel?.id === f.id ? '#F3FBF8' : (f.vigente ? '#fff' : '#FAFAF7'), opacity: f.vigente ? 1 : 0.62 }}>
                    <div>
                      <span style={{ fontWeight: 600, color: '#0C447C' }}>{perLabel(f.periodo)}</span>
                      <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 10, background: f.tipo_declaracion === 'primitiva' ? '#EEF3F8' : '#FDF6E3', color: f.tipo_declaracion === 'primitiva' ? '#0C447C' : '#9A6E00' }}>{TIPO_LABEL[f.tipo_declaracion] || f.tipo_declaracion}</span>
                      {!f.vigente && <span style={{ marginLeft: 6, fontSize: 10, color: '#B4B2A9' }}>reemplazada</span>}
                    </div>
                    <div style={{ color: '#888780', fontSize: 11 }}>{f.folio}</div>
                    <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{clp(f.total_a_pagar)}</div>
                    <div style={{ textAlign: 'center', color: '#B4B2A9' }}>{sel?.id === f.id ? '▸' : ''}</div>
                  </div>
                ))}
          </div>

          {/* Detalle + asiento */}
          <div style={{ border: '0.5px solid #E0DED6', borderRadius: 10, background: '#fff', padding: F ? '14px 16px' : 0, minHeight: 120 }}>
            {!F ? <div style={{ padding: 24, textAlign: 'center', color: '#B4B2A9', fontSize: 13 }}>Elige un F29 para ver el detalle y el asiento.</div>
              : (<>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>{perLabel(F.periodo)} · <span style={{ fontWeight: 500, color: '#888780' }}>{TIPO_LABEL[F.tipo_declaracion]}</span></div>
                  <div style={{ fontSize: 11, color: '#888780' }}>Folio {F.folio} · {fmtFecha(F.fecha_presentacion)}</div>
                </div>
                {F.corrige_folio && <div style={{ fontSize: 11, color: '#9A6E00', marginBottom: 8 }}>Corrige al folio {F.corrige_folio}</div>}

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 12 }}>
                  <tbody>
                    {[['IVA a pagar (089)', F.iva_a_pagar], ['PPM (062)', F.ppm], ['Retención honorarios (151)', F.retencion_honorarios]].map(([l, v]) => (
                      <tr key={l} style={{ borderBottom: '0.5px solid #F0EFEA' }}>
                        <td style={{ padding: '5px 0', color: '#5A5954' }}>{l}</td>
                        <td style={{ padding: '5px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{clp(v)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td style={{ padding: '7px 0', fontWeight: 700 }}>Total a pagar (091)</td>
                      <td style={{ padding: '7px 0', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{clp(F.total_a_pagar)}</td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ fontSize: 11, color: '#888780', marginBottom: 10 }}>
                  IVA débito {clp(F.iva_debito)} − crédito {clp(F.iva_credito)} · base PPM {clp(F.ppm_base)} (tasa {F.ppm_tasa}%) · pagado por {F.banco || '—'} ({F.medio_pago || '—'})
                </div>

                {/* Asiento sugerido */}
                <div style={{ fontSize: 11, fontWeight: 700, color: '#085041', marginBottom: 4 }}>Asiento sugerido</div>
                <div style={{ border: '0.5px solid #E0DED6', borderRadius: 8, overflow: 'hidden', fontSize: 12 }}>
                  {asiento.debe.map((r, i) => (
                    <div key={'d' + i} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 110px', padding: '4px 9px', borderBottom: '0.5px solid #F3F2ED' }}>
                      <div style={{ fontWeight: 700, color: '#B23A3A' }}>DEBE</div>
                      <div><b>{r[0]}</b> {r[1]}</div>
                      <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{clp(r[2])}</div>
                    </div>
                  ))}
                  {asiento.haber.map((r, i) => (
                    <div key={'h' + i} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 110px', padding: '4px 9px', borderBottom: '0.5px solid #F3F2ED', background: '#FCFCFA' }}>
                      <div style={{ fontWeight: 700, color: '#085041', paddingLeft: 10 }}>HABER</div>
                      <div style={{ paddingLeft: 10 }}><b>{r[0]}</b> {r[1]}</div>
                      <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{clp(r[2])}</div>
                    </div>
                  ))}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', padding: '5px 9px', background: '#F7F6F2', fontSize: 11 }}>
                    <div style={{ color: sumDebe === sumHaber ? '#085041' : '#B23A3A', fontWeight: 600 }}>{sumDebe === sumHaber ? '✓ cuadra' : '✗ no cuadra'}</div>
                    <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#888780' }}>{clp(sumDebe)}</div>
                  </div>
                </div>
                <div style={{ fontSize: 10.5, color: '#B4B2A9', marginTop: 6 }}>
                  Y al pagarlo (cargo en Banco Santander): DEBE <b>2108-09</b> F29 POR PAGAR / HABER <b>1101-05</b> Banco, {clp(F.total_a_pagar)}.
                  {F.tipo_declaracion !== 'primitiva' && ' Ojo: si la primitiva ya se asentó, esta rectificatoria se asienta por la DIFERENCIA.'}
                </div>
              </>)}
          </div>
        </div>
        )}
      </div>
    </>
  )
}
