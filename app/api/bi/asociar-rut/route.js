// VERSION: v5 · 2026-08-14 · El +RUT marca idadmon_origen='manual' (lo confirma una persona): así, si el
//   movimiento venía de una asignación 'auto', sale de la lista «Por validar» del BI. Hereda v4.
// VERSION: v4 · 2026-08-14 · CIERRA EL HUECO del desincronismo: al hacer +RUT con un IDADMON válido, si la
//   fila NO existía en `cuentas` (seguía en FALTA), ahora se INSERTA (antes solo se corregía la existente y,
//   como el BI quedaba CORREGIDO, "Copiar FALTA" ya no la recogía → el abono se perdía). Se unifica el volcado
//   con el del route de movimientos: helper `volcarACuentas` que ACTUALIZA (calif=reg) o INSERTA. Hereda v3.
// VERSION: v3 · 2026-07-21 · +RUT ahora PROPAGA a CUENTAS (opción B automática): además de asociar en
//   bi_admon y marcar unique_concept, si el valor es un IDADMON válido corrige la fila ya volcada en
//   `cuentas` (por calif = bi.reg) y marca el movimiento del BI como CORREGIDO. Si aún no está en cuentas
//   (sigue en FALTA), no falla: se copiará luego con el idadmon correcto.
// VERSION: v2 · 2026-07-15 · POST acepta `biId` opcional: además de asociar en bi_admon, rellena
//   ese movimiento del BI (unique_concept = idadmon) SERVER-SIDE (service role). Así los usuarios
//   sin escritura directa en `bi` (Anthony/Neika/Adalis/Fabiola) pueden identificar abonos. Aditivo:
//   sin `biId` el comportamiento es idéntico al v1.
//
// app/api/bi/asociar-rut/route.js
// Asocia un RUT a un IDADMON en la tabla `bi_admon`, para que los abonos futuros
// de ese RUT se autocompleten solos en el BI.
//
// El IDADMON se propone DESDE EL ORIGEN: se busca en `cuentas` (histórico de cartolas)
// a qué IDADMON pagó antes ese mismo RUT (el RUT vive en `cuentas.concepto`).
//
// GET  ?rut=16111735-8  -> candidatos {idadmon, veces} ordenados por frecuencia (desde `cuentas`).
// POST { rut, idadmon } -> inserta (rut, idadmon, fuente:'origen:cuentas', activo:true) en `bi_admon`.

import { createClient } from '@supabase/supabase-js'

const supaAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

// Normaliza un RUT "16111735-8" (dígitos-guión-verificador). Devuelve '' si no es válido.
function normRut(txt) {
  const m = String(txt ?? '').trim().match(/(\d{5,9})-([\dkK])/)
  return m ? `${m[1]}-${m[2].toUpperCase()}` : ''
}

const num = (v) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d.-]/g, '')) || 0)

// timestamp "dd/mm/aaaa HH:MM" en hora de Chile (para JUSTIFICANTES), igual que el route de movimientos.
function ahoraCL() {
  const partes = new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date())
  const g = (t) => partes.find((p) => p.type === t)?.value || ''
  return `${g('day')}/${g('month')}/${g('year')} ${g('hour')}:${g('minute')}`
}

// Vuelca a `cuentas` el IDADMON de un movimiento de BI: ACTUALIZA la(s) fila(s) con calif=reg o las INSERTA si
// no existían. Es el mismo comportamiento que volcarACuentas() del route de movimientos, para que editar el
// IDADMON a mano y hacer +RUT dejen `cuentas` igual. `mov` debe traer { fecha, detalle_movimiento, cargos, abonos }.
async function volcarACuentas(mov, reg, idadmon) {
  // ¿Existe ya la fila en cuentas (por calif = reg)?
  const { data: ex, error: eSel } = await supaAdmin
    .from('cuentas').select('id').eq('calif', reg).limit(1)
  if (eSel) return { propagado: false, error: eSel.message }

  // Datos del contrato para estado/propietario/inmueble.
  const { data: da } = await supaAdmin
    .from('datos_arriendos').select('estado, propietario, inmueble').eq('idadmon', idadmon).maybeSingle()

  if (ex && ex.length) {
    // Corrige la(s) fila(s) existente(s) al nuevo IDADMON (+ propietario/inmueble).
    const { data: upd, error: eUp } = await supaAdmin.from('cuentas').update({
      idadmon,
      propietario: da?.propietario ?? null,
      inmueble: da?.inmueble ?? null,
      updated_at: new Date().toISOString(),
    }).eq('calif', reg).select('id')
    if (eUp) return { propagado: false, error: eUp.message }
    return { propagado: true, accion: 'actualizada', filas: (upd || []).length }
  }

  // No existía: insertar la fila (misma forma que "Copiar FALTA a CUENTAS").
  const { error: eIns } = await supaAdmin.from('cuentas').insert([{
    fecha: mov.fecha,
    idadmon,
    concepto: mov.detalle_movimiento,
    cargo: num(mov.cargos),
    abono: num(mov.abonos),
    saldo: null,
    comentarios: 'BI',
    calif: reg,
    justificantes: ahoraCL(),
    estado: da?.estado ?? null,
    propietario: da?.propietario ?? null,
    inmueble: da?.inmueble ?? null,
    updated_at: new Date().toISOString(),
  }])
  if (eIns) return { propagado: false, error: eIns.message }
  return { propagado: true, accion: 'insertada', filas: 1 }
}
// VERSION: v3 · 2026-07-19 · POST acepta IDADMON (Axxxxx) O TEXTO LIBRE (ej. "PO64-PAVEZ, JUANA").
//   Si el valor empieza por A+dígito se exige formato Axxxxx; si no, se acepta como texto de
//   identificación tal cual. Rellena unique_concept y asocia RUT→valor en bi_admon (reconocimiento
//   futuro) en ambos casos. El candado "texto libre solo Dirección/Karina" es del cliente (este
//   endpoint no tiene auth propia — deuda técnica conocida).
// IDADMON válido: A + 5 dígitos (ej. A00819). Devuelve en mayúsculas o ''.
function normIdadmon(txt) {
  const m = String(txt ?? '').trim().toUpperCase().match(/^A\d{5}$/)
  return m ? m[0] : ''
}
// ¿El texto tiene pinta de IDADMON? (empieza por A seguido de dígito)
function pareceIdadmon(txt) { return /^a\d/i.test(String(txt ?? '').trim()) }
// Resuelve el valor a asociar: IDADMON normalizado (si parece IDADMON y es válido) o texto libre.
// Devuelve { valor, esIdadmon } o null si es inválido (parece IDADMON pero está mal formado, o vacío).
function resolverValor(txt) {
  const s = String(txt ?? '').trim()
  if (!s) return null
  if (pareceIdadmon(s)) {
    const id = normIdadmon(s)
    return id ? { valor: id, esIdadmon: true } : null   // empieza como A+dígito pero no es Axxxxx completo
  }
  return { valor: s, esIdadmon: false }                 // texto libre, tal cual
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const rut = normRut(searchParams.get('rut'))
    if (!rut) return Response.json({ error: 'RUT no válido' }, { status: 400 })

    // Busca en cuentas todas las filas cuyo concepto contiene el RUT, con idadmon.
    const { data, error } = await supaAdmin
      .from('cuentas')
      .select('idadmon, concepto')
      .ilike('concepto', `%${rut}%`)
      .limit(2000)
    if (error) return Response.json({ error: error.message }, { status: 500 })

    // Cuenta por idadmon válido (Axxxxx).
    const conteo = new Map()
    for (const r of data || []) {
      const id = normIdadmon(r.idadmon)
      if (!id) continue
      conteo.set(id, (conteo.get(id) || 0) + 1)
    }
    const candidatos = [...conteo.entries()]
      .map(([idadmon, veces]) => ({ idadmon, veces }))
      .sort((a, b) => b.veces - a.veces)

    return Response.json({ ok: true, rut, candidatos })
  } catch (e) {
    return Response.json({ error: e.message || 'Error' }, { status: 500 })
  }
}

export async function POST(req) {
  try {
    const body = await req.json()
    const rut = normRut(body?.rut)
    const r = resolverValor(body?.idadmon)   // acepta IDADMON (Axxxxx) o texto libre
    const biId = body?.biId ?? null   // id del movimiento en `bi` a rellenar (opcional)
    if (!rut) return Response.json({ error: 'RUT no válido' }, { status: 400 })
    if (!r) return Response.json({ error: 'Valor no válido: si empieza por "A" debe ser Axxxxx (ej. A00819); si no, escribe un texto de identificación.' }, { status: 400 })
    const valor = r.valor   // IDADMON normalizado o texto libre, tal cual

    // Rellena el movimiento del BI y PROPAGA la corrección a CUENTAS (cartola).
    // Con service role funciona aunque el usuario no tenga escritura directa en `bi`/`cuentas`.
    const esIdadmonValido = /^A\d{5}$/.test(valor)   // solo A+5 dígitos toca cuentas (texto libre no)
    async function rellenarMovimiento() {
      if (biId == null) return { rellenado: false }

      // 1) Leer el movimiento: reg (puente con cuentas.calif) + datos por si hay que INSERTAR en cuentas.
      const { data: mov, error: eMov } = await supaAdmin
        .from('bi').select('reg, fecha, detalle_movimiento, cargos, abonos').eq('id', biId).single()
      if (eMov) return { rellenado: false, errorRelleno: eMov.message }
      const reg = mov?.reg != null && String(mov.reg).trim() !== '' ? String(mov.reg).trim() : null

      // 2) Marcar el movimiento del BI: unique_concept + idadmon2 (espejo) + check2 = CORREGIDO.
      //    idadmon_origen='manual': lo confirma una persona → sale de «Por validar».
      const patchBi = { unique_concept: valor, idadmon_origen: 'manual' }
      if (esIdadmonValido) { patchBi.idadmon2 = valor; patchBi.check2_pasar_a_cartola = 'CORREGIDO' }
      const { error: eBi } = await supaAdmin.from('bi').update(patchBi).eq('id', biId)
      if (eBi) return { rellenado: false, errorRelleno: eBi.message }

      // 3) Volcar a cuentas: ACTUALIZA la fila (calif=reg) o la INSERTA si no existía. Solo IDADMON válido + reg.
      //    Antes solo actualizaba: si no existía, el abono quedaba sin volcar (hueco del desincronismo). Ya no.
      let cuentas = { propagado: false, motivo: 'no_idadmon_o_sin_reg' }
      if (esIdadmonValido && reg) {
        cuentas = await volcarACuentas(mov, reg, valor)
        if (cuentas.error) return { rellenado: true, cuentas, errorCuentas: cuentas.error }
      }
      return { rellenado: true, cuentas }
    }

    // ¿Ya existe esa pareja activa? No duplicar en bi_admon, pero SÍ rellenar el movimiento.
    const { data: existentes, error: e1 } = await supaAdmin
      .from('bi_admon').select('id, idadmon, activo').eq('rut', rut)
    if (e1) return Response.json({ error: e1.message }, { status: 500 })

    // Compara por el valor tal cual (sirve para IDADMON y para texto libre).
    const yaExacta = (existentes || []).some(x => String(x.idadmon ?? '').trim() === valor && x.activo !== false)
    if (yaExacta) {
      const rel = await rellenarMovimiento()
      return Response.json({ ok: true, yaExistia: true, rut, idadmon: valor, ...rel })
    }

    // Insertar la asociación RUT → valor (IDADMON o texto libre) para reconocimiento futuro.
    const { error: e2 } = await supaAdmin
      .from('bi_admon')
      .insert({ rut, idadmon: valor, fuente: r.esIdadmon ? 'origen:cuentas' : 'texto:manual', activo: true })
    if (e2) return Response.json({ error: e2.message }, { status: 500 })

    const otros = (existentes || [])
      .map(x => String(x.idadmon ?? '').trim())
      .filter(v => v && v !== valor)

    const rel = await rellenarMovimiento()
    return Response.json({ ok: true, rut, idadmon: valor, teniaOtros: otros, ...rel })
  } catch (e) {
    return Response.json({ error: e.message || 'Error' }, { status: 500 })
  }
}