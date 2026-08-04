'use client';
// VERSION: v16 · 2026-08-04 · ARRENDATARIO: al crear, aviso que confirma cargo/abono y el descuento se carga solo
//   en cartola (endpoint crear v3). En la ficha, el botón pasa a "Modificar cargo/abono Cartola" si ya se pasó
//   (rehace el movimiento con el signo actual). En el listado, la celda "Imputar a" va en verde claro si ya está
//   en cartola y rojizo si falta. Requiere que /api/descuentos/listar traiga el campo pasado_a_cartola.
// VERSION: v15 · 2026-08-03 · Mejora 1: botón "Pasar a Cartolas" en la ficha de un descuento de ARRENDATARIO
//   (inserta en cuentas: cargo si +, abono si −; concepto = num + texto; marca pasado_a_cartola). Si ya se pasó,
//   muestra "✓ En cartola". Reutiliza el patrón del botón de garantía.
// VERSION: v14 · 2026-08-01 · CORRECCIÓN DE SIGNO: la devolución de garantía en poder del Dueño se crea con monto
//   POSITIVO (positivo = se le descuenta al propietario, que es lo correcto al recuperarle la garantía). Antes iba
//   en negativo (le sumaba) — error. Las creadas antes de este cambio hay que corregirlas a mano.
// VERSION: v13 · 2026-08-01 · Al buscar un descuento por Núm, su fila se centra en la lista (scroll) para ver el contexto
//   de los descuentos vecinos. Si la fila no estaba entre las recientes, se muestran todas para poder centrarla.
// VERSION: v12 · 2026-08-01 · (a) Se cargan TODOS los descuentos (el endpoint pagina): el buscador por Núm y los filtros
//   operan sobre el total, no sobre 1000. (b) La cabecera de la página ya no queda tapada por el TopNav.
// VERSION: v11 · 2026-08-01 · Botón "Crear devolución de garantía" en la ficha de un descuento T-: si el contrato tiene
//   garantía en poder del DUEÑO, abre el formulario de alta YA RELLENO (PROPIETARIO, sucesor, monto=-garantía, tipo
//   GARANTIAS, mes de liquidación en curso, texto estándar). Solo prerellena; el num y el guardado los hace el servidor.
// VERSION: v10 · 2026-08-01 · La columna N (num) queda FIJA (sticky) a la izquierda: se sigue viendo al hacer scroll horizontal.
// VERSION: v9 · 2026-08-01 · Celdas con DATOS corregidos (accion='corregir') se resaltan en BEIGE, en la lista y en la
//   ficha (modo ver). Solo campos de datos (importes, IDADMON, mes, tipo…); comentarios/textos NO. Fuente: descuentos_bitacora.
// VERSION: v8 · 2026-08-01 · El aviso "no válido para PROPIETARIO" del badge ahora NOMBRA el sucesor sugerido y es
//   clicable: al pulsarlo, cambia el IDADMON al sucesor (P/S/SQ) de un golpe.
// VERSION: v7 · 2026-08-01 · En edición, junto al IDADMON se muestra su ESTADO (no editable, badge de color, en vivo):
//   verde si es válido (P/S/SQ), rojo si está terminado (Q/N/N-DICOM). Ayuda a ver de un vistazo si el IDADMON sirve.
// VERSION: v6 · 2026-08-01 · CANDADO: no deja guardar un descuento imputado a PROPIETARIO si su IDADMON está
//   en Q/N/N-DICOM (terminado) para meses AGOSTO 2026 en adelante (no entraría en la liquidación). Avisa y pide
//   usar el IDADMON del contrato vigente (sucesor P/S/SQ). Mantiene: fila resaltada + sugerencia del sucesor (v5).
// VERSION: v5 · 2026-08-01 · (a) La fila abierta en el drawer queda RESALTADA (blanca sobre gris) para no perderla.
//   (b) En el drawer de edición, "IDADMON relacionado" muestra la SUGERENCIA del sucesor del inmueble (P/S/SQ),
//   clicable, cuando el campo está vacío (para cualquier descuento, p.ej. TERMINO imputado a PROPIETARIO).
// VERSION: v4 · 2026-07-17 · (a) Autorelleno de "IDADMON relacionado" con el sucesor en términos T-.
//   (b) Aviso de confirmación al guardar (revisar datos + monto a transferir; no editable después).
//   (c) Al imputar a ARRENDATARIO, selector obligatorio CARGO/ABONO que fija el signo del monto
//   (ABONO→negativo, CARGO→positivo), para que el signo no quede al azar.

import { useEffect, useMemo, useState, useRef, forwardRef } from 'react';
import { TIPOS, REPERCUTIR_A } from '@/lib/descuentosPermisos';
import TopNav from '@/app/components/ui/TopNav';

// ------- columnas de la tabla (orden, etiqueta, ancho px, alineación, truncado) -------
// w = ancho fijo en px (table-layout: fixed). trunc = recorta con ellipsis + hover.
const COLS = [
  { key: 'num', label: 'Núm', w: 42, align: 'right' },
  { key: 'fecha', label: 'Fecha', w: 66 },
  { key: 'mes_a_imputar', label: 'Mes imp.', w: 82 },
  { key: 'ingresado_por', label: 'Ingresó', w: 72, trunc: true },
  { key: 'idadmon', label: 'IDADMON', w: 62 },
  { key: 'inmueble', label: 'Inmueble', w: 185, trunc: true },
  { key: 'propietario', label: 'Propietario', w: 116, trunc: true },
  { key: 'repercutir_a', label: 'Imputar a', w: 98, trunc: true },
  { key: 'idadmon_relacionado', label: 'ID rel.', w: 62 },
  { key: 'monto_a_imputar', label: 'M. imputar', w: 80, align: 'right' },
  { key: 'monto_a_transferir', label: 'M. transf.', w: 80, align: 'right' },
  { key: 'tipo', label: 'Tipo', w: 88 },
  { key: 'texto_explicativo_para_carta_a_propietario', label: 'Texto liquid.', w: 138, trunc: true },
  { key: 'comentarios_karina', label: 'Coment. Karina', w: 104, trunc: true },
  { key: 'texto_para_contabilidad', label: 'Texto contab.', w: 184 },
  { key: 'verificado', label: 'Verificado', w: 72 },
];
const TABLE_W = COLS.reduce((a, c) => a + c.w, 0);

// ---- Ficha (drawer): etiquetas legibles de cada campo ----
const LABELS = {
  num: 'Núm', fecha: 'Fecha', mes_a_imputar: 'Mes a imputar', ingresado_por: 'Ingresado por',
  idadmon: 'IDADMON', inmueble: 'Inmueble', propietario: 'Propietario', repercutir_a: 'Imputar a',
  idadmon_relacionado: 'IDADMON relacionado', relacionado: 'Enlace justificante',
  monto_a_imputar: 'Monto a imputar', monto_a_transferir: 'Monto a transferir',
  link_admon: 'Enlace Admon (link)', admon_piensa_que_se_necesita_factura_boleta: '¿Necesita factura/boleta?',
  justificante_compra: 'Justificante compra', numero: 'Número', a_nombre_de_quien: '¿A nombre de quién?',
  factura_boleta_de_venta: 'Factura / Boleta de venta', tipo: 'Tipo',
  texto_explicativo_para_carta_a_propietario: 'Texto para liquidación (carta)',
  texto_para_contabilidad: 'Texto para contabilidad', aclaracion: 'Aclaración',
  comentarios_karina: 'Comentarios Karina', visto_bueno_de_karina_y_mas_comentarios: 'Visto bueno Karina y comentarios',
  comentario_interno2: 'Comentario interno 2',
  auditoria_1: 'Auditoría 1', auditoria_2: 'Auditoría 2', auditoria_3: 'Auditoría 3',
  mmdd: 'MMDD', check1: 'check1', check2: 'check2', check3_estado: 'check3 / estado',
  fecha_contable: 'Fecha contable',
  creado_por: 'Creado por', creado_at: 'Creado', modificado_por: 'Modificado por', modificado_at: 'Modificado',
  verificado: 'Verificado', verificado_por: 'Verificado por', verificado_at: 'Verificado el',
  origen: 'Origen', updated_at: 'Actualizado', sync_hash: 'sync_hash', id: 'ID',
};

// Secciones para el modo VER (mostrar todo, ordenado)
const SECCIONES_VER = [
  { titulo: 'Identificación', campos: ['num', 'fecha', 'mes_a_imputar', 'ingresado_por', 'tipo'] },
  { titulo: 'Inmueble y propietario', campos: ['idadmon', 'inmueble', 'propietario', 'repercutir_a', 'idadmon_relacionado', 'relacionado'] },
  { titulo: 'Montos', campos: ['monto_a_imputar', 'monto_a_transferir'] },
  { titulo: 'Documentación', campos: ['justificante_compra', 'numero', 'a_nombre_de_quien', 'factura_boleta_de_venta', 'admon_piensa_que_se_necesita_factura_boleta', 'link_admon'] },
  { titulo: 'Textos', campos: ['texto_explicativo_para_carta_a_propietario', 'texto_para_contabilidad', 'aclaracion', 'comentarios_karina', 'visto_bueno_de_karina_y_mas_comentarios', 'comentario_interno2'] },
  { titulo: 'Contable / auditoría', campos: ['auditoria_1', 'auditoria_2', 'auditoria_3', 'mmdd', 'check1', 'check2', 'check3_estado', 'fecha_contable'] },
  { titulo: 'Trazabilidad', campos: ['creado_por', 'creado_at', 'modificado_por', 'modificado_at', 'verificado', 'verificado_por', 'verificado_at', 'origen', 'updated_at'] },
];

// Campos editables desde la ficha (alineados con el endpoint /api/descuentos/corregir)
const EDIT_CAMPOS = [
  { k: 'mes_a_imputar', tipo: 'mes' },
  { k: 'idadmon', tipo: 'texto', upper: true },
  { k: 'inmueble', tipo: 'texto' },
  { k: 'propietario', tipo: 'texto' },
  { k: 'repercutir_a', tipo: 'select' },
  { k: 'idadmon_relacionado', tipo: 'texto', upper: true },
  { k: 'relacionado', tipo: 'texto' },
  { k: 'monto_a_imputar', tipo: 'numero' },
  { k: 'monto_a_transferir', tipo: 'numero' },
  { k: 'link_admon', tipo: 'texto' },
  { k: 'admon_piensa_que_se_necesita_factura_boleta', tipo: 'sino' },
  { k: 'tipo', tipo: 'select' },
  { k: 'texto_explicativo_para_carta_a_propietario', tipo: 'area' },
  { k: 'texto_para_contabilidad', tipo: 'area' },
  { k: 'aclaracion', tipo: 'area' },
  { k: 'comentarios_karina', tipo: 'area' },
  { k: 'visto_bueno_de_karina_y_mas_comentarios', tipo: 'area' },
  { k: 'fecha_contable', tipo: 'texto' },
];

const fmtValor = (k, v) => {
  if (v == null || v === '') return '—';
  if (k === 'fecha' || k === 'fecha_contable') return fmtFecha(v);
  if (k === 'monto_a_imputar' || k === 'monto_a_transferir') return money(v);
  if (k === 'verificado') return v ? 'Sí' : 'No';
  if ((k === 'creado_at' || k === 'modificado_at' || k === 'updated_at' || k === 'verificado_at')) {
    try { return new Date(v).toLocaleString('es-CL'); } catch { return String(v); }
  }
  return String(v);
};

const money = (n) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.round(v).toLocaleString('es-CL') : (n ?? '');
};

// Fecha a formato uniforme dd/mm/yy. Acepta dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd.
const p2 = (x) => String(x).padStart(2, '0');
function fmtFecha(s) {
  if (!s) return '';
  const str = String(s).trim();
  let m = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);      // ISO yyyy-mm-dd
  if (m) return `${p2(m[3])}/${p2(m[2])}/${m[1].slice(2)}`;
  m = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);        // dd/mm/yyyy o dd-mm-yyyy
  if (m) { const y = m[3].length === 4 ? m[3].slice(2) : p2(m[3]); return `${p2(m[1])}/${p2(m[2])}/${y}`; }
  return str; // formato desconocido: se deja tal cual
}

// Meses para el dropdown: el actual + los 5 siguientes, en formato "JULIO 2026".
const MESES_NOM = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

// Texto estándar de la carta para una devolución de garantía (>=45 chars que exige el endpoint).
const TEXTO_DEVOL_GARANTIA = 'Descuento de la garantía en poder del Dueño para realizar el Término';
// Mes de liquidación en curso (regla del día 23: día>=23 -> mes siguiente). Devuelve "AGOSTO 2026".
function mesLiquidacionEnCurso() {
  const h = new Date();
  let mm = h.getMonth(), yy = h.getFullYear();
  if (h.getDate() >= 23) { mm += 1; if (mm > 11) { mm = 0; yy += 1; } }
  return `${MESES_NOM[mm]} ${yy}`;
}
// ¿es un descuento de término (T-...)?
const esTerminoRep = (rep) => /^T-/i.test(String(rep || '').trim());
function opcionesMes() {
  const hoy = new Date();
  const out = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
    out.push(`${MESES_NOM[d.getMonth()]} ${d.getFullYear()}`);
  }
  return out;
}

// Cuántas filas mostrar por defecto (las más recientes)
const TOPE_DEFECTO = 100;

const C = {  azul: '#1f4e79', azulClaro: '#dbe5f1', borde: '#c9d3e0',
  verde: '#2e7d32', rojo: '#c62828', ambar: '#b8860b', gris: '#6b7280',
  fondo: '#f4f7fb',
};
const BEIGE = '#FBEFC7';          // resaltado de celda con dato corregido
const BEIGE_TXT = '#8a6d0a';      // texto del "· corregido"

// ── Candado "imputar a PROPIETARIO" (regla desde AGOSTO 2026) ──
const MES_NUM = {
  ENERO: 1, FEBRERO: 2, MARZO: 3, ABRIL: 4, MAYO: 5, JUNIO: 6, JULIO: 7,
  AGOSTO: 8, SEPTIEMBRE: 9, SETIEMBRE: 9, OCTUBRE: 10, NOVIEMBRE: 11, DICIEMBRE: 12,
};
// ¿mes_a_imputar es AGOSTO 2026 o posterior? (los "----MES" anulados NO cuentan)
function mesDesdeAgosto2026(mesTexto) {
  const t = String(mesTexto || '').trim();
  if (t.startsWith('-')) return false;                 // anulado (herencia VBA)
  const m = t.toUpperCase().match(/([A-ZÑ]+)\s+(\d{4})/);
  if (!m) return false;
  const mm = MES_NUM[m[1]];
  const anio = parseInt(m[2], 10);
  if (!mm || !anio) return false;
  return anio > 2026 || (anio === 2026 && mm >= 8);
}
// Devuelve un mensaje de bloqueo si el IDADMON no es imputable a PROPIETARIO (Q/N/N-DICOM), o '' si está bien.
async function motivoNoImputableAPropietario(idadmon) {
  const id = String(idadmon || '').trim();
  if (!id) return '';
  try {
    const r = await fetch(`/api/descuentos/lookup-idadmon?idadmon=${encodeURIComponent(id)}`);
    const j = await r.json();
    const est = String(j.estado || '').trim().toUpperCase();
    if (['Q', 'N', 'N-DICOM'].includes(est)) {
      const suc = j.sucesor ? ` El contrato vigente del inmueble es ${j.sucesor} — usa ese IDADMON.` : '';
      return `No se puede imputar a PROPIETARIO: el IDADMON ${id} está en estado ${est} (terminado), ` +
             `así que este descuento NO entraría en la liquidación. Cambia el IDADMON al del contrato vigente (P/S/SQ).${suc}`;
    }
  } catch { /* si no se puede verificar, no bloqueamos aquí (lo cubre el servidor) */ }
  return '';
}


export default function DescuentosPage() {
  const [caps, setCaps] = useState({ crear: false, corregir: false, verificar: false });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [puedeGestionar, setPuedeGestionar] = useState(false);   // Dirección + Karina
  const [gestNum, setGestNum] = useState('');                    // Núm en la caja ANULAR/CAMBIAR

  useEffect(() => {
    fetch('/api/descuentos/anular').then(r => r.json()).then(j => setPuedeGestionar(!!j.puede)).catch(() => {});
  }, []);

  async function cargar() {
    setLoading(true); setError('');
    try {
      const r = await fetch('/api/descuentos/listar', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Error al cargar');
      setCaps(j.caps || {});
      setRows(j.rows || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { cargar(); }, []);

  // -------------------- FILTROS TIPO EXCEL --------------------
  const [filtros, setFiltros] = useState({});       // { col: Set(valores seleccionados) }
  const [menuCol, setMenuCol] = useState(null);     // col con menú abierto
  const [busca, setBusca] = useState('');           // texto del buscador del menú
  const [verTodos, setVerTodos] = useState(false);  // mostrar todo el histórico o solo lo reciente
  const menuRef = useRef(null);
  const scrollRef = useRef(null);   // contenedor scrolleable de la tabla
  const ancladoRef = useRef(false); // para anclar al fondo solo una vez por carga
  const rowRefs = useRef({});          // DOM de cada fila, por id, para centrar
  const centrarPendiente = useRef(null); // id de la fila a centrar tras buscar por Núm

  useEffect(() => {
    function onDoc(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuCol(null);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function valoresUnicos(col) {
    const s = new Set();
    rows.forEach((r) => {
      let v = r[col];
      if (col === 'verificado') v = r[col] ? 'Sí' : 'No';
      s.add((v ?? '') === '' ? '(vacío)' : String(v));
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'es'));
  }

  function cellFilterValue(r, col) {
    let v = r[col];
    if (col === 'verificado') v = r[col] ? 'Sí' : 'No';
    return (v ?? '') === '' ? '(vacío)' : String(v);
  }

  const filtradas = useMemo(() => {
    return rows.filter((r) =>
      Object.entries(filtros).every(([col, set]) => {
        if (!set || set.size === 0) return true; // sin filtro activo
        return set.has(cellFilterValue(r, col));
      })
    );
  }, [rows, filtros]);

  const hayFiltroActivo = Object.values(filtros).some((s) => s && s.size > 0);

  // Exportar a Excel EXACTAMENTE lo filtrado (todas las columnas: vista + ficha).
  async function exportarExcel() {
    const XLSX = await import('xlsx');
    // Orden de columnas: primero las de la vista, luego el resto de campos de LABELS.
    const colsVista = COLS.map(c => c.key);
    const resto = Object.keys(LABELS).filter(k => !colsVista.includes(k)
      && !['id', 'sync_hash'].includes(k));
    const orden = [...colsVista, ...resto];
    const filas = filtradas.map((r) => {
      const o = {};
      for (const k of orden) {
        const lab = LABELS[k] || k;
        let v = r[k];
        // Montos y fechas en formato legible; el resto tal cual.
        if (k === 'fecha' || k === 'fecha_contable' || k === 'creado_at' || k === 'modificado_at' || k === 'verificado_at' || k === 'updated_at') {
          v = v ? fmtFecha(v) : '';
        } else if (k === 'monto_a_imputar' || k === 'monto_a_transferir') {
          v = (v == null || v === '') ? '' : Number(v);
        } else {
          v = v == null ? '' : v;
        }
        o[lab] = v;
      }
      return o;
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(filas);
    XLSX.utils.book_append_sheet(wb, ws, 'Descuentos');
    // Nombre con el mes filtrado si hay uno, o la fecha de hoy.
    const mesFiltro = filtros.mes_a_imputar && filtros.mes_a_imputar.size === 1
      ? [...filtros.mes_a_imputar][0].replace(/[^\w]+/g, '_') : null;
    const hoy = new Date().toISOString().slice(0, 10);
    const nombre = `Descuentos_${mesFiltro || hoy}.xlsx`;
    XLSX.writeFile(wb, nombre);
  }

  // rows viene con el NUM más alto/reciente AL FINAL. Por defecto mostramos los
  // 30 del final (los más recientes). Con filtro activo o "ver todos", todas.
  const visibles = useMemo(() => {
    if (verTodos || hayFiltroActivo) return filtradas;
    return filtradas.slice(-TOPE_DEFECTO);
  }, [filtradas, verTodos, hayFiltroActivo]);

  // Al cambiar entre "recientes" y "ver todos", permitir re-anclar al fondo una vez.
  useEffect(() => { ancladoRef.current = false; }, [verTodos]);

  // Sin filtro activo (vista por defecto o "ver todos"), tras cargar dejar el
  // scroll al fondo UNA vez: así los descuentos recientes quedan a la vista y el
  // scrolling hacia los antiguos es cómodo. Con filtro activo no se fuerza.
  useEffect(() => {
    if (loading) { ancladoRef.current = false; return; }
    if (hayFiltroActivo) return;
    if (ancladoRef.current) return;
    const el = scrollRef.current;
    if (el) { el.scrollTop = el.scrollHeight; ancladoRef.current = true; }
  }, [loading, verTodos, hayFiltroActivo, visibles]);

  function toggleValor(col, valor) {
    setFiltros((prev) => {
      const actual = new Set(prev[col] || valoresUnicos(col)); // si no había filtro, parte de "todos"
      if (actual.has(valor)) actual.delete(valor); else actual.add(valor);
      return { ...prev, [col]: actual };
    });
  }
  function soloEste(col, valor) {
    setFiltros((prev) => ({ ...prev, [col]: new Set([valor]) }));
    setMenuCol(null);
  }
  function limpiarFiltro(col) {
    setFiltros((prev) => { const n = { ...prev }; delete n[col]; return n; });
    setMenuCol(null);
  }
  const colFiltrada = (col) => filtros[col] && filtros[col].size > 0
    && filtros[col].size < valoresUnicos(col).length;

  // -------------------- ALTA --------------------
  const [showForm, setShowForm] = useState(false);
  const [prefill, setPrefill] = useState(null);   // datos para prerellenar el alta (p.ej. devolución de garantía)

  // -------------------- FICHA (drawer) --------------------
  const [descSel, setDescSel] = useState(null);   // fila abierta en el drawer
  const [hoverId, setHoverId] = useState(null);   // fila resaltada bajo el ratón

  // Centrar en la lista la fila buscada por Núm (una vez renderizada).
  useEffect(() => {
    const id = centrarPendiente.current;
    if (id == null) return;
    const el = rowRefs.current[id];
    if (el && el.scrollIntoView) {
      ancladoRef.current = true;   // evita que el anclaje al fondo interfiera
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      centrarPendiente.current = null;
    }
  }, [descSel, visibles]);

  // -------------------- ANULAR / CAMBIAR por Núm (Dirección + Karina) --------------------
  async function anularNum() {
    const n = gestNum.trim().replace(/\D/g, '');
    if (!n) return;
    if (!window.confirm(`¿Anular el descuento Núm ${n}? Se marcará mes a imputar = "ANULADO" y dejará de contar en las liquidaciones.`)) return;
    try {
      const res = await fetch('/api/descuentos/anular', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ num: n }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { alert('No se pudo anular: ' + (j.error || res.status)); return; }
      setGestNum('');
      cargar();
    } catch (e) { alert('Error: ' + e.message); }
  }
  function cambiarNum() {
    const n = gestNum.trim().replace(/\D/g, '');
    if (!n) return;
    const row = rows.find((r) => String(r.num) === n);
    if (row) {
      setDescSel(row);
      centrarPendiente.current = row.id;
      // si la fila no está entre las recientes visibles, mostrar todas para poder centrarla
      const enVisibles = (verTodos || hayFiltroActivo) || filtradas.slice(-TOPE_DEFECTO).some((v) => v.id === row.id);
      if (!enVisibles) setVerTodos(true);
    } else alert(`El Núm ${n} no existe en la lista de descuentos.`);
  }

  async function toggleVerificado(r) {
    try {
      const res = await fetch('/api/descuentos/verificar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: r.id, verificado: !r.verificado }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Error al verificar');
      await cargar();
    } catch (e) { alert(e.message); }
  }

  return (
    <>
      <TopNav />
      <div style={{ padding: '72px 20px 20px', background: C.fondo, minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h1 style={{ color: C.azul, margin: 0, fontSize: 24 }}>Descuentos</h1>

        {puedeGestionar && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button onClick={anularNum} style={btn(C.rojo)}>ANULAR</button>
              <input value={gestNum} onChange={(e) => setGestNum(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') cambiarNum(); }}
                placeholder="Núm" title="Número del descuento afectado"
                style={{ width: 84, padding: '7px 10px', borderRadius: 6, border: `1px solid ${C.borde}`,
                  fontSize: 13, textAlign: 'center', fontFamily: 'inherit', outline: 'none' }} />
              <button onClick={cambiarNum} style={btn(C.azul)}>CAMBIAR</button>
            </div>
            <span style={{ fontSize: 10, color: C.gris }}>Solo Dirección y Karina</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          {caps.crear && (
            <button onClick={() => { setPrefill(null); setShowForm((v) => !v); }} style={btn(C.verde)}>
              {showForm ? 'Cerrar formulario' : '+ Añadir descuento'}
            </button>
          )}
          <button onClick={cargar} style={btn(C.gris)}>↻ Recargar</button>
          <button onClick={exportarExcel} disabled={filtradas.length === 0}
            title="Exporta a Excel todo lo filtrado, con todas las columnas"
            style={{ ...btn('#188038'), opacity: filtradas.length === 0 ? 0.5 : 1, cursor: filtradas.length === 0 ? 'default' : 'pointer' }}>
            ⭳ Exportar Excel ({filtradas.length})
          </button>
        </div>
      </div>

      {/* Aviso de capacidades */}
      <div style={{ fontSize: 12, color: C.gris, marginBottom: 10 }}>
        {caps.corregir
          ? 'Puedes crear, corregir y verificar. Cada corrección queda registrada en la bitácora.'
          : caps.crear
            ? 'Puedes añadir descuentos nuevos. Los registros existentes no se pueden modificar.'
            : 'Solo lectura.'}
        {' · '}
        <span style={{ color: C.azul, fontWeight: 600 }}>Pincha en cualquier fila para abrir su ficha (ver{caps.corregir ? ' / editar' : ''}).</span>
        {' · '}
        <span style={{ background: BEIGE, color: BEIGE_TXT, fontWeight: 600, borderRadius: 4, padding: '0 6px' }}>celda beige = dato corregido</span>
      </div>

      {error && <div style={{ color: C.rojo, marginBottom: 10 }}>{error}</div>}

      {showForm && caps.crear && (
        <FormAlta inicial={prefill} onCreado={() => { setShowForm(false); setPrefill(null); cargar(); }} />
      )}

      {loading ? (
        <div style={{ color: C.gris }}>Cargando…</div>
      ) : (
        <div ref={scrollRef} style={{ maxHeight: '62vh', overflow: 'auto', border: `1px solid ${C.borde}`, borderRadius: 6, background: '#fff' }}>
          <table style={{ borderCollapse: 'collapse', width: TABLE_W, tableLayout: 'fixed', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
            <colgroup>
              {COLS.map((c) => <col key={c.key} style={{ width: c.w }} />)}
            </colgroup>
            <thead>
              <tr>
                {COLS.map((c, ci) => (
                  <th key={c.key} style={{ ...th(), textAlign: c.align || 'left', ...(ci === 0 ? { left: 0, zIndex: 12 } : {}) }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'space-between' }}>
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.label}</span>
                      <button
                        onClick={() => { setMenuCol(menuCol === c.key ? null : c.key); setBusca(''); }}
                        title="Filtrar"
                        style={{
                          border: 'none', cursor: 'pointer', borderRadius: 3, padding: 0, flexShrink: 0,
                          width: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          background: colFiltrada(c.key) ? C.ambar : 'rgba(255,255,255,.30)',
                          color: '#fff', fontSize: 9, lineHeight: 1,
                        }}
                      >▼</button>
                    </div>
                    {menuCol === c.key && (
                      <FiltroMenu
                        ref={menuRef}
                        col={c.key}
                        lado={ci < COLS.length / 2 ? 'left' : 'right'}
                        valores={valoresUnicos(c.key)}
                        seleccion={filtros[c.key]}
                        busca={busca} setBusca={setBusca}
                        onToggle={(v) => toggleValor(c.key, v)}
                        onSolo={(v) => soloEste(c.key, v)}
                        onTodos={() => limpiarFiltro(c.key)}
                        onCerrar={() => setMenuCol(null)}
                      />
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibles.map((r) => {
                const activo = descSel && descSel.id === r.id;
                return (
                <tr key={r.id}
                  ref={(el) => { if (el) rowRefs.current[r.id] = el; }}
                  onMouseEnter={() => setHoverId(r.id)}
                  onMouseLeave={() => setHoverId((h) => (h === r.id ? null : h))}
                  title="Pincha para ver / editar la ficha"
                  style={{
                    background: hoverId === r.id ? '#dbe9fb'
                      : activo ? '#ffffff'
                      : (r.verificado ? '#f1f8f1' : '#F1F1EE'),
                    cursor: 'pointer',
                    fontWeight: activo ? 600 : 'normal',
                    boxShadow: activo ? 'inset 4px 0 0 ' + C.ambar
                      : hoverId === r.id ? 'inset 3px 0 0 ' + C.azul : 'none',
                  }}>
                  {COLS.map((c, ci) => {
                    const corregida = Array.isArray(r.campos_corregidos) && r.campos_corregidos.includes(c.key);
                    const fija = ci === 0;   // columna N: sticky a la izquierda
                    const filaBg = hoverId === r.id ? '#dbe9fb' : (activo ? '#ffffff' : (r.verificado ? '#f1f8f1' : '#F1F1EE'));
                    // Celda "Imputar a": verde claro si ya está en cartola, rojizo si es ARRENDATARIO sin pasar.
                    const esArrRow = c.key === 'repercutir_a' && String(r.repercutir_a || '').trim().toUpperCase() === 'ARRENDATARIO' && !String(r.mes_a_imputar || '').startsWith('----');
                    const bgCartola = esArrRow ? (r.pasado_a_cartola ? '#DCF3E3' : '#FBE4E4') : null;
                    return (
                    <td key={c.key}
                      onClick={() => setDescSel(r)}
                      title={esArrRow ? (r.pasado_a_cartola ? 'Ya imputado a Cartolas' : 'Pendiente de imputar a Cartolas') : (corregida ? 'Dato corregido' : undefined)}
                      style={{ ...td(), textAlign: c.align || 'left', cursor: 'pointer',
                        ...(corregida ? { background: BEIGE } : {}),
                        ...(bgCartola ? { background: bgCartola } : {}),
                        ...(fija ? { position: 'sticky', left: 0, zIndex: 5, background: corregida ? BEIGE : filaBg } : {}) }}>
                      {renderCelda(r, c.key, { caps, toggleVerificado, col: c })}
                    </td>
                    );
                  })}
                </tr>
                );
              })}
              {visibles.length === 0 && (
                <tr><td colSpan={COLS.length} style={{ ...td(), textAlign: 'center', color: C.gris, padding: 20 }}>
                  No hay registros con los filtros actuales.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 8, fontSize: 12, color: C.gris, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span>
          Mostrando {visibles.length} de {filtradas.length}
          {filtradas.length !== rows.length ? ` (filtrados de ${rows.length})` : ' registros'}
        </span>
        {!verTodos && !hayFiltroActivo && filtradas.length > TOPE_DEFECTO && (
          <button onClick={() => setVerTodos(true)} style={btnMini(C.azul)}>
            Ver todos ({filtradas.length})
          </button>
        )}
        {verTodos && !hayFiltroActivo && filtradas.length > TOPE_DEFECTO && (
          <button onClick={() => setVerTodos(false)} style={btnMini(C.gris)}>
            Ver solo los últimos {TOPE_DEFECTO}
          </button>
        )}
      </div>

      {descSel && (
        <FichaDescuento
          descuento={descSel}
          caps={caps}
          onClose={() => setDescSel(null)}
          onGuardado={async () => { await cargar(); }}
          onCrearGarantia={(datos) => { setPrefill(datos); setDescSel(null); setShowForm(true); if (scrollRef.current) scrollRef.current.scrollIntoView?.({ behavior: 'smooth' }); }}
        />
      )}
      </div>
    </>
  );
}

// ---------- celda (solo lectura; la edición es por la ficha) ----------
function renderCelda(r, key, ctx) {
  const { caps, toggleVerificado, col } = ctx;
  const stop = (e) => e.stopPropagation();   // evita abrir el drawer al pulsar controles

  if (key === 'verificado') {
    return r.verificado
      ? <span style={{ color: '#2e7d32', fontWeight: 600 }} title={`${r.verificado_por || ''} ${r.verificado_at ? new Date(r.verificado_at).toLocaleDateString('es-CL') : ''}`}>
          ✓ {caps.verificar && <a onClick={(e) => { stop(e); toggleVerificado(r); }} style={linkMini}>quitar</a>}
        </span>
      : (caps.verificar
          ? <button onClick={(e) => { stop(e); toggleVerificado(r); }} style={btnMini('#2e7d32')}>Verificar</button>
          : <span style={{ color: '#999' }}>—</span>);
  }

  if (key === 'texto_para_contabilidad') {
    return <CeldaTextoContab texto={r.texto_para_contabilidad} />;
  }

  let v = r[key];
  if (key === 'fecha') v = fmtFecha(v);
  if (key === 'monto_a_imputar' || key === 'monto_a_transferir') v = money(v);

  // columnas largas marcadas trunc: recorte con ellipsis + hover con el valor completo
  if (col && col.trunc) {
    return <span title={r[key] || ''} style={{ display: 'block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v || ''}</span>;
  }
  // columnas cortas (num, fecha, idadmon, montos, tipo): sin ajuste de línea
  return <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v ?? ''}</span>;
}

// ---------- celda TEXTO PARA CONTABILIDAD (lectura + hover + copiar) ----------
// Muestra el texto precalculado que Karina lleva al BI. Truncado con ellipsis,
// hover nativo (title) para leerlo entero, y botón 📋 que copia el texto completo.
function CeldaTextoContab({ texto }) {
  const [copiado, setCopiado] = useState(false);
  const t = (texto ?? '').toString();

  async function copiar(e) {
    if (e) e.stopPropagation();   // no abrir el drawer al copiar
    if (!t) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(t);
      } else {
        const ta = document.createElement('textarea');
        ta.value = t;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1200);
    } catch { /* si falla la copia, no rompemos nada */ }
  }

  if (!t) return <span style={{ color: '#999' }}>—</span>;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%', minWidth: 0 }}>
      <span
        title={t}
        style={{
          flex: 1, minWidth: 0, overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
      >{t}</span>
      <button
        onClick={copiar}
        title={copiado ? 'Copiado' : 'Copiar texto para contabilidad'}
        style={{
          border: 'none', cursor: 'pointer', borderRadius: 4, fontSize: 11,
          padding: '2px 6px', flexShrink: 0, lineHeight: 1.4,
          background: copiado ? '#2e7d32' : '#dbe5f1',
          color: copiado ? '#fff' : '#1f4e79',
        }}
      >{copiado ? '✓' : '📋'}</button>
    </div>
  );
}

// ---------- menú de filtro estilo Excel ----------
const FiltroMenu = forwardRef(function FiltroMenu(
  { valores, seleccion, busca, setBusca, onToggle, onSolo, onTodos, onCerrar, lado = 'right' }, ref) {
  const sel = seleccion && seleccion.size > 0 ? seleccion : new Set(valores); // sin filtro = todos
  const visibles = valores.filter((v) => v.toLowerCase().includes(busca.toLowerCase()));
  // Las columnas de la izquierda abren el menú hacia la derecha (left:0) y las de
  // la derecha hacia la izquierda (right:0), para que nunca tape su propia columna.
  const anchoLado = lado === 'left' ? { left: 0 } : { right: 0 };
  return (
    <div ref={ref} style={{
      position: 'absolute', zIndex: 50, top: '100%', ...anchoLado, marginTop: 4,
      background: '#fff', color: '#222', border: '1px solid #b9c2d0', borderRadius: 6,
      boxShadow: '0 6px 18px rgba(0,0,0,.18)', width: 230, padding: 8, textAlign: 'left',
      fontWeight: 400, fontSize: 12,
    }}>
      <input autoFocus placeholder="Buscar…" value={busca} onChange={(e) => setBusca(e.target.value)}
        style={{ width: '100%', boxSizing: 'border-box', padding: '4px 6px', marginBottom: 6, fontSize: 12 }} />
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <button onClick={onTodos} style={btnMini('#1f4e79')}>Mostrar todos</button>
      </div>
      <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #eee', borderRadius: 4, padding: 4 }}>
        {visibles.map((v) => (
          <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', cursor: 'pointer' }}>
            <input type="checkbox" checked={sel.has(v)} onChange={() => onToggle(v)} />
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>
            <a onClick={() => onSolo(v)} style={linkMini}>solo</a>
          </label>
        ))}
        {visibles.length === 0 && <div style={{ color: '#999', padding: 4 }}>Sin coincidencias</div>}
      </div>
      <div style={{ textAlign: 'right', marginTop: 6 }}>
        <button onClick={onCerrar} style={btnMini('#6b7280')}>Cerrar</button>
      </div>
    </div>
  );
});

// ---------- bitácora ----------
function Bitacora({ rows, loading, creado }) {
  if (loading) return <span style={{ color: '#888' }}>Cargando bitácora…</span>;
  return (
    <div style={{ fontSize: 12 }}>
      <div style={{ marginBottom: 6, color: '#555' }}>
        <b>Alta:</b> {creado.ingresado_por || '—'} ({creado.creado_por || 'histórico Excel'})
        {creado.creado_at ? ' · ' + new Date(creado.creado_at).toLocaleString('es-CL') : ''}
      </div>
      {rows.length === 0 ? (
        <span style={{ color: '#888' }}>Sin movimientos registrados.</span>
      ) : (
        <table style={{ borderCollapse: 'collapse', width: '100%', fontVariantNumeric: 'tabular-nums' }}>
          <thead><tr>
            {['Cuándo', 'Acción', 'Campo', 'Antes', 'Después', 'Quién'].map((h) => (
              <th key={h} style={{ ...thMini }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id}>
                <td style={tdMini}>{new Date(b.created_at).toLocaleString('es-CL')}</td>
                <td style={tdMini}>{b.accion}</td>
                <td style={tdMini}>{b.campo || '—'}</td>
                <td style={tdMini}>{b.valor_anterior ?? ''}</td>
                <td style={tdMini}>{b.valor_nuevo ?? ''}</td>
                <td style={tdMini}>{b.usuario}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------- FICHA DEL DESCUENTO (drawer lateral: ver / editar) ----------
function FichaDescuento({ descuento, caps, onClose, onGuardado, onCrearGarantia }) {
  const [row, setRow] = useState(descuento);
  const [modo, setModo] = useState('ver');
  const [buf, setBuf] = useState({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [bitaRows, setBitaRows] = useState([]);
  const [bitaLoad, setBitaLoad] = useState(true);
  const [sucesor, setSucesor] = useState('');           // sucesor del inmueble (P/S/SQ) para sugerir ID relacionado
  const [sucesorMult, setSucesorMult] = useState(false);
  const [estadoId, setEstadoId] = useState('');         // estado del IDADMON principal (badge informativo en edición)
  const [garInfo, setGarInfo] = useState(null);         // info de garantía del contrato (para el botón de devolución)
  const [pasandoCartola, setPasandoCartola] = useState(false);   // Mejora 1: pasar descuento ARRENDATARIO a cartola
  const [pasadoLocal, setPasadoLocal] = useState(null);          // marca local tras pasar (sin recargar)

  // Si el descuento es un T-... consulta la garantía del contrato (para ofrecer crear su devolución).
  useEffect(() => {
    if (!esTerminoRep(row.repercutir_a)) { setGarInfo(null); return; }
    let vivo = true;
    (async () => {
      try {
        const r = await fetch(`/api/descuentos/garantia-info?idadmon=${encodeURIComponent(row.idadmon || '')}`, { cache: 'no-store' });
        const j = await r.json();
        if (vivo) setGarInfo(j && j.encontrado ? j : null);
      } catch { if (vivo) setGarInfo(null); }
    })();
    return () => { vivo = false; };
  }, [row.idadmon, row.repercutir_a]);

  function lanzarDevolucionGarantia() {
    if (!garInfo) return;
    onCrearGarantia && onCrearGarantia({
      idadmon: garInfo.sucesor || '',                    // principal = sucesor (si es único); si no, se rellena a mano
      inmueble: garInfo.inmueble || row.inmueble || '',
      propietario: garInfo.propietario || row.propietario || '',
      repercutir_a: 'PROPIETARIO',
      tipo: 'GARANTIAS',
      monto_a_imputar: String(Math.abs(garInfo.garantia || 0)),   // POSITIVO = se le descuenta al propietario (recuperación)
      mes_a_imputar: mesLiquidacionEnCurso(),
      idadmon_relacionado: row.idadmon || '',            // referencia: el contrato terminado
      texto_explicativo_para_carta_a_propietario: TEXTO_DEVOL_GARANTIA,
    });
  }

  async function pasarACartola() {
    if (pasandoCartola) return;
    const monto = Number(row.monto_a_imputar) || 0;
    const tipoMov = monto >= 0 ? 'CARGO' : 'ABONO';
    if (!window.confirm(`Pasar el descuento Nº ${row.num} a la cartola del arrendatario (${row.idadmon}) como ${tipoMov} de ${Math.abs(monto).toLocaleString('es-CL')}. ¿Continuar?`)) return;
    setPasandoCartola(true); setErr('');
    try {
      const res = await fetch('/api/descuentos/pasar-cartola', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id }),
      });
      const j = await res.json();
      if (j.ok) {
        setPasadoLocal({ tipo: j.tipo, monto: j.monto });
      } else {
        setErr(j.error || 'No se pudo pasar a cartola');
        if (j.yaPasado) setPasadoLocal({ ya: true });
      }
    } catch (e) {
      setErr('Error de red al pasar a cartola');
    }
    setPasandoCartola(false);
  }

  useEffect(() => {
    let vivo = true;
    (async () => {
      setBitaLoad(true);
      try {
        const res = await fetch(`/api/descuentos/bitacora?descuento_id=${row.id}`, { cache: 'no-store' });
        const j = await res.json();
        if (vivo) setBitaRows(j.rows || []);
      } catch { if (vivo) setBitaRows([]); }
      finally { if (vivo) setBitaLoad(false); }
    })();
    return () => { vivo = false; };
  }, [row.id]);

  function entrarEdicion() {
    const b = {};
    EDIT_CAMPOS.forEach(({ k }) => { b[k] = row[k] ?? ''; });
    setBuf(b); setErr(''); setModo('editar');
    setSucesor(''); setSucesorMult(''); setEstadoId('');
  }

  // En edición, consulta en vivo el estado y el sucesor del IDADMON del buffer (se actualiza al cambiarlo).
  useEffect(() => {
    if (modo !== 'editar') return;
    const id = String(buf.idadmon || '').trim().toUpperCase();
    if (!/^A\d{5}$/.test(id)) { setEstadoId(''); setSucesor(''); setSucesorMult(false); return; }
    let vivo = true;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/descuentos/lookup-idadmon?idadmon=${encodeURIComponent(id)}`);
        const j = await r.json();
        if (!vivo) return;
        if (j.encontrado) {
          setEstadoId(String(j.estado || '').trim().toUpperCase());
          setSucesor(j.sucesor || ''); setSucesorMult(!!j.sucesor_multiple);
        } else { setEstadoId('NO ENCONTRADO'); setSucesor(''); setSucesorMult(false); }
      } catch { if (vivo) setEstadoId(''); }
    }, 350);
    return () => { vivo = false; clearTimeout(t); };
  }, [buf.idadmon, modo]);

  async function recargarBitacora() {
    try {
      const res = await fetch(`/api/descuentos/bitacora?descuento_id=${row.id}`, { cache: 'no-store' });
      const j = await res.json();
      setBitaRows(j.rows || []);
    } catch { /* nada */ }
  }

  async function guardar() {
    setErr('');
    const txt = String(buf.texto_explicativo_para_carta_a_propietario ?? '').trim();
    if (txt !== '' && txt.length < 15) {
      setErr('El texto para liquidación debe tener al menos 15 caracteres.'); return;
    }
    // CANDADO: imputar a PROPIETARIO exige IDADMON vigente (no Q/N/N-DICOM), de AGOSTO 2026 en adelante.
    const repFinal = String(buf.repercutir_a ?? row.repercutir_a ?? '').trim().toUpperCase();
    const mesFinal = buf.mes_a_imputar ?? row.mes_a_imputar;
    if (repFinal === 'PROPIETARIO' && mesDesdeAgosto2026(mesFinal)) {
      const bloqueo = await motivoNoImputableAPropietario(buf.idadmon ?? row.idadmon);
      if (bloqueo) { setErr(bloqueo); return; }
    }
    const cambios = {};
    EDIT_CAMPOS.forEach(({ k }) => {
      const nuevo = buf[k] ?? '';
      const viejo = row[k] ?? '';
      if (String(nuevo) !== String(viejo)) cambios[k] = nuevo === '' ? null : nuevo;
    });
    if (Object.keys(cambios).length === 0) { setModo('ver'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/descuentos/corregir', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, cambios }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Error al corregir');
      if (j.row) setRow(j.row);
      setModo('ver');
      await recargarBitacora();
      onGuardado && onGuardado();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  const editable = !!caps.corregir;

  return (
    <>
      <div onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.28)', zIndex: 200 }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, height: '100vh', width: 'min(560px, 96vw)',
        background: '#fff', zIndex: 201, boxShadow: '-6px 0 24px rgba(0,0,0,.18)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* cabecera */}
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.borde}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.azul }}>Descuento N° {row.num || '—'}</div>
            <div style={{ fontSize: 12, color: C.gris }}>
              {row.idadmon || '—'} · {row.tipo || ''} · {fmtFecha(row.fecha)}{row.verificado ? ' · ✓ verificado' : ''}
            </div>
          </div>
          <button onClick={onClose} style={btnMini(C.gris)}>✕ Cerrar</button>
        </div>

        {/* barra de modo */}
        <div style={{ padding: '10px 18px', borderBottom: `1px solid ${C.borde}`, display: 'flex', gap: 8, alignItems: 'center', background: '#fafbfd' }}>
          {modo === 'ver' ? (
            editable
              ? <button onClick={entrarEdicion} style={btn(C.azul)}>✎ Editar</button>
              : <span style={{ fontSize: 12, color: C.gris }}>Solo lectura.</span>
          ) : (
            <>
              <button disabled={saving} onClick={guardar} style={btn(C.verde)}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
              <button disabled={saving} onClick={() => { setModo('ver'); setErr(''); }} style={btn(C.gris)}>Cancelar</button>
            </>
          )}
          {modo === 'ver' && caps.crear && garInfo && garInfo.es_dueno && garInfo.garantia > 0 && (
            <button onClick={lanzarDevolucionGarantia}
              title={`Crear el descuento de devolución de la garantía (${garInfo.garantia.toLocaleString('es-CL')}) que tiene el DUEÑO. Se abre el alta ya rellena.`}
              style={{ ...btn('#8a6d0a'), background: '#FBEFC7', color: '#8a6d0a', border: '1px solid #e6d38a' }}>
              ➕ Devolución de garantía ({garInfo.garantia.toLocaleString('es-CL')})
            </button>
          )}
          {/* Mejora 1: pasar/modificar cartola (solo ARRENDATARIO, no anulado) */}
          {modo === 'ver' && caps.crear
            && String(row.repercutir_a || '').trim().toUpperCase() === 'ARRENDATARIO'
            && !String(row.mes_a_imputar || '').startsWith('----')
            && (() => {
              const yaPasado = !!(row.pasado_a_cartola || (pasadoLocal && !pasadoLocal.error))
              return (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  {yaPasado && (
                    <span style={{ fontSize: 12, color: C.verde, fontWeight: 600 }}>
                      ✓ En cartola{pasadoLocal && pasadoLocal.tipo ? ` (${pasadoLocal.tipo} ${Number(pasadoLocal.monto).toLocaleString('es-CL')})` : ''}
                    </span>
                  )}
                  <button onClick={pasarACartola} disabled={pasandoCartola}
                    title={yaPasado
                      ? 'Rehacer el movimiento en la cartola con el signo/importe actual del descuento (por si era abono en vez de cargo, o cambió el importe).'
                      : 'Insertar este descuento en la cartola del arrendatario (cargo si es positivo, abono si es negativo).'}
                    style={{ ...btn('#5b21b6'), background: '#EDE7F9', color: '#5b21b6', border: '1px solid #c9b6ef' }}>
                    {pasandoCartola ? 'Procesando…' : (yaPasado ? 'Modificar cargo/abono Cartola' : '📥 Pasar a Cartolas')}
                  </button>
                </span>
              )
            })()}
          {err && <span style={{ color: C.rojo, fontSize: 12 }}>{err}</span>}
        </div>

        {/* cuerpo */}
        <div style={{ overflow: 'auto', padding: '14px 18px', flex: 1 }}>
          {modo === 'ver'
            ? SECCIONES_VER.map((sec) => (
                <div key={sec.titulo} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.azul, textTransform: 'uppercase', letterSpacing: .4, marginBottom: 6, borderBottom: `1px solid ${C.azulClaro || C.borde}`, paddingBottom: 3 }}>
                    {sec.titulo}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
                    {sec.campos.map((k) => {
                      const largo = ['texto_explicativo_para_carta_a_propietario', 'texto_para_contabilidad', 'aclaracion', 'comentarios_karina', 'visto_bueno_de_karina_y_mas_comentarios', 'comentario_interno2', 'inmueble', 'propietario'].includes(k);
                      const esEnlace = (k === 'relacionado' || k === 'link_admon');
                      const val = row[k];
                      const urlValida = esEnlace && /^https?:\/\//i.test(String(val || '').trim());
                      const corregido = Array.isArray(row.campos_corregidos) && row.campos_corregidos.includes(k);
                      return (
                        <div key={k} style={{ gridColumn: largo ? '1 / -1' : 'auto', minWidth: 0, background: corregido ? BEIGE : 'transparent', borderRadius: corregido ? 5 : 0, padding: corregido ? '3px 7px' : 0 }}>
                          <div style={{ fontSize: 11, color: C.gris }}>{LABELS[k] || k}{corregido && <span style={{ color: BEIGE_TXT, fontWeight: 700 }}> · corregido</span>}</div>
                          {urlValida
                            ? <a href={String(val).trim()} target="_blank" rel="noopener noreferrer"
                                style={{ fontSize: 13, color: C.azul, fontWeight: 600, textDecoration: 'none', wordBreak: 'break-all' }}>
                                🔗 Abrir enlace
                              </a>
                            : <div style={{ fontSize: 13, color: '#222', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{fmtValor(k, val)}</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {EDIT_CAMPOS.map((cfg) => {
                  const largo = cfg.tipo === 'area';
                  return (
                    <div key={cfg.k} style={{ gridColumn: largo ? '1 / -1' : 'auto' }}>
                      <Campo label={LABELS[cfg.k] || cfg.k}>
                        {editorCampo(cfg, buf[cfg.k] ?? '', (val) => setBuf((b) => ({ ...b, [cfg.k]: val })))}
                      </Campo>
                      {cfg.k === 'idadmon' && estadoId && (() => {
                        const est = estadoId;
                        const terminado = ['Q', 'N', 'N-DICOM'].includes(est);
                        const vigente = ['P', 'S', 'SQ'].includes(est);
                        const noEnc = est === 'NO ENCONTRADO';
                        const bg = terminado ? '#fde8e8' : vigente ? '#e6f4ea' : '#f3f4f6';
                        const fg = terminado ? C.rojo : vigente ? C.verde : C.gris;
                        const brd = terminado ? '#f0b4b4' : vigente ? '#a8d5b5' : C.borde;
                        const esProp = String(buf.repercutir_a ?? '').trim().toUpperCase() === 'PROPIETARIO';
                        return (
                          <div style={{ marginTop: 4, fontSize: 11, color: C.gris, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span>Estado:</span>
                            <span style={{ background: bg, color: fg, border: '1px solid ' + brd, borderRadius: 5, padding: '1px 8px', fontWeight: 700 }}>
                              {noEnc ? 'no encontrado' : est}{vigente ? ' · vigente' : terminado ? ' · terminado' : ''}
                            </span>
                            {terminado && esProp && (
                              sucesor
                                ? <span style={{ color: C.rojo, fontWeight: 600 }}>
                                    no válido para PROPIETARIO — usa{' '}
                                    <button type="button"
                                      onClick={() => setBuf((b) => ({ ...b, idadmon: sucesor }))}
                                      style={{ border: 'none', background: '#e6f4ea', color: C.verde, fontWeight: 700, borderRadius: 5, padding: '1px 8px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11 }}>
                                      {sucesor}
                                    </button>
                                  </span>
                                : <span style={{ color: C.rojo, fontWeight: 600 }}>no válido para PROPIETARIO — usa el sucesor vigente (P/S/SQ)</span>
                            )}
                          </div>
                        );
                      })()}
                      {cfg.k === 'idadmon_relacionado' && (() => {
                        const actual = String(buf.idadmon_relacionado ?? '').trim().toUpperCase();
                        if (sucesor && !actual) {
                          return (
                            <div style={{ fontSize: 11, marginTop: 4, color: C.gris }}>
                              Sugerencia:{' '}
                              <button type="button"
                                onClick={() => setBuf((b) => ({ ...b, idadmon_relacionado: sucesor }))}
                                style={{ border: 'none', background: C.azulClaro || '#dbe5f1', color: C.azul, fontWeight: 700, borderRadius: 5, padding: '1px 8px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11 }}>
                                {sucesor} — usar
                              </button>
                              <span> · siguiente del inmueble en P/S/SQ</span>
                            </div>
                          );
                        }
                        if (sucesorMult && !actual) {
                          return <div style={{ fontSize: 11, marginTop: 4, color: C.ambar }}>Hay varios contratos activos en el inmueble: escribe a mano el del nuevo ciclo.</div>;
                        }
                        if (sucesor && actual && actual === sucesor.toUpperCase()) {
                          return <div style={{ fontSize: 11, marginTop: 4, color: C.verde }}>✓ Coincide con el sucesor del inmueble.</div>;
                        }
                        return null;
                      })()}
                    </div>
                  );
                })}
              </div>
            )}

          <div style={{ marginTop: 18, paddingTop: 12, borderTop: `1px solid ${C.borde}` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.azul, textTransform: 'uppercase', letterSpacing: .4, marginBottom: 8 }}>Bitácora</div>
            <Bitacora rows={bitaRows} loading={bitaLoad} creado={row} />
          </div>
        </div>
      </div>
    </>
  );
}

// control de edición según el tipo del campo
function editorCampo(cfg, val, onChange) {
  if (cfg.tipo === 'select') {
    const opts = cfg.k === 'tipo' ? TIPOS : REPERCUTIR_A;
    return (
      <select value={val ?? ''} onChange={(e) => onChange(e.target.value)} style={inp}>
        <option value="">— elegir —</option>
        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (cfg.tipo === 'sino') {
    return (
      <select value={val ?? ''} onChange={(e) => onChange(e.target.value)} style={inp}>
        <option value="">—</option><option value="NO">NO</option><option value="SI">SI</option>
      </select>
    );
  }
  if (cfg.tipo === 'mes') {
    const opts = opcionesMes();
    const actual = String(val ?? '').trim();
    if (actual && !opts.includes(actual)) opts.unshift(actual);
    return (
      <select value={val ?? ''} onChange={(e) => onChange(e.target.value)} style={inp}>
        <option value="">— elegir —</option>
        {opts.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
    );
  }
  if (cfg.tipo === 'area') {
    return <textarea value={val ?? ''} onChange={(e) => onChange(e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} />;
  }
  if (cfg.tipo === 'numero') {
    return <input type="text" inputMode="numeric" value={val ?? ''} onChange={(e) => onChange(e.target.value)} style={inp} />;
  }
  return <input value={val ?? ''} onChange={(e) => onChange(cfg.upper ? e.target.value.toUpperCase() : e.target.value)} style={inp} />;
}

// ---------- formulario de alta ----------
// ¿el texto parece un enlace? (validación ligera, no bloqueante)
const pareceURL = (s) => /^https?:\/\//i.test(String(s || '').trim());

function FormAlta({ onCreado, inicial }) {
  const [f, setF] = useState({
    mes_a_imputar: '', idadmon: '', inmueble: '', propietario: '',
    repercutir_a: 'PROPIETARIO', tipo: '', monto_a_imputar: '', monto_a_transferir: '',
    relacionado: '', link_admon: '', factura_boleta: 'NO', idadmon_relacionado: '',
    texto_explicativo_para_carta_a_propietario: '', aclaracion: '',
    ...(inicial || {}),
  });
  const [estado, setEstado] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [sucesor, setSucesor] = useState('');            // sucesor del inmueble (P/S/SQ), o ''
  const [sucesorMult, setSucesorMult] = useState(false); // varios activos: no autocompletar
  const [cargoAbono, setCargoAbono] = useState('');      // '' | 'CARGO' | 'ABONO' (solo ARRENDATARIO)
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const esTermino = (rep) => /^T-/i.test(String(rep || '').trim());
  const esArrendatario = (rep) => String(rep || '').trim().toUpperCase() === 'ARRENDATARIO';

  // Aplica el signo del monto según cargo/abono: ABONO → negativo, CARGO → positivo
  function aplicarSigno(montoStr, ca) {
    const n = Math.abs(Number(String(montoStr).replace(/[^\d.-]/g, '')));
    if (isNaN(n) || n === 0) return montoStr;
    if (ca === 'ABONO') return String(-n);
    if (ca === 'CARGO') return String(n);
    return montoStr;
  }
  function cambiarCargoAbono(ca) {
    setCargoAbono(ca);
    if (f.monto_a_imputar) set('monto_a_imputar', aplicarSigno(f.monto_a_imputar, ca));
  }
  function cambiarMonto(v) {
    // si es ARRENDATARIO y ya eligió cargo/abono, fuerza el signo
    if (esArrendatario(f.repercutir_a) && cargoAbono) set('monto_a_imputar', aplicarSigno(v, cargoAbono));
    else set('monto_a_imputar', v);
  }

  async function buscarIdadmon() {
    const id = f.idadmon.trim();
    if (!id) return;
    try {
      const r = await fetch(`/api/descuentos/lookup-idadmon?idadmon=${encodeURIComponent(id)}`);
      const j = await r.json();
      if (j.encontrado) {
        set('inmueble', j.inmueble || ''); set('propietario', j.propietario || '');
        setEstado(j.estado || '');
        setSucesor(j.sucesor || '');
        setSucesorMult(!!j.sucesor_multiple);
        // Autocompletar idadmon_relacionado si Imputar a es un T-... y el campo está vacío
        if (esTermino(f.repercutir_a) && j.sucesor && !f.idadmon_relacionado.trim()) {
          set('idadmon_relacionado', j.sucesor);
        }
      } else { setEstado('NO ENCONTRADO'); setSucesor(''); setSucesorMult(false); }
    } catch { setEstado(''); setSucesor(''); setSucesorMult(false); }
  }

  // Al cambiar "Imputar a": si pasa a T-... y tenemos sucesor, autocompletar (si está vacío)
  function cambiarRepercutir(v) {
    set('repercutir_a', v);
    if (!esArrendatario(v)) setCargoAbono('');   // el selector cargo/abono solo aplica a ARRENDATARIO
    if (esTermino(v) && sucesor && !f.idadmon_relacionado.trim()) {
      set('idadmon_relacionado', sucesor);
    }
  }

  const textoLen = f.texto_explicativo_para_carta_a_propietario.trim().length;

  async function guardar() {
    setErr('');
    if (textoLen < 15) { setErr('El texto para liquidación debe tener al menos 15 caracteres.'); return; }
    if (esArrendatario(f.repercutir_a) && !cargoAbono) {
      setErr('Al imputar a ARRENDATARIO, indica si es CARGO (se le cobra) o ABONO (a su favor).'); return;
    }
    // CANDADO: imputar a PROPIETARIO exige IDADMON vigente (no Q/N/N-DICOM), de AGOSTO 2026 en adelante.
    if (String(f.repercutir_a || '').trim().toUpperCase() === 'PROPIETARIO' && mesDesdeAgosto2026(f.mes_a_imputar)) {
      const bloqueo = await motivoNoImputableAPropietario(f.idadmon);
      if (bloqueo) { setErr(bloqueo); return; }
    }
    // Aviso de confirmación: recuerda revisar antes de guardar (no se puede editar después)
    const falta = [];
    if (!String(f.mes_a_imputar || '').trim()) falta.push('Mes a imputar');
    if (!String(f.monto_a_imputar || '').trim()) falta.push('Monto a imputar');
    if (!String(f.tipo || '').trim()) falta.push('Tipo');
    const avisoTransf = !String(f.monto_a_transferir || '').trim()
      ? '\n\n• "Monto a transferir" está VACÍO. Si este descuento implica una transferencia, complételo.' : '';
    // ARRENDATARIO: se cargará automáticamente en cartola. Confirmar signo (cargo/abono).
    const esArr = esArrendatario(f.repercutir_a);
    const montoNum = Math.round(Number(f.monto_a_imputar) || 0);
    const avisoCartola = esArr
      ? `\n\n• Este descuento se cargará DIRECTAMENTE en la CARTOLA del arrendatario como ${montoNum >= 0 ? 'CARGO (se le cobra)' : 'ABONO (a su favor)'} de ${Math.abs(montoNum).toLocaleString('es-CL')}. Confirma que el signo es correcto.`
      : '';
    const mensaje =
      'Antes de guardar, revise que están todos los datos.' +
      avisoTransf + avisoCartola +
      '\n\nUna vez guardado, el descuento NO se podrá modificar.' +
      '\n\n¿Guardar el descuento?';
    if (!window.confirm(mensaje)) return;   // cancela → sigue editando
    setSaving(true);
    try {
      const r = await fetch('/api/descuentos/crear', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Error al crear');
      // Informar del resultado de la carga automática a cartola (si aplica)
      if (esArr && j.cartola) {
        if (j.cartola.ok) {
          window.alert(`Descuento creado y cargado en la cartola del arrendatario (${j.cartola.tipo} de ${Number(j.cartola.monto).toLocaleString('es-CL')}).`);
        } else {
          window.alert(`El descuento se creó, pero NO se pudo cargar en cartola automáticamente (${j.cartola.error || 'error'}). Queda pendiente: podrás cargarlo desde su ficha con el botón "Pasar a Cartolas".`);
        }
      }
      onCreado();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ background: '#fff', border: `1px solid ${C.borde}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
      <h3 style={{ marginTop: 0, color: C.azul }}>Añadir descuento</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <Campo label="IDADMON *">
          <input value={f.idadmon} onChange={(e) => set('idadmon', e.target.value.toUpperCase())}
            onBlur={buscarIdadmon} placeholder="A00855" style={inp} />
          {estado && <div style={{ fontSize: 11, color: estado === 'NO ENCONTRADO' ? C.rojo : C.gris }}>Estado: {estado}</div>}
        </Campo>
        <Campo label="Propietario"><input value={f.propietario} onChange={(e) => set('propietario', e.target.value)} style={inp} /></Campo>
        <Campo label="Inmueble"><input value={f.inmueble} onChange={(e) => set('inmueble', e.target.value)} style={inp} /></Campo>

        <Campo label="Mes a imputar *">
          <select value={f.mes_a_imputar} onChange={(e) => set('mes_a_imputar', e.target.value)} style={inp}>
            <option value="">— elegir —</option>
            {opcionesMes().map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </Campo>
        <Campo label="Imputar a *">
          <select value={f.repercutir_a} onChange={(e) => cambiarRepercutir(e.target.value)} style={inp}>
            {REPERCUTIR_A.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Campo>
        <Campo label="Tipo *">
          <select value={f.tipo} onChange={(e) => set('tipo', e.target.value)} style={inp}>
            <option value="">— elegir —</option>
            {TIPOS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Campo>

        <Campo label="Monto a imputar *">
          <input type="text" inputMode="numeric" value={f.monto_a_imputar} onChange={(e) => cambiarMonto(e.target.value)} style={inp} />
          {esArrendatario(f.repercutir_a) && (
            <div style={{ marginTop: 5, display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: C.gris }}>Arrendatario:</span>
              <button type="button" onClick={() => cambiarCargoAbono('CARGO')}
                style={{ ...chip, ...(cargoAbono === 'CARGO' ? chipOn(C.rojo) : {}) }}>Cargo (le cobras +)</button>
              <button type="button" onClick={() => cambiarCargoAbono('ABONO')}
                style={{ ...chip, ...(cargoAbono === 'ABONO' ? chipOn(C.verde) : {}) }}>Abono (a su favor −)</button>
            </div>
          )}
          {esArrendatario(f.repercutir_a) && !cargoAbono &&
            <div style={{ fontSize: 11, color: C.ambar, marginTop: 3 }}>Elige CARGO o ABONO: fija el signo del monto.</div>}
        </Campo>
        <Campo label="Monto a transferir"><input type="text" inputMode="numeric" value={f.monto_a_transferir} onChange={(e) => set('monto_a_transferir', e.target.value)} style={inp} /></Campo>
        <Campo label="¿Necesita factura/boleta?">
          <select value={f.factura_boleta} onChange={(e) => set('factura_boleta', e.target.value)} style={inp}>
            <option value="NO">NO</option><option value="SI">SI</option>
          </select>
        </Campo>

        <Campo label="Enlace justificante">
          <input value={f.relacionado} onChange={(e) => set('relacionado', e.target.value)}
            placeholder="https://drive.google.com/…  (comprobante)" style={inp} />
          {f.relacionado.trim() !== '' && !pareceURL(f.relacionado)
            ? <div style={{ fontSize: 11, color: C.ambar }}>¿Seguro que es un enlace? Suele empezar por http…</div>
            : <div style={{ fontSize: 11, color: C.gris }}>Pega el enlace de Drive del comprobante (boleta/factura/recibo). En Drive: clic derecho → Compartir → Copiar vínculo.</div>}
        </Campo>
        <Campo label="Enlace Admon (link)">
          <input value={f.link_admon} onChange={(e) => set('link_admon', e.target.value)}
            placeholder="https://…  (opcional)" style={inp} />
          {f.link_admon.trim() !== '' && !pareceURL(f.link_admon) &&
            <div style={{ fontSize: 11, color: C.ambar }}>¿Seguro que es un enlace? Suele empezar por http…</div>}
        </Campo>
        <Campo label="IDADMON relacionado (términos)">
          <input value={f.idadmon_relacionado} onChange={(e) => set('idadmon_relacionado', e.target.value.toUpperCase())} placeholder="A00654" style={inp} />
          {esTermino(f.repercutir_a) && f.idadmon_relacionado.trim() && sucesor && f.idadmon_relacionado.trim().toUpperCase() === sucesor.toUpperCase()
            ? <div style={{ fontSize: 11, color: C.gris }}>✓ Sucesor del inmueble (autocompletado). Editable.</div>
            : esTermino(f.repercutir_a) && sucesorMult
              ? <div style={{ fontSize: 11, color: C.ambar }}>Hay varios contratos activos en este inmueble: elige a mano el IDADMON del nuevo ciclo.</div>
              : esTermino(f.repercutir_a) && !sucesor && f.idadmon.trim()
                ? <div style={{ fontSize: 11, color: C.ambar }}>No se encontró un sucesor activo (P/S/SQ) para este inmueble.</div>
                : <div style={{ fontSize: 11, color: C.gris }}>En términos (T-…): IDADMON del nuevo ciclo del inmueble. Se autocompleta al buscar el IDADMON.</div>}
        </Campo>
      </div>

      <div style={{ marginTop: 12 }}>
        <Campo label={`Texto para liquidación * (mín. 15 — ${textoLen})`}>
          <textarea value={f.texto_explicativo_para_carta_a_propietario}
            onChange={(e) => set('texto_explicativo_para_carta_a_propietario', e.target.value)}
            rows={2} style={{ ...inp, resize: 'vertical' }} />
        </Campo>
      </div>
      <div style={{ marginTop: 12 }}>
        <Campo label="Aclaración">
          <textarea value={f.aclaracion} onChange={(e) => set('aclaracion', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} />
        </Campo>
      </div>

      {err && <div style={{ color: C.rojo, marginTop: 10 }}>{err}</div>}
      <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
        <button disabled={saving} onClick={guardar} style={btn(C.verde)}>{saving ? 'Guardando…' : 'Guardar descuento'}</button>
      </div>
    </div>
  );
}

// ---------- mini componentes / estilos ----------
function Campo({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#333' }}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  );
}
function SelectMini({ value, opts, onChange }) {
  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value)} style={{ fontSize: 12, padding: '2px 4px' }}>
      <option value="">—</option>
      {opts.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
const inp = { padding: '6px 8px', border: '1px solid #c9d3e0', borderRadius: 4, fontSize: 13, width: '100%', boxSizing: 'border-box' };
const chip = { fontSize: 11, padding: '3px 8px', border: '1px solid #c9d3e0', borderRadius: 12, background: '#fff', color: '#555', cursor: 'pointer' };
function chipOn(bg) { return { background: bg, color: '#fff', borderColor: bg, fontWeight: 700 }; }
const linkMini = { color: '#1f4e79', cursor: 'pointer', fontSize: 11, marginLeft: 4, textDecoration: 'underline' };
function btn(bg) { return { background: bg, color: '#fff', border: 'none', borderRadius: 5, padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }; }
function btnMini(bg) { return { background: bg, color: '#fff', border: 'none', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', fontSize: 11 }; }
function th() { return { position: 'sticky', top: 0, zIndex: 10, background: '#1f4e79', color: '#fff', padding: '5px 6px', textAlign: 'left', whiteSpace: 'nowrap', border: '1px solid #173a5c', fontSize: 11.5 }; }
function td() { return { padding: '3px 6px', borderBottom: '1px solid #eef1f5', borderRight: '1px solid #f3f5f8', verticalAlign: 'middle', overflow: 'hidden', fontSize: 11.5 }; }
const thMini = { background: '#f0e6c8', padding: '3px 6px', textAlign: 'left', border: '1px solid #e0d4a8', fontSize: 11 };
const tdMini = { padding: '3px 6px', borderBottom: '1px solid #f0ead8', fontSize: 11 };