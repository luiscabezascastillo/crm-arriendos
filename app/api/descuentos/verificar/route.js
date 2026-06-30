// app/api/descuentos/verificar/route.js
import { sesionYCaps, registrarBitacora } from '@/lib/descuentosServer';

export async function POST(req) {
  try {
    const { email, caps, supa } = await sesionYCaps();
    if (!caps.verificar) {
      return Response.json({ error: 'No tienes permiso para verificar descuentos' }, { status: 403 });
    }

    const { id, verificado } = await req.json();
    if (!id) return Response.json({ error: 'Falta id' }, { status: 400 });

    const { data: actual, error: e1 } = await supa
      .from('descuentos').select('id, num, verificado').eq('id', id).single();
    if (e1 || !actual) return Response.json({ error: 'Descuento no encontrado' }, { status: 404 });

    const nuevo = verificado !== false; // por defecto marca true
    const patch = {
      verificado: nuevo,
      verificado_por: nuevo ? email : null,
      verificado_at: nuevo ? new Date().toISOString() : null,
    };

    const { data: upd, error: e2 } = await supa
      .from('descuentos').update(patch).eq('id', id).select().single();
    if (e2) return Response.json({ error: e2.message }, { status: 500 });

    await registrarBitacora(supa, [{
      descuento_id: id, num: actual.num, accion: 'verificar',
      campo: 'verificado',
      valor_anterior: String(!!actual.verificado),
      valor_nuevo: String(nuevo),
      usuario: email,
    }]);

    return Response.json({ ok: true, row: upd });
  } catch (e) {
    return Response.json({ error: e.error || 'Error' }, { status: e.status || 500 });
  }
}
