// app/api/cc1/pendientes/route.js
//
// GET -> { capacidades, pendientes }
//   capacidades: qué puede hacer el usuario actual (para mostrar/ocultar botones)
//   pendientes:  altas con pendiente_aprobacion = true (para la bandeja de Anthony)

import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { supabaseAdmin, getCapacidades } from '../../../../lib/cc1Permisos'

export async function GET() {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })

  const cap = await getCapacidades(email)

  let pendientes = []
  if (cap.puedeAprobar) {
    const { data } = await supabaseAdmin
      .from('datos_arriendos')
      .select('idadmon, estado, propietario, inmueble, creado_por, fecha')
      .eq('pendiente_aprobacion', true)
      .order('idadmon', { ascending: false })
    pendientes = data || []
  }

  return Response.json({ capacidades: cap, pendientes })
}
