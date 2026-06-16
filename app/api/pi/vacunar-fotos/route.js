import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ML_API = 'https://api.mercadolibre.com'

async function getValidToken() {
  const { data: rows } = await supabase
    .from('configuracion')
    .select('clave, valor')
    .in('clave', ['ml_access_token', 'ml_token_expira', 'ml_refresh_token'])
  const config = {}
  for (const row of rows || []) config[row.clave] = row.valor
  const expira = config['ml_token_expira'] ? new Date(config['ml_token_expira']) : null
  const ahora = new Date()
  if (config['ml_access_token'] && expira && expira > new Date(ahora.getTime() + 5 * 60 * 1000)) {
    return config['ml_access_token']
  }
  const res = await fetch(`${ML_API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.ML_CLIENT_ID,
      client_secret: process.env.ML_CLIENT_SECRET,
      refresh_token: config['ml_refresh_token'],
    }),
  })
  const json = await res.json()
  const newAccess = json.access_token
  const newRefresh = json.refresh_token || config['ml_refresh_token']
  const nuevaExpiracion = new Date(ahora.getTime() + (json.expires_in || 21600) * 1000).toISOString()
  await supabase.from('configuracion').upsert([
    { clave: 'ml_access_token', valor: newAccess, updated_at: new Date().toISOString() },
    { clave: 'ml_refresh_token', valor: newRefresh, updated_at: new Date().toISOString() },
    { clave: 'ml_token_expira', valor: nuevaExpiracion, updated_at: new Date().toISOString() },
  ])
  return newAccess
}

// Lista ordenada de nombres de archivo (imagen1..imagen30, break al primer hueco)
function listaFotos(pub) {
  const fotos = []
  for (let i = 1; i <= 30; i++) {
    const img = pub[`imagen${i}`]
    if (!img) break
    fotos.push(img)
  }
  return fotos
}

// Firma nueva (formato de nombres unidos por '|', igual que publicar-pi/actualizar-pi)
function calcularFirmaFotos(pub) {
  const partes = []
  for (let i = 1; i <= 30; i++) partes.push(pub[`imagen${i}`] || '')
  return partes.join('|')
}

function lotes(arr, n) {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

// POST /api/pi/vacunar-fotos
// Reconstruye fotos_ml + fotos_firma para las publicaciones ACTIVAS con codigo_pi
// que no tengan mapeo fiable. Empareja por POSICION las fotos de ML con imagen1..N.
//
// SEGURIDAD:
//  - Por defecto NO escribe nada (modo simulacro). Para ejecutar de verdad,
//    enviar body { "ejecutar": true }.
//  - Solo reconstruye si el numero de fotos de ML COINCIDE con el de la tabla.
//    Si no coincide -> NO toca, marca "revisar" (alguien cambio fotos sin sincronizar).
//  - Solo procesa publicaciones cuyo fotos_ml este vacio o sea basura (no array).
export async function POST(request) {
  try {
    let ejecutar = false
    try {
      const body = await request.json()
      ejecutar = body?.ejecutar === true
    } catch (e) { ejecutar = false }

    // 1. Activas con codigo_pi
    const { data: pubs, error } = await supabase
      .from('publicaciones')
      .select('*')
      .eq('activo', 'active')
      .not('codigo_pi', 'is', null)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!pubs || pubs.length === 0) {
      return NextResponse.json({ ok: true, mensaje: 'No hay publicaciones activas con código PI.' })
    }

    // 2. Filtrar las que NO tienen mapeo fiable (fotos_ml vacio o no-array)
    const sinMapeo = pubs.filter(p => !Array.isArray(p.fotos_ml) || p.fotos_ml.length === 0)
    const yaConMapeo = pubs.length - sinMapeo.length

    const token = await getValidToken()
    const ahora = new Date().toISOString()

    // 3. Leer fotos de ML en lotes de 20 (multiget verbose con attributes=id,pictures)
    const fotosPorItem = {}  // codigo_pi -> [ids] o null
    const statusPorItem = {} // codigo_pi -> status
    const codigos = sinMapeo.map(p => p.codigo_pi)
    for (const lote of lotes(codigos, 20)) {
      const ids = lote.join(',')
      const res = await fetch(`${ML_API}/items?ids=${ids}&attributes=id,status,pictures`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
      })
      const data = await res.json()
      if (Array.isArray(data)) {
        for (const item of data) {
          const body = item.body || {}
          if (item.code === 200 && body.id) {
            fotosPorItem[body.id] = (body.pictures || []).map(pic => pic.id)
            statusPorItem[body.id] = body.status
          }
        }
      }
    }

    // 4. Para cada una, decidir: vacunar / revisar / saltar
    const aVacunar = []   // {id, codigo, codigo_pi, num}
    const aRevisar = []   // {id, codigo, codigo_pi, motivo, nTabla, nMl}
    const updates = []    // {id, fotos_ml, fotos_firma}

    for (const p of sinMapeo) {
      const nombresTabla = listaFotos(p)
      const idsML = fotosPorItem[p.codigo_pi]
      const statusML = statusPorItem[p.codigo_pi]

      if (!idsML) {
        aRevisar.push({ id: p.id, codigo: p.codigo, codigo_pi: p.codigo_pi, motivo: 'no_leida_en_ml (status ' + (statusML || '?') + ')', nTabla: nombresTabla.length, nMl: 0 })
        continue
      }
      if (statusML !== 'active') {
        aRevisar.push({ id: p.id, codigo: p.codigo, codigo_pi: p.codigo_pi, motivo: 'no_active_en_ml (' + statusML + ')', nTabla: nombresTabla.length, nMl: idsML.length })
        continue
      }
      if (nombresTabla.length === 0) {
        aRevisar.push({ id: p.id, codigo: p.codigo, codigo_pi: p.codigo_pi, motivo: 'sin_fotos_en_tabla', nTabla: 0, nMl: idsML.length })
        continue
      }
      if (nombresTabla.length !== idsML.length) {
        aRevisar.push({ id: p.id, codigo: p.codigo, codigo_pi: p.codigo_pi, motivo: 'cantidades_distintas', nTabla: nombresTabla.length, nMl: idsML.length })
        continue
      }
      // OK: emparejar por posicion
      const fotosMl = nombresTabla.map((nombre, idx) => ({ imagen: nombre, ml_id: idsML[idx] }))
      const firma = calcularFirmaFotos(p)
      aVacunar.push({ id: p.id, codigo: p.codigo, codigo_pi: p.codigo_pi, num: fotosMl.length })
      updates.push({ id: p.id, fotos_ml: fotosMl, fotos_firma: firma })
    }

    // 5. Si ejecutar=true, aplicar los updates
    let aplicadas = 0
    if (ejecutar) {
      for (const u of updates) {
        await supabase.from('publicaciones')
          .update({ fotos_ml: u.fotos_ml, fotos_firma: u.fotos_firma })
          .eq('id', u.id)
        aplicadas++
      }
    }

    return NextResponse.json({
      ok: true,
      modo: ejecutar ? 'EJECUTADO' : 'SIMULACRO (no se ha escrito nada)',
      activas_con_pi: pubs.length,
      ya_con_mapeo: yaConMapeo,
      sin_mapeo: sinMapeo.length,
      vacunables: aVacunar.length,
      a_revisar: aRevisar.length,
      aplicadas: ejecutar ? aplicadas : 0,
      detalle_vacunables: aVacunar,
      detalle_revisar: aRevisar,
      fecha: ahora,
    })

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}