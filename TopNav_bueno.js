'use client';
// VERSION: v11 ┬À 2026-08-12 ┬À Nuevo enlace "BB1" (Operaciones comerciales ┬À VENTAS) junto a BB2, mismo p├║blico
//   (Direcci├│n + Anthony). Orden en la barra: BB1, BB2. Hereda v10.
// VERSION: v10 ┬À 2026-08-12 ┬À El enlace "Captaciones" pasa a verse SOLO por Direcci├│n (Alberto y Luis); se quita
//   Administraci├│n. Hereda v9.
// VERSION: v9 ┬À 2026-08-12 ┬À Nuevo enlace "Captaciones" (cartera de propietarios) junto a BB2, visible para
//   Direcci├│n + Administraci├│n. Hereda v8.
// VERSION: v8 ┬À 2026-08-12 ┬À Nuevo enlace "BB2" (Operaciones comerciales ┬À arriendo sin adm├│n) en la barra, visible
//   SOLO para Direcci├│n (Alberto/Luis) + Anthony (Legal). Preparado para a├▒adir "BB1" al lado cuando exista.
//   Sin cambios en el resto de gates ni del men├║. Hereda v7.
// VERSION: v7 ┬À 2026-08-11 ┬À El bot├│n "Alertas" se abre por ROL: Administraci├│n (Adalis/Fabiola) y Legal
//   (Anthony) adem├ís de Karina + Direcci├│n. El badge cuenta lo de cada rol: Admin -> reclamaciones del d├¡a;
//   Legal -> t├®rminos sin valorar; Karina/Dir -> alertas propias + T├®rminos del d├¡a. Hereda v6.
// VERSION: v6 ┬À 2026-08-11 ┬À El badge "Alertas" (Karina + Direcci├│n) ahora PARPADEA en rojo cuando hay
//   pendientes: alertas propias o T├®rminos del d├¡a sin tratar. Mismo p├║blico que v5. Hereda v5.
// VERSION: v5 ┬À 2026-07-28 ┬À Bot├│n "Alertas" (Karina, Alberto, Luis) entre Ayuda y Mis tareas, con
//   SEM├üFORO seg├║n las alertas propias (para_email): rojo si hay alguna pendiente sin gestionar,
//   ├ímbar si todas las abiertas est├ín pospuestas (gestionadas), verde si no queda ninguna abierta.
// VERSION: v4 ┬À 2026-07-23 ┬À Bot├│n "Direccion" partido: el texto va a /direccion y la Ôû¥ abre un
//   dropdown con las operaciones propias de Direcci├│n (Control de Asistencia, Tareas, Valoraciones,
//   Budget y Problemas pendientes de crear, Reparar inicios). Mismo patr├│n que el bot├│n "Procesos".
//   Sin cambios en gates ni en el resto del men├║.
// VERSION: v3 ┬À 2026-07-21 ┬À Dropdown de 'Procesos en producci├│n' ordenado alfab├®ticamente por t├¡tulo.
// VERSION: v2 ┬À 2026-07-20 ┬À Rol 'comercial' ve su bloque Ventas (Publicaciones/Requerimientos/Visitas/Calendario/Contactos); Cumplea├▒os y Edificios ocultos salvo permiso. Tirza fuera de DIRECCION_EMAILS para pruebas de espejo.
// VERSION: v1 ┬À 2026-07-19 ┬À El men├║ "Propiedades" solo lo ve Direcci├│n (esDireccion: rol direccion
//   o email de direcci├│n), adem├ís del permiso de proceso que ya exist├¡a. Resto del TopNav sin cambios.
import { useState, useRef, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import { PROCESOS } from '../../../lib/procesos';

const DIRECCION_EMAILS = [
  'alberto.cabezas@fondocapital.com',
  'luis.cabezas@fondocapital.com',
  // 'tirza.chavez@fondocapital.com',   // fuera para probar el perfil Comercial (espejo de Lorena). Reponer si Tirza debe ser Direcci├│n.
];

// Qui├®n ve el bot├│n de Alertas (solo Karina + Direcci├│n; el resto tendr├í sus propias alertas m├ís adelante).
const ALERTAS_EMAILS = [
  'karina.morales@fondocapital.com',
  'alberto.cabezas@fondocapital.com',
  'luis.cabezas@fondocapital.com',
];

// --- Transici├│n de roles (Fase 1): traduce nombres viejos -> nuevos al vuelo.
// Permite que el c├│digo nuevo funcione mientras la BD a├║n tenga roles viejos.
const ROL_ALIAS = {
  admin: 'direccion',
  operaciones: 'administracion',
  tecnico: 'mantencion',
};
const normRol = (r) => ROL_ALIAS[r] || r;

// Roles internos de la empresa (todos menos 'comercial', que es externo).
const INTERNOS = ['direccion', 'administracion', 'mantencion', 'finanzas', 'legal', 'ventas'];

// RUTAS: deny by default. Lo que NO est├í listado aqu├¡, solo lo ve Direcci├│n.
const RUTAS = {
  '/panel':         INTERNOS,
  '/procesos':      INTERNOS,
  '/propiedades':   INTERNOS,
  '/procesos/mi-portal': INTERNOS,
  // Bloque Ventas (solo rol 'ventas', interno):
  '/publicaciones':  ['ventas', 'comercial'],
  '/requerimientos': ['ventas', 'comercial'],
  '/visitas':        ['ventas', 'comercial'],
  '/calendario':     ['ventas', 'comercial'],
  '/cumpleanos':     ['ventas'],
  '/contactos':      ['ventas', 'comercial'],
  '/edificios':      ['ventas'],
  // /admin (Config): NO se lista -> solo Direcci├│n.
};

const DOCS = {
  reglamento: 'https://drive.google.com/file/d/1P4z9A8CDHLzqDPce-ZNK3p_yEwvnMzpS/preview',
  procesos: '/procesos-2026.html',
  manual_deudas: 'https://docs.google.com/document/d/1gdZTAa3snBe2o9up3EqSGKOz6zMKlp-8/preview',
  manual_terminos: 'https://docs.google.com/document/d/19tsg6pTtkEXHMugI4Wmp8ClJkTaiQLYt/preview',
  manual_publicaciones: 'https://docs.google.com/document/d/11fYLCV_VT2xSPRO1RsrkBaAM7HZlI7ky/preview',
  manual_descuentos: '/manuales/descuentos.pdf',
  manual_bi: '/manuales/bi.pdf',
  manual_gestion_log: '/manuales/gestion-log.pdf',
};

// Portales del ecosistema FCR (selector FCR). CRM Interno es el actual.
const WORKSPACES = {
  propietarios: 'https://portal-propietarios-rose.vercel.app',
  web: 'https://www.fondocapital.com',
};

export default function TopNav() {
  const { data: session } = useSession();
  const [alertaSem, setAlertaSem] = useState({ color: null, n: 0 });
  const pathname = usePathname();
  const [fcrOpen, setFcrOpen] = useState(false);
  const [direccionOpen, setDireccionOpen] = useState(false);
  const [propiedadesOpen, setPropiedadesOpen] = useState(false);
  const [procesosOpen, setProcesosOpen] = useState(false);
  const [ventasOpen, setVentasOpen] = useState(false);
  const [ayudaOpen, setAyudaOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const fcrRef = useRef(null);
  const direccionRef = useRef(null);
  const propiedadesRef = useRef(null);
  const procesosRef = useRef(null);
  const ventasRef = useRef(null);
  const ayudaRef = useRef(null);
  const userRef = useRef(null);

  // Permisos por proceso (mismo criterio que la p├ígina /procesos): un proceso est├í
  // "con acceso" si el usuario tiene fila activa en proceso_permisos con esa key.
  const [procKeys, setProcKeys] = useState(new Set());
  useEffect(() => {
    if (!session?.user?.email) return;
    supabase.from('proceso_permisos').select('proceso').eq('email', session.user.email).eq('activo', true)
      .then(({ data }) => { if (data) setProcKeys(new Set(data.map(r => r.proceso))); });
  }, [session?.user?.email]);

  // Sem├íforo de Alertas: rojo si hay alguna 'pendiente'; si no, ├ímbar si hay 'pospuesta';
  // si no queda ninguna abierta, verde. Solo para quien ve el bot├│n.
  // Qui├®n ve el bot├│n de Alertas: Karina + Direcci├│n (por email/rol), Administraci├│n y Legal (por rol).
  const rolNav = normRol(session?.user?.role);
  const esDireccionNav = rolNav === 'direccion' || DIRECCION_EMAILS.includes(session?.user?.email);
  const esKarinaDir = ALERTAS_EMAILS.includes(session?.user?.email);
  const esAdminRol = rolNav === 'administracion';
  const esLegalRol = rolNav === 'legal';
  const puedeAlertas = esKarinaDir || esDireccionNav || esAdminRol || esLegalRol;
  useEffect(() => {
    if (!puedeAlertas || !session?.user?.email) return;
    let vivo = true;
    const calc = async () => {
      const { data } = await supabase.from('alertas').select('estado').eq('para_email', session.user.email);
      const pend = (data || []).filter(a => a.estado === 'pendiente').length;
      const posp = (data || []).filter(a => a.estado === 'pospuesta').length;
      let deRol = 0;   // pendientes de las tarjetas por rol
      try {
        if (esKarinaDir) {
          const j = await (await fetch('/api/alertas/terminos-del-dia', { cache: 'no-store' })).json();
          if (j && j.ok) deRol += j.total_pendientes || 0;
        }
        if (esAdminRol || esDireccionNav) {
          const j = await (await fetch('/api/alertas/reclamaciones', { cache: 'no-store' })).json();
          if (j && j.ok) deRol += (j.reclamaciones || []).length;
        }
        if (esLegalRol || esDireccionNav) {
          const j = await (await fetch('/api/alertas/valoracion-legal', { cache: 'no-store' })).json();
          if (j && j.ok) deRol += j.total || 0;
        }
      } catch { /* noop */ }
      if (!vivo) return;
      const rojo = pend > 0 || deRol > 0;
      const color = rojo ? '#DC2626' : posp > 0 ? '#D97706' : '#16A34A';
      const nPersonal = pend + posp;
      setAlertaSem({ color, n: nPersonal > 0 ? nPersonal : deRol });
    };
    calc();
    const t = setInterval(calc, 60000);   // refresca cada minuto
    return () => { vivo = false; clearInterval(t); };
  }, [puedeAlertas, session?.user?.email, pathname]);

  useEffect(() => {
    function handleClick(e) {
      if (fcrRef.current && !fcrRef.current.contains(e.target)) setFcrOpen(false);
      if (direccionRef.current && !direccionRef.current.contains(e.target)) setDireccionOpen(false);
      if (propiedadesRef.current && !propiedadesRef.current.contains(e.target)) setPropiedadesOpen(false);
      if (procesosRef.current && !procesosRef.current.contains(e.target)) setProcesosOpen(false);
      if (ventasRef.current && !ventasRef.current.contains(e.target)) setVentasOpen(false);
      if (ayudaRef.current && !ayudaRef.current.contains(e.target)) setAyudaOpen(false);
      if (userRef.current && !userRef.current.contains(e.target)) setUserOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const isActive = (path) => pathname === path || pathname?.startsWith(path + '/');
  const rol = normRol(session?.user?.role);
  const esDireccion = rol === 'direccion' || DIRECCION_EMAILS.includes(session?.user?.email);
  // Operaciones BB (arriendo/venta sin/ con adm├│n): en construcci├│n, solo Direcci├│n + Anthony (Legal).
  const esBB = esDireccion || session?.user?.email === 'anthony.mendoza@fondocapital.com';
  // Captaciones (cartera de propietarios): Direcci├│n (incluye Alberto) + Administraci├│n (Adalis/Fabiola).
  const esCaptacion = esDireccion; // solo Alberto + Luis (Direcci├│n)
  // Direcci├│n ve todo. Lo no listado en RUTAS solo lo ve Direcci├│n (deny by default).
  const puede = (ruta) => esDireccion || (RUTAS[ruta] ? RUTAS[ruta].includes(rol) : false);

  function abrirDoc(tipo) {
    const url = DOCS[tipo];
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }
  function abrirWorkspace(url) {
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  const s = {
    nav: {
      display: 'flex', alignItems: 'center', gap: 4,
      background: '#fff', borderBottom: '1px solid #E8E6E0',
      padding: '0 20px', height: 52, position: 'sticky', top: 0, zIndex: 100,
      fontFamily: '"DM Sans", "Segoe UI", sans-serif',
    },
    brand: {
      fontSize: 15, fontWeight: 700, color: '#1a1a2e',
      marginRight: 4, textDecoration: 'none',
      display: 'flex', alignItems: 'center', gap: 4,
      background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px',
      borderRadius: 6,
    },
    link: (active) => ({
      padding: '6px 12px', borderRadius: 6,
      fontSize: 13, fontWeight: active ? 600 : 400,
      color: active ? '#185FA5' : '#555',
      background: active ? '#E6F1FB' : 'transparent',
      textDecoration: 'none', border: 'none', cursor: 'pointer',
      transition: 'all 0.12s', whiteSpace: 'nowrap',
    }),
    linkDir: (active) => ({
      padding: '6px 12px', borderRadius: 6,
      fontSize: 13, fontWeight: active ? 700 : 600,
      color: active ? '#fff' : '#1a1a2e',
      background: active ? '#1a1a2e' : '#F0EEE8',
      textDecoration: 'none', border: 'none', cursor: 'pointer',
      transition: 'all 0.12s', whiteSpace: 'nowrap',
    }),
    dropBtn: (active) => ({
      padding: '6px 12px', borderRadius: 6,
      fontSize: 13, fontWeight: active ? 600 : 400,
      color: active ? '#185FA5' : '#555',
      background: active ? '#E6F1FB' : 'transparent',
      border: 'none', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 4,
      transition: 'all 0.12s', whiteSpace: 'nowrap',
    }),
    dropdown: {
      position: 'absolute', top: '100%', left: 0, marginTop: 4,
      background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8,
      boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
      minWidth: 220, padding: '6px 0', zIndex: 200,
    },
    dropdownRight: {
      position: 'absolute', top: '100%', right: 0, marginTop: 4,
      background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8,
      boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
      minWidth: 240, padding: '6px 0', zIndex: 200,
    },
    dropItem: {
      display: 'block', padding: '8px 16px',
      fontSize: 13, color: '#444', textDecoration: 'none',
      transition: 'background 0.1s', cursor: 'pointer',
    },
    dropItemSoon: {
      display: 'block', padding: '8px 16px',
      fontSize: 13, color: '#bbb', textDecoration: 'none',
      cursor: 'default',
    },
    dropDivider: { height: 1, background: '#F0EEE8', margin: '4px 0' },
    dropLabel: {
      padding: '4px 16px 2px',
      fontSize: 10, fontWeight: 700, color: '#aaa',
      letterSpacing: '0.08em', textTransform: 'uppercase',
    },
    infoLink: (active) => ({
      padding: '5px 10px', borderRadius: 6,
      fontSize: 13, fontWeight: active ? 600 : 400,
      color: active ? '#0F6E56' : '#555',
      background: active ? '#E1F5EE' : 'transparent',
      textDecoration: 'none', border: active ? 'none' : '1px dashed #ccc',
      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
      transition: 'all 0.12s',
    }),
    spacer: { flex: 1 },
    signout: { fontSize: 11, color: '#aaa', background: 'none', border: '1px solid #E8E6E0', borderRadius: 4, padding: '3px 8px', cursor: 'pointer' },
  };

  const direccionActive = isActive('/direccion');
  const propiedadesActive = isActive('/propiedades');
  const procesosActive = isActive('/procesos') || isActive('/cc1') || isActive('/op');
  const ventasActive = isActive('/requerimientos') || isActive('/visitas') || isActive('/calendario')
    || isActive('/cumpleanos') || isActive('/publicaciones') || isActive('/edificios') || isActive('/contactos');

  return (
    <nav style={s.nav}>
      <style>{`@keyframes fcrNavBlink{0%,49%{opacity:1}50%,100%{opacity:0.2}}`}</style>

      {/* FCR ÔÇö selector de workspace/portal */}
      <div ref={fcrRef} style={{ position: 'relative', marginRight: 8 }}>
        <button style={s.brand} onClick={() => setFcrOpen(v => !v)}>
          <span>FCR</span>
          <span style={{ fontSize: 9, opacity: 0.5 }}>Ôû¥</span>
        </button>
        {fcrOpen && (
          <div style={s.dropdown}>
            <div style={s.dropLabel}>Cambiar de portal</div>
            <span style={{ ...s.dropItem, fontWeight: 600, color: '#185FA5', cursor: 'default', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              CRM Interno (Backoffice) <span style={{ color: '#0F6E56', fontSize: 11 }}>ÔùÅ</span>
            </span>
            <button style={{ ...s.dropItem, width: '100%', textAlign: 'left', background: 'none', border: 'none', fontFamily: 'inherit' }}
              onClick={() => { abrirWorkspace(WORKSPACES.propietarios); setFcrOpen(false); }}>
              Portal de Propietarios Ôåù
            </button>
            <span style={s.dropItemSoon}>Portal Comercial ┬À pronto</span>
            <button style={{ ...s.dropItem, width: '100%', textAlign: 'left', background: 'none', border: 'none', fontFamily: 'inherit' }}
              onClick={() => { abrirWorkspace(WORKSPACES.web); setFcrOpen(false); }}>
              Web Corporativa Ôåù
            </button>
          </div>
        )}
      </div>

      {/* Direcci├│n ÔÇö bot├│n partido: el texto va a /direccion; la Ôû¥ abre las operaciones
          propias de Direcci├│n. Visible por rol 'direccion' (o email de respaldo). */}
      {esDireccion && (
      <div ref={direccionRef} style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', borderRadius: 6,
          background: direccionActive ? '#1a1a2e' : '#F0EEE8' }}>
          <Link href="/direccion" onClick={() => setDireccionOpen(false)}
            style={{ ...s.linkDir(direccionActive), background: 'transparent', paddingRight: 4 }}>
            Direccion
          </Link>
          <button aria-label="Operaciones de Direccion"
            onClick={() => { setDireccionOpen(v => !v); setPropiedadesOpen(false); setProcesosOpen(false); setVentasOpen(false); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px 6px 2px',
              color: direccionActive ? '#fff' : '#1a1a2e', display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: 9, opacity: 0.6, transition: 'transform 0.15s',
              transform: direccionOpen ? 'rotate(180deg)' : 'none' }}>Ôû¥</span>
          </button>
        </div>
        {direccionOpen && (
          <div style={s.dropdown}>
            <div style={s.dropLabel}>Operaciones de Direccion</div>
            <Link href="/direccion/control-asistencia" style={s.dropItem} onClick={() => setDireccionOpen(false)}
              onMouseEnter={e => e.currentTarget.style.background = '#F7F6F2'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              Control de Asistencia
            </Link>
            <span style={s.dropItemSoon}>Budget ┬À pronto</span>
            <span style={s.dropItemSoon}>Problemas ┬À pronto</span>
            <div style={s.dropDivider} />
            <Link href="/direccion/tareas" style={s.dropItem} onClick={() => setDireccionOpen(false)}
              onMouseEnter={e => e.currentTarget.style.background = '#F7F6F2'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              Tareas del equipo
            </Link>
            <Link href="/direccion/valoraciones" style={s.dropItem} onClick={() => setDireccionOpen(false)}
              onMouseEnter={e => e.currentTarget.style.background = '#F7F6F2'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              Valoraciones
            </Link>
            <div style={s.dropDivider} />
            <div style={s.dropLabel}>Herramientas</div>
            <Link href="/direccion/reparar-inicios" style={s.dropItem} onClick={() => setDireccionOpen(false)}
              onMouseEnter={e => e.currentTarget.style.background = '#F7F6F2'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              Reparar inicios
            </Link>
            <div style={s.dropDivider} />
            <Link href="/direccion" onClick={() => setDireccionOpen(false)}
              style={{ ...s.dropItem, color: '#185FA5', fontWeight: 600 }}>
              Ver panel de Direccion ÔåÆ
            </Link>
          </div>
        )}
      </div>
      )}

      {/* Panel ÔÇö dashboard operativo */}
      {puede('/panel') && (
        <Link href="/panel" style={s.link(isActive('/panel'))}>Panel</Link>
      )}

      {/* Propiedades ÔÇö m├│dulo de datos maestros. Solo Direcci├│n (rol direccion o email de direcci├│n). */}
      {esDireccion && puede('/propiedades') && (
      <div ref={propiedadesRef} style={{ position: 'relative' }}>
        <button style={s.dropBtn(propiedadesActive)} onClick={() => { setPropiedadesOpen(v => !v); setProcesosOpen(false); setVentasOpen(false); }}>
          Propiedades <span style={{ fontSize: 9, opacity: 0.6 }}>v</span>
        </button>
        {propiedadesOpen && (
          <div style={s.dropdown}>
            <Link href="/propiedades" style={s.dropItem} onClick={() => setPropiedadesOpen(false)}>Cartera de Propiedades</Link>
            <span style={s.dropItemSoon}>Unidades ┬À pronto</span>
            <span style={s.dropItemSoon}>Propietarios ┬À pronto</span>
            <span style={s.dropItemSoon}>Arrendatarios ┬À pronto</span>
            <span style={s.dropItemSoon}>Contratos ┬À pronto</span>
            <span style={s.dropItemSoon}>Documentos ┬À pronto</span>
            <span style={s.dropItemSoon}>Historial ┬À pronto</span>
          </div>
        )}
      </div>
      )}

      {/* Procesos ÔÇö bot├│n partido: el texto va a /procesos; la Ôû¥ abre el desplegable
          de procesos EN PRODUCCI├ôN, filtrado por perfil (candado ­ƒöÆ si no hay acceso). */}
      {puede('/procesos') && (
      <div ref={procesosRef} style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', borderRadius: 6,
          background: procesosActive ? '#E6F1FB' : 'transparent' }}>
          <Link href="/procesos" onClick={() => setProcesosOpen(false)}
            style={{ ...s.link(procesosActive), background: 'transparent', paddingRight: 4 }}>
            Procesos
          </Link>
          <button aria-label="Ver procesos en producci├│n"
            onClick={() => { setProcesosOpen(v => !v); setPropiedadesOpen(false); setVentasOpen(false); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px 6px 2px',
              color: procesosActive ? '#185FA5' : '#555', display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: 9, opacity: 0.6, transition: 'transform 0.15s',
              transform: procesosOpen ? 'rotate(180deg)' : 'none' }}>Ôû¥</span>
          </button>
        </div>
        {procesosOpen && (
          <div style={s.dropdown}>
            <div style={s.dropLabel}>Procesos en producci├│n</div>
            {PROCESOS.filter(p => p.produccion).slice().sort((a, b) => a.titulo.localeCompare(b.titulo, 'es')).map(p => {
              const tiene = procKeys.has(p.key) && !!p.href;
              return tiene ? (
                <Link key={p.key} href={p.href} style={s.dropItem} onClick={() => setProcesosOpen(false)}
                  onMouseEnter={e => e.currentTarget.style.background = '#F7F6F2'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  {p.titulo}
                </Link>
              ) : (
                <span key={p.key} title="Sin acceso"
                  style={{ ...s.dropItem, color: '#bbb', cursor: 'default', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 11 }}>­ƒöÆ</span>{p.titulo}
                </span>
              );
            })}
            <div style={s.dropDivider} />
            <Link href="/procesos" onClick={() => setProcesosOpen(false)}
              style={{ ...s.dropItem, color: '#185FA5', fontWeight: 600 }}>
              Ver todos los procesos ÔåÆ
            </Link>
          </div>
        )}
      </div>
      )}

      {/* Ventas (interno) ÔÇö Inventario y Contactos */}
      {puede('/publicaciones') && (
      <div ref={ventasRef} style={{ position: 'relative' }}>
        <button style={s.dropBtn(ventasActive)} onClick={() => { setVentasOpen(v => !v); setPropiedadesOpen(false); setProcesosOpen(false); }}>
          Ventas <span style={{ fontSize: 9, opacity: 0.6 }}>v</span>
        </button>
        {ventasOpen && (
          <div style={s.dropdown}>
            <Link href="/requerimientos" style={s.dropItem} onClick={() => setVentasOpen(false)}>Requerimientos</Link>
            <Link href="/visitas" style={s.dropItem} onClick={() => setVentasOpen(false)}>Visitas y ├│rdenes</Link>
            <div style={s.dropDivider}/>
            <Link href="/calendario" style={s.dropItem} onClick={() => setVentasOpen(false)}>Calendario</Link>
            {puede('/cumpleanos') && (
            <Link href="/cumpleanos" style={s.dropItem} onClick={() => setVentasOpen(false)}>Cumplea├▒os</Link>
            )}
            <div style={s.dropDivider}/>
            <div style={s.dropLabel}>Inventario</div>
            <Link href="/publicaciones" style={s.dropItem} onClick={() => setVentasOpen(false)}>Publicaciones</Link>
            {esDireccion && (
            <Link href="/canje" style={s.dropItem} onClick={() => setVentasOpen(false)}>Bolsa Inmobiliaria (Canje)</Link>
            )}
            {puede('/edificios') && (
            <Link href="/edificios" style={s.dropItem} onClick={() => setVentasOpen(false)}>Edificios</Link>
            )}
            <div style={s.dropDivider}/>
            <Link href="/contactos" style={s.dropItem} onClick={() => setVentasOpen(false)}>Contactos</Link>
            <span style={s.dropItemSoon}>Leads / buz├│n ┬À pronto</span>
          </div>
        )}
      </div>
      )}

      {/* BB1 (venta) / BB2 (arriendo sin adm├│n) ÔÇö Operaciones comerciales. En construcci├│n: solo Direcci├│n + Anthony. */}
      {esBB && (
        <Link href="/bb1" style={s.link(isActive('/bb1'))}>BB1</Link>
      )}
      {esBB && (
        <Link href="/bb2" style={s.link(isActive('/bb2'))}>BB2</Link>
      )}
      {esCaptacion && (
        <Link href="/captaciones" style={s.link(isActive('/captaciones'))}>Captaciones</Link>
      )}

      {/* Comercial ÔÇö Portal externo (pendiente de desarrollo). Solo Direcci├│n por ahora. */}
      {esDireccion && (
        <span style={{ ...s.link(false), opacity: 0.4, cursor: 'default' }}>Comercial ┬À pronto</span>
      )}

      {/* Config ÔÇö solo Direcci├│n */}
      {puede('/admin') && (
        <Link href="/config" style={s.link(isActive('/config'))}>Config</Link>
      )}

      <div style={s.spacer}/>

      {/* Ayuda ÔÇö Reglamento, Mapa de procesos y manuales */}
      <div ref={ayudaRef} style={{ position: 'relative' }}>
        <button style={s.dropBtn(false)} onClick={() => setAyudaOpen(v => !v)}>
          Ayuda <span style={{ fontSize: 9, opacity: 0.6 }}>v</span>
        </button>
        {ayudaOpen && (
          <div style={s.dropdownRight}>
            <button style={{ ...s.dropItem, width: '100%', textAlign: 'left', background: 'none', border: 'none', fontFamily: 'inherit' }}
              onClick={() => { abrirDoc('reglamento'); setAyudaOpen(false); }}>­ƒôï Reglamento Interno</button>
            <button style={{ ...s.dropItem, width: '100%', textAlign: 'left', background: 'none', border: 'none', fontFamily: 'inherit' }}
              onClick={() => { abrirDoc('procesos'); setAyudaOpen(false); }}>­ƒù║ Mapa de Procesos</button>
            <div style={s.dropDivider}/>
            <div style={s.dropLabel}>Manuales</div>
            <button style={{ ...s.dropItem, width: '100%', textAlign: 'left', background: 'none', border: 'none', fontFamily: 'inherit' }}
              onClick={() => { abrirDoc('manual_deudas'); setAyudaOpen(false); }}>­ƒÆº Manual de Deudas de Servicios</button>
            <button style={{ ...s.dropItem, width: '100%', textAlign: 'left', background: 'none', border: 'none', fontFamily: 'inherit' }}
              onClick={() => { abrirDoc('manual_terminos'); setAyudaOpen(false); }}>­ƒöæ Gu├¡a de T├®rminos</button>
            <button style={{ ...s.dropItem, width: '100%', textAlign: 'left', background: 'none', border: 'none', fontFamily: 'inherit' }}
              onClick={() => { abrirDoc('manual_publicaciones'); setAyudaOpen(false); }}>­ƒÅá Manual de Publicaciones</button>
            <button style={{ ...s.dropItem, width: '100%', textAlign: 'left', background: 'none', border: 'none', fontFamily: 'inherit' }}
              onClick={() => { abrirDoc('manual_descuentos'); setAyudaOpen(false); }}>­ƒÆ© Manual de Descuentos</button>
            <button style={{ ...s.dropItem, width: '100%', textAlign: 'left', background: 'none', border: 'none', fontFamily: 'inherit' }}
              onClick={() => { abrirDoc('manual_bi'); setAyudaOpen(false); }}>­ƒôè Manual del BI</button>
            <button style={{ ...s.dropItem, width: '100%', textAlign: 'left', background: 'none', border: 'none', fontFamily: 'inherit' }}
              onClick={() => { abrirDoc('manual_gestion_log'); setAyudaOpen(false); }}>­ƒôæ Manual de Gesti├│n LOG</button>
          </div>
        )}
      </div>

      {/* Alertas ÔÇö sem├íforo seg├║n las alertas propias (rojo/├ímbar/verde) */}
      {puedeAlertas && (
        <Link href="/alertas" style={s.infoLink(isActive('/alertas'))}
          title={alertaSem.color === '#DC2626' ? 'Tienes alertas sin gestionar'
               : alertaSem.color === '#D97706' ? 'Alertas pospuestas pendientes de resolver'
               : 'Sin alertas abiertas'}>
          <span style={{
            width: 9, height: 9, borderRadius: '50%',
            background: alertaSem.color || '#C9C7BF',
            boxShadow: alertaSem.color === '#DC2626' ? '0 0 0 3px rgba(220,38,38,0.18)' : 'none',
            animation: alertaSem.color === '#DC2626' ? 'fcrNavBlink 0.9s steps(1,end) infinite' : 'none',
            display: 'inline-block', flexShrink: 0,
          }} />
          Alertas
          {alertaSem.n > 0 && (
            <span style={{ fontSize: 10, fontWeight: 700, color: alertaSem.color, marginLeft: 1 }}>{alertaSem.n}</span>
          )}
        </Link>
      )}

      {/* Mis tareas */}
      {puede('/procesos/mi-portal') && (
        <Link href="/procesos/mi-portal" style={s.infoLink(isActive('/procesos/mi-portal'))}>­ƒôï Mis tareas</Link>
      )}

      {/* Men├║ de usuario */}
      {session?.user && (
      <div ref={userRef} style={{ position: 'relative' }}>
        <button style={s.dropBtn(userOpen)} onClick={() => setUserOpen(v => !v)}>
          {session.user.email?.split('@')[0]} <span style={{ fontSize: 9, opacity: 0.6 }}>v</span>
        </button>
        {userOpen && (
          <div style={s.dropdownRight}>
            <span style={s.dropItemSoon}>Mi Perfil ┬À pronto</span>
            {esDireccion && (
              <>
                <div style={s.dropDivider}/>
                <div style={s.dropLabel}>Administracion</div>
                <span style={s.dropItemSoon}>Usuarios y Permisos ┬À pronto</span>
                <span style={s.dropItemSoon}>Catalogos / Listas Maestras ┬À pronto</span>
                <span style={s.dropItemSoon}>Integraciones ┬À pronto</span>
                <span style={s.dropItemSoon}>Configuracion General ┬À pronto</span>
              </>
            )}
            <div style={s.dropDivider}/>
            <button style={{ ...s.dropItem, width: '100%', textAlign: 'left', background: 'none', border: 'none', fontFamily: 'inherit', color: '#C0392B' }}
              onClick={() => signOut()}>Cerrar sesion</button>
          </div>
        )}
      </div>
      )}
    </nav>
  );
}
