import { NextResponse } from 'next/server'
import { registrarBitacora } from '@/lib/bitacora'
import { getServerSession } from 'next-auth'

export async function POST(request) {
  try {
    const session = await getServerSession()
    const usuario = session?.user?.name || session?.user?.email || null

    const { idpublicacion, codigo, detalle } = await request.json()

    if (!idpublicacion) {
      return NextResponse.json({ error: 'Falta idpublicacion' }, { status: 400 })
    }
    if (!detalle || !String(detalle).trim()) {
      return NextResponse.json({ error: 'Sin cambios que registrar' }, { status: 400 })
    }

    await registrarBitacora({
      idpublicacion,
      codigo: codigo || null,
      evento: 'editar',
      detalle: String(detalle),
      usuario,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error bitacora/editar:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
