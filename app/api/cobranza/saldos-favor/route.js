// VERSION: v2 · 2026-08-24 · Añade sugerencias de Cobranza (POST crear / atender) y puedeMover (trio sensible). Hereda v1.
// VERSION: v1 · 2026-08-24 · Auditoria de saldos A FAVOR del arrendatario (posible abono mal asignado).
//   GET -> dos grupos: vigente (S/SQ) y termino (Q). Saldo vivo = Σ(cargo - abono) por idadmon.
//   Filtra saldo < -tolerancia (10.000), excluye quien_cobra=DUENO y propietario vacio.
//   Marca las "parejas mismo piso" (mismo inmueble con >1 idadmon en la lista). SOLO LECTURA.
// Ruta real: app/api/cobranza/saldos-favor/route.js
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const PUEDEN_VER = ['direccion', 'administracion', 'finanzas', 'legal']
const TOLERANCIA = 10000
const TRIO = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']

const num = (v) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d.-]/g, '')) || 0)
const normInmueble = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ')

export async function GET() {
  const session = await getServerSession(authOptions)
  const rol = session?.user?.role
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!PUEDEN_VER.includes(rol)) return Response.json({ error: 'No autorizado' }, { status: 403 })

  // 1) Saldo por idadmon (paginado)
  const saldo = new Map()   // idadmon -> {cargos, abonos, n}
  const PAGE = 1000
  for (let desde = 0; ; desde += PAGE) {
    const { data, error } = await admin.from('cuentas').select('idadmon, cargo, abono').range(desde, desde + PAGE - 1)
    if (error) return Response.json({ error: 'cuentas: ' + error.message }, { status: 500 })
    for (const m of (data || [])) {
      if (!m.idadmon) continue
      const s = saldo.get(m.idadmon) || { cargos: 0, abonos: 0, n: 0 }
      s.cargos += num(m.cargo); s.abonos += num(m.abono); s.n += 1
      saldo.set(m.idadmon, s)
    }
    if (!data || data.length < PAGE) break
  }

  // 2) Contratos
  const { data: contratos } = await admin.from('datos_arriendos')
    .select('idadmon, propietario, inmueble, arrendatario, estado, quien_cobra')
  const info = {}
  for (const c of (contratos || [])) info[c.idadmon] = c

  // 3) Filtrar saldos a favor por estado
  const filas = []
  for (const [idadmon, s] of saldo.entries()) {
    const c = info[idadmon]
    if (!c) continue
    if (!c.propietario || String(c.propietario).trim() === '') continue
    const est = String(c.estado || '').toUpperCase().trim()
    let grupo = null
    if (est === 'S' || est === 'SQ') grupo = 'vigente'
    else if (est === 'Q') grupo = 'termino'
    else continue
    const qc = String(c.quien_cobra || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
    if (qc === 'DUENO') continue
    const saldoVivo = Math.round(s.cargos - s.abonos)
    if (saldoVivo >= -TOLERANCIA) continue   // solo a favor por encima de la tolerancia
    filas.push({
      idadmon, grupo, estado: est,
      propietario: c.propietario || '', inmueble: c.inmueble || '', arrendatario: c.arrendatario || '',
      saldo: saldoVivo, cargos: Math.round(s.cargos), abonos: Math.round(s.abonos), n_mov: s.n,
    })
  }

  // 4) Parejas "mismo piso" (mismo inmueble normalizado con >1 idadmon en la lista)
  const porInmueble = {}
  for (const f of filas) {
    const k = normInmueble(f.inmueble)
    if (!k) continue
    ;(porInmueble[k] ||= []).push(f.idadmon)
  }
  for (const f of filas) {
    const k = normInmueble(f.inmueble)
    f.mismo_piso = (porInmueble[k] && porInmueble[k].length > 1) ? porInmueble[k].filter(x => x !== f.idadmon) : []
  }

  // 5) Ordenar por propietario, inmueble, idadmon
  const cmp = (a, b) => (a.propietario.localeCompare(b.propietario) || a.inmueble.localeCompare(b.inmueble) || a.idadmon.localeCompare(b.idadmon))
  const vigente = filas.filter(f => f.grupo === 'vigente').sort(cmp)
  const termino = filas.filter(f => f.grupo === 'termino').sort(cmp)
  const tot = (arr) => arr.reduce((x, f) => x + f.saldo, 0)

  // 6) Sugerencias de Cobranza (Adalis/Fabiola) por idadmon
  const idset = new Set([...vigente, ...termino].map(f => f.idadmon))
  const { data: sug } = await admin.from('saldos_favor_sugerencias').select('*').order('created_at', { ascending: true })
  const sugerencias = {}
  for (const g of (sug || [])) { if (!idset.has(g.idadmon)) continue; (sugerencias[g.idadmon] ||= []).push(g) }

  return Response.json({
    ok: true, tolerancia: TOLERANCIA,
    vigente, termino, sugerencias,
    yo: email, puedeMover: TRIO.includes(email),
    resumen: {
      vigente: { n: vigente.length, total: tot(vigente) },
      termino: { n: termino.length, total: tot(termino) },
    },
  })
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const rol = session?.user?.role
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!PUEDEN_VER.includes(rol)) return Response.json({ error: 'No autorizado' }, { status: 403 })

  let b
  try { b = await req.json() } catch { return Response.json({ error: 'JSON invalido' }, { status: 400 }) }

  if (b && b.accion === 'atender') {
    if (!TRIO.includes(email)) return Response.json({ error: 'Solo Karina/Direccion pueden marcar atendida' }, { status: 403 })
    const { error } = await admin.from('saldos_favor_sugerencias')
      .update({ atendida: true, atendida_por: email, atendida_at: new Date().toISOString() })
      .eq('id', b.id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  const idadmon = String((b && b.idadmon) || '').trim()
  const texto = String((b && b.texto) || '').trim()
  if (!idadmon || !texto) return Response.json({ error: 'Falta idadmon o texto' }, { status: 400 })
  const { data, error } = await admin.from('saldos_favor_sugerencias')
    .insert({ idadmon, texto, autor: email }).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, sugerencia: data })
}
