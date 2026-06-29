import { NextResponse } from 'next/server'
import { plantillaArriendo, asuntoArriendo } from '@/lib/notifPlantilla'

// Devuelve el HTML del recordatorio SIN enviar nada (vista previa / "display").
// Usa la misma plantilla que el envío real → lo que se ve es lo que se manda.
export async function POST(request) {
  try {
    const { mes, mesLabel, valorUf, notificacion } = await request.json()
    if (!notificacion) {
      return NextResponse.json({ error: 'Falta la notificación a previsualizar' }, { status: 400 })
    }
    const html = plantillaArriendo(notificacion, { mes, mesLabel, valorUf })
    const asunto = asuntoArriendo(mesLabel)
    return NextResponse.json({ asunto, html })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
