// app/api/descuentos/bitacora/route.js
import { sesionYCaps } from '@/lib/descuentosServer';

export async function GET(req) {
  try {
    const { supa } = await sesionYCaps(); // basta con estar autenticado y tener fila/Dirección
    const { searchParams } = new URL(req.url);
    const descuentoId = searchParams.get('descuento_id');
    if (!descuentoId) return Response.json({ error: 'Falta descuento_id' }, { status: 400 });

    const { data, error } = await supa
      .from('descuentos_bitacora')
      .select('*')
      .eq('descuento_id', descuentoId)
      .order('created_at', { ascending: false });

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ rows: data || [] });
  } catch (e) {
    return Response.json({ error: e.error || 'Error' }, { status: e.status || 500 });
  }
}
