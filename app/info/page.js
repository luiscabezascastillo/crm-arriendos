'use client';
import { useState } from 'react';

// ─── Datos de documentación ───────────────────────────────────────────────────
const MODULOS = [
  {
    id: 'morosidad',
    label: 'Morosidad',
    icono: '⚠️',
    color: '#E8593C',
    colorLight: '#FDF1EE',
    estado: 'En desarrollo',
    estadoColor: '#E8593C',
    resumen: 'Detección automática de arrendatarios con saldo impago, gestión de notificaciones previas y aplicación de multas diarias configurables.',
    secciones: [
      {
        id: 'overview',
        titulo: 'Visión general',
        contenido: null,
        diagrama: 'flujo',
      },
      {
        id: 'logica',
        titulo: 'Lógica de negocio',
        contenido: [
          { label: 'Fuente de datos', texto: 'Tabla cuentas — se detectan IDADMONs con saldo > 0 en conceptos de arriendo o garantía.' },
          { label: 'Definición de moroso', texto: 'Contrato con cargo sin abono suficiente. El sistema cruza con datos_arriendos para obtener nombre del arrendatario, inmueble y cuota vigente.' },
          { label: 'Días de gracia', texto: '10 días naturales desde el vencimiento antes de que el sistema marque al contrato como candidato a multa.' },
          { label: 'Notificación previa', texto: 'Antes de aplicar la multa se debe registrar una notificación por email. La fecha de esa notificación es el punto de inicio del cómputo de la multa.' },
          { label: 'Fórmula de multa', texto: 'Multa = Deuda base × (% diario × días transcurridos desde fecha inicio). El porcentaje por defecto es 1% diario y es editable por contrato.' },
          { label: 'Registro doble', texto: 'La multa aplicada se guarda en la tabla morosidad_multas y genera automáticamente un cargo en tabla cuentas con concepto "MULTA MORA".' },
        ],
        diagrama: null,
      },
      {
        id: 'tabla',
        titulo: 'Tabla Supabase',
        contenido: null,
        diagrama: 'tabla',
      },
      {
        id: 'pantalla',
        titulo: 'Pantalla principal',
        contenido: [
          { label: 'Ruta', texto: '/op/morosidad — accesible desde TopNav Op. especiales y desde CC1 dropdown.' },
          { label: 'KPIs superiores', texto: 'Total morosos | Deuda total acumulada | Multas aplicadas este mes | Monto total multas.' },
          { label: 'Tabla con filtros', texto: 'IDADMON · Arrendatario · Inmueble · Saldo deuda · Días en mora · Estado multa. Filtros dropdown estilo Excel en cada cabecera.' },
          { label: 'Acciones por fila', texto: 'Botón Notificar (genera email) · Botón Aplicar multa (abre drawer lateral).' },
          { label: 'Drawer lateral', texto: 'Al pinchar un IDADMON: detalle de cargos desde cuentas · campo fecha inicio editable · campo % diario editable · cálculo en tiempo real · historial de multas anteriores.' },
        ],
        diagrama: null,
      },
      {
        id: 'archivos',
        titulo: 'Archivos a crear',
        contenido: null,
        diagrama: 'archivos',
      },
    ],
  },
  {
    id: 'cc1',
    label: 'CC1 Admin',
    icono: '🏠',
    color: '#185FA5',
    colorLight: '#EBF3FB',
    estado: 'Activo',
    estadoColor: '#0F6E56',
    resumen: 'Listado de 835+ contratos con paginación server-side, filtros dropdown estilo Excel y acceso rápido a operaciones.',
    secciones: [
      {
        id: 'overview',
        titulo: 'Descripción',
        contenido: [
          { label: 'Ruta', texto: '/cc1 — accesible desde TopNav principal.' },
          { label: 'Contratos', texto: '835+ registros desde tabla datos_arriendos. Paginación de 15 por página procesada en Supabase.' },
          { label: 'Filtros', texto: 'Dropdowns Excel en IDADMON, Inmueble, Propietario, Estado, Cuota y Término. Todas las consultas van directamente a Supabase con ilike/eq/order.' },
          { label: 'Estados', texto: 'S = Activo · P = Vacío · Q = En término · SQ · O · Inactiva.' },
          { label: 'Acceso a Deudas', texto: 'Botón Operaciones con dropdown que incluye acceso directo a /op/deudas.' },
        ],
        diagrama: null,
      },
    ],
  },
  {
    id: 'deudas',
    label: 'Deudas servicios',
    icono: '💡',
    color: '#3B6D11',
    colorLight: '#EAF3DE',
    estado: 'Activo',
    estadoColor: '#0F6E56',
    resumen: 'Control mensual de deudas de GGCC, luz, agua y gas por contrato. Cargado desde Comunidad Feliz y fuentes externas.',
    secciones: [
      {
        id: 'overview',
        titulo: 'Descripción',
        contenido: [
          { label: 'Ruta', texto: '/op/deudas — accesible desde CC1 dropdown y TopNav Op. especiales.' },
          { label: 'Tabla', texto: 'ggcc_agua_luz — 220 contratos Mayo 2026. Meses cargados: OCT 2025 → MAY 2026.' },
          { label: 'KPIs', texto: 'Contratos totales · con deuda · sin deuda · deuda total por mes.' },
          { label: 'Semáforos', texto: 'Indicador visual por servicio: GGCC / Luz / Agua / Gas.' },
          { label: 'Drawer', texto: 'Al pinchar IDADMON: detalle por servicio + gráfico evolución + historial GGCC.' },
        ],
        diagrama: null,
      },
    ],
  },
  {
    id: 'cf',
    label: 'Comunidad Feliz',
    icono: '📋',
    color: '#854F0B',
    colorLight: '#FAEEDA',
    estado: 'Activo',
    estadoColor: '#0F6E56',
    resumen: 'Procesamiento mensual del archivo AAMM_CF.xlsx desde Google Drive. Cruza con tabla cf_correspondencias y carga en ggcc_agua_luz.',
    secciones: [
      {
        id: 'overview',
        titulo: 'Descripción',
        contenido: [
          { label: 'Ruta', texto: '/op/comunidad-feliz.' },
          { label: 'Fuente', texto: 'Lee AAMM_CF.xlsx desde carpeta Drive 1qE47HbwpDg32hkMUJIxRuWTRNA6Uhj47 (Unidad Compartida).' },
          { label: 'Matching', texto: '~155 matches de 174 registros. Cruza por cf_correspondencias.' },
          { label: 'Destino', texto: 'Guarda en ggcc_agua_luz con constraint único (idadmon, idinmue, mes).' },
        ],
        diagrama: null,
      },
    ],
  },
];

// ─── Diagramas SVG inline ─────────────────────────────────────────────────────
function DiagramaFlujo() {
  return (
    <svg width="100%" viewBox="0 0 640 480" style={{ display: 'block', margin: '24px 0' }}>
      <defs>
        <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M2 1L8 5L2 9" fill="none" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </marker>
      </defs>

      {/* FUENTE */}
      <rect x="30" y="30" width="150" height="52" rx="8" fill="#F1EFE8" stroke="#B4B2A9" strokeWidth="0.5"/>
      <text x="105" y="52" textAnchor="middle" fontSize="12" fontWeight="500" fill="#444441">Tabla cuentas</text>
      <text x="105" y="68" textAnchor="middle" fontSize="11" fill="#888780">Cargos sin abono</text>

      {/* DATOS ARRIENDOS */}
      <rect x="460" y="30" width="150" height="52" rx="8" fill="#F1EFE8" stroke="#B4B2A9" strokeWidth="0.5"/>
      <text x="535" y="52" textAnchor="middle" fontSize="12" fontWeight="500" fill="#444441">datos_arriendos</text>
      <text x="535" y="68" textAnchor="middle" fontSize="11" fill="#888780">Arrendatario, cuota</text>

      {/* DETECCIÓN */}
      <rect x="220" y="30" width="200" height="52" rx="8" fill="#FAEEDA" stroke="#EF9F27" strokeWidth="1"/>
      <text x="320" y="52" textAnchor="middle" fontSize="12" fontWeight="500" fill="#633806">Detección morosos</text>
      <text x="320" y="68" textAnchor="middle" fontSize="11" fill="#854F0B">saldo &gt; 0 en cuentas</text>

      <line x1="180" y1="56" x2="218" y2="56" stroke="#888" strokeWidth="0.8" markerEnd="url(#arr)"/>
      <line x1="422" y1="56" x2="460" y2="56" stroke="#888" strokeWidth="0.8" markerEnd="url(#arr)" style={{transform:'scaleX(-1)', transformOrigin:'441px 56px'}}/>
      <line x1="460" y1="56" x2="422" y2="56" stroke="#888" strokeWidth="0.8" markerEnd="url(#arr)"/>

      {/* LISTADO MOROSOS */}
      <rect x="170" y="140" width="300" height="52" rx="8" fill="#E6F1FB" stroke="#378ADD" strokeWidth="1"/>
      <text x="320" y="162" textAnchor="middle" fontSize="12" fontWeight="500" fill="#042C53">/op/morosidad — listado</text>
      <text x="320" y="178" textAnchor="middle" fontSize="11" fill="#185FA5">KPIs + tabla + filtros Excel</text>
      <line x1="320" y1="82" x2="320" y2="138" stroke="#888" strokeWidth="0.8" markerEnd="url(#arr)"/>

      {/* NOTIFICAR */}
      <rect x="30" y="250" width="150" height="52" rx="8" fill="#E1F5EE" stroke="#1D9E75" strokeWidth="0.8"/>
      <text x="105" y="272" textAnchor="middle" fontSize="12" fontWeight="500" fill="#04342C">Notificar</text>
      <text x="105" y="288" textAnchor="middle" fontSize="11" fill="#0F6E56">Email aviso previo</text>

      {/* DRAWER MULTA */}
      <rect x="230" y="250" width="180" height="52" rx="8" fill="#FAECE7" stroke="#D85A30" strokeWidth="1"/>
      <text x="320" y="272" textAnchor="middle" fontSize="12" fontWeight="500" fill="#4A1B0C">Aplicar multa</text>
      <text x="320" y="288" textAnchor="middle" fontSize="11" fill="#993C1D">Drawer con parámetros</text>

      {/* HISTORIAL */}
      <rect x="460" y="250" width="150" height="52" rx="8" fill="#EEEDFE" stroke="#534AB7" strokeWidth="0.8"/>
      <text x="535" y="272" textAnchor="middle" fontSize="12" fontWeight="500" fill="#26215C">Historial</text>
      <text x="535" y="288" textAnchor="middle" fontSize="11" fill="#3C3489">Multas anteriores</text>

      <line x1="240" y1="192" x2="105" y2="248" stroke="#888" strokeWidth="0.8" markerEnd="url(#arr)"/>
      <line x1="320" y1="192" x2="320" y2="248" stroke="#888" strokeWidth="0.8" markerEnd="url(#arr)"/>
      <line x1="400" y1="192" x2="535" y2="248" stroke="#888" strokeWidth="0.8" markerEnd="url(#arr)"/>

      {/* PARÁMETROS DRAWER */}
      <rect x="120" y="360" width="400" height="90" rx="8" fill="#FDF1EE" stroke="#E8593C" strokeWidth="0.8"/>
      <text x="320" y="382" textAnchor="middle" fontSize="12" fontWeight="500" fill="#4A1B0C">Drawer: calcular y aplicar multa</text>
      <rect x="136" y="394" width="110" height="28" rx="4" fill="#fff" stroke="#E8593C" strokeWidth="0.5"/>
      <text x="191" y="412" textAnchor="middle" fontSize="10" fill="#993C1D">Fecha inicio multa</text>
      <rect x="264" y="394" width="110" height="28" rx="4" fill="#fff" stroke="#E8593C" strokeWidth="0.5"/>
      <text x="319" y="412" textAnchor="middle" fontSize="10" fill="#993C1D">% diario (def. 1%)</text>
      <rect x="392" y="394" width="110" height="28" rx="4" fill="#fff" stroke="#E8593C" strokeWidth="0.5"/>
      <text x="447" y="412" textAnchor="middle" fontSize="10" fill="#993C1D">Monto calculado</text>
      <text x="320" y="440" textAnchor="middle" fontSize="10" fill="#71433A">Multa = Deuda × (% diario × días desde fecha inicio)</text>

      <line x1="320" y1="302" x2="320" y2="358" stroke="#E8593C" strokeWidth="0.8" markerEnd="url(#arr)"/>

      {/* TABLA BD */}
      <rect x="195" y="466" width="250" height="36" rx="8" fill="#EAF3DE" stroke="#639922" strokeWidth="0.8"/>
      <text x="320" y="489" textAnchor="middle" fontSize="11" fontWeight="500" fill="#173404">morosidad_multas + cargo en cuentas</text>
      <line x1="320" y1="450" x2="320" y2="464" stroke="#639922" strokeWidth="0.8" markerEnd="url(#arr)"/>
    </svg>
  );
}

function DiagramaTabla() {
  const cols = [
    { campo: 'id', tipo: 'bigserial', nota: 'PK' },
    { campo: 'idadmon', tipo: 'text', nota: 'FK → datos_arriendos' },
    { campo: 'arrendatario', tipo: 'text', nota: '' },
    { campo: 'inmueble', tipo: 'text', nota: '' },
    { campo: 'propietario', tipo: 'text', nota: '' },
    { campo: 'deuda_base', tipo: 'numeric', nota: 'monto sobre el que se calcula' },
    { campo: 'fecha_inicio', tipo: 'date', nota: 'desde cuándo corre la multa' },
    { campo: 'porcentaje', tipo: 'numeric', nota: 'default 1.0 (%)' },
    { campo: 'dias', tipo: 'integer', nota: 'calculado al aplicar' },
    { campo: 'monto_multa', tipo: 'numeric', nota: 'resultado final' },
    { campo: 'estado', tipo: 'text', nota: 'pendiente / aplicada / anulada' },
    { campo: 'notas', tipo: 'text', nota: '' },
    { campo: 'creado_por', tipo: 'text', nota: 'email operador' },
    { campo: 'created_at', tipo: 'timestamptz', nota: 'default now()' },
  ];
  return (
    <div style={{ margin: '16px 0', overflowX: 'auto' }}>
      <div style={{ display: 'inline-block', minWidth: '100%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '180px 140px 1fr', borderBottom: '1px solid #ddd', paddingBottom: '6px', marginBottom: '4px' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Campo</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tipo</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Descripción</span>
        </div>
        {cols.map((c, i) => (
          <div key={c.campo} style={{
            display: 'grid',
            gridTemplateColumns: '180px 140px 1fr',
            padding: '6px 0',
            borderBottom: '1px solid #f0f0f0',
            background: i % 2 === 0 ? 'transparent' : '#FAFAFA',
          }}>
            <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#E8593C', fontWeight: 600 }}>{c.campo}</span>
            <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#185FA5' }}>{c.tipo}</span>
            <span style={{ fontSize: 11, color: '#666' }}>{c.nota || '—'}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16, background: '#1a1a2e', borderRadius: 8, padding: '14px 16px', overflowX: 'auto' }}>
        <pre style={{ margin: 0, fontSize: 11, color: '#a8d8a8', lineHeight: 1.7, fontFamily: 'monospace' }}>{`create table morosidad_multas (
  id            bigserial primary key,
  idadmon       text not null,
  arrendatario  text,
  inmueble      text,
  propietario   text,
  deuda_base    numeric not null,
  fecha_inicio  date not null,
  porcentaje    numeric default 1.0,
  dias          integer,
  monto_multa   numeric,
  estado        text default 'pendiente',
  notas         text,
  creado_por    text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);`}</pre>
      </div>
    </div>
  );
}

function DiagramaArchivos() {
  const archivos = [
    { ruta: 'app/op/morosidad/page.js', desc: 'Página principal — KPIs, tabla, drawer', tipo: 'page', estado: 'crear' },
    { ruta: 'app/api/morosidad/aplicar/route.js', desc: 'Guarda multa + inserta cargo en cuentas', tipo: 'api', estado: 'crear' },
    { ruta: 'app/api/morosidad/historial/route.js', desc: 'Historial de multas por IDADMON', tipo: 'api', estado: 'crear' },
    { ruta: 'app/api/morosidad/morosos/route.js', desc: 'Lista IDAs con saldo > 0 desde cuentas', tipo: 'api', estado: 'crear' },
    { ruta: 'app/components/ui/TopNav.js', desc: 'Añadir Morosidad en Op. especiales dropdown', tipo: 'edit', estado: 'editar' },
  ];
  const colores = {
    page: { bg: '#E6F1FB', border: '#378ADD', text: '#042C53', label: 'PAGE' },
    api: { bg: '#EAF3DE', border: '#639922', text: '#173404', label: 'API' },
    edit: { bg: '#FAEEDA', border: '#EF9F27', text: '#412402', label: 'EDIT' },
  };
  return (
    <div style={{ margin: '16px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {archivos.map(a => {
        const c = colores[a.tipo];
        return (
          <div key={a.ruta} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 14px', borderRadius: 8,
            background: c.bg, border: `1px solid ${c.border}`,
          }}>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
              padding: '2px 6px', borderRadius: 4,
              background: c.border, color: '#fff', minWidth: 34, textAlign: 'center',
            }}>{c.label}</span>
            <code style={{ fontSize: 12, color: c.text, flex: 1, fontFamily: 'monospace' }}>{a.ruta}</code>
            <span style={{ fontSize: 11, color: '#666' }}>{a.desc}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Componente Módulo Card ───────────────────────────────────────────────────
function ModuloCard({ modulo, activo, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
        background: activo ? modulo.colorLight : 'transparent',
        borderLeft: activo ? `3px solid ${modulo.color}` : '3px solid transparent',
        borderRadius: activo ? '0 8px 8px 0' : '0 8px 8px 0',
        padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
        transition: 'all 0.15s ease',
      }}
    >
      <span style={{ fontSize: 18 }}>{modulo.icono}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: activo ? modulo.color : '#333' }}>{modulo.label}</div>
        <div style={{
          display: 'inline-block', fontSize: 9, fontWeight: 700,
          padding: '1px 6px', borderRadius: 3, marginTop: 2,
          background: modulo.estadoColor + '20',
          color: modulo.estadoColor,
          letterSpacing: '0.05em',
        }}>{modulo.estado}</div>
      </div>
    </button>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function InfoPage() {
  const [moduloActivo, setModuloActivo] = useState('morosidad');
  const [seccionActiva, setSeccionActiva] = useState('overview');

  const modulo = MODULOS.find(m => m.id === moduloActivo);
  const seccion = modulo?.secciones.find(s => s.id === seccionActiva);

  // Al cambiar módulo, resetear sección a la primera
  function cambiarModulo(id) {
    setModuloActivo(id);
    const m = MODULOS.find(x => x.id === id);
    setSeccionActiva(m?.secciones[0]?.id || 'overview');
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F8F7F4',
      fontFamily: '"DM Sans", "Segoe UI", sans-serif',
    }}>
      {/* HEADER */}
      <div style={{
        background: '#fff',
        borderBottom: '1px solid #E8E6E0',
        padding: '0 32px',
        display: 'flex', alignItems: 'center', gap: 16, height: 56,
      }}>
        <span style={{ fontSize: 18 }}>📖</span>
        <div>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>Información</span>
          <span style={{ fontSize: 12, color: '#888', marginLeft: 12 }}>Documentación técnica · CRM Arriendos · Fondo Capital</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <a href="/cc1" style={{
            fontSize: 12, color: '#185FA5', textDecoration: 'none',
            padding: '4px 10px', border: '1px solid #B5D4F4', borderRadius: 6,
            background: '#E6F1FB',
          }}>← CC1 Admin</a>
        </div>
      </div>

      <div style={{ display: 'flex', maxWidth: 1200, margin: '0 auto', minHeight: 'calc(100vh - 56px)' }}>

        {/* SIDEBAR MÓDULOS */}
        <div style={{
          width: 220, flexShrink: 0,
          background: '#fff',
          borderRight: '1px solid #E8E6E0',
          padding: '20px 0',
        }}>
          <div style={{ padding: '0 16px 12px', fontSize: 10, fontWeight: 700, color: '#aaa', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Módulos
          </div>
          {MODULOS.map(m => (
            <ModuloCard
              key={m.id}
              modulo={m}
              activo={moduloActivo === m.id}
              onClick={() => cambiarModulo(m.id)}
            />
          ))}
          <div style={{ margin: '20px 16px 12px', borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#aaa', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
              Próximamente
            </div>
            {['CC2', 'CC3', 'BB1', 'BB2', 'Nubox', 'Facturas'].map(n => (
              <div key={n} style={{ fontSize: 12, color: '#ccc', padding: '5px 14px' }}>· {n}</div>
            ))}
          </div>
        </div>

        {/* CONTENIDO PRINCIPAL */}
        <div style={{ flex: 1, padding: '32px 40px', overflowY: 'auto' }}>

          {/* Cabecera módulo */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <span style={{ fontSize: 28 }}>{modulo?.icono}</span>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#1a1a2e' }}>{modulo?.label}</h1>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                padding: '3px 8px', borderRadius: 4,
                background: modulo?.estadoColor + '20', color: modulo?.estadoColor,
              }}>{modulo?.estado}</span>
            </div>
            <p style={{ margin: 0, fontSize: 14, color: '#666', lineHeight: 1.6, maxWidth: 620 }}>
              {modulo?.resumen}
            </p>
          </div>

          {/* TABS secciones */}
          <div style={{
            display: 'flex', gap: 4, marginBottom: 28,
            borderBottom: '1px solid #E8E6E0', paddingBottom: 0,
          }}>
            {modulo?.secciones.map(s => (
              <button
                key={s.id}
                onClick={() => setSeccionActiva(s.id)}
                style={{
                  border: 'none', cursor: 'pointer',
                  padding: '8px 16px',
                  fontSize: 13, fontWeight: seccionActiva === s.id ? 600 : 400,
                  color: seccionActiva === s.id ? modulo.color : '#888',
                  background: 'transparent',
                  borderBottom: seccionActiva === s.id ? `2px solid ${modulo.color}` : '2px solid transparent',
                  marginBottom: -1,
                  transition: 'all 0.15s',
                }}
              >
                {s.titulo}
              </button>
            ))}
          </div>

          {/* CONTENIDO SECCIÓN */}
          <div style={{ maxWidth: 760 }}>
            {seccion?.diagrama === 'flujo' && (
              <div>
                <p style={{ fontSize: 14, color: '#555', lineHeight: 1.7, marginBottom: 8 }}>
                  El módulo detecta morosos cruzando la tabla <code style={{ background: '#F0EEE8', padding: '1px 5px', borderRadius: 3, fontSize: 12 }}>cuentas</code> con <code style={{ background: '#F0EEE8', padding: '1px 5px', borderRadius: 3, fontSize: 12 }}>datos_arriendos</code>, permite notificar al arrendatario y luego aplicar la multa desde un drawer lateral con parámetros editables.
                </p>
                <DiagramaFlujo />
              </div>
            )}

            {seccion?.diagrama === 'tabla' && <DiagramaTabla />}
            {seccion?.diagrama === 'archivos' && <DiagramaArchivos />}

            {seccion?.contenido && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {seccion.contenido.map((item, i) => (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: '180px 1fr',
                    borderBottom: '1px solid #F0EEE8',
                    padding: '14px 0',
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: modulo.color, paddingRight: 16, paddingTop: 1 }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: 13, color: '#444', lineHeight: 1.65 }}>
                      {item.texto}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
