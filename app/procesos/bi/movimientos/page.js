'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import TopNav from '@/app/components/ui/TopNav'

const num = (v) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d.-]/g, '')) || 0)
const fmt = (v) => { const n = num(v); return n ? n.toLocaleString('es-CL') : (String(v ?? '').trim() === '0' ? '0' : '') }
const CARGAR = 500

const COLS = [
  { key: 'fecha',                  h: 'Fecha',          ro: true, w: 84,  align: 'left',  filt: true },
  { key: 'detalle_movimiento',     h: 'Detalle mov.',   ro: true, w: 230, align: 'left',  filt: true, wrap: true },
  { key: 'n_doc',                  h: 'N° Doc',         ro: true, w: 86,  align: 'left',  filt: true, rango: true },
  { key: 'cargos',                 h: 'Cargo',          ro: true, w: 84,  align: 'right', money: true, color: '#9B1C1C', filt: true, rango: true },
  { key: 'abonos',                 h: 'Abono',          ro: true, w: 84,  align: 'right', money: true, color: '#085041', filt: true, rango: true },
  { key: 'saldos',                 h: 'Saldo',          ro: true, w: 92,  align: 'right', money: true, filt: true, rango: true },
  { key: '_check1',                h: 'check1',         ro: true, w: 60,  align: 'right', filt: true, rango: true },
  { key: 'check2_pasar_a_cartola', h: 'check2',         w: 78,  align: 'left',  filt: true },
  { key: 'reg',                    h: 'Reg',            w: 62,  align: 'left',  filt: true, rango: true },
  { key: 'unique_concept',         h: 'UNIQUE CONCEPT', w: 130, align: 'left', filt: true },
  { key: 'comentarios',            h: 'COMENTARIOS',    w: 180, align: 'left', filt: true, wrap: true },
  { key: 'trim',                   h: 'TRIM',           w: 60,  align: 'left', filt: true },
  { key: 'mes',                    h: 'MES',            w: 58,  align: 'left', filt: true },
  { key: 'liquidacion_mes2',       h: 'LIQ. MES2',      w: 80,  align: 'left', filt: true },
  { key: 'idadmon2',               h: 'IDADMON',        w: 84,  align: 'left', filt: true },
  { key: 'recibido',               h: 'RECIBIDO',       w: 86,  align: 'right', filt: true, rango: true },
  { key: 'arriendo',               h: 'ARRIENDO',       w: 86,  align: 'right', filt: true, rango: true },
  { key: 'discriminador',          h: 'DISCRIMINADOR',  w: 110, align: 'left', filt: true },
]
const I_REG = COLS.findIndex(c => c.key === 'reg')
const I_UC = COLS.findIndex(c => c.key === 'unique_concept')

function colorFila(m) {
  const ab = num(m.abonos), ca = num(m.cargos)
  if (ab > 0) return String(m.idadmon2 || m.unique_concept || '').trim() ? '#EAF2FB' : '#FEF7D6'
  if (ca > 0) return '#FBECEC'
  return '#fff'
}
function bgCelda(ci, r) {
  if (ci === I_REG) return '#C19A6B'
  if (ci >= I_UC) return colorFila(r)
  return '#fff'
}
const dispVal = (r, c) => c.key === '_check1' ? (r._check1 == null ? '' : String(r._check1))
  : c.money ? fmt(r[c.key]) : String(r[c.key] ?? '')
const rawNum = (r, c) => c.key === '_check1' ? (r._check1 ?? 0) : num(r[c.key])

export default function BiVista() {
  const { status } = useSession()
  const router = useRouter()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filtros, setFiltros] = useState({})        // {key:{search,sel,min,max}}
  const [openF, setOpenF] = useState(null)           // {key,x,y}
  const [savingId, setSavingId] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [toast, setToast] = useState(null)
  const [copiando, setCopiando] = useState(false)
  const scrollRef = useRef(null)

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(null), 1400) }

  useEffect(() => { if (status === 'unauthenticated') router.push('/api/auth/signin') }, [status, router])

  const cargar = (inicial) => {
    if (!inicial) setRefreshing(true)
    supabase.from('bi').select('*').order('id', { ascending: false }).limit(CARGAR)
      .then(({ data, error }) => {
        if (error) { setError(error.message); setLoading(false); setRefreshing(false); return }
        const ord = (data || []).reverse()
        for (let i = 0; i < ord.length; i++)
          ord[i]._check1 = i === 0 ? null : Math.round(num(ord[i - 1].saldos) - num(ord[i].cargos) + num(ord[i].abonos) - num(ord[i].saldos))
        setRows(ord); setLoading(false); setRefreshing(false)
      })
  }
  useEffect(() => { cargar(true) }, [])
  useEffect(() => { if (!loading && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight }, [loading])

  const upd = (key, patch) => setFiltros(f => ({ ...f, [key]: { ...(f[key] || {}), ...patch } }))
  const limpiar = (key) => setFiltros(f => { const n = { ...f }; delete n[key]; return n })
  const activo = (key) => { const f = filtros[key]; return !!f && ((f.search || '') !== '' || f.sel != null || (f.min ?? '') !== '' || (f.max ?? '') !== '') }

  const onLocal = (id, k, v) => setRows(rs => rs.map(r => r.id === id ? { ...r, [k]: v } : r))
  const guardarCelda = async (id, k, valor) => {
    const v = valor === '' ? null : valor
    setSavingId(id)
    const { error } = await supabase.from('bi').update({ [k]: v }).eq('id', id)
    setSavingId(null)
    if (error) { setError('No se pudo guardar: ' + error.message); return }
    setRows(rs => rs.map(r => r.id === id ? { ...r, [k]: v } : r))
    flash('✓ Guardado')
  }

  const copiarFaltan = async () => {
    if (copiando) return
    if (!confirm('¿Copiar a CUENTAS todos los movimientos en FALTA con IDADMON válido?')) return
    setCopiando(true); setError(null)
    try {
      const r = await fetch('/api/bi/copiar-cuentas', { method: 'POST' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Error en el servidor')

      // ERROR: movimientos en FALTA sin IDADMON valido (A + 5 digitos) -> NO se pasaron, siguen en FALTA
      if (d.invalidos?.length) {
        const regs = d.invalidos.map(x => x.reg).filter(Boolean).join(', ')
        setError(
          `ERROR: se ha colocado "FALTA" a ${d.invalidos.length} movimiento(s) NO asociado(s) a un IDADMON válido (Axxxxx). ` +
          `NO se han pasado a CARTOLAS y siguen en FALTA. Corrígelos en BI` +
          (regs ? ` (Reg: ${regs}).` : '.')
        )
      }
      flash(`✓ ${d.copiados} copiado(s) a CUENTAS`)
      if (d.idadmons_sin_match?.length)
        flash(`✓ ${d.copiados} copiado(s) · IDADMON sin ficha: ${d.idadmons_sin_match.join(', ')}`)
      cargar(false)
    } catch (err) {
      setError('No se pudo copiar: ' + err.message)
    } finally { setCopiando(false) }
  }

  if (status === 'loading' || loading)
    return (<><TopNav /><div style={{ padding: 60, textAlign: 'center', color: '#888', fontSize: 14 }}>Cargando movimientos…</div></>)

  const passCol = (r, c) => {
    const f = filtros[c.key]; if (!f) return true
    const d = dispVal(r, c)
    if (f.search && !d.toLowerCase().includes(f.search.toLowerCase())) return false
    if (f.sel && !f.sel.includes(d)) return false
    if (c.rango) {
      const n = rawNum(r, c)
      if ((f.min ?? '') !== '' && n < Number(f.min)) return false
      if ((f.max ?? '') !== '' && n > Number(f.max)) return false
    }
    return true
  }
  const visibles = rows.filter(r => COLS.every(c => passCol(r, c)))

  const abonos = rows.filter(r => num(r.abonos) > 0).length
  const cargos = rows.filter(r => num(r.cargos) > 0).length
  const sinId = rows.filter(r => num(r.abonos) > 0 && !String(r.idadmon2 || r.unique_concept || '').trim()).length
  const errChk = rows.filter(r => r._check1 != null && r._check1 !== 0).length

  const cell = (r, c) => {
    if (c.key === '_check1') return r._check1 == null
      ? <span style={{ color: '#B4B2A9' }}>—</span>
      : <span style={{ fontWeight: 600, color: r._check1 === 0 ? '#1D9E75' : '#9B1C1C' }}>{r._check1}</span>
    if (!c.ro) return (
      <input value={r[c.key] ?? ''} onChange={e => onLocal(r.id, c.key, e.target.value)}
        onBlur={e => { if ((r[c.key] ?? '') !== e.target.value) guardarCelda(r.id, c.key, e.target.value) }}
        onFocus={e => { e.target.style.border = '1px solid #1D9E75'; e.target.style.background = '#fff' }}
        onBlurCapture={e => { e.target.style.border = '1px solid transparent'; e.target.style.background = 'transparent' }}
        style={{ width: '100%', border: '1px solid transparent', borderRadius: 4, padding: '2px 4px', fontSize: 11, background: 'transparent', textAlign: c.align, color: '#2C2C2A', boxSizing: 'border-box' }} />
    )
    if (c.money) { const s = fmt(r[c.key]); return <span style={{ color: s && c.color ? c.color : '#2C2C2A' }}>{s || '—'}</span> }
    return <span>{r[c.key] ?? '—'}</span>
  }

  // ---- popover de filtro ----
  const popCol = openF ? COLS.find(c => c.key === openF.key) : null
  const renderPop = () => {
    if (!openF || !popCol) return null
    const c = popCol, key = c.key, f = filtros[key] || {}
    const uniq = [...new Set(rows.map(r => dispVal(r, c)))]
    uniq.sort((a, b) => c.rango ? (num(a) - num(b)) : a.localeCompare(b, 'es'))
    const search = f.search || ''
    const shown = search ? uniq.filter(v => v.toLowerCase().includes(search.toLowerCase())) : uniq
    const sel = f.sel
    const checked = (v) => sel == null || sel.includes(v)
    const toggle = (v) => {
      let cur = sel == null ? [...uniq] : [...sel]
      cur = cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v]
      upd(key, { sel: cur.length === uniq.length ? null : cur })
    }
    const left = Math.min(openF.x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 250)
    return (
      <>
        <div onClick={() => setOpenF(null)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
        <div style={{ position: 'fixed', left, top: openF.y, width: 240, maxHeight: 360, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#fff', border: '0.5px solid #B4B2A9', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,.15)', zIndex: 41, fontSize: 12 }}>
          <div style={{ padding: 8, borderBottom: '0.5px solid #EDEBE4' }}>
            <input autoFocus value={search} onChange={e => upd(key, { search: e.target.value })} placeholder="Buscar (contiene)…"
              style={{ width: '100%', fontSize: 12, padding: '4px 6px', border: '0.5px solid #D3D1C7', borderRadius: 5, boxSizing: 'border-box' }} />
            {c.rango && (
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <input value={f.min ?? ''} onChange={e => upd(key, { min: e.target.value })} placeholder="≥ min" inputMode="numeric"
                  style={{ width: '50%', fontSize: 11, padding: '3px 5px', border: '0.5px solid #D3D1C7', borderRadius: 5, boxSizing: 'border-box' }} />
                <input value={f.max ?? ''} onChange={e => upd(key, { max: e.target.value })} placeholder="≤ max" inputMode="numeric"
                  style={{ width: '50%', fontSize: 11, padding: '3px 5px', border: '0.5px solid #D3D1C7', borderRadius: 5, boxSizing: 'border-box' }} />
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, padding: '5px 8px', borderBottom: '0.5px solid #EDEBE4', fontSize: 11 }}>
            <button onClick={() => upd(key, { sel: null })} style={{ border: 'none', background: 'none', color: '#0C447C', cursor: 'pointer', padding: 0 }}>Seleccionar todo</button>
            <button onClick={() => upd(key, { sel: [] })} style={{ border: 'none', background: 'none', color: '#0C447C', cursor: 'pointer', padding: 0 }}>Ninguno</button>
          </div>
          <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
            {shown.map((v, i) => (
              <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={checked(v)} onChange={() => toggle(v)} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v === '' ? '(vacío)' : v}</span>
              </label>
            ))}
            {shown.length === 0 && <div style={{ padding: 8, color: '#888780' }}>sin valores</div>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', borderTop: '0.5px solid #EDEBE4' }}>
            <button onClick={() => { limpiar(key); setOpenF(null) }} style={{ fontSize: 11, border: '0.5px solid #D3D1C7', background: '#fff', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>Quitar filtro</button>
            <button onClick={() => setOpenF(null)} style={{ fontSize: 11, border: 'none', background: '#1D9E75', color: '#fff', borderRadius: 6, padding: '3px 12px', cursor: 'pointer' }}>Listo</button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <TopNav />
      <div style={{ maxWidth: 1640, margin: '0 auto', padding: '18px 20px 30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 10, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 2px', color: '#2C2C2A' }}>BI · Movimientos (tabla bi)</h1>
            <div style={{ fontSize: 12, color: '#888780' }}>últimos {rows.length} · recientes abajo · edita desde UNIQUE CONCEPT</div>
          </div>
          <button onClick={() => router.push('/procesos/bi')}
            style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, border: '0.5px solid #D3D1C7', background: '#fff', cursor: 'pointer', color: '#2C2C2A', whiteSpace: 'nowrap' }}>← Cargar cartola</button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 10, fontSize: 11, color: '#5F5E5A', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><i style={{ width: 12, height: 12, background: '#EAF2FB', border: '0.5px solid #B9D4EE', borderRadius: 2 }} /> Abono ({abonos})</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><i style={{ width: 12, height: 12, background: '#FBECEC', border: '0.5px solid #E9B9B9', borderRadius: 2 }} /> Cargo ({cargos})</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><i style={{ width: 12, height: 12, background: '#FEF7D6', border: '0.5px solid #E6D58A', borderRadius: 2 }} /> Sin identificar ({sinId})</span>
          {errChk > 0 && <span style={{ color: '#9B1C1C', fontWeight: 600 }}>⚠ check1 ≠ 0 en {errChk}</span>}
          {savingId && <span style={{ color: '#1D9E75' }}>guardando…</span>}
        </div>

        {error && <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: '#FDECEC', border: '0.5px solid #F1B0B0', color: '#9B1C1C', fontSize: 12 }}>{error}</div>}

        {/* BARRA DE ACCIONES */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12, alignItems: 'center' }}>
          <button onClick={() => cargar(false)} disabled={refreshing}
            style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: 'none', background: '#1D9E75', color: '#fff', cursor: 'pointer' }}>
            {refreshing ? 'Refrescando…' : 'Guardar / Refrescar'}
          </button>
          <span style={{ width: 1, height: 22, background: '#D3D1C7', margin: '0 4px' }} />
          {[
            ['Verificar si en CUENTAS', 'Verifica qué ingresos ya están en CUENTAS', null],
            ['Copiar FALTAN a CUENTAS', 'Exporta a CUENTAS los marcados FALTA (solo IDADMON válido)', copiarFaltan],
            ['Corregir en CUENTAS', 'Corrige en CUENTAS los marcados CORREGIR', null],
          ].map(([label, hint, accion], i) => {
            const habilitado = !!accion && !copiando
            return (
              <button key={i} title={hint} disabled={!habilitado}
                onClick={() => { if (accion) accion() }}
                style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: '1px solid ' + (habilitado ? '#6B4423' : '#C8C5BC'), background: habilitado ? '#8A5A2B' : '#D3D1C7', color: '#fff', cursor: habilitado ? 'pointer' : 'default' }}>
                {label}
              </button>
            )
          })}
        </div>

        <div ref={scrollRef} style={{ overflow: 'auto', maxHeight: '72vh', border: '0.5px solid #D3D1C7', borderRadius: 8 }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, fontSize: 11, minWidth: 1600 }}>
            <thead>
              <tr style={{ background: '#F1EFE8' }}>
                {COLS.map((c, i) => (
                  <th key={i} style={{ padding: '6px 8px', textAlign: c.align, fontWeight: 600, color: '#5F5E5A', whiteSpace: 'nowrap', minWidth: c.w, position: 'sticky', top: 0, background: '#F1EFE8', zIndex: 3, borderBottom: '0.5px solid #D3D1C7' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {c.h}
                      {c.filt && (
                        <button onClick={(e) => { const rc = e.currentTarget.getBoundingClientRect(); setOpenF(openF && openF.key === c.key ? null : { key: c.key, x: rc.left, y: rc.bottom + 2 }) }}
                          title="Filtrar"
                          style={{ border: 'none', background: activo(c.key) ? '#1D9E75' : 'transparent', color: activo(c.key) ? '#fff' : '#888780', borderRadius: 4, cursor: 'pointer', fontSize: 10, lineHeight: 1, padding: '2px 4px' }}>▾</button>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibles.map((r) => (
                <tr key={r.id}>
                  {COLS.map((c, ci) => (
                    <td key={ci} style={{ padding: c.ro ? '5px 8px' : '2px 4px', textAlign: c.align, whiteSpace: c.wrap ? 'normal' : 'nowrap', background: bgCelda(ci, r), color: ci === I_REG ? '#1A1A1A' : '#2C2C2A', fontWeight: ci === I_REG ? 600 : 400, borderBottom: '0.5px solid #EDEBE4', maxWidth: c.w + 60, overflow: 'hidden', textOverflow: c.wrap ? 'clip' : 'ellipsis' }}>
                      {cell(r, c)}
                    </td>
                  ))}
                </tr>
              ))}
              {visibles.length === 0 && <tr><td colSpan={COLS.length} style={{ padding: 24, textAlign: 'center', color: '#888780' }}>Sin resultados con esos filtros.</td></tr>}
            </tbody>
          </table>
        </div>

        <div style={{ fontSize: 11, color: '#888780', marginTop: 8 }}>
          {visibles.length} de {rows.length} visibles (últimos {CARGAR}) · check1 debe ser 0 (verde); en rojo = salto o dato mal colocado.
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
