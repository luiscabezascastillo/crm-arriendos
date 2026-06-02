// portal-propietarios/src/app/acceso/[token]/page.tsx
import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createToken, COOKIE_NAME } from '@/lib/auth'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function AccesoPage({ params }: { params: { token: string } }) {
  const { token } = params

  if (!token) redirect('/login')

  // Buscar token válido en portal_tokens
  const { data, error } = await supabaseAdmin
    .from('portal_tokens')
    .select('*')
    .eq('token', token)
    .eq('usado', false)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (error || !data) redirect('/login?error=token_invalido')

  // Marcar token como usado
  await supabaseAdmin
    .from('portal_tokens')
    .update({ usado: true })
    .eq('token', token)

  // Buscar usuario en portal_users por idprop
  const { data: user } = await supabaseAdmin
    .from('portal_users')
    .select('*, propietarios(propietario)')
    .eq('idprop', data.idprop)
    .eq('activo', true)
    .single()

  if (!user) redirect('/login?error=usuario_no_encontrado')

  // Actualizar último acceso
  await supabaseAdmin
    .from('portal_users')
    .update({ ultimo_acceso: new Date().toISOString() })
    .eq('id', user.id)

  // Crear JWT de sesión
  const sessionToken = createToken({
    idprop: user.idprop,
    email: user.email,
    propietario: user.propietarios?.propietario || '',
  })

  // Setear cookie
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 2, // 2 horas
    path: '/',
  })

  redirect('/dashboard')
}
