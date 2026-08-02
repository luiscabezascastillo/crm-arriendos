// app/api/descuentos/listar/route.js
// VERSION: v2 · 2026-08-01 · Adjunta a cada descuento `campos_corregidos`: los campos de DATOS que se corrigieron
//   (accion='corregir' en descuentos_bitacora). Sirve para pintar en beige esas celdas (lista y ficha).
import { sesionYCaps } from '@/lib/descuentosServer';

// Campos de DATOS cuya corrección se resalta (excluye comentarios/aclaración/textos largos).
const CAMPOS_BEIGE = [
  'idadmon', 'idadmon_relacionado', 'mes_a_imputar', 'repercutir_a', 'tipo',
  'monto_a_imputar', 'monto_a_transferir',
  'admon_piensa_que_se_necesita_factura_boleta', 'factura_boleta',
  'relacionado', 'link_admon',
];

export async function GET() {
  try {
    const { caps, supa } = await sesionYCaps();

    const { data, error } = await supa
      .from('descuentos')
      .select('*')
      .order('id', { ascending: false });

    if (error) return Response.json({ error: error.message }, { status: 500 });

    // Una sola consulta: campos de datos corregidos por descuento.
    const corregidosPorId = {};
    try {
      const { data: bita } = await supa
        .from('descuentos_bitacora')
        .select('descuento_id, campo')
        .eq('accion', 'corregir')
        .in('campo', CAMPOS_BEIGE);
      for (const b of (bita || [])) {
        if (b.descuento_id == null || !b.campo) continue;
        (corregidosPorId[b.descuento_id] || (corregidosPorId[b.descuento_id] = new Set())).add(b.campo);
      }
    } catch { /* si falla, la lista sigue funcionando (sin beige) */ }

    // Orden por NUM (como el Excel). num puede traer decimales históricos (2003.2);
    // ordenamos por su valor numérico: el más alto/reciente queda al FINAL (abajo).
    const rows = (data || []).slice().sort((a, b) => {
      const na = parseFloat(a.num), nb = parseFloat(b.num);
      const va = Number.isFinite(na) ? na : Infinity;
      const vb = Number.isFinite(nb) ? nb : Infinity;
      return va - vb;
    });

    // Adjuntar los campos corregidos a cada fila.
    for (const r of rows) {
      const set = corregidosPorId[r.id];
      r.campos_corregidos = set ? Array.from(set) : [];
    }

    return Response.json({ caps, rows });
  } catch (e) {
    return Response.json({ error: e.error || 'Error' }, { status: e.status || 500 });
  }
}
