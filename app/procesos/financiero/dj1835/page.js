// VERSION: 2026-08-26 · Añadido "← Volver" (BotonVolver, history.back) — convención de retorno. Hereda versión previa.
// VERSION: v5 · 2026-07-26 · Pantalla DJ 1835: + barra FinancieroNav.
//   · Selector de año + nota del año tributario.
//   · Totales del año. Panel plegable de "Pendientes de rol" (con monto, sin rol).
//   · Barra de acciones + cabecera de tabla fija bajo el TopNav al hacer scroll.
//   · Vista Legible con filtro de texto por columna (tipo Excel).
//   · Cuatro vistas: Legible / Formato SII / Valores CSV / Líneas CSV.
//   · Exporta el .csv del SII. Congela el año declarado.
//
// El listado ya viene filtrado por el endpoint: SOLO líneas declarables. Los casos con
// arriendo pero sin rol válido llegan aparte, como pendientes de localizar el rol.
'use client'

import { useSession } from 'next-auth/react'
import BotonVolver from '../../../components/ui/BotonVolver'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import TopNav from '@/app/components/ui/TopNav'
import FinancieroNav from '@/app/components/ui/FinancieroNav'

const EDITORES = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MES_UP = MESES.map(m => m.toUpperCase())
const RUT_FCR = { num: '76828712', dv: '0' }

const VERDE = '#085041'
const VERDE_CLARO = '#E1F5EE'
const BORDE = '#E5E4DF'
const TENUE = '#888780'
const ROJO_BG = '#FBE9E7'
const ROJO = '#B23A3A'
const AMBAR_BG = '#FDF6E3'
const AMBAR = '#9A6E00'

const clp = (n) => (n == null ? '' : Number(n).toLocaleString('es-CL'))

// Roles que el SII observó en la DJ 2025 (R450/V390). Se marcan para revisar.
const ROLES_OBSERVADOS = { 'A00695': true, 'A00684': true }

// ---------- transformaciones de formato SII ----------
function partirRol(rol) {
  if (!rol) return { manzana: '', predio: '' }
  const m = String(rol).match(/(\d+)\s*-\s*(\d+)/)
  if (!m) return { manzana: rol, predio: '' }
  return { manzana: m[1].padStart(5, '0'), predio: String(parseInt(m[2], 10)) }
}
function rutConGuion(rut) {
  if (!rut || rut === '') return '11111111-1'
  return String(rut).replace(/\./g, '').replace(/\s/g, '')
}
function rutPartido(rut) {
  if (!rut || rut === '') return { num: '11111111', dv: '1' }
  const s = String(rut).replace(/\./g, '').replace(/\s/g, '')
  const m = s.match(/(\d+)\s*-\s*([\dkK])/)
  if (!m) return { num: s, dv: '' }
  return { num: m[1], dv: m[2].toUpperCase() }
}

const CAB_SII = [
  'MANZANA', 'PREDIO', 'COD_COMUNA', 'RUT_PROPIETARIO',
  'RUT_FCR', 'DV_FCR', 'RUT_ARREND', 'DV_ARREND', 'MONTO_ANUAL',
  ...MES_UP, 'AMOBLADO', 'DESTINO', 'DFL2', 'NATURALEZA',
]

function filaSII(f) {
  const { manzana, predio } = partirRol(f.rol)
  const arr = rutPartido(f.rut_arrendatario)
  return [
    manzana, predio, f.comuna_sii || '',
    rutConGuion(f.rut_propietario),
    RUT_FCR.num, RUT_FCR.dv,
    arr.num, arr.dv,
    f.monto_anual,
    ...MESES.map(m => (f[m] ? 'A' : '')),
    1, 1, '', 2,
  ]
}

export default function DJ1835Page() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const email = session?.user?.email
  const puedeEditar = EDITORES.includes(email)

  const [anios, setAnios] = useState([])
  const [anioSel, setAnioSel] = useState(null)
  const [lineas, setLineas] = useState([])
  const [pendientesRol, setPendientesRol] = useState([])
  const [cargaAnio, setCargaAnio] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [vista, setVista] = useState('LEGIBLE')
  const [congelando, setCongelando] = useState(false)
  const [verPendientes, setVerPendientes] = useState(false)
  const [filtros, setFiltros] = useState({})

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    ;(async () => {
      try {
        const r = await fetch('/api/financiero/dj1835')
        const j = await r.json()
        if (j.error) { setError(j.error); setCargando(false); return }
        setAnios(j.anios || [])
        if ((j.anios || []).length) setAnioSel(j.anios[0])
        else setCargando(false)
      } catch (e) {
        setError('No se pudo conectar con el servidor.')
        setCargando(false)
      }
    })()
  }, [status])

  const recargar = async () => {
    if (!anioSel) return
    setCargando(true)
    setError(null)
    try {
      const r = await fetch(`/api/financiero/dj1835?anio=${anioSel}`)
      const j = await r.json()
      if (j.error) { setError(j.error); setLineas([]); return }
      setLineas(j.lineas || [])
      setPendientesRol(j.pendientesRol || [])
      setCargaAnio(j.carga || null)
    } catch (e) {
      setError('No se pudieron cargar las líneas.')
      setLineas([])
    } finally {
      setCargando(false)
    }
  }
  useEffect(() => { if (anioSel) { setFiltros({}); recargar() } }, [anioSel])

  const totales = useMemo(() => {
    const n = lineas.length
    const monto = lineas.reduce((s, l) => s + (Number(l.monto_anual) || 0), 0)
    const sinComuna = lineas.filter(l => l.falta_comuna).length
    const sinRutProp = lineas.filter(l => l.falta_rut_propietario).length
    return { n, monto, sinComuna, sinRutProp }
  }, [lineas])

  const filasFiltradas = useMemo(() => {
    const activos = Object.entries(filtros).filter(([, v]) => v && v.trim())
    if (!activos.length) return lineas
    return lineas.filter(l =>
      activos.every(([col, val]) => String(l[col] ?? '').toLowerCase().includes(val.trim().toLowerCase()))
    )
  }, [lineas, filtros])

  const congelado = !!cargaAnio?.congelado

  const descargarCSV = () => {
    const txt = lineas.map(f => filaSII(f).join(';')).join('\r\n')
    const blob = new Blob([txt], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `DJ1835_${anioSel}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const congelar = async () => {
    if (!puedeEditar || congelando) return
    if (!confirm(`¿Congelar el año ${anioSel}? Guardará una copia de las ${totales.n} líneas declaradas. No se podrá recalcular después.`)) return
    setCongelando(true); setAviso(null)
    try {
      const r = await fetch('/api/financiero/dj1835', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anio: anioSel }),
      })
      const j = await r.json()
      if (j.error) { setAviso({ tipo: 'error', txt: j.error }); return }
      setAviso({ tipo: 'ok', txt: `Año ${anioSel} congelado: ${j.n_casos} líneas, ${clp(j.total_monto)}.` })
      recargar()
    } catch (e) {
      setAviso({ tipo: 'error', txt: 'No se pudo congelar.' })
    } finally { setCongelando(false) }
  }

  if (status === 'loading') return <div style={{ padding: 40, color: TENUE }}>Cargando…</div>

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF8' }}>
      <TopNav />
      <BotonVolver />
      <FinancieroNav activo="dj1835" />

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 13, color: TENUE, marginBottom: 4 }}>Procesos · Financiero</div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1A1A17', margin: 0 }}>DJ 1835 · Bienes raíces arrendados</h1>
            <div style={{ fontSize: 14, color: TENUE, marginTop: 4 }}>Declaración jurada anual. Se genera desde las liquidaciones; no se teclea.</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: TENUE }}>Año de los arriendos</span>
              <select value={anioSel || ''} onChange={e => setAnioSel(Number(e.target.value))}
                style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${BORDE}`, fontSize: 15, fontWeight: 600, color: VERDE, background: '#fff' }}>
                {anios.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              {congelado && <span style={{ padding: '4px 10px', borderRadius: 999, background: VERDE_CLARO, color: VERDE, fontSize: 12, fontWeight: 600 }}>Congelado</span>}
            </div>
            {anioSel && <span style={{ fontSize: 12, color: TENUE }}>Arriendos {anioSel} → se declara en el Año Tributario {anioSel + 1}</span>}
          </div>
        </div>

        {error && <div style={{ padding: 14, borderRadius: 10, background: ROJO_BG, color: ROJO, marginBottom: 16 }}>{error}</div>}
        {aviso && <div style={{ padding: 14, borderRadius: 10, marginBottom: 16, background: aviso.tipo === 'ok' ? VERDE_CLARO : ROJO_BG, color: aviso.tipo === 'ok' ? VERDE : ROJO }}>{aviso.txt}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
          <Tarjeta label="Casos a declarar" valor={totales.n} sub={`arriendos ${anioSel || ''}`} />
          <Tarjeta label="Monto arriendo anual" valor={clp(totales.monto)} acento />
          <Tarjeta label="Datos faltantes" valor={totales.sinComuna + totales.sinRutProp}
            sub={(totales.sinComuna + totales.sinRutProp) ? `${totales.sinComuna} comuna · ${totales.sinRutProp} RUT dueño` : 'todo completo'}
            alerta={(totales.sinComuna + totales.sinRutProp) > 0} />
        </div>

        {pendientesRol.length > 0 && (
          <div style={{ marginBottom: 16, border: '1px solid #F0D8A8', borderRadius: 12, background: AMBAR_BG, overflow: 'hidden' }}>
            <button onClick={() => setVerPendientes(v => !v)}
              style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: AMBAR }}>{pendientesRol.length} caso{pendientesRol.length > 1 ? 's' : ''} con arriendo pero sin rol</span>
              <span style={{ fontSize: 13, color: AMBAR }}>— hay que localizar el rol para poder declararlos</span>
              <span style={{ marginLeft: 'auto', color: AMBAR }}>{verPendientes ? '▲' : '▼'}</span>
            </button>
            {verPendientes && (
              <div style={{ padding: '0 16px 14px' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', background: '#fff', borderRadius: 8, overflow: 'hidden' }}>
                  <thead><tr>
                    <th style={thP}>IDADMON</th><th style={thP}>Propietario</th><th style={thP}>Inmueble</th>
                    <th style={{ ...thP, textAlign: 'right' }}>Monto anual</th><th style={thP}>Rol actual</th>
                  </tr></thead>
                  <tbody>
                    {pendientesRol.map((p, i) => (
                      <tr key={p.idadmon + i}>
                        <td style={tdP}>{p.idadmon}</td>
                        <td style={tdP}>{p.propietario}</td>
                        <td style={tdP}>{p.inmueble}</td>
                        <td style={{ ...tdP, textAlign: 'right' }}>{clp(p.monto_anual)}</td>
                        <td style={tdP}>
                          <span style={{ color: ROJO }}>{p.rol || '(vacío)'}</span>
                          {ROLES_OBSERVADOS[p.idadmon] && <span style={{ marginLeft: 6, fontSize: 11, color: ROJO }}>· observado SII</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ fontSize: 12, color: AMBAR, marginTop: 8 }}>El rol se toma de la tabla de inmuebles. Corrígelo o cárgalo ahí y estas líneas entrarán solas en la declaración.</div>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: '#FAFAF8', borderBottom: `1px solid ${BORDE}` }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '10px 20px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <BotonVista actual={vista} valor="LEGIBLE" set={setVista}>Legible</BotonVista>
          <BotonVista actual={vista} valor="SII" set={setVista}>Formato SII</BotonVista>
          <BotonVista actual={vista} valor="CSV" set={setVista}>Valores CSV</BotonVista>
          <BotonVista actual={vista} valor="LINEAS" set={setVista}>Líneas CSV</BotonVista>
          <div style={{ flex: 1 }} />
          <button onClick={descargarCSV} style={btnPrimario}>Descargar .csv</button>
          {puedeEditar && !congelado && (
            <button onClick={congelar} disabled={congelando} style={btnSecundario}>{congelando ? 'Congelando…' : 'Congelar año'}</button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '12px 20px 80px' }}>
        {cargando ? (
          <div style={{ padding: 40, color: TENUE }}>Cargando líneas…</div>
        ) : (
          <div style={{ overflowX: 'auto', border: `1px solid ${BORDE}`, borderRadius: 12, background: '#fff' }}>
            {vista === 'LEGIBLE' && <TablaLegible filas={filasFiltradas} filtros={filtros} setFiltros={setFiltros} />}
            {vista === 'SII' && <TablaSII filas={lineas} />}
            {vista === 'CSV' && <TablaCSV filas={lineas} />}
            {vista === 'LINEAS' && <TablaLineas filas={lineas} />}
          </div>
        )}
        {vista === 'LEGIBLE' && Object.values(filtros).some(v => v && v.trim()) && (
          <div style={{ fontSize: 12, color: TENUE, marginTop: 8 }}>
            Mostrando {filasFiltradas.length} de {lineas.length}. <button onClick={() => setFiltros({})} style={{ border: 'none', background: 'none', color: VERDE, cursor: 'pointer', fontSize: 12, textDecoration: 'underline' }}>Quitar filtros</button>
          </div>
        )}
      </div>
    </div>
  )
}

function Tarjeta({ label, valor, sub, acento, alerta }) {
  return (
    <div style={{ padding: 16, borderRadius: 12, border: `1px solid ${alerta ? '#F0D8A8' : BORDE}`, background: alerta ? AMBAR_BG : '#fff' }}>
      <div style={{ fontSize: 12, color: alerta ? AMBAR : TENUE, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: acento ? VERDE : '#1A1A17' }}>{valor}</div>
      {sub && <div style={{ fontSize: 12, color: alerta ? AMBAR : TENUE, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function BotonVista({ actual, valor, set, children }) {
  const activo = actual === valor
  return (
    <button onClick={() => set(valor)} style={{
      padding: '8px 14px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
      border: `1px solid ${activo ? VERDE : BORDE}`, background: activo ? VERDE : '#fff', color: activo ? '#fff' : '#1A1A17',
    }}>{children}</button>
  )
}

const th = { textAlign: 'left', padding: '10px 12px', fontSize: 12, fontWeight: 600, color: TENUE, borderBottom: `1px solid ${BORDE}`, whiteSpace: 'nowrap', background: '#FBFBF9' }
const td = { padding: '9px 12px', fontSize: 13, color: '#1A1A17', borderBottom: `1px solid ${BORDE}`, whiteSpace: 'nowrap' }
const tdNum = { ...td, textAlign: 'right' }
const thP = { textAlign: 'left', padding: '8px 10px', fontSize: 11, fontWeight: 600, color: TENUE, borderBottom: `1px solid ${BORDE}` }
const tdP = { padding: '7px 10px', fontSize: 12, color: '#1A1A17', borderBottom: '1px solid #F0EFEA' }
const btnPrimario = { padding: '8px 14px', borderRadius: 8, border: 'none', background: VERDE, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }
const btnSecundario = { padding: '8px 14px', borderRadius: 8, border: `1px solid ${BORDE}`, background: '#fff', color: '#1A1A17', fontSize: 14, fontWeight: 600, cursor: 'pointer' }

function FiltroCol({ col, filtros, setFiltros }) {
  return (
    <input value={filtros[col] || ''} onChange={e => setFiltros(f => ({ ...f, [col]: e.target.value }))} placeholder="filtrar…"
      style={{ marginTop: 5, width: '100%', boxSizing: 'border-box', padding: '3px 6px', fontSize: 11, border: `1px solid ${BORDE}`, borderRadius: 5, fontWeight: 400, color: '#1A1A17' }} />
  )
}

function TablaLegible({ filas, filtros, setFiltros }) {
  const thL = { ...th, position: 'sticky', top: 0, zIndex: 5, verticalAlign: 'top' }
  return (
    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
      <thead>
        <tr>
          <th style={thL}>IDADMON<FiltroCol col="idadmon" filtros={filtros} setFiltros={setFiltros} /></th>
          <th style={thL}>Propiedad<FiltroCol col="inmueble" filtros={filtros} setFiltros={setFiltros} /></th>
          <th style={thL}>Rol<FiltroCol col="rol" filtros={filtros} setFiltros={setFiltros} /></th>
          <th style={thL}>Comuna<FiltroCol col="comuna_nombre" filtros={filtros} setFiltros={setFiltros} /></th>
          <th style={thL}>Propietario<FiltroCol col="propietario" filtros={filtros} setFiltros={setFiltros} /></th>
          <th style={thL}>Arrendatario<FiltroCol col="arrendatario" filtros={filtros} setFiltros={setFiltros} /></th>
          <th style={thL}>RUT<FiltroCol col="rut_arrendatario" filtros={filtros} setFiltros={setFiltros} /></th>
          <th style={{ ...thL, textAlign: 'right' }}>Monto anual</th>
          <th style={thL}>Meses</th>
          <th style={thL}>Estado</th>
        </tr>
      </thead>
      <tbody>
        {filas.map((f, i) => (
          <tr key={f.idadmon + i}>
            <td style={td}>{f.idadmon}</td>
            <td style={{ ...td, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.inmueble}</td>
            <td style={td}>
              {f.rol}
              {ROLES_OBSERVADOS[f.idadmon] && <span title="El SII observó este rol en 2025. Ya corregido desde inmuebles." style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 6, background: ROJO_BG, color: ROJO, fontSize: 11, fontWeight: 600 }}>obs. 2025</span>}
            </td>
            <td style={td}>{f.comuna_nombre || '—'} <span style={{ color: TENUE }}>{f.comuna_sii}</span></td>
            <td style={{ ...td, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.propietario}</td>
            <td style={{ ...td, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.arrendatario || <span style={{ color: TENUE }}>(extranjero)</span>}</td>
            <td style={td}>{f.rut_arrendatario || <span style={{ color: TENUE }}>11111111-1</span>}</td>
            <td style={tdNum}>{clp(f.monto_anual)}</td>
            <td style={{ ...td, letterSpacing: 1 }}>{MESES.map(m => f[m] ? 'A' : '·').join('')}</td>
            <td style={td}>
              {(f.falta_comuna || f.falta_rut_propietario)
                ? <span style={{ color: AMBAR }}>faltan datos{f.falta_comuna ? ' · comuna' : ''}{f.falta_rut_propietario ? ' · RUT dueño' : ''}</span>
                : <span style={{ color: VERDE }}>ok</span>}
            </td>
          </tr>
        ))}
        {filas.length === 0 && <tr><td colSpan={10} style={{ ...td, textAlign: 'center', color: TENUE, padding: 24 }}>Ningún caso coincide con el filtro.</td></tr>}
      </tbody>
    </table>
  )
}

function TablaSII({ filas }) {
  const thS = { ...th, position: 'sticky', top: 0, zIndex: 5 }
  return (
    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
      <thead><tr>{CAB_SII.map(c => <th key={c} style={thS}>{c}</th>)}</tr></thead>
      <tbody>{filas.map((f, i) => <tr key={f.idadmon + i}>{filaSII(f).map((v, j) => <td key={j} style={j === 8 ? tdNum : td}>{v}</td>)}</tr>)}</tbody>
    </table>
  )
}

function TablaCSV({ filas }) {
  const thS = { ...th, position: 'sticky', top: 0, zIndex: 5 }
  return (
    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
      <thead><tr>{CAB_SII.map((c, i) => <th key={c} style={thS}>{i + 1}</th>)}</tr></thead>
      <tbody>{filas.map((f, i) => <tr key={f.idadmon + i}>{filaSII(f).map((v, j) => <td key={j} style={td}>{v === '' ? '' : v}</td>)}</tr>)}</tbody>
    </table>
  )
}

function TablaLineas({ filas }) {
  const thS = { ...th, position: 'sticky', top: 0, zIndex: 5 }
  return (
    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
      <thead><tr><th style={thS}>#</th><th style={thS}>LINEA_CSV</th></tr></thead>
      <tbody>{filas.map((f, i) => (
        <tr key={f.idadmon + i}>
          <td style={{ ...td, color: TENUE }}>{i + 1}</td>
          <td style={{ ...td, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12 }}>{filaSII(f).join(';')}</td>
        </tr>
      ))}</tbody>
    </table>
  )
}
