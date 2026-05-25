'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import TopNav from '../../components/ui/TopNav';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const fmt = (n) => n == null ? '—' : Math.round(Number(n)).toLocaleString('es-CL');
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-CL') : '—';

function diasDesde(fechaStr) {
  if (!fechaStr) return null;
  try {
    const partes = fechaStr.split('/');
    if (partes.length === 3) {
      const f = new Date(`${partes[2]}-${partes[1]}-${partes[0]}`);
      return Math.floor((new Date() - f) / (1000 * 60 * 60 * 24));
    }
    return null;
  } catch { return null; }
}

const ESTADO_BADGE = {
  S:  { bg: '#EAF3DE', color: '#3B6D11' },
  Q:  { bg: '#FAEEDA', color: '#854F0B' },
  SQ: { bg: '#FAEEDA', color: '#854F0B' },
  P:  { bg: '#F1EFE8', color: '#5F5E5A' },
  N:  { bg: '#F1EFE8', color: '#999'    },
  O:  { bg: '#EBF3FB', color: '#185FA5' },
};

function EstadoBadge({ estado }) {
  const e = ESTADO_BADGE[estado] || { bg: '#F1EFE8', color: '#aaa' };
  return (
    <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 700, background: e.bg, color: e.color }}>
      {estado || '—'}
    </span>
  );
}

const emptyF = { selected: [], sort: null, min: '', max: '' };

// ─── ExcelFilter (idéntico al de Deudas) ─────────────────────────────────────
function ExcelFilter({ label, type, options, value, onApply, align = 'left' }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(value.selected || []);
  const [sortDir, setSortDir] = useState(value.sort || null);
  const [minVal, setMinVal] = useState(value.min ?? '');
  const [maxVal, setMaxVal] = useState(value.max ?? '');
  const ref = useRef(null);

  useEffect(() => {
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const activo = (value.selected?.length > 0) || value.sort || value.min !== '' || value.max !== '';
  const filteredOpts = options.filter(o => String(o ?? '').toLowerCase().includes(search.toLowerCase()));

  function toggleAll() {
    setSelected(selected.length === options.length ? [] : [...options]);
  }
  function toggle(opt) {
    setSelected(s => s.includes(opt) ? s.filter(x => x !== opt) : [...s, opt]);
  }
  function apply() {
    onApply({ selected, sort: sortDir, min: minVal, max: maxVal });
    setOpen(false);
  }
  function clear() {
    setSelected([]); setSortDir(null); setMinVal(''); setMaxVal('');
    onApply({ selected: [], sort: null, min: '', max: '' });
    setOpen(false);
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      <button onClick={() => setOpen(v => !v)} style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 500,
        color: activo ? '#1D4ED8' : '#6B7280',
      }}>
        {label}
        <span style={{ fontSize: 10, color: activo ? '#1D4ED8' : '#9CA3AF' }}>
          {value.sort === 'asc' ? ' ↑' : value.sort === 'desc' ? ' ↓' : ' ⬇'}
        </span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', [align === 'right' ? 'right' : 'left']: 0, marginTop: 4,
          background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 220, zIndex: 300,
        }}>
          {/* Ordenar */}
          <div style={{ padding: '8px 12px', borderBottom: '0.5px solid #F3F4F6' }}>
            <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 500, marginBottom: 6, textTransform: 'uppercase' }}>Ordenar</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[['asc', type === 'number' ? 'Menor → Mayor' : 'A → Z'], ['desc', type === 'number' ? 'Mayor → Menor' : 'Z → A']].map(([dir, lbl]) => (
                <button key={dir} onClick={() => setSortDir(d => d === dir ? null : dir)} style={{
                  flex: 1, padding: '4px 8px', borderRadius: 6, border: '1px solid',
                  fontSize: 11, cursor: 'pointer',
                  background: sortDir === dir ? '#EFF6FF' : '#F9FAFB',
                  borderColor: sortDir === dir ? '#BFDBFE' : '#E5E7EB',
                  color: sortDir === dir ? '#1D4ED8' : '#374151',
                }}>{lbl}</button>
              ))}
            </div>
          </div>

          {/* Filtro numérico */}
          {type === 'number' && (
            <div style={{ padding: '8px 12px', borderBottom: '0.5px solid #F3F4F6' }}>
              <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 500, marginBottom: 6, textTransform: 'uppercase' }}>Rango</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input placeholder="Mín" value={minVal} onChange={e => setMinVal(e.target.value)} type="number"
                  style={{ flex: 1, padding: '4px 8px', borderRadius: 6, border: '1px solid #E5E7EB', fontSize: 12 }} />
                <span style={{ color: '#9CA3AF', fontSize: 12 }}>—</span>
                <input placeholder="Máx" value={maxVal} onChange={e => setMaxVal(e.target.value)} type="number"
                  style={{ flex: 1, padding: '4px 8px', borderRadius: 6, border: '1px solid #E5E7EB', fontSize: 12 }} />
              </div>
            </div>
          )}

          {/* Buscar */}
          <div style={{ padding: '8px 12px', borderBottom: '0.5px solid #F3F4F6' }}>
            <input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '4px 8px', borderRadius: 6, border: '1px solid #E5E7EB', fontSize: 12, boxSizing: 'border-box' }} />
          </div>

          {/* Lista */}
          <div style={{ maxHeight: 180, overflowY: 'auto', padding: '4px' }}>
            <div onClick={toggleAll} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
              onMouseEnter={e => e.currentTarget.style.background = '#F3F4F6'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <input type="checkbox" readOnly checked={selected.length === options.length} style={{ margin: 0 }} />
              <span style={{ fontWeight: 500 }}>Seleccionar todo</span>
            </div>
            {filteredOpts.map(opt => (
              <div key={String(opt)} onClick={() => toggle(opt)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
                onMouseEnter={e => e.currentTarget.style.background = '#F3F4F6'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <input type="checkbox" readOnly checked={selected.includes(opt)} style={{ margin: 0 }} />
                <span>{opt === null || opt === '' ? '(vacío)' : String(opt)}</span>
              </div>
            ))}
          </div>

          {/* Botones */}
          <div style={{ padding: '8px 12px', borderTop: '0.5px solid #F3F4F6', display: 'flex', gap: 6 }}>
            <button onClick={clear} style={{ flex: 1, padding: '5px', borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', fontSize: 12, cursor: 'pointer', color: '#6B7280' }}>
              Limpiar
            </button>
            <button onClick={apply} style={{ flex: 1, padding: '5px', borderRadius: 6, border: 'none', background: '#1D4ED8', fontSize: 12, cursor: 'pointer', color: '#fff', fontWeight: 500 }}>
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Drawer ───────────────────────────────────────────────────────────────────
function Drawer({ moroso, onClose, onMultaAplicada }) {
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().split('T')[0]);
  const [porcentaje, setPorcentaje] = useState(1.0);
  const [notas, setNotas] = useState('');
  const [historial, setHistorial] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [exito, setExito] = useState(false);

  const dias = Math.max(0, Math.floor((new Date() - new Date(fechaInicio)) / (1000 * 60 * 60 * 24)));
  const montoMulta = Math.round(moroso.deuda * (porcentaje / 100) * dias);

  useEffect(() => {
    if (!moroso) return;
    supabase.from('cuentas').select('fecha, concepto, cargo, abono, calif')
      .eq('idadmon', moroso.idadmon).order('id', { ascending: true }).limit(50)
      .then(({ data }) => {
      let saldo = 0;
      const conSaldo = (data || []).map(row => {
        saldo = saldo + Number(row.cargo || 0) - Number(row.abono || 0);
        return { ...row, saldo_calc: saldo };
      });
      setCargos(conSaldo);
    });
    supabase.from('morosidad_multas').select('*')
      .eq('idadmon', moroso.idadmon).order('created_at', { ascending: false })
      .then(({ data }) => setHistorial(data || []));
  }, [moroso]);

  async function aplicarMulta() {
    if (montoMulta <= 0) return;
    setGuardando(true);
    const hoy = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const { error } = await supabase.from('morosidad_multas').insert({
      idadmon: moroso.idadmon, arrendatario: moroso.arrendatario,
      inmueble: moroso.inmueble, propietario: moroso.propietario,
      deuda_base: moroso.deuda, fecha_inicio: fechaInicio,
      porcentaje, dias, monto_multa: montoMulta, estado: 'aplicada', notas,
    });
    if (!error) {
      await supabase.from('cuentas').insert({
        idadmon: moroso.idadmon, fecha: hoy, concepto: 'MULTA MORA',
        cargo: montoMulta, estado: 'N', propietario: moroso.propietario, inmueble: moroso.inmueble,
      });
      setExito(true);
      setTimeout(() => { setExito(false); onMultaAplicada(); }, 1800);
    }
    setGuardando(false);
  }

  const s = {
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 300, display: 'flex', justifyContent: 'flex-end' },
    panel: { width: 500, background: '#fff', height: '100vh', overflowY: 'auto', boxShadow: '-4px 0 32px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', fontFamily: '"DM Sans","Segoe UI",sans-serif' },
    section: { padding: '16px 24px', borderBottom: '1px solid #F5F3EF' },
    lbl: { fontSize: 10, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 },
    inp: { width: '100%', padding: '8px 10px', border: '1px solid #E0DDD8', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' },
  };

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.panel}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #F0EEE8', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: '#FAFAF8' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e' }}>{moroso.idadmon}</span>
              <EstadoBadge estado={moroso.estado} />
              <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 3, background: '#FAECE7', color: '#E8593C', fontWeight: 700 }}>MOROSO</span>
            </div>
            <div style={{ fontSize: 13, color: '#555', marginTop: 3 }}>{moroso.arrendatario || '—'}</div>
            <div style={{ fontSize: 11, color: '#999', marginTop: 1 }}>{moroso.propietario || '—'} · {moroso.inmueble || '—'}</div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 22, cursor: 'pointer', color: '#bbb' }}>×</button>
        </div>

        <div style={{ ...s.section, background: '#FDF1EE' }}>
          <div style={s.lbl}>Deuda acumulada</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#E8593C' }}>${fmt(moroso.deuda)}</div>
          {moroso.dias_mora != null && <div style={{ fontSize: 12, color: '#993C1D', marginTop: 4 }}>Último movimiento hace {moroso.dias_mora} días</div>}
        </div>

        <div style={s.section}>
          <div style={s.lbl}>Movimientos recientes</div>
          {cargos.length === 0 ? <div style={{ fontSize: 12, color: '#ccc' }}>Cargando...</div> : (
            <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
              <thead><tr>{['Fecha','Concepto','Cargo','Abono','Saldo'].map(h => (
                <td key={h} style={{ padding: '3px 0', color: '#aaa', fontWeight: 600, fontSize: 10 }}>{h}</td>
              ))}</tr></thead>
              <tbody>{cargos.map((c, i) => (
                <tr key={i} style={{ borderTop: '1px solid #F5F3EF', background: c.calif === 'INICIO' ? '#EAF3DE' : 'transparent' }}>
                  <td style={{ padding: '5px 0', color: '#999', whiteSpace: 'nowrap' }}>{c.fecha}</td>
                  <td style={{ padding: '5px 0', color: '#444', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.concepto}</td>
                  <td style={{ padding: '5px 0', textAlign: 'right', color: c.cargo ? '#E8593C' : '#ccc', fontWeight: c.cargo ? 600 : 400 }}>{c.cargo ? '$'+fmt(c.cargo) : '—'}</td>
                  <td style={{ padding: '5px 0', textAlign: 'right', color: c.abono ? '#0F6E56' : '#ccc', fontWeight: c.abono ? 600 : 400 }}>{c.abono ? '$'+fmt(c.abono) : '—'}</td>
                  <td style={{ padding: '5px 0', textAlign: 'right', fontWeight: 600, color: c.saldo_calc > 0 ? '#E8593C' : c.saldo_calc < 0 ? '#0F6E56' : '#999' }}>${fmt(c.saldo_calc)}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>

        <div style={s.section}>
          <div style={s.lbl}>Calcular multa</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Fecha inicio notificación</div>
              <input type="date" style={s.inp} value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>% diario (default 1%)</div>
              <input type="number" step="0.1" min="0.1" max="10" style={s.inp} value={porcentaje} onChange={e => setPorcentaje(parseFloat(e.target.value) || 1)} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Notas (opcional)</div>
            <textarea style={{ ...s.inp, height: 52, resize: 'none' }} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Ej: Notificado por email el 20/05/2026..." />
          </div>
        </div>

        <div style={{ margin: '0 24px 4px', background: '#FDF1EE', border: '1px solid #F5C4B3', borderRadius: 10, padding: '14px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 12, color: '#993C1D' }}>Deuda base</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#993C1D' }}>${fmt(moroso.deuda)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 12, color: '#993C1D' }}>{dias} días × {porcentaje}% diario</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#993C1D' }}>{(porcentaje * dias).toFixed(1)}%</span>
          </div>
          <div style={{ borderTop: '1px solid #F0C0A8', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#4A1B0C' }}>Multa total</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#E8593C' }}>${fmt(montoMulta)}</span>
          </div>
        </div>

        <div style={{ padding: '12px 24px 20px' }}>
          <button onClick={aplicarMulta} disabled={guardando || dias === 0} style={{
            width: '100%', padding: '11px 0', borderRadius: 8, border: 'none',
            background: exito ? '#0F6E56' : dias === 0 ? '#E0DDD8' : '#E8593C',
            color: dias === 0 ? '#aaa' : '#fff', fontSize: 14, fontWeight: 700,
            cursor: dias === 0 ? 'not-allowed' : 'pointer', transition: 'background 0.3s',
          }}>
            {exito ? '✓ Multa aplicada' : guardando ? 'Guardando...' : dias === 0 ? 'Selecciona una fecha anterior a hoy' : `Aplicar multa de $${fmt(montoMulta)}`}
          </button>
        </div>

        {historial.length > 0 && (
          <div style={s.section}>
            <div style={s.lbl}>Historial ({historial.length})</div>
            {historial.map((h, i) => (
              <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #F5F3EF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, color: '#444' }}>{fmtDate(h.created_at)}</div>
                  <div style={{ fontSize: 11, color: '#999' }}>{h.dias} días × {h.porcentaje}% — base ${fmt(h.deuda_base)}</div>
                  {h.notas && <div style={{ fontSize: 11, color: '#bbb', fontStyle: 'italic' }}>{h.notas}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#E8593C' }}>${fmt(h.monto_multa)}</div>
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: '#EAF3DE', color: '#3B6D11' }}>{h.estado}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function MorosidadPage() {
  const [morosos, setMorosos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seleccionado, setSeleccionado] = useState(null);

  const [fIdadmon, setFIdadmon] = useState(emptyF);
  const [fEstado, setFEstado] = useState(emptyF);
  const [fPropietario, setFPropietario] = useState(emptyF);
  const [fArrendatario, setFArrendatario] = useState(emptyF);
  const [fInmueble, setFInmueble] = useState(emptyF);
  const [fDeuda, setFDeuda] = useState(emptyF);
  const [fDias, setFDias] = useState(emptyF);

  useEffect(() => { cargarMorosos(); }, []);

  function cargarMorosos() {
    setLoading(true);
    supabase.from('v_cartolas').select('*')
      .then(({ data, error }) => {
        if (error) { console.error(error); setLoading(false); return; }
        const lista = (data || []).map(m => ({
          ...m,
          dias_mora: diasDesde(m.ultima_fecha),
        }));
        // Por defecto: más recientes primero (menos días de mora)
        lista.sort((a, b) => (a.dias_mora ?? 9999) - (b.dias_mora ?? 9999));
        setMorosos(lista);
        setLoading(false);
      });
  }

  // Aplicar filtros y ordenación
  function applyFilters(lista) {
    let r = [...lista];

    // Filtros por selección
    if (fIdadmon.selected.length) r = r.filter(m => fIdadmon.selected.includes(m.idadmon));
    if (fEstado.selected.length) r = r.filter(m => fEstado.selected.includes(m.estado));
    if (fPropietario.selected.length) r = r.filter(m => fPropietario.selected.includes(m.propietario));
    if (fArrendatario.selected.length) r = r.filter(m => fArrendatario.selected.includes(m.arrendatario));
    if (fInmueble.selected.length) r = r.filter(m => fInmueble.selected.includes(m.inmueble));

    // Filtro numérico deuda
    if (fDeuda.min !== '') r = r.filter(m => Number(m.deuda) >= Number(fDeuda.min));
    if (fDeuda.max !== '') r = r.filter(m => Number(m.deuda) <= Number(fDeuda.max));

    // Filtro numérico días
    if (fDias.min !== '') r = r.filter(m => (m.dias_mora ?? 0) >= Number(fDias.min));
    if (fDias.max !== '') r = r.filter(m => (m.dias_mora ?? 0) <= Number(fDias.max));

    // Ordenación — última que tenga sort gana
    const sorts = [
      { f: fIdadmon, key: 'idadmon', num: false },
      { f: fEstado, key: 'estado', num: false },
      { f: fPropietario, key: 'propietario', num: false },
      { f: fArrendatario, key: 'arrendatario', num: false },
      { f: fInmueble, key: 'inmueble', num: false },
      { f: fDeuda, key: 'deuda', num: true },
      { f: fDias, key: 'dias_mora', num: true },
    ].filter(s => s.f.sort);

    if (sorts.length) {
      const { key, num, f } = sorts[sorts.length - 1];
      r.sort((a, b) => {
        const av = num ? Number(a[key] ?? 0) : String(a[key] ?? '');
        const bv = num ? Number(b[key] ?? 0) : String(b[key] ?? '');
        return f.sort === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
      });
    }

    return r;
  }

  const filtrados = applyFilters(morosos);
  const totalDeuda = filtrados.reduce((s, m) => s + Number(m.deuda || 0), 0);
  const mas30dias = filtrados.filter(m => m.dias_mora != null && m.dias_mora > 30).length;
  const unicos = (campo) => [...new Set(morosos.map(m => m[campo]).filter(v => v != null))].sort();

  const hayFiltros = [fIdadmon, fEstado, fPropietario, fArrendatario, fInmueble, fDeuda, fDias].some(
    f => f.selected.length || f.sort || f.min !== '' || f.max !== ''
  );

  function limpiarTodo() {
    setFIdadmon(emptyF); setFEstado(emptyF); setFPropietario(emptyF);
    setFArrendatario(emptyF); setFInmueble(emptyF); setFDeuda(emptyF); setFDias(emptyF);
  }

  const s = {
    page: { minHeight: '100vh', background: '#F8F7F4', fontFamily: '"DM Sans","Segoe UI",sans-serif' },
    container: { maxWidth: 1300, margin: '0 auto', padding: '28px 24px' },
    kpi: { background: '#fff', border: '1px solid #E8E6E0', borderRadius: 10, padding: '14px 18px' },
    tabla: { background: '#fff', border: '1px solid #E8E6E0', borderRadius: 10, overflow: 'hidden' },
    th: { padding: '10px 14px', fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '1px solid #F0EEE8', background: '#FAFAF8', textAlign: 'left', whiteSpace: 'nowrap' },
    td: { padding: '10px 14px', fontSize: 13, color: '#333', borderBottom: '1px solid #F5F3EF' },
  };

  return (
    <div style={s.page}>
      <TopNav />
      <div style={s.container}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <Link href="/cc1" style={{ fontSize: 12, color: '#185FA5', textDecoration: 'none', padding: '4px 10px', border: '1px solid #B5D4F4', borderRadius: 6, background: '#E6F1FB' }}>← CC1 Admin</Link>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1a1a2e' }}>Morosidad</h1>
          <span style={{ fontSize: 12, color: '#aaa' }}>Arrendatarios con saldo pendiente</span>
          {hayFiltros && (
            <button onClick={limpiarTodo} style={{ fontSize: 11, padding: '3px 10px', border: '1px solid #E8593C', borderRadius: 5, background: '#FDF1EE', color: '#E8593C', cursor: 'pointer' }}>
              × Limpiar filtros
            </button>
          )}
          <button onClick={cargarMorosos} style={{ marginLeft: 'auto', fontSize: 12, padding: '5px 12px', border: '1px solid #E0DDD8', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>↺ Actualizar</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
          <div style={s.kpi}>
            <div style={{ fontSize: 11, color: '#aaa', marginBottom: 4 }}>Total morosos</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#E8593C' }}>{loading ? '...' : morosos.length}</div>
          </div>
          <div style={s.kpi}>
            <div style={{ fontSize: 11, color: '#aaa', marginBottom: 4 }}>Deuda {filtrados.length < morosos.length ? 'filtrada' : 'total'}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e' }}>{loading ? '...' : '$'+fmt(totalDeuda)}</div>
          </div>
          <div style={s.kpi}>
            <div style={{ fontSize: 11, color: '#aaa', marginBottom: 4 }}>Más de 30 días</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#854F0B' }}>{loading ? '...' : mas30dias}</div>
          </div>
          <div style={s.kpi}>
            <div style={{ fontSize: 11, color: '#aaa', marginBottom: 4 }}>Mostrando</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#185FA5' }}>{loading ? '...' : filtrados.length}</div>
          </div>
        </div>

        <div style={s.tabla}>
          {loading ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#aaa', fontSize: 13 }}>Cargando morosos...</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={s.th}><ExcelFilter label="IDADMON" type="text" options={unicos('idadmon')} value={fIdadmon} onApply={setFIdadmon} /></th>
                  <th style={s.th}><ExcelFilter label="Estado" type="text" options={unicos('estado')} value={fEstado} onApply={setFEstado} /></th>
                  <th style={s.th}><ExcelFilter label="Propietario" type="text" options={unicos('propietario')} value={fPropietario} onApply={setFPropietario} /></th>
                  <th style={s.th}><ExcelFilter label="Arrendatario" type="text" options={unicos('arrendatario')} value={fArrendatario} onApply={setFArrendatario} /></th>
                  <th style={s.th}><ExcelFilter label="Inmueble" type="text" options={unicos('inmueble')} value={fInmueble} onApply={setFInmueble} /></th>
                  <th style={{ ...s.th, textAlign: 'right' }}><ExcelFilter label="Deuda" type="number" options={[]} value={fDeuda} onApply={setFDeuda} align="right" /></th>
                  <th style={{ ...s.th, textAlign: 'center' }}><ExcelFilter label="Días mora" type="number" options={[]} value={fDias} onApply={setFDias} /></th>
                  <th style={{ ...s.th, textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 ? (
                  <tr><td colSpan={8} style={{ ...s.td, textAlign: 'center', color: '#aaa', padding: 40 }}>No hay morosos con los filtros seleccionados</td></tr>
                ) : filtrados.map((m, i) => (
                  <tr key={m.idadmon} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAF8', cursor: 'pointer' }}
                    onClick={() => setSeleccionado(m)}>
                    <td style={{ ...s.td, fontWeight: 700, color: '#185FA5' }}>{m.idadmon}</td>
                    <td style={s.td}><EstadoBadge estado={m.estado} /></td>
                    <td style={{ ...s.td, fontSize: 12 }}>{m.propietario || '—'}</td>
                    <td style={s.td}>{m.arrendatario || '—'}</td>
                    <td style={{ ...s.td, color: '#777', fontSize: 12 }}>{m.inmueble || '—'}</td>
                    <td style={{ ...s.td, textAlign: 'right', fontWeight: 700, color: '#E8593C', fontSize: 14 }}>${fmt(m.deuda)}</td>
                    <td style={{ ...s.td, textAlign: 'center' }}>
                      {m.dias_mora != null ? (
                        <span style={{
                          padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                          background: m.dias_mora > 365 ? '#FAECE7' : m.dias_mora > 90 ? '#FAEEDA' : m.dias_mora > 30 ? '#FEF9C3' : '#F1EFE8',
                          color: m.dias_mora > 365 ? '#993C1D' : m.dias_mora > 90 ? '#854F0B' : m.dias_mora > 30 ? '#7C6800' : '#5F5E5A',
                        }}>{m.dias_mora}d</span>
                      ) : '—'}
                    </td>
                    <td style={{ ...s.td, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => setSeleccionado(m)} style={{
                        fontSize: 11, padding: '4px 10px', borderRadius: 5,
                        border: '1px solid #E8593C', background: '#FDF1EE',
                        color: '#E8593C', cursor: 'pointer', fontWeight: 600,
                      }}>Multar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {seleccionado && (
        <Drawer moroso={seleccionado} onClose={() => setSeleccionado(null)}
          onMultaAplicada={() => { setSeleccionado(null); cargarMorosos(); }} />
      )}
    </div>
  );
}