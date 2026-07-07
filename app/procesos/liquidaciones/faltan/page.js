'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../../lib/supabaseClient'
import TopNav from '@/app/components/ui/TopNav'

const DIRECCION_EMAILS = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']
// Comentario interno de FALTAN: solo Direccion (alberto/luis) y Admin. Karina NO escribe aqui.
const COMENTAR_EMAILS = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com']

const n0 = v => { const x = Number(v); return isNaN(x) ? 0 : x }
const NUM_FONT = { fontFamily: '"DM Mono", "Roboto Mono", ui-monospace, "SF Mono", "Cascadia Mono", Consolas, Menlo, monospace', fontVariantNumeric: 'tabular-nums' }
const fmtPesos = n => {
  const v = Number(n)
  const s = (isNaN(v) || n === null || n === '') ? '—' : '$' + Math.round(v).toLocaleString('es-CL')
  return <span style={NUM_FONT}>{s}</span>
}
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
  const puedeComentar = rol === 'admin' || COMENTAR_EMAILS.includes(email)   // Direccion + Admin

  const [accesoOk, setAccesoOk] = useState(null)
  const [mes, setMes] = useState(mesEnCurso())
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [filas, setFilas] = useState([])
  // Comentarios internos por idadmon (del mes cargado)
  const [comentarios, setComentarios] = useState({})   // idadmon -> { comentario, actualizado_por, actualizado_at }
  const [editCom, setEditCom] = useState(null)          // idadmon en edicion (o null)
  const [editTxt, setEditTxt] = useState('')
  const [savingCom, setSavingCom] = useState(false)

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
    setCargando(true); setError(null); setFilas([]); setComentarios({})
    try {
      // 1) Liquidación del periodo -> quedarse con los que tienen falta de arriendo > 0
      const { data: liq, error: e1 } = await supabase.rpc('calcular_liquidacion', { p_mes: m })
      if (e1) { setError(e1.message); setCargando(false); return }
      // 1b) Fusionar por IDADMON: la línea normal y la [proporcional mes anterior]
      //     se combinan en UNA fila -> a cobrar, recibido y falta = suma de ambas.
      const porId = {}
      for (const r of (liq || [])) {
        const esProp = String(r.inmueble || '').startsWith('[proporcional')
        if (!porId[r.idadmon]) porId[r.idadmon] = { idadmon: r.idadmon, propietario: r.propietario, inmueble: '', base: 0, recibido: 0, falta: 0 }
        const g = porId[r.idadmon]
        g.base += n0(r.base); g.recibido += n0(r.recibido_banco); g.falta += n0(r.falta)
        if (!esProp) g.inmueble = r.inmueble
        else if (!g.inmueble) g.inmueble = String(r.inmueble || '').replace('[proporcional mes anterior] ', '')
      }
      const conFalta = Object.values(porId).filter(g => g.falta > 0)
      if (conFalta.length === 0) { setFilas([]); setCargando(false); return }

      // 2) Servicios (saldo vigente = fila del aamm más alto por IDADMON)
      const ids = conFalta.map(g => g.idadmon)
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

      const out = conFalta.map(g => {
        const s = vig[g.idadmon] || { ggcc: 0, luz: 0, agua: 0, gas: 0, aamm: null }
        const servTotal = s.ggcc + s.luz + s.agua + s.gas
        return {
          idadmon: g.idadmon, propietario: g.propietario, inmueble: g.inmueble,
          falta: g.falta, base: g.base, recibido: g.recibido,
          ggcc: s.ggcc, luz: s.luz, agua: s.agua, gas: s.gas, servTotal, servAamm: s.aamm,
        }
      }).sort((a, b) => b.falta - a.falta)   // por deuda de arriendo desc

      setFilas(out)

      // 3) Comentarios internos del mes (por idadmon)
      try {
        const rc = await fetch(`/api/faltan/comentario?mes=${m}`, { cache: 'no-store' })
        const jc = await rc.json()
        const map = {}
        for (const c of (jc.rows || [])) map[c.idadmon] = c
        setComentarios(map)
      } catch { setComentarios({}) }
    } catch (err) { setError(err.message) }
    setCargando(false)
  }

  function abrirEditCom(idadmon) {
    if (!puedeComentar) return
    setEditCom(idadmon)
    setEditTxt((comentarios[idadmon] && comentarios[idadmon].comentario) || '')
  }
  async function guardarCom() {
    if (editCom == null) return
    setSavingCom(true)
    try {
      const res = await fetch('/api/faltan/comentario', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idadmon: editCom, mes, comentario: editTxt }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Error al guardar')
      setComentarios(prev => {
        const n = { ...prev }
        const txt = String(editTxt || '').trim()
        if (txt === '') delete n[editCom]
        else n[editCom] = { comentario: txt, actualizado_por: j.actualizado_por, actualizado_at: j.actualizado_at }
        return n
      })
      setEditCom(null); setEditTxt('')
    } catch (e) { alert(e.message) }
    setSavingCom(false)
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
        {valor > 0 ? <span style={NUM_FONT}>{'$' + valor.toLocaleString('es-CL')}</span> : '—'}
      </div>
    )
  }

  const th = { fontSize: 11, color: '#888', fontWeight: 700 }
  const GRID = '0.7fr 1.4fr 1.5fr 0.9fr 0.9fr 0.8fr 0.8fr 0.8fr 0.8fr 0.9fr 1.5fr'

  return (
    <>
      <TopNav />
      <div style={{ maxWidth: 1460, margin: '0 auto', padding: 24, fontFamily: '"DM Sans", sans-serif', fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum" 1' }}>

        {/* Cabecera */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
          <button onClick={() => router.push('/procesos/liquidaciones')}
            style={{ fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: '1px solid #D3D1C7', background: '#fff', color: '#2C2C2A', cursor: 'pointer' }}>
            ← TRANSFER
          </button>
          <button onClick={() => router.push('/procesos/liquidaciones/cartas')}
            style={{ fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: '1px solid #C7D2FE', background: '#EEF2FF', color: '#3730A3', cursor: 'pointer' }}>
            📄 CARTAS
          </button>
          <button onClick={() => router.push('/procesos/liquidaciones/emails')}
            style={{ fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: '1px solid #A7F3D0', background: '#ECFDF5', color: '#065F46', cursor: 'pointer' }}>
            ✉ EMAILS
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
              <div style={th}>Coment. interno</div>
            </div>

            <div style={{ background: '#fff', borderLeft: '1px solid #E8E6E0', borderRight: '1px solid #E8E6E0', borderBottom: '1px solid #E8E6E0', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
              {filas.length === 0 && <div style={{ padding: 20, color: '#888', fontSize: 13 }}>No hay morosos de arriendo en {aammToTxt(mes)}. 🎉</div>}

              {filas.map((f, i) => (
                <div key={f.idadmon + (f.esProp ? '·prop' : '')} style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, padding: '9px 16px', borderTop: i ? '1px solid #F0EEE8' : 'none', alignItems: 'center', fontSize: 12.5, background: '#fff' }}>
                  <div style={{ fontWeight: 600 }}>{f.idadmon}</div>
                  <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={f.propietario || ''}>{f.propietario || '—'}</div>
                  <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#666' }} title={f.inmueble || ''}>{f.inmueble || '—'}</div>
                  <div style={{ textAlign: 'right' }}>{fmtPesos(f.base)}</div>
                  <div style={{ textAlign: 'right', fontWeight: 700, color: '#B91C1C' }}>{fmtPesos(f.falta)}</div>
                  {celdaServ(f.ggcc, UMBRAL.ggcc)}
                  {celdaServ(f.luz, UMBRAL.luz)}
                  {celdaServ(f.agua, UMBRAL.agua)}
                  {celdaServ(f.gas, UMBRAL.gas)}
                  <div style={{ textAlign: 'right', fontWeight: 600 }}>{f.servTotal > 0 ? <span style={NUM_FONT}>{'$' + f.servTotal.toLocaleString('es-CL')}</span> : '—'}</div>
                  {/* Comentario interno (Direccion + Admin) */}
                  <div style={{ minWidth: 0 }}>
                    {puedeComentar ? (
                      (comentarios[f.idadmon] && comentarios[f.idadmon].comentario) ? (
                        <div onClick={() => abrirEditCom(f.idadmon)} title={comentarios[f.idadmon].comentario}
                          style={{ cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 12, fontWeight: 600, color: '#92400E', background: '#FEF3C7', border: '1px solid #FDE68A', padding: '2px 8px', borderRadius: 6 }}>
                          {comentarios[f.idadmon].comentario}
                        </div>
                      ) : (
                        <div onClick={() => abrirEditCom(f.idadmon)} title="Añadir comentario interno"
                          style={{ cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 12, color: '#9CA3AF' }}>
                          ✎ comentar
                        </div>
                      )
                    ) : (
                      <div title={(comentarios[f.idadmon] && comentarios[f.idadmon].comentario) || ''}
                        style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 12, fontWeight: (comentarios[f.idadmon] && comentarios[f.idadmon].comentario) ? 600 : 400, color: (comentarios[f.idadmon] && comentarios[f.idadmon].comentario) ? '#92400E' : '#666' }}>
                        {(comentarios[f.idadmon] && comentarios[f.idadmon].comentario) || '—'}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div style={{ fontSize: 11, color: '#B4B2A9', marginTop: 10 }}>
          Umbrales de riesgo (en rojo al superar): GGCC &gt; $100.000 · Luz &gt; $80.000 · Agua &gt; $50.000 · Gas &gt; $50.000. Servicios = saldo vigente del último mes cargado.
        </div>
      </div>

      {/* Modal: editar comentario interno */}
      {editCom != null && (
        <div onClick={() => !savingCom && setEditCom(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 12, padding: 22, width: 'min(520px, 92vw)', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>Comentario interno · {editCom}</h3>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>{aammToTxt(mes)} · visible solo para Dirección y Admin</div>
            <textarea value={editTxt} onChange={e => setEditTxt(e.target.value)} rows={4} autoFocus
              placeholder="Ej: pagó doble el mes pasado · está con problemas, pagará el día 15 · abandonó el depto…"
              style={{ width: '100%', boxSizing: 'border-box', fontSize: 13, padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: 8, fontFamily: 'inherit', resize: 'vertical' }} />
            {comentarios[editCom] && comentarios[editCom].actualizado_por && (
              <div style={{ fontSize: 11, color: '#B4B2A9', marginTop: 6 }}>
                Última edición: {comentarios[editCom].actualizado_por}{comentarios[editCom].actualizado_at ? ' · ' + new Date(comentarios[editCom].actualizado_at).toLocaleString('es-CL') : ''}
              </div>
            )}
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setEditCom(null)} disabled={savingCom}
                style={{ fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', color: '#374151', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={guardarCom} disabled={savingCom}
                style={{ fontSize: 13, fontWeight: 700, padding: '8px 18px', borderRadius: 8, border: 'none', background: '#1D9E75', color: '#fff', cursor: 'pointer' }}>{savingCom ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const metric = { flex: 1, minWidth: 150, background: '#fff', border: '1px solid #E8E6E0', borderRadius: 12, padding: '12px 16px' }
const metricLbl = { fontSize: 12, color: '#888' }
const metricVal = { fontSize: 20, fontWeight: 700, color: '#1a1a2e' }
