// app/api/descuentos/lookup-idadmon/route.js
import { sesionYCaps } from '@/lib/descuentosServer';

export async function GET(req) {
  try {
    const { supa } = await sesionYCaps();
    const { searchParams } = new URL(req.url);
    const idadmon = (searchParams.get('idadmon') || '').trim();
    if (!idadmon) return Response.json({ error: 'Falta idadmon' }, { status: 400 });

    const { data, error } = await supa
      .from('datos_arriendos')
      .select('idadmon, propietario, inmueble, estado')
      .eq('idadmon', idadmon)
      .maybeSingle();

    if (error) return Response.json({ error: error.message }, { status: 500 });
    if (!data) return Response.json({ encontrado: false });

    return Response.json({ encontrado: true, ...data });
  } catch (e) {
    return Response.json({ error: e.error || 'Error' }, { status: e.status || 500 });
  }
}
