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
    if (!token) {
      return NextResponse.json({ error: 'Token requerido' }, { status: 400 })
    }

    // Verificar secret interno
    const internalSecret = request.headers.get('x-internal-secret')
    if (internalSecret !== process.env.INTERNAL_SECRET) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Buscar token en portal_tokens
    const { data: portalToken, error } = await supabaseAdmin
      .from('portal_tokens')
      .select('*')
      .eq('token', token)
      .eq('usado', false)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (error || !portalToken) {
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 })
    }

    // Marcar como usado
    await supabaseAdmin
      .from('portal_tokens')
      .update({ usado: true })
      .eq('id', portalToken.id)

    // Buscar propietario
    const idprop = portalToken.idprop || portalToken.email
    const { data: prop } = await supabaseAdmin
      .from('propietarios')
      .select('propietario, nombre')
      .eq('idprop', idprop)
      .single()

    // Crear sesión JWT (2 horas)
    const jwt = createToken({
      idprop,
      email: portalToken.email,
      propietario: prop?.propietario || prop?.nombre || '',
    })

    const response = NextResponse.json({ ok: true, idprop })
    response.cookies.set(COOKIE_NAME, jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 2, // 2 horas
      path: '/',
    })
    return response
  } catch (err) {
    console.error('Impersonate error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
