// app/direccion/valoraciones/page.js
'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';

const DIRECCION = [
  'alberto.cabezas@fondocapital.com',
  'luis.cabezas@fondocapital.com',
  'karina.morales@fondocapital.com',
];

const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('es-CL', { maximumFractionDigits: 0 }));
const fmt2 = (n) => (n == null ? '—' : Number(n).toLocaleString('es-CL', { maximumFractionDigits: 2 }));

const inputS = { padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14, width: '100%', boxSizing: 'border-box' };
const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, marginBottom: 16 };
const lbl = { fontSize: 12, color: '#475569' };
const kpi = { flex: 1, minWidth: 150, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 };

const testigoVacio = () => ({ link: '', m2: '', precio: '', moneda: 'UF', dormitorios: '' });

export default function ValoracionesPage() {
  const { data: session, status } = useSession();
  const email = session?.user?.email || '';

  const [suj, setSuj] = useState({
    direccion: '', comuna: '', tipo: 'departamento', operacion: 'venta',
    m2: '', dormitorios: '', avaluo_fiscal_uf: '', rol: '',
  });
  const [testigos, setTestigos] = useState([testigoVacio(), testigoVacio(), testigoVacio()]);
  const [res, setRes] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardadoId, setGuardadoId] = useState(null);
  const [error, setError] = useState('');
  const [verDesc, setVerDesc] = useState(false);
  const [pegado, setPegado] = useState('');
  const [parseando, setParseando] = useState(false);
  const [avisoExtraccion, setAvisoExtraccion] = useState('');

  if (status === 'loading') return <div style={{ padding: 40 }}>Cargando…</div>;
  if (!DIRECCION.includes(email)) return <div style={{ padding: 40 }}>Acceso restringido a Dirección.</div>;

  const setS = (k, v) => setSuj((p) => ({ ...p, [k]: v }));
  const setT = (i, k, v) => setTestigos((p) => p.map((t, idx) => (idx === i ? { ...t, [k]: v } : t)));
  const addT = () => setTestigos((p) => [...p, testigoVacio()]);
  const delT = (i) => setTestigos((p) => p.filter((_, idx) => idx !== i));

  async function calcular(guardar) {
    setError(''); if (!guardar) { setRes(null); setGuardadoId(null); }
    if (!suj.comuna.trim()) { setError('Ingresa la comuna del sujeto.'); return; }
    const conDatos = testigos.filter((t) => t.m2 && t.precio);
    if (conDatos.length < 1) { setError('Ingresa al menos un testigo con m² y precio.'); return; }
    guardar ? setGuardando(true) : setCargando(true);
    try {
      const r = await fetch('/api/valoraciones/calcular', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sujeto: suj, testigos: conDatos, guardar, creado_por: email }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error || 'Error'); return; }
      setRes(data.resultado);
      if (guardar && data.valoracion_id) setGuardadoId(data.valoracion_id);
    } catch (e) { setError(e.message); }
    finally { setCargando(false); setGuardando(false); }
  }

  async function extraer() {
    setAvisoExtraccion('');
    if (!pegado.trim() || pegado.trim().length < 20) { setAvisoExtraccion('Pega el contenido del aviso.'); return; }
    setParseando(true);
    try {
      const r = await fetch('/api/valoraciones/parsear', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contenido: pegado }),
      });
      const d = await r.json();
      if (!r.ok) { setAvisoExtraccion(d.error || 'No se pudo extraer.'); return; }
      // agrega un testigo pre-llenado con lo encontrado
      setTestigos((p) => [...p, {
        link: d.link || '',
        m2: d.m2 != null ? String(d.m2) : '',
        precio: d.precio != null ? String(d.precio) : '',
        moneda: d.moneda || 'UF',
        dormitorios: d.dormitorios != null ? String(d.dormitorios) : '',
      }]);
      const faltan = [];
      if (d.precio == null) faltan.push('precio');
      if (d.m2 == null) faltan.push('m²');
      setPegado('');
      setAvisoExtraccion(faltan.length
        ? `Agregado, pero revisa: no detecté ${faltan.join(' ni ')}. Complétalo a mano.`
        : `✓ Testigo agregado (${d.m2} m², ${d.precio} ${d.moneda}). Verifica contra el aviso.`);
    } catch (e) { setAvisoExtraccion(e.message); }
    finally { setParseando(false); }
  }

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Valoración de propiedades</h1>
      <p style={{ color: '#64748b', marginTop: 0, fontSize: 13 }}>
        Ingresa la propiedad y 3 o más testigos comparables (desde Portal Inmobiliario u otra fuente).
        El sistema quita los valores extremos y calcula la estimación.
      </p>

      {/* SUJETO */}
      <div style={card}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>Propiedad a tasar</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 2, minWidth: 220 }}>
            <div style={lbl}>Dirección</div>
            <input style={inputS} value={suj.direccion} onChange={(e) => setS('direccion', e.target.value)} placeholder="Calle 123, depto 45" />
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <div style={lbl}>Comuna *</div>
            <input style={inputS} value={suj.comuna} onChange={(e) => setS('comuna', e.target.value)} placeholder="Providencia" />
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <div style={lbl}>Tipo</div>
            <select style={inputS} value={suj.tipo} onChange={(e) => setS('tipo', e.target.value)}>
              <option value="departamento">Departamento</option>
              <option value="casa">Casa</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
          <div style={{ flex: 1, minWidth: 110 }}>
            <div style={lbl}>m²</div>
            <input style={inputS} type="number" value={suj.m2} onChange={(e) => setS('m2', e.target.value)} placeholder="65" />
          </div>
          <div style={{ flex: 1, minWidth: 110 }}>
            <div style={lbl}>Dormitorios</div>
            <input style={inputS} type="number" value={suj.dormitorios} onChange={(e) => setS('dormitorios', e.target.value)} placeholder="2" />
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <div style={lbl}>Avalúo fiscal (UF)</div>
            <input style={inputS} type="number" value={suj.avaluo_fiscal_uf} onChange={(e) => setS('avaluo_fiscal_uf', e.target.value)} placeholder="opcional" />
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <div style={lbl}>Rol SII</div>
            <input style={inputS} value={suj.rol} onChange={(e) => setS('rol', e.target.value)} placeholder="opcional" />
          </div>
        </div>
      </div>

      {/* TESTIGOS */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontWeight: 600 }}>Testigos comparables</div>
          <button onClick={addT} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>
            + Agregar vacío
          </button>
        </div>

        {/* Pegar aviso para autocompletar */}
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: '#1e40af', marginBottom: 6 }}>
            Pega aquí el aviso (selecciona todo con Ctrl+A en la página del aviso, o el código fuente con Ctrl+U) y extraigo los datos:
          </div>
          <textarea value={pegado} onChange={(e) => setPegado(e.target.value)} rows={3}
            placeholder="Pega el contenido del aviso de Portal Inmobiliario…"
            style={{ ...inputS, fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
            <button onClick={extraer} disabled={parseando}
              style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 14px', cursor: 'pointer', fontSize: 13, opacity: parseando ? 0.6 : 1 }}>
              {parseando ? 'Extrayendo…' : 'Extraer y agregar testigo'}
            </button>
            {avisoExtraccion && <span style={{ fontSize: 12, color: '#1e40af' }}>{avisoExtraccion}</span>}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
          {testigos.map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', padding: 8, background: '#f8fafc', borderRadius: 8 }}>
              <div style={{ flex: 3, minWidth: 220 }}>
                <div style={lbl}>Link (referencia)</div>
                <input style={inputS} value={t.link} onChange={(e) => setT(i, 'link', e.target.value)} placeholder="https://www.portalinmobiliario.com/MLC-..." />
              </div>
              <div style={{ flex: 1, minWidth: 80 }}>
                <div style={lbl}>m²</div>
                <input style={inputS} type="number" value={t.m2} onChange={(e) => setT(i, 'm2', e.target.value)} />
              </div>
              <div style={{ flex: 1, minWidth: 90 }}>
                <div style={lbl}>Precio</div>
                <input style={inputS} type="number" value={t.precio} onChange={(e) => setT(i, 'precio', e.target.value)} />
              </div>
              <div style={{ flex: 1, minWidth: 80 }}>
                <div style={lbl}>Moneda</div>
                <select style={inputS} value={t.moneda} onChange={(e) => setT(i, 'moneda', e.target.value)}>
                  <option value="UF">UF</option>
                  <option value="CLP">$ CLP</option>
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 70 }}>
                <div style={lbl}>Dorm.</div>
                <input style={inputS} type="number" value={t.dormitorios} onChange={(e) => setT(i, 'dormitorios', e.target.value)} />
              </div>
              <button onClick={() => delT(i)} title="Quitar"
                style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 6, padding: '8px 10px', cursor: 'pointer' }}>✕</button>
            </div>
          ))}
        </div>
        <button onClick={() => calcular(false)} disabled={cargando}
          style={{ marginTop: 14, padding: '10px 20px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer', opacity: cargando ? 0.6 : 1 }}>
          {cargando ? 'Calculando…' : 'Calcular'}
        </button>
      </div>

      {error && <div style={{ ...card, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>{error}</div>}

      {res && (
        <>
          {res.estimacion && (
            <div style={{ ...card, background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
              <div style={{ fontSize: 12, color: '#065f46' }}>Estimación (mediana UF/m² × m²)</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#065f46' }}>
                {fmt(res.estimacion.valor_uf)} UF
                {res.estimacion.valor_clp && <span style={{ fontSize: 15, fontWeight: 400, color: '#047857' }}>{'  '}≈ ${fmt(res.estimacion.valor_clp)}</span>}
              </div>
              <div style={{ fontSize: 13, color: '#047857' }}>
                Rango {fmt(res.estimacion.rango_uf[0])}–{fmt(res.estimacion.rango_uf[1])} UF · {fmt2(res.estimacion.uf_m2_mediana)} UF/m²
                {res.vs_avaluo && <span> · {fmt2(res.vs_avaluo.ratio)}× el avalúo fiscal</span>}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={kpi}>
              <div style={{ fontSize: 11, color: '#64748b' }}>Testigos usados</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{res.totales.usados}</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>de {res.totales.testigos} · {res.totales.descartados} extremos fuera</div>
            </div>
            <div style={kpi}>
              <div style={{ fontSize: 11, color: '#64748b' }}>Metraje medio</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{fmt(res.stat_m2?.media)} m²</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>mediana {fmt(res.stat_m2?.mediana)} · {fmt(res.stat_m2?.min)}–{fmt(res.stat_m2?.max)}</div>
            </div>
            <div style={kpi}>
              <div style={{ fontSize: 11, color: '#64748b' }}>UF/m² medio</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{fmt2(res.stat_uf_m2?.media)}</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>mediana {fmt2(res.stat_uf_m2?.mediana)} · p25–p75 {fmt2(res.stat_uf_m2?.p25)}–{fmt2(res.stat_uf_m2?.p75)}</div>
            </div>
          </div>

          <div style={card}>
            <div style={{ fontWeight: 600, marginBottom: 10 }}>Testigos usados</div>
            <Tabla filas={res.comparables} />
          </div>

          {res.comparables_descartados?.length > 0 && (
            <div style={card}>
              <button onClick={() => setVerDesc(!verDesc)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 14, padding: 0 }}>
                {verDesc ? '▼' : '▶'} Ver {res.comparables_descartados.length} descartados (extremos)
              </button>
              {verDesc && <div style={{ marginTop: 10 }}><Tabla filas={res.comparables_descartados} /></div>}
            </div>
          )}

          {/* Guardar */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button onClick={() => calcular(true)} disabled={guardando}
              style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer', opacity: guardando ? 0.6 : 1 }}>
              {guardando ? 'Guardando…' : 'Guardar valoración'}
            </button>
            {guardadoId && <span style={{ color: '#16a34a', fontSize: 13 }}>✓ Guardada (#{guardadoId})</span>}
          </div>
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
            <th style={th}>Testigo</th><th style={th}>m²</th><th style={th}>Dorm.</th>
            <th style={th}>Precio</th><th style={th}>UF/m²</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((c, i) => (
            <tr key={i}>
              <td style={td}>
                {c.link
                  ? <a href={c.link} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'none' }}>Ver aviso ↗</a>
                  : <span style={{ color: '#94a3b8' }}>manual</span>}
              </td>
              <td style={td}>{fmt(c.m2)}</td>
              <td style={td}>{c.dormitorios ?? '—'}</td>
              <td style={td}>{fmt(c.precio_uf)} UF{c.moneda === 'CLP' ? ` ($${fmt(c.precio)})` : ''}</td>
              <td style={td}>{fmt2(c.uf_m2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
