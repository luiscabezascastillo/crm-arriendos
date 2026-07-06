// app/direccion/valoraciones/historial/page.js
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

const DIRECCION = [
  'alberto.cabezas@fondocapital.com',
  'luis.cabezas@fondocapital.com',
];

const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('es-CL', { maximumFractionDigits: 0 }));
const fecha = (s) => { try { return new Date(s).toLocaleDateString('es-CL'); } catch { return '—'; } };

export default function HistorialPage() {
  const { data: session, status } = useSession();
  const email = session?.user?.email || '';

  const [rows, setRows] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [borrando, setBorrando] = useState(null);

  useEffect(() => {
    if (status !== 'authenticated') return;
    (async () => {
      try {
        const r = await fetch('/api/valoraciones/listar');
        const d = await r.json();
        if (!r.ok) { setError(d.error || 'Error'); return; }
        setRows(d.valoraciones || []);
      } catch (e) { setError(e.message); }
      finally { setCargando(false); }
    })();
  }, [status]);

  if (status === 'loading') return <div style={{ padding: 40 }}>Cargando…</div>;
  if (!DIRECCION.includes(email)) return <div style={{ padding: 40 }}>Acceso restringido a Dirección.</div>;

  async function borrar(id) {
    if (!confirm(`¿Eliminar la valoración folio #${id}? No se puede deshacer.`)) return;
    setBorrando(id);
    try {
      const r = await fetch(`/api/valoraciones/listar?id=${id}`, { method: 'DELETE' });
      const d = await r.json();
      if (!r.ok) { alert(d.error || 'Error al eliminar'); return; }
      setRows((p) => p.filter((x) => x.id !== id));
    } catch (e) { alert(e.message); }
    finally { setBorrando(null); }
  }

  const filtradas = rows.filter((r) => {
    if (!q.trim()) return true;
    const t = `${r.direccion || ''} ${r.comuna || ''} ${r.tipo || ''} ${r.id}`.toLowerCase();
    return t.includes(q.trim().toLowerCase());
  });

  const th = { textAlign: 'left', padding: '8px 10px', fontSize: 11, color: '#64748b', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 0, background: '#fff' };
  const td = { padding: '8px 10px', fontSize: 13, borderBottom: '1px solid #f1f5f9' };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Historial de valoraciones</h1>
        <Link href="/direccion/valoraciones" style={{ background: '#0f172a', color: '#fff', textDecoration: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 14 }}>+ Nueva valoración</Link>
      </div>
      <p style={{ color: '#64748b', marginTop: 0, fontSize: 13 }}>Tasaciones guardadas. Haz clic en una para reabrirla, editarla o regenerar su PDF.</p>

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por dirección, comuna, tipo o folio…"
        style={{ width: '100%', maxWidth: 420, padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', marginBottom: 16 }} />

      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: 12, borderRadius: 8, marginBottom: 16 }}>{error}</div>}
      {cargando ? <div style={{ color: '#94a3b8' }}>Cargando valoraciones…</div> : (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto', maxHeight: '70vh' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={th}>Folio</th><th style={th}>Fecha</th><th style={th}>Dirección</th><th style={th}>Comuna</th>
                  <th style={th}>Tipo</th><th style={th}>m²</th><th style={th}>Valor UF</th><th style={th}>Valor $</th>
                  <th style={th}>UF/m²</th><th style={th}>Por</th><th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((r) => (
                  <tr key={r.id} style={{ cursor: 'pointer' }}>
                    <td style={td}><Link href={`/direccion/valoraciones?id=${r.id}`} style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>#{r.id}</Link></td>
                    <td style={td}>{fecha(r.created_at)}</td>
                    <td style={td}>{r.direccion || '—'}</td>
                    <td style={td}>{r.comuna}</td>
                    <td style={td}>{r.tipo}</td>
                    <td style={td}>{fmt(r.m2_objetivo)}</td>
                    <td style={td}><b>{fmt(r.valor_uf)}</b></td>
                    <td style={td}>{r.valor_clp ? '$' + fmt(r.valor_clp) : '—'}</td>
                    <td style={td}>{r.uf_m2_mediana ? Number(r.uf_m2_mediana).toLocaleString('es-CL', { maximumFractionDigits: 1 }) : '—'}</td>
                    <td style={td}>{(r.creado_por || '').split('@')[0]}</td>
                    <td style={td}>
                      <button onClick={() => borrar(r.id)} disabled={borrando === r.id}
                        style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>
                        {borrando === r.id ? '…' : 'Eliminar'}
                      </button>
                    </td>
                  </tr>
                ))}
                {filtradas.length === 0 && <tr><td style={td} colSpan={11}><span style={{ color: '#94a3b8' }}>Sin valoraciones{q ? ' para esa búsqueda' : ' guardadas aún'}.</span></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
