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

const ESTADOS_VALIDOS = ['P', 'S', 'SQ', 'Q', 'N', 'N-DICOM', 'Inactiva']

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
  if (!cap.puedeCambiarEstado) {
    return Response.json({ error: 'Sin permiso para cambiar estados (requiere responsable/supervisor en Gestión LOG).' }, { status: 403 })
  }

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const { idadmon, estadoNuevo, fecha } = body || {}
  if (!idadmon || !estadoNuevo) return Response.json({ error: 'Faltan idadmon o estadoNuevo' }, { status: 400 })
  if (!ESTADOS_VALIDOS.includes(estadoNuevo)) return Response.json({ error: 'Estado no válido: ' + estadoNuevo }, { status: 400 })

  const fechaEvento = fecha || new Date().toISOString().slice(0, 10)

  // 2. Cargar contrato actual
  const { data: contrato, error: e0 } = await supabaseAdmin
    .from('datos_arriendos').select('*').eq('idadmon', idadmon).single()
  if (e0 || !contrato) return Response.json({ error: 'Contrato no encontrado: ' + idadmon }, { status: 404 })

  const estadoAnterior = contrato.estado
  const emailsEnviados = []

  // Validar que ESTE rol puede hacer ESTA transición concreta
  if (!puedeTransicion(cap, estadoAnterior, estadoNuevo)) {
    return Response.json({
      error: `No tienes permiso para la transición ${estadoAnterior} → ${estadoNuevo}. ` +
             `Validar inicio (P→S) y cerrar (Q→N) son exclusivos del responsable de Gestión LOG.`,
    }, { status: 403 })
  }

  // 3. Cambiar el estado del contrato
  const { error: e1 } = await supabaseAdmin
    .from('datos_arriendos')
    .update({ estado: estadoNuevo, updated_at: new Date().toISOString() })
    .eq('idadmon', idadmon)
  if (e1) return Response.json({ error: 'Error al cambiar estado: ' + e1.message }, { status: 500 })

  // Registrar evento de cambio de estado
  const subjectCambio = buildSubject({
    idadmon, estadoNuevo,
    propietario: contrato.propietario, inmueble: contrato.inmueble, fecha: fechaEvento,
  })
  await supabaseAdmin.from('historico_idadmon').insert([{
    idadmon, evento: 'cambio_estado',
    estado_anterior: estadoAnterior, estado_nuevo: estadoNuevo,
    fecha: fechaEvento, usuario: email, email_subject: subjectCambio,
  }])
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
    emails: emailsEnviados,
  })
}
