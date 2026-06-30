'use client';

import { useEffect, useMemo, useState, useRef, forwardRef } from 'react';
import { TIPOS, REPERCUTIR_A } from '@/lib/descuentosPermisos';

// ------- columnas de la tabla (orden y etiqueta) -------
const COLS = [
  { key: 'num', label: 'Núm' },
  { key: 'fecha', label: 'Fecha' },
  { key: 'mes_a_imputar', label: 'Mes a imputar' },
  { key: 'ingresado_por', label: 'Ingresado por' },
  { key: 'idadmon', label: 'IDADMON' },
  { key: 'inmueble', label: 'Inmueble' },
  { key: 'propietario', label: 'Propietario' },
  { key: 'repercutir_a', label: 'Imputar a' },
  { key: 'idadmon_relacionado', label: 'IDADMON rel.' },
  { key: 'monto_a_imputar', label: 'Monto imputar' },
  { key: 'monto_a_transferir', label: 'Monto transferir' },
  { key: 'tipo', label: 'Tipo' },
  { key: 'texto_explicativo_para_carta_a_propietario', label: 'Texto liquidación' },
  { key: 'comentarios_karina', label: 'Comentarios Karina' },
  { key: 'verificado', label: 'Verificado' },
];

// campos que el corrector puede editar inline
const EDITABLES = new Set([
  'mes_a_imputar', 'idadmon', 'inmueble', 'propietario', 'repercutir_a',
  'idadmon_relacionado', 'monto_a_imputar', 'monto_a_transferir', 'tipo',
  'texto_explicativo_para_carta_a_propietario', 'comentarios_karina',
]);

const money = (n) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.round(v).toLocaleString('es-CL') : (n ?? '');
};

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
  const menuRef = useRef(null);

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

  // -------------------- CORRECCIÓN INLINE --------------------
  const [editId, setEditId] = useState(null);
  const [editBuf, setEditBuf] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);

  function empezarEdicion(r) {
    setEditId(r.id);
    const buf = {};
    EDITABLES.forEach((k) => { buf[k] = r[k] ?? ''; });
    setEditBuf(buf);
  }
  async function guardarEdicion(r) {
    setSavingEdit(true);
    try {
      const cambios = {};
      EDITABLES.forEach((k) => {
        const nuevo = editBuf[k] ?? '';
        const viejo = r[k] ?? '';
        if (String(nuevo) !== String(viejo)) cambios[k] = nuevo === '' ? null : nuevo;
      });
      if (Object.keys(cambios).length === 0) { setEditId(null); return; }
      const res = await fetch('/api/descuentos/corregir', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: r.id, cambios }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Error al corregir');
      setEditId(null);
      await cargar();
    } catch (e) { alert(e.message); }
    finally { setSavingEdit(false); }
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

  // -------------------- BITÁCORA --------------------
  const [bitaId, setBitaId] = useState(null);
  const [bitaRows, setBitaRows] = useState([]);
  const [bitaLoad, setBitaLoad] = useState(false);
  async function verBitacora(r) {
    if (bitaId === r.id) { setBitaId(null); return; }
    setBitaId(r.id); setBitaLoad(true); setBitaRows([]);
    try {
      const res = await fetch(`/api/descuentos/bitacora?descuento_id=${r.id}`, { cache: 'no-store' });
      const j = await res.json();
      setBitaRows(j.rows || []);
    } catch { setBitaRows([]); }
    finally { setBitaLoad(false); }
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
      </div>

      {error && <div style={{ color: C.rojo, marginBottom: 10 }}>{error}</div>}

      {showForm && caps.crear && (
        <FormAlta onCreado={() => { setShowForm(false); cargar(); }} />
      )}

      {loading ? (
        <div style={{ color: C.gris }}>Cargando…</div>
      ) : (
        <div style={{ overflowX: 'auto', border: `1px solid ${C.borde}`, borderRadius: 6, background: '#fff' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
            <thead>
              <tr>
                {COLS.map((c) => (
                  <th key={c.key} style={th()}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'space-between' }}>
                      <span>{c.label}</span>
                      <button
                        onClick={() => { setMenuCol(menuCol === c.key ? null : c.key); setBusca(''); }}
                        title="Filtrar"
                        style={{
                          border: 'none', cursor: 'pointer', borderRadius: 3, padding: '1px 4px',
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
                <th style={th()}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((r) => {
                const enEd = editId === r.id;
                return (
                  <>
                    <tr key={r.id} style={{ background: r.verificado ? '#f1f8f1' : '#fff' }}>
                      {COLS.map((c) => (
                        <td key={c.key} style={td()}>
                          {renderCelda(r, c.key, { enEd, editBuf, setEditBuf, caps, toggleVerificado })}
                        </td>
                      ))}
                      <td style={td()}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {caps.corregir && !enEd && (
                            <button onClick={() => empezarEdicion(r)} style={btnMini(C.azul)}>Corregir</button>
                          )}
                          {enEd && (
                            <>
                              <button disabled={savingEdit} onClick={() => guardarEdicion(r)} style={btnMini(C.verde)}>
                                {savingEdit ? '…' : 'Guardar'}
                              </button>
                              <button onClick={() => setEditId(null)} style={btnMini(C.gris)}>Cancelar</button>
                            </>
                          )}
                          <button onClick={() => verBitacora(r)} style={btnMini(C.ambar)}>
                            {bitaId === r.id ? 'Ocultar' : 'Bitácora'}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {bitaId === r.id && (
                      <tr>
                        <td colSpan={COLS.length + 1} style={{ ...td(), background: '#fffdf5' }}>
                          <Bitacora rows={bitaRows} loading={bitaLoad} creado={r} />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
              {filtradas.length === 0 && (
                <tr><td colSpan={COLS.length + 1} style={{ ...td(), textAlign: 'center', color: C.gris, padding: 20 }}>
                  No hay registros con los filtros actuales.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 8, fontSize: 12, color: C.gris }}>
        {filtradas.length} de {rows.length} registros
      </div>
    </div>
  );
}

// ---------- celda (lectura o edición inline) ----------
function renderCelda(r, key, ctx) {
  const { enEd, editBuf, setEditBuf, caps, toggleVerificado } = ctx;

  if (key === 'verificado') {
    return r.verificado
      ? <span style={{ color: '#2e7d32', fontWeight: 600 }} title={`${r.verificado_por || ''} ${r.verificado_at ? new Date(r.verificado_at).toLocaleDateString('es-CL') : ''}`}>
          ✓ {caps.verificar && <a onClick={() => toggleVerificado(r)} style={linkMini}>quitar</a>}
        </span>
      : (caps.verificar
          ? <button onClick={() => toggleVerificado(r)} style={btnMini('#2e7d32')}>Verificar</button>
          : <span style={{ color: '#999' }}>—</span>);
  }

  if (enEd && EDITABLES.has(key)) {
    if (key === 'tipo') return <SelectMini value={editBuf.tipo} opts={TIPOS} onChange={(v) => setEditBuf((b) => ({ ...b, tipo: v }))} />;
    if (key === 'repercutir_a') return <SelectMini value={editBuf.repercutir_a} opts={REPERCUTIR_A} onChange={(v) => setEditBuf((b) => ({ ...b, repercutir_a: v }))} />;
    return (
      <input
        value={editBuf[key] ?? ''}
        onChange={(e) => setEditBuf((b) => ({ ...b, [key]: e.target.value }))}
        style={{ width: key.includes('texto') ? 220 : 90, fontSize: 12, padding: '2px 4px' }}
      />
    );
  }

  let v = r[key];
  if (key === 'monto_a_imputar' || key === 'monto_a_transferir') v = money(v);
  if (key === 'texto_explicativo_para_carta_a_propietario' || key === 'inmueble' || key === 'comentarios_karina') {
    return <span title={r[key] || ''} style={{ display: 'inline-block', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v || ''}</span>;
  }
  return <span>{v ?? ''}</span>;
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

// ---------- formulario de alta ----------
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

        <Campo label="Mes a imputar *"><input value={f.mes_a_imputar} onChange={(e) => set('mes_a_imputar', e.target.value.toUpperCase())} placeholder="JULIO 2026" style={inp} /></Campo>
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

        <Campo label="Monto a imputar *"><input type="number" value={f.monto_a_imputar} onChange={(e) => set('monto_a_imputar', e.target.value)} style={inp} /></Campo>
        <Campo label="Monto a transferir"><input type="number" value={f.monto_a_transferir} onChange={(e) => set('monto_a_transferir', e.target.value)} style={inp} /></Campo>
        <Campo label="¿Necesita factura/boleta?">
          <select value={f.factura_boleta} onChange={(e) => set('factura_boleta', e.target.value)} style={inp}>
            <option value="NO">NO</option><option value="SI">SI</option>
          </select>
        </Campo>

        <Campo label="Enlace justificante"><input value={f.relacionado} onChange={(e) => set('relacionado', e.target.value)} style={inp} /></Campo>
        <Campo label="Enlace Admon (link)"><input value={f.link_admon} onChange={(e) => set('link_admon', e.target.value)} style={inp} /></Campo>
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
function th() { return { position: 'relative', background: '#1f4e79', color: '#fff', padding: '6px 8px', textAlign: 'left', whiteSpace: 'nowrap', border: '1px solid #173a5c', fontSize: 12 }; }
function td() { return { padding: '4px 8px', borderBottom: '1px solid #eef1f5', borderRight: '1px solid #f3f5f8', verticalAlign: 'top' }; }
const thMini = { background: '#f0e6c8', padding: '3px 6px', textAlign: 'left', border: '1px solid #e0d4a8', fontSize: 11 };
const tdMini = { padding: '3px 6px', borderBottom: '1px solid #f0ead8', fontSize: 11 };
