// VERSION: v1 · 2026-07-13 · Vista SA (Financiero): tabla de movimientos + drawer de clasificación/descomposición.
'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import TopNav from '@/app/components/ui/TopNav'

// Quién puede EDITAR la clasificación (acciones sensibles de finanzas).
const EDITORES = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']
const CCB_SUGERIDOS = ['CC1', 'CC2', 'CC3', 'BB1', 'BB2', 'GG']

const ESTADO = {
  CUADRADO:       { bg: '#E1F5EE', color: '#085041', label: 'Cuadrado' },
  SIN_CLASIFICAR: { bg: '#F0EFEA', color: '#888780', label: 'Sin clasificar' },
  DESCUADRADO:    { bg: '#FBE9E7', color: '#B23A3A', label: 'Descuadrado' },
}

const clp = (n) => (n == null ? '—' : Number(n).toLocaleString('es-CL'))
const fmtFecha = (iso) => { if (!iso) return ''; const [y, m, d] = String(iso).slice(0, 10).split('-'); return `${d}/${m}/${y}` }

function Chip({ estado }) {
  const e = ESTADO[estado] || ESTADO.SIN_CLASIFICAR
  return <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 9px', borderRadius: 20, background: e.bg, color: e.color, whiteSpace: 'nowrap' }}>{e.label}</span>
}

function Card({ label, value, color }) {
  return (
    <div style={{ background: '#fff', border: '0.5px solid #E0DED6', borderRadius: 10, padding: '10px 14px', minWidth: 118, flex: '1 1 auto' }}>
      <div style={{ fontSize: 11, color: '#888780', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color || '#2C2C2A' }}>{value}</div>
    </div>
  )
}

export default function SaPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isMobile, setIsMobile] = useState(false)

  const [cargas, setCargas] = useState([])
  const [cargaId, setCargaId] = useState(null)
  const [movs, setMovs] = useState([])
  const [loading, setLoading] = useState(false)

  const [fEstado, setFEstado] = useState('')     // '' | CUADRADO | SIN_CLASIFICAR | DESCUADRADO
  const [fTexto, setFTexto] = useState('')

  const [sel, setSel] = useState(null)           // movimiento seleccionado (abre drawer)
  const [lineas, setLineas] = useState([])       // líneas en edición
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

  // cargar lista de cartolas
  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/financiero/sa').then(r => r.json()).then(d => {
      const list = d.cargas || []
      setCargas(list)
      if (list.length && cargaId == null) setCargaId(list[0].id)   // la más reciente
    }).catch(() => {})
  }, [status]) // eslint-disable-line

  // cargar movimientos de la cartola elegida
  const cargarMovs = (id) => {
    if (!id) return
    setLoading(true)
    fetch(`/api/financiero/sa?carga=${id}`).then(r => r.json()).then(d => {
      setMovs(d.movimientos || [])
    }).finally(() => setLoading(false))
  }
  useEffect(() => { if (cargaId) cargarMovs(cargaId) }, [cargaId])

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
    const q = fTexto.trim().toLowerCase()
    return movs.filter(m =>
      (!fEstado || m.estado_clasificacion === fEstado) &&
      (!q || (m.descripcion || '').toLowerCase().includes(q))
    )
  }, [movs, fEstado, fTexto])

  // abrir drawer → cargar líneas
  const abrir = (m) => {
    setSel(m); setSavedFlag(false); setConfirmDesc(false); setLineas([])
    fetch(`/api/financiero/sa?movimiento=${m.id}`).then(r => r.json()).then(d => {
      setLineas((d.lineas || []).map(l => ({ ...l })))
    })
  }
  const cerrar = () => { setSel(null); setLineas([]); setConfirmDesc(false) }

  const setLinea = (i, campo, val) => setLineas(ls => ls.map((l, k) => k === i ? { ...l, [campo]: val } : l))
  const addLinea = () => setLineas(ls => [...ls, { sub_orden: ls.length + 1, monto: '', ccb: '', cuenta_1: '', cuenta_2: '', concepto: '' }])
  const delLinea = (i) => setLineas(ls => ls.filter((_, k) => k !== i))

  const sumaLineas = useMemo(() => lineas.reduce((a, l) => a + (Number(l.monto) || 0), 0), [lineas])
  const cuadra = sel ? Math.abs(sumaLineas) === Math.abs(Number(sel.monto)) : false
  const diferencia = sel ? Math.abs(Number(sel.monto)) - Math.abs(sumaLineas) : 0

  const guardar = async () => {
    if (!sel) return
    if (!cuadra && !confirmDesc) { setConfirmDesc(true); return }
    setSaving(true)
    try {
      const payload = {
        movimiento_id: sel.id,
        lineas: lineas
          .filter(l => l.monto !== '' && l.monto != null)
          .map((l, i) => ({
            sub_orden: i + 1,
            monto: Math.round(Number(l.monto)),
            ccb: (l.ccb || '').trim() || null,
            cuenta_1: (l.cuenta_1 || '').trim() || null,
            cuenta_2: (l.cuenta_2 || '').trim() || null,
            concepto: (l.concepto || '').trim() || null,
          })),
      }
      const res = await fetch('/api/financiero/sa', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || 'No se pudo guardar'); return }
      setSavedFlag(true); setConfirmDesc(false)
      cargarMovs(cargaId)   // refresca chip + resumen
    } finally { setSaving(false) }
  }

  if (status === 'loading') return (<><TopNav /><div style={{ padding: 60, textAlign: 'center', color: '#888', fontSize: 14 }}>Cargando…</div></>)

  const cargaActual = cargas.find(c => c.id === cargaId)

  return (
    <>
      <TopNav />
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: isMobile ? '16px 12px 40px' : '20px 24px 48px' }}>

        {/* CABECERA */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: isMobile ? 18 : 20, fontWeight: 600, margin: '0 0 2px', color: '#2C2C2A' }}>SA · Banco Santander</h1>
            <div style={{ fontSize: 12, color: '#888780' }}>Movimientos y clasificación por Centro de Coste/Beneficio</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={cargaId || ''} onChange={e => setCargaId(Number(e.target.value))}
              style={{ fontSize: 13, padding: '7px 10px', borderRadius: 8, border: '0.5px solid #D3D1C7', background: '#fff', color: '#2C2C2A' }}>
              {cargas.map(c => (
                <option key={c.id} value={c.id}>
                  Cartola {c.nro_cartola} · {c.periodo}{c.tipo === 'provisoria' ? ' (provisoria)' : ''}
                </option>
              ))}
            </select>
            <button onClick={() => router.push('/procesos/financiero')}
              style={{ fontSize: 12, padding: '7px 12px', borderRadius: 8, border: '0.5px solid #D3D1C7', background: '#fff', cursor: 'pointer', color: '#2C2C2A', whiteSpace: 'nowrap' }}>← Financiero</button>
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

        {/* FILTROS */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <input value={fTexto} onChange={e => setFTexto(e.target.value)} placeholder="Buscar en la descripción…"
            style={{ flex: '1 1 220px', fontSize: 13, padding: '8px 11px', borderRadius: 8, border: '0.5px solid #D3D1C7' }} />
          {['', 'SIN_CLASIFICAR', 'DESCUADRADO', 'CUADRADO'].map(v => (
            <button key={v} onClick={() => setFEstado(v)}
              style={{ fontSize: 12, padding: '7px 12px', borderRadius: 8, cursor: 'pointer',
                border: fEstado === v ? '1px solid #1D9E75' : '0.5px solid #D3D1C7',
                background: fEstado === v ? '#E1F5EE' : '#fff', color: '#2C2C2A', fontWeight: fEstado === v ? 600 : 400 }}>
              {v === '' ? 'Todos' : (ESTADO[v]?.label || v)}
            </button>
          ))}
        </div>

        {/* TABLA MOVIMIENTOS */}
        <div style={{ border: '0.5px solid #E0DED6', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '78px 1fr 96px' : '92px 1fr 120px 60px 120px', gap: 0, background: '#F7F6F2', borderBottom: '0.5px solid #E0DED6', padding: '9px 12px', fontSize: 11, fontWeight: 600, color: '#888780' }}>
            <div>Fecha</div><div>Descripción</div><div style={{ textAlign: 'right' }}>Monto</div>
            {!isMobile && <div style={{ textAlign: 'center' }}>C/A</div>}
            {!isMobile && <div style={{ textAlign: 'center' }}>Estado</div>}
          </div>
          {loading ? (
            <div style={{ padding: 30, textAlign: 'center', color: '#888', fontSize: 13 }}>Cargando movimientos…</div>
          ) : movsFiltrados.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: '#888', fontSize: 13 }}>Sin movimientos para este filtro.</div>
          ) : movsFiltrados.map(m => (
            <div key={m.id} onClick={() => abrir(m)}
              style={{ display: 'grid', gridTemplateColumns: isMobile ? '78px 1fr 96px' : '92px 1fr 120px 60px 120px', gap: 0, padding: '9px 12px', fontSize: 13, color: '#2C2C2A', borderBottom: '0.5px solid #F0EFEA', cursor: 'pointer', alignItems: 'center' }}
              onMouseEnter={e => e.currentTarget.style.background = '#FAFAF7'}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
              <div style={{ color: '#888780', fontSize: 12 }}>{fmtFecha(m.fecha)}</div>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
                {m.descripcion || <span style={{ color: '#B4B2A9' }}>—</span>}
                {isMobile && <div style={{ marginTop: 3 }}><Chip estado={m.estado_clasificacion} /></div>}
              </div>
              <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: m.monto < 0 ? '#B23A3A' : '#085041', fontWeight: 500 }}>{clp(m.monto)}</div>
              {!isMobile && <div style={{ textAlign: 'center', color: '#888780', fontSize: 12 }}>{m.cargo_abono || '—'}</div>}
              {!isMobile && <div style={{ textAlign: 'center' }}><Chip estado={m.estado_clasificacion} /></div>}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: '#B4B2A9', marginTop: 8 }}>
          {cargaActual ? `Cartola ${cargaActual.nro_cartola} · ${fmtFecha(cargaActual.fecha_desde)} a ${fmtFecha(cargaActual.fecha_hasta)}` : ''}
          {'  ·  Pincha una fila para ver y clasificar sus líneas.'}
        </div>
      </div>

      {/* DRAWER */}
      {sel && (
        <>
          <div onClick={cerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.28)', zIndex: 40 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, height: '100vh', width: isMobile ? '100%' : 560, maxWidth: '100%', background: '#fff', zIndex: 41, boxShadow: '-4px 0 24px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column' }}>
            {/* cabecera drawer */}
            <div style={{ padding: '16px 18px', borderBottom: '0.5px solid #E0DED6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#888780' }}>{fmtFecha(sel.fecha)} · Cartola {cargaActual?.nro_cartola}</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#2C2C2A', marginTop: 2 }}>{sel.descripcion || '—'}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: sel.monto < 0 ? '#B23A3A' : '#085041' }}>{clp(sel.monto)}</div>
                </div>
                <button onClick={cerrar} style={{ border: 'none', background: 'transparent', fontSize: 22, cursor: 'pointer', color: '#888780', lineHeight: 1 }}>×</button>
              </div>
              {!canEdit && <div style={{ marginTop: 8, fontSize: 12, color: '#888780', background: '#F7F6F2', padding: '6px 10px', borderRadius: 6 }}>Solo lectura · no tienes permiso para editar la clasificación.</div>}
            </div>

            {/* líneas */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#888780', marginBottom: 8 }}>LÍNEAS DE CLASIFICACIÓN</div>
              {lineas.length === 0 && <div style={{ fontSize: 13, color: '#B4B2A9', padding: '10px 0' }}>Sin líneas. {canEdit && 'Añade una para clasificar este movimiento.'}</div>}
              {lineas.map((l, i) => (
                <div key={i} style={{ border: '0.5px solid #E8E6DE', borderRadius: 8, padding: 10, marginBottom: 8, background: '#FCFCFA' }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                    <input list="ccb-list" value={l.ccb || ''} disabled={!canEdit} onChange={e => setLinea(i, 'ccb', e.target.value)} placeholder="CCB"
                      style={{ width: 90, fontSize: 13, padding: '6px 8px', borderRadius: 6, border: '0.5px solid #D3D1C7' }} />
                    <input type="number" value={l.monto} disabled={!canEdit} onChange={e => setLinea(i, 'monto', e.target.value)} placeholder="Monto"
                      style={{ flex: 1, fontSize: 13, padding: '6px 8px', borderRadius: 6, border: '0.5px solid #D3D1C7', textAlign: 'right' }} />
                    {canEdit && <button onClick={() => delLinea(i)} title="Quitar línea" style={{ border: '0.5px solid #E7C9C4', background: '#fff', color: '#B23A3A', borderRadius: 6, cursor: 'pointer', width: 30, fontSize: 15 }}>×</button>}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                    <input value={l.cuenta_1 || ''} disabled={!canEdit} onChange={e => setLinea(i, 'cuenta_1', e.target.value)} placeholder="Cuenta 1"
                      style={{ flex: 1, fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '0.5px solid #D3D1C7' }} />
                    <input value={l.cuenta_2 || ''} disabled={!canEdit} onChange={e => setLinea(i, 'cuenta_2', e.target.value)} placeholder="Cuenta 2"
                      style={{ flex: 1, fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '0.5px solid #D3D1C7' }} />
                  </div>
                  <input value={l.concepto || ''} disabled={!canEdit} onChange={e => setLinea(i, 'concepto', e.target.value)} placeholder="Concepto"
                    style={{ width: '100%', fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '0.5px solid #D3D1C7', boxSizing: 'border-box' }} />
                </div>
              ))}
              {canEdit && <button onClick={addLinea} style={{ fontSize: 13, padding: '8px 12px', borderRadius: 8, border: '0.5px dashed #1D9E75', background: '#F3FBF8', color: '#085041', cursor: 'pointer', width: '100%', fontWeight: 500 }}>+ Añadir línea</button>}
              <datalist id="ccb-list">{CCB_SUGERIDOS.map(c => <option key={c} value={c} />)}</datalist>
            </div>

            {/* pie: cuadre + guardar */}
            <div style={{ borderTop: '0.5px solid #E0DED6', padding: '12px 18px', background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span style={{ color: '#888780' }}>Suman las líneas</span>
                <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{clp(sumaLineas)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 10 }}>
                <span style={{ color: '#888780' }}>{cuadra ? 'Cuadra con el banco' : 'Diferencia con el banco'}</span>
                <span style={{ fontWeight: 700, color: cuadra ? '#085041' : '#B23A3A', fontVariantNumeric: 'tabular-nums' }}>
                  {cuadra ? '✓ 0' : clp(diferencia)}
                </span>
              </div>
              {canEdit && (
                <>
                  {confirmDesc && !cuadra && (
                    <div style={{ fontSize: 12, color: '#B23A3A', background: '#FBE9E7', padding: '7px 10px', borderRadius: 6, marginBottom: 8 }}>
                      Va a quedar <b>descuadrado</b> (diferencia {clp(diferencia)}). Pulsa otra vez para guardar igual.
                    </div>
                  )}
                  <button onClick={guardar} disabled={saving}
                    style={{ width: '100%', fontSize: 14, fontWeight: 600, padding: '10px', borderRadius: 8, border: 'none', cursor: saving ? 'default' : 'pointer',
                      background: confirmDesc && !cuadra ? '#B23A3A' : '#1D9E75', color: '#fff', opacity: saving ? 0.7 : 1 }}>
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
