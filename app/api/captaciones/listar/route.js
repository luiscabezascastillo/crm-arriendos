// VERSION: v2 · 2026-08-12 · app/api/captaciones/listar/route.js — Lista las captaciones con datos del contacto
//   (nombre, whatsapp) para la pantalla. `wa` solo se rellena si el teléfono es MÓVIL (los fijos no llevan WhatsApp).
//   GET. Gate: solo Alberto + Luis (Dirección). Solo lectura. Hereda v1.
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin.js'
import { normalizaTelefono } from '../../../../lib/captacionImport.js'

const AUTORIZADOS = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com']

export async function GET() {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!AUTORIZADOS.includes(email)) return Response.json({ error: 'Solo Alberto y Luis (Dirección) pueden ver captaciones.' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('captaciones')
    .select('id, contacto_id, propietario, telefono, objetivo, comuna, estado, n_publicaciones, administrado, nota_relacion, proxima_gestion, ultima_gestion, contactos(nombre, apellido, whatsapp, telefono, email)')
    .order('estado', { ascending: true })
    .order('proxima_gestion', { ascending: true, nullsFirst: false })
    .limit(2000)
  if (error) return Response.json({ error: 'Error leyendo captaciones: ' + error.message }, { status: 500 })

  const rows = (data || []).map(c => {
    const ct = c.contactos || {}
    const tel = c.telefono || ct.whatsapp || ct.telefono || ''
    const tn = normalizaTelefono(tel)
    const nombre = ct.nombre || String(c.propietario || '').split(',').slice(-1)[0].trim() || c.propietario
    return {
      id: c.id, propietario: c.propietario, nombre, apellido: ct.apellido || '',
      telefono: tn.valido ? tn.display : (tel || ''), wa: tn.wa || '', email: ct.email || '',
      objetivo: c.objetivo, comuna: c.comuna, estado: c.estado,
      n_publicaciones: c.n_publicaciones, administrado: c.administrado,
      nota_relacion: c.nota_relacion || '', proxima_gestion: c.proxima_gestion, ultima_gestion: c.ultima_gestion,
    }
  })
  return Response.json({ ok: true, total: rows.length, rows })
}
