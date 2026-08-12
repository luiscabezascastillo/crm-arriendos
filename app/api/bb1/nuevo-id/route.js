// VERSION: v3 · 2026-08-12 · app/api/bb1/nuevo-id/route.js — Siguiente Id de VENTA = (máx V real) + 1, formato V00xxx.
//   El "máx V real" es el mayor entre el catálogo `idventa` (columna `idventa`, donde viven ventas ligeras que aún
//   NO están en el log, p.ej. V00593–V00601) y el `log` (id_lcc 'V%'). CRÍTICO: sin mirar `idventa` se reutilizaría
//   un V real. GET. Gate: Dirección + Anthony. No escribe. Hereda v2 (que solo miraba el log → daba un V ya usado).
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin.js'

const AUTORIZADOS = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'anthony.mendoza@fondocapital.com']
const numDe = s => { const n = parseInt(String(s || '').replace(/\D/g, ''), 10); return isNaN(n) ? 0 : n }

export async function siguienteIdVenta() {
  let max = 0
  // Catálogo idventa (fuente principal del correlativo real).
  const { data: cat } = await supabaseAdmin
    .from('idventa').select('idventa').ilike('idventa', 'V%').order('idventa', { ascending: false }).limit(1)
  if (cat && cat[0]) max = Math.max(max, numDe(cat[0].idventa))
  // LOG (por si hubiera un V mayor volcado que no esté en el catálogo).
  const { data: log } = await supabaseAdmin
    .from('log').select('id_lcc').ilike('id_lcc', 'V%').order('id_lcc', { ascending: false }).limit(1)
  if (log && log[0]) max = Math.max(max, numDe(log[0].id_lcc))
  return 'V' + String(max + 1).padStart(5, '0')
}

export async function GET() {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!AUTORIZADOS.includes(email)) return Response.json({ error: 'Solo Dirección y Anthony pueden ver BB1.' }, { status: 403 })
  return Response.json({ ok: true, siguiente: await siguienteIdVenta() })
}
