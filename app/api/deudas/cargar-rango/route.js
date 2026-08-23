// VERSION: v3 · 2026-08-23 · Lee la hoja 'GGCC-AGUA-LUZ-DESCUENTOS' (no la [0], que es CODIGOS) y el diagnóstico
//   vuelca las primeras filas de esa hoja (`ggccFilas`) para ver título/cabeceras reales. Hereda v2.
// VERSION: v2 · 2026-08-23 · Añade DIAGNÓSTICO: la respuesta incluye qué AAMM existen realmente en el Excel
//   (`aammEnExcel`), cuántas filas van sin AAMM y una muestra, para localizar dónde están los meses históricos.
//   Hereda v1.
// VERSION: v1 · 2026-08-23 · Carga MASIVA de meses históricos de GGCC/servicios a la tabla viva `ggcc_agua_luz`.
//   Reutiliza la lógica de deudas/cargar-excel pero recorre una LISTA de AAMM (descarga el Excel del Drive una
//   sola vez). Para cada mes reporta: filas del Excel, idadmon únicos, y DUPLICADOS (mismo idadmon+idinmue+mes
//   con >1 fila = "dos vistas del mismo mes") — sin pisar nada raro: el upsert deduplica (última gana).
//   NO alimenta servicios_codigos (es carga histórica; no debe tocar los códigos vigentes).
//   POST { aamms: ['2501','2502',...] }
import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const FOLDER_ID = '1qE47HbwpDg32hkMUJIxRuWTRNA6Uhj47'
const ARCHIVO = 'BD_LOG_ARRENDATARIOS.xlsx'

function limpia(v) {
  if (v === null || v === undefined || v === '') return null
  const s = String(v).trim()
  if (s === '' || s === '-' || s === 'N/A') return null
  return s
}
const aammDe = r => String(r['AAMM'] || r['aamm'] || '').trim().replace(/^'+/, '').replace(/\s/g, '')

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}))
    const aamms = Array.isArray(body.aamms) ? body.aamms.map(a => String(a).trim()) : []
    if (!aamms.length) return Response.json({ error: 'Pasa aamms: ["2501","2502",...]' }, { status: 400 })

    // Descargar el Excel del Drive UNA vez
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS)
    const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/drive.readonly'] })
    const drive = google.drive({ version: 'v3', auth })
    const res = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and name='${ARCHIVO}' and trashed=false`,
      fields: 'files(id,name)', supportsAllDrives: true, includeItemsFromAllDrives: true, corpora: 'allDrives',
    })
    const archivo = res.data.files?.[0]
    if (!archivo) return Response.json({ error: `No se encontró ${ARCHIVO} en Drive` }, { status: 404 })
    const fileRes = await drive.files.get({ fileId: archivo.id, alt: 'media' }, { responseType: 'arraybuffer' })
    const wb = XLSX.read(fileRes.data, { type: 'array', cellDates: true })
    const HOJA_GGCC = 'GGCC-AGUA-LUZ-DESCUENTOS'
    const ws = wb.Sheets[HOJA_GGCC] || wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { raw: false, defval: null })
    // Rejilla cruda (primeras filas) para ver título/cabeceras reales de la hoja GGCC
    const grid = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: null })
    const ggccFilas = grid.slice(0, 16).map(r => (r || []).map(c => c === null ? '' : String(c)).slice(0, 14))

    const mapFila = r => ({
      mes:                     limpia(r['MES'] || r['mes']),
      idadmon:                 limpia(r['IDADMON'] || r['idadmon']),
      estado:                  limpia(r['ESTADO'] || r['estado']),
      idinmue:                 limpia(r['IDINMUE'] || r['idinmue']),
      edificio_proyecto:       limpia(r['EDIFICIO / PROYECTO'] || r['edificio_proyecto']),
      propietariio:            limpia(r['PROPIETARIIO'] || r['propietario']),
      inmueble:                limpia(r['INMUEBLE'] || r['inmueble']),
      aamm:                    limpia(r['AAMM'] || r['aamm']),
      arrendatario:            limpia(r['ARRENDATARIO'] || r['arrendatario']),
      deuda_gastos_comunes:    limpia(r['DEUDA GASTOS COMUNES'] || r['deuda_gastos_comunes']),
      fecha_hecho_ggcc:        limpia(r['FECHA HECHO GGCC'] || r['fecha_hecho_ggcc']),
      meses:                   limpia(r['MESES'] || r['meses']),
      comentarios_se_han_dejado_los_comentarios_mes_anterior: limpia(r['COMENTARIOS (SE HAN DEJADO LOS COMENTARIOS MES ANTERIOR)'] || r['comentarios_se_han_dejado_los_comentarios_mes_anterior']),
      deuda_vigente_electricidad: limpia(r[' DEUDA VIGENTE ELECTRICIDAD '] || r['DEUDA VIGENTE ELECTRICIDAD'] || r['deuda_vigente_electricidad']),
      codigo_ele:              limpia(r['CODIGO ELE'] || r['codigo_ele']),
      fecha_hecho_luz:         limpia(r['FECHA HECHO LUZ'] || r['fecha_hecho_luz']),
      comentarios_y_fecha_corte: limpia(r['COMENTARIOS Y FECHA CORTE'] || r['comentarios_y_fecha_corte']),
      deuda_vigente_agua:      limpia(r[' DEUDA VIGENTE AGUA '] || r['DEUDA VIGENTE AGUA'] || r['deuda_vigente_agua']),
      codigo_agua:             limpia(r['CODIGO AGUA'] || r['codigo_agua']),
      deuda_anterior_agua:     limpia(r[' DEUDA ANTERIOR AGUA '] || r['DEUDA ANTERIOR AGUA'] || r['deuda_anterior_agua']),
      fecha_hecho_agua:        limpia(r['FECHA HECHO AGUA'] || r['fecha_hecho_agua']),
      deuda_vigente_gas:       limpia(r[' DEUDA VIGENTE '] || r['DEUDA VIGENTE'] || r['deuda_vigente_gas']),
      codigo_gas:              limpia(r['CODIGO GAS'] || r['codigo_gas']),
      deuda_anterior_gas:      limpia(r['DEUDA ANTERIOR2'] || r['deuda_anterior_gas']),
      fecha_hecho_gas:         limpia(r['FECHA HECHO GAS'] || r['fecha_hecho_gas']),
      updated_at:              new Date().toISOString(),
    })

    // DIAGNÓSTICO: qué AAMM hay realmente y filas sin AAMM (para localizar los históricos)
    const aammEnExcel = [...new Set(rows.map(r => aammDe(r)).filter(Boolean))].sort()
    const filasSinAamm = rows.filter(r => !aammDe(r) && (r['IDADMON'] || r['idadmon']))
    const sinAammMuestra = filasSinAamm.slice(0, 10).map(r => ({ mes: r['MES'] || r['mes'] || null, idadmon: r['IDADMON'] || r['idadmon'] || null }))
    const diagnostico = { hojaLeida: (wb.Sheets[HOJA_GGCC] ? HOJA_GGCC : wb.SheetNames[0]), hojas: wb.SheetNames, aammEnExcel, filasSinAamm: filasSinAamm.length, sinAammMuestra, ggccFilas }

    const reporte = []
    for (const aamm of aamms) {
      const filtradas = rows.filter(r => aammDe(r) === aamm)
      if (!filtradas.length) { reporte.push({ aamm, filasExcel: 0, cargadas: 0, aviso: 'sin filas en el Excel' }); continue }

      const rows_db = filtradas.map(mapFila).filter(r => r.idadmon)

      // Detectar DUPLICADOS: mismo (idadmon|idinmue|mes) con >1 fila (posible "dos vistas del mismo mes")
      const conteo = new Map()
      for (const r of rows_db) {
        const k = `${r.idadmon}||${r.idinmue || ''}||${r.mes || ''}`
        conteo.set(k, (conteo.get(k) || 0) + 1)
      }
      const duplicados = [...conteo.entries()].filter(([, n]) => n > 1)
        .map(([k, n]) => { const [idadmon, idinmue, mes] = k.split('||'); return { idadmon, idinmue, mes, veces: n } })

      // Upsert (la clave única deduplica: última gana)
      let cargadas = 0
      const BATCH = 50
      for (let i = 0; i < rows_db.length; i += BATCH) {
        const lote = rows_db.slice(i, i + BATCH)
        const { error } = await supabase.from('ggcc_agua_luz').upsert(lote, { onConflict: 'idadmon,idinmue,mes' })
        if (error) return Response.json({ error: `Mes ${aamm}, lote ${Math.floor(i/BATCH)+1}: ${error.message}`, reporteParcial: reporte }, { status: 500 })
        cargadas += lote.length
      }

      reporte.push({
        aamm, mes: rows_db[0]?.mes || null,
        filasExcel: filtradas.length, cargadas,
        idadmonUnicos: new Set(rows_db.map(r => r.idadmon)).size,
        duplicados: duplicados.length ? duplicados : undefined,
      })
    }

    const conDuplicados = reporte.filter(r => r.duplicados)
    return Response.json({ ok: true, diagnostico, reporte, mesesConDuplicados: conDuplicados.map(r => r.aamm) })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
