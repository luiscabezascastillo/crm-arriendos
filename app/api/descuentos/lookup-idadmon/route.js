// VERSION: v2 · 2026-07-17 · Además de inmueble/propietario/estado, devuelve el SUCESOR del inmueble
//   (otro idadmon con el mismo idlinmue en estado P/S/SQ) para autocompletar idadmon_relacionado
//   en los descuentos de término (T-...). Si hay 0 o >1 candidatos, sucesor = null (se rellena a mano).
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
      .select('idadmon, propietario, inmueble, estado, idlinmue')
      .eq('idadmon', idadmon)
      .maybeSingle();

    if (error) return Response.json({ error: error.message }, { status: 500 });
    if (!data) return Response.json({ encontrado: false });

    // Buscar el sucesor: mismo idlinmue, distinto idadmon, en estado activo (P/S/SQ)
    let sucesor = null;
    let sucesor_multiple = false;
    if (data.idlinmue) {
      const { data: hermanos } = await supa
        .from('datos_arriendos')
        .select('idadmon, estado, arrendatario')
        .eq('idlinmue', data.idlinmue)
        .neq('idadmon', idadmon);
      const activos = (hermanos || []).filter(h =>
        ['P', 'S', 'SQ'].includes(String(h.estado || '').trim().toUpperCase())
      );
      if (activos.length === 1) sucesor = activos[0].idadmon;
      else if (activos.length > 1) sucesor_multiple = true; // ambiguo: no autocompletar
    }

    return Response.json({
      encontrado: true,
      idadmon: data.idadmon,
      propietario: data.propietario,
      inmueble: data.inmueble,
      estado: data.estado,
      sucesor,            // idadmon del nuevo ciclo, o null
      sucesor_multiple,   // true si hay varios activos (no se autocompleta)
    });
  } catch (e) {
    return Response.json({ error: e.error || 'Error' }, { status: e.status || 500 });
  }
}
