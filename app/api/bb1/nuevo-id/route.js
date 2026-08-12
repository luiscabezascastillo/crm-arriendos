// VERSION: v1 · 2026-08-12 · app/api/bb1/nuevo-id/route.js — Siguiente Id de VENTA disponible, formato V00xxx.
//   Toma el máximo entre el LOG (id_lcc 'V%') y el catálogo `idventa` (Ids precreados en el Excel VBA), para NO
//   reutilizar un V histórico que aún no esté volcado al LOG. GET. Gate: Dirección + Anthony. No escribe nada.
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin.js'

const AUTORIZADOS = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'anthony.mendoza@fondocapital.com']
const numDe = s => { const n = parseInt(String(s || '').replace(/\D/g, ''), 10); return isNaN(n) ? 0 : n }

export async function siguienteIdVenta() {
  // Máximo V en el LOG.
  const { data: log } = await supabaseAdmin
    .from('log').select('id_lcc').ilike('id_lcc', 'V%').order('id_lcc', { ascending: false }).limit(1)
  let max = log && log[0] ? numDe(log[0].id_lcc) : 0
  // Máximo V en el catálogo idventa (si la tabla/columna existe; si falla, se ignora sin romper).
  try {
    const { data: cat, error } = await supabaseAdmin
      .from('idventa').select('id_lcc').ilike('id_lcc', 'V%').order('id_lcc', { ascending: false }).limit(1)
    if (!error && cat && cat[0]) max = Math.max(max, numDe(cat[0].id_lcc))
  } catch { /* idventa opcional */ }
  return 'V' + String(max + 1).padStart(5, '0')
}

export async function GET() {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!AUTORIZADOS.includes(email)) return Response.json({ error: 'Solo Dirección y Anthony pueden ver BB1.' }, { status: 403 })
  return Response.json({ ok: true, siguiente: await siguienteIdVenta() })
}
