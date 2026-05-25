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
    supabase
      .from('cuentas')
      .select('fecha, concepto, cargo, abono')
      .eq('idadmon', moroso.idadmon)
      .order('id', { ascending: false })
      .limit(12)
      .then(({ data }) => setCargos(data || []));

    supabase
      .from('morosidad_multas')
      .select('*')
      .eq('idadmon', moroso.idadmon)
      .order('created_at', { ascending: false })
      .then(({ data }) => setHistorial(data || []));
  }, [moroso]);

  async function aplicarMulta() {
    if (montoMulta <= 0) return;
    setGuardando(true);
    const hoy = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const { error } = await supabase.from('morosidad_multas').insert({
      idadmon: moroso.idadmon,
      arrendatario: moroso.arrendatario,
      inmueble: moroso.inmueble,
      propietario: moroso.propietario,
      deuda_base: moroso.deuda,
      fecha_inicio: fechaInicio,
      porcentaje: porcentaje,
      dias: dias,
      monto_multa: montoMulta,
      estado: 'aplicada',
      notas: notas,
    });
    if (!error) {
      await supabase.from('cuentas').insert({
        idadmon: moroso.idadmon,
        fecha: hoy,
        concepto: 'MULTA MORA',
        cargo: montoMulta,
        estado: 'N',
        propietario: moroso.propietario,
        inmueble: moroso.inmueble,
      });
      setExito(true);
      setTimeout(() => { setExito(false); onMultaAplicada(); }, 1800);
    }
    setGuardando(false);
  }

  const s = {
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 300, display: 'flex', justifyContent: 'flex-end' },
    panel: { width: 500, background: '#fff', height: '100vh', overflowY: 'auto', boxShadow: '-4px 0 32px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', fontFamily: '"DM Sans", "Segoe UI", sans-serif' },
    header: { padding: '20px 24px 16px', borderBottom: '1px solid #F0EEE8', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: '#FAFAF8' },
    section: { padding: '16px 24px', borderBottom: '1px solid #F5F3EF' },
    label: { fontSize: 10, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 },
    input: { width: '100%', padding: '8px 10px', border: '1px solid #E0DDD8', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' },
  };

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.panel}>
        <div style={s.header}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e' }}>{moroso.idadmon}</span>
              <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 3, background: '#FAECE7', color: '#E8593C', fontWeight: 700 }}>MOROSO</span>
            </div>
            <div style={{ fontSize: 13, color: '#555', marginTop: 3 }}>{moroso.arrendatario || '—'}</div>
            <div style={{ fontSize: 11, color: '#999', marginTop: 1 }}>{moroso.inmueble || '—'}</div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 22, cursor: 'pointer', color: '#bbb' }}>×</button>
        </div>

        <div style={{ ...s.section, background: '#FDF1EE' }}>
          <div style={s.label}>Deuda acumulada</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#E8593C' }}>${fmt(moroso.deuda)}</div>
          {moroso.dias_mora != null && (
            <div style={{ fontSize: 12, color: '#993C1D', marginTop: 4 }}>Último movimiento hace {moroso.dias_mora} días</div>
          )}
        </div>

        <div style={s.section}>
          <div style={s.label}>Movimientos recientes</div>
          {cargos.length === 0 ? (
            <div style={{ fontSize: 12, color: '#ccc' }}>Cargando...</div>
          ) : (
            <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Fecha','Concepto','Cargo','Abono'].map(h => (
                  <td key={h} style={{ padding: '3px 0', color: '#aaa', fontWeight: 600, fontSize: 10 }}>{h}</td>
                ))}</tr>
              </thead>
              <tbody>
                {cargos.map((c, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #F5F3EF' }}>
                    <td style={{ padding: '5px 0', color: '#999', whiteSpace: 'nowrap' }}>{c.fecha}</td>
                    <td style={{ padding: '5px 0', color: '#444', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.concepto}</td>
                    <td style={{ padding: '5px 0', textAlign: 'right', color: c.cargo ? '#E8593C' : '#ccc', fontWeight: c.cargo ? 600 : 400 }}>{c.cargo ? '$'+fmt(c.cargo) : '—'}</td>
                    <td style={{ padding: '5px 0', textAlign: 'right', color: c.abono ? '#0F6E56' : '#ccc', fontWeight: c.abono ? 600 : 400 }}>{c.abono ? '$'+fmt(c.abono) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={s.section}>
          <div style={s.label}>Calcular multa</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Fecha inicio notificación</div>
              <input type="date" style={s.input} value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>% diario (default 1%)</div>
              <input type="number" step="0.1" min="0.1" max="10" style={s.input} value={porcentaje} onChange={e => setPorcentaje(parseFloat(e.target.value) || 1)} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Notas (opcional)</div>
            <textarea style={{ ...s.input, height: 52, resize: 'none' }} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Ej: Notificado por email el 20/05/2026..." />
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
            color: dias === 0 ? '#aaa' : '#fff',
            fontSize: 14, fontWeight: 700, cursor: dias === 0 ? 'not-allowed' : 'pointer', transition: 'background 0.3s',
          }}>
            {exito ? '✓ Multa aplicada' : guardando ? 'Guardando...' : dias === 0 ? 'Selecciona una fecha anterior a hoy' : `Aplicar multa de $${fmt(montoMulta)}`}
          </button>
        </div>

        {historial.length > 0 && (
          <div style={s.section}>
            <div style={s.label}>Historial ({historial.length})</div>
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

export default function MorosidadPage() {
  const [morosos, setMorosos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seleccionado, setSeleccionado] = useState(null);
  const [filtroIdadmon, setFiltroIdadmon] = useState('');
  const [filtroArrendatario, setFiltroArrendatario] = useState('');
  const [filtroInmueble, setFiltroInmueble] = useState('');
  const [dropOpen, setDropOpen] = useState(null);
  const dropRef = useRef(null);

  useEffect(() => { cargarMorosos(); }, []);

  useEffect(() => {
    function handleClick(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(null);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function cargarMorosos() {
    setLoading(true);
    supabase
      .from('v_morosos')
      .select('*')
      .then(({ data, error }) => {
        if (error) { console.error(error); setLoading(false); return; }
        const lista = (data || []).map(m => ({
          ...m,
          dias_mora: diasDesde(m.ultima_fecha),
        }));
        setMorosos(lista);
        setLoading(false);
      });
  }

  const filtrados = morosos.filter(m => {
    if (filtroIdadmon && m.idadmon !== filtroIdadmon) return false;
    if (filtroArrendatario && m.arrendatario !== filtroArrendatario) return false;
    if (filtroInmueble && m.inmueble !== filtroInmueble) return false;
    return true;
  });

  const totalDeuda = morosos.reduce((s, m) => s + Number(m.deuda || 0), 0);
  const mas30dias = morosos.filter(m => m.dias_mora != null && m.dias_mora > 30).length;
  const unicos = (campo) => [...new Set(morosos.map(m => m[campo]).filter(Boolean))].sort();

  const s = {
    page: { minHeight: '100vh', background: '#F8F7F4', fontFamily: '"DM Sans", "Segoe UI", sans-serif' },
    container: { maxWidth: 1140, margin: '0 auto', padding: '28px 24px' },
    kpi: { background: '#fff', border: '1px solid #E8E6E0', borderRadius: 10, padding: '14px 18px' },
    tabla: { background: '#fff', border: '1px solid #E8E6E0', borderRadius: 10, overflow: 'hidden' },
    th: { padding: '10px 14px', fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '1px solid #F0EEE8', background: '#FAFAF8', textAlign: 'left', whiteSpace: 'nowrap' },
    td: { padding: '10px 14px', fontSize: 13, color: '#333', borderBottom: '1px solid #F5F3EF' },
    dropdown: { position: 'absolute', top: '100%', left: 0, marginTop: 2, zIndex: 200, background: '#fff', border: '1px solid #E0DDD8', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', minWidth: 220, maxHeight: 260, overflowY: 'auto' },
  };

  function DropFiltro({ campo, valor, setValor, label }) {
    const open = dropOpen === campo;
    const opciones = unicos(campo);
    return (
      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 3 }} ref={open ? dropRef : null}>
        <span>{label}</span>
        <button style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 10, color: valor ? '#E8593C' : '#bbb', padding: 0 }}
          onClick={() => setDropOpen(open ? null : campo)}>▾</button>
        {open && (
          <div style={s.dropdown}>
            <div style={{ padding: '7px 14px', fontSize: 12, cursor: 'pointer', color: '#888', borderBottom: '1px solid #F0EEE8' }}
              onClick={() => { setValor(''); setDropOpen(null); }}>— Todos —</div>
            {opciones.map(o => (
              <div key={o} style={{ padding: '7px 14px', fontSize: 12, cursor: 'pointer', color: '#333', background: valor === o ? '#FDF1EE' : 'transparent' }}
                onClick={() => { setValor(o); setDropOpen(null); }}>{o}</div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={s.page}>
      <TopNav />
      <div style={s.container}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <Link href="/cc1" style={{ fontSize: 12, color: '#185FA5', textDecoration: 'none', padding: '4px 10px', border: '1px solid #B5D4F4', borderRadius: 6, background: '#E6F1FB' }}>← CC1 Admin</Link>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1a1a2e' }}>Morosidad</h1>
          <span style={{ fontSize: 12, color: '#aaa' }}>Arrendatarios con saldo pendiente</span>
          <button onClick={cargarMorosos} style={{ marginLeft: 'auto', fontSize: 12, padding: '5px 12px', border: '1px solid #E0DDD8', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>↺ Actualizar</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
          <div style={s.kpi}>
            <div style={{ fontSize: 11, color: '#aaa', marginBottom: 4 }}>Total morosos</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#E8593C' }}>{loading ? '...' : morosos.length}</div>
          </div>
          <div style={s.kpi}>
            <div style={{ fontSize: 11, color: '#aaa', marginBottom: 4 }}>Deuda total</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e' }}>{loading ? '...' : '$'+fmt(totalDeuda)}</div>
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
                  <th style={s.th}><DropFiltro campo="idadmon" valor={filtroIdadmon} setValor={setFiltroIdadmon} label="IDADMON" /></th>
                  <th style={s.th}><DropFiltro campo="arrendatario" valor={filtroArrendatario} setValor={setFiltroArrendatario} label="Arrendatario" /></th>
                  <th style={s.th}><DropFiltro campo="inmueble" valor={filtroInmueble} setValor={setFiltroInmueble} label="Inmueble" /></th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Deuda acumulada</th>
                  <th style={{ ...s.th, textAlign: 'center' }}>Último mov.</th>
                  <th style={{ ...s.th, textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 ? (
                  <tr><td colSpan={6} style={{ ...s.td, textAlign: 'center', color: '#aaa', padding: 40 }}>No hay morosos</td></tr>
                ) : filtrados.map((m, i) => (
                  <tr key={m.idadmon} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAF8', cursor: 'pointer' }}
                    onClick={() => setSeleccionado(m)}>
                    <td style={{ ...s.td, fontWeight: 700, color: '#185FA5' }}>{m.idadmon}</td>
                    <td style={s.td}>{m.arrendatario || '—'}</td>
                    <td style={{ ...s.td, color: '#777', fontSize: 12 }}>{m.inmueble || '—'}</td>
                    <td style={{ ...s.td, textAlign: 'right', fontWeight: 700, color: '#E8593C', fontSize: 14 }}>${fmt(m.deuda)}</td>
                    <td style={{ ...s.td, textAlign: 'center' }}>
                      {m.dias_mora != null ? (
                        <span style={{
                          padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                          background: m.dias_mora > 60 ? '#FAECE7' : m.dias_mora > 30 ? '#FAEEDA' : '#F1EFE8',
                          color: m.dias_mora > 60 ? '#993C1D' : m.dias_mora > 30 ? '#854F0B' : '#5F5E5A',
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
        <Drawer
          moroso={seleccionado}
          onClose={() => setSeleccionado(null)}
          onMultaAplicada={() => { setSeleccionado(null); cargarMorosos(); }}
        />
      )}
    </div>
  );
}