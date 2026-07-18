// VERSION: v1 · 2026-07-18 · app/api/comunidad-feliz/parsear-texto/route.js
//
// Alternativa a leer el xlsx de Drive: recibe el TEXTO pegado del portal Comunidad Feliz
// (bloques de 3 líneas: Comunidad / Inmueble / Deuda) y produce EXACTAMENTE las mismas `filas`
// y `stats` que /procesar, cruzando con cf_correspondencias. Así el resto del circuito
// (previo → tabla → guardar) queda idéntico. NO escribe nada; solo devuelve el previo.
//
// Robustez (lección del día): NO se fía ciegamente del "3 en 3". Valida que la 3ª línea de cada
// bloque parezca una deuda ("$..." o "Sin deuda"); si no, marca el bloque como error y se detiene
// sin cargar nada desalineado. Y deduplica por comunidad+inmueble (por si se pega una tanda 2 veces).

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function norm(s) {
  if (!s) return ''
  return String(s).trim().toLowerCase()
}

// ¿La línea parece una deuda? "$ 117.608", "$191", "Sin deuda"
function esLineaDeuda(s) {
  const t = String(s || '').trim().toLowerCase()
  if (t === 'sin deuda') return true
  return /^\$\s*[\d.]+$/.test(String(s || '').trim())
}

// "$ 117.608" -> 117608 · "Sin deuda" -> 0 · "$191" -> 191
// El punto es separador de MILES (Chile): se quita. Nunca se multiplica por 1000.
function parseDeuda(s) {
  const t = String(s || '').trim()
  if (t.toLowerCase() === 'sin deuda') return 0
  const num = t.replace(/[^\d]/g, '')
  return num === '' ? null : parseInt(num, 10)
}

export async function POST(req) {
  try {
    const { texto, mesClave, aamm } = await req.json()
    if (!texto || !String(texto).trim()) {
      return Response.json({ error: 'No se pegó ningún texto.' }, { status: 400 })
    }

    // 1) Partir en líneas no vacías (tolera \r\n, líneas en blanco entre tandas)
    const lineas = String(texto).split(/\r?\n/).map(l => l.trim()).filter(l => l !== '')

    // 2) Agrupar de 3 en 3, validando la 3ª línea como deuda
    const errores = []
    const cfMap = {}          // key comunidad||inmueble -> { comunidad, inmueble, deuda }
    let duplicados = 0
    let bloques = 0

    for (let i = 0; i < lineas.length; i += 3) {
      const b = lineas.slice(i, i + 3)
      bloques++
      if (b.length < 3) {
        errores.push(`Bloque incompleto al final (línea ${i + 1}): ${JSON.stringify(b)}`)
        break
      }
      const [comunidad, inmueble, deudaRaw] = b
      // Salvaguarda anti-desalineo: la 3ª línea DEBE parecer una deuda
      if (!esLineaDeuda(deudaRaw)) {
        errores.push(`Bloque ${bloques} (línea ${i + 1}): la 3ª línea no parece una deuda → "${deudaRaw}". Revisa el pegado (¿se coló una columna o falta una línea?).`)
        continue
      }
      const deuda = parseDeuda(deudaRaw)
      const key = norm(comunidad) + '||' + norm(inmueble)
      if (cfMap[key]) { duplicados++; continue }   // dedupe: misma comunidad+inmueble ya pegada
      cfMap[key] = { comunidad, inmueble, deuda }
    }

    // Si hay errores de estructura, NO seguimos: mejor parar que cargar mal.
    if (errores.length > 0) {
      return Response.json({
        error: 'El texto pegado no cuadra en bloques de 3 (Comunidad / Inmueble / Deuda).',
        detalles: errores.slice(0, 10),
        propiedadesDetectadas: Object.keys(cfMap).length,
        duplicadosIgnorados: duplicados,
      }, { status: 422 })
    }

    const fechaExtraccion = new Date().toISOString().substring(0, 10)

    // 3) Cargar correspondencias desde Supabase (igual que /procesar)
    const { data: corrRows, error: corrErr } = await supabase
      .from('cf_correspondencias')
      .select('*')
      .eq('activo', true)
    if (corrErr) throw new Error('Error cargando correspondencias: ' + corrErr.message)

    const corrMap = {}
    for (const c of corrRows) {
      corrMap[norm(c.comunidad_cf) + '||' + norm(c.inmueble_cf)] = c
    }

    // 4) Cruce (misma lógica y misma forma de `filas` que /procesar) ----------
    const filas = []
    let conMatch = 0, sinMatch = 0, nuevos = 0

    for (const [key, corr] of Object.entries(corrMap)) {
      if (!['S', 'P'].includes(corr.estado)) continue
      const cfRow = cfMap[key]
      const match = !!cfRow
      let observacion = ''
      if (!match) { observacion = 'No encontrado en CF'; sinMatch++ } else { conMatch++ }
      filas.push({
        idadmon: corr.idadmon,
        idinmue: corr.idinmue,
        estado: corr.estado,
        propietario: corr.propietario,
        comunidad_cf: corr.comunidad_cf,
        inmueble_cf: corr.inmueble_cf,
        deuda: match ? Math.round(cfRow.deuda) : null,
        fecha: match ? fechaExtraccion : null,
        match,
        nuevo: false,
        observacion,
      })
    }

    // Inmuebles pegados que no tienen correspondencia (nuevos)
    for (const [key, cfRow] of Object.entries(cfMap)) {
      if (!corrMap[key] && cfRow.deuda > 0) {
        nuevos++
        filas.push({
          idadmon: null, idinmue: null, estado: null, propietario: null,
          comunidad_cf: cfRow.comunidad, inmueble_cf: cfRow.inmueble,
          deuda: Math.round(cfRow.deuda), fecha: fechaExtraccion,
          match: false, nuevo: true,
          observacion: 'En CF pero sin correspondencia — revisar',
        })
      }
    }

    const stats = {
      total: filas.length, conMatch, sinMatch, nuevos,
      propiedadesPegadas: Object.keys(cfMap).length,
      duplicadosIgnorados: duplicados,
    }

    return Response.json({ filas, stats, fechaExtraccion })
  } catch (e) {
    console.error(e)
    return Response.json({ error: e.message }, { status: 500 })
  }
}
