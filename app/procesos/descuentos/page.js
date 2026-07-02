'use client';

import { useEffect, useMemo, useState, useRef, forwardRef } from 'react';
import { TIPOS, REPERCUTIR_A } from '@/lib/descuentosPermisos';

// ------- columnas de la tabla (orden, etiqueta, ancho px, alineación, truncado) -------
// w = ancho fijo en px (table-layout: fixed). trunc = recorta con ellipsis + hover.
const COLS = [
  { key: 'num', label: 'Núm', w: 42, align: 'right' },
  { key: 'fecha', label: 'Fecha', w: 66 },
  { key: 'mes_a_imputar', label: 'Mes imp.', w: 82 },
  { key: 'ingresado_por', label: 'Ingresó', w: 72, trunc: true },
  { key: 'idadmon', label: 'IDADMON', w: 62 },
  { key: 'inmueble', label: 'Inmueble', w: 140, trunc: true },
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
const TOPE_DEFECTO = 30;

const C = {
  azul: '#1f4e79', azulClaro: '#dbe5f1', borde: '#c9d3e0',
  verde: '#2e7d32', rojo: '#c62828', ambar: '#b8860b', gris: '#6b7280',
  fondo: '#f4f7fb',
};

export default function DescuentosPage() {
  const [caps, setCaps] = useState({ crear: false, corregir: false, verificar: false });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
  // rows viene con el NUM más alto/reciente AL FINAL. Por defecto mostramos los
  // 30 del final (los más recientes). Con filtro activo o "ver todos", todas.
  const visibles = useMemo(() => {
    if (verTodos || hayFiltroActivo) return filtradas;
    return filtradas.slice(-TOPE_DEFECTO);
  }, [filtradas, verTodos, hayFiltroActivo]);

  // En la vista por defecto (sin filtro, sin "ver todos"), dejar el scroll al
  // fondo para que el último subido quede a la vista sin mover nada.
  useEffect(() => {
    if (loading) return;
    if (verTodos || hayFiltroActivo) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [visibles, loading, verTodos, hayFiltroActivo]);

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

  // -------------------- FICHA (drawer) --------------------
  const [descSel, setDescSel] = useState(null);   // fila abierta en el drawer
  const [hoverId, setHoverId] = useState(null);   // fila resaltada bajo el ratón

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
    <div style={{ padding: 20, background: C.fondo, minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h1 style={{ color: C.azul, margin: 0, fontSize: 24 }}>Descuentos</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {caps.crear && (
            <button onClick={() => setShowForm((v) => !v)} style={btn(C.verde)}>
              {showForm ? 'Cerrar formulario' : '+ Añadir descuento'}
            </button>
          )}
          <button onClick={cargar} style={btn(C.gris)}>↻ Recargar</button>
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
      </div>

      {error && <div style={{ color: C.rojo, marginBottom: 10 }}>{error}</div>}

      {showForm && caps.crear && (
        <FormAlta onCreado={() => { setShowForm(false); cargar(); }} />
      )}

      {loading ? (
        <div style={{ color: C.gris }}>Cargando…</div>
      ) : (
        <div ref={scrollRef} style={{ maxHeight: '62vh', overflow: 'auto', border: `1px solid ${C.borde}`, borderRadius: 6, background: '#fff' }}>
          <table style={{ borderCollapse: 'collapse', width: TABLE_W, tableLayout: 'fixed', fontSize: 12 }}>
            <colgroup>
              {COLS.map((c) => <col key={c.key} style={{ width: c.w }} />)}
            </colgroup>
            <thead>
              <tr>
                {COLS.map((c) => (
                  <th key={c.key} style={{ ...th(), textAlign: c.align || 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'space-between' }}>
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.label}</span>
                      <button
                        onClick={() => { setMenuCol(menuCol === c.key ? null : c.key); setBusca(''); }}
                        title="Filtrar"
                        style={{
                          border: 'none', cursor: 'pointer', borderRadius: 3, padding: '1px 4px', flexShrink: 0,
                          background: colFiltrada(c.key) ? C.ambar : 'rgba(255,255,255,.25)',
                          color: '#fff', fontSize: 11,
                        }}
                      >▼</button>
                    </div>
                    {menuCol === c.key && (
                      <FiltroMenu
                        ref={menuRef}
                        col={c.key}
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
              {visibles.map((r) => (
                <tr key={r.id}
                  onMouseEnter={() => setHoverId(r.id)}
                  onMouseLeave={() => setHoverId((h) => (h === r.id ? null : h))}
                  title="Pincha para ver / editar la ficha"
                  style={{
                    background: hoverId === r.id ? '#dbe9fb' : (r.verificado ? '#f1f8f1' : '#fff'),
                    cursor: 'pointer',
                    boxShadow: hoverId === r.id ? 'inset 3px 0 0 ' + C.azul : 'none',
                  }}>
                  {COLS.map((c) => (
                    <td key={c.key}
                      onClick={() => setDescSel(r)}
                      style={{ ...td(), textAlign: c.align || 'left', cursor: 'pointer' }}>
                      {renderCelda(r, c.key, { caps, toggleVerificado, col: c })}
                    </td>
                  ))}
                </tr>
              ))}
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
        />
      )}
    </div>
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
  { valores, seleccion, busca, setBusca, onToggle, onSolo, onTodos, onCerrar }, ref) {
  const sel = seleccion && seleccion.size > 0 ? seleccion : new Set(valores); // sin filtro = todos
  const visibles = valores.filter((v) => v.toLowerCase().includes(busca.toLowerCase()));
  return (
    <div ref={ref} style={{
      position: 'absolute', zIndex: 50, top: '100%', right: 0, marginTop: 4,
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
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
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
function FichaDescuento({ descuento, caps, onClose, onGuardado }) {
  const [row, setRow] = useState(descuento);
  const [modo, setModo] = useState('ver');
  const [buf, setBuf] = useState({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [bitaRows, setBitaRows] = useState([]);
  const [bitaLoad, setBitaLoad] = useState(true);

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
  }

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
    if (txt !== '' && txt.length < 45) {
      setErr('El texto para liquidación debe tener al menos 45 caracteres.'); return;
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
                      return (
                        <div key={k} style={{ gridColumn: largo ? '1 / -1' : 'auto', minWidth: 0 }}>
                          <div style={{ fontSize: 11, color: C.gris }}>{LABELS[k] || k}</div>
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

function FormAlta({ onCreado }) {
  const [f, setF] = useState({
    mes_a_imputar: '', idadmon: '', inmueble: '', propietario: '',
    repercutir_a: 'PROPIETARIO', tipo: '', monto_a_imputar: '', monto_a_transferir: '',
    relacionado: '', link_admon: '', factura_boleta: 'NO', idadmon_relacionado: '',
    texto_explicativo_para_carta_a_propietario: '', aclaracion: '',
  });
  const [estado, setEstado] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  async function buscarIdadmon() {
    const id = f.idadmon.trim();
    if (!id) return;
    try {
      const r = await fetch(`/api/descuentos/lookup-idadmon?idadmon=${encodeURIComponent(id)}`);
      const j = await r.json();
      if (j.encontrado) {
        set('inmueble', j.inmueble || ''); set('propietario', j.propietario || '');
        setEstado(j.estado || '');
      } else { setEstado('NO ENCONTRADO'); }
    } catch { setEstado(''); }
  }

  const textoLen = f.texto_explicativo_para_carta_a_propietario.trim().length;

  async function guardar() {
    setErr('');
    if (textoLen < 45) { setErr('El texto para liquidación debe tener al menos 45 caracteres.'); return; }
    setSaving(true);
    try {
      const r = await fetch('/api/descuentos/crear', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Error al crear');
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
          <select value={f.repercutir_a} onChange={(e) => set('repercutir_a', e.target.value)} style={inp}>
            {REPERCUTIR_A.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Campo>
        <Campo label="Tipo *">
          <select value={f.tipo} onChange={(e) => set('tipo', e.target.value)} style={inp}>
            <option value="">— elegir —</option>
            {TIPOS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Campo>

        <Campo label="Monto a imputar *"><input type="text" inputMode="numeric" value={f.monto_a_imputar} onChange={(e) => set('monto_a_imputar', e.target.value)} style={inp} /></Campo>
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
        <Campo label="IDADMON relacionado (términos)"><input value={f.idadmon_relacionado} onChange={(e) => set('idadmon_relacionado', e.target.value.toUpperCase())} placeholder="A00654" style={inp} /></Campo>
      </div>

      <div style={{ marginTop: 12 }}>
        <Campo label={`Texto para liquidación * (mín. 45 — ${textoLen})`}>
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
const linkMini = { color: '#1f4e79', cursor: 'pointer', fontSize: 11, marginLeft: 4, textDecoration: 'underline' };
function btn(bg) { return { background: bg, color: '#fff', border: 'none', borderRadius: 5, padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }; }
function btnMini(bg) { return { background: bg, color: '#fff', border: 'none', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', fontSize: 11 }; }
function th() { return { position: 'sticky', top: 0, zIndex: 10, background: '#1f4e79', color: '#fff', padding: '5px 6px', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', border: '1px solid #173a5c', fontSize: 11.5 }; }
function td() { return { padding: '3px 6px', borderBottom: '1px solid #eef1f5', borderRight: '1px solid #f3f5f8', verticalAlign: 'middle', overflow: 'hidden', fontSize: 11.5 }; }
const thMini = { background: '#f0e6c8', padding: '3px 6px', textAlign: 'left', border: '1px solid #e0d4a8', fontSize: 11 };
const tdMini = { padding: '3px 6px', borderBottom: '1px solid #f0ead8', fontSize: 11 };