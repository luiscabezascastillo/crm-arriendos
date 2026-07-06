// app/api/valoraciones/sii/route.js
// Consulta SimpleAPI Mapas (catastro SII) por ROL o DIRECCIÓN.
// Resuelve la comuna contra la lista oficial de SimpleAPI (tolera acentos/mayúsculas),
// así nunca falla por cómo se escriba. La apikey va en SIMPLEAPI_KEY (Vercel).

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const BASE = 'https://servicios.simpleapi.cl/api/mapas'

async function ufActual() {
  try {
    const { data } = await supabase.from('indices_mensuales').select('valor_uf').order('mes', { ascending: false }).limit(1).maybeSingle()
    return data?.valor_uf ? Number(data.valor_uf) : null
  } catch (e) { return null }
}

// quita acentos, pasa a mayúsculas, colapsa espacios -> para comparar comunas
function norm(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()
}

// cache simple de comunas en memoria (por invocación de servidor)
let _comunas = null
async function comunasSimpleAPI(key) {
  if (_comunas) return _comunas
  try {
    const r = await fetch(`${BASE}/utils/comunas`, {
      method: 'POST',
      headers: { 'Authorization': key, 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(15000),
    })
    if (!r.ok) return null
    const j = await r.json()
    const arr = Array.isArray(j) ? j : (j.data || j.Data || [])
    _comunas = arr.map((c) => ({ id: c.Id || c.id, nombre: c.Comuna || c.comuna }))
    return _comunas
  } catch (e) { return null }
}

// devuelve { id, nombre } de la comuna oficial que matchee, o null
async function resolverComuna(key, comunaInput) {
  const lista = await comunasSimpleAPI(key)
  if (!lista) return null
  const target = norm(comunaInput)
  // match exacto normalizado, si no, que empiece igual
  return lista.find((c) => norm(c.nombre) === target)
      || lista.find((c) => norm(c.nombre).startsWith(target))
      || null
}

function normalizar(d) {
  if (!d) return null
  const ah = d.DatosAreaHomogenea || {}
  return {
    rol: d.Rol || null, direccion: d.Direccion || null, comuna: d.Comuna || null, destino: d.Destino || null,
    avaluo_total: d.ValorTotal || null,
    superficie_construida: d.MetrosCuadradosConstruidos || 0, superficie_terreno: d.SuperficieTerreno || 0,
    area_homogenea: d.AreaHomogenea || null, valor_m2_ah: ah.ValorUnitario || null,
    rango_superficie_ah: ah.RangoSuperficie ? ah.RangoSuperficie.trim() : null,
    lat: d.PosicionX || null, lng: d.PosicionY || null, periodo: d.Periodo || null,
  }
}

async function consultar(url, body, key) {
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    })
    const txt = await r.text()
    let json = null; try { json = JSON.parse(txt) } catch {}
    if (!r.ok) return { error: `SimpleAPI ${r.status}`, detalle: (json ? JSON.stringify(json) : txt).slice(0, 400) }
    const datos = normalizar(json?.Datos)
    if (datos && datos.avaluo_total) {
      const uf = await ufActual()
      datos.avaluo_uf = uf ? Math.round(datos.avaluo_total / uf) : null
    }
    return { datos }
  } catch (e) {
    return { error: e.name === 'TimeoutError' ? 'El SII tardó demasiado (reintenta)' : e.message }
  }
}

export async function GET(request) {
  try {
    const key = process.env.SIMPLEAPI_KEY
    if (!key) return NextResponse.json({ error: 'Falta SIMPLEAPI_KEY en variables de entorno' }, { status: 500 })

    const { searchParams } = new URL(request.url)
    const rol = (searchParams.get('rol') || '').trim()
    const direccion = (searchParams.get('direccion') || '').trim()
    const comunaInput = (searchParams.get('comuna') || '').trim()

    if (!comunaInput) return NextResponse.json({ error: 'Falta la comuna' }, { status: 400 })

    // Resolver comuna oficial (tolera acentos/mayúsculas)
    const comuna = await resolverComuna(key, comunaInput)
    if (!comuna) return NextResponse.json({ error: `No encontré la comuna "${comunaInput}" en el catastro. Revisa el nombre.` }, { status: 400 })

    // --- Por ROL ---
    if (rol) {
      const [manzana, predio] = rol.split('-').map((x) => parseInt(x, 10))
      if (!manzana || !predio) return NextResponse.json({ error: 'Rol inválido. Formato: manzana-predio (ej. 517-175)' }, { status: 400 })
      const r = await consultar(`${BASE}/buscar/rol`, { Comuna: comuna.nombre, Manzana: manzana, Predio: predio }, key)
      return NextResponse.json(r)
    }

    // --- Por DIRECCIÓN ---
    if (direccion) {
      const m = direccion.match(/^(.*?)(\d+)\s*$/)
      const calle = (m ? m[1] : direccion).trim().toUpperCase()
      const numero = m ? m[2] : ''
      const r = await consultar(`${BASE}/buscar/direccion`, { IdComuna: comuna.id, Comuna: comuna.nombre, Calle: calle, Numero: numero }, key)
      return NextResponse.json(r)
    }

    return NextResponse.json({ error: 'Envía ?rol=517-175&comuna=... o ?direccion=CALLE 123&comuna=...' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}