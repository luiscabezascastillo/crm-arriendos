// VERSION: v3 · 2026-07-25 · Pantalla CONTAB (comprobantes contables).
//   · Selector de AÑO + alcance Mes / Todo el año.
//   · Fila por ORIGEN (Ventas activo) con Generar (idempotente) y estado de cuadre.
//   · Previsualización consolidada estilo Nubox (A-K, morado/verde, desc. cuenta),
//     ordenada por fecha (asientos enteros), con FILTROS por columna para seleccionar
//     por asiento/origen/CCB/cuenta. Columna Número estrecha.
//   · Exporta a Nubox desde la previsualización, en bloques <5000 sin partir asientos.
'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import TopNav from '@/app/components/ui/TopNav'

const EDITORES = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']

const VERDE = '#085041'
const VERDE_CLARO = '#E1F5EE'
const BORDE = '#E5E4DF'
const TENUE = '#888780'
const ROJO_BG = '#FBE9E7'
const ROJO = '#B23A3A'

const clp = (n) => (n == null || n === '' ? '' : Number(n).toLocaleString('es-CL'))

const ORIGENES = [
  { id: 'ventas',     nombre: 'Ventas',       desc: 'Ingresos por CCB (bruto/neto/IVA)', activo: true },
  { id: 'compras',    nombre: 'Compras',      desc: 'Gastos por naturaleza + IVA crédito', activo: true },
  { id: 'honorarios', nombre: 'Honorarios',   desc: 'Boletas de honorarios',             activo: false },
  { id: 'sa',         nombre: 'B. Santander', desc: 'Movimientos Santander (propio)',    activo: false },
  { id: 'caja_chica', nombre: 'Caja Chica',   desc: 'Movimientos de caja chica',         activo: false },
  { id: 'global',     nombre: 'Global 66',    desc: 'Movimientos Global 66',             activo: false },
]

const MESES_N = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const aniosDisponibles = () => { const y = new Date().getFullYear(); return [y, y - 1, y - 2] }

function fechaCL(f) {
  if (!f) return ''
  const d = new Date(f); if (isNaN(d)) return String(f)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

export default function ContabPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const email = session?.user?.email
  const puedeEditar = EDITORES.includes(email)

  const [anio, setAnio] = useState(new Date().getFullYear())
  const [alcance, setAlcance] = useState('anio')   // 'mes' | 'anio'
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [comprobantes, setComprobantes] = useState([])
  const [resumen, setResumen] = useState([])
  const [cargando, setCargando] = useState(false)
  const [generando, setGenerando] = useState(null)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [preview, setPreview] = useState(null)
  const [cargandoPreview, setCargandoPreview] = useState(false)

  useEffect(() => { if (status === 'unauthenticated') router.push('/') }, [status, router])

  // query string del alcance actual
  const periodoStr = () => `${anio}-${String(mes).padStart(2, '0')}`
  const qsAlcance = () => alcance === 'mes' ? `periodo=${periodoStr()}` : `anio=${anio}`

  const cargar = async () => {
    setCargando(true); setError(null)
    try {
      const r = await fetch(`/api/financiero/contab?${qsAlcance()}`)
      const j = await r.json()
      if (j.error) { setError(j.error); setComprobantes([]); setResumen([]); return }
      setComprobantes(j.comprobantes || [])
      setResumen(j.resumen || [])
    } catch (e) { setError('No se pudo cargar.') } finally { setCargando(false) }
  }
  useEffect(() => { if (status === 'authenticated') cargar() }, [anio, alcance, mes, status]) // eslint-disable-line

  // Generar un origen. En alcance 'anio', genera los 12 meses (para) hasta el actual.
  const generar = async (origen) => {
    if (!puedeEditar || generando) return
    setGenerando(origen); setAviso(null); setError(null)
    try {
      let periodos = []
      if (alcance === 'mes') periodos = [periodoStr()]
      else {
        const hasta = (anio === new Date().getFullYear()) ? new Date().getMonth() + 1 : 12
        for (let m = 1; m <= hasta; m++) periodos.push(`${anio}-${String(m).padStart(2, '0')}`)
      }
      let totComp = 0, totCuadran = 0
      for (const p of periodos) {
        const r = await fetch('/api/financiero/contab', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ origen, periodo: p }),
        })
        const j = await r.json()
        if (j.error) { setAviso({ tipo: 'error', txt: `${p}: ${j.error}` }); break }
        totComp += (j.resultado || []).length
        totCuadran += (j.resultado || []).filter(x => x.r_cuadra).length
      }
      setAviso({
        tipo: totComp === totCuadran ? 'ok' : 'error',
        txt: `${origen} · ${alcance === 'mes' ? periodoStr() : anio}: ${totComp} comprobante(s), ${totCuadran} cuadran${totComp === totCuadran ? '.' : ' — revisar.'}`,
      })
      cargar()
    } catch (e) { setAviso({ tipo: 'error', txt: 'No se pudo generar.' }) } finally { setGenerando(null) }
  }

  const previsualizar = async () => {
    setCargandoPreview(true); setAviso(null)
    try {
      const r = await fetch(`/api/financiero/contab?preview=1&${qsAlcance()}`)
      const j = await r.json()
      if (j.error) { setAviso({ tipo: 'error', txt: j.error }); return }
      if (!j.filas?.length) { setAviso({ tipo: 'error', txt: 'No hay comprobantes en el alcance elegido.' }); return }
      setPreview(j)
    } catch (e) { setAviso({ tipo: 'error', txt: 'No se pudo previsualizar.' }) } finally { setCargandoPreview(false) }
  }

  const exportarNubox = async () => {
    try {
      const r = await fetch(`/api/financiero/contab?export=nubox&${qsAlcance()}`)
      const j = await r.json()
      if (j.error) { setAviso({ tipo: 'error', txt: j.error }); return }
      if (!j.bloques?.length) { setAviso({ tipo: 'error', txt: 'No hay comprobantes para exportar.' }); return }
      const base = alcance === 'mes' ? periodoStr() : String(anio)
      j.bloques.forEach((bloque, i) => {
        const cab = ['Número', 'Tipo', 'Fecha', 'Glosa', 'Cuenta Detalle', 'Glosa Detalle', 'Centro Costo', 'Sucursal', 'Debe', 'Haber']
        const filas = bloque.map(f => [f.numero, f.tipo, f.fecha ? fechaCL(f.fecha) : '', f.glosa, f.cuenta, f.glosa_detalle, f.centro_costo, f.sucursal, f.debe || '', f.haber || ''])
        const tsv = [cab, ...filas].map(r => r.join('\t')).join('\r\n')
        const blob = new Blob([tsv], { type: 'text/tab-separated-values;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = j.n_bloques > 1 ? `CONTAB_${base}_bloque${i + 1}de${j.n_bloques}.txt` : `CONTAB_${base}.txt`
        a.click(); URL.revokeObjectURL(url)
      })
      setAviso({ tipo: 'ok', txt: `Exportado: ${j.total_filas} líneas en ${j.n_bloques} bloque(s) <5000.` })
    } catch (e) { setAviso({ tipo: 'error', txt: 'No se pudo exportar.' }) }
  }

  const totalGeneral = useMemo(() => {
    const debe = comprobantes.reduce((s, c) => s + (Number(c.total_debe) || 0), 0)
    const haber = comprobantes.reduce((s, c) => s + (Number(c.total_haber) || 0), 0)
    const todos = comprobantes.every(c => c.cuadra)
    return { debe, haber, n: comprobantes.length, todos, lineas: comprobantes.reduce((s, c) => s + (Number(c.n_lineas) || 0), 0) }
  }, [comprobantes])

  const resumenPorOrigen = (id) => resumen.find(r => r.origen === id)

  if (status === 'loading') return <div style={{ padding: 40, color: TENUE }}>Cargando…</div>

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF8' }}>
      <TopNav />
      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '24px 20px 80px' }}>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 13, color: TENUE, marginBottom: 4 }}>Procesos · Financiero</div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1A1A17', margin: 0 }}>CONTAB · Comprobantes contables</h1>
            <div style={{ fontSize: 14, color: TENUE, marginTop: 4 }}>Genera los asientos de cada módulo y los exporta a Nubox en bloques.</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: TENUE }}>Año</span>
            <select value={anio} onChange={e => setAnio(Number(e.target.value))} style={selStyle}>
              {aniosDisponibles().map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <div style={{ display: 'flex', border: `1px solid ${BORDE}`, borderRadius: 8, overflow: 'hidden' }}>
              <button onClick={() => setAlcance('mes')} style={togBtn(alcance === 'mes')}>Mes</button>
              <button onClick={() => setAlcance('anio')} style={togBtn(alcance === 'anio')}>Todo el año</button>
            </div>
            {alcance === 'mes' && (
              <select value={mes} onChange={e => setMes(Number(e.target.value))} style={selStyle}>
                {MESES_N.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>
            )}
          </div>
        </div>

        {error && <div style={{ padding: 14, borderRadius: 10, background: ROJO_BG, color: ROJO, marginBottom: 16 }}>{error}</div>}
        {aviso && <div style={{ padding: 14, borderRadius: 10, marginBottom: 16, background: aviso.tipo === 'ok' ? VERDE_CLARO : ROJO_BG, color: aviso.tipo === 'ok' ? VERDE : ROJO }}>{aviso.txt}</div>}

        <div style={{ border: `1px solid ${BORDE}`, borderRadius: 12, background: '#fff', overflow: 'hidden', marginBottom: 20 }}>
          {ORIGENES.map((o, i) => {
            const res = resumenPorOrigen(o.id)
            const gen = generando === o.id
            return (
              <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderTop: i ? `1px solid ${BORDE}` : 'none', background: o.activo ? '#fff' : '#FBFBF9' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: o.activo ? '#1A1A17' : TENUE }}>{o.nombre}</div>
                  <div style={{ fontSize: 12, color: TENUE }}>{o.desc}</div>
                </div>
                {res ? (
                  <div style={{ fontSize: 13, textAlign: 'right', color: res.todos_cuadran ? VERDE : ROJO }}>
                    {res.n_comp} comp{res.n_meses > 1 ? ` · ${res.n_meses} meses` : ''} · {clp(res.debe)}<br />
                    <span style={{ fontSize: 11 }}>{res.todos_cuadran ? 'cuadra ✓' : 'descuadre ✗'}</span>
                  </div>
                ) : (<div style={{ fontSize: 12, color: TENUE }}>{o.activo ? 'sin generar' : ''}</div>)}
                {o.activo ? (
                  puedeEditar && (
                    <button onClick={() => generar(o.id)} disabled={gen} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: VERDE, color: '#fff', fontSize: 14, fontWeight: 600, cursor: gen ? 'default' : 'pointer', opacity: gen ? 0.6 : 1 }}>
                      {gen ? 'Generando…' : (res ? 'Regenerar' : 'Generar')}
                    </button>
                  )
                ) : (<span style={{ fontSize: 11, color: '#B4B2A9', padding: '4px 10px' }}>pronto</span>)}
              </div>
            )
          })}
        </div>

        {comprobantes.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ fontSize: 14, color: '#1A1A17' }}>
              <b>{totalGeneral.n}</b> comprobantes · <b>{totalGeneral.lineas}</b> líneas · debe <b>{clp(totalGeneral.debe)}</b>{' '}
              <span style={{ color: totalGeneral.todos ? VERDE : ROJO }}>{totalGeneral.todos ? 'todos cuadran ✓' : 'hay descuadres ✗'}</span>
            </div>
            <div style={{ flex: 1 }} />
            <button onClick={previsualizar} disabled={cargandoPreview} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: VERDE, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: cargandoPreview ? 0.6 : 1 }}>
              {cargandoPreview ? 'Preparando…' : 'Previsualizar Nubox'}
            </button>
          </div>
        )}

        {cargando ? (
          <div style={{ padding: 40, color: TENUE }}>Cargando…</div>
        ) : comprobantes.length === 0 ? (
          <div style={{ padding: 40, color: TENUE, textAlign: 'center', border: `1px dashed ${BORDE}`, borderRadius: 12 }}>
            No hay comprobantes generados para {alcance === 'mes' ? `${MESES_N[mes]} ${anio}` : anio}. Pulsa “Generar” en un origen.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', border: `1px solid ${BORDE}`, borderRadius: 12, background: '#fff' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead><tr>
                <th style={th}>Origen</th><th style={th}>Periodo</th><th style={th}>Fecha</th><th style={th}>Glosa</th>
                <th style={th}>CCB</th><th style={{ ...th, textAlign: 'right' }}>Líneas</th>
                <th style={{ ...th, textAlign: 'right' }}>Debe</th><th style={{ ...th, textAlign: 'right' }}>Haber</th><th style={th}>Cuadre</th>
              </tr></thead>
              <tbody>
                {comprobantes.map(c => (
                  <tr key={c.id}>
                    <td style={td}>{c.origen}</td>
                    <td style={td}>{c.periodo}</td>
                    <td style={td}>{fechaCL(c.fecha)}</td>
                    <td style={td}>{c.glosa}</td>
                    <td style={td}>{c.ccb}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{c.n_lineas}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{clp(c.total_debe)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{clp(c.total_haber)}</td>
                    <td style={td}>{c.cuadra ? <span style={{ color: VERDE }}>✓</span> : <span style={{ color: ROJO }}>✗ {clp(c.descuadre)}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {preview && <PreviewNubox preview={preview} onCerrar={() => setPreview(null)} onExportar={exportarNubox} />}
    </div>
  )
}

// ---- Previsualización Nubox consolidada, con filtros por columna ----
function PreviewNubox({ preview, onCerrar, onExportar }) {
  const { filas, total_debe, total_haber, cuadra, n_lineas, alcance } = preview
  const [filtros, setFiltros] = useState({})
  const [ordenFecha, setOrdenFecha] = useState(true)

  // filtros a nivel de ASIENTO: si el filtro casa con alguna línea del asiento, se muestra entero
  const compIdsVisibles = useMemo(() => {
    const activos = Object.entries(filtros).filter(([, v]) => v && v.trim())
    if (!activos.length) return null
    const ok = new Set()
    const porComp = {}
    for (const f of filas) (porComp[f.comp_id] ||= []).push(f)
    for (const [cid, ls] of Object.entries(porComp)) {
      const casa = activos.every(([col, val]) =>
        ls.some(l => String(l[col] ?? '').toLowerCase().includes(val.trim().toLowerCase()))
      )
      if (casa) ok.add(Number(cid))
    }
    return ok
  }, [filas, filtros])

  const filasVis = useMemo(() => {
    let fs = compIdsVisibles ? filas.filter(f => compIdsVisibles.has(f.comp_id)) : filas
    return fs
  }, [filas, compIdsVisibles])

  const setF = (col, val) => setFiltros(f => ({ ...f, [col]: val }))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', flexDirection: 'column', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 12, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px', borderBottom: `1px solid ${BORDE}`, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#1A1A17' }}>Previsualización Nubox · {alcance}</div>
            <div style={{ fontSize: 13, color: TENUE }}>
              {filasVis.length}{filasVis.length !== n_lineas ? ` de ${n_lineas}` : ''} líneas · debe {clp(total_debe)} · haber {clp(total_haber)}{' '}
              <span style={{ color: cuadra ? VERDE : ROJO, fontWeight: 600 }}>{cuadra ? 'cuadra ✓' : 'descuadre ✗'}</span>
            </div>
          </div>
          <div style={{ flex: 1 }} />
          {Object.values(filtros).some(v => v && v.trim()) && (
            <button onClick={() => setFiltros({})} style={{ padding: '9px 14px', borderRadius: 8, border: `1px solid ${BORDE}`, background: '#fff', color: VERDE, fontSize: 13, cursor: 'pointer' }}>Quitar filtros</button>
          )}
          <button onClick={onExportar} disabled={!cuadra} title={cuadra ? 'Exportar archivo Nubox' : 'No cuadra'} style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: cuadra ? VERDE : '#B4B2A9', color: '#fff', fontSize: 14, fontWeight: 600, cursor: cuadra ? 'pointer' : 'default' }}>Exportar a Nubox</button>
          <button onClick={onCerrar} style={{ padding: '9px 16px', borderRadius: 8, border: `1px solid ${BORDE}`, background: '#fff', color: '#1A1A17', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cerrar</button>
        </div>

        <div style={{ overflow: 'auto', flex: 1 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
              <tr>
                <th style={{ ...thN, width: 42 }}>Nº</th>
                <th style={thM}>Tipo<FiltroCol col="tipo" filtros={filtros} set={setF} /></th>
                <th style={thM}>Fecha</th>
                <th style={thM}>Glosa<FiltroCol col="glosa" filtros={filtros} set={setF} /></th>
                <th style={thV}>Cuenta<FiltroCol col="cuenta" filtros={filtros} set={setF} /></th>
                <th style={thV}>Glosa Detalle<FiltroCol col="glosa_detalle" filtros={filtros} set={setF} /></th>
                <th style={thV}>C.Costo<FiltroCol col="centro_costo" filtros={filtros} set={setF} /></th>
                <th style={thV}>Suc.</th>
                <th style={{ ...thV, textAlign: 'right' }}>Debe</th>
                <th style={{ ...thV, textAlign: 'right' }}>Haber</th>
                <th style={thK}>Descripción cuenta<FiltroCol col="desc_cuenta" filtros={filtros} set={setF} /></th>
                <th style={thK}>Origen<FiltroCol col="origen" filtros={filtros} set={setF} /></th>
              </tr>
            </thead>
            <tbody>
              {filasVis.map((f, i) => {
                const esCab = f.numero === 0 || f.numero === '0'
                return (
                  <tr key={i} style={{ borderTop: esCab ? `2px solid #C9C7BE` : 'none' }}>
                    <td style={{ ...tdN, width: 42 }}>{esCab ? 0 : ''}</td>
                    <td style={tdM}>{f.tipo}</td>
                    <td style={tdM}>{f.fecha ? fechaCL(f.fecha) : ''}</td>
                    <td style={{ ...tdM, fontWeight: esCab ? 600 : 400 }}>{f.glosa}</td>
                    <td style={tdV}>{f.cuenta}</td>
                    <td style={tdV}>{f.glosa_detalle}</td>
                    <td style={tdV}>{f.centro_costo}</td>
                    <td style={tdV}>{f.sucursal}</td>
                    <td style={{ ...tdV, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{f.debe ? clp(f.debe) : ''}</td>
                    <td style={{ ...tdV, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{f.haber ? clp(f.haber) : ''}</td>
                    <td style={tdK}>{f.desc_cuenta}</td>
                    <td style={tdK}>{f.origen}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function FiltroCol({ col, filtros, set }) {
  return (
    <input value={filtros[col] || ''} onChange={e => set(col, e.target.value)} placeholder="filtrar…"
      style={{ marginTop: 4, width: '100%', boxSizing: 'border-box', padding: '2px 5px', fontSize: 10, border: `1px solid ${BORDE}`, borderRadius: 4, fontWeight: 400 }} />
  )
}

const selStyle = { padding: '8px 12px', borderRadius: 8, border: `1px solid ${BORDE}`, fontSize: 15, fontWeight: 600, color: VERDE, background: '#fff' }
const togBtn = (activo) => ({ padding: '8px 14px', border: 'none', background: activo ? VERDE : '#fff', color: activo ? '#fff' : '#2C2C2A', fontSize: 14, fontWeight: 600, cursor: 'pointer' })

const th = { textAlign: 'left', padding: '10px 12px', fontSize: 12, fontWeight: 600, color: TENUE, borderBottom: `1px solid ${BORDE}`, whiteSpace: 'nowrap', background: '#FBFBF9' }
const td = { padding: '9px 12px', fontSize: 13, color: '#1A1A17', borderBottom: `1px solid ${BORDE}`, whiteSpace: 'nowrap' }

const MORADO = '#EEEBF7', MORADO_TH = '#E0DAF0', VERDE_BG = '#E6F4EA', VERDE_TH = '#D3EAD9'
const celdaBase = { padding: '5px 9px', borderBottom: '1px solid #EDEDEA', borderRight: '1px solid #EDEDEA', whiteSpace: 'nowrap', verticalAlign: 'top' }
const thBase = { padding: '6px 9px', fontSize: 11, fontWeight: 700, color: '#2C2C2A', borderBottom: '1px solid #D3D1C7', borderRight: '1px solid #D3D1C7', whiteSpace: 'nowrap', textAlign: 'left', verticalAlign: 'top' }
const thN = { ...thBase, background: MORADO_TH }
const tdN = { ...celdaBase, background: MORADO, color: '#2C2C2A', textAlign: 'right' }
const thM = { ...thBase, background: MORADO_TH }
const tdM = { ...celdaBase, background: MORADO }
const thV = { ...thBase, background: VERDE_TH }
const tdV = { ...celdaBase, background: VERDE_BG }
const thK = { ...thBase, background: '#F0EFEA' }
const tdK = { ...celdaBase, background: '#fff', color: '#555' }
