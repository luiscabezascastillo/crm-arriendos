// portal-propietarios/src/app/api/auth/impersonate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createToken, COOKIE_NAME } from '@/lib/auth'

const INTERNAL_SECRET = process.env.INTERNAL_SECRET!

export async function POST(request: NextRequest) {
  try {
    const { idprop, secret } = await request.json()

    // Verificar clave secreta interna
    if (!secret || secret !== INTERNAL_SECRET) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (!idprop) {
      return NextResponse.json({ error: 'idprop requerido' }, { status: 400 })
    }

    // Buscar propietario
    const { data: user, error } = await supabaseAdmin
      .from('portal_users')
      .select('*, propietarios(propietario)')
      .eq('idprop', idprop)
      .eq('activo', true)
      .single()

    if (error || !user) {
      return NextResponse.json({ error: 'Propietario no encontrado en portal_users' }, { status: 404 })
    }

    // Crear token JWT igual que en login normal
    const token = createToken({
      idprop: user.idprop,
      email: user.email,
      propietario: user.propietarios?.propietario || '',
    })

    // Actualizar último acceso
    await supabaseAdmin
      .from('portal_users')
      .update({ ultimo_acceso: new Date().toISOString() })
      .eq('id', user.id)

    const response = NextResponse.json({ ok: true, idprop: user.idprop })
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 2, // 2 horas (más corto que login normal)
      path: '/',
    })

    return response

  } catch (err) {
    console.error('Impersonate error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}