'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabaseClient'
import TopNav from '@/app/components/ui/TopNav'

const DIRECCION_EMAILS = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']

const norm = s => (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
const n0 = v => { const x = Number(v); return isNaN(x) ? 0 : x }
const fmtPesos = n => { const v = Number(n); if (isNaN(v) || n === null || n === '') return '—'; return '$' + Math.round(v).toLocaleString('es-CL') }
const fmtFecha = s => { if (!s) return '—'; const str = String(s); if (/^\d{4}-\d{2}-\d{2}/.test(str)) { const [y, m, d] = str.slice(0, 10).split('-'); return `${d}/${m}/${y}` } return str }

// Mes AAMM -> etiqueta legible y viceversa
const MESES_TXT = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
const aammToTxt = aamm => { if (!aamm || aamm.length !== 4) return aamm; const a = aamm.slice(0, 2), m = parseInt(aamm.slice(2), 10); return `${MESES_TXT[m - 1] || '?'} 20${a}` }
// Genera lista de meses AAMM desde 2412 hacia atrás y adelante (para el selector)
function generarMeses() {
  const out = []
  const hoy = new Date()
  for (let i = 6; i >= -1; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
    const aa = String(d.getFullYear()).slice(2)
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    out.push(aa + mm)
  }
  return out
}

export default function LiquidacionesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const email = session?.user?.email
  const rol = session?.user?.role

  const [accesoOk, setAccesoOk] = useState(null)
  // Mes de liquidación en curso: el mes actual, pero a partir del día 23
  // ya se prepara el mes siguiente (calendario de cierre de FCR).
  function mesEnCurso() {
    const h = new Date()
    let y = h.getFullYear(), m = h.getMonth()  // m: 0-11
    if (h.getDate() >= 23) { m += 1; if (m > 11) { m = 0; y += 1 } }
    return String(y).slice(2) + String(m + 1).padStart(2, '0')
  }
  const [mes, setMes] = useState(mesEnCurso())
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [propietarios, setPropietarios] = useState([])   // resumen por propietario
  const [detalles, setDetalles] = useState({})            // idprop -> [inmuebles]
  const [expandido, setExpandido] = useState(null)        // idprop expandido
  const [pagoAbierto, setPagoAbierto] = useState(null)    // idadmon con desglose de recibido abierto
  const [busca, setBusca] = useState('')

  // Acceso
  useEffect(() => {
    if (status !== 'authenticated' || !email) return
    if (rol === 'admin' || DIRECCION_EMAILS.includes(email)) { setAccesoOk(true); return }
    supabase.from('proceso_permisos').select('proceso').eq('email', email).eq('activo', true)
      .then(({ data }) => setAccesoOk(!!(data || []).some(p => (p.proceso || '').toLowerCase().includes('liquidac'))))
  }, [status, email, rol])
  useEffect(() => { if (accesoOk === false) router.replace('/') }, [accesoOk, router])
  useEffect(() => { if (accesoOk === true) cargarMes(mes) }, [accesoOk])

  async function cargarMes(m) {
    setCargando(true); setError(null); setExpandido(null); setDetalles({})
    const { data, error } = await supabase.rpc('calcular_liquidacion_propietario', { p_mes: m })
    if (error) { setError(error.message); setPropietarios([]); setCargando(false); return }
    setPropietarios(data || [])
    setCargando(false)
  }

  // Cargar detalle por inmueble + descuentos + comentarios + ajustes del mes
  async function toggle(idprop) {
    if (expandido === idprop) { setExpandido(null); return }
    setExpandido(idprop)
    if (detalles[idprop]) return
    const { data, error } = await supabase.rpc('calcular_liquidacion', { p_mes: mes })
    if (error) { setError(error.message); return }
    const delProp = (data || []).filter(d => d.idprop === idprop)
    const ids = delProp.map(d => d.idadmon)
    let descs = [], coments = [], arriendos = [], pagos = []
    if (ids.length) {
      const [rDesc, rCom, rArr, rPag] = await Promise.all([
        supabase.from('descuentos')
          .select('idadmon, monto_a_transferir, texto_explicativo_para_carta_a_propietario')
          .in('idadmon', ids).eq('mes_a_imputar', aammToTxt(mes)).eq('repercutir_a', 'PROPIETARIO'),
        supabase.from('comentarios_liquidacion')
          .select('idadmon, comentario').in('idadmon', ids).eq('mes', mes),
        supabase.from('datos_arriendos')
          .select('idadmon, fecha_reajuste1, cantidad_reajuste1, fecha_reajuste2, cantidad_reajuste2, fecha_reajuste3, cantidad_reajuste3, fecha_reajuste4, cantidad_reajuste4, fecha_reajuste5, cantidad_reajuste5, fecha_reajuste6, cantidad_reajuste6')
          .in('idadmon', ids),
        supabase.from('bi')
          .select('idadmon2, fecha, reg, arriendo').eq('liquidacion_mes2', mes).in('idadmon2', ids),
      ])
      descs = rDesc.data || []; coments = rCom.data || []; arriendos = rArr.data || []; pagos = rPag.data || []
    }
    // Ajuste del mes = cantidad_reajusteN cuya fecha cae en el mes AAMM liquidado
    const ajustes = {}
    arriendos.forEach(a => {
      for (let i = 1; i <= 6; i++) {
        const f = a['fecha_reajuste' + i], c = n0(a['cantidad_reajuste' + i])
        if (f && c !== 0) {
          const aamm = String(f).slice(2, 4) + String(f).slice(5, 7)  // YYYY-MM-DD -> AAMM
          if (aamm === mes) ajustes[a.idadmon] = c
        }
      }
    })
    // Pie de textos: IDADMON · cantidad · texto
    const pie = []
    ids.forEach(id => {
      descs.filter(d => d.idadmon === id).forEach(d =>
        pie.push({ idadmon: id, cantidad: n0(d.monto_a_transferir), texto: d.texto_explicativo_para_carta_a_propietario || 'Descuento' }))
      if (ajustes[id]) pie.push({ idadmon: id, cantidad: ajustes[id], texto: 'Ajuste del mes' })
      coments.filter(c => c.idadmon === id && c.comentario).forEach(c =>
        pie.push({ idadmon: id, cantidad: null, texto: c.comentario }))
    })
    const sumaDesc = {}
    descs.forEach(d => { sumaDesc[d.idadmon] = (sumaDesc[d.idadmon] || 0) + n0(d.monto_a_transferir) })
    // pagos del BI agrupados por inmueble (para el desglose al pinchar Recibido)
    const pagosPorInm = {}
    pagos.forEach(pg => { (pagosPorInm[pg.idadmon2] = pagosPorInm[pg.idadmon2] || []).push(pg) })
    setDetalles(prev => ({ ...prev, [idprop]: { inmuebles: delProp, pie, sumaDesc, pagosPorInm } }))
  }

  function cambiarMes(m) { setMes(m); cargarMes(m) }

  if (status === 'loading' || accesoOk === null) return (<><TopNav /><div style={{ padding: 40, color: '#888' }}>Cargando…</div></>)
  if (accesoOk === false) return null

  // ── Alertas automáticas por propietario ──
  function alertasDe(p) {
    const out = []
    if (n0(p.n_con_falta) > 0) out.push({ tipo: 'falta', txt: `${p.n_con_falta} inmueble${p.n_con_falta > 1 ? 's' : ''} con falta de pago` })
    if (n0(p.n_propiedades) === 1 && n0(p.total_falta) > 0) out.push({ tipo: 'riesgo', txt: 'Propietario de 1 sola propiedad con falta — recuperar adelanto es difícil' })
    return out
  }

  const q = norm(busca)
  const lista = (propietarios || []).filter(p => !q || norm([p.propietario, p.idprop].join(' ')).includes(q))

  // Totales del mes
  const totMes = lista.reduce((a, p) => ({
    transferir: a.transferir + n0(p.total_transferir),
    comision: a.comision + n0(p.total_comision) + n0(p.total_iva),
    falta: a.falta + n0(p.total_falta),
  }), { transferir: 0, comision: 0, falta: 0 })

  const card = { background: '#fff', border: '1px solid #E8E6E0', borderRadius: 12, padding: 16, marginBottom: 16 }
  const metric = { flex: 1, minWidth: 130, background: '#FAFAF8', borderRadius: 8, padding: '10px 14px' }
  const metricLbl = { fontSize: 12, color: '#888' }
  const metricVal = { fontSize: 20, fontWeight: 700, color: '#1a1a2e' }

  return (
    <>
      <TopNav />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24, fontFamily: '"DM Sans", sans-serif' }}>

        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', margin: '0 0 6px' }}>Liquidaciones</h1>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>Transferencias a propietarios · los datos vienen de sus tablas de origen (datos_arriendos, bi, descuentos)</div>

        {/* Barra: mes + búsqueda */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          <label style={{ fontSize: 13, color: '#666' }}>Mes:</label>
          <select value={mes} onChange={e => cambiarMes(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid #E5E7EB', fontSize: 13, fontFamily: 'inherit' }}>
            {generarMeses().map(m => <option key={m} value={m}>{aammToTxt(m)}</option>)}
          </select>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar propietario…"
            style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid #E5E7EB', fontSize: 13, fontFamily: 'inherit', width: 240 }} />
          <button onClick={() => cargarMes(mes)} disabled={cargando}
            style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 7, border: 'none', background: '#1D9E75', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
            {cargando ? 'Calculando…' : '🔄 Recalcular'}
          </button>
        </div>

        {/* Métricas */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={metric}><div style={metricLbl}>A transferir</div><div style={metricVal}>{fmtPesos(totMes.transferir)}</div></div>
          <div style={metric}><div style={metricLbl}>Comisión + IVA</div><div style={metricVal}>{fmtPesos(totMes.comision)}</div></div>
          <div style={metric}><div style={metricLbl}>Por cobrar (falta)</div><div style={{ ...metricVal, color: '#dc2626' }}>{fmtPesos(totMes.falta)}</div></div>
          <div style={metric}><div style={metricLbl}>Propietarios</div><div style={metricVal}>{lista.length}</div></div>
        </div>

        {error && <div style={{ ...card, background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', fontSize: 13 }}>Error: {error}</div>}

        {cargando ? <div style={{ color: '#888', padding: 20 }}>Calculando liquidación de {aammToTxt(mes)}…</div> : (
          <div style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 12, overflow: 'hidden' }}>

            {/* Cabecera tabla */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 0.8fr 0.8fr 0.7fr 0.6fr 0.75fr 0.85fr 0.45fr', gap: 8, padding: '9px 16px', background: '#FAFAF8', borderBottom: '1px solid #E8E6E0', fontSize: 12, color: '#888', fontWeight: 700 }}>
              <div>Propietario</div>
              <div style={{ textAlign: 'right' }}>A cobrar</div>
              <div style={{ textAlign: 'right' }}>Recibido</div>
              <div style={{ textAlign: 'right' }}>Comisión</div>
              <div style={{ textAlign: 'right' }}>IVA</div>
              <div style={{ textAlign: 'right' }}>Descuentos</div>
              <div style={{ textAlign: 'right' }}>A transferir</div>
              <div style={{ textAlign: 'center' }}>Estado</div>
            </div>

            {lista.length === 0 && <div style={{ padding: 20, color: '#888', fontSize: 13 }}>No hay propietarios con contratos activos para {aammToTxt(mes)}.</div>}

            {lista.map(p => {
              const alertas = alertasDe(p)
              const abierto = expandido === p.idprop
              const detObj = detalles[p.idprop] || null
              const det = detObj ? detObj.inmuebles : []
              const pie = detObj ? detObj.pie : []
              const sumaDesc = detObj ? detObj.sumaDesc : {}
              const GRID = '1.4fr 0.75fr 0.75fr 0.65fr 0.6fr 0.75fr 0.85fr 0.55fr'
              return (
                <div key={p.idprop} style={{ borderTop: '1px solid #F0EEE8' }}>
                  {/* Fila propietario */}
                  <div onClick={() => toggle(p.idprop)}
                    style={{ display: 'grid', gridTemplateColumns: '1.5fr 0.8fr 0.8fr 0.7fr 0.6fr 0.75fr 0.85fr 0.45fr', gap: 8, padding: '11px 16px', cursor: 'pointer', alignItems: 'center', background: abierto ? '#F5F9FF' : '#fff', fontSize: 13 }}>
                    <div style={{ fontWeight: 600, color: '#1a1a2e' }}>
                      <span style={{ color: '#9ca3af', marginRight: 6 }}>{abierto ? '▼' : '▶'}</span>
                      {p.propietario}
                      <span style={{ color: '#9ca3af', fontWeight: 400, fontSize: 12 }}> · {p.n_propiedades} prop{p.n_propiedades > 1 ? 's' : ''}</span>
                    </div>
                    <div style={{ textAlign: 'right', color: '#666' }}>{fmtPesos(p.total_base)}</div>
                    <div style={{ textAlign: 'right', color: '#666' }}>{fmtPesos(p.total_recibido)}</div>
                    <div style={{ textAlign: 'right', color: '#666' }}>{n0(p.total_comision) === 0 ? '—' : fmtPesos(p.total_comision)}</div>
                    <div style={{ textAlign: 'right', color: '#666' }}>{n0(p.total_iva) === 0 ? '—' : fmtPesos(p.total_iva)}</div>
                    <div style={{ textAlign: 'right', color: n0(p.total_descuentos) ? (n0(p.total_descuentos) < 0 ? '#dc2626' : '#1D9E75') : '#ccc' }}>{n0(p.total_descuentos) ? fmtPesos(p.total_descuentos) : '—'}</div>
                    <div style={{ textAlign: 'right', fontWeight: 700 }}>{fmtPesos(p.total_transferir)}</div>
                    <div style={{ textAlign: 'center' }}>
                      {alertas.length > 0
                        ? <span title={alertas.map(a => a.txt).join(' · ')} style={{ color: '#dc2626' }}>⚠</span>
                        : <span style={{ color: '#1D9E75' }}>✓</span>}
                    </div>
                  </div>

                  {/* Detalle expandido */}
                  {abierto && (
                    <div style={{ padding: '4px 16px 16px', background: '#F5F9FF' }}>
                      {/* Alertas */}
                      {alertas.map((a, i) => (
                        <div key={i} style={{ background: a.tipo === 'riesgo' ? '#FFF7ED' : '#FEF2F2', border: '1px solid ' + (a.tipo === 'riesgo' ? '#FED7AA' : '#FCA5A5'), borderRadius: 8, padding: '7px 12px', marginBottom: 8, fontSize: 12, color: a.tipo === 'riesgo' ? '#9A3412' : '#991B1B' }}>
                          ⚠ {a.txt}
                        </div>
                      ))}

                      {/* Tabla de inmuebles */}
                      {!detObj ? <div style={{ fontSize: 12, color: '#888', padding: 8 }}>Cargando inmuebles…</div> : (
                        <div style={{ background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8, overflow: 'hidden' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 4, padding: '6px 12px', background: '#FAFAF8', fontSize: 11, color: '#9ca3af', fontWeight: 700 }}>
                            <div>Inmueble</div>
                            <div style={{ textAlign: 'right' }}>A cobrar</div>
                            <div style={{ textAlign: 'right' }}>Recibido</div>
                            <div style={{ textAlign: 'right' }}>Comisión</div>
                            <div style={{ textAlign: 'right' }}>IVA</div>
                            <div style={{ textAlign: 'right' }}>Descuentos</div>
                            <div style={{ textAlign: 'right' }}>A transferir</div>
                            <div style={{ textAlign: 'center' }}>Aviso</div>
                          </div>
                          {det.map(d => {
                            const sd = sumaDesc[d.idadmon]
                            const notasInm = pie.filter(f => f.idadmon === d.idadmon)
                            const pagosInm = (detObj.pagosPorInm && detObj.pagosPorInm[d.idadmon]) || []
                            const verPagos = pagoAbierto === 'R' + d.idadmon
                            const verDescs = pagoAbierto === 'D' + d.idadmon
                            const clic = key => setPagoAbierto(prev => prev === key ? null : key)
                            return (
                            <div key={d.idadmon}>
                            <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 4, padding: '7px 12px', borderTop: '1px solid #F0EEE8', fontSize: 12, background: d.hubo_falta ? '#FEF6F6' : '#fff', alignItems: 'center' }}>
                              <div title={d.idadmon + ' · ' + (d.inmueble || '')}><span style={{ fontWeight: 600 }}>{d.idadmon}</span> <span style={{ color: '#9ca3af' }}>{(d.inmueble || '').slice(0, 24)}</span></div>
                              <div style={{ textAlign: 'right' }}>{fmtPesos(d.base)}</div>
                              <div style={{ textAlign: 'right' }}>
                                {n0(d.recibido_banco) > 0 && pagosInm.length > 0
                                  ? <span onClick={() => clic('R' + d.idadmon)} style={{ cursor: 'pointer', color: '#185FA5', borderBottom: '1px dotted #185FA5' }}>{fmtPesos(d.recibido_banco)}</span>
                                  : <span style={{ color: n0(d.recibido_banco) === 0 ? '#dc2626' : '#666' }}>{fmtPesos(d.recibido_banco)}</span>}
                              </div>
                              <div style={{ textAlign: 'right', color: '#666' }}>{n0(d.comision) === 0 ? '—' : fmtPesos(d.comision)}</div>
                              <div style={{ textAlign: 'right', color: '#666' }}>{n0(d.iva_comision) === 0 ? '—' : fmtPesos(d.iva_comision)}</div>
                              <div style={{ textAlign: 'right' }}>
                                {sd
                                  ? <span onClick={() => clic('D' + d.idadmon)} style={{ cursor: 'pointer', color: sd < 0 ? '#dc2626' : '#1D9E75', fontWeight: 600, borderBottom: '1px dotted ' + (sd < 0 ? '#dc2626' : '#1D9E75') }}>{fmtPesos(sd)}</span>
                                  : <span style={{ color: '#ccc' }}>—</span>}
                              </div>
                              <div style={{ textAlign: 'right', fontWeight: 600 }}>{fmtPesos(d.neto_transferir)}</div>
                              <div style={{ textAlign: 'center', fontSize: 10 }}>
                                {d.hubo_falta ? <span style={{ color: '#dc2626' }}>falta</span> : <span style={{ color: '#1D9E75' }}>✓</span>}
                              </div>
                            </div>
                            {/* Desglose de pagos del BI (al pinchar Recibido) */}
                            {verPagos && pagosInm.map((pg, i) => (
                              <div key={'p' + i} style={{ display: 'flex', gap: 12, padding: '3px 12px 3px 34px', fontSize: 11, background: '#F0F6FC', alignItems: 'baseline' }}>
                                <span style={{ color: '#8Fb4dd', width: 12 }}>↳</span>
                                <span style={{ color: '#666', width: 80 }}>{fmtFecha(pg.fecha)}</span>
                                <span style={{ color: '#9ca3af', width: 70 }}>Reg {pg.reg}</span>
                                <span style={{ color: '#185FA5', fontWeight: 600 }}>{fmtPesos(pg.arriendo)}</span>
                              </div>
                            ))}
                            {/* Detalle de descuentos/ajustes/comentarios (al pinchar Descuentos) */}
                            {verDescs && notasInm.map((f, i) => (
                              <div key={'d' + i} style={{ display: 'flex', gap: 10, padding: '3px 12px 3px 34px', fontSize: 11, background: '#FBFBF9', alignItems: 'baseline' }}>
                                <span style={{ color: '#c0bdb2', width: 12 }}>↳</span>
                                <span style={{ textAlign: 'right', width: 78, fontWeight: 600, color: f.cantidad == null ? '#ccc' : (f.cantidad < 0 ? '#dc2626' : '#1D9E75') }}>{f.cantidad == null ? '—' : fmtPesos(f.cantidad)}</span>
                                <span style={{ color: '#666' }}>{f.texto}</span>
                              </div>
                            ))}
                            </div>
                          )})}
                          {/* Fila TOTALES */}
                          <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 4, padding: '8px 12px', borderTop: '2px solid #E8E6E0', fontSize: 12, fontWeight: 700, background: '#FAFAF8' }}>
                            <div>TOTALES · {p.n_propiedades} inmuebles</div>
                            <div style={{ textAlign: 'right' }}>{fmtPesos(p.total_base)}</div>
                            <div style={{ textAlign: 'right' }}>{fmtPesos(p.total_recibido)}</div>
                            <div style={{ textAlign: 'right' }}>{fmtPesos(p.total_comision)}</div>
                            <div style={{ textAlign: 'right' }}>{fmtPesos(p.total_iva)}</div>
                            <div style={{ textAlign: 'right' }}>{fmtPesos(p.total_descuentos)}</div>
                            <div style={{ textAlign: 'right' }}>{fmtPesos(p.total_transferir)}</div>
                            <div></div>
                          </div>
                        </div>
                      )}

                      {/* A transferir destacado */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, padding: '8px 12px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 8 }}>
                        <span style={{ fontSize: 12, color: '#065F46' }}>A transferir a {p.propietario}</span>
                        <span style={{ fontSize: 16, fontWeight: 700, color: '#065F46' }}>{fmtPesos(p.total_transferir)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 10 }}>
          Los datos provienen de sus tablas de origen. Para modificar un valor, hay que cambiarlo en su origen (datos_arriendos, descuentos), no aquí.
        </div>

      </div>
    </>
  )
}