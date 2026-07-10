// VERSION: v3 · 2026-07-10 · Fotos por etapa · cámara (1 por toque) + galería (selección múltiple) · sube por API
'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import comprimirImagen from '@/lib/comprimirImagen';

const BUCKET = 'incidencias'; // bucket en Supabase Storage (mismo patrón que 'ordenes')

// Gestiona las fotos de UNA etapa de la incidencia (reporte, validacion, resolucion, cierre).
// Sin tope de fotos: cada subida agrega una fila en incidencia_adjuntos.
export default function FotoCapturaEtapa({ incidenciaId, etapa, subidoPor, titulo }) {
  const [fotos, setFotos] = useState([]);
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState(''); // ej. "2/5"
  const [error, setError] = useState('');
  const camaraRef = useRef(null);
  const galeriaRef = useRef(null);

  const cargar = useCallback(async () => {
    if (!incidenciaId) return;
    const { data, error: e } = await supabase
      .from('incidencia_adjuntos')
      .select('*')
      .eq('incidencia_id', incidenciaId)
      .eq('etapa', etapa)
      .order('creado_en', { ascending: true });
    if (e) { console.error(e); return; }
    const conUrl = (data || []).map((row) => ({
      ...row,
      url: supabase.storage.from(BUCKET).getPublicUrl(row.storage_path).data.publicUrl,
    }));
    setFotos(conUrl);
  }, [incidenciaId, etapa]);

  useEffect(() => { cargar(); }, [cargar]);

  async function subirUna(file) {
    const blob = await comprimirImagen(file);
    const fd = new FormData();
    fd.append('incidencia_id', String(incidenciaId));
    fd.append('etapa', etapa);
    if (subidoPor) fd.append('subido_por', subidoPor);
    fd.append('file', blob, 'foto.jpg');
    const res = await fetch('/api/incidencias/foto', { method: 'POST', body: fd });
    if (!res.ok) throw new Error('upload ' + res.status);
  }

  async function onArchivos(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length || !incidenciaId) return;
    setError('');
    setSubiendo(true);
    let ok = 0;
    try {
      for (let i = 0; i < files.length; i++) {
        setProgreso(files.length > 1 ? `${i + 1}/${files.length}` : '');
        try { await subirUna(files[i]); ok++; }
        catch (err) { console.error(err); }
      }
      await cargar();
      if (ok < files.length) {
        setError(`Se subieron ${ok} de ${files.length}. Reintenta las que faltan.`);
      }
    } finally {
      setSubiendo(false);
      setProgreso('');
    }
  }

  const btn = {
    minHeight: 44, padding: '0 12px', borderRadius: 8, border: '1px solid #d1d5db',
    background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 6,
  };

  return (
    <div style={{ marginBottom: 16 }}>
      {titulo && (
        <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
          {titulo} {fotos.length > 0 && <span style={{ color: '#9ca3af' }}>({fotos.length})</span>}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        {fotos.map((f) => (
          <a key={f.id} href={f.url} target="_blank" rel="noreferrer"
             style={{ display: 'block', width: 84, height: 84, borderRadius: 8, overflow: 'hidden',
                      border: '1px solid #e5e7eb', background: '#f3f4f6' }}>
            {f.url && <img src={f.url} alt="evidencia" loading="lazy"
                           style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
          </a>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" onClick={() => camaraRef.current?.click()} disabled={subiendo} style={btn}>
          <span style={{ fontSize: 16 }}>📷</span> Tomar foto
        </button>
        <button type="button" onClick={() => galeriaRef.current?.click()} disabled={subiendo} style={btn}>
          <span style={{ fontSize: 16 }}>🖼️</span> Subir varias
        </button>
        {subiendo && (
          <span style={{ fontSize: 12, color: '#6b7280' }}>
            Subiendo{progreso ? ` ${progreso}` : ''}…
          </span>
        )}
      </div>

      {/* Cámara trasera, una por toque */}
      <input ref={camaraRef} type="file" accept="image/*" capture="environment"
             onChange={onArchivos} style={{ display: 'none' }} />
      {/* Galería, selección múltiple */}
      <input ref={galeriaRef} type="file" accept="image/*" multiple
             onChange={onArchivos} style={{ display: 'none' }} />

      {error && <div style={{ color: '#dc2626', fontSize: 12, marginTop: 6 }}>{error}</div>}
    </div>
  );
}
