// VERSION: 2026-08-26 · Añadido "← Volver" (BotonVolver, history.back) — convención de retorno. Hereda versión previa.
// RUTA: app/procesos/financiero/facturas-int/page.js
// VERSION: v1 · 2026-08-16 · Facturas Internacionales (servicios del exterior). Arrastra el PDF y
//   crea una línea (lector parseFacturaInternacional). Tabla con Cuenta contable y Comentario
//   editables (se guardan en el acto). CCB por defecto CC1 (Fabiola), editable. Dirección + editores.
'use client'

import { useSession } from 'next-auth/react'
import BotonVolver from '../../../components/ui/BotonVolver'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import TopNav from '@/app/components/ui/TopNav'
import FinancieroNav from '@/app/components/ui/FinancieroNav'
import { parseFacturaInternacionalPDF } from '@/app/lib/parseFacturaInternacional'

const EDITORES = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']
const CCB = ['CC1', 'CC2', 'CC3', 'BB1', 'BB2', 'GG']
const money = (n, m) => (n == null ? '—' : `${m || ''} ${Number(n).toLocaleString('es-CL')}`.trim())
const fmtFecha = (iso) => { const x = String(iso || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/); return x ? `${x[3]}/${x[2]}/${x[1]}` : (iso || '—') }
const perLabel = (p) => { const s = String(p || ''); const M = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']; return s.length === 4 ? `${M[Number(s.slice(2))] || '?'} 20${s.slice(0, 2)}` : s }

export default function FacturasIntPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const canEdit = EDITORES.includes(session?.user?.email) || String(session?.user?.role || '').toLowerCase() === 'direccion'

  const [rows, setRows] = useState([])
  const [ed, setEd] = useState({})     // id -> {cuenta_contable, comentario} en edición
  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [msg, setMsg] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => { if (status === 'unauthenticated') router.push('/api/auth/signin') }, [status, router])

  const cargar = async () => {
    setCargando(true)
    try { const r = await fetch('/api/financiero/facturas-int'); const d = await r.json(); if (d.error) setMsg({ error: d.error }); else setRows(d.facturas || []) }
    catch (e) { setMsg({ error: String(e?.message || e) }) }
    setCargando(false)
  }
  useEffect(() => { if (status === 'authenticated') cargar() }, [status]) // eslint-disable-line
  useEffect(() => { const m = {}; for (const f of rows) m[f.id] = { cuenta_contable: f.cuenta_contable || '', comentario: f.comentario || '' }; setEd(m) }, [rows])

  async function subir(files) {
    if (!canEdit) { setMsg({ error: 'No tienes permiso para cargar.' }); return }
    const pdfs = Array.from(files || []).filter(f => /\.pdf$/i.test(f.name))
    if (!pdfs.length) { setMsg({ error: 'Arrastra el PDF de la factura (.pdf).' }); return }
    setSubiendo(true); setMsg(null)
    const oks = [], errs = []
    for (const file of pdfs) {
      try {
        const f = await parseFacturaInternacionalPDF(file)
        if (f.avisos?.length) { errs.push(`${file.name}: ${f.avisos.join(', ')}`); continue }
        const res = await fetch('/api/financiero/facturas-int', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ factura: f }) })
        const d = await res.json()
        if (!res.ok) errs.push(`${file.name}: ${d.error || 'no se pudo guardar'}`)
        else oks.push(`#${d.numero}${d.actualizada ? ' (actualizada)' : ''}`)
      } catch (e) { errs.push(`${file.name}: ${String(e?.message || e)}`) }
    }
    setSubiendo(false)
    setMsg({ text: oks.length ? `Cargadas: ${oks.join(' · ')}.` : null, error: errs.length ? `Con problemas: ${errs.join(' · ')}` : null })
    await cargar()
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
      await fetch('/api/financiero/facturas-int', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, [campo]: valor }) })
      setRows(rs => rs.map(f => f.id === id ? { ...f, [campo]: valor } : f))
    } catch { /* silencioso */ }
  }

  if (status === 'loading') return (<><TopNav /><div style={{ padding: 60, textAlign: 'center', color: '#888' }}>Cargando…</div></>)
  const inp = { fontSize: 12, padding: '5px 7px', borderRadius: 6, border: '0.5px solid #E0DED6', boxSizing: 'border-box', width: '100%', background: canEdit ? '#fff' : '#F7F6F2' }
  const totalUSD = rows.reduce((a, f) => a + (f.moneda === 'USD' ? Number(f.importe) || 0 : 0), 0)

  return (
    <>
      <TopNav />
      <BotonVolver />
      <FinancieroNav activo="facturas-int" />
      {dragOver && canEdit && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(29,158,117,0.10)', border: '3px dashed #1D9E75', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ background: '#fff', padding: '16px 26px', borderRadius: 12, fontSize: 15, fontWeight: 700, color: '#085041', boxShadow: '0 8px 30px rgba(0,0,0,0.15)' }}>⬆ Suelta el/los PDF de la factura</div>
        </div>
      )}
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '18px 24px 48px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1a1a2e' }}>Facturas Internacionales</h1>
            <div style={{ fontSize: 13, color: '#888780', marginTop: 2 }}>Servicios del exterior. Arrastra el PDF y se crea la línea.</div>
          </div>
          {canEdit && (
            <div style={{ textAlign: 'right' }}>
              <button onClick={() => fileRef.current?.click()} disabled={subiendo}
                style={{ fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 8, border: 'none', background: subiendo ? '#B4D8CB' : '#1D9E75', color: '#fff', cursor: subiendo ? 'default' : 'pointer' }}>
                ⬆ {subiendo ? 'Leyendo…' : 'Cargar factura (PDF)'}
              </button>
              <input ref={fileRef} type="file" accept=".pdf" multiple style={{ display: 'none' }} onChange={e => { const fs = e.target.files; e.target.value = ''; if (fs?.length) subir(fs) }} />
              <div style={{ fontSize: 11, color: '#B4B2A9', marginTop: 4 }}>o arrastra varias a la vez</div>
            </div>
          )}
        </div>

        {msg && (msg.text || msg.error) && (
          <div style={{ marginBottom: 12, fontSize: 12.5, padding: '9px 12px', borderRadius: 8, background: msg.error ? '#FBE9E7' : '#F3FBF8', border: `0.5px solid ${msg.error ? '#F0C9C2' : '#CDEBDF'}`, color: msg.error ? '#B23A3A' : '#085041' }}>
            {msg.text}{msg.text && msg.error ? ' · ' : ''}{msg.error}
          </div>
        )}

        <div style={{ border: '0.5px solid #E0DED6', borderRadius: 10, overflow: 'auto', background: '#fff' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12.5, minWidth: 1120 }}>
            <thead>
              <tr style={{ background: '#F1EFE9', color: '#888780' }}>
                {['Fecha', 'N°', 'Proveedor', 'Período', 'Descripción', 'Importe', 'CCB', 'Cuenta contable', 'Comentario', ''].map((h, i) => (
                  <th key={i} style={{ padding: '9px 10px', fontWeight: 600, textAlign: i === 5 ? 'right' : 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cargando ? <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: '#888' }}>Cargando…</td></tr>
                : rows.length === 0 ? <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: '#888' }}>Aún no hay facturas. Arrastra los PDF.</td></tr>
                  : rows.map(f => (
                    <tr key={f.id} style={{ borderTop: '0.5px solid #F0EFEA' }}>
                      <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{fmtFecha(f.fecha)}</td>
                      <td style={{ padding: '6px 10px', fontWeight: 600, color: '#0C447C' }}>{f.numero}</td>
                      <td style={{ padding: '6px 10px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.proveedor}>{f.proveedor || '—'}</td>
                      <td style={{ padding: '6px 10px', whiteSpace: 'nowrap', color: '#5A5954' }}>{perLabel(f.periodo)}</td>
                      <td style={{ padding: '6px 10px', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#5A5954' }} title={f.descripcion}>{f.descripcion || '—'}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, whiteSpace: 'nowrap' }}>{money(f.importe, f.moneda)}</td>
                      <td style={{ padding: '5px 8px' }}>
                        <select value={f.ccb || 'CC1'} disabled={!canEdit} onChange={e => guardarCampo(f.id, 'ccb', e.target.value)}
                          style={{ ...inp, width: 70, padding: '5px 4px' }}>
                          {CCB.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '5px 8px', minWidth: 150 }}>
                        <input value={ed[f.id]?.cuenta_contable ?? ''} disabled={!canEdit}
                          onChange={e => setEd(m => ({ ...m, [f.id]: { ...m[f.id], cuenta_contable: e.target.value } }))}
                          onBlur={() => guardarCampo(f.id, 'cuenta_contable', ed[f.id]?.cuenta_contable ?? '')}
                          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
                          placeholder={canEdit ? 'cuenta…' : ''} style={inp} />
                      </td>
                      <td style={{ padding: '5px 8px', minWidth: 200 }}>
                        <input value={ed[f.id]?.comentario ?? ''} disabled={!canEdit}
                          onChange={e => setEd(m => ({ ...m, [f.id]: { ...m[f.id], comentario: e.target.value } }))}
                          onBlur={() => guardarCampo(f.id, 'comentario', ed[f.id]?.comentario ?? '')}
                          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
                          placeholder={canEdit ? 'comentario…' : ''} style={inp} />
                      </td>
                      <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                        {canEdit && <button onClick={async () => { if (window.confirm(`¿Borrar la factura #${f.numero}?`)) { await fetch('/api/financiero/facturas-int?id=' + f.id, { method: 'DELETE' }); cargar() } }}
                          title="Borrar" style={{ border: '0.5px solid #E7C9C4', background: '#fff', color: '#B23A3A', borderRadius: 5, cursor: 'pointer', fontSize: 13, padding: '2px 7px' }}>×</button>}
                      </td>
                    </tr>
                  ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr style={{ borderTop: '1px solid #E0DED6', background: '#F7F6F2', fontWeight: 700 }}>
                  <td colSpan={5} style={{ padding: '8px 10px' }}>Total ({rows.length} facturas)</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>USD {totalUSD.toLocaleString('es-CL')}</td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <div style={{ fontSize: 11, color: '#B4B2A9', marginTop: 8 }}>
          Nota: son servicios del exterior. Si en algún momento aplica impuesto adicional (art. 59 LIR) por servicios prestados fuera de Chile, se registra aparte; hoy el módulo solo deja constancia de la factura, su cuenta y el CCB.
        </div>
      </div>
    </>
  )
}
