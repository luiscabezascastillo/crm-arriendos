'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../../lib/supabaseClient'
import TopNav from '@/app/components/ui/TopNav'

const DIRECCION_EMAILS = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']

const n0 = v => { const x = Number(v); return isNaN(x) ? 0 : x }
// parseo de texto de pesos: "550.020" -> 550020 · "25000" -> 25000
const pnum = v => { const s = String(v ?? '').replace(/\./g, '').replace(/[^0-9-]/g, ''); const n = Number(s); return isNaN(n) ? 0 : n }
const fmt = n => { const v = Math.round(n0(n)); return v ? v.toLocaleString('es-CL') : (n === 0 ? '0' : '—') }
const fmtFecha = s => { if (!s) return '—'; const str = String(s); if (/^\d{4}-\d{2}-\d{2}/.test(str)) { const [y, m, d] = str.slice(0, 10).split('-'); return `${d}/${m}/${y}` } return str }
const MESES_TXT = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
const aammToTxt = aamm => { if (!aamm || String(aamm).length !== 4) return aamm; const a = String(aamm).slice(0, 2), m = parseInt(String(aamm).slice(2), 10); return `${MESES_TXT[m - 1] || '?'} 20${a}` }
function generarMeses() {
  const out = []; const hoy = new Date()
  for (let i = 6; i >= -1; i--) { const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1); out.push(String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0')) }
  return out
}
function mesEnCurso() { const h = new Date(); let y = h.getFullYear(), m = h.getMonth(); if (h.getDate() >= 23) { m += 1; if (m > 11) { m = 0; y += 1 } } return String(y).slice(2) + String(m + 1).padStart(2, '0') }

// normaliza el texto del detalle para extraer el IDPROP ("PO67" -> "P067")
function idpropsEnTexto(detalle, conocidos) {
  const s = String(detalle || '').replace(/P[oO](\d)/g, 'P0$1')
  const cand = s.match(/P\d{2,4}/g) || []
  return cand.filter(c => conocidos.has(c))
}

export default function CartasPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const email = session?.user?.email
  const rol = session?.user?.role

  const [accesoOk, setAccesoOk] = useState(null)
  const [mes, setMes] = useState(mesEnCurso())
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [bloques, setBloques] = useState([])
  const [actualizado, setActualizado] = useState(null)
  const [obsAbierta, setObsAbierta] = useState({})   // idprop -> bool (expandido)
  const [obsTexto, setObsTexto] = useState({})       // idprop -> texto
  const [obsGuardando, setObsGuardando] = useState({})

  useEffect(() => {
    if (status !== 'authenticated' || !email) return
    if (rol === 'admin' || DIRECCION_EMAILS.includes(email)) { setAccesoOk(true); return }
    supabase.from('proceso_permisos').select('proceso').eq('email', email).eq('activo', true)
      .then(({ data }) => setAccesoOk(!!(data || []).some(p => (p.proceso || '').toLowerCase().includes('liquidac'))))
  }, [status, email, rol])
  useEffect(() => { if (accesoOk === false) router.replace('/') }, [accesoOk, router])
  useEffect(() => { if (accesoOk === true) cargar(mes) }, [accesoOk])

  async function cargar(m) {
    setCargando(true); setError(null); setBloques([])
    try {
      const { data: liq, error: e1 } = await supabase.rpc('calcular_liquidacion', { p_mes: m })
      if (e1) { setError(e1.message); setCargando(false); return }
      const rows = liq || []
      if (rows.length === 0) { setBloques([]); setActualizado(new Date()); setCargando(false); return }
      const ids = [...new Set(rows.map(r => r.idadmon))]
      const idprops = new Set(rows.map(r => r.idprop))

      const [rArr, rServ, rDesc, rCom, rCargos, rObs] = await Promise.all([
        supabase.from('datos_arriendos').select('*').in('idadmon', ids),
        supabase.from('ggcc_agua_luz').select('idadmon, aamm, deuda_gastos_comunes, deuda_vigente_electricidad, deuda_vigente_agua, deuda_vigente_gas').in('idadmon', ids),
        supabase.from('descuentos').select('idadmon, monto_a_transferir, texto_explicativo_para_carta_a_propietario').in('idadmon', ids).eq('mes_a_imputar', aammToTxt(m)).eq('repercutir_a', 'PROPIETARIO'),
        supabase.from('comentarios').select('idadmon, comentario, mes, para_mes_txt, created_at').in('idadmon', ids),
        supabase.from('bi').select('detalle_movimiento, cargos').eq('unique_concept', 'PROPIETARIOS').eq('liquidacion_mes2', m),
        supabase.from('liquidacion_observaciones').select('idprop, texto').eq('mes', m),
      ])

      // datos_arriendos por idadmon (lectura defensiva de nombres de columna)
      const arr = {}
      for (const d of rArr.data || []) arr[d.idadmon] = d
      const campo = (d, keys, def = '') => { for (const k of keys) if (d && d[k] != null && String(d[k]).trim() !== '') return d[k]; return def }

      // servicios: saldo vigente = fila del aamm más alto
      const serv = {}
      for (const s of rServ.data || []) {
        const a = parseInt(String(s.aamm || '0'), 10)
        if (!serv[s.idadmon] || a > serv[s.idadmon]._a) serv[s.idadmon] = { _a: a, ggcc: n0(s.deuda_gastos_comunes), luz: n0(s.deuda_vigente_electricidad), agua: n0(s.deuda_vigente_agua) }
      }

      // DES (descuentos por idadmon)
      const des = {}
      for (const d of rDesc.data || []) {
        (des[d.idadmon] = des[d.idadmon] || []).push({ monto: n0(d.monto_a_transferir), texto: d.texto_explicativo_para_carta_a_propietario || '' })
      }

      // Nota (comentarios): coincidir mes en 'mes' o 'para_mes_txt'; si no, la más reciente
      const comPorId = {}
      for (const c of rCom.data || []) (comPorId[c.idadmon] = comPorId[c.idadmon] || []).push(c)
      const txtMes = aammToTxt(m)
      const notaDe = (id) => {
        const arrc = comPorId[id] || []
        if (!arrc.length) return ''
        const delMes = arrc.filter(c => String(c.mes || '') === m || String(c.para_mes_txt || '').toUpperCase() === txtMes)
        const usar = (delMes.length ? delMes : arrc).slice().sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
        return (usar[0] && usar[0].comentario) || ''
      }

      // Transferido a cada propietario (cargos BI 'PROPIETARIOS' del periodo, IDPROP en el detalle)
      const transf = {}
      for (const c of rCargos.data || []) {
        const monto = pnum(c.cargos)
        if (!monto) continue
        for (const ip of idpropsEnTexto(c.detalle_movimiento, idprops)) transf[ip] = (transf[ip] || 0) + monto
      }

      // Observaciones guardadas
      const obs = {}
      for (const o of rObs.data || []) obs[o.idprop] = o.texto || ''
      setObsTexto(obs)

      // Agrupar por propietario
      const grupos = {}
      for (const r of rows) {
        if (!grupos[r.idprop]) grupos[r.idprop] = { idprop: r.idprop, propietario: r.propietario, inmuebles: [] }
        const d = arr[r.idadmon] || {}
        const s = serv[r.idadmon] || { ggcc: 0, luz: 0, agua: 0 }
        grupos[r.idprop].inmuebles.push({
          idadmon: r.idadmon,
          propiedad: r.inmueble,
          comienzo: fmtFecha(campo(d, ['fecha_inicio'])),
          final: fmtFecha(campo(d, ['termino_actual', 'fecha_fin', 'fecha_final', 'fecha_termino', 'finalizacion', 'termino', 'fecha_fin_contrato'])),
          arrendatario: campo(d, ['arrendatario', 'arrendatario1', 'nombre_arrendatario', 'arrendatario_nombre']),
          rut: campo(d, ['rut', 'rut_arrendatario', 'rut1']),
          por: campo(d, ['quien_cobra'], 'FCR'),
          aCobrar: n0(r.base), recibido: n0(r.recibido_banco), admon: n0(r.comision), iva: n0(r.iva_comision),
          descuentos: n0(r.total_descuentos), aTransferir: n0(r.neto_transferir),
          ggcc: s.ggcc, luz: s.luz, agua: s.agua,
          nota: notaDe(r.idadmon), des: des[r.idadmon] || [],
        })
      }

      const lista = Object.values(grupos).map(g => {
        const T = g.inmuebles.reduce((a, x) => ({
          aCobrar: a.aCobrar + x.aCobrar, recibido: a.recibido + x.recibido, admon: a.admon + x.admon,
          iva: a.iva + x.iva, descuentos: a.descuentos + x.descuentos, aTransferir: a.aTransferir + x.aTransferir,
        }), { aCobrar: 0, recibido: 0, admon: 0, iva: 0, descuentos: 0, aTransferir: 0 })
        const transferido = transf[g.idprop] || 0
        const diff = Math.round(T.aTransferir - transferido)
        const hayDesc = T.descuentos > 0
        let estado
        if (transferido === 0) estado = 'TO SEE'
        else if (Math.abs(diff) <= 2000) estado = hayDesc ? 'OK DESC' : 'OK'
        else estado = 'CHECK'
        return { ...g, totales: T, transferido, diff, estado }
      }).sort((a, b) => String(a.idprop).localeCompare(String(b.idprop)))

      setBloques(lista); setActualizado(new Date())
    } catch (err) { setError(err.message) }
    setCargando(false)
  }

  async function guardarObs(idprop) {
    const texto = (obsTexto[idprop] || '').trim()
    setObsGuardando(g => ({ ...g, [idprop]: true }))
    try {
      if (!texto) {
        // vacío: no se crea fila en blanco; se borra la que hubiera
        await supabase.from('liquidacion_observaciones').delete().eq('idprop', idprop).eq('mes', mes)
      } else {
        await supabase.from('liquidacion_observaciones')
          .upsert({ idprop, mes, texto, actualizado_por: email, actualizado_at: new Date().toISOString() }, { onConflict: 'idprop,mes' })
      }
      setObsAbierta(o => ({ ...o, [idprop]: false }))   // cerrar tras guardar
    } catch (e) { setError(e.message) }
    setObsGuardando(g => ({ ...g, [idprop]: false }))
  }

  if (status === 'loading' || accesoOk === null) return (<><TopNav /><div style={{ padding: 40, color: '#888' }}>Cargando…</div></>)
  if (accesoOk === false) return null

  const estadoColor = { 'OK': { bg: '#DCFCE7', c: '#166534' }, 'OK DESC': { bg: '#FEF9C3', c: '#854D0E' }, 'TO SEE': { bg: '#FEE2E2', c: '#991B1B' }, 'CHECK': { bg: '#FFEDD5', c: '#9A3412' } }
  const MONO = "ui-monospace, 'SF Mono', 'Roboto Mono', Menlo, Consolas, monospace"
  const COLS = '58px 168px 72px 72px 128px 82px 76px 76px 34px 66px 58px 76px 82px 68px 64px 60px 128px 140px'
  const th = { fontSize: 10, color: '#e5e7eb', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
  const td = { fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
  const rt = { textAlign: 'right', fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }

  return (
    <>
      <TopNav />
      <div style={{ maxWidth: 1900, margin: '0 auto', padding: 20, fontFamily: '"DM Sans", sans-serif' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
          <button onClick={() => router.push('/procesos/liquidaciones')}
            style={{ fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: '1px solid #D3D1C7', background: '#fff', color: '#2C2C2A', cursor: 'pointer' }}>
            ← Volver a Liquidaciones
          </button>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>Vista CARTAS · revisión de liquidación</h1>
        </div>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 14 }}>
          Lo que se va a liquidar en <b>{aammToTxt(mes)}</b>, por propietario. Vista de revisión (Alberto). {actualizado && <>Actualizado el <b>{actualizado.toLocaleString('es-CL')}</b>.</>}
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          <label style={{ fontSize: 13, color: '#666' }}>Mes:</label>
          <select value={mes} onChange={e => { setMes(e.target.value); cargar(e.target.value) }}
            style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid #E5E7EB', fontSize: 13 }}>
            {generarMeses().map(mm => <option key={mm} value={mm}>{aammToTxt(mm)}</option>)}
          </select>
          <button onClick={() => cargar(mes)} disabled={cargando}
            style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 7, border: 'none', background: '#1D9E75', color: '#fff', cursor: 'pointer' }}>
            {cargando ? 'Calculando…' : '🔄 Recalcular'}
          </button>
        </div>

        {error && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', fontSize: 13, padding: '10px 14px', borderRadius: 8, marginBottom: 12 }}>Error: {error}</div>}
        {cargando && <div style={{ color: '#888', padding: 20 }}>Calculando…</div>}

        {!cargando && bloques.map(b => {
          const ec = estadoColor[b.estado] || { bg: '#eee', c: '#333' }
          const abierta = !!obsAbierta[b.idprop]
          return (
            <div key={b.idprop} style={{ border: '1px solid #C7D2FE', borderRadius: 10, marginBottom: 16, overflow: 'hidden', background: '#fff' }}>
              {/* Cabecera del bloque */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: '#E0E7FF', borderBottom: '1px solid #C7D2FE' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1e3a8a' }}>{b.idprop} — {b.propietario}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#3730a3' }}>{aammToTxt(mes)}</div>
              </div>

              {/* Tabla de inmuebles (scroll horizontal) */}
              <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: 1550 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 6, padding: '7px 12px', background: '#334155' }}>
                    <div style={th}>IdAdmon</div><div style={th}>Propiedad</div><div style={th}>Comienzo</div><div style={th}>Final</div>
                    <div style={th}>Arrendatario</div><div style={th}>RUT</div><div style={{ ...th, ...rt }}>A Cobrar</div><div style={{ ...th, ...rt }}>Recibido</div>
                    <div style={th}>Por</div><div style={{ ...th, ...rt }}>Admon</div><div style={{ ...th, ...rt }}>IVA</div><div style={{ ...th, ...rt }}>Descuentos</div>
                    <div style={{ ...th, ...rt }}>A transferir</div><div style={{ ...th, ...rt }}>G.Comunes</div><div style={{ ...th, ...rt }}>Electric.</div><div style={{ ...th, ...rt }}>Agua</div>
                    <div style={th}>Nota</div><div style={th}>DES</div>
                  </div>
                  {b.inmuebles.map((x, i) => (
                    <div key={x.idadmon + i} style={{ display: 'grid', gridTemplateColumns: COLS, gap: 6, padding: '6px 12px', borderTop: '1px solid #F0EEE8', alignItems: 'center' }}>
                      <div style={{ ...td, fontFamily: MONO, fontWeight: 600 }}>{x.idadmon}</div>
                      <div style={td} title={x.propiedad || ''}>{x.propiedad || '—'}</div>
                      <div style={{ ...td, fontFamily: MONO }}>{x.comienzo}</div>
                      <div style={{ ...td, fontFamily: MONO }}>{x.final}</div>
                      <div style={td} title={x.arrendatario || ''}>{x.arrendatario || '—'}</div>
                      <div style={{ ...td, fontFamily: MONO }}>{x.rut || '—'}</div>
                      <div style={{ ...td, ...rt }}>{fmt(x.aCobrar)}</div>
                      <div style={{ ...td, ...rt }}>{fmt(x.recibido)}</div>
                      <div style={td}>{x.por || '—'}</div>
                      <div style={{ ...td, ...rt }}>{fmt(x.admon)}</div>
                      <div style={{ ...td, ...rt }}>{fmt(x.iva)}</div>
                      <div style={{ ...td, ...rt, color: x.descuentos ? '#B45309' : '#2C2C2A' }}>{fmt(x.descuentos)}</div>
                      <div style={{ ...td, ...rt, fontWeight: 600 }}>{fmt(x.aTransferir)}</div>
                      <div style={{ ...td, ...rt }}>{fmt(x.ggcc)}</div>
                      <div style={{ ...td, ...rt }}>{fmt(x.luz)}</div>
                      <div style={{ ...td, ...rt }}>{fmt(x.agua)}</div>
                      <div style={td} title={x.nota || ''}>{x.nota || '—'}</div>
                      <div style={td} title={x.des.map(d => d.texto).join(' · ')}>{x.des.length ? x.des.map(d => `(${fmt(d.monto)}) ${d.texto}`).join(' · ') : '—'}</div>
                    </div>
                  ))}
                  {/* TOTALES */}
                  <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 6, padding: '7px 12px', borderTop: '2px solid #CBD5E1', background: '#F1F5F9', fontWeight: 700, fontSize: 11.5 }}>
                    <div>TOTALES</div><div /><div /><div /><div /><div />
                    <div style={rt}>{fmt(b.totales.aCobrar)}</div><div style={rt}>{fmt(b.totales.recibido)}</div><div />
                    <div style={rt}>{fmt(b.totales.admon)}</div><div style={rt}>{fmt(b.totales.iva)}</div><div style={rt}>{fmt(b.totales.descuentos)}</div>
                    <div style={rt}>{fmt(b.totales.aTransferir)}</div><div /><div /><div /><div /><div />
                  </div>
                </div>
              </div>

              {/* Fila de cierre: estado + transferido + diferencia */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: '10px 14px', borderTop: '1px solid #E5E7EB', background: '#FAFAFA' }}>
                <span style={{ fontSize: 12, fontWeight: 800, padding: '4px 12px', borderRadius: 20, background: ec.bg, color: ec.c }}>{b.estado}</span>
                <span style={{ fontSize: 12, color: '#555' }}>A transferir: <b>{fmt(b.totales.aTransferir)}</b></span>
                <span style={{ fontSize: 12, color: '#555' }}>Transferido al propietario: <b>{fmt(b.transferido)}</b></span>
                <span style={{ fontSize: 12, color: '#555' }}>Diferencia:
                  <b style={{ marginLeft: 6, padding: '3px 10px', borderRadius: 6, background: Math.abs(b.diff) <= 2000 ? '#DCFCE7' : '#FEE2E2', color: Math.abs(b.diff) <= 2000 ? '#166534' : '#991B1B' }}>{fmt(b.diff)}</b>
                </span>
                <button onClick={() => setObsAbierta(o => ({ ...o, [b.idprop]: !o[b.idprop] }))}
                  style={{ order: -1, fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 7, border: '1px solid #D3D1C7', background: abierta ? '#EEF2FF' : '#fff', color: '#374151', cursor: 'pointer' }}>
                  {abierta ? '▾ Cerrar observaciones' : '＋ Observaciones de Alberto'}
                </button>
              </div>

              {/* Zona expandible de observaciones */}
              {abierta && (
                <div style={{ padding: '12px 14px', borderTop: '1px dashed #D1D5DB', background: '#FFFDF5' }}>
                  <textarea value={obsTexto[b.idprop] || ''} onChange={e => setObsTexto(t => ({ ...t, [b.idprop]: e.target.value }))}
                    placeholder="Conclusiones / observaciones de Alberto para este propietario…"
                    rows={3} style={{ width: '100%', boxSizing: 'border-box', fontSize: 13, padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: 8, fontFamily: 'inherit', resize: 'vertical' }} />
                  <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={() => guardarObs(b.idprop)} disabled={obsGuardando[b.idprop]}
                      style={{ fontSize: 12, fontWeight: 700, padding: '7px 16px', borderRadius: 8, border: 'none', background: '#1D9E75', color: '#fff', cursor: 'pointer' }}>
                      {obsGuardando[b.idprop] ? 'Guardando…' : 'Guardar observación'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {!cargando && bloques.length === 0 && !error && (
          <div style={{ padding: 30, textAlign: 'center', color: '#888', fontSize: 14 }}>No hay propietarios con liquidación para {aammToTxt(mes)}.</div>
        )}
      </div>
    </>
  )
}