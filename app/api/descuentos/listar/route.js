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

    // Orden por NUM (como el Excel). num puede traer decimales históricos (2003.2);
    // ordenamos por su valor numérico, descendente (lo más nuevo arriba).
    const rows = (data || []).slice().sort((a, b) => {
      const na = parseFloat(a.num), nb = parseFloat(b.num);
      const va = Number.isFinite(na) ? na : -Infinity;
      const vb = Number.isFinite(nb) ? nb : -Infinity;
      return vb - va;
    });

    return Response.json({ caps, rows });
  } catch (e) {
    return Response.json({ error: e.error || 'Error' }, { status: e.status || 500 });
  }
}
