import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ML_API = 'https://api.mercadolibre.com'

async function getValidToken() {
  const { data: rows } = await supabase
    .from('configuracion')
    .select('clave, valor')
    .in('clave', ['ml_access_token', 'ml_token_expira', 'ml_refresh_token'])
  const config = {}
  for (const row of rows || []) config[row.clave] = row.valor
  const expira = config['ml_token_expira'] ? new Date(config['ml_token_expira']) : null
  const ahora = new Date()
  if (config['ml_access_token'] && expira && expira > new Date(ahora.getTime() + 5 * 60 * 1000)) {
    return config['ml_access_token']
  }
  const res = await fetch(`${ML_API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.ML_CLIENT_ID,
      client_secret: process.env.ML_CLIENT_SECRET,
      refresh_token: config['ml_refresh_token'],
    }),
  })
  const json = await res.json()
  const newAccess = json.access_token
  const newRefresh = json.refresh_token || config['ml_refresh_token']
  const nuevaExpiracion = new Date(ahora.getTime() + (json.expires_in || 21600) * 1000).toISOString()
  await supabase.from('configuracion').upsert([
    { clave: 'ml_access_token', valor: newAccess, updated_at: new Date().toISOString() },
    { clave: 'ml_refresh_token', valor: newRefresh, updated_at: new Date().toISOString() },
    { clave: 'ml_token_expira', valor: nuevaExpiracion, updated_at: new Date().toISOString() },
  ])
  return newAccess
}

export async function POST(request) {
  try {
    const { publicacionId, codigoPI } = await request.json()
    if (!codigoPI) return NextResponse.json({ error: 'Falta codigoPI' }, { status: 400 })

    // Obtener descripción actual de Supabase
    const { data: pub, error: errPub } = await supabase
      .from('publicaciones').select('observaciones, codigo').eq('id', publicacionId).single()
    if (errPub || !pub) return NextResponse.json({ error: 'Publicación no encontrada' }, { status: 404 })

    let descripcion = pub.observaciones || ''
    descripcion += `\n - ${pub.codigo} - \n\nmetros aproximados proporcionados por el dueno`
    descripcion = descripcion
      .replace(/<br>/g, '\n ').replace(/<\/br>/g, '\n ')
      .replace(/á/g, '\u00E1').replace(/é/g, '\u00E9')
      .replace(/í/g, '\u00ED').replace(/ó/g, '\u00F3')
      .replace(/ú/g, '\u00FA').replace(/ñ/g, '\u00F1')
      .replace(/Á/g, '\u00C1').replace(/É/g, '\u00C9')
      .replace(/Í/g, '\u00CD').replace(/Ó/g, '\u00D3')
      .replace(/Ú/g, '\u00DA').replace(/Ñ/g, '\u00D1')

    const token = await getValidToken()

    // Intentar PUT primero (actualizar descripción existente)
    const resPut = await fetch(`${ML_API}/items/${codigoPI}/description`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ plain_text: descripcion }),
    })

    if (resPut.status === 200) {
      return NextResponse.json({ ok: true, metodo: 'PUT', mensaje: '✓ Descripción actualizada correctamente' })
    }

    // Si PUT falla, intentar POST (crear descripción nueva)
    const resPost = await fetch(`${ML_API}/items/${codigoPI}/description`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ plain_text: descripcion }),
    })

    const jsonPost = await resPost.json()

    if (resPost.status === 200 || resPost.status === 201) {
      return NextResponse.json({ ok: true, metodo: 'POST', mensaje: '✓ Descripción creada correctamente' })
    }

    return NextResponse.json({
      ok: false,
      error: `ML respondió ${resPost.status}: ${jsonPost.message || JSON.stringify(jsonPost)}`
    }, { status: 500 })

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
