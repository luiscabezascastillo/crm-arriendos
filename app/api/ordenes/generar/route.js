import { getToken } from 'next-auth/jwt'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin.js'
import { generarOrdenPDF } from '../../../../lib/pdfOrden.js'

export const runtime = 'nodejs'

function opLabel(objetivo) {
  const o = (objetivo || '').toString().toLowerCase()
  if (o.includes('arriendo') || o.includes('renta')) return 'Arriendo'
  if (o.includes('venta')) return 'Venta'
  return ''
}
function fmtFecha(d) {
  if (!d) return ''
  const [y, m, day] = String(d).split('-')
  return (day && m && y) ? `${day}-${m}-${y}` : String(d)
}

export async function POST(req) {
  // --- auth: requiere sesion (ajustar aqui si tu setup de NextAuth difiere) ---
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token) return Response.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const { visita_id } = await req.json()
    if (!visita_id) return Response.json({ error: 'Falta visita_id' }, { status: 400 })

    // 1) visita + detalle
    const { data: visita, error: eV } = await supabaseAdmin
      .from('visitas')
      .select('*, visita_propiedades(*)')
      .eq('id', visita_id)
      .single()
    if (eV || !visita) return Response.json({ error: 'Visita no encontrada' }, { status: 404 })

    // 2) datos de las propiedades del detalle
    const ids = (visita.visita_propiedades || []).map(vp => vp.publicacion_id).filter(Boolean)
    let pubs = []
    if (ids.length) {
      const { data } = await supabaseAdmin
        .from('publicaciones')
        .select('id, objetivo, tipo, direccion, direccionreal, calle, numero_calle, departamento, comuna, valor, tipo_moneda, codigo')
        .in('id', ids)
      pubs = data || []
    }
    const propsSnapshot = (visita.visita_propiedades || []).map(vp => {
      const p = pubs.find(x => x.id === vp.publicacion_id) || {}
      const direccion = p.direccionreal || p.direccion || [p.calle, p.numero_calle].filter(Boolean).join(' ') || ''
      return {
        operacion: opLabel(p.objetivo),
        tipo: p.tipo || '',
        direccion: direccion + (p.departamento ? ', depto ' + p.departamento : ''),
        comuna: p.comuna || '',
        valor: p.valor ?? null,
        moneda: (p.tipo_moneda || '').toUpperCase().replace('CLF', 'UF'),
        codigo: p.codigo || '',
      }
    })

    // 3) email del cliente (si hay contacto ligado)
    let clienteEmail = null
    if (visita.contacto_id) {
      const { data: c } = await supabaseAdmin.from('contactos').select('email').eq('id', visita.contacto_id).single()
      clienteEmail = c?.email || null
    }

    // 4) reusar orden existente de la visita, o crear una nueva
    const { data: existente } = await supabaseAdmin
      .from('ordenes_visita').select('id, token').eq('visita_id', visita_id).maybeSingle()

    const tok = existente?.token || (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36))

    const snapshot = {
      visita_id,
      token: tok,
      estado: 'borrador',
      cliente_nombre: visita.cliente_nombre || null,
      cliente_email: clienteEmail,
      cliente_telefono: visita.cliente_telefono || null,
      comercial: visita.comercial || null,
      fecha: visita.fecha || null,
      hora: visita.hora || null,
      propiedades: propsSnapshot,
      updated_at: new Date().toISOString(),
    }

    let ordenId
    if (existente?.id) {
      ordenId = existente.id
      await supabaseAdmin.from('ordenes_visita').update(snapshot).eq('id', existente.id)
    } else {
      const { data: ins, error: eIns } = await supabaseAdmin
        .from('ordenes_visita').insert(snapshot).select('id').single()
      if (eIns) return Response.json({ error: 'No se pudo crear la orden: ' + eIns.message }, { status: 500 })
      ordenId = ins.id
    }

    // 5) generar PDF (sin firmar)
    const bytes = await generarOrdenPDF({
      folio: ordenId,
      fechaEmision: fmtFecha(new Date().toISOString().slice(0, 10)),
      cliente: {
        nombre: visita.cliente_nombre || '', telefono: visita.cliente_telefono || '', email: clienteEmail || '',
      },
      comercial: visita.comercial || '',
      fechaVisita: fmtFecha(visita.fecha),
      horaVisita: visita.hora ? String(visita.hora).slice(0, 5) : '',
      propiedades: propsSnapshot,
      firma: null,
    })

    // 6) subir al bucket
    const path = `${tok}/orden.pdf`
    const up = await supabaseAdmin.storage.from('ordenes')
      .upload(path, Buffer.from(bytes), { contentType: 'application/pdf', upsert: true })
    if (up.error) return Response.json({ error: 'Error subiendo PDF: ' + up.error.message }, { status: 500 })
    const pdf_url = supabaseAdmin.storage.from('ordenes').getPublicUrl(path).data.publicUrl

    await supabaseAdmin.from('ordenes_visita').update({ pdf_url, updated_at: new Date().toISOString() }).eq('id', ordenId)

    const base = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin
    return Response.json({
      ok: true, orden_id: ordenId, token: tok, estado: 'borrador',
      pdf_url, link: `${base}/firmar/${tok}`,
    })
  } catch (err) {
    return Response.json({ error: 'Error: ' + (err?.message || String(err)) }, { status: 500 })
  }
}
