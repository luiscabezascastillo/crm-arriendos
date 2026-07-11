// VERSION: v1 · 2026-07-10 · Genera la Orden de Trabajo (PDF) de una incidencia y la guarda en Storage
// Patrón de app/api/ordenes/*: getToken + supabaseAdmin + pdf-lib.
import { getToken } from 'next-auth/jwt';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin.js';
import { generarOrdenTrabajoPDF } from '../../../../lib/pdfOrdenTrabajo.js';

export const runtime = 'nodejs';
const BUCKET = 'incidencias';

const CAT = {
  sanitario: 'Sanitario', electrico: 'Eléctrico', gas: 'Gas', estructural: 'Estructural',
  cerrajeria: 'Cerrajería', ascensor: 'Ascensor', accesos: 'Accesos',
  electrodomestico: 'Electrodoméstico', seguridad: 'Seguridad', otros: 'Otros',
};
const URG = { alta: 'Alta (24h)', media: 'Media (72h)', baja: 'Baja (7 días)' };

export async function POST(req) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return Response.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const { incidencia_id } = await req.json();
    if (!incidencia_id) return Response.json({ error: 'Falta incidencia_id' }, { status: 400 });

    const { data: inc, error: eInc } = await supabaseAdmin
      .from('incidencias').select('*').eq('id', incidencia_id).single();
    if (eInc || !inc) return Response.json({ error: 'Incidencia no encontrada' }, { status: 404 });

    let proveedor = null;
    if (inc.proveedor_id) {
      const { data } = await supabaseAdmin.from('contactos')
        .select('nombre, empresa, telefono, whatsapp, email').eq('id', inc.proveedor_id).maybeSingle();
      proveedor = data || null;
    }
    let presupuesto = null;
    if (inc.presupuesto_id) {
      const { data } = await supabaseAdmin.from('presupuestos')
        .select('numero, total').eq('id', inc.presupuesto_id).maybeSingle();
      presupuesto = data || null;
    }

    const fecha = new Date().toISOString().slice(0, 10);
    const bytes = await generarOrdenTrabajoPDF({
      ticket: inc.numero_ticket, fecha,
      inmueble: inc.inmueble || inc.ubicacion, idadmon: inc.idadmon, propietario: inc.propietario,
      categoria: CAT[inc.categoria] || inc.categoria, urgencia: URG[inc.urgencia] || inc.urgencia,
      descripcion: inc.descripcion,
      proveedor: proveedor ? {
        nombre: proveedor.nombre, empresa: proveedor.empresa,
        telefono: proveedor.telefono || proveedor.whatsapp, email: proveedor.email,
      } : null,
      presupuesto: presupuesto ? { numero: presupuesto.numero, total: presupuesto.total } : null,
      emisor: token.email || null,
    });

    const path = `${incidencia_id}/ordenes/OT_${inc.numero_ticket}_${Date.now()}.pdf`;
    const up = await supabaseAdmin.storage.from(BUCKET)
      .upload(path, Buffer.from(bytes), { contentType: 'application/pdf', upsert: false });
    if (up.error) throw up.error;

    // registrar como adjunto (documento) en la etapa de resolución
    await supabaseAdmin.from('incidencia_adjuntos').insert({
      incidencia_id, etapa: 'resolucion', tipo: 'documento',
      storage_path: path, nota: 'Orden de trabajo', subido_por: token.email || null,
    });

    const url = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    return Response.json({ ok: true, url, path });
  } catch (err) {
    console.error('[api/incidencias/orden]', err);
    return Response.json({ error: 'No se pudo generar la orden: ' + (err.message || err) }, { status: 500 });
  }
}
