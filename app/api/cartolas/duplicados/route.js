// app/api/cartolas/duplicados/route.js
// Detección y borrado de filas duplicadas en la tabla `cuentas` (CARTOLAS).
// Replica el botón VBA "MarcarDuplicadosConsecutivos": un duplicado es una fila
// idéntica a otra en los campos de negocio (equivalente a A:I del Excel, SIN el
// folio `calif` ni `justificantes`, que son justo lo que distingue el asiento).
//
// La columna `fecha` es TEXTO en formato dd/mm/aaaa. Para filtrar por rango se
// parsea a un entero aaaammdd comparable (ordenar el texto tal cual mezcla años).
//
// GET ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
//     -> grupos de filas idénticas (2+) cuya fecha cae en el rango (ambos opcionales).
// POST { ids: [...] }
//     -> borra esos ids con salvaguarda: solo "sobrantes" (nunca el de menor id de
//        un grupo, ni filas únicas). Re-verifica en el servidor antes de borrar.

import { createClient } from '@supabase/supabase-js'

const supaAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

// Campos que definen un duplicado (A:I del Excel, sin folio ni justificante).
const CAMPOS = ['fecha', 'idadmon', 'concepto', 'cargo', 'abono', 'saldo', 'comentarios']

function claveDe(r) {
  return CAMPOS.map(c => {
    const v = r[c]
    return v === null || v === undefined ? '' : String(v).trim()
  }).join('||')
}

// "dd/mm/aaaa" -> entero aaaammdd (p. ej. "01/07/2026" -> 20260701). Si no parsea, null.
function fechaInt(txt) {
  const m = String(txt ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const d = Number(m[1]), mes = Number(m[2]), a = Number(m[3])
  return a * 10000 + mes * 100 + d
}

// "YYYY-MM-DD" (input date) -> entero aaaammdd. Vacío/invalido -> null.
function isoInt(txt) {
  const m = String(txt ?? '').trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (!m) return null
  return Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3])
}

// Trae TODAS las filas de cuentas (solo columnas necesarias + calif para mostrar),
// paginando de 1000 en 1000. Filtra por rango de fechas (si se pasa) en memoria.
async function traerTodas(desdeInt, hastaInt) {
  const filas = []
  const paso = 1000
  let desde = 0
  for (;;) {
    const { data, error } = await supaAdmin
      .from('cuentas')
      .select('id, fecha, idadmon, concepto, cargo, abono, saldo, comentarios, calif')
      .order('id', { ascending: true })
      .range(desde, desde + paso - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    for (const r of data) {
      if (desdeInt != null || hastaInt != null) {
        const fi = fechaInt(r.fecha)
        if (fi == null) continue                       // fecha no parseable -> fuera del rango
        if (desdeInt != null && fi < desdeInt) continue
        if (hastaInt != null && fi > hastaInt) continue
      }
      filas.push(r)
    }
    if (data.length < paso) break
    desde += paso
  }
  return filas
}

function agrupar(filas) {
  const mapa = new Map()
  for (const r of filas) {
    const k = claveDe(r)
    if (!mapa.has(k)) mapa.set(k, [])
    mapa.get(k).push(r)
  }
  const grupos = []
  for (const arr of mapa.values()) {
    if (arr.length > 1) {
      arr.sort((a, b) => a.id - b.id)   // la primera (menor id) se conserva
      grupos.push({ filas: arr })
    }
  }
  // Orden de presentación: por fecha real ascendente, luego por id.
  grupos.sort((a, b) => (fechaInt(a.filas[0].fecha) || 0) - (fechaInt(b.filas[0].fecha) || 0) || a.filas[0].id - b.filas[0].id)
  return grupos
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const desdeInt = isoInt(searchParams.get('desde'))
    const hastaInt = isoInt(searchParams.get('hasta'))
    const filas = await traerTodas(desdeInt, hastaInt)
    const grupos = agrupar(filas)
    const totalSobrantes = grupos.reduce((s, g) => s + (g.filas.length - 1), 0)
    return Response.json({ ok: true, grupos, totalGrupos: grupos.length, totalSobrantes })
  } catch (e) {
    return Response.json({ error: e.message || 'Error al detectar duplicados' }, { status: 500 })
  }
}

export async function POST(req) {
  try {
    const { ids } = await req.json()
    if (!Array.isArray(ids) || ids.length === 0) {
      return Response.json({ error: 'Sin ids para eliminar' }, { status: 400 })
    }

    // SALVAGUARDA server-side: re-verificar que cada id a borrar es un sobrante real.
    // Se escanea SIN rango (toda la tabla) para que el grupo esté completo y no se
    // borre por error algo que parecía sobrante dentro de un rango recortado.
    const filas = await traerTodas(null, null)
    const porClave = new Map()
    for (const r of filas) {
      const k = claveDe(r)
      if (!porClave.has(k)) porClave.set(k, [])
      porClave.get(k).push(r)
    }
    const byId = new Map(filas.map(r => [r.id, r]))
    const permitidos = []
    for (const id of ids) {
      const r = byId.get(id)
      if (!r) continue
      const grupo = porClave.get(claveDe(r)) || []
      if (grupo.length < 2) continue
      const minId = Math.min(...grupo.map(x => x.id))
      if (id !== minId) permitidos.push(id)   // nunca se borra el original del grupo
    }

    if (permitidos.length === 0) {
      return Response.json({ error: 'Ninguno de los ids es un sobrante válido (no se borra el original ni filas únicas).' }, { status: 400 })
    }

    // Borrado en lotes de 500 (evita URLs demasiado largas en el .in()).
    let borrados = 0
    for (let i = 0; i < permitidos.length; i += 500) {
      const lote = permitidos.slice(i, i + 500)
      const { error } = await supaAdmin.from('cuentas').delete().in('id', lote)
      if (error) return Response.json({ error: error.message, borrados }, { status: 500 })
      borrados += lote.length
    }

    return Response.json({ ok: true, borrados, ids: permitidos })
  } catch (e) {
    return Response.json({ error: e.message || 'Error al eliminar duplicados' }, { status: 500 })
  }
}