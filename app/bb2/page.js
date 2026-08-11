'use client'
// VERSION: v2 · 2026-08-11 · app/bb2/page.js — Filas CLICABLES → ficha (/bb2/ficha?id=) y botón "+ Nueva operación".
//   La comisión propietario/arrendatario ya sale bien (bb2Log v2 corrige COBRADO/COBRADO-D). Hereda v1.
// VERSION: v1 · 2026-08-11 · app/bb2/page.js — PASO 1 de BB2 (arriendo sin administración): LISTADO de solo lectura
//   sobre el LOG (id_lcc 'R%'), leído desde raw_data (las columnas promovidas están desalineadas). Buscador +
//   filtro por ejecutivo + filtro por estado (HECHO/pendiente) + recuento. Acceso: Dirección + Anthony (Legal).
//   Los siguientes pasos (ficha guardar/recuperar, Terminar → comisiones_por_facturar + email a Karina) irán aparte.
import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import TopNav from '../components/ui/TopNav'

const AUTORIZADOS = [
  'alberto.cabezas@fondocapital.com',
  'luis.cabezas@fondocapital.com',
  'anthony.mendoza@fondocapital.com',
]

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const n0 = v => { const x = Number(String(v).replace(/[^\d.-]/g, '')); return isNaN(x) ? 0 : x }
const money = v => { const x = n0(v); return x ? '$' + x.toLocaleString('es-CL') : '—' }
const dash = v => (v && String(v).trim()) ? v : '—'

export default function BB2Page() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const email = session?.user?.email
  const autorizado = !!email && AUTORIZADOS.includes(email)

  const [rows, setRows] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [busca, setBusca] = useState('')
  const [fEjec, setFEjec] = useState('')
  const [fEstado, setFEstado] = useState('')   // '', 'hecho', 'pendiente'

  useEffect(() => {
    if (status !== 'authenticated' || !autorizado) return
    let vivo = true
    setCargando(true)
    fetch('/api/bb2/listar')
      .then(r => r.json())
      .then(j => { if (!vivo) return; if (j.error) setError(j.error); else setRows(j.rows || []) })
      .catch(e => { if (vivo) setError(String(e?.message || e)) })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [status, autorizado])

  const ejecutivos = useMemo(() => Array.from(new Set(rows.map(r => r.ejecutivo).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es')), [rows])

  const filtradas = useMemo(() => {
    const q = norm(busca.trim())
    return rows.filter(r => {
      if (fEjec && r.ejecutivo !== fEjec) return false
      if (fEstado === 'hecho' && !r.hecho) return false
      if (fEstado === 'pendiente' && r.hecho) return false
      if (q) {
        const hay = norm([r.id, r.inmueble, r.comuna, r.ejecutivo, r.propietario, r.arrendatario].filter(Boolean).join(' '))
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, busca, fEjec, fEstado])

  if (status === 'loading') return <div style={{ minHeight: '100vh' }}><TopNav /><div style={{ padding: 40, color: '#888' }}>Cargando…</div></div>
  if (status === 'authenticated' && !autorizado) {
    return <div style={{ minHeight: '100vh' }}><TopNav /><div style={{ padding: 40, color: '#b91c1c' }}>BB2 está restringido a Dirección y Anthony durante su construcción.</div></div>
  }

  const th = { padding: '7px 8px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: .3, whiteSpace: 'nowrap', borderBottom: '1px solid #E8E6E0', position: 'sticky', top: 0, background: '#F7F8FA', zIndex: 1 }
  const tdc = { padding: '7px 8px', fontSize: 12, color: '#1f2937', verticalAlign: 'top' }
  const tdr = { ...tdc, textAlign: 'right', whiteSpace: 'nowrap' }
  const sel = { padding: '8px 10px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 13, fontFamily: 'inherit', background: '#fff' }

  return (
    <div style={{ minHeight: '100vh', background: '#f4f6f9' }}>
      <TopNav />
      <div style={{ maxWidth: 1500, margin: '0 auto', padding: 18, fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: .5 }}>BB2 · Operaciones comerciales</span>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1a1a2e', margin: 0 }}>Arriendos sin administración</h1>
          <button onClick={() => router.push('/bb2/ficha?id=nuevo')} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#0C447C', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginLeft: 'auto' }}>+ Nueva operación</button>
        </div>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>Solo corretaje (comisión). Lectura del LOG (id R00xxx). Datos tomados de raw_data; se depurarán en la estabilización.</div>

        {/* Barra de filtros */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar Id, inmueble, propietario, arrendatario…"
            style={{ ...sel, minWidth: 320, flex: '1 1 320px' }} />
          <select value={fEjec} onChange={e => setFEjec(e.target.value)} style={sel}>
            <option value="">Todos los ejecutivos</option>
            {ejecutivos.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
          <select value={fEstado} onChange={e => setFEstado(e.target.value)} style={sel}>
            <option value="">Todos los estados</option>
            <option value="hecho">HECHO (protegido)</option>
            <option value="pendiente">Pendiente</option>
          </select>
          <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>{filtradas.length} de {rows.length}</span>
        </div>

        {error && <div style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 13 }}>{error}</div>}

        <div style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 12, overflow: 'hidden' }}>
          {cargando ? <div style={{ padding: 30, color: '#888' }}>Cargando operaciones…</div>
            : filtradas.length === 0 ? <div style={{ padding: 30, color: '#888' }}>Sin resultados.</div>
              : (
                <div style={{ overflowX: 'auto', maxHeight: '70vh', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1200 }}>
                    <thead>
                      <tr>
                        <th style={th}>Id</th>
                        <th style={th}>Inmueble</th>
                        <th style={th}>Ejecutivo</th>
                        <th style={th}>Propietario</th>
                        <th style={th}>Arrendatario</th>
                        <th style={{ ...th, textAlign: 'right' }}>Renta</th>
                        <th style={th}>Inicio</th>
                        <th style={th}>Fin</th>
                        <th style={{ ...th, textAlign: 'right' }}>Com. propietario</th>
                        <th style={{ ...th, textAlign: 'right' }}>Com. arrendatario</th>
                        <th style={{ ...th, textAlign: 'center' }}>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtradas.map((r, i) => (
                        <tr key={r.id || i} onClick={() => r.id && router.push('/bb2/ficha?id=' + r.id)} title="Abrir ficha"
                          style={{ borderBottom: '1px solid #F1F1EE', background: i % 2 ? '#FCFCFB' : '#fff', cursor: 'pointer' }}>
                          <td style={{ ...tdc, fontWeight: 700, whiteSpace: 'nowrap', color: '#0C447C', textDecoration: 'underline' }}>{r.id}</td>
                          <td style={{ ...tdc, minWidth: 240 }}>
                            <div>{dash(r.inmueble)}</div>
                            {r.comuna && <div style={{ fontSize: 10, color: '#9ca3af' }}>{r.comuna}</div>}
                          </td>
                          <td style={tdc}>{dash(r.ejecutivo)}</td>
                          <td style={{ ...tdc, minWidth: 160 }}>{dash(r.propietario)}</td>
                          <td style={{ ...tdc, minWidth: 160 }}>{dash(r.arrendatario)}</td>
                          <td style={tdr}>{(r.moneda || r.monto) ? `${r.moneda || ''} ${r.monto || ''}`.trim() : '—'}</td>
                          <td style={{ ...tdc, whiteSpace: 'nowrap' }}>{dash(r.inicio)}</td>
                          <td style={{ ...tdc, whiteSpace: 'nowrap' }}>{dash(r.fin)}</td>
                          <td style={tdr}>{money(r.comD.total)}{r.comD.tipo_doc && <div style={{ fontSize: 10, color: '#9ca3af' }}>{r.comD.tipo_doc}</div>}</td>
                          <td style={tdr}>{money(r.comA.total)}{r.comA.tipo_doc && <div style={{ fontSize: 10, color: '#9ca3af' }}>{r.comA.tipo_doc}</div>}</td>
                          <td style={{ ...tdc, textAlign: 'center' }}>
                            {r.hecho
                              ? <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color: '#16a34a', background: '#F0FDF4', border: '1px solid #bbf7d0' }}>HECHO</span>
                              : <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color: '#b45309', background: '#FFFBEB', border: '1px solid #fde68a' }}>Pendiente</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
        </div>
      </div>
    </div>
  )
}
