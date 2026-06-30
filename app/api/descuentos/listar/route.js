// app/api/descuentos/listar/route.js
import { sesionYCaps } from '@/lib/descuentosServer';

export async function GET() {
  try {
    const { caps, supa } = await sesionYCaps();

    const { data, error } = await supa
      .from('descuentos')
      .select('*')
      .order('id', { ascending: false });

    if (error) return Response.json({ error: error.message }, { status: 500 });

    return Response.json({ caps, rows: data || [] });
  } catch (e) {
    return Response.json({ error: e.error || 'Error' }, { status: e.status || 500 });
  }
}
