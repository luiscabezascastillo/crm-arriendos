// app/api/propietarios/guardar/route.js
// Crea o edita un propietario. Acceso: Dirección/Legal/Administración
// (crm_users.rol in admin/legal/operaciones). idprop NUNCA se edita; en el alta
// se genera correlativo P + 3 dígitos = MAX(numérico)+1 en el servidor (evita duplicados).

import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const ROLES_EDIT = ['admin', 'legal', 'operaciones']
const EMAILS_OK = [
  'luis.cabezas@fondocapital.com', 'alberto.cabezas@fondocapital.com',
  'anthony.mendoza@fondocapital.com', 'adalis@fondocapital.com', 'fabiola.guerra@fondocapital.com',
]
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Columnas editables (whitelist). idprop y los internos (recib, cob, iva, des, trm,
// aju, esp, sync_hash) quedan FUERA a propósito.
const CAMPOS = [
  'propietario', 'nombre', 'apellidos', 'fis_jurid', 'genero', 'rut', 'mail1',
  'telefono', 'direccion', 'comuna', 'tipo_factura', 'activo',
  'email_2', 'fecha_cumpleanos', 'llaves', 'plantilla', 'advertencias', 'comentarios', 'range', 'para_uso_futuro',
]

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })

  const { data: u } = await admin.from('crm_users').select('rol').eq('email', email).maybeSingle()
  const autorizado = EMAILS_OK.includes(email) || (u && ROLES_EDIT.includes(u.rol))
  if (!autorizado) {
    return Response.json({ error: 'No autorizado (solo Dirección, Legal o Administración)' }, { status: 403 })
  }

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const { modo, idprop, campos } = body || {}
  if (!campos || typeof campos !== 'object') return Response.json({ error: 'Faltan campos' }, { status: 400 })

  const limpio = {}
  for (const k of CAMPOS) if (k in campos) limpio[k] = (campos[k] === '' ? null : campos[k])
  limpio.updated_at = new Date().toISOString()

  try {
    if (modo === 'crear') {
      const { data: rows } = await admin.from('propietarios').select('idprop')
      let max = 0
      for (const r of rows || []) {
        const n = parseInt(String(r.idprop).replace(/\D/g, ''), 10)
        if (!isNaN(n) && n > max) max = n
      }
      const nuevo = 'P' + String(max + 1).padStart(3, '0')
      const { error } = await admin.from('propietarios').insert({ idprop: nuevo, ...limpio })
      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json({ ok: true, idprop: nuevo })
    } else {
      if (!idprop) return Response.json({ error: 'Falta idprop' }, { status: 400 })
      const { error } = await admin.from('propietarios').update(limpio).eq('idprop', idprop)
      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json({ ok: true, idprop })
    }
  } catch (e) {
    return Response.json({ error: e?.message || 'Error' }, { status: 500 })
  }
}
