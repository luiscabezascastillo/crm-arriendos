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
const NUM_FONT = { fontFamily: '"DM Mono", "Roboto Mono", ui-monospace, "SF Mono", "Cascadia Mono", Consolas, Menlo, monospace', fontVariantNumeric: 'tabular-nums' }
const fmt = n => { const v = Math.round(n0(n)); const s = v ? v.toLocaleString('es-CL') : (n === 0 ? '0' : '—'); return <span style={NUM_FONT}>{s}</span> }
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
  // Solo estas personas pueden enviar/reenviar; el resto ve todo pero sin botones de envío.
  const PUEDEN_ENVIAR = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']
  const puedeEnviar = PUEDEN_ENVIAR.includes((email || '').toLowerCase())

  const [accesoOk, setAccesoOk] = useState(null)
  const [mes, setMes] = useState(mesEnCurso())
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [bloques, setBloques] = useState([])
  const [actualizado, setActualizado] = useState(null)
  const [obsAbierta, setObsAbierta] = useState({})   // idprop -> bool (expandido)
  const [obsTexto, setObsTexto] = useState({})       // idprop -> texto
  const [envios, setEnvios] = useState({})           // idprop -> {estado_envio, fecha_envio, email_dest}
  const [historialEnv, setHistorialEnv] = useState({})   // idprop -> [envios del log, más recientes primero]
  const [emailProp, setEmailProp] = useState({})     // idprop -> email
  const [seleccion, setSeleccion] = useState({})     // idprop -> bool (marcado para enviar)
  const [previewAbierto, setPreviewAbierto] = useState(false)
  const [obsGuardando, setObsGuardando] = useState({})
  const [despedida, setDespedida] = useState('Desde Fondo Capital Rent SpA le deseamos un feliz mes. Atentamente, Servicio de Información al Cliente.')
  const [enviando, setEnviando] = useState(false)
  const [resultadoEnvio, setResultadoEnvio] = useState(null)   // {enviadas, fallidas, results} | {error}
  const [borradorLoading, setBorradorLoading] = useState(null) // idprop generando borrador
  const [reducir1p, setReducir1p] = useState({})   // idprop -> true = forzar 1 página (borrador + envío)

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

      const [rArr, rServ, rDesc, rCom, rCargos, rObs, rEnvios, rProps, rLog] = await Promise.all([
        supabase.from('datos_arriendos').select('*').in('idadmon', ids),
        supabase.from('ggcc_agua_luz').select('idadmon, aamm, deuda_gastos_comunes, deuda_vigente_electricidad, deuda_vigente_agua, deuda_vigente_gas').in('idadmon', ids),
        supabase.from('descuentos').select('idadmon, monto_a_imputar, texto_explicativo_para_carta_a_propietario').in('idadmon', ids).eq('mes_a_imputar', aammToTxt(m)).eq('repercutir_a', 'PROPIETARIO'),
        supabase.from('comentarios_liquidacion').select('idadmon, comentario, mes, para_mes_txt, created_at').in('idadmon', ids),
        supabase.rpc('transferido_propietario', { p_mes: m }),
        supabase.from('liquidacion_observaciones').select('idprop, texto').eq('mes', m),
        supabase.from('liquidacion_envios').select('idprop, estado_envio, fecha_envio, email_dest, enviado_por').eq('mes', m),
        supabase.from('propietarios').select('idprop, mail1, nombre').in('idprop', [...idprops]),
        supabase.from('liquidacion_envios_log').select('idprop, fecha_envio, enviado_por, reducido').eq('mes', m).order('fecha_envio', { ascending: false }),
      ])

      // Historial de envíos del mes (todos, incl. reenvíos), agrupado por idprop, más recientes primero
      const hist = {}
      for (const l of rLog.data || []) (hist[l.idprop] = hist[l.idprop] || []).push(l)
      setHistorialEnv(hist)

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
        (des[d.idadmon] = des[d.idadmon] || []).push({ monto: n0(d.monto_a_imputar), texto: d.texto_explicativo_para_carta_a_propietario || '' })
      }

      // Ajuste del mes = cantidad_reajusteN cuya fecha_reajusteN cae en el mes AAMM liquidado.
      // (mismo cálculo que en la pantalla principal de Liquidaciones; los campos
      //  fecha_reajusteN/cantidad_reajusteN ya vienen en rArr porque se hace select('*'))
      const ajustes = {}
      for (const id of ids) {
        const d = arr[id]
        if (!d) continue
        for (let i = 1; i <= 6; i++) {
          const f = d['fecha_reajuste' + i], c = n0(d['cantidad_reajuste' + i])
          if (f && c !== 0) {
            const aamm = String(f).slice(2, 4) + String(f).slice(5, 7)  // YYYY-MM-DD -> AAMM
            if (aamm === m) ajustes[id] = c
          }
        }
      }

      // Nota (comentarios): estricto al mes liquidado (como en la principal, que filtra por mes)
      const comPorId = {}
      for (const c of rCom.data || []) (comPorId[c.idadmon] = comPorId[c.idadmon] || []).push(c)
      const txtMes = aammToTxt(m)
      const notaDe = (id) => {
        const arrc = comPorId[id] || []
        if (!arrc.length) return ''
        const delMes = arrc.filter(c => String(c.mes || '') === m || String(c.para_mes_txt || '').toUpperCase() === txtMes)
        if (!delMes.length) return ''   // solo comentarios del mes liquidado (no arrastra meses anteriores)
        const usar = delMes.slice().sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
        return (usar[0] && usar[0].comentario) || ''
      }

      // Transferido a cada propietario (cargos BI 'PROPIETARIOS' del periodo, IDPROP en el detalle)
      const transf = {}
      for (const t of rCargos.data || []) transf[t.idprop] = n0(t.transferido)

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
        const esProp = String(r.inmueble || '').startsWith('[proporcional')   // línea proporcional mes anterior
        const desc = n0(r.total_descuentos)
        grupos[r.idprop].inmuebles.push({
          idadmon: r.idadmon,
          estado, esP, esProp,
          propiedad: r.inmueble,
          comienzo: (esP || esProp) ? '' : fmtFecha(campo(d, ['fecha_inicio'])),
          final: esP ? '' : fmtFecha(campo(d, ['termino_actual', 'fecha_fin', 'fecha_final', 'fecha_termino', 'finalizacion', 'termino', 'fecha_fin_contrato'])),
          arrendatario: esP ? 'EN CAPTACION ARRENDATARIO' : campo(d, ['arrendatario', 'arrendatario1', 'nombre_arrendatario', 'arrendatario_nombre']),
          rut: esP ? '' : campo(d, ['rut', 'rut_arrendatario', 'rut1']),
          por: esP ? '' : campo(d, ['quien_cobra'], 'FCR'),
          aCobrar: esP ? 0 : n0(r.base), recibido: esP ? 0 : n0(r.recibido_banco),
          admon: esP ? 0 : n0(r.comision), iva: esP ? 0 : n0(r.iva_comision),
          descuentos: desc, aTransferir: esP ? -desc : n0(r.neto_transferir),
          ggcc: esP ? 0 : s.ggcc, luz: esP ? 0 : s.luz, agua: esP ? 0 : s.agua,
          nota: esProp ? '' : notaDe(r.idadmon), des: esProp ? [] : (des[r.idadmon] || []),
          ajuste: (esP || esProp) ? 0 : n0(ajustes[r.idadmon] || 0),
        })
      }

      const lista = Object.values(grupos).map(g => {
        // Inmuebles ordenados por nombre de propiedad (numérico para "dep 905" < "dep 1006")
        g.inmuebles.sort((a, b) => {
          // Ordenar por dirección SIN el prefijo del proporcional, para que la línea
          // "[proporcional mes anterior]" quede junto a su contrato normal (misma dirección);
          // desempate: la normal antes que la proporcional.
          const pa = String(a.propiedad || '').replace('[proporcional mes anterior] ', '')
          const pb = String(b.propiedad || '').replace('[proporcional mes anterior] ', '')
          const c = pa.localeCompare(pb, 'es', { numeric: true, sensitivity: 'base' })
          return c !== 0 ? c : ((a.esProp ? 1 : 0) - (b.esProp ? 1 : 0))
        })
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
    // Se permite reenviar: ya NO se bloquea por envío previo (al reenviar se pide confirmación).
    return b.estado === 'OK' || b.estado === 'OK DESC'         // solo cuadradas
  }
  const seleccionadas = bloques.filter(b => seleccion[b.idprop] && enviable(b))
  function toggleSel(idprop) { setSeleccion(s => ({ ...s, [idprop]: !s[idprop] })) }
  function seleccionarTodasEnviables() {
    const s = {}; for (const b of bloques) if (enviable(b)) s[b.idprop] = true; setSeleccion(s)
  }
  function limpiarSeleccion() { setSeleccion({}) }

  // Ver el PDF de un propietario como BORRADOR (marca de agua). No envía nada.
  async function verBorrador(b) {
    if (borradorLoading) return
    setBorradorLoading(b.idprop)
    try {
      const res = await fetch('/api/liquidaciones/borrador-carta', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bloque: b, mesTxt: aammToTxt(mes), despedida, reducir: !!reducir1p[b.idprop] }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        alert('No se pudo generar el borrador: ' + (d.error || res.status))
      } else {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        window.open(url, '_blank')
        setTimeout(() => URL.revokeObjectURL(url), 60000)
      }
    } catch (e) {
      alert('Error: ' + e.message)
    }
    setBorradorLoading(null)
  }

  // FASE B — envío real de las cartas seleccionadas
  async function enviarSeleccionadas() {
    if (!seleccionadas.length || enviando) return
    // Advertir si alguna de las seleccionadas YA se había enviado (reenvío)
    const yaEnviadas = seleccionadas.filter(b => envios[b.idprop]?.fecha_envio)
    if (yaEnviadas.length > 0) {
      const lista = yaEnviadas.slice(0, 8).map(b => `· ${b.idprop} ${b.propietario}`).join('\n')
      const extra = yaEnviadas.length > 8 ? `\n… y ${yaEnviadas.length - 8} más` : ''
      const ok = window.confirm(
        `⚠ Vas a REENVIAR ${yaEnviadas.length} carta(s) que ya se habían enviado:\n\n${lista}${extra}\n\n` +
        `El propietario recibirá el correo de nuevo y quedará registrado como reenvío. ¿Continuar?`
      )
      if (!ok) return
    }
    setEnviando(true); setResultadoEnvio(null)
    try {
      const envios = seleccionadas.map(b => ({
        idprop: b.idprop, propietario: b.propietario, email: emailProp[b.idprop] || '', bloque: b,
        reducir: !!reducir1p[b.idprop],
      }))
      const res = await fetch('/api/liquidaciones/enviar-cartas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes, mesTxt: aammToTxt(mes), fecha: new Date().toLocaleDateString('es-CL'), despedida, envios }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setResultadoEnvio({ error: data.error || `Error ${res.status}` }); setEnviando(false); return }
      setResultadoEnvio(data)
      // Marcar en memoria las enviadas (candado) y quitarlas de la selección
      const okIds = (data.results || []).filter(r => r.ok)
      if (okIds.length) {
        setEnvios(prev => {
          const next = { ...prev }
          for (const r of okIds) next[r.idprop] = { ...(next[r.idprop] || {}), estado_envio: 'ENVIADA', fecha_envio: r.fecha_envio, email_dest: r.email_dest, enviado_por: r.enviado_por }
          return next
        })
        setHistorialEnv(prev => {
          const next = { ...prev }
          for (const r of okIds) next[r.idprop] = [{ idprop: r.idprop, fecha_envio: r.fecha_envio, enviado_por: r.enviado_por, reducido: !!reducir1p[r.idprop] }, ...(next[r.idprop] || [])]
          return next
        })
        setSeleccion(prev => { const next = { ...prev }; for (const r of okIds) delete next[r.idprop]; return next })
      }
    } catch (err) {
      setResultadoEnvio({ error: err.message })
    }
    setEnviando(false)
  }

  if (status === 'loading' || accesoOk === null) return (<><TopNav /><div style={{ padding: 40, color: '#888' }}>Cargando…</div></>)
  if (accesoOk === false) return null

  const estadoColor = { 'OK': { bg: '#DCFCE7', c: '#166534' }, 'OK DESC': { bg: '#FEF9C3', c: '#854D0E' }, 'TO SEE': { bg: '#FEE2E2', c: '#991B1B' }, 'CHECK': { bg: '#FFEDD5', c: '#9A3412' } }
  const MONO = "ui-monospace, 'SF Mono', 'Roboto Mono', Menlo, Consolas, monospace"
  const COLS = '58px 168px 72px 72px 128px 82px 76px 76px 34px 66px 58px 76px 82px 76px 68px 64px 60px 128px 140px'
  const th = { fontSize: 10, color: '#e5e7eb', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
  const td = { fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
  const rt = { textAlign: 'right', fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }

  return (
    <>
      <TopNav />
      <div style={{ maxWidth: 1900, margin: '0 auto', padding: 20, fontFamily: '"DM Sans", sans-serif', fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum" 1' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
          <button onClick={() => router.push('/procesos/liquidaciones')}
            style={{ fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: '1px solid #D3D1C7', background: '#fff', color: '#2C2C2A', cursor: 'pointer' }}>
            ← TRANSFER
          </button>
          <button onClick={() => router.push('/procesos/liquidaciones/cartas')}
            style={{ fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: '1px solid #C7D2FE', background: '#EEF2FF', color: '#3730A3', cursor: 'pointer' }}>
            📄 CARTAS
          </button>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>EMAILS · envío de liquidaciones</h1>
        </div>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 14 }}>
          Envío de las cartas de liquidación de <b>{aammToTxt(mes)}</b> a los propietarios (PDF adjunto · candado anti-reenvío). {actualizado && <>Actualizado el <b>{actualizado.toLocaleString('es-CL')}</b>.</>}
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

        {!cargando && bloques.length > 0 && puedeEnviar && (
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
              <div style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', background: '#E0E7FF', borderBottom: '1px solid #C7D2FE' }}>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                  {puedeEnviar && (enviable(b) ? (
                    <input type="checkbox" checked={!!seleccion[b.idprop]} onChange={() => toggleSel(b.idprop)}
                      title="Seleccionar para enviar" style={{ width: 16, height: 16, cursor: 'pointer' }} />
                  ) : (
                    <input type="checkbox" disabled checked={false}
                      title={envios[b.idprop]?.fecha_envio ? 'Ya enviada' : 'No se puede enviar hasta que esté en OK'} style={{ width: 16, height: 16 }} />
                  ))}
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1e3a8a' }}>{b.idprop} — {b.propietario}</div>
                  {envios[b.idprop]?.fecha_envio
                    ? <span title={`Enviada por ${envios[b.idprop].enviado_por || '—'}`} style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#DCFCE7', color: '#166534' }}>✓ Enviada {(historialEnv[b.idprop]?.length || 1)}x · {new Date(envios[b.idprop].fecha_envio).toLocaleString('es-CL')}{envios[b.idprop].enviado_por ? ' · ' + String(envios[b.idprop].enviado_por).split('@')[0] : ''}</span>
                    : <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#F1F5F9', color: '#64748B' }}>Pendiente</span>}
                </div>
                <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                  {puedeEnviar && (
                  <label title="Comprime la carta para que quepa en 1 página (borrador y envío). Reversible."
                    style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600,
                      color: reducir1p[b.idprop] ? '#065F46' : '#94A3B8', cursor: 'pointer', userSelect: 'none' }}>
                    <input type="checkbox" checked={!!reducir1p[b.idprop]}
                      onChange={() => setReducir1p(m => ({ ...m, [b.idprop]: !m[b.idprop] }))}
                      style={{ width: 14, height: 14, cursor: 'pointer' }} />
                    1 pág.
                  </label>
                  )}
                  <button onClick={() => verBorrador(b)} disabled={borradorLoading === b.idprop}
                    title="Ver el PDF de esta carta como borrador (marca de agua, no se envía)"
                    style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 7,
                      border: '1px solid #C7D2FE', background: '#fff', color: '#3730A3',
                      cursor: borradorLoading === b.idprop ? 'wait' : 'pointer' }}>
                    {borradorLoading === b.idprop ? 'Generando…' : '📄 Ver borrador'}
                  </button>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#3730a3' }}>{aammToTxt(mes)}</div>
                </div>
                <div style={{ flex: 1 }} />
              </div>

              {(historialEnv[b.idprop]?.length > 0) && (
                <div style={{ fontSize: 10.5, color: '#64748B', padding: '0 0 8px 26px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '2px 14px' }}>
                  <span style={{ fontWeight: 600, color: '#475569' }}>Últimos envíos:</span>
                  {historialEnv[b.idprop].slice(0, 3).map((l, i) => (
                    <span key={i} style={{ whiteSpace: 'nowrap' }}>
                      {new Date(l.fecha_envio).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })} · {String(l.enviado_por || '').split('@')[0]}{l.reducido ? ' · 1pág' : ''}
                    </span>
                  ))}
                  {historialEnv[b.idprop].length > 3 && <span style={{ color: '#94A3B8', whiteSpace: 'nowrap' }}>… ({historialEnv[b.idprop].length} en total)</span>}
                </div>
              )}

              {/* Tabla de inmuebles (scroll horizontal) */}
              <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: 1632 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 6, padding: '7px 12px', background: '#334155' }}>
                    <div style={th}>IdAdmon</div><div style={th}>Propiedad</div><div style={th}>Comienzo</div><div style={th}>Final</div>
                    <div style={th}>Arrendatario</div><div style={th}>RUT</div><div style={{ ...th, ...rt }}>A Cobrar</div><div style={{ ...th, ...rt }}>Recibido</div>
                    <div style={th}>Por</div><div style={{ ...th, ...rt }}>Admon</div><div style={{ ...th, ...rt }}>IVA</div><div style={{ ...th, ...rt }}>Descuentos</div>
                    <div style={{ ...th, ...rt }}>A transferir</div><div style={{ ...th, ...rt }}>Ajuste</div>
                    <div style={{ ...th, ...rt }}>G.Comunes</div><div style={{ ...th, ...rt }}>Electric.</div><div style={{ ...th, ...rt }}>Agua</div>
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
                      <div style={{ ...td, ...rt, color: x.ajuste ? '#B45309' : '#2C2C2A', fontWeight: x.ajuste ? 700 : 400 }}>{x.esP ? '' : (x.ajuste ? fmt(x.ajuste) : '—')}</div>
                      <div style={{ ...td, ...rt }}>{x.esP ? '' : fmt(x.ggcc)}</div>
                      <div style={{ ...td, ...rt }}>{x.esP ? '' : fmt(x.luz)}</div>
                      <div style={{ ...td, ...rt }}>{x.esP ? '' : fmt(x.agua)}</div>
                      <div style={td} title={x.nota || ''}>{x.nota || '—'}</div>
                      <div style={td}>—</div>
                    </div>
                    )
                    // Sub-filas bajo el inmueble (solo contratos activos, no P):
                    //   descuento (verde) · ajuste del mes (ámbar) · comentario (gris)
                    // Réplica del desglose de la pantalla principal de Liquidaciones.
                    const subfilas = []
                    if (!x.esP) {
                      // 1) Descuentos
                      ;(x.des || []).forEach((dd, j) => subfilas.push(
                        <div key={x.idadmon + i + 'd' + j} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '3px 12px 3px 40px', borderTop: '1px solid #F7F6F2' }}>
                          <span style={{ color: '#9CA3AF', fontSize: 12 }}>↳</span>
                          <span style={{ fontFamily: MONO, color: '#16A34A', fontWeight: 700, fontSize: 12, minWidth: 92, textAlign: 'right' }}>{fmt(dd.monto)}</span>
                          <span style={{ fontSize: 12, color: '#4B5563' }}>{dd.texto || 'Descuento'}</span>
                        </div>
                      ))
                      // 2) Ajuste del mes
                      if (x.ajuste) subfilas.push(
                        <div key={x.idadmon + i + 'aj'} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '3px 12px 3px 40px', borderTop: '1px solid #F7F6F2' }}>
                          <span style={{ color: '#9CA3AF', fontSize: 12 }}>↳</span>
                          <span style={{ fontFamily: MONO, color: '#B45309', fontWeight: 700, fontSize: 12, minWidth: 92, textAlign: 'right' }}>{fmt(x.ajuste)}</span>
                          <span style={{ fontSize: 12, color: '#92400E' }}>Se ha realizado un ajuste de ${fmt(x.ajuste)} en la renta</span>
                        </div>
                      )
                      // 3) Comentario del mes (comentarios_liquidacion)
                      if (x.nota) subfilas.push(
                        <div key={x.idadmon + i + 'co'} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '3px 12px 3px 40px', borderTop: '1px solid #F7F6F2' }}>
                          <span style={{ color: '#9CA3AF', fontSize: 12 }}>↳</span>
                          <span style={{ fontSize: 12, minWidth: 92, textAlign: 'right', color: '#6366F1', fontWeight: 700 }}>💬 Nota</span>
                          <span style={{ fontSize: 12, color: '#4B5563', fontStyle: 'italic' }}>{x.nota}</span>
                        </div>
                      )
                    }
                    return [filaInmueble, ...subfilas]
                  })}
                  {/* TOTALES */}
                  <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 6, padding: '7px 12px', borderTop: '2px solid #CBD5E1', background: '#F1F5F9', fontWeight: 700, fontSize: 11.5 }}>
                    <div>TOTALES</div><div /><div /><div /><div /><div />
                    <div style={rt}>{fmt(b.totales.aCobrar)}</div><div style={rt}>{fmt(b.totales.recibido)}</div><div />
                    <div style={rt}>{fmt(b.totales.admon)}</div><div style={rt}>{fmt(b.totales.iva)}</div><div style={rt}>{fmt(b.totales.descuentos)}</div>
                    <div style={rt}>{fmt(b.totales.aTransferir)}</div>
                    <div style={rt}>{(() => { const s = (b.inmuebles || []).reduce((a, x) => a + n0(x.ajuste), 0); return s ? fmt(s) : '' })()}</div><div /><div /><div /><div /><div />
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
              {/* Despedida configurable (va en el email y en el PDF) */}
              <div style={{ marginTop: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>Frase de despedida (email + PDF)</label>
                <textarea value={despedida} onChange={e => setDespedida(e.target.value)} rows={2}
                  style={{ width: '100%', boxSizing: 'border-box', fontSize: 12, padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: 8, fontFamily: 'inherit', resize: 'vertical' }} />
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                  Asunto: <b>[NO RESPONDER] Liquidación mes de {aammToTxt(mes)}</b> · CC a administracion@fondocapital.com · Adjunto PDF. Al enviar se pone candado (fecha de envío) y no se reenvía.
                </div>
              </div>

              {/* Resultado del envío */}
              {resultadoEnvio && (
                resultadoEnvio.error ? (
                  <div style={{ marginTop: 12, fontSize: 12, color: '#991B1B', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 12px' }}>
                    Error: {resultadoEnvio.error}
                  </div>
                ) : (
                  <div style={{ marginTop: 12, fontSize: 12, borderRadius: 8, padding: '10px 12px', background: resultadoEnvio.fallidas ? '#FFFBEB' : '#ECFDF5', border: '1px solid ' + (resultadoEnvio.fallidas ? '#FDE68A' : '#A7F3D0'), color: '#065F46' }}>
                    <b>{resultadoEnvio.enviadas} enviada(s)</b>{resultadoEnvio.fallidas ? `, ${resultadoEnvio.fallidas} no enviada(s)` : ''}.
                    {(resultadoEnvio.results || []).filter(r => !r.ok).length > 0 && (
                      <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: '#92400E' }}>
                        {(resultadoEnvio.results || []).filter(r => !r.ok).map(r => (
                          <li key={r.idprop}>{r.idprop} {r.propietario} — {r.motivo}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              )}
            </div>
            <div style={{ padding: 14, borderTop: '1px solid #E8E6E0', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => { setPreviewAbierto(false); setResultadoEnvio(null) }}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Cerrar
              </button>
              <button onClick={enviarSeleccionadas} disabled={enviando || seleccionadas.length === 0}
                title="Genera el PDF, envía por email y pone candado"
                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: (enviando || !seleccionadas.length) ? '#9CA3AF' : '#1D9E75', color: '#fff', fontSize: 13, fontWeight: 700, cursor: (enviando || !seleccionadas.length) ? 'not-allowed' : 'pointer' }}>
                {enviando ? 'Enviando…' : `✉ Confirmar envío (${seleccionadas.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}