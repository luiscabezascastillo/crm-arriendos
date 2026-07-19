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

    // Rellena el movimiento del BI (marca unique_concept = valor) SERVER-SIDE.
    // Con service role funciona aunque el usuario no tenga escritura directa en `bi`.
    async function rellenarMovimiento() {
      if (biId == null) return { rellenado: false }
      const { error } = await supaAdmin.from('bi').update({ unique_concept: valor }).eq('id', biId)
      return error ? { rellenado: false, errorRelleno: error.message } : { rellenado: true }
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