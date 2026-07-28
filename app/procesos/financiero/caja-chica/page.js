// VERSION: v6 · 2026-07-27 · Caja Chica: campo Cuenta con buscador del plan y sugerencia.
//   La memoria va por la PRIMERA PALABRA del detalle, aprendida del historico:
//   "Dominio A00842" y "Dominio A00844" son el mismo gasto, y con 520 movimientos
//   cinco patrones (Dominio 175, FV 196, Rep 56, Plan 24, Comision 25) cubren el 92%.
//   No hay reglas fijas en el codigo: en cuanto se clasifica UNO de un patron, los
//   demas salen sugeridos. Asi la regla la pone quien sabe de contabilidad, no yo.
// VERSION: v5 · 2026-07-27 · Caja Chica: arreglada la carga y separadas Saldo / CCB.
//   1) "Cannot read properties of undefined (reading 'includes')" al cargar el Excel:
//      SheetJS devuelve arrays DISPERSOS (con huecos) cuando hay celdas vacias. .map()
//      y .some() SALTAN los huecos, pero findIndex NO: los recorre pasando undefined.
//      Bastaba una columna vacia en la fila de cabecera para que reventase la carga.
//      Ahora la fila se densifica con Array.from antes de buscar nada.
//   2) Las cabeceras "Saldo" y "CCB" se tocaban y parecian una sola columna llamada
//      "SaldoCCB", lo que hacia pensar que habia un total por centro. Son dos columnas
//      distintas: el saldo corrido de la caja y el centro de cada movimiento.
// VERSION: v4 · 2026-07-26 · Caja Chica: cabecera compartida FinancieroHeader (3 lineas, fija).
//   El offset pegajoso lo calcula el componente (TopNav + FinancieroNav). Antes esta
//   pagina media solo el hermano inmediato y la cabecera se escondia tras el TopNav.
//   Totales como chips dentro de la zona fija: ya no desaparecen al hacer scroll.
//   Fuera el boton ← Financiero (duplicado: ya esta en FinancieroNav).
// VERSION: v2 · 2026-07-14 · Caja Chica: orden por nº de fila (saldo corrido correcto) + resalte de saltos de saldo.
'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo, useRef } from 'react'
import TopNav from '@/app/components/ui/TopNav'
import FinancieroNav from '@/app/components/ui/FinancieroNav'
import FinancieroHeader from '@/app/components/ui/FinancieroHeader'
import CuentaSelector from '@/app/components/ui/CuentaSelector'

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
    // Array.from densifica: rellena los huecos del array disperso de SheetJS.
    const hh = Array.from(rows[i] || [], c => String(c == null ? '' : c).trim().toUpperCase())
    if (hh.some(h => h.includes('SALDO')) && hh.some(h => h.includes('MONTO INICIAL'))) { hi = i; break }
  }
  if (hi < 0) throw new Error('No encontré la cabecera (Monto inicial / Saldo Final). ¿Es el libro de Caja Chica?')
  const H = Array.from(rows[hi] || [], c => String(c == null ? '' : c).trim().toUpperCase())
  const idxHas = (...subs) => H.findIndex(h => typeof h === 'string' && subs.every(s => h.includes(s.toUpperCase())))
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

// Primera palabra del detalle, sin numeros ni codigos: "Dominio A00842" -> "DOMINIO".
const patronDe = (d) => String(d || '').trim().split(/\s+/)[0].toUpperCase().replace(/[^A-ZÁÉÍÓÚÑ]/g, '')

const COLDEFS = [
  { key: 'fecha', label: 'Fecha', w: '92px', align: 'left', get: v => fmtFecha(v.fecha), filter: 'list' },
  { key: 'detalle', label: 'Detalle', w: '1fr', align: 'left', get: v => v.detalle || '', filter: 'text' },
  { key: 'n_documento', label: 'N° Doc', w: '128px', align: 'left', get: v => v.n_documento || '', filter: 'text' },
  { key: 'pagado', label: 'Pagado', w: '98px', align: 'right', get: v => v.pagado, filter: null },
  { key: 'recibido', label: 'Recibido', w: '98px', align: 'right', get: v => v.recibido, filter: null },
  { key: 'saldo', label: 'Saldo', w: '112px', align: 'right', get: v => v.saldo, filter: null },
  { key: 'ccb', label: 'CCB', w: '92px', align: 'left', get: v => v.ccb || '', filter: 'list' },
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
  const [plan, setPlan] = useState([])
  const [sel, setSel] = useState(null); const [edit, setEdit] = useState({}); const [saving, setSaving] = useState(false); const [savedFlag, setSavedFlag] = useState(false)
  const [uploading, setUploading] = useState(false); const [uploadMsg, setUploadMsg] = useState(null); const [dragOver, setDragOver] = useState(false); const fileRef = useRef(null)
  const canEdit = EDITORES.includes(session?.user?.email)
const wantScroll = useRef(false); const handleFileRef = useRef(null)
  const [topTabla, setTopTabla] = useState(0)

  useEffect(() => { const c = () => setIsMobile(window.innerWidth < 768); c(); window.addEventListener('resize', c); return () => window.removeEventListener('resize', c) }, [])
  useEffect(() => { if (status === 'unauthenticated') router.push('/api/auth/signin') }, [status, router])
  useEffect(() => { if (status !== 'authenticated') return; fetch('/api/financiero/caja-chica').then(r => r.json()).then(d => { const l = d.meses || []; setMeses(l); if (l.length && mesSel == null) setMesSel(l[0].mes) }).catch(() => {}) }, [status]) // eslint-disable-line

  const cargar = () => {
    const url = modo === 'continua' ? '/api/financiero/caja-chica?todas=1' : (mesSel ? `/api/financiero/caja-chica?mes=${mesSel}` : null)
    if (!url) return
    setLoading(true)
    fetch(url).then(r => r.json()).then(d => { setMovimientos(d.movimientos || []); setPlan(d.plan || []); if (wantScroll.current) { wantScroll.current = false; setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' }), 90) } }).finally(() => setLoading(false))
  }
  useEffect(() => { if (status === 'authenticated' && (modo === 'continua' || mesSel)) { wantScroll.current = true; cargar() } }, [modo, mesSel, status]) // eslint-disable-line

  const resumen = useMemo(() => {
    const r = { n: movimientos.length, pagado: 0, recibido: 0, revisar: 0, sinCuenta: 0, saldo: null }
    for (const v of movimientos) { r.pagado += v.pagado || 0; r.recibido += v.recibido || 0; if (!v.ccb) r.revisar++; if (!String(v.cuenta || '').trim()) r.sinCuenta++ }
    if (movimientos.length) r.saldo = movimientos[movimientos.length - 1].saldo
    return r
  }, [movimientos])
  const apertura = useMemo(() => {
    if (!movimientos.length) return null
    const o = movimientos[0]
    if (o.saldo == null || o.monto == null) return null
    return { saldo: o.saldo - o.monto, label: modo === 'mensual' && mesSel ? `Apertura ${mesLabel(mesSel)}` : 'Apertura 2026' }
  }, [movimientos, modo, mesSel])

  // Filas donde la cadena de saldo se rompe (el "Monto inicial" implícito ≠ Saldo Final de la fila anterior).
  const rotos = useMemo(() => {
    const set = new Set()
    for (let i = 1; i < movimientos.length; i++) {
      const cur = movimientos[i], prev = movimientos[i - 1]
      if (cur.saldo == null || cur.monto == null || prev.saldo == null) continue
      if ((cur.saldo - cur.monto) !== prev.saldo) set.add(cur.id)
    }
    return set
  }, [movimientos])

  const filtrados = useMemo(() => movimientos.filter(v => { for (const c of COLDEFS) { const f = filters[c.key]; if (!f) continue; const val = String(c.get(v) ?? ''); if (f.text && !val.toLowerCase().includes(f.text.toLowerCase())) return false; if (f.sel && f.sel.length && !f.sel.includes(val)) return false } return true }), [movimientos, filters])

  // Memoria por patron: para cada primera palabra, la cuenta y el CCB mas usados.
  // Solo se propone si el historico es UNANIME (una sola cuenta) y hay al menos uno.
  const memoria = useMemo(() => {
    const acc = {}
    for (const m of movimientos) {
      const pat = patronDe(m.detalle)
      if (!pat) continue
      const e = acc[pat] || (acc[pat] = { ctas: {}, ccbs: {}, n: 0 })
      e.n++
      const c = String(m.cuenta || '').trim()
      if (c) e.ctas[c] = (e.ctas[c] || 0) + 1
      if (m.ccb) e.ccbs[m.ccb] = (e.ccbs[m.ccb] || 0) + 1
    }
    for (const k of Object.keys(acc)) {
      const e = acc[k]
      const ct = Object.keys(e.ctas), cb = Object.keys(e.ccbs)
      e.cuenta = ct.length === 1 ? ct[0] : null
      e.ccb = cb.length === 1 ? cb[0] : null
    }
    return acc
  }, [movimientos])

  const memoSel = sel ? memoria[patronDe(sel.detalle)] : null

  const abrir = (v) => { setSel(v); setSavedFlag(false); setEdit({ ccb: v.ccb || '', cuenta: v.cuenta || '', detalle: v.detalle || '' }) }
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

  if (status === 'loading') return (<><TopNav /><FinancieroNav activo="caja-chica" /><div style={{ padding: 60, textAlign: 'center', color: '#888', fontSize: 14 }}>Cargando…</div></>)
  const inp = { fontSize: 13, padding: '7px 9px', borderRadius: 7, border: '0.5px solid #D3D1C7', boxSizing: 'border-box', width: '100%' }

  return (
    <>
      <TopNav />
      <FinancieroNav activo="caja-chica" />
      {dragOver && canEdit && (
        <div data-overlay="1" style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(29,158,117,0.10)', border: '3px dashed #1D9E75', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ background: '#fff', padding: '16px 26px', borderRadius: 12, fontSize: 15, fontWeight: 700, color: '#085041', boxShadow: '0 8px 30px rgba(0,0,0,0.15)' }}>⬆ Suelta el archivo para cargar</div>
        </div>
      )}
      <FinancieroHeader
        titulo="Caja Chica"
        subtitulo="Movimientos de caja chica con Centro de Coste/Beneficio"
        onOffset={setTopTabla}
        derecha={<>
          <div style={{ display: 'flex', border: '0.5px solid #D3D1C7', borderRadius: 8, overflow: 'hidden' }}>
            {[['continua', 'Continua'], ['mensual', 'Mensual']].map(([v, lbl]) => (
              <button key={v} onClick={() => setModo(v)} style={{ fontSize: 12, padding: '6px 11px', border: 'none', cursor: 'pointer', background: modo === v ? '#1D9E75' : '#fff', color: modo === v ? '#fff' : '#2C2C2A', fontWeight: modo === v ? 600 : 400 }}>{lbl}</button>
            ))}
          </div>
          {modo === 'mensual' && (
            <select value={mesSel || ''} onChange={e => setMesSel(e.target.value)} style={{ fontSize: 13, padding: '6px 9px', borderRadius: 8, border: '0.5px solid #D3D1C7', background: '#fff', color: '#2C2C2A' }}>
              {meses.map(m => <option key={m.mes} value={m.mes}>{mesLabel(m.mes)} ({m.n})</option>)}
            </select>
          )}
        </>}
        acciones={<>
          <button onClick={() => fileRef.current?.click()} disabled={!canEdit || uploading} title={canEdit ? 'Subir, arrastrar o pegar el libro de Caja Chica' : 'Sin permiso'} style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: 'none', background: (!canEdit || uploading) ? '#B4D8CB' : '#1D9E75', color: '#fff', cursor: (!canEdit || uploading) ? 'default' : 'pointer' }}>⬆ {uploading ? 'Procesando…' : 'Cargar caja chica'}</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={onFileInput} style={{ display: 'none' }} />
          {canEdit && <span style={{ fontSize: 11, color: '#B4B2A9' }}>o arrastra / pega · solo movimientos de 2026</span>}
        </>}
        metricas={[
          { label: 'Movimientos', valor: resumen.n },
          { label: 'Pagado', valor: clp(resumen.pagado), color: '#B23A3A' },
          { label: 'Recibido', valor: clp(resumen.recibido), color: '#085041' },
          { label: 'Saldo', valor: clp(resumen.saldo) },
          { label: 'Sin CCB', valor: resumen.revisar, color: resumen.revisar ? '#B23A3A' : '#888780' },
          { label: 'Sin cuenta', valor: resumen.sinCuenta, color: resumen.sinCuenta ? '#9A6E00' : '#888780' },
          { label: 'Saltos', valor: rotos.size, color: rotos.size ? '#B23A3A' : '#888780' },
        ]}
        mensajes={<>
          {uploadMsg && (
            <div style={{ marginBottom: 8, fontSize: 12, padding: '7px 11px', borderRadius: 8, background: uploadMsg.error ? '#FBE9E7' : '#F3FBF8', border: `0.5px solid ${uploadMsg.error ? '#F0C9C2' : '#CDEBDF'}`, color: uploadMsg.error ? '#B23A3A' : '#085041' }}>{uploadMsg.error || uploadMsg.text}</div>
          )}
        </>}
      />

      <div style={{ maxWidth: 1180, margin: '0 auto', padding: isMobile ? '12px 8px 40px' : '14px 24px 48px' }}>

        <div style={{ border: '0.5px solid #E0DED6', borderRadius: 10, overflow: 'visible', background: '#fff' }}>
          <div style={{ position: 'sticky', top: topTabla, zIndex: 16, display: 'grid', gridTemplateColumns: GRID, background: '#F1EFE9', borderBottom: '0.5px solid #E0DED6', padding: '9px 12px', fontSize: 11, fontWeight: 600, color: '#888780' }}>
            {COLDEFS.map(c => (<div key={c.key} style={{ textAlign: c.align, display: 'flex', justifyContent: c.align === 'right' ? 'flex-end' : c.align === 'center' ? 'center' : 'flex-start', alignItems: 'center', paddingRight: c.align === 'right' ? 10 : 0 }}><span>{c.label}</span>{c.filter && <HeaderFilter col={c} movs={movimientos} state={filters[c.key]} setState={(v) => setFilters(f => ({ ...f, [c.key]: v }))} open={openFilter} setOpen={setOpenFilter} />}</div>))}
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
            ) : filtrados.map(v => {
              const roto = rotos.has(v.id)
              return (
              <div key={v.id} onClick={() => abrir(v)} style={{ display: 'grid', gridTemplateColumns: GRID, padding: '8px 12px', fontSize: 13, color: '#2C2C2A', borderBottom: '0.5px solid #F0EFEA', borderLeft: roto ? '3px solid #E8A13A' : '3px solid transparent', background: roto ? '#FDF6EA' : '#fff', cursor: 'pointer', alignItems: 'center' }} onMouseEnter={e => e.currentTarget.style.background = roto ? '#FBEFD8' : '#FAFAF7'} onMouseLeave={e => e.currentTarget.style.background = roto ? '#FDF6EA' : '#fff'}>
                <div style={{ color: '#888780', fontSize: 12 }}>{fmtFecha(v.fecha)}</div>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>{v.detalle || <span style={{ color: '#B4B2A9' }}>—</span>}</div>
                <div style={{ fontSize: 12, color: '#888780', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.n_documento || '—'}</div>
                <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: v.pagado ? '#B23A3A' : '#B4B2A9' }}>{v.pagado ? clp(v.pagado) : '—'}</div>
                <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: v.recibido ? '#085041' : '#B4B2A9' }}>{v.recibido ? clp(v.recibido) : '—'}</div>
                <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: roto ? '#B26A00' : '#888780', fontWeight: roto ? 700 : 400 }}>{clp(v.saldo)}{roto ? ' ⚠' : ''}</div>
                <div><CcbChip ccb={v.ccb} /></div>
              </div>
              )
            })}
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
            <label style={{ fontSize: 12, color: '#888780' }}>Cuenta
              <div style={{ marginTop: 4 }}>
                <CuentaSelector valor={edit.cuenta} plan={plan} disabled={!canEdit}
                  formato="codigo+desc"
                  sugerida={(memoSel && memoSel.cuenta && !String(edit.cuenta || '').trim()) ? String(memoSel.cuenta).trim().slice(0, 7) : null}
                  onChange={v => setEdit(x => ({ ...x, cuenta: v }))}
                  estilo={{ ...inp }} />
              </div>
            </label>
            {memoSel && memoSel.n > 1 && (
              <div style={{ fontSize: 11, color: '#888780', marginTop: -4 }}>
                Hay {memoSel.n} movimientos que empiezan por «{patronDe(sel.detalle)}»
                {memoSel.cuenta ? '. Al guardar este, los demás saldrán sugeridos.' : ''}
              </div>
            )}
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
