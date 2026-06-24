import { NextResponse } from 'next/server'
import { supabase } from '../../../../../lib/supabaseClient'
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'

const ML_API = 'https://api.mercadolibre.com'

// Normaliza: minusculas, sin tildes, espacios colapsados. Clave de busqueda.
function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
}

async function getToken() {
  const { data: rows } = await supabase
    .from('configuracion').select('clave, valor').eq('clave', 'ml_access_token')
  return rows?.[0]?.valor || null
}

export async function POST() {
  try {
    const token = await getToken()
    if (!token) return NextResponse.json({ error: 'No hay ml_access_token en configuracion. Refresca el token primero.' }, { status: 500 })
    const headers = { Authorization: `Bearer ${token}` }

    // 1) Pais Chile -> estados (regiones)
    const resPais = await fetch(`${ML_API}/countries/CL`, { headers })
    if (!resPais.ok) return NextResponse.json({ error: 'Error /countries/CL: ' + resPais.status }, { status: 500 })
    const pais = await resPais.json()
    const estados = pais.states || []

    // 2) Por cada estado, traer ciudades (comunas)
    const filas = []
    const vistos = new Set()
    for (const est of estados) {
      try {
        const resEst = await fetch(`${ML_API}/states/${est.id}`, { headers })
        if (!resEst.ok) continue
        const detEst = await resEst.json()
        for (const ciudad of (detEst.cities || [])) {
          const nn = norm(ciudad.name)
          if (!nn || vistos.has(nn)) continue   // evita duplicados por nombre normalizado
          vistos.add(nn)
          filas.push({
            nombre_norm: nn,
            nombre: ciudad.name,
            ml_city_id: ciudad.id,
            state_id: est.id,
            state_name: est.name,
            updated_at: new Date().toISOString(),
          })
        }
      } catch (e) { /* sigue */ }
    }

    if (!filas.length) return NextResponse.json({ error: 'ML no devolvio comunas' }, { status: 500 })

    // 3) Upsert por lotes a comunas_ml (service role, salta RLS)
    let upserted = 0
    const lote = 200
    for (let i = 0; i < filas.length; i += lote) {
      const slice = filas.slice(i, i + lote)
      const { error } = await supabaseAdmin
        .from('comunas_ml')
        .upsert(slice, { onConflict: 'nombre_norm' })
      if (error) return NextResponse.json({ error: 'Error upsert: ' + error.message, upserted }, { status: 500 })
      upserted += slice.length
    }

    return NextResponse.json({
      ok: true,
      total_estados: estados.length,
      total_comunas: filas.length,
      upserted,
      mensaje: `Sincronizadas ${upserted} comunas en comunas_ml`,
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
