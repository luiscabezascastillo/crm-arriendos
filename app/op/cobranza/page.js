'use client'
// VERSION: v23 · 2026-08-26 · Widget "Salud del cobro" (4 KPIs renta+servicios con mini-curva y enlace a /op/cobranza/kpis). Hereda v22.
// VERSION: v22 · 2026-08-26 · Pestañas reordenadas por flujo de cobro (Cartolas·Diferencias·Multas·Casos·Servicios·…) + botón "🔔 Notificaciones" en cabecera (prevención). Hereda v21.
// VERSION: v21 · 2026-08-26 · Pestaña "Diferencias": saldo por cobrar / pagó de menos (solo lectura, /api/cobranza/diferencias + DiferenciasView). Hereda v20.
// VERSION: v20 · 2026-08-26 · Pestaña "Multas": bandeja de multas por atraso (solo lectura, consume /api/cobranza/multas + MultasView). Hereda v19.
// VERSION: v19 · 2026-08-26 · Boton "📕 Guía morosos" en la cabecera (abre /api/cobranza/guia-morosos). Hereda v18.
// VERSION: v18 · 2026-08-24 · Saldos a favor: enlace al panel completo "Cartolas a auditar". Hereda v17.
// VERSION: v17 · 2026-08-24 · Saldos a favor: sugerencias por contrato (Adalis/Fabiola proponen; trio marca atendida). El traslado a A00000 seguira gateado al trio. Hereda v16.
// VERSION: v16 · 2026-08-24 · Pestaña "Saldos a favor": auditoría de saldos a favor del arrendatario (S/SQ y Q), IDADMON->Cartola, parejas mismo piso marcadas. Solo lectura (endpoint /api/cobranza/saldos-favor). Hereda v15.
// VERSION: v15 · 2026-08-24 · Boton "📖 Manual" en la cabecera (abre /api/cobranza/manual, imprimible/PDF). Hereda v14.
// VERSION: v14 · 2026-08-24 · Panel Gestionar: compositor de email por DEPARTAMENTO (Cobranzas/Legal) con destinatarios por check + CC/CCO + CCO al propietario (anade bloque), adjuntos, PRUEBA y Revisar->Aceptar y enviar; registro rapido llamada/WhatsApp/presencial; IDADMON abre la Cartola (pestana nueva). Hereda v13.
// VERSION: v13 · 2026-08-24 · Cartolas: toggles Vigentes/Término suben a la línea de cabecera (junto a "situación al"); cabecera + "Acciones pendientes hoy" quedan STICKY bajo el TopNav (top:52) y no se ocultan. Hereda v12.
// VERSION: v11 · 2026-08-13 · Cartolas/Inicios: filtros tipo Excel por columna (mismo motor que CC1,
//   lib/filtroExcel) en cada cabecera de la tabla, con orden y multiselección, y botón "Exportar Excel"
//   que vuelca EXACTAMENTE lo filtrado (respetando filtros y orden) a .xlsx. Cada grupo (Vigentes/Término)
//   filtra y exporta de forma independiente. Hereda v10.
// VERSION: v10 · 2026-08-10 · Escalera alineada a la regla FCR: 1er aviso SOLO arrendatario; desde el 2º,
//   arrendatario + aval juntos (día 5). La worklist lo refleja. Hereda v9.
// VERSION: v9 · 2026-08-10 · Multa/interés automático en la reclamación: días de mora × % diario × deuda
//   (prefijado desde multa_diaria del contrato, editable). Muestra total y lo inyecta en la plantilla
//   ({{multa}}/{{total}}) y en monto_reclamado. Hereda v8.
// VERSION: v8 · 2026-08-10 · Botón "Expediente (PDF)" en el panel y en Casos: abre /api/cobranza/expediente
//   (HTML imprimible con toda la secuencia de gestiones) para entregar al aval/abogado o respaldar al dueño. Hereda v7.
// VERSION: v7 · 2026-08-10 · Pestaña "Casos" con semáforo del propietario (🟢/🟡/🔴 según avisos al propietario
//   y aval) + botón "Abrir casos de términos con déficit" (sync desde vw_termino_resultado). Hereda v6.
// VERSION: v6 · 2026-08-10 · Escalera automática + worklist: la lista muestra "Próxima acción" por moroso
//   (cruza días de mora con lo ya gestionado) y una barra "Acciones pendientes hoy" con el recuento por paso
//   (recordatorio, 1ª reclamación, avisar propietario, reclamar aval, pre-DICOM, sin gestión). Hereda v5.
// VERSION: v5 · 2026-08-10 · Cobranza: el panel ahora ENVÍA por email desde el CRM (canal email) y guarda
//   el acuse real; si no, registra la constancia manual. Email destino editable (arrendatario/aval/propietario).
//   Hereda v4. v4: "Gestionar" con plantilla + constancia (cobranza_gestiones append-only), avisos obligatorios
//   (aval/propietario), pestaña Bitácora. Reusa /api/cobranza (mora) y /api/cobranza/gestion.
// VERSION: v3 · 2026-07-21 · Cartolas operativa y por defecto (endpoint unificado /api/cobranza?tipo=).
//   Cabecera "Cobranza de {tipo} · situación al {fecha, hora}". Columna "Último abono". Toggles vigente/término,
//   sin_cobrador resaltado. Inicios sigue disponible como sub-vista. Servicios enlaza a /op/deudas.

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { HeaderFilter, filtroActivo, aplicarFiltros } from '@/lib/filtroExcel'

const num = (v) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d.-]/g, '')) || 0)
const money = (v) => { const n = num(v); return (n ? '$' + n.toLocaleString('es-CL') : '$0') }

import MultasView from './MultasView'
import DiferenciasView from './DiferenciasView'
import KpisResumen from './KpisResumen'

const C = {
  txt: '#2C2C2A', sub: '#888780', line: '#D3D1C7', panel: '#F1EFE8',
  rojo: '#9B1C1C', rojoBg: '#FBEDEC', verde: '#085041', verdeBg: '#E9F4E4',
  ambar: '#B8860B', ambarBg: '#FBF7EC', acento: '#1D9E75',
}

function fechaHoraLocal(iso) {
  const d = iso ? new Date(iso) : new Date()
  const p = (n) => String(n).padStart(2, '0')
  return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ', ' + p(d.getHours()) + ':' + p(d.getMinutes())
}

const MESES_TXT = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
function mesActualTxt() { const d = new Date(); return MESES_TXT[d.getMonth()] + ' ' + d.getFullYear() }

const CANALES = ['email', 'whatsapp', 'llamada', 'carta_certificada', 'notarial', 'presencial']
const DEST_LBL = { arrendatario: 'Arrendatario', aval: 'Aval', propietario: 'Propietario' }

// ── Escalera de cobranza (días de mora → paso esperado). Plazos BORRADOR, a validar por Legal. ──
// Regla FCR: 1er aviso SOLO al arrendatario; desde el 2º, arrendatario Y aval juntos.
const LADDER = [
  { dia: 1, etapa: 'recordatorio', dest: 'arrendatario', label: '1er aviso (solo arrendatario)' },
  { dia: 5, etapa: 'reclamacion_1', dest: 'arrendatario', label: '2ª: reclamación arrendatario' },
  { dia: 5, etapa: 'reclamacion_aval', dest: 'aval', label: '2ª: reclamación aval' },
  { dia: 5, etapa: 'aviso_propietario', dest: 'propietario', label: 'Avisar propietario' },
  { dia: 15, etapa: 'aviso_dicom', dest: 'arrendatario', label: 'Aviso pre-DICOM' },
]
function diasDesdeFecha(ddmmyyyy) {
  const m = String(ddmmyyyy || '').match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (!m) return null
  const f = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
  return Math.floor((new Date() - f) / (1000 * 60 * 60 * 24))
}
function pasoHecho(step, r) {
  if (!r) return false
  if (r.etapas && r.etapas.includes(step.etapa)) return true
  if ((step.dest === 'aval' || step.dest === 'propietario') && r.destinatarios && r.destinatarios.includes(step.dest)) return true
  return false
}
function pendientesDe(dias, r) {
  const d = dias == null ? 999 : dias   // sin fecha de abono → tratar como mora antigua
  return LADDER.filter(s => d >= s.dia && !pasoHecho(s, r))
}

// ── Filtros estilo Excel (mismo motor que CC1: lib/filtroExcel). Una definición de columna por
//    cada campo filtrable de la tabla de Cartolas/Inicios. `fkey` extrae el valor de la fila y
//    `flabel` lo formatea para el desplegable del filtro. ──
const SIT_LBL = { moroso: 'Moroso', al_dia: 'Al día', sobrepago: 'Revisar · sobrepago' }
const fmtNumCL = (k) => { const n = Number(k); return isNaN(n) ? String(k) : n.toLocaleString('es-CL') }
const COB_COLS = [
  { key: 'idadmon', label: 'IDADMON', tipo: 'texto',
    fkey: f => f.idadmon || '', flabel: k => (k === '' ? '(vacías)' : k) },
  { key: 'propietario', label: 'Propietario', tipo: 'texto',
    fkey: f => f.propietario || '', flabel: k => (k === '' ? '(vacías)' : k) },
  { key: 'inmueble', label: 'Inmueble', tipo: 'texto',
    fkey: f => f.inmueble || '', flabel: k => (k === '' ? '(vacías)' : k) },
  { key: 'arrendatario', label: 'Arrendatario', tipo: 'texto',
    fkey: f => f.arrendatario || '', flabel: k => (k === '' ? '(vacías)' : k) },
  { key: 'estado', label: 'Est.', tipo: 'texto',
    fkey: f => f.estado || '', flabel: k => (k === '' ? '(vacías)' : k) },
  { key: 'ultimo_abono', label: 'Último abono', tipo: 'texto',
    fkey: f => f.ultimo_abono || '', flabel: k => (k === '' ? '(sin abono)' : k) },
  { key: 'deuda', label: 'Deuda', tipo: 'num',
    fkey: f => String(num(f.deuda)), flabel: k => (k === '' ? '(vacías)' : fmtNumCL(k)) },
  { key: 'clase', label: 'Situación', tipo: 'texto',
    fkey: f => f.clase || '', flabel: k => (k === '' ? '(vacías)' : (SIT_LBL[k] || k)) },
]

const TABS = [
  { k: 'cartolas', label: 'Cartolas' },
  { k: 'diferencias', label: 'Diferencias' },
  { k: 'multas', label: 'Multas' },
  { k: 'casos', label: 'Casos' },
  { k: 'servicios', label: 'Servicios', href: '/op/deudas' },
  { k: 'saldos', label: 'Saldos a favor' },
  { k: 'inicios', label: 'Inicios' },
  { k: 'bitacora', label: 'Bitácora' },
]
const TITULO_TIPO = { cartolas: 'Cobranza de Cartolas', inicios: 'Cobranza de Inicios' }

// Contenido del boton "? Ayuda" — como funciona la cobranza (escueto y practico).
const AYUDA_COBRANZA = [
  { t: 'Como detecta la mora', d: 'Mira el saldo vivo de cada contrato en su cartola (lo cargado menos lo abonado). Si hay deuda y el contrato lo cobra FCR (no el dueno), sale como moroso. La deuda depende de que la cartola este limpia.' },
  { t: 'Las pestanas', d: 'Cartolas: morosos, deuda y la Proxima accion de hoy, con el boton Gestionar. Casos: expedientes abiertos con semaforo al propietario y el Expediente en PDF. Servicios / Inicios / Bitacora: deudas de servicios, contratos recien iniciados y el registro global de gestiones.' },
  { t: 'La escalera (que toca hoy)', d: 'Por dias desde el ultimo abono: 1er aviso al arrendatario (>=1 dia), 1a reclamacion + avisar al propietario (>=5), reclamar al aval (>=10), aviso pre-DICOM (>=15). Plazos en borrador, a validar por Legal.' },
  { t: 'Siempre arrendatario Y aval', d: 'La solidaridad del aval se pierde si no se le reclama a tiempo y en forma. Por eso desde el 2o aviso entra tambien el aval.' },
  { t: 'Semaforo al propietario', d: 'Verde: silencio (mora leve). Ambar: aviso proactivo (el riesgo crece). Rojo: decision/cargo con expediente. Regla de oro: el propietario nunca debe sorprenderse de un mal resultado.' },
  { t: 'Gestionar (el boton)', d: 'Ves los contactos, los avisos obligatorios pendientes (aval/propietario) y registras la gestion con una plantilla; puedes enviarla por email y queda el acuse. Todo lo registrado es INMUTABLE: no se edita ni se borra.' },
  { t: 'El expediente', d: 'En Casos generas un PDF con toda la secuencia de gestiones. Es la salida legal para el aval, el abogado o el respaldo al dueno.' },
]

export default function Cobranza() {
  const [tab, setTab] = useState('cartolas')
  const [ayudaOpen, setAyudaOpen] = useState(false)

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '18px 20px', fontFamily: 'system-ui, -apple-system, sans-serif', color: C.txt }}>
      <div style={{ fontSize: 12, color: C.sub, marginBottom: 6 }}>
        <Link href="/procesos" style={{ color: C.sub, textDecoration: 'none' }}>← Procesos</Link> / Cobranza
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 2px' }}>Cobranza</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => window.open('/procesos/notificaciones', '_blank')} title="Notificaciones: recordatorio automatico de pago (prevencion, dia 24-26)"
            style={{ fontSize: 13, fontWeight: 700, padding: '7px 13px', cursor: 'pointer', borderRadius: 9, border: '1px solid #C9DEF5', background: '#EAF2FB', color: '#185FA5', whiteSpace: 'nowrap' }}>🔔 Notificaciones</button>
          <button onClick={() => window.open('/api/cobranza/manual', '_blank')} title="Manual de uso del modulo"
            style={{ fontSize: 13, fontWeight: 700, padding: '7px 13px', cursor: 'pointer', borderRadius: 9, border: '1px solid #CBE6BE', background: '#E9F4E4', color: '#085041', whiteSpace: 'nowrap' }}>📖 Manual</button>
          <button onClick={() => window.open('/api/cobranza/guia-morosos', '_blank')} title="Buenas practicas para la reclamacion a morosos"
            style={{ fontSize: 13, fontWeight: 700, padding: '7px 13px', cursor: 'pointer', borderRadius: 9, border: '1px solid #F0DFA8', background: '#FFF7E0', color: '#6b4e05', whiteSpace: 'nowrap' }}>📕 Guía morosos</button>
          <button onClick={() => setAyudaOpen(true)} title="Como funciona la cobranza"
            style={{ fontSize: 13, fontWeight: 700, padding: '7px 13px', cursor: 'pointer', borderRadius: 9, border: '1px solid #C9DEF5', background: '#EAF2FB', color: '#185FA5', whiteSpace: 'nowrap' }}>? Ayuda</button>
        </div>
      </div>
      <div style={{ fontSize: 13, color: C.sub, marginBottom: 16 }}>Impago → gestión con constancia → pago o acción legal</div>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid ' + C.line, marginBottom: 18 }}>
        {TABS.map(t => {
          const active = tab === t.k
          const base = {
            fontSize: 13, fontWeight: 600, padding: '9px 16px', cursor: 'pointer',
            border: 'none', background: 'none', borderBottom: active ? '2px solid ' + C.acento : '2px solid transparent',
            color: active ? C.txt : C.sub, position: 'relative', top: 1,
          }
          if (t.href) return <Link key={t.k} href={t.href} style={{ ...base, textDecoration: 'none' }}>{t.label}</Link>
          return <button key={t.k} onClick={() => setTab(t.k)} style={base}>{t.label}</button>
        })}
      </div>

      <KpisResumen />
      {(tab === 'cartolas' || tab === 'inicios') && <VistaCobranza tipo={tab} />}
      {tab === 'multas' && <MultasView />}
      {tab === 'diferencias' && <DiferenciasView />}
      {tab === 'casos' && <CasosView />}
      {tab === 'saldos' && <SaldosFavor />}
      {tab === 'bitacora' && <Bitacora />}

      {ayudaOpen && (
        <div onClick={() => setAyudaOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 14, boxShadow: '0 18px 50px rgba(0,0,0,0.25)', width: 'min(640px, 96vw)', maxHeight: '88vh', overflowY: 'auto', padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1a1a2e', margin: 0 }}>Como funciona la Cobranza</h2>
              <button onClick={() => setAyudaOpen(false)} style={{ border: 'none', background: 'transparent', fontSize: 20, color: '#9ca3af', cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ fontSize: 13, color: '#1a1a2e', background: '#EAF2FB', border: '1px solid #C9DEF5', borderRadius: 8, padding: '9px 12px', margin: '4px 0 14px' }}>
              <b>Sin constancia, no existe.</b> El sistema empuja las acciones a tiempo (arrendatario, aval y propietario) y deja un rastro inmutable de todo.
            </div>
            {AYUDA_COBRANZA.map((a, i) => (
              <div key={i} style={{ padding: '9px 0', borderTop: i === 0 ? 'none' : '1px solid #F0EFEA' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>{a.t}</div>
                <div style={{ fontSize: 12.5, color: '#555', marginTop: 2 }}>{a.d}</div>
              </div>
            ))}
            <div style={{ marginTop: 14, fontSize: 11.5, color: '#9ca3af' }}>
              Nota: la deuda y la escalera salen de la cartola (cuentas). Si un cargo o abono esta mal, saldran mal; por eso conviene mantener las cartolas limpias.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function VistaCobranza({ tipo }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [verVigente, setVerVigente] = useState(true)
  const [verTermino, setVerTermino] = useState(true)
  const [gestionar, setGestionar] = useState(null)   // fila seleccionada para el panel
  const [resumenMap, setResumenMap] = useState({})   // idadmon -> gestiones ya hechas

  useEffect(() => {
    let vivo = true
    setLoading(true); setError(null); setData(null)
    fetch('/api/cobranza?tipo=' + tipo)
      .then(r => r.json())
      .then(j => { if (!vivo) return; if (j.error) setError(j.error); else setData(j); setLoading(false) })
      .catch(e => { if (!vivo) return; setError(String(e)); setLoading(false) })
    fetch('/api/cobranza/gestion?resumen=1')
      .then(r => r.json())
      .then(j => { if (!vivo) return; const m = {}; for (const x of (j.resumen || [])) m[x.idadmon] = x; setResumenMap(m) })
      .catch(() => {})
    return () => { vivo = false }
  }, [tipo])

  const filas = data?.filas || []
  const rv = data?.resumen?.vigente || {}
  const rt = data?.resumen?.termino || {}
  const grupos = []
  if (verVigente) grupos.push({ g: 'vigente', titulo: 'Vigentes (S / SQ)', r: rv })
  if (verTermino) grupos.push({ g: 'termino', titulo: 'En término (Q)', r: rt })

  // Escalera: pendientes por moroso + worklist
  const pendMap = {}
  for (const f of filas) {
    const dias = diasDesdeFecha(f.ultimo_abono)
    pendMap[f.idadmon] = { dias, pend: f.clase === 'moroso' ? pendientesDe(dias, resumenMap[f.idadmon]) : [] }
  }
  const moros = filas.filter(f => f.clase === 'moroso')
  const wl = LADDER.map(s => ({ ...s, n: moros.filter(f => pendMap[f.idadmon].pend.some(p => p.etapa === s.etapa && p.dest === s.dest)).length }))
  const sinGestion = moros.filter(f => { const r = resumenMap[f.idadmon]; return !r || r.n === 0 }).length

  // Cabecera + acciones FIJAS (sticky) bajo el TopNav (52px, z-index 100): siguen visibles al hacer scroll.
  const stickyCab = { position: 'sticky', top: 52, zIndex: 90, background: '#f4f6f9', paddingTop: 10 }

  return (
    <div>
      <div style={stickyCab}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', justifyContent: 'space-between', paddingBottom: 10, marginBottom: (data && moros.length > 0) ? 12 : 0, borderBottom: '1px solid ' + C.line }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>{TITULO_TIPO[tipo]}</span>
            <span style={{ fontSize: 12, color: C.sub }}>· situación al {fechaHoraLocal(data?.generado)}</span>
          </div>
          {data && (
            <div style={{ display: 'flex', gap: 16, fontSize: 13, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={verVigente} onChange={e => setVerVigente(e.target.checked)} />
                Vigentes (S/SQ) · {rv.con_deuda || 0} con deuda
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={verTermino} onChange={e => setVerTermino(e.target.checked)} />
                En término (Q) · {rt.con_deuda || 0} con deuda
              </label>
            </div>
          )}
        </div>

        {data && moros.length > 0 && (
          <div style={{ border: '1px solid ' + C.line, borderRadius: 10, padding: '12px 16px', marginBottom: 16, background: '#fff' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.txt, marginBottom: 8 }}>
              Acciones pendientes hoy <span style={{ color: C.sub, fontWeight: 400 }}>· escalera de cobranza (plazos borrador, a validar por Legal)</span>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <WlChip label="Sin gestión" n={sinGestion} rojo />
              {wl.map(s => <WlChip key={s.etapa + s.dest} label={s.label + ' (≥' + s.dia + 'd)'} n={s.n} />)}
            </div>
          </div>
        )}
      </div>

      {loading && <div style={{ padding: 40, textAlign: 'center', color: C.sub }}>Calculando saldos…</div>}
      {error && <div style={{ padding: 20, color: C.rojo, fontSize: 13 }}>Error: {error}</div>}

      {data && (
        <>
          {grupos.map(({ g, titulo, r }) => (
            <div key={g} style={{ marginBottom: 26 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{titulo}</h2>
                <span style={{ fontSize: 12, color: C.sub }}>
                  {r.con_deuda || 0} con deuda · {r.al_dia || 0} al día · {r.sobrepago || 0} a revisar · deuda total {money(r.total_deuda)}
                </span>
              </div>
              <Tabla filas={filas.filter(f => f.grupo === g)} tipo={tipo} grupo={g} onGestionar={setGestionar} pendMap={pendMap} />
            </div>
          ))}

          <div style={{ fontSize: 11, color: C.sub, marginTop: 8 }}>
            Umbral deuda: {money(data.parametros?.umbral)} · sobrepago a revisar: &gt; {money(data.parametros?.sobrepago)} a favor.
            Saldo corrido a la fecha de hoy (mismo cálculo que la Cartola).
          </div>
        </>
      )}

      {gestionar && <CobranzaDrawer fila={gestionar} onClose={() => setGestionar(null)} />}
    </div>
  )
}

function Tabla({ filas, tipo, grupo, onGestionar, pendMap }) {
  // Estado de filtro/orden PROPIO de esta tabla (como una mini-CC1): cada grupo (Vigentes/Término)
  // filtra y ordena de forma independiente. Así no hay colisión entre las dos tablas de la vista.
  const [filters, setFilters] = useState({})
  const [openFilter, setOpenFilter] = useState(null)
  const [orden, setOrden] = useState(null)
  const setFiltroCol = (key, val) => setFilters(f => { const n = { ...f }; if (val == null) delete n[key]; else n[key] = val; return n })
  const limpiarTodo = () => { setFilters({}); setOrden(null) }
  const hayAlguno = COB_COLS.some(c => filtroActivo(filters[c.key])) || !!orden?.key

  const esInicios = tipo === 'inicios'

  // Derivación en memoria: filtros de columna → orden (mismo motor que CC1).
  const filtradas = useMemo(() => aplicarFiltros(filas, COB_COLS, filters, orden), [filas, filters, orden])

  // Exporta a Excel EXACTAMENTE lo filtrado (`filtradas`), con las columnas de la tabla.
  async function exportarExcel() {
    const XLSX = await import('xlsx')
    const salida = filtradas.map(f => {
      const pm = pendMap && pendMap[f.idadmon]
      let prox = ''
      if (f.clase === 'moroso' && pm) prox = pm.pend.length ? pm.pend[0].label : 'al día en gestiones'
      const row = {
        IDADMON: f.idadmon || '',
        Propietario: f.propietario || '',
        Inmueble: f.inmueble || '',
        Arrendatario: f.arrendatario || '',
        Estado: f.estado || '',
        'Último abono': f.ultimo_abono || '',
      }
      if (esInicios) row['Último inicio'] = f.fecha_ultimo_inicio || ''
      row['Deuda'] = num(f.deuda)
      row['Situación'] = SIT_LBL[f.clase] || f.clase || ''
      row['Días mora'] = (pm && pm.dias != null) ? pm.dias : ''
      row['Próxima acción'] = prox
      row['Comentario'] = f.comentario || f.coment_interno || ''
      return row
    })
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(salida)
    XLSX.utils.book_append_sheet(wb, ws, 'Cobranza')
    const hoy = new Date().toISOString().slice(0, 10)
    const gtxt = grupo === 'termino' ? 'termino' : 'vigente'
    XLSX.writeFile(wb, `Cobranza_${tipo}_${gtxt}_${hoy}.xlsx`)
  }

  const th = { fontSize: 11, fontWeight: 600, color: C.sub, textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid ' + C.line, whiteSpace: 'nowrap' }
  const td = { fontSize: 12, padding: '8px 10px', borderBottom: '0.5px solid ' + C.line, verticalAlign: 'top' }
  const lbl = { fontSize: 11, fontWeight: 600, color: C.sub }

  // Cabecera reutilizable: etiqueta + control de filtro Excel para una columna.
  const HF = (key) => (
    <HeaderFilter col={COB_COLS.find(c => c.key === key)} movs={filas}
      state={filters[key]} setState={v => setFiltroCol(key, v)}
      open={openFilter} setOpen={setOpenFilter} orden={orden} setOrden={setOrden}
      limpiarTodo={limpiarTodo} hayAlguno={hayAlguno} />
  )

  if (!filas.length) return <div style={{ padding: 16, color: C.sub, fontSize: 13 }}>Sin registros en este grupo.</div>

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginBottom: 8 }}>
        {hayAlguno && (
          <button onClick={limpiarTodo} style={{ padding: '6px 11px', borderRadius: 7, border: '1px solid ' + C.line,
            background: '#FBF7EC', fontSize: 12, color: C.ambar, cursor: 'pointer', fontWeight: 600 }}>
            ✕ Limpiar filtros
          </button>
        )}
        <button onClick={exportarExcel} style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 7, border: 'none', background: '#1c7d3f', color: '#fff',
          fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          ⬇ Exportar Excel ({filtradas.length})
        </button>
      </div>

      <div style={{ overflow: 'visible', border: '0.5px solid ' + C.line, borderRadius: 8 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1060 }}>
          <thead>
            <tr>
              <th style={th}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={lbl}>IDADMON</span>{HF('idadmon')}</span></th>
              <th style={th}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={lbl}>Propietario</span>{HF('propietario')}<span style={{ color: C.line }}>/</span><span style={lbl}>Inmueble</span>{HF('inmueble')}</span></th>
              <th style={th}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={lbl}>Arrendatario</span>{HF('arrendatario')}</span></th>
              <th style={th}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={lbl}>Est.</span>{HF('estado')}</span></th>
              <th style={th}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={lbl}>Último abono</span>{HF('ultimo_abono')}</span></th>
              {esInicios && <th style={{ ...th, textAlign: 'right' }}>Últ. inicio</th>}
              <th style={th}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={lbl}>Deuda</span>{HF('deuda')}</span></th>
              <th style={th}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={lbl}>Situación</span>{HF('clase')}</span></th>
              <th style={th}>Próxima acción</th>
              <th style={{ ...th, textAlign: 'center' }}>Gestión</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 ? (
              <tr><td colSpan={esInicios ? 10 : 9} style={{ padding: 20, textAlign: 'center', color: C.sub, fontSize: 12 }}>Sin resultados con los filtros aplicados.</td></tr>
            ) : filtradas.map(f => {
              const esMoroso = f.clase === 'moroso'
              const esSobre = f.clase === 'sobrepago'
              const bg = f.clase === 'al_dia' ? C.verdeBg : (esSobre ? C.ambarBg : '#fff')
              const aviso = f.sin_cobrador
              return (
                <tr key={f.idadmon} style={{ background: bg, boxShadow: aviso ? 'inset 3px 0 0 ' + C.ambar : 'none' }}>
                  <td style={{ ...td, fontWeight: 600 }}>
                    <a href={'/procesos/cartolas?idadmon=' + encodeURIComponent(f.idadmon)} target="_blank" rel="noopener noreferrer"
                      title="Abrir la Cartola de este contrato" style={{ color: '#185FA5', textDecoration: 'none' }}>{f.idadmon}</a>
                  </td>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{f.propietario || '—'}</div>
                    <div style={{ color: C.sub, fontSize: 11 }}>{f.inmueble || ''}</div>
                  </td>
                  <td style={{ ...td, color: C.sub }}>{f.arrendatario || '—'}</td>
                  <td style={{ ...td, textAlign: 'center' }}>{f.estado || '—'}</td>
                  <td style={{ ...td, textAlign: 'right', color: C.sub, fontVariantNumeric: 'tabular-nums' }}>{f.ultimo_abono || '—'}</td>
                  {esInicios && <td style={{ ...td, textAlign: 'right', color: C.sub, fontVariantNumeric: 'tabular-nums' }}>{f.fecha_ultimo_inicio || '—'}</td>}
                  <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: esSobre ? 700 : 600,
                    color: esMoroso ? C.rojo : (f.clase === 'al_dia' ? C.verde : C.ambar) }}>
                    {money(f.deuda)}
                  </td>
                  <td style={td}>
                    {esMoroso && <span style={{ color: C.rojo, fontWeight: 600 }}>Moroso</span>}
                    {f.clase === 'al_dia' && <span style={{ color: C.verde }}>Al día</span>}
                    {esSobre && <span style={{ color: C.ambar, fontWeight: 700 }}>Revisar · posible mala asignación</span>}
                    {aviso && <div style={{ color: C.ambar, fontSize: 11, fontWeight: 600, marginTop: 2 }}>⚠ Falta «quién cobra» en el LOG</div>}
                  </td>
                  <td style={td}>{(() => {
                    const pm = pendMap && pendMap[f.idadmon]
                    if (!pm || f.clase !== 'moroso') return <span style={{ color: C.sub }}>—</span>
                    if (!pm.pend.length) return <span style={{ color: C.verde, fontSize: 11 }}>✓ al día en gestiones</span>
                    const next = pm.pend[0]
                    return <span style={{ fontSize: 11, fontWeight: 700, color: C.rojo }}>
                      {next.label}{pm.pend.length > 1 ? ' +' + (pm.pend.length - 1) : ''}
                      {pm.dias != null ? <span style={{ color: C.sub, fontWeight: 400 }}> · {pm.dias}d</span> : null}
                    </span>
                  })()}</td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <button onClick={() => onGestionar(f)} style={{
                      fontSize: 11, padding: '4px 10px', borderRadius: 5, border: '1px solid ' + C.acento,
                      background: '#fff', color: C.acento, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap',
                    }}>Gestionar</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ─── Panel de gestión (constancia) ──────────────────────────────────────────
function CobranzaDrawer({ fila, onClose }) {
  const [info, setInfo] = useState(null)
  const [loading, setLoading] = useState(true)

  const [departamento, setDepartamento] = useState('cobranza')
  const [plantillaId, setPlantillaId] = useState('')
  const [asunto, setAsunto] = useState('')
  const [contenido, setContenido] = useState('')
  const [pct, setPct] = useState(1)

  const [toArr, setToArr] = useState(true)
  const [toAval, setToAval] = useState(false)
  const [toProp, setToProp] = useState(false)
  const [emailArr, setEmailArr] = useState('')
  const [emailAval, setEmailAval] = useState('')
  const [emailProp, setEmailProp] = useState('')
  const [cc, setCc] = useState('')
  const [cco, setCco] = useState('')
  const [ccoProp, setCcoProp] = useState(false)

  const [resultado, setResultado] = useState('enviado')
  const [acuse, setAcuse] = useState('')
  const [adjuntos, setAdjuntos] = useState([])
  const [subiendo, setSubiendo] = useState(false)
  const [toTest, setToTest] = useState('')

  const [fase, setFase] = useState('compose')
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)

  const [rapParty, setRapParty] = useState('arrendatario')
  const [rapNota, setRapNota] = useState('')

  const tipo = fila.grupo === 'termino' ? 'termino' : 'vigente'
  const deuda = num(fila.deuda)
  const dias = (fila.dias_mora != null) ? fila.dias_mora : diasDesdeFecha(fila.ultimo_abono)
  const multa = (dias && dias > 0) ? Math.round(deuda * (Number(pct) / 100) * dias) : 0
  const total = deuda + multa

  function cargar() {
    setLoading(true)
    fetch('/api/cobranza/gestion?idadmon=' + encodeURIComponent(fila.idadmon))
      .then(r => r.json())
      .then(j => { setInfo(j); setLoading(false) })
      .catch(e => { setMsg('Error: ' + e); setLoading(false) })
  }
  useEffect(() => { cargar() }, [fila.idadmon])

  useEffect(() => {
    const c = info?.contrato || {}
    setEmailArr(c.mail_arrendatario || '')
    setEmailAval(c.mail_avalista || '')
  }, [info])

  useEffect(() => {
    const md = Number(info?.contrato?.multa_diaria)
    if (md && md > 0 && md <= 10) setPct(md)
  }, [info])

  const contrato = info?.contrato || {}
  const gestiones = info?.gestiones || []
  const plantillas = info?.plantillas || []

  const yaAval = gestiones.some(g => g.destinatario === 'aval')
  const yaProp = gestiones.some(g => g.destinatario === 'propietario')
  const avalPendiente = deuda > 0 && !yaAval
  const propPendiente = deuda > 0 && !yaProp

  function valores() {
    return {
      '{{arrendatario}}': contrato.arrendatario || fila.arrendatario || '',
      '{{aval}}': contrato.avalista || '',
      '{{propietario}}': contrato.propietario || fila.propietario || '',
      '{{propiedad}}': contrato.inmueble || fila.inmueble || '',
      '{{monto}}': num(deuda).toLocaleString('es-CL'),
      '{{dias_mora}}': String(dias ?? ''),
      '{{multa}}': num(multa).toLocaleString('es-CL'),
      '{{total}}': num(total).toLocaleString('es-CL'),
      '{{mes}}': mesActualTxt(),
    }
  }
  function render(t) { let s = String(t || ''); const v = valores(); for (const k in v) s = s.split(k).join(v[k]); return s }

  const bloqueCco = (plantillas.find(p => p.destinatario === 'propietario_cco' && (p.departamento || 'cobranza') === departamento)?.cuerpo) || ''

  const plantillasDep = plantillas.filter(p =>
    (p.departamento || 'cobranza') === departamento && p.canal === 'email' &&
    (p.destinatario === 'arrendatario' || p.destinatario === 'aval'))

  function aplicarPlantilla(id) {
    setPlantillaId(id)
    const p = plantillas.find(x => String(x.id) === String(id))
    if (!p) return
    let cuerpo = render(p.cuerpo)
    if (ccoProp && bloqueCco) cuerpo = cuerpo.trimEnd() + '\n\n' + bloqueCco
    setAsunto(render(p.asunto)); setContenido(cuerpo)
    if (p.destinatario === 'aval') { setToAval(true); setToArr(false); if (emailArr) setCc(emailArr) }
    else { setToArr(true) }
  }

  useEffect(() => {
    if (!plantillaId) return
    const p = plantillas.find(x => String(x.id) === String(plantillaId))
    if (!p) return
    let cuerpo = render(p.cuerpo)
    if (ccoProp && bloqueCco) cuerpo = cuerpo.trimEnd() + '\n\n' + bloqueCco
    setAsunto(render(p.asunto)); setContenido(cuerpo)
  }, [pct]) // eslint-disable-line

  function toggleCcoProp(on) {
    setCcoProp(on)
    if (!bloqueCco) return
    if (on) { setContenido(c => (c && c.includes(bloqueCco)) ? c : ((c || '').trimEnd() + '\n\n' + bloqueCco).trim()) }
    else { setContenido(c => (c || '').split('\n\n' + bloqueCco).join('').split(bloqueCco).join('').trimEnd()) }
  }

  async function onFiles(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setSubiendo(true); setMsg(null)
    for (const f of files) {
      const fd = new FormData(); fd.append('file', f); fd.append('idadmon', fila.idadmon)
      const r = await fetch('/api/cobranza/adjunto', { method: 'POST', body: fd }).then(r => r.json()).catch(e => ({ error: String(e) }))
      if (r.error) { setMsg('Adjunto: ' + r.error); continue }
      setAdjuntos(a => [...a, { path: r.path, nombre: r.nombre, size: r.size }])
    }
    setSubiendo(false); e.target.value = ''
  }

  const contratoPayload = {
    propietario: contrato.propietario || fila.propietario, inmueble: contrato.inmueble || fila.inmueble,
    arrendatario: contrato.arrendatario || fila.arrendatario, rut: contrato.rut,
    avalista: contrato.avalista, rut_avalista: contrato.rut_avalista,
  }

  async function registrarRapido(canal) {
    const nota = rapNota.trim() || ('Contacto por ' + canal)
    setGuardando(true); setMsg(null)
    const res = await fetch('/api/cobranza/gestion', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idadmon: fila.idadmon, tipo, departamento, canal,
        destinos: [{ party: rapParty, email: null }],
        contenido: nota, resultado: 'registrado',
        monto_adeudado: deuda, dias_mora: dias ?? null, contrato: contratoPayload,
        enviar: false,
      }),
    }).then(r => r.json()).catch(e => ({ error: String(e) }))
    setGuardando(false)
    if (res.error) { setMsg('Error: ' + res.error); return }
    setMsg('✓ ' + canal + ' registrada'); setRapNota(''); cargar()
  }

  async function probar() {
    if (!contenido.trim()) { setMsg('Escribe el contenido antes de probar.'); return }
    setGuardando(true); setMsg(null)
    const res = await fetch('/api/cobranza/gestion', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true, toTest, departamento, asunto, contenido, adjuntos }),
    }).then(r => r.json()).catch(e => ({ error: String(e) }))
    setGuardando(false)
    if (res.error) { setMsg('Error prueba: ' + res.error); return }
    setMsg('✓ Prueba enviada a ' + res.enviadoA + (res.adjuntos ? ' (' + res.adjuntos + ' adjunto/s)' : ''))
  }

  function destinosSel() {
    const d = []
    if (toArr && emailArr.trim()) d.push({ party: 'arrendatario', email: emailArr.trim() })
    if (toAval && emailAval.trim()) d.push({ party: 'aval', email: emailAval.trim() })
    if (toProp && emailProp.trim() && !ccoProp) d.push({ party: 'propietario', email: emailProp.trim() })
    return d
  }

  function revisar() {
    if (!contenido.trim()) { setMsg('Falta el contenido.'); return }
    const d = destinosSel()
    if (!d.length && !cc.trim()) { setMsg('Elige al menos un destinatario (o pon un CC).'); return }
    setMsg(null); setFase('confirm')
  }

  async function enviarReal() {
    setGuardando(true); setMsg(null)
    const p = plantillas.find(x => String(x.id) === String(plantillaId))
    const res = await fetch('/api/cobranza/gestion', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idadmon: fila.idadmon, tipo, departamento, canal: 'email',
        destinos: destinosSel(), asunto, contenido,
        etapa: p?.etapa || null, plantilla_id: plantillaId || null,
        cc, cco, cco_propietario: ccoProp, propietario_email: emailProp,
        resultado, acuse, adjuntos,
        monto_adeudado: deuda, dias_mora: dias ?? null, monto_reclamado: total,
        contrato: contratoPayload, enviar: true,
      }),
    }).then(r => r.json()).catch(e => ({ error: String(e) }))
    setGuardando(false)
    if (res.error) { setMsg('Error: ' + res.error); setFase('compose'); return }
    setMsg('✓ Enviado y registrado')
    setFase('compose'); setContenido(''); setAsunto(''); setPlantillaId(''); setAdjuntos([]); setCcoProp(false); setCc(''); setCco('')
    cargar()
  }

  const s = {
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 300, display: 'flex', justifyContent: 'flex-end' },
    panel: { width: 580, maxWidth: '96vw', background: '#fff', height: '100vh', overflowY: 'auto', boxShadow: '-4px 0 32px rgba(0,0,0,0.12)' },
    section: { padding: '14px 22px', borderBottom: '1px solid #F0EEE8' },
    lbl: { fontSize: 10, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 },
    inp: { width: '100%', padding: '8px 10px', border: '1px solid #E0DDD8', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' },
    chk: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer' },
    mini: { fontSize: 11, color: '#888', marginBottom: 3 },
  }
  const btnSec = { fontSize: 12, padding: '7px 12px', borderRadius: 7, border: '1px solid ' + C.line, background: '#fff', color: C.txt, cursor: 'pointer', fontWeight: 600 }

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.panel}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #F0EEE8', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: '#FAFAF8' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>{fila.idadmon}</span>
              <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 3, background: C.rojoBg, color: C.rojo, fontWeight: 700 }}>{money(deuda)}</span>
              <span style={{ fontSize: 11, color: C.sub }}>{tipo === 'termino' ? 'término' : 'vigente'}{fila.dias_mora != null ? ' · ' + fila.dias_mora + 'd' : ''}</span>
            </div>
            <div style={{ fontSize: 13, color: '#555', marginTop: 3 }}>{fila.arrendatario || '—'}</div>
            <div style={{ fontSize: 11, color: '#999' }}>{fila.propietario || '—'} · {fila.inmueble || '—'}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => window.open('/api/cobranza/expediente?idadmon=' + encodeURIComponent(fila.idadmon), '_blank')} style={{
              fontSize: 11, padding: '5px 10px', borderRadius: 5, border: '1px solid ' + C.line, background: '#fff', color: C.txt, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap',
            }}>Expediente (PDF)</button>
            <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 22, cursor: 'pointer', color: '#bbb' }}>×</button>
          </div>
        </div>

        <div style={{ ...s.section, background: '#FFFDF6' }}>
          <div style={s.lbl}>Acciones que exige el sistema</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <AvisoRow ok={yaAval} pend={avalPendiente} txtPend="⚠ Reclamación al AVAL pendiente" txtOk="✓ Ya se reclamó al aval" />
            <AvisoRow ok={yaProp} pend={propPendiente} txtPend="⚠ Aviso al PROPIETARIO pendiente" txtOk="✓ Propietario ya avisado" />
          </div>
        </div>

        <div style={s.section}>
          <div style={s.lbl}>Contactos</div>
          {loading ? <div style={{ color: '#bbb', fontSize: 12 }}>Cargando…</div> : (
            <div style={{ fontSize: 12, color: '#444', lineHeight: 1.7 }}>
              <div><b>Arrendatario:</b> {contrato.arrendatario || '—'} · {contrato.rut || '—'} · {contrato.mail_arrendatario || 's/mail'} · {contrato.movil || ''}</div>
              <div><b>Aval:</b> {contrato.avalista || '—'} · {contrato.rut_avalista || '—'} · {contrato.mail_avalista || 's/mail'} · {contrato.telefono_avalista || ''}</div>
              <div><b>Propietario:</b> {contrato.propietario || fila.propietario || '—'}</div>
            </div>
          )}
        </div>

        <div style={{ ...s.section, background: '#FBFBF9' }}>
          <div style={s.lbl}>Registro rápido (constancia, sin email)</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
            <select style={{ ...s.inp, width: 140 }} value={rapParty} onChange={e => setRapParty(e.target.value)}>
              {['arrendatario', 'aval', 'propietario'].map(d => <option key={d} value={d}>{DEST_LBL[d]}</option>)}
            </select>
            <input style={{ ...s.inp, flex: 1, minWidth: 160 }} value={rapNota} onChange={e => setRapNota(e.target.value)} placeholder="Nota (ej: llamé, no contesta / paga el viernes)" />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => registrarRapido('llamada')} disabled={guardando} style={btnSec}>☎ Llamada</button>
            <button onClick={() => registrarRapido('whatsapp')} disabled={guardando} style={btnSec}>WhatsApp</button>
            <button onClick={() => registrarRapido('presencial')} disabled={guardando} style={btnSec}>Presencial</button>
          </div>
        </div>

        <div style={s.section}>
          <div style={s.lbl}>Enviar comunicación (email)</div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {[['cobranza', 'Cobranzas'], ['legal', 'Área Legal']].map(([k, lb]) => (
              <button key={k} onClick={() => { setDepartamento(k); setPlantillaId('') }} style={{
                flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                border: '1px solid ' + (departamento === k ? (k === 'legal' ? '#9B1C1C' : C.acento) : C.line),
                background: departamento === k ? (k === 'legal' ? C.rojoBg : '#E9F4E4') : '#fff',
                color: departamento === k ? (k === 'legal' ? C.rojo : C.verde) : C.sub,
              }}>{lb}</button>
            ))}
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={s.mini}>Plantilla ({departamento === 'legal' ? 'tono jurídico' : 'tono cobranza'})</div>
            <select style={s.inp} value={plantillaId} onChange={e => aplicarPlantilla(e.target.value)}>
              <option value="">— elegir plantilla —</option>
              {plantillasDep.map(p => <option key={p.id} value={p.id}>{DEST_LBL[p.destinatario] || p.destinatario} · {p.etapa}</option>)}
            </select>
          </div>

          {dias > 0 && (
            <div style={{ marginBottom: 10, background: '#FBF7EC', border: '1px solid #EADFBD', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 12, color: '#7a5b0b' }}>
                  Multa/interés: <b>{money(multa)}</b> <span style={{ color: C.sub }}>({dias}d × {pct}% de {money(deuda)})</span> · Total: <b>{money(total)}</b>
                </div>
                <label style={{ fontSize: 12, color: '#7a5b0b', display: 'flex', alignItems: 'center', gap: 6 }}>
                  % diario
                  <input type="number" step="0.1" min="0" max="10" value={pct} onChange={e => setPct(parseFloat(e.target.value) || 0)}
                    style={{ width: 64, padding: '5px 7px', border: '1px solid #E0DDD8', borderRadius: 6, fontSize: 12 }} />
                </label>
              </div>
              <div style={{ fontSize: 10, color: C.sub, marginTop: 4 }}>Usa {'{{multa}}'} y {'{{total}}'} en las plantillas. El cargo a la cuenta sigue en Morosidad.</div>
            </div>
          )}

          <div style={{ marginBottom: 10 }}>
            <div style={s.mini}>Para (destinatarios)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ ...s.chk, width: 120 }}><input type="checkbox" checked={toArr} onChange={e => setToArr(e.target.checked)} /> Arrendatario</label>
                <input style={{ ...s.inp, flex: 1 }} value={emailArr} onChange={e => setEmailArr(e.target.value)} placeholder="email arrendatario" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ ...s.chk, width: 120 }}><input type="checkbox" checked={toAval} onChange={e => setToAval(e.target.checked)} /> Aval</label>
                <input style={{ ...s.inp, flex: 1 }} value={emailAval} onChange={e => setEmailAval(e.target.value)} placeholder="email aval" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ ...s.chk, width: 120 }}><input type="checkbox" checked={toProp} onChange={e => setToProp(e.target.checked)} disabled={ccoProp} /> Propietario</label>
                <input style={{ ...s.inp, flex: 1 }} value={emailProp} onChange={e => setEmailProp(e.target.value)} placeholder="email propietario" />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
            <div>
              <div style={s.mini}>CC (copia visible)</div>
              <input style={s.inp} value={cc} onChange={e => setCc(e.target.value)} placeholder="correos separados por coma" />
            </div>
            <div>
              <div style={s.mini}>CCO (copia oculta)</div>
              <input style={s.inp} value={cco} onChange={e => setCco(e.target.value)} placeholder="correos separados por coma" />
            </div>
          </div>
          <label style={{ ...s.chk, marginBottom: 10, color: ccoProp ? C.rojo : C.txt, fontWeight: 600 }}>
            <input type="checkbox" checked={ccoProp} onChange={e => toggleCcoProp(e.target.checked)} />
            CCO al propietario (demostrarle que estamos gestionando){ccoProp && !emailProp.trim() ? ' — pon su email arriba' : ''}
          </label>

          <div style={{ marginBottom: 10 }}>
            <div style={s.mini}>Asunto</div>
            <input style={s.inp} value={asunto} onChange={e => setAsunto(e.target.value)} placeholder="Asunto" />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={s.mini}>Contenido (editable; queda como constancia exacta)</div>
            <textarea style={{ ...s.inp, height: 150, resize: 'vertical' }} value={contenido} onChange={e => setContenido(e.target.value)} placeholder="Texto del correo…" />
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={s.mini}>Adjuntos (viajan incrustados en el correo)</div>
            <input type="file" multiple onChange={onFiles} style={{ fontSize: 12 }} />
            {subiendo && <span style={{ fontSize: 12, color: C.sub, marginLeft: 8 }}>subiendo…</span>}
            {adjuntos.length > 0 && (
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {adjuntos.map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#444' }}>
                    <span>📎 {a.nombre} <span style={{ color: C.sub }}>({Math.round((a.size || 0) / 1024)} KB)</span></span>
                    <button onClick={() => setAdjuntos(x => x.filter((_, j) => j !== i))} style={{ border: 'none', background: 'none', color: C.rojo, cursor: 'pointer', fontSize: 14 }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <div style={s.mini}>Resultado</div>
              <select style={s.inp} value={resultado} onChange={e => setResultado(e.target.value)}>
                {['enviado', 'entregado', 'leido', 'compromiso', 'sin_respuesta', 'rechazado'].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <div style={s.mini}>Acuse / referencia</div>
              <input style={s.inp} value={acuse} onChange={e => setAcuse(e.target.value)} placeholder="opcional" />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
            <input style={{ ...s.inp, flex: 1 }} value={toTest} onChange={e => setToTest(e.target.value)} placeholder="correo de prueba (vacío = a ti mismo)" />
            <button onClick={probar} disabled={guardando} style={btnSec}>Probar</button>
          </div>

          {msg && <div style={{ fontSize: 12, marginBottom: 8, color: msg.startsWith('✓') ? C.verde : C.rojo }}>{msg}</div>}

          <button onClick={revisar} disabled={guardando} style={{
            width: '100%', padding: '11px 0', borderRadius: 8, border: 'none',
            background: departamento === 'legal' ? C.rojo : C.acento, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}>Revisar y enviar…</button>
        </div>

        <div style={s.section}>
          <div style={s.lbl}>Historial de gestiones ({gestiones.length})</div>
          {gestiones.length === 0 ? <div style={{ fontSize: 12, color: '#bbb' }}>Aún sin gestiones registradas.</div> : gestiones.map(g => (
            <div key={g.id} style={{ padding: '9px 0', borderBottom: '1px solid #F5F3EF' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>
                  {DEST_LBL[g.destinatario] || g.destinatario} · {g.canal}
                  {g.departamento ? <span style={{ fontSize: 10, color: g.departamento === 'legal' ? C.rojo : C.verde, marginLeft: 6, fontWeight: 700 }}>{g.departamento === 'legal' ? 'LEGAL' : 'COBR.'}</span> : null}
                </span>
                <span style={{ fontSize: 11, color: C.sub }}>{fechaHoraLocal(g.fecha)}</span>
              </div>
              {g.asunto && <div style={{ fontSize: 12, color: '#444', marginTop: 2 }}>{g.asunto}</div>}
              <div style={{ fontSize: 11, color: '#777', marginTop: 2, whiteSpace: 'pre-wrap' }}>{g.contenido_snapshot}</div>
              <div style={{ fontSize: 10, color: '#aaa', marginTop: 3 }}>
                {g.etapa || ''} · {g.resultado || ''} · {g.usuario}
                {g.destino_email ? ' · → ' + g.destino_email : ''}
                {Array.isArray(g.adjuntos) && g.adjuntos.length ? ' · 📎 ' + g.adjuntos.length : ''}
                {g.acuse ? ' · acuse: ' + g.acuse : ''}
              </div>
            </div>
          ))}
        </div>
      </div>

      {fase === 'confirm' && (
        <div onClick={() => setFase('compose')} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, boxShadow: '0 18px 50px rgba(0,0,0,0.25)', width: 'min(560px, 96vw)', maxHeight: '88vh', overflowY: 'auto', padding: 22 }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Revisa antes de enviar</div>
            <div style={{ fontSize: 12, color: C.sub, marginBottom: 12 }}>Nada sale hasta que pulses “Aceptar y enviar”.</div>
            <div style={{ fontSize: 13, lineHeight: 1.7, background: '#F8F8F6', border: '1px solid #ECEAE3', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
              <div><b>Desde:</b> {departamento === 'legal' ? 'Área Legal (legal@fondocapital.com)' : 'Cobranzas (cobranza@fondocapital.com)'}</div>
              <div><b>Para:</b> {destinosSel().map(d => DEST_LBL[d.party] + ' ‹' + d.email + '›').join(', ') || '—'}</div>
              {cc.trim() ? <div><b>CC:</b> {cc}</div> : null}
              {(cco.trim() || ccoProp) ? <div><b>CCO:</b> {[cco.trim(), ccoProp ? (emailProp.trim() || 'propietario (falta email)') : ''].filter(Boolean).join(', ')}</div> : null}
              <div><b>Asunto:</b> {asunto || '—'}</div>
              {adjuntos.length ? <div><b>Adjuntos:</b> {adjuntos.map(a => a.nombre).join(', ')}</div> : null}
            </div>
            <div style={{ fontSize: 12, color: '#555', whiteSpace: 'pre-wrap', maxHeight: 220, overflowY: 'auto', border: '1px solid #F0EEE8', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>{contenido}</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setFase('compose')} disabled={guardando} style={{ ...btnSec, padding: '10px 16px' }}>Cancelar / volver</button>
              <button onClick={enviarReal} disabled={guardando} style={{
                padding: '10px 18px', borderRadius: 8, border: 'none',
                background: guardando ? '#ccc' : (departamento === 'legal' ? C.rojo : C.acento), color: '#fff', fontSize: 14, fontWeight: 700, cursor: guardando ? 'default' : 'pointer',
              }}>{guardando ? 'Enviando…' : 'Aceptar y enviar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SaldosFavor() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [abierto, setAbierto] = useState(null)
  const [nota, setNota] = useState('')
  const [enviando, setEnviando] = useState(false)

  function cargar() {
    fetch('/api/cobranza/saldos-favor')
      .then(r => r.json())
      .then(j => { if (j.error) setError(j.error); else { setData(j); setError(null) }; setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }
  useEffect(() => { cargar() }, [])

  const puedeMover = !!(data && data.puedeMover)
  const sugs = (id) => (data && data.sugerencias && data.sugerencias[id]) || []

  async function enviarSugerencia(idadmon) {
    if (!nota.trim()) return
    setEnviando(true)
    const r = await fetch('/api/cobranza/saldos-favor', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idadmon, texto: nota }),
    }).then(r => r.json()).catch(e => ({ error: String(e) }))
    setEnviando(false)
    if (!r.error) { setNota(''); cargar() }
  }
  async function atender(id) {
    await fetch('/api/cobranza/saldos-favor', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'atender', id }),
    }).then(r => r.json()).catch(() => {})
    cargar()
  }

  const th = { fontSize: 11, fontWeight: 600, color: C.sub, textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid ' + C.line, whiteSpace: 'nowrap' }
  const td = { fontSize: 12, padding: '8px 10px', borderBottom: '0.5px solid ' + C.line, verticalAlign: 'top' }

  const renderFila = (f) => {
    const lista = sugs(f.idadmon)
    const abiertas = lista.filter(x => !x.atendida).length
    const open = abierto === f.idadmon
    return (
      <>
        <tr key={f.idadmon}>
          <td style={{ ...td, fontWeight: 600 }}>
            <a href={'/procesos/cartolas?idadmon=' + encodeURIComponent(f.idadmon)} target="_blank" rel="noopener noreferrer" style={{ color: '#185FA5', textDecoration: 'none' }}>{f.idadmon}</a>
            {f.mismo_piso && f.mismo_piso.length > 0 && <div style={{ fontSize: 10, color: C.ambar, marginTop: 2 }}>⚠ mismo piso: {f.mismo_piso.join(', ')}</div>}
          </td>
          <td style={td}>{f.propietario || '—'}</td>
          <td style={{ ...td, color: C.sub }}>{f.inmueble || '—'}</td>
          <td style={td}>{f.arrendatario || '—'}</td>
          <td style={{ ...td, textAlign: 'right', color: C.rojo, fontWeight: 700 }}>{money(Math.abs(f.saldo))}</td>
          <td style={{ ...td, textAlign: 'center' }}>
            <button onClick={() => { setAbierto(open ? null : f.idadmon); setNota('') }} style={{
              fontSize: 11, padding: '4px 9px', borderRadius: 6, cursor: 'pointer',
              border: '1px solid ' + (abiertas ? '#CFE0FF' : C.line), background: abiertas ? '#EEF4FF' : '#fff', color: abiertas ? '#1D4ED8' : C.sub, fontWeight: 600,
            }}>💬 {lista.length ? lista.length : 'Sugerir'}</button>
          </td>
        </tr>
        {open && (
          <tr key={f.idadmon + '-det'}>
            <td colSpan={6} style={{ ...td, background: '#FBFBF9' }}>
              {lista.map(x => (
                <div key={x.id} style={{ fontSize: 12, padding: '5px 0', borderBottom: '1px solid #F0EFEA', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ color: x.atendida ? C.sub : C.txt, textDecoration: x.atendida ? 'line-through' : 'none' }}>
                    <b>{String(x.autor || '').split('@')[0]}:</b> {x.texto}{x.atendida ? ' · atendida' : ''}
                  </span>
                  {puedeMover && !x.atendida && <button onClick={() => atender(x.id)} style={{ fontSize: 10, border: 'none', background: 'none', color: C.verde, cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}>✓ atendida</button>}
                </div>
              ))}
              {!lista.length && <div style={{ fontSize: 12, color: C.sub, marginBottom: 6 }}>Sin sugerencias todavía.</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input value={nota} onChange={e => setNota(e.target.value)} placeholder="Sugerencia para Karina (ej: posible abono de A00xxx / duplicado)…"
                  style={{ flex: 1, fontSize: 12, padding: '7px 9px', border: '1px solid ' + C.line, borderRadius: 6 }} />
                <button onClick={() => enviarSugerencia(f.idadmon)} disabled={enviando || !nota.trim()} style={{
                  fontSize: 12, padding: '7px 12px', borderRadius: 6, border: 'none', background: (enviando || !nota.trim()) ? '#ccc' : C.acento, color: '#fff', fontWeight: 700, cursor: 'pointer',
                }}>Enviar</button>
              </div>
              {puedeMover && <div style={{ fontSize: 11, color: C.sub, marginTop: 8 }}>El traslado del importe al puente A00000 (solo Karina/Dirección) se añadirá aquí.</div>}
            </td>
          </tr>
        )}
      </>
    )
  }

  const renderGrupo = (titulo, filas, resumen) => (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{titulo}</h2>
        <span style={{ fontSize: 12, color: C.sub }}>{resumen.n} contratos · a favor {money(Math.abs(resumen.total))}</span>
      </div>
      {filas.length === 0 ? <div style={{ fontSize: 13, color: C.sub, padding: '8px 0' }}>Sin casos.</div> : (
        <div style={{ border: '1px solid ' + C.line, borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead><tr>
              <th style={th}>IDADMON</th><th style={th}>Propietario</th><th style={th}>Inmueble</th>
              <th style={th}>Arrendatario</th><th style={{ ...th, textAlign: 'right' }}>Saldo a favor</th>
              <th style={{ ...th, textAlign: 'center' }}>Sugerencias</th>
            </tr></thead>
            <tbody>{filas.map(renderFila)}</tbody>
          </table>
        </div>
      )}
    </div>
  )

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <a href="/procesos/cartolas/auditar" style={{ fontSize: 12, fontWeight: 700, padding: '7px 12px', borderRadius: 8, border: '1px solid #EADFBD', background: '#FBF7EC', color: '#7a5b0b', textDecoration: 'none' }}>🔎 Abrir panel completo · Cartolas a auditar (incluye deudas) →</a>
      </div>
      <div style={{ fontSize: 13, color: C.txt, marginBottom: 16, background: '#FBF7EC', border: '1px solid #EADFBD', borderRadius: 8, padding: '10px 12px' }}>
        Contratos con <b>saldo a favor del arrendatario</b> por encima de {money((data && data.tolerancia) || 10000)}: casi siempre un <b>abono asignado a un IDADMON equivocado</b> o duplicado. Adalis y Fabiola pueden <b>sugerir</b> aquí; el traslado al puente A00000 lo hace <b>solo Karina/Dirección</b>. El IDADMON abre su Cartola.
      </div>
      {loading && <div style={{ padding: 30, color: C.sub }}>Calculando…</div>}
      {error && <div style={{ padding: 16, color: C.rojo, fontSize: 13 }}>Error: {error}</div>}
      {data && (<>
        {renderGrupo('Vigentes (S / SQ)', data.vigente, data.resumen.vigente)}
        {renderGrupo('En término (Q)', data.termino, data.resumen.termino)}
      </>)}
    </div>
  )
}

function AvisoRow({ ok, pend, txtPend, txtOk }) {
  if (ok) return <div style={{ fontSize: 12, color: C.verde, fontWeight: 600 }}>{txtOk}</div>
  if (pend) return <div style={{ fontSize: 12, color: C.rojo, fontWeight: 700 }}>{txtPend}</div>
  return <div style={{ fontSize: 12, color: C.sub }}>—</div>
}

function WlChip({ label, n, rojo }) {
  const on = n > 0
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20,
      background: on ? (rojo ? C.rojoBg : '#EEF4FF') : '#F3F2EE',
      border: '1px solid ' + (on ? (rojo ? '#F0CFCB' : '#CFE0FF') : C.line),
    }}>
      <span style={{ fontSize: 12, fontWeight: on ? 700 : 500, color: on ? (rojo ? C.rojo : '#1D4ED8') : C.sub }}>{n}</span>
      <span style={{ fontSize: 11, color: on ? C.txt : C.sub }}>{label}</span>
    </div>
  )
}

// ─── Casos (semáforo del propietario) ───────────────────────────────────────
function semaforoCaso(r) {
  const prop = !!(r && r.destinatarios && r.destinatarios.includes('propietario'))
  const aval = !!(r && r.destinatarios && r.destinatarios.includes('aval'))
  if (prop && aval) return { ic: '🟢', color: C.verde, txt: 'En regla' }
  if (prop || aval) return { ic: '🟡', color: C.ambar, txt: 'En curso' }
  return { ic: '🔴', color: C.rojo, txt: 'Sin avisar' }
}
function filaDeCaso(c) {
  return {
    idadmon: c.idadmon, deuda: c.monto_adeudado, dias_mora: c.dias_mora,
    grupo: c.tipo === 'termino' ? 'termino' : 'vigente',
    propietario: c.propietario, inmueble: c.propiedad, arrendatario: c.arrendatario, ultimo_abono: null,
  }
}

function CasosView() {
  const [casos, setCasos] = useState(null)
  const [resumen, setResumen] = useState({})
  const [error, setError] = useState(null)
  const [gestionar, setGestionar] = useState(null)
  const [sync, setSync] = useState(null)
  const [sincronizando, setSincronizando] = useState(false)

  function cargar() {
    fetch('/api/cobranza/gestion?casos=1').then(r => r.json())
      .then(j => { if (j.error) setError(j.error); else setCasos(j.casos || []) }).catch(e => setError(String(e)))
    fetch('/api/cobranza/gestion?resumen=1').then(r => r.json())
      .then(j => { const m = {}; for (const x of (j.resumen || [])) m[x.idadmon] = x; setResumen(m) }).catch(() => {})
  }
  useEffect(() => { cargar() }, [])

  async function sincronizar() {
    setSincronizando(true); setSync(null)
    const r = await fetch('/api/cobranza/gestion', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'sync_terminos' }),
    }).then(r => r.json()).catch(e => ({ error: String(e) }))
    setSincronizando(false)
    setSync(r.error ? ('Error: ' + r.error) : ('✓ ' + r.creados + ' caso(s) nuevo(s) · ' + r.total_deficit + ' términos con déficit'))
    cargar()
  }

  const th = { fontSize: 11, fontWeight: 600, color: C.sub, textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid ' + C.line, whiteSpace: 'nowrap' }
  const td = { fontSize: 12, padding: '8px 10px', borderBottom: '0.5px solid ' + C.line, verticalAlign: 'top' }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>Casos de cobranza</span>
        <button onClick={sincronizar} disabled={sincronizando} style={{
          fontSize: 12, padding: '6px 12px', borderRadius: 6, border: '1px solid ' + C.acento,
          background: '#fff', color: C.acento, cursor: sincronizando ? 'default' : 'pointer', fontWeight: 600,
        }}>{sincronizando ? 'Sincronizando…' : 'Abrir casos de términos con déficit'}</button>
        {sync && <span style={{ fontSize: 12, color: sync.startsWith('Error') ? C.rojo : C.verde }}>{sync}</span>}
        <button onClick={cargar} style={{ marginLeft: 'auto', fontSize: 12, padding: '5px 12px', border: '1px solid ' + C.line, borderRadius: 6, background: '#fff', cursor: 'pointer' }}>↺ Actualizar</button>
      </div>

      {error && <div style={{ padding: 20, color: C.rojo, fontSize: 13 }}>Error: {error}</div>}
      {!casos && !error && <div style={{ padding: 40, textAlign: 'center', color: C.sub }}>Cargando casos…</div>}
      {casos && casos.length === 0 && <div style={{ padding: 24, color: C.sub, fontSize: 13 }}>No hay casos abiertos. Usa "Abrir casos de términos con déficit" o gestiona un moroso desde Cartolas.</div>}

      {casos && casos.length > 0 && (
        <div style={{ overflowX: 'auto', border: '0.5px solid ' + C.line, borderRadius: 8 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1000 }}>
            <thead><tr>
              <th style={{ ...th, textAlign: 'center' }}>Semáforo</th>
              <th style={th}>IDADMON</th>
              <th style={th}>Tipo</th>
              <th style={th}>Propietario / Inmueble</th>
              <th style={th}>Arrendatario</th>
              <th style={th}>Aval</th>
              <th style={{ ...th, textAlign: 'right' }}>Monto</th>
              <th style={th}>Pendiente</th>
              <th style={{ ...th, textAlign: 'center' }}>Gestión</th>
            </tr></thead>
            <tbody>
              {casos.map(c => {
                const r = resumen[c.idadmon]
                const sem = semaforoCaso(r)
                const faltaProp = !(r && r.destinatarios && r.destinatarios.includes('propietario'))
                const faltaAval = !(r && r.destinatarios && r.destinatarios.includes('aval'))
                const falta = [faltaProp && 'Avisar propietario', faltaAval && 'Reclamar aval'].filter(Boolean).join(' · ')
                return (
                  <tr key={c.id}>
                    <td style={{ ...td, textAlign: 'center' }} title={sem.txt}>{sem.ic}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{c.idadmon}</td>
                    <td style={td}>{c.tipo === 'termino' ? 'Término' : 'Vigente'}</td>
                    <td style={td}><div style={{ fontWeight: 600 }}>{c.propietario || '—'}</div><div style={{ color: C.sub, fontSize: 11 }}>{c.propiedad || ''}</div></td>
                    <td style={{ ...td, color: C.sub }}>{c.arrendatario || '—'}</td>
                    <td style={{ ...td, color: C.sub }}>{c.aval || '—'}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 600, color: C.rojo, fontVariantNumeric: 'tabular-nums' }}>{money(c.monto_adeudado)}</td>
                    <td style={{ ...td, fontWeight: falta ? 700 : 400, color: falta ? C.rojo : C.verde }}>{falta || '✓ en regla'}</td>
                    <td style={{ ...td, textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <button onClick={() => setGestionar(c)} style={{
                        fontSize: 11, padding: '4px 10px', borderRadius: 5, border: '1px solid ' + C.acento,
                        background: '#fff', color: C.acento, cursor: 'pointer', fontWeight: 600,
                      }}>Gestionar</button>
                      <button onClick={() => window.open('/api/cobranza/expediente?idadmon=' + encodeURIComponent(c.idadmon), '_blank')} style={{
                        fontSize: 11, padding: '4px 8px', borderRadius: 5, border: '1px solid ' + C.line,
                        background: '#fff', color: C.sub, cursor: 'pointer', marginLeft: 6,
                      }}>PDF</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {gestionar && <CobranzaDrawer fila={filaDeCaso(gestionar)} onClose={() => { setGestionar(null); cargar() }} />}
    </div>
  )
}

// ─── Bitácora global ────────────────────────────────────────────────────────
function Bitacora() {
  const [gestiones, setGestiones] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/cobranza/gestion?log=1').then(r => r.json())
      .then(j => { if (j.error) setError(j.error); else setGestiones(j.gestiones || []) })
      .catch(e => setError(String(e)))
  }, [])

  if (error) return <div style={{ padding: 20, color: C.rojo, fontSize: 13 }}>Error: {error}</div>
  if (!gestiones) return <div style={{ padding: 40, textAlign: 'center', color: C.sub }}>Cargando bitácora…</div>
  if (!gestiones.length) return <div style={{ padding: 24, color: C.sub, fontSize: 13 }}>Aún no hay gestiones registradas.</div>

  const th = { fontSize: 11, fontWeight: 600, color: C.sub, textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid ' + C.line, whiteSpace: 'nowrap' }
  const td = { fontSize: 12, padding: '8px 10px', borderBottom: '0.5px solid ' + C.line, verticalAlign: 'top' }

  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Bitácora de gestiones · {gestiones.length}</div>
      <div style={{ overflowX: 'auto', border: '0.5px solid ' + C.line, borderRadius: 8 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 820 }}>
          <thead><tr>
            <th style={th}>Fecha</th><th style={th}>IDADMON</th><th style={th}>Destinatario</th>
            <th style={th}>Canal</th><th style={th}>Etapa</th><th style={th}>Asunto</th>
            <th style={th}>Resultado</th><th style={th}>Usuario</th>
          </tr></thead>
          <tbody>
            {gestiones.map(g => (
              <tr key={g.id}>
                <td style={{ ...td, whiteSpace: 'nowrap', color: C.sub }}>{fechaHoraLocal(g.fecha)}</td>
                <td style={{ ...td, fontWeight: 600 }}>{g.idadmon}</td>
                <td style={td}>{DEST_LBL[g.destinatario] || g.destinatario}</td>
                <td style={td}>{g.canal}</td>
                <td style={td}>{g.etapa || '—'}</td>
                <td style={{ ...td, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.asunto || '—'}</td>
                <td style={td}>{g.resultado || '—'}</td>
                <td style={{ ...td, color: C.sub }}>{g.usuario}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
