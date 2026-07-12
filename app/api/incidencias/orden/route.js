// VERSION: v1 · 2026-07-10 · Genera la Orden de Trabajo (PDF) de una incidencia y la guarda en Storage
// Patrón de app/api/ordenes/*: getToken + supabaseAdmin + pdf-lib.
import { getToken } from 'next-auth/jwt';
import { Resend } from 'resend';
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
    const { incidencia_id, enviar } = await req.json();
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

    // Envío opcional al proveedor por email (Resend), mismo patrón que /api/ordenes/email
    let emailed = false, emailMsg = '';
    if (enviar) {
      const destinoReal = (proveedor?.email || '').trim();
      const testTo = (process.env.RESEND_TEST_TO || '').trim();
      const to = testTo || destinoReal;
      if (!process.env.RESEND_API_KEY) {
        emailMsg = 'La orden se generó, pero falta RESEND_API_KEY en el entorno para enviar.';
      } else if (!to) {
        emailMsg = 'La orden se generó, pero el proveedor no tiene email.';
      } else {
        try {
          const resend = new Resend(process.env.RESEND_API_KEY);
          const from = process.env.RESEND_FROM || 'Fondo Capital Rent <onboarding@resend.dev>';
          const esPrueba = !!testTo;
          const notaPrueba = esPrueba
            ? `<div style="background:#FEF3C7;border:1px solid #FCD34D;border-radius:8px;padding:10px 12px;margin:0 0 16px;font-size:13px;color:#92400E"><b>MODO PRUEBA.</b> Este correo iba dirigido a <b>${destinoReal || '(proveedor sin email)'}</b>, pero se redirigió a tu correo de pruebas.</div>`
            : '';
          const html = `
            <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1a1a2e">
              ${notaPrueba}
              <h2 style="color:#1f2937;margin:0 0 4px">Orden de trabajo ${inc.numero_ticket}</h2>
              <p style="color:#6b7280;margin:0 0 16px">Mantención · Fondo Capital Rent</p>
              <p>Estimado/a ${proveedor?.nombre || 'proveedor'},</p>
              <p>Adjuntamos la orden de trabajo para la propiedad <b>${inc.inmueble || inc.idadmon || ''}</b>.</p>
              <ul style="color:#374151;font-size:14px">
                <li><b>Categoría:</b> ${CAT[inc.categoria] || inc.categoria || '—'}</li>
                <li><b>Urgencia:</b> ${URG[inc.urgencia] || inc.urgencia || '—'}</li>
                <li><b>Descripción:</b> ${inc.descripcion || '—'}</li>
              </ul>
              <p style="color:#6b7280;font-size:13px">Por favor coordinar el acceso con el arrendatario y registrar fotos del antes y después.</p>
            </div>`;
          await resend.emails.send({
            from, to,
            subject: `Orden de trabajo ${inc.numero_ticket} — Fondo Capital`,
            html,
            attachments: [{ filename: `orden-trabajo-${inc.numero_ticket}.pdf`, content: Buffer.from(bytes).toString('base64') }],
          });
          emailed = true;
          emailMsg = esPrueba
            ? `Enviada en MODO PRUEBA a ${to} (destino real: ${destinoReal || 'sin email'}).`
            : `Orden enviada a ${to}.`;
        } catch (e) {
          console.error('[orden email]', e);
          emailMsg = 'La orden se generó, pero falló el envío: ' + (e.message || e);
        }
      }
    }

    return Response.json({ ok: true, url, path, emailed, emailMsg });
  } catch (err) {
    console.error('[api/incidencias/orden]', err);
    return Response.json({ error: 'No se pudo generar la orden: ' + (err.message || err) }, { status: 500 });
  }
}
