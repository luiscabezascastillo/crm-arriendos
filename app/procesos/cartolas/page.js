'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import TopNav from '@/app/components/ui/TopNav'

const num = (v) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d.-]/g, '')) || 0)
const fmt = (v) => { const n = num(v); return n ? n.toLocaleString('es-CL') : (String(v ?? '').trim() === '0' ? '0' : '') }
const LIMITE = 50

// columnas editables (solo en filas NO-BI y solo para direccion/finanzas)
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

export default function CartolasVista() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [filtros, setFiltros] = useState({})       // {key:{search} | {min,max}}
  const [openF, setOpenF] = useState(null)          // {key,x,y}
  const [draft, setDraft] = useState({})            // borrador del popover abierto
  const [savingId, setSavingId] = useState(null)
  const [toast, setToast] = useState(null)
  const scrollRef = useRef(null)

  const rol = session?.user?.role
  const puedeEditar = rol === 'direccion' || rol === 'finanzas'

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(null), 1400) }

  useEffect(() => { if (status === 'unauthenticated') router.push('/api/auth/signin') }, [status, router])

  const fetchRows = async (fActuales = filtros) => {
    setRefreshing(true); setError(null)
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
    const { data, error } = await q.order('id', { ascending: false }).limit(LIMITE)
    if (error) { setError(error.message); setRefreshing(false); setLoading(false); return }
    setRows((data || []).reverse())   // recientes abajo
    setRefreshing(false); setLoading(false)
  }
  useEffect(() => { fetchRows({}) }, [])
  useEffect(() => { if (!loading && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight }, [loading])

  const activo = (key) => {
    const f = filtros[key]
    return !!f && ((f.search ?? '') !== '' || (f.min ?? '') !== '' || (f.max ?? '') !== '')
  }

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

  if (status === 'loading' || loading)
    return (<><TopNav /><div style={{ padding: 60, textAlign: 'center', color: '#888', fontSize: 14 }}>Cargando cuentas…</div></>)

  // ---- estilos por celda (BI / INICIO) ----
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

  // ---- popover de filtro (server-side) ----
  const popCol = openF ? COLS.find(c => c.key === openF.key) : null
  const abrirFiltro = (c, e) => {
    const rc = e.currentTarget.getBoundingClientRect()
    setDraft(filtros[c.key] || {})
    setOpenF(openF && openF.key === c.key ? null : { key: c.key, x: rc.left, y: rc.bottom + 2 })
  }
  const aplicarFiltro = () => {
    const nf = { ...filtros, [openF.key]: draft }
    setFiltros(nf); setOpenF(null); fetchRows(nf)
  }
  const quitarFiltro = () => {
    const nf = { ...filtros }; delete nf[openF.key]
    setFiltros(nf); setOpenF(null); fetchRows(nf)
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

  const hayFiltros = Object.keys(filtros).some(k => activo(k))

  return (
    <>
      <TopNav />
      <div style={{ maxWidth: 1760, margin: '0 auto', padding: '18px 20px 30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 10, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 2px', color: '#2C2C2A' }}>Cuentas (CARTOLAS)</h1>
            <div style={{ fontSize: 12, color: '#888780' }}>
              últimas {LIMITE}{hayFiltros ? ' (filtradas)' : ''} · filas BI no editables (se corrigen en BI)
              {!puedeEditar && ' · solo lectura'}
            </div>
          </div>
          <button onClick={() => fetchRows()} disabled={refreshing}
            style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: 'none', background: '#1D9E75', color: '#fff', cursor: 'pointer' }}>
            {refreshing ? 'Refrescando…' : 'Refrescar'}
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 10, fontSize: 11, color: '#5F5E5A', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><i style={{ width: 12, height: 12, background: '#fff', border: '0.5px solid #D3D1C7', borderRadius: 2 }} /> <b style={{ fontWeight: 700 }}>BI</b> = del banco (bloqueada)</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><i style={{ width: 12, height: 12, background: '#E9F4E4', border: '0.5px solid #C4E0BC', borderRadius: 2 }} /> INICIO = datos iniciales</span>
          {savingId && <span style={{ color: '#1D9E75' }}>guardando…</span>}
        </div>

        {error && <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: '#FDECEC', border: '0.5px solid #F1B0B0', color: '#9B1C1C', fontSize: 12 }}>{error}</div>}

        <div ref={scrollRef} style={{ overflow: 'auto', maxHeight: '74vh', border: '0.5px solid #D3D1C7', borderRadius: 8 }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, fontSize: 11, minWidth: 1700 }}>
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
          {rows.length} fila(s){hayFiltros ? ' que cumplen el filtro' : ''} · se muestran las {LIMITE} más recientes · recientes abajo.
        </div>
      </div>
      {renderPop()}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#2C2C2A', color: '#fff', fontSize: 13, padding: '10px 18px', borderRadius: 8, zIndex: 60, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          {toast}
        </div>
      )}
    </>
  )
}