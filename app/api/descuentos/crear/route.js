// VERSION: v4 · 2026-08-04 · FCR: exige adjuntar el email de aceptación de Karina al crear (bloqueo). ARRENDATARIO: al crear el descuento se CARGA AUTOMÁTICAMENTE en la cartola del
//   arrendatario (cargo si +, abono si −) y se marca pasado_a_cartola. Si la carga falla, el descuento se crea
//   igual (queda sin pasar, para gestionarlo con el botón). FCR: sigue generando alerta a Karina (v2). No rompe
//   el alta si algo secundario falla.
// app/api/descuentos/crear/route.js
import { sesionYCaps, registrarBitacora } from '@/lib/descuentosServer';
import { nombreCorto, TIPOS, REPERCUTIR_A } from '@/lib/descuentosPermisos';
import { crearAlertaFcrSiHaceFalta } from '@/lib/descuentosAlertas';
import { pasarDescuentoACartola } from '@/app/api/descuentos/pasar-cartola/route';

// MES A IMPUTAR "JULIO 2026" -> mmdd "2607" y fecha_contable "07/07/2026"
const MESES = {
  ENERO: 1, FEBRERO: 2, MARZO: 3, ABRIL: 4, MAYO: 5, JUNIO: 6,
  JULIO: 7, AGOSTO: 8, SEPTIEMBRE: 9, OCTUBRE: 10, NOVIEMBRE: 11, DICIEMBRE: 12,
};

function parseMes(mesAImputar) {
  // "JULIO 2026" -> { mm: 7, yyyy: 2026 }
  const m = String(mesAImputar || '').trim().toUpperCase().match(/([A-ZÁÉÍÓÚÑ]+)\s+(\d{4})/);
  if (!m) return null;
  const mm = MESES[m[1].normalize('NFD').replace(/[\u0300-\u036f]/g, '')];
  if (!mm) return null;
  return { mm, yyyy: parseInt(m[2], 10) };
}

const pad2 = (n) => String(n).padStart(2, '0');

export async function POST(req) {
  try {
    const { email, caps, supa } = await sesionYCaps();
    if (!caps.crear) {
      return Response.json({ error: 'No tienes permiso para crear descuentos' }, { status: 403 });
    }

    const b = await req.json();

    // --- Validaciones obligatorias ---
    const idadmon = String(b.idadmon || '').trim();
    if (!idadmon) return Response.json({ error: 'Falta el IDADMON' }, { status: 400 });

    const mesAImputar = String(b.mes_a_imputar || '').trim();
    const mes = parseMes(mesAImputar);
    if (!mes) return Response.json({ error: 'MES A IMPUTAR inválido (formato esperado: "JULIO 2026")' }, { status: 400 });

    const tipo = String(b.tipo || '').trim().toUpperCase();
    if (!TIPOS.includes(tipo)) return Response.json({ error: 'TIPO no válido' }, { status: 400 });

    const repercutir = String(b.repercutir_a || '').trim().toUpperCase();
    if (!REPERCUTIR_A.includes(repercutir)) return Response.json({ error: 'IMPUTAR A no válido' }, { status: 400 });

    const texto = String(b.texto_explicativo_para_carta_a_propietario || '').trim();
    if (texto.length < 45) {
      return Response.json({ error: 'El texto para liquidación debe tener al menos 45 caracteres' }, { status: 400 });
    }

    // FCR: exige la copia/referencia del email de Karina que acepta el cargo (evidencia obligatoria).
    const fcrEmail = String(b.fcr_email_aceptacion || '').trim();
    if (repercutir === 'FCR' && fcrEmail.length < 15) {
      return Response.json({ error: 'Un cargo a FCR requiere adjuntar el email de Karina que lo acepta (mínimo 15 caracteres). Sin él no se puede crear.' }, { status: 400 });
    }

    const montoImputar = Math.round(Number(b.monto_a_imputar));
    if (!Number.isFinite(montoImputar)) return Response.json({ error: 'MONTO A IMPUTAR inválido' }, { status: 400 });
    const montoTransferir = b.monto_a_transferir === '' || b.monto_a_transferir == null
      ? null : Math.round(Number(b.monto_a_transferir));

    // --- num correlativo (MAX(num::int)+1) ---
    const { data: maxRow } = await supa
      .from('descuentos')
      .select('num')
      .order('id', { ascending: false })
      .limit(200);
    let maxNum = 0;
    (maxRow || []).forEach((r) => {
      const n = parseInt(r.num, 10);
      if (Number.isFinite(n) && n > maxNum) maxNum = n;
    });
    const num = String(maxNum + 1);

    const mmdd = `${String(mes.yyyy).slice(2)}${pad2(mes.mm)}`;            // 2607
    const fechaContable = `${pad2(mes.mm)}/07/${mes.yyyy}`;               // 07/07/2026 (día 7, criterio FCR)
    const textoContab = `${num} ${idadmon} ${tipo} ${repercutir} ${texto}`;

    const hoyISO = new Date().toISOString();

    const fila = {
      num,
      fecha: new Date().toLocaleDateString('es-CL'),
      mes_a_imputar: mesAImputar.toUpperCase(),
      ingresado_por: nombreCorto(email),
      idadmon,
      inmueble: String(b.inmueble || '').trim(),
      propietario: String(b.propietario || '').trim(),
      repercutir_a: repercutir,
      idadmon_relacionado: String(b.idadmon_relacionado || '').trim() || null,
      relacionado: String(b.relacionado || '').trim() || null,
      monto_a_imputar: String(montoImputar),
      monto_a_transferir: montoTransferir == null ? null : String(montoTransferir),
      link_admon: String(b.link_admon || '').trim() || null,
      admon_piensa_que_se_necesita_factura_boleta: String(b.factura_boleta || '').trim() || null,
      texto_explicativo_para_carta_a_propietario: texto,
      aclaracion: String(b.aclaracion || '').trim() || null,
      fcr_email_aceptacion: repercutir === 'FCR' ? fcrEmail : null,
      tipo,
      mmdd,
      fecha_contable: fechaContable,
      texto_para_contabilidad: textoContab,
      // auditoría CRM
      creado_por: email,
      creado_at: hoyISO,
      verificado: false,
      origen: 'crm',
    };

    const { data: ins, error } = await supa
      .from('descuentos')
      .insert(fila)
      .select()
      .single();

    if (error) return Response.json({ error: error.message }, { status: 500 });

    await registrarBitacora(supa, [{
      descuento_id: ins.id, num: ins.num, accion: 'crear',
      campo: null, valor_anterior: null, valor_nuevo: null, usuario: email,
    }]);

    // Si se imputa a FCR, avisar a Karina para que lo apruebe/rechace.
    let alertaFcr = null;
    if (repercutir === 'FCR') {
      alertaFcr = await crearAlertaFcrSiHaceFalta(supa, { num: ins.num, idadmon });
    }

    // ARRENDATARIO: cargar automáticamente en la cartola (cargo si +, abono si −).
    // Si falla, el descuento queda creado pero sin pasar (se gestiona luego con el botón).
    let cartola = null;
    if (repercutir === 'ARRENDATARIO') {
      try {
        const r = await pasarDescuentoACartola(supa, ins, email);
        if (r.ok) {
          await supa.from('descuentos')
            .update({ pasado_a_cartola: new Date().toISOString(), pasado_a_cartola_por: email })
            .eq('id', ins.id);
          cartola = { ok: true, tipo: r.tipo, monto: r.monto, accion: r.accion };
        } else {
          cartola = { ok: false, error: r.error };
        }
      } catch (e) {
        cartola = { ok: false, error: String((e && e.message) || e) };
      }
    }

    return Response.json({ ok: true, row: ins, alertaFcr, cartola });
  } catch (e) {
    return Response.json({ error: e.error || 'Error' }, { status: e.status || 500 });
  }
}
