// VERSION: v5 · 2026-08-23 · Filtro de pendientes calculado en JS (no en SQL) con esPendiente(): sin fecha,
//   formato no-ISO (d/m/aaaa, no fiable) o ISO anterior al último domingo. Evita depender del orden de texto
//   con formatos mezclados. Mismo criterio que Luz v4. Hereda v4.
// VERSION: v4 · 2026-08-23 · "Solo pendientes" ahora = sin fecha O consultado antes del ÚLTIMO DOMINGO
//   (antes: antes del día 1 del mes). Encaja con los cortes semanales: lo no consultado desde el domingo
//   se considera pendiente para el corte de la semana. Domingo anclado a hora de Chile. Hereda v3.
// VERSION: v3 · 2026-08-17 · El código de agua (Aguas Andinas) ya NO se lee de la fila del mes, sino de la fuente
//   única `servicios_codigos` (por idinmue). Los meses nuevos lo heredan solo. La deuda del mes sigue en
//   ggcc_agua_luz. Hereda v2.
// VERSION: v2 · 2026-07-18 · Normaliza el mes a ISO (AAAA-MM) antes de filtrar (campo `mes` unificado).
//   Acepta "JULIO 2026", "2026-07" o "2607". Aplica en guardar y en GET.
// app/api/servicios/agua/route.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Normaliza el mes al formato ISO 'AAAA-MM'. Acepta 'JULIO 2026' | '2026-07' | '2607'.
function normalizarMes(m) {
  if (!m) return m
  const s = String(m).trim()
  if (/^\d{4}-\d{2}$/.test(s)) return s
  if (/^\d{4}$/.test(s)) return '20' + s.slice(0, 2) + '-' + s.slice(2)
  const MESES = { enero:'01', febrero:'02', marzo:'03', abril:'04', mayo:'05', junio:'06',
    julio:'07', agosto:'08', septiembre:'09', setiembre:'09', octubre:'10', noviembre:'11', diciembre:'12' }
  const mm = s.toLowerCase().match(/^([a-záéíóúñ]+)\s+(\d{4})$/)
  if (mm && MESES[mm[1]]) return mm[2] + '-' + MESES[mm[1]]
  return s
}

// Fecha (YYYY-MM-DD) del domingo más reciente, inclusive si hoy es domingo.
// Anclado a hora de Chile (America/Santiago) para no desfasar cerca de medianoche.
function ultimoDomingoISO() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  }).formatToParts(new Date())
  const o = {}
  for (const p of partes) o[p.type] = p.value
  const dow = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[o.weekday] ?? 0
  // Mediodía UTC para restar días sin cruzar de fecha por husos.
  const base = new Date(`${o.year}-${o.month}-${o.day}T12:00:00Z`)
  base.setUTCDate(base.getUTCDate() - dow)
  return base.toISOString().split('T')[0]
}

// Pendiente = sin fecha, formato no-ISO (d/m/aaaa: fecha vieja, no fiable como consulta),
// o ISO anterior al último domingo. Robusto ante formatos mezclados en la columna.
function esPendiente(fh, corte) {
  if (fh == null) return true
  const s = String(fh).trim()
  if (!s) return true
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return s.slice(0, 10) < corte
  return true
}

function esCodigoAguaValido(codigo) {
  if (!codigo) return false
  const texto = String(codigo).trim().toLowerCase()
  // Excluir textos como bodega, estacionamiento, etc.
  if (!/^\d/.test(texto)) return false
  return true
}

// Extrae número sin dígito verificador: "2623638-K" → "2623638"
function normalizarCodigoAgua(codigo) {
  return String(codigo).trim().split('-')[0]
}

async function guardar(mes, idadmon, idinmue, deuda, fecha) {
  mes = normalizarMes(mes)
  const { error } = await supabase
    .from('ggcc_agua_luz')
    .update({
      deuda_vigente_agua: deuda,
      fecha_hecho_agua: fecha,
      updated_at: new Date().toISOString(),
    })
    .eq('mes', mes)
    .eq('idadmon', idadmon)
    .eq('idinmue', idinmue)
  if (error) throw new Error(error.message)
}

// POST /api/servicios/agua
// Body: { action: 'guardar', mes, idadmon, idinmue, deuda, fecha }
export async function POST(request) {
  try {
    const body = await request.json()

    if (body.action === 'guardar') {
      const { mes, idadmon, idinmue, deuda, fecha } = body
      await guardar(mes, idadmon, idinmue, deuda, fecha)
      return Response.json({ ok: true })
    }

    return Response.json({ error: 'Acción no reconocida' }, { status: 400 })

  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

// GET /api/servicios/agua?mes=MAYO 2026&solo_pendientes=true
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const mes = normalizarMes(searchParams.get('mes'))
    const soloPendientes = searchParams.get('solo_pendientes') === 'true'

    if (!mes) return Response.json({ error: 'Parámetro mes requerido' }, { status: 400 })

    // Filas del mes (deuda/estado); el CÓDIGO ya no vive aquí.
    // El filtro de pendientes se hace en JS (ver esPendiente), no en SQL, por los formatos mezclados de fecha.
    const query = supabase
      .from('ggcc_agua_luz')
      .select('idadmon, idinmue, deuda_vigente_agua, fecha_hecho_agua, edificio_proyecto, inmueble')
      .eq('mes', mes)
      .not('idadmon', 'like', '.%')
      .order('idadmon')

    const { data, error } = await query
    if (error) return Response.json({ error: error.message }, { status: 500 })

    // Código de agua desde la fuente única (por idinmue).
    const { data: cods, error: eC } = await supabase.from('servicios_codigos').select('idinmue, codigo_agua')
    if (eC) return Response.json({ error: eC.message }, { status: 500 })
    const mapAgua = new Map((cods || []).map(c => [c.idinmue, c.codigo_agua]))

    let filtrado = (data || [])
      .map(row => ({ ...row, codigo_agua: mapAgua.get(row.idinmue) || null }))
      .filter(row => esCodigoAguaValido(row.codigo_agua))
      .map(row => ({ ...row, codigo_agua_normalizado: normalizarCodigoAgua(row.codigo_agua) }))

    if (soloPendientes) {
      const corte = ultimoDomingoISO()
      filtrado = filtrado.filter(row => esPendiente(row.fecha_hecho_agua, corte))
    }

    return Response.json({ codigos: filtrado, total: filtrado.length })

  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
