import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyPassword, createToken, COOKIE_NAME } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email y contraseña son obligatorios' },
        { status: 400 }
      )
    }

    // Buscar usuario en portal_users
    const { data: user, error } = await supabaseAdmin
      .from('portal_users')
      .select('*, propietarios(propietario, nombre)')
      .eq('email', email.toLowerCase().trim())
      .eq('activo', true)
      .single()

    if (error || !user) {
      return NextResponse.json(
        { error: 'Credenciales incorrectas' },
        { status: 401 }
      )
    }

    // Si no tiene password_hash aún (primer acceso)
    if (!user.password_hash) {
      return NextResponse.json(
        { error: 'PRIMER_ACCESO', idprop: user.idprop },
        { status: 403 }
      )
    }

    // Verificar contraseña
    const valid = await verifyPassword(password, user.password_hash)
    if (!valid) {
      return NextResponse.json(
        { error: 'Credenciales incorrectas' },
        { status: 401 }
      )
    }

    // Actualizar último acceso
    await supabaseAdmin
      .from('portal_users')
      .update({ ultimo_acceso: new Date().toISOString() })
      .eq('id', user.id)

    // Crear token JWT
    const token = createToken({
      idprop: user.idprop,
      email: user.email,
      propietario: user.propietarios?.propietario || '',
    })

    // Respuesta con cookie httpOnly
    const response = NextResponse.json({
      ok: true,
      idprop: user.idprop,
      debe_cambiar_password: user.debe_cambiar_password,
    })

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 días
      path: '/',
    })

    return response
  } catch (err) {
    console.error('Login error:', err)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
