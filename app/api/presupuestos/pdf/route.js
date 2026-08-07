// VERSION: v1 · 2026-08-07 · app/api/presupuestos/pdf/route.js
//   Genera el PDF del presupuesto CON MARKUP (precio al cliente) desde la hoja de Presupuestos y lo sube al bucket
//   'presupuestos' (público, nombre con token aleatorio). Devuelve { pdf_url, path, neto, iva, total, para: {to, nombre} }.
//
//   MARKUP POR LÍNEA (modelo de la hoja Presupuestos v7, distinto del endpoint de Términos que usa markup único del
//   término): precio de línea = base_imponible · (1 + mk/100), donde mk = markup_pct explícito o, si no lo hay, el
//   DEFAULT según el tipo de ejecución (INTERNO ⇒ 0%, EXTERNO ⇒ 20%). El markup va EMBEBIDO: el PDF solo muestra el
//   precio final al cliente, nunca el coste. No existe PDF "sin markup".
//
//   GATE: cualquier usuario con acceso ACTIVO al proceso 'presupuestos' (Adalis, Fabiola, Christian, Karina) o Dirección.
//   Es la MISMA puerta que da acceso a la hoja; el PDF es comunicable (precio cliente), así que no se restringe a
//   Karina/Dirección como el de coste.
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin.js'
import { generarPresupuestoPDF } from '../../../../lib/pdfPresupuesto.js'
import { randomUUID } from 'crypto'

const DIRECCION = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com']
const BUCKET = 'presupuestos'
const IVA = 0.19
const MARKUP_DEFAULT = 20
const n0 = v => { const x = Number(v); return isNaN(x) ? 0 : x }
const norm = s => (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
const esInterno = t => norm(t) === 'interno'
const fmtFecha = s => { if (!s) return ''; const m = String(s).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : String(s) }

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = (session?.user?.email || '').trim().toLowerCase()
  const rol = session?.user?.role
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })

  // Gate: Dirección (o rol admin) o permiso ACTIVO del proceso 'presupuestos' (mismo candado que la hoja).
  let ok = rol === 'admin' || DIRECCION.includes(email)
  if (!ok) {
    const { data: perm } = await supabaseAdmin
      .from('proceso_permisos').select('proceso')
      .eq('email', email).eq('proceso', 'presupuestos').eq('activo', true).limit(1)
    ok = !!(perm && perm.length)
  }
  if (!ok) return Response.json({ error: 'Sin acceso al proceso presupuestos.' }, { status: 403 })

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }) }
  const presupuesto_id = body?.presupuesto_id
  if (!presupuesto_id) return Response.json({ error: 'Falta presupuesto_id' }, { status: 400 })

  // 1. Cabecera
  const { data: p, error: eP } = await supabaseAdmin
    .from('presupuestos')
    .select('id, numero, fecha, id_admon_new, ubicacion, propietario, descripcion, neto')
    .eq('id', presupuesto_id).maybeSingle()
  if (eP) return Response.json({ error: eP.message }, { status: 500 })
  if (!p) return Response.json({ error: 'Presupuesto no encontrado.' }, { status: 404 })

  // 2. Detalle (con markup por línea y tipo de ejecución)
  const { data: det } = await supabaseAdmin
    .from('presupuesto_detalle')
    .select('orden, descripcion, cantidad, base_imponible, markup_pct, tipo_ejecucion')
    .eq('presupuesto_id', presupuesto_id).order('orden')
  const detalle = det || []

  // 3. Precio al cliente por línea (base con markup embebido). Sin líneas ⇒ una desde el neto de la cabecera.
  const lineasFuente = detalle.length
    ? detalle.map(d => ({ descripcion: d.descripcion || '(sin descripción)', cantidad: d.cantidad, base: n0(d.base_imponible), markup_pct: d.markup_pct, tipo: d.tipo_ejecucion }))
    : [{ descripcion: p.descripcion || ('Presupuesto ' + (p.numero || '')), cantidad: null, base: n0(p.neto), markup_pct: null, tipo: 'EXTERNO' }]

  const lineas = lineasFuente.map(l => {
    const mk = (l.markup_pct === '' || l.markup_pct == null) ? (esInterno(l.tipo) ? 0 : MARKUP_DEFAULT) : (Number(l.markup_pct) || 0)
    const importe = Math.round(l.base * (1 + mk / 100))
    return { descripcion: l.descripcion, cantidad: l.cantidad, importe }
  })

  const subtotal = lineas.reduce((a, l) => a + l.importe, 0)
  const neto = subtotal
  const iva = Math.round(neto * IVA)
  const total = neto + iva

  // 4. Contrato/propietario para la cabecera del PDF y el destinatario del email.
  let inmueble = p.ubicacion || ''
  let propNombre = p.propietario || ''
  let to = null, idprop = null
  const idadmon = (p.id_admon_new || '').trim()
  if (idadmon) {
    const { data: arr } = await supabaseAdmin
      .from('datos_arriendos').select('idadmon, inmueble, propietario, idprop').eq('idadmon', idadmon).maybeSingle()
    if (arr) {
      inmueble = arr.inmueble || inmueble
      propNombre = arr.propietario || propNombre
      idprop = arr.idprop || null
    }
    if (idprop) {
      const { data: pr } = await supabaseAdmin
        .from('propietarios').select('mail1, email_2, propietario').eq('idprop', idprop).maybeSingle()
      to = pr?.mail1 || pr?.email_2 || null
      if (pr?.propietario) propNombre = pr.propietario
    }
  }

  // 5. PDF (una sección con este presupuesto). Precios ya con markup embebido; el coste no aparece.
  const secciones = [{
    numero: p.numero || '', descripcion: p.descripcion || '', fecha: fmtFecha(p.fecha),
    lineas: lineas.map(l => ({ descripcion: l.descripcion, cantidad: l.cantidad, importe: l.importe })),
    subtotal,
  }]
  let bytes
  try {
    bytes = await generarPresupuestoPDF({
      idadmon, inmueble, propietario: propNombre,
      fecha: fmtFecha(new Date().toISOString()), secciones, neto, iva, total,
    })
  } catch (e) {
    return Response.json({ error: 'No se pudo generar el PDF: ' + e.message }, { status: 500 })
  }

  // 6. Subir al bucket (público, nombre no adivinable)
  const path = `${idadmon || 'PRES'}-${p.numero || presupuesto_id}-${randomUUID()}.pdf`
  const up = await supabaseAdmin.storage.from(BUCKET).upload(path, Buffer.from(bytes), { upsert: true, contentType: 'application/pdf' })
  if (up.error) return Response.json({ error: 'No se pudo subir el PDF: ' + up.error.message }, { status: 500 })
  const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)

  return Response.json({
    ok: true, pdf_url: pub?.publicUrl || null, path, neto, iva, total,
    para: { to: to || '', nombre: propNombre || '' },
    numero: p.numero || '', inmueble,
  })
}
