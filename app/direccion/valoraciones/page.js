// app/direccion/valoraciones/page.js
'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';

// Solo Dirección por ahora (misma lista que el resto del panel /direccion)
const DIRECCION = [
  'alberto.cabezas@fondocapital.com',
  'luis.cabezas@fondocapital.com',
  'karina.morales@fondocapital.com',
];

const fmt = (n) =>
  n == null ? '—' : Number(n).toLocaleString('es-CL', { maximumFractionDigits: 0 });
const fmt2 = (n) =>
  n == null ? '—' : Number(n).toLocaleString('es-CL', { maximumFractionDigits: 2 });

export default function ValoracionesPage() {
  const { data: session, status } = useSession();
  const email = session?.user?.email || '';

  const [comuna, setComuna] = useState('');
  const [tipo, setTipo] = useState('departamento');
  const [operacion, setOperacion] = useState('venta');
  const [m2, setM2] = useState('');
  const [cargando, setCargando] = useState(false);
  const [res, setRes] = useState(null);
  const [error, setError] = useState('');
  const [verDesc, setVerDesc] = useState(false);

  if (status === 'loading') return <div style={{ padding: 40 }}>Cargando…</div>;
  if (!DIRECCION.includes(email)) {
    return <div style={{ padding: 40 }}>Acceso restringido a Dirección.</div>;
  }

  async function calcular() {
    setError('');
    setRes(null);
    if (!comuna.trim()) { setError('Ingresa la comuna.'); return; }
    setCargando(true);
    try {
      const r = await fetch('/api/valoraciones/comparables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comuna: comuna.trim(),
          tipo,
          operacion,
          m2_objetivo: m2 ? Number(m2) : null,
        }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error || 'Error en el cálculo'); return; }
      setRes(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  const inputS = {
    padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6,
    fontSize: 14, width: '100%', boxSizing: 'border-box',
  };
  const card = {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
    padding: 16, marginBottom: 16,
  };
  const kpi = {
    flex: 1, minWidth: 140, background: '#f8fafc', border: '1px solid #e2e8f0',
    borderRadius: 8, padding: 12,
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Valoración de propiedades</h1>
      <p style={{ color: '#64748b', marginTop: 0, fontSize: 13 }}>
        Capa 1 — comparables de Portal Inmobiliario en la zona, sin los valores extremos.
      </p>

      {/* Formulario */}
      <div style={card}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 2, minWidth: 200 }}>
            <label style={{ fontSize: 12, color: '#475569' }}>Comuna</label>
            <input style={inputS} value={comuna} onChange={(e) => setComuna(e.target.value)}
              placeholder="Ej: Providencia" />
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={{ fontSize: 12, color: '#475569' }}>Tipo</label>
            <select style={inputS} value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="departamento">Departamento</option>
              <option value="casa">Casa</option>
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={{ fontSize: 12, color: '#475569' }}>Operación</label>
            <select style={inputS} value={operacion} onChange={(e) => setOperacion(e.target.value)}>
              <option value="venta">Venta</option>
              <option value="arriendo">Arriendo</option>
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label style={{ fontSize: 12, color: '#475569' }}>m² objetivo</label>
            <input style={inputS} type="number" value={m2} onChange={(e) => setM2(e.target.value)}
              placeholder="Ej: 65" />
          </div>
        </div>
        <button onClick={calcular} disabled={cargando}
          style={{
            marginTop: 14, padding: '10px 20px', background: '#0f172a', color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer',
            opacity: cargando ? 0.6 : 1,
          }}>
          {cargando ? 'Calculando…' : 'Calcular'}
        </button>
      </div>

      {error && (
        <div style={{ ...card, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
          {error}
        </div>
      )}

      {res?.ml_error && (
        <div style={{ ...card, background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', fontSize: 13 }}>
          <b>Aviso ML:</b> el buscador respondió {res.ml_error.status || 'error'}. Verifica en
          {' '}<code>/api/valoraciones/test-ml</code>. Si es 401/403, hay que pasar a scraping.
          <div style={{ marginTop: 6, fontFamily: 'monospace', fontSize: 11 }}>{res.ml_error.detalle}</div>
        </div>
      )}

      {res && (
        <>
          {/* Estimación */}
          {res.estimacion && (
            <div style={{ ...card, background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
              <div style={{ fontSize: 12, color: '#065f46' }}>Estimación (mediana ajustada × m²)</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#065f46' }}>
                {fmt(res.estimacion.valor_uf)} UF
                {res.estimacion.valor_clp &&
                  <span style={{ fontSize: 15, fontWeight: 400, color: '#047857' }}>
                    {'  '}≈ ${fmt(res.estimacion.valor_clp)}
                  </span>}
              </div>
              <div style={{ fontSize: 13, color: '#047857' }}>
                Rango {fmt(res.estimacion.rango_uf[0])}–{fmt(res.estimacion.rango_uf[1])} UF ·
                {' '}{fmt2(res.estimacion.uf_m2_mediana)} UF/m²
              </div>
            </div>
          )}

          {/* KPIs de comparables */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={kpi}>
              <div style={{ fontSize: 11, color: '#64748b' }}>Comparables usados</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{res.totales.usados}</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                de {res.totales.traidos} traídos · {res.totales.descartados} extremos fuera
              </div>
            </div>
            <div style={kpi}>
              <div style={{ fontSize: 11, color: '#64748b' }}>Metraje medio</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>
                {fmt(res.stat_m2?.media)} m²
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                mediana {fmt(res.stat_m2?.mediana)} · {fmt(res.stat_m2?.min)}–{fmt(res.stat_m2?.max)} m²
              </div>
            </div>
            <div style={kpi}>
              <div style={{ fontSize: 11, color: '#64748b' }}>UF/m² medio</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{fmt2(res.stat_uf_m2?.media)}</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                mediana {fmt2(res.stat_uf_m2?.mediana)} · p25–p75 {fmt2(res.stat_uf_m2?.p25)}–{fmt2(res.stat_uf_m2?.p75)}
              </div>
            </div>
          </div>

          {/* Tabla de comparables usados */}
          <div style={card}>
            <div style={{ fontWeight: 600, marginBottom: 10 }}>Comparables usados</div>
            <Tabla filas={res.comparables} />
          </div>

          {/* Descartados */}
          {res.comparables_descartados?.length > 0 && (
            <div style={card}>
              <button onClick={() => setVerDesc(!verDesc)}
                style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 14, padding: 0 }}>
                {verDesc ? '▼' : '▶'} Ver {res.comparables_descartados.length} descartados (extremos)
              </button>
              {verDesc && <div style={{ marginTop: 10 }}><Tabla filas={res.comparables_descartados} /></div>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Tabla({ filas }) {
  if (!filas?.length) return <div style={{ color: '#94a3b8', fontSize: 13 }}>Sin datos.</div>;
  const th = { textAlign: 'left', padding: '6px 8px', fontSize: 11, color: '#64748b', borderBottom: '1px solid #e2e8f0' };
  const td = { padding: '6px 8px', fontSize: 13, borderBottom: '1px solid #f1f5f9' };
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={th}>Publicación</th>
            <th style={th}>m²</th>
            <th style={th}>Dorm.</th>
            <th style={th}>Precio (UF)</th>
            <th style={th}>UF/m²</th>
            <th style={th}>Comuna</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((c) => (
            <tr key={c.ml_id}>
              <td style={td}>
                <a href={c.permalink} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'none' }}>
                  {(c.titulo || c.ml_id).slice(0, 48)}
                </a>
              </td>
              <td style={td}>{fmt(c.m2)}</td>
              <td style={td}>{c.dormitorios ?? '—'}</td>
              <td style={td}>{fmt(c.precio_uf)}</td>
              <td style={td}>{fmt2(c.uf_m2)}</td>
              <td style={td}>{c.comuna || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
