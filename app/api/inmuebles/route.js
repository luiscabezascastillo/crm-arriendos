// app/api/inmuebles/route.js
// VERSION: v1 · 2026-07-31 · Lectura de la tabla `inmuebles` por el SERVIDOR (service_role), para la
//   vista de consulta /cc1/inmuebles. Cada fila guarda su información en raw_data (jsonb, volcado del
//   Excel): la parseamos y devolvemos solo los campos que se usan (idinmue combinado, inmueble,
//   propietario, idprop, bodega, estac, rol). M2, ESTADO, KKK, Tipo, IdInmue se ignoran.
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Normaliza el ROL: en el Excel viene con espacios sueltos al principio o dobles entre códigos.
const limpiaRol = (r) => String(r ?? '').trim().replace(/\s+/g, ' ')

// ¿Es una combinación (agrupación de varias unidades)? Lleva espacio en el idinmue combinado.
const esCombinacion = (idc) => String(idc ?? '').trim().includes(' ')

export async function GET() {
  const PAGE = 1000
  let desde = 0
  let filas = []
  for (;;) {
    const { data, error } = await supabaseAdmin
      .from('inmuebles')
      .select('id, idinmue_combinado, raw_data')
      .order('idinmue_combinado', { ascending: true })
      .range(desde, desde + PAGE - 1)
    if (error) return NextResponse.json({ error: 'Error leyendo inmuebles: ' + error.message }, { status: 500 })
    filas = filas.concat(data || [])
    if (!data || data.length < PAGE) break
    desde += PAGE
  }

  // Parsear el raw_data de cada fila a un objeto plano con solo lo que se usa.
  const inmuebles = filas.map((f) => {
    let d = {}
    try { d = typeof f.raw_data === 'string' ? JSON.parse(f.raw_data) : (f.raw_data || {}) } catch { d = {} }
    const idc = f.idinmue_combinado || d['IDINMUE combinado'] || d.IdInmue || ''
    // El idprop son los 4 primeros caracteres del idinmue (P046-01 → P046).
    const idprop = (d.IdProp || '').trim() || String(idc).trim().slice(0, 4)
    return {
      id: f.id,
      idinmue: idc,
      inmueble: d.Inmueble || '',
      idprop,
      propietario: (d.Propietario || '').trim(),
      bodega: d.Bodega || '',
      estac: d.Estac || '',
      rol: limpiaRol(d.ROL),
      combinacion: esCombinacion(idc),
    }
  })

  // Mapa idprop → nombre, con las filas que SÍ traen propietario. Muchas combinaciones vienen sin
  // él en el Excel; se rellena por el prefijo (P046-01 y "P046-01 P046-51" comparten idprop P046).
  const nombrePorProp = {}
  for (const it of inmuebles) {
    if (it.propietario && it.idprop && !nombrePorProp[it.idprop]) nombrePorProp[it.idprop] = it.propietario
  }
  // Fallback: para los idprop que aún no tengan nombre, buscarlo en datos_arriendos.
  const sinNombre = [...new Set(inmuebles.filter(it => !nombrePorProp[it.idprop]).map(it => it.idprop))].filter(Boolean)
  if (sinNombre.length) {
    const { data: da } = await supabaseAdmin
      .from('datos_arriendos')
      .select('idprop, propietario')
      .in('idprop', sinNombre)
    for (const r of da || []) {
      const ip = String(r.idprop || '').trim()
      if (ip && r.propietario && !nombrePorProp[ip]) nombrePorProp[ip] = r.propietario
    }
  }
  // Rellenar el propietario en todas las filas.
  for (const it of inmuebles) {
    if (!it.propietario && nombrePorProp[it.idprop]) it.propietario = nombrePorProp[it.idprop]
  }

  return NextResponse.json({ ok: true, inmuebles })
}
