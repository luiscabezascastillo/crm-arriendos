// VERSION: v2 · 15-07-2026 · fecha de renta a dd/mm/yyyy (antes salía en ISO 2026-07-01 y descuadraba el orden de cuentas)
// Verificación tras copiar: Select-String route.js -Pattern "VERSION: v2"
// app/api/cartolas/cargar-mes/route.js
// Carga los cargos del mes (el "A Cobrar" de CARTAS = base de calcular_liquidacion)
// a la tabla `cuentas`, replicando el formato de las filas de junio.
// Blindado: solo Direccion, preview antes de insertar, candado anti-duplicado por mes,
// insert atomico (todo o nada), cuadre de control y constancia en cuentas_cargas_log.

import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

const DIRECCION_EMAILS = [
  'alberto.cabezas@fondocapital.com',
  'luis.cabezas@fondocapital.com',
  'karina.morales@fondocapital.com',
]

const MESES_TXT = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
const n0 = v => { const x = Number(v); return isNaN(x) ? 0 : x }
const aammToTxt = aamm => {
  if (!aamm || String(aamm).length !== 4) return String(aamm)
  const a = String(aamm).slice(0, 2), m = parseInt(String(aamm).slice(2), 10)
  return `${MESES_TXT[m - 1] || '?'} 20${a}`
}
const aammToFecha = aamm => `01/${String(aamm).slice(2)}/20${String(aamm).slice(0, 2)}` // AAMM -> DD/MM/YYYY (01/07/2026), consistente con el resto de cuentas

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )
}

export async function POST(req) {
  // --- Auth: solo Direccion ---
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!DIRECCION_EMAILS.includes(email)) {
    return Response.json({ error: 'Solo Direccion puede cargar los cargos del mes a Cuentas.' }, { status: 403 })
  }

  let body = {}
  try { body = await req.json() } catch {}
  const mes = String(body.mes || '').trim()
  const confirmar = body.confirmar === true
  if (!/^\d{4}$/.test(mes)) return Response.json({ error: 'Mes invalido (se espera AAMM, p.ej. 2607).' }, { status: 400 })

  const sb = svc()
  const mesTxt = aammToTxt(mes)
  const fecha = aammToFecha(mes)

  // --- Candado: ¿ya se cargo este mes? ---
  const { data: yaCuentas } = await sb.from('cuentas').select('idadmon').ilike('concepto', `${mesTxt}%`).limit(1)
  const { data: yaLog } = await sb.from('cuentas_cargas_log')
    .select('id, usuario, fecha_carga, n_filas, total').eq('mes', mes).order('id', { ascending: false }).limit(1)
  const yaCargado = (yaCuentas && yaCuentas.length > 0) || (yaLog && yaLog.length > 0)
  const logPrev = (yaLog && yaLog[0]) || null

  // --- Fuente: la MISMA RPC que alimenta la vista CARTAS ---
  const { data: liq, error: e1 } = await sb.rpc('calcular_liquidacion', { p_mes: mes })
  if (e1) return Response.json({ error: 'calcular_liquidacion: ' + e1.message }, { status: 500 })
  const rows = liq || []
  const ids = [...new Set(rows.map(r => r.idadmon))]

  // Estado del IDADMON (para filtrar P y para poblar la columna estado)
  const { data: arrData } = await sb.from('datos_arriendos').select('idadmon, estado').in('idadmon', ids)
  const estadoDe = {}
  for (const d of arrData || []) estadoDe[d.idadmon] = String(d.estado || '').trim().toUpperCase()

  // Construir los cargos (mismo criterio que CARTAS: A Cobrar = base, P=0)
  const cargos = []
  let omitP = 0, omitProp = 0, omitCero = 0
  const nowIso = new Date().toISOString()
  for (const r of rows) {
    const estado = estadoDe[r.idadmon] || ''
    const esP = estado === 'P'
    const esProp = String(r.inmueble || '').startsWith('[proporcional')
    const aCobrar = esP ? 0 : Math.round(n0(r.base))
    if (esP) { omitP++; continue }
    if (esProp) { omitProp++; continue }
    if (aCobrar <= 0) { omitCero++; continue }
    cargos.push({
      fecha,
      idadmon: r.idadmon,
      concepto: `${mesTxt} ${r.propietario || ''} ${r.inmueble || ''}`,
      cargo: aCobrar,
      estado: estado || 'S',
      propietario: r.propietario || '',
      inmueble: r.inmueble || '',
      updated_at: nowIso,
    })
  }
  const total = cargos.reduce((a, c) => a + c.cargo, 0)

  // --- PREVIEW (no inserta) ---
  if (!confirmar) {
    return Response.json({
      preview: true, mes, mesTxt, fecha, yaCargado, log: logPrev,
      n: cargos.length, total,
      omitidas: { P: omitP, proporcional: omitProp, cero: omitCero },
      muestra: cargos.slice(0, 5),
    })
  }

  // --- CONFIRMAR: candado + insert atomico + cuadre + log ---
  if (yaCargado) {
    return Response.json({ error: `El mes ${mesTxt} ya fue cargado. Operacion bloqueada (candado anti-duplicado).`, yaCargado: true, log: logPrev }, { status: 409 })
  }
  if (cargos.length === 0) return Response.json({ error: 'No hay cargos que insertar para este mes.' }, { status: 400 })

  const { error: eIns } = await sb.from('cuentas').insert(cargos) // un solo insert = atomico
  if (eIns) return Response.json({ error: 'INSERT cuentas: ' + eIns.message }, { status: 500 })

  // Cuadre: leer de vuelta y sumar
  const { data: check } = await sb.from('cuentas').select('cargo').ilike('concepto', `${mesTxt}%`)
  const totalVerificado = (check || []).reduce((a, c) => a + n0(c.cargo), 0)

  await sb.from('cuentas_cargas_log').insert({
    mes, mes_txt: mesTxt, usuario: email, n_filas: cargos.length, total, total_verificado: totalVerificado,
  })

  return Response.json({
    ok: true, mes, mesTxt, n: cargos.length, total,
    total_verificado: totalVerificado,
    cuadra: Math.round(total) === Math.round(totalVerificado),
  })
}
