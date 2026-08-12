// VERSION: v2 · 2026-08-12 · lib/captacionImport.js — normalizaTelefono estricto: extrae el 1er móvil si vienen varios pegados, exige 11 dígitos, y wa SOLO para móviles (fijos sin WhatsApp). Hereda v1.
// VERSION: v1 · 2026-08-12 · lib/captacionImport.js — Utilidades de importación de captaciones desde `publicaciones`.
//   Normaliza teléfonos chilenos a +56…, agrupa por dueño (tolerante al orden "Apellido, Nombre" vs "Nombre
//   Apellido"), consolida teléfono/email/comuna/objetivo y enriquece desde `propietarios`. Sin efectos: solo transforma.

export function soloDigitos(s) { return String(s ?? '').replace(/\D/g, '') }
export const esNulo = v => { const s = String(v ?? '').trim().toLowerCase(); return s === '' || s === 'null' }

// Teléfono chileno -> { valido, e164, wa (dígitos, SOLO si es móvil), esMovil, display }.
// Un número chileno normalizado tiene 11 dígitos (56 + 9). Si viene basura (varios números pegados),
// se extrae el PRIMER móvil; si no se puede cuadrar a 11 dígitos, se marca inválido (mejor "falta tel").
export function normalizaTelefono(raw) {
  let n = soloDigitos(raw)
  if (!n) return { valido: false }
  if (n.startsWith('00')) n = n.slice(2)
  if (n.length > 11) { const m = n.match(/(?:56)?9\d{8}/); if (m) n = m[0]; else return { valido: false } } // varios números pegados → primer móvil
  if (n.length === 9 && n.startsWith('9')) n = '56' + n
  else if (n.length === 8) n = '569' + n
  else if (n.length === 10 && n.startsWith('56')) n = '569' + n.slice(2)
  else if (n.length === 9 && !n.startsWith('9')) n = '56' + n
  if (n.length !== 11 || !n.startsWith('56')) return { valido: false }          // no cuadra como número chileno
  const esMovil = n.startsWith('569')
  return {
    valido: true, e164: '+' + n, wa: esMovil ? n : '', esMovil,                 // wa (WhatsApp) SOLO para móviles
    display: esMovil ? `+56 9 ${n.slice(3, 7)} ${n.slice(7)}` : '+' + n,
  }
}

// Clave de persona tolerante a orden y comas: tokens normalizados y ORDENADOS.
export function normKey(s) {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).sort().join(' ')
}

const RE_EMPRESA = /(ltda|limitada|spa|s\.?a\.?|inmobiliaria|inversiones|e\.?i\.?r\.?l|eirl|comercial|constructora|sociedad|fondo|capital)/i
export function splitNombre(full) {
  const s = String(full ?? '').trim()
  if (RE_EMPRESA.test(s)) return { nombre: s, apellido: '', esEmpresa: true }
  if (s.includes(',')) { const [ape, nom] = s.split(',', 2); return { nombre: (nom || '').trim(), apellido: (ape || '').trim(), esEmpresa: false } }
  const parts = s.split(/\s+/)
  if (parts.length >= 2) return { nombre: parts.slice(0, -1).join(' '), apellido: parts.slice(-1)[0], esEmpresa: false }
  return { nombre: s, apellido: '', esEmpresa: false }
}

// Agrupa las filas de publicaciones por dueño y consolida. propByKey = Map(normKey -> fila de propietarios).
export function agrupaLeads(publicaciones, propByKey) {
  const map = new Map()
  for (const p of (publicaciones || [])) {
    const full = String(p.propietario ?? '').trim()
    if (esNulo(full)) continue
    const key = normKey(full)
    if (!key) continue
    let g = map.get(key)
    if (!g) { g = { key, propietario: full, telefonos: [], emails: [], comunas: [], objetivos: new Set(), n: 0, administrado: false }; map.set(key, g) }
    g.n++
    const t = normalizaTelefono(p.telefono); if (t.valido) g.telefonos.push(t.e164)
    if (!esNulo(p.email) && /@/.test(p.email)) g.emails.push(String(p.email).trim())
    if (!esNulo(p.comuna)) g.comunas.push(String(p.comuna).trim())
    const o = String(p.objetivo ?? '').toLowerCase()
    if (o.includes('arr')) g.objetivos.add('arriendo'); else if (o.includes('vent') || o.includes('vta')) g.objetivos.add('venta')
    if (!esNulo(p.idadmon)) g.administrado = true
  }
  const primero = arr => arr.find(Boolean) || null
  const leads = []
  for (const [key, g] of map) {
    const prop = propByKey.get(key) || null
    let telE164 = primero(g.telefonos)
    if (!telE164 && prop) { const t = normalizaTelefono(prop.telefono); if (t.valido) telE164 = t.e164 }
    const email = primero(g.emails) || (prop ? (!esNulo(prop.mail1) ? prop.mail1 : (!esNulo(prop.email_2) ? prop.email_2 : null)) : null) || null
    const comuna = (prop && !esNulo(prop.comuna) ? prop.comuna : null) || primero(g.comunas) || null
    const objetivo = g.objetivos.size >= 2 ? 'ambos' : ([...g.objetivos][0] || 'arriendo')
    const tn = telE164 ? normalizaTelefono(telE164) : { valido: false }
    leads.push({
      key, propietario: g.propietario,
      telefono: telE164, tel_display: tn.valido ? tn.display : null, wa: tn.valido ? tn.wa : null, es_movil: !!tn.esMovil,
      email, comuna, objetivo, n_publicaciones: g.n, administrado: g.administrado,
      rut: prop && !esNulo(prop.rut) ? String(prop.rut).trim() : null,
      fecha_cumpleanos: prop && !esNulo(prop.fecha_cumpleanos) ? String(prop.fecha_cumpleanos).trim() : null,
      en_propietarios: !!prop,
    })
  }
  // orden: primero los que tienen teléfono, luego por nº de publicaciones desc
  leads.sort((a, b) => (b.telefono ? 1 : 0) - (a.telefono ? 1 : 0) || b.n_publicaciones - a.n_publicaciones)
  return leads
}
