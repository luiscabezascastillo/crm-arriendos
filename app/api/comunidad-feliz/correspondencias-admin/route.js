// VERSION: v3 · 2026-08-24 · Admin de cf_correspondencias para /op/comunidad-feliz/correspondencias.
//   v3: estados de contrato precisos — VÁLIDOS = S, SQ (activos) y P (vacío, servicios del propietario);
//       TERMINADOS/no válidos = Q*, N* (u otros). Sugeridor, búsqueda y "activo por idinmue" filtran por
//       estado VÁLIDO (positivo). Guard al guardar consultando el estado real en datos_arriendos.
//   v2: el idinmue es el ancla estable y el idadmon rota (contratos); se resuelve el idadmon activo por idinmue.
//   GET ?modo=lista  → correspondencias enriquecidas (dirección, idadmon terminado, idadmon activo sugerido).
//   GET ?modo=sugerir&comunidad=&inmueble= → candidatos activos por nº de unidad (dep/est/bod).
//   GET ?modo=buscar&q= → búsqueda libre en el maestro (solo activos primero).
//   POST {accion:'guardar'|'desactivar'|'activar', ...}.
//   NOTA seguridad: usa service-role y NO valida sesión/rol (control solo en UI), como el resto del circuito CF.
// app/api/comunidad-feliz/correspondencias-admin/route.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const J = (o, s = 200) => Response.json(o, { status: s })
const soloAlnum = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

// Estados de contrato (datos_arriendos.estado):
//   VÁLIDOS para la correspondencia → S, SQ (activos) y P (vacío, servicios a cuenta del propietario).
//   TERMINADOS → Q* y N* (con subestados, pero siempre empiezan por esas letras).
const esValidoEstado = (e) => { const t = String(e || '').trim().toUpperCase(); return t.startsWith('S') || t.startsWith('P') }
const esTerminadoEstado = (e) => { const t = String(e || '').trim().toUpperCase(); return t.startsWith('Q') || t.startsWith('N') }

function tokensNombre(s) {
  return String(s || '').toLowerCase()
    .replace(/comunidad|edificio|condominio|proyecto|torre/g, ' ')
    .split(/[^a-z0-9]+/).filter((t) => t.length >= 4)
}
function unidadesDireccion(inm) {
  const t = String(inm || '').toLowerCase()
  const grab = (re) => { const out = []; let m; while ((m = re.exec(t))) out.push(soloAlnum(m[1])); return out }
  return {
    dep: grab(/dep\s*([0-9]+\s*[a-z]?)/g),
    est: grab(/est\s*([0-9]+\s*[a-z]?)/g),
    bod: grab(/bod\s*([0-9]+\s*[a-z]?)/g),
  }
}
function unidadCF(s) {
  let t = soloAlnum(s)
  t = t.replace(/^(departamento|depto|dep|estacionamiento|estac|est|bodega|bod)/, '')
  t = t.replace(/^[a-z]+(?=[0-9])/, '')
  return t
}

async function cargarMaestro() {
  const { data, error } = await supabase
    .from('datos_arriendos')
    .select('idadmon, idinmue, propietario, inmueble, estado')
    .limit(20000)
  if (error) throw new Error(error.message)
  const vistos = new Set(); const out = []
  for (const r of (data || [])) {
    if (!r.idadmon) continue
    const k = r.idadmon + '|' + (r.idinmue || '') + '|' + (r.inmueble || '')
    if (vistos.has(k)) continue
    vistos.add(k); out.push(r)
  }
  return out
}

// Índices útiles a partir del maestro.
function indexar(maestro) {
  const dirPorIdadmon = new Map()   // idadmon → dirección (primera)
  const estadoPorIdadmon = new Map()// idadmon → estado
  const activoPorComp = new Map()   // componente de idinmue → idadmon ACTIVO
  for (const r of maestro) {
    if (r.idadmon && !dirPorIdadmon.has(r.idadmon)) dirPorIdadmon.set(r.idadmon, r.inmueble)
    if (r.idadmon && !estadoPorIdadmon.has(r.idadmon)) estadoPorIdadmon.set(r.idadmon, r.estado || '')
    if (esValidoEstado(r.estado)) { // solo contratos válidos (S/SQ/P) como "activo" del inmueble
      for (const comp of String(r.idinmue || '').split(/\s+/).filter(Boolean)) {
        if (!activoPorComp.has(comp)) activoPorComp.set(comp, r.idadmon)
      }
    }
  }
  return { dirPorIdadmon, estadoPorIdadmon, activoPorComp }
}

function sugerir(comunidad_cf, inmueble_cf, maestro) {
  const u = unidadCF(inmueble_cf)
  if (!u) return []
  const toksCom = tokensNombre(comunidad_cf)
  const cands = []
  for (const r of maestro) {
    if (!esValidoEstado(r.estado)) continue // solo contratos válidos (S/SQ/P)
    const { dep, est, bod } = unidadesDireccion(r.inmueble)
    let tipo = null, base = 0
    if (dep.includes(u)) { tipo = 'dep'; base = 0.75 }
    else if (est.includes(u)) { tipo = 'est'; base = 0.55 }
    else if (bod.includes(u)) { tipo = 'bod'; base = 0.55 }
    if (!tipo) continue
    const overlap = toksCom.length ? tokensNombre(r.inmueble).some((t) => toksCom.includes(t)) : false
    const score = Math.min(0.98, base + (overlap ? 0.2 : 0))
    cands.push({ idadmon: r.idadmon, idinmue: r.idinmue, propietario: r.propietario, inmueble: r.inmueble, score, motivo: tipo + (overlap ? '+nombre' : '') })
  }
  cands.sort((a, b) => b.score - a.score)
  return cands.slice(0, 6)
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const modo = searchParams.get('modo') || 'lista'
    const maestro = await cargarMaestro()

    if (modo === 'lista') {
      const soloActivas = searchParams.get('todas') !== '1'
      let q = supabase.from('cf_correspondencias')
        .select('id, comunidad_cf, inmueble_cf, idadmon, idinmue, estado, propietario, activo, notas, updated_at')
        .order('comunidad_cf', { ascending: true }).limit(10000)
      if (soloActivas) q = q.eq('activo', true)
      const { data, error } = await q
      if (error) return J({ error: error.message }, 500)

      const { dirPorIdadmon, estadoPorIdadmon, activoPorComp } = indexar(maestro)

      const filas = (data || []).map((c) => {
        const estadoDA = c.idadmon ? (estadoPorIdadmon.get(c.idadmon) || '') : ''
        // "malo" = idadmon presente cuyo estado NO es S/SQ/P (terminado Q/N, u otro no válido).
        const malo = c.idadmon ? !esValidoEstado(estadoDA) : false
        const terminado = c.idadmon ? esTerminadoEstado(estadoDA) : false
        const primeraComp = String(c.idinmue || '').split(/\s+/).filter(Boolean)[0] || null
        const activoSug = primeraComp ? (activoPorComp.get(primeraComp) || null) : null
        let problema = null
        if (!c.comunidad_cf?.trim()) problema = 'sin_comunidad'
        else if (!c.idadmon) problema = 'sin_idadmon'
        else if (malo) problema = 'idadmon_terminado'
        else if (activoSug && activoSug !== c.idadmon) problema = 'idadmon_desactualizado'
        return {
          ...c,
          direccion_maestro: c.idadmon ? (dirPorIdadmon.get(c.idadmon) || null) : null,
          estado_contrato: estadoDA || null,
          idadmon_terminado: malo,
          idadmon_activo_sugerido: (malo || (activoSug && activoSug !== c.idadmon)) ? activoSug : null,
          problema,
        }
      })
      // prioridad de revisión: terminado > desactualizado > sin idadmon > sin comunidad > ok
      const peso = { idadmon_terminado: 0, idadmon_desactualizado: 1, sin_idadmon: 2, sin_comunidad: 3 }
      filas.sort((a, b) => (a.problema ? peso[a.problema] : 9) - (b.problema ? peso[b.problema] : 9))
      return J({ correspondencias: filas })
    }

    if (modo === 'sugerir') {
      const comunidad = searchParams.get('comunidad') || ''
      const inmueble = searchParams.get('inmueble') || ''
      if (!inmueble.trim()) return J({ candidatos: [] })
      return J({ candidatos: sugerir(comunidad, inmueble, maestro) })
    }

    if (modo === 'buscar') {
      const qtext = soloAlnum(searchParams.get('q') || '')
      if (qtext.length < 2) return J({ candidatos: [] })
      const res = maestro
        .filter((r) => esValidoEstado(r.estado))
        .filter((r) => soloAlnum(r.propietario).includes(qtext) || soloAlnum(r.inmueble).includes(qtext) || soloAlnum(r.idadmon).includes(qtext) || soloAlnum(r.idinmue).includes(qtext))
        .slice(0, 30)
        .map((r) => ({ idadmon: r.idadmon, idinmue: r.idinmue, propietario: r.propietario, inmueble: r.inmueble }))
      return J({ candidatos: res })
    }

    return J({ error: 'modo no reconocido' }, 400)
  } catch (e) {
    return J({ error: e.message }, 500)
  }
}

export async function POST(req) {
  let body
  try { body = await req.json() } catch { return J({ error: 'JSON inválido' }, 400) }
  const accion = body?.accion || 'guardar'

  try {
    if (accion === 'desactivar' || accion === 'activar') {
      if (!body.id) return J({ error: 'Falta id' }, 400)
      const { error } = await supabase.from('cf_correspondencias')
        .update({ activo: accion === 'activar', updated_at: new Date().toISOString() })
        .eq('id', body.id)
      if (error) return J({ error: error.message }, 500)
      return J({ ok: true })
    }

    const fila = {
      comunidad_cf: String(body.comunidad_cf || '').trim(),
      inmueble_cf: String(body.inmueble_cf || '').trim(),
      idadmon: String(body.idadmon || '').trim().toUpperCase() || null,
      idinmue: String(body.idinmue || '').trim() || null,
      estado: (String(body.estado || 'S').trim().toUpperCase()) || 'S',
      propietario: String(body.propietario || '').trim() || null,
      notas: body.notas != null ? String(body.notas).trim() : null,
      activo: body.activo !== false,
      updated_at: new Date().toISOString(),
    }
    if (!fila.comunidad_cf) return J({ error: 'Falta la Comunidad CF (es la que hace casar el dato con el portal).' }, 400)
    if (!fila.inmueble_cf) return J({ error: 'Falta el Inmueble CF (la unidad).' }, 400)
    if (!['S', 'P'].includes(fila.estado)) return J({ error: 'Estado inválido (S o P).' }, 400)
    // Guard: no admitir un idadmon cuyo contrato esté terminado/no válido (solo S/SQ/P).
    if (fila.idadmon) {
      const { data: da } = await supabase.from('datos_arriendos').select('estado').eq('idadmon', fila.idadmon).limit(1).maybeSingle()
      const est = da?.estado || ''
      if (est && !esValidoEstado(est)) {
        return J({ error: `El IDADMON ${fila.idadmon} tiene estado ${est} (terminado/no válido). Asigna el contrato activo (S, SQ o P) del inmueble.` }, 400)
      }
    }

    if (body.id) {
      const { data, error } = await supabase.from('cf_correspondencias').update(fila).eq('id', body.id).select('*').maybeSingle()
      if (error) return J({ error: error.message }, 500)
      return J({ ok: true, correspondencia: data })
    } else {
      const { data, error } = await supabase.from('cf_correspondencias').insert(fila).select('*').maybeSingle()
      if (error) return J({ error: error.message }, 500)
      return J({ ok: true, correspondencia: data })
    }
  } catch (e) {
    return J({ error: e.message }, 500)
  }
}
