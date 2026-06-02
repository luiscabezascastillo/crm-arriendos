import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createToken, COOKIE_NAME } from '@/lib/auth'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()
    if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 400 })

    const { data: pt, error } = await supabaseAdmin
      .from('portal_tokens')
      .select('*')
      .eq('token', token)
      .eq('usado', false)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (error || !pt) {
      return NextResponse.json({ error: 'Token invalido o expirado. Solicita un nuevo enlace.' }, { status: 401 })
    }

    await supabaseAdmin
      .from('portal_tokens')
      .update({ usado: true })
      .eq('id', pt.id)

    const { data: prop } = await supabaseAdmin
      .from('propietarios')
      .select('propietario, nombre')
      .eq('idprop', pt.idprop)
      .single()

    const jwt = createToken({
      idprop: pt.idprop,
      email: pt.email,
      propietario: prop?.nombre || prop?.propietario || '',
    })

    const response = NextResponse.json({ ok: true, idprop: pt.idprop })
    response.cookies.set(COOKIE_NAME, jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 2,
      path: '/',
    })
    return response
  } catch (err) {
    console.error('Acceso error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}