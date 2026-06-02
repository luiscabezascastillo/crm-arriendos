'use client';
import { useState, useRef, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const DOCS = [
  {
    key: 'reglamento',
    label: '📋 Reglamento Interno',
    url: 'https://drive.google.com/file/d/1P4z9A8CDHLzqDPce-ZNK3p_yEwvnMzpS/preview',
  },
  {
    key: 'procesos',
    label: '🗺 Mapa de Procesos',
    url: '/procesos-2026.html',
  },
]

export default function TopNav() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [cc1Open, setCc1Open] = useState(false);
  const [opOpen, setOpOpen] = useState(false);
  const [crmOpen, setCrmOpen] = useState(false);
  const [docActivo, setDocActivo] = useState(null);
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

  // Cerrar modal con Escape
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') setDocActivo(null);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  const isActive = (path) => pathname === path || pathname?.startsWith(path + '/');

  const s = {
    nav: {
      display: 'flex', alignItems: 'center', gap: 4,
      background: '#fff', borderBottom: '1px solid #E8E6E0',
      padding: '0 20px', height: 52, position: 'sticky', top: 0, zIndex: 100,
      fontFamily: '"DM Sans", "Segoe UI", sans-serif',
    },
    brand: {
      fontSize: 15, fontWeight: 700, color: '#1a1a2e',
      marginRight: 16, textDecoration: 'none',
      display: 'flex', alignItems: 'center', gap: 6,
      background: 'none', border: 'none', cursor: 'pointer',
      padding: '4px 8px', borderRadius: 6,
    },
    link: (active) => ({
      padding: '6px 12px', borderRadius: 6,
      fontSize: 13, fontWeight: active ? 600 : 400,
      color: active ? '#185FA5' : '#555',
      background: active ? '#E6F1FB' : 'transparent',
      textDecoration: 'none', border: 'none', cursor: 'pointer',
      transition: 'all 0.12s',
      whiteSpace: 'nowrap',
    }),
    linkBold: (active) => ({
      padding: '6px 12px', borderRadius: 6,
      fontSize: 13, fontWeight: 700,
      color: active ? '#185FA5' : '#555',
      background: active ? '#E6F1FB' : 'transparent',
      textDecoration: 'none', border: 'none', cursor: 'pointer',
      transition: 'all 0.12s',
      whiteSpace: 'nowrap',
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
      transition: 'background 0.1s',
    },
    dropDivider: {
      height: 1, background: '#F0EEE8', margin: '4px 0',
    },
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
    user: {
      fontSize: 12, color: '#888',
      display: 'flex', alignItems: 'center', gap: 8,
    },
    signout: {
      fontSize: 11, color: '#aaa', background: 'none',
      border: '1px solid #E8E6E0', borderRadius: 4,
      padding: '3px 8px', cursor: 'pointer',
    },
  };

  const cc1Active = isActive('/cc1') || isActive('/op/deudas');
  const opActive = isActive('/op/comunidad-feliz') || isActive('/op/liquidacion-paola') || isActive('/op/morosidad');
  const docInfo = DOCS.find(d => d.key === docActivo);

  return (
    <>
      <nav style={s.nav}>
        {/* CRM → dropdown con documentos */}
        <div ref={crmRef} style={{ position: 'relative', marginRight: 16 }}>
          <button
            style={s.brand}
            onClick={() => { setCrmOpen(v => !v); setCc1Open(false); setOpOpen(false); }}
            title="Documentos corporativos"
          >
            CRM <span style={{ fontSize: 9, opacity: 0.5, fontWeight: 400 }}>▾</span>
          </button>
          {crmOpen && (
            <div style={{ ...s.dropdown, minWidth: 220 }}>
              <div style={s.dropLabel}>Documentos</div>
              {DOCS.map(doc => (
                <button
                  key={doc.key}
                  onClick={() => { setDocActivo(doc.key); setCrmOpen(false); }}
                  style={{
                    ...s.dropItem, width: '100%', textAlign: 'left',
                    background: 'none', border: 'none', cursor: 'pointer',
                    display: 'block',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F3F4F6'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  {doc.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <Link href="/panel" style={s.linkBold(isActive('/panel'))}>Dashboard</Link>
        <Link href="/procesos" style={s.linkBold(isActive('/procesos'))}>Trabajo</Link>

        <div ref={cc1Ref} style={{ position: 'relative' }}>
          <button style={s.dropBtn(cc1Active)} onClick={() => { setCc1Open(v => !v); setOpOpen(false); setCrmOpen(false); }}>
            CC1 Admin <span style={{ fontSize: 9, opacity: 0.6 }}>v</span>
          </button>
          {cc1Open && (
            <div style={s.dropdown}>
              <Link href="/cc1" style={s.dropItem} onClick={() => setCc1Open(false)}>CC1 Admin</Link>
              <Link href="/op/deudas" style={s.dropItem} onClick={() => setCc1Open(false)}>Deudas servicios</Link>
              <Link href="/op/morosidad" style={s.dropItem} onClick={() => setCc1Open(false)}>Morosidad</Link>
            </div>
          )}
        </div>

        <Link href="#" style={{ ...s.link(false), opacity: 0.35, pointerEvents: 'none' }}>CC2</Link>
        <Link href="#" style={{ ...s.link(false), opacity: 0.35, pointerEvents: 'none' }}>CC3</Link>
        <Link href="#" style={{ ...s.link(false), opacity: 0.35, pointerEvents: 'none' }}>BB1</Link>
        <Link href="#" style={{ ...s.link(false), opacity: 0.35, pointerEvents: 'none' }}>BB2</Link>

        <div ref={opRef} style={{ position: 'relative' }}>
          <button style={s.dropBtn(opActive)} onClick={() => { setOpOpen(v => !v); setCc1Open(false); setCrmOpen(false); }}>
            Op. especiales <span style={{ fontSize: 9, opacity: 0.6 }}>v</span>
          </button>
          {opOpen && (
            <div style={s.dropdown}>
              <div style={s.dropLabel}>Operacion</div>
              <Link href="/op/liquidacion-paola" style={s.dropItem} onClick={() => setOpOpen(false)}>Liquidacion Paola</Link>
              <Link href="/op/morosidad" style={s.dropItem} onClick={() => setOpOpen(false)}>Morosidad</Link>
              <div style={s.dropDivider}/>
              <div style={s.dropLabel}>Servicios</div>
              <Link href="/op/deudas" style={{ ...s.dropItem, fontSize: 14, fontWeight: 600, color: '#185FA5' }} onClick={() => setOpOpen(false)}>📊 Visualizar Deudas</Link>
              <div style={s.dropDivider}/>
              <Link href="/op/comunidad-feliz" style={s.dropItem} onClick={() => setOpOpen(false)}>🏢 Cargar ggcc CF</Link>
              <Link href="/op/servicios/luz" style={s.dropItem} onClick={() => setOpOpen(false)}>⚡ Cargar Luz</Link>
              <Link href="/op/servicios/agua" style={s.dropItem} onClick={() => setOpOpen(false)}>💧 Cargar Agua</Link>
              <div style={s.dropDivider}/>
              <div style={s.dropLabel}>Pendientes</div>
              {['Contratos','Estados IDADMON','Cartolas','Facturas','Nubox'].map(n => (
                <span key={n} style={{ ...s.dropItem, opacity: 0.35, display: 'block', cursor: 'default' }}>{n}</span>
              ))}
            </div>
          )}
        </div>

        <Link href="/admin" style={s.link(isActive('/admin'))}>Config</Link>
        <Link href="/publicaciones" style={s.link(isActive('/publicaciones'))}>Publicaciones</Link>

        <div style={s.spacer}/>
        <Link href="/info" style={s.infoLink(isActive('/info'))}>
          Informacion
        </Link>

        {session?.user && (
          <div style={s.user}>
            <span>{session.user.email?.split('@')[0]}</span>
            <button style={s.signout} onClick={() => signOut()}>salir</button>
          </div>
        )}
      </nav>

      {/* Modal documentos */}
      {docActivo && docInfo && (
        <>
          <div
            onClick={() => setDocActivo(null)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.5)',
              zIndex: 900,
            }}
          />
          <div style={{
            position: 'fixed',
            top: '5vh', left: '5vw',
            width: '90vw', height: '90vh',
            background: '#fff',
            borderRadius: 12,
            zIndex: 901,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            overflow: 'hidden',
          }}>
            {/* Header modal */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 20px',
              borderBottom: '1px solid #E8E6E0',
              background: '#F9FAFB',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  onClick={() => setDocActivo(null)}
                  style={{
                    background: '#1a1a2e', border: 'none', cursor: 'pointer',
                    color: '#fff', fontSize: 12, padding: '5px 12px',
                    borderRadius: 6, fontWeight: 600,
                  }}
                >
                  ← Volver al CRM
                </button>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>
                  {docInfo.label}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {DOCS.map(doc => (
                  <button
                    key={doc.key}
                    onClick={() => setDocActivo(doc.key)}
                    style={{
                      fontSize: 12, padding: '5px 12px', borderRadius: 6,
                      border: '1px solid #E8E6E0', cursor: 'pointer',
                      background: docActivo === doc.key ? '#E6F1FB' : '#fff',
                      color: docActivo === doc.key ? '#185FA5' : '#555',
                      fontWeight: docActivo === doc.key ? 600 : 400,
                    }}
                  >
                    {doc.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Iframe */}
            <iframe
              src={docInfo.url}
              style={{ flex: 1, border: 'none', width: '100%' }}
              title={docInfo.label}
              allow="autoplay"
            />
          </div>
        </>
      )}
    </>
  );
}