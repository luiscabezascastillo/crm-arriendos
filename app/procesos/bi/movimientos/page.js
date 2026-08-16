// VERSION: v39 · 2026-08-16 · RENDIMIENTO tabla: VENTANA DE RENDER (virtualización casera, sin dependencias). Con
//   ~7.000 filas el freno era el DOM (7.000 <tr> pintados) + re-render de TODAS al teclear una celda. Ahora la tabla
//   carga entera en memoria (rápida después) pero SOLO pinta las filas visibles (± un margen), con dos filas
//   "espaciador" que reservan el alto del resto. Alto de fila uniforme (ROW_H) → las columnas de texto largo
//   (Detalle, Comentarios) pasan a una línea con "…" y el texto completo sigue en el tooltip al pasar el ratón.
//   Mensaje de carga inicial informando de la espera. Filtros/edición/colores idénticos. Hereda v38.
// VERSION: v38 · 2026-08-15 · Editar UNIQUE CONCEPT: NO se bloquea (el campo admite texto válido de muchos tipos),
//   solo se AVISA con las consecuencias y la persona decide. Novedad clave: si se cambia un IDADMON válido por algo
//   que NO lo es (texto libre o vacío), el aviso muestra el valor anterior y, al confirmar, se QUITA la correspondencia
//   en CUENTAS (el endpoint borra la línea calif=reg → el abono sale de esa cartola). Requiere ruta movimientos v4.
//   Hereda v37.
// VERSION: v37 · 2026-08-15 · LIMPIEZA: (1) se SUPRIME el botón "Copiar FALTA a CUENTAS" (y su función copiarFaltan)
//   — el volcado ya lo hacen la edición de celda y +RUT; era vestigio del flujo Excel. (2) Se OCULTAN las columnas
//   check1 y check2 de la tabla (y sus avisos/leyendas asociados). El dato bi.check2_pasar_a_cartola sigue en la BD
//   (lo lee lógica interna), solo deja de mostrarse. Sin cambios de datos ni de endpoints. Hereda v36.
// VERSION: v36 · 2026-08-15 · RENDIMIENTO del filtro de cabecera (iba lento / se "enganchaba"): (1) las opciones de
//   cada columna se MEMOIZAN una vez por carga (antes valoresUnicos() recorría las 7040 filas con localeCompare para
//   TODAS las columnas en cada render); (2) dentro del desplegable, la forma normalizada de cada opción se precalcula
//   una vez y no en cada tecla. El filtrado al teclear pasa a ser inmediato. Sin cambios de datos. Hereda v35.
// VERSION: v35 · 2026-08-15 · Vista "RUT → IDADMON": cada bloque añade una 4ª columna con la ÚLTIMA CANTIDAD pagada
//   (el abono del pago más reciente, no la suma), junto a la fecha del último pago. Hereda v34.
// VERSION: v34 · 2026-08-15 · Se SUPRIME el toggle "Ver todo / Ver recientes" (era confuso): la tabla muestra
//   siempre todas las filas que casen con los filtros de cabecera. Para acotar se usan esos filtros (árbol de
//   fechas, buscar Reg, etc.) y el botón "✕ Quitar filtros". Hereda v33.
// VERSION: v33 · 2026-08-15 · FILTROS más ágiles: (1) la lista de opciones se CAPA a 300 (columnas como Reg/N°Doc
//   tenían miles y el desplegable se atascaba al escribir — ahora va fluido y el buscador afina); (2) foco automático
//   en el buscador al abrir; (3) botón "✕ Quitar filtros" en la barra (visible solo si hay filtro/orden activo) para
//   no quedarte atascado con un filtro de otra columna (p. ej. Fecha=2026 escondiendo un Reg de 2025). Hereda v32.
// VERSION: v32 · 2026-08-15 · FILTROS DE CABECERA: (1) el desplegable ahora se dibuja por PORTAL a document.body, así
//   que sale SIEMPRE por delante de la cabecera sticky (antes quedaba atrapado en su stacking-context y lo tapaban
//   las columnas de al lado); (2) la columna Fecha usa un ÁRBOL Año → Mes → Día con casillas tri-estado y
//   desplegar/plegar (como el filtro de Descuentos), en vez de la lista plana de todas las fechas. Hereda v31.
// VERSION: v31 · 2026-08-15 · Nuevo botón "RUT ↔ IDADMON": abre una vista pivote (en cliente, sobre las filas ya
//   cargadas) donde, por cada RUT, se muestran tantos bloques de tres columnas (IDADMON · Nº de pagos · fecha del
//   último pago) como IDADMON distintos le hayamos cobrado en BI, ordenados de más a menos pagos. Con buscador
//   (RUT o IDADMON) y filtro "solo RUT que pagan a varios IDADMON". No toca datos ni añade endpoint. Hereda v30.
// VERSION: v30 · 2026-08-14 · Ayuda del "?" reescrita al flujo real: (1) lo que hace el sistema solo (auto + validar
//   con "✓ auto"/chip "Por validar"), (2) cuándo asignas tú (+RUT o escribir el IDADMON en la celda, que ya vuelca
//   solo — se elimina el paso obsoleto "FALTA + botón"), (3) "Copiar FALTA" reencuadrado como repesca en lote, y
//   estados de check2 actualizados. Solo texto de ayuda; ninguna lógica cambia. Hereda v29.
// VERSION: v29 · 2026-08-14 · VALIDAR IDADMON AUTO. Los abonos con idadmon_origen='auto' (IDADMON que puso el
//   sistema solo al cargar la cartola) se RESALTAN con una barra ámbar a la izquierda y muestran en su celda un
//   botón "✓ auto": al pulsarlo se validan (pasa a 'manual' vía /api/bi/validar-idadmon, queda en bitácora y sale
//   de la lista). Nuevo chip "⚠ Por validar (n)" en el filtro de UNIQUE CONCEPT para aislar los pendientes. Hereda v28.
// VERSION: v28 · 2026-08-14 · Se QUITA el botón "Verificar si en CUENTAS" (acción null, ya no tenía sentido) y su
//   línea de ayuda. La barra de botones queda con "Copiar FALTA a CUENTAS" (el .map sigue funcionando con 1 solo). Hereda v27.
// VERSION: v27 · 2026-08-14 · Ajuste fino: Detalle mov. +10 caracteres (w210) y check2 más estrecha (w16). Hereda v26.
// VERSION: v26 · 2026-08-14 · La tabla usa el 100% del ancho (sin scroll horizontal): se quita el minWidth fijo de 1600
//   y se estrechan columnas (Detalle 150, UNIQUE 150, COMENTARIOS 130, check2 40, N°Doc/Cargo/Abono/Saldo/Reg/Desc menores).
//   Hereda v25 (check1 30, LIQ.MES2 54, DISCRIMINADOR oculta).
// VERSION: v25 · 2026-08-14 · Ajustes de columnas: check1 más estrecha (w30), check2 justo para "CORREGIDO" (w88),
//   LIQ. MES2 a ~6 caracteres (w54) y DISCRIMINADOR OCULTA (el dato sigue en `bi`). Hereda v24.
// VERSION: v24 · 2026-08-13 · Reasignar el IDADMON de un movimiento ahora AVISA (afecta al contrato anterior y al
//   nuevo, y a sus liquidaciones del mes): confirm al escribir un IDADMON distinto en UNIQUE CONCEPT y al usar +RUT,
//   solo cuando es reasignación real (viejo válido → nuevo distinto). El diálogo +RUT explica cuándo NO usarlo (ingreso
//   puntual → usar FALTA + "Copiar FALTA a CUENTAS"). Nuevo botón "?" con ayuda completa (dos procedimientos, botones,
//   estados FALTA/PASADO/CORREGIDO). Hereda v23.
// VERSION: v23 · 2026-08-13 · Filtro de cantidad (Cargo/Abono/Saldo) mejorado: (1) campo "Igual a (exacto)" para
//   buscar un valor concreto sin usar Desde/Hasta (si se rellena, manda sobre el rango). (2) Layout corregido:
//   los rótulos Desde/Hasta/Igual van ENCIMA de su input (antes se solapaban con el placeholder). Hereda v22.
// VERSION: v22 · 2026-08-12 · Columnas de dinero (Cargo/Abono/Saldo) con filtro por RANGO (Desde/Hasta) en vez de la
//   lista de valores; y sin "Ordenar" en esas columnas. El resto de columnas mantiene su filtro tipo Excel. Hereda v21.
// VERSION: v21 · 2026-08-04 · Columna "Descuento" movida a antes de COMENTARIOS (tras UNIQUE CONCEPT). Hereda v20 (Exportar Excel + LIQ. MES2).
// VERSION: v18 · 2026-07-29 · Botón renombrado a "Copiar FALTA a CUENTAS". El mensaje tras
//   copiar ahora informa de omitidos (ya estaban) y actualizados (reg existente con IDADMON
//   corregido), no solo de copiados — antes decía "0 copiados" sin explicar y parecía no hacer nada.
// VERSION: v17 · 2026-07-28 · La pantalla ya NO lee/escribe `bi` directo con anon (RLS lo bloquea:
//   0 filas). Lectura por GET /api/bi/movimientos y edición por PATCH, ambos service_role. Así
//   `bi` puede tener RLS activado y la pantalla sigue funcionando.
// VERSION: v16 · 2026-07-21 · El botón +RUT pasa a vivir DENTRO de la celda de UNIQUE CONCEPT (junto al de color), donde es más útil; se oculta la columna _asociar del final. UNIQUE CONCEPT algo más ancha.
// VERSION: v15 · 2026-07-21 · Oculta LIQ. MES2; quita botón 'Corregir en CUENTAS' (obsoleto, +RUT corrige solo); columna +RUT (bi_admon) fija a la derecha (sticky) para verla sin scroll.
// VERSION: v14 · 2026-07-21 · Oculta columna IDADMON (idadmon2, vestigio sin uso); ensancha DISCRIMINADOR (conocimiento para discriminar). Números en fuente monoespaciada.
// VERSION: v13 · 2026-07-19 · Fix dropdown filtro: pasa a position:fixed (coords al abrir) para
//   escapar del scroll de la tabla (overflow:auto/maxHeight:72vh); antes quedaba atrapado y se salía
//   por abajo. Altura acotada desde su posición hasta el borde inferior; botones siempre visibles.
// VERSION: v12 · 2026-07-19 · Dropdown del filtro acotado a la altura de pantalla: la lista de casillas
//   hace scroll y los botones Limpiar/Ver todos quedan siempre fijos abajo (sin bajar el zoom).
// VERSION: v11 · 2026-07-19 · Tooltip al hover: cada celda muestra su texto completo en la burbuja del
//   navegador (title en el <td>), para leer lo que se corta (UNIQUE CONCEPT, COMENTARIOS, DISCRIMINADOR…).
// VERSION: v10 · 2026-07-19 · Fix amarillo UNIQUE CONCEPT: un texto libre identificado (ej. "PO64-
//   PAVEZ, JUANA") quita el aviso amarillo "falta teclear IDADMON", igual que un IDADMON válido.
//   Vacío o IDADMON a medio teclear siguen en amarillo. (Complementa v9.)
// VERSION: v9 · 2026-07-19 · ➕RUT flexible: acepta IDADMON (Axxxxx) para todos los asociadores, y
//   además TEXTO LIBRE (ingreso de propietario, etc., sin límite) solo para Dirección/Karina. El texto
//   libre rellena UNIQUE CONCEPT y se asocia en bi_admon para reconocer ingresos futuros del mismo RUT.
// VERSION: v8 · 2026-07-19 · PARTE 2 colores manuales: columna bi.color_manual. Dirección/Karina pintan
//   la fila con un punto a la derecha de UNIQUE CONCEPT (Negocio SA naranja fuerte / A corregir amarillo /
//   Sin color / Automático). colorFila da prioridad al manual (naranja SA manda). El filtro de UNIQUE
//   CONCEPT pasa a filtrar por COLOR real (Abono / A corregir / Cargo / Negocio SA). Solo filtra/pinta.
// VERSION: v7 · 2026-07-18 · PARTE 1 filtros LOG: sustituye el filtro propio por el mecanismo del LOG
//   (ordenar A→Z/Z→A + casillas estilo Excel + buscador + "Seleccionar todo") en cada cabecera.
//   Se mantienen los chips de categoría en UNIQUE CONCEPT. Filtra en cliente sobre las 6.7k. Solo filtra/ordena.
// VERSION: v6 · 2026-07-15 · ASOCIA_EMAILS con los 4 emails reales (Anthony, Neika, Fabiola, Adalis).
//   Sin cambios de lógica respecto a v5; corrige la lista que se había quedado con placeholders.
// VERSION: v5 · 2026-07-15 · PARTE 2 (filtros): sustituye el filtro "contiene" por filtro tipo Excel
//   (casillas de valores + buscador + "solo" / "mostrar todos") en cada cabecera, filtrando en cliente
//   sobre las 6.7k ya cargadas. En UNIQUE CONCEPT, además, chips de categoría de color (Todos /
//   Identificados / Sin identificar / Cargos), combinables con las casillas. Los filtros SOLO filtran.
// VERSION: v4 · 2026-07-15 · PARTE 1 (cimiento de filtros): carga TODAS las filas de `bi` (paginado
//   por rangos), muestra por defecto solo las recientes con "Ver todo" (no vuelca 6.7k inputs de golpe),
//   y DESACTIVA el autorelleno de LIQ. MES2 (abrir la vista ya NO escribe nada). Solo lectura de datos.
// VERSION: v3 · 2026-07-15 · Segundo nivel de permiso: Anthony/Neika/Adalis/Fabiola pueden IDENTIFICAR
//   abonos (asociar RUT→IDADMON) por el drawer "➕ RUT" en modo manual (sin sugerencias). El rellenado
//   del movimiento lo hace el endpoint asociar-rut (server-side), así no dependen de escritura en `bi`.
//   Edición libre del resto del BI sigue siendo solo Dirección/Karina. Resto igual que v2.
// VERSION: v2 · 2026-07-09 · gate de escritura (solo Dirección y Karina) + columna LIQ. MES2 editable con validación AAMM
'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import TopNav from '@/app/components/ui/TopNav'

// ── Permisos de ESCRITURA del BI ──────────────────────────────────────────
// Ver la tabla bi lo puede hacer cualquiera con acceso al proceso (proceso_permisos).
// EDITAR (celdas, asociar RUT, copiar a CUENTAS, reasignar LIQ. MES2) queda
// reservado a Dirección y Karina, la MISMA lista que preparar-mes y EMAILS.
// El match es case-insensitive y sin espacios (evita el caso de correos con
// variantes que ya rompió permisos antes). Nota: este gate es de INTERFAZ;
// el blindaje server-side de los endpoints (cartola, asociar-rut, copiar-cuentas)
// es una segunda entrega pendiente.
const EDIT_EMAILS = [
  'alberto.cabezas@fondocapital.com',
  'luis.cabezas@fondocapital.com',
  'karina.morales@fondocapital.com',
]
// ── Segundo nivel: SOLO pueden IDENTIFICAR abonos (asociar RUT→IDADMON por el drawer
// "➕ RUT", en modo manual sin sugerencias). NO editan nada más del BI.
// Emails confirmados con crm_users (15-jul-2026). Coincidencia EXACTA, en minúsculas.
const ASOCIA_EMAILS = [
  'anthony.mendoza@fondocapital.com',
  'neika.duque@fondocapital.com',
  'fabiola.guerra@fondocapital.com',
  'adalis@fondocapital.com',
]
// AAMM de 4 dígitos, meses 01–12 (para validar la reasignación de LIQ. MES2).
const esAAMM = (v) => /^\d{2}(0[1-9]|1[0-2])$/.test(String(v ?? '').trim())

const num = (v) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d.-]/g, '')) || 0)
const fmt = (v) => { const n = num(v); return n ? n.toLocaleString('es-CL') : (String(v ?? '').trim() === '0' ? '0' : '') }
const LIMITE = 50
// Con la carga completa, por defecto se PINTAN solo las N más recientes (para no volcar miles de
// inputs de golpe). "Ver todo" pinta las 6.7k. El filtrado (Parte 2) mostrará todas las que casen.
const TOPE_DEFECTO = 300
// ── Ventana de render (virtualización casera) ─────────────────────────────────
//   ROW_H: alto fijo de cada fila (px). Todas las filas se fuerzan a este alto y a una sola línea, así el cálculo
//   de qué filas caen en pantalla es exacto (no hace falta medir cada fila). OVERSCAN: filas de más que se pintan
//   por arriba y por abajo del hueco visible para que al hacer scroll no se vea el borde en blanco.
const ROW_H = 30
const OVERSCAN = 10

// Extrae el RUT (dígitos-guión-verificador) del texto del detalle del movimiento.
// "Transferencia de otro banco 16111735-8" -> "16111735-8". Sin RUT -> ''.
function extraerRut(txt) {
  const m = String(txt ?? '').match(/(\d{5,9})-([\dkK])/)
  return m ? `${m[1]}-${m[2].toUpperCase()}` : ''
}

const COLS = [
  { key: 'fecha',                  h: 'Fecha',          ro: true, w: 72,  align: 'left',  filt: true },
  { key: 'detalle_movimiento',     h: 'Detalle mov.',   ro: true, w: 210, align: 'left',  filt: true, wrap: true },
  { key: 'n_doc',                  h: 'N° Doc',         ro: true, w: 74,  align: 'left',  filt: true },
  { key: 'cargos',                 h: 'Cargo',          ro: true, w: 74,  align: 'right', money: true, color: '#9B1C1C', filt: true },
  { key: 'abonos',                 h: 'Abono',          ro: true, w: 74,  align: 'right', money: true, color: '#085041', filt: true },
  { key: 'saldos',                 h: 'Saldo',          ro: true, w: 80,  align: 'right', money: true, filt: true },
  // check1 y check2 retirados de la vista (2026-08-15): eran vestigio del flujo Excel; ya no se usan.
  //   El dato check2_pasar_a_cartola sigue en `bi` (lo lee alguna lógica interna), solo no se muestra.
  { key: 'reg',                    h: 'Reg',            ro: true, w: 50,  align: 'left',  filt: true },
  { key: 'unique_concept',         h: 'UNIQUE CONCEPT', w: 150, align: 'left', filt: true },
  { key: '_descuentos',            h: 'Descuento',      ro: true, w: 52, align: 'center' },
  { key: 'comentarios',            h: 'COMENTARIOS',    w: 130, align: 'left', filt: true, wrap: true },
  { key: 'liquidacion_mes2',       h: 'LIQ. MES2',      w: 54,  align: 'left', filt: true },
  // IDADMON (idadmon2) oculto: vestigio del Excel VBA, sin uso en el CRM.
  // DISCRIMINADOR oculta (petición 2026-08-14): se deja de renderizar, el dato sigue en `bi`.
  // { key: 'discriminador',          h: 'DISCRIMINADOR',  w: 200, align: 'left', filt: true, wrap: true },
  // Columna +RUT (_asociar) oculta: el botón +RUT ahora vive dentro de la celda de UNIQUE CONCEPT, junto al de color.
  // { key: '_asociar',               h: 'bi_admon',       ro: true, w: 74, align: 'center' },
]
const I_REG = COLS.findIndex(c => c.key === 'reg')
const I_UC = COLS.findIndex(c => c.key === 'unique_concept')

// Paleta de colores del BI:
//   Naranja fuerte #F4A73B = negocio SA (manual, MANDA) · Amarillo #FEF7D6 = a corregir (auto+manual)
//   Azul #EAF2FB = abono identificado (auto) · Naranja clarito #FBECEC = cargo (auto)
const COLOR = { naranja_sa: '#F4A73B', amarillo: '#FEF7D6', abono: '#EAF2FB', cargo: '#FBECEC', ninguno: '#fff' }

function colorFila(m) {
  // 1) Color MANUAL guardado — tiene prioridad sobre el automático.
  const cm = String(m.color_manual || '').trim()
  if (cm === 'naranja_sa') return COLOR.naranja_sa   // negocio SA manda sobre todo
  if (cm === 'amarillo') return COLOR.amarillo
  if (cm === 'sin_color') return COLOR.ninguno        // fuerza quitar el automático
  // 2) Automático (cuando no hay marca manual).
  const ab = num(m.abonos), ca = num(m.cargos)
  if (ab > 0) return String(m.idadmon2 || m.unique_concept || '').trim() ? COLOR.abono : COLOR.amarillo
  if (ca > 0) return COLOR.cargo
  return COLOR.ninguno
}
// IDADMON válido: A + 5 dígitos (ej. A00819).
const esIdadmonValido = (uc) => /^A\d{5}$/.test(String(uc ?? '').trim().toUpperCase())
// ¿La celda de UNIQUE CONCEPT está IDENTIFICADA? (quita el amarillo de "falta teclear IDADMON")
//   vacío -> no · empieza por A+dígito -> debe ser Axxxxx completo · texto libre no vacío -> sí.
const estaIdentificado = (uc) => {
  const s = String(uc ?? '').trim()
  if (!s) return false
  if (/^A\d/i.test(s)) return esIdadmonValido(s)   // parece IDADMON: exige formato completo
  return true                                       // texto libre (ingreso de propietario, etc.): identificado
}

// LIQ. MES2 (AAMM) según la fecha de hoy (hora de Chile):
//   día >= 23 -> mes actual + 1   ·   día <= 22 -> mes actual
// Ej.: 23-jun -> 2607 · del 24-jun al 22-jul -> 2607 · 23-jul -> 2608.
function liqMes2Actual(base = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(base)
  const g = (t) => Number(partes.find((p) => p.type === t)?.value)
  let y = g('year'), m = g('month')
  const day = g('day')
  if (day >= 23) { m += 1; if (m > 12) { m = 1; y += 1 } }
  return `${String(y).slice(-2)}${String(m).padStart(2, '0')}`
}
function bgCelda(ci, r) {
  if (ci === I_REG) return '#C19A6B'
  if (ci >= I_UC) return colorFila(r)
  return '#fff'
}

// ── Filtro de cabecera estilo LOG: ordenar A→Z/Z→A + casillas Excel + buscador ──
// Opcional: `chips` renderiza una fila de botones de categoría arriba (para UNIQUE CONCEPT).
function ColFilterExcel({ label, col, sortCol, sortDir, onSort, opciones, value, onApply, align = 'left', chips, catFiltro, onCat, numeric = false, tree = false }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ left: 0, top: 0 })   // coords del dropdown (fixed)
  const [buscar, setBuscar] = useState('')
  const [pending, setPending] = useState(null)
  const [rango, setRango] = useState({ min: '', max: '', igual: '' })   // filtro por cantidad (columnas numéricas): rango o valor exacto
  const [expanded, setExpanded] = useState(() => new Set())   // años/meses desplegados en el árbol de fechas
  const ref = useRef(null)
  const btnRef = useRef(null)
  const popRef = useRef(null)   // el desplegable va por PORTAL a document.body, así que necesita su propio ref
  useEffect(() => {
    function handle(e) {
      const inWrap = ref.current && ref.current.contains(e.target)
      const inPop = popRef.current && popRef.current.contains(e.target)
      if (!inWrap && !inPop) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])
  useEffect(() => {
    if (open) {
      setBuscar('')
      if (numeric) setRango({ min: value?.min ?? '', max: value?.max ?? '', igual: value?.igual ?? '' })
      else setPending(new Set(value || []))
      if (tree) {   // al abrir, deja desplegado el año más reciente
        const ys = [...new Set((opciones || []).map(o => { const m = /\/(\d{4})$/.exec(String(o)); return m ? m[1] : null }).filter(Boolean))].sort()
        const last = ys[ys.length - 1]
        setExpanded(new Set(last ? ['Y:' + last] : []))
      }
    }
  }, [open]) // eslint-disable-line
  // Abre el dropdown calculando su posición fija (respecto a la pantalla, no a la tabla con scroll).
  const abrir = () => {
    if (open) { setOpen(false); return }
    const rc = btnRef.current?.getBoundingClientRect()
    if (rc) {
      const W = 250
      const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
      const left = align === 'right' ? Math.max(8, rc.right - W) : Math.min(rc.left, vw - W - 8)
      setPos({ left, top: rc.bottom + 4 })
    }
    setOpen(true)
  }
  const norm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  // Precalcula la forma normalizada de cada opci\u00f3n UNA vez (no en cada tecla). `opciones` llega ya
  // memoizado desde el padre \u2192 este useMemo solo se rehace si cambian los datos, no al teclear.
  const opcNorm = useMemo(() => (opciones || []).map(o => [o, norm(o)]), [opciones])
  const rangoActivo = numeric && value && typeof value === 'object' && !Array.isArray(value) && (value.min != null || value.max != null || value.igual != null)
  const activo = (!numeric && value && value.length > 0) || rangoActivo || (!numeric && sortCol === col) || (chips && catFiltro && catFiltro !== 'todos')
  const nb = norm(buscar)
  const visibles = !buscar ? (opciones || []) : opcNorm.filter(x => x[1].includes(nb)).map(x => x[0])
  const p = pending || new Set()
  const todasVisiblesMarcadas = visibles.length > 0 && visibles.every(o => p.has(o))
  const toggle = o => { const n = new Set(p); n.has(o) ? n.delete(o) : n.add(o); setPending(n) }
  const toggleTodas = () => { const n = new Set(p); todasVisiblesMarcadas ? visibles.forEach(o => n.delete(o)) : visibles.forEach(o => n.add(o)); setPending(n) }
  // ── Árbol de fechas (Año → Mes → Día) para la columna Fecha ──
  const MESES = ['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const toggleExp = (k) => setExpanded(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })
  const tri = (hojas) => (hojas.length && hojas.every(l => p.has(l))) ? 'yes' : hojas.some(l => p.has(l)) ? 'mid' : 'no'
  const toggleHojas = (hojas, on) => { const n = new Set(p); hojas.forEach(l => on ? n.add(l) : n.delete(l)); setPending(n) }
  // Agrupa las fechas VISIBLES (respeta el buscador) en { año: { mes: [dd/mm/aaaa...] } }.
  const treeData = {}
  if (tree && !numeric) for (const o of visibles) {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(o))
    const yy = m ? m[3] : '(sin fecha)'; const mm = m ? m[2] : '-'
    if (!treeData[yy]) treeData[yy] = {}
    if (!treeData[yy][mm]) treeData[yy][mm] = []
    treeData[yy][mm].push(o)
  }
  const toNum = (s) => { const t = String(s ?? '').trim(); if (t === '') return null; const n = Number(t.replace(/[^\d.-]/g, '')); return isNaN(n) ? null : n }
  const aplicar = () => {
    if (numeric) {
      const ig = toNum(rango.igual)
      onApply(col, ig != null ? { igual: ig } : { min: toNum(rango.min), max: toNum(rango.max) })
      setOpen(false); return
    }
    const arr = [...p]; onApply(col, (arr.length === 0 || arr.length === (opciones || []).length) ? [] : arr); setOpen(false)
  }
  const limpiar = () => {
    if (numeric) { setRango({ min: '', max: '' }); onApply(col, null); setOpen(false); return }
    setPending(new Set()); onApply(col, []); setOpen(false)
  }
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      <button ref={btnRef} onClick={abrir} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: activo ? '#1a56db' : '#5F5E5A', letterSpacing: '0.03em' }}>
        {label}
        <span style={{ fontSize: 9, color: activo ? '#1a56db' : '#B4B2A9' }}>
          {numeric ? (rangoActivo ? ' ⧩' : ' ⯬') : (value && value.length ? ' ⧩' : sortCol === col && sortDir === 'asc' ? ' ↑' : sortCol === col && sortDir === 'desc' ? ' ↓' : ' ⯬')}
        </span>
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div ref={popRef} style={{ position: 'fixed', left: pos.left, top: pos.top, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', width: 250, maxHeight: `calc(100vh - ${pos.top + 12}px)`, display: 'flex', flexDirection: 'column', zIndex: 4000, padding: 8, boxSizing: 'border-box' }}>
          {chips && (
            <>
              <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 500, marginBottom: 6, textTransform: 'uppercase' }}>Categoría</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #F3F4F6' }}>
                {chips.map(([k, lab, col]) => (
                  <button key={k} onClick={() => onCat(k)} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, padding: '3px 8px', borderRadius: 12, cursor: 'pointer', border: '1px solid ' + (catFiltro === k ? '#1a56db' : '#E5E7EB'), background: catFiltro === k ? '#1a56db' : '#fff', color: catFiltro === k ? '#fff' : '#374151', fontWeight: catFiltro === k ? 600 : 400 }}>
                    {col && <span style={{ width: 10, height: 10, borderRadius: '50%', border: '1px solid #9A968C', background: col, flexShrink: 0 }} />}
                    {lab}
                  </button>
                ))}
              </div>
            </>
          )}
          {numeric ? (
            <>
              <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 500, marginBottom: 6, textTransform: 'uppercase' }}>Filtrar por cantidad</div>
              <div style={{ fontSize: 10.5, color: '#94A3B8', marginBottom: 8 }}>Un valor exacto, o un rango Desde/Hasta (deja un lado vacío para acotar solo por uno).</div>
              {/* Valor exacto: si se rellena, manda sobre el rango */}
              <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: '#6B7280', marginBottom: 8 }}>
                <span>Igual a (exacto)</span>
                <input inputMode="numeric" value={rango.igual} onChange={e => setRango(v => ({ ...v, igual: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') aplicar() }} placeholder="valor exacto"
                  style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #E5E7EB', fontSize: 12, boxSizing: 'border-box', textAlign: 'right', fontFamily: 'ui-monospace, monospace' }} />
              </label>
              <div style={{ fontSize: 10, color: '#CBD5E1', textAlign: 'center', margin: '0 0 8px' }}>— o un rango —</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 4, opacity: String(rango.igual).trim() ? 0.4 : 1 }}>
                <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: '#6B7280' }}>
                  <span>Desde</span>
                  <input inputMode="numeric" value={rango.min} onChange={e => setRango(v => ({ ...v, min: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') aplicar() }} placeholder="mín"
                    style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #E5E7EB', fontSize: 12, boxSizing: 'border-box', textAlign: 'right', fontFamily: 'ui-monospace, monospace' }} />
                </label>
                <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: '#6B7280' }}>
                  <span>Hasta</span>
                  <input inputMode="numeric" value={rango.max} onChange={e => setRango(v => ({ ...v, max: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') aplicar() }} placeholder="máx"
                    style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #E5E7EB', fontSize: 12, boxSizing: 'border-box', textAlign: 'right', fontFamily: 'ui-monospace, monospace' }} />
                </label>
              </div>
              <div style={{ height: 8 }} />
            </>
          ) : (
            <>
              <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 500, marginBottom: 6, textTransform: 'uppercase' }}>Ordenar</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                {[['asc', 'A → Z'], ['desc', 'Z → A']].map(([dir, lbl]) => (
                  <button key={dir} onClick={() => { onSort(col, dir); setOpen(false) }} style={{ flex: 1, padding: '4px 8px', borderRadius: 6, border: '1px solid', fontSize: 11, cursor: 'pointer', background: sortCol === col && sortDir === dir ? '#EFF6FF' : '#F9FAFB', borderColor: sortCol === col && sortDir === dir ? '#BFDBFE' : '#E5E7EB', color: sortCol === col && sortDir === dir ? '#1D4ED8' : '#374151' }}>{lbl}</button>
                ))}
              </div>
              <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 500, marginBottom: 4, textTransform: 'uppercase' }}>Filtrar</div>
              <div style={{ fontSize: 10.5, color: '#94A3B8', marginBottom: 6 }}>Marca los que quieres ver (vacío = todos).</div>
              <input autoFocus placeholder={`Buscar ${String(label).toLowerCase()}...`} value={buscar} onChange={e => setBuscar(e.target.value)} style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #E5E7EB', fontSize: 12, boxSizing: 'border-box', marginBottom: 6 }} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#374151', borderBottom: '1px solid #F3F4F6' }}>
                <input type="checkbox" checked={todasVisiblesMarcadas} onChange={toggleTodas} style={{ margin: 0 }} />
                (Seleccionar todo){buscar ? ' (lo visible)' : ''}
              </label>
              <div style={{ flex: 1, minHeight: 40, overflowY: 'auto', margin: '2px 0 8px' }}>
                {visibles.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#9CA3AF', padding: '8px 4px' }}>Sin coincidencias</div>
                ) : tree ? (
                  Object.keys(treeData).sort((a, b) => b.localeCompare(a)).map(yy => {
                    const meses = treeData[yy]
                    const hojasY = Object.values(meses).flat()
                    const stY = tri(hojasY)
                    const abiertoY = !!buscar || expanded.has('Y:' + yy)
                    return (
                      <div key={yy}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 2px' }}>
                          <span onClick={() => toggleExp('Y:' + yy)} style={{ cursor: 'pointer', width: 14, textAlign: 'center', color: '#9CA3AF', fontSize: 10, userSelect: 'none' }}>{abiertoY ? '▾' : '▸'}</span>
                          <input type="checkbox" ref={el => { if (el) el.indeterminate = stY === 'mid' }} checked={stY === 'yes'} onChange={() => toggleHojas(hojasY, stY !== 'yes')} style={{ margin: 0 }} />
                          <span style={{ fontWeight: 700, fontSize: 12 }}>{yy}</span>
                          <span style={{ fontSize: 10, color: '#B4B2A9' }}>({hojasY.length})</span>
                        </div>
                        {abiertoY && Object.keys(meses).sort((a, b) => b.localeCompare(a)).map(mm => {
                          const dias = meses[mm]
                          const stM = tri(dias)
                          const abiertoM = !!buscar || expanded.has('M:' + yy + mm)
                          return (
                            <div key={mm} style={{ marginLeft: 16 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 2px' }}>
                                <span onClick={() => toggleExp('M:' + yy + mm)} style={{ cursor: 'pointer', width: 14, textAlign: 'center', color: '#9CA3AF', fontSize: 10, userSelect: 'none' }}>{abiertoM ? '▾' : '▸'}</span>
                                <input type="checkbox" ref={el => { if (el) el.indeterminate = stM === 'mid' }} checked={stM === 'yes'} onChange={() => toggleHojas(dias, stM !== 'yes')} style={{ margin: 0 }} />
                                <span style={{ fontSize: 12, textTransform: 'capitalize' }}>{MESES[parseInt(mm, 10)] || mm}</span>
                                <span style={{ fontSize: 10, color: '#B4B2A9' }}>({dias.length})</span>
                              </div>
                              {abiertoM && dias.slice().sort((a, b) => b.localeCompare(a)).map(d => (
                                <label key={d} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 4px', marginLeft: 16, fontSize: 12, cursor: 'pointer', color: '#374151' }}>
                                  <input type="checkbox" checked={p.has(d)} onChange={() => toggle(d)} style={{ margin: 0, flexShrink: 0 }} />
                                  <span>{d}</span>
                                </label>
                              ))}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })
                ) : (
                  <>
                    {visibles.slice(0, 300).map(o => (
                      <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: '#374151' }}>
                        <input type="checkbox" checked={p.has(o)} onChange={() => toggle(o)} style={{ margin: 0, flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={o}>{o}</span>
                      </label>
                    ))}
                    {visibles.length > 300 && (
                      <div style={{ fontSize: 11, color: '#9CA3AF', padding: '6px 4px' }}>Mostrando 300 de {visibles.length}. Escribe arriba para afinar (o marca «Seleccionar todo» sobre lo buscado).</div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button onClick={limpiar} style={{ flex: 1, padding: 5, borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', fontSize: 12, cursor: 'pointer', color: '#6B7280' }}>Limpiar</button>
            <button onClick={aplicar} style={{ flex: 1, padding: 5, borderRadius: 6, border: 'none', background: '#1a56db', fontSize: 12, cursor: 'pointer', color: '#fff', fontWeight: 500 }}>{numeric ? 'Aplicar' : ([...p].length ? `Aplicar (${[...p].length})` : 'Ver todos')}</button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default function BiVista() {
  const { data: session, status } = useSession()
  const router = useRouter()
  // ¿El usuario logueado puede EDITAR el BI? (Dirección y Karina). Normalizado.
  const emailSesion = (session?.user?.email || '').trim().toLowerCase()
  const puedeEditar = EDIT_EMAILS.includes(emailSesion)
  // Puede IDENTIFICAR abonos (asociar RUT): edición total, o el segundo nivel (los 4).
  const puedeAsociar = puedeEditar || ASOCIA_EMAILS.includes(emailSesion)
  const [rows, setRows] = useState([])               // ascendente por id: antiguos arriba, recientes abajo
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [noMore, setNoMore] = useState(false)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [verTodos, setVerTodos] = useState(false)   // false = solo recientes (TOPE_DEFECTO); true = todas
  const [filtros, setFiltros] = useState({})        // { col: [valores marcados] } — filtro Excel del LOG
  const [catFiltro, setCatFiltro] = useState('todos') // chips: todos|identificados|sinid|cargos
  const [sortCol, setSortCol] = useState(null)      // columna de ordenación (key)
  const [sortDir, setSortDir] = useState('asc')     // 'asc' | 'desc'
  const [savingId, setSavingId] = useState(null)
  const [colorOpen, setColorOpen] = useState(null)   // { row, x, y } — selector de color de fila
  const [toast, setToast] = useState(null)
  const [descOpen, setDescOpen] = useState(null)   // { row, x, y, modo } popover de descuentos
  const [descRows, setDescRows] = useState([])
  const [descLoading, setDescLoading] = useState(false)
  const [descQuery, setDescQuery] = useState('')   // buscador libre dentro del popover
  // Drawer "Asociar RUT" (busca en cuentas y escribe en bi_admon)
  const [asocOpen, setAsocOpen] = useState(null)   // { row, rut }
  const [asocLoading, setAsocLoading] = useState(false)
  const [asocCands, setAsocCands] = useState([])   // [{ idadmon, veces }]
  const [asocErr, setAsocErr] = useState(null)
  const [asocId, setAsocId] = useState('')         // idadmon escrito a mano
  const [asocGuardando, setAsocGuardando] = useState(false)
  const [validando, setValidando] = useState(null)  // id del movimiento que se está validando (auto→manual)
  const scrollRef = useRef(null)
  const anclarAbajo = useRef(false)
  const pendingAdjust = useRef(null)
  // Ventana de render: posición del scroll y alto visible del contenedor. Con esto calculamos qué franja
  // de filas pintar. Se actualizan al hacer scroll (y el alto también al montar/redimensionar).
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportH, setViewportH] = useState(600)

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(null), 1400) }

  useEffect(() => { if (status === 'unauthenticated') router.push('/api/auth/signin') }, [status, router])

  // (La carga la hace /api/bi/movimientos por service_role; el filtrado es en cliente.)

  // Valor de una celda para el filtro (vacío -> "(vacío)").
  const valorCelda = (r, key) => { const v = r[key]; return (v ?? '') === '' ? '(vacío)' : String(v) }
  // Valores distintos de una columna (sobre TODAS las filas cargadas), ordenados.
  const valoresUnicos = (key) => {
    const s = new Set()
    rows.forEach(r => s.add(valorCelda(r, key)))
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'es'))
  }
  // Opciones de filtro por columna, MEMOIZADAS: se calculan UNA vez por carga de datos (no en cada
  // render ni al teclear). Antes valoresUnicos() se ejecutaba para TODAS las columnas en cada render
  // (7040 filas × localeCompare por columna) → causa de la lentitud y del "enganche" del filtro.
  const opcionesPorCol = useMemo(() => {
    const cols = COLS.filter(c => c.filt && !c.money)
    const sets = {}
    for (const c of cols) sets[c.key] = new Set()
    for (const r of rows) for (const c of cols) sets[c.key].add(valorCelda(r, c.key))
    const out = {}
    for (const c of cols) out[c.key] = Array.from(sets[c.key]).sort((a, b) => a.localeCompare(b, 'es'))
    return out
  }, [rows])
  // Categoría de la fila para los chips de color (misma lógica que colorFila / la leyenda).
  const categoriaFila = (r) => {
    const ab = num(r.abonos), ca = num(r.cargos)
    if (ab > 0) return String(r.idadmon2 || r.unique_concept || '').trim() ? 'identificados' : 'sinid'
    if (ca > 0) return 'cargos'
    return 'otros'
  }
  // ¿La columna tiene un filtro de casillas activo? (array con valores)
  const colFiltrada = (key) => {
    const a = filtros[key]
    if (Array.isArray(a)) return a.length > 0
    if (a && typeof a === 'object') return a.min != null || a.max != null || a.igual != null   // filtro numérico (rango o exacto)
    return false
  }
  const hayFiltroActivo = catFiltro !== 'todos' || COLS.some(c => colFiltrada(c.key)) || !!sortCol
  const onSort = (col, dir) => { setSortCol(col); setSortDir(dir) }
  const onApply = (col, val) => setFiltros(prev => {
    const n = { ...prev }
    const vacio = !val
      || (Array.isArray(val) && val.length === 0)
      || (typeof val === 'object' && !Array.isArray(val) && val.min == null && val.max == null && val.igual == null)
    if (vacio) delete n[col]; else n[col] = val
    return n
  })

  const fetchInitial = async (fActuales = filtros) => {
    setRefreshing(true); setError(null); setNoMore(true)
    // Lectura por el servidor (service_role): el navegador no puede leer `bi` directo porque
    // RLS lo deniega (devolvería 0 filas). La API trae todas las filas ya paginadas.
    try {
      const res = await fetch('/api/bi/movimientos')
      const d = await res.json()
      if (!res.ok) { setError(d.error || 'Error cargando movimientos'); setRefreshing(false); setLoading(false); return }
      anclarAbajo.current = true
      setRows(d.filas || [])
    } catch (e) {
      setError('Error de conexión al cargar movimientos: ' + (e?.message || e))
    }
    setRefreshing(false); setLoading(false)
  }
  useEffect(() => { fetchInitial({}) }, [])

  // ── Autorelleno de LIQ. MES2: DESACTIVADO (Parte 1, opción A) ──────────────
  // Antes, al abrir la vista se escribía el mes en curso a las filas sin valor. Con la carga
  // completa eso dispararía miles de escrituras al abrir. Como esta vista pasa a ser de solo
  // lectura para el filtrado, NO se autorellena nada. (La reasignación manual de LIQ. MES2 por
  // Dirección/Karina en su celda sigue funcionando igual.)
  const liqDoneRef = useRef(new Set())   // conservado por compatibilidad; ya no se usa para escribir

  // Guarda primero lo que se esté editando (celda con foco) y LUEGO refresca.
  // Sin esto, si el usuario escribe en una celda y pulsa el botón sin salir
  // de ella, el onBlur no llega a dispararse y la recarga borra lo escrito.
  const guardarYRefrescar = async () => {
    const ae = document.activeElement
    if (ae && ae.tagName === 'INPUT') {
      ae.blur()                                   // dispara el onBlur -> guardarCelda
      await new Promise(res => setTimeout(res, 350)) // esperar a que guarde en Supabase
    }
    fetchInitial()
  }

  // Con la carga completa por la API, ya están TODAS las filas en memoria: no hace falta traer
  // más al hacer scroll. loadMore queda como no-op (se conserva onScroll para no tocar el JSX).
  const loadMore = async () => {}

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (pendingAdjust.current) {
      const { prevH, prevT } = pendingAdjust.current
      el.scrollTop = prevT + (el.scrollHeight - prevH)
      pendingAdjust.current = null
    } else if (anclarAbajo.current) {
      el.scrollTop = el.scrollHeight
      anclarAbajo.current = false
    }
  }, [rows])

  // Al hacer scroll: recalculamos la franja visible (barato: solo cambian dos números). También refrescamos
  // el alto del contenedor por si cambió (redimensionar ventana). loadMore quedó como no-op (todo en memoria).
  const onScroll = (e) => {
    const el = e.currentTarget
    setScrollTop(el.scrollTop)
    if (el.clientHeight && el.clientHeight !== viewportH) setViewportH(el.clientHeight)
  }
  // Al montar / cuando llegan las filas: fijar el alto visible real del contenedor (si difiere del estimado).
  useEffect(() => {
    const el = scrollRef.current
    if (el?.clientHeight && el.clientHeight !== viewportH) setViewportH(el.clientHeight)
  }, [rows])
  // Al cambiar filtros/orden, la lista se acorta: volvemos arriba para no quedar en una franja vacía.
  useEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = 0; setScrollTop(0) }, [catFiltro, filtros, sortCol, sortDir])

  // check1 (saltos/duplicados) sobre la secuencia COMPLETA, siempre — así es correcto.
  const conCheck = useMemo(() => {
    return rows.map((r, i) => {
      if (i === 0) return { ...r, _check1: null }
      const prev = rows[i - 1]
      const c1 = Math.round(num(prev.saldos) - num(r.cargos) + num(r.abonos) - num(r.saldos))
      return { ...r, _check1: c1 }
    })
  }, [rows])

  // Aplica los filtros: categoría (chips) + casillas por columna (arrays) + ordenación.
  // Si hay filtro/orden activo, se oculta check1 (deja de tener sentido sobre un subconjunto/reordenado).
  const filas = useMemo(() => {
    let out = conCheck
    if (catFiltro === 'por_validar') out = out.filter(r => String(r.idadmon_origen ?? '').trim() === 'auto')
    else if (catFiltro !== 'todos') out = out.filter(r => colorFila(r) === catFiltro)
    const activos = Object.entries(filtros).filter(([, a]) =>
      (Array.isArray(a) && a.length > 0) || (a && typeof a === 'object' && !Array.isArray(a) && (a.min != null || a.max != null || a.igual != null)))
    if (activos.length) out = out.filter(r => activos.every(([k, a]) => {
      if (Array.isArray(a)) return a.includes(valorCelda(r, k))   // filtro de casillas (texto)
      const x = num(r[k])                                          // filtro numérico (exacto o rango)
      if (a.igual != null) return x === a.igual                    // valor exacto: manda sobre el rango
      if (a.min != null && x < a.min) return false
      if (a.max != null && x > a.max) return false
      return true
    }))
    if (sortCol) {
      const dir = sortDir === 'asc' ? 1 : -1
      out = [...out].sort((x, y) => valorCelda(x, sortCol).localeCompare(valorCelda(y, sortCol), 'es', { numeric: true }) * dir)
    }
    if (hayFiltroActivo) out = out.map(r => ({ ...r, _check1: null }))
    return out
  }, [conCheck, catFiltro, filtros, sortCol, sortDir, hayFiltroActivo])

  // Qué filas se PINTAN. check1 se calcula sobre TODA la secuencia (arriba), pero por defecto
  // solo mostramos las recientes para no volcar miles de inputs. "Ver todo" las pinta todas.
  // (En la Parte 2, con filtro activo se mostrarán todas las que casen.)
  // Se muestran SIEMPRE todas las filas filtradas (se quitó el toggle "Ver todo/Ver recientes").
  // Para acotar, usa los filtros de cabecera (árbol de fechas, buscar Reg, etc.).
  // Ventana de render: de todas las filas filtradas (`filas`) solo pintamos las que caen en pantalla
  // (± OVERSCAN). `padTop`/`padBottom` son el alto que reservan las filas no pintadas (arriba y abajo),
  // así la barra de scroll y las posiciones son las de la lista completa.
  const total = filas.length
  const winStart = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN)
  const winEnd = Math.min(total, Math.ceil((scrollTop + viewportH) / ROW_H) + OVERSCAN)
  const visibles = filas.slice(winStart, winEnd)
  const padTop = winStart * ROW_H
  const padBottom = Math.max(0, (total - winEnd) * ROW_H)

  const onLocal = (id, k, v) => setRows(rs => rs.map(r => r.id === id ? { ...r, [k]: v } : r))
  const [ayudaOpen, setAyudaOpen] = useState(false)

  // ── Vista "RUT → IDADMON": por cada RUT, tantos bloques (IDADMON · nº pagos · última fecha)
  //    como IDADMON distintos le hayamos cobrado en BI. Se calcula en cliente sobre las filas ya cargadas.
  const [rutViewOpen, setRutViewOpen] = useState(false)
  const [rutQuery, setRutQuery] = useState('')
  const [soloVarios, setSoloVarios] = useState(false)
  const rutIdadmon = useMemo(() => {
    const keyF = (f) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(f || '')); return m ? (m[3] + m[2] + m[1]) : '' }
    const mapa = new Map()   // rut -> Map(idadmon -> {idadmon, pagos, key, ultima, monto})
    for (const r of rows) {
      if (num(r.abonos) <= 0) continue
      const uc = String(r.unique_concept ?? '').trim().toUpperCase()
      if (!esIdadmonValido(uc)) continue
      const rut = extraerRut(r.detalle_movimiento)
      if (!rut) continue
      if (!mapa.has(rut)) mapa.set(rut, new Map())
      const mi = mapa.get(rut)
      const cur = mi.get(uc) || { idadmon: uc, pagos: 0, key: '', ultima: '', monto: 0, montoUlt: 0 }
      cur.pagos += 1
      cur.monto += num(r.abonos)
      const k = keyF(r.fecha)
      // montoUlt = importe del pago MÁS RECIENTE (el de la última fecha), no la suma.
      if (k && k > cur.key) { cur.key = k; cur.ultima = r.fecha; cur.montoUlt = num(r.abonos) }
      mi.set(uc, cur)
    }
    const out = []
    for (const [rut, mi] of mapa) {
      const grupos = [...mi.values()].sort((a, b) => b.pagos - a.pagos || (a.idadmon < b.idadmon ? -1 : 1))
      out.push({ rut, grupos, n: grupos.length, total: grupos.reduce((s, g) => s + g.pagos, 0) })
    }
    out.sort((a, b) => (a.rut < b.rut ? -1 : a.rut > b.rut ? 1 : 0))
    return out
  }, [rows])
  const rutIdadmonView = useMemo(() => {
    const q = rutQuery.trim().toUpperCase()
    return rutIdadmon.filter(x => {
      if (soloVarios && x.n < 2) return false
      if (!q) return true
      if (x.rut.toUpperCase().includes(q)) return true
      return x.grupos.some(g => g.idadmon.includes(q))
    })
  }, [rutIdadmon, rutQuery, soloVarios])
  const rutMaxGrupos = useMemo(() => rutIdadmonView.reduce((m, x) => Math.max(m, x.n), 0), [rutIdadmonView])
  // Aviso al REASIGNAR un movimiento de un IDADMON a otro (afecta al anterior y al nuevo + sus liquidaciones del mes).
  const RE_IDADMON = /^A\d{5}$/
  const esReasignacion = (viejo, nuevo) => {
    const v = String(viejo || '').trim().toUpperCase(), n = String(nuevo || '').trim().toUpperCase()
    return RE_IDADMON.test(v) && RE_IDADMON.test(n) && v !== n
  }
  const AVISO_REASIGNACION =
    '⚠ Estás REASIGNANDO este movimiento a otro IDADMON.\n\n' +
    'El abono/cargo se moverá del IDADMON anterior al nuevo:\n' +
    '• el anterior lo PIERDE (su cartola baja → puede subir su falta de arriendo),\n' +
    '• el nuevo lo GANA (su cartola sube → baja su falta).\n\n' +
    'Afecta a las cartolas y a la liquidación del mes de AMBOS contratos.\n' +
    'Después, revisa la cartola del anterior y la del nuevo, y la liquidación del mes en los dos.\n\n' +
    '¿Confirmas el cambio?'

  const guardarCelda = async (id, k, valor) => {
    if (!puedeEditar) { flash('Solo Dirección y Karina pueden editar el BI'); return }
    const v = valor === '' ? null : valor
    setSavingId(id)
    try {
      const res = await fetch('/api/bi/movimientos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, campo: k, valor: v }),
      })
      const d = await res.json()
      setSavingId(null)
      if (!res.ok) { setError(d.error || 'No se pudo guardar'); return }
      setRows(rs => rs.map(r => r.id === id ? { ...r, [k]: v } : r))
      flash('✓ Guardado')
    } catch (e) {
      setSavingId(null)
      setError('Error de conexión al guardar: ' + (e?.message || e))
    }
  }

  // ── Selector de color manual de la fila (solo Dirección/Karina) ──────────
  const abrirColor = (r, e) => {
    e.stopPropagation()
    const rc = e.currentTarget.getBoundingClientRect()
    setColorOpen(colorOpen && colorOpen.row.id === r.id ? null : { row: r, x: rc.left, y: rc.bottom + 2 })
  }
  // val: 'naranja_sa' | 'amarillo' | 'sin_color' | 'auto' (auto = null, vuelve al automático)
  const aplicarColor = async (id, val) => {
    setColorOpen(null)
    await guardarCelda(id, 'color_manual', val === 'auto' ? '' : val)
  }

  // ── Asociar RUT a IDADMON en bi_admon (origen: cuentas) ──────────────────
  const abrirAsociar = async (r) => {
    if (!puedeAsociar) { flash('No tienes permiso para asociar RUT en el BI'); return }
    const rut = extraerRut(r.detalle_movimiento)
    if (!rut) { flash('No se encontró un RUT en el detalle'); return }
    // Los del segundo nivel (no editores totales) van en modo MANUAL: sin sugerencias de IDADMON.
    const soloManual = !puedeEditar
    setAsocOpen({ row: r, rut, soloManual }); setAsocCands([]); setAsocErr(null); setAsocId('')
    if (soloManual) { setAsocLoading(false); return }   // no se buscan candidatos
    setAsocLoading(true)
    try {
      const res = await fetch('/api/bi/asociar-rut?rut=' + encodeURIComponent(rut))
      const d = await res.json()
      if (!res.ok) { setAsocErr(d.error || 'Error al buscar'); setAsocLoading(false); return }
      setAsocCands(d.candidatos || [])
    } catch { setAsocErr('Error de conexión') }
    setAsocLoading(false)
  }

  const asociarRut = async (entrada) => {
    const raw = String(entrada || '').trim()
    if (!raw) { setAsocErr('Escribe un IDADMON o un texto de identificación'); return }
    let valor
    if (/^a\d/i.test(raw)) {
      // Parece IDADMON -> exigir formato Axxxxx (6 caracteres).
      const id = raw.toUpperCase()
      if (!/^A\d{5}$/.test(id)) { setAsocErr('IDADMON no válido (debe ser Axxxxx, ej. A00819)'); return }
      valor = id
    } else {
      // Texto libre (ingreso de propietario, etc.) -> SOLO Dirección/Karina, sin límite de caracteres.
      if (!puedeEditar) { setAsocErr('Solo puedes asociar un IDADMON (Axxxxx). El texto libre está reservado a Dirección/Karina.'); return }
      valor = raw
    }
    const { row, rut } = asocOpen
    // Si ya tenía un IDADMON válido y lo cambias por otro, es una reasignación: avisar de las consecuencias.
    if (esReasignacion(row.unique_concept, valor) && !window.confirm(AVISO_REASIGNACION)) { return }
    setAsocGuardando(true); setAsocErr(null)
    try {
      // Pasamos biId: el endpoint asocia en bi_admon Y rellena este movimiento (server-side).
      const res = await fetch('/api/bi/asociar-rut', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rut, idadmon: valor, biId: row.id }),
      })
      const d = await res.json()
      if (!res.ok) { setAsocErr(d.error || 'Error al asociar'); setAsocGuardando(false); return }
      if (d.rellenado === false && d.errorRelleno) {
        setAsocErr('Se asoció el RUT pero no se pudo rellenar el movimiento: ' + d.errorRelleno)
        setAsocGuardando(false); return
      }
      // Reflejar en la vista el valor que el endpoint ya escribió en unique_concept.
      setRows(rs => rs.map(r => r.id === row.id ? { ...r, unique_concept: valor } : r))
      flash(d.yaExistia ? `Ya estaba asociado (${rut} → ${valor})` : `✓ Asociado ${rut} → ${valor}`)
      setAsocGuardando(false); setAsocOpen(null)
    } catch { setAsocErr('Error de conexión'); setAsocGuardando(false) }
  }

  // ── Validar un IDADMON auto-asignado ────────────────────────────────────────
  // Confirma que el IDADMON que el sistema puso solo (idadmon_origen='auto') es el correcto:
  // lo pasa a 'manual' (queda registrado en bi_idadmon_log) y con eso sale de "pendientes de validar".
  const validarIdadmon = async (r) => {
    if (!puedeAsociar) { flash('No tienes permiso para validar'); return }
    setValidando(r.id)
    try {
      const res = await fetch('/api/bi/validar-idadmon', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: r.id }),
      })
      const d = await res.json()
      if (!res.ok) { flash(d.error || 'No se pudo validar'); setValidando(null); return }
      setRows(rs => rs.map(x => x.id === r.id ? { ...x, idadmon_origen: 'manual' } : x))
      flash('✓ Validado ' + (r.unique_concept || ''))
    } catch { flash('Error de conexión al validar') }
    setValidando(null)
  }

  // Exporta a Excel EXACTAMENTE lo filtrado (variable `filas`), con las columnas visibles de la tabla.
  async function exportarExcel() {
    const XLSX = await import('xlsx')
    // columnas reales de datos (se excluyen las "sintéticas" de acción: _check1, _descuentos, etc.)
    const cols = COLS.filter(c => !c.key.startsWith('_'))
    const salida = filas.map(m => {
      const o = {}
      for (const c of cols) {
        let v = m[c.key]
        if (c.money) v = (v == null || v === '') ? '' : Number(v)   // montos como número
        else v = v == null ? '' : v
        o[c.h] = v
      }
      return o
    })
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(salida)
    XLSX.utils.book_append_sheet(wb, ws, 'BI Movimientos')
    const hoy = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `BI_Movimientos_${hoy}.xlsx`)
  }


  // Parte B: localizar el descuento que justifica un movimiento y pegar su
  // texto_para_contabilidad en UNIQUE CONCEPT. Dos modos:
  //  - abono con IDADMON  -> descuentos de ese IDADMON
  //  - egreso (cargo)     -> descuentos con monto_a_transferir = cargo (candidatos por importe)
  // Lectura server-side (service role) para no depender del RLS de descuentos.
  const buscarDescuentos = async ({ monto, q }) => {
    setDescLoading(true)
    try {
      const p = new URLSearchParams()
      if (monto != null) p.set('monto', String(monto))
      if (q) p.set('q', q)
      const res = await fetch(`/api/descuentos/buscar?${p.toString()}`)
      const d = await res.json()
      setDescRows(d.rows || [])
    } catch { setDescRows([]) }
    finally { setDescLoading(false) }
  }

  const abrirDescuentos = async (r, e) => {
    const rc = e.currentTarget.getBoundingClientRect()
    if (descOpen && descOpen.row?.id === r.id) { setDescOpen(null); return }
    const idadmon = String(r.idadmon2 || '').trim().toUpperCase()
    const cargo = num(r.cargos)
    const modo = cargo > 0 ? 'importe' : 'idadmon'
    setDescOpen({ row: r, x: rc.left, y: rc.bottom + 2, modo })
    setDescRows([]); setDescQuery('')
    if (modo === 'importe') await buscarDescuentos({ monto: Math.round(cargo) })
    else if (idadmon) {
      setDescLoading(true)
      try {
        const res = await fetch(`/api/descuentos/por-idadmon?idadmon=${encodeURIComponent(idadmon)}`)
        const d = await res.json()
        setDescRows(d.rows || [])
      } catch { setDescRows([]) }
      finally { setDescLoading(false) }
    }
  }

  // Pega el texto_para_contabilidad del descuento elegido en UNIQUE CONCEPT de la fila.
  const usarEnUniqueConcept = async (d) => {
    if (!descOpen?.row) return
    const txt = String(d.texto_para_contabilidad || '').trim()
    if (!txt) return
    const actual = String(descOpen.row.unique_concept || '').trim()
    // si ya hay un texto de contabilidad (empieza por "num Axxxxx"), pedir confirmación
    const yaTieneTexto = /^\d+\s+A\d{5}\b/.test(actual)
    if (yaTieneTexto && !confirm(`UNIQUE CONCEPT ya tiene:\n\n${actual}\n\n¿Reemplazar por?\n\n${txt}`)) return
    await guardarCelda(descOpen.row.id, 'unique_concept', txt)
    setDescOpen(null)
  }

  const copiarTexto = async (t) => {
    const txt = String(t ?? '')
    if (!txt) return
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(txt)
      } else {
        const ta = document.createElement('textarea')
        ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0'
        document.body.appendChild(ta); ta.select()
        document.execCommand('copy'); document.body.removeChild(ta)
      }
      flash('✓ Texto copiado')
    } catch { /* si falla, no rompemos nada */ }
  }

  if (status === 'loading' || loading)
    return (<><TopNav /><div style={{ padding: 60, textAlign: 'center', color: '#888', fontSize: 14 }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#5F5E5A', marginBottom: 6 }}>Cargando todos los movimientos…</div>
      <div style={{ fontSize: 12.5, color: '#8A8780', lineHeight: 1.5 }}>Traemos la tabla completa a memoria (unos segundos la primera vez).<br />A partir de ahí el filtrado y el desplazamiento van al instante.</div>
    </div></>)

  const abonos = rows.filter(r => num(r.abonos) > 0).length
  const cargos = rows.filter(r => num(r.cargos) > 0).length
  const sinId = rows.filter(r => num(r.abonos) > 0 && !String(r.idadmon2 || r.unique_concept || '').trim()).length

  const cell = (r, c) => {
    if (c.key === '_check1') return r._check1 == null
      ? <span style={{ color: '#B4B2A9' }}>—</span>
      : <span style={{ fontWeight: 600, color: r._check1 === 0 ? '#1D9E75' : '#9B1C1C' }}>{r._check1}</span>
    if (c.key === '_descuentos') {
      const tieneId = String(r.idadmon2 || '').trim() !== ''
      const esEgreso = num(r.cargos) > 0
      if (!tieneId && !esEgreso) return <span style={{ color: '#B4B2A9' }}>—</span>
      if (!puedeEditar) return <span style={{ color: '#B4B2A9' }}>—</span>
      const abierto = descOpen && descOpen.row?.id === r.id
      return (
        <button onClick={(e) => abrirDescuentos(r, e)}
          title={esEgreso
            ? 'Buscar el descuento que justifica este egreso (por importe) y pegar su texto en UNIQUE CONCEPT'
            : 'Ver el/los texto(s) para contabilidad del descuento de este IDADMON'}
          style={{ border: '0.5px solid #C8C5BC', background: abierto ? '#E6F1FB' : '#fff', borderRadius: 6, cursor: 'pointer', fontSize: 11, padding: '2px 7px' }}>📋</button>
      )
    }
    if (c.key === '_asociar') {
      const esAbono = num(r.abonos) > 0
      const rut = extraerRut(r.detalle_movimiento)
      if (!esAbono || !rut) return <span style={{ color: '#B4B2A9' }}>—</span>
      if (!puedeAsociar) return <span style={{ color: '#B4B2A9' }}>—</span>
      const resuelto = String(r.idadmon2 || r.unique_concept || '').trim() !== ''
      const abierto = asocOpen && asocOpen.row?.id === r.id
      return (
        <button onClick={() => abrirAsociar(r)}
          title={`Asociar el RUT ${rut} a un IDADMON en bi_admon (busca en CUENTAS a qué contrato pagó antes)`}
          style={{ border: '0.5px solid ' + (resuelto ? '#C8C5BC' : '#9BD7C2'), background: abierto ? '#E1F5EE' : (resuelto ? '#fff' : '#F0FAF6'), color: resuelto ? '#8A8780' : '#085041', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700, padding: '2px 7px' }}>➕ RUT</button>
      )
    }
    // LIQ. MES2: mes de liquidación al que se imputa el pago. Editable SOLO por
    // Dirección/Karina (reasignar excepciones del corte del día 23). Valida AAMM.
    // Si la celda está vacía, muestra en gris el valor que le tocaría por la regla
    // del día (liqMes2Actual), sin escribirlo aquí (de eso se ocupa el autollenado).
    if (c.key === 'liquidacion_mes2') {
      const actual = String(r.liquidacion_mes2 ?? '').trim()
      if (!puedeEditar) {
        const v = actual || liqMes2Actual()
        return <span title={v} style={{ color: '#5F5E5A' }}>{v}</span>
      }
      const vacio = actual === ''
      return (
        <input value={actual} title={vacio ? `Sin asignar (por regla: ${liqMes2Actual()})` : actual}
          placeholder={liqMes2Actual()} inputMode="numeric" maxLength={4}
          onChange={e => onLocal(r.id, c.key, e.target.value.replace(/[^\d]/g, '').slice(0, 4))}
          onFocus={e => { e.target.dataset.orig = actual; e.target.style.border = '1px solid #1D9E75'; e.target.style.background = '#fff' }}
          onBlur={e => {
            const orig = e.target.dataset.orig ?? ''
            const val = (e.target.value ?? '').trim()
            e.target.style.border = '1px solid transparent'
            e.target.style.background = 'transparent'
            if (val === orig) return                                  // sin cambios
            if (val !== '' && !esAAMM(val)) {                          // formato inválido -> revertir
              onLocal(r.id, c.key, orig)
              flash('LIQ. MES2 debe ser AAMM (p. ej. 2607)')
              return
            }
            guardarCelda(r.id, c.key, val)                            // válido o vaciado
          }}
          style={{ width: '100%', border: '1px solid transparent', borderRadius: 4, padding: '2px 4px', fontSize: 11, background: 'transparent', textAlign: c.align, color: vacio ? '#B4B2A9' : '#2C2C2A', boxSizing: 'border-box' }} />
      )
    }
    if (!c.ro) {
      // Columnas editables (unique_concept, idadmon2, discriminador, check2):
      // en modo lectura (observador) se muestran como texto, sin input.
      if (!puedeEditar) {
        const s = String(r[c.key] ?? '').trim()
        return <span title={s}>{s || '—'}</span>
      }
      const esUC = c.key === 'unique_concept'
      const baseAm = esUC && num(r.abonos) > 0 && ['FALTA', 'REVISAR'].includes(String(r.check2_pasar_a_cartola ?? '').trim().toUpperCase())
      const amarillo = baseAm && !estaIdentificado(r[c.key])
      const inputUC = (
        <input value={r[c.key] ?? ''} title={amarillo ? 'Falta teclear el IDADMON (A+5 dígitos)' : (r[c.key] ?? '')}
          placeholder={amarillo ? 'IDADMON…' : ''}
          onChange={e => onLocal(r.id, c.key, e.target.value)}
          onFocus={e => { e.target.dataset.orig = (r[c.key] ?? ''); e.target.style.border = '1px solid #1D9E75'; e.target.style.background = '#fff' }}
          onBlur={e => {
            const orig = e.target.dataset.orig ?? ''
            const actual = e.target.value ?? ''
            const sigueAm = baseAm && !estaIdentificado(actual)
            e.target.style.border = '1px solid transparent'
            e.target.style.background = sigueAm ? '#FFE84D' : 'transparent'
            if (orig !== actual) {
              const t = String(actual).trim()
              const actualEsId = RE_IDADMON.test(t)
              const origEsId = RE_IDADMON.test(String(orig).trim())
              // NO se bloquea nada (el campo admite texto válido de muchos tipos). Solo se AVISA con las
              // consecuencias y la persona decide (Aceptar) o vuelve atrás (Cancelar → repone el valor anterior).
              let aviso = null
              if (esReasignacion(orig, actual)) {
                // IDADMON válido → otro IDADMON válido: reasignación entre contratos.
                aviso = AVISO_REASIGNACION + '\n\n(Reg ' + r.reg + ': ' + orig + ' → ' + actual + ')'
              } else if (origEsId && !actualEsId) {
                // Se sustituye un IDADMON válido por algo que NO lo es (texto libre o vacío): la línea réplica
                // del abono en CUENTAS (bajo ese contrato) se ELIMINA automáticamente. Avisar y mostrar el anterior.
                aviso = '⚠ Vas a cambiar el IDADMON «' + orig + '» por «' + (actual === '' ? '(vacío)' : actual) + '», que NO es un IDADMON.\n\n' +
                  'Consecuencia: se ELIMINARÁ automáticamente la línea de este abono en CUENTAS (la cartola de ' + orig + '). Esa línea es solo una réplica del BI bajo el contrato; al quedarse sin IDADMON deja de existir en Cuentas. La cartola de ' + orig + ' baja y puede subir su falta de arriendo. La traza del cambio queda en la bitácora.\n\n' +
                  'Valor anterior: ' + orig + ' (apúntalo por si quieres volver atrás).\n\n¿Confirmas el cambio?'
              }
              if (aviso && !window.confirm(aviso)) { onLocal(r.id, c.key, orig); return }
              guardarCelda(r.id, c.key, actual)
            }
          }}
          style={{ width: '100%', border: '1px solid transparent', borderRadius: 4, padding: '2px 4px', fontSize: 11, fontWeight: amarillo ? 700 : 400, background: amarillo ? '#FFE84D' : 'transparent', textAlign: c.align, color: '#2C2C2A', boxSizing: 'border-box' }} />
      )
      if (!esUC) return inputUC
      // En UNIQUE CONCEPT: input + punto de color a la derecha (compacto) para pintar la fila.
      const cm = String(r.color_manual || '').trim()
      const dot = cm === 'naranja_sa' ? COLOR.naranja_sa : cm === 'amarillo' ? COLOR.amarillo : cm === 'sin_color' ? '#fff' : null
      // Botón +RUT en la propia celda (solo abonos con RUT y con permiso), junto al de color.
      const rutUC = extraerRut(r.detalle_movimiento)
      const mostrarRut = num(r.abonos) > 0 && rutUC && puedeAsociar
      const resueltoUC = String(r.idadmon2 || r.unique_concept || '').trim() !== ''
      const asocAbiertoUC = asocOpen && asocOpen.row?.id === r.id
      const esAuto = String(r.idadmon_origen ?? '').trim() === 'auto'
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <div style={{ flex: 1, minWidth: 0 }}>{inputUC}</div>
          {esAuto && (
            <button onClick={() => validarIdadmon(r)} disabled={validando === r.id || !puedeAsociar}
              title="IDADMON asignado automáticamente por el sistema (pendiente de validar). Pulsa para confirmarlo: pasa a 'manual', queda en bitácora y sale de «Por validar»."
              style={{ flexShrink: 0, border: '0.5px solid #E0A93B', background: validando === r.id ? '#FDE9C8' : '#FEF3C7', color: '#92600A', borderRadius: 5, cursor: puedeAsociar ? 'pointer' : 'default', fontSize: 10, fontWeight: 700, padding: '1px 5px', lineHeight: 1.4 }}>{validando === r.id ? '…' : '✓ auto'}</button>
          )}
          {mostrarRut && (
            <button onClick={() => abrirAsociar(r)}
              title={`Asociar el RUT ${rutUC} a un IDADMON (busca en CUENTAS a qué contrato pagó antes)`}
              style={{ flexShrink: 0, border: '0.5px solid ' + (resueltoUC ? '#C8C5BC' : '#9BD7C2'), background: asocAbiertoUC ? '#E1F5EE' : (resueltoUC ? '#fff' : '#F0FAF6'), color: resueltoUC ? '#8A8780' : '#085041', borderRadius: 5, cursor: 'pointer', fontSize: 10, fontWeight: 700, padding: '1px 5px', lineHeight: 1.4 }}>➕RUT</button>
          )}
          <button onClick={(e) => abrirColor(r, e)} title="Color de la fila (Dirección/Karina)"
            style={{ flexShrink: 0, width: 13, height: 13, borderRadius: '50%', cursor: 'pointer', padding: 0,
              border: '1px solid #9A968C', background: dot || 'repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 50% / 6px 6px' }} />
        </div>
      )
    }
    if (c.money) { const s = fmt(r[c.key]); return <span title={s || ''} style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: s && c.color ? c.color : '#2C2C2A' }}>{s || '—'}</span> }
    return <span title={r[c.key] ?? ''}>{r[c.key] ?? '—'}</span>
  }

  // Los filtros de cabecera los dibuja el componente <ColFilterExcel> (patrón del LOG),
  // definido fuera de este componente. Aquí solo se pasan onSort / onApply y el estado.
  const nPorValidar = rows.reduce((n, r) => n + (String(r.idadmon_origen ?? '').trim() === 'auto' ? 1 : 0), 0)
  const CHIPS_CAT = [['todos', 'Todos', null], [COLOR.abono, 'Abono', COLOR.abono], [COLOR.amarillo, 'A corregir', COLOR.amarillo], [COLOR.cargo, 'Cargo', COLOR.cargo], [COLOR.naranja_sa, 'Negocio SA', COLOR.naranja_sa], ['por_validar', `⚠ Por validar (${nPorValidar})`, '#F59E0B']]


  // ---- popover de descuentos (texto para contabilidad, con copiar) ----
  // Popover del selector de color de fila
  const renderColorPicker = () => {
    if (!colorOpen) return null
    const { row, x, y } = colorOpen
    const W = 168
    const left = Math.min(x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - W - 12)
    const opciones = [
      ['naranja_sa', 'Negocio SA', COLOR.naranja_sa],
      ['amarillo', 'A corregir', COLOR.amarillo],
      ['sin_color', 'Sin color', '#fff'],
      ['auto', 'Automático', null],
    ]
    const actual = String(row.color_manual || '').trim() || 'auto'
    return (
      <>
        <div onClick={() => setColorOpen(null)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
        <div style={{ position: 'fixed', left, top: y, width: W, background: '#fff', border: '0.5px solid #B4B2A9', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,.15)', zIndex: 41, fontSize: 12, padding: 6 }}>
          <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', padding: '2px 4px 6px' }}>Color de la fila</div>
          {opciones.map(([val, lab, col]) => (
            <button key={val} onClick={() => aplicarColor(row.id, val)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
                border: actual === val ? '1px solid #1a56db' : '1px solid transparent', background: actual === val ? '#EFF6FF' : 'transparent', color: '#374151', marginBottom: 2 }}>
              <span style={{ width: 14, height: 14, borderRadius: '50%', flexShrink: 0, border: '1px solid #9A968C',
                background: col === null ? 'repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 50% / 6px 6px' : col }} />
              {lab}
            </button>
          ))}
        </div>
      </>
    )
  }

  const renderPopDescuentos = () => {
    if (!descOpen) return null
    const W = 460
    const left = Math.min(descOpen.x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - W - 12)
    const r = descOpen.row
    const cargo = num(r?.cargos)
    const esImporte = descOpen.modo === 'importe'
    const unico = !descLoading && descRows.length === 1   // precarga: único candidato
    return (
      <>
        <div onClick={() => setDescOpen(null)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
        <div style={{ position: 'fixed', left, top: descOpen.y, width: W, maxHeight: 420, overflow: 'auto', background: '#fff', border: '0.5px solid #B4B2A9', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,.15)', zIndex: 41, fontSize: 12 }}>
          <div style={{ padding: '8px 10px', borderBottom: '0.5px solid #EDEBE4', fontWeight: 600, color: '#5F5E5A', position: 'sticky', top: 0, background: '#fff' }}>
            {esImporte
              ? <>Egreso de <b>{fmt(cargo)}</b> · descuentos con transferir = {fmt(cargo)}</>
              : <>Descuentos de {String(r?.idadmon2 || '').trim().toUpperCase()}</>}
          </div>

          {/* buscador para navegar (por IDADMON, N° o texto) */}
          <div style={{ padding: '8px 10px', borderBottom: '0.5px solid #F0EEE8', display: 'flex', gap: 6 }}>
            <input value={descQuery} onChange={e => setDescQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && descQuery.trim()) buscarDescuentos({ q: descQuery.trim() }) }}
              placeholder="Buscar por IDADMON, N° o texto…"
              style={{ flex: 1, border: '1px solid #C8C5BC', borderRadius: 6, padding: '4px 8px', fontSize: 12 }} />
            <button onClick={() => descQuery.trim() && buscarDescuentos({ q: descQuery.trim() })}
              style={{ border: 'none', background: '#5F6B7A', color: '#fff', borderRadius: 6, cursor: 'pointer', fontSize: 11, padding: '4px 10px' }}>Buscar</button>
            {esImporte && (
              <button onClick={() => { setDescQuery(''); buscarDescuentos({ monto: Math.round(cargo) }) }}
                title="Volver a los candidatos por importe"
                style={{ border: '0.5px solid #C8C5BC', background: '#fff', color: '#5F5E5A', borderRadius: 6, cursor: 'pointer', fontSize: 11, padding: '4px 8px' }}>↺ importe</button>
            )}
          </div>

          {descLoading
            ? <div style={{ padding: 12, color: '#888780' }}>Cargando…</div>
            : descRows.length === 0
              ? <div style={{ padding: 12, color: '#888780' }}>
                  {esImporte ? 'Ningún descuento con ese importe. Usa el buscador para localizarlo.' : 'Sin resultados.'}
                </div>
              : descRows.map((d, i) => (
                <div key={i} style={{ padding: '8px 10px', borderBottom: '0.5px solid #F0EEE8', display: 'flex', gap: 8, alignItems: 'flex-start', background: unico ? '#F3FAF6' : '#fff' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: '#888780', marginBottom: 2 }}>
                      N° {d.num || '—'} · {d.idadmon || ''} · {d.tipo || ''} · transferir {fmt(d.monto_a_transferir)}{unico ? ' · (único candidato)' : ''}
                    </div>
                    <div style={{ color: '#2C2C2A', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                      {d.texto_para_contabilidad || <span style={{ color: '#B4B2A9' }}>(sin texto de contabilidad)</span>}
                    </div>
                  </div>
                  {d.texto_para_contabilidad && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                      <button onClick={() => usarEnUniqueConcept(d)} title="Pegar este texto en UNIQUE CONCEPT de la fila"
                        style={{ border: 'none', background: '#1D9E75', color: '#fff', borderRadius: 6, cursor: 'pointer', fontSize: 11, padding: '4px 8px', whiteSpace: 'nowrap' }}>Usar este</button>
                      <button onClick={() => copiarTexto(d.texto_para_contabilidad)} title="Solo copiar al portapapeles"
                        style={{ border: 'none', background: '#E6F1FB', color: '#0C447C', borderRadius: 6, cursor: 'pointer', fontSize: 11, padding: '4px 8px' }}>📋</button>
                    </div>
                  )}
                </div>
              ))
          }
        </div>
      </>
    )
  }

  return (
    <>
      <TopNav />
      <div style={{ maxWidth: 1640, margin: '0 auto', padding: '18px 20px 30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 10, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 2px', color: '#2C2C2A' }}>BI · Movimientos (tabla bi)</h1>
            <div style={{ fontSize: 12, color: '#888780' }}>recientes abajo · carga completa{hayFiltroActivo ? ' · filtrado' : ''}{puedeEditar ? ' · edita desde UNIQUE CONCEPT · los cambios se guardan solos al salir de la celda (✓ Guardado)' : ' · modo solo lectura'}</div>
          </div>
        </div>

        {!puedeEditar && (
          <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: '#FBF7EC', border: '0.5px solid #E6D58A', color: '#8a6d1e', fontSize: 12 }}>
            Modo solo lectura — la edición del BI (asociar RUT, IDADMON, mes de liquidación) está reservada a Dirección y Karina.
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 10, fontSize: 11, color: '#5F5E5A', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><i style={{ width: 12, height: 12, background: '#EAF2FB', border: '0.5px solid #B9D4EE', borderRadius: 2 }} /> Abono ({abonos})</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><i style={{ width: 12, height: 12, background: '#FBECEC', border: '0.5px solid #E9B9B9', borderRadius: 2 }} /> Cargo ({cargos})</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><i style={{ width: 12, height: 12, background: '#FEF7D6', border: '0.5px solid #E6D58A', borderRadius: 2 }} /> Sin identificar ({sinId})</span>
          {savingId && <span style={{ color: '#1D9E75' }}>guardando…</span>}
        </div>

        {error && <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: '#FDECEC', border: '0.5px solid #F1B0B0', color: '#9B1C1C', fontSize: 12 }}>{error}</div>}

        {/* BARRA DE ACCIONES */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12, alignItems: 'center' }}>
          <button onClick={guardarYRefrescar} disabled={refreshing}
            style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: 'none', background: '#1D9E75', color: '#fff', cursor: 'pointer' }}>
            {refreshing ? 'Actualizando…' : '🔄 Refrescar lista'}
          </button>
          {puedeEditar && (
            <button onClick={() => router.push('/procesos/bi')}
              title="Ir a la hoja de subir la cartola del Banco Internacional"
              style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: '1px solid #1D9E75', background: '#E1F5EE', color: '#085041', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              📥 Cargar cartola →
            </button>
          )}
          <span style={{ width: 1, height: 22, background: '#D3D1C7', margin: '0 4px' }} />
          <button onClick={() => setAyudaOpen(true)} title="¿Qué hace cada botón y cuándo usar +RUT?"
            style={{ fontSize: 13, fontWeight: 800, width: 26, height: 26, borderRadius: '50%', border: '1px solid #C8C5BC', background: '#fff', color: '#6B4423', cursor: 'pointer', lineHeight: 1, flexShrink: 0 }}>?</button>
          <span style={{ width: 1, height: 22, background: '#D3D1C7', margin: '0 4px' }} />
          <button onClick={exportarExcel} disabled={filas.length === 0}
            title="Exporta a Excel exactamente lo filtrado, con las columnas visibles"
            style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: '1px solid #1c7d3f', background: filas.length === 0 ? '#eee' : '#EAF7EF', color: filas.length === 0 ? '#aaa' : '#1c7d3f', cursor: filas.length === 0 ? 'default' : 'pointer' }}>
            ⭳ Exportar Excel ({filas.length})
          </button>
          <span style={{ width: 1, height: 22, background: '#D3D1C7', margin: '0 4px' }} />
          <button onClick={() => setRutViewOpen(true)}
            title="Ver, por cada RUT, a qué IDADMON ha pagado (nº de pagos y última fecha)"
            style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: '1px solid #6B4423', background: '#fff', color: '#6B4423', cursor: 'pointer' }}>
            RUT ↔ IDADMON
          </button>
          {hayFiltroActivo && (
            <>
              <span style={{ width: 1, height: 22, background: '#D3D1C7', margin: '0 4px' }} />
              <button onClick={() => { setFiltros({}); setCatFiltro('todos'); setSortCol(null) }}
                title="Quitar todos los filtros y la ordenación de las columnas"
                style={{ fontSize: 12, fontWeight: 700, padding: '7px 14px', borderRadius: 8, border: '1px solid #C0392B', background: '#FDECEA', color: '#B93A2B', cursor: 'pointer' }}>
                ✕ Quitar filtros
              </button>
            </>
          )}
        </div>

        <div ref={scrollRef} onScroll={onScroll} style={{ overflow: 'auto', maxHeight: '72vh', border: '0.5px solid #D3D1C7', borderRadius: 8 }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, fontSize: 11, width: '100%' }}>
            <thead>
              <tr style={{ background: '#F1EFE8' }}>
                {COLS.map((c, i) => (
                  <th key={i} style={{ padding: '6px 8px', textAlign: c.align, fontWeight: 600, color: '#5F5E5A', whiteSpace: 'nowrap', minWidth: c.w, position: 'sticky', top: 0, right: c.key === '_asociar' ? 0 : undefined, background: '#F1EFE8', zIndex: c.key === '_asociar' ? 5 : 3, borderBottom: '0.5px solid #D3D1C7', boxShadow: c.key === '_asociar' ? '-6px 0 8px -6px rgba(0,0,0,0.15)' : undefined }}>
                    {c.filt ? (
                      <ColFilterExcel
                        label={c.h} col={c.key} align={c.align === 'right' ? 'right' : 'left'}
                        sortCol={sortCol} sortDir={sortDir} onSort={onSort}
                        opciones={c.money ? [] : (opcionesPorCol[c.key] || [])} value={filtros[c.key] || (c.money ? { min: null, max: null } : [])} onApply={onApply}
                        numeric={!!c.money}
                        tree={c.key === 'fecha'}
                        chips={c.key === 'unique_concept' ? CHIPS_CAT : null}
                        catFiltro={catFiltro} onCat={setCatFiltro}
                      />
                    ) : (
                      <span>{c.h}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Espaciador superior: reserva el alto de las filas que quedan por encima de la franja pintada. */}
              {padTop > 0 && <tr aria-hidden="true" style={{ height: padTop }}><td colSpan={COLS.length} style={{ padding: 0, border: 0 }} /></tr>}
              {visibles.map((r) => (
                <tr key={r.id} style={{ height: ROW_H }}>
                  {COLS.map((c, ci) => {
                    // Tooltip (burbuja del navegador) con el texto completo de la celda al hacer hover,
                    // para poder leer lo que se corta. Columnas de botón/check no llevan.
                    const tdTitle = c.key.startsWith('_') ? undefined : (c.money ? (fmt(r[c.key]) || undefined) : (String(r[c.key] ?? '').trim() || undefined))
                    return (
                    <td key={ci} title={tdTitle} style={{ padding: c.ro ? '5px 8px' : '2px 4px', textAlign: c.align, whiteSpace: 'nowrap', background: c.key === '_asociar' ? '#fff' : bgCelda(ci, r), color: ci === I_REG ? '#1A1A1A' : '#2C2C2A', fontWeight: ci === I_REG ? 600 : 400, borderBottom: '0.5px solid #EDEBE4', borderLeft: (ci === 0 && String(r.idadmon_origen ?? '').trim() === 'auto') ? '3px solid #F59E0B' : undefined, maxWidth: c.w + 60, overflow: 'hidden', textOverflow: 'ellipsis', position: c.key === '_asociar' ? 'sticky' : undefined, right: c.key === '_asociar' ? 0 : undefined, zIndex: c.key === '_asociar' ? 2 : undefined, boxShadow: c.key === '_asociar' ? '-6px 0 8px -6px rgba(0,0,0,0.15)' : undefined }}>
                      {cell(r, c)}
                    </td>
                    )
                  })}
                </tr>
              ))}
              {/* Espaciador inferior: reserva el alto de las filas que quedan por debajo de la franja pintada. */}
              {padBottom > 0 && <tr aria-hidden="true" style={{ height: padBottom }}><td colSpan={COLS.length} style={{ padding: 0, border: 0 }} /></tr>}
              {total === 0 && <tr><td colSpan={COLS.length} style={{ padding: 24, textAlign: 'center', color: '#888780' }}>Sin resultados con esos filtros.</td></tr>}
            </tbody>
          </table>
        </div>

        <div style={{ fontSize: 11, color: '#888780', marginTop: 8 }}>
          {filas.length} fila(s){hayFiltroActivo ? ' (filtradas)' : ''} · carga completa en memoria · se pintan solo las visibles para ir fluido.
        </div>
      </div>
      {/* filtros: ahora en las cabeceras vía ColFilterExcel */}
      {renderPopDescuentos()}
      {renderColorPicker()}
      {asocOpen && (
        <>
          <div onClick={() => !asocGuardando && setAsocOpen(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 70 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(520px, 94vw)', maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.25)', zIndex: 71 }}>
            <div style={{ padding: '14px 18px', borderBottom: '0.5px solid #E4E2DA', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#2C2C2A' }}>Asociar RUT a IDADMON</div>
                <div style={{ fontSize: 12, color: '#5F5E5A' }}>RUT <b>{asocOpen.rut}</b> — se guardará en <code>bi_admon</code> para autocompletar sus abonos futuros.</div>
              </div>
              <button onClick={() => !asocGuardando && setAsocOpen(null)}
                style={{ border: 'none', background: '#F1EFE8', color: '#5F5E5A', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Cerrar</button>
            </div>

            <div style={{ padding: '14px 18px', overflow: 'auto' }}>
              {asocErr && <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: '#FDECEC', border: '0.5px solid #F1B0B0', color: '#9B1C1C', fontSize: 12 }}>{asocErr}</div>}

              <div style={{ marginBottom: 12, padding: '9px 12px', borderRadius: 8, background: '#EFF6FF', border: '0.5px solid #BFDBFE', color: '#1E40AF', fontSize: 11.5, lineHeight: 1.5 }}>
                <b>Usa +RUT solo si este RUT volverá a pagar</b> (arrendatario habitual): queda memorizado y sus abonos futuros se reconocen solos.<br />
                Si es un <b>ingreso puntual</b> que no se repetirá (p. ej. un amigo que pagó una vez), <b>no uses +RUT</b>: cierra esto y escribe el IDADMON directamente en la celda <b>UNIQUE CONCEPT</b>. Al salir de la celda se vuelca solo a Cartolas y corrige la cartola sin dejar el RUT guardado.
              </div>

              {asocOpen.soloManual ? (
                <div style={{ padding: '10px 12px', borderRadius: 8, background: '#F1EFE8', color: '#5F5E5A', fontSize: 12, marginBottom: 4 }}>
                  Escribe el IDADMON del contrato al que pertenece este abono. Al guardar, este RUT
                  quedará asociado y sus abonos futuros se reconocerán solos.
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 12, color: '#5F5E5A', fontWeight: 600, marginBottom: 6 }}>Según pagos anteriores en CUENTAS:</div>
                  {asocLoading && <div style={{ padding: 16, textAlign: 'center', color: '#888780', fontSize: 13 }}>Buscando en el historial…</div>}
                  {!asocLoading && asocCands.length === 0 && (
                    <div style={{ padding: '10px 12px', borderRadius: 8, background: '#FBF7EC', color: '#8a6d1e', fontSize: 12, marginBottom: 12 }}>
                      Este RUT no aparece en CUENTAS con ningún IDADMON. Escríbelo a mano abajo.
                    </div>
                  )}
                  {!asocLoading && asocCands.map((c) => (
                    <button key={c.idadmon} onClick={() => asociarRut(c.idadmon)} disabled={asocGuardando}
                      style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 12px', marginBottom: 6, border: '0.5px solid #9BD7C2', background: '#F0FAF6', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                      <span style={{ fontWeight: 700, color: '#085041' }}>{c.idadmon}</span>
                      <span style={{ fontSize: 11, color: '#5F5E5A' }}>pagó {c.veces} vez(ces) · asociar →</span>
                    </button>
                  ))}
                </>
              )}

              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '0.5px solid #EDEBE4' }}>
                <div style={{ fontSize: 12, color: '#5F5E5A', fontWeight: 600, marginBottom: 6 }}>
                  {asocOpen.soloManual ? 'IDADMON del contrato:' : 'IDADMON o texto de identificación:'}
                </div>
                {!asocOpen.soloManual && (
                  <div style={{ fontSize: 11, color: '#888780', marginBottom: 6 }}>
                    Un IDADMON (ej. A00819) o un texto libre (ej. ingreso de un propietario: "PO64-PAVEZ, JUANA").
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={asocId} onChange={e => setAsocId(e.target.value)}
                    placeholder={asocOpen.soloManual ? 'A00819' : 'A00819  o  texto de identificación'}
                    style={{ flex: 1, fontSize: 13, padding: '7px 10px', border: '0.5px solid #D3D1C7', borderRadius: 8 }} />
                  <button onClick={() => asociarRut(asocId)} disabled={asocGuardando || !asocId.trim()}
                    style={{ fontSize: 13, fontWeight: 700, padding: '7px 16px', borderRadius: 8, border: 'none', background: asocId.trim() ? '#1D9E75' : '#D3D1C7', color: '#fff', cursor: asocId.trim() ? 'pointer' : 'default' }}>
                    {asocGuardando ? 'Asociando…' : 'Asociar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      {ayudaOpen && (
        <>
          <div onClick={() => setAyudaOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 70 }} />
          <div style={{ position: 'fixed', top: '8vh', left: '50%', transform: 'translateX(-50%)', width: 'min(560px, 94vw)', maxHeight: '84vh', overflow: 'auto', background: '#fff', borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.25)', zIndex: 71, padding: 20, fontSize: 13, lineHeight: 1.55, color: '#2C2C2A' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>Cómo identificar un ingreso y pasarlo a Cartolas</div>
              <button onClick={() => setAyudaOpen(false)} style={{ border: 'none', background: '#F1EFE8', borderRadius: 8, padding: '5px 11px', cursor: 'pointer', fontWeight: 700, color: '#5F5E5A' }}>Cerrar</button>
            </div>
            <p style={{ margin: '6px 0' }}>Al cargar la cartola, el sistema intenta identificar cada abono <b>solo</b>. Tú solo intervienes cuando no pudo, o para <b>validar</b> lo que propuso.</p>

            <p style={{ margin: '10px 0 4px', fontWeight: 700 }}>Lo que hace el sistema solo</p>
            <p style={{ margin: '6px 0', padding: '8px 12px', background: '#FEF3C7', border: '0.5px solid #E0A93B', borderRadius: 8, color: '#5b4708' }}>
              Si reconoce el RUT (porque ya se asoció antes con +RUT, o por el RUT del contrato) <b>asigna el IDADMON y lo vuelca a Cartolas</b> al momento. Esos abonos salen con una <b>barra ámbar</b> a la izquierda y el botón <b>“✓ auto”</b>: son propuestas del sistema <b>pendientes de validar</b>.<br />
              <b>Validar:</b> pulsa <b>“✓ auto”</b> para confirmar que el IDADMON es correcto (pasa a manual, queda en bitácora y desaparece de la lista). Para verlos todos juntos, usa el chip <b>“⚠ Por validar (n)”</b> del filtro de UNIQUE CONCEPT. Si el sistema se equivocó, corrígelo escribiendo el IDADMON bueno en la celda (ver abajo).
            </p>

            <p style={{ margin: '10px 0 4px', fontWeight: 700 }}>Cuando tienes que asignarlo tú</p>
            <p style={{ margin: '6px 0', padding: '8px 12px', background: '#F0FAF6', border: '0.5px solid #9BD7C2', borderRadius: 8 }}>
              <b>1) Botón +RUT</b> — para un RUT que <b>volverá a pagar</b> (arrendatario habitual). Asocia el RUT al IDADMON (sus abonos futuros se reconocen solos) y <b>corrige la cartola en el momento</b>. No hace falta nada más.
            </p>
            <p style={{ margin: '6px 0', padding: '8px 12px', background: '#FBF7EC', border: '0.5px solid #EAD9A0', borderRadius: 8 }}>
              <b>2) Escribir el IDADMON en la celda UNIQUE CONCEPT</b> — para un <b>ingreso puntual</b> (no se repetirá) o para <b>corregir</b> uno mal asignado. Al salir de la celda se <b>vuelca solo a Cartolas</b> (inserta la línea o corrige la que hubiera). No hace falta pulsar ningún botón.
            </p>

            <p style={{ margin: '10px 0 0', padding: '8px 12px', background: '#FDECEC', border: '0.5px solid #F1B0B0', borderRadius: 8, color: '#9B1C1C' }}>
              ⚠ <b>Cambiar el IDADMON de un movimiento afecta a DOS contratos</b>: el anterior pierde el abono y el nuevo lo gana. Cambian sus cartolas y su liquidación del mes. Revisa siempre ambas después.
            </p>
          </div>
        </>
      )}
      {rutViewOpen && (
        <>
          <div onClick={() => setRutViewOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 70 }} />
          <div style={{ position: 'fixed', top: '5vh', left: '50%', transform: 'translateX(-50%)', width: 'min(1200px, 96vw)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.25)', zIndex: 71, padding: 16, color: '#2C2C2A' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>RUT → IDADMON · a quién paga cada RUT</div>
                <div style={{ fontSize: 12, color: '#5F5E5A' }}>Por cada RUT, un bloque <b>IDADMON · Nº pagos · Últ. fecha · Últ. cantidad</b> por cada IDADMON que le hayamos cobrado en BI (de más a menos pagos).</div>
              </div>
              <button onClick={() => setRutViewOpen(false)} style={{ border: 'none', background: '#F1EFE8', borderRadius: 8, padding: '5px 11px', cursor: 'pointer', fontWeight: 700, color: '#5F5E5A' }}>Cerrar</button>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
              <input value={rutQuery} onChange={e => setRutQuery(e.target.value)} placeholder="Buscar RUT o IDADMON…"
                style={{ fontSize: 13, padding: '6px 10px', borderRadius: 8, border: '1px solid #C8C5BC', width: 240 }} />
              <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={soloVarios} onChange={e => setSoloVarios(e.target.checked)} />
                Solo RUT que pagan a <b>&nbsp;varios&nbsp;</b> IDADMON
              </label>
              <span style={{ fontSize: 12, color: '#5F5E5A' }}>{rutIdadmonView.length} RUT</span>
            </div>
            <div style={{ overflow: 'auto', border: '1px solid #E7E4DB', borderRadius: 8 }}>
              {rutIdadmonView.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: '#888780' }}>Sin resultados.</div>}
              {rutIdadmonView.map((x) => (
                <div key={x.rut} style={{ display: 'flex', alignItems: 'stretch', borderBottom: '1px solid #EDEBE4', minWidth: 'max-content' }}>
                  <div style={{ position: 'sticky', left: 0, zIndex: 1, background: '#FAF9F5', borderRight: '1px solid #E7E4DB', padding: '8px 10px', minWidth: 128, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontWeight: 700, fontSize: 12 }}>{x.rut}</span>
                    <span style={{ fontSize: 10, color: '#8A8780' }}>{x.n} IDADMON · {x.total} pagos</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, padding: 6 }}>
                    {x.grupos.map((g, i) => (
                      <div key={g.idadmon} title={`${g.pagos} pago(s) · último ${g.ultima || '—'} · ${g.montoUlt ? '$' + Number(g.montoUlt).toLocaleString('es-CL') : '—'}`}
                        style={{ display: 'flex', border: '1px solid ' + (i === 0 ? '#9BD7C2' : '#D8D5CC'), borderRadius: 8, overflow: 'hidden', background: i === 0 ? '#F0FAF6' : '#fff', flexShrink: 0 }}>
                        <span style={{ padding: '6px 8px', fontFamily: 'ui-monospace, Menlo, monospace', fontWeight: 700, fontSize: 12, color: '#085041', borderRight: '1px solid #E7E4DB', minWidth: 62, textAlign: 'center' }}>{g.idadmon}</span>
                        <span style={{ padding: '6px 8px', fontSize: 12, fontWeight: 600, borderRight: '1px solid #E7E4DB', minWidth: 34, textAlign: 'center' }}>{g.pagos}</span>
                        <span style={{ padding: '6px 8px', fontSize: 11, color: '#5F5E5A', borderRight: '1px solid #E7E4DB', minWidth: 74, textAlign: 'center' }}>{g.ultima || '—'}</span>
                        <span style={{ padding: '6px 8px', fontSize: 11, fontWeight: 600, color: '#085041', minWidth: 78, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{g.montoUlt ? Number(g.montoUlt).toLocaleString('es-CL') : '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: '#8A8780', marginTop: 6 }}>El primer bloque (verde) es el IDADMON con más pagos de ese RUT. Cada bloque tiene cuatro columnas: IDADMON · Nº de pagos · fecha del último pago · importe del último pago.</div>
          </div>
        </>
      )}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#2C2C2A', color: '#fff', fontSize: 13, padding: '10px 18px', borderRadius: 8, zIndex: 60, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          {toast}
        </div>
      )}
    </>
  )
}