// app/api/liquidaciones/generar-csv/route.js
// VERSION: v3 · 2026-08-10 · NO FACTURAR lo EN ESPERA. Antes de armar los CSV se quitan de `lineas` los idadmon retenidos
//   (liquidacion_retenidos: retenido=true y liberado_at null) — arrendatario moroso, marcado en CARTAS. Así su comisión
//   NO se factura este mes (se hará en la complementaria al cobrar). Aplica a mes congelado y en vivo. Hereda v2.
// VERSION: v2 · 2026-08-10 · FACTURAR SIN PREPARAR: si el mes NO está preparado (liquidacion_idadmon sin filas), las
//   líneas (comisión por inmueble) se calculan EN VIVO desde calcular_liquidacion —igual que la página/CARTAS/EMAILS—,
//   tomando el estado de datos_arriendos para excluir los P. El tipo (33/39) sigue saliendo de liquidacion_idprop
//   (la fila la crea el upsert de facturar/route v2) y el HECHO+fecha_emision se marca sobre esa fila. Hereda v1.
// VERSION: v1 · 2026-07-08 · genera los 2 CSV SimpleFactura (33 facturas / 39 boletas)
// Verificar: Select-String route.js -Pattern "VERSION: v2"
//
// Filtro: SOLO propietarios con facturar='SI' (cualquier otro valor queda fuera).
// Excluye Paola (P001) y estado P. Separa por tipo_factura: 33->facturas, 39/41->boletas.
// Agrupa por propietario (Id local desde 1). Si nº inmuebles >= limite -> parte en 2 (equilibrado).
// Al generar OK: pone facturar='HECHO' + fecha_emision=ahora en los propietarios incluidos.
// Solo Alberto, Luis, Karina.
//
// POST { mes, limite? } -> { ok, facturas_csv, boletas_csv, resumen } | { error }

import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

const EMAILS_OK = [
  'alberto.cabezas@fondocapital.com',
  'luis.cabezas@fondocapital.com',
  'karina.morales@fondocapital.com',
]
const PAOLA = 'P001'

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
}

// quitar acentos y caracteres problematicos para el CSV
function sinAcentos(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // á->a, ñ se mantiene como n+tilde -> ojo
    .replace(/ñ/g, 'n').replace(/Ñ/g, 'N')
    .replace(/;/g, ' ')   // el ; es separador -> fuera del contenido
    .replace(/\r?\n/g, ' ')
    .trim()
}

function numOf(v) {
  if (v == null) return 0
  const n = Number(String(v).replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? Math.round(n) : 0
}

// fecha DD/MM/YYYY de hoy
function fechaHoy() {
  const d = new Date()
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

// Reparto equilibrado de N items en G grupos -> array de tamaños
// (ej: 19 en 2 -> [10,9]; 12 en 2 -> [6,6])
function tamGrupos(n, g) {
  const base = Math.floor(n / g), resto = n % g
  return Array.from({ length: g }, (_, i) => base + (i < resto ? 1 : 0))
}

// 38 columnas del CSV SimpleFactura, en orden
const COLUMNAS = ['Id', 'TipoDte', 'FmaPago', 'FechaEmision', 'Vencimiento', 'RutRecep', 'GiroRecep', 'Contacto', 'CorreoRecep', 'DirRecep', 'CmnaRecep', 'CiudadRecep', 'RazonSocialRecep', 'DirDest', 'CmnaDest', 'CiudadDest', 'ReferenciaTpoDocRef', 'ReferenciaFolioRef', 'ReferenciaFchRef', 'ReferenciaRazonRef', 'ReferenciaCodigo', 'CodigoProducto', 'NombreProducto', 'DescripcionProducto', 'CantidadProducto', 'PrecioProducto', 'UnidadMedidaProducto', 'DescuentoProducto', 'RecargoProducto', 'RebajaAvaluo', 'IndicadorExento', 'TotalProducto', 'GlosaDR', 'TpoMov', 'TpoValor', 'ValorDR', 'ValorOtrMnda', 'IndExeDR']

function filaCSV(obj) {
  return COLUMNAS.map(c => obj[c] != null ? String(obj[c]) : '').join(';')
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  const rol = session?.user?.role
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!(rol === 'admin' || EMAILS_OK.includes(email))) {
    return Response.json({ error: 'Solo Direccion y Karina pueden generar la facturacion.' }, { status: 403 })
  }

  let body = {}
  try { body = await req.json() } catch {}
  const mes = String(body.mes || '').trim()
  if (!/^\d{4}$/.test(mes)) return Response.json({ error: 'Mes invalido (AAMM).' }, { status: 400 })
  const limite = Math.max(2, Number(body.limite) || 10)   // >= limite -> parte en 2

  const sb = svc()

  // 1) Cabeceras: SOLO facturar='SI', no cerradas
  const { data: cabs, error: eCab } = await sb.from('liquidacion_idprop')
    .select('idprop, facturar, tipo_factura, cerrado')
    .eq('mes', mes).eq('facturar', 'SI')
  if (eCab) return Response.json({ error: 'cabeceras: ' + eCab.message }, { status: 500 })
  const idpropsSI = (cabs || []).filter(c => c.idprop !== PAOLA && !c.cerrado).map(c => c.idprop)
  if (idpropsSI.length === 0) return Response.json({ ok: true, facturas_csv: '', boletas_csv: '', resumen: { aviso: 'No hay propietarios con facturar=SI.' } })
  const tipoDe = {}; for (const c of cabs || []) tipoDe[c.idprop] = (c.tipo_factura || '').trim()

  // 2) Lineas (inmuebles) de esos propietarios, sin estado P.
  //    Si el mes está PREPARADO (liquidacion_idadmon con filas), se leen de ahí (la foto).
  //    Si NO, se calculan EN VIVO desde calcular_liquidacion (igual que la página/CARTAS/EMAILS),
  //    tomando el estado de datos_arriendos para excluir los P. Así se puede facturar sin preparar.
  const { data: anyFroz, error: eAny } = await sb.from('liquidacion_idadmon').select('idadmon').eq('mes', mes).limit(1)
  if (eAny) return Response.json({ error: 'chequeo mes: ' + eAny.message }, { status: 500 })
  const esCongelado = (anyFroz || []).length > 0

  let lineas = []
  if (esCongelado) {
    const { data: lins, error: eLin } = await sb.from('liquidacion_idadmon')
      .select('idadmon, idprop, propietario, inmueble, comision, estado')
      .eq('mes', mes).in('idprop', idpropsSI)
    if (eLin) return Response.json({ error: 'lineas: ' + eLin.message }, { status: 500 })
    lineas = (lins || []).filter(l => (l.estado || '').toUpperCase() !== 'P' && numOf(l.comision) > 0)
  } else {
    const { data: liq, error: eLiq } = await sb.rpc('calcular_liquidacion', { p_mes: mes })
    if (eLiq) return Response.json({ error: 'calcular_liquidacion: ' + eLiq.message }, { status: 500 })
    const setSI = new Set(idpropsSI)
    const rows = (liq || []).filter(r => setSI.has(r.idprop))
    const ids = [...new Set(rows.map(r => r.idadmon))]
    const estadoDe = {}
    if (ids.length) {
      const { data: arr } = await sb.from('datos_arriendos').select('idadmon, estado').in('idadmon', ids)
      for (const d of (arr || [])) estadoDe[d.idadmon] = String(d.estado || '').toUpperCase()
    }
    lineas = rows.map(r => ({
      idadmon: r.idadmon, idprop: r.idprop, propietario: r.propietario,
      inmueble: r.inmueble, comision: r.comision, estado: estadoDe[r.idadmon] || '',
    })).filter(l => l.estado !== 'P' && numOf(l.comision) > 0)
  }

  // 2b) EN ESPERA: quitar los idadmon retenidos (arrendatario moroso). Su comisión NO se factura
  //     hasta cobrar (se hará en la complementaria). Fuente: liquidacion_retenidos (mismo que CARTAS/EMAILS).
  const { data: retData } = await sb.from('liquidacion_retenidos')
    .select('idadmon').eq('mes', mes).eq('retenido', true).is('liberado_at', null)
  const retSet = new Set((retData || []).map(r => r.idadmon))
  let nEnEspera = 0
  if (retSet.size) {
    const antes = lineas.length
    lineas = lineas.filter(l => !retSet.has(l.idadmon))
    nEnEspera = antes - lineas.length
  }

  // 3) Datos de propietarios (cliente)
  const { data: props } = await sb.from('propietarios')
    .select('idprop, propietario, rut, mail1, email_2, direccion, comuna, telefono').in('idprop', idpropsSI)
  const propDe = {}; for (const p of props || []) propDe[p.idprop] = p

  // 4) Agrupar lineas por propietario
  const porProp = {}
  for (const l of lineas) (porProp[l.idprop] = porProp[l.idprop] || []).push(l)

  const fecha = fechaHoy()
  const filasFactura = []   // TipoDte 33
  const filasBoleta = []    // TipoDte 39/41
  let idFactura = 0, idBoleta = 0
  const resumen = { facturas: { propietarios: 0, docs: 0, lineas: 0 }, boletas: { propietarios: 0, docs: 0, lineas: 0 }, partidos: [] }
  const idpropsFacturados = []

  // orden por nombre para salida estable
  const idpropsOrden = idpropsSI.filter(ip => porProp[ip]?.length)
    .sort((a, b) => (propDe[a]?.propietario || '').localeCompare(propDe[b]?.propietario || '', 'es'))

  for (const idprop of idpropsOrden) {
    const p = propDe[idprop] || {}
    const tipo = tipoDe[idprop] || '39'
    const esFactura = tipo === '33'
    const inmuebles = porProp[idprop]

    // ¿parte en 2? (>= limite inmuebles)
    const nGrupos = inmuebles.length >= limite ? 2 : 1
    if (nGrupos > 1) resumen.partidos.push({ idprop, propietario: p.propietario, inmuebles: inmuebles.length, docs: nGrupos })
    const tam = tamGrupos(inmuebles.length, nGrupos)

    // datos de cliente comunes
    const cliente = {
      FmaPago: '2',
      FechaEmision: fecha,
      Vencimiento: fecha,
      RutRecep: p.rut || '',
      GiroRecep: 'PROPIETARIO INMUEBLE',
      CorreoRecep: p.mail1 || p.email_2 || '',
      DirRecep: sinAcentos(p.direccion),
      CmnaRecep: sinAcentos(p.comuna),
      CiudadRecep: 'SANTIAGO',
      RazonSocialRecep: sinAcentos(`${idprop}-${p.propietario}`),
      NombreProducto: 'COMISION ADMINISTRACION',
      CantidadProducto: '1',
      UnidadMedidaProducto: 'UN',
      DescuentoProducto: '0',
      RecargoProducto: '0',
      RebajaAvaluo: '0',
      IndicadorExento: '0',
    }

    let idx = 0
    for (let g = 0; g < nGrupos; g++) {
      const id = esFactura ? (++idFactura) : (++idBoleta)
      const grupo = inmuebles.slice(idx, idx + tam[g]); idx += tam[g]
      for (const l of grupo) {
        const monto = numOf(l.comision)
        const fila = filaCSV({
          ...cliente,
          Id: String(id),
          TipoDte: tipo,
          DescripcionProducto: sinAcentos(`${l.idadmon}-${l.inmueble}`),
          PrecioProducto: String(monto),
          TotalProducto: String(monto),
        })
        if (esFactura) filasFactura.push(fila); else filasBoleta.push(fila)
      }
      if (esFactura) resumen.facturas.docs++; else resumen.boletas.docs++
    }
    if (esFactura) { resumen.facturas.propietarios++; resumen.facturas.lineas += inmuebles.length }
    else { resumen.boletas.propietarios++; resumen.boletas.lineas += inmuebles.length }
    idpropsFacturados.push(idprop)
  }

  const cab = COLUMNAS.join(';')
  const facturas_csv = filasFactura.length ? [cab, ...filasFactura].join('\r\n') : ''
  const boletas_csv = filasBoleta.length ? [cab, ...filasBoleta].join('\r\n') : ''

  // 5) Marcar HECHO + fecha_emision a los propietarios incluidos
  const nowIso = new Date().toISOString()
  for (const idprop of idpropsFacturados) {
    await sb.from('liquidacion_idprop').update({ facturar: 'HECHO', fecha_emision: nowIso, updated_at: nowIso })
      .eq('mes', mes).eq('idprop', idprop)
  }

  resumen.enEspera = nEnEspera
  if (nEnEspera > 0) resumen.aviso = `${nEnEspera} línea(s) en espera (arrendatario moroso) se excluyeron de la facturación; se facturarán en la complementaria al cobrar.`

  return Response.json({ ok: true, mes, facturas_csv, boletas_csv, resumen })
}
