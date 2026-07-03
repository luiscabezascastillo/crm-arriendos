'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../../lib/supabaseClient'
import TopNav from '@/app/components/ui/TopNav'

const DIRECCION_EMAILS = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']

const n0 = v => { const x = Number(v); return isNaN(x) ? 0 : x }
const fmtPesos = n => { const v = Number(n); if (isNaN(v) || n === null || n === '') return '—'; return '$' + Math.round(v).toLocaleString('es-CL') }
const MESES_TXT = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
const aammToTxt = aamm => { if (!aamm || String(aamm).length !== 4) return aamm; const a = String(aamm).slice(0, 2), m = parseInt(String(aamm).slice(2), 10); return `${MESES_TXT[m - 1] || '?'} 20${a}` }
function generarMeses() {
  const out = []; const hoy = new Date()
  for (let i = 6; i >= -1; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
    out.push(String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0'))
  }
  return out
}
function mesEnCurso() {
  const h = new Date(); let y = h.getFullYear(), m = h.getMonth()
  if (h.getDate() >= 23) { m += 1; if (m > 11) { m = 0; y += 1 } }
  return String(y).slice(2) + String(m + 1).padStart(2, '0')
}

// Umbrales de riesgo por servicio (rojo al superar)
const UMBRAL = { ggcc: 100000, luz: 80000, agua: 50000, gas: 50000 }

export default function FaltanPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const email = session?.user?.email
  const rol = session?.user?.role

  const [accesoOk, setAccesoOk] = useState(null)
  const [mes, setMes] = useState(mesEnCurso())
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [filas, setFilas] = useState([])

  // Acceso (mismo criterio que Liquidaciones)
  useEffect(() => {
    if (status !== 'authenticated' || !email) return
    if (rol === 'admin' || DIRECCION_EMAILS.includes(email)) { setAccesoOk(true); return }
    supabase.from('proceso_permisos').select('proceso').eq('email', email).eq('activo', true)
      .then(({ data }) => setAccesoOk(!!(data || []).some(p => (p.proceso || '').toLowerCase().includes('liquidac'))))
  }, [status, email, rol])
  useEffect(() => { if (accesoOk === false) router.replace('/') }, [accesoOk, router])
  useEffect(() => { if (accesoOk === true) cargar(mes) }, [accesoOk])

  async function cargar(m) {
    setCargando(true); setError(null); setFilas([])
    try {
      // 1) Liquidación del periodo -> quedarse con los que tienen falta de arriendo > 0
      const { data: liq, error: e1 } = await supabase.rpc('calcular_liquidacion', { p_mes: m })
      if (e1) { setError(e1.message); setCargando(false); return }
      const enFalta = (liq || []).filter(r => n0(r.falta) > 0)
      if (enFalta.length === 0) { setFilas([]); setCargando(false); return }

      // 2) Servicios (saldo vigente = fila del aamm más alto por IDADMON)
      const ids = [...new Set(enFalta.map(r => r.idadmon))]
      const { data: serv, error: e2 } = await supabase
        .from('ggcc_agua_luz')
        .select('idadmon, aamm, deuda_gastos_comunes, deuda_vigente_electricidad, deuda_vigente_agua, deuda_vigente_gas')
        .in('idadmon', ids)
      if (e2) { setError(e2.message); setCargando(false); return }

      // Por IDADMON, quedarse con la fila del aamm más reciente (saldo vigente)
      const vig = {}
      for (const s of serv || []) {
        const a = parseInt(String(s.aamm || '0'), 10)
        if (!vig[s.idadmon] || a > vig[s.idadmon]._a) {
          vig[s.idadmon] = {
            _a: a, aamm: s.aamm,
            ggcc: n0(s.deuda_gastos_comunes),
            luz: n0(s.deuda_vigente_electricidad),
            agua: n0(s.deuda_vigente_agua),
            gas: n0(s.deuda_vigente_gas),
          }
        }
      }

      const out = enFalta.map(r => {
        const s = vig[r.idadmon] || { ggcc: 0, luz: 0, agua: 0, gas: 0, aamm: null }
        const servTotal = s.ggcc + s.luz + s.agua + s.gas
        return {
          idadmon: r.idadmon, propietario: r.propietario, inmueble: r.inmueble,
          falta: n0(r.falta), base: n0(r.base), recibido: n0(r.recibido_banco),
          ggcc: s.ggcc, luz: s.luz, agua: s.agua, gas: s.gas, servTotal, servAamm: s.aamm,
        }
      }).sort((a, b) => b.falta - a.falta)   // por deuda de arriendo desc

      setFilas(out)
    } catch (err) { setError(err.message) }
    setCargando(false)
  }

  if (status === 'loading' || accesoOk === null) return (<><TopNav /><div style={{ padding: 40, color: '#888' }}>Cargando…</div></>)
  if (accesoOk === false) return null

  const totFalta = filas.reduce((s, f) => s + f.falta, 0)
  const totServ = filas.reduce((s, f) => s + f.servTotal, 0)

  // celda de servicio con color de riesgo si supera el umbral
  const celdaServ = (valor, umbral) => {
    const rojo = valor > umbral
    return (
      <div style={{ textAlign: 'right', color: rojo ? '#B91C1C' : (valor > 0 ? '#374151' : '#C7C7C2'), fontWeight: rojo ? 700 : 400 }}>
        {valor > 0 ? '$' + valor.toLocaleString('es-CL') : '—'}
      </div>
    )
  }

  const th = { fontSize: 11, color: '#888', fontWeight: 700 }
  const GRID = '0.7fr 1.4fr 1.5fr 0.9fr 0.9fr 0.8fr 0.8fr 0.8fr 0.8fr 0.9fr'

  return (
    <>
      <TopNav />
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: 24, fontFamily: '"DM Sans", sans-serif' }}>

        {/* Cabecera */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
          <button onClick={() => router.push('/procesos/liquidaciones')}
            style={{ fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: '1px solid #D3D1C7', background: '#fff', color: '#2C2C2A', cursor: 'pointer' }}>
            ← Volver a Liquidaciones
          </button>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>FALTAN · morosidad de arriendo</h1>
        </div>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
          IDADMON de la liquidación de <b>{aammToTxt(mes)}</b> que no han pagado la totalidad del arriendo, ordenados por deuda. Los servicios muestran el saldo vigente (riesgo).
        </div>

        {/* Barra: mes */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          <label style={{ fontSize: 13, color: '#666' }}>Mes:</label>
          <select value={mes} onChange={e => { setMes(e.target.value); cargar(e.target.value) }}
            style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid #E5E7EB', fontSize: 13, fontFamily: 'inherit' }}>
            {generarMeses().map(m => <option key={m} value={m}>{aammToTxt(m)}</option>)}
          </select>
          <button onClick={() => cargar(mes)} disabled={cargando}
            style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 7, border: 'none', background: '#1D9E75', color: '#fff', cursor: 'pointer' }}>
            {cargando ? 'Calculando…' : '🔄 Recalcular'}
          </button>
        </div>

        {/* KPIs */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={metric}><div style={metricLbl}>En falta</div><div style={metricVal}>{filas.length}</div></div>
          <div style={metric}><div style={metricLbl}>Falta de arriendo</div><div style={{ ...metricVal, color: '#dc2626' }}>{fmtPesos(totFalta)}</div></div>
          <div style={metric}><div style={metricLbl}>Deuda servicios (vigente)</div><div style={metricVal}>{fmtPesos(totServ)}</div></div>
        </div>

        {error && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', fontSize: 13, padding: '10px 14px', borderRadius: 8, marginBottom: 12 }}>Error: {error}</div>}

        {cargando ? <div style={{ color: '#888', padding: 20 }}>Calculando…</div> : (
          <>
            {/* Fila de títulos: sticky de verdad (fuera del contenedor con overflow) */}
            <div style={{ position: 'sticky', top: 0, zIndex: 5, display: 'grid', gridTemplateColumns: GRID, gap: 8, padding: '10px 16px', background: '#FAFAF8', border: '1px solid #E8E6E0', borderRadius: '12px 12px 0 0' }}>
              <div style={th}>IDADMON</div>
              <div style={th}>Propietario</div>
              <div style={th}>Inmueble</div>
              <div style={{ ...th, textAlign: 'right' }}>A cobrar</div>
              <div style={{ ...th, textAlign: 'right' }}>Falta arriendo</div>
              <div style={{ ...th, textAlign: 'right' }}>GGCC</div>
              <div style={{ ...th, textAlign: 'right' }}>Luz</div>
              <div style={{ ...th, textAlign: 'right' }}>Agua</div>
              <div style={{ ...th, textAlign: 'right' }}>Gas</div>
              <div style={{ ...th, textAlign: 'right' }}>Serv. total</div>
            </div>

            <div style={{ background: '#fff', borderLeft: '1px solid #E8E6E0', borderRight: '1px solid #E8E6E0', borderBottom: '1px solid #E8E6E0', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
              {filas.length === 0 && <div style={{ padding: 20, color: '#888', fontSize: 13 }}>No hay morosos de arriendo en {aammToTxt(mes)}. 🎉</div>}

              {filas.map((f, i) => (
                <div key={f.idadmon} style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, padding: '9px 16px', borderTop: i ? '1px solid #F0EEE8' : 'none', alignItems: 'center', fontSize: 12.5, background: '#fff' }}>
                  <div style={{ fontWeight: 600 }}>{f.idadmon}</div>
                  <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={f.propietario || ''}>{f.propietario || '—'}</div>
                  <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#666' }} title={f.inmueble || ''}>{f.inmueble || '—'}</div>
                  <div style={{ textAlign: 'right' }}>{fmtPesos(f.base)}</div>
                  <div style={{ textAlign: 'right', fontWeight: 700, color: '#B91C1C' }}>{fmtPesos(f.falta)}</div>
                  {celdaServ(f.ggcc, UMBRAL.ggcc)}
                  {celdaServ(f.luz, UMBRAL.luz)}
                  {celdaServ(f.agua, UMBRAL.agua)}
                  {celdaServ(f.gas, UMBRAL.gas)}
                  <div style={{ textAlign: 'right', fontWeight: 600 }}>{f.servTotal > 0 ? '$' + f.servTotal.toLocaleString('es-CL') : '—'}</div>
                </div>
              ))}
            </div>
          </>
        )}

        <div style={{ fontSize: 11, color: '#B4B2A9', marginTop: 10 }}>
          Umbrales de riesgo (en rojo al superar): GGCC &gt; $100.000 · Luz &gt; $80.000 · Agua &gt; $50.000 · Gas &gt; $50.000. Servicios = saldo vigente del último mes cargado.
        </div>
      </div>
    </>
  )
}

const metric = { flex: 1, minWidth: 150, background: '#fff', border: '1px solid #E8E6E0', borderRadius: 12, padding: '12px 16px' }
const metricLbl = { fontSize: 12, color: '#888' }
const metricVal = { fontSize: 20, fontWeight: 700, color: '#1a1a2e' }