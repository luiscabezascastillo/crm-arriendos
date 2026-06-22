import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    const { sourceId } = await request.json()
    if (!sourceId) {
      return NextResponse.json({ error: 'Falta sourceId' }, { status: 400 })
    }

    // 1 — Traer la propiedad original
    const { data: original, error: errGet } = await supabase
      .from('publicaciones')
      .select('*')
      .eq('id', sourceId)
      .single()
    if (errGet) return NextResponse.json({ error: errGet.message }, { status: 500 })
    if (!original) return NextResponse.json({ error: 'No se encontró la propiedad original' }, { status: 404 })

    // 2 — Código nuevo desde el generador atómico de la BD (función siguiente_codigo()).
    //     Única fuente de verdad; evita duplicados y carreras.
    const { data: nuevoCodigo, error: errCod } = await supabase.rpc('siguiente_codigo')
    if (errCod) return NextResponse.json({ error: errCod.message }, { status: 500 })

    // 3 — Clonar datos. NO se toca el id (identity → lo genera Supabase).
    //     NO se escribe codigo_num (columna en desuso, se eliminará).
    const nueva = { ...original }
    delete nueva.id
    delete nueva.codigo_num
    nueva.codigo     = nuevoCodigo
    nueva.fecha      = new Date().toISOString().split('T')[0]
    nueva.pi         = 'NO'
    nueva.web        = 'NO'
    nueva.yapo       = 'NO'
    nueva.goplaceit  = 'NO'
    nueva.proppit    = 'NO'
    nueva.activo     = 'CREAR'
    nueva.estado_2   = ''
    nueva.updated_at = new Date().toISOString()
    nueva.fotos_firma  = null
    nueva.sync_id    = null
    // Campos de portales (especificos del anuncio en ML/web): la copia nace sin ellos
    nueva.codigo_pi            = null
    nueva.url_pi               = null
    nueva.fotos_ml             = null
    nueva.fecha_vencimiento_pi = null
    nueva.estado_pi            = null
    // Regenerar direccion (publica) y direccionreal (interna con depto) desde los campos
    const __depto = (nueva.departamento && String(nueva.departamento).trim()) ? String(nueva.departamento).trim() : ''
    const __base = [nueva.calle, nueva.numero_calle].filter(Boolean).join(' ').trim()
    if (__base) nueva.direccion = __base
    let __real = __base
    if (__depto) __real = __base ? (__base + ' dep ' + __depto) : ('dep ' + __depto)
    if (nueva.comuna && String(nueva.comuna).trim()) __real = __real ? (__real + ', ' + String(nueva.comuna).trim()) : String(nueva.comuna).trim()
    if (__real) nueva.direccionreal = __real
    nueva.url_web              = null
    nueva.url_yapo             = null
    nueva.url_goplaceit        = null
    nueva.url_proppit          = null

    // La copia hereda las fotos de la original (imagen1–imagen38).
    // Borrar una foto en la copia solo quita la referencia en Supabase, no el archivo
    // del servidor, asi que la original nunca se ve afectada.

    // 4 — Insertar
    const { data: creada, error: errCreate } = await supabase
      .from('publicaciones')
      .insert([nueva])
      .select('id, codigo')
      .single()
    if (errCreate) return NextResponse.json({ error: errCreate.message }, { status: 500 })

    return NextResponse.json({ id: creada.id, codigo: creada.codigo })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}