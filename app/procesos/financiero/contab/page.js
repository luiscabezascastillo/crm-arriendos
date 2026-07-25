// VERSION: v1 · 2026-07-25 · Pantalla CONTAB (comprobantes contables, financiero).
//   · Selector de periodo (mes).
//   · Una fila por ORIGEN (Ventas activo; Compras/SA/... en "pronto") con botón Generar
//     y estado de cuadre. Genera idempotente vía contab_generar_<origen>.
//   · Tabla de comprobantes generados con su cuadre.
//   · Exporta a Nubox: descarga el/los bloque(s) <5000 líneas en formato A-J.
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
const AMBAR = '#9A6E00'

const clp = (n) => (n == null ? '' : Number(n).toLocaleString('es-CL'))

// Orígenes que se muestran. 'activo' = tiene generador; el resto, "pronto".
const ORIGENES = [
  { id: 'ventas',     nombre: 'Ventas',        desc: 'Ingresos por CCB (bruto/neto/IVA)', activo: true },
  { id: 'compras',    nombre: 'Compras',       desc: 'Gastos y crédito fiscal',           activo: false },
  { id: 'honorarios', nombre: 'Honorarios',    desc: 'Boletas de honorarios',             activo: false },
  { id: 'sa',         nombre: 'B. Santander',  desc: 'Movimientos Santander (propio)',    activo: false },
  { id: 'caja_chica', nombre: 'Caja Chica',    desc: 'Movimientos de caja chica',         activo: false },
  { id: 'global',     nombre: 'Global 66',     desc: 'Movimientos Global 66',             activo: false },
]

// periodos recientes para el selector (últimos 24 meses)
function periodosRecientes() {
  const out = []
  const now = new Date()
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

export default function ContabPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const email = session?.user?.email
  const puedeEditar = EDITORES.includes(email)

  const [periodo, setPeriodo] = useState(null)
  const [comprobantes, setComprobantes] = useState([])
  const [resumen, setResumen] = useState([])
  const [cargando, setCargando] = useState(false)
  const [generando, setGenerando] = useState(null) // id del origen que se está generando
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)

  useEffect(() => { if (status === 'unauthenticated') router.push('/') }, [status, router])

  useEffect(() => {
    if (status === 'authenticated' && !periodo) {
      const ps = periodosRecientes()
      setPeriodo(ps[0])
    }
  }, [status])

  const cargar = async () => {
    if (!periodo) return
    setCargando(true); setError(null)
    try {
      const r = await fetch(`/api/financiero/contab?periodo=${periodo}`)
      const j = await r.json()
      if (j.error) { setError(j.error); setComprobantes([]); setResumen([]); return }
      setComprobantes(j.comprobantes || [])
      setResumen(j.resumen || [])
    } catch (e) {
      setError('No se pudo cargar.')
    } finally { setCargando(false) }
  }
  useEffect(() => { if (periodo) cargar() }, [periodo])

  const generar = async (origen) => {
    if (!puedeEditar || generando) return
    setGenerando(origen); setAviso(null); setError(null)
    try {
      const r = await fetch('/api/financiero/contab', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origen, periodo }),
      })
      const j = await r.json()
      if (j.error) { setAviso({ tipo: 'error', txt: j.error }); return }
      const nOk = (j.resultado || []).filter(x => x.r_cuadra).length
      const n = (j.resultado || []).length
      setAviso({
        tipo: j.todos_cuadran ? 'ok' : 'error',
        txt: `${origen} · ${periodo}: ${n} comprobante(s) generados, ${nOk} cuadran${j.todos_cuadran ? '.' : ' — revisar descuadre.'}`,
      })
      cargar()
    } catch (e) {
      setAviso({ tipo: 'error', txt: 'No se pudo generar.' })
    } finally { setGenerando(null) }
  }

  const exportarNubox = async () => {
    try {
      const r = await fetch(`/api/financiero/contab?export=nubox&periodo=${periodo}`)
      const j = await r.json()
      if (j.error) { setAviso({ tipo: 'error', txt: j.error }); return }
      if (!j.bloques?.length) { setAviso({ tipo: 'error', txt: 'No hay comprobantes para exportar.' }); return }
      // un archivo por bloque
      j.bloques.forEach((bloque, i) => {
        const cab = ['Número', 'Tipo', 'Fecha', 'Glosa', 'Cuenta Detalle', 'Glosa Detalle', 'Centro Costo', 'Sucursal', 'Debe', 'Haber']
        const filas = bloque.map(f => [
          f.numero, f.tipo, fechaCL(f.fecha), f.glosa, f.cuenta, f.glosa_detalle,
          f.centro_costo, f.sucursal, f.debe || '', f.haber || '',
        ])
        const tsv = [cab, ...filas].map(r => r.join('\t')).join('\r\n')
        const blob = new Blob([tsv], { type: 'text/tab-separated-values;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = j.n_bloques > 1 ? `CONTAB_${periodo}_bloque${i + 1}de${j.n_bloques}.txt` : `CONTAB_${periodo}.txt`
        a.click(); URL.revokeObjectURL(url)
      })
      setAviso({ tipo: 'ok', txt: `Exportado: ${j.total_filas} líneas en ${j.n_bloques} bloque(s) <5000.` })
    } catch (e) {
      setAviso({ tipo: 'error', txt: 'No se pudo exportar.' })
    }
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
            <div style={{ fontSize: 14, color: TENUE, marginTop: 4 }}>
              Genera los asientos de cada módulo y los exporta a Nubox en bloques.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: TENUE }}>Periodo</span>
            <select value={periodo || ''} onChange={e => setPeriodo(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${BORDE}`, fontSize: 15, fontWeight: 600, color: VERDE, background: '#fff' }}>
              {periodosRecientes().map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        {error && <div style={{ padding: 14, borderRadius: 10, background: ROJO_BG, color: ROJO, marginBottom: 16 }}>{error}</div>}
        {aviso && <div style={{ padding: 14, borderRadius: 10, marginBottom: 16, background: aviso.tipo === 'ok' ? VERDE_CLARO : ROJO_BG, color: aviso.tipo === 'ok' ? VERDE : ROJO }}>{aviso.txt}</div>}

        {/* Orígenes: una fila por módulo */}
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
                    {res.n_comp} comp · {clp(res.debe)}<br />
                    <span style={{ fontSize: 11 }}>{res.todos_cuadran ? 'cuadra ✓' : 'descuadre ✗'}</span>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: TENUE }}>{o.activo ? 'sin generar' : ''}</div>
                )}
                {o.activo ? (
                  puedeEditar && (
                    <button onClick={() => generar(o.id)} disabled={gen}
                      style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: VERDE, color: '#fff', fontSize: 14, fontWeight: 600, cursor: gen ? 'default' : 'pointer', opacity: gen ? 0.6 : 1 }}>
                      {gen ? 'Generando…' : (res ? 'Regenerar' : 'Generar')}
                    </button>
                  )
                ) : (
                  <span style={{ fontSize: 11, color: '#B4B2A9', padding: '4px 10px' }}>pronto</span>
                )}
              </div>
            )
          })}
        </div>

        {/* Resumen general + exportar */}
        {comprobantes.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ fontSize: 14, color: '#1A1A17' }}>
              <b>{totalGeneral.n}</b> comprobantes · <b>{totalGeneral.lineas}</b> líneas · debe <b>{clp(totalGeneral.debe)}</b>
              {' '}<span style={{ color: totalGeneral.todos ? VERDE : ROJO }}>{totalGeneral.todos ? 'todos cuadran ✓' : 'hay descuadres ✗'}</span>
            </div>
            <div style={{ flex: 1 }} />
            <button onClick={exportarNubox} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: VERDE, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Exportar a Nubox
            </button>
          </div>
        )}

        {/* Tabla de comprobantes */}
        {cargando ? (
          <div style={{ padding: 40, color: TENUE }}>Cargando…</div>
        ) : comprobantes.length === 0 ? (
          <div style={{ padding: 40, color: TENUE, textAlign: 'center', border: `1px dashed ${BORDE}`, borderRadius: 12 }}>
            No hay comprobantes generados para {periodo}. Pulsa “Generar” en un origen.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', border: `1px solid ${BORDE}`, borderRadius: 12, background: '#fff' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={th}>Origen</th><th style={th}>Fecha</th><th style={th}>Glosa</th>
                  <th style={th}>CCB</th><th style={{ ...th, textAlign: 'right' }}>Líneas</th>
                  <th style={{ ...th, textAlign: 'right' }}>Debe</th><th style={{ ...th, textAlign: 'right' }}>Haber</th>
                  <th style={th}>Cuadre</th>
                </tr>
              </thead>
              <tbody>
                {comprobantes.map(c => (
                  <tr key={c.id}>
                    <td style={td}>{c.origen}</td>
                    <td style={td}>{fechaCL(c.fecha)}</td>
                    <td style={td}>{c.glosa}</td>
                    <td style={td}>{c.ccb}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{c.n_lineas}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{clp(c.total_debe)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{clp(c.total_haber)}</td>
                    <td style={td}>{c.cuadra
                      ? <span style={{ color: VERDE }}>✓</span>
                      : <span style={{ color: ROJO }}>✗ {clp(c.descuadre)}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function fechaCL(f) {
  if (!f) return ''
  const d = new Date(f)
  if (isNaN(d)) return String(f)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

const th = { textAlign: 'left', padding: '10px 12px', fontSize: 12, fontWeight: 600, color: TENUE, borderBottom: `1px solid ${BORDE}`, whiteSpace: 'nowrap', background: '#FBFBF9' }
const td = { padding: '9px 12px', fontSize: 13, color: '#1A1A17', borderBottom: `1px solid ${BORDE}`, whiteSpace: 'nowrap' }
