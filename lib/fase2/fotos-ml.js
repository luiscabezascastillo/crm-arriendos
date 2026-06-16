// ───────────────────────────────────────────────────────────────────────────
// Módulo de gestión de fotos en Mercado Libre (Portal Inmobiliario) — FASE 2
// ───────────────────────────────────────────────────────────────────────────
// Cubre los casos de cambio de fotos en una publicación YA activa en ML:
//
//   Caso 1/2  reordenar / cambiar portada con fotos existentes  -> reordenarFotos()
//   Caso 3    añadir foto nueva que NO es portada               -> anadirFotoNoPortada()
//   Caso 4    añadir foto nueva que SÍ es portada (2 pasos)     -> anadirFotoPortada()
//
// Todas reciben:
//   { token, codigoPi, fotosActuales, mapa, baseUrl }
//     token         : access token de ML ya válido
//     codigoPi      : MLCxx␣ del item
//     fotosActuales : array de nombres de archivo en el orden deseado (imagen1..N)
//     mapa          : objeto { nombreArchivo: ml_id } de las fotos ya conocidas
//     baseUrl       : prefijo de URL pública de las fotos (fondocapital)
//
// Devuelven un objeto resultado:
//   { ok, mensaje, nuevaFotosMl?, error?, verificado? }
//   nuevaFotosMl : array [{imagen, ml_id}] en el nuevo orden, listo para guardar
//
// IMPORTANTE: ML cachea las fotos por nombre de archivo (source). Si se reemplaza
// una foto manteniendo el mismo nombre, ML NO la actualiza. Eso es responsabilidad
// del flujo que sube las fotos a fondocapital, no de este módulo.
// ───────────────────────────────────────────────────────────────────────────

const ML_API = 'https://api.mercadolibre.com'

function urlDe(nombre, baseUrl) {
  return `${baseUrl}${nombre}`
}

// Lee las pictures actuales del item en ML (array de {id} en orden).
async function leerPicturesML(token, codigoPi) {
  const res = await fetch(`${ML_API}/items/${codigoPi}?attributes=pictures`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
  })
  if (res.status !== 200) return null
  const item = await res.json()
  return (item.pictures || []).map(p => p.id)
}

// PUT genérico de pictures. `pictures` es un array de {id} y/o {source}.
async function putPictures(token, codigoPi, pictures) {
  const res = await fetch(`${ML_API}/items/${codigoPi}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ pictures }),
  })
  let json = null
  try { json = await res.json() } catch (e) { json = null }
  return { status: res.status, json }
}

// ── CASO 1/2: reordenar / cambiar portada con fotos EXISTENTES ──────────────
// Todas las fotos actuales están en `mapa`. Mandamos sus ml_id en el nuevo orden.
export async function reordenarFotos({ token, codigoPi, fotosActuales, mapa }) {
  const picturesPut = fotosActuales.map(n => ({ id: mapa[n] }))
  const { status, json } = await putPictures(token, codigoPi, picturesPut)
  if (status !== 200) {
    return { ok: false, error: `${status}: ${json?.message || JSON.stringify(json)}` }
  }
  // Verificar releyendo
  let verificado = true
  const idsEnML = await leerPicturesML(token, codigoPi)
  if (idsEnML) {
    const esperados = picturesPut.map(p => p.id)
    verificado = idsEnML.length === esperados.length && idsEnML.every((id, i) => id === esperados[i])
  }
  const nuevaFotosMl = fotosActuales.map(n => ({ imagen: n, ml_id: mapa[n] }))
  return {
    ok: true,
    verificado,
    nuevaFotosMl,
    mensaje: verificado
      ? 'Fotos reordenadas correctamente en Portal Inmobiliario.'
      : 'Fotos reordenadas (ML respondió OK, pero la verificación del orden no coincidió exactamente; revisar).',
  }
}

// ── CASO 3: añadir foto(s) nueva(s) que NO incluyen la portada ──────────────
// La portada (posición 0) es una foto existente -> va con id, no se re-descarga.
// Las nuevas van con source en su posición. Un solo PUT con el array mezclado.
export async function anadirFotoNoPortada({ token, codigoPi, fotosActuales, mapa, baseUrl }) {
  // Construir array mezclado en el orden actual
  const picturesPut = fotosActuales.map(n =>
    mapa[n] ? { id: mapa[n] } : { source: urlDe(n, baseUrl) }
  )
  // Seguridad: la portada (índice 0) DEBE ser existente (id), nunca source
  if (!mapa[fotosActuales[0]]) {
    return { ok: false, error: 'La portada es una foto nueva; este caso corresponde a anadirFotoPortada().' }
  }
  const { status, json } = await putPictures(token, codigoPi, picturesPut)
  if (status !== 200) {
    return { ok: false, error: `${status}: ${json?.message || JSON.stringify(json)}` }
  }
  // Releer ML para capturar los id que asignó a las fotos nuevas (por posición).
  const idsEnML = await leerPicturesML(token, codigoPi)
  if (!idsEnML || idsEnML.length !== fotosActuales.length) {
    // El PUT fue 200 pero la relectura no cuadra en cantidad: guardamos lo que se pueda
    return {
      ok: true,
      verificado: false,
      nuevaFotosMl: null,
      mensaje: 'Foto(s) añadida(s) (ML respondió OK), pero no se pudo reconstruir el mapeo con certeza; se recomienda revisar con diag-fotos.',
    }
  }
  // Emparejar por posición: cada nombre actual -> id en esa posición de ML
  const nuevaFotosMl = fotosActuales.map((n, i) => ({ imagen: n, ml_id: idsEnML[i] }))
  return {
    ok: true,
    verificado: true,
    nuevaFotosMl,
    mensaje: 'Foto(s) nueva(s) añadida(s) correctamente en Portal Inmobiliario.',
  }
}

// ── CASO 4: añadir foto nueva que SÍ es la portada (proceso en 2 PASOS) ──────
// Paso A: PUT con las existentes (id) en su orden + la nueva al FINAL (source).
//         Así la portada actual no se toca todavía.
// Paso B: releer ML, identificar el id de la nueva por DOBLE comprobación
//         (no estaba en `mapa` Y es la última posición), y segundo PUT
//         colocándola en posición 1 (portada) + el resto en el orden deseado.
export async function anadirFotoPortada({ token, codigoPi, fotosActuales, mapa, baseUrl }) {
  const nombrePortadaNueva = fotosActuales[0]
  if (mapa[nombrePortadaNueva]) {
    return { ok: false, error: 'La portada ya existe; este caso corresponde a reordenarFotos().' }
  }

  // ids de ML conocidos antes del cambio (para descarte en paso B)
  const idsConocidos = new Set(Object.values(mapa))

  // --- PASO A: existentes en su orden (sin la portada nueva) + nueva al final ---
  const existentesEnOrden = fotosActuales.filter(n => mapa[n]).map(n => ({ id: mapa[n] }))
  const pasoA = [...existentesEnOrden, { source: urlDe(nombrePortadaNueva, baseUrl) }]
  const r1 = await putPictures(token, codigoPi, pasoA)
  if (r1.status !== 200) {
    return { ok: false, error: `Paso A falló: ${r1.status}: ${r1.json?.message || JSON.stringify(r1.json)}` }
  }

  // Releer para capturar el id de la foto nueva
  const idsTrasA = await leerPicturesML(token, codigoPi)
  if (!idsTrasA || idsTrasA.length !== pasoA.length) {
    return {
      ok: false,
      error: 'Paso A: ML respondió OK pero la relectura no coincide en cantidad; no se puede identificar la foto nueva con seguridad. Revisar con diag-fotos.',
    }
  }
  // DOBLE COMPROBACIÓN: la nueva es (a) la última posición y (b) un id no conocido
  const idUltima = idsTrasA[idsTrasA.length - 1]
  const noConocidos = idsTrasA.filter(id => !idsConocidos.has(id))
  const idNuevaPorDescarte = noConocidos.length === 1 ? noConocidos[0] : null
  if (!idNuevaPorDescarte || idNuevaPorDescarte !== idUltima) {
    return {
      ok: false,
      error: 'Paso A: no se pudo identificar la foto nueva sin ambigüedad (la última posición y el descarte no coinciden). No se cambia la portada para no arriesgar. Revisar con diag-fotos.',
    }
  }
  const idPortadaNueva = idUltima

  // Mapa nombre->id COMPLETO ahora (las viejas + la nueva)
  const mapaCompleto = { ...mapa, [nombrePortadaNueva]: idPortadaNueva }

  // --- PASO B: poner todo en el orden deseado (portada nueva en posición 1) ---
  const pasoB = fotosActuales.map(n => ({ id: mapaCompleto[n] }))
  const r2 = await putPictures(token, codigoPi, pasoB)
  if (r2.status !== 200) {
    return {
      ok: false,
      error: `Paso B falló: ${r2.status}: ${r2.json?.message || JSON.stringify(r2.json)}. La foto nueva se subió pero quedó al final; la portada no cambió.`,
    }
  }
  // Verificar orden final
  let verificado = true
  const idsFinal = await leerPicturesML(token, codigoPi)
  if (idsFinal) {
    const esperados = pasoB.map(p => p.id)
    verificado = idsFinal.length === esperados.length && idsFinal.every((id, i) => id === esperados[i])
  }
  const nuevaFotosMl = fotosActuales.map(n => ({ imagen: n, ml_id: mapaCompleto[n] }))
  return {
    ok: true,
    verificado,
    nuevaFotosMl,
    mensaje: verificado
      ? 'Portada nueva subida y colocada correctamente en Portal Inmobiliario.'
      : 'Portada nueva subida (ML respondió OK, pero la verificación del orden final no coincidió exactamente; revisar).',
  }
}

// ── ORQUESTADOR: decide el caso y delega ────────────────────────────────────
// Devuelve además `caso` para que el llamante sepa qué pasó.
export async function sincronizarFotos({ token, codigoPi, fotosActuales, fotosMl, baseUrl }) {
  // Sin mapeo fiable -> no tocar (publicación antigua: hay que republicar una vez)
  if (!Array.isArray(fotosMl) || fotosMl.length === 0) {
    return {
      ok: false, caso: 'sin-mapeo', sinMapeo: true,
      mensaje: 'Las fotos cambiaron, pero esta publicación no tiene el mapeo de fotos de ML (fotos_ml). Para sincronizar fotos, republícala una vez. Los demás cambios sí se aplicaron.',
    }
  }
  const mapa = {}
  for (const f of fotosMl) {
    if (f && f.imagen && f.ml_id) mapa[f.imagen] = f.ml_id
  }
  if (fotosActuales.length === 0) {
    return { ok: false, caso: 'sin-fotos', error: 'No hay fotos en la publicación.' }
  }
  const nuevas = fotosActuales.filter(n => !mapa[n])
  const portadaEsNueva = !mapa[fotosActuales[0]]

  if (nuevas.length === 0) {
    // Caso 1/2
    const r = await reordenarFotos({ token, codigoPi, fotosActuales, mapa })
    return { ...r, caso: 'reordenar' }
  }
  if (!portadaEsNueva) {
    // Caso 3
    const r = await anadirFotoNoPortada({ token, codigoPi, fotosActuales, mapa, baseUrl })
    return { ...r, caso: 'foto-nueva-no-portada' }
  }
  // Caso 4
  const r = await anadirFotoPortada({ token, codigoPi, fotosActuales, mapa, baseUrl })
  return { ...r, caso: 'foto-nueva-portada' }
}
