// app/api/portal/preview/route.js
// Genera token temporal y devuelve URL de acceso al portal

import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const PORTAL_URL = process.env.PORTAL_URL || 'https://portal-propietarios-rose.vercel.app'

export async function POST(request) {
  try {
    const { idprop } = await request.json()
    if (!idprop) return Response.json({ error: 'idprop requerido' }, { status: 400 })

    // Verificar que el propietario existe en portal_users
    const { data: user, error } = await supabase
      .from('portal_users')
      .select('idprop, email, activo')
      .eq('idprop', idprop)
      .eq('activo', true)
      .single()

    if (error || !user) {
      return Response.json({ error: `Propietario ${idprop} no tiene acceso al portal. Debe estar registrado en portal_users.` }, { status: 404 })
    }

    // Generar token de un solo uso válido 10 minutos
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

    await supabase.from('portal_tokens').insert({
      email: user.email,
      rut: '',
      tipo: 'propietario',
      token,
      usado: false,
      expires_at: expiresAt.toISOString(),
      idprop,
    })

    return Response.json({
      ok: true,
      portalUrl: `${PORTAL_URL}/acceso/${token}`,
    })

  } catch (e) {
    console.error('portal/preview error:', e)
    return Response.json({ error: 'Error interno: ' + e.message }, { status: 500 })
  }
}
