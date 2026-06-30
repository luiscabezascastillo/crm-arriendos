// app/api/descuentos/corregir/route.js
import { sesionYCaps, registrarBitacora } from '@/lib/descuentosServer';
import { TIPOS, REPERCUTIR_A } from '@/lib/descuentosPermisos';

// Campos que un corrector (Karina/Dirección) puede editar.
// NO incluye creado_por/at ni el num original (trazabilidad intacta).
const CAMPOS_EDITABLES = new Set([
  'mes_a_imputar', 'idadmon', 'inmueble', 'propietario', 'repercutir_a',
  'idadmon_relacionado', 'relacionado', 'monto_a_imputar', 'monto_a_transferir',
  'link_admon', 'admon_piensa_que_se_necesita_factura_boleta',
  'texto_explicativo_para_carta_a_propietario', 'aclaracion', 'tipo',
  'comentarios_karina', 'visto_bueno_de_karina_y_mas_comentarios',
  'fecha_contable', 'texto_para_contabilidad',
]);

export async function POST(req) {
  try {
    const { email, caps, supa } = await sesionYCaps();
    if (!caps.corregir) {
      return Response.json({ error: 'No tienes permiso para corregir descuentos' }, { status: 403 });
    }

    const { id, cambios } = await req.json();
    if (!id) return Response.json({ error: 'Falta id' }, { status: 400 });
    if (!cambios || typeof cambios !== 'object') {
      return Response.json({ error: 'Sin cambios' }, { status: 400 });
    }

    // Fila actual (para comparar antes/después)
    const { data: actual, error: e1 } = await supa
      .from('descuentos').select('*').eq('id', id).single();
    if (e1 || !actual) return Response.json({ error: 'Descuento no encontrado' }, { status: 404 });

    // Validaciones de campos cerrados
    if (cambios.tipo != null) {
      const t = String(cambios.tipo).trim().toUpperCase();
      if (!TIPOS.includes(t)) return Response.json({ error: 'TIPO no válido' }, { status: 400 });
      cambios.tipo = t;
    }
    if (cambios.repercutir_a != null) {
      const r = String(cambios.repercutir_a).trim().toUpperCase();
      if (!REPERCUTIR_A.includes(r)) return Response.json({ error: 'IMPUTAR A no válido' }, { status: 400 });
      cambios.repercutir_a = r;
    }
    if (cambios.texto_explicativo_para_carta_a_propietario != null) {
      const tx = String(cambios.texto_explicativo_para_carta_a_propietario).trim();
      if (tx.length < 45) return Response.json({ error: 'El texto para liquidación debe tener al menos 45 caracteres' }, { status: 400 });
      cambios.texto_explicativo_para_carta_a_propietario = tx;
    }

    // Construir patch solo con campos editables que cambian de verdad
    const patch = {};
    const filasBitacora = [];
    for (const [campo, valorNuevoRaw] of Object.entries(cambios)) {
      if (!CAMPOS_EDITABLES.has(campo)) continue;
      const valorNuevo = valorNuevoRaw == null ? null : String(valorNuevoRaw);
      const valorAnt = actual[campo] == null ? null : String(actual[campo]);
      if (valorNuevo === valorAnt) continue; // no cambió
      patch[campo] = valorNuevo;
      filasBitacora.push({
        descuento_id: id, num: actual.num, accion: 'corregir',
        campo, valor_anterior: valorAnt, valor_nuevo: valorNuevo, usuario: email,
      });
    }

    if (Object.keys(patch).length === 0) {
      return Response.json({ ok: true, sinCambios: true });
    }

    patch.modificado_por = email;
    patch.modificado_at = new Date().toISOString();

    const { data: upd, error: e2 } = await supa
      .from('descuentos').update(patch).eq('id', id).select().single();
    if (e2) return Response.json({ error: e2.message }, { status: 500 });

    await registrarBitacora(supa, filasBitacora);

    return Response.json({ ok: true, row: upd });
  } catch (e) {
    return Response.json({ error: e.error || 'Error' }, { status: e.status || 500 });
  }
}
