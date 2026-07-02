'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import TopNav from '@/app/components/ui/TopNav'

const num = (v) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d.-]/g, '')) || 0)
const fmt = (v) => { const n = num(v); return n ? n.toLocaleString('es-CL') : (String(v ?? '').trim() === '0' ? '0' : '') }
const LIMITE = 50

const COLS = [
  { key: 'fecha',                  h: 'Fecha',          ro: true, w: 84,  align: 'left',  filt: true },
  { key: 'detalle_movimiento',     h: 'Detalle mov.',   ro: true, w: 230, align: 'left',  filt: true, wrap: true },
  { key: 'n_doc',                  h: 'N° Doc',         ro: true, w: 86,  align: 'left',  filt: true },
  { key: 'cargos',                 h: 'Cargo',          ro: true, w: 84,  align: 'right', money: true, color: '#9B1C1C', filt: true },
  { key: 'abonos',                 h: 'Abono',          ro: true, w: 84,  align: 'right', money: true, color: '#085041', filt: true },
  { key: 'saldos',                 h: 'Saldo',          ro: true, w: 92,  align: 'right', money: true, filt: true },
  { key: '_check1',                h: 'check1',         ro: true, w: 60,  align: 'right' },
  { key: 'check2_pasar_a_cartola', h: 'check2',         w: 78,  align: 'left',  filt: true },
  { key: 'reg',                    h: 'Reg',            ro: true, w: 62,  align: 'left',  filt: true },
  { key: 'unique_concept',         h: 'UNIQUE CONCEPT', w: 130, align: 'left', filt: true },
  { key: 'comentarios',            h: 'COMENTARIOS',    w: 180, align: 'left', filt: true, wrap: true },
  { key: 'trim',                   h: 'TRIM',           w: 60,  align: 'left', filt: true },
  { key: 'mes',                    h: 'MES',            w: 58,  align: 'left', filt: true },
  { key: 'liquidacion_mes2',       h: 'LIQ. MES2',      w: 80,  align: 'left', filt: true },
  { key: 'idadmon2',               h: 'IDADMON',        w: 84,  align: 'left', filt: true },
  { key: 'recibido',               h: 'RECIBIDO',       w: 86,  align: 'right', filt: true },
  { key: 'arriendo',               h: 'ARRIENDO',       w: 86,  align: 'right', filt: true },
  { key: 'discriminador',          h: 'DISCRIMINADOR',  w: 110, align: 'left', filt: true },
  { key: '_descuentos',            h: 'Descuento',      ro: true, w: 76, align: 'center' },
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

export default function BiVista() {
  const { status } = useSession()
  const router = useRouter()
  const [rows, setRows] = useState([])               // ascendente por id: antiguos arriba, recientes abajo
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
  const [copiando, setCopiando] = useState(false)
  const [descOpen, setDescOpen] = useState(null)   // { row, x, y, modo } popover de descuentos
  const [descRows, setDescRows] = useState([])
  const [descLoading, setDescLoading] = useState(false)
  const [descQuery, setDescQuery] = useState('')   // buscador libre dentro del popover
  const scrollRef = useRef(null)
  const anclarAbajo = useRef(false)
  const pendingAdjust = useRef(null)

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(null), 1400) }

  useEffect(() => { if (status === 'unauthenticated') router.push('/api/auth/signin') }, [status, router])

  const activo = (key) => { const f = filtros[key]; return !!f && (f.search ?? '') !== '' }
  const hayFiltros = Object.keys(filtros).some(k => activo(k))

  const buildQuery = (fActuales) => {
    let q = supabase.from('bi').select('*')
    for (const [key, f] of Object.entries(fActuales)) {
      if (!f || key === '_check1') continue
      if ((f.search ?? '') !== '') q = q.ilike(key, `%${f.search}%`)
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

  // Guarda primero lo que se esté editando (celda con foco) y LUEGO refresca.
  // Sin esto, si el usuario escribe en una celda y pulsa el botón sin salir
  // de ella, el onBlur no llega a dispararse y la recarga borra lo escrito.
  const guardarYRefrescar = async () => {
    const ae = document.activeElement
    if (ae && ae.tagName === 'INPUT') {
      ae.blur()                                   // dispara el onBlur -> guardarCelda
      await new Promise(res => setTimeout(res, 350)) // esperar a que guarde en Supabase
    }
    fetchInitial()
  }

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

  // check1: detector de saltos/duplicados del extracto. Solo SIN filtros.
  const filas = useMemo(() => {
    if (hayFiltros) return rows.map(r => ({ ...r, _check1: null }))
    return rows.map((r, i) => {
      if (i === 0) return { ...r, _check1: null }
      const prev = rows[i - 1]
      const c1 = Math.round(num(prev.saldos) - num(r.cargos) + num(r.abonos) - num(r.saldos))
      return { ...r, _check1: c1 }
    })
  }, [rows, hayFiltros])

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
      if (d.invalidos?.length) {
        const regs = d.invalidos.map(x => x.reg).filter(Boolean).join(', ')
        setError(
          `ERROR: se ha colocado "FALTA" a ${d.invalidos.length} movimiento(s) NO asociado(s) a un IDADMON válido (Axxxxx). ` +
          `NO se han pasado a CARTOLAS y siguen en FALTA. Corrígelos en BI` + (regs ? ` (Reg: ${regs}).` : '.')
        )
      }
      flash(`✓ ${d.copiados} copiado(s) a CUENTAS`)
      fetchInitial()
    } catch (err) {
      setError('No se pudo copiar: ' + err.message)
    } finally { setCopiando(false) }
  }

  // Parte B: localizar el descuento que justifica un movimiento y pegar su
  // texto_para_contabilidad en UNIQUE CONCEPT. Dos modos:
  //  - abono con IDADMON  -> descuentos de ese IDADMON
  //  - egreso (cargo)     -> descuentos con monto_a_transferir = cargo (candidatos por importe)
  // Lectura server-side (service role) para no depender del RLS de descuentos.
  const buscarDescuentos = async ({ monto, q }) => {
    setDescLoading(true)
    try {
      const p = new URLSearchParams()
      if (monto != null) p.set('monto', String(monto))
      if (q) p.set('q', q)
      const res = await fetch(`/api/descuentos/buscar?${p.toString()}`)
      const d = await res.json()
      setDescRows(d.rows || [])
    } catch { setDescRows([]) }
    finally { setDescLoading(false) }
  }

  const abrirDescuentos = async (r, e) => {
    const rc = e.currentTarget.getBoundingClientRect()
    if (descOpen && descOpen.row?.id === r.id) { setDescOpen(null); return }
    const idadmon = String(r.idadmon2 || '').trim().toUpperCase()
    const cargo = num(r.cargos)
    const modo = cargo > 0 ? 'importe' : 'idadmon'
    setDescOpen({ row: r, x: rc.left, y: rc.bottom + 2, modo })
    setDescRows([]); setDescQuery('')
    if (modo === 'importe') await buscarDescuentos({ monto: Math.round(cargo) })
    else if (idadmon) {
      setDescLoading(true)
      try {
        const res = await fetch(`/api/descuentos/por-idadmon?idadmon=${encodeURIComponent(idadmon)}`)
        const d = await res.json()
        setDescRows(d.rows || [])
      } catch { setDescRows([]) }
      finally { setDescLoading(false) }
    }
  }

  // Pega el texto_para_contabilidad del descuento elegido en UNIQUE CONCEPT de la fila.
  const usarEnUniqueConcept = async (d) => {
    if (!descOpen?.row) return
    const txt = String(d.texto_para_contabilidad || '').trim()
    if (!txt) return
    const actual = String(descOpen.row.unique_concept || '').trim()
    // si ya hay un texto de contabilidad (empieza por "num Axxxxx"), pedir confirmación
    const yaTieneTexto = /^\d+\s+A\d{5}\b/.test(actual)
    if (yaTieneTexto && !confirm(`UNIQUE CONCEPT ya tiene:\n\n${actual}\n\n¿Reemplazar por?\n\n${txt}`)) return
    await guardarCelda(descOpen.row.id, 'unique_concept', txt)
    setDescOpen(null)
  }

  const copiarTexto = async (t) => {
    const txt = String(t ?? '')
    if (!txt) return
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(txt)
      } else {
        const ta = document.createElement('textarea')
        ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0'
        document.body.appendChild(ta); ta.select()
        document.execCommand('copy'); document.body.removeChild(ta)
      }
      flash('✓ Texto copiado')
    } catch { /* si falla, no rompemos nada */ }
  }

  if (status === 'loading' || loading)
    return (<><TopNav /><div style={{ padding: 60, textAlign: 'center', color: '#888', fontSize: 14 }}>Cargando movimientos…</div></>)

  const abonos = filas.filter(r => num(r.abonos) > 0).length
  const cargos = filas.filter(r => num(r.cargos) > 0).length
  const sinId = filas.filter(r => num(r.abonos) > 0 && !String(r.idadmon2 || r.unique_concept || '').trim()).length
  const errChk = filas.filter(r => r._check1 != null && r._check1 !== 0).length

  const cell = (r, c) => {
    if (c.key === '_check1') return r._check1 == null
      ? <span style={{ color: '#B4B2A9' }}>—</span>
      : <span style={{ fontWeight: 600, color: r._check1 === 0 ? '#1D9E75' : '#9B1C1C' }}>{r._check1}</span>
    if (c.key === '_descuentos') {
      const tieneId = String(r.idadmon2 || '').trim() !== ''
      const esEgreso = num(r.cargos) > 0
      if (!tieneId && !esEgreso) return <span style={{ color: '#B4B2A9' }}>—</span>
      const abierto = descOpen && descOpen.row?.id === r.id
      return (
        <button onClick={(e) => abrirDescuentos(r, e)}
          title={esEgreso
            ? 'Buscar el descuento que justifica este egreso (por importe) y pegar su texto en UNIQUE CONCEPT'
            : 'Ver el/los texto(s) para contabilidad del descuento de este IDADMON'}
          style={{ border: '0.5px solid #C8C5BC', background: abierto ? '#E6F1FB' : '#fff', borderRadius: 6, cursor: 'pointer', fontSize: 11, padding: '2px 7px' }}>📋</button>
      )
    }
    if (!c.ro) return (
      <input value={r[c.key] ?? ''} title={r[c.key] ?? ''} onChange={e => onLocal(r.id, c.key, e.target.value)}
        onFocus={e => { e.target.dataset.orig = (r[c.key] ?? ''); e.target.style.border = '1px solid #1D9E75'; e.target.style.background = '#fff' }}
        onBlur={e => {
          const orig = e.target.dataset.orig ?? ''
          const actual = e.target.value ?? ''
          e.target.style.border = '1px solid transparent'; e.target.style.background = 'transparent'
          if (orig !== actual) guardarCelda(r.id, c.key, actual)
        }}
        style={{ width: '100%', border: '1px solid transparent', borderRadius: 4, padding: '2px 4px', fontSize: 11, background: 'transparent', textAlign: c.align, color: '#2C2C2A', boxSizing: 'border-box' }} />
    )
    if (c.money) { const s = fmt(r[c.key]); return <span title={s || ''} style={{ color: s && c.color ? c.color : '#2C2C2A' }}>{s || '—'}</span> }
    return <span title={r[c.key] ?? ''}>{r[c.key] ?? '—'}</span>
  }

  // ---- popover de filtro (server-side, contiene) ----
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
            <input autoFocus value={draft.search ?? ''} onChange={e => setDraft(d => ({ ...d, search: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') aplicarFiltro() }} placeholder="contiene…"
              style={{ width: '100%', fontSize: 12, padding: '5px 6px', border: '0.5px solid #D3D1C7', borderRadius: 5, boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', borderTop: '0.5px solid #EDEBE4' }}>
            <button onClick={quitarFiltro} style={{ fontSize: 11, border: '0.5px solid #D3D1C7', background: '#fff', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>Quitar</button>
            <button onClick={aplicarFiltro} style={{ fontSize: 11, border: 'none', background: '#1D9E75', color: '#fff', borderRadius: 6, padding: '4px 14px', cursor: 'pointer' }}>Aplicar</button>
          </div>
        </div>
      </>
    )
  }

  // ---- popover de descuentos (texto para contabilidad, con copiar) ----
  const renderPopDescuentos = () => {
    if (!descOpen) return null
    const W = 460
    const left = Math.min(descOpen.x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - W - 12)
    const r = descOpen.row
    const cargo = num(r?.cargos)
    const esImporte = descOpen.modo === 'importe'
    const unico = !descLoading && descRows.length === 1   // precarga: único candidato
    return (
      <>
        <div onClick={() => setDescOpen(null)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
        <div style={{ position: 'fixed', left, top: descOpen.y, width: W, maxHeight: 420, overflow: 'auto', background: '#fff', border: '0.5px solid #B4B2A9', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,.15)', zIndex: 41, fontSize: 12 }}>
          <div style={{ padding: '8px 10px', borderBottom: '0.5px solid #EDEBE4', fontWeight: 600, color: '#5F5E5A', position: 'sticky', top: 0, background: '#fff' }}>
            {esImporte
              ? <>Egreso de <b>{fmt(cargo)}</b> · descuentos con transferir = {fmt(cargo)}</>
              : <>Descuentos de {String(r?.idadmon2 || '').trim().toUpperCase()}</>}
          </div>

          {/* buscador para navegar (por IDADMON, N° o texto) */}
          <div style={{ padding: '8px 10px', borderBottom: '0.5px solid #F0EEE8', display: 'flex', gap: 6 }}>
            <input value={descQuery} onChange={e => setDescQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && descQuery.trim()) buscarDescuentos({ q: descQuery.trim() }) }}
              placeholder="Buscar por IDADMON, N° o texto…"
              style={{ flex: 1, border: '1px solid #C8C5BC', borderRadius: 6, padding: '4px 8px', fontSize: 12 }} />
            <button onClick={() => descQuery.trim() && buscarDescuentos({ q: descQuery.trim() })}
              style={{ border: 'none', background: '#5F6B7A', color: '#fff', borderRadius: 6, cursor: 'pointer', fontSize: 11, padding: '4px 10px' }}>Buscar</button>
            {esImporte && (
              <button onClick={() => { setDescQuery(''); buscarDescuentos({ monto: Math.round(cargo) }) }}
                title="Volver a los candidatos por importe"
                style={{ border: '0.5px solid #C8C5BC', background: '#fff', color: '#5F5E5A', borderRadius: 6, cursor: 'pointer', fontSize: 11, padding: '4px 8px' }}>↺ importe</button>
            )}
          </div>

          {descLoading
            ? <div style={{ padding: 12, color: '#888780' }}>Cargando…</div>
            : descRows.length === 0
              ? <div style={{ padding: 12, color: '#888780' }}>
                  {esImporte ? 'Ningún descuento con ese importe. Usa el buscador para localizarlo.' : 'Sin resultados.'}
                </div>
              : descRows.map((d, i) => (
                <div key={i} style={{ padding: '8px 10px', borderBottom: '0.5px solid #F0EEE8', display: 'flex', gap: 8, alignItems: 'flex-start', background: unico ? '#F3FAF6' : '#fff' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: '#888780', marginBottom: 2 }}>
                      N° {d.num || '—'} · {d.idadmon || ''} · {d.tipo || ''} · transferir {fmt(d.monto_a_transferir)}{unico ? ' · (único candidato)' : ''}
                    </div>
                    <div style={{ color: '#2C2C2A', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                      {d.texto_para_contabilidad || <span style={{ color: '#B4B2A9' }}>(sin texto de contabilidad)</span>}
                    </div>
                  </div>
                  {d.texto_para_contabilidad && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                      <button onClick={() => usarEnUniqueConcept(d)} title="Pegar este texto en UNIQUE CONCEPT de la fila"
                        style={{ border: 'none', background: '#1D9E75', color: '#fff', borderRadius: 6, cursor: 'pointer', fontSize: 11, padding: '4px 8px', whiteSpace: 'nowrap' }}>Usar este</button>
                      <button onClick={() => copiarTexto(d.texto_para_contabilidad)} title="Solo copiar al portapapeles"
                        style={{ border: 'none', background: '#E6F1FB', color: '#0C447C', borderRadius: 6, cursor: 'pointer', fontSize: 11, padding: '4px 8px' }}>📋</button>
                    </div>
                  )}
                </div>
              ))
          }
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
            <div style={{ fontSize: 12, color: '#888780' }}>recientes abajo · sube para cargar más{hayFiltros ? ' · filtrado (check1 oculto)' : ''} · edita desde UNIQUE CONCEPT · los cambios se guardan solos al salir de la celda (✓ Guardado)</div>
          </div>
          <button onClick={() => router.push('/procesos/bi')}
            style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, border: '0.5px solid #D3D1C7', background: '#fff', cursor: 'pointer', color: '#2C2C2A', whiteSpace: 'nowrap' }}>← Cargar cartola</button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 10, fontSize: 11, color: '#5F5E5A', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><i style={{ width: 12, height: 12, background: '#EAF2FB', border: '0.5px solid #B9D4EE', borderRadius: 2 }} /> Abono ({abonos})</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><i style={{ width: 12, height: 12, background: '#FBECEC', border: '0.5px solid #E9B9B9', borderRadius: 2 }} /> Cargo ({cargos})</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><i style={{ width: 12, height: 12, background: '#FEF7D6', border: '0.5px solid #E6D58A', borderRadius: 2 }} /> Sin identificar ({sinId})</span>
          {!hayFiltros && errChk > 0 && <span style={{ color: '#9B1C1C', fontWeight: 600 }}>⚠ check1 ≠ 0 en {errChk}</span>}
          {savingId && <span style={{ color: '#1D9E75' }}>guardando…</span>}
        </div>

        {error && <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: '#FDECEC', border: '0.5px solid #F1B0B0', color: '#9B1C1C', fontSize: 12 }}>{error}</div>}

        {/* BARRA DE ACCIONES */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12, alignItems: 'center' }}>
          <button onClick={guardarYRefrescar} disabled={refreshing}
            style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: 'none', background: '#1D9E75', color: '#fff', cursor: 'pointer' }}>
            {refreshing ? 'Actualizando…' : '🔄 Refrescar lista'}
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

        <div ref={scrollRef} onScroll={onScroll} style={{ overflow: 'auto', maxHeight: '72vh', border: '0.5px solid #D3D1C7', borderRadius: 8 }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, fontSize: 11, minWidth: 1600 }}>
            <thead>
              <tr style={{ background: '#F1EFE8' }}>
                {COLS.map((c, i) => (
                  <th key={i} style={{ padding: '6px 8px', textAlign: c.align, fontWeight: 600, color: '#5F5E5A', whiteSpace: 'nowrap', minWidth: c.w, position: 'sticky', top: 0, background: '#F1EFE8', zIndex: 3, borderBottom: '0.5px solid #D3D1C7' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {c.h}
                      {c.filt && (
                        <button onClick={(e) => abrirFiltro(c, e)} title="Filtrar"
                          style={{ border: 'none', background: activo(c.key) ? '#1D9E75' : 'transparent', color: activo(c.key) ? '#fff' : '#888780', borderRadius: 4, cursor: 'pointer', fontSize: 10, lineHeight: 1, padding: '2px 4px' }}>▾</button>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loadingMore && <tr><td colSpan={COLS.length} style={{ padding: 8, textAlign: 'center', color: '#888780' }}>Cargando más…</td></tr>}
              {!loadingMore && noMore && filas.length > 0 && <tr><td colSpan={COLS.length} style={{ padding: 6, textAlign: 'center', color: '#B4B2A9', fontSize: 10 }}>— inicio de la tabla —</td></tr>}
              {filas.map((r) => (
                <tr key={r.id}>
                  {COLS.map((c, ci) => (
                    <td key={ci} style={{ padding: c.ro ? '5px 8px' : '2px 4px', textAlign: c.align, whiteSpace: c.wrap ? 'normal' : 'nowrap', background: bgCelda(ci, r), color: ci === I_REG ? '#1A1A1A' : '#2C2C2A', fontWeight: ci === I_REG ? 600 : 400, borderBottom: '0.5px solid #EDEBE4', maxWidth: c.w + 60, overflow: 'hidden', textOverflow: c.wrap ? 'clip' : 'ellipsis' }}>
                      {cell(r, c)}
                    </td>
                  ))}
                </tr>
              ))}
              {filas.length === 0 && <tr><td colSpan={COLS.length} style={{ padding: 24, textAlign: 'center', color: '#888780' }}>Sin resultados con esos filtros.</td></tr>}
            </tbody>
          </table>
        </div>

        <div style={{ fontSize: 11, color: '#888780', marginTop: 8 }}>
          {filas.length} fila(s) cargada(s){hayFiltros ? ' (filtradas)' : ''} · {noMore ? 'no hay más hacia atrás' : 'sube para cargar más'} · check1 0 (verde) ok; rojo = posible línea saltada/duplicada (solo sin filtros).
        </div>
      </div>
      {renderPop()}
      {renderPopDescuentos()}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#2C2C2A', color: '#fff', fontSize: 13, padding: '10px 18px', borderRadius: 8, zIndex: 60, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          {toast}
        </div>
      )}
    </>
  )
}