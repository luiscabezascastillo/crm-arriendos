// VERSION: v1 · 2026-07-10 · Subida de foto de incidencia (servidor, supabaseAdmin) + fila en incidencia_adjuntos
// Mismo patrón que app/api/ordenes/*: auth con getToken + supabaseAdmin + Storage.
import { getToken } from 'next-auth/jwt';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin.js';

export const runtime = 'nodejs';

const BUCKET = 'incidencias';

export async function POST(req) {
  // auth: requiere sesión (igual que ordenes/generar)
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return Response.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const form = await req.formData();
    const file = form.get('file');
    const incidenciaRaw = form.get('incidencia_id');
    const etapa = form.get('etapa');
    const subido_por = form.get('subido_por') || token?.email || null;

    if (!file || !incidenciaRaw || !etapa) {
      return Response.json({ error: 'Faltan datos (file, incidencia_id, etapa)' }, { status: 400 });
    }
    // id numérico (bigint) o texto (uuid): soporta ambos
    const incidencia_id = /^\d+$/.test(String(incidenciaRaw)) ? Number(incidenciaRaw) : incidenciaRaw;

    const bytes = Buffer.from(await file.arrayBuffer());
    const path = `${incidencia_id}/${etapa}/${Date.now()}.jpg`;

    const up = await supabaseAdmin.storage.from(BUCKET)
      .upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
    if (up.error) throw up.error;

    const { error: eIns } = await supabaseAdmin.from('incidencia_adjuntos').insert({
      incidencia_id, etapa, tipo: 'foto', storage_path: path, subido_por,
    });
    if (eIns) throw eIns;

    const url = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    return Response.json({ ok: true, path, url });
  } catch (err) {
    console.error('[api/incidencias/foto]', err);
    return Response.json({ error: 'Error al subir la foto' }, { status: 500 });
  }
}
