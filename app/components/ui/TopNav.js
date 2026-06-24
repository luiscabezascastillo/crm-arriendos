'use client';
import { useState, useRef, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const DIRECCION_EMAILS = [
  'alberto.cabezas@fondocapital.com',
  'luis.cabezas@fondocapital.com',
  'tirza.chavez@fondocapital.com',
];

// --- Transición de roles (Fase 1): traduce nombres viejos -> nuevos al vuelo.
// Permite que el código nuevo funcione mientras la BD aún tenga roles viejos.
const ROL_ALIAS = {
  admin: 'direccion',
  operaciones: 'administracion',
  tecnico: 'mantencion',
};
const normRol = (r) => ROL_ALIAS[r] || r;

// Roles internos de la empresa (todos menos 'comercial', que es externo).
const INTERNOS = ['direccion', 'administracion', 'mantencion', 'finanzas', 'legal', 'ventas'];

// RUTAS: deny by default. Lo que NO está listado aquí, solo lo ve Dirección.
const RUTAS = {
  '/panel':         INTERNOS,
  '/procesos':      INTERNOS,
  '/propiedades':   INTERNOS,
  '/mi-portal':     INTERNOS,
  // Bloque Ventas (solo rol 'ventas', interno):
  '/publicaciones':  ['ventas'],
  '/requerimientos': ['ventas'],
  '/visitas':        ['ventas'],
  '/calendario':     ['ventas'],
  '/cumpleanos':     ['ventas'],
  '/contactos':      ['ventas'],
  '/edificios':      ['ventas'],
  // /admin (Config): NO se lista -> solo Dirección.
};

const DOCS = {
  reglamento: 'https://drive.google.com/file/d/1P4z9A8CDHLzqDPce-ZNK3p_yEwvnMzpS/preview',
  procesos: '/procesos-2026.html',
  manual_deudas: 'https://docs.google.com/document/d/1gdZTAa3snBe2o9up3EqSGKOz6zMKlp-8/preview',
  manual_terminos: 'https://docs.google.com/document/d/19tsg6pTtkEXHMugI4Wmp8ClJkTaiQLYt/preview',
  manual_publicaciones: 'https://docs.google.com/document/d/11fYLCV_VT2xSPRO1RsrkBaAM7HZlI7ky/preview',
};

// Portales del ecosistema FCR (selector FCR). CRM Interno es el actual.
const WORKSPACES = {
  propietarios: 'https://portal-propietarios-rose.vercel.app',
  web: 'https://www.fondocapital.com',
};

export default function TopNav() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [fcrOpen, setFcrOpen] = useState(false);
  const [propiedadesOpen, setPropiedadesOpen] = useState(false);
  const [procesosOpen, setProcesosOpen] = useState(false);
  const [ventasOpen, setVentasOpen] = useState(false);
  const [ayudaOpen, setAyudaOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const fcrRef = useRef(null);
  const propiedadesRef = useRef(null);
  const procesosRef = useRef(null);
  const ventasRef = useRef(null);
  const ayudaRef = useRef(null);
  const userRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (fcrRef.current && !fcrRef.current.contains(e.target)) setFcrOpen(false);
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
  // Dirección ve todo. Lo no listado en RUTAS solo lo ve Dirección (deny by default).
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

  const propiedadesActive = isActive('/propiedades');
  const procesosActive = isActive('/procesos') || isActive('/cc1') || isActive('/op');
  const ventasActive = isActive('/requerimientos') || isActive('/visitas') || isActive('/calendario')
    || isActive('/cumpleanos') || isActive('/publicaciones') || isActive('/edificios') || isActive('/contactos');

  return (
    <nav style={s.nav}>

      {/* FCR — selector de workspace/portal */}
      <div ref={fcrRef} style={{ position: 'relative', marginRight: 8 }}>
        <button style={s.brand} onClick={() => setFcrOpen(v => !v)}>
          <span>FCR</span>
          <span style={{ fontSize: 9, opacity: 0.5 }}>▾</span>
        </button>
        {fcrOpen && (
          <div style={s.dropdown}>
            <div style={s.dropLabel}>Cambiar de portal</div>
            <span style={{ ...s.dropItem, fontWeight: 600, color: '#185FA5', cursor: 'default', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              CRM Interno (Backoffice) <span style={{ color: '#0F6E56', fontSize: 11 }}>●</span>
            </span>
            <button style={{ ...s.dropItem, width: '100%', textAlign: 'left', background: 'none', border: 'none', fontFamily: 'inherit' }}
              onClick={() => { abrirWorkspace(WORKSPACES.propietarios); setFcrOpen(false); }}>
              Portal de Propietarios ↗
            </button>
            <span style={s.dropItemSoon}>Portal Comercial · pronto</span>
            <button style={{ ...s.dropItem, width: '100%', textAlign: 'left', background: 'none', border: 'none', fontFamily: 'inherit' }}
              onClick={() => { abrirWorkspace(WORKSPACES.web); setFcrOpen(false); }}>
              Web Corporativa ↗
            </button>
          </div>
        )}
      </div>

      {/* Dirección — panel propio, por rol 'direccion' (o email de respaldo) */}
      {esDireccion && (
        <Link href="/direccion" style={s.linkDir(isActive('/direccion'))}>Direccion</Link>
      )}

      {/* Panel — dashboard operativo */}
      {puede('/panel') && (
        <Link href="/panel" style={s.link(isActive('/panel'))}>Panel</Link>
      )}

      {/* Propiedades — módulo de datos maestros (entre Panel y Procesos) */}
      {puede('/propiedades') && (
      <div ref={propiedadesRef} style={{ position: 'relative' }}>
        <button style={s.dropBtn(propiedadesActive)} onClick={() => { setPropiedadesOpen(v => !v); setProcesosOpen(false); setVentasOpen(false); }}>
          Propiedades <span style={{ fontSize: 9, opacity: 0.6 }}>v</span>
        </button>
        {propiedadesOpen && (
          <div style={s.dropdown}>
            <Link href="/propiedades" style={s.dropItem} onClick={() => setPropiedadesOpen(false)}>Cartera de Propiedades</Link>
            <span style={s.dropItemSoon}>Unidades · pronto</span>
            <span style={s.dropItemSoon}>Propietarios · pronto</span>
            <span style={s.dropItemSoon}>Arrendatarios · pronto</span>
            <span style={s.dropItemSoon}>Contratos · pronto</span>
            <span style={s.dropItemSoon}>Documentos · pronto</span>
            <span style={s.dropItemSoon}>Historial · pronto</span>
          </div>
        )}
      </div>
      )}

      {/* Procesos — enlace directo a la pagina general. Acceso fino por proceso_permisos en la pagina. */}
      {puede('/procesos') && (
        <Link href="/procesos" style={s.link(procesosActive)}>Procesos</Link>
      )}

      {/* Ventas (interno) — Inventario y Contactos */}
      {puede('/publicaciones') && (
      <div ref={ventasRef} style={{ position: 'relative' }}>
        <button style={s.dropBtn(ventasActive)} onClick={() => { setVentasOpen(v => !v); setPropiedadesOpen(false); setProcesosOpen(false); }}>
          Ventas <span style={{ fontSize: 9, opacity: 0.6 }}>v</span>
        </button>
        {ventasOpen && (
          <div style={s.dropdown}>
            <Link href="/requerimientos" style={s.dropItem} onClick={() => setVentasOpen(false)}>Requerimientos</Link>
            <Link href="/visitas" style={s.dropItem} onClick={() => setVentasOpen(false)}>Visitas y órdenes</Link>
            <div style={s.dropDivider}/>
            <Link href="/calendario" style={s.dropItem} onClick={() => setVentasOpen(false)}>Calendario</Link>
            <Link href="/cumpleanos" style={s.dropItem} onClick={() => setVentasOpen(false)}>Cumpleaños</Link>
            <div style={s.dropDivider}/>
            <div style={s.dropLabel}>Inventario</div>
            <Link href="/publicaciones" style={s.dropItem} onClick={() => setVentasOpen(false)}>Publicaciones</Link>
            <Link href="/edificios" style={s.dropItem} onClick={() => setVentasOpen(false)}>Edificios</Link>
            <div style={s.dropDivider}/>
            <Link href="/contactos" style={s.dropItem} onClick={() => setVentasOpen(false)}>Contactos</Link>
            <span style={s.dropItemSoon}>Leads / buzón · pronto</span>
          </div>
        )}
      </div>
      )}

      {/* Comercial — Portal externo (pendiente de desarrollo). Solo Dirección por ahora. */}
      {esDireccion && (
        <span style={{ ...s.link(false), opacity: 0.4, cursor: 'default' }}>Comercial · pronto</span>
      )}

      {/* Config — solo Dirección */}
      {puede('/admin') && (
        <Link href="/admin" style={s.link(isActive('/admin'))}>Config</Link>
      )}

      <div style={s.spacer}/>

      {/* Ayuda — Reglamento, Mapa de procesos y manuales */}
      <div ref={ayudaRef} style={{ position: 'relative' }}>
        <button style={s.dropBtn(false)} onClick={() => setAyudaOpen(v => !v)}>
          Ayuda <span style={{ fontSize: 9, opacity: 0.6 }}>v</span>
        </button>
        {ayudaOpen && (
          <div style={s.dropdownRight}>
            <button style={{ ...s.dropItem, width: '100%', textAlign: 'left', background: 'none', border: 'none', fontFamily: 'inherit' }}
              onClick={() => { abrirDoc('reglamento'); setAyudaOpen(false); }}>📋 Reglamento Interno</button>
            <button style={{ ...s.dropItem, width: '100%', textAlign: 'left', background: 'none', border: 'none', fontFamily: 'inherit' }}
              onClick={() => { abrirDoc('procesos'); setAyudaOpen(false); }}>🗺 Mapa de Procesos</button>
            <div style={s.dropDivider}/>
            <div style={s.dropLabel}>Manuales</div>
            <button style={{ ...s.dropItem, width: '100%', textAlign: 'left', background: 'none', border: 'none', fontFamily: 'inherit' }}
              onClick={() => { abrirDoc('manual_deudas'); setAyudaOpen(false); }}>💧 Manual de Deudas de Servicios</button>
            <button style={{ ...s.dropItem, width: '100%', textAlign: 'left', background: 'none', border: 'none', fontFamily: 'inherit' }}
              onClick={() => { abrirDoc('manual_terminos'); setAyudaOpen(false); }}>🔑 Guía de Términos</button>
            <button style={{ ...s.dropItem, width: '100%', textAlign: 'left', background: 'none', border: 'none', fontFamily: 'inherit' }}
              onClick={() => { abrirDoc('manual_publicaciones'); setAyudaOpen(false); }}>🏠 Manual de Publicaciones</button>
          </div>
        )}
      </div>

      {/* Mis tareas */}
      {puede('/mi-portal') && (
        <Link href="/mi-portal" style={s.infoLink(isActive('/mi-portal'))}>📋 Mis tareas</Link>
      )}

      {/* Menú de usuario */}
      {session?.user && (
      <div ref={userRef} style={{ position: 'relative' }}>
        <button style={s.dropBtn(userOpen)} onClick={() => setUserOpen(v => !v)}>
          {session.user.email?.split('@')[0]} <span style={{ fontSize: 9, opacity: 0.6 }}>v</span>
        </button>
        {userOpen && (
          <div style={s.dropdownRight}>
            <span style={s.dropItemSoon}>Mi Perfil · pronto</span>
            {esDireccion && (
              <>
                <div style={s.dropDivider}/>
                <div style={s.dropLabel}>Administracion</div>
                <span style={s.dropItemSoon}>Usuarios y Permisos · pronto</span>
                <span style={s.dropItemSoon}>Catalogos / Listas Maestras · pronto</span>
                <span style={s.dropItemSoon}>Integraciones · pronto</span>
                <span style={s.dropItemSoon}>Configuracion General · pronto</span>
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
