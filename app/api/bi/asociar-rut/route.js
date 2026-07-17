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
// IDADMON válido: A + 5 dígitos (ej. A00819). Devuelve en mayúsculas o ''.
function normIdadmon(txt) {
  const m = String(txt ?? '').trim().toUpperCase().match(/^A\d{5}$/)
  return m ? m[0] : ''
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
    const idadmon = normIdadmon(body?.idadmon)
    const biId = body?.biId ?? null   // id del movimiento en `bi` a rellenar (opcional)
    if (!rut) return Response.json({ error: 'RUT no válido' }, { status: 400 })
    if (!idadmon) return Response.json({ error: 'IDADMON no válido (debe ser Axxxxx, ej. A00819)' }, { status: 400 })

    // Rellena el movimiento del BI (marca unique_concept = idadmon) SERVER-SIDE.
    // Con service role funciona aunque el usuario no tenga escritura directa en `bi`.
    // Solo se hace si nos pasan biId; devuelve el resultado para informar al cliente.
    async function rellenarMovimiento() {
      if (biId == null) return { rellenado: false }
      const { error } = await supaAdmin.from('bi').update({ unique_concept: idadmon }).eq('id', biId)
      return error ? { rellenado: false, errorRelleno: error.message } : { rellenado: true }
    }

    // ¿Ya existe esa pareja activa? No duplicar en bi_admon, pero SÍ rellenar el movimiento.
    const { data: existentes, error: e1 } = await supaAdmin
      .from('bi_admon').select('id, idadmon, activo').eq('rut', rut)
    if (e1) return Response.json({ error: e1.message }, { status: 500 })

    const yaExacta = (existentes || []).some(x => normIdadmon(x.idadmon) === idadmon && x.activo !== false)
    if (yaExacta) {
      const rel = await rellenarMovimiento()
      return Response.json({ ok: true, yaExistia: true, rut, idadmon, ...rel })
    }

    // Insertar. Si el RUT ya tenía otro IDADMON, quedará con varias filas: el matching
    // del BI agrupa por RUT y ofrecerá candidatos automáticamente (no tocamos `ambiguo`).
    const { error: e2 } = await supaAdmin
      .from('bi_admon')
      .insert({ rut, idadmon, fuente: 'origen:cuentas', activo: true })
    if (e2) return Response.json({ error: e2.message }, { status: 500 })

    const otrosIdadmon = (existentes || [])
      .map(x => normIdadmon(x.idadmon))
      .filter(id => id && id !== idadmon)

    const rel = await rellenarMovimiento()
    return Response.json({ ok: true, rut, idadmon, teniaOtros: otrosIdadmon, ...rel })
  } catch (e) {
    return Response.json({ error: e.message || 'Error' }, { status: 500 })
  }
}