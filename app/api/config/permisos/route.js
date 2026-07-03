import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'

const DIRECCION_EMAILS = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']
const ROLES = ['observador', 'colaborador', 'supervisor', 'responsable']

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  const rol = session?.user?.role
  const esDireccion = ['admin', 'direccion'].includes(rol) || DIRECCION_EMAILS.includes(email)
  if (!email) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (!esDireccion) return NextResponse.json({ error: 'Solo Dirección puede cambiar permisos' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const target = String(body.email || '').trim().toLowerCase()
  const proceso = String(body.proceso || '').trim()
  const nuevoRol = body.rol ? String(body.rol).trim() : ''

  if (!target || !proceso) return NextResponse.json({ error: 'Faltan datos (email/proceso)' }, { status: 400 })
  if (nuevoRol && !ROLES.includes(nuevoRol)) return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })

  // SIN ACCESO -> desactivar todas las filas de esa persona/proceso (conserva histórico)
  if (!nuevoRol) {
    const { error } = await supabaseAdmin.from('proceso_permisos')
      .update({ activo: false }).eq('email', target).eq('proceso', proceso)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, proceso, rol: null })
  }

  // OTORGAR/CAMBIAR -> si ya existe fila, actualizar; si no, insertar.
  // (manual insert/update para no depender de que exista el índice único proceso+email)
  const { data: existentes, error: eSel } = await supabaseAdmin.from('proceso_permisos')
    .select('id').eq('email', target).eq('proceso', proceso).order('id', { ascending: true })
  if (eSel) return NextResponse.json({ error: eSel.message }, { status: 500 })

  if (existentes && existentes.length) {
    // actualizar la primera y desactivar posibles duplicadas
    const primera = existentes[0].id
    const { error: eUpd } = await supabaseAdmin.from('proceso_permisos')
      .update({ rol: nuevoRol, activo: true }).eq('id', primera)
    if (eUpd) return NextResponse.json({ error: eUpd.message }, { status: 500 })
    if (existentes.length > 1) {
      const resto = existentes.slice(1).map(r => r.id)
      await supabaseAdmin.from('proceso_permisos').update({ activo: false }).in('id', resto)
    }
  } else {
    const { error: eIns } = await supabaseAdmin.from('proceso_permisos')
      .insert({ proceso, email: target, rol: nuevoRol, activo: true })
    if (eIns) return NextResponse.json({ error: eIns.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, proceso, rol: nuevoRol })
}