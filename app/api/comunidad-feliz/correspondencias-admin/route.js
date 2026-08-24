// VERSION: v1 · 2026-08-24 · Admin de cf_correspondencias para /op/comunidad-feliz/correspondencias.
//   GET  ?modo=lista            → correspondencias enriquecidas con datos_arriendos (direccion/propietario).
//   GET  ?modo=sugerir&comunidad=&inmueble= → candidatos del maestro por nº de unidad (dep/est/bod).
//   GET  ?modo=buscar&q=        → busqueda libre en el maestro (propietario/direccion/idadmon).
//   POST {accion:'guardar'|'desactivar'|'activar', ...} → alta/edicion por id, o baja/alta logica.
//   NOTA seguridad: como el resto del circuito CF, usa service-role y NO valida sesion/rol (control solo en UI).
// app/api/comunidad-feliz/correspondencias-admin/route.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const J = (o, s = 200) => Response.json(o, { status: s })
const soloAlnum = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

// tokens "de nombre" (>=4 chars) para medir solape calle/comunidad
function tokensNombre(s) {
  return String(s || '').toLowerCase()
    .replace(/comunidad|edificio|condominio|proyecto|torre/g, ' ')
    .split(/[^a-z0-9]+/).filter((t) => t.length >= 4)
}

// extrae numeros de dep/est/bod de una direccion tipo "Calle 12- dep 507- est 12- bod 3"
function unidadesDireccion(inm) {
  const t = String(inm || '').toLowerCase()
  const grab = (re) => { const out = []; let m; while ((m = re.exec(t))) out.push(soloAlnum(m[1])); return out }
  return {
    dep: grab(/dep\s*([0-9]+\s*[a-z]?)/g),
    est: grab(/est\s*([0-9]+\s*[a-z]?)/g),
    bod: grab(/bod\s*([0-9]+\s*[a-z]?)/g),
  }
}

// normaliza el inmueble_cf a su nº de unidad: "Departamento 507"->507, "2208-B"->2208b, "D508"->508
function unidadCF(s) {
  let t = soloAlnum(s)
  t = t.replace(/^(departamento|depto|dep|estacionamiento|estac|est|bodega|bod)/, '')
  t = t.replace(/^[a-z]+(?=[0-9])/, '') // "d508"->"508", "td4086"->"4086"
  return t
}

// dedup del maestro por idadmon+idinmue
async function cargarMaestro() {
  const { data, error } = await supabase
    .from('datos_arriendos')
    .select('idadmon, idinmue, propietario, inmueble')
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

function sugerir(comunidad_cf, inmueble_cf, maestro) {
  const u = unidadCF(inmueble_cf)
  if (!u) return []
  const toksCom = tokensNombre(comunidad_cf)
  const cands = []
  for (const r of maestro) {
    const { dep, est, bod } = unidadesDireccion(r.inmueble)
    let tipo = null, base = 0
    if (dep.includes(u)) { tipo = 'dep'; base = 0.75 }
    else if (est.includes(u)) { tipo = 'est'; base = 0.55 }
    else if (bod.includes(u)) { tipo = 'bod'; base = 0.55 }
    if (!tipo) continue
    const overlap = toksCom.length ? tokensNombre(r.inmueble).some((t) => toksCom.includes(t)) : false
    const score = Math.min(0.98, base + (overlap ? 0.2 : 0))
    cands.push({
      idadmon: r.idadmon, idinmue: r.idinmue, propietario: r.propietario, inmueble: r.inmueble,
      score, motivo: tipo + (overlap ? '+nombre' : ''),
    })
  }
  cands.sort((a, b) => b.score - a.score)
  return cands.slice(0, 6)
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const modo = searchParams.get('modo') || 'lista'

    if (modo === 'lista') {
      const soloActivas = searchParams.get('todas') !== '1'
      let q = supabase.from('cf_correspondencias')
        .select('id, comunidad_cf, inmueble_cf, idadmon, idinmue, estado, propietario, activo, notas, updated_at')
        .order('comunidad_cf', { ascending: true }).limit(10000)
      if (soloActivas) q = q.eq('activo', true)
      const { data, error } = await q
      if (error) return J({ error: error.message }, 500)

      // enriquecer con la direccion del maestro (por idadmon)
      const maestro = await cargarMaestro()
      const mapDir = new Map()
      for (const r of maestro) if (r.idadmon && !mapDir.has(r.idadmon)) mapDir.set(r.idadmon, r.inmueble)

      const filas = (data || []).map((c) => ({
        ...c,
        direccion_maestro: c.idadmon ? (mapDir.get(c.idadmon) || null) : null,
        problema: !c.comunidad_cf?.trim() ? 'sin_comunidad' : (!c.idadmon ? 'sin_idadmon' : null),
      }))
      // primero las problematicas
      filas.sort((a, b) => (a.problema ? 0 : 1) - (b.problema ? 0 : 1))
      return J({ correspondencias: filas })
    }

    if (modo === 'sugerir') {
      const comunidad = searchParams.get('comunidad') || ''
      const inmueble = searchParams.get('inmueble') || ''
      if (!inmueble.trim()) return J({ candidatos: [] })
      const maestro = await cargarMaestro()
      return J({ candidatos: sugerir(comunidad, inmueble, maestro) })
    }

    if (modo === 'buscar') {
      const qtext = soloAlnum(searchParams.get('q') || '')
      if (qtext.length < 2) return J({ candidatos: [] })
      const maestro = await cargarMaestro()
      const res = maestro.filter((r) =>
        soloAlnum(r.propietario).includes(qtext) ||
        soloAlnum(r.inmueble).includes(qtext) ||
        soloAlnum(r.idadmon).includes(qtext) ||
        soloAlnum(r.idinmue).includes(qtext)
      ).slice(0, 30).map((r) => ({ idadmon: r.idadmon, idinmue: r.idinmue, propietario: r.propietario, inmueble: r.inmueble }))
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

    // guardar (alta o edicion por id)
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
