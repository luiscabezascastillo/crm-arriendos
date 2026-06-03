import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const limpiar = (v) => {
  if (!v) return 0
  const n = Number(String(v).replace(/[^0-9]/g, ''))
  return isNaN(n) ? 0 : n
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const mes = searchParams.get('mes') || 'MAYO 2026'
  const umbral = Number(searchParams.get('umbral')) || 180000

  const { data: rows, error } = await supabase
    .from('ggcc_agua_luz')
    .select('idadmon, arrendatario, deuda_gastos_comunes, deuda_vigente_electricidad, deuda_vigente_agua, deuda_vigente_gas')
    .eq('mes', mes)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const conTotal = rows.map(r => {
    const ggcc = limpiar(r.deuda_gastos_comunes)
    const luz  = limpiar(r.deuda_vigente_electricidad)
    const agua = limpiar(r.deuda_vigente_agua)
    const gas  = limpiar(r.deuda_vigente_gas)
    return {
      idadmon: r.idadmon,
      arrendatario: r.arrendatario,
      ggcc, luz, agua, gas,
      total: ggcc + luz + agua + gas
    }
  }).filter(r => r.total >= umbral)

  const idadmons = conTotal.map(r => r.idadmon)
  const { data: arriendos } = await supabase
    .from('datos_arriendos')
    .select('idadmon, mail_arrendatario, inmueble')
    .in('idadmon', idadmons)

  const emailMap = {}
  const inmuebleMap = {}
  ;(arriendos || []).forEach(a => {
    emailMap[a.idadmon] = a.mail_arrendatario
    inmuebleMap[a.idadmon] = a.inmueble
  })

  const resultado = conTotal
    .map(r => ({ ...r, mail_arrendatario: emailMap[r.idadmon] || null, inmueble: inmuebleMap[r.idadmon] || '' }))
    .sort((a, b) => b.total - a.total)

  return NextResponse.json({ deudores: resultado })
}