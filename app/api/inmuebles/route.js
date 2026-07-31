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
    return {
      id: f.id,
      idinmue: idc,
      inmueble: d.Inmueble || '',
      idprop: d.IdProp || '',
      propietario: d.Propietario || '',
      bodega: d.Bodega || '',
      estac: d.Estac || '',
      rol: limpiaRol(d.ROL),
      combinacion: esCombinacion(idc),
    }
  })

  return NextResponse.json({ ok: true, inmuebles })
}
