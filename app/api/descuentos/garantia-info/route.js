// app/api/descuentos/garantia-info/route.js
// VERSION: v1 · 2026-08-01 · Dado el IDADMON de un contrato terminado, devuelve su garantía y quién la tiene, más el
//   sucesor vigente (P/S/SQ) del inmueble. Lo usa el botón "Crear devolución de garantía". Solo lectura.
import { sesionYCaps } from '@/lib/descuentosServer';

const norm = (s) => String(s || '').trim().toUpperCase();
const esDueno = (q) => ['DUEÑO', 'DUENO', 'FCR PARA DUEÑO', 'FCR PARA EL DUEÑO', 'FCR PARA DUENO'].includes(norm(q));
const numOf = (v) => {
  const n = Math.round(Number(String(v ?? '').replace(/\./g, '').replace(/[^0-9.\-]/g, '')));
  return Number.isFinite(n) ? n : 0;
};
const primerTok = (idlinmue) => String(idlinmue || '').trim().split(/\s+/)[0] || '';

export async function GET(req) {
  try {
    const { supa } = await sesionYCaps();
    const idadmon = new URL(req.url).searchParams.get('idadmon');
    if (!idadmon) return Response.json({ error: 'Falta idadmon' }, { status: 400 });

    // Contrato terminado (el del descuento T-)
    const { data: term, error } = await supa
      .from('datos_arriendos')
      .select('idadmon, estado, quien_tiene_garantia, garantia_pedida, deuda_garantia, inmueble, propietario, idlinmue')
      .eq('idadmon', idadmon)
      .maybeSingle();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    if (!term) return Response.json({ encontrado: false });

    const garantia = numOf(term.garantia_pedida);
    const es_dueno = esDueno(term.quien_tiene_garantia);

    // Sucesor vigente (P/S/SQ) del mismo inmueble. Primero por idlinmue exacto; si no,
    // por inclusión del primer token (para agrupaciones cuyo idlinmue cambió).
    let sucesores = [];
    const tok = primerTok(term.idlinmue);
    if (term.idlinmue) {
      const { data: exactos } = await supa
        .from('datos_arriendos')
        .select('idadmon, estado, inmueble, propietario, idlinmue, fecha_inicio')
        .eq('idlinmue', term.idlinmue)
        .neq('idadmon', idadmon)
        .in('estado', ['P', 'S', 'SQ']);
      sucesores = exactos || [];
      if (sucesores.length === 0 && tok) {
        const { data: porTok } = await supa
          .from('datos_arriendos')
          .select('idadmon, estado, inmueble, propietario, idlinmue, fecha_inicio')
          .ilike('idlinmue', `%${tok}%`)
          .neq('idadmon', idadmon)
          .in('estado', ['P', 'S', 'SQ']);
        sucesores = porTok || [];
      }
    }
    // Ordenar: primero S/SQ (arrendados) por fecha, luego P.
    sucesores.sort((a, b) => {
      const rank = (e) => (norm(e) === 'S' || norm(e) === 'SQ' ? 0 : 1);
      const ra = rank(a.estado), rb = rank(b.estado);
      if (ra !== rb) return ra - rb;
      return String(a.fecha_inicio || '').localeCompare(String(b.fecha_inicio || ''));
    });

    const sucesorUnico = sucesores.length === 1 ? sucesores[0] : null;
    // Datos del sucesor a heredar (inmueble/propietario): del único, o del término si no hay único.
    const base = sucesorUnico || term;

    return Response.json({
      encontrado: true,
      idadmon,
      estado: term.estado,
      quien_tiene_garantia: term.quien_tiene_garantia || '',
      es_dueno,
      garantia,
      deuda_garantia: numOf(term.deuda_garantia),
      inmueble: base.inmueble || term.inmueble || '',
      propietario: base.propietario || term.propietario || '',
      sucesor: sucesorUnico ? sucesorUnico.idadmon : '',
      sucesor_multiple: sucesores.length > 1,
      sucesores: sucesores.map((s) => `${s.idadmon}:${s.estado}`),
    });
  } catch (e) {
    return Response.json({ error: e.error || 'Error' }, { status: e.status || 500 });
  }
}
