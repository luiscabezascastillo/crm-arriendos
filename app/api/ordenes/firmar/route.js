import { supabaseAdmin } from '../../../../lib/supabaseAdmin.js'
import { generarOrdenPDF } from '../../../../lib/pdfOrden.js'

export const runtime = 'nodejs'

function fmtFecha(d) {
  if (!d) return ''
  const [y, m, day] = String(d).split('-')
  return (day && m && y) ? `${day}-${m}-${y}` : String(d)
}
function ahoraCL() {
  return new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export async function POST(req) {
  try {
    const { token, firmante_nombre, firmante_rut, firmante_domicilio, firmante_comuna, firmante_doc_tipo, firma_png } = await req.json()
    if (!token || !firmante_nombre || !firmante_rut || !firma_png) {
      return Response.json({ error: 'Faltan datos (token, nombre, RUT o firma).' }, { status: 400 })
    }
    const docLabel = firmante_doc_tipo === 'extranjero' ? 'Documento' : 'R.U.T.'

    // 1) cargar la orden por token
    const { data: orden, error: eO } = await supabaseAdmin
      .from('ordenes_visita').select('*').eq('token', token).single()
    if (eO || !orden) return Response.json({ error: 'Orden no encontrada o enlace invalido.' }, { status: 404 })
    if (orden.estado === 'firmada') {
      return Response.json({ ok: true, ya_firmada: true, pdf_url: orden.pdf_url })
    }

    // 2) decodificar la firma (dataURL base64 PNG)
    const b64 = String(firma_png).replace(/^data:image\/png;base64,/, '')
    const pngBytes = Buffer.from(b64, 'base64')

    // IP / user agent
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'n/d'
    const ua = req.headers.get('user-agent') || ''
    const firmadoTxt = ahoraCL()

    // 3) subir la imagen de la firma
    const firmaPath = `${token}/firma.png`
    await supabaseAdmin.storage.from('ordenes').upload(firmaPath, pngBytes, { contentType: 'image/png', upsert: true })
    const firma_img_url = supabaseAdmin.storage.from('ordenes').getPublicUrl(firmaPath).data.publicUrl

    // 4) regenerar el PDF, ahora firmado, desde el snapshot de la orden
    const bytes = await generarOrdenPDF({
      folio: orden.id,
      fechaEmision: fmtFecha(orden.fecha) || '',
      cliente: { nombre: orden.cliente_nombre || '', rut: firmante_rut || '', docLabel, domicilio: firmante_domicilio || '', comuna: firmante_comuna || '', telefono: orden.cliente_telefono || '', email: orden.cliente_email || '' },
      comercial: orden.comercial || '',
      fechaVisita: fmtFecha(orden.fecha),
      horaVisita: orden.hora ? String(orden.hora).slice(0, 5) : '',
      propiedades: orden.propiedades || [],
      firma: { nombre: firmante_nombre, rut: firmante_rut, docLabel, fecha: firmadoTxt, ip, imagenPng: pngBytes },
    })

    const pdfPath = `${token}/orden-firmada.pdf`
    const up = await supabaseAdmin.storage.from('ordenes')
      .upload(pdfPath, Buffer.from(bytes), { contentType: 'application/pdf', upsert: true })
    if (up.error) return Response.json({ error: 'Error guardando PDF firmado: ' + up.error.message }, { status: 500 })
    const pdf_url = supabaseAdmin.storage.from('ordenes').getPublicUrl(pdfPath).data.publicUrl

    // 5) actualizar la orden
    await supabaseAdmin.from('ordenes_visita').update({
      estado: 'firmada',
      firmante_nombre, firmante_rut,
      firma_domicilio: firmante_domicilio || null,
      firma_comuna: firmante_comuna || null,
      firma_img_url, firma_ip: ip, firma_user_agent: ua,
      firmado_en: new Date().toISOString(),
      pdf_url,
      updated_at: new Date().toISOString(),
    }).eq('id', orden.id)

    return Response.json({ ok: true, pdf_url })
  } catch (err) {
    return Response.json({ error: 'Error: ' + (err?.message || String(err)) }, { status: 500 })
  }
}
