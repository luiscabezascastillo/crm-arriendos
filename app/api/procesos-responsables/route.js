import { createClient } from '@supabase/supabase-js'

// Cliente server-side. Usa la service role key si está disponible (recomendado:
// no expone crm_users al navegador); si no existe, cae a la anon key.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// Dirección: se excluye del nombre del responsable cuando hay otro responsable.
const DIRECCION = [
  'luis.cabezas@fondocapital.com',
  'alberto.cabezas@fondocapital.com',
]

export async function GET() {
  // 1. Responsables activos de todos los procesos
  const { data: permisos, error: e1 } = await supabase
    .from('proceso_permisos')
    .select('proceso, email')
    .eq('rol', 'responsable')
    .eq('activo', true)

  if (e1) {
    return Response.json({ error: e1.message }, { status: 500 })
  }

  // 2. Nombres reales desde crm_users (SOLO email + nombre, nunca password_hash)
  const emails = [...new Set((permisos || []).map(p => p.email))]
  const nameByEmail = {}
  if (emails.length) {
    const { data: users, error: e2 } = await supabase
      .from('crm_users')
      .select('email, nombre')
      .in('email', emails)
    if (e2) {
      return Response.json({ error: e2.message }, { status: 500 })
    }
    ;(users || []).forEach(u => { nameByEmail[u.email] = u.nombre })
  }

  // 3. Agrupar por proceso, excluyendo a Dirección cuando hay otro responsable
  const byProceso = {}
  ;(permisos || []).forEach(p => {
    ;(byProceso[p.proceso] = byProceso[p.proceso] || []).push(p.email)
  })

  const result = {}
  for (const [proceso, lista] of Object.entries(byProceso)) {
    const noDir = lista.filter(e => !DIRECCION.includes(e))
    if (noDir.length) {
      const nombres = noDir.map(e => nameByEmail[e] || e.split('@')[0])
      result[proceso] = { nombre: nombres.join(' · '), esDireccion: false }
    } else {
      result[proceso] = { nombre: 'Dirección', esDireccion: true }
    }
  }

  return Response.json(result)
}