// VERSION: v1 · 2026-07-13 · Vista Ventas (Financiero): continua/mensual, recientes abajo, cabecera+barra fijas, filtros Excel, cargar mes, CCB editable.
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

// Lee un Libro de Ventas (formato viejo o nuevo) por nombre de columna.
async function parseVentas(file, XLSX) {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: false })
  let hi = -1
  for (let i = 0; i < rows.length; i++) { if ((rows[i] || []).some(c => String(c).trim().toUpperCase() === 'TIPO # FOLIO')) { hi = i; break } }
  if (hi < 0) throw new Error('No encontré la cabecera (Tipo # Folio). ¿Es un Libro de Ventas?')
  const header = rows[hi].map(c => String(c == null ? '' : c).trim())
  const find = (...names) => { for (const n of names) { const idx = header.findIndex(h => h.toUpperCase() === n.toUpperCase()); if (idx >= 0) return idx } return -1 }
  const cFolio = find('Tipo # Folio'), cCcb = find('CENTRO COSTO'), cId = find('IDADMON'), cFecha = find('Fecha')
  const cNeto = find('NETO'), cIva = find('IVA'), cTotal = find('$ Total', '$Total', 'TOTAL')
  const cRev = find('REVISIÓN', 'REVISION'), cTipo = find('TIP0', 'TIPO'), cGlosa = find('GLOSA')
  const recCols = []; header.forEach((h, i) => { if (h.toUpperCase() === 'RECEPTOR') recCols.push(i) })
  const num = (x) => { if (x == null || x === '') return null; const n = Number(x); return isNaN(n) ? null : Math.round(n) }
  const cl = (x) => { if (x == null) return null; const s = String(x).trim(); return (s === '' || s.toUpperCase() === 'X' || s === 'nan') ? null : s }
  const folioNum = (x) => { const m = String(x == null ? '' : x).match(/(\d+)\s*$/); return m ? Number(m[1]) : null }
  const ventas = []
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i] || []
    const folio = folioNum(r[cFolio]); const fecha = fechaISO(r[cFecha])
    if (folio == null || !fecha) continue
    let rut = null, receptor = null
    if (recCols.length >= 2) { rut = cl(r[recCols[0]]); receptor = cl(r[recCols[1]]) }
    else if (recCols.length === 1) { const s = cl(r[recCols[0]]) || ''; const m = s.match(/^([\d.\-Kk]+)\s+(.*)$/); if (m) { rut = m[1]; receptor = m[2] } else receptor = s || null }
    ventas.push({ folio, tipo_doc: cl(r[cTipo]), fecha, ccb: cl(r[cCcb]), idadmon: cl(r[cId]), rut, receptor, neto: num(r[cNeto]), iva: num(r[cIva]), total: num(r[cTotal]), revision: cl(r[cRev]), glosa: cGlosa >= 0 ? cl(r[cGlosa]) : null, mes: fecha.slice(0, 7) })
  }
  return { archivo: file.name, ventas }
}

const COLDEFS = [
  { key: 'folio', label: 'Folio', w: '80px', align: 'left', get: v => String(v.folio ?? ''), filter: 'text' },
  { key: 'fecha', label: 'Fecha', w: '92px', align: 'left', get: v => fmtFecha(v.fecha), filter: 'list' },
  { key: 'tipo_doc', label: 'Tipo', w: '64px', align: 'left', get: v => v.tipo_doc || '', filter: 'list' },
  { key: 'receptor', label: 'Receptor', w: '1fr', align: 'left', get: v => v.receptor || '', filter: 'text' },
  { key: 'ccb', label: 'CCB', w: '78px', align: 'left', get: v => v.ccb || '', filter: 'list' },
  { key: 'neto', label: 'Neto', w: '104px', align: 'right', get: v => v.neto, filter: null },
  { key: 'iva', label: 'IVA', w: '94px', align: 'right', get: v => v.iva, filter: null },
  { key: 'total', label: 'Total', w: '116px', align: 'right', get: v => v.total, filter: null },
]
const GRID = COLDEFS.map(c => c.w).join(' ')

function CcbChip({ ccb }) {
  if (!ccb) return <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#FBE9E7', color: '#B23A3A' }}>revisar</span>
  return <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#EEF3F8', color: '#0C447C' }}>{ccb}</span>
}
function Card({ label, value, color }) {
  return (
    <div style={{ background: '#fff', border: '0.5px solid #E0DED6', borderRadius: 10, padding: '10px 14px', minWidth: 108, flex: '1 1 auto' }}>
      <div style={{ fontSize: 11, color: '#888780', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color || '#2C2C2A' }}>{value}</div>
    </div>
  )
}

function HeaderFilter({ col, movs, state, setState, open, setOpen }) {
  const active = state && (state.text || (state.sel && state.sel.length))
  const distinct = useMemo(() => {
    if (col.filter !== 'list') return []
    const s = new Set(); for (const m of movs) s.add(String(col.get(m)))
    return Array.from(s).sort()
  }, [movs, col])
  const s = state || { text: '', sel: [] }
  const toggle = (v) => { const sel = s.sel.includes(v) ? s.sel.filter(x => x !== v) : [...s.sel, v]; setState({ ...s, sel }) }
  return (
    <span style={{ position: 'relative', marginLeft: 4 }}>
      <button onClick={(e) => { e.stopPropagation(); setOpen(open === col.key ? null : col.key) }} title="Filtrar" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: active ? '#1D9E75' : '#B4B2A9', fontSize: 11, padding: 0 }}>▼</button>
      {open === col.key && (
        <>
          <div onClick={() => setOpen(null)} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
          <div style={{ position: 'absolute', top: 18, left: 0, zIndex: 31, background: '#fff', border: '0.5px solid #D3D1C7', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,0.14)', padding: 10, width: 220, textAlign: 'left', fontWeight: 400 }}>
            <input value={s.text} onChange={e => setState({ ...s, text: e.target.value })} placeholder="Contiene…" autoFocus style={{ width: '100%', fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '0.5px solid #D3D1C7', boxSizing: 'border-box', marginBottom: 8 }} />
            {col.filter === 'list' && distinct.length <= 40 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 5 }}>
                  <button onClick={() => setState({ ...s, sel: distinct.slice() })} style={{ border: 'none', background: 'transparent', color: '#0C447C', cursor: 'pointer', padding: 0 }}>Todos</button>
                  <button onClick={() => setState({ ...s, sel: [] })} style={{ border: 'none', background: 'transparent', color: '#888780', cursor: 'pointer', padding: 0 }}>Limpiar</button>
                </div>
                <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                  {distinct.map(v => (
                    <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '3px 0', cursor: 'pointer' }}>
                      <input type="checkbox" checked={s.sel.includes(v)} onChange={() => toggle(v)} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v === '' ? '(vacío)' : v}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
            {active ? <button onClick={() => { setState({ text: '', sel: [] }); setOpen(null) }} style={{ marginTop: 8, width: '100%', fontSize: 12, padding: '5px', borderRadius: 6, border: '0.5px solid #D3D1C7', background: '#F7F6F2', cursor: 'pointer' }}>Quitar filtro</button> : null}
          </div>
        </>
      )}
    </span>
  )
}

export default function VentasPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isMobile, setIsMobile] = useState(false)

  const [modo, setModo] = useState('continua')
  const [meses, setMeses] = useState([])
  const [mesSel, setMesSel] = useState(null)
  const [ventas, setVentas] = useState([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({})
  const [openFilter, setOpenFilter] = useState(null)

  const [sel, setSel] = useState(null)
  const [edit, setEdit] = useState({})
  const [saving, setSaving] = useState(false)
  const [savedFlag, setSavedFlag] = useState(false)

  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState(null); const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef(null); const handleFileRef = useRef(null)

  const canEdit = EDITORES.includes(session?.user?.email)
  const contentRef = useRef(null)
  const toolbarRef = useRef(null)
  const wantScroll = useRef(false)
  const [stickyTop, setStickyTop] = useState(0)
  const [toolbarH, setToolbarH] = useState(0)

  useEffect(() => {
    const medir = () => { const prev = contentRef.current?.previousElementSibling; if (prev) { const pos = window.getComputedStyle(prev).position; setStickyTop((pos === 'fixed' || pos === 'sticky') ? Math.round(prev.getBoundingClientRect().height) : 0) } }
    medir(); window.addEventListener('resize', medir); const t = setTimeout(medir, 300)
    return () => { window.removeEventListener('resize', medir); clearTimeout(t) }
  }, [status])
  useEffect(() => {
    const m = () => { if (toolbarRef.current) setToolbarH(Math.round(toolbarRef.current.getBoundingClientRect().height)) }
    m(); window.addEventListener('resize', m); const t = setTimeout(m, 350)
    return () => { window.removeEventListener('resize', m); clearTimeout(t) }
  }, [status, modo, isMobile, uploadMsg])
  useEffect(() => { const c = () => setIsMobile(window.innerWidth < 768); c(); window.addEventListener('resize', c); return () => window.removeEventListener('resize', c) }, [])
  useEffect(() => { if (status === 'unauthenticated') router.push('/api/auth/signin') }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/financiero/ventas').then(r => r.json()).then(d => { const l = d.meses || []; setMeses(l); if (l.length && mesSel == null) setMesSel(l[0].mes) }).catch(() => {})
  }, [status]) // eslint-disable-line

  const cargar = () => {
    const url = modo === 'continua' ? '/api/financiero/ventas?todas=1' : (mesSel ? `/api/financiero/ventas?mes=${mesSel}` : null)
    if (!url) return
    setLoading(true)
    fetch(url).then(r => r.json()).then(d => {
      setVentas(d.ventas || [])
      if (wantScroll.current) { wantScroll.current = false; setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' }), 90) }
    }).finally(() => setLoading(false))
  }
  useEffect(() => { if (status === 'authenticated' && (modo === 'continua' || mesSel)) { wantScroll.current = true; cargar() } }, [modo, mesSel, status]) // eslint-disable-line

  const resumen = useMemo(() => {
    const r = { n: ventas.length, neto: 0, iva: 0, total: 0, revisar: 0 }
    for (const v of ventas) { r.neto += v.neto || 0; r.iva += v.iva || 0; r.total += v.total || 0; if (!v.ccb) r.revisar++ }
    return r
  }, [ventas])

  const ventasFiltradas = useMemo(() => {
    return ventas.filter(v => {
      for (const c of COLDEFS) {
        const f = filters[c.key]; if (!f) continue
        const val = String(c.get(v) ?? '')
        if (f.text && !val.toLowerCase().includes(f.text.toLowerCase())) return false
        if (f.sel && f.sel.length && !f.sel.includes(val)) return false
      }
      return true
    })
  }, [ventas, filters])

  const abrir = (v) => { setSel(v); setSavedFlag(false); setEdit({ ccb: v.ccb || '', idadmon: v.idadmon || '', revision: v.revision || '', glosa: v.glosa || '' }) }
  const cerrar = () => { setSel(null) }
  const guardar = async () => {
    if (!sel) return
    setSaving(true)
    try {
      const res = await fetch('/api/financiero/ventas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: sel.id, ...edit }) })
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
      const { ventas: parsed, archivo } = await parseVentas(file, XLSX)
      if (!parsed.length) { setUploadMsg({ error: 'No encontré ventas en el archivo.' }); return }
      const res = await fetch('/api/financiero/ventas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ventas: parsed, archivo }) })
      const d = await res.json()
      if (!res.ok) { setUploadMsg({ error: d.error || 'No se pudo cargar.' }); return }
      setUploadMsg({ text: `${d.nuevas} venta(s) nueva(s), ${d.duplicadas} ya estaban, ${d.total} en el archivo.` })
      fetch('/api/financiero/ventas').then(r => r.json()).then(x => setMeses(x.meses || [])).catch(() => {})
      cargar()
    } catch (err) { setUploadMsg({ error: String(err?.message || err) }) }
    finally { setUploading(false) }
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

        {/* TOOLBAR FIJA */}
        <div ref={toolbarRef} style={{ position: 'sticky', top: stickyTop, zIndex: 18, background: '#fff', paddingTop: 6, paddingBottom: 10, marginBottom: 8, borderBottom: '0.5px solid #ECEAE3' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontSize: isMobile ? 18 : 20, fontWeight: 600, margin: '0 0 2px', color: '#2C2C2A' }}>Ventas</h1>
              <div style={{ fontSize: 12, color: '#888780' }}>Ventas del mes con Centro de Coste/Beneficio</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', border: '0.5px solid #D3D1C7', borderRadius: 8, overflow: 'hidden' }}>
                {[['continua', 'Continua'], ['mensual', 'Mensual']].map(([v, lbl]) => (
                  <button key={v} onClick={() => setModo(v)} style={{ fontSize: 12, padding: '7px 12px', border: 'none', cursor: 'pointer', background: modo === v ? '#1D9E75' : '#fff', color: modo === v ? '#fff' : '#2C2C2A', fontWeight: modo === v ? 600 : 400 }}>{lbl}</button>
                ))}
              </div>
              {modo === 'mensual' && (
                <select value={mesSel || ''} onChange={e => setMesSel(e.target.value)} style={{ fontSize: 13, padding: '7px 10px', borderRadius: 8, border: '0.5px solid #D3D1C7', background: '#fff', color: '#2C2C2A' }}>
                  {meses.map(m => <option key={m.mes} value={m.mes}>{mesLabel(m.mes)} ({m.n})</option>)}
                </select>
              )}
              <button onClick={() => router.push('/procesos/financiero')} style={{ fontSize: 12, padding: '7px 12px', borderRadius: 8, border: '0.5px solid #D3D1C7', background: '#fff', cursor: 'pointer', color: '#2C2C2A', whiteSpace: 'nowrap' }}>← Financiero</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={() => fileRef.current?.click()} disabled={!canEdit || uploading} title={canEdit ? 'Subir un Libro de Ventas mensual' : 'Sin permiso'} style={{ fontSize: 12, fontWeight: 600, padding: '8px 15px', borderRadius: 8, border: 'none', background: (!canEdit || uploading) ? '#B4D8CB' : '#1D9E75', color: '#fff', cursor: (!canEdit || uploading) ? 'default' : 'pointer' }}>⬆ {uploading ? 'Procesando…' : 'Cargar ventas del mes'}</button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={onFileInput} style={{ display: 'none' }} />
          </div>
          {uploadMsg && (
            <div style={{ marginTop: 8, fontSize: 12, padding: '8px 12px', borderRadius: 8, background: uploadMsg.error ? '#FBE9E7' : '#F3FBF8', border: `0.5px solid ${uploadMsg.error ? '#F0C9C2' : '#CDEBDF'}`, color: uploadMsg.error ? '#B23A3A' : '#085041' }}>{uploadMsg.error || uploadMsg.text}</div>
          )}
        </div>

        {/* RESUMEN */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <Card label="Ventas" value={resumen.n} />
          <Card label="Neto" value={clp(resumen.neto)} />
          <Card label="IVA" value={clp(resumen.iva)} />
          <Card label="Total" value={clp(resumen.total)} color="#085041" />
          <Card label="Sin CCB" value={resumen.revisar} color={resumen.revisar ? '#B23A3A' : '#888780'} />
        </div>

        {/* TABLA */}
        <div style={{ border: '0.5px solid #E0DED6', borderRadius: 10, overflow: 'visible', background: '#fff' }}>
          <div style={{ position: 'sticky', top: stickyTop + toolbarH, zIndex: 16, display: 'grid', gridTemplateColumns: GRID, background: '#F1EFE9', borderBottom: '0.5px solid #E0DED6', padding: '9px 12px', fontSize: 11, fontWeight: 600, color: '#888780' }}>
            {COLDEFS.map(c => (
              <div key={c.key} style={{ textAlign: c.align, display: 'flex', justifyContent: c.align === 'right' ? 'flex-end' : c.align === 'center' ? 'center' : 'flex-start', alignItems: 'center' }}>
                <span>{c.label}</span>
                {c.filter && <HeaderFilter col={c} movs={ventas} state={filters[c.key]} setState={(v) => setFilters(f => ({ ...f, [c.key]: v }))} open={openFilter} setOpen={setOpenFilter} />}
              </div>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: 30, textAlign: 'center', color: '#888', fontSize: 13 }}>Cargando…</div>
          ) : ventasFiltradas.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: '#888', fontSize: 13 }}>Sin ventas para este filtro.</div>
          ) : ventasFiltradas.map(v => (
            <div key={v.id} onClick={() => abrir(v)} style={{ display: 'grid', gridTemplateColumns: GRID, padding: '8px 12px', fontSize: 13, color: '#2C2C2A', borderBottom: '0.5px solid #F0EFEA', cursor: 'pointer', alignItems: 'center' }}
              onMouseEnter={e => e.currentTarget.style.background = '#FAFAF7'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
              <div style={{ fontWeight: 600, color: '#0C447C' }}>{v.folio}</div>
              <div style={{ color: '#888780', fontSize: 12 }}>{fmtFecha(v.fecha)}</div>
              <div style={{ fontSize: 12, color: '#888780' }}>{v.tipo_doc || '—'}</div>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>{v.receptor || <span style={{ color: '#B4B2A9' }}>—</span>}</div>
              <div><CcbChip ccb={v.ccb} /></div>
              <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#888780' }}>{clp(v.neto)}</div>
              <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#888780' }}>{clp(v.iva)}</div>
              <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 500, color: (v.total || 0) < 0 ? '#B23A3A' : '#2C2C2A' }}>{clp(v.total)}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: '#B4B2A9', marginTop: 8 }}>
          {modo === 'mensual' && mesSel ? `${mesLabel(mesSel)}  ·  ` : (modo === 'continua' ? 'Todas las ventas  ·  ' : '')}
          {ventasFiltradas.length} de {ventas.length} ventas. Pincha una para revisar/editar su CCB.
        </div>
      </div>

      {/* DRAWER edición */}
      {sel && (
        <>
          <div onClick={cerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.28)', zIndex: 40 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, height: '100vh', width: isMobile ? '100%' : 440, maxWidth: '100%', background: '#fff', zIndex: 41, boxShadow: '-4px 0 24px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 18px', borderBottom: '0.5px solid #E0DED6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#888780' }}>{sel.tipo_doc || '—'} · Folio {sel.folio} · {fmtFecha(sel.fecha)}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#2C2C2A', marginTop: 2 }}>{sel.receptor || '—'}</div>
                  <div style={{ fontSize: 12, color: '#888780', marginTop: 2 }}>{sel.rut || ''}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: (sel.total || 0) < 0 ? '#B23A3A' : '#085041' }}>{clp(sel.total)}</div>
                  <div style={{ fontSize: 12, color: '#888780', marginTop: 2 }}>Neto {clp(sel.neto)} · IVA {clp(sel.iva)}</div>
                </div>
                <button onClick={cerrar} style={{ border: 'none', background: 'transparent', fontSize: 22, cursor: 'pointer', color: '#888780', lineHeight: 1 }}>×</button>
              </div>
              {!canEdit && <div style={{ marginTop: 8, fontSize: 12, color: '#888780', background: '#F7F6F2', padding: '6px 10px', borderRadius: 6 }}>Solo lectura.</div>}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ fontSize: 12, color: '#888780' }}>Centro de Coste/Beneficio (CCB)
                <input list="ccb-list-v" value={edit.ccb} disabled={!canEdit} onChange={e => setEdit(x => ({ ...x, ccb: e.target.value }))} style={{ ...inp, marginTop: 4 }} />
              </label>
              <label style={{ fontSize: 12, color: '#888780' }}>IDADMON (contrato)
                <input value={edit.idadmon} disabled={!canEdit} onChange={e => setEdit(x => ({ ...x, idadmon: e.target.value }))} style={{ ...inp, marginTop: 4 }} />
              </label>
              <label style={{ fontSize: 12, color: '#888780' }}>Revisión
                <input value={edit.revision} disabled={!canEdit} onChange={e => setEdit(x => ({ ...x, revision: e.target.value }))} style={{ ...inp, marginTop: 4 }} />
              </label>
              <label style={{ fontSize: 12, color: '#888780' }}>Glosa
                <input value={edit.glosa} disabled={!canEdit} onChange={e => setEdit(x => ({ ...x, glosa: e.target.value }))} style={{ ...inp, marginTop: 4 }} />
              </label>
              <datalist id="ccb-list-v">{CCB_SUGERIDOS.map(c => <option key={c} value={c} />)}</datalist>
            </div>
            {canEdit && (
              <div style={{ borderTop: '0.5px solid #E0DED6', padding: '12px 18px' }}>
                <button onClick={guardar} disabled={saving} style={{ width: '100%', fontSize: 14, fontWeight: 600, padding: '10px', borderRadius: 8, border: 'none', cursor: saving ? 'default' : 'pointer', background: '#1D9E75', color: '#fff', opacity: saving ? 0.7 : 1 }}>{saving ? 'Guardando…' : 'Guardar'}</button>
                {savedFlag && <div style={{ textAlign: 'center', fontSize: 12, color: '#085041', marginTop: 6 }}>✓ Guardado</div>}
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}
