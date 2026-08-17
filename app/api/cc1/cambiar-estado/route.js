// VERSION: v8 · 2026-08-17 · Al crear el expediente de término (S→Q) se SIEMBRAN también las 6 tareas del workflow
//   desde la plantilla workflow_nodes (T1 ACTIVO + T2..T6 PENDIENTE, responsable = area_responsable). Antes el
//   circuito creaba la instancia pero no las tareas, y esos términos salían "sin expediente". Hereda v7.
// VERSION: v7 · 2026-08-14 · Nuevos sub-estados de término Q-Auditado y Q-Reclamado (Q → Q-Auditado / Q-Reclamado).
//   Acción SENSIBLE: solo Dirección + Karina (cap.puedeAuditarTermino), sin exigir rol en Gestión LOG. Solo desde
//   un término en Q (o alternando entre los dos sub-estados). Escribe en datos_arriendos.estado y registra en
//   historico_idadmon como cualquier cambio de estado; NO crea IDADMON en P ni workflow (eso es solo al entrar en Q).
//   Hereda v6.
// VERSION: v6 · 2026-08-12 · FECHAS dd/mm → ISO: normaliza la `fecha` de entrada (dd/mm/aaaa) a aaaa-mm-dd
//   con aISO() ANTES de escribir termino_actual y de armar el correo, para que ni JS ni Postgres (datestyle
//   MDY) intercambien día y mes. Corrige el swap de la fecha de entrega/aviso de término. Hereda v5.
// VERSION: v5 · 2026-07-15 · Cierra la puerta trasera P→S: este endpoint RECHAZA estadoNuevo='S'.
//   La activación (llegar a S) solo se hace por CERRAR Y FACTURAR (valida + escribe inicios +
//   facturación). Emergencia: forzar-estado (solo Dirección, con registro). Resto idéntico a v4.
// VERSION: v4 · 2026-07-13 · Acepta `comentario` (opcional) del cambio de estado y lo guarda en
//   historico_idadmon.detalle (contexto de qué pasó). Aditivo: si no viene, queda null. Resto igual.
// VERSION: v3 · 2026-07-13 · Al avisar/entrar en término (S->SQ, S->Q) se escribe la fecha
//   comunicada en datos_arriendos.termino_actual (fecha real en que el arrendatario dice que se va).
//   termino_inicial (la del contrato) NO se toca. Solo si viene `fecha`. Resto igual que v2.
// VERSION: v2 · 2026-07-12 · Bloque 2 Términos: autorización de cierre (lee `solicitudes`)
//   + estampa autorizado_por/motivo_cierre en historico_idadmon + crea workflow_instance al pasar a Q.
//   Sobre el v1 desplegado (gate maker-checker con 16 tests). Cambios marcados con ▼▼▼ BLOQUE 2.
//
// app/api/cc1/cambiar-estado/route.js
//
// Núcleo del circuito de estados. Recibe { idadmon, estadoNuevo, fecha? }.
// 1. Valida sesión y permiso (revision_log: responsable/supervisor/dirección).
// 2. Cambia el estado del contrato en datos_arriendos.
// 3. Si la transición es S->SQ (o S->Q tratada como SQ+Q), crea automáticamente
//    el siguiente IDADMON en estado P, heredando datos de inmueble/propietario,
//    insertando una fila nueva en la tabla `idadmon` (correlativo MAX+1).
// 4. Registra el/los evento(s) en historico_idadmon.
// 5. Envía email a cambiosdeestado@ con el subject codificado (uno por transición),
//    incluyendo el AUTOR del cambio (replyTo + cuerpo).
//
// El correlativo del nuevo IDADMON = MAX(idadmon) de datos_arriendos + 1 (acordado).

import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { supabaseAdmin, getCapacidades, puedeTransicion } from '../../../../lib/cc1Permisos'
import { buildSubject, enviarNotificacion } from '../../../../lib/cc1Email'

// Campos que hereda el nuevo IDADMON en P (solo inmueble/propietario)
const CAMPOS_HEREDADOS = [
  'propietario', 'idprop', 'inmueble', 'idlinmue', 'tipo', 'bodega', 'estac',
  'tiene_contrato_admon', 'pct_adm', 'si_fijo_admon', 'adicionar_iva',
  'quien_cobra', 'tiene_termo_mant',
]

const ESTADOS_VALIDOS = ['P', 'S', 'SQ', 'Q', 'Q-Auditado', 'Q-Reclamado', 'N', 'N-Liquidacion', 'N-DICOM', 'Inactiva']
// Sub-estados de auditoría del término: solo Dirección + Karina, y solo desde un término en Q.
const ESTADOS_AUDITORIA = ['Q-Auditado', 'Q-Reclamado']

// Normaliza CUALQUIER fecha de entrada a ISO aaaa-mm-dd (dd/mm/aaaa y España/Chile), SIN usar new Date()
// (que asume mm/dd) y sin dejar que Postgres adivine (datestyle MDY convierte "11/04/2026" en 4-nov).
// Si ya viene ISO, la deja. Si no reconoce el formato, devuelve la cadena original (o null si vacía).
function aISO(s) {
  const t = String(s ?? '').trim()
  if (!t) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10)              // ya ISO
  const m = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)       // dd/mm/aaaa (o aa)
  if (m) {
    const d = m[1].padStart(2, '0'), mo = m[2].padStart(2, '0')
    const y = m[3].length === 2 ? '20' + m[3] : m[3]
    if (+d >= 1 && +d <= 31 && +mo >= 1 && +mo <= 12) return `${y}-${mo}-${d}`
  }
  return t
}

// Umbral por defecto (CLP) si no existe la fila en `configuracion`. Un cierre que
// pierde garantía por encima de esto (o que abandona deuda cobrable) es "alto riesgo"
// y exige autorización de Dirección. Parametrizable en configuracion.umbral_firma_termino.
const UMBRAL_FIRMA_DEFAULT = 100000

// Lee el umbral de firma desde `configuracion` (clave/valor). Fallback al default.
async function leerUmbralFirma() {
  try {
    const { data } = await supabaseAdmin
      .from('configuracion').select('valor').eq('clave', 'umbral_firma_termino').single()
    const v = Number(data?.valor)
    return isNaN(v) ? UMBRAL_FIRMA_DEFAULT : v
  } catch {
    return UMBRAL_FIRMA_DEFAULT
  }
}

// Calcula el contexto de riesgo para el cierre (→ N). Lo calcula el SISTEMA desde datos
// duros; NUNCA lo declara quien ejecuta. Devuelve { altoRiesgo, motivo }.
//   - Pérdida de garantía (terminos.perdida_garantia) por encima del umbral -> alto riesgo.
//   - Abandono: cerrar desde N-DICOM con deuda aún abierta en `cuentas` -> alto riesgo.
//     (balance = Σcargo − Σabono, MISMA fórmula que el panel de términos.)
async function calcularRiesgoCierre({ idadmon, estadoAnterior }) {
  const umbral = await leerUmbralFirma()

  // 1. Pérdida de garantía sobre umbral
  const { data: term } = await supabaseAdmin
    .from('terminos').select('perdida_garantia').eq('idadmon', idadmon).single()
  const perdida = Number(term?.perdida_garantia) || 0
  if (perdida > umbral) {
    return { altoRiesgo: true, motivo: 'perdida' }
  }

  // 2. Abandono de reclamación cobrable: sale de DICOM con deuda todavía abierta
  const de = String(estadoAnterior || '').trim().toUpperCase().replace(/[ _]/g, '-')
  if (de === 'N-DICOM') {
    const { data: movs } = await supabaseAdmin
      .from('cuentas').select('cargo, abono').eq('idadmon', idadmon)
    const balance = (movs || []).reduce((a, r) => a + (Number(r.cargo) || 0) - (Number(r.abono) || 0), 0)
    if (balance > 0) {
      return { altoRiesgo: true, motivo: 'abandonado' }   // deuda cobrable que se deja ir
    }
    return { altoRiesgo: false, motivo: 'recuperado' }
  }

  // Cierre limpio (sin pérdida sobre umbral, sin abandono)
  return { altoRiesgo: false, motivo: 'limpio' }
}

// ▼▼▼ BLOQUE 2 · CAMBIO 1 — Autorización de cierre (lee `solicitudes`)
// Busca una solicitud de cierre APROBADA y NO consumida para este IDADMON.
// Devuelve la fila (con resuelto_por y motivo) o null. Ordena por la más reciente.
// "No consumida" = no existe ya un historico_idadmon de cierre a N que la haya usado
// (evita que una misma aprobación sirva para dos cierres). Se detecta por el par
// (idadmon, autorizado_por no null) posterior a la fecha de resolución de la solicitud.
async function buscarAutorizacionCierre(idadmon) {
  const { data: sols } = await supabaseAdmin
    .from('solicitudes')
    .select('id, motivo, resuelto_por, fecha_resolucion')
    .eq('tipo', 'cierre_termino')
    .eq('idadmon', idadmon)
    .eq('estado', 'APROBADA')
    .order('fecha_resolucion', { ascending: false })
    .limit(1)
  const sol = sols?.[0]
  if (!sol) return null

  // ¿Ya se consumió? Buscar un cierre previo (autorizado_por no null) para este IDADMON
  // posterior a la resolución de esta solicitud.
  const { data: usada } = await supabaseAdmin
    .from('historico_idadmon')
    .select('id')
    .eq('idadmon', idadmon)
    .not('autorizado_por', 'is', null)
    .gte('created_at', sol.fecha_resolucion)
    .limit(1)
  if (usada && usada.length > 0) return null   // aprobación ya usada en un cierre anterior

  return sol
}
// ▲▲▲ BLOQUE 2 · CAMBIO 1

function siguienteIdadmon(maxId) {
  // maxId tipo 'A00884' -> 'A00885'
  const m = String(maxId || '').match(/^([A-Za-z]*)(\d+)$/)
  if (!m) return null
  const prefijo = m[1] || 'A'
  const num = parseInt(m[2], 10) + 1
  const ancho = m[2].length
  return prefijo + String(num).padStart(ancho, '0')
}

export async function POST(req) {
  // 1. Sesión + permiso
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })

  const cap = await getCapacidades(email)

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const { idadmon, estadoNuevo, fecha, comentario } = body || {}
  if (!idadmon || !estadoNuevo) return Response.json({ error: 'Faltan idadmon o estadoNuevo' }, { status: 400 })
  if (!ESTADOS_VALIDOS.includes(estadoNuevo)) return Response.json({ error: 'Estado no válido: ' + estadoNuevo }, { status: 400 })

  // Gate de permiso. Los sub-estados de auditoría (Q-Auditado / Q-Reclamado) son acción sensible:
  // SOLO Dirección + Karina (puedeAuditarTermino), sin depender del rol en Gestión LOG. El resto de
  // transiciones siguen exigiendo puedeCambiarEstado (responsable/supervisor en revision_log).
  const esAuditoriaTermino = ESTADOS_AUDITORIA.includes(estadoNuevo)
  if (esAuditoriaTermino) {
    if (!cap.puedeAuditarTermino) {
      return Response.json({ error: 'Solo Dirección y Karina pueden marcar un término como Auditado o Reclamado.' }, { status: 403 })
    }
  } else if (!cap.puedeCambiarEstado) {
    return Response.json({ error: 'Sin permiso para cambiar estados (requiere responsable/supervisor en Gestión LOG).' }, { status: 403 })
  }

  // ─── Cierre de la "puerta trasera" a S ───────────────────────────────────────
  // La activación (llegar a estado 'S') SOLO se hace por CERRAR Y FACTURAR, que valida
  // los datos de inicio, los escribe en `cuentas` y envía la facturación. Este endpoint
  // es para los saltos posteriores (S→SQ, S→Q, Q→N / N-Liquidacion / N-DICOM), NUNCA para
  // activar. Si por emergencia hiciera falta forzar S, es forzar-estado (solo Dirección,
  // con registro). Sin esta guarda, un P→S por aquí dejaría el contrato activo SIN inicios
  // ni facturación (que es justo el problema que arrastrábamos).
  if (estadoNuevo === 'S') {
    return Response.json({
      error: 'Para activar un contrato (pasar a S) usa "CERRAR Y FACTURAR". Este endpoint no activa contratos.',
    }, { status: 409 })
  }

  // Fecha SIEMPRE en ISO antes de tocar la base o el correo (dd/mm/aaaa -> aaaa-mm-dd).
  const fechaISO = aISO(fecha)
  const fechaEvento = fechaISO || new Date().toISOString().slice(0, 10)

  // 2. Cargar contrato actual
  const { data: contrato, error: e0 } = await supabaseAdmin
    .from('datos_arriendos').select('*').eq('idadmon', idadmon).single()
  if (e0 || !contrato) return Response.json({ error: 'Contrato no encontrado: ' + idadmon }, { status: 404 })

  const estadoAnterior = contrato.estado
  const emailsEnviados = []

  // Contexto de riesgo para el gate de cierre (maker-checker). Solo relevante cuando
  // el destino es N; para el resto de transiciones no influye. Lo calcula el sistema.
  // ▼▼▼ BLOQUE 2 · CAMBIO 1 — ctx.autorizado ahora sale del registro de solicitudes
  let ctxCierre = {}
  let autorizacion = null   // fila de `solicitudes` aprobada, si la hay (para estampar luego)
  if (estadoNuevo === 'N') {
    const riesgo = await calcularRiesgoCierre({ idadmon, estadoAnterior })
    // Solo consultamos la autorización si el cierre es de alto riesgo (evita lecturas
    // innecesarias en los cierres limpios, que no la necesitan).
    if (riesgo.altoRiesgo) {
      autorizacion = await buscarAutorizacionCierre(idadmon)
    }
    ctxCierre = {
      altoRiesgo: riesgo.altoRiesgo,
      autorizado: !!autorizacion,      // true SOLO si consta solicitud APROBADA no consumida
      motivo: riesgo.motivo,
    }
  }
  // ▲▲▲ BLOQUE 2 · CAMBIO 1

  // Validar que ESTE rol puede hacer ESTA transición concreta.
  if (esAuditoriaTermino) {
    // Auditado / Reclamado: permiso ya comprobado (puedeAuditarTermino). Solo se exige que el término
    // esté en Q (o ya en uno de los sub-estados de auditoría, para poder alternar entre ellos).
    const de = String(estadoAnterior || '').trim().toUpperCase().replace(/[ _]/g, '-')
    if (!['Q', 'Q-AUDITADO', 'Q-RECLAMADO'].includes(de)) {
      return Response.json({ error: `Solo se puede marcar Auditado/Reclamado desde un término en Q (estado actual: ${estadoAnterior || '—'}).` }, { status: 409 })
    }
  } else if (!puedeTransicion(cap, estadoAnterior, estadoNuevo, ctxCierre)) {
    const extra = (estadoNuevo === 'N' && ctxCierre.altoRiesgo)
      ? ` Este cierre es de alto riesgo (${ctxCierre.motivo}) y requiere autorización de Dirección.`
      : ` Validar inicio (P→S) y el cierre final (→N) tienen reglas específicas de rol.`
    return Response.json({
      error: `No tienes permiso para la transición ${estadoAnterior} → ${estadoNuevo}.` + extra,
    }, { status: 403 })
  }

  // 3. Cambiar el estado del contrato
  //    En el aviso/entrada en término (S->SQ, S->Q) escribimos la fecha COMUNICADA en
  //    termino_actual (fecha real en que el arrendatario dice que se va). termino_inicial
  //    (la del contrato) NUNCA se toca. Solo si el usuario aportó `fecha`; si no, no se pisa.
  const camposUpdate = { estado: estadoNuevo, updated_at: new Date().toISOString() }
  const esAvisoTermino = estadoAnterior === 'S' && (estadoNuevo === 'SQ' || estadoNuevo === 'Q')
  if (esAvisoTermino && fechaISO) camposUpdate.termino_actual = fechaISO
  const { error: e1 } = await supabaseAdmin
    .from('datos_arriendos')
    .update(camposUpdate)
    .eq('idadmon', idadmon)
  if (e1) return Response.json({ error: 'Error al cambiar estado: ' + e1.message }, { status: 500 })

  // Registrar evento de cambio de estado
  const subjectCambio = buildSubject({
    idadmon, estadoNuevo,
    propietario: contrato.propietario, inmueble: contrato.inmueble, fecha: fechaEvento,
  })
  // ▼▼▼ BLOQUE 2 · CAMBIO 2 — estampar la doble firma cuando el cierre iba autorizado
  // Si este cierre a N usó una autorización aprobada, grabamos autorizado_por + motivo_cierre
  // (doble firma real: quien autoriza ≠ quien ejecuta). En cierres limpios quedan null.
  const filaHist = {
    idadmon, evento: 'cambio_estado',
    estado_anterior: estadoAnterior, estado_nuevo: estadoNuevo,
    fecha: fechaEvento, usuario: email, email_subject: subjectCambio,
    detalle: (comentario && String(comentario).trim()) ? String(comentario).trim() : null,
  }
  if (estadoNuevo === 'N' && autorizacion) {
    filaHist.autorizado_por = autorizacion.resuelto_por
    filaHist.motivo_cierre = autorizacion.motivo
  } else if (estadoNuevo === 'N' && ctxCierre && !ctxCierre.altoRiesgo) {
    // Cierre limpio: dejamos constancia del motivo calculado (limpio/recuperado), sin autorizador.
    filaHist.motivo_cierre = ctxCierre.motivo
  }
  await supabaseAdmin.from('historico_idadmon').insert([filaHist])
  // ▲▲▲ BLOQUE 2 · CAMBIO 2
  const r1 = await enviarNotificacion({
    subject: subjectCambio,
    autor: email,
    idadmon,
    estadoAnterior,
    estadoNuevo,
    propietario: contrato.propietario,
    inmueble: contrato.inmueble,
    fecha: fechaEvento,
  })
  emailsEnviados.push({ subject: subjectCambio, ok: r1.ok })

  // ▼▼▼ BLOQUE 2 · CAMBIO 3 — crear la workflow_instance de TERMINO al pasar a Q
  // El expediente de término nace aquí (antes nacía perezoso cuando Karina guardaba).
  // Solo al ENTRAR en Q, con salvaguarda anti-duplicado. No bloquea el cambio de estado
  // ya hecho: si algo falla, se reporta como warning y el estado queda cambiado igual.
  let workflowCreado = null
  if (estadoNuevo === 'Q') {
    try {
      const { data: yaInst } = await supabaseAdmin
        .from('workflow_instances')
        .select('id')
        .eq('workflow_codigo', 'TERMINO')
        .eq('idadmon', idadmon)
        .limit(1)
      if (!yaInst || yaInst.length === 0) {
        const { data: inst, error: eInst } = await supabaseAdmin
          .from('workflow_instances')
          .insert([{
            workflow_codigo: 'TERMINO',
            idadmon,
            estado: 'ACTIVO',
            fecha_inicio: new Date().toISOString(),
            observaciones: 'Expediente creado automáticamente al pasar a Q (circuito CC1).',
          }])
          .select('id')
          .single()
        if (!eInst && inst) {
          workflowCreado = inst.id
          // ── Sembrar las 6 tareas del expediente desde la plantilla workflow_nodes ──
          // Mismo molde que ya existía: la primera etapa (menor orden_visual) queda ACTIVO con
          // fecha_inicio y fecha_limite (+2 días); el resto PENDIENTE. responsable = area_responsable.
          // Antes el circuito creaba la instancia pero NO las tareas, y esos términos salían "sin
          // expediente". Con esto queda completo de una sola vez.
          try {
            const { data: nodos } = await supabaseAdmin
              .from('workflow_nodes')
              .select('codigo, area_responsable, orden_visual')
              .eq('workflow_codigo', 'TERMINO')
              .order('orden_visual', { ascending: true })
            if (nodos && nodos.length) {
              const minOv = Math.min(...nodos.map(n => Number(n.orden_visual)))
              const ahora = new Date().toISOString()
              const limite = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
              const tareas = nodos.map(n => {
                const activa = Number(n.orden_visual) === minOv
                return {
                  workflow_instance_id: inst.id,
                  node_codigo: n.codigo,
                  estado: activa ? 'ACTIVO' : 'PENDIENTE',
                  responsable: n.area_responsable,
                  fecha_inicio: activa ? ahora : null,
                  fecha_limite: activa ? limite : null,
                  fecha_cierre: null,
                  comentarios: null,
                  created_at: ahora,
                }
              })
              await supabaseAdmin.from('workflow_tasks').insert(tareas)
            }
          } catch (e2) {
            // No abortamos el cambio de estado: la instancia queda creada y las tareas se pueden sembrar luego.
          }
        }
      }
    } catch (err) {
      // No abortamos: el expediente puede crearse luego. Se reporta abajo.
      workflowCreado = { error: String(err?.message || err) }
    }
  }
  // ▲▲▲ BLOQUE 2 · CAMBIO 3

  // 4. ¿Hay que crear el nuevo IDADMON en P?
  //    Se crea cuando el contrato entra en SQ (aviso de término). Si pasa directo
  //    S->Q, se trata como si hubiera pasado por SQ: se crea igualmente el P.
  let nuevoP = null
  const entraEnTermino = (estadoNuevo === 'SQ' || estadoNuevo === 'Q')
  const veniaActivo = (estadoAnterior === 'S' || estadoAnterior === 'SQ')

  if (entraEnTermino && veniaActivo) {
    // Salvaguarda anti-duplicado: ¿ya se creó un sucesor para este contrato?
    const { data: yaCreado } = await supabaseAdmin
      .from('historico_idadmon')
      .select('idadmon')
      .eq('idadmon_origen', idadmon)
      .eq('evento', 'creado_P')
      .limit(1)

    if (!yaCreado || yaCreado.length === 0) {
      // Correlativo: MAX(idadmon) de datos_arriendos + 1
      const { data: maxRows } = await supabaseAdmin
        .from('datos_arriendos').select('idadmon').order('idadmon', { ascending: false }).limit(1)
      const maxId = maxRows?.[0]?.idadmon
      const nuevoId = siguienteIdadmon(maxId)

      if (nuevoId) {
        // Datos heredados del inmueble/propietario
        const heredados = {}
        CAMPOS_HEREDADOS.forEach(c => { heredados[c] = contrato[c] ?? null })

        // fecha del nuevo P = fecha del paso a Q (inicio de búsqueda, KPI)
        const nuevaFila = {
          idadmon: nuevoId,
          estado: 'P',
          fecha: fechaEvento,
          ...heredados,
        }
        const { error: e2 } = await supabaseAdmin.from('datos_arriendos').insert([nuevaFila])
        if (e2) {
          // No abortamos el cambio de estado ya hecho; reportamos el fallo del P.
          return Response.json({
            ok: true, estadoAnterior, estadoNuevo,
            warning: 'Estado cambiado, pero falló crear el P: ' + e2.message,
            workflowCreado,
            emails: emailsEnviados,
          })
        }

        // Insertar fila nueva en la tabla idadmon (registro maestro de correlativos)
        await supabaseAdmin.from('idadmon').insert([{
          idadmon: nuevoId,
          fecha: fechaEvento,
          raw_data: {
            IdAdmon: nuevoId,
            Propietario: contrato.propietario || '',
            IdProp: contrato.idprop || '',
            Inmueble: contrato.inmueble || '',
            IdInmue: contrato.idlinmue || '',
            FECHA: fechaEvento,
            masinfo: 'creado por circuito CC1 (origen ' + idadmon + ')',
          },
          updated_at: new Date().toISOString(),
        }])

        // Histórico del nuevo P
        const subjectP = buildSubject({
          idadmon: nuevoId, estadoNuevo: 'P',
          propietario: contrato.propietario, inmueble: contrato.inmueble, fecha: fechaEvento,
        })
        await supabaseAdmin.from('historico_idadmon').insert([{
          idadmon: nuevoId, evento: 'creado_P',
          estado_anterior: null, estado_nuevo: 'P',
          idadmon_origen: idadmon,
          fecha: fechaEvento, usuario: email, email_subject: subjectP,
        }])
        const r2 = await enviarNotificacion({
          subject: subjectP,
          autor: email,
          idadmon: nuevoId,
          estadoAnterior: null,
          estadoNuevo: 'P',
          propietario: contrato.propietario,
          inmueble: contrato.inmueble,
          fecha: fechaEvento,
          esCreacionP: true,
          idadmonOrigen: idadmon,
        })
        emailsEnviados.push({ subject: subjectP, ok: r2.ok })

        nuevoP = nuevoId
      }
    }
  }

  return Response.json({
    ok: true,
    idadmon, estadoAnterior, estadoNuevo,
    nuevoP,                       // IDADMON creado en P, o null
    workflowCreado,               // id de la workflow_instance creada al pasar a Q, o null
    emails: emailsEnviados,
  })
}