'use client'
// RUTA: app/procesos/liquidaciones/faltan/page.js
// VERSION: v7 · 2026-08-15 · FIX columna "Cartola": el saldo global salía 0 en muchos IDADMON porque el fetch de
//   `cuentas` topaba a 1000 filas (para ~100 contratos son miles). Ahora se PAGINA (range de 1000 en 1000) y se suman
//   TODAS las líneas, de modo que el saldo coincide con el saldo corrido de la cartola. Hereda v6.
// VERSION: v6 · 2026-08-15 · La columna de saldo global de la cartola se renombra a "Cartola" y se tiñe de naranja
//   suave (cabecera y celdas) para distinguirla. Hereda v5.
// VERSION: v5 · 2026-08-15 · (1) La columna "Falta arriendo" se renombra a "Falta mensual" (es lo cobrado en la
//   ventana 23 del mes anterior → 22 del mes, según liquidacion_mes2). (2) Nueva columna "Saldo cuentas": saldo
//   global de la cartola de cada IDADMON (Σ cargo efectivo − Σ abono, sin anuladas), para ver de un vistazo el
//   comportamiento global del contrato además de la falta del mes. Se añade también al Excel y al filtro. Hereda v4.
// VERSION: v4 · 2026-08-14 · Los "pagos de más" (saldo a favor, falta < 0) salen AHORA VISIBLES por defecto
//   (antes ocultos). El botón se mantiene, pero al revés: arranca como "− Ocultar pagos de más". No cambia el
//   cálculo ni las métricas. Hereda v3.
// VERSION: v3 · 2026-08-13 · Botón "Ver pagos de más" (por defecto OCULTO): además de los deudores, permite mostrar
//   los IDADMON con saldo a FAVOR (falta < 0). No afectan a las métricas (En falta / Falta de arriendo / Deuda
//   servicios), que siguen contando solo deudores; se distinguen con badge "+pagó", fondo e importe en verde.
//   Se enriquecen y filtran igual que el resto (comentario, chequeado). Hereda v2.
// VERSION: v2 · 2026-08-13 · Columna "Chequeado" (tick por fila) para marcar las filas ya revisadas, con filtro
//   Excel arriba (SI/NO). Es solo de gestión: se guarda por idadmon+mes en la tabla `faltan_check` (endpoint
//   /api/faltan/check) SIN tocar ningún dato de la liquidación. Gate de escritura = Dirección + Admin (igual que
//   los comentarios). Se exporta también a Excel. Hereda v1.
// VERSION: v1 · 2026-08-13 · Filtros tipo Excel por columna (mismo motor que CC1/Cobranza, lib/filtroExcel)
//   en TODAS las columnas (IDADMON, Propietario, Inmueble, A cobrar, Falta arriendo, GGCC, Luz, Agua, Gas,
//   Serv. total, Comentario) + botón "Exportar Excel" que vuelca EXACTAMENTE lo filtrado del mes. Primera
//   versión versionada de esta pantalla.

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../../lib/supabaseClient'
import { HeaderFilter, filtroActivo, aplicarFiltros } from '@/lib/filtroExcel'
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

// ── Filtros estilo Excel (mismo motor que CC1/Cobranza: lib/filtroExcel). Una definición por columna.
//    `fkey` extrae el valor de la fila y `flabel` lo formatea para el desplegable. ──
const fmtNumCL = (k) => { const x = Number(k); return isNaN(x) ? String(k) : x.toLocaleString('es-CL') }
const nkey = (v) => String(Math.round(n0(v)))   // clave numérica estable para el filtro
const FALTAN_COLS = [
  { key: 'idadmon', label: 'IDADMON', tipo: 'texto', fkey: f => f.idadmon || '', flabel: k => (k === '' ? '(vacías)' : k) },
  { key: 'propietario', label: 'Propietario', tipo: 'texto', fkey: f => f.propietario || '', flabel: k => (k === '' ? '(vacías)' : k) },
  { key: 'inmueble', label: 'Inmueble', tipo: 'texto', fkey: f => f.inmueble || '', flabel: k => (k === '' ? '(vacías)' : k) },
  { key: 'base', label: 'A cobrar', tipo: 'num', fkey: f => nkey(f.base), flabel: k => (k === '' ? '(vacías)' : fmtNumCL(k)) },
  { key: 'falta', label: 'Falta mensual', tipo: 'num', fkey: f => nkey(f.falta), flabel: k => (k === '' ? '(vacías)' : fmtNumCL(k)) },
  { key: 'saldoCuentas', label: 'Cartola', tipo: 'num', fkey: f => nkey(f.saldoCuentas), flabel: k => (k === '' ? '(vacías)' : fmtNumCL(k)) },
  { key: 'ggcc', label: 'GGCC', tipo: 'num', fkey: f => nkey(f.ggcc), flabel: k => (k === '' ? '(vacías)' : fmtNumCL(k)) },
  { key: 'luz', label: 'Luz', tipo: 'num', fkey: f => nkey(f.luz), flabel: k => (k === '' ? '(vacías)' : fmtNumCL(k)) },
  { key: 'agua', label: 'Agua', tipo: 'num', fkey: f => nkey(f.agua), flabel: k => (k === '' ? '(vacías)' : fmtNumCL(k)) },
  { key: 'gas', label: 'Gas', tipo: 'num', fkey: f => nkey(f.gas), flabel: k => (k === '' ? '(vacías)' : fmtNumCL(k)) },
  { key: 'servTotal', label: 'Serv. total', tipo: 'num', fkey: f => nkey(f.servTotal), flabel: k => (k === '' ? '(vacías)' : fmtNumCL(k)) },
  { key: 'comentario', label: 'Coment. interno', tipo: 'texto', fkey: f => f.comentario || '', flabel: k => (k === '' ? '(sin comentario)' : k) },
  { key: 'chequeado', label: 'Chequeado', tipo: 'texto', fkey: f => f.chequeado || 'NO', flabel: k => (k || 'NO') },
]

export default function FaltanPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const email = session?.user?.email
  const rol = session?.user?.role
  const puedeComentar = rol === 'administracion' || rol === 'direccion' || rol === 'admin' || COMENTAR_EMAILS.includes(email)   // Direccion + Administracion (Adalis, Fabiola)

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
  const [checks, setChecks] = useState({})              // idadmon -> true (chequeado del mes)
  const [filasPago, setFilasPago] = useState([])        // IDADMON con saldo a favor (pagaron de más)
  const [verPagoDeMas, setVerPagoDeMas] = useState(true)   // por defecto VISIBLES (el botón permite ocultarlos)

  // ── Filtros estilo Excel (mismo motor que CC1/Cobranza): un estado por columna + orden global ──
  const [filters, setFilters] = useState({})
  const [openFilter, setOpenFilter] = useState(null)
  const [orden, setOrden] = useState(null)
  const setFiltroCol = (key, val) => setFilters(f => { const n = { ...f }; if (val == null) delete n[key]; else n[key] = val; return n })
  const limpiarTodo = () => { setFilters({}); setOrden(null) }
  const hayAlguno = FALTAN_COLS.some(c => filtroActivo(filters[c.key])) || !!orden?.key

  // Enriquecer cada fila con su comentario (que vive en otro estado) para poder filtrar/exportar por él.
  // Fuente visible: deudores siempre; los "pagó de más" solo si el botón está activo.
  const filasVista = useMemo(() => (verPagoDeMas ? [...filas, ...filasPago] : filas), [filas, filasPago, verPagoDeMas])
  const filasEnr = useMemo(
    () => filasVista.map(f => ({ ...f, comentario: (comentarios[f.idadmon] && comentarios[f.idadmon].comentario) || '', chequeado: checks[f.idadmon] ? 'SI' : 'NO' })),
    [filasVista, comentarios, checks]
  )
  // Derivación: filtros de columna → orden. Sin orden explícito, se mantiene el orden original
  // (FCR primero, luego por deuda desc), igual que antes.
  const filtradas = useMemo(() => {
    let out = aplicarFiltros(filasEnr, FALTAN_COLS, filters, orden)
    if (!orden?.key) {
      out = [...out].sort((a, b) => (Number(a.cobraDueno) - Number(b.cobraDueno)) || (b.falta - a.falta))
    }
    return out
  }, [filasEnr, filters, orden])

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
    setCargando(true); setError(null); setFilas([]); setFilasPago([]); setComentarios({}); setChecks({})
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
      const grupos = Object.values(porId)
      const conFalta = grupos.filter(g => g.falta > 0)
      const conPago  = grupos.filter(g => g.falta < 0)   // pagaron de más (saldo a favor)
      if (conFalta.length === 0 && conPago.length === 0) { setFilas([]); setFilasPago([]); setCargando(false); return }

      // 2) Servicios (saldo vigente = fila del aamm más alto por IDADMON) — para deudores y pagos de más
      const ids = [...conFalta, ...conPago].map(g => g.idadmon)
      const { data: serv, error: e2 } = await supabase
        .from('ggcc_agua_luz')
        .select('idadmon, aamm, deuda_gastos_comunes, deuda_vigente_electricidad, deuda_vigente_agua, deuda_vigente_gas')
        .in('idadmon', ids)
      if (e2) { setError(e2.message); setCargando(false); return }

      // quien_cobra por IDADMON: los que cobra el DUEÑO no se cuentan como deuda de FCR
      const { data: arr } = await supabase.from('datos_arriendos').select('idadmon, quien_cobra').in('idadmon', ids)
      const cobraMap = {}
      for (const a of arr || []) cobraMap[a.idadmon] = String(a.quien_cobra || '').trim().toUpperCase()

      // Saldo GLOBAL de la cartola (cuentas) por IDADMON: Σ cargo efectivo − Σ abono (sin líneas anuladas).
      // Da la visión global del contrato (positivo = debe acumulado; negativo = a favor), además de la falta del mes.
      // OJO: para ~100 contratos son MILES de filas en `cuentas` y el fetch topa a 1000 → hay que PAGINAR,
      // si no, muchos IDADMON se quedan sin sus movimientos y su saldo sale 0 (bug de la v5/v6).
      const saldoCtasMap = {}
      {
        const PAGE = 1000
        let desde = 0
        for (;;) {
          const { data: ctas, error: ec } = await supabase
            .from('cuentas').select('idadmon, cargo, cargo_manual, abono, anulado')
            .in('idadmon', ids)
            .range(desde, desde + PAGE - 1)
          if (ec) { setError(ec.message); setCargando(false); return }
          for (const c of ctas || []) {
            if (c.anulado) continue
            const cargoEf = (c.cargo_manual != null && c.cargo_manual !== '') ? n0(c.cargo_manual) : n0(c.cargo)
            saldoCtasMap[c.idadmon] = (saldoCtasMap[c.idadmon] || 0) + cargoEf - n0(c.abono)
          }
          if (!ctas || ctas.length < PAGE) break
          desde += PAGE
        }
      }

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

      const construir = (g, pagoDeMas) => {
        const s = vig[g.idadmon] || { ggcc: 0, luz: 0, agua: 0, gas: 0, aamm: null }
        const servTotal = s.ggcc + s.luz + s.agua + s.gas
        return {
          idadmon: g.idadmon, propietario: g.propietario, inmueble: g.inmueble,
          falta: g.falta, base: g.base, recibido: g.recibido,
          saldoCuentas: saldoCtasMap[g.idadmon] || 0,
          ggcc: s.ggcc, luz: s.luz, agua: s.agua, gas: s.gas, servTotal, servAamm: s.aamm,
          cobraDueno: cobraMap[g.idadmon] === 'DUEÑO',   // paga directo al dueño (no lo controla FCR)
          pagoDeMas,
        }
      }
      const out = conFalta.map(g => construir(g, false))
        .sort((a, b) => (Number(a.cobraDueno) - Number(b.cobraDueno)) || (b.falta - a.falta))   // FCR primero (por deuda desc), dueño al final
      const outPago = conPago.map(g => construir(g, true)).sort((a, b) => a.falta - b.falta)     // mayor pago de más arriba

      setFilas(out)
      setFilasPago(outPago)

      // 3) Comentarios internos del mes (por idadmon)
      try {
        const rc = await fetch(`/api/faltan/comentario?mes=${m}`, { cache: 'no-store' })
        const jc = await rc.json()
        const map = {}
        for (const c of (jc.rows || [])) map[c.idadmon] = c
        setComentarios(map)
      } catch { setComentarios({}) }

      // 4) Chequeados del mes (por idadmon) — solo gestión, no toca datos
      try {
        const rk = await fetch(`/api/faltan/check?mes=${m}`, { cache: 'no-store' })
        const jk = await rk.json()
        const cm = {}
        for (const c of (jk.rows || [])) cm[c.idadmon] = true
        setChecks(cm)
      } catch { setChecks({}) }
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

  // Marcar/desmarcar "chequeado" (optimista + persistencia por idadmon+mes). No altera ningún dato de la liquidación.
  async function toggleCheck(idadmon) {
    if (!puedeComentar) return
    const nuevo = !checks[idadmon]
    setChecks(prev => { const n = { ...prev }; if (nuevo) n[idadmon] = true; else delete n[idadmon]; return n })
    try {
      const res = await fetch('/api/faltan/check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idadmon, mes, chequeado: nuevo }),
      })
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Error al guardar') }
    } catch (e) {
      setChecks(prev => { const n = { ...prev }; if (nuevo) delete n[idadmon]; else n[idadmon] = true; return n })
      alert(e.message)
    }
  }

  if (status === 'loading' || accesoOk === null) return (<><TopNav /><div style={{ padding: 40, color: '#888' }}>Cargando…</div></>)
  if (accesoOk === false) return null

  const filasFcr = filas.filter(f => !f.cobraDueno)
  const filasDueno = filas.filter(f => f.cobraDueno)
  const totFalta = filasFcr.reduce((s, f) => s + f.falta, 0)
  const totServ = filasFcr.reduce((s, f) => s + f.servTotal, 0)

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
  const GRID = '0.7fr 1.4fr 1.5fr 0.9fr 0.9fr 1fr 0.8fr 0.8fr 0.8fr 0.8fr 0.9fr 1.5fr 0.8fr'

  // Control de filtro Excel para una columna (mismo patrón que CC1). `movs` = todas las filas
  // enriquecidas, para que el desplegable liste todos los valores.
  const HF = (key) => (
    <HeaderFilter col={FALTAN_COLS.find(c => c.key === key)} movs={filasEnr}
      state={filters[key]} setState={v => setFiltroCol(key, v)}
      open={openFilter} setOpen={setOpenFilter} orden={orden} setOrden={setOrden}
      limpiarTodo={limpiarTodo} hayAlguno={hayAlguno} />
  )
  // Celda de cabecera: etiqueta + filtro (alineada izq. o der. según sea texto o número).
  const Hh = (label, key, right, bg) => (
    <div style={{ ...(right ? { ...th, textAlign: 'right' } : th), ...(bg ? { background: bg, borderRadius: 6, padding: '2px 6px' } : {}) }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, width: '100%', justifyContent: right ? 'flex-end' : 'flex-start' }}>
        <span>{label}</span>{HF(key)}
      </span>
    </div>
  )

  // Exporta a Excel EXACTAMENTE lo filtrado (`filtradas`) del mes en pantalla.
  async function exportarExcel() {
    const XLSX = await import('xlsx')
    const salida = filtradas.map(f => ({
      IDADMON: f.idadmon || '',
      Propietario: f.propietario || '',
      Inmueble: f.inmueble || '',
      'A cobrar': Math.round(n0(f.base)),
      'Falta mensual': Math.round(n0(f.falta)),
      Cartola: Math.round(n0(f.saldoCuentas)),
      GGCC: Math.round(n0(f.ggcc)),
      Luz: Math.round(n0(f.luz)),
      Agua: Math.round(n0(f.agua)),
      Gas: Math.round(n0(f.gas)),
      'Serv. total': Math.round(n0(f.servTotal)),
      'Cobra dueño': f.cobraDueno ? 'SÍ' : '',
      Comentario: f.comentario || '',
      Chequeado: f.chequeado || 'NO',
    }))
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(salida)
    XLSX.utils.book_append_sheet(wb, ws, 'FALTAN')
    const hoy = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `FALTAN_${mes}_${hoy}.xlsx`)
  }

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
          <button onClick={() => router.push('/procesos/liquidaciones/facturas')}
            style={{ fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: '1px solid #DDD6FE', background: '#F5F3FF', color: '#6D28D9', cursor: 'pointer' }}>
            🧾 FACTURAS
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
          {filasPago.length > 0 && (
            <button onClick={() => setVerPagoDeMas(v => !v)}
              style={{ fontSize: 12, fontWeight: 600, padding: '7px 12px', borderRadius: 7, border: '1px solid ' + (verPagoDeMas ? '#A7F3D0' : '#E5E7EB'), background: verPagoDeMas ? '#ECFDF5' : '#fff', color: verPagoDeMas ? '#065F46' : '#6B7280', cursor: 'pointer' }}>
              {verPagoDeMas ? '− Ocultar pagos de más' : '+ Ver pagos de más'} ({filasPago.length})
            </button>
          )}
          <div style={{ flex: 1 }} />
          {hayAlguno && (
            <button onClick={limpiarTodo}
              style={{ fontSize: 12, fontWeight: 600, padding: '7px 12px', borderRadius: 7, border: '1px solid #E5E7EB', background: '#FBF7EC', color: '#B8860B', cursor: 'pointer' }}>
              ✕ Limpiar filtros
            </button>
          )}
          <button onClick={exportarExcel}
            style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 7, border: 'none', background: '#1c7d3f', color: '#fff', cursor: 'pointer' }}>
            ⬇ Exportar Excel ({filtradas.length})
          </button>
        </div>

        {/* KPIs */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={metric}><div style={metricLbl}>En falta</div><div style={metricVal}>{filasFcr.length}{filasDueno.length > 0 && <span style={{ fontSize: 13, fontWeight: 600, color: '#9CA3AF' }}> (+{filasDueno.length} cobra dueño)</span>}</div></div>
          <div style={metric}><div style={metricLbl}>Falta de arriendo</div><div style={{ ...metricVal, color: '#dc2626' }}>{fmtPesos(totFalta)}</div></div>
          <div style={metric}><div style={metricLbl}>Deuda servicios (vigente)</div><div style={metricVal}>{fmtPesos(totServ)}</div></div>
        </div>

        {error && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', fontSize: 13, padding: '10px 14px', borderRadius: 8, marginBottom: 12 }}>Error: {error}</div>}

        {cargando ? <div style={{ color: '#888', padding: 20 }}>Calculando…</div> : (
          <div>
            {/* Fila de títulos: sticky top:52 (bajo el TopNav). Debe compartir
                contenedor con las filas de datos para que el sticky funcione. */}
            <div style={{ position: 'sticky', top: 52, zIndex: 5, display: 'grid', gridTemplateColumns: GRID, gap: 8, padding: '10px 16px', background: '#FAFAF8', border: '1px solid #E8E6E0', borderRadius: '12px 12px 0 0', overflow: 'visible' }}>
              {Hh('IDADMON', 'idadmon', false)}
              {Hh('Propietario', 'propietario', false)}
              {Hh('Inmueble', 'inmueble', false)}
              {Hh('A cobrar', 'base', true)}
              {Hh('Falta mensual', 'falta', true)}
              {Hh('Cartola', 'saldoCuentas', true, '#F6D9BC')}
              {Hh('GGCC', 'ggcc', true)}
              {Hh('Luz', 'luz', true)}
              {Hh('Agua', 'agua', true)}
              {Hh('Gas', 'gas', true)}
              {Hh('Serv. total', 'servTotal', true)}
              {Hh('Coment. interno', 'comentario', false)}
              {Hh('Chequeado', 'chequeado', false)}
            </div>

            <div style={{ background: '#fff', borderLeft: '1px solid #E8E6E0', borderRight: '1px solid #E8E6E0', borderBottom: '1px solid #E8E6E0', borderRadius: '0 0 12px 12px' }}>
              {filasEnr.length === 0 && <div style={{ padding: 20, color: '#888', fontSize: 13 }}>No hay morosos de arriendo en {aammToTxt(mes)}. 🎉</div>}
              {filasEnr.length > 0 && filtradas.length === 0 && <div style={{ padding: 20, color: '#888', fontSize: 13 }}>Sin resultados con los filtros aplicados.</div>}

              {filtradas.map((f, i) => (
                <div key={f.idadmon + (f.esProp ? '·prop' : '')} style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, padding: '9px 16px', borderTop: i ? '1px solid #F0EEE8' : 'none', alignItems: 'center', fontSize: 12.5, background: f.pagoDeMas ? '#F0FDF4' : (f.cobraDueno ? '#F9FAFB' : '#fff') }}>
                  <div style={{ fontWeight: 600, color: f.cobraDueno ? '#9CA3AF' : undefined, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span>{f.idadmon}</span>
                    {f.pagoDeMas && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 8, background: '#D1FAE5', color: '#065F46', whiteSpace: 'nowrap' }}>+pagó</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, color: f.cobraDueno ? '#9CA3AF' : undefined }} title={f.propietario || ''}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.propietario || '—'}</span>
                    {f.cobraDueno && <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: '#E5E7EB', color: '#6B7280' }}>cobra dueño</span>}
                  </div>
                  <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: f.cobraDueno ? '#9CA3AF' : '#666' }} title={f.inmueble || ''}>{f.inmueble || '—'}</div>
                  <div style={{ textAlign: 'right', color: f.cobraDueno ? '#9CA3AF' : undefined }}>{fmtPesos(f.base)}</div>
                  <div style={{ textAlign: 'right', fontWeight: 700, color: f.pagoDeMas ? '#047857' : (f.cobraDueno ? '#9CA3AF' : '#B91C1C') }}>{fmtPesos(f.falta)}</div>
                  <div style={{ textAlign: 'right', fontWeight: 600, background: '#FDF0E4', borderRadius: 6, padding: '3px 8px' }} title="Saldo global de la cartola (todo el histórico): + debe · − a favor">
                    <span style={{ ...NUM_FONT, color: f.saldoCuentas > 0 ? '#B91C1C' : (f.saldoCuentas < 0 ? '#047857' : '#9CA3AF') }}>{fmtPesos(f.saldoCuentas)}</span>
                  </div>
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
                  {/* Chequeado: tick de gestión (guardado por idadmon+mes; no toca datos) */}
                  <div style={{ textAlign: 'center' }}>
                    {puedeComentar ? (
                      <button onClick={() => toggleCheck(f.idadmon)} title={checks[f.idadmon] ? 'Chequeado — clic para desmarcar' : 'Marcar como chequeado'}
                        style={{ cursor: 'pointer', border: '1px solid ' + (checks[f.idadmon] ? '#16a34a' : '#D1D5DB'), background: checks[f.idadmon] ? '#16a34a' : '#fff', color: '#fff', width: 22, height: 22, borderRadius: 6, fontSize: 13, fontWeight: 800, lineHeight: 1, fontFamily: 'inherit', padding: 0 }}>
                        {checks[f.idadmon] ? '✓' : ''}
                      </button>
                    ) : (
                      <span style={{ color: checks[f.idadmon] ? '#16a34a' : '#C7C7C2', fontWeight: 800 }}>{checks[f.idadmon] ? '✓' : '—'}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
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
