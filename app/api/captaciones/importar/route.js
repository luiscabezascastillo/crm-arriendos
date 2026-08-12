// VERSION: v1 · 2026-08-12 · app/api/captaciones/importar/route.js — Importa dueños de `publicaciones` a Contactos
//   (a nombre de Alberto) + crea su fila en `captaciones`. POST { dryRun, limite }.
//   · dryRun:true (por defecto) → NO escribe: devuelve conteos + muestra de lo que entraría.
//   · dryRun:false → crea/actualiza contactos e inserta captaciones para hasta `limite` dueños NUEVOS (idempotente:
//     salta los que ya tienen captación, así se puede correr por tandas). Gate: Dirección + Administración.
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin.js'
import { agrupaLeads, normKey, splitNombre, soloDigitos, esNulo } from '../../../../lib/captacionImport.js'

const ALBERTO = 'alberto.cabezas@fondocapital.com'
const AUTORIZADOS = [ALBERTO, 'luis.cabezas@fondocapital.com', 'adalis@fondocapital.com', 'fabiola.guerra@fondocapital.com']
const HOY = () => new Date().toISOString().slice(0, 10)

async function traerTodo(tabla, cols, filtro) {
  const filas = []
  for (let desde = 0; desde < 20000; desde += 1000) {
    let q = supabaseAdmin.from(tabla).select(cols).range(desde, desde + 999)
    if (filtro) q = filtro(q)
    const { data, error } = await q
    if (error) throw new Error(tabla + ': ' + error.message)
    filas.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return filas
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!AUTORIZADOS.includes(email)) return Response.json({ error: 'Solo Dirección y Administración pueden importar captaciones.' }, { status: 403 })

  let body = {}
  try { body = await req.json() } catch { /* sin body = dry run */ }
  const dryRun = body?.dryRun !== false
  const limite = Math.min(Math.max(parseInt(body?.limite, 10) || 20, 1), 800)

  let leads, contactos, capExistentes
  try {
    const [publi, props, cts, caps] = await Promise.all([
      traerTodo('publicaciones', 'propietario, telefono, email, comuna, objetivo, idadmon', q => q.ilike('captador', 'alberto')),
      traerTodo('propietarios', 'propietario, telefono, rut, mail1, email_2, comuna, fecha_cumpleanos'),
      traerTodo('contactos', 'id, numero_doc, telefono, telefono_2, whatsapp, nombre, apellido, comercial_asignado'),
      traerTodo('captaciones', 'id, contacto_id'),
    ])
    const propByKey = new Map()
    for (const p of props) { const k = normKey(p.propietario); if (k && !propByKey.has(k)) propByKey.set(k, p) }
    leads = agrupaLeads(publi, propByKey)
    contactos = cts
    capExistentes = new Set((caps || []).map(c => c.contacto_id).filter(Boolean))
  } catch (e) {
    return Response.json({ error: 'Error leyendo datos: ' + String(e?.message || e) }, { status: 500 })
  }

  // Índices para no duplicar contactos: por RUT, por teléfono (dígitos) y por nombre (normKey de apellido+nombre).
  const porRut = new Map(), porTel = new Map(), porNombre = new Map()
  for (const c of contactos) {
    const rut = soloDigitos(c.numero_doc); if (rut) porRut.set(rut, c)
    for (const t of [c.whatsapp, c.telefono, c.telefono_2]) { const d = soloDigitos(t); if (d.length >= 8) porTel.set(d, c) }
    const nk = normKey(`${c.apellido || ''} ${c.nombre || ''}`); if (nk) porNombre.set(nk, c)
  }
  const matchContacto = (lead) => {
    const rut = soloDigitos(lead.rut); if (rut && porRut.has(rut)) return porRut.get(rut)
    const tel = soloDigitos(lead.telefono); if (tel && porTel.has(tel)) return porTel.get(tel)
    if (porNombre.has(lead.key)) return porNombre.get(lead.key)
    return null
  }

  const conTel = leads.filter(l => l.telefono).length
  const enrichProp = leads.filter(l => l.en_propietarios).length

  if (dryRun) {
    const muestra = leads.slice(0, limite).map(l => {
      const c = matchContacto(l)
      return { propietario: l.propietario, telefono: l.tel_display || (l.telefono ? l.telefono : '(sin tel)'), es_movil: l.es_movil, objetivo: l.objetivo, comuna: l.comuna, n_pub: l.n_publicaciones, administrado: l.administrado, rut: l.rut, ya_en_contactos: !!c }
    })
    return Response.json({
      ok: true, dryRun: true,
      total_duenos: leads.length, con_telefono: conTel, sin_telefono: leads.length - conTel,
      enriquecidos_desde_propietarios: enrichProp,
      ya_en_contactos: leads.filter(l => matchContacto(l)).length,
      muestra,
    })
  }

  // ── Escritura real (por tandas idempotentes) ──
  let creadosContactos = 0, usadosExistentes = 0, capsCreadas = 0, capsSaltadas = 0
  let procesados = 0
  for (const lead of leads) {
    if (procesados >= limite) break
    let contacto = matchContacto(lead)
    // Si ya tiene captación, saltar (idempotencia → la siguiente tanda coge los que faltan).
    if (contacto && capExistentes.has(contacto.id)) { capsSaltadas++; continue }

    if (!contacto) {
      const { nombre, apellido, esEmpresa } = splitNombre(lead.propietario)
      const nuevo = {
        tipo_doc: lead.rut ? 'RUT' : null, numero_doc: lead.rut || null,
        nombre: nombre || lead.propietario, apellido: apellido || null,
        email: lead.email || null, telefono: lead.telefono || null, whatsapp: lead.es_movil ? lead.telefono : null,
        comuna: lead.comuna || null, roles: ['propietario'], origen: 'publicaciones',
        comercial_asignado: ALBERTO, activo: true, empresa: esEmpresa ? lead.propietario : null,
        notas: `Captación · ${lead.n_publicaciones} publicación(es)${lead.administrado ? ' · administrado' : ''}. Importado de publicaciones.`,
        creado_por: email,
      }
      const ins = await supabaseAdmin.from('contactos').insert(nuevo).select('id').single()
      if (ins.error) { return Response.json({ error: 'Al crear contacto (' + lead.propietario + '): ' + ins.error.message, parcial: { creadosContactos, capsCreadas } }, { status: 500 }) }
      contacto = { id: ins.data.id }
      creadosContactos++
    } else {
      usadosExistentes++
      // Completar whatsapp/asignación si están vacíos, sin pisar lo que ya hay.
      const patch = {}
      if (esNulo(contacto.whatsapp) && lead.es_movil) patch.whatsapp = lead.telefono
      if (esNulo(contacto.comercial_asignado)) patch.comercial_asignado = ALBERTO
      if (Object.keys(patch).length) await supabaseAdmin.from('contactos').update(patch).eq('id', contacto.id)
    }

    const cap = {
      contacto_id: contacto.id, propietario: lead.propietario, telefono: lead.telefono || null,
      objetivo: lead.objetivo, comuna: lead.comuna || null, origen: 'publicaciones',
      n_publicaciones: lead.n_publicaciones, administrado: lead.administrado,
      estado: 'por_contactar', asignado_a: ALBERTO, proxima_gestion: HOY(),
    }
    const insCap = await supabaseAdmin.from('captaciones').insert(cap)
    if (insCap.error) { return Response.json({ error: 'Al crear captación (' + lead.propietario + '): ' + insCap.error.message, parcial: { creadosContactos, capsCreadas } }, { status: 500 }) }
    capExistentes.add(contacto.id); capsCreadas++; procesados++
  }

  const totalConCap = capExistentes.size
  return Response.json({
    ok: true, dryRun: false,
    contactos_creados: creadosContactos, contactos_existentes_usados: usadosExistentes,
    captaciones_creadas: capsCreadas, captaciones_saltadas_ya_existian: capsSaltadas,
    total_captaciones_ahora: totalConCap, restantes_aprox: Math.max(0, leads.length - totalConCap),
  })
}
