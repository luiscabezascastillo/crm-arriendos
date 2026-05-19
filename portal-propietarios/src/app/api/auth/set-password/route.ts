import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { hashPassword, createToken, COOKIE_NAME } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password || password.length < 8) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 8 caracteres' },
        { status: 400 }
      )
    }

    const { data: user, error } = await supabaseAdmin
      .from('portal_users')
      .select('*, propietarios(propietario)')
      .eq('email', email.toLowerCase().trim())
      .eq('activo', true)
      .single()

    if (error || !user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const password_hash = await hashPassword(password)

    await supabaseAdmin
      .from('portal_users')
      .update({
        password_hash,
        debe_cambiar_password: false,
        ultimo_acceso: new Date().toISOString(),
      })
      .eq('id', user.id)

    const token = createToken({
      idprop: user.idprop,
      email: user.email,
      propietario: user.propietarios?.propietario || '',
    })

    const response = NextResponse.json({ ok: true })
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    return response
  } catch (err) {
    console.error('Set password error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
