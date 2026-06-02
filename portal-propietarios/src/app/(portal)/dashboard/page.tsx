import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function calcularPrecio(c: Record<string, unknown>): number {
  const cuota = parseFloat(String(c.cuota ?? 0)) || 0
  const unid = String(c.unid ?? '').trim().toUpperCase()
  if (unid === 'UF') return Math.round(cuota * (parseFloat(String(c.uf_peso_factor ?? 1)) || 1))
  const reajustes = [
    c.cantidad_reajuste1, c.cantidad_reajuste2, c.cantidad_reajuste3,
    c.cantidad_reajuste4, c.cantidad_reajuste5, c.cantidad_reajuste6,
  ].reduce((s: number, r) => s + (parseFloat(String(r ?? 0)) || 0), 0)
  return Math.round(cuota + reajustes)
}

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) redirect('/login')
  const session = verifyToken(token)
  if (!session) redirect('/login')

  // Query 1: propietario y contratos
  const [{ data: propietario }, { data: contratos }] = await Promise.all([
    supabaseAdmin.from('propietarios').select('nombre, genero').eq('idprop', session.idprop).single(),
    supabaseAdmin.from('datos_arriendos')
      .select('idadmon, estado, inmueble, cuota, unid, uf_peso_factor, cantidad_reajuste1, cantidad_reajuste2, cantidad_reajuste3, cantidad_reajuste4, cantidad_reajuste5, cantidad_reajuste6, termino_actual')
      .eq('idprop', session.idprop)
      .in('estado', ['S', 'SQ', 'Q', 'P']),
  ])

  const todos = (contratos || []) as Record<string, unknown>[]
  const idadmons = todos.map(c => c.idadmon as string)

  // Query 2: movimientos y servicios
  const [{ data: movimientos }, { data: ggccData }] = await Promise.all([
    supabaseAdmin.from('cuentas').select('idadmon, cargo, abono, fecha').in('idadmon', idadmons),
    supabaseAdmin.from('ggcc_agua_luz')
      .select('idadmon, deuda_gastos_comunes, deuda_vigente_electricidad, deuda_vigente_agua, deuda_vigente, aamm')
      .in('idadmon', idadmons)
      .order('aamm', { ascending: false }),
  ])

  // KPIs estados
  const totalS  = todos.filter(c => c.estado === 'S').length
  const totalSQ = todos.filter(c => c.estado === 'SQ').length
  const totalQ  = todos.filter(c => c.estado === 'Q').length
  const totalP  = todos.filter(c => c.estado === 'P').length
  const activos = todos.filter(c => ['S', 'SQ'].includes(c.estado as string))
  const ingresoMensual = activos.reduce((s, c) => s + calcularPrecio(c), 0)

  // Saldos por IDADMON
  const saldoMap = new Map<string, number>()
  for (const m of (movimientos || [])) {
    const id = m.idadmon as string
    const cargo = parseFloat(String(m.cargo ?? 0)) || 0
    const abono = parseFloat(String(m.abono ?? 0)) || 0
    saldoMap.set(id, (saldoMap.get(id) || 0) + cargo - abono)
  }

  // Morosos con inmueble
  const alertasMorosos = idadmons
    .filter(id => (saldoMap.get(id) || 0) > 0)
    .map(id => ({
      idadmon: id,
      inmueble: (todos.find(c => c.idadmon === id)?.inmueble as string) || id,
      saldo: saldoMap.get(id) || 0,
    }))
    .sort((a, b) => b.saldo - a.saldo)

  const totalMorosidad = alertasMorosos.reduce((s, a) => s + a.saldo, 0)

  // Servicios m�s recientes
  const svcMap = new Map<string, Record<string, unknown>>()
  for (const s of (ggccData || [])) {
    if (!svcMap.has(s.idadmon as string)) svcMap.set(s.idadmon as string, s as Record<string, unknown>)
  }
  const totalGGCC = idadmons.reduce((s, id) => s + (parseFloat(String(svcMap.get(id)?.deuda_gastos_comunes ?? 0)) || 0), 0)
  const totalLuz  = idadmons.reduce((s, id) => s + (parseFloat(String(svcMap.get(id)?.deuda_vigente_electricidad ?? 0)) || 0), 0)
  const totalAgua = idadmons.reduce((s, id) => s + (parseFloat(String(svcMap.get(id)?.deuda_vigente_agua ?? 0)) || 0), 0)

  // Ingresos por mes (�ltimos 12)
  const ingresosMap = new Map<string, number>()
  for (const m of (movimientos || [])) {
    if (!m.fecha || !m.abono) continue
    const f = String(m.fecha)
    let mes = ''
    if (f.includes('/')) {
      const p = f.split('/')
      if (p.length === 3) mes = p[2] + '-' + p[1]
    } else if (f.includes('-')) {
      mes = f.substring(0, 7)
    }
    if (mes) ingresosMap.set(mes, (ingresosMap.get(mes) || 0) + (parseFloat(String(m.abono ?? 0)) || 0))
  }

  // GGCC por mes
  const ggccMesMap = new Map<string, number>()
  for (const g of (ggccData || [])) {
    const aamm = String(g.aamm || '')
    if (aamm.length === 4) {
      const mes = '20' + aamm.substring(0, 2) + '-' + aamm.substring(2, 4)
      ggccMesMap.set(mes, (ggccMesMap.get(mes) || 0) + (parseFloat(String(g.deuda_gastos_comunes ?? 0)) || 0))
    }
  }

  const meses12 = Array.from(new Set([...ingresosMap.keys(), ...ggccMesMap.keys()]))
    .sort()
    .slice(-12)

  const graficoData = meses12.map(mes => ({
    mes,
    ingresos: ingresosMap.get(mes) || 0,
    ggcc: ggccMesMap.get(mes) || 0,
  }))

  // Contratos por vencer en 90 d�as
  const hoy = new Date()
  const en90 = new Date(hoy.getTime() + 90 * 24 * 60 * 60 * 1000)
  const alertasVencimiento = todos
    .filter(c => {
      if (!c.termino_actual) return false
      const t = new Date(String(c.termino_actual))
      return t >= hoy && t <= en90
    })
    .map(c => ({
      idadmon: c.idadmon as string,
      inmueble: c.inmueble as string,
      termino: c.termino_actual as string,
    }))

  return (
    <DashboardClient
      nombreCorto={propietario?.nombre || session.propietario}
      tratamiento={propietario?.genero === 'M' ? 'Bienvenida' : 'Bienvenido'}
      idprop={session.idprop}
      totalS={totalS}
      totalSQ={totalSQ}
      totalQ={totalQ}
      totalP={totalP}
      ingresoMensual={ingresoMensual}
      totalMorosidad={totalMorosidad}
      totalGGCC={totalGGCC}
      totalLuz={totalLuz}
      totalAgua={totalAgua}
      morososCount={alertasMorosos.length}
      graficoData={graficoData}
      alertasMorosos={alertasMorosos}
      alertasVencimiento={alertasVencimiento}
    />
  )
}
