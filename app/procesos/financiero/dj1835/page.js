// VERSION: v1 · 2026-07-25 · Pantalla DJ 1835 (arriendos SII, financiero).
//   · Selector de año.
//   · Totales del año (declarables, monto, no declarables, datos faltantes).
//   · Cuatro vistas conmutables, todas con encabezado:
//       1. LEGIBLE      — para revisar (idadmon, propiedad, rol, arrendatario, meses).
//       2. FORMATO SII  — manzana/predio/comuna/ruts partidos/monto/meses A.
//       3. VALORES CSV  — los mismos campos, crudos.
//       4. LÍNEAS CSV   — la línea ; lista para el importador del SII.
//   · Exporta el .csv del SII. Congela el año declarado (dj1835_cargas).
//
// La DJ se genera desde vw_dj1835 (una línea por contrato/año). Monto anual = suma de
// a_cobrar de los meses arrendados. Comuna y RUT dueño ya vienen resueltos en la vista.
// Sólo van al SII las líneas declarables (monto > 0); las demás se muestran marcadas.
'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo, Fragment } from 'react'
import TopNav from '@/app/components/ui/TopNav'

const EDITORES = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MES_UP = MESES.map(m => m.toUpperCase())
const RUT_FCR = { num: '76828712', dv: '0' } // declarante

const VERDE = '#085041'
const VERDE_CLARO = '#E1F5EE'
const BORDE = '#E5E4DF'
const TENUE = '#888780'
const ROJO_BG = '#FBE9E7'
const ROJO = '#B23A3A'
const AMBAR_BG = '#FDF6E3'
const AMBAR = '#9A6E00'

const clp = (n) => (n == null ? '—' : Number(n).toLocaleString('es-CL'))

// Roles que el SII observó en la DJ 2025 (R450/V390): rol mal formado.
// Se marcan en pantalla para revisarlos. Corregir el rol en el origen los limpia.
const ROLES_OBSERVADOS = { 'A00695': '590-574', 'A00684': '1756-2' }

// ---------- transformaciones de formato ----------
function partirRol(rol) {
  if (!rol) return { manzana: '', predio: '' }
  const m = String(rol).match(/(\d+)\s*-\s*(\d+)/)
  if (!m) return { manzana: rol, predio: '' }
  return { manzana: m[1].padStart(5, '0'), predio: String(parseInt(m[2], 10)) }
}
function rutConGuion(rut) {
  if (!rut || rut === '') return '11111111-1' // extranjero sin RUT
  return String(rut).replace(/\./g, '').replace(/\s/g, '')
}
function rutPartido(rut) {
  if (!rut || rut === '') return { num: '11111111', dv: '1' }
  const s = String(rut).replace(/\./g, '').replace(/\s/g, '')
  const m = s.match(/(\d+)\s*-\s*([\dkK])/)
  if (!m) return { num: s, dv: '' }
  return { num: m[1], dv: m[2].toUpperCase() }
}

// Cabeceras del formato SII (25 columnas)
const CAB_SII = [
  'MANZANA', 'PREDIO', 'COD_COMUNA', 'RUT_PROPIETARIO',
  'RUT_FCR', 'DV_FCR', 'RUT_ARREND', 'DV_ARREND', 'MONTO_ANUAL',
  ...MES_UP, 'AMOBLADO', 'DESTINO', 'DFL2', 'NATURALEZA',
]

// Una fila de 25 valores en el orden del SII
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
  const [cargas, setCargas] = useState([])
  const [anioSel, setAnioSel] = useState(null)
  const [lineas, setLineas] = useState([])
  const [cargaAnio, setCargaAnio] = useState(null) // estado congelado del año
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [vista, setVista] = useState('LEGIBLE') // LEGIBLE | SII | CSV | LINEAS
  const [soloDeclarables, setSoloDeclarables] = useState(true)
  const [congelando, setCongelando] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/')
  }, [status, router])

  // Años disponibles
  useEffect(() => {
    if (status !== 'authenticated') return
    ;(async () => {
      try {
        const r = await fetch('/api/financiero/dj1835')
        const j = await r.json()
        if (j.error) { setError(j.error); setCargando(false); return }
        setAnios(j.anios || [])
        setCargas(j.cargas || [])
        if ((j.anios || []).length) setAnioSel(j.anios[0])
        else setCargando(false)
      } catch (e) {
        setError('No se pudo conectar con el servidor.')
        setCargando(false)
      }
    })()
  }, [status])

  // Líneas del año seleccionado
  const recargar = async () => {
    if (!anioSel) return
    setCargando(true)
    setError(null)
    try {
      const r = await fetch(`/api/financiero/dj1835?anio=${anioSel}`)
      const j = await r.json()
      if (j.error) { setError(j.error); setLineas([]); return }
      setLineas(j.lineas || [])
      setCargaAnio(j.carga || null)
    } catch (e) {
      setError('No se pudieron cargar las líneas.')
      setLineas([])
    } finally {
      setCargando(false)
    }
  }
  useEffect(() => { if (anioSel) recargar() }, [anioSel])

  // ------- derivados -------
  const declarables = useMemo(() => lineas.filter(l => l.declarable), [lineas])
  const noDeclarables = useMemo(() => lineas.filter(l => !l.declarable), [lineas])
  const visibles = useMemo(
    () => (soloDeclarables ? declarables : lineas),
    [soloDeclarables, declarables, lineas]
  )

  const totales = useMemo(() => {
    const n = declarables.length
    const monto = declarables.reduce((s, l) => s + (Number(l.monto_anual) || 0), 0)
    const sinComuna = declarables.filter(l => l.falta_comuna).length
    const sinRutProp = declarables.filter(l => l.falta_rut_propietario).length
    return { n, monto, sinComuna, sinRutProp, noDecl: noDeclarables.length }
  }, [declarables, noDeclarables])

  const congelado = !!cargaAnio?.congelado

  // ------- exportar CSV -------
  const descargarCSV = () => {
    const filas = declarables.map(f => filaSII(f).join(';'))
    const txt = filas.join('\r\n')
    const blob = new Blob([txt], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `DJ1835_${anioSel}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const congelar = async () => {
    if (!puedeEditar || congelando) return
    if (!confirm(`Congelar el año ${anioSel}? Guardará una copia de las ${totales.n} líneas declaradas. No se podrá recalcular después.`)) return
    setCongelando(true)
    setAviso(null)
    try {
      const r = await fetch('/api/financiero/dj1835', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anio: anioSel }),
      })
      const j = await r.json()
      if (j.error) { setAviso({ tipo: 'error', txt: j.error }); return }
      setAviso({ tipo: 'ok', txt: `Año ${anioSel} congelado: ${j.n_casos} líneas, ${clp(j.total_monto)}.` })
      recargar()
    } catch (e) {
      setAviso({ tipo: 'error', txt: 'No se pudo congelar.' })
    } finally {
      setCongelando(false)
    }
  }

  if (status === 'loading') {
    return <div style={{ padding: 40, color: TENUE }}>Cargando…</div>
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF8' }}>
      <TopNav />
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 20px 80px' }}>

        {/* Cabecera */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 13, color: TENUE, marginBottom: 4 }}>Procesos · Financiero</div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1A1A17', margin: 0 }}>DJ 1835 · Bienes raíces arrendados</h1>
            <div style={{ fontSize: 14, color: TENUE, marginTop: 4 }}>
              Declaración jurada anual. Se genera desde las liquidaciones; no se teclea.
            </div>
          </div>

          {/* Selector de año */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: TENUE }}>Año de los arriendos</span>
              <select
                value={anioSel || ''}
                onChange={e => setAnioSel(Number(e.target.value))}
                style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${BORDE}`, fontSize: 15, fontWeight: 600, color: VERDE, background: '#fff' }}
              >
                {anios.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              {congelado && (
                <span style={{ padding: '4px 10px', borderRadius: 999, background: VERDE_CLARO, color: VERDE, fontSize: 12, fontWeight: 600 }}>
                  Congelado
                </span>
              )}
            </div>
            {anioSel && (
              <span style={{ fontSize: 12, color: TENUE }}>
                Arriendos {anioSel} → se declara en el Año Tributario {anioSel + 1}
              </span>
            )}
          </div>
        </div>

        {error && (
          <div style={{ padding: 14, borderRadius: 10, background: ROJO_BG, color: ROJO, marginBottom: 16 }}>{error}</div>
        )}
        {aviso && (
          <div style={{ padding: 14, borderRadius: 10, marginBottom: 16, background: aviso.tipo === 'ok' ? VERDE_CLARO : ROJO_BG, color: aviso.tipo === 'ok' ? VERDE : ROJO }}>
            {aviso.txt}
          </div>
        )}

        {/* Totales */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
          <Tarjeta label="Casos declarables" valor={totales.n} sub={`${anioSel || ''}`} />
          <Tarjeta label="Monto arriendo anual" valor={clp(totales.monto)} acento />
          <Tarjeta label="No declarables" valor={totales.noDecl} sub="sin arriendo real" tenue />
          <Tarjeta
            label="Datos faltantes"
            valor={totales.sinComuna + totales.sinRutProp}
            sub={(totales.sinComuna + totales.sinRutProp) ? `${totales.sinComuna} comuna · ${totales.sinRutProp} RUT dueño` : 'ninguno'}
            alerta={(totales.sinComuna + totales.sinRutProp) > 0}
          />
        </div>

        {/* Botones de vista */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          <BotonVista actual={vista} valor="LEGIBLE" set={setVista}>Legible</BotonVista>
          <BotonVista actual={vista} valor="SII" set={setVista}>Formato SII</BotonVista>
          <BotonVista actual={vista} valor="CSV" set={setVista}>Valores CSV</BotonVista>
          <BotonVista actual={vista} valor="LINEAS" set={setVista}>Líneas CSV</BotonVista>

          <div style={{ flex: 1 }} />

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: TENUE }}>
            <input type="checkbox" checked={soloDeclarables} onChange={e => setSoloDeclarables(e.target.checked)} />
            Solo declarables
          </label>
          <button onClick={descargarCSV} style={btnPrimario}>Descargar .csv</button>
          {puedeEditar && !congelado && (
            <button onClick={congelar} disabled={congelando} style={btnSecundario}>
              {congelando ? 'Congelando…' : 'Congelar año'}
            </button>
          )}
        </div>

        {/* Tabla */}
        {cargando ? (
          <div style={{ padding: 40, color: TENUE }}>Cargando líneas…</div>
        ) : (
          <div style={{ overflowX: 'auto', border: `1px solid ${BORDE}`, borderRadius: 12, background: '#fff' }}>
            {vista === 'LEGIBLE' && <TablaLegible filas={visibles} />}
            {vista === 'SII' && <TablaSII filas={soloDeclarables ? declarables : declarables} />}
            {vista === 'CSV' && <TablaCSV filas={declarables} />}
            {vista === 'LINEAS' && <TablaLineas filas={declarables} />}
          </div>
        )}

        {vista !== 'LEGIBLE' && (
          <div style={{ fontSize: 12, color: TENUE, marginTop: 8 }}>
            Las vistas de formato SII solo incluyen líneas declarables ({totales.n}).
          </div>
        )}
      </div>
    </div>
  )
}

// ---------- componentes ----------
function Tarjeta({ label, valor, sub, acento, tenue, alerta }) {
  return (
    <div style={{
      padding: 16, borderRadius: 12, border: `1px solid ${alerta ? '#F0D8A8' : BORDE}`,
      background: alerta ? AMBAR_BG : '#fff',
    }}>
      <div style={{ fontSize: 12, color: alerta ? AMBAR : TENUE, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: acento ? VERDE : (tenue ? TENUE : '#1A1A17') }}>{valor}</div>
      {sub && <div style={{ fontSize: 12, color: alerta ? AMBAR : TENUE, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function BotonVista({ actual, valor, set, children }) {
  const activo = actual === valor
  return (
    <button
      onClick={() => set(valor)}
      style={{
        padding: '8px 14px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
        border: `1px solid ${activo ? VERDE : BORDE}`,
        background: activo ? VERDE : '#fff',
        color: activo ? '#fff' : '#1A1A17',
      }}
    >
      {children}
    </button>
  )
}

const th = { textAlign: 'left', padding: '10px 12px', fontSize: 12, fontWeight: 600, color: TENUE, borderBottom: `1px solid ${BORDE}`, whiteSpace: 'nowrap', background: '#FBFBF9', position: 'sticky', top: 0 }
const td = { padding: '9px 12px', fontSize: 13, color: '#1A1A17', borderBottom: `1px solid ${BORDE}`, whiteSpace: 'nowrap' }
const tdNum = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }

const btnPrimario = { padding: '8px 14px', borderRadius: 8, border: 'none', background: VERDE, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }
const btnSecundario = { padding: '8px 14px', borderRadius: 8, border: `1px solid ${BORDE}`, background: '#fff', color: '#1A1A17', fontSize: 14, fontWeight: 600, cursor: 'pointer' }

// Vista 1: legible
function TablaLegible({ filas }) {
  return (
    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
      <thead>
        <tr>
          <th style={th}>IDADMON</th><th style={th}>Propiedad</th><th style={th}>Rol</th>
          <th style={th}>Comuna</th><th style={th}>Propietario</th><th style={th}>Arrendatario</th>
          <th style={th}>RUT</th><th style={{ ...th, textAlign: 'right' }}>Monto anual</th>
          <th style={th}>Meses</th><th style={th}>Estado</th>
        </tr>
      </thead>
      <tbody>
        {filas.map((f, i) => (
          <tr key={f.idadmon + i} style={{ background: f.declarable ? '#fff' : '#FBFBF9' }}>
            <td style={td}>{f.idadmon}</td>
            <td style={{ ...td, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.inmueble}</td>
            <td style={td}>
              {f.rol}
              {ROLES_OBSERVADOS[f.idadmon] && (
                <span title="El SII observó este rol (R450/V390). Revisar formato." style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 6, background: ROJO_BG, color: ROJO, fontSize: 11, fontWeight: 600 }}>observado</span>
              )}
            </td>
            <td style={td}>{f.comuna_nombre || '—'} <span style={{ color: TENUE }}>{f.comuna_sii}</span></td>
            <td style={{ ...td, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.propietario}</td>
            <td style={{ ...td, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.arrendatario || <span style={{ color: TENUE }}>(extranjero)</span>}</td>
            <td style={td}>{f.rut_arrendatario || <span style={{ color: TENUE }}>11111111-1</span>}</td>
            <td style={tdNum}>{clp(f.monto_anual)}</td>
            <td style={{ ...td, fontVariantNumeric: 'tabular-nums', letterSpacing: 1 }}>
              {MESES.map(m => f[m] ? 'A' : '·').join('')}
            </td>
            <td style={td}>
              {f.declarable
                ? (f.falta_comuna || f.falta_rut_propietario
                    ? <span style={{ color: AMBAR }}>
                        faltan datos{f.falta_comuna ? ' · comuna' : ''}{f.falta_rut_propietario ? ' · RUT dueño' : ''}
                      </span>
                    : <span style={{ color: VERDE }}>ok</span>)
                : <span style={{ color: TENUE }}>no se declara · {f.motivo_no_declarable}</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// Vista 2: formato SII (25 columnas con encabezado)
function TablaSII({ filas }) {
  return (
    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
      <thead>
        <tr>{CAB_SII.map(c => <th key={c} style={th}>{c}</th>)}</tr>
      </thead>
      <tbody>
        {filas.map((f, i) => (
          <tr key={f.idadmon + i}>
            {filaSII(f).map((v, j) => (
              <td key={j} style={j >= 8 && j === 8 ? tdNum : td}>{v}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// Vista 3: valores crudos (sin nombres de comuna, tal como van al CSV)
function TablaCSV({ filas }) {
  return (
    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
      <thead>
        <tr>{CAB_SII.map((c, i) => <th key={c} style={th}>{i + 1}</th>)}</tr>
      </thead>
      <tbody>
        {filas.map((f, i) => (
          <tr key={f.idadmon + i}>
            {filaSII(f).map((v, j) => <td key={j} style={td}>{v === '' ? '' : v}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// Vista 4: líneas ; (una celda por fila)
function TablaLineas({ filas }) {
  return (
    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
      <thead>
        <tr><th style={th}>#</th><th style={th}>LINEA_CSV</th></tr>
      </thead>
      <tbody>
        {filas.map((f, i) => (
          <tr key={f.idadmon + i}>
            <td style={{ ...td, color: TENUE }}>{i + 1}</td>
            <td style={{ ...td, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12 }}>
              {filaSII(f).join(';')}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
