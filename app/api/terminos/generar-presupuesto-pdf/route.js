// VERSION: v1 · 2026-07-12 · app/api/terminos/generar-presupuesto-pdf/route.js
//   Genera el PDF del presupuesto de un término, con markup EMBEBIDO (invisible) y fiscalidad
//   por línea, y lo sube al bucket 'presupuestos' (público; nombre con token aleatorio para que
//   la URL no sea adivinable). Devuelve { pdf_url, neto, iva, total }.
//   Gate ESTRICTO: solo Karina + Dirección (el PDF lleva markup → comunicación económica que
//   compromete a FCR). Distinto del gate amplio de Enviar Email.
//
//   Algoritmo (decisiones 12-jul, confirmadas por Luis):
//     · honorarios: base_imponible = LÍQUIDO al técnico  → r = b·tR/(1−tR); c = b + r
//     · factura / sin_documento:                            r = 0;          c = b
//     · markup M (terminos.markup_fcr) prorrateado sobre el COSTE REAL en TODAS las líneas:
//         m = M · (c / Σc)
//     · base_final = c + m       (lo que ve el cliente; retención y markup invisibles)
//     · IVA SIEMPRE 19% sobre base_final ; total = base_final + IVA
//   tR = configuracion.retencion_honorarios (2026 = 0.1525, parametrizable).

import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin.js'
import { generarPresupuestoPDF } from '../../../../lib/pdfPresupuesto.js'
import { randomUUID } from 'crypto'

const KARINA_DIRECCION = [
  'alberto.cabezas@fondocapital.com',
  'luis.cabezas@fondocapital.com',
  'karina.morales@fondocapital.com',
]
const BUCKET = 'presupuestos'
const IVA = 0.19
const n0 = v => { const x = Number(v); return isNaN(x) ? 0 : x }
const fmtFecha = s => { if (!s) return ''; const m = String(s).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : String(s) }

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!KARINA_DIRECCION.includes(email)) {
    return Response.json({ error: 'Solo Karina y Dirección pueden generar/enviar presupuestos.' }, { status: 403 })
  }

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const { idadmon, presupuesto_id } = body || {}
  if (!idadmon) return Response.json({ error: 'Falta idadmon' }, { status: 400 })

  // 1. Contrato + término (markup)
  const { data: arr } = await supabaseAdmin
    .from('datos_arriendos').select('idadmon, inmueble, propietario').eq('idadmon', idadmon).maybeSingle()
  if (!arr) return Response.json({ error: 'Contrato no encontrado: ' + idadmon }, { status: 404 })
  const { data: term } = await supabaseAdmin
    .from('terminos').select('markup_fcr').eq('idadmon', idadmon).maybeSingle()
  const M = n0(term?.markup_fcr)

  // 2. Presupuestos del término (o el indicado)
  let q = supabaseAdmin.from('presupuestos').select('id, numero, fecha, neto, total, descripcion').eq('id_admon_new', idadmon)
  if (presupuesto_id) q = q.eq('id', presupuesto_id)
  const { data: presu } = await q
  const presupuestos = presu || []
  if (!presupuestos.length) return Response.json({ error: 'Este término no tiene presupuestos registrados.' }, { status: 409 })

  const { data: det } = await supabaseAdmin.from('presupuesto_detalle')
    .select('presupuesto_id, orden, descripcion, cantidad, base_imponible, tipo_comprobante')
    .in('presupuesto_id', presupuestos.map(p => p.id)).order('orden')
  const detalle = det || []

  // 3. Tasa de retención (parametrizable)
  const { data: cfg } = await supabaseAdmin.from('configuracion').select('valor').eq('clave', 'retencion_honorarios').maybeSingle()
  const tR = (cfg && !isNaN(parseFloat(cfg.valor))) ? parseFloat(cfg.valor) : 0.1525

  // 4. Aplanar líneas. Fallback: si un presupuesto no tiene detalle, una línea desde su neto.
  const lineas = []
  for (const p of presupuestos) {
    const suyas = detalle.filter(d => d.presupuesto_id === p.id)
    if (suyas.length) {
      for (const d of suyas) lineas.push({
        pid: p.id, descripcion: d.descripcion || '(sin descripción)', cantidad: d.cantidad,
        b: n0(d.base_imponible), tipo: (d.tipo_comprobante || 'factura').toLowerCase(),
      })
    } else {
      lineas.push({ pid: p.id, descripcion: p.descripcion || ('Presupuesto ' + (p.numero || '')), cantidad: null, b: n0(p.neto), tipo: 'factura' })
    }
  }

  // 5. Retención bruteada + markup prorrateado sobre el coste real
  let sumaC = 0
  for (const l of lineas) {
    l.r = (l.tipo === 'honorarios' && tR < 1) ? (l.b * tR) / (1 - tR) : 0
    l.c = l.b + l.r
    sumaC += l.c
  }
  for (const l of lineas) {
    const m = sumaC > 0 ? M * (l.c / sumaC) : 0
    l.base_final = Math.round(l.c + m)   // pesos; retención + markup invisibles
  }
  // Nota: la retención por línea (l.r) se calcula aquí para el PDF; su persistencia en
  // presupuesto_detalle.retencion (auditoría) se hará en el flujo de envío, no en la vista previa.

  // 6. Agrupar en secciones (una por presupuesto)
  const secciones = presupuestos.map(p => {
    const suyas = lineas.filter(l => l.pid === p.id)
    const subtotal = suyas.reduce((a, l) => a + l.base_final, 0)
    return {
      numero: p.numero || '', descripcion: p.descripcion || '', fecha: fmtFecha(p.fecha),
      lineas: suyas.map(l => ({ descripcion: l.descripcion, cantidad: l.cantidad, importe: l.base_final })),
      subtotal,
    }
  })
  const neto = secciones.reduce((a, s) => a + s.subtotal, 0)
  const iva = Math.round(neto * IVA)
  const total = neto + iva

  // 7. Generar PDF
  let bytes
  try {
    bytes = await generarPresupuestoPDF({
      idadmon, inmueble: arr.inmueble || '', propietario: arr.propietario || '',
      fecha: fmtFecha(new Date().toISOString()), secciones, neto, iva, total,
    })
  } catch (e) {
    return Response.json({ error: 'No se pudo generar el PDF: ' + e.message }, { status: 500 })
  }

  // 8. Subir al bucket (público, nombre no adivinable)
  const path = `${idadmon}-${randomUUID()}.pdf`
  const up = await supabaseAdmin.storage.from(BUCKET).upload(path, Buffer.from(bytes), { upsert: true, contentType: 'application/pdf' })
  if (up.error) return Response.json({ error: 'No se pudo subir el PDF: ' + up.error.message }, { status: 500 })
  const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)

  return Response.json({ ok: true, pdf_url: pub?.publicUrl || null, path, neto, iva, total })
}
