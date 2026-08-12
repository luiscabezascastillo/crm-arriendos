// VERSION: v1 · 2026-08-12 · app/api/bb1/listar/route.js — Listado BB1 (VENTAS · corretaje sin administración).
//   Clonado de BB2: lee la tabla `log` con id_lcc 'V%' y devuelve las filas mapeadas desde `raw_data` (fuente de
//   verdad; las columnas promovidas están desalineadas). Reusa el mismo motor `lib/bb2Log.js`. Solo LECTURA.
//   Gate ESTRICTO: Dirección + Anthony (Legal), como en BB2 durante la construcción.
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin.js'
import { mapFilaLista } from '../../../../lib/bb2Log.js'

const AUTORIZADOS = [
  'alberto.cabezas@fondocapital.com',
  'luis.cabezas@fondocapital.com',
  'anthony.mendoza@fondocapital.com',
]

export async function GET() {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!AUTORIZADOS.includes(email)) {
    return Response.json({ error: 'Solo Dirección y Anthony pueden ver BB1.' }, { status: 403 })
  }

  // Ventas = filas del LOG cuyo id_lcc empieza por 'V'. Columnas promovidas solo como fallback; el contenido real
  // sale de raw_data en mapFilaLista.
  const { data, error } = await supabaseAdmin
    .from('log')
    .select('id, id_lcc, tipo, ejecutivo_venta, inmueble, fecha_registro, fecha_start_promesa, dueno_vendedor, arrendatario_comprador, raw_data')
    .ilike('id_lcc', 'V%')
    .limit(2000)
  if (error) return Response.json({ error: 'Error leyendo el LOG: ' + error.message }, { status: 500 })

  const rows = (data || []).map(mapFilaLista)
  // Orden por Id descendente (V00604 > V00580 …) de forma natural.
  rows.sort((a, b) => String(b.id).localeCompare(String(a.id), 'es', { numeric: true }))
  return Response.json({ ok: true, total: rows.length, rows })
}
