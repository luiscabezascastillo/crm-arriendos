// VERSION: v1 · 2026-07-13 · Vista Caja Chica (Financiero): continua/mensual, saldo + línea de apertura, recientes abajo, barra+cabecera fijas, filtros Excel, cargar (subir/arrastrar/pegar), CCB editable.
'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo, useRef } from 'react'
import TopNav from '@/app/components/ui/TopNav'

const EDITORES = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']
const CCB_SUGERIDOS = ['CC1', 'CC2', 'CC3', 'BB1', 'BB2', 'GG']

const clp = (n) => (n == null ? '—' : Number(n).toLocaleString('es-CL'))
const fmtFecha = (iso) => { if (!iso) return ''; const [y, m, d] = String(iso).slice(0, 10).split('-'); return `${d}/${m}/${y}` }
const mesLabel = (m) => { if (!m) return ''; const [y, mm] = m.split('-'); const N = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']; return `${N[Number(mm)] || mm} ${y}` }

function fechaISO(v) {
  if (v == null || v === '') return null
  if (v instanceof Date && !isNaN(v)) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`
  const s = String(v).trim()
  let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/); if (m) return `${m[3]}-${m[2]}-${m[1]}`
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`
  return null
}

// Lee el libro de Caja Chica. Solo movimientos de 2026 en adelante. Guarda el Saldo Final tal cual.
async function parseCajaChica(file, XLSX) {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: false })
  let hi = -1
  for (let i = 0; i < rows.length; i++) {
    const hh = (rows[i] || []).map(c => String(c == null ? '' : c).trim().toUpperCase())
    if (hh.some(h => h.includes('SALDO')) && hh.some(h => h.includes('MONTO INICIAL'))) { hi = i; break }
  }
  if (hi < 0) throw new Error('No encontré la cabecera (Monto inicial / Saldo Final). ¿Es el libro de Caja Chica?')
  const H = rows[hi].map(c => String(c == null ? '' : c).trim().toUpperCase())
  const idxHas = (...subs) => H.findIndex(h => subs.every(s => h.includes(s.toUpperCase())))
  const C = {
    ini: idxHas('MONTO', 'INICIAL'), fecha: (idxHas('GESTI') >= 0 ? idxHas('GESTI') : idxHas('DÍA')), detalle: idxHas('DOCUMENTOS'),
    pagado: idxHas('MONTO', 'PAGADO'), recibido: idxHas('RECIBIDO'), ndoc: (idxHas('BOLETA') >= 0 ? idxHas('BOLETA') : idxHas('TRANSFER')), saldo: idxHas('SALDO', 'FINAL'),
  }
  const num = (x) => { if (x == null || x === '') return null; const n = Number(x); return isNaN(n) ? null : Math.round(n) }
  const cl = (x) => { if (x == null) return null; const s = String(x).trim(); return (s === '' || s === 'nan') ? null : s }
  const g = (r, i) => i >= 0 ? r[i] : null
  const movimientos = []
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i] || []
    const fecha = fechaISO(g(r, C.fecha))
    if (!fecha || Number(fecha.slice(0, 4)) < 2026) continue
    const orden = num(r[0])
    const pagado = num(g(r, C.pagado)) || 0; const recibido = num(g(r, C.recibido)) || 0
    movimientos.push({ orden, fecha, detalle: cl(g(r, C.detalle)), pagado, recibido, monto: recibido - pagado, n_documento: cl(g(r, C.ndoc)), saldo: num(g(r, C.saldo)), mes: fecha.slice(0, 7) })
  }
  return { archivo: file.name, movimientos }
}

const COLDEFS = [
  { key: 'fecha', label: 'Fecha', w: '92px', align: 'left', get: v => fmtFecha(v.fecha), filter: 'list' },
  { key: 'detalle', label: 'Detalle', w: '1fr', align: 'left', get: v => v.detalle || '', filter: 'text' },
  { key: 'n_documento', label: 'N° Doc', w: '128px', align: 'left', get: v => v.n_documento || '', filter: 'text' },
  { key: 'pagado', label: 'Pagado', w: '98px', align: 'right', get: v => v.pagado, filter: null },
  { key: 'recibido', label: 'Recibido', w: '98px', align: 'right', get: v => v.recibido, filter: null },
  { key: 'saldo', label: 'Saldo', w: '106px', align: 'right', get: v => v.saldo, filter: null },
  { key: 'ccb', label: 'CCB', w: '74px', align: 'left', get: v => v.ccb || '', filter: 'list' },
]
const GRID = COLDEFS.map(c => c.w).join(' ')

function CcbChip({ ccb }) {
  if (!ccb) return <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#FBE9E7', color: '#B23A3A' }}>revisar</span>
  return <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#EEF3F8', color: '#0C447C' }}>{ccb}</span>
}
function Card({ label, value, color }) {
  return (<div style={{ background: '#fff', border: '0.5px solid #E0DED6', borderRadius: 10, padding: '10px 14px', minWidth: 108, flex: '1 1 auto' }}>
    <div style={{ fontSize: 11, color: '#888780', marginBottom: 3 }}>{label}</div><div style={{ fontSize: 18, fontWeight: 700, color: color || '#2C2C2A' }}>{value}</div></div>)
}
function HeaderFilter({ col, movs, state, setState, open, setOpen }) {
  const active = state && (state.text || (state.sel && state.sel.length))
  const distinct = useMemo(() => { if (col.filter !== 'list') return []; const s = new Set(); for (const m of movs) s.add(String(col.get(m))); return Array.from(s).sort() }, [movs, col])
  const s = state || { text: '', sel: [] }
  const toggle = (v) => { const sel = s.sel.includes(v) ? s.sel.filter(x => x !== v) : [...s.sel, v]; setState({ ...s, sel }) }
  return (
    <span style={{ position: 'relative', marginLeft: 4 }}>
      <button onClick={(e) => { e.stopPropagation(); setOpen(open === col.key ? null : col.key) }} title="Filtrar" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: active ? '#1D9E75' : '#B4B2A9', fontSize: 11, padding: 0 }}>▼</button>
      {open === col.key && (<>
        <div onClick={() => setOpen(null)} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
        <div style={{ position: 'absolute', top: 18, left: 0, zIndex: 31, background: '#fff', border: '0.5px solid #D3D1C7', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,0.14)', padding: 10, width: 220, textAlign: 'left', fontWeight: 400 }}>
          <input value={s.text} onChange={e => setState({ ...s, text: e.target.value })} placeholder="Contiene…" autoFocus style={{ width: '100%', fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '0.5px solid #D3D1C7', boxSizing: 'border-box', marginBottom: 8 }} />
          {col.filter === 'list' && distinct.length <= 40 && (<>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 5 }}>
              <button onClick={() => setState({ ...s, sel: distinct.slice() })} style={{ border: 'none', background: 'transparent', color: '#0C447C', cursor: 'pointer', padding: 0 }}>Todos</button>
              <button onClick={() => setState({ ...s, sel: [] })} style={{ border: 'none', background: 'transparent', color: '#888780', cursor: 'pointer', padding: 0 }}>Limpiar</button>
            </div>
            <div style={{ maxHeight: 180, overflowY: 'auto' }}>
              {distinct.map(v => (<label key={v} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '3px 0', cursor: 'pointer' }}>
                <input type="checkbox" checked={s.sel.includes(v)} onChange={() => toggle(v)} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v === '' ? '(vacío)' : v}</span></label>))}
            </div></>)}
          {active ? <button onClick={() => { setState({ text: '', sel: [] }); setOpen(null) }} style={{ marginTop: 8, width: '100%', fontSize: 12, padding: '5px', borderRadius: 6, border: '0.5px solid #D3D1C7', background: '#F7F6F2', cursor: 'pointer' }}>Quitar filtro</button> : null}
        </div></>)}
    </span>
  )
}

export default function CajaChicaPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isMobile, setIsMobile] = useState(false)
  const [modo, setModo] = useState('continua')
  const [meses, setMeses] = useState([]); const [mesSel, setMesSel] = useState(null)
  const [movimientos, setMovimientos] = useState([]); const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({}); const [openFilter, setOpenFilter] = useState(null)
  const [sel, setSel] = useState(null); const [edit, setEdit] = useState({}); const [saving, setSaving] = useState(false); const [savedFlag, setSavedFlag] = useState(false)
  const [uploading, setUploading] = useState(false); const [uploadMsg, setUploadMsg] = useState(null); const [dragOver, setDragOver] = useState(false); const fileRef = useRef(null)
  const canEdit = EDITORES.includes(session?.user?.email)
  const contentRef = useRef(null); const toolbarRef = useRef(null); const wantScroll = useRef(false); const handleFileRef = useRef(null)
  const [stickyTop, setStickyTop] = useState(0); const [toolbarH, setToolbarH] = useState(0)

  useEffect(() => { const medir = () => { const prev = contentRef.current?.previousElementSibling; if (prev) { const pos = window.getComputedStyle(prev).position; setStickyTop((pos === 'fixed' || pos === 'sticky') ? Math.round(prev.getBoundingClientRect().height) : 0) } }; medir(); window.addEventListener('resize', medir); const t = setTimeout(medir, 300); return () => { window.removeEventListener('resize', medir); clearTimeout(t) } }, [status])
  useEffect(() => { const m = () => { if (toolbarRef.current) setToolbarH(Math.round(toolbarRef.current.getBoundingClientRect().height)) }; m(); window.addEventListener('resize', m); const t = setTimeout(m, 350); return () => { window.removeEventListener('resize', m); clearTimeout(t) } }, [status, modo, isMobile, uploadMsg])
  useEffect(() => { const c = () => setIsMobile(window.innerWidth < 768); c(); window.addEventListener('resize', c); return () => window.removeEventListener('resize', c) }, [])
  useEffect(() => { if (status === 'unauthenticated') router.push('/api/auth/signin') }, [status, router])
  useEffect(() => { if (status !== 'authenticated') return; fetch('/api/financiero/caja-chica').then(r => r.json()).then(d => { const l = d.meses || []; setMeses(l); if (l.length && mesSel == null) setMesSel(l[0].mes) }).catch(() => {}) }, [status]) // eslint-disable-line

  const cargar = () => {
    const url = modo === 'continua' ? '/api/financiero/caja-chica?todas=1' : (mesSel ? `/api/financiero/caja-chica?mes=${mesSel}` : null)
    if (!url) return
    setLoading(true)
    fetch(url).then(r => r.json()).then(d => { setMovimientos(d.movimientos || []); if (wantScroll.current) { wantScroll.current = false; setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' }), 90) } }).finally(() => setLoading(false))
  }
  useEffect(() => { if (status === 'authenticated' && (modo === 'continua' || mesSel)) { wantScroll.current = true; cargar() } }, [modo, mesSel, status]) // eslint-disable-line

  const resumen = useMemo(() => {
    const r = { n: movimientos.length, pagado: 0, recibido: 0, revisar: 0, saldo: null }
    for (const v of movimientos) { r.pagado += v.pagado || 0; r.recibido += v.recibido || 0; if (!v.ccb) r.revisar++ }
    if (movimientos.length) r.saldo = movimientos[movimientos.length - 1].saldo
    return r
  }, [movimientos])
  const apertura = useMemo(() => {
    if (!movimientos.length) return null
    const o = movimientos[0]
    if (o.saldo == null || o.monto == null) return null
    return { saldo: o.saldo - o.monto, label: modo === 'mensual' && mesSel ? `Apertura ${mesLabel(mesSel)}` : 'Apertura 2026' }
  }, [movimientos, modo, mesSel])

  const filtrados = useMemo(() => movimientos.filter(v => { for (const c of COLDEFS) { const f = filters[c.key]; if (!f) continue; const val = String(c.get(v) ?? ''); if (f.text && !val.toLowerCase().includes(f.text.toLowerCase())) return false; if (f.sel && f.sel.length && !f.sel.includes(val)) return false } return true }), [movimientos, filters])

  const abrir = (v) => { setSel(v); setSavedFlag(false); setEdit({ ccb: v.ccb || '', detalle: v.detalle || '' }) }
  const cerrar = () => { setSel(null) }
  const guardar = async () => {
    if (!sel) return; setSaving(true)
    try {
      const res = await fetch('/api/financiero/caja-chica', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: sel.id, ...edit }) })
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || 'No se pudo guardar'); return }
      setSavedFlag(true); cargar()
    } finally { setSaving(false) }
  }

  const handleFile = async (file) => {
    if (!file) return
    if (!canEdit) { setUploadMsg({ error: 'No tienes permiso para cargar.' }); return }
    setUploading(true); setUploadMsg(null)
    try {
      const XLSX = await import('xlsx')
      const { movimientos: parsed, archivo } = await parseCajaChica(file, XLSX)
      if (!parsed.length) { setUploadMsg({ error: 'No encontré movimientos de 2026 en el archivo.' }); return }
      const res = await fetch('/api/financiero/caja-chica', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ movimientos: parsed, archivo }) })
      const d = await res.json()
      if (!res.ok) { setUploadMsg({ error: d.error || 'No se pudo cargar.' }); return }
      setUploadMsg({ text: `${d.nuevas} movimiento(s) nuevo(s), ${d.duplicadas} ya estaban, ${d.total} de 2026 en el archivo.` })
      fetch('/api/financiero/caja-chica').then(r => r.json()).then(x => setMeses(x.meses || [])).catch(() => {})
      cargar()
    } catch (err) { setUploadMsg({ error: String(err?.message || err) }) } finally { setUploading(false) }
  }
  handleFileRef.current = handleFile
  const onFileInput = (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) handleFile(f) }

  useEffect(() => {
    const over = (e) => { if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) { e.preventDefault(); setDragOver(true) } }
    const leave = (e) => { if (e.clientX <= 0 && e.clientY <= 0) setDragOver(false) }
    const drop = (e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer?.files?.[0]; if (f) handleFileRef.current?.(f) }
    const paste = (e) => { const f = e.clipboardData?.files?.[0]; if (f) { e.preventDefault(); handleFileRef.current?.(f) } }
    window.addEventListener('dragover', over); window.addEventListener('dragleave', leave); window.addEventListener('drop', drop); window.addEventListener('paste', paste)
    return () => { window.removeEventListener('dragover', over); window.removeEventListener('dragleave', leave); window.removeEventListener('drop', drop); window.removeEventListener('paste', paste) }
  }, [])

  if (status === 'loading') return (<><TopNav /><div style={{ padding: 60, textAlign: 'center', color: '#888', fontSize: 14 }}>Cargando…</div></>)
  const inp = { fontSize: 13, padding: '7px 9px', borderRadius: 7, border: '0.5px solid #D3D1C7', boxSizing: 'border-box', width: '100%' }

  return (
    <>
      <TopNav />
      {dragOver && canEdit && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(29,158,117,0.10)', border: '3px dashed #1D9E75', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ background: '#fff', padding: '16px 26px', borderRadius: 12, fontSize: 15, fontWeight: 700, color: '#085041', boxShadow: '0 8px 30px rgba(0,0,0,0.15)' }}>⬆ Suelta el archivo para cargar</div>
        </div>
      )}
      <div ref={contentRef} style={{ maxWidth: 1180, margin: '0 auto', padding: isMobile ? '16px 8px 40px' : '20px 24px 48px' }}>
        <div ref={toolbarRef} style={{ position: 'sticky', top: stickyTop, zIndex: 18, background: '#fff', paddingTop: 6, paddingBottom: 10, marginBottom: 8, borderBottom: '0.5px solid #ECEAE3' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontSize: isMobile ? 18 : 20, fontWeight: 600, margin: '0 0 2px', color: '#2C2C2A' }}>Caja Chica</h1>
              <div style={{ fontSize: 12, color: '#888780' }}>Movimientos de caja chica con Centro de Coste/Beneficio</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', border: '0.5px solid #D3D1C7', borderRadius: 8, overflow: 'hidden' }}>
                {[['continua', 'Continua'], ['mensual', 'Mensual']].map(([v, lbl]) => (<button key={v} onClick={() => setModo(v)} style={{ fontSize: 12, padding: '7px 12px', border: 'none', cursor: 'pointer', background: modo === v ? '#1D9E75' : '#fff', color: modo === v ? '#fff' : '#2C2C2A', fontWeight: modo === v ? 600 : 400 }}>{lbl}</button>))}
              </div>
              {modo === 'mensual' && (<select value={mesSel || ''} onChange={e => setMesSel(e.target.value)} style={{ fontSize: 13, padding: '7px 10px', borderRadius: 8, border: '0.5px solid #D3D1C7', background: '#fff', color: '#2C2C2A' }}>{meses.map(m => <option key={m.mes} value={m.mes}>{mesLabel(m.mes)} ({m.n})</option>)}</select>)}
              <button onClick={() => router.push('/procesos/financiero')} style={{ fontSize: 12, padding: '7px 12px', borderRadius: 8, border: '0.5px solid #D3D1C7', background: '#fff', cursor: 'pointer', color: '#2C2C2A', whiteSpace: 'nowrap' }}>← Financiero</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={() => fileRef.current?.click()} disabled={!canEdit || uploading} title={canEdit ? 'Subir, arrastrar o pegar el libro de Caja Chica' : 'Sin permiso'} style={{ fontSize: 12, fontWeight: 600, padding: '8px 15px', borderRadius: 8, border: 'none', background: (!canEdit || uploading) ? '#B4D8CB' : '#1D9E75', color: '#fff', cursor: (!canEdit || uploading) ? 'default' : 'pointer' }}>⬆ {uploading ? 'Procesando…' : 'Cargar caja chica'}</button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={onFileInput} style={{ display: 'none' }} />
            {canEdit && <span style={{ fontSize: 11, color: '#B4B2A9' }}>o arrastra / pega el archivo · solo se cargan movimientos de 2026</span>}
          </div>
          {uploadMsg && (<div style={{ marginTop: 8, fontSize: 12, padding: '8px 12px', borderRadius: 8, background: uploadMsg.error ? '#FBE9E7' : '#F3FBF8', border: `0.5px solid ${uploadMsg.error ? '#F0C9C2' : '#CDEBDF'}`, color: uploadMsg.error ? '#B23A3A' : '#085041' }}>{uploadMsg.error || uploadMsg.text}</div>)}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <Card label="Movimientos" value={resumen.n} />
          <Card label="Pagado" value={clp(resumen.pagado)} color="#B23A3A" />
          <Card label="Recibido" value={clp(resumen.recibido)} color="#085041" />
          <Card label="Saldo actual" value={clp(resumen.saldo)} />
          <Card label="Sin CCB" value={resumen.revisar} color={resumen.revisar ? '#B23A3A' : '#888780'} />
        </div>

        <div style={{ border: '0.5px solid #E0DED6', borderRadius: 10, overflow: 'visible', background: '#fff' }}>
          <div style={{ position: 'sticky', top: stickyTop + toolbarH, zIndex: 16, display: 'grid', gridTemplateColumns: GRID, background: '#F1EFE9', borderBottom: '0.5px solid #E0DED6', padding: '9px 12px', fontSize: 11, fontWeight: 600, color: '#888780' }}>
            {COLDEFS.map(c => (<div key={c.key} style={{ textAlign: c.align, display: 'flex', justifyContent: c.align === 'right' ? 'flex-end' : c.align === 'center' ? 'center' : 'flex-start', alignItems: 'center' }}><span>{c.label}</span>{c.filter && <HeaderFilter col={c} movs={movimientos} state={filters[c.key]} setState={(v) => setFilters(f => ({ ...f, [c.key]: v }))} open={openFilter} setOpen={setOpenFilter} />}</div>))}
          </div>
          {loading ? (<div style={{ padding: 30, textAlign: 'center', color: '#888', fontSize: 13 }}>Cargando…</div>
          ) : (<>
            {apertura && (
              <div style={{ display: 'grid', gridTemplateColumns: GRID, padding: '8px 12px', fontSize: 12, background: '#F3F7FB', borderBottom: '0.5px solid #E7EDF3', alignItems: 'center', color: '#0C447C' }}>
                <div />
                <div style={{ fontWeight: 600 }}>{apertura.label}</div>
                <div /><div /><div />
                <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{clp(apertura.saldo)}</div>
                <div />
              </div>
            )}
            {filtrados.length === 0 ? (<div style={{ padding: 30, textAlign: 'center', color: '#888', fontSize: 13 }}>Sin movimientos para este filtro.</div>
            ) : filtrados.map(v => (
              <div key={v.id} onClick={() => abrir(v)} style={{ display: 'grid', gridTemplateColumns: GRID, padding: '8px 12px', fontSize: 13, color: '#2C2C2A', borderBottom: '0.5px solid #F0EFEA', cursor: 'pointer', alignItems: 'center' }} onMouseEnter={e => e.currentTarget.style.background = '#FAFAF7'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                <div style={{ color: '#888780', fontSize: 12 }}>{fmtFecha(v.fecha)}</div>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>{v.detalle || <span style={{ color: '#B4B2A9' }}>—</span>}</div>
                <div style={{ fontSize: 12, color: '#888780', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.n_documento || '—'}</div>
                <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: v.pagado ? '#B23A3A' : '#B4B2A9' }}>{v.pagado ? clp(v.pagado) : '—'}</div>
                <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: v.recibido ? '#085041' : '#B4B2A9' }}>{v.recibido ? clp(v.recibido) : '—'}</div>
                <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#888780' }}>{clp(v.saldo)}</div>
                <div><CcbChip ccb={v.ccb} /></div>
              </div>
            ))}
          </>)}
        </div>
        <div style={{ fontSize: 11, color: '#B4B2A9', marginTop: 8 }}>{modo === 'mensual' && mesSel ? `${mesLabel(mesSel)}  ·  ` : (modo === 'continua' ? 'Todos los movimientos de 2026  ·  ' : '')}{filtrados.length} de {movimientos.length} movimientos. Pincha uno para asignar/editar su CCB.</div>
      </div>

      {sel && (<>
        <div onClick={cerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.28)', zIndex: 40 }} />
        <div style={{ position: 'fixed', top: 0, right: 0, height: '100vh', width: isMobile ? '100%' : 440, maxWidth: '100%', background: '#fff', zIndex: 41, boxShadow: '-4px 0 24px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 18px', borderBottom: '0.5px solid #E0DED6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: '#888780' }}>{fmtFecha(sel.fecha)}{sel.n_documento ? ` · ${sel.n_documento}` : ''}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#2C2C2A', marginTop: 2 }}>{sel.detalle || '—'}</div>
                <div style={{ fontSize: 13, marginTop: 4, color: (sel.monto || 0) < 0 ? '#B23A3A' : '#085041', fontWeight: 600 }}>{(sel.monto || 0) < 0 ? `Pagado ${clp(sel.pagado)}` : `Recibido ${clp(sel.recibido)}`}</div>
                <div style={{ fontSize: 12, color: '#888780', marginTop: 2 }}>Saldo tras el movimiento: {clp(sel.saldo)}</div>
              </div>
              <button onClick={cerrar} style={{ border: 'none', background: 'transparent', fontSize: 22, cursor: 'pointer', color: '#888780', lineHeight: 1 }}>×</button>
            </div>
            {!canEdit && <div style={{ marginTop: 8, fontSize: 12, color: '#888780', background: '#F7F6F2', padding: '6px 10px', borderRadius: 6 }}>Solo lectura.</div>}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ fontSize: 12, color: '#888780' }}>CCB<input list="ccb-list-cc" value={edit.ccb} disabled={!canEdit} onChange={e => setEdit(x => ({ ...x, ccb: e.target.value }))} style={{ ...inp, marginTop: 4 }} /></label>
            <label style={{ fontSize: 12, color: '#888780' }}>Detalle<input value={edit.detalle} disabled={!canEdit} onChange={e => setEdit(x => ({ ...x, detalle: e.target.value }))} style={{ ...inp, marginTop: 4 }} /></label>
            <datalist id="ccb-list-cc">{CCB_SUGERIDOS.map(c => <option key={c} value={c} />)}</datalist>
          </div>
          {canEdit && (<div style={{ borderTop: '0.5px solid #E0DED6', padding: '12px 18px' }}>
            <button onClick={guardar} disabled={saving} style={{ width: '100%', fontSize: 14, fontWeight: 600, padding: '10px', borderRadius: 8, border: 'none', cursor: saving ? 'default' : 'pointer', background: '#1D9E75', color: '#fff', opacity: saving ? 0.7 : 1 }}>{saving ? 'Guardando…' : 'Guardar'}</button>
            {savedFlag && <div style={{ textAlign: 'center', fontSize: 12, color: '#085041', marginTop: 6 }}>✓ Guardado</div>}
          </div>)}
        </div>
      </>)}
    </>
  )
}
