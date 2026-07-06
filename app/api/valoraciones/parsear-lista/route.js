// app/api/valoraciones/parsear-lista/route.js
// Recibe el texto pegado de una PÁGINA DE LISTADO de Portal Inmobiliario y
// devuelve todos los comparables detectados, listos para agregar como testigos.

import { NextResponse } from 'next/server'
import { parsearListado } from '../../../../lib/parsearAviso'

export async function POST(request) {
  try {
    const { contenido } = await request.json().catch(() => ({}))
    if (!contenido || String(contenido).length < 20) {
      return NextResponse.json({ error: 'Pega el texto del listado de Portal Inmobiliario.' }, { status: 400 })
    }
    const items = parsearListado(contenido)
    if (!items.length) {
      return NextResponse.json({ error: 'No detecté comparables. ¿Pegaste el listado (no un aviso individual)?' }, { status: 400 })
    }
    return NextResponse.json({ ok: true, total: items.length, items })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
