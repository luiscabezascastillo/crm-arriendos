import { NextResponse } from 'next/server'
import { supabase } from '../../../../lib/supabaseClient'

const ML_API = 'https://api.mercadolibre.com'

// Normaliza para comparar nombres de comuna sin importar mayusculas/tildes/espacios.
function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
}

async function getToken() {
  const { data: rows } = await supabase
    .from('configuracion').select('clave, valor').eq('clave', 'ml_access_token')
  return rows?.[0]?.valor || null
}

export async function GET() {
  try {
    const token = await getToken()
    if (!token) return NextResponse.json({ error: 'No hay ml_access_token en configuracion' }, { status: 500 })
    const headers = { Authorization: `Bearer ${token}` }

    // 1) Pais Chile -> lista de estados (regiones)
    const resPais = await fetch(`${ML_API}/countries/CL`, { headers })
    if (!resPais.ok) return NextResponse.json({ error: 'Error /countries/CL: ' + resPais.status }, { status: 500 })
    const pais = await resPais.json()
    const estados = pais.states || []

    // 2) Por cada estado, traer sus ciudades (comunas) con su id real
    const comunas = []
    for (const est of estados) {
      try {
        const resEst = await fetch(`${ML_API}/states/${est.id}`, { headers })
        if (!resEst.ok) continue
        const detEst = await resEst.json()
        for (const ciudad of (detEst.cities || [])) {
          comunas.push({
            nombre: ciudad.name,
            id: ciudad.id,
            state_id: est.id,
            state_name: est.name,
          })
        }
      } catch (e) { /* sigue con el resto */ }
    }

    // 3) Indexar por nombre normalizado para busqueda
    const porNombre = {}
    for (const c of comunas) porNombre[norm(c.nombre)] = c

    return NextResponse.json({
      ok: true,
      total_estados: estados.length,
      total_comunas: comunas.length,
      comunas,                 // catalogo oficial completo de ML
      // mapa rapido nombre_normalizado -> {id, state_id, state_name}
      indice: porNombre,
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
