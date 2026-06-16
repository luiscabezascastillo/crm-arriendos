'use client';
import { useState, useRef, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const DIRECCION_EMAILS = ['alberto.cabezas@fondocapital.com','luis.cabezas@fondocapital.com'];

const RUTAS = {
  '/panel':        ['admin', 'operaciones', 'finanzas', 'legal'],
  '/admin':        ['admin', 'operaciones', 'finanzas', 'legal'],
  '/cc1':          ['admin', 'finanzas', 'legal'],
  '/op/deudas':    ['admin', 'operaciones', 'finanzas', 'legal'],
  '/op/morosidad': ['admin', 'operaciones', 'finanzas', 'legal'],
  '/op':           ['admin', 'operaciones', 'finanzas', 'legal'],
  '/info':         ['admin', 'operaciones', 'finanzas', 'legal'],
  '/procesos':     ['admin', 'operaciones', 'finanzas', 'legal', 'ventas'],
  '/publicaciones':['admin', 'comercial', 'ventas', 'legal'],
  '/contactos':    ['admin', 'operaciones', 'finanzas', 'legal', 'comercial'],
};

export default function TopNav() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [cc1Open, setCc1Open] = useState(false);
  const [opOpen, setOpOpen] = useState(false);
  const [crmOpen, setCrmOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState(null);
  const cc1Ref = useRef(null);
  const opRef = useRef(null);
  const crmRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (cc1Ref.current && !cc1Ref.current.contains(e.target)) setCc1Open(false);
      if (opRef.current && !opRef.current.contains(e.target)) setOpOpen(false);
      if (crmRef.current && !crmRef.current.contains(e.target)) setCrmOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const isActive = (path) => pathname === path || pathname?.startsWith(path + '/');
  const esDireccion = DIRECCION_EMAILS.includes(session?.user?.email);
  const rol = session?.user?.role;
  // ¿el rol actual puede ver esta ruta? Si la ruta no está en RUTAS, se muestra a todos.
  const puede = (ruta) => !RUTAS[ruta] || (rol && RUTAS[ruta].includes(rol));

function abrirModal(tipo) {
    const urls = {
      reglamento: 'https://drive.google.com/file/d/1P4z9A8CDHLzqDPce-ZNK3p_yEwvnMzpS/preview',
      procesos: '/procesos-2026.html',
      manual_deudas: 'https://docs.google.com/document/d/1gdZTAa3snBe2o9up3EqSGKOz6zMKlp-8/preview',
      manual_terminos: 'https://docs.google.com/document/d/19tsg6pTtkEXHMugI4Wmp8ClJkTaiQLYt/preview',
      manual_publicaciones: 'https://docs.google.com/document/d/11fYLCV_VT2xSPRO1RsrkBaAM7HZlI7ky/preview',
    };
    const url = urls[tipo];
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
      transition: 'all 0.12s',
    }),
    dropdown: {
      position: 'absolute', top: '100%', left: 0, marginTop: 4,
      background: '#fff', border: '1px solid #E8E6E0', borderRadius: 8,
      boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
      minWidth: 200, padding: '6px 0', zIndex: 200,
    },
    dropItem: {
      display: 'block', padding: '8px 16px',
      fontSize: 13, color: '#444', textDecoration: 'none',
      transition: 'background 0.1s', cursor: 'pointer',
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
    user: { fontSize: 12, color: '#888', display: 'flex', alignItems: 'center', gap: 8 },
    signout: { fontSize: 11, color: '#aaa', background: 'none', border: '1px solid #E8E6E0', borderRadius: 4, padding: '3px 8px', cursor: 'pointer' },
  };

  const cc1Active = isActive('/cc1') || isActive('/op/deudas');
  const opActive = isActive('/op/comunidad-feliz') || isActive('/op/liquidacion-paola') || isActive('/op/morosidad');

  return (
    <>
      <nav style={s.nav}>

        {/* CRM dropdown con modal */}
        <div ref={crmRef} style={{ position: 'relative', marginRight: 8 }}>
          <button style={s.brand} onClick={() => setCrmOpen(v => !v)}>
            <span>CRM</span>
            <span style={{ fontSize: 9, opacity: 0.5 }}>▾</span>
          </button>
          {crmOpen && (
            <div style={s.dropdown}>
              <button style={{ ...s.dropItem, width: '100%', textAlign: 'left', background: 'none', border: 'none', fontFamily: 'inherit' }}
                onClick={() => abrirModal('reglamento')}>
                📋 Reglamento Interno
              </button>
<button style={{ ...s.dropItem, width: '100%', textAlign: 'left', background: 'none', border: 'none', fontFamily: 'inherit' }}
                onClick={() => abrirModal('procesos')}>
                🗺 Mapa de Procesos
              </button>
              <div style={s.dropDivider}/>
              <div style={s.dropLabel}>Manuales</div>
              <button style={{ ...s.dropItem, width: '100%', textAlign: 'left', background: 'none', border: 'none', fontFamily: 'inherit' }}
                onClick={() => abrirModal('manual_deudas')}>
                💧 Manual de Deudas de Servicios
              </button>
              <button style={{ ...s.dropItem, width: '100%', textAlign: 'left', background: 'none', border: 'none', fontFamily: 'inherit' }}
                onClick={() => abrirModal('manual_terminos')}>
                🔑 Guía de Términos
              </button>
              <button style={{ ...s.dropItem, width: '100%', textAlign: 'left', background: 'none', border: 'none', fontFamily: 'inherit' }}
                onClick={() => abrirModal('manual_publicaciones')}>
                🏠 Manual de Publicaciones
              </button>
            </div>
          )}        </div>

        {esDireccion && (
          <Link href="/direccion" style={s.linkDir(isActive('/direccion'))}>Direccion</Link>
        )}

        {puede('/panel') && (
          <Link href="/panel" style={s.link(isActive('/panel'))}>Panel</Link>
        )}
        {puede('/procesos') && (
          <Link href="/procesos" style={s.link(isActive('/procesos'))}>Procesos</Link>
        )}

        {(puede('/cc1') || puede('/op/deudas') || puede('/op/morosidad')) && (
        <div ref={cc1Ref} style={{ position: 'relative' }}>
          <button style={s.dropBtn(cc1Active)} onClick={() => { setCc1Open(v => !v); setOpOpen(false); }}>
            CC1 Admin <span style={{ fontSize: 9, opacity: 0.6 }}>v</span>
          </button>
          {cc1Open && (
            <div style={s.dropdown}>
              {puede('/cc1') && <Link href="/cc1" style={s.dropItem} onClick={() => setCc1Open(false)}>CC1 Admin</Link>}
              {puede('/op/deudas') && <Link href="/op/deudas" style={s.dropItem} onClick={() => setCc1Open(false)}>Deudas servicios</Link>}
              {puede('/op/morosidad') && <Link href="/op/morosidad" style={s.dropItem} onClick={() => setCc1Open(false)}>Morosidad</Link>}
            </div>
          )}
        </div>
        )}

        {(rol === 'admin' || esDireccion) && (
          <Link href="#" style={{ ...s.link(false), opacity: 0.35, pointerEvents: 'none' }}>CC2</Link>
        )}
        {(rol === 'admin' || esDireccion) && (
          <Link href="#" style={{ ...s.link(false), opacity: 0.35, pointerEvents: 'none' }}>CC3</Link>
        )}

        {puede('/op') && (
        <div ref={opRef} style={{ position: 'relative' }}>
          <button style={s.dropBtn(opActive)} onClick={() => { setOpOpen(v => !v); setCc1Open(false); }}>
            Op. especiales <span style={{ fontSize: 9, opacity: 0.6 }}>v</span>
          </button>
          {opOpen && (
            <div style={s.dropdown}>
              <div style={s.dropLabel}>Operacion</div>
              <Link href="/op/comunidad-feliz" style={s.dropItem} onClick={() => setOpOpen(false)}>Comunidad Feliz</Link>
              <Link href="/op/liquidacion-paola" style={s.dropItem} onClick={() => setOpOpen(false)}>Liquidacion Paola</Link>
              <Link href="/op/morosidad" style={s.dropItem} onClick={() => setOpOpen(false)}>Morosidad</Link>
              <div style={s.dropDivider}/>
              <div style={s.dropLabel}>Pendientes</div>
              {['Contratos','Estados IDADMON','Cartolas','Facturas','Nubox'].map(n => (
                <span key={n} style={{ ...s.dropItem, opacity: 0.35, display: 'block', cursor: 'default' }}>{n}</span>
              ))}
            </div>
          )}
        </div>
        )}

        {puede('/admin') && (
          <Link href="/admin" style={s.link(isActive('/admin'))}>Config</Link>
        )}
        {puede('/publicaciones') && (
          <Link href="/publicaciones" style={s.link(isActive('/publicaciones'))}>Publicaciones</Link>
        )}
        <Link href="/edificios" style={s.link(isActive('/edificios'))}>Edificios</Link>
        {puede('/contactos') && (
          <Link href="/contactos" style={s.link(isActive('/contactos'))}>Contactos</Link>
        )}

        <div style={s.spacer}/>

        {puede('/mi-portal') && (
          <Link href="/mi-portal" style={s.infoLink(isActive('/mi-portal'))}>📋 Mis tareas</Link>
        )}

        {session?.user && (
          <div style={s.user}>
            <span>{session.user.email?.split('@')[0]}</span>
            <button style={s.signout} onClick={() => signOut()}>salir</button>
          </div>
        )}
      </nav>

      {/* Modal CRM */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setModalOpen(false)}>
          <div style={{ background: '#fff', borderRadius: 16, width: '90%', maxWidth: modalContent === 'procesos' ? 1100 : 800, height: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E8E6E0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>
              {modalContent === 'reglamento' ? '📋 Reglamento Interno'
                  : modalContent === 'procesos' ? '🗺 Mapa de Procesos 2026'
                  : modalContent === 'manual_deudas' ? '💧 Manual de Deudas de Servicios'
                  : modalContent === 'manual_terminos' ? '🔑 Guía de Términos'
                  : '🏠 Manual de Publicaciones'}              </span>
              <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#888' }}>×</button>
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              {modalContent === 'reglamento' && (
                <iframe
                  src="https://drive.google.com/file/d/1P4z9A8CDHLzqDPce-ZNK3p_yEwvnMzpS/preview"
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  allow="autoplay"
                />
              )}
              {modalContent === 'procesos' && (
                <iframe
                  src="/procesos-2026.html"
                  style={{ width: '100%', height: '100%', border: 'none' }}
                />
              )}
              {modalContent === 'manual_deudas' && (
                <iframe
                  src="https://docs.google.com/document/d/1gdZTAa3snBe2o9up3EqSGKOz6zMKlp-8/preview"
                  style={{ width: '100%', height: '100%', border: 'none' }}
                />
              )}
              {modalContent === 'manual_terminos' && (
                <iframe
                  src="https://docs.google.com/document/d/19tsg6pTtkEXHMugI4Wmp8ClJkTaiQLYt/preview"
                  style={{ width: '100%', height: '100%', border: 'none' }}
                />
              )}
              {modalContent === 'manual_publicaciones' && (
                <iframe
                  src="https://docs.google.com/document/d/11fYLCV_VT2xSPRO1RsrkBaAM7HZlI7ky/preview"
                  style={{ width: '100%', height: '100%', border: 'none' }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}