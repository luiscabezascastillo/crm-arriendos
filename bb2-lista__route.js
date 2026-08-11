// app/api/bb2/lista/route.js
// VERSION: v1 · 2026-08-11 · BB2 (arriendos de corretaje) — LISTADO. Lee la tabla `log` (histórico del LOG del Excel,
//   ahora gestionado desde el CRM) filtrando los arriendos (id_lcc que empieza por 'R'). Devuelve una lista SLIM
//   (sin volcar el raw_data entero al cliente) con los campos para el listado + la bandera HECHO (raw_data->'HECHO/PENDIENTE2').
//   Service role (como BI) porque `log` puede tener RLS. GET ?q= (busca en id/inmueble/dueño/arrendatario) & ?estado=.
//   Solo Dirección, Comercial, Ventas y Legal.

import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

const DIRECCION_EMAILS = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']
const ROLES_OK = ['direccion', 'comercial', 'ventas', 'legal', 'administracion', 'admin']

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
}

// lee una clave del raw_data probando primero la clave "limpia" y luego las históricas (fallback)
function pick(raw, ...keys) {
  for (const k of keys) { const v = raw && raw[k]; if (v != null && String(v).trim() !== '') return String(v).trim() }
  return ''
}

export async function GET(req) {
  const session = await getServerSession(authOptions)
  const email = (session?.user?.email || '').toLowerCase()
  const rol = session?.user?.role
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!(ROLES_OK.includes(rol) || DIRECCION_EMAILS.includes(email))) {
    return Response.json({ error: 'Sin acceso a Operaciones comerciales.' }, { status: 403 })
  }

  try {
    const sb = svc()
    // Arriendos de corretaje = id_lcc que empieza por 'R'. Traemos columnas promovidas + raw_data
    // (solo en el servidor) para leer la bandera HECHO y algún dato que no esté promovido.
    const { data, error } = await sb.from('log')
      .select('id_lcc, tipo, fecha_registro, inmueble, moneda, cantidad_contrato2, ejecutivo_venta, dueno_vendedor, arrendatario_comprador, estatus, raw_data, updated_at')
      .ilike('id_lcc', 'R%')
    if (error) return Response.json({ error: error.message }, { status: 500 })

    const lista = (data || []).map(r => {
      const raw = r.raw_data || {}
      const hecho = String(raw['HECHO/PENDIENTE2'] || raw['hecho'] || '').trim().toUpperCase() === 'HECHO'
      return {
        idop: r.id_lcc,
        fecha_registro: r.fecha_registro || pick(raw, 'fecha_registro', 'FECHA REGISTRO'),
        inmueble: r.inmueble || pick(raw, 'inmueble', 'INMUEBLE'),
        comuna: pick(raw, 'inmueble_comuna', 'COMUNA INMUEBLE'),
        dueno: r.dueno_vendedor || pick(raw, 'D_nombre', 'Nombre-D', 'DUEÑO/VENDEDOR'),
        arrendatario: r.arrendatario_comprador || pick(raw, 'A_nombre', 'Nombre-A', 'ARRENDATARIO/COMPRADOR'),
        moneda: r.moneda || pick(raw, 'moneda', 'MONEDA'),
        monto: r.cantidad_contrato2 || pick(raw, 'monto', 'CANTIDAD CONTRATO2'),
        vendedor: r.ejecutivo_venta || pick(raw, 'vendedor', 'EJECUTIVO VENTA'),
        hecho,
      }
    })

    // Filtros de servidor (opcionales)
    const url = new URL(req.url)
    const q = (url.searchParams.get('q') || '').trim().toLowerCase()
    const estado = (url.searchParams.get('estado') || '').trim()   // '' | 'hecho' | 'pendiente'
    let out = lista
    if (q) out = out.filter(x => `${x.idop} ${x.inmueble} ${x.dueno} ${x.arrendatario} ${x.vendedor}`.toLowerCase().includes(q))
    if (estado === 'hecho') out = out.filter(x => x.hecho)
    else if (estado === 'pendiente') out = out.filter(x => !x.hecho)

    // Orden: por Id descendente (más recientes primero). id_lcc = 'R00xxx'
    out.sort((a, b) => String(b.idop).localeCompare(String(a.idop), 'es', { numeric: true }))

    return Response.json({ ok: true, total: lista.length, mostrados: out.length, arriendos: out })
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 500 })
  }
}
