'use client'
// VERSION: v3 · 2026-07-21 · Cartola IDADMON: proporcional colapsado (details), números sin $ con separador de miles y fuente monoespaciada, más altura para movimientos (cabeceras ya sticky).
// VERSION: v2 · 2026-07-20 · Aviso de proporcional: coteja el cargo contra datos_arriendos.proporcional (el dato con que se carga el inicio), no contra el recálculo. Recálculo de calendario queda como info. Tolerancia ±100; avisa si falta respaldo en LOG.

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import TopNav from '@/app/components/ui/TopNav'

const num = (v) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d.-]/g, '')) || 0)
const fmt = (v) => { const n = num(v); return n ? n.toLocaleString('es-CL') : (String(v ?? '').trim() === '0' ? '0' : '') }
const money = (v) => { const n = num(v); return n ? '$' + n.toLocaleString('es-CL') : '$0' }
const LIMITE = 50

const EDITABLES = ['idadmon', 'concepto', 'comentarios', 'calif', 'estado']

const COLS = [
  { key: 'fecha',         h: 'Fecha',        w: 90,  align: 'left'  },
  { key: 'idadmon',       h: 'IDADMON',      w: 84,  align: 'left'  },
  { key: 'concepto',      h: 'Concepto',     w: 240, align: 'left', wrap: true },
  { key: 'cargo',         h: 'Cargo',        w: 90,  align: 'right', money: true, color: '#9B1C1C' },
  { key: 'abono',         h: 'Abono',        w: 90,  align: 'right', money: true, color: '#085041' },
  { key: 'saldo',         h: 'Saldo',        w: 90,  align: 'right', money: true },
  { key: 'comentarios',   h: 'Comentarios',  w: 170, align: 'left', wrap: true },
  { key: 'calif',         h: 'Calif',        w: 88,  align: 'left'  },
  { key: 'justificantes', h: 'Justificantes',w: 120, align: 'left'  },
  { key: 'estado',        h: 'Estado',       w: 70,  align: 'left'  },
  { key: 'propietario',   h: 'Propietario',  w: 190, align: 'left', wrap: true },
  { key: 'inmueble',      h: 'Inmueble',     w: 200, align: 'left', wrap: true },
  { key: 'updated_at',    h: 'updated_at',   w: 130, align: 'left'  },
  { key: 'sync_hash',     h: 'sync_hash',    w: 120, align: 'left'  },
  { key: 'sync_id',       h: 'sync_id',      w: 110, align: 'left'  },
]

// parsea "dd/mm/aaaa" -> número comparable (aaaammdd); vacío -> 0
const fechaOrden = (s) => {
  const m = String(s ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return 0
  return Number(m[3]) * 10000 + Number(m[2]) * 100 + Number(m[1])
}

export default function CartolasPage() {
  const [vista, setVista] = useState('tabla')   // 'tabla' | 'idadmon'
  return (
    <>
      <TopNav />
      <div style={{ maxWidth: 1760, margin: '0 auto', padding: '14px 20px 0' }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 2 }}>
          {[['tabla', 'Tabla'], ['idadmon', 'Cartola por IDADMON']].map(([k, label]) => (
            <button key={k} onClick={() => setVista(k)}
              style={{
                fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: '8px 8px 0 0',
                border: '0.5px solid #D3D1C7', borderBottom: vista === k ? '2px solid #fff' : '0.5px solid #D3D1C7',
                marginBottom: vista === k ? -1 : 0,
                background: vista === k ? '#fff' : '#F1EFE8',
                color: vista === k ? '#2C2C2A' : '#888780', cursor: 'pointer',
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {vista === 'tabla' ? <TablaVista /> : <CartolaIdadmonVista />}
    </>
  )
}

/* ============================================================
   VISTA 1 — TABLA (espejo de cuentas, scroll infinito + filtros)
   ============================================================ */
function TablaVista() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [noMore, setNoMore] = useState(false)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [filtros, setFiltros] = useState({})
  const [openF, setOpenF] = useState(null)
  const [draft, setDraft] = useState({})
  const [savingId, setSavingId] = useState(null)
  const [toast, setToast] = useState(null)
  // Chequeo de duplicados (modal)
  const [dupOpen, setDupOpen] = useState(false)
  const [dupLoading, setDupLoading] = useState(false)
  const [dupErr, setDupErr] = useState(null)
  const [dupGrupos, setDupGrupos] = useState([])
  const [dupSel, setDupSel] = useState(() => new Set())   // ids marcados para borrar
  const [dupBorrando, setDupBorrando] = useState(false)
  const [dupDesde, setDupDesde] = useState('')            // YYYY-MM-DD (input date)
  const [dupHasta, setDupHasta] = useState('')            // YYYY-MM-DD (input date)
  const [dupEscaneado, setDupEscaneado] = useState(false) // ya se corrió al menos un escaneo
  const [dupResumen, setDupResumen] = useState(null)      // { totalGrupos, totalSobrantes }
  const scrollRef = useRef(null)
  const anclarAbajo = useRef(false)
  const pendingAdjust = useRef(null)

  const rol = session?.user?.role
  const puedeEditar = rol === 'direccion' || rol === 'finanzas'

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(null), 1400) }

  useEffect(() => { if (status === 'unauthenticated') router.push('/api/auth/signin') }, [status, router])

  const buildQuery = (fActuales) => {
    let q = supabase.from('cuentas').select('*')
    for (const [key, f] of Object.entries(fActuales)) {
      if (!f) continue
      const col = COLS.find(c => c.key === key)
      if (col?.money) {
        if ((f.min ?? '') !== '') q = q.gte(key, Number(f.min))
        if ((f.max ?? '') !== '') q = q.lte(key, Number(f.max))
      } else if ((f.search ?? '') !== '') {
        q = q.ilike(key, `%${f.search}%`)
      }
    }
    return q
  }

  const fetchInitial = async (fActuales = filtros) => {
    setRefreshing(true); setError(null); setNoMore(false)
    const { data, error } = await buildQuery(fActuales).order('id', { ascending: false }).limit(LIMITE)
    if (error) { setError(error.message); setRefreshing(false); setLoading(false); return }
    const arr = (data || []).reverse()
    anclarAbajo.current = true
    setRows(arr)
    setNoMore((data || []).length < LIMITE)
    setRefreshing(false); setLoading(false)
  }
  useEffect(() => { fetchInitial({}) }, [])

  const loadMore = async () => {
    if (loadingMore || noMore || loading || rows.length === 0) return
    setLoadingMore(true)
    const minId = rows[0].id
    const el = scrollRef.current
    const prevH = el ? el.scrollHeight : 0
    const prevT = el ? el.scrollTop : 0
    const { data, error } = await buildQuery(filtros).lt('id', minId).order('id', { ascending: false }).limit(LIMITE)
    if (error) { setError(error.message); setLoadingMore(false); return }
    const nuevos = (data || []).reverse()
    if (nuevos.length > 0) {
      pendingAdjust.current = { prevH, prevT }
      setRows(rs => [...nuevos, ...rs])
    }
    if ((data || []).length < LIMITE) setNoMore(true)
    setLoadingMore(false)
  }

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (pendingAdjust.current) {
      const { prevH, prevT } = pendingAdjust.current
      el.scrollTop = prevT + (el.scrollHeight - prevH)
      pendingAdjust.current = null
    } else if (anclarAbajo.current) {
      el.scrollTop = el.scrollHeight
      anclarAbajo.current = false
    }
  }, [rows])

  const onScroll = (e) => { if (e.currentTarget.scrollTop <= 40) loadMore() }

  const activo = (key) => {
    const f = filtros[key]
    return !!f && ((f.search ?? '') !== '' || (f.min ?? '') !== '' || (f.max ?? '') !== '')
  }
  const hayFiltros = Object.keys(filtros).some(k => activo(k))

  const filaEsBI = (r) => String(r.comentarios || '').trim().toUpperCase() === 'BI'
  const celdaEditable = (r, c) => puedeEditar && !filaEsBI(r) && EDITABLES.includes(c.key)

  const guardarCelda = async (id, k, valor) => {
    const v = valor === '' ? null : valor
    setSavingId(id)
    const { error } = await supabase.from('cuentas').update({ [k]: v }).eq('id', id)
    setSavingId(null)
    if (error) { setError('No se pudo guardar: ' + error.message); return }
    setRows(rs => rs.map(r => r.id === id ? { ...r, [k]: v } : r))
    flash('✓ Guardado')
  }
  const onLocal = (id, k, v) => setRows(rs => rs.map(r => r.id === id ? { ...r, [k]: v } : r))

  // ── Chequeo de duplicados ─────────────────────────────────────────────
  // Duplicado = fila idéntica a otra en fecha·idadmon·concepto·cargo·abono·saldo·comentarios
  // (NO se compara el folio `calif` ni `justificantes`). Se conserva la de menor id.
  // Se busca por RANGO de fechas para revisar y borrar por tramos (nunca todo de golpe).
  const abrirDuplicados = () => {
    setDupOpen(true); setDupErr(null); setDupGrupos([]); setDupSel(new Set())
    setDupEscaneado(false); setDupResumen(null)
  }

  const escanearDuplicados = async () => {
    setDupLoading(true); setDupErr(null); setDupGrupos([]); setDupSel(new Set()); setDupResumen(null)
    try {
      const params = new URLSearchParams()
      if (dupDesde) params.set('desde', dupDesde)
      if (dupHasta) params.set('hasta', dupHasta)
      const res = await fetch('/api/cartolas/duplicados?' + params.toString())
      const data = await res.json()
      if (!res.ok) { setDupErr(data.error || 'Error al detectar'); setDupLoading(false); setDupEscaneado(true); return }
      const grupos = data.grupos || []
      const sel = new Set()
      for (const g of grupos) g.filas.slice(1).forEach(f => sel.add(f.id))
      setDupGrupos(grupos); setDupSel(sel)
      setDupResumen({ totalGrupos: data.totalGrupos || grupos.length, totalSobrantes: data.totalSobrantes || sel.size })
    } catch { setDupErr('Error de conexión') }
    setDupLoading(false); setDupEscaneado(true)
  }

  const toggleDup = (id) => setDupSel(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
  })

  const eliminarDuplicados = async () => {
    const ids = [...dupSel]
    if (ids.length === 0) return
    if (!window.confirm(`Se eliminarán ${ids.length} fila(s) duplicada(s) de CUENTAS en el rango elegido. Se conserva siempre la primera (id más bajo) de cada grupo. Esta acción no se puede deshacer. ¿Continuar?`)) return
    setDupBorrando(true); setDupErr(null)
    try {
      const res = await fetch('/api/cartolas/duplicados', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      const data = await res.json()
      if (!res.ok) { setDupErr(data.error || 'Error al eliminar'); setDupBorrando(false); return }
      flash(`✓ ${data.borrados} fila(s) eliminada(s)`)
      setDupBorrando(false)
      await escanearDuplicados()   // re-escanea el mismo rango para ver lo que quede
      fetchInitial()               // refresca la tabla principal
    } catch { setDupErr('Error de conexión'); setDupBorrando(false) }
  }

  // Borrado MASIVO por rango: no manda ids (evita el cuelgue del navegador con miles
  // de checkboxes). El servidor recalcula los sobrantes del rango y los borra en lotes.
  const eliminarRango = async () => {
    const total = dupResumen?.totalSobrantes || 0
    if (!total) return
    if (!window.confirm(`Se eliminarán TODOS los sobrantes del rango ${dupDesde || '(inicio)'} → ${dupHasta || '(fin)'}: ${total} fila(s). Se conserva siempre la primera (id más bajo) de cada grupo. Esta acción no se puede deshacer. ¿Continuar?`)) return
    setDupBorrando(true); setDupErr(null)
    try {
      const res = await fetch('/api/cartolas/duplicados', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modo: 'rango', desde: dupDesde, hasta: dupHasta }),
      })
      const data = await res.json()
      if (!res.ok) { setDupErr(data.error || 'Error al eliminar'); setDupBorrando(false); return }
      flash(`✓ ${data.borrados} fila(s) eliminada(s)`)
      setDupBorrando(false)
      await escanearDuplicados()   // re-escanea el rango (debería quedar limpio)
      fetchInitial()
    } catch { setDupErr('Error de conexión'); setDupBorrando(false) }
  }

  if (status === 'loading' || loading)
    return (<div style={{ padding: 60, textAlign: 'center', color: '#888', fontSize: 14 }}>Cargando cuentas…</div>)

  const bgCelda = (r, c) => {
    if (String(r.calif || '').trim().toUpperCase() === 'INICIO' && (c.key === 'idadmon' || c.key === 'concepto' || c.key === 'cargo'))
      return '#E9F4E4'
    return '#fff'
  }
  const estiloTexto = (r, c) => {
    if (filaEsBI(r)) {
      if (c.key === 'comentarios') return { fontWeight: 700 }
      if (c.key === 'calif') return { color: '#B8860B', fontWeight: 600 }
    }
    return {}
  }

  const cell = (r, c) => {
    if (celdaEditable(r, c)) return (
      <input value={r[c.key] ?? ''} onChange={e => onLocal(r.id, c.key, e.target.value)}
        onBlur={e => { if ((r[c.key] ?? '') !== e.target.value) guardarCelda(r.id, c.key, e.target.value) }}
        onFocus={e => { e.target.style.border = '1px solid #1D9E75'; e.target.style.background = '#fff' }}
        onBlurCapture={e => { e.target.style.border = '1px solid transparent'; e.target.style.background = 'transparent' }}
        style={{ width: '100%', border: '1px solid transparent', borderRadius: 4, padding: '2px 4px', fontSize: 11, background: 'transparent', textAlign: c.align, color: '#2C2C2A', boxSizing: 'border-box' }} />
    )
    if (c.money) { const s = fmt(r[c.key]); return <span style={{ color: s && c.color ? c.color : '#2C2C2A' }}>{s || '—'}</span> }
    return <span style={estiloTexto(r, c)}>{r[c.key] ?? '—'}</span>
  }

  const popCol = openF ? COLS.find(c => c.key === openF.key) : null
  const abrirFiltro = (c, e) => {
    const rc = e.currentTarget.getBoundingClientRect()
    setDraft(filtros[c.key] || {})
    setOpenF(openF && openF.key === c.key ? null : { key: c.key, x: rc.left, y: rc.bottom + 2 })
  }
  const aplicarFiltro = () => {
    const nf = { ...filtros, [openF.key]: draft }
    setFiltros(nf); setOpenF(null); fetchInitial(nf)
  }
  const quitarFiltro = () => {
    const nf = { ...filtros }; delete nf[openF.key]
    setFiltros(nf); setOpenF(null); fetchInitial(nf)
  }
  const renderPop = () => {
    if (!openF || !popCol) return null
    const c = popCol
    const left = Math.min(openF.x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 260)
    return (
      <>
        <div onClick={() => setOpenF(null)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
        <div style={{ position: 'fixed', left, top: openF.y, width: 248, background: '#fff', border: '0.5px solid #B4B2A9', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,.15)', zIndex: 41, fontSize: 12 }}>
          <div style={{ padding: 10 }}>
            <div style={{ fontWeight: 600, color: '#5F5E5A', marginBottom: 6 }}>Filtrar: {c.h}</div>
            {c.money ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={draft.min ?? ''} onChange={e => setDraft(d => ({ ...d, min: e.target.value }))} placeholder="≥ min" inputMode="numeric"
                  style={{ width: '50%', fontSize: 12, padding: '5px 6px', border: '0.5px solid #D3D1C7', borderRadius: 5, boxSizing: 'border-box' }} />
                <input value={draft.max ?? ''} onChange={e => setDraft(d => ({ ...d, max: e.target.value }))} placeholder="≤ max" inputMode="numeric"
                  style={{ width: '50%', fontSize: 12, padding: '5px 6px', border: '0.5px solid #D3D1C7', borderRadius: 5, boxSizing: 'border-box' }} />
              </div>
            ) : (
              <input autoFocus value={draft.search ?? ''} onChange={e => setDraft(d => ({ ...d, search: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') aplicarFiltro() }} placeholder="contiene…"
                style={{ width: '100%', fontSize: 12, padding: '5px 6px', border: '0.5px solid #D3D1C7', borderRadius: 5, boxSizing: 'border-box' }} />
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', borderTop: '0.5px solid #EDEBE4' }}>
            <button onClick={quitarFiltro} style={{ fontSize: 11, border: '0.5px solid #D3D1C7', background: '#fff', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>Quitar</button>
            <button onClick={aplicarFiltro} style={{ fontSize: 11, border: 'none', background: '#1D9E75', color: '#fff', borderRadius: 6, padding: '4px 14px', cursor: 'pointer' }}>Aplicar</button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div style={{ maxWidth: 1760, margin: '0 auto', padding: '8px 20px 30px' }}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 2px', color: '#2C2C2A' }}>Cuentas (CARTOLAS)</h1>
            <div style={{ fontSize: 12, color: '#888780' }}>
              recientes abajo · sube para cargar más{hayFiltros ? ' · filtrado' : ''}
              {!puedeEditar && ' · solo lectura'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 8 }}>
            <button onClick={abrirDuplicados}
              title="Buscar filas duplicadas en CUENTAS (por rango de fechas)"
              style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: '0.5px solid #D3D1C7', background: '#fff', color: '#5F5E5A', cursor: 'pointer' }}>
              🔍 Duplicados
            </button>
            <button onClick={() => fetchInitial()} disabled={refreshing}
              style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: 'none', background: '#1D9E75', color: '#fff', cursor: 'pointer' }}>
              {refreshing ? 'Refrescando…' : 'Refrescar'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 10, fontSize: 11, color: '#5F5E5A', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><i style={{ width: 12, height: 12, background: '#fff', border: '0.5px solid #D3D1C7', borderRadius: 2 }} /> <b style={{ fontWeight: 700 }}>BI</b> = del banco (bloqueada)</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><i style={{ width: 12, height: 12, background: '#E9F4E4', border: '0.5px solid #C4E0BC', borderRadius: 2 }} /> INICIO = datos iniciales</span>
          {savingId && <span style={{ color: '#1D9E75' }}>guardando…</span>}
        </div>

        {error && <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: '#FDECEC', border: '0.5px solid #F1B0B0', color: '#9B1C1C', fontSize: 12 }}>{error}</div>}

        <div ref={scrollRef} onScroll={onScroll} style={{ overflow: 'auto', maxHeight: '74vh', border: '0.5px solid #D3D1C7', borderRadius: 8 }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, fontSize: 11, minWidth: 1700, fontVariantNumeric: 'tabular-nums' }}>
            <thead>
              <tr style={{ background: '#F1EFE8' }}>
                {COLS.map((c, i) => (
                  <th key={i} style={{ padding: '6px 8px', textAlign: c.align, fontWeight: 600, color: '#5F5E5A', whiteSpace: 'nowrap', minWidth: c.w, position: 'sticky', top: 0, background: '#F1EFE8', zIndex: 3, borderBottom: '0.5px solid #D3D1C7' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {c.h}
                      <button onClick={(e) => abrirFiltro(c, e)} title="Filtrar"
                        style={{ border: 'none', background: activo(c.key) ? '#1D9E75' : 'transparent', color: activo(c.key) ? '#fff' : '#888780', borderRadius: 4, cursor: 'pointer', fontSize: 10, lineHeight: 1, padding: '2px 4px' }}>▾</button>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loadingMore && <tr><td colSpan={COLS.length} style={{ padding: 8, textAlign: 'center', color: '#888780' }}>Cargando más…</td></tr>}
              {!loadingMore && noMore && rows.length > 0 && <tr><td colSpan={COLS.length} style={{ padding: 6, textAlign: 'center', color: '#B4B2A9', fontSize: 10 }}>— inicio de la tabla —</td></tr>}
              {rows.map((r) => (
                <tr key={r.id}>
                  {COLS.map((c, ci) => (
                    <td key={ci} style={{ padding: celdaEditable(r, c) ? '2px 4px' : '5px 8px', textAlign: c.align, whiteSpace: c.wrap ? 'normal' : 'nowrap', background: bgCelda(r, c), color: '#2C2C2A', borderBottom: '0.5px solid #EDEBE4', maxWidth: c.w + 60, overflow: 'hidden', textOverflow: c.wrap ? 'clip' : 'ellipsis' }}>
                      {cell(r, c)}
                    </td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={COLS.length} style={{ padding: 24, textAlign: 'center', color: '#888780' }}>Sin resultados con esos filtros.</td></tr>}
            </tbody>
          </table>
        </div>

        <div style={{ fontSize: 11, color: '#888780', marginTop: 8 }}>
          {rows.length} fila(s) cargada(s){hayFiltros ? ' (filtradas)' : ''} · {noMore ? 'no hay más hacia atrás' : 'sube para cargar más'}.
        </div>
      </div>
      {renderPop()}
      {dupOpen && (
        <>
          <div onClick={() => !dupBorrando && setDupOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 70 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(1040px, 96vw)', maxHeight: '88vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.25)', zIndex: 71 }}>
            <div style={{ padding: '14px 18px', borderBottom: '0.5px solid #E4E2DA', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#2C2C2A' }}>Duplicados en CUENTAS</div>
                <div style={{ fontSize: 11, color: '#888780' }}>Idénticas en fecha · IDADMON · concepto · cargo · abono · comentarios · calif (no se comparan saldo ni justificantes). Se conserva la de menor id.</div>
              </div>
              <button onClick={() => !dupBorrando && setDupOpen(false)}
                style={{ border: 'none', background: '#F1EFE8', color: '#5F5E5A', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Cerrar</button>
            </div>

            {/* Rango de fechas + Escanear */}
            <div style={{ padding: '12px 18px', borderBottom: '0.5px solid #E4E2DA', display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
              <label style={{ fontSize: 11, color: '#5F5E5A', display: 'flex', flexDirection: 'column', gap: 3 }}>
                Desde
                <input type="date" value={dupDesde} onChange={e => setDupDesde(e.target.value)}
                  style={{ fontSize: 12, padding: '5px 8px', border: '0.5px solid #D3D1C7', borderRadius: 6 }} />
              </label>
              <label style={{ fontSize: 11, color: '#5F5E5A', display: 'flex', flexDirection: 'column', gap: 3 }}>
                Hasta
                <input type="date" value={dupHasta} onChange={e => setDupHasta(e.target.value)}
                  style={{ fontSize: 12, padding: '5px 8px', border: '0.5px solid #D3D1C7', borderRadius: 6 }} />
              </label>
              <button onClick={escanearDuplicados} disabled={dupLoading}
                style={{ fontSize: 12, fontWeight: 700, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#1D9E75', color: '#fff', cursor: 'pointer' }}>
                {dupLoading ? 'Escaneando…' : '🔍 Escanear'}
              </button>
              <div style={{ fontSize: 10.5, color: '#888780', flex: 1, minWidth: 180 }}>
                Deja las fechas en blanco para escanear TODO (no recomendado: son ~29.000 sobrantes). Revisa y borra por tramos (año a año).
              </div>
            </div>

            {/* Resumen */}
            {dupResumen && !dupLoading && (
              <div style={{ padding: '8px 18px', background: '#FBF7EC', borderBottom: '0.5px solid #E4E2DA', fontSize: 12, color: '#8a6d1e', fontWeight: 600 }}>
                Rango {dupDesde || '(inicio)'} → {dupHasta || '(fin)'}: {dupResumen.totalGrupos} grupo(s) con duplicados · {dupResumen.totalSobrantes} fila(s) sobrante(s).
              </div>
            )}

            <div style={{ padding: '14px 18px', overflow: 'auto' }}>
              {dupLoading && <div style={{ padding: 30, textAlign: 'center', color: '#888780', fontSize: 13 }}>Escaneando el rango…</div>}
              {dupErr && <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: '#FDECEC', border: '0.5px solid #F1B0B0', color: '#9B1C1C', fontSize: 12 }}>{dupErr}</div>}
              {!dupLoading && !dupErr && !dupEscaneado && (
                <div style={{ padding: 30, textAlign: 'center', color: '#888780', fontSize: 13 }}>Elige un rango de fechas y pulsa <b>Escanear</b>.</div>
              )}
              {!dupLoading && !dupErr && dupEscaneado && dupGrupos.length === 0 && (
                <div style={{ padding: 30, textAlign: 'center', color: '#1D9E75', fontSize: 14, fontWeight: 600 }}>✓ No se encontraron duplicados en este rango.</div>
              )}
              {!dupLoading && dupGrupos.length > 150 && (
                <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: '#EFF6FF', border: '0.5px solid #93C5FD', color: '#1447C3', fontSize: 12 }}>
                  Mostrando los primeros 150 de {dupGrupos.length} grupos (para no saturar el navegador). El botón <b>“Eliminar TODOS los sobrantes del rango”</b> borra el total, no solo lo que ves aquí.
                </div>
              )}
              {!dupLoading && dupGrupos.slice(0, 150).map((g, gi) => (
                <div key={gi} style={{ border: '0.5px solid #E4E2DA', borderRadius: 8, marginBottom: 10, overflow: 'hidden' }}>
                  <div style={{ background: '#FBF7EC', padding: '6px 10px', fontSize: 11, color: '#8a6d1e', fontWeight: 600 }}>
                    Grupo {gi + 1} · {g.filas.length} filas idénticas · {g.filas[0].fecha} · {g.filas[0].idadmon || '—'}
                  </div>
                  {/* Cabecera de columnas (hasta CALIF) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 10px', background: '#F7F5EF', fontSize: 9.5, fontWeight: 700, color: '#888780', textTransform: 'uppercase' }}>
                    <div style={{ width: 78, flexShrink: 0 }}>Acción</div>
                    <div style={{ width: 74, flexShrink: 0 }}>Fecha</div>
                    <div style={{ width: 64, flexShrink: 0 }}>IDADMON</div>
                    <div style={{ flex: 1, minWidth: 0 }}>Concepto</div>
                    <div style={{ width: 78, textAlign: 'right', flexShrink: 0 }}>Cargo</div>
                    <div style={{ width: 78, textAlign: 'right', flexShrink: 0 }}>Abono</div>
                    <div style={{ width: 130, flexShrink: 0 }}>Comentarios</div>
                    <div style={{ width: 70, flexShrink: 0 }}>Calif</div>
                    <div style={{ width: 44, textAlign: 'right', flexShrink: 0 }}>id</div>
                  </div>
                  {g.filas.map((f, fi) => {
                    const conservar = fi === 0
                    const marcado = dupSel.has(f.id)
                    return (
                      <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', borderTop: '0.5px solid #EDEBE4', background: conservar ? '#F3FAF0' : (marcado ? '#FDF3F3' : '#fff'), fontSize: 11, color: '#2C2C2A' }}>
                        <div style={{ width: 78, flexShrink: 0 }}>
                          {conservar
                            ? <span style={{ fontSize: 10, fontWeight: 700, color: '#1D9E75' }}>CONSERVAR</span>
                            : <label style={{ fontSize: 10, fontWeight: 700, color: '#9B1C1C', display: 'flex', alignItems: 'center', gap: 5, cursor: puedeEditar ? 'pointer' : 'default' }}>
                                <input type="checkbox" checked={marcado} disabled={!puedeEditar} onChange={() => toggleDup(f.id)} /> BORRAR
                              </label>}
                        </div>
                        <div style={{ width: 74, flexShrink: 0 }}>{f.fecha || '—'}</div>
                        <div style={{ width: 64, flexShrink: 0 }}>{f.idadmon || '—'}</div>
                        <div style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={f.concepto || ''}>{f.concepto || '—'}</div>
                        <div style={{ width: 78, textAlign: 'right', color: '#9B1C1C', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{fmt(f.cargo) || '—'}</div>
                        <div style={{ width: 78, textAlign: 'right', color: '#085041', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{fmt(f.abono) || '—'}</div>
                        <div style={{ width: 130, flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={f.comentarios || ''}>{f.comentarios || '—'}</div>
                        <div style={{ width: 70, flexShrink: 0, color: '#B8860B', fontWeight: 600 }}>{f.calif || '—'}</div>
                        <div style={{ width: 44, textAlign: 'right', fontSize: 10, color: '#B4B2A9', flexShrink: 0 }}>#{f.id}</div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>

            {!dupLoading && dupGrupos.length > 0 && (
              <div style={{ padding: '12px 18px', borderTop: '0.5px solid #E4E2DA', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 12, color: '#5F5E5A' }}>
                  {dupResumen?.totalGrupos ?? dupGrupos.length} grupo(s) · {dupResumen?.totalSobrantes ?? 0} sobrante(s) en el rango
                  {!puedeEditar && <span style={{ color: '#9B1C1C' }}> · solo lectura (no puedes borrar)</span>}
                </div>
                {puedeEditar && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button onClick={eliminarDuplicados} disabled={dupBorrando || dupSel.size === 0}
                      title="Borra solo las filas marcadas con la casilla BORRAR en la muestra visible"
                      style={{ fontSize: 12, fontWeight: 600, padding: '8px 14px', borderRadius: 8, border: '0.5px solid #D3D1C7', background: '#fff', color: dupSel.size === 0 ? '#B4B2A9' : '#C0392B', cursor: dupSel.size === 0 ? 'default' : 'pointer' }}>
                      {dupBorrando ? '…' : `Borrar marcados (${dupSel.size})`}
                    </button>
                    <button onClick={eliminarRango} disabled={dupBorrando || !(dupResumen?.totalSobrantes)}
                      title="Borra TODOS los sobrantes del rango (no solo lo visible). Conserva el id más bajo de cada grupo."
                      style={{ fontSize: 12, fontWeight: 700, padding: '8px 16px', borderRadius: 8, border: 'none', background: !(dupResumen?.totalSobrantes) ? '#D3D1C7' : '#C0392B', color: '#fff', cursor: !(dupResumen?.totalSobrantes) ? 'default' : 'pointer' }}>
                      {dupBorrando ? 'Eliminando…' : `🗑 Eliminar TODOS los sobrantes del rango (${dupResumen?.totalSobrantes ?? 0})`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#2C2C2A', color: '#fff', fontSize: 13, padding: '10px 18px', borderRadius: 8, zIndex: 60, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          {toast}
        </div>
      )}
    </>
  )
}

/* ============================================================
   VISTA 2 — CARTOLA POR IDADMON (= hoja ENTRADA del Excel)
   ============================================================ */
const MCOLS = [
  { key: 'fecha',     h: 'Fecha',     w: 90,  align: 'left'  },
  { key: 'concepto',  h: 'Concepto',  w: 320, align: 'left'  },
  { key: 'cargo',     h: 'Cargo',     w: 100, align: 'right', money: true, color: '#9B1C1C' },
  { key: 'abono',     h: 'Abono',     w: 100, align: 'right', money: true, color: '#085041' },
  { key: '_saldo',    h: 'Saldo',     w: 110, align: 'right', money: true },
  { key: 'comentarios', h: 'Comentarios', w: 160, align: 'left' },
  { key: 'calif',     h: 'Calif',     w: 90,  align: 'left'  },
  { key: 'justificantes', h: 'Justificantes', w: 130, align: 'left' },
]

// Proporcional del PRIMER mes, calculado desde datos_arriendos:
//  - día de inicio inclusive · base = días reales del mes
//  - condición especial (cantidad): SIEMPRE en pesos (no se convierte por UF)
//  - cuota normal: si unid='UF' se convierte con la UF del mes de inicio (indices_mensuales)
const MESES_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
function calcProporcional(f, ufMesInicio) {
  if (!f || !f.fecha_inicio) return null
  const s = String(f.fecha_inicio).slice(0, 10)          // 'YYYY-MM-DD'
  const [Y, M, D] = s.split('-').map(Number)
  if (!Y || !M || !D) return null
  const diasMes = new Date(Y, M, 0).getDate()            // último día del mes M (1-based)
  const diasCobrar = diasMes - D + 1                     // inclusive
  const especial = num(f.cantidad) > 0
  const esUF = String(f.unid || '').trim().toUpperCase() === 'UF'

  let renta, faltaUF = false
  if (especial) {
    renta = num(f.cantidad)                              // condición especial: siempre pesos
  } else if (esUF) {
    if (!ufMesInicio) { faltaUF = true; renta = 0 }      // no hay UF del mes de inicio en indices_mensuales
    else renta = Math.round(num(f.cuota) * ufMesInicio)
  } else {
    renta = num(f.cuota)                                 // cuota en pesos
  }
  if (renta <= 0 && !faltaUF) return null

  const prop = faltaUF ? null : Math.round(renta * diasCobrar / diasMes)
  return {
    prop, renta, diasCobrar, diasMes, especial, esUF, faltaUF,
    ufMesInicio: ufMesInicio || null, cuotaUF: esUF ? num(f.cuota) : null,
    mesNombre: MESES_ES[M - 1], anio: Y, dia: D,
    inicioDia1: D === 1,
  }
}

function CartolaIdadmonVista() {
  const { status } = useSession()
  const router = useRouter()
  const [idInput, setIdInput] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState(null)
  const [ficha, setFicha] = useState(null)      // fila de datos_arriendos
  const [movs, setMovs] = useState([])          // movimientos con _saldo corrido
  const [consultado, setConsultado] = useState(false)
  const [aviso, setAviso] = useState(null)      // "en TÉRMINO" / "HISTÓRICO"
  const [ufMesInicio, setUfMesInicio] = useState(null)   // valor_uf del mes de inicio (indices_mensuales)

  useEffect(() => { if (status === 'unauthenticated') router.push('/api/auth/signin') }, [status, router])

  const buscar = async () => {
    const id = idInput.trim().toUpperCase()
    if (!id) return
    setBuscando(true); setError(null); setAviso(null); setConsultado(true)
    setFicha(null); setMovs([]); setUfMesInicio(null)

    // 1) ficha en datos_arriendos (idadmon es único -> una fila)
    const { data: da, error: e1 } = await supabase
      .from('datos_arriendos')
      .select('idadmon, estado, propietario, arrendatario, avalista, inmueble, garantia_pedida, quien_tiene_garantia, fecha_inicio, cuota, meses, cantidad, unid, proporcional')
      .eq('idadmon', id)
      .limit(1)
    if (e1) { setError('Error leyendo ficha: ' + e1.message); setBuscando(false); return }
    const f = (da && da[0]) || null
    setFicha(f)
    if (f) {
      const est = String(f.estado || '').trim().toUpperCase()
      if (est === 'Q') setAviso('Este IDADMON está en ESTADO Q (TÉRMINO).')
      else if (est === 'N') setAviso('Este IDADMON está en ESTADO N (HISTÓRICO).')

      // UF del mes de inicio (origen: indices_mensuales, día 1 del mes de inicio)
      // Solo se necesita si el contrato es UF y no hay condición especial.
      if (f.fecha_inicio && String(f.unid || '').trim().toUpperCase() === 'UF' && !(num(f.cantidad) > 0)) {
        const mes1 = String(f.fecha_inicio).slice(0, 7) + '-01'   // 'YYYY-MM-01'
        const { data: im } = await supabase
          .from('indices_mensuales')
          .select('valor_uf')
          .eq('mes', mes1)
          .limit(1)
        if (im && im[0]) setUfMesInicio(num(im[0].valor_uf))
      }
    }

    // 2) movimientos en cuentas
    const { data: cu, error: e2 } = await supabase
      .from('cuentas')
      .select('id, fecha, concepto, cargo, abono, comentarios, calif, justificantes')
      .eq('idadmon', id)
    if (e2) { setError('Error leyendo movimientos: ' + e2.message); setBuscando(false); return }

    // ordenar por fecha real ascendente (fecha es texto dd/mm/aaaa); empate -> por id
    const ordenados = (cu || []).slice().sort((a, b) => {
      const fa = fechaOrden(a.fecha), fb = fechaOrden(b.fecha)
      if (fa !== fb) return fa - fb
      return (a.id || 0) - (b.id || 0)
    })
    // saldo corrido desde 0: saldo = saldo_anterior + cargo - abono
    let saldo = 0
    const conSaldo = ordenados.map(m => {
      saldo = saldo + num(m.cargo) - num(m.abono)
      return { ...m, _saldo: saldo }
    })
    setMovs(conSaldo)
    setBuscando(false)
  }

  const onKey = (e) => { if (e.key === 'Enter') buscar() }

  const filaEsBI = (r) => String(r.comentarios || '').trim().toUpperCase() === 'BI'
  const esInicio = (r) => String(r.calif || '').trim().toUpperCase() === 'INICIO'
  const saldoTotal = movs.length ? movs[movs.length - 1]._saldo : 0

  // Proporcional del primer mes.
  //  - propCalc: recálculo estándar de calendario (cuota × UF × días) → SOLO informativo.
  //  - propLog: datos_arriendos.proporcional → es el dato REAL con el que cc1Inicios carga el
  //    inicio, así que el cotejo de descuadre se hace contra ESTE, no contra el recálculo.
  const propCalc = calcProporcional(ficha, ufMesInicio)
  const propLog = num(ficha?.proporcional)
  const filaPropCartola = movs.find(m => esInicio(m) && /PROPORCIONAL/i.test(String(m.concepto || '')))
  const TOL_PROP = 100   // misma tolerancia que cc1Inicios (redondeos)
  const cargoProp = filaPropCartola ? num(filaPropCartola.cargo) : null
  const faltaRespaldoLog = !!filaPropCartola && !(propLog > 0)   // hay línea en cartola pero LOG sin proporcional
  const descuadre = !!filaPropCartola && !(propCalc && propCalc.inicioDia1) && (
    faltaRespaldoLog ? true : Math.abs(cargoProp - propLog) > TOL_PROP
  )

  const Dato = ({ label, value, strong }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
      <span style={{ fontSize: 10, color: '#888780', textTransform: 'uppercase', letterSpacing: '.03em' }}>{label}</span>
      <span style={{ fontSize: 13, color: '#2C2C2A', fontWeight: strong ? 700 : 500, whiteSpace: 'normal', wordBreak: 'break-word' }}>{value || '—'}</span>
    </div>
  )

  const cellMov = (r, c) => {
    if (c.key === '_saldo') return <span style={{ fontWeight: 600, color: r._saldo < 0 ? '#9B1C1C' : '#2C2C2A' }}>{money(r._saldo)}</span>
    if (c.money) { const s = fmt(r[c.key]); return <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: s && c.color ? c.color : '#2C2C2A' }}>{s || '—'}</span> }
    if (c.key === 'comentarios') return <span style={{ fontWeight: filaEsBI(r) ? 700 : 400 }}>{r[c.key] ?? '—'}</span>
    if (c.key === 'calif') return <span style={{ color: filaEsBI(r) ? '#B8860B' : '#2C2C2A', fontWeight: filaEsBI(r) ? 600 : 400 }}>{r[c.key] ?? '—'}</span>
    return <span>{r[c.key] ?? '—'}</span>
  }
  const bgMov = (r, c) => (esInicio(r) && (c.key === 'concepto' || c.key === 'cargo')) ? '#E9F4E4' : '#fff'

  if (status === 'loading')
    return (<div style={{ padding: 60, textAlign: 'center', color: '#888', fontSize: 14 }}>Cargando…</div>)

  return (
    <div style={{ maxWidth: 1760, margin: '0 auto', padding: '8px 20px 30px' }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 10px', color: '#2C2C2A' }}>Cartola por IDADMON</h1>

      {/* BUSCADOR */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <input value={idInput} onChange={e => setIdInput(e.target.value)} onKeyDown={onKey}
          placeholder="IDADMON (ej. A00857)" autoFocus
          style={{ fontSize: 14, padding: '8px 12px', border: '0.5px solid #B4B2A9', borderRadius: 8, width: 200, textTransform: 'uppercase' }} />
        <button onClick={buscar} disabled={buscando}
          style={{ fontSize: 13, fontWeight: 600, padding: '8px 18px', borderRadius: 8, border: 'none', background: '#1D9E75', color: '#fff', cursor: 'pointer' }}>
          {buscando ? 'Buscando…' : 'Ver cuenta'}
        </button>
      </div>

      {error && <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: '#FDECEC', border: '0.5px solid #F1B0B0', color: '#9B1C1C', fontSize: 12 }}>{error}</div>}
      {aviso && <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: '#FEF3C7', border: '0.5px solid #FCD34D', color: '#92400E', fontSize: 12, fontWeight: 600 }}>⚠ {aviso}</div>}

      {consultado && !buscando && !ficha && !error && (
        <div style={{ padding: 16, borderRadius: 8, background: '#F1EFE8', color: '#5F5E5A', fontSize: 13 }}>
          No se encontró el IDADMON <b>{idInput.trim().toUpperCase()}</b> en datos_arriendos.
        </div>
      )}

      {ficha && (
        <>
          {/* CABECERA */}
          <div style={{ border: '0.5px solid #D3D1C7', borderRadius: 10, padding: '14px 16px', marginBottom: 14, background: '#F8FAFC' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#0C447C' }}>{ficha.idadmon}</span>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 20, background: '#E6F1FB', color: '#0C447C' }}>Estado: {ficha.estado || '—'}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: '#888780', textTransform: 'uppercase', letterSpacing: '.03em' }}>Saldo total</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: saldoTotal < 0 ? '#9B1C1C' : '#085041' }}>{money(saldoTotal)}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px 18px' }}>
              <Dato label="Propietario" value={ficha.propietario} strong />
              <Dato label="Arrendatario" value={ficha.arrendatario} strong />
              <Dato label="Avalista" value={ficha.avalista} />
              <Dato label="Inmueble" value={ficha.inmueble} />
              <Dato label="Garantía" value={ficha.garantia_pedida ? money(ficha.garantia_pedida) : null} />
              <Dato label="Quién tiene la garantía" value={ficha.quien_tiene_garantia} />
            </div>
          </div>

          {/* PROPORCIONAL PRIMER MES (calculado desde datos_arriendos) · colapsado por defecto */}
          {propCalc && (
            <details style={{ border: '0.5px solid ' + (descuadre ? '#FCD34D' : '#CDE3CD'), borderRadius: 10, marginBottom: 14, background: descuadre ? '#FEF3C7' : '#F0F7F0' }}>
              <summary style={{ cursor: 'pointer', padding: '8px 16px', fontSize: 12, color: descuadre ? '#92400E' : '#5F5E5A', fontWeight: 600, listStyle: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{descuadre ? '⚠ Proporcional del primer mes — revisar' : '✓ Proporcional del primer mes'}</span>
                <span style={{ fontWeight: 400, color: '#888780' }}>· ver detalle</span>
              </summary>
              <div style={{ padding: '4px 16px 12px' }}>
              <div style={{ fontSize: 10, color: '#888780', textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 6 }}>Proporcional del primer mes · calculado desde datos_arriendos</div>
              {propCalc.inicioDia1 ? (
                <div style={{ fontSize: 13, color: '#5F5E5A' }}>El contrato inicia el día 1 de {propCalc.mesNombre}: mes completo, sin proporcional.</div>
              ) : propCalc.faltaUF ? (
                <div style={{ fontSize: 13, color: '#92400E', fontWeight: 600 }}>
                  ⚠ Contrato en UF (cuota {propCalc.cuotaUF} UF) pero no hay valor_uf para {propCalc.mesNombre} {propCalc.anio} en indices_mensuales. No se puede calcular el proporcional.
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 13, color: '#2C2C2A' }}>
                    Renta base <b>{money(propCalc.renta)}</b>{' '}
                    {propCalc.especial
                      ? '(condición especial)'
                      : propCalc.esUF
                        ? `(${propCalc.cuotaUF} UF × ${money(propCalc.ufMesInicio)} UF de ${propCalc.mesNombre})`
                        : '(cuota normal)'} · {propCalc.diasCobrar} de {propCalc.diasMes} días de {propCalc.mesNombre} {propCalc.anio}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0C447C', marginTop: 2 }}>
                    Proporcional en el LOG (datos_arriendos): {propLog > 0 ? money(propLog) : '—'}
                  </div>
                  {filaPropCartola ? (
                    descuadre ? (
                      faltaRespaldoLog ? (
                        <div style={{ marginTop: 8, fontSize: 12, color: '#92400E', fontWeight: 600 }}>
                          ⚠ En la cartola figura {money(cargoProp)} ("{filaPropCartola.concepto}") pero el LOG no tiene proporcional cargado. Revisar el origen (datos_arriendos → campo proporcional), no aquí.
                        </div>
                      ) : (
                        <div style={{ marginTop: 8, fontSize: 12, color: '#92400E', fontWeight: 600 }}>
                          ⚠ En la cartola figura {money(cargoProp)} ("{filaPropCartola.concepto}"), pero el LOG dice {money(propLog)} (diferencia {money(Math.abs(cargoProp - propLog))}). Si es un error, corrígelo en el origen (datos_arriendos → CUENTAS), no aquí.
                        </div>
                      )
                    ) : (
                      <div style={{ marginTop: 8, fontSize: 12, color: '#085041', fontWeight: 600 }}>✓ El cargo de la cartola coincide con el proporcional del LOG.</div>
                    )
                  ) : (
                    <div style={{ marginTop: 8, fontSize: 12, color: '#888780' }}>No hay línea de proporcional (INICIO) en la cartola para comparar.</div>
                  )}
                  {propCalc.prop != null && (
                    <div style={{ marginTop: 8, fontSize: 11, color: '#888780' }}>
                      Info · proporcional de calendario: {money(propCalc.prop)} ({propCalc.diasCobrar}/{propCalc.diasMes} días de {propCalc.mesNombre}). Puede diferir del pactado si el contrato fija un pago especial (p. ej. incluir otro mes).
                    </div>
                  )}
                </>
              )}
              </div>
            </details>
          )}

          {/* MOVIMIENTOS */}
          <div style={{ overflow: 'auto', maxHeight: '72vh', border: '0.5px solid #D3D1C7', borderRadius: 8 }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: 0, fontSize: 12, minWidth: 980, width: '100%', fontVariantNumeric: 'tabular-nums' }}>
              <thead>
                <tr style={{ background: '#F1EFE8' }}>
                  {MCOLS.map((c, i) => (
                    <th key={i} style={{ padding: '7px 10px', textAlign: c.align, fontWeight: 600, color: '#5F5E5A', whiteSpace: 'nowrap', minWidth: c.w, position: 'sticky', top: 0, background: '#F1EFE8', zIndex: 2, borderBottom: '0.5px solid #D3D1C7' }}>{c.h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {movs.map((r) => (
                  <tr key={r.id}>
                    {MCOLS.map((c, ci) => (
                      <td key={ci} style={{ padding: '6px 10px', textAlign: c.align, whiteSpace: c.key === 'concepto' ? 'normal' : 'nowrap', background: bgMov(r, c), color: '#2C2C2A', borderBottom: '0.5px solid #EDEBE4' }}>
                        {cellMov(r, c)}
                      </td>
                    ))}
                  </tr>
                ))}
                {movs.length === 0 && <tr><td colSpan={MCOLS.length} style={{ padding: 24, textAlign: 'center', color: '#888780' }}>Sin movimientos en CUENTAS para este IDADMON.</td></tr>}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11, color: '#888780', marginTop: 8 }}>
            {movs.length} movimiento(s) · saldo corrido desde 0 (cargo suma, abono resta) · ordenados por fecha.
          </div>
        </>
      )}
    </div>
  )
}