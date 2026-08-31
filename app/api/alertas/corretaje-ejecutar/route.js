// VERSION: v5 · 2026-08-31 · Salida CSV NUBOX (20 col, formato del mensual generar-csv). Corretaje = servicio
//   PUNTUAL: TIPOSERVICIO y PERIODO en blanco. GIRO 'CORRETAJE INMOBILIARIO' (como SimpleFactura). Se mantienen
//   los CSV SimpleFactura; se AÑADE nubox_csv. Precio: factura(33) NETO / boleta(39) BRUTO. Hereda v4.
// VERSION: v4 · 2026-08-06 · Fix anti-duplicado del descuento de corretaje: ahora EXCLUYE los anulados
//   (mes_a_imputar='----MES'). Antes, un corretaje anulado bloqueaba la re-facturación → la factura salía
//   pero el descuento NO se creaba (caso A00888/A00873: solo quedaban sus anulados 5173/5175). Se mantiene
//   el candado para no duplicar descuentos ACTIVOS. Hereda v3.
// VERSION: v3 · 2026-08-04 · El descuento de corretaje ahora incluye texto_para_contabilidad (misma fórmula que el alta normal: "{num} {idadmon} CORRETAJES PROPIETARIO {texto}"), mmdd y fecha_contable. Antes salía vacío el Texto contab. Hereda v2 (fix IVA neto en CSV).
//   no el total. SimpleFactura AÑADE el IVA (IndicadorExento=0), así la factura queda en el total del LOG.
//   Antes se pasaba el total (ya con IVA) y SimpleFactura lo volvía a multiplicar por 1.19. El descuento al
//   propietario y el cargo al arrendatario siguen siendo el TOTAL con IVA.
//   (1) crea el descuento de corretaje al PROPIETARIO (CORRETAJES, comision_d_total, mes en curso) —
//   anti-duplicado; (2) si Karina lo marca, crea el cargo COMISION del arrendatario en cuentas
//   (comision_a_total); (3) genera el/los CSV SimpleFactura (33 factura / 39 boleta) para propietario
//   y arrendatario, mismo formato de 38 columnas que /api/liquidaciones/generar-csv; (4) resuelve la
//   alerta. Solo Dirección y Karina.
// app/api/alertas/corretaje-ejecutar/route.js

import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { createClient } from '@supabase/supabase-js'

const EMAILS_OK = [
  'alberto.cabezas@fondocapital.com',
  'luis.cabezas@fondocapital.com',
  'karina.morales@fondocapital.com',
]

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
}
const n0 = v => { const x = Number(v); return Number.isFinite(x) ? Math.round(x) : 0 }
const MESES_TXT = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
function mesLiquidacionEnCurso() {
  const d = new Date()
  return `${MESES_TXT[d.getMonth()]} ${d.getFullYear()}`   // "AGOSTO 2026"
}
function fechaHoy() {
  const d = new Date()
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}
function sinAcentos(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/ñ/g, 'n').replace(/Ñ/g, 'N')
    .replace(/;/g, ' ').replace(/\r?\n/g, ' ').trim()
}

// 38 columnas SimpleFactura (idénticas a /api/liquidaciones/generar-csv)
const COLUMNAS = ['Id', 'TipoDte', 'FmaPago', 'FechaEmision', 'Vencimiento', 'RutRecep', 'GiroRecep', 'Contacto', 'CorreoRecep', 'DirRecep', 'CmnaRecep', 'CiudadRecep', 'RazonSocialRecep', 'DirDest', 'CmnaDest', 'CiudadDest', 'ReferenciaTpoDocRef', 'ReferenciaFolioRef', 'ReferenciaFchRef', 'ReferenciaRazonRef', 'ReferenciaCodigo', 'CodigoProducto', 'NombreProducto', 'DescripcionProducto', 'CantidadProducto', 'PrecioProducto', 'UnidadMedidaProducto', 'DescuentoProducto', 'RecargoProducto', 'RebajaAvaluo', 'IndicadorExento', 'TotalProducto', 'GlosaDR', 'TpoMov', 'TpoValor', 'ValorDR', 'ValorOtrMnda', 'IndExeDR']
function filaCSV(obj) { return COLUMNAS.map(c => obj[c] != null ? String(obj[c]) : '').join(';') }

// Construye una línea de CSV para un receptor (propietario o arrendatario)
function lineaReceptor({ id, tipo, rut, razon, correo, direccion, monto, idadmon, inmueble }) {
  const fecha = fechaHoy()
  return filaCSV({
    Id: String(id),
    TipoDte: tipo,                         // 33 factura / 39 boleta
    FmaPago: '2',
    FechaEmision: fecha,
    Vencimiento: fecha,
    RutRecep: rut || '',
    GiroRecep: 'CORRETAJE INMOBILIARIO',
    CorreoRecep: correo || '',
    DirRecep: sinAcentos(direccion),
    CmnaRecep: '',                         // comuna omitida (acordado)
    CiudadRecep: 'SANTIAGO',
    RazonSocialRecep: sinAcentos(razon),
    NombreProducto: 'CORRETAJE',
    DescripcionProducto: sinAcentos(`Corretaje inicio contrato ${idadmon}-${inmueble}`),
    CantidadProducto: '1',
    PrecioProducto: String(monto),
    UnidadMedidaProducto: 'UN',
    DescuentoProducto: '0',
    RecargoProducto: '0',
    RebajaAvaluo: '0',
    IndicadorExento: '0',
    TotalProducto: String(monto),
  })
}

// 20 columnas del CSV de Nubox (Cargar Ventas desde Archivo), idénticas al mensual (generar-csv).
// FOLIO = correlativo de documento (1,2,3...) que Nubox exige; con "Folios automatico" asigna el folio real del SII.
const NUBOX_COLS = ['TIPO', 'FOLIO', 'SECUENCIA', 'FECHA', 'RUT', 'RAZONSOCIAL', 'GIRO', 'COMUNA', 'DIRECCION', 'AFECTO', 'PRODUCTO', 'DESCRIPCION', 'CANTIDAD', 'PRECIO', 'PORCENTDSCTO', 'EMAIL', 'TIPOSERVICIO', 'PERIODODESDE', 'PERIODOHASTA', 'FECHAVENCIMIENTO']
function filaNubox(obj) { return NUBOX_COLS.map(c => obj[c] != null ? String(obj[c]) : '').join(';') }
// Una línea Nubox para un receptor. Corretaje = puntual: TIPOSERVICIO y PERIODO vacíos.
function lineaNubox({ folio, tipo, rut, razon, comuna, direccion, correo, precio, idadmon, inmueble }) {
  const fecha = fechaHoy()
  return filaNubox({
    TIPO: tipo, FOLIO: String(folio), SECUENCIA: '1', FECHA: fecha,
    RUT: rut || '', RAZONSOCIAL: sinAcentos(razon), GIRO: 'CORRETAJE INMOBILIARIO',
    COMUNA: sinAcentos(comuna), DIRECCION: sinAcentos(direccion), AFECTO: 'SI',
    PRODUCTO: 'CORRETAJE', DESCRIPCION: sinAcentos(`Corretaje inicio contrato ${idadmon}-${inmueble}`),
    CANTIDAD: '1', PRECIO: String(precio), PORCENTDSCTO: '0', EMAIL: correo || '',
    TIPOSERVICIO: '', PERIODODESDE: '', PERIODOHASTA: '', FECHAVENCIMIENTO: fecha,
  })
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return Response.json({ error: 'No autenticado' }, { status: 401 })
  if (!EMAILS_OK.includes(email)) return Response.json({ error: 'Solo Dirección y Karina.' }, { status: 403 })

  let body = {}
  try { body = await req.json() } catch {}
  const idadmon = String(body.idadmon || '').trim()
  const alertaId = body.alerta_id || null
  const crearCargoArr = body.crear_cargo_arrendatario === true
  const tipoArr = String(body.tipo_arrendatario || '39').trim()   // 33/39 elegido por Karina
  if (!idadmon) return Response.json({ error: 'Falta idadmon' }, { status: 400 })

  const sb = svc()
  const resultado = { idadmon, descuento: null, cargo: null, csv: {}, alerta: null, avisos: [] }

  // --- Releer ficha (fuente de verdad para montos y datos) ---
  const { data: da, error: eDa } = await sb.from('datos_arriendos')
    .select('idadmon, idprop, propietario, arrendatario, inmueble, rut, mail_arrendatario, comision_d_total, comision_a_total, comision_d_base, comision_a_base')
    .eq('idadmon', idadmon).maybeSingle()
  if (eDa || !da) return Response.json({ error: 'No se pudo leer datos_arriendos: ' + (eDa?.message || 'no existe') }, { status: 500 })

  const comisionProp = n0(da.comision_d_total)   // TOTAL con IVA: para el descuento al propietario
  const comisionArr = n0(da.comision_a_total)    // TOTAL con IVA: para el cargo en cartola
  // NETO (sin IVA) para el CSV de SimpleFactura, que AÑADE el IVA (IndicadorExento=0).
  // Si no hubiera base guardada, se deriva del total (/1.19) como respaldo.
  const netoProp = n0(da.comision_d_base) || Math.round(comisionProp / 1.19)
  const netoArr = n0(da.comision_a_base) || Math.round(comisionArr / 1.19)

  // ============ 1) DESCUENTO al propietario (CORRETAJES) ============
  if (comisionProp > 0) {
    // anti-duplicado: SOLO cuenta descuentos de corretaje ACTIVOS. Los ANULADOS (mes_a_imputar='----MES')
    // NO bloquean, para que un corretaje anulado y vuelto a facturar SÍ recree el descuento.
    const { data: yaDesc } = await sb.from('descuentos')
      .select('num').eq('idadmon', idadmon).eq('tipo', 'CORRETAJES')
      .neq('mes_a_imputar', '----MES').limit(1)
    if (yaDesc && yaDesc.length) {
      resultado.descuento = { creado: false, motivo: 'ya_existe', num: yaDesc[0].num }
      resultado.avisos.push(`Ya existía un descuento de corretaje activo (Nº ${yaDesc[0].num}); no se ha duplicado.`)
    } else {
      // num correlativo
      const { data: maxRow } = await sb.from('descuentos').select('num').order('id', { ascending: false }).limit(200)
      let maxNum = 0; (maxRow || []).forEach(r => { const x = parseInt(r.num, 10); if (Number.isFinite(x) && x > maxNum) maxNum = x })
      const num = String(maxNum + 1)
      const mesTxt = mesLiquidacionEnCurso()
      const texto = `Corretaje por gestión de arriendo — inicio de contrato ${idadmon}`
      // Texto de contabilidad: misma fórmula que el alta normal de descuentos.
      const textoContab = `${num} ${idadmon} CORRETAJES PROPIETARIO ${texto}`
      // mmdd y fecha contable del mes en curso (criterio FCR: día 7)
      const _hoy = new Date()
      const _mm = _hoy.getMonth() + 1, _yyyy = _hoy.getFullYear()
      const _mmdd = `${String(_yyyy).slice(2)}${String(_mm).padStart(2, '0')}`
      const _fechaContable = `${String(_mm).padStart(2, '0')}/07/${_yyyy}`
      const fila = {
        num,
        fecha: new Date().toLocaleDateString('es-CL'),
        mes_a_imputar: mesTxt,
        ingresado_por: 'SISTEMA',
        idadmon,
        inmueble: da.inmueble || '',
        propietario: da.propietario || '',
        repercutir_a: 'PROPIETARIO',
        monto_a_imputar: String(comisionProp),   // positivo = se le descuenta al propietario
        tipo: 'CORRETAJES',
        texto_explicativo_para_carta_a_propietario: texto,
        texto_para_contabilidad: textoContab,
        mmdd: _mmdd,
        fecha_contable: _fechaContable,
        creado_por: email,
        creado_at: new Date().toISOString(),
        verificado: false,
        origen: 'corretaje_inicio',
      }
      const { data: ins, error: eIns } = await sb.from('descuentos').insert(fila).select().single()
      if (eIns) { resultado.descuento = { creado: false, error: eIns.message }; resultado.avisos.push('No se pudo crear el descuento: ' + eIns.message) }
      else {
        resultado.descuento = { creado: true, num: ins.num, monto: comisionProp }
        // bitácora (si falla, no rompe)
        try { await sb.from('descuentos_bitacora').insert({ descuento_id: ins.id, num: ins.num, accion: 'crear', campo: null, valor_anterior: null, valor_nuevo: null, usuario: email }) } catch {}
      }
    }
  } else {
    resultado.avisos.push('El propietario no tiene comisión (comision_d_total = 0); no se crea descuento.')
  }

  // ============ 2) CARGO del arrendatario en cartola (si Karina lo pide) ============
  if (crearCargoArr && comisionArr > 0) {
    const { data: yaCargo } = await sb.from('cuentas')
      .select('id').eq('idadmon', idadmon).ilike('concepto', '%COMISION%').limit(1)
    if (yaCargo && yaCargo.length) {
      resultado.cargo = { creado: false, motivo: 'ya_existe' }
      resultado.avisos.push('El cargo de comisión del arrendatario ya existía en cartola; no se ha duplicado.')
    } else {
      const filaCargo = {
        fecha: fechaHoy(),
        idadmon,
        concepto: 'COMISION',
        cargo: comisionArr,
        estado: 'S',
        propietario: da.propietario || '',
        inmueble: da.inmueble || '',
        updated_at: new Date().toISOString(),
      }
      const { error: eCar } = await sb.from('cuentas').insert(filaCargo)
      if (eCar) { resultado.cargo = { creado: false, error: eCar.message }; resultado.avisos.push('No se pudo crear el cargo del arrendatario: ' + eCar.message) }
      else resultado.cargo = { creado: true, monto: comisionArr }
    }
  }

  // ============ 3) CSV SimpleFactura (propietario + arrendatario) ============
  const filasFactura = []   // 33
  const filasBoleta = []    // 39/41
  let idF = 0, idB = 0
  const filasNubox = []     // Nubox (20 col, 1 CSV)
  let docNubox = 0          // correlativo de documento para el FOLIO de Nubox

  // Propietario
  if (comisionProp > 0) {
    const { data: p } = await sb.from('propietarios')
      .select('propietario, rut, mail1, email_2, direccion, comuna, tipo_factura').eq('idprop', da.idprop || '').maybeSingle()
    const tipoP = (p?.tipo_factura || '33').trim()
    const linea = lineaReceptor({
      id: tipoP === '33' ? ++idF : ++idB, tipo: tipoP,
      rut: p?.rut, razon: `${da.idprop}-${p?.propietario || da.propietario}`,
      correo: p?.mail1 || p?.email_2, direccion: p?.direccion,
      monto: netoProp, idadmon, inmueble: da.inmueble,   // NETO: SimpleFactura añade el IVA
    })
    if (tipoP === '33') filasFactura.push(linea); else filasBoleta.push(linea)
    filasNubox.push(lineaNubox({
      folio: ++docNubox, tipo: tipoP, rut: p?.rut,
      razon: `${da.idprop}-${p?.propietario || da.propietario}`,
      comuna: p?.comuna, direccion: p?.direccion, correo: p?.mail1 || p?.email_2,
      precio: tipoP === '33' ? netoProp : comisionProp,   // factura NETO / boleta BRUTO
      idadmon, inmueble: da.inmueble,
    }))
  }
  // Arrendatario (si aplica)
  if (comisionArr > 0) {
    const tipoA = tipoArr === '33' ? '33' : '39'
    const linea = lineaReceptor({
      id: tipoA === '33' ? ++idF : ++idB, tipo: tipoA,
      rut: da.rut, razon: da.arrendatario, correo: da.mail_arrendatario,
      direccion: da.inmueble, monto: netoArr, idadmon, inmueble: da.inmueble,   // NETO: SimpleFactura añade el IVA
    })
    if (tipoA === '33') filasFactura.push(linea); else filasBoleta.push(linea)
    filasNubox.push(lineaNubox({
      folio: ++docNubox, tipo: tipoA, rut: da.rut, razon: da.arrendatario,
      comuna: '', direccion: da.inmueble, correo: da.mail_arrendatario,
      precio: tipoA === '33' ? netoArr : comisionArr,   // factura NETO / boleta BRUTO
      idadmon, inmueble: da.inmueble,
    }))
    resultado.avisos.push('Boleta/factura del arrendatario generada: verifica en cartolas que el cargo del arrendatario ya está registrado.')
  }
  const cab = COLUMNAS.join(';')
  resultado.csv = {
    facturas_csv: filasFactura.length ? [cab, ...filasFactura].join('\r\n') : '',
    boletas_csv: filasBoleta.length ? [cab, ...filasBoleta].join('\r\n') : '',
    nubox_csv: filasNubox.length ? [NUBOX_COLS.join(';'), ...filasNubox].join('\r\n') : '',
  }
  if (resultado.descuento?.creado) resultado.avisos.push('Recuerda: la factura/boleta del propietario lleva asociado el descuento de corretaje creado en la liquidación.')

  // ============ 4) RESOLVER la alerta ============
  if (alertaId) {
    const { error: eAl } = await sb.from('alertas')
      .update({ estado: 'resuelta', resuelta_at: new Date().toISOString(), resuelta_por: email })
      .eq('id', alertaId)
    resultado.alerta = eAl ? { resuelta: false, error: eAl.message } : { resuelta: true }
  }

  return Response.json({ ok: true, ...resultado })
}