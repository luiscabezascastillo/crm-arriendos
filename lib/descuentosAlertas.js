// VERSION: v1 · 2026-08-03 · Helper para crear una alerta a Karina cuando un descuento se imputa a FCR.
//   Un descuento a FCR requiere aprobación de Alberto y validación de Karina; esta alerta le avisa para
//   que lo revise. Anti-duplicado: no crea otra si ya hay una alerta 'descuento_fcr' para ese num sin resolver.
// lib/descuentosAlertas.js

const KARINA_EMAIL = 'karina.morales@fondocapital.com';

// Inserta (si hace falta) una alerta 'descuento_fcr' para Karina.
// supa = cliente service-role (el de sesionYCaps). Devuelve {creada:boolean, ...}.
export async function crearAlertaFcrSiHaceFalta(supa, { num, idadmon }) {
  try {
    const nSafe = String(num || '').trim();
    if (!nSafe) return { creada: false, motivo: 'sin_num' };

    // Anti-duplicado: ¿ya existe una alerta de este descuento a FCR sin resolver?
    const { data: ya } = await supa
      .from('alertas')
      .select('id')
      .eq('origen', 'descuento_fcr')
      .neq('estado', 'resuelta')
      .ilike('tema', `%Nº ${nSafe},%`)
      .limit(1);
    if (ya && ya.length) return { creada: false, motivo: 'ya_existe' };

    const hoy = new Date();
    const fecha = hoy.toISOString().slice(0, 10); // YYYY-MM-DD (columna date)
    const fechaResolver = new Date(hoy.getTime() + 3 * 86400000).toISOString().slice(0, 10); // +3 días

    const { error } = await supa.from('alertas').insert({
      para_email: KARINA_EMAIL,
      tema: `Revisar para aprobar o rechazar descuento Nº ${nSafe}, imputado a FCR (requiere aprobación de Alberto)`,
      cuerpo: `El descuento Nº ${nSafe}${idadmon ? ' (' + idadmon + ')' : ''} se ha imputado a FCR. Un cargo a FCR requiere aprobación de Alberto y validación de Karina antes de liquidar. Revisa si se acepta o se reimputa (al arrendatario o al propietario).`,
      origen: 'descuento_fcr',
      ref_idadmon: idadmon || null,
      fecha,
      fecha_resolver: fechaResolver,
      estado: 'pendiente',
    });
    if (error) return { creada: false, error: error.message };
    return { creada: true };
  } catch (e) {
    // Nunca romper el guardado del descuento por un fallo de la alerta.
    return { creada: false, error: String((e && e.message) || e) };
  }
}
