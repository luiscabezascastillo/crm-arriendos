// app/direccion/valoraciones/page.js
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

const DIRECCION = [
  'alberto.cabezas@fondocapital.com',
  'luis.cabezas@fondocapital.com',
];

const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('es-CL', { maximumFractionDigits: 0 }));
const fmt2 = (n) => (n == null ? '—' : Number(n).toLocaleString('es-CL', { maximumFractionDigits: 2 }));

const inputS = { padding: '7px 9px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, width: '100%', boxSizing: 'border-box' };
const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, marginBottom: 16 };
const lbl = { fontSize: 11, color: '#475569' };
const kpi = { flex: 1, minWidth: 150, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 };

const soloDigitos = (v) => String(v).replace(/[^\d]/g, '');
const fmtPesosInput = (v) => { const n = soloDigitos(v); return n ? Number(n).toLocaleString('es-CL') : ''; };

const testigoVacio = () => ({ link: '', titulo: '', precio: '', moneda: 'UF', m2_util: '', terraza: '', estac: '', bodega: '', dormitorios: '', revisar: false });

export default function ValoracionesPage() {
  const { data: session, status } = useSession();
  const email = session?.user?.email || '';

  const [suj, setSuj] = useState({ direccion: '', comuna: '', tipo: 'departamento', operacion: 'venta', m2_util: '', terraza: '', estac: '', bodega: '', dormitorios: '', avaluo_fiscal_pesos: '', rol: '' });
  const [par, setPar] = useState({ negociacion: 12, uf_estac: 350, uf_bodega: 80, factor_terraza: 0.5, tol_m2: 40 });
  const [testigos, setTestigos] = useState([testigoVacio()]);
  const [res, setRes] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardadoId, setGuardadoId] = useState(null);
  const [error, setError] = useState('');
  const [verDesc, setVerDesc] = useState(false);
  const [pegado, setPegado] = useState('');
  const [parseando, setParseando] = useState(false);
  const [avisoP, setAvisoP] = useState('');
  const [fotoSujeto, setFotoSujeto] = useState(null);
  const [genPdf, setGenPdf] = useState(false);
  const [siiMsg, setSiiMsg] = useState('');
  const [siiCargando, setSiiCargando] = useState(false);
  const [siiExtra, setSiiExtra] = useState(null);
  const [editandoId, setEditandoId] = useState(null);

  // Reabrir una valoración existente si la URL trae ?id=N
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const idUrl = new URLSearchParams(window.location.search).get('id');
    if (!idUrl) return;
    (async () => {
      try {
        const r = await fetch(`/api/valoraciones/listar?id=${idUrl}`);
        const d = await r.json();
        if (!r.ok || !d.valoracion) return;
        const mj = d.valoracion.metodologia_json || {};
        if (mj.sujeto) setSuj((p) => ({ ...p, ...mj.sujeto }));
        if (mj.parametros) {
          setPar({
            negociacion: Math.round((mj.parametros.negociacion ?? 0.12) * 100),
            uf_estac: mj.parametros.uf_estac ?? 350,
            uf_bodega: mj.parametros.uf_bodega ?? 80,
            factor_terraza: mj.parametros.factor_terraza ?? 0.5,
            tol_m2: Math.round((mj.parametros.tol_m2 ?? 0.4) * 100),
          });
        }
        if (Array.isArray(mj.testigos_raw) && mj.testigos_raw.length) {
          setTestigos(mj.testigos_raw.map((t) => ({ ...testigoVacio(), ...t })));
        }
        setEditandoId(Number(idUrl));
      } catch (e) { /* nada */ }
    })();
  }, []);

  async function traerSII() {
    setSiiMsg(''); setSiiExtra(null);
    if (!suj.comuna.trim()) { setSiiMsg('Ingresa la comuna primero.'); return; }
    if (!suj.rol.trim() && !suj.direccion.trim()) { setSiiMsg('Ingresa el rol (ej. 517-175) o la dirección.'); return; }
    setSiiCargando(true);
    try {
      const params = new URLSearchParams({ comuna: suj.comuna });
      if (suj.rol.trim()) params.set('rol', suj.rol.trim());
      else params.set('direccion', suj.direccion.trim());
      const r = await fetch(`/api/valoraciones/sii?${params.toString()}`);
      const d = await r.json();
      if (!r.ok || d.error) { setSiiMsg(d.error || 'No se pudo consultar el SII.'); return; }
      const x = d.datos;
      if (!x) { setSiiMsg('El SII no devolvió datos para esa consulta.'); return; }
      setSuj((p) => ({
        ...p,
        rol: x.rol || p.rol,
        direccion: p.direccion || x.direccion || '',
        m2_util: p.m2_util || (x.superficie_construida ? String(x.superficie_construida) : ''),
        avaluo_fiscal_pesos: x.avaluo_total ? String(x.avaluo_total) : p.avaluo_fiscal_pesos,
      }));
      setSiiExtra({ destino: x.destino, valor_m2_ah: x.valor_m2_ah, area: x.area_homogenea, rango: x.rango_superficie_ah, avaluo_pesos: x.avaluo_total });
      setSiiMsg('✓ Datos SII traídos. Revisa y edita si algo no cuadra.');
    } catch (e) { setSiiMsg(e.message); }
    finally { setSiiCargando(false); }
  }


  if (status === 'loading') return <div style={{ padding: 40 }}>Cargando…</div>;
  if (!DIRECCION.includes(email)) return <div style={{ padding: 40 }}>Acceso restringido a Dirección.</div>;

  const setS = (k, v) => setSuj((p) => ({ ...p, [k]: v }));
  const setP = (k, v) => setPar((p) => ({ ...p, [k]: v }));
  const setT = (i, k, v) => setTestigos((p) => p.map((t, idx) => (idx === i ? { ...t, [k]: v } : t)));
  const addT = () => setTestigos((p) => [...p, testigoVacio()]);
  const delT = (i) => setTestigos((p) => p.filter((_, idx) => idx !== i));

  async function extraerUno() {
    setAvisoP('');
    if (!pegado.trim() || pegado.trim().length < 20) { setAvisoP('Pega el contenido del aviso.'); return; }
    setParseando(true);
    try {
      const r = await fetch('/api/valoraciones/parsear', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contenido: pegado }) });
      const d = await r.json();
      if (!r.ok) { setAvisoP(d.error || 'No se pudo extraer.'); return; }
      setTestigos((p) => [...p, { ...testigoVacio(), link: d.link || '', titulo: d.titulo || '', m2_util: d.m2 != null ? String(d.m2) : '', precio: d.precio != null ? String(d.precio) : '', moneda: d.moneda || 'UF', dormitorios: d.dormitorios != null ? String(d.dormitorios) : '' }]);
      setPegado('');
      setAvisoP(d.precio == null || d.m2 == null ? 'Agregado, revisa: faltó precio o m². Complétalo a mano.' : `✓ Agregado (${d.m2} m², ${d.precio} ${d.moneda}).`);
    } catch (e) { setAvisoP(e.message); } finally { setParseando(false); }
  }

  async function extraerLista() {
    setAvisoP('');
    if (!pegado.trim() || pegado.trim().length < 20) { setAvisoP('Pega el texto del listado.'); return; }
    setParseando(true);
    try {
      const r = await fetch('/api/valoraciones/parsear-lista', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contenido: pegado }) });
      const d = await r.json();
      if (!r.ok) { setAvisoP(d.error || 'No se pudo extraer.'); return; }
      const nuevos = d.items.map((it) => ({ ...testigoVacio(), link: it.link || '', titulo: it.titulo || '', precio: String(it.precio), moneda: it.moneda || 'UF', m2_util: String(it.m2_util), dormitorios: it.dormitorios != null ? String(it.dormitorios) : '', revisar: it.revisar }));
      setTestigos((p) => [...p.filter((t) => t.precio || t.m2_util), ...nuevos]);
      setPegado('');
      const marcados = nuevos.filter((n) => n.revisar).length;
      setAvisoP(`✓ ${d.total} comparables agregados${marcados ? ` · ⚠️ ${marcados} traen estac/bodega/terraza en el título — revisa esos` : ''}.`);
    } catch (e) { setAvisoP(e.message); } finally { setParseando(false); }
  }

  async function generarPDF() {
    if (!guardadoId || !res) return;
    setGenPdf(true);
    try {
      // logo opcional: public/logo-fcr.png
      let logoDataUrl = null;
      try {
        const resp = await fetch('/logo-fcr.png');
        if (resp.ok) { const blob = await resp.blob(); logoDataUrl = await blobToDataUrl(blob); }
      } catch (e) {}
      // mapa: geocodifica la dirección y trae el mapa (server-side, base64)
      let mapaDataUrl = null;
      try {
        const g = await fetch(`/api/valoraciones/geocode?direccion=${encodeURIComponent(suj.direccion || '')}&comuna=${encodeURIComponent(suj.comuna || '')}`);
        const gd = await g.json();
        if (gd.mapa) mapaDataUrl = gd.mapa;
      } catch (e) {}
      const { generarPdfValoracion } = await import('../../../lib/valoracionPdf');
      generarPdfValoracion({ folio: guardadoId, sujeto: suj, parametros: res.parametros, resultado: res, logoDataUrl, fotoDataUrl: fotoSujeto, mapaDataUrl });
    } catch (e) { setError('Error generando PDF: ' + e.message); }
    finally { setGenPdf(false); }
  }

  function blobToDataUrl(blob) {
    return new Promise((ok) => { const r = new FileReader(); r.onloadend = () => ok(r.result); r.readAsDataURL(blob); });
  }

  function onFoto(e) {
    const file = e.target.files?.[0];
    if (!file) { setFotoSujeto(null); return; }
    blobToDataUrl(file).then(setFotoSujeto);
  }

  async function calcular(guardar) {
    setError(''); if (!guardar) { setRes(null); setGuardadoId(null); }
    if (!suj.comuna.trim()) { setError('Ingresa la comuna del sujeto.'); return; }
    const conDatos = testigos.filter((t) => t.m2_util && t.precio);
    if (conDatos.length < 1) { setError('Ingresa al menos un testigo con m² útil y precio.'); return; }
    guardar ? setGuardando(true) : setCargando(true);
    try {
      const r = await fetch('/api/valoraciones/calcular', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sujeto: suj, testigos: conDatos, guardar, creado_por: email, id: editandoId,
          parametros: { negociacion: Number(par.negociacion) / 100, uf_estac: Number(par.uf_estac), uf_bodega: Number(par.uf_bodega), factor_terraza: Number(par.factor_terraza), tol_m2: Number(par.tol_m2) / 100 },
        }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error || 'Error'); return; }
      setRes(data.resultado);
      if (guardar && data.valoracion_id) setGuardadoId(data.valoracion_id);
    } catch (e) { setError(e.message); } finally { setCargando(false); setGuardando(false); }
  }

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 22, marginBottom: 4 }}>Valoración de propiedades</h1>
          <p style={{ color: '#64748b', marginTop: 0, fontSize: 13 }}>
            Estimación referencial por comparables homologados. No reemplaza una tasación bancaria.
          </p>
        </div>
        <a href="/direccion/valoraciones/historial" style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#0f172a', textDecoration: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, whiteSpace: 'nowrap' }}>📋 Historial</a>
      </div>
      {editandoId && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span>✏️ Editando la valoración <b>folio #{editandoId}</b>. Al guardar se reemplaza la existente. Para crear otra, <a href="/direccion/valoraciones" style={{ color: '#1d4ed8' }}>empieza una nueva</a>.</span>
        </div>
      )}

      {/* SUJETO */}
      <div style={card}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>Propiedad a tasar</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: 2, minWidth: 200 }}><div style={lbl}>Dirección</div><input style={inputS} value={suj.direccion} onChange={(e) => setS('direccion', e.target.value)} /></div>
          <div style={{ flex: 1, minWidth: 130 }}><div style={lbl}>Comuna *</div><input style={inputS} value={suj.comuna} onChange={(e) => setS('comuna', e.target.value)} placeholder="Providencia" /></div>
          <div style={{ flex: 1, minWidth: 110 }}><div style={lbl}>Tipo</div><select style={inputS} value={suj.tipo} onChange={(e) => setS('tipo', e.target.value)}><option value="departamento">Departamento</option><option value="casa">Casa</option><option value="oficina">Oficina</option><option value="local">Local comercial</option><option value="bodega">Bodega / Estacionamiento</option></select></div>
          <div style={{ flex: 1, minWidth: 90 }}><div style={lbl}>Rol SII</div><input style={inputS} value={suj.rol} onChange={(e) => setS('rol', e.target.value)} placeholder="opcional" /></div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
          <div style={{ flex: 1, minWidth: 90 }}><div style={lbl}>m² útil</div><input style={inputS} type="number" value={suj.m2_util} onChange={(e) => setS('m2_util', e.target.value)} /></div>
          <div style={{ flex: 1, minWidth: 90 }}><div style={lbl}>m² terraza</div><input style={inputS} type="number" value={suj.terraza} onChange={(e) => setS('terraza', e.target.value)} /></div>
          <div style={{ flex: 1, minWidth: 80 }}><div style={lbl}>Estac.</div><input style={inputS} type="number" value={suj.estac} onChange={(e) => setS('estac', e.target.value)} placeholder="0" /></div>
          <div style={{ flex: 1, minWidth: 80 }}><div style={lbl}>Bodegas</div><input style={inputS} type="number" value={suj.bodega} onChange={(e) => setS('bodega', e.target.value)} placeholder="0" /></div>
          <div style={{ flex: 1, minWidth: 80 }}><div style={lbl}>Dorm.</div><input style={inputS} type="number" value={suj.dormitorios} onChange={(e) => setS('dormitorios', e.target.value)} /></div>
          <div style={{ flex: 1, minWidth: 120 }}><div style={lbl}>Avalúo fiscal ($)</div><input style={inputS} type="text" inputMode="numeric" value={suj.avaluo_fiscal_pesos ? fmtPesosInput(suj.avaluo_fiscal_pesos) : ''} onChange={(e) => setS('avaluo_fiscal_pesos', soloDigitos(e.target.value))} placeholder="opcional" /></div>
        </div>
        <div style={{ marginTop: 10 }}>
          <div style={lbl}>Foto de la propiedad (para el informe)</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="file" accept="image/*" onChange={onFoto} style={{ fontSize: 13 }} />
            {fotoSujeto && <span style={{ fontSize: 12, color: '#16a34a' }}>✓ foto cargada</span>}
            <button onClick={traerSII} disabled={siiCargando} style={{ marginLeft: 'auto', background: '#0369a1', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 14px', cursor: 'pointer', fontSize: 13, opacity: siiCargando ? 0.6 : 1 }}>
              {siiCargando ? 'Consultando SII…' : '🏛️ Traer datos SII (rol/avalúo)'}
            </button>
          </div>
          {siiMsg && <div style={{ fontSize: 12, color: siiMsg.startsWith('✓') ? '#16a34a' : '#b91c1c', marginTop: 6 }}>{siiMsg}</div>}
          {siiExtra && (
            <div style={{ fontSize: 12, color: '#334155', marginTop: 6, background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 6, padding: 8 }}>
              <b>Extra SII:</b> destino {siiExtra.destino || '—'} · valor m² oficial del sector (AH {siiExtra.area}): ${Number(siiExtra.valor_m2_ah || 0).toLocaleString('es-CL')}/m² · rango sup. {siiExtra.rango || '—'} · avalúo ${Number(siiExtra.avaluo_pesos || 0).toLocaleString('es-CL')}
            </div>
          )}
        </div>
      </div>

      {/* PARÁMETROS */}
      <div style={{ ...card, background: '#fffbeb', border: '1px solid #fde68a' }}>
        <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>Parámetros de homologación</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 140 }}><div style={lbl}>Negociación (%)</div><input style={inputS} type="number" value={par.negociacion} onChange={(e) => setP('negociacion', e.target.value)} /></div>
          <div style={{ flex: 1, minWidth: 140 }}><div style={lbl}>UF por estacionamiento</div><input style={inputS} type="number" value={par.uf_estac} onChange={(e) => setP('uf_estac', e.target.value)} /></div>
          <div style={{ flex: 1, minWidth: 140 }}><div style={lbl}>UF por bodega</div><input style={inputS} type="number" value={par.uf_bodega} onChange={(e) => setP('uf_bodega', e.target.value)} /></div>
          <div style={{ flex: 1, minWidth: 140 }}><div style={lbl}>Factor terraza</div><input style={inputS} type="number" step="0.1" value={par.factor_terraza} onChange={(e) => setP('factor_terraza', e.target.value)} /></div>
          <div style={{ flex: 1, minWidth: 140 }}><div style={lbl}>Tolerancia m² ±%</div><input style={inputS} type="number" value={par.tol_m2} onChange={(e) => setP('tol_m2', e.target.value)} /></div>
        </div>
        <div style={{ fontSize: 11, color: '#92400e', marginTop: 6 }}>La tolerancia descarta testigos cuyo tamaño se aleje del sujeto (ej. ±40% de la sup. ponderada) — así no se cuela un dúplex entre deptos chicos.</div>
      </div>

      {/* TESTIGOS */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontWeight: 600 }}>Testigos comparables</div>
          <button onClick={addT} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>+ Fila vacía</button>
        </div>

        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: '#1e40af', marginBottom: 6 }}>Pega un aviso individual (Ctrl+A en la página) o el <b>listado completo</b> del sector (con la consola: <code>copy(document.body.innerText.slice(0,8000))</code>):</div>
          <textarea value={pegado} onChange={(e) => setPegado(e.target.value)} rows={3} placeholder="Pega aquí…" style={{ ...inputS, fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
            <button onClick={extraerUno} disabled={parseando} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 14px', cursor: 'pointer', fontSize: 13 }}>Extraer 1 aviso</button>
            <button onClick={extraerLista} disabled={parseando} style={{ background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 14px', cursor: 'pointer', fontSize: 13 }}>Extraer listado completo</button>
            {avisoP && <span style={{ fontSize: 12, color: '#1e40af' }}>{avisoP}</span>}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 6 }}>
          {testigos.map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-end', padding: 8, background: t.revisar ? '#fef3c7' : '#f8fafc', borderRadius: 8, border: t.revisar ? '1px solid #fcd34d' : '1px solid transparent' }}>
              <div style={{ flex: 3, minWidth: 180 }}><div style={lbl}>Link {t.revisar ? '⚠️ revisar estac/bodega' : ''}</div><input style={inputS} value={t.link} onChange={(e) => setT(i, 'link', e.target.value)} placeholder="https://…MLC-…" /></div>
              <div style={{ flex: 1, minWidth: 70 }}><div style={lbl}>m² útil</div><input style={inputS} type="number" value={t.m2_util} onChange={(e) => setT(i, 'm2_util', e.target.value)} /></div>
              <div style={{ flex: 1, minWidth: 65 }}><div style={lbl}>terraza</div><input style={inputS} type="number" value={t.terraza} onChange={(e) => setT(i, 'terraza', e.target.value)} /></div>
              <div style={{ flex: 1, minWidth: 80 }}><div style={lbl}>Precio</div><input style={inputS} type="number" value={t.precio} onChange={(e) => setT(i, 'precio', e.target.value)} /></div>
              <div style={{ flex: 1, minWidth: 70 }}><div style={lbl}>Mon.</div><select style={inputS} value={t.moneda} onChange={(e) => setT(i, 'moneda', e.target.value)}><option value="UF">UF</option><option value="CLP">$</option></select></div>
              <div style={{ flex: 1, minWidth: 55 }}><div style={lbl}>Est.</div><input style={inputS} type="number" value={t.estac} onChange={(e) => setT(i, 'estac', e.target.value)} placeholder="0" /></div>
              <div style={{ flex: 1, minWidth: 55 }}><div style={lbl}>Bod.</div><input style={inputS} type="number" value={t.bodega} onChange={(e) => setT(i, 'bodega', e.target.value)} placeholder="0" /></div>
              <button onClick={() => delT(i)} style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 6, padding: '7px 9px', cursor: 'pointer' }}>✕</button>
            </div>
          ))}
        </div>
        <button onClick={() => calcular(false)} disabled={cargando} style={{ marginTop: 14, padding: '10px 20px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer', opacity: cargando ? 0.6 : 1 }}>{cargando ? 'Calculando…' : 'Calcular'}</button>
      </div>

      {error && <div style={{ ...card, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>{error}</div>}

      {res && (
        <>
          {res.estimacion && (
            <div style={{ ...card, background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
              <div style={{ fontSize: 12, color: '#065f46' }}>Estimación (mediana UF/m² homologado × sup. ponderada {res.estimacion.sup_ponderada_sujeto} m²)</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#065f46' }}>{fmt(res.estimacion.valor_uf)} UF{res.estimacion.valor_clp && <span style={{ fontSize: 15, fontWeight: 400, color: '#047857' }}>{'  '}≈ ${fmt(res.estimacion.valor_clp)}</span>}</div>
              <div style={{ fontSize: 13, color: '#047857' }}>Rango {fmt(res.estimacion.rango_uf[0])}–{fmt(res.estimacion.rango_uf[1])} UF · {fmt2(res.estimacion.uf_m2_mediana)} UF/m²{res.vs_avaluo && <span> · {fmt2(res.vs_avaluo.ratio)}× el avalúo fiscal</span>}</div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={kpi}><div style={{ fontSize: 11, color: '#64748b' }}>Testigos usados</div><div style={{ fontSize: 22, fontWeight: 700 }}>{res.totales.usados}</div><div style={{ fontSize: 11, color: '#94a3b8' }}>de {res.totales.testigos} · {res.totales.descartados} extremos fuera</div></div>
            <div style={kpi}><div style={{ fontSize: 11, color: '#64748b' }}>Sup. ponderada media</div><div style={{ fontSize: 22, fontWeight: 700 }}>{fmt(res.stat_sup?.media)} m²</div><div style={{ fontSize: 11, color: '#94a3b8' }}>mediana {fmt(res.stat_sup?.mediana)}</div></div>
            <div style={kpi}><div style={{ fontSize: 11, color: '#64748b' }}>UF/m² homologado</div><div style={{ fontSize: 22, fontWeight: 700 }}>{fmt2(res.stat_uf_m2?.media)}</div><div style={{ fontSize: 11, color: '#94a3b8' }}>mediana {fmt2(res.stat_uf_m2?.mediana)} · p25–p75 {fmt2(res.stat_uf_m2?.p25)}–{fmt2(res.stat_uf_m2?.p75)}</div></div>
          </div>
          <div style={card}><div style={{ fontWeight: 600, marginBottom: 10 }}>Testigos usados (homologados)</div><Tabla filas={res.comparables} /></div>
          {res.comparables_descartados?.length > 0 && (
            <div style={card}>
              <button onClick={() => setVerDesc(!verDesc)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 14, padding: 0 }}>{verDesc ? '▼' : '▶'} Ver {res.comparables_descartados.length} descartados (extremos)</button>
              {verDesc && <div style={{ marginTop: 10 }}><Tabla filas={res.comparables_descartados} /></div>}
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button onClick={() => calcular(true)} disabled={guardando} style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer', opacity: guardando ? 0.6 : 1 }}>{guardando ? 'Guardando…' : 'Guardar valoración'}</button>
            {guardadoId && <span style={{ color: '#16a34a', fontSize: 13 }}>✓ Guardada (folio #{guardadoId})</span>}
            {guardadoId && (
              <button onClick={generarPDF} disabled={genPdf} style={{ padding: '10px 20px', background: '#b91c1c', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer', opacity: genPdf ? 0.6 : 1 }}>
                {genPdf ? 'Generando…' : '📄 Generar PDF'}
              </button>
            )}
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
        <thead><tr><th style={th}>Testigo</th><th style={th}>Sup.pond.</th><th style={th}>Oferta UF</th><th style={th}>Ajuste</th><th style={th}>Homologado</th><th style={th}>UF/m²</th></tr></thead>
        <tbody>
          {filas.map((c, i) => (
            <tr key={i}>
              <td style={td}>{c.link ? <a href={c.link} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'none' }}>{(c.titulo || 'Ver aviso').slice(0, 32)} ↗</a> : <span style={{ color: '#94a3b8' }}>{(c.titulo || 'manual').slice(0, 32)}</span>}</td>
              <td style={td}>{fmt(c.sup_ponderada)}</td>
              <td style={td}>{fmt(c.oferta_uf)}</td>
              <td style={td}>{c.ajuste_amenidades ? (c.ajuste_amenidades > 0 ? '+' : '') + fmt(c.ajuste_amenidades) : '—'}</td>
              <td style={td}>{fmt(c.valor_homologado)}</td>
              <td style={td}><b>{fmt2(c.uf_m2)}</b></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
