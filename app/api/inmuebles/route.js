// app/api/inmuebles/route.js
// VERSION: v3 · 2026-07-31 · Lee de las tablas NORMALIZADAS (inmuebles_norm + combinaciones_norm)
//   en vez del raw_data. Devuelve las unidades individuales y las agrupaciones juntas, con el
//   mismo formato que antes para no cambiar la pantalla (idinmue, inmueble, propietario, idprop,
//   bodega, estac, rol, combinacion).
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const limpiaRol = (r) => String(r ?? '').trim().replace(/\s+/g, ' ')

export async function GET() {
  // Unidades individuales
  const { data: unidades, error: e1 } = await supabaseAdmin
    .from('inmuebles_norm')
    .select('idinmue, idprop, tipo, inmueble, rol, propietario, bodega_ref, estac_ref')
    .order('idinmue', { ascending: true })
  if (e1) return NextResponse.json({ error: 'inmuebles_norm: ' + e1.message }, { status: 500 })

  // Agrupaciones
  const { data: combis, error: e2 } = await supabaseAdmin
    .from('combinaciones_norm')
    .select('idinmue_combinado, idprop, inmueble, rol, propietario')
    .order('idinmue_combinado', { ascending: true })
  if (e2) return NextResponse.json({ error: 'combinaciones_norm: ' + e2.message }, { status: 500 })

  const filasU = (unidades || []).map(u => ({
    idinmue: u.idinmue,
    inmueble: u.inmueble || '',
    idprop: u.idprop || '',
    propietario: u.propietario || '',
    bodega: u.bodega_ref || '',
    estac: u.estac_ref || '',
    rol: limpiaRol(u.rol),
    tipo: u.tipo || '',
    combinacion: false,
  }))

  const filasC = (combis || []).map(c => ({
    idinmue: c.idinmue_combinado,
    inmueble: c.inmueble || '',
    idprop: c.idprop || '',
    propietario: c.propietario || '',
    bodega: '',
    estac: '',
    rol: limpiaRol(c.rol),
    tipo: 'agrupacion',
    combinacion: true,
  }))

  return NextResponse.json({ ok: true, inmuebles: [...filasU, ...filasC] })
}
