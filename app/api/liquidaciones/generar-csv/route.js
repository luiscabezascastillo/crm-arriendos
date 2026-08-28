// RUTA: app/api/liquidaciones/generar-csv/route.js
// VERSION: v9 · 2026-08-28 · MODO EXCEPCION: acepta forzar:true (solo trío EMAILS_OK) para emitir en un mes CERRADO
//   (incluye las cabeceras con cerrado=true). Sin forzar, se excluyen como siempre. Hereda v8.
// VERSION: v8 · 2026-08-19 · BITÁCORA de facturación (append-only). Cada línea emitida (regulares y complementarias) se
//   INSERTA en liquidacion_facturado_log con usuario + hora y NUNCA se borra (sobrevive al DELETE de liquidacion_facturado
//   al re-'SI'). Además, antes de emitir se avisa si algún idadmon YA figura en la bitácora del mes (resumen.reemitidos):
//   detecta la posible RE-EMISIÓN / doble cobro. Requiere la tabla liquidacion_facturado_log. Hereda v7.
// VERSION: v7 · 2026-08-18 · FACTURACION PARCIAL. Procesa facturar IN ('SI','PARCIAL') y emite SOLO las lineas que NO
//   estan ya en `liquidacion_facturado` (registro por idadmon del mes) y que no estan en espera. Registra lo emitido
//   en esa tabla. Estado final por propietario: si le queda alguna linea EN ESPERA -> 'PARCIAL' (ya se hizo pero
//   falta el moroso); si no le queda nada en espera y se le facturo algo -> 'HECHO'; si no se facturo nada -> se deja
//   igual. Asi, al recuperar el moroso y re-facturar, solo sale lo que faltaba. La complementaria queda intacta.
//   Hereda v6.
// VERSION: v6 · 2026-08-17 · NUBOX FIX: FOLIO ya NO va vacio (Nubox lo exige: "Folio de documento es
//   obligatorio"). Aunque se cargue con "Folios automatico", ese campo es un CORRELATIVO de documento
//   dentro del archivo (1,2,3...) que Nubox usa para agrupar lineas; el folio real del SII lo asigna
//   Nubox. Nuevo contador docNubox por documento (unico en el archivo, mezcle facturas y boletas);
//   SECUENCIA sigue siendo la linea dentro del documento. Hereda v5.
// VERSION: v5 · 2026-08-16 · NUBOX. formato='nubox' genera UN CSV de 20 columnas (Cargar Ventas
//   desde Archivo) con FOLIO vacio -> Nubox numera (opcion "Folios automatico"). Factura (33) a
//   precio NETO; boleta (39) a precio BRUTO (Admon+IVA, tomado de la propia liquidacion). Periodo
//   del servicio = mes de la liquidacion (01 -> fin de mes). TIPOSERVICIO=1 en boletas, vacio en
//   facturas. Email siempre. Sin acentos (mismo sinAcentos). Marca HECHO igual que SimpleFactura
//   (emision real): el generador solo toma facturar='SI', asi los HECHO nunca se re-emiten.
//   Ademas param solo='boletas' (para el SimpleFactura en retirada): procesa solo tipo 39/41.
//   El camino SimpleFactura (2 CSV de 38 col) queda intacto. Hereda v4.
// app/api/liquidaciones/generar-csv/route.js
// VERSION: v4 · 2026-08-10 · COMPLEMENTARIAS al CSV: se añaden las líneas de comisión de las complementarias registradas
//   con mes_cobro = este mes (arriendos morosos ya cobrados), a la factura de su propietario (aunque el propietario no
//   tuviera facturar=SI). Tras generar se marcan estado='facturada' para no repetirlas. El tipo (33/39) del propietario que
//   entra solo por complementaria se toma de propietarios.tipo_factura. Hereda v3.
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

// 20 columnas del CSV de Nubox (Cargar Ventas desde Archivo), en orden.
// FOLIO = correlativo de documento (1,2,3...) que Nubox exige para agrupar lineas; con "Folios
// automatico" Nubox asigna el folio real del SII. NO es el folio del SII ni puede ir vacio.
const NUBOX_COLS = ['TIPO', 'FOLIO', 'SECUENCIA', 'FECHA', 'RUT', 'RAZONSOCIAL', 'GIRO', 'COMUNA', 'DIRECCION', 'AFECTO', 'PRODUCTO', 'DESCRIPCION', 'CANTIDAD', 'PRECIO', 'PORCENTDSCTO', 'EMAIL', 'TIPOSERVICIO', 'PERIODODESDE', 'PERIODOHASTA', 'FECHAVENCIMIENTO']
function filaNubox(obj) {
  return NUBOX_COLS.map(c => obj[c] != null ? String(obj[c]) : '').join(';')
}
// 'AAMM' -> ['01/MM/AAAA', 'DD/MM/AAAA' (ultimo dia del mes)]
function periodoMes(mes) {
  const yyyy = 2000 + Number(mes.slice(0, 2)), m = Number(mes.slice(2))
  const fin = new Date(yyyy, m, 0).getDate()
  const p = n => String(n).padStart(2, '0')
  return [`01/${p(m)}/${yyyy}`, `${p(fin)}/${p(m)}/${yyyy}`]
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
  const formato = String(body.formato || 'simple').toLowerCase()   // 'simple' (2 CSV) | 'nubox' (1 CSV)
  const forzar = body.forzar === true && EMAILS_OK.includes(email)   // modo excepción: facturar en mes CERRADO (solo trío)
  const solo = String(body.solo || '').toLowerCase()               // '' | 'boletas' (SimpleFactura en retirada)

  const sb = svc()

  // 1) Cabeceras: facturar='SI' o 'PARCIAL' (re-facturación de lo que faltaba), no cerradas
  const { data: cabs, error: eCab } = await sb.from('liquidacion_idprop')
    .select('idprop, facturar, tipo_factura, cerrado')
    .eq('mes', mes).in('facturar', ['SI', 'PARCIAL'])
  if (eCab) return Response.json({ error: 'cabeceras: ' + eCab.message }, { status: 500 })
  const idpropsSI = (cabs || []).filter(c => c.idprop !== PAOLA && (!c.cerrado || forzar)).map(c => c.idprop)
  const tipoDe = {}; for (const c of cabs || []) tipoDe[c.idprop] = (c.tipo_factura || '').trim()

  // Complementarias a facturar en ESTE mes de cobro (arriendos morosos ya cobrados y registrados).
  // Se añaden como líneas extra a la factura de su propietario. No se re-facturan (estado 'facturada').
  const { data: complRows } = await sb.from('liquidacion_complementaria')
    .select('id, idadmon, idprop, mes_espera, comision, estado').eq('mes_cobro', mes)
  const compl = (complRows || []).filter(c => c.idprop !== PAOLA && numOf(c.comision) > 0 && c.estado !== 'facturada' && c.estado !== 'anulada')
  const complProps = [...new Set(compl.map(c => c.idprop))]

  if (idpropsSI.length === 0 && compl.length === 0) {
    return Response.json({ ok: true, facturas_csv: '', boletas_csv: '', resumen: { aviso: 'No hay propietarios con facturar SI/PARCIAL ni complementarias.' } })
  }

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
      .select('idadmon, idprop, propietario, inmueble, comision, iva, estado')
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
      inmueble: r.inmueble, comision: r.comision, iva: r.iva_comision, estado: estadoDe[r.idadmon] || '',
    })).filter(l => l.estado !== 'P' && numOf(l.comision) > 0)
  }

  // 2a) Facturables TOTALES por propietario (con y sin espera) — para decidir el estado final PARCIAL/HECHO.
  const facturablesPorProp = {}
  for (const l of lineas) (facturablesPorProp[l.idprop] = facturablesPorProp[l.idprop] || new Set()).add(l.idadmon)

  // 2b) EN ESPERA: quitar los idadmon retenidos (arrendatario moroso). Su comisión NO se factura hasta cobrar.
  //     Fuente: liquidacion_retenidos (mismo que CARTAS/EMAILS).
  const { data: retData } = await sb.from('liquidacion_retenidos')
    .select('idadmon').eq('mes', mes).eq('retenido', true).is('liberado_at', null)
  const retSet = new Set((retData || []).map(r => r.idadmon))
  let nEnEspera = 0
  if (retSet.size) {
    const antes = lineas.length
    lineas = lineas.filter(l => !retSet.has(l.idadmon))
    nEnEspera = antes - lineas.length
  }

  // 2c) YA FACTURADO este mes (parciales previos): no se re-emite. Registro por idadmon en liquidacion_facturado.
  const { data: yaFactRows } = await sb.from('liquidacion_facturado').select('idadmon, idprop').eq('mes', mes)
  const yaFactSet = new Set((yaFactRows || []).map(r => r.idadmon))
  const yaFactPropSet = new Set((yaFactRows || []).map(r => r.idprop).filter(Boolean))
  if (yaFactSet.size) lineas = lineas.filter(l => !yaFactSet.has(l.idadmon))

  // 2d) BITÁCORA (append-only): idadmon que YA figuran EMITIDOS este mes en liquidacion_facturado_log.
  //     No bloquea, pero avisa: si `liquidacion_facturado` se limpió (re-'SI') la bitácora conserva la memoria
  //     y detecta la posible RE-EMISIÓN (doble facturación). Se devuelve en resumen.reemitidos.
  const { data: logPrevRows } = await sb.from('liquidacion_facturado_log').select('idadmon').eq('mes', mes)
  const yaEnBitacora = new Set((logPrevRows || []).map(r => r.idadmon))
  const reemitidos = [...new Set(lineas.filter(l => yaEnBitacora.has(l.idadmon)).map(l => l.idadmon))]

  // 3) Datos de propietarios (cliente) — SI + los que tienen complementaria
  const idpropsAll = [...new Set([...idpropsSI, ...complProps])]
  const { data: props } = await sb.from('propietarios')
    .select('idprop, propietario, rut, mail1, email_2, direccion, comuna, telefono, tipo_factura').in('idprop', idpropsAll)
  const propDe = {}; for (const p of props || []) propDe[p.idprop] = p

  // 4) Agrupar lineas por propietario
  const porProp = {}
  for (const l of lineas) (porProp[l.idprop] = porProp[l.idprop] || []).push(l)
  // Añadir las líneas de complementaria (una por complementaria) al grupo de su propietario.
  const complIncluidas = []
  for (const c of compl) {
    (porProp[c.idprop] = porProp[c.idprop] || []).push({
      idadmon: c.idadmon, idprop: c.idprop, propietario: (propDe[c.idprop]?.propietario || ''),
      inmueble: `COMPLEMENTARIA arriendo ${c.mes_espera}`, comision: c.comision, _complId: c.id,
    })
    complIncluidas.push(c.id)
  }

  const fecha = fechaHoy()
  const [periodoDesde, periodoHasta] = periodoMes(mes)   // mes de la liquidacion, para Nubox
  const filasFactura = []   // TipoDte 33
  const filasBoleta = []    // TipoDte 39/41
  const filasNubox = []     // formato Nubox (20 col, 1 CSV)
  let idFactura = 0, idBoleta = 0, docNubox = 0   // docNubox = correlativo de documento para el FOLIO de Nubox
  const resumen = { facturas: { propietarios: 0, docs: 0, lineas: 0 }, boletas: { propietarios: 0, docs: 0, lineas: 0 }, partidos: [] }
  const idpropsFacturados = []
  const emitidasRegistro = []   // líneas realmente emitidas (para el registro liquidacion_facturado; excluye complementarias)
  const emitidasLog = []        // TODAS las líneas emitidas (incl. complementarias) para la BITÁCORA append-only

  // orden por nombre para salida estable (SI + complementarias)
  const idpropsOrden = idpropsAll.filter(ip => porProp[ip]?.length)
    .sort((a, b) => (propDe[a]?.propietario || '').localeCompare(propDe[b]?.propietario || '', 'es'))

  for (const idprop of idpropsOrden) {
    const p = propDe[idprop] || {}
    const tipo = tipoDe[idprop] || (propDe[idprop]?.tipo_factura || '').trim() || '39'
    const esFactura = tipo === '33'
    if (solo === 'boletas' && esFactura) continue   // SimpleFactura en retirada: solo boletas
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
      const folioNubox = ++docNubox   // un correlativo por documento, unico en el archivo
      const grupo = inmuebles.slice(idx, idx + tam[g]); idx += tam[g]
      let seq = 0
      for (const l of grupo) {
        const monto = numOf(l.comision)
        const ivaMonto = (l.iva != null && l.iva !== '') ? numOf(l.iva) : Math.round(monto * 0.19)
        seq++
        // SimpleFactura (2 CSV de 38 col) — sin cambios
        const fila = filaCSV({
          ...cliente,
          Id: String(id),
          TipoDte: tipo,
          DescripcionProducto: sinAcentos(`${l.idadmon}-${l.inmueble}`),
          PrecioProducto: String(monto),
          TotalProducto: String(monto),
        })
        if (esFactura) filasFactura.push(fila); else filasBoleta.push(fila)
        // Registro de línea realmente emitida (no complementarias). Clave para la facturación PARCIAL.
        if (!l._complId) emitidasRegistro.push({ idadmon: l.idadmon, idprop, monto, tipo })
        // BITÁCORA append-only: TODA línea emitida (regulares y complementarias), con quién y cuándo.
        emitidasLog.push({
          idadmon: l.idadmon, idprop, propietario: (p.propietario || l.propietario || ''),
          inmueble: l.inmueble || '', monto, iva: ivaMonto, tipo, documento: String(id),
          es_complementaria: !!l._complId,
        })
        // Nubox (1 CSV de 20 col): factura precio NETO; boleta precio BRUTO (Admon+IVA).
        filasNubox.push(filaNubox({
          TIPO: tipo, FOLIO: String(folioNubox), SECUENCIA: seq, FECHA: fecha,
          RUT: p.rut || '', RAZONSOCIAL: sinAcentos(`${idprop}-${p.propietario}`),
          GIRO: 'PROPIETARIO INMUEBLE', COMUNA: sinAcentos(p.comuna), DIRECCION: sinAcentos(p.direccion),
          AFECTO: 'SI', PRODUCTO: 'COMISION ADMINISTRACION',
          DESCRIPCION: sinAcentos(`${l.idadmon}-${l.inmueble}`),
          CANTIDAD: '1', PRECIO: String(esFactura ? monto : (monto + ivaMonto)), PORCENTDSCTO: '0',
          EMAIL: p.mail1 || p.email_2 || '', TIPOSERVICIO: esFactura ? '' : '1',
          PERIODODESDE: periodoDesde, PERIODOHASTA: periodoHasta, FECHAVENCIMIENTO: fecha,
        }))
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
  const nubox_csv = filasNubox.length ? [NUBOX_COLS.join(';'), ...filasNubox].join('\r\n') : ''

  // 5) Registro de lo emitido (por idadmon) + estado por propietario (PARCIAL si queda algo en espera; si no, HECHO).
  const nowIso = new Date().toISOString()
  const setSIfinal = new Set(idpropsSI)   // propietarios con facturar SI/PARCIAL (no Paola, no cerrados)

  // 5a) Registrar en liquidacion_facturado las líneas realmente emitidas (idempotente por mes+idadmon).
  if (emitidasRegistro.length) {
    const rows = emitidasRegistro.map(l => ({ mes, idadmon: l.idadmon, idprop: l.idprop, monto: numOf(l.monto), tipo: l.tipo, fecha_emision: nowIso }))
    try { await sb.from('liquidacion_facturado').upsert(rows, { onConflict: 'mes,idadmon' }) } catch (e) { resumen.registroError = (e?.message || 'registro').slice(0, 200) }
  }

  // 5a-bis) BITÁCORA append-only: se INSERTA (nunca upsert ni delete) todo lo emitido, con usuario y hora.
  //         Es la constancia de auditoría de facturación; sobrevive aunque se limpie liquidacion_facturado.
  if (emitidasLog.length) {
    const rows = emitidasLog.map(l => ({
      mes, idadmon: l.idadmon, idprop: l.idprop, propietario: l.propietario, inmueble: l.inmueble,
      monto: numOf(l.monto), iva: numOf(l.iva), tipo: l.tipo, documento: l.documento,
      formato, es_complementaria: !!l.es_complementaria, usuario: email, generado_en: nowIso,
    }))
    try { await sb.from('liquidacion_facturado_log').insert(rows) } catch (e) { resumen.bitacoraError = (e?.message || 'bitacora').slice(0, 200) }
  }

  // 5b) Estado por propietario. "algo facturado" = ya lo estaba (registro) o se emitió ahora.
  //     Queda PARCIAL si a ese propietario le sigue quedando alguna línea EN ESPERA; si no, HECHO.
  const emitidosAhora = new Set(idpropsFacturados)
  let nParciales = 0, nHechos = 0
  for (const idprop of setSIfinal) {
    const algoFacturado = yaFactPropSet.has(idprop) || emitidosAhora.has(idprop)
    if (!algoFacturado) continue   // nada emitido aún (p. ej. todo en espera): se deja como estaba (SI)
    const facturables = facturablesPorProp[idprop] || new Set()
    const quedaEnEspera = [...facturables].some(id => retSet.has(id))
    const nuevoEstado = quedaEnEspera ? 'PARCIAL' : 'HECHO'
    await sb.from('liquidacion_idprop').update({ facturar: nuevoEstado, fecha_emision: nowIso, updated_at: nowIso })
      .eq('mes', mes).eq('idprop', idprop)
    if (quedaEnEspera) nParciales++; else nHechos++
  }
  resumen.parciales = nParciales
  resumen.hechos = nHechos
  // Marcar las complementarias incluidas como facturadas (no se vuelven a facturar).
  if (complIncluidas.length) {
    await sb.from('liquidacion_complementaria')
      .update({ estado: 'facturada', actualizado_at: nowIso }).in('id', complIncluidas)
  }

  resumen.enEspera = nEnEspera
  resumen.complementarias = complIncluidas.length
  resumen.reemitidos = reemitidos   // idadmon que YA estaban en la bitácora de este mes: posible re-emisión (doble cobro)
  const avisos = []
  if (nEnEspera > 0) avisos.push(`${nEnEspera} línea(s) en espera se excluyeron (se facturan en la complementaria al cobrar)`)
  if (complIncluidas.length > 0) avisos.push(`${complIncluidas.length} complementaria(s) incluida(s) y marcada(s) como facturadas`)
  if (reemitidos.length > 0) avisos.push(`⚠️ ${reemitidos.length} idadmon YA figuran facturados este mes en la bitácora (posible doble cobro): ${reemitidos.join(', ')}`)
  if (avisos.length) resumen.aviso = avisos.join('. ') + '.'

  resumen.formato = formato
  return Response.json({ ok: true, mes, formato, facturas_csv, boletas_csv, nubox_csv, resumen })
}
