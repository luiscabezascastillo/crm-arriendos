// VERSION: v11 · 2026-08-12 · APAGADO GLOBAL: interruptor AUTO_OFF=true apaga TODO el automático (términos del día,
//   reclamaciones/cobranzas y valoración legal) para TODAS las personas mientras se depura. Solo quedan las alertas
//   asignadas a mano. Poner AUTO_OFF=false para reactivar. Hereda v10.
// VERSION: v10 · 2026-08-12 · Alertas automáticas de TÉRMINOS y COBRANZAS APAGADAS para Adalis, Fabiola y Karina
//   (siguen recibiendo lo que se les asigne a mano). Dirección (Alberto/Luis) gana botón "➕ Asignar alerta" que crea
//   una alerta en `alertas` para la persona elegida (queda registrada). Aviso de "prioridad absoluta" + chip PRIORIDAD
//   en las alertas manuales. Hereda v9.
// VERSION: v9 · 2026-08-12 · Los dos botones de cada término se renombran a "Ver Término" (la hoja real,
//   /procesos/terminos?id=) y "Ver Reloj" (el workflow, /procesos/terminos/ID). Siempre salen los dos, en las
//   tres tarjetas (Términos del día, Notificación y Resultado). Hereda v8.
// VERSION: v8 · 2026-08-11 · Cada término ofrece DOS destinos: "Hoja →" (la hoja real, /procesos/terminos?id=)
//   y "Reloj" (el workflow, /procesos/terminos/ID). Así Karina llega a la hoja para ver el markup. Hereda v7.
// VERSION: v7 · 2026-08-11 · Normaliza el rol de la sesión (alias operaciones->administracion, etc.) para el
//   acceso por rol, igual que TopNav; así Adalis/Fabiola/Anthony entran aunque tengan un rol antiguo. Hereda v6.
// VERSION: v6 · 2026-08-11 · Legal en DOS vertientes: (1) valoración de la NOTIFICACIÓN del término
//   (estado Q, veredicto CUMPLE/NO CUMPLE) y (2) valoración del RESULTADO (tras Q-Auditado). Hereda v5.
// VERSION: v5 · 2026-08-11 · Alertas por ROL. Se abre la pantalla a Administración (Adalis/Fabiola) y Legal
//   (Anthony), cada uno ve SU tarjeta: Administración -> "Reclamaciones del día" (top 5 más graves por
//   monto+tiempo+servicios, estado COMPARTIDO por idadmon); Legal -> "Valoración legal" (escribe y guarda
//   en el CRM). "Términos del día" sigue SOLO para Karina + Dirección (por email). Hereda v4.
// VERSION: v4 · 2026-08-11 · Términos del día SOLO para Karina + Dirección (mismo público de siempre); NO se
//   abre al resto del equipo (tendrán sus propias alertas más adelante). Hereda v3.
// VERSION: v3 · 2026-08-11 · Tarjeta "Términos del día" (3 sin tratar: antiguo/medio/reciente) que se
//   mantiene hasta marcarlos tratados. Indicador en ROJO parpadeante cuando hay pendientes. Hereda v2.
// VERSION: v2 · 2026-08-03 · Alertas de "Facturar inicio de contrato" (origen=factura_inicio): botón
//   "Facturar corretaje" que abre un panel de confirmación (preview) para crear el descuento de corretaje
//   al propietario, chequear/crear el cargo del arrendatario en cartola y generar el CSV SimpleFactura,
//   y luego resolver la alerta. El resto de alertas siguen igual (Posponer / Resolver).
// VERSION: v1 · 2026-07-28 · Pantalla propia de Alertas (/alertas) para Karina, Alberto y Luis.
'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'
import TopNav from '../components/ui/TopNav'

// Términos del día: SOLO estos (Karina + Dirección), como pidió Dirección.
const ALERTAS_EMAILS = [
  'karina.morales@fondocapital.com',
  'alberto.cabezas@fondocapital.com',
  'luis.cabezas@fondocapital.com',
]
// Reclamaciones (Administración) y Valoración legal (Legal): por ROL de la sesión.
const ROLES_ADMIN = ['administracion', 'direccion']
const ROLES_LEGAL = ['legal', 'direccion']
// Alias de roles antiguos -> nuevos (igual que TopNav), para no depender de cómo esté en la BD.
const ROL_ALIAS = { admin: 'direccion', operaciones: 'administracion', tecnico: 'mantencion' }
const normRol = (r) => ROL_ALIAS[String(r || '').toLowerCase()] || String(r || '').toLowerCase()

// Dirección puede ASIGNAR alertas a mano (como cometidos de Mis tareas).
const EMAILS_DIR = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com']
// A estos se les APAGA lo automático de términos y cobranzas (siguen recibiendo las asignadas a mano).
const INHIBIR_AUTO = ['adalis@fondocapital.com', 'fabiola.guerra@fondocapital.com', 'karina.morales@fondocapital.com']
// INTERRUPTOR GLOBAL: mientras se depura el sistema, TODO el automático (términos del día, reclamaciones/cobranzas
// y valoración legal) está APAGADO para TODAS las personas. Las alertas solo llegan asignadas a mano. Poner en
// false para reactivarlo cuando esté afinado.
const AUTO_OFF = true
// Destinatarios a los que Dirección puede asignar una alerta.
const PERSONAS = [
  { email: 'adalis@fondocapital.com', nombre: 'Adalis' },
  { email: 'fabiola.guerra@fondocapital.com', nombre: 'Fabiola Guerra' },
  { email: 'karina.morales@fondocapital.com', nombre: 'Karina Morales' },
  { email: 'anthony.mendoza@fondocapital.com', nombre: 'Anthony Mendoza' },
  { email: 'alberto.cabezas@fondocapital.com', nombre: 'Alberto Cabezas' },
  { email: 'luis.cabezas@fondocapital.com', nombre: 'Luis Cabezas' },
]

const fmtFecha = (d) => {
  if (!d) return ''
  const x = new Date(d)
  if (isNaN(x)) return ''
  return `${String(x.getDate()).padStart(2, '0')}-${String(x.getMonth() + 1).padStart(2, '0')}-${x.getFullYear()}`
}
const hoyISO = () => new Date().toISOString().slice(0, 10)
const fmtPesos = (n) => '$' + Number(n || 0).toLocaleString('es-CL')

export default function AlertasPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const email = session?.user?.email || ''
  const role = normRol(session?.user?.role)
  const esKarinaDir = ALERTAS_EMAILS.includes(email)
  const esAdmin = ROLES_ADMIN.includes(role)
  const esLegal = ROLES_LEGAL.includes(role)
  const esDireccion = role === 'direccion' || EMAILS_DIR.includes(email)
  const autoInhibido = INHIBIR_AUTO.includes(email)   // términos/cobranzas automáticos apagados
  const puede = esKarinaDir || esAdmin || esLegal

  const [alertas, setAlertas] = useState([])
  const [terDia, setTerDia] = useState(null)
  const [recDia, setRecDia] = useState(null)      // Reclamaciones del día (Admin)
  const [valList, setValList] = useState(null)    // Legal: { notificacion:[], resultado:[] }
  const [notifTxt, setNotifTxt] = useState({})    // vertiente 1: { idadmon: texto }
  const [notifCumple, setNotifCumple] = useState({}) // vertiente 1: { idadmon: 'CUMPLE'|'NO CUMPLE' }
  const [valTxt, setValTxt] = useState({})        // vertiente 2: { idadmon: texto }
  const [valBusy, setValBusy] = useState('')
  const [cargando, setCargando] = useState(true)
  const [verResueltas, setVerResueltas] = useState(false)
  const [posponiendo, setPosponiendo] = useState(null)
  const [posFecha, setPosFecha] = useState('')
  const [posMotivo, setPosMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)

  // --- Corretaje ---
  const [corr, setCorr] = useState(null)         // alerta seleccionada para corretaje
  const [corrData, setCorrData] = useState(null) // preview
  const [corrLoad, setCorrLoad] = useState(false)
  const [corrEjec, setCorrEjec] = useState(false)
  const [crearCargoArr, setCrearCargoArr] = useState(false)
  const [tipoArr, setTipoArr] = useState('39')
  const [corrResultado, setCorrResultado] = useState(null)

  // --- Asignar alerta (Dirección) ---
  const [asignar, setAsignar] = useState(false)
  const [asigForm, setAsigForm] = useState({ para: '', tema: '', cuerpo: '', fecha_resolver: '' })
  const [asigBusy, setAsigBusy] = useState(false)

  useEffect(() => {
    if (status === 'loading') return
    if (!session) { router.replace('/panel'); return }
    if (!puede) { router.replace('/procesos/mi-portal'); return }
    cargar()
    if (esKarinaDir && !autoInhibido && !AUTO_OFF) cargarTerDia()   // términos automáticos
    if (esAdmin && !autoInhibido && !AUTO_OFF) cargarRecDia()        // cobranzas automáticas
    if (esLegal && !AUTO_OFF) cargarValList()                        // valoración legal (también en pausa)
    // eslint-disable-next-line
  }, [status, session])

  const cargar = async () => {
    setCargando(true)
    const { data } = await supabase.from('alertas').select('*')
      .eq('para_email', email)
      .order('fecha_resolver', { ascending: true, nullsFirst: false })
      .order('fecha', { ascending: true })
    setAlertas(data || [])
    setCargando(false)
  }

  const cargarTerDia = async () => {
    try {
      const r = await fetch('/api/alertas/terminos-del-dia', { cache: 'no-store' })
      const j = await r.json()
      setTerDia(j && j.ok ? j : { terminos: [], total_pendientes: 0 })
    } catch { setTerDia({ terminos: [], total_pendientes: 0 }) }
  }
  const marcarTratado = async (idadmon) => {
    await fetch('/api/alertas/terminos-del-dia', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idadmon }),
    })
    cargarTerDia()
  }

  // --- Reclamaciones del día (Administración) ---
  const cargarRecDia = async () => {
    try {
      const r = await fetch('/api/alertas/reclamaciones', { cache: 'no-store' })
      const j = await r.json()
      setRecDia(j && j.ok ? j : { reclamaciones: [], total: 0 })
    } catch { setRecDia({ reclamaciones: [], total: 0 }) }
  }
  const marcarReclamacionTratada = async (idadmon) => {
    await fetch('/api/alertas/reclamaciones', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idadmon }),
    })
    cargarRecDia()
  }

  // --- Valoración legal (Legal / Anthony) ---
  const cargarValList = async () => {
    try {
      const r = await fetch('/api/alertas/valoracion-legal', { cache: 'no-store' })
      const j = await r.json()
      setValList(j && j.ok ? j : { terminos: [], total: 0 })
    } catch { setValList({ terminos: [], total: 0 }) }
  }
  // Vertiente 1: notificación del término (CUMPLE / NO CUMPLE)
  const guardarNotificacion = async (idadmon) => {
    const valoracion = (notifTxt[idadmon] || '').trim()
    const cumple = notifCumple[idadmon] || ''
    if (!valoracion || !cumple || valBusy) return
    setValBusy('n:' + idadmon)
    try {
      const r = await fetch('/api/alertas/valoracion-legal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'notificacion', idadmon, cumple, valoracion }),
      })
      const j = await r.json()
      if (j.ok) {
        setNotifTxt(s => ({ ...s, [idadmon]: '' })); setNotifCumple(s => ({ ...s, [idadmon]: '' })); cargarValList()
      } else alert(j.error || 'No se pudo guardar')
    } catch (e) { alert(String(e)) }
    setValBusy('')
  }
  // Vertiente 2: valoración del resultado (tras Q-Auditado)
  const guardarValoracion = async (idadmon) => {
    const valoracion = (valTxt[idadmon] || '').trim()
    if (!valoracion || valBusy) return
    setValBusy('r:' + idadmon)
    try {
      const r = await fetch('/api/alertas/valoracion-legal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'resultado', idadmon, valoracion }),
      })
      const j = await r.json()
      if (j.ok) { setValTxt(s => ({ ...s, [idadmon]: '' })); cargarValList() }
      else alert(j.error || 'No se pudo guardar')
    } catch (e) { alert(String(e)) }
    setValBusy('')
  }

  const abrirPosponer = (a) => {
    setPosponiendo(a)
    setPosFecha(a.fecha_pospuesta || a.fecha_resolver || '')
    setPosMotivo(a.motivo_pospuesta || '')
  }
  const guardarPosponer = async () => {
    if (!posponiendo || !posFecha || guardando) return
    setGuardando(true)
    const { error } = await supabase.from('alertas')
      .update({ estado: 'pospuesta', fecha_pospuesta: posFecha, motivo_pospuesta: posMotivo || null })
      .eq('id', posponiendo.id)
    setGuardando(false)
    if (!error) { setPosponiendo(null); cargar() }
  }
  const resolver = async (a) => {
    const { error } = await supabase.from('alertas')
      .update({ estado: 'resuelta', resuelta_at: new Date().toISOString(), resuelta_por: email })
      .eq('id', a.id)
    if (!error) cargar()
  }
  const reabrir = async (a) => {
    const { error } = await supabase.from('alertas')
      .update({ estado: 'pendiente', resuelta_at: null, resuelta_por: null })
      .eq('id', a.id)
    if (!error) cargar()
  }

  // Dirección asigna una alerta a una persona (se guarda en `alertas` con su para_email).
  const abrirAsignar = () => { setAsigForm({ para: '', tema: '', cuerpo: '', fecha_resolver: '' }); setAsignar(true) }
  const guardarAsignar = async () => {
    const para = asigForm.para, tema = (asigForm.tema || '').trim()
    if (!para || !tema || asigBusy) return
    setAsigBusy(true)
    const quien = (PERSONAS.find(p => p.email === email)?.nombre) || email
    const detalle = (asigForm.cuerpo || '').trim()
    const cuerpo = (detalle ? detalle + ' · ' : '') + 'Asignada por ' + quien + ' el ' + fmtFecha(hoyISO())
    const { error } = await supabase.from('alertas').insert({
      para_email: para, tema, cuerpo,
      fecha: hoyISO(), fecha_resolver: asigForm.fecha_resolver || null,
      estado: 'pendiente', origen: 'manual',
    })
    setAsigBusy(false)
    if (error) { alert(error.message || 'No se pudo crear la alerta'); return }
    setAsignar(false)
    cargar()   // si te la asignas a ti, aparece; si es para otra persona, va a su buzón de Alertas
  }

  // --- Corretaje: abrir panel + cargar preview ---
  const esFacturaInicio = (a) => String(a.origen || '') === 'factura_inicio'
  const abrirCorretaje = async (a) => {
    setCorr(a); setCorrData(null); setCorrResultado(null); setCrearCargoArr(false); setCorrLoad(true)
    try {
      const r = await fetch(`/api/alertas/corretaje-preview?idadmon=${encodeURIComponent(a.ref_idadmon || '')}`, { cache: 'no-store' })
      const j = await r.json()
      if (j.ok) {
        setCorrData(j)
        setTipoArr(j.arrendatario?.tipo_factura_sugerido || '39')
        // sugerir crear cargo si el arrendatario aplica y NO existe en cartola
        setCrearCargoArr(!!j.arrendatario?.aplica && !j.cargoArrendatario?.existe)
      } else {
        setCorrData({ error: j.error || 'Error al cargar' })
      }
    } catch (e) {
      setCorrData({ error: String(e) })
    }
    setCorrLoad(false)
  }
  const cerrarCorretaje = () => { setCorr(null); setCorrData(null); setCorrResultado(null) }

  const descargarCSV = (contenido, nombre) => {
    if (!contenido) return
    const blob = new Blob(['\ufeff' + contenido], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = nombre; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const ejecutarCorretaje = async () => {
    if (!corr || !corrData || corrData.error || corrEjec) return
    setCorrEjec(true)
    try {
      const r = await fetch('/api/alertas/corretaje-ejecutar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idadmon: corrData.idadmon,
          alerta_id: corr.id,
          crear_cargo_arrendatario: crearCargoArr,
          tipo_arrendatario: tipoArr,
        }),
      })
      const j = await r.json()
      setCorrResultado(j)
      if (j.ok) {
        const mes = new Date().toISOString().slice(0, 7).replace('-', '')
        if (j.csv?.facturas_csv) descargarCSV(j.csv.facturas_csv, `corretaje_facturas_33_${corrData.idadmon}.csv`)
        if (j.csv?.boletas_csv) setTimeout(() => descargarCSV(j.csv.boletas_csv, `corretaje_boletas_39_${corrData.idadmon}.csv`), 700)
        cargar()  // la alerta ya está resuelta
      }
    } catch (e) {
      setCorrResultado({ error: String(e) })
    }
    setCorrEjec(false)
  }

  const visibles = alertas.filter(a => verResueltas ? true : a.estado !== 'resuelta')
  const nPend = alertas.filter(a => a.estado === 'pendiente').length
  const nPosp = alertas.filter(a => a.estado === 'pospuesta').length
  const color = nPend > 0 ? '#DC2626' : nPosp > 0 ? '#D97706' : '#16A34A'

  const th = { textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.03em', borderBottom: '1px solid #E5E3DC' }
  const td = { padding: '10px 12px', fontSize: 13, color: '#333', borderBottom: '1px solid #F0EEE8', verticalAlign: 'top' }

  return (
    <>
      <TopNav />
      <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>

        <style>{`@keyframes fcrBlink { 0%,49%{opacity:1} 50%,100%{opacity:0.15} }`}</style>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <span style={{ width: 16, height: 16, borderRadius: '50%', background: color, display: 'inline-block',
            animation: nPend > 0 ? 'fcrBlink 0.9s steps(1,end) infinite' : 'none',
            boxShadow: nPend > 0 ? '0 0 0 4px rgba(220,38,38,0.15)' : 'none' }} />
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: nPend > 0 ? '#DC2626' : '#2C2C2A' }}>Alertas</h1>
        </div>
        <div style={{ fontSize: 13, color: nPend > 0 ? '#DC2626' : '#999', fontWeight: nPend > 0 ? 600 : 400, marginBottom: 20 }}>
          {nPend} sin gestionar · {nPosp} pospuesta(s). Tareas urgentes generadas por el sistema y fechas clave a atender.
        </div>

        {(AUTO_OFF || autoInhibido) && (
          <div style={{ border: '1px solid #FBBF77', background: '#FFF7ED', borderRadius: 12, padding: '12px 16px', marginBottom: 18, fontSize: 13, color: '#7C2D12', lineHeight: 1.5 }}>
            <b>Alertas automáticas en pausa.</b> Mientras depuramos el sistema, las de términos y cobranzas no salen solas (eran demasiadas y con datos inconsistentes). Las que veáis aquí las asigna Dirección, o las levanta Karina por su impacto económico: son de <b>PRIORIDAD ABSOLUTA</b>.
          </div>
        )}

        {!AUTO_OFF && !autoInhibido && terDia && terDia.terminos && terDia.terminos.length > 0 && (
          <div style={{ border: '1px solid #F0C0A8', background: '#FEF6F2', borderRadius: 12, padding: 16, marginBottom: 18 }}>
            <div style={{ fontWeight: 700, color: '#9B1C1C', marginBottom: 2 }}>Términos del día — a analizar</div>
            <div style={{ fontSize: 12, color: '#9B1C1C', opacity: 0.8, marginBottom: 10 }}>
              {terDia.total_pendientes} términos pendientes de revisión en total. Karina analiza estos 3 (se mantienen hasta marcarlos tratados).
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {terDia.terminos.map(t => (
                <div key={t.idadmon} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13, background: '#fff', border: '1px solid #F0DCD2', borderRadius: 8, padding: '8px 10px' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#FBEDEC', border: '1px solid #E5C0B0', color: '#9B1C1C', whiteSpace: 'nowrap' }}>{t.tramo}</span>
                  <b>{t.idadmon}</b>
                  <span style={{ color: '#666' }}>{t.propietario || '—'}{t.inmueble ? ' · ' + t.inmueble : ''}</span>
                  <span style={{ color: '#999' }}>{fmtFecha(t.termino_actual)}</span>
                  {t.resultado != null && Number(t.resultado) < 0 && (
                    <span style={{ color: '#9B1C1C', fontWeight: 600 }}>déficit {fmtPesos(Math.abs(t.resultado))}</span>
                  )}
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    <a href={'/procesos/terminos?id=' + t.idadmon} style={{ fontSize: 12, color: '#0C447C', textDecoration: 'none', padding: '4px 10px', border: '1px solid #C7D6E6', borderRadius: 6 }}>Ver Término</a>
                    <a href={'/procesos/terminos/' + t.idadmon} style={{ fontSize: 12, color: '#6B7280', textDecoration: 'none', padding: '4px 10px', border: '1px solid #D8DCE2', borderRadius: 6 }}>Ver Reloj</a>
                    <button onClick={() => marcarTratado(t.idadmon)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Marcar tratado</button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RECLAMACIONES DEL DÍA — Administración (Adalis y Fabiola) */}
        {esAdmin && !AUTO_OFF && !autoInhibido && recDia && recDia.reclamaciones && recDia.reclamaciones.length > 0 && (
          <div style={{ border: '1px solid #E5B9A0', background: '#FDF4EF', borderRadius: 12, padding: 16, marginBottom: 18 }}>
            <div style={{ fontWeight: 700, color: '#9A3412', marginBottom: 2 }}>Reclamaciones del día — las {recDia.reclamaciones.length} más graves</div>
            <div style={{ fontSize: 12, color: '#9A3412', opacity: 0.85, marginBottom: 10 }}>
              {recDia.total} casos con deuda en total. Estas son las prioritarias por importe y tiempo (incluye deudas sostenidas de GGCC/luz/agua/gas). Al tratarlas aquí, quedan tratadas también para tu compañera.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recDia.reclamaciones.map(r => (
                <div key={r.idadmon} style={{ background: '#fff', border: '1px solid #EAD3C6', borderRadius: 8, padding: '10px 12px', fontSize: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#FBEDE6', border: '1px solid #E0B9A5', color: '#9A3412', whiteSpace: 'nowrap' }}>{r.motivo}</span>
                    <b>{r.idadmon}</b>
                    <span style={{ color: '#666' }}>{r.propietario || '—'}{r.propiedad ? ' · ' + r.propiedad : ''}</span>
                    <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                      <a href="/op/cobranza" style={{ fontSize: 12, color: '#0C447C', textDecoration: 'none', padding: '4px 10px', border: '1px solid #C7D6E6', borderRadius: 6 }}>Gestionar en Cobranza →</a>
                      <button onClick={() => marcarReclamacionTratada(r.idadmon)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Marcar tratado</button>
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 6, color: '#444' }}>
                    <span>Arrendatario: <b>{r.arrendatario || '—'}</b>{r.arrendatario_rut ? ' · ' + r.arrendatario_rut : ''}</span>
                    <span>Aval: <b>{r.aval || '—'}</b>{r.aval_rut ? ' · ' + r.aval_rut : ''}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 4 }}>
                    {r.monto_arriendo > 0 && <span style={{ color: '#9B1C1C', fontWeight: 600 }}>Arriendo {fmtPesos(r.monto_arriendo)} · {r.dias_mora} d mora</span>}
                    {r.deuda_servicios > 0 && (
                      <span style={{ color: '#92400E' }}>Servicios {fmtPesos(r.deuda_servicios)} ({r.meses_servicio} mes(es)){r.servicios_detalle ? ` · GGCC ${fmtPesos(r.servicios_detalle.ggcc)} · Luz ${fmtPesos(r.servicios_detalle.luz)} · Agua ${fmtPesos(r.servicios_detalle.agua)} · Gas ${fmtPesos(r.servicios_detalle.gas)}` : ''}</span>
                    )}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, color: '#0a5c3b', background: '#EAF7F0', borderRadius: 6, padding: '5px 8px' }}>
                    Siguiente paso: <b>{r.siguiente}</b>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VALORACIÓN LEGAL — Legal (Anthony): 2 vertientes */}
        {esLegal && !AUTO_OFF && valList && (valList.total > 0) && (
          <div style={{ border: '1px solid #B9C7E5', background: '#F1F5FD', borderRadius: 12, padding: 16, marginBottom: 18 }}>
            <div style={{ fontWeight: 700, color: '#1E3A8A', marginBottom: 8 }}>Valoración legal</div>

            {/* VERTIENTE 1: notificación del término (prioridad) */}
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1E3A8A', marginBottom: 2 }}>1 · Notificación del término {valList.total_notificacion ? `(${valList.total_notificacion})` : ''}</div>
            <div style={{ fontSize: 12, color: '#1E3A8A', opacity: 0.85, marginBottom: 10 }}>
              Valora la notificación de término: cuándo se hizo, cómo se hizo y si cumple el contrato. Cierra con un veredicto CUMPLE / NO CUMPLE (tiene repercusiones legales).
            </div>
            {(!valList.notificacion || valList.notificacion.length === 0) ? (
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>No hay notificaciones pendientes de valorar.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                {valList.notificacion.slice(0, 8).map(t => {
                  const cumpleSel = notifCumple[t.idadmon] || ''
                  const txt = (notifTxt[t.idadmon] || '').trim()
                  const listo = !!cumpleSel && !!txt
                  return (
                    <div key={t.idadmon} style={{ background: '#fff', border: '1px solid #D2DCF0', borderRadius: 8, padding: '10px 12px', fontSize: 13 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <b>{t.idadmon}</b>
                        <span style={{ color: '#666' }}>{t.propietario || '—'}{t.inmueble ? ' · ' + t.inmueble : ''}</span>
                        <span style={{ color: '#999' }}>Entrega: {fmtFecha(t.termino_actual)}</span>
                        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                      <a href={'/procesos/terminos?id=' + t.idadmon} style={{ fontSize: 12, color: '#0C447C', textDecoration: 'none', padding: '4px 10px', border: '1px solid #C7D6E6', borderRadius: 6 }}>Ver Término</a>
                      <a href={'/procesos/terminos/' + t.idadmon} style={{ fontSize: 12, color: '#6B7280', textDecoration: 'none', padding: '4px 10px', border: '1px solid #D8DCE2', borderRadius: 6 }}>Ver Reloj</a>
                    </span>
                      </div>
                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 4, color: '#444' }}>
                        <span>Arrendatario: <b>{t.arrendatario || '—'}</b>{t.arrendatario_rut ? ' · ' + t.arrendatario_rut : ''}</span>
                        <span>Aval: <b>{t.avalista || '—'}</b></span>
                      </div>
                      <textarea value={notifTxt[t.idadmon] || ''} onChange={e => setNotifTxt(s => ({ ...s, [t.idadmon]: e.target.value }))}
                        rows={2} placeholder="Cuándo se notificó, cómo (canal/forma), si respeta el plazo y la forma del contrato…"
                        style={{ width: '100%', fontSize: 13, padding: '8px 10px', borderRadius: 8, border: '1px solid #D3D1C7', fontFamily: 'inherit', boxSizing: 'border-box', marginTop: 8, resize: 'vertical' }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, color: '#666' }}>Veredicto:</span>
                        <button onClick={() => setNotifCumple(s => ({ ...s, [t.idadmon]: 'CUMPLE' }))}
                          style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, border: '1px solid ' + (cumpleSel === 'CUMPLE' ? '#16a34a' : '#CBD5E1'), background: cumpleSel === 'CUMPLE' ? '#16a34a' : '#fff', color: cumpleSel === 'CUMPLE' ? '#fff' : '#16a34a' }}>CUMPLE</button>
                        <button onClick={() => setNotifCumple(s => ({ ...s, [t.idadmon]: 'NO CUMPLE' }))}
                          style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, border: '1px solid ' + (cumpleSel === 'NO CUMPLE' ? '#DC2626' : '#CBD5E1'), background: cumpleSel === 'NO CUMPLE' ? '#DC2626' : '#fff', color: cumpleSel === 'NO CUMPLE' ? '#fff' : '#DC2626' }}>NO CUMPLE</button>
                        <button onClick={() => guardarNotificacion(t.idadmon)} disabled={!listo || valBusy === ('n:' + t.idadmon)}
                          style={{ marginLeft: 'auto', fontSize: 12, padding: '5px 14px', borderRadius: 6, border: 'none', background: listo ? '#1E3A8A' : '#C9C7BF', color: '#fff', fontWeight: 600, cursor: listo ? 'pointer' : 'default', fontFamily: 'inherit' }}>
                          {valBusy === ('n:' + t.idadmon) ? 'Guardando…' : 'Guardar valoración'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* VERTIENTE 2: resultado (tras Q-Auditado) */}
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1E3A8A', marginTop: 6, marginBottom: 2 }}>2 · Resultado del término {valList.total_resultado ? `(${valList.total_resultado})` : ''}</div>
            <div style={{ fontSize: 12, color: '#1E3A8A', opacity: 0.85, marginBottom: 10 }}>
              Aparece cuando Karina ya auditó el término (estado Q-Auditado). Aquí valoras el resultado: solidaridad del aval y si es reclamable, vía DICOM/judicial, plazos y riesgos.
            </div>
            {(!valList.resultado || valList.resultado.length === 0) ? (
              <div style={{ fontSize: 12, color: '#6B7280' }}>Nada pendiente aquí todavía (llega tras la auditoría de Karina).</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {valList.resultado.slice(0, 8).map(t => (
                  <div key={t.idadmon} style={{ background: '#fff', border: '1px solid #D2DCF0', borderRadius: 8, padding: '10px 12px', fontSize: 13 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <b>{t.idadmon}</b>
                      <span style={{ color: '#666' }}>{t.propietario || '—'}{t.inmueble ? ' · ' + t.inmueble : ''}</span>
                      {t.resultado != null && Number(t.resultado) < 0 && (
                        <span style={{ color: '#9B1C1C', fontWeight: 600 }}>déficit {fmtPesos(Math.abs(t.resultado))}{t.quien ? ' · ' + t.quien : ''}</span>
                      )}
                      <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                      <a href={'/procesos/terminos?id=' + t.idadmon} style={{ fontSize: 12, color: '#0C447C', textDecoration: 'none', padding: '4px 10px', border: '1px solid #C7D6E6', borderRadius: 6 }}>Ver Término</a>
                      <a href={'/procesos/terminos/' + t.idadmon} style={{ fontSize: 12, color: '#6B7280', textDecoration: 'none', padding: '4px 10px', border: '1px solid #D8DCE2', borderRadius: 6 }}>Ver Reloj</a>
                    </span>
                    </div>
                    <textarea value={valTxt[t.idadmon] || ''} onChange={e => setValTxt(s => ({ ...s, [t.idadmon]: e.target.value }))}
                      rows={2} placeholder="Valoración legal del resultado…"
                      style={{ width: '100%', fontSize: 13, padding: '8px 10px', borderRadius: 8, border: '1px solid #D3D1C7', fontFamily: 'inherit', boxSizing: 'border-box', marginTop: 8, resize: 'vertical' }} />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                      <button onClick={() => guardarValoracion(t.idadmon)} disabled={valBusy === ('r:' + t.idadmon) || !(valTxt[t.idadmon] || '').trim()}
                        style={{ fontSize: 12, padding: '5px 14px', borderRadius: 6, border: 'none', background: (valTxt[t.idadmon] || '').trim() ? '#1E3A8A' : '#C9C7BF', color: '#fff', fontWeight: 600, cursor: (valTxt[t.idadmon] || '').trim() ? 'pointer' : 'default', fontFamily: 'inherit' }}>
                        {valBusy === ('r:' + t.idadmon) ? 'Guardando…' : 'Guardar valoración'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div>
            {esDireccion && (
              <button onClick={abrirAsignar}
                style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#0C447C', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                ➕ Asignar alerta
              </button>
            )}
          </div>
          <button onClick={() => setVerResueltas(v => !v)}
            style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #D3D1C7', background: verResueltas ? '#EEF3F8' : '#fff', color: '#666', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            {verResueltas ? 'Ocultar resueltas' : 'Ver resueltas'}
          </button>
        </div>

        {cargando ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Cargando…</div>
        ) : visibles.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#888', fontSize: 14, background: '#FAFAF7', borderRadius: 12 }}>
            No hay alertas{verResueltas ? '' : ' pendientes'}. Todo al día 🎉
          </div>
        ) : (
          <div style={{ border: '1px solid #E5E3DC', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: '#FAFAF7' }}>
                <th style={th}>Tema</th>
                <th style={th}>Fecha</th>
                <th style={th}>A resolver</th>
                <th style={th}>Motivo aplazamiento</th>
                <th style={th}>Estado</th>
                <th style={th}></th>
              </tr></thead>
              <tbody>
                {visibles.map(a => {
                  const resuelta = a.estado === 'resuelta'
                  const pospuesta = a.estado === 'pospuesta'
                  const objetivo = a.fecha_pospuesta || a.fecha_resolver
                  const vencida = objetivo && !resuelta && objetivo < hoyISO()
                  const facturaInicio = esFacturaInicio(a)
                  return (
                    <tr key={a.id} style={{ opacity: resuelta ? 0.55 : 1 }}>
                      <td style={td}>
                        <div style={{ fontWeight: 500, color: '#2C2C2A' }}>{a.tema}{a.origen === 'manual' && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 6, background: '#FEE2E2', color: '#B91C1C', border: '1px solid #FCA5A5', verticalAlign: 'middle' }}>PRIORIDAD</span>}</div>
                        {a.ref_idadmon && <div style={{ fontSize: 11, color: '#aaa' }}>{a.ref_idadmon}{a.origen ? ' · ' + a.origen : ''}</div>}
                        {a.cuerpo && <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{a.cuerpo}</div>}
                      </td>
                      <td style={td}>{fmtFecha(a.fecha)}</td>
                      <td style={{ ...td, color: vencida ? '#B23A3A' : '#444', fontWeight: vencida ? 700 : 400 }}>
                        {fmtFecha(objetivo) || '—'}{pospuesta && <span style={{ fontSize: 10, color: '#0C447C', marginLeft: 4 }}>(pospuesta)</span>}
                      </td>
                      <td style={{ ...td, fontSize: 12, color: '#666' }}>{a.motivo_pospuesta || '—'}</td>
                      <td style={td}>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                          background: resuelta ? '#E1F5EE' : pospuesta ? '#EEF3F8' : '#FEF3E2',
                          color: resuelta ? '#085041' : pospuesta ? '#0C447C' : '#92400E' }}>
                          {resuelta ? 'Resuelta' : pospuesta ? 'Pospuesta' : 'Pendiente'}
                        </span>
                      </td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>
                        {resuelta ? (
                          <button onClick={() => reabrir(a)} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #D3D1C7', background: '#fff', color: '#666', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Reabrir</button>
                        ) : (
                          <span style={{ display: 'flex', gap: 6 }}>
                            {facturaInicio && (
                              <button onClick={() => abrirCorretaje(a)} title="Crear el descuento de corretaje, revisar el cargo del arrendatario y generar la facturación"
                                style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: '#6D28D9', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Facturar corretaje</button>
                            )}
                            <button onClick={() => abrirPosponer(a)} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #D3D1C7', background: '#fff', color: '#0C447C', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Posponer</button>
                            <button onClick={() => resolver(a)} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: '#16a34a', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Resolver</button>
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal posponer */}
      {posponiendo && (
        <div onClick={() => setPosponiendo(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 12, padding: 24, width: 'min(480px, 100%)', boxShadow: '0 10px 40px rgba(0,0,0,0.25)' }}>
            <div style={{ fontSize: 12, color: '#aaa', marginBottom: 4 }}>Posponer alerta</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: '#2C2C2A' }}>{posponiendo.tema}</div>
            <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Nueva fecha para resolverla</label>
            <input type="date" value={posFecha} onChange={e => setPosFecha(e.target.value)}
              style={{ width: '100%', fontSize: 13, padding: '8px 10px', borderRadius: 8, border: '1px solid #D3D1C7', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 14 }} />
            <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Motivo del aplazamiento</label>
            <textarea value={posMotivo} onChange={e => setPosMotivo(e.target.value)} rows={3}
              placeholder="Ej.: se retrasa la factura al mes siguiente para posponer el IVA"
              style={{ width: '100%', fontSize: 13, padding: '8px 10px', borderRadius: 8, border: '1px solid #D3D1C7', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 18, resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setPosponiendo(null)}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #D3D1C7', background: '#fff', color: '#666', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
              <button onClick={guardarPosponer} disabled={!posFecha || guardando}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: posFecha ? '#0C447C' : '#C9C7BF', color: '#fff', fontSize: 13, fontWeight: 600, cursor: posFecha ? 'pointer' : 'default', fontFamily: 'inherit' }}>
                {guardando ? 'Guardando…' : 'Posponer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal ASIGNAR alerta (Dirección) */}
      {asignar && (
        <div onClick={() => setAsignar(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 105, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 12, padding: 24, width: 'min(520px, 100%)', boxShadow: '0 10px 40px rgba(0,0,0,0.25)' }}>
            <div style={{ fontSize: 12, color: '#0C447C', fontWeight: 700, marginBottom: 2 }}>ASIGNAR ALERTA</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, color: '#2C2C2A' }}>Nueva alerta para una persona</div>

            <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Destinatario</label>
            <select value={asigForm.para} onChange={e => setAsigForm(f => ({ ...f, para: e.target.value }))}
              style={{ width: '100%', fontSize: 13, padding: '8px 10px', borderRadius: 8, border: '1px solid #D3D1C7', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 12, background: '#fff' }}>
              <option value="">— elige a quién —</option>
              {PERSONAS.map(p => <option key={p.email} value={p.email}>{p.nombre}</option>)}
            </select>

            <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Título / tema</label>
            <input value={asigForm.tema} onChange={e => setAsigForm(f => ({ ...f, tema: e.target.value }))}
              placeholder="Ej.: Revisar cobro urgente A00xxx"
              style={{ width: '100%', fontSize: 13, padding: '8px 10px', borderRadius: 8, border: '1px solid #D3D1C7', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 12 }} />

            <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Detalle (opcional)</label>
            <textarea value={asigForm.cuerpo} onChange={e => setAsigForm(f => ({ ...f, cuerpo: e.target.value }))} rows={3}
              placeholder="Qué hay que hacer y por qué es prioritario…"
              style={{ width: '100%', fontSize: 13, padding: '8px 10px', borderRadius: 8, border: '1px solid #D3D1C7', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 12, resize: 'vertical' }} />

            <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Fecha para resolver (opcional)</label>
            <input type="date" value={asigForm.fecha_resolver} onChange={e => setAsigForm(f => ({ ...f, fecha_resolver: e.target.value }))}
              style={{ width: '100%', fontSize: 13, padding: '8px 10px', borderRadius: 8, border: '1px solid #D3D1C7', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 18 }} />

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setAsignar(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #D3D1C7', background: '#fff', color: '#666', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
              <button onClick={guardarAsignar} disabled={!asigForm.para || !asigForm.tema.trim() || asigBusy}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: (asigForm.para && asigForm.tema.trim()) ? '#0C447C' : '#C9C7BF', color: '#fff', fontSize: 13, fontWeight: 600, cursor: (asigForm.para && asigForm.tema.trim()) ? 'pointer' : 'default', fontFamily: 'inherit' }}>
                {asigBusy ? 'Guardando…' : 'Asignar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal CORRETAJE */}
      {corr && (
        <div onClick={cerrarCorretaje} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, padding: 24, width: 'min(640px, 100%)', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.28)' }}>
            <div style={{ fontSize: 12, color: '#6D28D9', fontWeight: 700, marginBottom: 2 }}>FACTURAR CORRETAJE</div>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4, color: '#2C2C2A' }}>{corr.tema}</div>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 16 }}>{corr.ref_idadmon}</div>

            {corrLoad && <div style={{ padding: 30, textAlign: 'center', color: '#999' }}>Cargando datos…</div>}
            {corrData?.error && <div style={{ padding: 16, background: '#FEECEC', color: '#B23A3A', borderRadius: 8, fontSize: 13 }}>{corrData.error}</div>}

            {corrData && !corrData.error && !corrResultado && (
              <>
                {/* BLOQUE 1: descuento propietario */}
                <div style={{ border: '1px solid #E5E3DC', borderRadius: 10, padding: 14, marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#2C2C2A', marginBottom: 6 }}>1 · Descuento al propietario</div>
                  <div style={{ fontSize: 13, color: '#444' }}>{corrData.propietario.nombre} · <b>{fmtPesos(corrData.propietario.comision)}</b> (CORRETAJES, mes en curso)</div>
                  {corrData.descuentoCorretaje.existe
                    ? <div style={{ fontSize: 12, color: '#B23A3A', marginTop: 4 }}>⚠ Ya existe un descuento de corretaje (Nº {corrData.descuentoCorretaje.registros[0]?.num}); no se creará otro.</div>
                    : <div style={{ fontSize: 12, color: '#0a7f4f', marginTop: 4 }}>Se creará el descuento y la factura/boleta del propietario lo lleva asociado.</div>}
                </div>

                {/* BLOQUE 2: cargo arrendatario */}
                <div style={{ border: '1px solid #E5E3DC', borderRadius: 10, padding: 14, marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#2C2C2A', marginBottom: 6 }}>2 · Cargo del arrendatario en cartola</div>
                  {!corrData.arrendatario.aplica ? (
                    <div style={{ fontSize: 12, color: '#888' }}>Este contrato no tiene comisión de arrendatario (0); no hay nada que cargar.</div>
                  ) : corrData.cargoArrendatario.existe ? (
                    <div style={{ fontSize: 13, color: '#0a7f4f' }}>✓ Ya registrado en cartola ({fmtPesos(corrData.cargoArrendatario.registros[0]?.cargo)}).</div>
                  ) : (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#444', cursor: 'pointer' }}>
                      <input type="checkbox" checked={crearCargoArr} onChange={e => setCrearCargoArr(e.target.checked)} />
                      No encontrado — crear cargo COMISION de {fmtPesos(corrData.arrendatario.comision)} a {corrData.arrendatario.nombre}
                    </label>
                  )}
                </div>

                {/* BLOQUE 3: facturación */}
                <div style={{ border: '1px solid #E5E3DC', borderRadius: 10, padding: 14, marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#2C2C2A', marginBottom: 8 }}>3 · Facturación (CSV SimpleFactura)</div>
                  <div style={{ fontSize: 13, color: '#444', marginBottom: 8 }}>
                    <b>Propietario:</b> tipo {corrData.propietario.tipo_factura === '33' ? 'FACTURA (33)' : 'BOLETA (39)'} · {fmtPesos(corrData.propietario.comision)}
                    <span style={{ color: '#999' }}> (de propietarios)</span>
                  </div>
                  {corrData.arrendatario.aplica && (
                    <div style={{ fontSize: 13, color: '#444', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <b>Arrendatario:</b>
                      <select value={tipoArr} onChange={e => setTipoArr(e.target.value)}
                        style={{ fontSize: 13, padding: '4px 8px', borderRadius: 6, border: '1px solid #D3D1C7', fontFamily: 'inherit' }}>
                        <option value="39">BOLETA (39)</option>
                        <option value="33">FACTURA (33)</option>
                      </select>
                      · {fmtPesos(corrData.arrendatario.comision)}
                      <span style={{ fontSize: 11, color: '#999' }}>(sugerido; ajústalo si procede)</span>
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: '#a06d00', marginTop: 8, background: '#FEF6E7', borderRadius: 6, padding: '6px 8px' }}>
                    Al facturar al arrendatario, verifica en cartolas que su cargo ya está registrado.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                  <button onClick={cerrarCorretaje}
                    style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #D3D1C7', background: '#fff', color: '#666', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
                  <button onClick={ejecutarCorretaje} disabled={corrEjec}
                    style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#6D28D9', color: '#fff', fontSize: 13, fontWeight: 700, cursor: corrEjec ? 'default' : 'pointer', fontFamily: 'inherit', opacity: corrEjec ? 0.6 : 1 }}>
                    {corrEjec ? 'Procesando…' : 'Confirmar y ejecutar'}
                  </button>
                </div>
              </>
            )}

            {/* Resultado */}
            {corrResultado && (
              <div>
                {corrResultado.error
                  ? <div style={{ padding: 16, background: '#FEECEC', color: '#B23A3A', borderRadius: 8, fontSize: 13 }}>{corrResultado.error}</div>
                  : (
                    <div style={{ padding: 16, background: '#E9F8F0', borderRadius: 10, fontSize: 13, color: '#0a5c3b' }}>
                      <div style={{ fontWeight: 700, marginBottom: 8 }}>✓ Corretaje procesado</div>
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {(corrResultado.avisos || []).map((m, i) => <li key={i} style={{ marginBottom: 4 }}>{m}</li>)}
                      </ul>
                      <div style={{ fontSize: 12, color: '#0a7f4f', marginTop: 8 }}>El/los CSV se han descargado. Súbelos a SimpleFactura.</div>
                    </div>
                  )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                  <button onClick={cerrarCorretaje}
                    style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#0C447C', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cerrar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
