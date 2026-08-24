// VERSION: v3 · 2026-08-24 · Auditoria de CARTOLAS. Dos problemas: saldo A FAVOR (< -10.000, posible abono
//   mal asignado) y DEUDA grande (> umbral, bajo cobranza). Devuelve seguimiento (Karina) + notas
//   (sugerencia de Adalis/Fabiola | accion de Karina). POST: nota / seguimiento / atender. Hereda v2/v1.
// Ruta real: app/api/cobranza/saldos-favor/route.js
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const PUEDEN_VER = ['direccion', 'administracion', 'finanzas', 'legal']
const TRIO = ['alberto.cabezas@fondocapital.com', 'luis.cabezas@fondocapital.com', 'karina.morales@fondocapital.com']
const TOLERANCIA = 10000
const UMBRAL_DEUDA_DEF = 300000

const num = (v) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d.-]/g, '')) || 0)
const normInmueble = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ')

export async function GET() {
  const session = await getServerSession(authOptions)
  const rol = session?.user?.role
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!PUEDEN_VER.includes(rol)) return Response.json({ error: 'No autorizado' }, { status: 403 })

  let umbralDeuda = UMBRAL_DEUDA_DEF
  try {
    const { data } = await admin.from('configuracion').select('valor').eq('clave', 'auditoria_umbral_deuda').maybeSingle()
    if (data && data.valor) umbralDeuda = num(data.valor)
  } catch {}

  // 1) Saldo por idadmon (paginado)
  const saldo = new Map()
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

  // 3) Clasificar problemas
  const aFavor = [], deuda = []
  for (const [idadmon, s] of saldo.entries()) {
    const c = info[idadmon]
    if (!c || !c.propietario || String(c.propietario).trim() === '') continue
    const est = String(c.estado || '').toUpperCase().trim()
    let grupo = null
    if (est === 'S' || est === 'SQ') grupo = 'vigente'
    else if (est === 'Q') grupo = 'termino'
    else continue
    const qc = String(c.quien_cobra || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
    if (qc === 'DUENO') continue
    const saldoVivo = Math.round(s.cargos - s.abonos)
    const base = {
      idadmon, grupo, estado: est,
      propietario: c.propietario || '', inmueble: c.inmueble || '', arrendatario: c.arrendatario || '',
      saldo: saldoVivo, cargos: Math.round(s.cargos), abonos: Math.round(s.abonos), n_mov: s.n,
    }
    if (saldoVivo < -TOLERANCIA) aFavor.push({ ...base, tipo: 'a_favor' })
    else if (saldoVivo > umbralDeuda) deuda.push({ ...base, tipo: 'deuda_alta' })
  }

  // 4) Parejas "mismo piso" (entre los de saldo a favor)
  const porInmueble = {}
  for (const f of aFavor) { const k = normInmueble(f.inmueble); if (k) (porInmueble[k] ||= []).push(f.idadmon) }
  for (const f of aFavor) { const k = normInmueble(f.inmueble); f.mismo_piso = (porInmueble[k] && porInmueble[k].length > 1) ? porInmueble[k].filter(x => x !== f.idadmon) : [] }

  // 5) Ordenar
  const cmp = (a, b) => (a.propietario.localeCompare(b.propietario) || a.inmueble.localeCompare(b.inmueble) || a.idadmon.localeCompare(b.idadmon))
  const vigente = aFavor.filter(f => f.grupo === 'vigente').sort(cmp)
  const termino = aFavor.filter(f => f.grupo === 'termino').sort(cmp)
  deuda.sort((a, b) => b.saldo - a.saldo)   // deuda: de mayor a menor
  const tot = (arr) => arr.reduce((x, f) => x + f.saldo, 0)

  // 6) Seguimiento + notas de todos los idadmon en la lista
  const ids = new Set([...vigente, ...termino, ...deuda].map(f => f.idadmon))
  const { data: aud } = await admin.from('cartolas_auditoria').select('*')
  const auditoria = {}
  for (const a of (aud || [])) { if (ids.has(a.idadmon)) auditoria[a.idadmon] = a }
  const { data: notas } = await admin.from('saldos_favor_sugerencias').select('*').order('created_at', { ascending: true })
  const sugerencias = {}
  for (const g of (notas || [])) { if (ids.has(g.idadmon)) (sugerencias[g.idadmon] ||= []).push(g) }

  return Response.json({
    ok: true, tolerancia: TOLERANCIA, umbralDeuda,
    vigente, termino, deuda, auditoria, sugerencias,
    yo: email, puedeMover: TRIO.includes(email), puedeSeguimiento: TRIO.includes(email),
    resumen: {
      vigente: { n: vigente.length, total: tot(vigente) },
      termino: { n: termino.length, total: tot(termino) },
      deuda: { n: deuda.length, total: tot(deuda) },
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
  const accion = b && b.accion

  // Seguimiento (estado + nota de Karina) — solo trio
  if (accion === 'seguimiento') {
    if (!TRIO.includes(email)) return Response.json({ error: 'Solo Karina/Direccion' }, { status: 403 })
    const idadmon = String(b.idadmon || '').trim()
    if (!idadmon) return Response.json({ error: 'Falta idadmon' }, { status: 400 })
    const estado = ['pendiente', 'en_curso', 'resuelto'].includes(b.estado) ? b.estado : 'pendiente'
    const { error } = await admin.from('cartolas_auditoria').upsert({
      idadmon, estado, seguimiento: String(b.seguimiento || '') || null,
      updated_por: email, updated_at: new Date().toISOString(),
    }, { onConflict: 'idadmon' })
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  // Marcar una nota como atendida — solo trio
  if (accion === 'atender') {
    if (!TRIO.includes(email)) return Response.json({ error: 'Solo Karina/Direccion' }, { status: 403 })
    const { error } = await admin.from('saldos_favor_sugerencias')
      .update({ atendida: true, atendida_por: email, atendida_at: new Date().toISOString() }).eq('id', b.id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  // Nueva nota: sugerencia (cualquiera con acceso) | accion (solo trio)
  const idadmon = String((b && b.idadmon) || '').trim()
  const texto = String((b && b.texto) || '').trim()
  const tipo = (b && b.tipo === 'accion') ? 'accion' : 'sugerencia'
  if (!idadmon || !texto) return Response.json({ error: 'Falta idadmon o texto' }, { status: 400 })
  if (tipo === 'accion' && !TRIO.includes(email)) return Response.json({ error: 'Solo Karina/Direccion registran acciones' }, { status: 403 })
  const { data, error } = await admin.from('saldos_favor_sugerencias')
    .insert({ idadmon, texto, autor: email, tipo }).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, nota: data })
}
