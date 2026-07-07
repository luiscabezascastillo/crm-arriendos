// app/api/liquidaciones/comentario/route.js
// Gestor de comentarios_liquidacion por IDADMON + mes. Solo Direccion y Karina.
// GET  ?idadmon=A00xxx&mes=AAMM   -> { rows:[...existentes...], info:{contrato}, puede }
// POST { idadmon, mes, comentario }         -> inserta uno nuevo (historial)
// POST { editar:true, id, comentario }      -> modifica la redaccion de uno existente

import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

const PERMITIDOS = [
  'alberto.cabezas@fondocapital.com',
  'luis.cabezas@fondocapital.com',
  'karina.morales@fondocapital.com',
]
const MESES_TXT = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
const aammToTxt = aamm => {
  if (!aamm || String(aamm).length !== 4) return String(aamm)
  const a = String(aamm).slice(0, 2), m = parseInt(String(aamm).slice(2), 10)
  return `${MESES_TXT[m - 1] || '?'} 20${a}`
}
const hoyISO = () => new Date().toISOString().slice(0, 10)

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
}
function puede(session) {
  const e = session?.user?.email, r = session?.user?.role
  return r === 'admin' || PERMITIDOS.includes(e)
}

export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const idadmon = String(searchParams.get('idadmon') || '').trim().toUpperCase()
  const mes = String(searchParams.get('mes') || '').trim()
  if (!idadmon) return Response.json({ error: 'Falta idadmon.' }, { status: 400 })
  if (!/^\d{4}$/.test(mes)) return Response.json({ error: 'Mes invalido (AAMM).' }, { status: 400 })

  const sb = svc()
  const { data, error } = await sb.from('comentarios_liquidacion')
    .select('id, persona, fecha, comentario, created_at')
    .eq('idadmon', idadmon).eq('mes', mes).order('created_at', { ascending: false })
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Datos del contrato (para mostrar propietario/inmueble/estado y para rellenar al insertar)
  const { data: arr } = await sb.from('datos_arriendos')
    .select('estado, propietario, idprop, inmueble').eq('idadmon', idadmon).limit(1)
  const info = (arr && arr[0]) || null

  return Response.json({ rows: data || [], info, puede: puede(session) })
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!puede(session)) return Response.json({ error: 'Solo Direccion y Karina pueden editar comentarios.' }, { status: 403 })

  let body = {}
  try { body = await req.json() } catch {}
  const sb = svc()
  const persona = session.user.name || session.user.email

  // --- Editar la redaccion de un comentario existente (por id) ---
  if (body.editar === true) {
    const id = body.id
    const comentario = String(body.comentario || '').trim()
    if (!id) return Response.json({ error: 'Falta id.' }, { status: 400 })
    if (!comentario) return Response.json({ error: 'El comentario no puede estar vacio.' }, { status: 400 })
    const { data, error } = await sb.from('comentarios_liquidacion')
      .update({ comentario, persona, fecha: hoyISO() }).eq('id', id).select().single()
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true, row: data })
  }

  // --- Nuevo comentario ---
  const idadmon = String(body.idadmon || '').trim().toUpperCase()
  const mes = String(body.mes || '').trim()
  const comentario = String(body.comentario || '').trim()
  if (!idadmon) return Response.json({ error: 'Falta idadmon.' }, { status: 400 })
  if (!/^\d{4}$/.test(mes)) return Response.json({ error: 'Mes invalido (AAMM).' }, { status: 400 })
  if (!comentario) return Response.json({ error: 'El comentario no puede estar vacio.' }, { status: 400 })

  // Completar la fila con datos del contrato (como las filas que ya existen)
  const { data: arr } = await sb.from('datos_arriendos')
    .select('estado, propietario, idprop, inmueble').eq('idadmon', idadmon).limit(1)
  const info = (arr && arr[0]) || {}

  const fila = {
    idadmon, mes, para_mes_txt: aammToTxt(mes), comentario, persona, fecha: hoyISO(),
    estado: info.estado || null, propietario: info.propietario || null,
    idprop: info.idprop || null, inmueble: info.inmueble || null,
  }
  const { data, error } = await sb.from('comentarios_liquidacion').insert(fila).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, row: data })
}
