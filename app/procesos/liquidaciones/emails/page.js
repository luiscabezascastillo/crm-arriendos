'use client'
// VERSION: v22 · 2026-08-10 · CARTA COMPLEMENTARIA (paso 5). Panel "🧩 Complementarias de <mes>": para cada propietario con
//   complementaria registrada (mes de cobro = mes visto), un botón "Ver borrador complementaria" que arma un bloque con
//   todas sus propiedades como referencia (yaLiquidado, en gris) + la línea cobrada con importes, y lo abre como borrador
//   (lib/liquidacionPdf v12, esComplementaria). Primera versión solo borrador; el envío oficial se añadirá luego. Hereda v21.
// VERSION: v21 · 2026-08-10 · Texto de la subfila en espera: "PENDIENTE DE COBRO — se liquida posteriormente, en liquidación
//   complementaria cuando el arrendatario pague." Sin cambios de lógica. Hereda v20.
// VERSION: v20 · 2026-08-10 · Texto de la subfila en espera suavizado: "PENDIENTE DE COBRO — se liquidará posteriormente,
//   cuando el arrendatario pague." (antes "no se liquida este mes..."). Sin cambios de lógica. Hereda v19.
// VERSION: v19 · 2026-08-10 · EN ESPERA = pendiente de cobro, FUERA de los totales pero SIEMPRE visible. La liquidación
//   referencia todas las propiedades: la del moroso sigue en la tabla pero con los importes TACHADOS y en gris, fondo
//   ámbar y una subfila "⏸ PENDIENTE DE COBRO — se liquidará en la complementaria". NO suma en totales ni se transfiere ni
//   se factura. Se retira el split "A transferir ahora / En espera" (v14-v15). La cuenta viaja como `enEsperaCount`; el
//   PDF (lib/liquidacionPdf v9) pinta igual. Hereda v18.
// VERSION: v18 · 2026-08-10 · "Enviar borrador a…": junto a "Ver borrador", quien emite puede mandar el PDF borrador
//   (marca de agua) por email a una persona concreta (revisión interna). No es el envío oficial: no toca el candado ni
//   liquidacion_envios. Usa /api/liquidaciones/borrador-carta con `enviarA`. Hereda v17.
// VERSION: v17 · 2026-08-10 · El texto de un depto en captación (P) se edita EN LÍNEA sobre la celda Arrendatario (clic →
//   "RESERVADO" o lo que sea) por quien emite (Alberto/Luis/Karina). Se guarda por idadmon en `captacion_etiqueta` y sale
//   igual en el PDF; vacío = vuelve a "EN CAPTACION ARRENDATARIO". Hereda v16.
// VERSION: v16 · 2026-08-10 · Etiqueta libre de captación: si un depto en estado P tiene una etiqueta en `captacion_etiqueta`
//   la carta muestra ESE texto en vez de "EN CAPTACION ARRENDATARIO". Hereda v15.
// VERSION: v15 · 2026-08-10 · EMAILS se ve COMO SALDRÁ la carta: la línea en espera muestra su "A transferir" ATENUADO
//   con una subfila "en espera"; la fila TOTALES, el cierre y el MODAL DE ENVÍO muestran "A transferir ahora" (sin lo
//   retenido) y el importe "En espera de cobro". Antes el modal enseñaba el bruto. Hereda v14.
// VERSION: v14 · 2026-08-10 · EN ESPERA en el total de la carta: el bloque de cada propietario ahora lleva en `totales`
//   dos campos nuevos — `enEspera` (suma de los "A transferir" de líneas retenidas por morosidad) y `aTransferirAhora`
//   (total − enEspera). El PDF (lib/liquidacionPdf v6) los usa para que la columna "A transferir" muestre el importe REAL
//   de la oleada y añada la línea "En espera de cobro". Las líneas retenidas ya viajaban marcadas con notaEspera. Hereda v13.
// VERSION: v13 · 2026-08-07 · FILTRO por estado ampliado: además de OK / OK DESC ahora se puede filtrar por TO SEE y
//   por CHECK (para revisarlas o desbloquearlas). "Todos los estados" muestra todo; OK/OK DESC siguen ocultando las ya
//   enviadas ("por enviar"). La selección de envío se hace a mano sobre lo filtrado. Hereda v12.
// VERSION: v12 · 2026-08-07 · ENVÍO POR LOTES. El envío se parte en tandas de 5 y hace una petición por tanda, en
//   secuencia, con progreso ("Enviando X/Y…"). Cada petición cabe de sobra en los 60s → se elimina el timeout 504 de
//   los envíos masivos. Si una tanda falla, sigue con las demás y al final avisa; reintentar es seguro (candado v11).
//   Hereda v11.
// VERSION: v11 · 2026-08-07 · ANTI-DUPLICADOS. Al confirmar el reenvío de una carta ya enviada (checkbox ámbar) se
//   registra su idprop como "reenvío autorizado" y solo esos van en el campo `reenviar` al servidor; el resto de
//   ya-enviadas el backend las OMITE (candado real). Además, tras enviar (aunque falle con 504) se refrescan los
//   candados desde la BD, para ver al momento cuáles salieron. Requiere enviar-cartas v4. Hereda v10.
// VERSION: v10 · 2026-08-07 · EMAILS: los filtros "Solo OK" y "Solo OK DESC" ahora son "por enviar": ocultan también
//   las cartas YA ENVIADAS (antes seguían apareciendo). Así al filtrar para enviar solo se ven las que faltan. Hereda v9.
// VERSION: v9 · 2026-08-07 · EMAILS filtros y selección: (1) "Seleccionar todas las enviables" ya NO re-marca las YA
//   ENVIADas (solo enviables no enviadas y de lo que esté a la vista); el contador refleja eso. (2) Nuevos filtros de
//   pantalla: por estado (Todos / Solo OK / Solo OK DESC) y por texto (IDPROP o nombre); solo se muestran las que pasan.
//   Hereda v8.
// VERSION: v8 · 2026-08-07 · EMAILS, dos arreglos: (1) fila TOTALES desalineada una celda (tenía 5 huecos iniciales,
//   heredado de CARTAS con columna "Final"; ahora 4) → cuadra con las columnas. (2) El checkbox de una carta YA ENVIADA
//   se muestra en ámbar y, al marcarlo para reenviar, pide confirmación "ya enviada, ¿reenviar?". Hereda v7.
// VERSION: v7 · 2026-08-07 · Los DESCUENTOS asociados a un IDADMON en estado P (depto en captación) también salen como
//   subfila en la pantalla de EMAILS, igual que en S/SQ (antes ocultos por el gate !esP). El PDF lo pinta lib/liquidacionPdf. Hereda v6.
// VERSION: v6 · 2026-08-07 · Nota "en espera" en la carta: si un inmueble está retenido en la liquidación (arrendatario
//   moroso, marcado en CARTAS), su línea lleva una nota avisando de que la transferencia de ese arriendo se aplaza hasta
//   conseguir el cobro. La nota viaja en el bloque (notaEspera) → sale en el PDF (borrador y envío). Hereda v5.
// VERSION: v5 · 2026-07-20 · Botón "Guardar observación" a la izquierda (antes quedaba fuera de pantalla)
// VERSION: v4 · 2026-07-20 · Texto informativo del CC actualizado (administracion@ + karina.morales@)
// VERSION: v3 · 2026-07-20 · Buscador "ir a propietario" (scroll+realce) + filtro "Solo no enviadas" en la barra de controles
// VERSION: v2 · 2026-07-20 · Desbloqueo justificado: Dirección/Karina pueden habilitar el envío de una
//   carta en CHECK/TO SEE dejando un motivo obligatorio (se guarda en liquidacion_envios: desbloqueo_motivo
//   + desbloqueado_por). enviable() acepta OK/OK DESC o desbloqueadas. El candado sigue para el resto.
// VERSION: v5 · 2026-07-08 · sticky top:52 (debajo del TopNav de 52px, antes chocaba en top:0)

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../../lib/supabaseClient'
import TopNav from '@/app/components/ui/TopNav'
import BuscarLiquidacion from '@/app/components/ui/BuscarLiquidacion'

const DIRECCION_EMAILS = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']
const TANDA_ENVIO = 5   // nº de cartas por petición (para no pasar el límite de 60s de la función → evita el 504)

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
  const [editCap, setEditCap] = useState(null)     // idadmon cuyo texto de captación (P) se está editando
  const [editCapTxt, setEditCapTxt] = useState('')
  const [capBusy, setCapBusy] = useState(null)
  const [actualizado, setActualizado] = useState(null)
  const [obsAbierta, setObsAbierta] = useState({})   // idprop -> bool (expandido)
  const [obsTexto, setObsTexto] = useState({})       // idprop -> texto
  const [envios, setEnvios] = useState({})           // idprop -> {estado_envio, fecha_envio, email_dest}
  const [historialEnv, setHistorialEnv] = useState({})   // idprop -> [envios del log, más recientes primero]
  const [emailProp, setEmailProp] = useState({})     // idprop -> email
  const [seleccion, setSeleccion] = useState({})     // idprop -> bool (marcado para enviar)
  const [reenvioOk, setReenvioOk] = useState({})     // idprop -> true = reenvío YA CONFIRMADO (autorizado al servidor)
  const [previewAbierto, setPreviewAbierto] = useState(false)
  const [obsGuardando, setObsGuardando] = useState({})
  const [despedida, setDespedida] = useState('Desde Fondo Capital Rent SpA le deseamos un feliz mes. Atentamente, Servicio de Información al Cliente.')
  const [enviando, setEnviando] = useState(false)
  const [progreso, setProgreso] = useState(null)   // { hechas, total } durante el envío por tandas
  const [resultadoEnvio, setResultadoEnvio] = useState(null)   // {enviadas, fallidas, results} | {error}
  const [borradorLoading, setBorradorLoading] = useState(null) // idprop generando borrador
  const [reducir1p, setReducir1p] = useState({})   // idprop -> true = forzar 1 página (borrador + envío)
  const [borradorToOpen, setBorradorToOpen] = useState({}) // idprop -> mostrar campo "enviar borrador a"
  const [borradorTo, setBorradorTo] = useState({})         // idprop -> correo destino del borrador
  const [borradorSendBusy, setBorradorSendBusy] = useState(null)
  const [complCands, setComplCands] = useState([])       // complementarias registradas del mes de cobro (para el panel)
  const [complBorradorBusy, setComplBorradorBusy] = useState(null)
  const [soloNoEnviadas, setSoloNoEnviadas] = useState(false)   // filtro: ocultar propietarios ya enviados
  const [filtroEstadoEnvio, setFiltroEstadoEnvio] = useState('todas')   // 'todas' | 'ok' | 'okdesc'
  const [filtroTexto, setFiltroTexto] = useState('')            // filtra por IDPROP o nombre (oculta el resto)

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

      const [rArr, rServ, rDesc, rCom, rCargos, rObs, rEnvios, rProps, rLog, rCap] = await Promise.all([
        supabase.from('datos_arriendos').select('*').in('idadmon', ids),
        supabase.from('ggcc_agua_luz').select('idadmon, aamm, deuda_gastos_comunes, deuda_vigente_electricidad, deuda_vigente_agua, deuda_vigente_gas').in('idadmon', ids),
        supabase.from('descuentos').select('idadmon, monto_a_imputar, texto_explicativo_para_carta_a_propietario').in('idadmon', ids).eq('mes_a_imputar', aammToTxt(m)).eq('repercutir_a', 'PROPIETARIO'),
        supabase.from('comentarios_liquidacion').select('idadmon, comentario, mes, para_mes_txt, created_at').in('idadmon', ids),
        supabase.rpc('transferido_propietario', { p_mes: m }),
        supabase.from('liquidacion_observaciones').select('idprop, texto').eq('mes', m),
        supabase.from('liquidacion_envios').select('idprop, estado_envio, fecha_envio, email_dest, enviado_por, desbloqueo_motivo, desbloqueado_por').eq('mes', m),
        supabase.from('propietarios').select('idprop, mail1, nombre').in('idprop', [...idprops]),
        supabase.from('liquidacion_envios_log').select('idprop, fecha_envio, enviado_por, reducido').eq('mes', m).order('fecha_envio', { ascending: false }),
        supabase.from('captacion_etiqueta').select('idadmon, etiqueta').in('idadmon', ids),
      ])
      // Etiqueta libre para deptos en captación (P): sustituye "EN CAPTACION ARRENDATARIO" en la carta.
      const capEtiq = {}
      for (const c of (rCap?.data || [])) if (c.idadmon && String(c.etiqueta || '').trim()) capEtiq[c.idadmon] = String(c.etiqueta).trim()

      // Líneas "en espera" (retenidas por morosidad, marcadas en CARTAS): set de idadmon para la nota de la carta.
      const retSet = new Set()
      try {
        const rr = await fetch('/api/liquidaciones/retener?mes=' + encodeURIComponent(m))
        const dd = await rr.json()
        for (const s of (dd.retenidos || [])) if (s.idadmon) retSet.add(s.idadmon)
      } catch { /* silencioso: sin exclusión si falla */ }

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
          arrendatario: esP ? (capEtiq[r.idadmon] || 'EN CAPTACION ARRENDATARIO') : campo(d, ['arrendatario', 'arrendatario1', 'nombre_arrendatario', 'arrendatario_nombre']),
          rut: esP ? '' : campo(d, ['rut', 'rut_arrendatario', 'rut1']),
          por: esP ? '' : campo(d, ['quien_cobra'], 'FCR'),
          aCobrar: esP ? 0 : n0(r.base), recibido: esP ? 0 : n0(r.recibido_banco),
          admon: esP ? 0 : n0(r.comision), iva: esP ? 0 : n0(r.iva_comision),
          descuentos: desc, aTransferir: esP ? -desc : n0(r.neto_transferir),
          ggcc: esP ? 0 : s.ggcc, luz: esP ? 0 : s.luz, agua: esP ? 0 : s.agua,
          nota: esProp ? '' : notaDe(r.idadmon), des: esProp ? [] : (des[r.idadmon] || []),
          ajuste: (esP || esProp) ? 0 : n0(ajustes[r.idadmon] || 0),
          // En espera = arrendatario no ha pagado. Esta línea NO entra en esta liquidación (ni importe ni comisión);
          // se hará una liquidación complementaria al cobrar. Se marca para EXCLUIRLA de la carta y de los totales.
          enEspera: (!esP && !esProp && retSet.has(r.idadmon)),
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
        // Las líneas EN ESPERA SIGUEN visibles (la liquidación referencia todas las propiedades) pero se
        // muestran marcadas como pendientes y NO entran en los totales. Se liquidan en una complementaria al cobrar.
        const enEsperaCount = g.inmuebles.filter(x => x.enEspera).length
        const T = g.inmuebles.filter(x => !x.enEspera).reduce((a, x) => ({
          aCobrar: a.aCobrar + x.aCobrar, recibido: a.recibido + x.recibido, admon: a.admon + x.admon,
          iva: a.iva + x.iva, descuentos: a.descuentos + x.descuentos, aTransferir: a.aTransferir + x.aTransferir,
        }), { aCobrar: 0, recibido: 0, admon: 0, iva: 0, descuentos: 0, aTransferir: 0 })
        g.enEsperaCount = enEsperaCount
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
      cargarComplEmails(m)
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

  // ¿Se puede enviar esta carta? OK/OK DESC, o CHECK/TO SEE con DESBLOQUEO justificado registrado.
  // Editar el texto de la carta para un depto en captación (P): "RESERVADO", etc. Lo hace quien emite.
  async function guardarCap(idadmon) {
    if (!puedeEnviar) return
    const val = (editCapTxt || '').trim()
    setCapBusy(idadmon)
    try {
      if (!val) await supabase.from('captacion_etiqueta').delete().eq('idadmon', idadmon)
      else await supabase.from('captacion_etiqueta').upsert({ idadmon, etiqueta: val, actualizado_por: email, actualizado_at: new Date().toISOString() }, { onConflict: 'idadmon' })
      const mostrar = val || 'EN CAPTACION ARRENDATARIO'
      setBloques(prev => prev.map(b => ({ ...b, inmuebles: b.inmuebles.map(x => (x.idadmon === idadmon && x.esP ? { ...x, arrendatario: mostrar } : x)) })))
    } catch (e) { alert('No se pudo guardar: ' + (e?.message || e)) }
    finally { setCapBusy(null); setEditCap(null); setEditCapTxt('') }
  }

  function estaDesbloqueada(b) {
    return !!String(envios[b.idprop]?.desbloqueo_motivo || '').trim()
  }
  function enviable(b) {
    if (b.estado === 'OK' || b.estado === 'OK DESC') return true   // cuadradas
    return estaDesbloqueada(b)                                     // o desbloqueadas con justificación
  }
  // Solo Dirección/Karina pueden desbloquear, y solo cartas NO cuadradas y aún no enviadas.
  function puedeDesbloquear(b) {
    return puedeEnviar && !(b.estado === 'OK' || b.estado === 'OK DESC') && !envios[b.idprop]?.fecha_envio
  }
  async function desbloquear(b) {
    if (!puedeDesbloquear(b)) return
    const motivo = (typeof window !== 'undefined' ? window.prompt(`Desbloquear el envío de ${b.idprop} — ${b.propietario} (estado ${b.estado}).\n\nEscribe la justificación (obligatoria):`, '') : '') || ''
    if (!motivo.trim()) { flash('Desbloqueo cancelado: falta la justificación.'); return }
    const { error } = await supabase.from('liquidacion_envios').upsert(
      { mes, idprop: b.idprop, desbloqueo_motivo: motivo.trim(), desbloqueado_por: email },
      { onConflict: 'mes,idprop' }
    )
    if (error) { flash('No se pudo desbloquear: ' + error.message); return }
    setEnvios(prev => ({ ...prev, [b.idprop]: { ...(prev[b.idprop] || {}), desbloqueo_motivo: motivo.trim(), desbloqueado_por: email } }))
    setSeleccion(s => ({ ...s, [b.idprop]: true }))
    flash('🔓 Envío desbloqueado con justificación')
  }
  const seleccionadas = bloques.filter(b => seleccion[b.idprop] && enviable(b))
  function toggleSel(idprop) { setSeleccion(s => ({ ...s, [idprop]: !s[idprop] })) }
  function seleccionarTodasEnviables() {
    // Solo las enviables que aún NO se han enviado y que están a la vista (respeta los filtros).
    const s = {}; for (const b of enviablesVisibles) s[b.idprop] = true; setSeleccion(s)
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

  // Enviar el PDF BORRADOR (marca de agua) por email a una persona concreta (revisión interna).
  // No es el envío oficial: no toca el candado ni liquidacion_envios.
  async function enviarBorradorA(b) {
    const dest = (borradorTo[b.idprop] || '').trim()
    if (!dest) { alert('Escribe el correo de destino.'); return }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(dest)) { alert('Ese correo no parece válido.'); return }
    setBorradorSendBusy(b.idprop)
    try {
      const res = await fetch('/api/liquidaciones/borrador-carta', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bloque: b, mesTxt: aammToTxt(mes), despedida, reducir: !!reducir1p[b.idprop], enviarA: dest }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { alert('No se pudo enviar el borrador: ' + (d.error || res.status)) }
      else { flash('📤 Borrador enviado a ' + dest); setBorradorToOpen(m => ({ ...m, [b.idprop]: false })); setBorradorTo(m => ({ ...m, [b.idprop]: '' })) }
    } catch (e) { alert('Error: ' + e.message) }
    finally { setBorradorSendBusy(null) }
  }

  // ── COMPLEMENTARIAS ──────────────────────────────────────────────────────
  // Carga las complementarias registradas cuyo mes de cobro es el mes visualizado.
  async function cargarComplEmails(m) {
    try {
      const r = await fetch('/api/liquidaciones/complementaria?mes_cobro=' + encodeURIComponent(m))
      const d = await r.json()
      setComplCands((d.candidatos || []).filter(c => c.complementaria && c.complementaria.estado !== 'anulada'))
    } catch { setComplCands([]) }
  }
  // Construye el bloque de la carta COMPLEMENTARIA de un propietario: todas sus propiedades del mes como
  // referencia (yaLiquidado, en gris, no suman) + la(s) línea(s) cobrada(s) con importes reales (del mes de espera).
  function buildComplBloque(idprop, cands) {
    const b = (bloques || []).find(x => x.idprop === idprop)
    const ref = ((b && b.inmuebles) || []).filter(x => !x.enEspera).map(x => ({ ...x, yaLiquidado: true, yaLiquidadoMes: aammToTxt(mes) }))
    const compl = cands.map(c => ({
      idadmon: c.idadmon, esP: false, esProp: false,
      propiedad: c.inmueble || c.idadmon, comienzo: '',
      arrendatario: `(cobrado - arriendo ${aammToTxt(c.mes_espera)})`, rut: '',
      aCobrar: n0(c.renta), recibido: 0, admon: n0(c.comision), iva: n0(c.iva),
      descuentos: 0, aTransferir: n0(c.neto), ggcc: 0, luz: 0, agua: 0, nota: '', des: [], ajuste: 0,
    }))
    const inmuebles = [...ref, ...compl]
    const T = compl.reduce((a, x) => ({
      aCobrar: a.aCobrar + x.aCobrar, recibido: 0, admon: a.admon + x.admon,
      iva: a.iva + x.iva, descuentos: 0, aTransferir: a.aTransferir + x.aTransferir,
    }), { aCobrar: 0, recibido: 0, admon: 0, iva: 0, descuentos: 0, aTransferir: 0 })
    const propietario = (b && b.propietario) || (cands[0] && cands[0].propietario) || ''
    return { idprop, propietario, inmuebles, totales: T, esComplementaria: true, enEsperaCount: 0 }
  }
  // Abre el borrador (marca de agua) de la carta complementaria de un propietario.
  async function verBorradorComplementaria(idprop, cands) {
    const bloque = buildComplBloque(idprop, cands)
    setComplBorradorBusy(idprop)
    try {
      const res = await fetch('/api/liquidaciones/borrador-carta', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bloque, mesTxt: aammToTxt(mes), despedida }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); alert('No se pudo generar: ' + (d.error || res.status)) }
      else { const blob = await res.blob(); const url = URL.createObjectURL(blob); window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 60000) }
    } catch (e) { alert('Error: ' + e.message) } finally { setComplBorradorBusy(null) }
  }

  // Re-lee los candados (liquidacion_envios) desde la BD y actualiza el estado, para reflejar al momento
  // qué cartas quedaron enviadas (útil tras un 504, donde el servidor sí envió algunas).
  async function refrescarEnvios() {
    try {
      const { data } = await supabase
        .from('liquidacion_envios')
        .select('idprop, estado_envio, fecha_envio, email_dest, enviado_por, desbloqueo_motivo, desbloqueado_por')
        .eq('mes', mes)
      const env = {}
      for (const e of data || []) env[e.idprop] = e
      setEnvios(env)
      // Quita de la selección las que ya tienen candado (ya no hay que reenviarlas).
      setSeleccion(prev => { const n = { ...prev }; for (const e of data || []) if (e.fecha_envio) delete n[e.idprop]; return n })
    } catch { /* silencioso */ }
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
    // Partir la selección en tandas de TANDA_ENVIO y enviar una petición por tanda (evita el timeout 504).
    const items = seleccionadas.slice()
    const total = items.length
    const tandas = []
    for (let i = 0; i < items.length; i += TANDA_ENVIO) tandas.push(items.slice(i, i + TANDA_ENVIO))
    const okAll = [], fallidasAll = [], erroresTanda = []
    let hechas = 0
    setProgreso({ hechas: 0, total })
    for (const tanda of tandas) {
      try {
        const enviosT = tanda.map(b => ({ idprop: b.idprop, propietario: b.propietario, email: emailProp[b.idprop] || '', bloque: b, reducir: !!reducir1p[b.idprop] }))
        const reenviar = tanda.filter(b => reenvioOk[b.idprop] && envios[b.idprop]?.fecha_envio).map(b => b.idprop)
        const res = await fetch('/api/liquidaciones/enviar-cartas', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mes, mesTxt: aammToTxt(mes), fecha: new Date().toLocaleDateString('es-CL'), despedida, envios: enviosT, reenviar }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) { erroresTanda.push(data.error || `Error ${res.status}`) }
        else {
          const okIds = (data.results || []).filter(r => r.ok)
          okAll.push(...okIds)
          fallidasAll.push(...(data.results || []).filter(r => !r.ok && r.motivo !== 'ya_enviada_omitida'))
          if (okIds.length) {
            setEnvios(prev => { const next = { ...prev }; for (const r of okIds) next[r.idprop] = { ...(next[r.idprop] || {}), estado_envio: 'ENVIADA', fecha_envio: r.fecha_envio, email_dest: r.email_dest, enviado_por: r.enviado_por }; return next })
            setHistorialEnv(prev => { const next = { ...prev }; for (const r of okIds) next[r.idprop] = [{ idprop: r.idprop, fecha_envio: r.fecha_envio, enviado_por: r.enviado_por, reducido: !!reducir1p[r.idprop] }, ...(next[r.idprop] || [])]; return next })
            setSeleccion(prev => { const next = { ...prev }; for (const r of okIds) delete next[r.idprop]; return next })
          }
        }
      } catch (err) {
        erroresTanda.push(err.message || 'Error de red')
      }
      hechas += tanda.length
      setProgreso({ hechas, total })
    }
    await refrescarEnvios()
    setProgreso(null)
    if (okAll.length === 0 && erroresTanda.length) {
      setResultadoEnvio({ error: `No se envió ninguna. ${erroresTanda[0]} — reintenta (no se duplica).` })
    } else {
      setResultadoEnvio({
        enviadas: okAll.length,
        fallidas: fallidasAll.length,
        results: okAll.concat(fallidasAll),
        aviso: erroresTanda.length ? `⚠ ${erroresTanda.length} tanda(s) fallaron; se enviaron ${okAll.length}. Reintenta el envío: solo saldrán las que falten (no se duplican).` : null,
      })
    }
    setEnviando(false)
  }

  if (status === 'loading' || accesoOk === null) return (<><TopNav /><div style={{ padding: 40, color: '#888' }}>Cargando…</div></>)
  if (accesoOk === false) return null

  const estadoColor = { 'OK': { bg: '#DCFCE7', c: '#166534' }, 'OK DESC': { bg: '#FEF9C3', c: '#854D0E' }, 'TO SEE': { bg: '#FEE2E2', c: '#991B1B' }, 'CHECK': { bg: '#FFEDD5', c: '#9A3412' } }
  const MONO = "ui-monospace, 'SF Mono', 'Roboto Mono', Menlo, Consolas, monospace"
  const COLS = '58px 168px 72px 128px 82px 76px 76px 34px 66px 58px 76px 82px 76px 68px 64px 60px 128px 140px'
  const th = { fontSize: 10, color: '#e5e7eb', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
  const td = { fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
  const rt = { textAlign: 'right', fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }

  // "Enviada" = tiene registro de envío (fecha) este mes. El filtro oculta las enviadas,
  // deje el estado que deje (muestra OK, CHECK, TO SEE... todo lo que aún no se envió).
  // Nota: la barra "Seleccionar todas las enviables" y el envío siguen operando sobre `bloques`
  // (todo el mes), no sobre lo filtrado; el filtro es solo visual.
  const estaEnviada = b => !!envios[b.idprop]?.fecha_envio
  const nNoEnviadas = bloques.filter(b => !estaEnviada(b)).length
  // Filtros de la pantalla: no-enviadas + estado (OK / OK DESC) + texto (IDPROP o nombre). Solo se muestran las que pasan.
  const normTxt = s => (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
  const qFiltro = normTxt(filtroTexto)
  const visibles = bloques.filter(b => {
    if (soloNoEnviadas && estaEnviada(b)) return false
    // "Solo OK / OK DESC" son filtros de "por enviar": ocultan también las ya enviadas.
    if (filtroEstadoEnvio === 'ok' && (b.estado !== 'OK' || estaEnviada(b))) return false
    if (filtroEstadoEnvio === 'okdesc' && (b.estado !== 'OK DESC' || estaEnviada(b))) return false
    // TO SEE y CHECK: filtro por estado (para revisar/desbloquear); no se ocultan por "enviada" (no son enviables).
    if (filtroEstadoEnvio === 'tosee' && b.estado !== 'TO SEE') return false
    if (filtroEstadoEnvio === 'check' && b.estado !== 'CHECK') return false
    if (qFiltro && !normTxt(`${b.idprop} ${b.propietario}`).includes(qFiltro)) return false
    return true
  })
  // Enviables NO enviadas dentro de lo que se ve ahora (para "Seleccionar todas" sin re-marcar las ya enviadas).
  const enviablesVisibles = visibles.filter(b => enviable(b) && !estaEnviada(b))

  return (
    <>
      <TopNav />
      <div style={{ maxWidth: 1900, margin: '0 auto', padding: 20, fontFamily: '"DM Sans", sans-serif', fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum" 1' }}>

        {/* Zona superior FIJA al hacer scroll: navegación + mes + envío */}
        <div style={{ position: 'sticky', top: 52, zIndex: 30, background: '#fff', paddingTop: 8, marginLeft: -20, marginRight: -20, paddingLeft: 20, paddingRight: 20, borderBottom: '1px solid #EAE8E1' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
          <button onClick={() => router.push('/procesos/liquidaciones')}
            style={{ fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: '1px solid #D3D1C7', background: '#fff', color: '#2C2C2A', cursor: 'pointer' }}>
            ← TRANSFER
          </button>
          <button onClick={() => router.push('/procesos/liquidaciones/cartas')}
            style={{ fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: '1px solid #C7D2FE', background: '#EEF2FF', color: '#3730A3', cursor: 'pointer' }}>
            📄 CARTAS
          </button>
          <button onClick={() => router.push('/procesos/liquidaciones/faltan')}
            style={{ fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#B91C1C', cursor: 'pointer' }}>
            ⚠ FALTAN
          </button>
          <button onClick={() => router.push('/procesos/liquidaciones/facturas')}
            style={{ fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: '1px solid #DDD6FE', background: '#F5F3FF', color: '#6D28D9', cursor: 'pointer' }}>
            🧾 FACTURAS
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
          <BuscarLiquidacion
            bloques={bloques}
            idPrefix="liq"
            mostrarFiltroEnviadas
            soloNoEnviadas={soloNoEnviadas}
            onSoloNoEnviadas={setSoloNoEnviadas}
            nNoEnviadas={nNoEnviadas}
          />
        </div>

        {/* Filtros de la lista: estado + texto (IDPROP/nombre). Solo se muestran las que pasan. */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Filtrar:</span>
          <select value={filtroEstadoEnvio} onChange={e => setFiltroEstadoEnvio(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid #E5E7EB', fontSize: 12 }}>
            <option value="todas">Todos los estados</option>
            <option value="ok">Solo OK · por enviar</option>
            <option value="okdesc">Solo OK DESC · por enviar</option>
            <option value="tosee">Solo TO SEE</option>
            <option value="check">Solo CHECK</option>
          </select>
          <input value={filtroTexto} onChange={e => setFiltroTexto(e.target.value)} placeholder="IDPROP o nombre del propietario…"
            style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid #E5E7EB', fontSize: 12, minWidth: 240 }} />
          {(filtroEstadoEnvio !== 'todas' || filtroTexto) && (
            <button onClick={() => { setFiltroEstadoEnvio('todas'); setFiltroTexto('') }}
              style={{ fontSize: 12, fontWeight: 600, padding: '6px 10px', borderRadius: 7, border: '1px solid #CBD5E1', background: '#fff', color: '#334155', cursor: 'pointer' }}>Quitar filtros</button>
          )}
          <span style={{ fontSize: 12, color: '#64748B' }}>Mostrando <b>{visibles.length}</b> de {bloques.length}</span>
        </div>

        {error && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', fontSize: 13, padding: '10px 14px', borderRadius: 8, marginBottom: 12 }}>Error: {error}</div>}
        {cargando && <div style={{ color: '#888', padding: 20 }}>Calculando…</div>}

        {!cargando && bloques.length > 0 && puedeEnviar && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>Envío de cartas:</span>
            <button onClick={seleccionarTodasEnviables} style={{ fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 7, border: '1px solid #CBD5E1', background: '#fff', color: '#334155', cursor: 'pointer' }}>
              Seleccionar todas las enviables ({enviablesVisibles.length})
            </button>
            <button onClick={limpiarSeleccion} style={{ fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 7, border: '1px solid #CBD5E1', background: '#fff', color: '#334155', cursor: 'pointer' }}>
              Quitar selección
            </button>
            <span style={{ fontSize: 12, color: '#64748B' }}>
              Solo se pueden enviar las cartas en <b style={{ color: '#166534' }}>OK</b> / <b style={{ color: '#854D0E' }}>OK DESC</b> que no se hayan enviado ya.
            </span>
            <button onClick={() => setPreviewAbierto(true)} disabled={seleccionadas.length === 0}
              style={{ margin: '0 auto', fontSize: 13, fontWeight: 700, padding: '8px 18px', borderRadius: 8, border: 'none', background: seleccionadas.length ? '#1D9E75' : '#9CA3AF', color: '#fff', cursor: seleccionadas.length ? 'pointer' : 'not-allowed' }}>
              ✉ Enviar seleccionadas ({seleccionadas.length})
            </button>
          </div>
        )}
        </div>{/* fin zona sticky */}

        {/* Panel de COMPLEMENTARIAS del mes de cobro: cartas de arriendos morosos ya cobrados. */}
        {!cargando && complCands.length > 0 && puedeEnviar && (() => {
          const porProp = {}
          for (const c of complCands) (porProp[c.idprop] = porProp[c.idprop] || []).push(c)
          const grupos = Object.entries(porProp)
          return (
            <div style={{ border: '1px solid #DDD6FE', background: '#F5F3FF', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#5B21B6', marginBottom: 6 }}>🧩 Complementarias de {aammToTxt(mes)} · {grupos.length} propietario(s)</div>
              <div style={{ fontSize: 12, color: '#6D28D9', marginBottom: 10 }}>Arriendos morosos ya cobrados que se liquidan este mes. La carta lista todas las propiedades del propietario (las ya liquidadas en gris) y solo la cobrada con importes.</div>
              {grupos.map(([idprop, cands]) => {
                const neto = cands.reduce((a, c) => a + n0(c.neto), 0)
                const nombre = (cands[0] && cands[0].propietario) || idprop
                return (
                  <div key={idprop} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '6px 0', borderTop: '1px solid #EDE9FE' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#3730A3' }}>{idprop} — {nombre}</span>
                    <span style={{ fontSize: 12, color: '#6B7280' }}>{cands.map(c => `${c.idadmon} (arriendo ${aammToTxt(c.mes_espera)})`).join(' · ')}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#5B21B6' }}>A transferir: {fmt(neto)}</span>
                    <button onClick={() => verBorradorComplementaria(idprop, cands)} disabled={complBorradorBusy === idprop}
                      style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 7, border: '1px solid #C7B5FE', background: '#fff', color: '#5B21B6', cursor: complBorradorBusy === idprop ? 'wait' : 'pointer' }}>
                      {complBorradorBusy === idprop ? 'Generando…' : '📄 Ver borrador complementaria'}
                    </button>
                  </div>
                )
              })}
            </div>
          )
        })()}

        {!cargando && visibles.map(b => {
          const ec = estadoColor[b.estado] || { bg: '#eee', c: '#333' }
          const abierta = !!obsAbierta[b.idprop]
          return (
            <div key={b.idprop} id={'liq-' + b.idprop} style={{ scrollMarginTop: 210, border: '1px solid #C7D2FE', borderRadius: 10, marginBottom: 16, overflow: 'hidden', background: '#fff' }}>
              {/* Cabecera del bloque */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', background: '#E0E7FF', borderBottom: '1px solid #C7D2FE' }}>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                  {puedeEnviar && (enviable(b) ? (
                    <input type="checkbox" checked={!!seleccion[b.idprop]}
                      onChange={() => {
                        // Reenvío: si ya se envió y la estás marcando, pide confirmación y AUTORIZA el reenvío (solo así se reenvía).
                        const marcando = !seleccion[b.idprop]
                        if (marcando && envios[b.idprop]?.fecha_envio) {
                          if (!window.confirm(`La liquidación de ${b.idprop} — ${b.propietario} YA fue enviada.\n\n¿Desea volver a enviarla (reenvío)?`)) return
                          setReenvioOk(r => ({ ...r, [b.idprop]: true }))
                        } else if (!marcando) {
                          setReenvioOk(r => { const n = { ...r }; delete n[b.idprop]; return n })
                        }
                        toggleSel(b.idprop)
                      }}
                      title={envios[b.idprop]?.fecha_envio ? 'Ya enviada — marca para REENVIAR (pedirá confirmación)' : (estaDesbloqueada(b) ? `Desbloqueada por ${envios[b.idprop]?.desbloqueado_por || '—'}: ${envios[b.idprop]?.desbloqueo_motivo || ''}` : 'Seleccionar para enviar')}
                      style={{ width: 16, height: 16, cursor: 'pointer', accentColor: envios[b.idprop]?.fecha_envio ? '#d97706' : undefined, outline: envios[b.idprop]?.fecha_envio ? '2px solid #f59e0b' : undefined, outlineOffset: 1, borderRadius: 3 }} />
                  ) : (
                    <input type="checkbox" disabled checked={false}
                      title={envios[b.idprop]?.fecha_envio ? 'Ya enviada' : 'No se puede enviar hasta que esté en OK (o se desbloquee con justificación)'} style={{ width: 16, height: 16 }} />
                  ))}
                  {puedeDesbloquear(b) && !estaDesbloqueada(b) && (
                    <button onClick={() => desbloquear(b)} title="Desbloquear el envío dejando una justificación (Dirección/Karina)"
                      style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#B91C1C', cursor: 'pointer' }}>
                      🔓 Desbloquear
                    </button>
                  )}
                  {estaDesbloqueada(b) && !envios[b.idprop]?.fecha_envio && (
                    <span title={`Motivo: ${envios[b.idprop]?.desbloqueo_motivo || ''}`} style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#FEF9C3', color: '#854D0E' }}>
                      🔓 Desbloqueada{envios[b.idprop]?.desbloqueado_por ? ' · ' + String(envios[b.idprop].desbloqueado_por).split('@')[0] : ''}
                    </span>
                  )}
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
                  {puedeEnviar && (
                    borradorToOpen[b.idprop] ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <input autoFocus type="email" value={borradorTo[b.idprop] || ''} placeholder="correo destino…"
                          onChange={(e) => setBorradorTo(m => ({ ...m, [b.idprop]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === 'Enter') enviarBorradorA(b); if (e.key === 'Escape') setBorradorToOpen(m => ({ ...m, [b.idprop]: false })) }}
                          style={{ fontSize: 11, padding: '3px 6px', borderRadius: 6, border: '1px solid #C7D2FE', width: 180 }} />
                        <button onClick={() => enviarBorradorA(b)} disabled={borradorSendBusy === b.idprop}
                          style={{ fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 7, border: 'none', background: '#4F46E5', color: '#fff', cursor: borradorSendBusy === b.idprop ? 'wait' : 'pointer' }}>
                          {borradorSendBusy === b.idprop ? 'Enviando…' : 'Enviar'}</button>
                        <button onClick={() => setBorradorToOpen(m => ({ ...m, [b.idprop]: false }))} title="Cancelar"
                          style={{ fontSize: 11, padding: '4px 6px', borderRadius: 7, border: '1px solid #E5E7EB', background: '#fff', color: '#6B7280', cursor: 'pointer' }}>✕</button>
                      </span>
                    ) : (
                      <button onClick={() => setBorradorToOpen(m => ({ ...m, [b.idprop]: true }))}
                        title="Enviar este borrador por email a una persona (revisión interna; NO es el envío oficial al propietario)"
                        style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 7, border: '1px solid #C7B5FE', background: '#F5F3FF', color: '#5B21B6', cursor: 'pointer' }}>✉ Enviar borrador a…</button>
                    )
                  )}
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
                <div style={{ minWidth: 1554 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 6, padding: '7px 12px', background: '#334155' }}>
                    <div style={th}>IdAdmon</div><div style={th}>Propiedad</div><div style={th}>Comienzo</div>
                    <div style={th}>Arrendatario</div><div style={th}>RUT</div><div style={{ ...th, ...rt }}>A Cobrar</div><div style={{ ...th, ...rt }}>Recibido</div>
                    <div style={th}>Por</div><div style={{ ...th, ...rt }}>Admon</div><div style={{ ...th, ...rt }}>IVA</div><div style={{ ...th, ...rt }}>Descuentos</div>
                    <div style={{ ...th, ...rt }}>A transferir</div><div style={{ ...th, ...rt }}>Ajuste</div>
                    <div style={{ ...th, ...rt }}>G.Comunes</div><div style={{ ...th, ...rt }}>Electric.</div><div style={{ ...th, ...rt }}>Agua</div>
                    <div style={th}>Nota</div><div style={th}>DES</div>
                  </div>
                  {b.inmuebles.map((x, i) => {
                    const bgP = x.esP ? { background: '#F5E6D3' } : {}   // fondo beige (como Excel): IdAdmon → A transferir
                    const vP = x.esP ? '\u00A0' : ''   // celda P vacía: espacio duro para que pinte el fondo
                    const enEsp = !x.esP && x.enEspera   // pendiente de cobro: fila visible pero FUERA de esta liquidación
                    const strike = enEsp ? { color: '#9CA3AF', textDecoration: 'line-through' } : {}
                    const filaInmueble = (
                    <div key={x.idadmon + i} style={{ display: 'grid', gridTemplateColumns: COLS, gap: 6, padding: '6px 12px', borderTop: '1px solid #F0EEE8', alignItems: 'center', ...(enEsp ? { background: '#FFF7ED' } : {}) }}>
                      <div style={{ ...td, ...bgP, fontFamily: MONO, fontWeight: 600 }}>{x.idadmon}</div>
                      <div style={{ ...td, ...bgP }} title={x.propiedad || ''}>{x.propiedad || '—'}</div>
                      <div style={{ ...td, ...bgP, fontFamily: MONO }}>{x.comienzo || vP}</div>
                      <div style={{ ...td, ...bgP }} title={x.arrendatario || ''}>
                        {x.esP && puedeEnviar
                          ? (editCap === x.idadmon
                              ? <input autoFocus value={editCapTxt} disabled={capBusy === x.idadmon}
                                  onChange={(e) => setEditCapTxt(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') guardarCap(x.idadmon); if (e.key === 'Escape') { setEditCap(null); setEditCapTxt('') } }}
                                  onBlur={() => guardarCap(x.idadmon)} placeholder="EN CAPTACION ARRENDATARIO"
                                  style={{ width: '100%', fontSize: 11, padding: '2px 4px', border: '1px solid #7c3aed', borderRadius: 4, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                              : <span onClick={() => { setEditCap(x.idadmon); setEditCapTxt(x.arrendatario === 'EN CAPTACION ARRENDATARIO' ? '' : (x.arrendatario || '')) }}
                                  title="Clic para cambiar el texto de la carta (p. ej. RESERVADO)"
                                  style={{ cursor: 'pointer', borderBottom: '1px dashed #C4B5FD' }}>{x.arrendatario || '—'} <span style={{ color: '#7c3aed', fontSize: 10 }}>✎</span></span>)
                          : (x.arrendatario || '—')}
                      </div>
                      <div style={{ ...td, ...bgP, fontFamily: MONO }}>{x.rut || vP}</div>
                      <div style={{ ...td, ...rt, ...bgP, ...strike }}>{x.esP ? vP : fmt(x.aCobrar)}</div>
                      <div style={{ ...td, ...rt, ...bgP, ...strike }}>{x.esP ? vP : fmt(x.recibido)}</div>
                      <div style={{ ...td, ...bgP }}>{x.esP ? vP : (x.por || '—')}</div>
                      <div style={{ ...td, ...rt, ...bgP, ...strike }}>{x.esP ? vP : fmt(x.admon)}</div>
                      <div style={{ ...td, ...rt, ...bgP, ...strike }}>{x.esP ? vP : fmt(x.iva)}</div>
                      <div style={{ ...td, ...rt, ...bgP, color: x.descuentos ? '#16A34A' : '#2C2C2A', fontWeight: x.descuentos ? 700 : 400, ...strike }}>{x.descuentos ? fmt(x.descuentos) : vP}</div>
                      <div style={{ ...td, ...rt, ...bgP, fontWeight: 600, ...strike }}>{x.esP ? (x.descuentos ? fmt(x.aTransferir) : vP) : fmt(x.aTransferir)}</div>
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
                    // 1) Descuentos — también en líneas P (deptos en captación con descuento asignado)
                    ;(x.des || []).forEach((dd, j) => subfilas.push(
                        <div key={x.idadmon + i + 'd' + j} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '3px 12px 3px 40px', borderTop: '1px solid #F7F6F2' }}>
                          <span style={{ color: '#9CA3AF', fontSize: 12 }}>↳</span>
                          <span style={{ fontFamily: MONO, color: '#16A34A', fontWeight: 700, fontSize: 12, minWidth: 92, textAlign: 'right' }}>{fmt(dd.monto)}</span>
                          <span style={{ fontSize: 12, color: '#4B5563' }}>{dd.texto || 'Descuento'}</span>
                        </div>
                      ))
                    if (!x.esP) {
                      // 2) Ajuste del mes
                      if (x.ajuste) subfilas.push(
                        <div key={x.idadmon + i + 'aj'} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '3px 12px 3px 40px', borderTop: '1px solid #F7F6F2' }}>
                          <span style={{ color: '#9CA3AF', fontSize: 12 }}>↳</span>
                          <span style={{ fontFamily: MONO, color: '#B45309', fontWeight: 700, fontSize: 12, minWidth: 92, textAlign: 'right' }}>{fmt(x.ajuste)}</span>
                          <span style={{ fontSize: 12, color: '#92400E' }}>Se ha realizado un ajuste de ${fmt(x.ajuste)} en la renta</span>
                        </div>
                      )
                    }
                    // 3) Comentario del mes (comentarios_liquidacion) — TAMBIÉN en líneas P
                    //    (deptos vacíos / en captación), igual que en el PDF de la carta.
                    if (x.nota) subfilas.push(
                      <div key={x.idadmon + i + 'co'} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '3px 12px 3px 40px', borderTop: '1px solid #F7F6F2' }}>
                        <span style={{ color: '#9CA3AF', fontSize: 12 }}>↳</span>
                        <span style={{ fontSize: 12, minWidth: 92, textAlign: 'right', color: '#6366F1', fontWeight: 700 }}>💬 Nota</span>
                        <span style={{ fontSize: 12, color: '#4B5563', fontStyle: 'italic' }}>{x.nota}</span>
                      </div>
                    )
                    // Pendiente de cobro (moroso): fila visible pero fuera de esta liquidación; se liquida en la complementaria.
                    if (enEsp) subfilas.push(
                      <div key={x.idadmon + i + 'esp'} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '3px 12px 3px 40px', borderTop: '1px solid #F7F6F2', background: '#FFF7ED' }}>
                        <span style={{ color: '#9CA3AF', fontSize: 12 }}>↳</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#9A3412' }}>⏸ PENDIENTE DE COBRO — se liquida posteriormente, en liquidación complementaria cuando el arrendatario pague.</span>
                      </div>
                    )
                    return [filaInmueble, ...subfilas]
                  })}
                  {/* TOTALES */}
                  <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 6, padding: '7px 12px', borderTop: '2px solid #CBD5E1', background: '#F1F5F9', fontWeight: 700, fontSize: 11.5 }}>
                    <div>TOTALES</div><div /><div /><div /><div />
                    <div style={rt}>{fmt(b.totales.aCobrar)}</div><div style={rt}>{fmt(b.totales.recibido)}</div><div />
                    <div style={rt}>{fmt(b.totales.admon)}</div><div style={rt}>{fmt(b.totales.iva)}</div><div style={rt}>{fmt(b.totales.descuentos)}</div>
                    <div style={rt}>{fmt(b.totales.aTransferir)}</div>
                    <div style={rt}>{(() => { const s = (b.inmuebles || []).filter(x => !x.enEspera).reduce((a, x) => a + n0(x.ajuste), 0); return s ? fmt(s) : '' })()}</div><div /><div /><div /><div /><div />
                  </div>
                  {n0(b.enEsperaCount) > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 12px 5px 40px', background: '#FFF7ED', borderTop: '1px solid #FED7AA' }}>
                      <span style={{ color: '#9CA3AF', fontSize: 12 }}>↳</span>
                      <span style={{ fontSize: 12, color: '#9A3412' }}>⏸ {b.enEsperaCount} propiedad(es) pendiente(s) de cobro (arriba, tachadas) — <b>fuera de esta liquidación</b>. Se liquidará(n) en la complementaria cuando el arrendatario pague.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Fila de cierre: estado + transferido + diferencia */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: '10px 14px', borderTop: '1px solid #E5E7EB', background: '#FAFAFA' }}>
                <span style={{ fontSize: 12, fontWeight: 800, padding: '4px 12px', borderRadius: 20, background: ec.bg, color: ec.c }}>{b.estado}</span>
                <span style={{ fontSize: 12, color: '#555' }}>A transferir: <b>{fmt(b.totales.aTransferir)}</b></span>
                {n0(b.enEsperaCount) > 0 && (
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: '#FFEDD5', color: '#9A3412' }}>⏸ {b.enEsperaCount} en espera (fuera de esta liquidación)</span>
                )}
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
                  <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-start' }}>
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
        {!cargando && bloques.length > 0 && visibles.length === 0 && soloNoEnviadas && (
          <div style={{ padding: 30, textAlign: 'center', color: '#166534', fontSize: 14 }}>Todas las cartas de {aammToTxt(mes)} ya se enviaron. Desmarca «Solo no enviadas» para verlas.</div>
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
                      <div style={{ textAlign: 'right', fontFamily: MONO }}>
                        {fmt(b.totales.aTransferir)}
                        {n0(b.enEsperaCount) > 0 && <div style={{ fontSize: 10, color: '#9A3412', fontWeight: 700 }}>⏸ {b.enEsperaCount} en espera aparte</div>}
                      </div>
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
                  Asunto: <b>[NO RESPONDER] Liquidación mes de {aammToTxt(mes)}</b> · CC a administracion@ y karina.morales@ · Adjunto PDF. Al enviar se pone candado (fecha de envío) y no se reenvía.
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
                    {resultadoEnvio.aviso && <div style={{ marginTop: 6, color: '#92400E', fontWeight: 600 }}>{resultadoEnvio.aviso}</div>}
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
                {enviando ? (progreso ? `Enviando ${progreso.hechas}/${progreso.total}…` : 'Enviando…') : `✉ Confirmar envío (${seleccionadas.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}