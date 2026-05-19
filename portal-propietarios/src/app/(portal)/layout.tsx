import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import Sidebar from '@/components/Sidebar'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) redirect('/login')
  const session = verifyToken(token)
  if (!session) redirect('/login')

  const { data: prop } = await supabaseAdmin
    .from('propietarios')
    .select('nombre')
    .eq('idprop', session.idprop)
    .single()

  const nombre = prop?.nombre || session.propietario

  return (
    <div className="portal-shell">
      <Sidebar idprop={session.idprop} nombre={nombre} />
      <main className="portal-main">
        {children}
      </main>
    </div>
  )
}
