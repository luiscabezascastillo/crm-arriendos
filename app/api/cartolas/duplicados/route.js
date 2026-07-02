// app/api/cartolas/duplicados/route.js
// Detección y borrado de filas duplicadas en la tabla `cuentas` (CARTOLAS).
// Replica el botón VBA "MarcarDuplicadosConsecutivos": un duplicado es una fila
// idéntica a otra en los campos de negocio (equivalente a las columnas A:I del Excel,
// SIN el folio `calif` ni `justificantes`, que son justo lo que distingue el asiento).
//
// GET  -> devuelve los grupos de filas idénticas (2+), ordenadas por id asc.
// POST { ids: [...] } -> borra esos ids, con salvaguarda: solo elimina "sobrantes"
//   (nunca el de menor id de un grupo, ni filas únicas). Re-verifica en el servidor.

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

// Trae TODAS las filas de cuentas (solo las columnas necesarias), paginando de 1000 en 1000.
async function traerTodas() {
  const filas = []
  const paso = 1000
  let desde = 0
  for (;;) {
    const { data, error } = await supaAdmin
      .from('cuentas')
      .select('id, fecha, idadmon, concepto, cargo, abono, saldo, comentarios')
      .order('id', { ascending: true })
      .range(desde, desde + paso - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    filas.push(...data)
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
  // Orden de presentación: por fecha del primer elemento
  grupos.sort((a, b) => String(a.filas[0].fecha).localeCompare(String(b.filas[0].fecha)))
  return grupos
}

export async function GET() {
  try {
    const filas = await traerTodas()
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

    // SALVAGUARDA server-side: re-verificar que cada id a borrar es un sobrante real
    // (pertenece a un grupo de 2+ idénticas y NO es el de menor id del grupo).
    const filas = await traerTodas()
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

    const { error } = await supaAdmin.from('cuentas').delete().in('id', permitidos)
    if (error) return Response.json({ error: error.message }, { status: 500 })

    return Response.json({ ok: true, borrados: permitidos.length, ids: permitidos })
  } catch (e) {
    return Response.json({ error: e.message || 'Error al eliminar duplicados' }, { status: 500 })
  }
}