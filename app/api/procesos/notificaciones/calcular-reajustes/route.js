// ═══════════════════════════════════════════════════════════════
// VERSION: v1  ·  2026-07-23  ·  Calcula los reajustes de renta de un mes
// Para verificar tras copiar:  Select-String route.js -Pattern "VERSION: v1"
// ═══════════════════════════════════════════════════════════════
// app/api/procesos/notificaciones/calcular-reajustes/route.js
//
// Calcula el reajuste que toca a cada contrato cuya fecha_reajusteN cae el
// primer dia del mes indicado, y lo escribe en la cantidad_reajusteN
// correspondiente. Sin esto, la notificacion sale con la renta antigua.
//
// FORMULA (deducida del Excel historico y verificada contra 8 reajustes ya
// aplicados, ademas de contra los contratos):
//     renta_vigente = cuota + suma de los reajustes con fecha ANTERIOR al mes
//     monto         = redondeo(renta_vigente x indice)
//     indice        segun el campo 'revision' del contrato:
//                      *CON UF* + trimestral -> uf_3m
//                      *CON UF* + anual      -> uf_12m
//                      *CON UF*              -> uf_6m
//                      trimestral            -> ipc_3m
//                      anual                 -> ipc_12m
//                      semestral / 6 meses   -> ipc_6m
//                      UF, FIJO, otros       -> no se reajusta
//
// Los contratos en UF (unid='UF') no llevan reajuste: su renta se actualiza
// sola con el valor de la UF del mes.
//
// TOPE: si el indice fuera negativo, el reajuste es 0. Los contratos lo dicen
// expresamente: "en ningun caso la renta sera inferior a la estipulada".
//
// POST { mes:'YYYY-MM-01' }                  -> PREVISUALIZA (no escribe nada)
// POST { mes:'YYYY-MM-01', aplicar:true }    -> escribe los montos
//
// Respuesta: { ok, mes, indices, filas:[...], resumen:{...} }

import { getServerSession } from 'next-auth'
import { authOptions } from '../../../auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

const EMAILS_OK = [
  'alberto.cabezas@fondocapital.com',
  'luis.cabezas@fondocapital.com',
  'karina.morales@fondocapital.com',
  'adalis@fondocapital.com',
  'fabiola.guerra@fondocapital.com',
]
const ROLES_OK = ['admin', 'direccion', 'administracion', 'finanzas', 'operaciones']

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )
}

const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const iso = v => v ? String(v).slice(0, 10) : null

// Que columna de indices_mensuales le toca a cada tipo de revision
function indiceDe(revision, idx) {
  const r = String(revision || '').toUpperCase()
  if (!r) return { valor: null, columna: null }
  if (r.includes('CON UF')) {
    if (r.includes('TRIMESTRAL')) return { valor: idx.uf_3m, columna: 'uf_3m' }
    if (r.includes('ANUAL')) return { valor: idx.uf_12m, columna: 'uf_12m' }
    return { valor: idx.uf_6m, columna: 'uf_6m' }
  }
  if (r.includes('TRIMESTRAL')) return { valor: idx.ipc_3m, columna: 'ipc_3m' }
  if (r.includes('ANUAL')) return { valor: idx.ipc_12m, columna: 'ipc_12m' }
  if (r.includes('SEMESTRAL')) return { valor: idx.ipc_6m, columna: 'ipc_6m' }
  if (r.includes('6 MESES')) return { valor: idx.ipc_6m, columna: 'ipc_6m' }
  return { valor: null, columna: null }   // UF a secas, FIJO, sin ajuste...
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  const rol = session?.user?.role
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!(ROLES_OK.includes(rol) || EMAILS_OK.includes(email))) {
    return Response.json({ error: 'Sin permiso para calcular reajustes.' }, { status: 403 })
  }

  let body = {}
  try { body = await req.json() } catch {}
  const mes = iso(body.mes)
  if (!mes || !/^\d{4}-\d{2}-01$/.test(mes)) {
    return Response.json({ error: 'Mes invalido (se espera YYYY-MM-01).' }, { status: 400 })
  }
  const aplicar = body.aplicar === true

  const sb = svc()

  // ── 1) Indices del mes ────────────────────────────────────────────────────
  const { data: idxRows, error: eIdx } = await sb
    .from('indices_mensuales')
    .select('mes, valor_uf, ipc_3m, ipc_6m, ipc_12m, uf_3m, uf_6m, uf_12m')
    .eq('mes', mes)
  if (eIdx) return Response.json({ error: 'indices: ' + eIdx.message }, { status: 500 })
  const idx = (idxRows || [])[0]
  if (!idx) {
    return Response.json({
      error: 'No hay indices cargados para ese mes. Carga la UF y los IPC antes de calcular.',
      falta_indices: true, mes,
    }, { status: 400 })
  }

  // ── 2) Contratos activos ──────────────────────────────────────────────────
  const cols = ['idadmon', 'propietario', 'inmueble', 'arrendatario', 'estado', 'revision', 'unid', 'cuota']
  for (let i = 1; i <= 6; i++) cols.push('fecha_reajuste' + i, 'cantidad_reajuste' + i)
  const { data: arr, error: eArr } = await sb
    .from('datos_arriendos').select(cols.join(', ')).in('estado', ['S', 'SQ']).limit(5000)
  if (eArr) return Response.json({ error: 'datos_arriendos: ' + eArr.message }, { status: 500 })

  // ── 3) Calcular ───────────────────────────────────────────────────────────
  const filas = []
  for (const c of (arr || [])) {
    // ¿alguna casilla vence este mes?
    let slot = 0
    for (let i = 1; i <= 6; i++) { if (iso(c['fecha_reajuste' + i]) === mes) { slot = i; break } }
    if (!slot) continue

    // Renta vigente = cuota + reajustes anteriores a este mes
    let acumulado = 0
    for (let i = 1; i <= 6; i++) {
      const f = iso(c['fecha_reajuste' + i])
      if (f && f < mes) acumulado += num(c['cantidad_reajuste' + i])
    }
    const rentaVigente = num(c.cuota) + acumulado
    const actual = num(c['cantidad_reajuste' + slot])

    const esUF = String(c.unid || '').toUpperCase() === 'UF'
    const { valor: indice, columna } = indiceDe(c.revision, idx)

    let motivo = null
    if (esUF) motivo = 'Contrato en UF: la renta se actualiza con el valor de la UF, no lleva reajuste.'
    else if (indice == null) motivo = `Revision "${c.revision || '(vacia)'}" no se reajusta por indice.`

    const propuesto = motivo ? null : Math.max(0, Math.round(rentaVigente * Number(indice)))

    filas.push({
      idadmon: c.idadmon, propietario: c.propietario, inmueble: c.inmueble,
      arrendatario: c.arrendatario, revision: c.revision, unid: c.unid,
      slot, cuota: num(c.cuota), acumulado, renta_vigente: rentaVigente,
      indice: indice == null ? null : Number(indice), indice_columna: columna,
      actual, propuesto, motivo,
      cambia: propuesto != null && propuesto !== actual,
      renta_nueva: propuesto == null ? null : rentaVigente + propuesto,
    })
  }
  filas.sort((a, b) => a.idadmon.localeCompare(b.idadmon))

  const aCambiar = filas.filter(f => f.cambia)
  const resumen = {
    total: filas.length,
    a_cambiar: aCambiar.length,
    sin_indice: filas.filter(f => f.motivo).length,
    ya_correctos: filas.filter(f => !f.cambia && !f.motivo).length,
    suma_reajustes: aCambiar.reduce((s, f) => s + (f.propuesto || 0), 0),
    suma_renta_vigente: aCambiar.reduce((s, f) => s + f.renta_vigente, 0),
  }

  // ── 4) Aplicar (solo si se pide) ──────────────────────────────────────────
  if (!aplicar) {
    return Response.json({ ok: true, mes, aplicado: false, indices: idx, filas, resumen })
  }
  let escritas = 0
  for (const f of aCambiar) {
    const patch = {}
    patch['cantidad_reajuste' + f.slot] = f.propuesto
    const { error } = await sb.from('datos_arriendos').update(patch).eq('idadmon', f.idadmon)
    if (error) return Response.json({ error: `al guardar ${f.idadmon}: ${error.message}`, escritas }, { status: 500 })
    escritas++
  }
  return Response.json({ ok: true, mes, aplicado: true, escritas, indices: idx, filas, resumen })
}
