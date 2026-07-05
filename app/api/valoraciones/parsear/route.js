// app/api/valoraciones/parsear/route.js
// Recibe el contenido pegado de un aviso y devuelve los campos extraídos
// para pre-llenar un testigo. No guarda nada; solo parsea.

import { NextResponse } from 'next/server'
import { parsearAviso } from '../../../../lib/parsearAviso'

export async function POST(request) {
  try {
    const { contenido } = await request.json().catch(() => ({}))
    if (!contenido || String(contenido).length < 20) {
      return NextResponse.json({ error: 'Pega el contenido del aviso (texto o código fuente).' }, { status: 400 })
    }
    const r = parsearAviso(contenido)
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
