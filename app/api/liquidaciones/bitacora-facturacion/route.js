// RUTA: app/api/liquidaciones/bitacora-facturacion/route.js
// VERSION: v1 · 2026-08-19 · API de la BITÁCORA de facturación (append-only). GET restringido a Dirección/Karina
//   (alberto.cabezas, luis.cabezas, karina.morales). Lee liquidacion_facturado_log vía service-role y devuelve las
//   filas del mes (o todas), más el conjunto de idadmon con MÁS DE UNA emisión (duplicados) para resaltarlos.
//   Solo lectura; la bitácora nunca se modifica desde aquí.

import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

// Acceso exclusivo (mismos tres que las acciones sensibles de liquidación/facturación).
const ACCESO = [
  'alberto.cabezas@fondocapital.com',
  'luis.cabezas@fondocapital.com',
  'karina.morales@fondocapital.com',
]

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
}

export const dynamic = 'force-dynamic'

export async function GET(req) {
  const session = await getServerSession(authOptions)
  const email = (session?.user?.email || '').toLowerCase()
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!ACCESO.includes(email)) return Response.json({ error: 'Acceso restringido a Dirección y Karina.' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const mes = (searchParams.get('mes') || '').trim()

  const sb = svc()
  let q = sb.from('liquidacion_facturado_log')
    .select('id, mes, idadmon, idprop, propietario, inmueble, monto, iva, tipo, documento, formato, es_complementaria, usuario, generado_en')
    .order('generado_en', { ascending: false })
    .limit(10000)
  if (/^\d{4}$/.test(mes)) q = q.eq('mes', mes)

  const { data, error } = await q
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const rows = data || []
  // Duplicados: (mes, idadmon) que aparecen en más de un documento distinto -> posible doble facturación.
  const porClave = {}
  for (const r of rows) {
    const k = r.mes + '·' + r.idadmon
    ;(porClave[k] = porClave[k] || new Set()).add(r.documento || String(r.id))
  }
  const duplicados = Object.entries(porClave).filter(([, docs]) => docs.size > 1).map(([k]) => k)

  return Response.json({ ok: true, rows, duplicados })
}
