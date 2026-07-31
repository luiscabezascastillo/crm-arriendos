// app/api/inmuebles/agrupacion/route.js
// VERSION: v1 · 2026-07-31 · Crear una AGRUPACIÓN nueva (dep + bod/est) en combinaciones_norm.
//   GET  ?idprop=P046 → unidades individuales de ese propietario (de inmuebles_norm) para marcar.
//   POST { idprop, unidades:[idinmue...], creado_por } → compone idinmue+texto+rol (orden
//         dep→bod→est) y la guarda. Rechaza si la agrupación ya existe.
//   Permiso: se valida en el cliente (supervisor/Dirección/Anthony); aquí se usa service_role.
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Tipo y orden por el rango del número: dep(01-49)→0, bod(51-79)→1, est(81-99)→2.
function tipoOrden(idinmue) {
  const n = parseInt(String(idinmue).split('-')[1], 10)
  if (n >= 1 && n <= 49) return { tipo: 'dep', orden: 0, n }
  if (n >= 51 && n <= 79) return { tipo: 'bod', orden: 1, n }
  if (n >= 81 && n <= 99) return { tipo: 'est', orden: 2, n }
  return { tipo: 'otro', orden: 9, n: n || 999 }
}

// De "Blanco Garces 154- dep 3109B" → { base: "Blanco Garces 154", parte: "dep 3109B" }
function extraerParte(texto) {
  const m = String(texto || '').match(/^(.*?)-\s*(dep|bod|est)\s+(.+)$/i)
  if (m) return { base: m[1].trim(), parte: `${m[2].toLowerCase()} ${m[3].trim()}` }
  return { base: String(texto || '').trim(), parte: '' }
}

// Compone idinmue, texto y rol de una lista de unidades, en orden dep→bod→est.
function componer(unidades) {
  const ord = [...unidades].sort((a, b) => {
    const ta = tipoOrden(a.idinmue), tb = tipoOrden(b.idinmue)
    return ta.orden - tb.orden || ta.n - tb.n
  })
  const idinmue = ord.map(u => u.idinmue).join(' ')
  let base = ''
  const partes = []
  for (const u of ord) {
    const { base: b, parte } = extraerParte(u.inmueble)
    if (!base) base = b
    if (parte) partes.push(parte)
  }
  const texto = base + partes.map(p => `- ${p}`).join('')
  const rol = ord.map(u => (u.rol || '').trim()).filter(Boolean).join(' ')
  return { idinmue, texto, rol, ordenadas: ord }
}

export async function GET(request) {
  const idprop = new URL(request.url).searchParams.get('idprop')
  if (!idprop) return NextResponse.json({ error: 'Falta idprop' }, { status: 400 })
  const { data, error } = await supabaseAdmin
    .from('inmuebles_norm')
    .select('idinmue, idprop, tipo, inmueble, rol, propietario')
    .eq('idprop', idprop.trim())
    .order('idinmue', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, unidades: data || [] })
}

export async function POST(request) {
  try {
    const { idprop, unidades, creado_por } = await request.json()
    if (!idprop || !Array.isArray(unidades) || unidades.length < 2) {
      return NextResponse.json({ error: 'Una agrupación necesita al menos 2 unidades.' }, { status: 400 })
    }

    // Traer los datos reales de esas unidades desde inmuebles_norm.
    const { data: filas, error: e1 } = await supabaseAdmin
      .from('inmuebles_norm')
      .select('idinmue, idprop, inmueble, rol')
      .in('idinmue', unidades)
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
    if (!filas || filas.length !== unidades.length) {
      return NextResponse.json({ error: 'Alguna unidad no existe en inmuebles_norm.' }, { status: 400 })
    }
    // Todas deben ser del mismo propietario.
    if (filas.some(f => String(f.idprop).trim() !== String(idprop).trim())) {
      return NextResponse.json({ error: 'Todas las unidades deben ser del mismo propietario.' }, { status: 400 })
    }
    // Debe haber exactamente un departamento (rango 01-49).
    const deptos = filas.filter(f => tipoOrden(f.idinmue).tipo === 'dep')
    if (deptos.length !== 1) {
      return NextResponse.json({ error: 'La agrupación debe tener exactamente un departamento (dep).' }, { status: 400 })
    }

    const { idinmue, texto, rol } = componer(filas)

    // ¿Ya existe?
    const { data: ya } = await supabaseAdmin
      .from('combinaciones_norm').select('idinmue_combinado').eq('idinmue_combinado', idinmue).maybeSingle()
    if (ya) return NextResponse.json({ error: 'Esa agrupación ya existe: ' + idinmue }, { status: 409 })

    const propietario = filas.find(f => (f.propietario || '').trim())?.propietario || null
    const { error: e2 } = await supabaseAdmin.from('combinaciones_norm').insert({
      idinmue_combinado: idinmue,
      idprop: String(idprop).trim(),
      unidades: [...filas].sort((a, b) => tipoOrden(a.idinmue).orden - tipoOrden(b.idinmue).orden || tipoOrden(a.idinmue).n - tipoOrden(b.idinmue).n).map(f => f.idinmue),
      inmueble: texto,
      rol,
      propietario,
      creado_por: creado_por || null,
    })
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })

    return NextResponse.json({ ok: true, idinmue_combinado: idinmue, inmueble: texto, rol })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
