// VERSION: v2 · 2026-07-10 · Página Incidencias (Mantención) — mobile-first · imports alineados al repo
'use client';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useSession } from 'next-auth/react';
import useIsMobile from '@/lib/useIsMobile';
import FotoCapturaEtapa from '@/app/components/FotoCapturaEtapa';
import TopNav from '@/app/components/ui/TopNav';

// ---------- Catálogos (alineados al esquema SQL v1) ----------
const CATEGORIAS = [
  ['sanitario', 'Sanitario'], ['electrico', 'Eléctrico'], ['gas', 'Gas'],
  ['estructural', 'Estructural'], ['cerrajeria', 'Cerrajería'], ['ascensor', 'Ascensor'],
  ['accesos', 'Accesos'], ['electrodomestico', 'Electrodoméstico'], ['seguridad', 'Seguridad'],
  ['otros', 'Otros'],
];
const CANALES = [
  ['email', 'Email'], ['whatsapp', 'WhatsApp'], ['formulario', 'Formulario'],
  ['telefono', 'Teléfono'], ['interno', 'Interno'],
];
const URGENCIAS = [
  ['alta', 'Alta', '#dc2626', '24h'],
  ['media', 'Media', '#d97706', '72h'],
  ['baja', 'Baja', '#16a34a', '7 días'],
];
// Orden del flujo (alineado al Motor: Reporte → Clasificar → Validar → Resolver → Cierre)
const ESTADOS = [
  ['reporte', 'Reporte', '#6b7280'],
  ['clasificada', 'Clasificada', '#2563eb'],
  ['validada', 'Validada', '#7c3aed'],
  ['en_resolucion', 'En resolución', '#0891b2'],
  ['esperando_aprobacion', 'Esperando aprobación', '#d97706'],
  ['cerrada', 'Cerrada', '#16a34a'],
  ['descartada', 'Descartada', '#9ca3af'],
];
const FLUJO = ['reporte', 'clasificada', 'validada', 'en_resolucion', 'esperando_aprobacion', 'cerrada'];
const label = (arr, k) => (arr.find((x) => x[0] === k)?.[1]) || k;
const colorEstado = (k) => ESTADOS.find((x) => x[0] === k)?.[2] || '#6b7280';
const infoUrgencia = (k) => URGENCIAS.find((x) => x[0] === k) || URGENCIAS[1];

// Etapas que llevan evidencia fotográfica
const ETAPAS_FOTO = [
  ['reporte', 'Fotos del reporte'],
  ['validacion', 'Fotos de validación'],
  ['resolucion', 'Fotos del arreglo'],
  ['cierre', 'Fotos de cierre'],
];

// ---------- Utilidades ----------
function chip(texto, color) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 12,
      fontWeight: 600, color: '#fff', background: color, whiteSpace: 'nowrap',
    }}>{texto}</span>
  );
}
function venc(inc) {
  if (!inc.fecha_limite || inc.estado === 'cerrada' || inc.estado === 'descartada') return null;
  const ms = new Date(inc.fecha_limite).getTime() - Date.now();
  if (ms < 0) return { txt: 'Vencida', color: '#dc2626' };
  if (ms < 24 * 3600 * 1000) return { txt: 'Vence pronto', color: '#d97706' };
  return null;
}

export default function IncidenciasPage() {
  const isMobile = useIsMobile();
  const { data: session } = useSession();
  const usuario = session?.user?.email || null;

  const [incidencias, setIncidencias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState('lista'); // 'lista' | 'nueva' | 'detalle'
  const [sel, setSel] = useState(null);
  const [filtros, setFiltros] = useState({ estado: '', urgencia: '', categoria: '', q: '' });

  const cargar = useCallback(async () => {
    setCargando(true);
    const { data, error } = await supabase
      .from('incidencias').select('*').order('fecha_reporte', { ascending: false });
    if (error) console.error(error);
    setIncidencias(data || []);
    setCargando(false);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const lista = useMemo(() => {
    const q = filtros.q.trim().toLowerCase();
    return incidencias.filter((i) =>
      (!filtros.estado || i.estado === filtros.estado) &&
      (!filtros.urgencia || i.urgencia === filtros.urgencia) &&
      (!filtros.categoria || i.categoria === filtros.categoria) &&
      (!q || [i.numero_ticket, i.idadmon, i.inmueble, i.descripcion, i.reportado_por]
        .filter(Boolean).some((c) => String(c).toLowerCase().includes(q)))
    );
  }, [incidencias, filtros]);

  function abrir(inc) { setSel(inc); setVista('detalle'); }

  // ---------- Vistas ----------
  return (
    <>
    <TopNav />
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '12px 12px 88px' : '20px 24px' }}>

      {vista === 'lista' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h1 style={{ fontSize: isMobile ? 20 : 26, fontWeight: 700, margin: 0 }}>Incidencias</h1>
            {!isMobile && (
              <button onClick={() => setVista('nueva')} style={btnPrimary}>+ Nueva incidencia</button>
            )}
          </div>

          <Filtros filtros={filtros} setFiltros={setFiltros} isMobile={isMobile} />

          {cargando ? (
            <p style={{ color: '#6b7280' }}>Cargando…</p>
          ) : lista.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No hay incidencias que coincidan.</p>
          ) : isMobile ? (
            <ListaTarjetas lista={lista} onAbrir={abrir} />
          ) : (
            <TablaEscritorio lista={lista} onAbrir={abrir} />
          )}

          {/* FAB solo en móvil */}
          {isMobile && (
            <button onClick={() => setVista('nueva')} aria-label="Nueva incidencia"
              style={{ position: 'fixed', right: 18, bottom: 18, width: 56, height: 56, borderRadius: 28,
                       border: 'none', background: '#111827', color: '#fff', fontSize: 28, lineHeight: '56px',
                       boxShadow: '0 6px 16px rgba(0,0,0,.25)', cursor: 'pointer' }}>+</button>
          )}
        </>
      )}

      {vista === 'nueva' && (
        <FormularioNueva
          usuario={usuario} isMobile={isMobile}
          onCancelar={() => setVista('lista')}
          onCreada={async () => { await cargar(); setVista('lista'); }}
        />
      )}

      {vista === 'detalle' && sel && (
        <Detalle
          inc={sel} usuario={usuario} isMobile={isMobile}
          onVolver={() => { setVista('lista'); }}
          onCambio={async () => { await cargar(); const fresca = (await supabase.from('incidencias').select('*').eq('id', sel.id).single()).data; if (fresca) setSel(fresca); }}
        />
      )}
    </div>
    </>
  );
}

// ---------- Filtros ----------
function Filtros({ filtros, setFiltros, isMobile }) {
  const set = (k) => (e) => setFiltros((f) => ({ ...f, [k]: e.target.value }));
  return (
    <div style={{ display: 'grid', gap: 8, marginBottom: 14,
                  gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr) 1fr' }}>
      <input placeholder="Buscar…" value={filtros.q} onChange={set('q')}
             style={{ ...input, gridColumn: isMobile ? '1 / -1' : 'auto' }} />
      <select value={filtros.estado} onChange={set('estado')} style={input}>
        <option value="">Estado: todos</option>
        {ESTADOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      <select value={filtros.urgencia} onChange={set('urgencia')} style={input}>
        <option value="">Urgencia: todas</option>
        {URGENCIAS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      <select value={filtros.categoria} onChange={set('categoria')} style={input}>
        <option value="">Categoría: todas</option>
        {CATEGORIAS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
    </div>
  );
}

// ---------- Lista móvil (tarjetas) ----------
function ListaTarjetas({ lista, onAbrir }) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {lista.map((i) => {
        const v = venc(i);
        return (
          <button key={i.id} onClick={() => onAbrir(i)}
            style={{ textAlign: 'left', border: '1px solid #e5e7eb', borderRadius: 12, padding: 12,
                     background: '#fff', cursor: 'pointer', minHeight: 44 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>{i.numero_ticket}</span>
              {chip(label(ESTADOS, i.estado), colorEstado(i.estado))}
            </div>
            <div style={{ fontSize: 14, color: '#111827', marginBottom: 6 }}>
              {i.inmueble || i.idadmon} · {label(CATEGORIAS, i.categoria)}
            </div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8,
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {i.descripcion}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              {chip(infoUrgencia(i.urgencia)[1], infoUrgencia(i.urgencia)[2])}
              {v && chip(v.txt, v.color)}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ---------- Tabla escritorio ----------
function TablaEscritorio({ lista, onAbrir }) {
  return (
    <div style={{ overflow: 'hidden', border: '1px solid #e5e7eb', borderRadius: 12 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
            {['Ticket', 'Inmueble / IDADMON', 'Categoría', 'Urgencia', 'Estado', 'Reporte'].map((h) => (
              <th key={h} style={{ padding: '10px 12px', fontWeight: 600, color: '#374151' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lista.map((i) => {
            const v = venc(i);
            return (
              <tr key={i.id} onClick={() => onAbrir(i)}
                  style={{ borderTop: '1px solid #f1f5f9', cursor: 'pointer' }}>
                <td style={{ padding: '10px 12px', fontWeight: 600 }}>{i.numero_ticket}</td>
                <td style={{ padding: '10px 12px' }}>{i.inmueble || i.idadmon}</td>
                <td style={{ padding: '10px 12px' }}>{label(CATEGORIAS, i.categoria)}</td>
                <td style={{ padding: '10px 12px' }}>
                  {chip(infoUrgencia(i.urgencia)[1], infoUrgencia(i.urgencia)[2])}
                  {v && <span style={{ marginLeft: 6 }}>{chip(v.txt, v.color)}</span>}
                </td>
                <td style={{ padding: '10px 12px' }}>{chip(label(ESTADOS, i.estado), colorEstado(i.estado))}</td>
                <td style={{ padding: '10px 12px', color: '#6b7280' }}>
                  {i.fecha_reporte ? new Date(i.fecha_reporte).toLocaleDateString('es-CL') : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Formulario nueva incidencia ----------
function FormularioNueva({ usuario, isMobile, onCancelar, onCreada }) {
  const [f, setF] = useState({
    idadmon: '', inmueble: '', ubicacion: '', propietario: '', reportado_por: '', canal: 'email',
    categoria: 'sanitario', urgencia: 'media', descripcion: '',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [lookup, setLookup] = useState({ estado: 'idle', msg: '', color: '#6b7280' });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  // Al escribir el IDADMON y salir del campo (o Enter), trae la propiedad de datos_arriendos.
  async function buscarIdadmon() {
    const id = f.idadmon.trim();
    if (!id) { setLookup({ estado: 'idle', msg: '', color: '#6b7280' }); return; }
    setLookup({ estado: 'buscando', msg: 'Buscando propiedad…', color: '#6b7280' });
    const { data, error: e } = await supabase
      .from('datos_arriendos')
      .select('idadmon, inmueble, propietario, estado')
      .eq('idadmon', id)
      .limit(1)
      .maybeSingle();
    if (e) {
      setLookup({ estado: 'error', msg: 'No se pudo consultar la propiedad: ' + (e.message || e), color: '#d97706' });
      return;
    }
    if (!data) {
      setLookup({ estado: 'nada', msg: `IDADMON "${id}" no está en datos_arriendos — completa el inmueble a mano.`, color: '#d97706' });
      return;
    }
    setF((s) => ({
      ...s,
      inmueble: data.inmueble || s.inmueble,
      ubicacion: data.inmueble || s.ubicacion,
      propietario: data.propietario || s.propietario,
    }));
    setLookup({
      estado: 'ok',
      msg: `✓ ${data.inmueble || 'Inmueble s/d'}${data.propietario ? ' · ' + data.propietario : ''}${data.estado ? ' · estado ' + data.estado : ''}`,
      color: '#16a34a',
    });
  }

  async function generarTicket() {
    // INC-AAAAMMDD-NNN con secuencia diaria
    const hoy = new Date();
    const y = hoy.getFullYear();
    const m = String(hoy.getMonth() + 1).padStart(2, '0');
    const d = String(hoy.getDate()).padStart(2, '0');
    const prefijo = `INC-${y}${m}${d}-`;
    const desde = new Date(y, hoy.getMonth(), hoy.getDate()).toISOString();
    const { count } = await supabase.from('incidencias')
      .select('*', { count: 'exact', head: true }).gte('fecha_reporte', desde);
    return prefijo + String((count || 0) + 1).padStart(3, '0');
  }

  async function guardar(e) {
    e.preventDefault();
    if (!f.idadmon.trim() || !f.descripcion.trim()) {
      setError('IDADMON y descripción son obligatorios.');
      return;
    }
    setError(''); setGuardando(true);
    try {
      const numero_ticket = await generarTicket();
      const { error: err } = await supabase.from('incidencias').insert({
        ...f, numero_ticket, estado: 'reporte', creado_por: usuario,
      });
      if (err) throw err;
      await onCreada();
    } catch (err) {
      console.error(err);
      setError('No se pudo crear la incidencia: ' + (err?.message || err?.error_description || 'error desconocido') +
               (err?.hint ? ` (${err.hint})` : ''));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar}>
      <BotonVolver onClick={onCancelar} texto="Cancelar" />
      <h1 style={{ fontSize: isMobile ? 20 : 26, fontWeight: 700, margin: '4px 0 16px' }}>Nueva incidencia</h1>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr' }}>
        <Campo label="IDADMON (contrato) *">
          <input style={input} value={f.idadmon} placeholder="Ej. A00856"
            onChange={(e) => { const v = e.target.value; setF((s) => ({ ...s, idadmon: v }));
              setLookup((l) => (l.estado === 'idle' ? l : { estado: 'idle', msg: '', color: '#6b7280' })); }}
            onBlur={buscarIdadmon}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); buscarIdadmon(); } }} />
        </Campo>
        <Campo label="Inmueble / ubicación"><input style={input} value={f.inmueble} onChange={set('inmueble')} /></Campo>
        {lookup.msg && (
          <div style={{ gridColumn: '1 / -1', fontSize: 12, color: lookup.color, marginTop: -4 }}>{lookup.msg}</div>
        )}
        <Campo label="Propietario"><input style={input} value={f.propietario} onChange={set('propietario')} /></Campo>
        <Campo label="Reportado por"><input style={input} value={f.reportado_por} onChange={set('reportado_por')} /></Campo>
        <Campo label="Canal">
          <select style={input} value={f.canal} onChange={set('canal')}>
            {CANALES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Campo>
        <Campo label="Categoría">
          <select style={input} value={f.categoria} onChange={set('categoria')}>
            {CATEGORIAS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Campo>
        <Campo label="Urgencia">
          <select style={input} value={f.urgencia} onChange={set('urgencia')}>
            {URGENCIAS.map(([k, l, , plazo]) => <option key={k} value={k}>{l} · {plazo}</option>)}
          </select>
        </Campo>
        <div style={{ gridColumn: '1 / -1' }}>
          <Campo label="Descripción del problema *">
            <textarea style={{ ...input, minHeight: 96, resize: 'vertical' }} value={f.descripcion} onChange={set('descripcion')} />
          </Campo>
        </div>
      </div>

      {error && <div style={{ color: '#dc2626', fontSize: 13, marginTop: 10 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <button type="submit" disabled={guardando} style={btnPrimary}>
          {guardando ? 'Guardando…' : 'Crear incidencia'}
        </button>
        <button type="button" onClick={onCancelar} style={btnSecondary}>Cancelar</button>
      </div>
      <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 10 }}>
        Las fotos de evidencia se agregan por etapa una vez creada la incidencia.
      </p>
    </form>
  );
}

// ---------- Detalle ----------
function Detalle({ inc, usuario, isMobile, onVolver, onCambio }) {
  const [trabajando, setTrabajando] = useState(false);

  async function registrarHistorial(campo, antes, despues) {
    await supabase.from('incidencia_historial').insert({
      incidencia_id: inc.id, campo, valor_antes: String(antes ?? ''),
      valor_despues: String(despues ?? ''), usuario,
    });
  }

  async function cambiarEstado(nuevo) {
    setTrabajando(true);
    try {
      const patch = { estado: nuevo };
      if (nuevo === 'cerrada') patch.fecha_cierre = new Date().toISOString();
      const { error } = await supabase.from('incidencias').update(patch).eq('id', inc.id);
      if (error) throw error;
      await registrarHistorial('estado', inc.estado, nuevo);
      await onCambio();
    } catch (err) {
      console.error(err);
    } finally {
      setTrabajando(false);
    }
  }

  const idx = FLUJO.indexOf(inc.estado);
  const siguiente = idx >= 0 && idx < FLUJO.length - 1 ? FLUJO[idx + 1] : null;
  const v = venc(inc);

  return (
    <div>
      <BotonVolver onClick={onVolver} texto="Volver a la lista" />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '4px 0 12px' }}>
        <h1 style={{ fontSize: isMobile ? 20 : 26, fontWeight: 700, margin: 0 }}>{inc.numero_ticket}</h1>
        {chip(label(ESTADOS, inc.estado), colorEstado(inc.estado))}
        {chip(infoUrgencia(inc.urgencia)[1], infoUrgencia(inc.urgencia)[2])}
        {v && chip(v.txt, v.color)}
      </div>

      <Bloque titulo="Información">
        <Dato k="Inmueble / IDADMON" v={`${inc.inmueble || '—'} · ${inc.idadmon}`} />
        <Dato k="Categoría" v={label(CATEGORIAS, inc.categoria)} />
        <Dato k="Reportado por" v={`${inc.reportado_por || '—'} (${label(CANALES, inc.canal)})`} />
        <Dato k="Fecha reporte" v={inc.fecha_reporte ? new Date(inc.fecha_reporte).toLocaleString('es-CL') : '—'} />
        <Dato k="Fecha límite" v={inc.fecha_limite ? new Date(inc.fecha_limite).toLocaleString('es-CL') : '—'} />
        {inc.fecha_cierre && <Dato k="Cierre" v={new Date(inc.fecha_cierre).toLocaleString('es-CL')} />}
        <Dato k="Asignado a" v={inc.asignado_a || '—'} />
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>Descripción</div>
          <div style={{ fontSize: 14 }}>{inc.descripcion}</div>
        </div>
        {inc.solucion_aplicada && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>Solución aplicada</div>
            <div style={{ fontSize: 14 }}>{inc.solucion_aplicada}</div>
          </div>
        )}
      </Bloque>

      <Bloque titulo="Evidencia por etapa">
        {ETAPAS_FOTO.map(([etapa, titulo]) => (
          <FotoCapturaEtapa key={etapa} incidenciaId={inc.id} etapa={etapa} titulo={titulo} subidoPor={usuario} />
        ))}
      </Bloque>

      <Bloque titulo="Reparación">
        <ProveedorSection inc={inc} usuario={usuario} onCambio={onCambio} />
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f1f5f9', fontSize: 13, color: '#6b7280' }}>
          Presupuesto: {inc.presupuesto_id ? `#${inc.presupuesto_id}` : 'sin presupuesto (no toda incidencia genera uno)'}
          {' · '}<span style={{ color: '#9ca3af' }}>crear/asociar presupuesto: próximo paso</span>
        </div>
      </Bloque>

      {/* Barra de acción de estado (sticky en móvil) */}
      <div style={{
        position: isMobile ? 'sticky' : 'static', bottom: 0, background: '#fff',
        borderTop: isMobile ? '1px solid #e5e7eb' : 'none', padding: isMobile ? '10px 0' : '4px 0',
        display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8,
      }}>
        {siguiente && (
          <button disabled={trabajando} onClick={() => cambiarEstado(siguiente)} style={btnPrimary}>
            Avanzar a: {label(ESTADOS, siguiente)}
          </button>
        )}
        {inc.estado !== 'cerrada' && inc.estado !== 'descartada' && (
          <button disabled={trabajando} onClick={() => cambiarEstado('descartada')} style={btnSecondary}>
            Descartar
          </button>
        )}
      </div>
    </div>
  );
}

// ---------- Asignar proveedor (contactos con rol 'proveedor') ----------
function ProveedorSection({ inc, usuario, onCambio }) {
  const [proveedores, setProveedores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data, error } = await supabase
        .from('contactos')
        .select('id, nombre, empresa, telefono, whatsapp, email, roles')
        .eq('activo', true)
        .order('nombre');
      if (!vivo) return;
      if (error) { console.error(error); setMsg('No se pudieron cargar proveedores: ' + error.message); }
      setProveedores((data || []).filter((c) => (c.roles || []).includes('proveedor')));
      setCargando(false);
    })();
    return () => { vivo = false; };
  }, []);

  const actual = proveedores.find((p) => String(p.id) === String(inc.proveedor_id));
  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    const base = t
      ? proveedores.filter((p) => [p.nombre, p.empresa].filter(Boolean).some((x) => x.toLowerCase().includes(t)))
      : proveedores;
    return base.slice(0, 30);
  }, [q, proveedores]);

  async function asignar(id) {
    setMsg('');
    const { error } = await supabase.from('incidencias').update({ proveedor_id: id }).eq('id', inc.id);
    if (error) { setMsg('No se pudo asignar: ' + error.message); return; }
    await supabase.from('incidencia_historial').insert({
      incidencia_id: inc.id, campo: 'proveedor_id',
      valor_antes: String(inc.proveedor_id ?? ''), valor_despues: String(id ?? ''), usuario,
    });
    setAbierto(false); setQ('');
    await onCambio();
  }

  const soloDigitos = (t) => (t || '').replace(/\D/g, '');
  const telHref = (t) => (t || '').replace(/[^\d+]/g, '');

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Proveedor asignado</div>

      {actual ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ marginRight: 'auto' }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{actual.nombre}{actual.empresa ? ` · ${actual.empresa}` : ''}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{actual.telefono || actual.whatsapp || actual.email || 'sin contacto'}</div>
          </div>
          {(actual.whatsapp || actual.telefono) &&
            <a href={`https://wa.me/${soloDigitos(actual.whatsapp || actual.telefono)}`} target="_blank" rel="noreferrer" style={miniBtn}>WhatsApp</a>}
          {actual.telefono && <a href={`tel:${telHref(actual.telefono)}`} style={miniBtn}>Llamar</a>}
          <button onClick={() => setAbierto((b) => !b)} style={miniBtn}>{abierto ? 'Cerrar' : 'Cambiar'}</button>
          <button onClick={() => asignar(null)} style={miniBtn}>Quitar</button>
        </div>
      ) : (
        <div style={{ marginBottom: 8, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: '#6b7280' }}>Sin proveedor asignado.</span>
          <button onClick={() => setAbierto(true)} style={btnSecondary}>Asignar proveedor</button>
        </div>
      )}

      {abierto && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }}>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} style={{ ...input, marginBottom: 8 }}
                 placeholder={cargando ? 'Cargando proveedores…' : 'Buscar por nombre o empresa…'} />
          <div style={{ maxHeight: 220, overflowY: 'auto', display: 'grid', gap: 4 }}>
            {filtrados.map((p) => (
              <button key={p.id} onClick={() => asignar(p.id)}
                style={{ textAlign: 'left', padding: '8px 10px', borderRadius: 6, border: '1px solid #eee',
                         background: '#fff', cursor: 'pointer', minHeight: 40 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{p.nombre}</span>
                {p.empresa && <span style={{ color: '#6b7280', fontSize: 13 }}> · {p.empresa}</span>}
                {(p.telefono || p.whatsapp) && <span style={{ color: '#9ca3af', fontSize: 12 }}> · {p.telefono || p.whatsapp}</span>}
              </button>
            ))}
            {!cargando && filtrados.length === 0 && (
              <div style={{ fontSize: 13, color: '#6b7280', padding: 6 }}>
                Sin coincidencias. Los proveedores se marcan con el rol “proveedor” en Contactos.
              </div>
            )}
          </div>
        </div>
      )}

      {msg && <div style={{ color: '#dc2626', fontSize: 12, marginTop: 6 }}>{msg}</div>}
    </div>
  );
}

// ---------- Piezas UI ----------
function Campo({ label, children }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{label}</div>
      {children}
    </label>
  );
}
function Bloque({ titulo, children }) {
  return (
    <section style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 14, marginBottom: 12 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 10px' }}>{titulo}</h2>
      {children}
    </section>
  );
}
function Dato({ k, v }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '3px 0', fontSize: 14 }}>
      <span style={{ color: '#6b7280' }}>{k}</span>
      <span style={{ textAlign: 'right' }}>{v}</span>
    </div>
  );
}
function BotonVolver({ onClick, texto }) {
  return (
    <button onClick={onClick} style={{ background: 'none', border: 'none', color: '#2563eb',
      cursor: 'pointer', fontSize: 14, padding: '6px 0', minHeight: 44 }}>← {texto}</button>
  );
}

// ---------- Estilos base ----------
const input = {
  width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8,
  fontSize: 16, boxSizing: 'border-box', minHeight: 44, background: '#fff',
};
const btnPrimary = {
  padding: '11px 18px', border: 'none', borderRadius: 8, background: '#111827', color: '#fff',
  fontSize: 15, fontWeight: 600, cursor: 'pointer', minHeight: 44,
};
const btnSecondary = {
  padding: '11px 18px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff',
  color: '#374151', fontSize: 15, fontWeight: 600, cursor: 'pointer', minHeight: 44,
};
const miniBtn = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 36,
  padding: '0 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff',
  color: '#111827', fontSize: 13, fontWeight: 600, textDecoration: 'none', cursor: 'pointer',
};