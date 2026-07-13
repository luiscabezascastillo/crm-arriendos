// VERSION: v3 · 2026-07-13 · Vista SA: continua por defecto, filtros Excel en cabeceras, desglose editable en tabla compacta, folio + saldo.
'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import TopNav from '@/app/components/ui/TopNav'

const EDITORES = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']
const CCB_SUGERIDOS = ['CC1', 'CC2', 'CC3', 'BB1', 'BB2', 'GG']

const ESTADO = {
  CUADRADO:       { bg: '#E1F5EE', color: '#085041', label: 'Cuadrado' },
  SIN_CLASIFICAR: { bg: '#F0EFEA', color: '#888780', label: 'Sin clasificar' },
  DESCUADRADO:    { bg: '#FBE9E7', color: '#B23A3A', label: 'Descuadrado' },
}

const clp = (n) => (n == null ? '—' : Number(n).toLocaleString('es-CL'))
const fmtFecha = (iso) => { if (!iso) return ''; const [y, m, d] = String(iso).slice(0, 10).split('-'); return `${d}/${m}/${y}` }
const subFolio = (orden, sub) => `${orden ?? '·'}.${String(sub).padStart(2, '0')}`

const COLDEFS = [
  { key: 'orden',        label: 'Folio',       w: '80px',  align: 'left',   get: m => (m.orden == null ? '' : String(m.orden)), filter: 'text' },
  { key: 'fecha',        label: 'Fecha',       w: '92px',  align: 'left',   get: m => fmtFecha(m.fecha),                        filter: 'list' },
  { key: 'descripcion',  label: 'Descripción', w: '1fr',   align: 'left',   get: m => m.descripcion || '',                      filter: 'text' },
  { key: 'monto',        label: 'Monto',       w: '118px', align: 'right',  get: m => m.monto,                                  filter: null },
  { key: 'saldo_calc',   label: 'Saldo',       w: '118px', align: 'right',  get: m => m.saldo_calc,                             filter: null },
  { key: 'cargo_abono',  label: 'C/A',         w: '46px',  align: 'center', get: m => m.cargo_abono || '',                      filter: 'list' },
  { key: 'estado_clasificacion', label: 'Estado', w: '116px', align: 'center', get: m => m.estado_clasificacion,               filter: 'list' },
]
const GRID = COLDEFS.map(c => c.w).join(' ')
const DGRID = '58px 74px 86px 86px 1fr 100px 26px'  // drawer: subfolio CCB cta1 cta2 concepto monto x

function Chip({ estado }) {
  const e = ESTADO[estado] || ESTADO.SIN_CLASIFICAR
  return <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 9px', borderRadius: 20, background: e.bg, color: e.color, whiteSpace: 'nowrap' }}>{e.label}</span>
}
function Card({ label, value, color }) {
  return (
    <div style={{ background: '#fff', border: '0.5px solid #E0DED6', borderRadius: 10, padding: '10px 14px', minWidth: 112, flex: '1 1 auto' }}>
      <div style={{ fontSize: 11, color: '#888780', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color || '#2C2C2A' }}>{value}</div>
    </div>
  )
}

// --- Filtro tipo Excel en cabecera ---
function HeaderFilter({ col, movs, state, setState, open, setOpen }) {
  const active = state && (state.text || (state.sel && state.sel.length))
  const distinct = useMemo(() => {
    if (col.filter !== 'list') return []
    const s = new Set(); for (const m of movs) s.add(String(col.get(m)))
    return Array.from(s).sort()
  }, [movs, col])
  const s = state || { text: '', sel: [] }
  const toggle = (v) => {
    const sel = s.sel.includes(v) ? s.sel.filter(x => x !== v) : [...s.sel, v]
    setState({ ...s, sel })
  }
  return (
    <span style={{ position: 'relative', marginLeft: 4 }}>
      <button onClick={(e) => { e.stopPropagation(); setOpen(open === col.key ? null : col.key) }}
        title="Filtrar" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: active ? '#1D9E75' : '#B4B2A9', fontSize: 11, padding: 0 }}>▼</button>
      {open === col.key && (
        <>
          <div onClick={() => setOpen(null)} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
          <div style={{ position: 'absolute', top: 18, left: 0, zIndex: 31, background: '#fff', border: '0.5px solid #D3D1C7', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,0.14)', padding: 10, width: 220, textAlign: 'left', fontWeight: 400 }}>
            <input value={s.text} onChange={e => setState({ ...s, text: e.target.value })} placeholder="Contiene…" autoFocus
              style={{ width: '100%', fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '0.5px solid #D3D1C7', boxSizing: 'border-box', marginBottom: 8 }} />
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
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v === '' ? '(vacío)' : (ESTADO[v]?.label || v)}</span>
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

export default function SaPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isMobile, setIsMobile] = useState(false)

  const [modo, setModo] = useState('continua')
  const [cargas, setCargas] = useState([])
  const [cargaId, setCargaId] = useState(null)
  const [movs, setMovs] = useState([])
  const [lineasByMov, setLineasByMov] = useState({})
  const [loading, setLoading] = useState(false)

  const [filters, setFilters] = useState({})   // { colKey: {text, sel[]} }
  const [openFilter, setOpenFilter] = useState(null)

  const [sel, setSel] = useState(null)
  const [lineas, setLineas] = useState([])
  const [savedFlag, setSavedFlag] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDesc, setConfirmDesc] = useState(false)

  const canEdit = EDITORES.includes(session?.user?.email)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check(); window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  useEffect(() => { if (status === 'unauthenticated') router.push('/api/auth/signin') }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/financiero/sa').then(r => r.json()).then(d => {
      const list = d.cargas || []
      setCargas(list)
      if (list.length && cargaId == null) setCargaId(list[0].id)
    }).catch(() => {})
  }, [status]) // eslint-disable-line

  const cargar = () => {
    const url = modo === 'continua' ? '/api/financiero/sa?todas=1' : (cargaId ? `/api/financiero/sa?carga=${cargaId}` : null)
    if (!url) return
    setLoading(true)
    fetch(url).then(r => r.json()).then(d => {
      setMovs(d.movimientos || [])
      const map = {}
      for (const l of (d.lineas || [])) { (map[l.movimiento_id] = map[l.movimiento_id] || []).push(l) }
      setLineasByMov(map)
    }).finally(() => setLoading(false))
  }
  useEffect(() => { if (status === 'authenticated' && (modo === 'continua' || cargaId)) cargar() }, [modo, cargaId, status]) // eslint-disable-line

  const resumen = useMemo(() => {
    const r = { n: movs.length, cuad: 0, sin: 0, desc: 0, cargos: 0, abonos: 0 }
    for (const m of movs) {
      if (m.estado_clasificacion === 'CUADRADO') r.cuad++
      else if (m.estado_clasificacion === 'DESCUADRADO') r.desc++
      else r.sin++
      if (m.monto < 0) r.cargos += m.monto; else r.abonos += m.monto
    }
    return r
  }, [movs])

  const movsFiltrados = useMemo(() => {
    return movs.filter(m => {
      for (const c of COLDEFS) {
        const f = filters[c.key]; if (!f) continue
        const val = String(c.get(m) ?? '')
        if (f.text && !val.toLowerCase().includes(f.text.toLowerCase())) return false
        if (f.sel && f.sel.length && !f.sel.includes(val)) return false
      }
      return true
    })
  }, [movs, filters])

  const abrir = (m) => { setSel(m); setSavedFlag(false); setConfirmDesc(false); setLineas((lineasByMov[m.id] || []).map(l => ({ ...l }))) }
  const cerrar = () => { setSel(null); setLineas([]); setConfirmDesc(false) }
  const setLinea = (i, campo, val) => setLineas(ls => ls.map((l, k) => k === i ? { ...l, [campo]: val } : l))
  const addLinea = () => setLineas(ls => [...ls, { sub_orden: ls.length + 1, monto: '', ccb: '', cuenta_1: '', cuenta_2: '', concepto: '' }])
  const delLinea = (i) => setLineas(ls => ls.filter((_, k) => k !== i))

  const sumaLineas = useMemo(() => lineas.reduce((a, l) => a + Math.abs(Number(l.monto) || 0), 0), [lineas])
  const cuadra = sel ? sumaLineas === Math.abs(Number(sel.monto)) : false
  const diferencia = sel ? Math.abs(Number(sel.monto)) - sumaLineas : 0

  const guardar = async () => {
    if (!sel) return
    if (!cuadra && !confirmDesc) { setConfirmDesc(true); return }
    setSaving(true)
    try {
      const payload = {
        movimiento_id: sel.id,
        lineas: lineas.filter(l => l.monto !== '' && l.monto != null).map((l, i) => ({
          sub_orden: i + 1, monto: Math.abs(Math.round(Number(l.monto))),
          ccb: (l.ccb || '').trim() || null, cuenta_1: (l.cuenta_1 || '').trim() || null,
          cuenta_2: (l.cuenta_2 || '').trim() || null, concepto: (l.concepto || '').trim() || null,
        })),
      }
      const res = await fetch('/api/financiero/sa', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || 'No se pudo guardar'); return }
      setSavedFlag(true); setConfirmDesc(false); cargar()
    } finally { setSaving(false) }
  }

  if (status === 'loading') return (<><TopNav /><div style={{ padding: 60, textAlign: 'center', color: '#888', fontSize: 14 }}>Cargando…</div></>)
  const cargaActual = cargas.find(c => c.id === cargaId)
  const inp = { fontSize: 12, padding: '5px 6px', borderRadius: 5, border: '0.5px solid #D3D1C7', boxSizing: 'border-box', width: '100%' }

  return (
    <>
      <TopNav />
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: isMobile ? '16px 8px 40px' : '20px 24px 48px' }}>

        {/* CABECERA */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: isMobile ? 18 : 20, fontWeight: 600, margin: '0 0 2px', color: '#2C2C2A' }}>SA · Banco Santander</h1>
            <div style={{ fontSize: 12, color: '#888780' }}>Movimientos y clasificación por Centro de Coste/Beneficio</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', border: '0.5px solid #D3D1C7', borderRadius: 8, overflow: 'hidden' }}>
              {[['continua', 'Continua'], ['cartola', 'Por cartola']].map(([v, lbl]) => (
                <button key={v} onClick={() => setModo(v)} style={{ fontSize: 12, padding: '7px 12px', border: 'none', cursor: 'pointer', background: modo === v ? '#1D9E75' : '#fff', color: modo === v ? '#fff' : '#2C2C2A', fontWeight: modo === v ? 600 : 400 }}>{lbl}</button>
              ))}
            </div>
            {modo === 'cartola' && (
              <select value={cargaId || ''} onChange={e => setCargaId(Number(e.target.value))} style={{ fontSize: 13, padding: '7px 10px', borderRadius: 8, border: '0.5px solid #D3D1C7', background: '#fff', color: '#2C2C2A' }}>
                {cargas.map(c => <option key={c.id} value={c.id}>Cartola {c.nro_cartola} · {c.periodo}{c.tipo === 'provisoria' ? ' (prov.)' : ''}</option>)}
              </select>
            )}
            <button onClick={() => router.push('/procesos/financiero')} style={{ fontSize: 12, padding: '7px 12px', borderRadius: 8, border: '0.5px solid #D3D1C7', background: '#fff', cursor: 'pointer', color: '#2C2C2A', whiteSpace: 'nowrap' }}>← Financiero</button>
          </div>
        </div>

        {/* RESUMEN */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <Card label="Movimientos" value={resumen.n} />
          <Card label="Cuadrados" value={resumen.cuad} color="#085041" />
          <Card label="Sin clasificar" value={resumen.sin} color="#888780" />
          <Card label="Descuadrados" value={resumen.desc} color="#B23A3A" />
          <Card label="Cargos" value={clp(resumen.cargos)} color="#B23A3A" />
          <Card label="Abonos" value={clp(resumen.abonos)} color="#085041" />
        </div>

        {/* TABLA */}
        <div style={{ border: '0.5px solid #E0DED6', borderRadius: 10, overflow: 'visible', background: '#fff' }}>
          <div style={{ display: 'grid', gridTemplateColumns: GRID, background: '#F7F6F2', borderBottom: '0.5px solid #E0DED6', padding: '9px 12px', fontSize: 11, fontWeight: 600, color: '#888780' }}>
            {COLDEFS.map(c => (
              <div key={c.key} style={{ textAlign: c.align, display: 'flex', justifyContent: c.align === 'right' ? 'flex-end' : c.align === 'center' ? 'center' : 'flex-start', alignItems: 'center' }}>
                <span>{c.label}</span>
                {c.filter && <HeaderFilter col={c} movs={movs} state={filters[c.key]} setState={(v) => setFilters(f => ({ ...f, [c.key]: v }))} open={openFilter} setOpen={setOpenFilter} />}
              </div>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: 30, textAlign: 'center', color: '#888', fontSize: 13 }}>Cargando…</div>
          ) : movsFiltrados.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: '#888', fontSize: 13 }}>Sin movimientos para este filtro.</div>
          ) : movsFiltrados.map(m => {
            const desg = lineasByMov[m.id] || []
            return (
              <div key={m.id}>
                <div onClick={() => abrir(m)} style={{ display: 'grid', gridTemplateColumns: GRID, padding: '8px 12px', fontSize: 13, color: '#2C2C2A', borderBottom: desg.length ? 'none' : '0.5px solid #F0EFEA', cursor: 'pointer', alignItems: 'center' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#FAFAF7'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                  <div style={{ fontWeight: 600, color: '#0C447C' }}>{m.orden ?? '—'}</div>
                  <div style={{ color: '#888780', fontSize: 12 }}>{fmtFecha(m.fecha)}</div>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>{m.descripcion || <span style={{ color: '#B4B2A9' }}>—</span>}</div>
                  <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: m.monto < 0 ? '#B23A3A' : '#085041', fontWeight: 500 }}>{clp(m.monto)}</div>
                  <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#888780' }}>{clp(m.saldo_calc)}</div>
                  <div style={{ textAlign: 'center', color: '#888780', fontSize: 12 }}>{m.cargo_abono || '—'}</div>
                  <div style={{ textAlign: 'center' }}><Chip estado={m.estado_clasificacion} /></div>
                </div>
                {desg.map((l, k) => (
                  <div key={l.id ?? k} onClick={() => abrir(m)} style={{ display: 'grid', gridTemplateColumns: GRID, padding: '4px 12px', fontSize: 12, color: '#6b6b66', background: '#FCFCFA', borderBottom: k === desg.length - 1 ? '0.5px solid #F0EFEA' : 'none', cursor: 'pointer', alignItems: 'center' }}>
                    <div style={{ color: '#9a988f', paddingLeft: 8 }}>{subFolio(m.orden, l.sub_orden)}</div>
                    <div />
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
                      {l.ccb && <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 20, background: '#EEF3F8', color: '#0C447C', marginRight: 6 }}>{l.ccb}</span>}
                      {l.concepto || l.cuenta_1 || '—'}
                    </div>
                    <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{clp(l.monto)}</div>
                    <div /><div /><div />
                  </div>
                ))}
              </div>
            )
          })}
        </div>
        <div style={{ fontSize: 11, color: '#B4B2A9', marginTop: 8 }}>
          {modo === 'cartola' && cargaActual ? `Cartola ${cargaActual.nro_cartola} · ${fmtFecha(cargaActual.fecha_desde)} a ${fmtFecha(cargaActual.fecha_hasta)}  ·  ` : (modo === 'continua' ? 'Vista continua (todos los meses)  ·  ' : '')}
          {movsFiltrados.length} de {movs.length} movimientos. Pincha uno para clasificar o editar su desglose.
        </div>
      </div>

      {/* DRAWER (edición como tabla compacta) */}
      {sel && (
        <>
          <div onClick={cerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.28)', zIndex: 40 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, height: '100vh', width: isMobile ? '100%' : 720, maxWidth: '100%', background: '#fff', zIndex: 41, boxShadow: '-4px 0 24px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px 18px', borderBottom: '0.5px solid #E0DED6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#888780' }}>Folio {sel.orden ?? '—'} · {fmtFecha(sel.fecha)}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#2C2C2A', marginTop: 2 }}>{sel.descripcion || '—'}</div>
                  <div style={{ fontSize: 19, fontWeight: 700, marginTop: 3, color: sel.monto < 0 ? '#B23A3A' : '#085041' }}>{clp(sel.monto)}</div>
                </div>
                <button onClick={cerrar} style={{ border: 'none', background: 'transparent', fontSize: 22, cursor: 'pointer', color: '#888780', lineHeight: 1 }}>×</button>
              </div>
              {!canEdit && <div style={{ marginTop: 8, fontSize: 12, color: '#888780', background: '#F7F6F2', padding: '6px 10px', borderRadius: 6 }}>Solo lectura · no tienes permiso para editar.</div>}
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '12px 18px' }}>
              <div style={{ minWidth: 560 }}>
                {/* cabecera tabla */}
                <div style={{ display: 'grid', gridTemplateColumns: DGRID, gap: 6, fontSize: 10, fontWeight: 600, color: '#888780', padding: '0 2px 6px' }}>
                  <div>Sub-folio</div><div>CCB</div><div>Cuenta 1</div><div>Cuenta 2</div><div>Concepto</div><div style={{ textAlign: 'right' }}>Monto</div><div />
                </div>
                {lineas.length === 0 && <div style={{ fontSize: 13, color: '#B4B2A9', padding: '8px 2px' }}>Sin líneas. {canEdit && 'Añade una para clasificar.'}</div>}
                {lineas.map((l, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: DGRID, gap: 6, alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontSize: 11, color: '#9a988f' }}>{subFolio(sel.orden, i + 1)}</div>
                    <input list="ccb-list" value={l.ccb || ''} disabled={!canEdit} onChange={e => setLinea(i, 'ccb', e.target.value)} style={inp} />
                    <input value={l.cuenta_1 || ''} disabled={!canEdit} onChange={e => setLinea(i, 'cuenta_1', e.target.value)} style={inp} />
                    <input value={l.cuenta_2 || ''} disabled={!canEdit} onChange={e => setLinea(i, 'cuenta_2', e.target.value)} style={inp} />
                    <input value={l.concepto || ''} disabled={!canEdit} onChange={e => setLinea(i, 'concepto', e.target.value)} style={inp} />
                    <input type="number" value={l.monto} disabled={!canEdit} onChange={e => setLinea(i, 'monto', e.target.value)} style={{ ...inp, textAlign: 'right' }} />
                    {canEdit ? <button onClick={() => delLinea(i)} title="Quitar" style={{ border: '0.5px solid #E7C9C4', background: '#fff', color: '#B23A3A', borderRadius: 5, cursor: 'pointer', height: 28, fontSize: 14 }}>×</button> : <div />}
                  </div>
                ))}
                {canEdit && <button onClick={addLinea} style={{ marginTop: 4, fontSize: 12, padding: '7px 12px', borderRadius: 7, border: '0.5px dashed #1D9E75', background: '#F3FBF8', color: '#085041', cursor: 'pointer', fontWeight: 500 }}>+ Añadir línea</button>}
                <datalist id="ccb-list">{CCB_SUGERIDOS.map(c => <option key={c} value={c} />)}</datalist>
              </div>
            </div>

            <div style={{ borderTop: '0.5px solid #E0DED6', padding: '12px 18px', background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span style={{ color: '#888780' }}>Suman las líneas</span>
                <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{clp(sumaLineas)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 10 }}>
                <span style={{ color: '#888780' }}>{cuadra ? 'Cuadra con el banco' : 'Diferencia con el banco'}</span>
                <span style={{ fontWeight: 700, color: cuadra ? '#085041' : '#B23A3A', fontVariantNumeric: 'tabular-nums' }}>{cuadra ? '✓ 0' : clp(diferencia)}</span>
              </div>
              {canEdit && (
                <>
                  {confirmDesc && !cuadra && <div style={{ fontSize: 12, color: '#B23A3A', background: '#FBE9E7', padding: '7px 10px', borderRadius: 6, marginBottom: 8 }}>Va a quedar <b>descuadrado</b> (diferencia {clp(diferencia)}). Pulsa otra vez para guardar igual.</div>}
                  <button onClick={guardar} disabled={saving} style={{ width: '100%', fontSize: 14, fontWeight: 600, padding: '10px', borderRadius: 8, border: 'none', cursor: saving ? 'default' : 'pointer', background: confirmDesc && !cuadra ? '#B23A3A' : '#1D9E75', color: '#fff', opacity: saving ? 0.7 : 1 }}>
                    {saving ? 'Guardando…' : (confirmDesc && !cuadra ? 'Guardar descuadrado' : 'Guardar clasificación')}
                  </button>
                  {savedFlag && <div style={{ textAlign: 'center', fontSize: 12, color: '#085041', marginTop: 6 }}>✓ Guardado</div>}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}
