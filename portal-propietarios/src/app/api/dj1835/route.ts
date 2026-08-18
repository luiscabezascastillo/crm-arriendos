// VERSION: v1 · 2026-08-18 · DJ 1835 del propietario (SII · bienes raices arrendados).
//   Lee la vista vw_dj1835 (misma que el CRM) filtrando por idprop de la sesion; devuelve las lineas
//   declarables por año + si el año esta congelado (declarado) desde dj1835_cargas.
// RUTA: portal-propietarios/src/app/api/dj1835/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const COLS = 'idadmon, anio, rol, comuna_nombre, rut_arrendatario, arrendatario, inmueble, monto_anual, meses_arrendados, ene, feb, mar, abr, may, jun, jul, ago, sep, oct, nov, dic'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const session = verifyToken(token)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // Lineas declarables del propietario (todas las de su idprop; nunca de otros)
    const { data: lineas, error } = await supabaseAdmin
      .from('vw_dj1835')
      .select(COLS)
      .eq('idprop', session.idprop)
      .eq('declarable', true)
      .order('anio', { ascending: false })
      .order('inmueble', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // ¿Que años estan congelados (ya declarados ante el SII)?
    const { data: cargas } = await supabaseAdmin
      .from('dj1835_cargas')
      .select('anio, congelado')
    const congeladoPorAnio: Record<string, boolean> = {}
    for (const c of (cargas || [])) congeladoPorAnio[String(c.anio)] = !!c.congelado

    return NextResponse.json({ lineas: lineas || [], congeladoPorAnio })
  } catch (err) {
    console.error('dj1835 error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
