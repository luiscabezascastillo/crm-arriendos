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
  const [envios, setEnvios] = useState({})           // idprop -> {estado_envio, fecha_envio, email_dest}
  const [emailProp, setEmailProp] = useState({})     // idprop -> email
  const [seleccion, setSeleccion] = useState({})     // idprop -> bool (marcado para enviar)
  const [previewAbierto, setPreviewAbierto] = useState(false)
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

      const [rArr, rServ, rDesc, rCom, rCargos, rObs, rEnvios, rProps] = await Promise.all([
        supabase.from('datos_arriendos').select('*').in('idadmon', ids),
        supabase.from('ggcc_agua_luz').select('idadmon, aamm, deuda_gastos_comunes, deuda_vigente_electricidad, deuda_vigente_agua, deuda_vigente_gas').in('idadmon', ids),
        supabase.from('descuentos').select('idadmon, monto_a_transferir, texto_explicativo_para_carta_a_propietario').in('idadmon', ids).eq('mes_a_imputar', aammToTxt(m)).eq('repercutir_a', 'PROPIETARIO'),
        supabase.from('comentarios').select('idadmon, comentario, mes, para_mes_txt, created_at').in('idadmon', ids),
        supabase.from('bi').select('detalle_movimiento, cargos').eq('unique_concept', 'PROPIETARIOS').eq('liquidacion_mes2', m),
        supabase.from('liquidacion_observaciones').select('idprop, texto').eq('mes', m),
        supabase.from('liquidacion_envios').select('idprop, estado_envio, fecha_envio, email_dest').eq('mes', m),
        supabase.from('propietarios').select('idprop, mail1, nombre').in('idprop', [...idprops]),
      ])

      // Envíos ya realizados este mes (candado anti-reenvío)
      const env = {}
      for (const e of rEnvios.data || []) env[e.idprop] = e
      setEnvios(env)
      // Email de cada propietario
      const emP = {}
      for (const p of rProps.data || []) emP[p.idprop] = p.mail1 || ''
      setEmailProp(emP)

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
        const estado = String(d.estado || '').trim().toUpperCase()
        const esP = estado === 'P'
        const desc = n0(r.total_descuentos)
        grupos[r.idprop].inmuebles.push({
          idadmon: r.idadmon,
          estado, esP,
          propiedad: r.inmueble,
          comienzo: esP ? '' : fmtFecha(campo(d, ['fecha_inicio'])),
          final: esP ? '' : fmtFecha(campo(d, ['termino_actual', 'fecha_fin', 'fecha_final', 'fecha_termino', 'finalizacion', 'termino', 'fecha_fin_contrato'])),
          arrendatario: esP ? 'EN CAPTACION ARRENDATARIO' : campo(d, ['arrendatario', 'arrendatario1', 'nombre_arrendatario', 'arrendatario_nombre']),
          rut: esP ? '' : campo(d, ['rut', 'rut_arrendatario', 'rut1']),
          por: esP ? '' : campo(d, ['quien_cobra'], 'FCR'),
          aCobrar: esP ? 0 : n0(r.base), recibido: esP ? 0 : n0(r.recibido_banco),
          admon: esP ? 0 : n0(r.comision), iva: esP ? 0 : n0(r.iva_comision),
          descuentos: desc, aTransferir: esP ? -desc : n0(r.neto_transferir),
          ggcc: esP ? 0 : s.ggcc, luz: esP ? 0 : s.luz, agua: esP ? 0 : s.agua,
          nota: notaDe(r.idadmon), des: des[r.idadmon] || [],
        })
      }

      const lista = Object.values(grupos).map(g => {
        // Inmuebles ordenados por nombre de propiedad (numérico para "dep 905" < "dep 1006")
        g.inmuebles.sort((a, b) => String(a.propiedad || '').localeCompare(String(b.propiedad || ''), 'es', { numeric: true, sensitivity: 'base' }))
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
      }).sort((a, b) => String(a.propietario || '').localeCompare(String(b.propietario || ''), 'es', { sensitivity: 'base' }))

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

  // ¿Se puede enviar esta carta? Solo si está OK/OK DESC y no se ha enviado ya.
  function enviable(b) {
    if (envios[b.idprop]?.fecha_envio) return false           // ya enviada (candado)
    return b.estado === 'OK' || b.estado === 'OK DESC'         // solo cuadradas
  }
  const seleccionadas = bloques.filter(b => seleccion[b.idprop] && enviable(b))
  function toggleSel(idprop) { setSeleccion(s => ({ ...s, [idprop]: !s[idprop] })) }
  function seleccionarTodasEnviables() {
    const s = {}; for (const b of bloques) if (enviable(b)) s[b.idprop] = true; setSeleccion(s)
  }
  function limpiarSeleccion() { setSeleccion({}) }

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

        {!cargando && bloques.length > 0 && (
          <div style={{ position: 'sticky', top: 52, zIndex: 30, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>Envío de cartas:</span>
            <button onClick={seleccionarTodasEnviables} style={{ fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 7, border: '1px solid #CBD5E1', background: '#fff', color: '#334155', cursor: 'pointer' }}>
              Seleccionar todas las enviables ({bloques.filter(enviable).length})
            </button>
            <button onClick={limpiarSeleccion} style={{ fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 7, border: '1px solid #CBD5E1', background: '#fff', color: '#334155', cursor: 'pointer' }}>
              Quitar selección
            </button>
            <span style={{ fontSize: 12, color: '#64748B' }}>
              Solo se pueden enviar las cartas en <b style={{ color: '#166534' }}>OK</b> / <b style={{ color: '#854D0E' }}>OK DESC</b> que no se hayan enviado ya.
            </span>
            <button onClick={() => setPreviewAbierto(true)} disabled={seleccionadas.length === 0}
              style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, padding: '8px 18px', borderRadius: 8, border: 'none', background: seleccionadas.length ? '#1D9E75' : '#9CA3AF', color: '#fff', cursor: seleccionadas.length ? 'pointer' : 'not-allowed' }}>
              ✉ Enviar seleccionadas ({seleccionadas.length})
            </button>
          </div>
        )}

        {!cargando && bloques.map(b => {
          const ec = estadoColor[b.estado] || { bg: '#eee', c: '#333' }
          const abierta = !!obsAbierta[b.idprop]
          return (
            <div key={b.idprop} style={{ border: '1px solid #C7D2FE', borderRadius: 10, marginBottom: 16, overflow: 'hidden', background: '#fff' }}>
              {/* Cabecera del bloque */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: '#E0E7FF', borderBottom: '1px solid #C7D2FE' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {enviable(b) ? (
                    <input type="checkbox" checked={!!seleccion[b.idprop]} onChange={() => toggleSel(b.idprop)}
                      title="Seleccionar para enviar" style={{ width: 16, height: 16, cursor: 'pointer' }} />
                  ) : (
                    <input type="checkbox" disabled checked={false}
                      title={envios[b.idprop]?.fecha_envio ? 'Ya enviada' : 'No se puede enviar hasta que esté en OK'} style={{ width: 16, height: 16 }} />
                  )}
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1e3a8a' }}>{b.idprop} — {b.propietario}</div>
                  {envios[b.idprop]?.fecha_envio
                    ? <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#DCFCE7', color: '#166534' }}>✓ Enviada {new Date(envios[b.idprop].fecha_envio).toLocaleDateString('es-CL')}</span>
                    : <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#F1F5F9', color: '#64748B' }}>Pendiente</span>}
                </div>
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
                  {b.inmuebles.map((x, i) => {
                    const bgP = x.esP ? { background: '#F5E6D3' } : {}   // fondo beige (como Excel): IdAdmon → A transferir
                    const vP = x.esP ? '\u00A0' : ''   // celda P vacía: espacio duro para que pinte el fondo
                    const filaInmueble = (
                    <div key={x.idadmon + i} style={{ display: 'grid', gridTemplateColumns: COLS, gap: 6, padding: '6px 12px', borderTop: '1px solid #F0EEE8', alignItems: 'center' }}>
                      <div style={{ ...td, ...bgP, fontFamily: MONO, fontWeight: 600 }}>{x.idadmon}</div>
                      <div style={{ ...td, ...bgP }} title={x.propiedad || ''}>{x.propiedad || '—'}</div>
                      <div style={{ ...td, ...bgP, fontFamily: MONO }}>{x.comienzo || vP}</div>
                      <div style={{ ...td, ...bgP, fontFamily: MONO }}>{x.final || vP}</div>
                      <div style={{ ...td, ...bgP }} title={x.arrendatario || ''}>{x.arrendatario || '—'}</div>
                      <div style={{ ...td, ...bgP, fontFamily: MONO }}>{x.rut || vP}</div>
                      <div style={{ ...td, ...rt, ...bgP }}>{x.esP ? vP : fmt(x.aCobrar)}</div>
                      <div style={{ ...td, ...rt, ...bgP }}>{x.esP ? vP : fmt(x.recibido)}</div>
                      <div style={{ ...td, ...bgP }}>{x.esP ? vP : (x.por || '—')}</div>
                      <div style={{ ...td, ...rt, ...bgP }}>{x.esP ? vP : fmt(x.admon)}</div>
                      <div style={{ ...td, ...rt, ...bgP }}>{x.esP ? vP : fmt(x.iva)}</div>
                      <div style={{ ...td, ...rt, ...bgP, color: x.descuentos ? '#16A34A' : '#2C2C2A', fontWeight: x.descuentos ? 700 : 400 }}>{x.descuentos ? fmt(x.descuentos) : vP}</div>
                      <div style={{ ...td, ...rt, ...bgP, fontWeight: 600 }}>{x.esP ? (x.descuentos ? fmt(x.aTransferir) : vP) : fmt(x.aTransferir)}</div>
                      <div style={{ ...td, ...rt }}>{x.esP ? '' : fmt(x.ggcc)}</div>
                      <div style={{ ...td, ...rt }}>{x.esP ? '' : fmt(x.luz)}</div>
                      <div style={{ ...td, ...rt }}>{x.esP ? '' : fmt(x.agua)}</div>
                      <div style={td} title={x.nota || ''}>{x.nota || '—'}</div>
                      <div style={td}>—</div>
                    </div>
                    )
                    // Sub-filas de desglose de descuentos (verde + texto), debajo del inmueble
                    const desgloses = (!x.esP && x.des && x.des.length)
                      ? x.des.map((dd, j) => (
                        <div key={x.idadmon + i + 'd' + j} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '3px 12px 3px 40px', borderTop: '1px solid #F7F6F2' }}>
                          <span style={{ color: '#9CA3AF', fontSize: 12 }}>↳</span>
                          <span style={{ fontFamily: MONO, color: '#16A34A', fontWeight: 700, fontSize: 12, minWidth: 92, textAlign: 'right' }}>{fmt(dd.monto)}</span>
                          <span style={{ fontSize: 12, color: '#4B5563' }}>{dd.texto || ''}</span>
                        </div>
                      ))
                      : []
                    return [filaInmueble, ...desgloses]
                  })}
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

      {/* ══ MODAL: vista previa del envío (Fase A: solo previsualiza; el envío real llega en la Fase B) ══ */}
      {previewAbierto && (
        <div onClick={() => setPreviewAbierto(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 2600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '30px 16px' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 10, width: 'min(720px, 96vw)', maxHeight: '86vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
            <div style={{ background: '#1D9E75', color: '#fff', padding: '10px 16px', fontSize: 14, fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Enviar liquidaciones · {aammToTxt(mes)} · {seleccionadas.length} carta(s)</span>
              <button onClick={() => setPreviewAbierto(false)} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: 16, overflowY: 'auto' }}>
              <div style={{ fontSize: 12, color: '#555', marginBottom: 10 }}>
                Se enviará la carta de liquidación a estos propietarios. Revisa los destinatarios antes de confirmar.
              </div>
              <div style={{ border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '70px 1.4fr 1.6fr 100px', gap: 6, padding: '8px 12px', background: '#F8FAFC', fontSize: 11, fontWeight: 700, color: '#64748B' }}>
                  <div>IdProp</div><div>Propietario</div><div>Email destino</div><div style={{ textAlign: 'right' }}>A transferir</div>
                </div>
                {seleccionadas.map((b, i) => {
                  const em = emailProp[b.idprop] || ''
                  return (
                    <div key={b.idprop} style={{ display: 'grid', gridTemplateColumns: '70px 1.4fr 1.6fr 100px', gap: 6, padding: '7px 12px', borderTop: i ? '1px solid #F0EEE8' : 'none', fontSize: 12, alignItems: 'center' }}>
                      <div style={{ fontFamily: MONO, fontWeight: 600 }}>{b.idprop}</div>
                      <div title={b.propietario}>{b.propietario}</div>
                      <div style={{ color: em ? '#1e3a8a' : '#B91C1C' }} title={em || 'SIN EMAIL'}>{em || '⚠ sin email'}</div>
                      <div style={{ textAlign: 'right', fontFamily: MONO }}>{fmt(b.totales.aTransferir)}</div>
                    </div>
                  )
                })}
              </div>
              {seleccionadas.some(b => !emailProp[b.idprop]) && (
                <div style={{ marginTop: 10, fontSize: 12, color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '8px 12px' }}>
                  ⚠ Hay propietarios sin email. Esas cartas no se podrán enviar hasta añadir el email en su ficha.
                </div>
              )}
              <div style={{ marginTop: 14, fontSize: 12, color: '#92400E', background: '#FEF9C3', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 12px' }}>
                <b>Fase A (en pruebas):</b> esto es la vista previa de los destinatarios. El <b>envío real</b> del email con el PDF y el archivado en Drive se activarán en el siguiente paso. De momento nada se envía.
              </div>
            </div>
            <div style={{ padding: 14, borderTop: '1px solid #E8E6E0', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setPreviewAbierto(false)}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Cerrar
              </button>
              <button disabled title="El envío real se activa en la Fase B"
                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#9CA3AF', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'not-allowed' }}>
                Confirmar envío (Fase B)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}