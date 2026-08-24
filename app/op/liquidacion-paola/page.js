// VERSION: v30 · 2026-08-24 · Pestaña GARANTÍAS rehecha: roster EDITABLE del mes (maestro datos_arriendos + ajustes),
//   igual que la hoja del Excel. Se editan pedida, quién, deuda y las cuotas (fecha/monto/cobrado); el ajuste se guarda
//   como override del mes (no toca el maestro), marca la fila (✎) y permite revertir. Hereda v29.
// VERSION: v29 · 2026-08-24 · Pestaña JUSTIFICANTES: pega (Ctrl+V) o arrastra imágenes → se suben al CRM (Storage vía
//   route) y se incrustan en la hoja Comprobantes del Excel. Rejilla con vista previa (URL firmada) y borrado.
//   Opcionalmente se asocian a un contrato. Hereda v28.
// VERSION: v28 · 2026-08-24 · Banner de estado del mes: "Liquidación enviada" (congelada al enviar, editable como
//   rectificación) y "Mes congelado" (cierre oficial, solo lectura), leídos de paola_cierres vía el GET. Tras un
//   envío real se refresca el estado. Hereda v27.
// VERSION: v27 · 2026-08-24 · Pestaña BITÁCORA (solo Dirección/Karina, según puedeBitacora del GET): registro de
//   cambios de la liquidación (fecha/hora, autor, idadmon, campo, antes→después) leído de paola_liquidacion_log.
//   Hereda v26.
// VERSION: v26 · 2026-08-24 · (1) Columna RECIBIDO editable a mano (para corregir un pago del justificante aún sin
//   discriminar antes de generar el Excel); recalcula Falta y fluye al guardado y al Excel. (2) Barra de acciones +
//   pestañas + cabecera de la tabla STICKY bajo el TopNav (top 52/106/tabla), con la tabla en contenedor de altura
//   acotada para que el scroll horizontal sea alcanzable. Hereda v25.
// VERSION: v25 · 2026-08-23 · Dos pestañas nuevas. GARANTÍAS: registro de cuotas por contrato (idadmon, mes, nº, monto,
//   bodega, total, fecha, pagada, nota) contra paola_garantias, con resumen por contrato (pagado/pendiente) y calendario
//   de cuotas (mes en curso resaltado, borrado por fila). RADAR: descuadres del mes — sobrepagos sin cuota de garantía
//   (con atajo "Registrar cuota") y pagos parciales; enlaza a Sin identificar. Hereda v24.
// VERSION: v24 · 2026-08-23 · Pagos combinados (arriendo + garantía + bodega): la fila muestra Recibido TOPADO al
//   arriendo (FALTA 0) con un chip "tope" (tooltip con el bruto y el excedente), y el Comentario 1 se PRECARGA con el
//   desglose sugerido por el route (editable; solo si no hay comentario guardado). Hereda v23.
// VERSION: v23 · 2026-08-19 · Panel Email a Paola con VISTA PREVIA EDITABLE de la carta (asunto + cuerpo, textarea) que se
//   regenera al abrir/cambiar de envío; se manda el texto editado. Requiere route v17. Hereda v22.
// VERSION: v22 · 2026-08-19 · La tabla de la liquidación se ordena SIEMPRE alfabéticamente por propiedad en el propio
//   render (localeCompare es, numérico), para que en pantalla salga ordenada pase lo que pase. Hereda v21.
// VERSION: v21 · 2026-08-19 · "Guardar en Drive" pasa a "✉ Email a Paola": panel con selector 1º/2º/3º, correo de
//   PRUEBA opcional y estado de lo ya enviado; manda el Excel adjunto + progreso de cobranza (acción 'enviar' del
//   route v14) y archiva en Drive. Requiere route v14 y paolaExcel v7. Hereda v20.
// VERSION: v20 · 2026-08-19 · Al generar el Excel se envía también `cartolaRows` (cartola completa) para la hoja
//   "Movimientos cuenta" (toda la cartola + IdAdmon/Inmueble). Requiere route v13 y paolaExcel v6. Hereda v19.
// VERSION: v19 · 2026-08-19 · Cabecera del panel de ayuda lleva el lema en mayúsculas del proceso (controlado por
//   Adalis; objetivo enviar 2 días tras la cartola). El Excel usa lib/paolaExcel v5 (Movimientos con IdAdmon). Hereda v18.
// VERSION: v18 · 2026-08-19 · El Excel de Paola (Descargar Control / Guardar en Drive) se genera con el nuevo diseño
//   profesional y multi-hoja: se envían también los movimientos de la cartola para la hoja "Movimientos cuenta".
//   Requiere lib/paolaExcel v4 y route v12. Hereda v17.
// VERSION: v17 · 2026-08-19 · Claridad de guardado: botones "💾 Guardar cambios" y "🔄 Ver lo guardado" (direcciones
//   opuestas, no se fusionan) + chip de estado "● Cambios sin guardar" (ámbar) / "✓ Guardado" (verde) que quita la
//   duda de si quedó persistido. Hereda v16.
// VERSION: v16 · 2026-08-19 · Botón "🔄 Refrescar con lo guardado": relee liquidacion_paola y muestra EXACTAMENTE lo
//   guardado en el CRM (limpia el buffer local; avisa si hay cambios sin guardar). Para confirmar de un vistazo que lo
//   tecleado quedó. Hereda v15.
// VERSION: v15 · 2026-08-19 · FIX pérdida de datos manuales al "Guardar mes en el CRM": (1) el buffer `edits` ya
//   NO se pisa en un refresco de `datos` — se fusiona conservando lo tecleado; (2) el guardado por celda (onBlur)
//   es silencioso y no deshabilita el botón del mes en mitad del clic (antes la carrera evitaba que se guardara
//   el mes). Los comentarios/columnas manuales ya no se pierden. Hereda v14.
// VERSION: v14 · 2026-08-18 · Estado de pago por contrato (columnas manuales): selector PAGADO / Pago atrasado /
//   No pagó + Nota, que marca Administración. Aclara los "pagos que parecen del mes pero son atrasados". Se
//   guarda en liquidacion_paola y sale en el Excel de Paola. Requiere route v11. Hereda v13.
// VERSION: v13 · 2026-08-17 · Botón "📂 Abrir lo guardado" en la ventana inicial: carga el mes ya guardado
//   (lo que dejó otra persona) sin re-procesar, para que Fabiola revise/continúe lo de Adalis. Requiere route v9.
// VERSION: v12 · 2026-08-17 · Aviso al RE-PROCESAR: si ya hay una liquidación en pantalla, "Procesar" pide
//   confirmación porque recalcular desde la cartola pisa lo tecleado sin guardar. Hereda v11.
// VERSION: v11 · 2026-08-17 · Robustez de la edición del mes: (1) las columnas manuales se teclean en un
//   BUFFER local (`edits`) — teclear ya NO re-renderiza toda la tabla ni pierde el foco; se guardan al salir
//   de la celda y con "💾 Guardar mes en el CRM"; el Excel exporta lo tecleado. (2) Servicios (GGCC/Luz/Agua)
//   se muestran en blanco si no hay dato (nada de "—"). (3) Líneas de cuadrícula entre celdas (salvo 1ª col).
//   (4) Ayuda "Cómo se trabaja" actualizada: lo manual se rellena AQUÍ, ya no en el Excel. Requiere route v8.
// VERSION: v10 · 2026-08-17 · Columnas MANUALES editables en la tabla del mes (Multas/Deudas, Especial,
//   Cantidad, Comentarios 1 y 2) que se GUARDAN en el CRM (liquidacion_paola) + botón "💾 Guardar mes en
//   el CRM". Con esto Adalis trabaja aquí y deja el Excel (que se sigue exportando con el mismo formato).
//   Lo editado se refleja en pantalla y en el Excel. Requiere route v8. Hereda v9.
// VERSION: v9 · 2026-08-16 · Botón "Histórico / hojas" en la cabecera → /op/liquidacion-paola/historico
//   (matriz A cobrar por idadmon × mes + RUT↔idadmon). Hereda v8.
// VERSION: v8 · 2026-08-16 · Nota "A cobrar calculado en vivo" cuando el mes no está congelado (avisos.enVivo del
//   route v7): el A cobrar sale del RPC en vivo, no de la foto congelada. Hereda v7.
// VERSION: v7 · 2026-07-23 · Panel de ayuda desplegable «Cómo se hace», colgado en la propia
//   pantalla. Distingue lo que hace el CRM de lo que sigue siendo manual, para no mandar a
//   Administración a botones que aún no existen. Se recuerda plegado/desplegado por sesión.
// v6 · Botones para generar el Control: descargarlo o guardarlo en la
//   carpeta de Drive P001 PAOLA con la nomenclatura de siempre.
// v5 · Cruce sobre el BUSCADOR. Nueva pestaña "No es renta" (ingresos de
//   Paola ajenos al arriendo) y, en "Sin identificar", un desplegable por abono para asignarlo a
//   un contrato o marcarlo como no-renta: esa confirmación alimenta el buscador.
'use client'

import { useState, useEffect, useRef, Fragment } from 'react'
import TopNav from '../../components/ui/TopNav'
import { useRouter } from 'next/navigation'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const COLOR_CONFIANZA = {
  alta: { bg: '#f0fdf4', color: '#16a34a', label: '✓ Alta' },
  media: { bg: '#eff6ff', color: '#1a56db', label: '~ Media' },
  sugerida: { bg: '#fffbeb', color: '#d97706', label: '? Sugerida' },
  baja: { bg: '#fef3c7', color: '#d97706', label: '⚠ Baja' },
}

const num = n => (n == null ? '—' : Number(n).toLocaleString('es-CL'))
// Parseo tolerante de un importe tecleado (quita puntos de miles y símbolos): "383.800" → 383800
const aNum = v => { const n = Number(String(v ?? '').replace(/[.\s$]/g, '').replace(/[^\d-]/g, '')); return isNaN(n) ? 0 : n }
const fecha = s => (s ? String(s).split('-').reverse().join('-') : '—')

export default function LiquidacionPaolaPage() {
  const router = useRouter()
  const inputRef = useRef(null)

  const [mes, setMes] = useState('')
  const [archivosDrive, setArchivosDrive] = useState([])
  const [driveId, setDriveId] = useState('')
  const [errorDrive, setErrorDrive] = useState(null)
  const [archivoLocal, setArchivoLocal] = useState(null)
  const [arrastrando, setArrastrando] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('liquidacion')
  const [abierta, setAbierta] = useState(null)
  const [eleccion, setEleccion] = useState({})
  const [confirmando, setConfirmando] = useState(null)
  const [generando, setGenerando] = useState(false)
  const [avisoExcel, setAvisoExcel] = useState(null)
  const [ayuda, setAyuda] = useState(false)
  const [guardandoMes, setGuardandoMes] = useState(false)
  const [avisoGuardado, setAvisoGuardado] = useState(null)
  const [edits, setEdits] = useState({})   // buffer de las columnas manuales por idadmon (no toca `datos` al teclear)
  const [dirty, setDirty] = useState(false)   // hay algo tecleado que aún no se ha persistido en el CRM
  // Envío a Paola (1º/2º/3º)
  const [envioAbierto, setEnvioAbierto] = useState(false)
  const [envioNum, setEnvioNum] = useState(1)
  const [envioPrueba, setEnvioPrueba] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [avisoEnvio, setAvisoEnvio] = useState(null)
  const [envios, setEnvios] = useState([])
  const [cartaAsunto, setCartaAsunto] = useState('')
  const [cartaCuerpo, setCartaCuerpo] = useState('')
  const [cartaCargando, setCartaCargando] = useState(false)
  // Control de garantías por cuotas
  const [garantias, setGarantias] = useState([])
  const [garCargando, setGarCargando] = useState(false)
  const [garGuardando, setGarGuardando] = useState(false)
  const [garAviso, setGarAviso] = useState(null)
  const garVacia = { idadmon: '', mes: '', n_cuota: '', monto: '', bodega_monto: '', garantia_total: '', fecha: '', nota: '', pagada: true }
  const [garForm, setGarForm] = useState(garVacia)
  // Garantías editables (roster efectivo del mes = maestro + ajustes)
  const [garRoster, setGarRoster] = useState([])
  const [garAjustados, setGarAjustados] = useState([])
  const [garRosterCargando, setGarRosterCargando] = useState(false)
  const [garEdits, setGarEdits] = useState({})   // buffer de inputs: clave `${idadmon}|${campo}`
  // Bitácora (solo Dirección/Karina)
  const [puedeBitacora, setPuedeBitacora] = useState(false)
  const [bitacora, setBitacora] = useState([])
  const [bitCargando, setBitCargando] = useState(false)
  const [cierre, setCierre] = useState(null)   // estado del mes: enviado_en / congelado
  // Justificantes (imágenes)
  const [justificantes, setJustificantes] = useState([])
  const [justSubiendo, setJustSubiendo] = useState(false)
  const [justIdadmon, setJustIdadmon] = useState('')
  const [justAviso, setJustAviso] = useState(null)

  useEffect(() => {
    const h = new Date()
    setMes(`${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`)
  }, [])

  // Detección automática de la cartola del mes en Drive
  useEffect(() => {
    if (!mes) return
    setDatos(null); setError(null); setArchivoLocal(null); setDriveId('')
    fetch(`/api/liquidacion-paola?mes=${mes}`)
      .then(r => r.json())
      .then(d => {
        if (!d.ok) return
        setPuedeBitacora(!!d.puedeBitacora)
        setCierre(d.cierre || null)
        const files = d.files || []
        setArchivosDrive(files)
        setErrorDrive(d.errorDrive || null)
        const delMes = files.filter(f => f.name.includes(`${mes}-Cartola`))
        if (delMes.length === 1) setDriveId(delMes[0].id)
      })
      .catch(() => {})
  }, [mes])

  // Al procesar un mes, precargar el buffer de columnas manuales con lo que traiga la liquidación
  // (lo guardado en liquidacion_paola). Así lo tecleado se conserva y se puede exportar/guardar.
  useEffect(() => {
    if (!datos?.resultado) { setEdits({}); return }
    // Fusión NO destructiva: los valores del servidor son el punto de partida, pero lo que el usuario
    // ya tecleó (prev) MANDA y NUNCA se pisa por un refresco de `datos`. Antes esto reiniciaba el buffer
    // y se perdían los comentarios/columnas manuales sin guardar.
    setEdits(prev => {
      const e = {}
      for (const r of datos.resultado) {
        const servidor = {
          multasDeudas: r.multasDeudas ?? '', especial: r.especial ?? '', cantidad: r.cantidad ?? '',
          comentarios1: (r.comentarios1 ?? '') || r.comentario1Sugerido || '', comentarios2: r.comentarios2 ?? '',
          estadoPago: r.estadoPago ?? '', notaPago: r.notaPago ?? '',
          recibidoEdit: r.recibido == null ? '' : String(r.recibido),
        }
        e[r.idadmon] = { ...servidor, ...(prev[r.idadmon] || {}) }
      }
      return e
    })
  }, [datos])

  const mesLabel = () => {
    if (!mes) return ''
    const [y, m] = mes.split('-')
    return `${MESES[parseInt(m, 10) - 1]} ${y}`
  }

  function aceptarArchivo(f) {
    if (!f) return
    if (!/\.xlsx?$/i.test(f.name)) { setError('La cartola tiene que ser un archivo .xlsx'); return }
    setError(null); setArchivoLocal(f); setDriveId(''); setDatos(null)
  }

  async function procesar() {
    // Aviso antes de re-procesar: recalcular desde la cartola PISA lo que hay en pantalla, incluidas las
    // columnas manuales sin guardar. Si ya se pulsó "Guardar mes en el CRM", se recuperan al recargar.
    if (datos?.resultado?.length) {
      const ok = window.confirm(
        'Ya hay una liquidación de este mes cargada.\n\n' +
        'Si vuelves a procesar, se recalcula TODO desde la cartola y se PIERDEN los cambios manuales que no hayas guardado (Multas/Deudas, Especial, Cantidad, Comentarios).\n\n' +
        'Si ya pulsaste «💾 Guardar mes en el CRM», se recuperan al recargar.\n\n' +
        '¿Volver a procesar?')
      if (!ok) return
    }
    setProcesando(true); setError(null)
    try {
      const body = { mes }
      if (archivoLocal) {
        const bytes = new Uint8Array(await archivoLocal.arrayBuffer())
        let bin = ''
        for (let i = 0; i < bytes.length; i += 8192) {
          bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192))
        }
        body.cartolaBase64 = btoa(bin)
      } else if (driveId) {
        body.cartolaDriveId = driveId
      }
      const res = await fetch('/api/liquidacion-paola', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const d = await res.json()
      if (d.ok) { setDatos(d); setTab('liquidacion'); setAbierta(null) }
      else setError(d.error || 'Error al procesar')
    } catch (e) {
      setError('Error de conexión: ' + e.message)
    }
    setProcesando(false)
  }

  async function confirmar(abono) {
    const valor = eleccion[abono.clave]
    if (!valor) return
    setConfirmando(abono.clave)
    try {
      const res = await fetch('/api/liquidacion-paola', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'confirmar', clave: abono.clave, rut: abono.rut, glosa: abono.detalle,
          idadmon: valor === 'NO_RENTA' ? null : valor,
          clase: valor === 'NO_RENTA' ? 'no_es_renta' : 'renta',
        }),
      })
      const d = await res.json()
      if (!d.ok) { setError(d.error || 'No se pudo guardar'); setConfirmando(null); return }
      await procesar()                    // se vuelve a cruzar ya con el buscador actualizado
    } catch (e) {
      setError('Error de conexión: ' + e.message)
    }
    setConfirmando(null)
  }

  // El Excel se arma con lo que hay en pantalla: lo que ves es lo que sale.
  async function generarExcel(guardarEnDrive) {
    if (!datos?.resultado?.length) return
    setGenerando(true); setError(null); setAvisoExcel(null)
    try {
      const res = await fetch('/api/liquidacion-paola', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'excel', mes, guardarEnDrive, filas: filasConEdits(), movimientos: datos?.movimientos || [], cartolaRows: datos?.cartolaRows || [] }),
      })
      const d = await res.json()
      if (!d.ok) { setError(d.error || 'No se pudo generar el Excel'); setGenerando(false); return }

      if (!guardarEnDrive) {
        const bytes = Uint8Array.from(atob(d.excelBase64), c => c.charCodeAt(0))
        const url = URL.createObjectURL(new Blob([bytes], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }))
        const a = document.createElement('a')
        a.href = url; a.download = d.nombre; a.click()
        URL.revokeObjectURL(url)
        setAvisoExcel(`Descargado ${d.nombre}`)
      } else if (d.drive) {
        setAvisoExcel(`${d.drive.accion === 'creado' ? 'Creado' : 'Sobrescrito'} en Drive: ${d.nombre}`)
      } else {
        setError(`No se pudo guardar en Drive: ${d.errorDrive || 'motivo desconocido'}`)
      }
    } catch (e) {
      setError('Error de conexión: ' + e.message)
    }
    setGenerando(false)
  }

  // Envíos ya hechos a Paola de este mes (para el panel de "Email a Paola").
  async function cargarEnvios() {
    if (!mes) return
    try {
      const res = await fetch('/api/liquidacion-paola', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'envios', mes }),
      })
      const d = await res.json()
      if (d.ok) setEnvios(d.envios || [])
    } catch { /* silencioso */ }
  }
  useEffect(() => { if (datos?.resultado?.length) cargarEnvios() }, [mes, datos])

  // ── Control de garantías por cuotas ────────────────────────────────────────
  async function cargarGarantias() {
    setGarCargando(true)
    try {
      const res = await fetch('/api/liquidacion-paola', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'garantias_list' }),
      })
      const d = await res.json()
      if (d.ok) setGarantias(d.garantias || [])
    } catch { /* silencioso */ }
    setGarCargando(false)
  }
  useEffect(() => { if (tab === 'radar') cargarGarantias() }, [tab])

  // Roster editable de garantías (maestro + ajustes del mes)
  async function cargarGarantiasRoster() {
    if (!mes) return
    setGarRosterCargando(true)
    try {
      const res = await fetch('/api/liquidacion-paola', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'garantias_roster', mes }),
      })
      const d = await res.json()
      if (d.ok) {
        setGarRoster(d.roster || [])
        setGarAjustados(d.ajustados || [])
        const e = {}
        for (const r of d.roster || []) for (const c of ['garantia_pedida', 'deuda_garantia', 'quien_tiene_garantia', 'fecha1', 'cuota1', 'cobrada1', 'fecha2', 'cuota2', 'cobrada2', 'fecha3', 'cuota3', 'cobrada3', 'fecha4', 'cuota4', 'cobrada4']) e[`${r.idadmon}|${c}`] = r[c] ?? ''
        setGarEdits(e)
      }
    } catch { /* silencioso */ }
    setGarRosterCargando(false)
  }
  useEffect(() => { if (tab === 'garantias') cargarGarantiasRoster() }, [tab, mes])

  async function guardarOverride(idadmon, campo, valor) {
    try {
      const res = await fetch('/api/liquidacion-paola', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'garantias_override_set', mes, idadmon, campo, valor }),
      })
      const d = await res.json()
      if (d.ok) cargarGarantiasRoster()   // refresca importes calculados y marca de "ajustado"
    } catch { /* silencioso */ }
  }
  async function revertirGarantia(idadmon) {
    try {
      await fetch('/api/liquidacion-paola', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'garantias_override_clear', mes, idadmon }),
      })
      cargarGarantiasRoster()
    } catch { /* silencioso */ }
  }

  async function guardarCuota() {
    if (!garForm.idadmon) { setGarAviso('Elige un contrato'); return }
    if (!garForm.mes) { setGarAviso('Indica el mes de la cuota (AAAA-MM)'); return }
    setGarGuardando(true); setGarAviso(null)
    try {
      const res = await fetch('/api/liquidacion-paola', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'garantias_upsert', cuota: garForm }),
      })
      const d = await res.json()
      if (!d.ok) { setGarAviso(d.error || 'No se pudo guardar la cuota'); setGarGuardando(false); return }
      setGarForm(garVacia)
      setGarAviso('Cuota registrada')
      await cargarGarantias()
      setTimeout(() => setGarAviso(null), 3000)
    } catch (e) { setGarAviso('Error de conexión: ' + e.message) }
    setGarGuardando(false)
  }

  async function borrarCuota(id) {
    try {
      const res = await fetch('/api/liquidacion-paola', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'garantias_delete', id }),
      })
      const d = await res.json()
      if (d.ok) setGarantias(gs => gs.filter(g => g.id !== id))
    } catch { /* silencioso */ }
  }

  // ── Justificantes (imágenes) ───────────────────────────────────────────────
  async function cargarJustificantes() {
    if (!mes) return
    try {
      const res = await fetch('/api/liquidacion-paola', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'justificantes_list', mes }),
      })
      const d = await res.json()
      if (d.ok) setJustificantes(d.justificantes || [])
    } catch { /* silencioso */ }
  }
  useEffect(() => { if (tab === 'justificantes') cargarJustificantes() }, [tab, mes])

  async function subirJustificante(file) {
    if (!file || !/^image\//.test(file.type)) { setJustAviso('Solo imágenes'); return }
    if (file.size > 8 * 1024 * 1024) { setJustAviso('Máx 8 MB por imagen'); return }
    setJustSubiendo(true); setJustAviso(null)
    try {
      const base64 = await new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = ko; r.readAsDataURL(file) })
      const res = await fetch('/api/liquidacion-paola', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'justificante_upload', mes, idadmon: justIdadmon || null, nombre: file.name || 'imagen', mime: file.type, base64 }),
      })
      const d = await res.json()
      if (!d.ok) { setJustAviso(d.error || 'No se pudo subir'); setJustSubiendo(false); return }
      setJustificantes(js => [...js, d.justificante])
      setJustAviso('Añadido')
      setTimeout(() => setJustAviso(null), 2500)
    } catch (e) { setJustAviso('Error: ' + e.message) }
    setJustSubiendo(false)
  }

  function onPasteJustif(e) {
    const items = e.clipboardData?.items || []
    for (const it of items) { if (it.type && it.type.startsWith('image/')) { const f = it.getAsFile(); if (f) subirJustificante(f) } }
  }
  function onDropJustif(e) {
    e.preventDefault()
    const files = e.dataTransfer?.files || []
    for (const f of files) if (/^image\//.test(f.type)) subirJustificante(f)
  }

  async function borrarJustificante(id) {
    try {
      const res = await fetch('/api/liquidacion-paola', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'justificante_delete', id }),
      })
      const d = await res.json()
      if (d.ok) setJustificantes(js => js.filter(j => j.id !== id))
    } catch { /* silencioso */ }
  }

  async function cargarBitacora() {
    setBitCargando(true)
    try {
      const res = await fetch('/api/liquidacion-paola', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'bitacora', mes }),
      })
      const d = await res.json()
      if (d.ok) setBitacora(d.log || [])
    } catch { /* silencioso */ }
    setBitCargando(false)
  }
  useEffect(() => { if (tab === 'bitacora' && puedeBitacora) cargarBitacora() }, [tab, mes])

  // Redacta la carta (texto preescrito) para revisarla/editarla antes de enviar.
  async function verCarta() {
    if (!datos?.resultado?.length) return
    setCartaCargando(true); setError(null)
    try {
      const res = await fetch('/api/liquidacion-paola', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'preview', mes, numero: envioNum, filas: filasConEdits() }),
      })
      const d = await res.json()
      if (d.ok) { setCartaAsunto(d.asunto); setCartaCuerpo(d.cuerpo) }
      else setError(d.error || 'No se pudo generar la vista previa')
    } catch (e) { setError('Error: ' + e.message) }
    setCartaCargando(false)
  }
  // Al abrir el panel o cambiar el número de envío, se (re)genera el texto preescrito.
  useEffect(() => { if (envioAbierto && datos?.resultado?.length) verCarta() }, [envioAbierto, envioNum])

  async function enviarPaola() {
    if (!datos?.resultado?.length) return
    const prueba = envioPrueba.trim()
    const destTxt = prueba ? `al correo de PRUEBA ${prueba}` : 'a PAOLA (su correo real)'
    if (!window.confirm(`Vas a enviar el ${envioNum}º email de ${mesLabel()} ${destTxt}, con el Excel adjunto.\n\n¿Continuar?`)) return
    setEnviando(true); setAvisoEnvio(null); setError(null)
    try {
      const res = await fetch('/api/liquidacion-paola', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'enviar', mes, numero: envioNum,
          filas: filasConEdits(), movimientos: datos?.movimientos || [], cartolaRows: datos?.cartolaRows || [],
          enviarA: prueba || undefined,
          asunto: cartaAsunto, cuerpo: cartaCuerpo,
        }),
      })
      const d = await res.json()
      if (!d.ok) { setError(d.error || 'No se pudo enviar'); setEnviando(false); return }
      setAvisoEnvio(`✓ Enviado (${envioNum}º) a ${d.enviado_a}${d.esPrueba ? ' [prueba]' : ''}`)
      cargarEnvios()
      // Envío real → refrescar el estado del mes para que salga el banner "enviada/congelada".
      if (!d.esPrueba) {
        try { const rr = await fetch(`/api/liquidacion-paola?mes=${mes}`).then(r => r.json()); if (rr?.ok) setCierre(rr.cierre || null) } catch { /* secundario */ }
      }
    } catch (e) { setError('Error de conexión al enviar: ' + e.message) }
    setEnviando(false)
  }

  // Columnas manuales (Adalis deja el Excel): se escriben en un buffer `edits` (teclear NO re-renderiza
  // toda la tabla) y al guardar se funden con la fila y se persisten en el CRM (liquidacion_paola).
  const setCampo = (idadmon, campo, valor) => { setDirty(true); setEdits(x => ({ ...x, [idadmon]: { ...x[idadmon], [campo]: valor } })) }
  const filaConEdits = (r) => {
    const e = edits[r.idadmon] || {}
    const base = { ...r, ...e }
    // Recibido editable a mano: se aplica al importe y recalcula la Falta, para que fluya al guardado y al Excel.
    if (e.recibidoEdit !== undefined && e.recibidoEdit !== '' && e.recibidoEdit !== null) {
      base.recibido = aNum(e.recibidoEdit)
      if (r.aCobrar != null) base.faltaMes = r.aCobrar - base.recibido
    }
    return base
  }
  const filasConEdits = () => (datos?.resultado || []).map(filaConEdits)
  // `silencioso`: guardado por celda (onBlur). NO toca `guardandoMes` (para no deshabilitar el botón
  // "Guardar mes" en mitad del clic) ni muestra aviso. El guardado del mes completo sí lo hace.
  async function guardar(filas, { silencioso = false } = {}) {
    if (!filas?.length) return
    if (!silencioso) { setGuardandoMes(true); setAvisoGuardado(null) }
    setError(null)
    try {
      const res = await fetch('/api/liquidacion-paola', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'guardar', mes, filas }),
      })
      const d = await res.json()
      if (!d.ok) { setError(d.error || 'No se pudo guardar'); if (!silencioso) setGuardandoMes(false); return }
      setDirty(false)   // lo tecleado quedó persistido
      if (!silencioso) {
        setAvisoGuardado(`Guardado en el CRM (${d.guardadas} fila${d.guardadas === 1 ? '' : 's'})`)
        setTimeout(() => setAvisoGuardado(null), 3500)
      }
    } catch (e) { setError('Error de conexión al guardar: ' + e.message) }
    if (!silencioso) setGuardandoMes(false)
  }
  const guardarMes = () => guardar(filasConEdits())
  const guardarFila = (r) => guardar([filaConEdits(r)], { silencioso: true })

  // Abrir/refrescar el mes YA GUARDADO en el CRM (liquidacion_paola), sin re-procesar la cartola.
  // Sirve también como "Refrescar con lo guardado": muestra EXACTAMENTE lo que hay en el CRM, para
  // confirmar que los cambios quedaron. Por eso limpia el buffer local (así se ven los valores del servidor).
  async function cargarGuardado() {
    if (!mes) return
    if (datos?.resultado?.length) {
      const ok = window.confirm(
        'Voy a recargar lo GUARDADO en el CRM de este mes, para que veas lo que quedó realmente.\n\n' +
        'Si has tecleado algo y NO lo has guardado, se descartará. ¿Continuar?')
      if (!ok) return
    }
    setProcesando(true); setError(null)
    try {
      const res = await fetch('/api/liquidacion-paola', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'cargar_guardado', mes }),
      })
      const d = await res.json()
      if (!d.ok) { setError(d.error || 'No se pudo abrir lo guardado') }
      else if (d.vacio) { setError('No hay nada guardado de este mes todavía. Procesa la liquidación y pulsa «Guardar mes en el CRM».') }
      else { setEdits({}); setDirty(false); setDatos(d); setTab('liquidacion'); setAbierta(null) }   // buffer limpio => se ven los valores del CRM
    } catch (e) { setError('Error de conexión: ' + e.message) }
    setProcesando(false)
  }

  const badge = c => {
    const cfg = COLOR_CONFIANZA[c]
    if (!cfg) return <span style={{ fontSize: 11, color: 'var(--gray-300)' }}>—</span>
    return <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, fontWeight: 600, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
  }

  const th = { padding: '9px 10px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }
  const td = { padding: '8px 10px', fontSize: 12, color: 'var(--gray-800)', borderBottom: '1px solid var(--border-subtle)' }
  const inpManual = { width: '100%', minWidth: 90, boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 6px', fontSize: 11, fontFamily: 'inherit', background: '#fff' }
  const hayCartola = !!(archivoLocal || driveId)
  const cartolasDelMes = archivosDrive.filter(f => f.name.includes(`${mes}-Cartola`))

  // ── Radar de descuadres del mes ────────────────────────────────────────────
  const TOL_RADAR = 2000
  const radarSobre = (datos?.resultado || []).filter(r => !r.vacante && !r.topado && r.recibido != null && r.aCobrar != null && (r.recibido - r.aCobrar) > TOL_RADAR)
  const radarParcial = (datos?.resultado || []).filter(r => !r.vacante && r.recibido != null && r.recibido > 0 && r.faltaMes != null && r.faltaMes > TOL_RADAR)
  const nRadar = radarSobre.length + radarParcial.length + (datos?.sinIdentificar?.length || 0)
  // Resumen de garantías por contrato (para la pestaña Garantías)
  const propDeId = {}, arrDeId = {}, pedidaDeId = {}, quienDeId = {}
  for (const r of (datos?.resultado || [])) {
    propDeId[r.idadmon] = r.propiedad || ''
    arrDeId[r.idadmon] = r.arrendatario || ''
    if (r.garantiaPedida != null) pedidaDeId[r.idadmon] = Number(r.garantiaPedida)
    if (r.quienGarantia != null) quienDeId[r.idadmon] = r.quienGarantia
  }
  const garPorId = {}
  for (const g of garantias) (garPorId[g.idadmon] = garPorId[g.idadmon] || []).push(g)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      <TopNav />

      <div style={{ padding: '10px 24px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12, color: 'var(--gray-400)', cursor: 'pointer' }} onClick={() => router.back()}>← Volver</span>
        <span style={{ color: 'var(--border)' }}>|</span>
        <div style={{ width: 28, height: 28, background: '#c2410c', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="white" strokeWidth="2" /><polyline points="14 2 14 8 20 8" stroke="white" strokeWidth="2" /></svg>
        </div>
        <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--gray-900)', margin: 0 }}>Preparación Liquidación de Paola</h1>
        <button onClick={() => router.push('/op/liquidacion-paola/historico')}
          title="Ver todas las liquidaciones de Paola (histórico A cobrar por mes) y la relación RUT ↔ idadmon"
          style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 600, padding: '7px 13px', borderRadius: 8, border: '1px solid #c2410c', background: '#fff', color: '#c2410c', cursor: 'pointer' }}>
          📊 Histórico / hojas
        </button>
      </div>

      <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>

        {/* AYUDA — plegada por defecto: quien ya sabe no la ve, quien duda la tiene a mano */}
        <div style={{ marginBottom: 20 }}>
          <button onClick={() => setAyuda(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
              padding: '11px 16px', fontSize: 13, fontFamily: 'inherit', fontWeight: 600,
              color: ayuda ? '#c2410c' : 'var(--gray-700)',
              background: ayuda ? '#fff7ed' : 'var(--surface)',
              border: `1px solid ${ayuda ? '#fdba74' : 'var(--border)'}`,
              borderRadius: ayuda ? '12px 12px 0 0' : 12, cursor: 'pointer',
            }}>
            <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>{ayuda ? '▾' : '▸'}</span>
            Cómo se hace la liquidación de Paola
            <span style={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: 800, letterSpacing: '.02em', color: '#9A3412' }}>
              PROCESO CONTROLADO POR ADALIS · OBJETIVO: ENVÍO DESDE AQUÍ DOS DÍAS DESPUÉS DE RECIBIR LA CARTOLA DE PAOLA
            </span>
            <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--gray-400)' }}>
              {ayuda ? 'ocultar' : '9 pasos · 2 min de lectura'}
            </span>
          </button>

          {ayuda && (
            <div style={{ border: '1px solid #fdba74', borderTop: 'none', borderRadius: '0 0 12px 12px', background: 'var(--surface)', padding: '18px 20px 20px' }}>

              {/* Qué hace el CRM y qué no: lo primero, para no crear expectativas falsas */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                {[
                  { t: 'Lo hace el CRM', c: '#16a34a', bg: '#f0fdf4', items: [
                    'Traer los contratos y lo que hay que cobrar',
                    'Cruzar los pagos de la cartola con cada arrendatario',
                    'Traer las deudas de gastos comunes, luz y agua',
                    'Generar el Excel con el formato de siempre',
                  ] },
                  { t: 'Lo seguís haciendo vosotras', c: '#c2410c', bg: '#fff7ed', items: [
                    'Decidir si un importe es correcto',
                    'Confirmar los pagos que no reconoce',
                    'Rellenar aquí Multas, Especial, Cantidad y los Comentarios (se guardan en el CRM)',
                    'Guardar el mes y enviárselo a Paola',
                  ] },
                ].map((b, i) => (
                  <div key={i} style={{ background: b.bg, borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: b.c, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 7 }}>{b.t}</div>
                    {b.items.map((x, j) => (
                      <div key={j} style={{ fontSize: 12, color: 'var(--gray-700)', padding: '2px 0' }}>· {x}</div>
                    ))}
                  </div>
                ))}
              </div>

              {[
                { n: 1, t: 'Poner al día CARTAS', d: 'Entrad en CARTAS y pulsad Resincronizar. Trabaja con una foto de los contratos tomada a principios de mes: si ha entrado o terminado un arriendo, no lo sabe. Si os lo saltáis, esta pantalla os avisará con un recuadro amarillo.' },
                { n: 2, t: 'Dejar la cartola en su carpeta', d: 'En 6.VIPS › P001 PAOLA, con el nombre de siempre: «2026-08-Cartola Ago 2026.xlsx». Si se llama así, aparece aquí sola y basta con pulsar.' },
                { n: 3, t: 'Elegir el mes', d: 'La cartola encontrada en Drive sale marcada con un ✓ verde. Si preferís otra, se puede arrastrar o buscar en el ordenador.' },
                { n: 4, t: 'Procesar liquidación', d: 'Tarda unos segundos. Arriba aparece el resumen; abajo, una línea que compara el total de la cartola con lo reconocido como renta. La diferencia son los ingresos de Paola que no son arriendo.' },
                { n: 5, t: 'Resolver «Sin identificar»', d: 'Cada pago trae el motivo por el que no se ha reconocido y un desplegable para asignarlo a un contrato o marcarlo como «No es renta». Al confirmar queda guardado: el mes que viene ese pagador ya sale identificado solo. Y si en la cartola anotáis la propiedad a mano (Dpto 903-A, Est 40), el CRM lo lee y lo asigna sin preguntar.', clave: true },
                { n: 6, t: 'Mirar «A revisar»', d: 'Son filas donde ha entrado más dinero del que se debía, casi siempre porque se ha asignado un pago ajeno. Pinchad la fila para ver los pagos concretos con su fecha y su glosa.' },
                { n: 7, t: 'Comprobar tres cosas a mano', d: 'Contratos que terminan a mitad de mes (el CRM cobra el mes entero, el proporcional lo ajustáis vosotras) · arriendos nuevos que Anthony aún no ha dado de alta · y A00810, que sale 263.900 cuando vosotras cobráis 260.000.' },
                { n: 8, t: 'Rellenar lo manual AQUÍ y guardar', d: 'En la tabla, últimas columnas: MULTAS/DEUDAS, Especial, Cantidad y COMENTARIOS 1 y 2. Se escriben en el CRM y se guardan al salir de cada celda; el botón «💾 Guardar mes en el CRM» guarda todo el mes de golpe (foto incluida) para que no se pierda. Ya no hace falta el Excel para esto.' },
                { n: 9, t: 'Generar el Excel y enviar', d: 'Descargar Control lo baja al ordenador (con lo que has rellenado); Guardar en Drive lo deja en la carpeta de Paola. Mismo formato de siempre: columnas, vacantes en marrón, totales y la fórmula de FALTA DEL MES. Luego a Paola por correo, como siempre.' },
              ].map(s => (
                <div key={s.n} style={{ display: 'flex', gap: 12, padding: '9px 0', borderTop: s.n === 1 ? 'none' : '1px solid var(--border-subtle)' }}>
                  <div style={{
                    flexShrink: 0, width: 22, height: 22, borderRadius: 6, fontSize: 11, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: s.clave ? '#c2410c' : 'var(--gray-100)', color: s.clave ? '#fff' : 'var(--gray-500)',
                  }}>{s.n}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-900)', marginBottom: 2 }}>{s.t}</div>
                    <div style={{ fontSize: 12, color: 'var(--gray-600)', lineHeight: 1.5 }}>{s.d}</div>
                  </div>
                </div>
              ))}

              <div style={{ marginTop: 16, padding: '11px 14px', background: 'var(--gray-50)', borderRadius: 10, fontSize: 12, color: 'var(--gray-600)', lineHeight: 1.5 }}>
                <strong style={{ color: 'var(--gray-800)' }}>Las versiones.</strong> La primera debería salir como
                máximo 3 días después de que llegue la cartola; a partir de ahí, según entren pagos, se manda otra.
                Estamos preparando que el CRM guarde cada versión con su fecha y lo que cambió, y que lo que pase al
                mes siguiente quede escrito en la última: qué queda pendiente, de quién y por cuánto.
                <br />
                <span style={{ color: 'var(--gray-500)' }}>
                  Si algo no cuadra, avisad con el IDADMON y la columna — con eso se localiza enseguida.
                </span>
              </div>
            </div>
          )}
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>
            1. Mes a procesar y cartola de Paola
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <input type="month" value={mes} onChange={e => setMes(e.target.value)}
              style={{ padding: '7px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', color: 'var(--gray-800)' }} />
            <span style={{ fontSize: 13, color: 'var(--gray-600)' }}>{mesLabel()}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

            {/* A — la cartola del mes, detectada en Drive */}
            <div style={{
              border: `1px solid ${driveId ? '#16a34a' : 'var(--border)'}`,
              background: driveId ? '#f0fdf4' : 'var(--gray-50)',
              borderRadius: 10, padding: '14px 16px',
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 8 }}>🏦 Cartola del banco · en Drive</div>
              {cartolasDelMes.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                  {errorDrive ? `No se pudo leer Drive (${errorDrive})` : `No hay ninguna cartola de ${mesLabel()} en Drive.`}
                </div>
              ) : (
                cartolasDelMes.map(f => (
                  <div key={f.id} onClick={() => { setDriveId(f.id); setArchivoLocal(null); setDatos(null) }}
                    style={{
                      fontSize: 12, padding: '7px 9px', borderRadius: 7, cursor: 'pointer', marginBottom: 4,
                      background: driveId === f.id ? '#dcfce7' : 'transparent',
                      color: driveId === f.id ? '#15803d' : 'var(--gray-700)',
                      fontWeight: driveId === f.id ? 600 : 400,
                    }}>
                    {driveId === f.id ? '✓ ' : '○ '}{f.name}
                  </div>
                ))
              )}
            </div>

            {/* B — o subirla desde el equipo */}
            <div
              onDragOver={e => { e.preventDefault(); setArrastrando(true) }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={e => { e.preventDefault(); setArrastrando(false); aceptarArchivo(e.dataTransfer.files?.[0]) }}
              onClick={() => inputRef.current?.click()}
              style={{
                border: `2px dashed ${arrastrando ? '#c2410c' : archivoLocal ? '#16a34a' : 'var(--border)'}`,
                background: arrastrando ? '#fff7ed' : archivoLocal ? '#f0fdf4' : 'var(--gray-50)',
                borderRadius: 10, padding: '14px 16px', textAlign: 'center', cursor: 'pointer', transition: 'all .15s',
              }}>
              <input ref={inputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
                onChange={e => aceptarArchivo(e.target.files?.[0])} />
              {archivoLocal ? (
                <>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#16a34a' }}>✓ {archivoLocal.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>
                    {(archivoLocal.size / 1024).toFixed(0)} KB · pincha para cambiarla
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 12, color: 'var(--gray-700)', fontWeight: 500 }}>📎 …o arrastra aquí otra cartola</div>
                  <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>pincha para buscarla en el equipo (.xlsx)</div>
                </>
              )}
            </div>
          </div>

          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={procesar} disabled={!mes || procesando}
              style={{
                padding: '10px 18px', fontSize: 13, fontWeight: 600, color: 'white',
                background: (!mes || procesando) ? 'var(--gray-300)' : '#c2410c',
                border: 'none', borderRadius: 8, cursor: (!mes || procesando) ? 'default' : 'pointer', fontFamily: 'inherit',
              }}>
              {procesando ? 'Procesando…' : '⚡ Procesar liquidación'}
            </button>
            <button onClick={cargarGuardado} disabled={!mes || procesando}
              title="Abrir lo que ya está guardado de este mes (lo que dejó preparado otra persona), sin recalcular la cartola"
              style={{
                padding: '10px 18px', fontSize: 13, fontWeight: 600, color: '#6b4423',
                background: '#fff', border: '1px solid #6b4423', borderRadius: 8,
                cursor: (!mes || procesando) ? 'default' : 'pointer', fontFamily: 'inherit', opacity: (!mes || procesando) ? 0.5 : 1,
              }}>
              📂 Abrir lo guardado
            </button>
            {!hayCartola && <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>Sin cartola se genera igual, pero sin la columna Recibido.</span>}
            {error && <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 500 }}>❌ {error}</span>}
          </div>
        </div>

        {datos && (
          <>
            {cierre?.enviado_en && !cierre?.congelado && (
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: '#1e40af' }}>
                🔒 <strong>Liquidación enviada</strong> el {new Date(cierre.enviado_en).toLocaleString('es-CL')}
                {cierre.enviado_por ? ' por ' + String(cierre.enviado_por).replace('@fondocapital.com', '') : ''}
                {cierre.ultimo_envio ? ` (envío nº ${cierre.ultimo_envio})` : ''}. Los cambios que hagas ahora son una
                <strong> rectificación</strong>: quedan en la bitácora y se mandarán en el próximo envío.
              </div>
            )}
            {cierre?.congelado && (
              <div style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: '#334155' }}>
                🔒 <strong>Mes congelado</strong> (cierre oficial). La liquidación es de solo lectura.
              </div>
            )}
            {datos.avisos?.resincronizarCartas && (
              <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: '#92400e' }}>
                ⚠ CARTAS no conoce {datos.avisos.vacantesNuevas.join(', ')}. La foto del mes es anterior:
                conviene <strong>Resincronizar</strong> en CARTAS y volver a procesar.
              </div>
            )}
            {datos.avisos?.enVivo && (
              <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: '#065f46' }}>
                ✓ <strong>A cobrar calculado en vivo</strong> (el mes aún no está congelado). Los importes salen del
                mismo motor que CARTAS; al congelar la liquidación (día 23) pasarán a leerse de la foto oficial.
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
              {[
                { label: 'Filas', value: datos.resumen.totalFilas },
                { label: 'Con importe', value: datos.resumen.conImporte },
                { label: 'A revisar', value: datos.resumen.revisar, color: datos.resumen.revisar ? '#d97706' : '#16a34a' },
                { label: 'Sin identificar', value: datos.resumen.sinIdentificar, color: datos.resumen.sinIdentificar ? '#dc2626' : '#16a34a' },
                { label: 'No es renta', value: datos.resumen.noEsRenta, color: 'var(--gray-500)' },
                { label: 'A cobrar', value: `$${num(datos.resumen.totalACobrar)}` },
                { label: 'Recibido', value: `$${num(datos.resumen.totalRecibido)}`, color: '#1a56db' },
              ].map((k, i) => (
                <div key={i} style={{ padding: '12px 16px', borderRight: i < 6 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ fontSize: 10, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{k.label}</div>
                  <div style={{ fontSize: 17, fontWeight: 600, color: k.color || 'var(--gray-800)' }}>{k.value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 0, position: 'sticky', top: 52, zIndex: 40, background: 'var(--background)', paddingTop: 10, paddingBottom: 10 }}>
              <button onClick={() => generarExcel(false)} disabled={generando}
                style={{
                  padding: '8px 14px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                  color: 'white', border: 'none', borderRadius: 8,
                  background: generando ? 'var(--gray-300)' : '#1a56db',
                  cursor: generando ? 'default' : 'pointer',
                }}>
                {generando ? 'Generando…' : '⬇ Descargar Control'}
              </button>
              <button onClick={() => setEnvioAbierto(o => !o)} disabled={!datos?.resultado?.length}
                title="Enviar la liquidación a Paola por email (1º rápido / 2º semanal / 3º definitivo). También la archiva en Drive."
                style={{
                  padding: '8px 14px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                  color: 'white', border: 'none', borderRadius: 8,
                  background: !datos?.resultado?.length ? 'var(--gray-300)' : (envioAbierto ? '#15803d' : '#16a34a'),
                  cursor: !datos?.resultado?.length ? 'default' : 'pointer',
                }}>
                ✉ Email a Paola {envioAbierto ? '▾' : '▸'}
              </button>
              <button onClick={guardarMes} disabled={guardandoMes || !datos?.resultado?.length}
                title="Guarda en el CRM lo que has tecleado (columnas manuales incluidas). Así no se pierde al salir."
                style={{
                  padding: '8px 14px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                  color: 'white', border: 'none', borderRadius: 8,
                  background: guardandoMes ? 'var(--gray-300)' : '#6b4423',
                  cursor: guardandoMes ? 'default' : 'pointer',
                }}>
                {guardandoMes ? 'Guardando…' : '💾 Guardar cambios'}
              </button>
              <button onClick={cargarGuardado} disabled={procesando || !mes}
                title="Trae del CRM lo que hay guardado de este mes, para confirmar que tus cambios quedaron. Descarta lo que hayas tecleado sin guardar."
                style={{
                  padding: '8px 14px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                  color: '#3730A3', border: '1px solid #C7D2FE', borderRadius: 8,
                  background: '#EEF2FF', cursor: procesando ? 'default' : 'pointer',
                }}>
                🔄 Ver lo guardado
              </button>
              {datos?.resultado?.length > 0 && (
                <span title={dirty ? 'Has tecleado algo que aún no está guardado en el CRM' : 'Todo lo tecleado está guardado en el CRM'}
                  style={{
                    fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
                    background: dirty ? '#FEF3C7' : '#DCFCE7', color: dirty ? '#92400E' : '#166534',
                    border: '1px solid ' + (dirty ? '#FCD34D' : '#86EFAC'),
                  }}>
                  {dirty ? '● Cambios sin guardar' : '✓ Guardado'}
                </span>
              )}
              {avisoExcel && <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 500 }}>✓ {avisoExcel}</span>}
              {avisoGuardado && <span style={{ fontSize: 11, color: '#6b4423', fontWeight: 600 }}>✓ {avisoGuardado}</span>}
            </div>

            {envioAbierto && datos?.resultado?.length > 0 && (
              <div style={{ border: '1px solid #86EFAC', background: '#F0FDF4', borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#15803d' }}>Enviar a Paola:</span>
                  <select value={envioNum} onChange={e => setEnvioNum(Number(e.target.value))} style={{ fontSize: 12, padding: '5px 8px', borderRadius: 6, border: '1px solid #CBD5E1' }}>
                    <option value={1}>1º · envío rápido (2 días tras la cartola)</option>
                    <option value={2}>2º · avance (una semana después)</option>
                    <option value={3}>3º · definitivo (fin de mes)</option>
                  </select>
                  <input value={envioPrueba} onChange={e => setEnvioPrueba(e.target.value)} placeholder="correo de PRUEBA (opcional) — vacío = Paola"
                    style={{ fontSize: 12, padding: '6px 10px', borderRadius: 6, border: '1px solid #CBD5E1', minWidth: 280 }} />
                  <button onClick={enviarPaola} disabled={enviando}
                    style={{ padding: '7px 16px', fontSize: 12, fontWeight: 700, border: 'none', borderRadius: 8, color: '#fff', background: enviando ? '#9CA3AF' : (envioPrueba.trim() ? '#2563EB' : '#16a34a'), cursor: enviando ? 'default' : 'pointer' }}>
                    {enviando ? 'Enviando…' : (envioPrueba.trim() ? '✉ Enviar PRUEBA' : '✉ Enviar a Paola')}
                  </button>
                  <button onClick={verCarta} disabled={cartaCargando}
                    title="Vuelve a generar el texto preescrito de la carta (por si cambiaste algo)."
                    style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, border: '1px solid #CBD5E1', borderRadius: 8, background: '#fff', color: '#374151', cursor: 'pointer' }}>
                    {cartaCargando ? 'Redactando…' : '↺ Redactar carta'}
                  </button>
                  {avisoEnvio && <span style={{ fontSize: 11, fontWeight: 600, color: '#166534' }}>{avisoEnvio}</span>}
                </div>

                {/* Vista previa EDITABLE de la carta: texto preescrito que Adalis puede retocar antes de enviar */}
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#15803d', marginBottom: 4 }}>Asunto</div>
                  <input value={cartaAsunto} onChange={e => setCartaAsunto(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', fontSize: 12, padding: '7px 10px', borderRadius: 6, border: '1px solid #CBD5E1', marginBottom: 8 }} />
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#15803d', marginBottom: 4 }}>Carta (puedes editarla antes de enviar)</div>
                  <textarea value={cartaCuerpo} onChange={e => setCartaCuerpo(e.target.value)} rows={14}
                    style={{ width: '100%', boxSizing: 'border-box', fontSize: 12.5, lineHeight: 1.5, padding: '10px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontFamily: 'inherit', resize: 'vertical' }} />
                </div>

                {envios.length > 0 && (
                  <div style={{ marginTop: 10, fontSize: 11, color: '#374151' }}>
                    <b>Enviados este mes:</b>{' '}
                    {envios.map((e, i) => (
                      <span key={i} style={{ marginRight: 12 }}>
                        {e.numero}º · {new Date(e.fecha_envio).toLocaleString('es-CL')} · {e.email_dest}{e.es_prueba ? ' [prueba]' : ''} · recibido {Math.round((e.recibido / (e.a_cobrar || 1)) * 100)}%
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: 8, fontSize: 11, color: '#6B7280' }}>
                  Revisa y edita la carta antes de enviar (el texto de arriba es una propuesta; se manda tal cual quede). Lleva el Excel adjunto. Con correo de prueba va a ese correo (no a Paola) y el archivo se guarda en Drive con prefijo «PRUEBA-» para borrarlo luego.
                </div>
              </div>
            )}

            {datos.cartola && (
              <div style={{ fontSize: 11, color: 'var(--gray-400)', marginBottom: 12 }}>
                Cartola ({datos.cartola.origen}) · hoja «{datos.cartola.hoja}» · {datos.cartola.movimientos} abonos,
                {datos.cartola.conNota} con anotación manual · total ${num(datos.cartola.totalAbonos)}, de los que
                ${num(datos.resumen.totalRecibido)} son renta y ${num(datos.resumen.totalNoEsRenta)} están marcados
                como ingresos ajenos al arriendo.
              </div>
            )}

            <div style={{ display: 'flex', gap: 2, background: 'var(--surface)', borderRadius: '12px 12px 0 0', border: '1px solid var(--border)', borderBottom: 'none', padding: '0 16px', position: 'sticky', top: 106, zIndex: 39 }}>
              {[
                { key: 'liquidacion', label: `Liquidación (${datos.resultado.length})` },
                { key: 'revisar', label: `Revisar (${datos.resumen.revisar})` },
                { key: 'radar', label: `Radar (${nRadar})` },
                { key: 'garantias', label: 'Garantías' },
                { key: 'justificantes', label: `📎 Justificantes${justificantes.length ? ' (' + justificantes.length + ')' : ''}` },
                { key: 'sin_identificar', label: `Sin identificar (${datos.sinIdentificar.length})` },
                { key: 'no_renta', label: `No es renta (${datos.noEsRenta.length})` },
                ...(puedeBitacora ? [{ key: 'bitacora', label: '🗒 Bitácora' }] : []),
              ].map(t => (
                <button key={t.key} onClick={() => setTab(t.key)} style={{
                  padding: '10px 16px', fontSize: 12, fontWeight: tab === t.key ? 500 : 400,
                  color: tab === t.key ? '#1a56db' : 'var(--gray-400)', background: 'none', border: 'none',
                  borderBottom: tab === t.key ? '2px solid #1a56db' : '2px solid transparent',
                  cursor: 'pointer', fontFamily: 'inherit', marginBottom: '-1px',
                }}>{t.label}</button>
              ))}
            </div>

            {(tab === 'liquidacion' || tab === 'revisar') && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0 0 12px 12px', overflow: 'auto', maxHeight: 'calc(100vh - 210px)' }}>
                <style>{`.tablaMes td, .tablaMes th { border-right: 1px solid var(--border-subtle); } .tablaMes td:first-child, .tablaMes th:first-child { border-right: none; } .tablaMes thead th { position: sticky; top: 0; z-index: 3; background: var(--gray-50); box-shadow: inset 0 -1px 0 var(--border); }`}</style>
                <table className="tablaMes" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1250 }}>
                  <thead>
                    <tr style={{ background: 'var(--gray-50)' }}>
                      {['', 'Est', 'IdAdmon', 'Propiedad', 'Comienzo', 'Termino', 'Arrendatario', 'RUT',
                        'A Cobrar', 'Recibido', 'Falta', 'Fecha pago', 'G.Comunes', 'Luz', 'Agua', 'Conf.',
                        'Multas/Deudas', 'Especial', 'Cantidad', 'Comentarios 1', 'Comentarios 2',
                        'Estado pago', 'Nota pago']
                        .map((h, i) => <th key={i} style={th}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {[...datos.resultado].sort((a, b) => String(a.propiedad || '').localeCompare(String(b.propiedad || ''), 'es', { numeric: true })).filter(r => tab === 'liquidacion' || r.revisar).map((r, i) => {
                      const recEdit = edits[r.idadmon]?.recibidoEdit
                      const recVal = (recEdit !== undefined && recEdit !== '' && recEdit !== null) ? aNum(recEdit) : (r.recibido == null ? null : r.recibido)
                      const faltaVal = r.aCobrar == null ? null : r.aCobrar - (recVal || 0)
                      return (
                      <Fragment key={r.idadmon}>
                        <tr onClick={() => setAbierta(abierta === r.idadmon ? null : r.idadmon)}
                          style={{
                            cursor: r.pagos?.length ? 'pointer' : 'default',
                            background: r.revisar ? '#fef2f2' : r.vacante ? '#f5e9da' : r.confianza === 'sugerida' ? '#fffbeb' : 'transparent',
                          }}>
                          <td style={{ ...td, color: 'var(--gray-300)', fontSize: 11 }}>{r.pagos?.length ? (abierta === r.idadmon ? '▾' : '▸') : ''}</td>
                          <td style={{ ...td, fontSize: 11, color: 'var(--gray-500)' }}>{r.estado || '—'}</td>
                          <td style={{ ...td, fontWeight: 600, color: '#1a56db' }}>{r.idadmon}</td>
                          <td style={{ ...td, fontSize: 11 }}>{r.propiedad}</td>
                          <td style={{ ...td, fontSize: 11 }}>{fecha(r.comienzo)}</td>
                          <td style={{ ...td, fontSize: 11 }}>{fecha(r.termino)}</td>
                          <td style={{ ...td, fontSize: 11 }}>{r.arrendatario}</td>
                          <td style={{ ...td, fontSize: 11 }}>{r.rut || '—'}</td>
                          <td style={{ ...td, textAlign: 'right' }}>{num(r.aCobrar)}</td>
                          <td style={{ ...td, whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                            {r.vacante ? <span style={{ color: 'var(--gray-300)' }}>—</span> : (
                              <input inputMode="numeric" value={edits[r.idadmon]?.recibidoEdit ?? ''} placeholder="NO PAGADO"
                                onChange={e => setCampo(r.idadmon, 'recibidoEdit', e.target.value)}
                                onBlur={() => guardarFila(r)}
                                title="Recibido. Puedes corregirlo a mano (p.ej. un pago del justificante aún sin discriminar) antes de generar el Excel. Se guarda y se congela con la liquidación."
                                style={{ ...inpManual, width: 92, minWidth: 92, textAlign: 'right', fontWeight: 600, color: recVal ? '#16a34a' : '#dc2626' }} />
                            )}
                            {r.topado && (
                              <span title={`Pago combinado: entró ${num(r.recibidoBruto)} (arriendo ${num(r.aCobrar)} + ${num(r.excedente)} de garantía/bodega). Se topa al arriendo.`}
                                    style={{ marginLeft: 4, fontSize: 9, fontWeight: 700, color: '#d97706', background: '#fef3c7', borderRadius: 3, padding: '1px 3px', cursor: 'help' }}>tope</span>
                            )}
                          </td>
                          <td style={{ ...td, textAlign: 'right', color: faltaVal > 0 ? '#dc2626' : faltaVal < 0 ? '#d97706' : '#16a34a' }}>
                            {faltaVal == null ? '—' : num(faltaVal)}
                          </td>
                          <td style={{ ...td, fontSize: 11 }}>{fecha(r.fechaPago)}</td>
                          <td style={{ ...td, textAlign: 'right', fontSize: 11 }}>{r.deudaGgcc == null ? '' : num(r.deudaGgcc)}</td>
                          <td style={{ ...td, textAlign: 'right', fontSize: 11 }}>{r.deudaLuz == null ? '' : num(r.deudaLuz)}</td>
                          <td style={{ ...td, textAlign: 'right', fontSize: 11 }}>{r.deudaAgua == null ? '' : num(r.deudaAgua)}</td>
                          <td style={td}>{badge(r.confianza)}</td>
                          {/* Columnas MANUALES — se teclean en el buffer `edits` y se guardan al salir de la celda */}
                          <td style={td} onClick={e => e.stopPropagation()}>
                            <input inputMode="numeric" value={edits[r.idadmon]?.multasDeudas ?? ''} placeholder="—"
                              onChange={e => setCampo(r.idadmon, 'multasDeudas', e.target.value)}
                              onBlur={() => guardarFila(r)} style={{ ...inpManual, minWidth: 84, textAlign: 'right' }} />
                          </td>
                          <td style={td} onClick={e => e.stopPropagation()}>
                            <input value={edits[r.idadmon]?.especial ?? ''} placeholder="—"
                              onChange={e => setCampo(r.idadmon, 'especial', e.target.value)}
                              onBlur={() => guardarFila(r)} style={{ ...inpManual, minWidth: 90 }} />
                          </td>
                          <td style={td} onClick={e => e.stopPropagation()}>
                            <input inputMode="numeric" value={edits[r.idadmon]?.cantidad ?? ''} placeholder="—"
                              onChange={e => setCampo(r.idadmon, 'cantidad', e.target.value)}
                              onBlur={() => guardarFila(r)} style={{ ...inpManual, minWidth: 84, textAlign: 'right' }} />
                          </td>
                          <td style={td} onClick={e => e.stopPropagation()}>
                            <input value={edits[r.idadmon]?.comentarios1 ?? ''} placeholder="—"
                              onChange={e => setCampo(r.idadmon, 'comentarios1', e.target.value)}
                              onBlur={() => guardarFila(r)} style={{ ...inpManual, minWidth: 220 }} />
                          </td>
                          <td style={td} onClick={e => e.stopPropagation()}>
                            <input value={edits[r.idadmon]?.comentarios2 ?? ''} placeholder="—"
                              onChange={e => setCampo(r.idadmon, 'comentarios2', e.target.value)}
                              onBlur={() => guardarFila(r)} style={{ ...inpManual, minWidth: 220 }} />
                          </td>
                          <td style={td} onClick={e => e.stopPropagation()}>
                            <select value={edits[r.idadmon]?.estadoPago ?? ''}
                              onChange={e => setCampo(r.idadmon, 'estadoPago', e.target.value)}
                              onBlur={() => guardarFila(r)} style={{ ...inpManual, minWidth: 128 }}>
                              <option value="">—</option>
                              <option value="PAGADO">Pagado</option>
                              <option value="ATRASADO">Pago atrasado</option>
                              <option value="NO_PAGADO">No pagó</option>
                            </select>
                          </td>
                          <td style={td} onClick={e => e.stopPropagation()}>
                            <input value={edits[r.idadmon]?.notaPago ?? ''} placeholder="p. ej. el pago del 31/07 es de julio"
                              onChange={e => setCampo(r.idadmon, 'notaPago', e.target.value)}
                              onBlur={() => guardarFila(r)} style={{ ...inpManual, minWidth: 240 }} />
                          </td>
                        </tr>
                        {abierta === r.idadmon && r.pagos?.map((p, j) => (
                          <tr key={`${r.idadmon}-${j}`} style={{ background: 'var(--gray-50)' }}>
                            <td style={td}></td>
                            <td style={{ ...td, fontSize: 11, color: 'var(--gray-400)' }} colSpan={6}>
                              {fecha(p.fecha)} · {p.detalle}
                            </td>
                            <td style={{ ...td, fontSize: 11, color: 'var(--gray-400)' }}>{p.metodo}</td>
                            <td style={td}></td>
                            <td style={{ ...td, textAlign: 'right', fontSize: 11, fontWeight: 600 }}>{num(p.monto)}</td>
                            <td style={td} colSpan={11}></td>
                          </tr>
                        ))}
                      </Fragment>
                      ) })}
                  </tbody>
                </table>
                {tab === 'revisar' && datos.resumen.revisar === 0 && (
                  <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: '#16a34a' }}>✓ Ninguna fila cobra por encima de lo debido</div>
                )}
              </div>
            )}

            {tab === 'sin_identificar' && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
                {datos.sinIdentificar.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: '#16a34a' }}>✓ Todos los abonos quedaron identificados</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--gray-50)' }}>
                        {['Fecha', 'RUT', 'Detalle', 'Monto', 'Por qué', 'Asignar a'].map((h, i) => <th key={i} style={th}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {datos.sinIdentificar.map((a, i) => (
                        <tr key={i} style={{ background: '#fef2f2' }}>
                          <td style={{ ...td, fontSize: 11 }}>{fecha(a.fecha) || String(a.fecha)}</td>
                          <td style={{ ...td, fontSize: 11, color: '#dc2626', fontWeight: 500 }}>{a.rut || '—'}</td>
                          <td style={{ ...td, fontSize: 11 }}>{a.detalle}</td>
                          <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{num(a.monto)}</td>
                          <td style={{ ...td, fontSize: 10, color: 'var(--gray-500)', maxWidth: 260 }}>{a.motivo}</td>
                          <td style={{ ...td, whiteSpace: 'nowrap' }}>
                            <select
                              value={eleccion[a.clave] || (a.sugerencia ? a.sugerencia.idadmon : '')}
                              onChange={e => setEleccion({ ...eleccion, [a.clave]: e.target.value })}
                              style={{ fontSize: 11, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--border)', fontFamily: 'inherit', maxWidth: 210 }}>
                              <option value="">— elegir —</option>
                              <option value="NO_RENTA">No es renta (ingreso de Paola)</option>
                              {(datos.contratos || []).map(c => (
                                <option key={c.idadmon} value={c.idadmon}>
                                  {c.idadmon} · {c.propiedad.replace('Pablo Urzúa 1481- ', '')}
                                </option>
                              ))}
                            </select>
                            <button onClick={() => confirmar(a)}
                              disabled={confirmando === a.clave || !(eleccion[a.clave] || a.sugerencia)}
                              style={{
                                marginLeft: 6, fontSize: 11, padding: '4px 10px', borderRadius: 6, border: 'none',
                                color: 'white', fontFamily: 'inherit',
                                background: (confirmando === a.clave || !(eleccion[a.clave] || a.sugerencia)) ? 'var(--gray-300)' : '#16a34a',
                                cursor: (confirmando === a.clave || !(eleccion[a.clave] || a.sugerencia)) ? 'default' : 'pointer',
                              }}>
                              {confirmando === a.clave ? '…' : 'Confirmar'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {tab === 'no_renta' && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
                <div style={{ padding: '10px 16px', fontSize: 11, color: 'var(--gray-500)', borderBottom: '1px solid var(--border-subtle)' }}>
                  Abonos que el buscador tiene marcados como ingresos de Paola ajenos al arriendo.
                  No cuentan como cobro ni quedan pendientes.
                </div>
                {datos.noEsRenta.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: 'var(--gray-400)' }}>Ninguno</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--gray-50)' }}>
                        {['Fecha', 'RUT', 'Detalle', 'Monto'].map((h, i) => <th key={i} style={th}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {datos.noEsRenta.map((a, i) => (
                        <tr key={i}>
                          <td style={{ ...td, fontSize: 11 }}>{fecha(a.fecha) || String(a.fecha)}</td>
                          <td style={{ ...td, fontSize: 11, color: 'var(--gray-500)' }}>{a.rut || '—'}</td>
                          <td style={{ ...td, fontSize: 11, color: 'var(--gray-500)' }}>{a.detalle}</td>
                          <td style={{ ...td, textAlign: 'right', color: 'var(--gray-500)' }}>{num(a.monto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* ── RADAR de descuadres ─────────────────────────────────────── */}
            {tab === 'radar' && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
                <div style={{ padding: '10px 16px', fontSize: 11, color: 'var(--gray-500)', borderBottom: '1px solid var(--border-subtle)' }}>
                  Descuadres del mes para revisar antes de enviar: pagos que no cuadran con el A Cobrar. Los abonos que no
                  se pudieron atribuir a ningún contrato están en <b>Sin identificar ({datos.sinIdentificar.length})</b>.
                </div>
                {nRadar === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: '#16a34a' }}>✓ Sin descuadres: todo cuadra con el A Cobrar</div>
                ) : (
                  <div style={{ padding: 16 }}>
                    {radarSobre.length > 0 && (
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#d97706', marginBottom: 8 }}>
                          Sobrepagos sin atribuir ({radarSobre.length}) · pagó más que el arriendo y no hay cuota de garantía registrada
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead><tr style={{ background: 'var(--gray-50)' }}>
                            {['IdAdmon', 'Propiedad', 'A Cobrar', 'Recibido', 'Excedente', ''].map((h, i) => <th key={i} style={th}>{h}</th>)}
                          </tr></thead>
                          <tbody>
                            {radarSobre.map(r => (
                              <tr key={r.idadmon} style={{ background: '#fffbeb' }}>
                                <td style={{ ...td, fontWeight: 600, color: '#1a56db' }}>{r.idadmon}</td>
                                <td style={{ ...td, fontSize: 11 }}>{r.propiedad}</td>
                                <td style={{ ...td, textAlign: 'right' }}>{num(r.aCobrar)}</td>
                                <td style={{ ...td, textAlign: 'right' }}>{num(r.recibidoBruto ?? r.recibido)}</td>
                                <td style={{ ...td, textAlign: 'right', fontWeight: 600, color: '#d97706' }}>{num((r.recibidoBruto ?? r.recibido) - r.aCobrar)}</td>
                                <td style={{ ...td, whiteSpace: 'nowrap' }}>
                                  <button onClick={() => setTab('garantias')}
                                    style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: 'none', color: 'white', background: '#d97706', cursor: 'pointer', fontFamily: 'inherit' }}>
                                    Ajustar en Garantías
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {radarParcial.length > 0 && (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#dc2626', marginBottom: 8 }}>
                          Pagos parciales ({radarParcial.length}) · pagó menos que el arriendo
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead><tr style={{ background: 'var(--gray-50)' }}>
                            {['IdAdmon', 'Propiedad', 'A Cobrar', 'Recibido', 'Falta'].map((h, i) => <th key={i} style={th}>{h}</th>)}
                          </tr></thead>
                          <tbody>
                            {radarParcial.map(r => (
                              <tr key={r.idadmon} style={{ background: '#fef2f2' }}>
                                <td style={{ ...td, fontWeight: 600, color: '#1a56db' }}>{r.idadmon}</td>
                                <td style={{ ...td, fontSize: 11 }}>{r.propiedad}</td>
                                <td style={{ ...td, textAlign: 'right' }}>{num(r.aCobrar)}</td>
                                <td style={{ ...td, textAlign: 'right' }}>{num(r.recibido)}</td>
                                <td style={{ ...td, textAlign: 'right', fontWeight: 600, color: '#dc2626' }}>{num(r.faltaMes)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── GARANTÍAS (control de cuotas) ────────────────────────────── */}
            {tab === 'garantias' && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
                <div style={{ padding: '10px 16px', fontSize: 11, color: 'var(--gray-500)', borderBottom: '1px solid var(--border-subtle)' }}>
                  Garantías de los contratos vigentes (S/SQ), como salen en la hoja <strong>Garantías</strong> del Excel.
                  Puedes <strong>ajustar</strong> pedida, quién, deuda y las cuotas (fecha/monto/cobrado) para este mes: se guarda como
                  ajuste del mes (no toca el maestro), queda en la bitácora y se congela con la liquidación.
                  {garRosterCargando && <span> · cargando…</span>}
                </div>
                {garRoster.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: 'var(--gray-400)' }}>Sin garantías de contratos vigentes.</div>
                ) : (
                  <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 240px)' }}>
                    <table style={{ borderCollapse: 'collapse', minWidth: 1500, fontSize: 11 }}>
                      <thead>
                        <tr style={{ background: 'var(--gray-50)' }}>
                          {['IdAdmon', 'Inmueble', 'Arrendatario', 'Pedida', 'Entregada', 'Pendiente', 'Quién', 'Deuda',
                            'C1 fecha', 'C1 monto', 'C1 cobr.', 'C2 fecha', 'C2 monto', 'C2 cobr.',
                            'C3 fecha', 'C3 monto', 'C3 cobr.', 'C4 fecha', 'C4 monto', 'C4 cobr.', ''].map((h, i) => <th key={i} style={{ ...th, whiteSpace: 'nowrap' }}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {[...garRoster].sort((a, b) => String(a.inmueble || '').localeCompare(String(b.inmueble || ''), 'es', { numeric: true })).map(r => {
                          const g = (c) => garEdits[`${r.idadmon}|${c}`] ?? ''
                          const setG = (c, v) => setGarEdits(e => ({ ...e, [`${r.idadmon}|${c}`]: v }))
                          const entregada = [1, 2, 3, 4].reduce((s, i) => s + aNum(g('cobrada' + i)), 0)
                          const pedida = aNum(g('garantia_pedida'))
                          const pendiente = Math.max(pedida - entregada, 0)
                          const ajustado = garAjustados.includes(r.idadmon)
                          const inpN = { ...inpManual, width: 78, minWidth: 78, textAlign: 'right', fontSize: 11 }
                          const inpF = { ...inpManual, width: 116, minWidth: 116, fontSize: 11 }
                          const campoTexto = (c, style) => (
                            <input value={g(c)} onChange={e => setG(c, e.target.value)} onBlur={() => guardarOverride(r.idadmon, c, g(c))} style={style} />
                          )
                          return (
                            <tr key={r.idadmon} style={{ background: ajustado ? '#fffbeb' : 'transparent' }}>
                              <td style={{ ...td, fontWeight: 600, color: '#1a56db', whiteSpace: 'nowrap' }}>{r.idadmon}{ajustado && <span title="Con ajuste este mes" style={{ marginLeft: 4, fontSize: 9, color: '#d97706' }}>✎</span>}</td>
                              <td style={{ ...td, whiteSpace: 'nowrap' }}>{String(r.inmueble || '').replace('Pablo Urzua 1481, ', '').replace('Pablo Urzúa 1481- ', '')}</td>
                              <td style={{ ...td, whiteSpace: 'nowrap' }}>{r.arrendatario}</td>
                              <td style={td} onClick={e => e.stopPropagation()}>{campoTexto('garantia_pedida', inpN)}</td>
                              <td style={{ ...td, textAlign: 'right', color: '#16a34a', fontWeight: 600 }}>{entregada ? num(entregada) : '—'}</td>
                              <td style={{ ...td, textAlign: 'right', color: pendiente > 0 ? '#d97706' : 'var(--gray-400)' }}>{pendiente ? num(pendiente) : '—'}</td>
                              <td style={td} onClick={e => e.stopPropagation()}>{campoTexto('quien_tiene_garantia', { ...inpManual, width: 110, minWidth: 110, fontSize: 11 })}</td>
                              <td style={td} onClick={e => e.stopPropagation()}>{campoTexto('deuda_garantia', inpN)}</td>
                              {[1, 2, 3, 4].map(i => (
                                <Fragment key={i}>
                                  <td style={td} onClick={e => e.stopPropagation()}>{campoTexto('fecha' + i, inpF)}</td>
                                  <td style={td} onClick={e => e.stopPropagation()}>{campoTexto('cuota' + i, inpN)}</td>
                                  <td style={td} onClick={e => e.stopPropagation()}>{campoTexto('cobrada' + i, inpN)}</td>
                                </Fragment>
                              ))}
                              <td style={{ ...td, textAlign: 'center' }}>
                                {ajustado && <button onClick={() => revertirGarantia(r.idadmon)} title="Quitar los ajustes de este mes (volver al maestro)"
                                  style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, border: '1px solid var(--border)', color: '#6b7280', background: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>↩ revertir</button>}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── JUSTIFICANTES (imágenes) ──────────────────────────────────── */}
            {tab === 'justificantes' && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
                <div style={{ padding: 16 }}
                  onPaste={onPasteJustif}
                  onDrop={onDropJustif}
                  onDragOver={e => e.preventDefault()}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                    <label style={{ fontSize: 11, color: 'var(--gray-500)' }}>Asociar a contrato (opcional):&nbsp;
                      <select value={justIdadmon} onChange={e => setJustIdadmon(e.target.value)} style={{ ...inpManual, width: 240, display: 'inline-block' }}>
                        <option value="">— general del mes —</option>
                        {(datos.contratos || []).map(c => <option key={c.idadmon} value={c.idadmon}>{c.idadmon} · {String(c.propiedad || '').replace('Pablo Urzúa 1481- ', '')}</option>)}
                      </select>
                    </label>
                    <label style={{ fontSize: 12, padding: '7px 14px', borderRadius: 8, border: '1px solid #1a56db', color: '#1a56db', background: '#EEF2FF', cursor: 'pointer', fontWeight: 600 }}>
                      + Añadir imagen
                      <input type="file" accept="image/*" multiple style={{ display: 'none' }}
                        onChange={e => { for (const f of e.target.files) subirJustificante(f); e.target.value = '' }} />
                    </label>
                    {justSubiendo && <span style={{ fontSize: 11, color: 'var(--gray-500)' }}>subiendo…</span>}
                    {justAviso && <span style={{ fontSize: 11, color: justAviso === 'Añadido' ? '#16a34a' : '#dc2626' }}>{justAviso}</span>}
                  </div>
                  <div tabIndex={0} style={{ border: '2px dashed var(--border)', borderRadius: 10, padding: 18, textAlign: 'center', fontSize: 12, color: 'var(--gray-500)', background: 'var(--gray-50)', marginBottom: 16 }}>
                    Pega aquí una captura (Ctrl+V) o arrastra imágenes. Se guardan en el CRM y se incrustan en la hoja
                    <strong> Comprobantes</strong> del Excel que se manda a Paola.
                  </div>
                  {justificantes.length === 0 ? (
                    <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--gray-400)' }}>Aún no hay justificantes de {mesLabel()}.</div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                      {justificantes.map(j => (
                        <div key={j.id} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
                          <a href={j.url} target="_blank" rel="noreferrer" style={{ display: 'block', height: 150, background: '#f8fafc' }}>
                            {j.url ? <img src={j.url} alt={j.nombre} style={{ width: '100%', height: 150, objectFit: 'cover' }} /> : <div style={{ padding: 20, fontSize: 11, color: 'var(--gray-400)' }}>sin vista previa</div>}
                          </a>
                          <div style={{ padding: '6px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 10, color: 'var(--gray-600)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {j.idadmon ? <b style={{ color: '#1a56db' }}>{j.idadmon}</b> : '·'} {j.nombre || ''}
                            </span>
                            <button onClick={() => borrarJustificante(j.id)} title="Borrar"
                              style={{ fontSize: 11, padding: '2px 7px', borderRadius: 6, border: '1px solid var(--border)', color: '#dc2626', background: '#fff', cursor: 'pointer', flexShrink: 0 }}>✕</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── BITÁCORA (solo Dirección/Karina) ──────────────────────────── */}
            {tab === 'bitacora' && puedeBitacora && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
                <div style={{ padding: '10px 16px', fontSize: 11, color: 'var(--gray-500)', borderBottom: '1px solid var(--border-subtle)' }}>
                  Registro de cambios de la liquidación de {mesLabel()} (quién, cuándo y de qué valor a cuál). Solo lectura.
                  {bitCargando && <span> · cargando…</span>}
                </div>
                {bitacora.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: 'var(--gray-400)' }}>Sin cambios registrados en este mes.</div>
                ) : (
                  <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 260px)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                      <thead><tr style={{ background: 'var(--gray-50)' }}>
                        {['Fecha/hora', 'Autor', 'IdAdmon', 'Campo', 'Antes', 'Después'].map((h, i) => <th key={i} style={th}>{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {bitacora.map(b => (
                          <tr key={b.id}>
                            <td style={{ ...td, fontSize: 11, whiteSpace: 'nowrap' }}>{b.creado_en ? new Date(b.creado_en).toLocaleString('es-CL') : '—'}</td>
                            <td style={{ ...td, fontSize: 11, color: 'var(--gray-600)' }}>{(b.autor || '—').replace('@fondocapital.com', '')}</td>
                            <td style={{ ...td, fontWeight: 600, color: '#1a56db' }}>{b.idadmon || '—'}</td>
                            <td style={{ ...td, fontSize: 11 }}>{b.campo}{b.evento && b.evento !== 'edit' ? <span style={{ marginLeft: 4, fontSize: 9, color: 'var(--gray-400)' }}>({b.evento})</span> : null}</td>
                            <td style={{ ...td, fontSize: 11, color: '#dc2626' }}>{b.valor_anterior ?? '—'}</td>
                            <td style={{ ...td, fontSize: 11, color: '#16a34a' }}>{b.valor_nuevo ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
