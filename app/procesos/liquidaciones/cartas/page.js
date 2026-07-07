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
// Override de transferencia: recalcula comision/IVA/neto a partir de un monto X,
// replicando la formula del motor (calcular_liquidacion). X<=0 (abandono) -> todo 0.
// comision = X*pct_adm (salvaguarda >1 -> /100) o fijo (si_fijo_admon).
// IVA = 19% si adicionar_iva='SI'. neto = X - comision - IVA - descuentos.
// especial_a='TOTALIDAD' -> neto = X.
function calcOverrideVals(X, d, descuentos) {
  const x = Math.round(n0(X))
  if (x <= 0) return { aCobrar: 0, admon: 0, iva: 0, aTransferir: 0 }
  let pct = n0(d && d.pct_adm)
  if (pct > 1) pct = pct / 100
  const fijoTxt = d && d.si_fijo_admon != null ? String(d.si_fijo_admon).trim() : ''
  const com = fijoTxt !== '' ? Math.round(pnum(fijoTxt)) : Math.round(x * pct)
  const iva = String((d && d.adicionar_iva) || '').trim().toUpperCase() === 'SI' ? Math.round(com * 0.19) : 0
  const totalidad = String((d && d.especial_a) || '').trim().toUpperCase() === 'TOTALIDAD'
  const aTransferir = totalidad ? x : Math.round(x - com - iva - n0(descuentos))
  return { aCobrar: x, admon: com, iva, aTransferir }
}

// Recalcula UN bloque (propietario) aplicando/quitando el override de un idadmon,
// SIN recargar la página (mantiene el scroll). Usa _ov (parametros del contrato)
// y _raw (valores originales del motor) que se guardan en cada inmueble.
function recomputarBloque(b, idadmon, ovr) {
  const inmuebles = b.inmuebles.map(x => {
    if (x.idadmon !== idadmon || x.esProp || x.esP) return x
    if (ovr) {
      const o = calcOverrideVals(ovr.monto_x, x._ov, x.descuentos)
      return { ...x, aCobrar: o.aCobrar, admon: o.admon, iva: o.iva, aTransferir: o.aTransferir, override: ovr }
    }
    const r = x._raw || {}
    return { ...x, aCobrar: n0(r.aCobrar), admon: n0(r.admon), iva: n0(r.iva), aTransferir: n0(r.aTransferir), override: null }
  })
  const T = inmuebles.reduce((a, x) => ({
    aCobrar: a.aCobrar + x.aCobrar, recibido: a.recibido + x.recibido, admon: a.admon + x.admon,
    iva: a.iva + x.iva, descuentos: a.descuentos + x.descuentos, aTransferir: a.aTransferir + x.aTransferir,
  }), { aCobrar: 0, recibido: 0, admon: 0, iva: 0, descuentos: 0, aTransferir: 0 })
  const transferido = b.transferido || 0
  const diff = Math.round(T.aTransferir - transferido)
  const hayDesc = T.descuentos > 0
  let estado
  if (transferido === 0) estado = 'TO SEE'
  else if (Math.abs(diff) <= 2000) estado = hayDesc ? 'OK DESC' : 'OK'
  else estado = 'CHECK'
  return { ...b, inmuebles, totales: T, diff, estado }
}
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
  const esDireccion = rol === 'admin' || DIRECCION_EMAILS.includes(email)   // carga a Cuentas: solo Direccion
  const OVERRIDE_EMAILS = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com']
  const puedeOverride = rol === 'admin' || OVERRIDE_EMAILS.includes(email)  // ajuste manual de transferencia: solo Direccion

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
  const [obsGuardando, setObsGuardando] = useState({})
  // Carga de cargos del mes a la tabla `cuentas` (solo Direccion)
  const [cargaModal, setCargaModal] = useState(null)   // {preview...} | {ok...} | {error...}
  const [cargaLoading, setCargaLoading] = useState(false)
  // Override de transferencia (solo Direccion): idadmon -> { monto_x, motivo, creado_por, creado_at }
  const [overrides, setOverrides] = useState({})
  const [ovrModal, setOvrModal] = useState(null)   // idadmon en edicion, o null
  const [ovrX, setOvrX] = useState('')
  const [ovrMotivo, setOvrMotivo] = useState('')
  const [ovrSaving, setOvrSaving] = useState(false)

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

      const [rArr, rServ, rDesc, rCom, rCargos, rObs, rEnvios, rProps, rOvr] = await Promise.all([
        supabase.from('datos_arriendos').select('*').in('idadmon', ids),
        supabase.from('ggcc_agua_luz').select('idadmon, aamm, deuda_gastos_comunes, deuda_vigente_electricidad, deuda_vigente_agua, deuda_vigente_gas').in('idadmon', ids),
        supabase.from('descuentos').select('idadmon, monto_a_imputar, texto_explicativo_para_carta_a_propietario').in('idadmon', ids).eq('mes_a_imputar', aammToTxt(m)).eq('repercutir_a', 'PROPIETARIO'),
        supabase.from('comentarios_liquidacion').select('idadmon, comentario, mes, para_mes_txt, created_at').in('idadmon', ids),
        supabase.rpc('transferido_propietario', { p_mes: m }),
        supabase.from('liquidacion_observaciones').select('idprop, texto').eq('mes', m),
        supabase.from('liquidacion_envios').select('idprop, estado_envio, fecha_envio, email_dest').eq('mes', m),
        supabase.from('propietarios').select('idprop, mail1, nombre').in('idprop', [...idprops]),
        supabase.from('transferencia_override').select('idadmon, monto_x, motivo, creado_por, creado_at').eq('mes', m),
      ])

      // Overrides de transferencia del mes (por idadmon)
      const ovrMap = {}
      for (const o of rOvr.data || []) ovrMap[o.idadmon] = o
      setOverrides(ovrMap)

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

      // Transferido a cada propietario: RPC transferido_propietario(mes)
      //  (cargos - abonos, bi unique_concept='PROPIETARIOS', idprop del detalle,
      //   rango día 15 mes anterior -> día 23 mes actual). Validado: P004/P085.
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
        // Override manual de transferencia (solo en la línea normal, no en la proporcional ni en P)
        const ovr = (!esP && !esProp) ? ovrMap[r.idadmon] : null
        const ov = ovr ? calcOverrideVals(ovr.monto_x, d, desc) : null
        grupos[r.idprop].inmuebles.push({
          idadmon: r.idadmon,
          estado, esP, esProp,
          propiedad: r.inmueble,
          comienzo: (esP || esProp) ? '' : fmtFecha(campo(d, ['fecha_inicio'])),
          final: (esP || esProp) ? '' : fmtFecha(campo(d, ['termino_actual', 'fecha_fin', 'fecha_final', 'fecha_termino', 'finalizacion', 'termino', 'fecha_fin_contrato'])),
          arrendatario: esP ? 'EN CAPTACION ARRENDATARIO' : campo(d, ['arrendatario', 'arrendatario1', 'nombre_arrendatario', 'arrendatario_nombre']),
          rut: esP ? '' : campo(d, ['rut', 'rut_arrendatario', 'rut1']),
          por: esP ? '' : campo(d, ['quien_cobra'], 'FCR'),
          aCobrar: ov ? ov.aCobrar : (esP ? 0 : n0(r.base)), recibido: esP ? 0 : n0(r.recibido_banco),
          admon: ov ? ov.admon : (esP ? 0 : n0(r.comision)), iva: ov ? ov.iva : (esP ? 0 : n0(r.iva_comision)),
          descuentos: desc, aTransferir: ov ? ov.aTransferir : (esP ? -desc : n0(r.neto_transferir)),
          override: ovr || null,
          _ov: { pct_adm: d.pct_adm, si_fijo_admon: d.si_fijo_admon, adicionar_iva: d.adicionar_iva, especial_a: d.especial_a },
          _raw: { aCobrar: esP ? 0 : n0(r.base), admon: esP ? 0 : n0(r.comision), iva: esP ? 0 : n0(r.iva_comision), aTransferir: esP ? -desc : n0(r.neto_transferir) },
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

  // === Carga de cargos del mes a la tabla `cuentas` (solo Direccion) ===
  async function abrirCargaCuentas() {
    setCargaLoading(true); setCargaModal(null)
    try {
      const res = await fetch('/api/cartolas/cargar-mes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes, confirmar: false }),
      })
      const j = await res.json()
      setCargaModal(res.ok ? j : { error: j.error || 'Error al preparar la carga', ...j })
    } catch (e) { setCargaModal({ error: e.message }) }
    setCargaLoading(false)
  }
  async function confirmarCargaCuentas() {
    setCargaLoading(true)
    try {
      const res = await fetch('/api/cartolas/cargar-mes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes, confirmar: true }),
      })
      const j = await res.json()
      setCargaModal(res.ok ? { ...j, done: true } : { error: j.error || 'Error al cargar', ...j })
    } catch (e) { setCargaModal({ error: e.message }) }
    setCargaLoading(false)
  }

  // === Override manual de transferencia (solo Direccion) ===
  function abrirOverride(x) {
    if (!puedeOverride || x.esProp || x.esP) return
    setOvrModal(x.idadmon)
    const o = overrides[x.idadmon]
    setOvrX(o ? String(o.monto_x) : '')
    setOvrMotivo(o ? (o.motivo || '') : '')
  }
  async function guardarOverride() {
    if (ovrModal == null) return
    if (String(ovrX).trim() === '') { alert('Escribe el monto X (pon 0 si abandonó).'); return }
    if (!ovrMotivo.trim()) { alert('Escribe el motivo del ajuste.'); return }
    setOvrSaving(true)
    try {
      const res = await fetch('/api/liquidaciones/override', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idadmon: ovrModal, mes, monto_x: pnum(ovrX), motivo: ovrMotivo.trim() }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Error al guardar')
      const ovr = { monto_x: j.monto_x, motivo: j.motivo, creado_por: j.creado_por, creado_at: j.creado_at }
      const idadmon = ovrModal
      setOverrides(prev => ({ ...prev, [idadmon]: ovr }))
      setBloques(prev => prev.map(b => recomputarBloque(b, idadmon, ovr)))
      setOvrModal(null); setOvrX(''); setOvrMotivo('')
    } catch (e) { alert(e.message) }
    setOvrSaving(false)
  }
  async function quitarOverride() {
    if (ovrModal == null) return
    if (!window.confirm('¿Quitar el ajuste manual y volver al cálculo automático?')) return
    setOvrSaving(true)
    try {
      const res = await fetch('/api/liquidaciones/override', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idadmon: ovrModal, mes, borrar: true }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Error al quitar')
      const idadmon = ovrModal
      setOverrides(prev => { const n = { ...prev }; delete n[idadmon]; return n })
      setBloques(prev => prev.map(b => recomputarBloque(b, idadmon, null)))
      setOvrModal(null); setOvrX(''); setOvrMotivo('')
    } catch (e) { alert(e.message) }
    setOvrSaving(false)
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
          <button onClick={() => router.push('/procesos/liquidaciones/emails')}
            style={{ fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: '1px solid #A7F3D0', background: '#ECFDF5', color: '#065F46', cursor: 'pointer' }}>
            ✉ EMAILS
          </button>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>CARTAS · revisión de liquidación</h1>
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
          {esDireccion && (
            <button onClick={abrirCargaCuentas} disabled={cargaLoading}
              style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 7, border: '1px solid #C4B5FD', background: '#F5F3FF', color: '#5B21B6', cursor: 'pointer' }}>
              {cargaLoading ? 'Preparando…' : '📥 Cargar cargos del mes a Cuentas'}
            </button>
          )}
        </div>

        {error && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', fontSize: 13, padding: '10px 14px', borderRadius: 8, marginBottom: 12 }}>Error: {error}</div>}
        {cargando && <div style={{ color: '#888', padding: 20 }}>Calculando…</div>}

        {!cargando && bloques.map(b => {
          const ec = estadoColor[b.estado] || { bg: '#eee', c: '#333' }
          const abierta = !!obsAbierta[b.idprop]
          const tieneOvr = (b.inmuebles || []).some(x => x.override)
          return (
            <div key={b.idprop} style={{ border: tieneOvr ? '1.5px solid #EF4444' : '1px solid #C7D2FE', borderRadius: 10, marginBottom: 16, overflow: 'hidden', background: '#fff' }}>
              {/* Cabecera del bloque */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: tieneOvr ? '#FEE2E2' : '#E0E7FF', borderBottom: tieneOvr ? '1px solid #FCA5A5' : '1px solid #C7D2FE' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1e3a8a' }}>{b.idprop} — {b.propietario}</div>
                  {envios[b.idprop]?.fecha_envio
                    ? <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#DCFCE7', color: '#166534' }}>✓ Enviada {new Date(envios[b.idprop].fecha_envio).toLocaleDateString('es-CL')}</span>
                    : <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#F1F5F9', color: '#64748B' }}>Pendiente</span>}
                  {tieneOvr && <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 20, background: '#FEE2E2', color: '#B91C1C', border: '1px solid #FCA5A5' }}>⚠ AJUSTADA</span>}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#3730a3' }}>{aammToTxt(mes)}</div>
              </div>

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
                      <div onClick={(e) => { if (puedeOverride && !x.esProp && !x.esP) { e.stopPropagation(); abrirOverride(x) } }}
                        title={x.override ? `Ajuste manual: $${Math.round(n0(x.override.monto_x)).toLocaleString('es-CL')} — ${x.override.motivo || ''}` : ((puedeOverride && !x.esProp && !x.esP) ? 'Ajustar transferencia (override)' : '')}
                        style={{ ...td, ...rt, ...bgP, fontWeight: 600, cursor: (puedeOverride && !x.esProp && !x.esP) ? 'pointer' : 'default', ...(x.override ? { background: '#FEF3C7', borderRadius: 4 } : {}) }}>
                        {x.override ? '⚠ ' : ''}{x.esP ? (x.descuentos ? fmt(x.aTransferir) : vP) : fmt(x.aTransferir)}
                      </div>
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
                      // Override manual de transferencia
                      if (x.override) subfilas.push(
                        <div key={x.idadmon + i + 'ov'} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '3px 12px 3px 40px', borderTop: '1px solid #F7F6F2', background: '#FFFBEB' }}>
                          <span style={{ color: '#9CA3AF', fontSize: 12 }}>↳</span>
                          <span style={{ fontFamily: MONO, color: '#B45309', fontWeight: 700, fontSize: 12, minWidth: 92, textAlign: 'right' }}>{fmt(x.override.monto_x)}</span>
                          <span style={{ fontSize: 12, color: '#92400E' }}>⚠ Ajuste manual de transferencia · {x.override.motivo || 'sin motivo'}{x.override.creado_por ? ` (${x.override.creado_por})` : ''}</span>
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

        {/* === Modal: Cargar cargos del mes a Cuentas === */}
        {cargaModal && (
          <div onClick={() => !cargaLoading && setCargaModal(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div onClick={e => e.stopPropagation()}
              style={{ background: '#fff', borderRadius: 12, padding: 24, width: 'min(520px, 92vw)', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 17, fontWeight: 700, color: '#1a1a2e' }}>📥 Cargar cargos de {aammToTxt(mes)} a Cuentas</h3>

              {cargaModal.error && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', fontSize: 13, padding: '10px 12px', borderRadius: 8 }}>
                  {cargaModal.error}
                  {cargaModal.log && <div style={{ marginTop: 6, fontSize: 12 }}>Cargado el {new Date(cargaModal.log.fecha_carga).toLocaleString('es-CL')} por {cargaModal.log.usuario} · {cargaModal.log.n_filas} filas · ${Number(cargaModal.log.total).toLocaleString('es-CL')}</div>}
                </div>
              )}

              {cargaModal.done && !cargaModal.error && (
                <div style={{ background: '#DCFCE7', border: '1px solid #86EFAC', color: '#166534', fontSize: 14, padding: '12px 14px', borderRadius: 8 }}>
                  ✓ Cargados <b>{cargaModal.n}</b> cargos por <b>${Number(cargaModal.total).toLocaleString('es-CL')}</b>.
                  <div style={{ marginTop: 4, fontSize: 12 }}>Cuadre: {cargaModal.cuadra ? '✓ coincide' : '⚠ revisar'} (verificado ${Number(cargaModal.total_verificado).toLocaleString('es-CL')}).</div>
                </div>
              )}

              {cargaModal.preview && !cargaModal.done && !cargaModal.error && (
                <>
                  {cargaModal.yaCargado ? (
                    <div style={{ background: '#FEF9C3', border: '1px solid #FDE047', color: '#854D0E', fontSize: 13, padding: '10px 12px', borderRadius: 8, marginBottom: 12 }}>
                      ⚠ {aammToTxt(mes)} ya fue cargado{cargaModal.log ? ` el ${new Date(cargaModal.log.fecha_carga).toLocaleString('es-CL')} por ${cargaModal.log.usuario}` : ''}. El candado bloquea una segunda carga.
                    </div>
                  ) : (
                    <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.7 }}>
                      Se cargarán <b>{cargaModal.n}</b> cargos por un total de <b>${Number(cargaModal.total).toLocaleString('es-CL')}</b>.<br />
                      Se omiten: {cargaModal.omitidas.P} en captación (P) · {cargaModal.omitidas.proporcional} proporcionales · {cargaModal.omitidas.cero} sin monto.
                    </div>
                  )}
                  <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button onClick={() => setCargaModal(null)} disabled={cargaLoading}
                      style={{ fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', color: '#374151', cursor: 'pointer' }}>Cancelar</button>
                    {!cargaModal.yaCargado && (
                      <button onClick={confirmarCargaCuentas} disabled={cargaLoading}
                        style={{ fontSize: 13, fontWeight: 700, padding: '8px 18px', borderRadius: 8, border: 'none', background: '#7C3AED', color: '#fff', cursor: 'pointer' }}>
                        {cargaLoading ? 'Cargando…' : 'Confirmar carga'}
                      </button>
                    )}
                  </div>
                </>
              )}

              {(cargaModal.done || cargaModal.error) && (
                <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => setCargaModal(null)}
                    style={{ fontSize: 13, fontWeight: 700, padding: '8px 18px', borderRadius: 8, border: 'none', background: '#1D9E75', color: '#fff', cursor: 'pointer' }}>Cerrar</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* === Modal: Ajuste manual de transferencia (override) === */}
        {ovrModal != null && (
          <div onClick={() => !ovrSaving && setOvrModal(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div onClick={e => e.stopPropagation()}
              style={{ background: '#fff', borderRadius: 12, padding: 22, width: 'min(520px, 92vw)', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>Ajuste manual de transferencia · {ovrModal}</h3>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>{aammToTxt(mes)} · solo Dirección. Se recalculan comisión, IVA y A transferir automáticamente.</div>

              <label style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>Monto efectivamente cobrado (X)</label>
              <input value={ovrX} onChange={e => setOvrX(e.target.value)} inputMode="numeric" autoFocus
                placeholder="0 si abandonó · o el monto acordado"
                style={{ width: '100%', boxSizing: 'border-box', fontSize: 14, padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: 8, marginTop: 4, marginBottom: 12, fontFamily: MONO }} />

              <label style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>Motivo</label>
              <textarea value={ovrMotivo} onChange={e => setOvrMotivo(e.target.value)} rows={3}
                placeholder="Ej: abandonó el depto · descuento especial acordado · acuerdo puntual…"
                style={{ width: '100%', boxSizing: 'border-box', fontSize: 13, padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: 8, marginTop: 4, fontFamily: 'inherit', resize: 'vertical' }} />

              {overrides[ovrModal] && overrides[ovrModal].creado_por && (
                <div style={{ fontSize: 11, color: '#B4B2A9', marginTop: 6 }}>
                  Ajuste actual por {overrides[ovrModal].creado_por}{overrides[ovrModal].creado_at ? ' · ' + new Date(overrides[ovrModal].creado_at).toLocaleString('es-CL') : ''}
                </div>
              )}

              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                <div>{overrides[ovrModal] && <button onClick={quitarOverride} disabled={ovrSaving}
                  style={{ fontSize: 13, fontWeight: 600, padding: '8px 14px', borderRadius: 8, border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#991B1B', cursor: 'pointer' }}>Quitar ajuste</button>}</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setOvrModal(null)} disabled={ovrSaving}
                    style={{ fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', color: '#374151', cursor: 'pointer' }}>Cancelar</button>
                  <button onClick={guardarOverride} disabled={ovrSaving}
                    style={{ fontSize: 13, fontWeight: 700, padding: '8px 18px', borderRadius: 8, border: 'none', background: '#7C3AED', color: '#fff', cursor: 'pointer' }}>{ovrSaving ? 'Guardando…' : 'Guardar ajuste'}</button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  )
}