// app/api/valoraciones/sii/route.js
// Consulta SimpleAPI Mapas (catastro SII público) por ROL o por DIRECCIÓN.
// Devuelve rol, avalúo, superficie, destino, área homogénea (valor m² oficial) y lat/lng.
// La apikey va en la variable de entorno SIMPLEAPI_KEY (Vercel).

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function ufActual() {
  try {
    const { data } = await supabase.from('indices_mensuales').select('valor_uf').order('mes', { ascending: false }).limit(1).maybeSingle()
    return data?.valor_uf ? Number(data.valor_uf) : null
  } catch (e) { return null }
}

const BASE = 'https://servicios.simpleapi.cl/api/mapas'

// Códigos de comuna SII (Mapas) más usados. Se puede ampliar.
const ID_COMUNA = {
  'SANTIAGO': 13101, 'PROVIDENCIA': 13123, 'LAS CONDES': 13114, 'VITACURA': 13132,
  'LO BARNECHEA': 13115, 'NUNOA': 13120, 'ÑUÑOA': 13120, 'LA REINA': 13113,
  'MACUL': 13116, 'PENALOLEN': 13122, 'PEÑALOLEN': 13122, 'LA FLORIDA': 13110,
  'PUENTE ALTO': 16301, 'MAIPU': 13119, 'MAIPÚ': 13119, 'ESTACION CENTRAL': 13106,
  'SAN MIGUEL': 13126, 'INDEPENDENCIA': 13108, 'RECOLETA': 13124, 'QUILICURA': 13125,
  'HUECHURABA': 13107, 'CONCHALI': 13104, 'RENCA': 13128, 'CERRILLOS': 13102,
  'PEDRO AGUIRRE CERDA': 13121, 'SAN JOAQUIN': 13127, 'LA CISTERNA': 13109,
  'EL BOSQUE': 13105, 'LA GRANJA': 13111, 'SAN RAMON': 13131, 'LO ESPEJO': 13117,
  'CERRO NAVIA': 13103, 'LO PRADO': 13118, 'PUDAHUEL': 13123, 'QUINTA NORMAL': 13126,
  'VINA DEL MAR': 5109, 'VIÑA DEL MAR': 5109, 'VALPARAISO': 5101, 'CONCON': 5103,
  'CONCEPCION': 8101, 'TALCAHUANO': 8108,
}

function idComuna(nombre) {
  if (!nombre) return null
  return ID_COMUNA[nombre.trim().toUpperCase()] || null
}

// Normaliza la respuesta de SimpleAPI a los campos que usa la ficha.
function normalizar(d) {
  if (!d) return null
  const ah = d.DatosAreaHomogenea || {}
  return {
    rol: d.Rol || null,
    direccion: d.Direccion || null,
    comuna: d.Comuna || null,
    destino: d.Destino || null,
    avaluo_total: d.ValorTotal || null,          // pesos
    superficie_construida: d.MetrosCuadradosConstruidos || 0,
    superficie_terreno: d.SuperficieTerreno || 0,
    area_homogenea: d.AreaHomogenea || null,
    valor_m2_ah: ah.ValorUnitario || null,       // $/m² oficial del sector
    rango_superficie_ah: ah.RangoSuperficie ? ah.RangoSuperficie.trim() : null,
    lat: d.PosicionX || null,
    lng: d.PosicionY || null,
    periodo: d.Periodo || null,
  }
}

async function consultar(url, body) {
  const key = process.env.SIMPLEAPI_KEY
  if (!key) return { error: 'Falta SIMPLEAPI_KEY en variables de entorno' }
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000), // SimpleAPI scrapea el SII: puede tardar
    })
    const txt = await r.text()
    let json = null
    try { json = JSON.parse(txt) } catch {}
    if (!r.ok) return { error: `SimpleAPI ${r.status}`, detalle: (json || txt).toString().slice(0, 300) }
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
    const { searchParams } = new URL(request.url)
    const rol = (searchParams.get('rol') || '').trim()
    const direccion = (searchParams.get('direccion') || '').trim()
    const comuna = (searchParams.get('comuna') || '').trim()

    // --- Por ROL (ej. "517-175") ---
    if (rol) {
      const [manzana, predio] = rol.split('-').map((x) => parseInt(x, 10))
      if (!manzana || !predio) return NextResponse.json({ error: 'Rol inválido. Formato esperado: manzana-predio (ej. 517-175)' }, { status: 400 })
      const r = await consultar(`${BASE}/buscar/rol`, { Comuna: comuna.toUpperCase(), Manzana: manzana, Predio: predio })
      return NextResponse.json(r)
    }

    // --- Por DIRECCIÓN ---
    if (direccion) {
      const idc = idComuna(comuna)
      if (!idc) return NextResponse.json({ error: `No tengo el código SII de la comuna "${comuna}". Usa la vía por rol, o avísame para agregarla.` }, { status: 400 })
      // separa calle y número: "AMANCAI 4642" -> calle "AMANCAI", numero "4642"
      const m = direccion.match(/^(.*?)(\d+)\s*$/)
      const calle = (m ? m[1] : direccion).trim().toUpperCase()
      const numero = m ? m[2] : ''
      const r = await consultar(`${BASE}/buscar/direccion`, { IdComuna: idc, Comuna: comuna.toUpperCase(), Calle: calle, Numero: numero })
      return NextResponse.json(r)
    }

    return NextResponse.json({ error: 'Envía ?rol=517-175&comuna=PROVIDENCIA o ?direccion=CALLE 123&comuna=...' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
