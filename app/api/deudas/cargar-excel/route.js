// VERSION: v2 · 2026-08-17 · Además de cargar en ggcc_agua_luz, alimenta la fuente única `servicios_codigos`
//   (códigos luz/agua/gas por idinmue): fusión sin borrar (un código en blanco en el Excel NO pisa el que ya
//   había). Así los meses nuevos heredan los códigos aunque cambien los contratos. Hereda v1.
import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const FOLDER_ID = '1qE47HbwpDg32hkMUJIxRuWTRNA6Uhj47'
const ARCHIVO = 'BD_LOG_ARRENDATARIOS.xlsx'

const MESES_NOMBRES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO',
                       'JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE']

function limpia(v) {
  if (v === null || v === undefined || v === '') return null
  const s = String(v).trim()
  if (s === '' || s === '-' || s === 'N/A') return null
  return s
}

export async function POST(req) {
  try {
    const { mes } = await req.json()
    if (!mes) return Response.json({ error: 'Falta el mes' }, { status: 400 })

    // Calcular AAMM desde el mes (ej: "MAYO 2026" → "2605")
    const mesFiltro = mes.toUpperCase().trim()
    const partes = mesFiltro.split(' ')
    const numMes = String(MESES_NOMBRES.indexOf(partes[0]) + 1).padStart(2, '0')
    const anio = partes[1] ? partes[1].slice(2) : ''
    const aamm = anio + numMes  // "2605"

    console.log('Buscando mes:', mesFiltro, '→ AAMM:', aamm)

    // Conectar Drive
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS)
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.readonly']
    })
    const drive = google.drive({ version: 'v3', auth })

    // Buscar archivo
    const res = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and name='${ARCHIVO}' and trashed=false`,
      fields: 'files(id,name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      corpora: 'allDrives'
    })

    const archivo = res.data.files?.[0]
    if (!archivo) return Response.json({ error: `No se encontró ${ARCHIVO} en Drive` }, { status: 404 })

    console.log('Archivo encontrado:', archivo.name, archivo.id)

    // Descargar archivo
    const fileRes = await drive.files.get(
      { fileId: archivo.id, alt: 'media' },
      { responseType: 'arraybuffer' }
    )

    // Leer Excel
    const wb = XLSX.read(fileRes.data, { type: 'array', cellDates: true })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { raw: false, defval: null })

    console.log('Total filas leídas:', rows.length)
    console.log('Últimas 3 filas:', JSON.stringify(rows.slice(-3).map(r => ({ aamm: r['AAMM'], mes: r['MES'] }))))
    console.log('Muestra AAMM valores únicos:', [...new Set(rows.map(r => r['AAMM']).filter(Boolean))].slice(-5))

    // Filtrar por AAMM
    const filtradas = rows.filter(r => {
      const a = String(r['AAMM'] || r['aamm'] || '').trim().replace(/^'+/, '').replace(/\s/g, '')
      return a === aamm
    })

    console.log('Filas filtradas para', aamm, ':', filtradas.length)

    if (filtradas.length === 0) {
      return Response.json({ 
        error: `No se encontraron filas para el mes: ${mes} (AAMM: ${aamm})`,
        totalFilas: rows.length,
        aammDisponibles: [...new Set(rows.map(r => r['AAMM']).filter(Boolean))].slice(-8)
      }, { status: 404 })
    }

    // Mapear a columnas Supabase
    const rows_db = filtradas.map(r => ({
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
      updated_at:              new Date().toISOString()
    })).filter(r => r.idadmon)

    // Upsert en lotes de 50
    let insertados = 0
    const BATCH = 50
    for (let i = 0; i < rows_db.length; i += BATCH) {
      const lote = rows_db.slice(i, i + BATCH)
      const { error } = await supabase
        .from('ggcc_agua_luz')
        .upsert(lote, { onConflict: 'idadmon,idinmue,mes' })
      if (error) throw new Error(`Lote ${Math.floor(i/BATCH)+1}: ${error.message}`)
      insertados += lote.length
    }

    // ── Fuente única de códigos por idinmue (Opción A) ──────────────────────────────────
    // Se alimenta desde el Excel, pero SIN BORRAR: un código en blanco no pisa el que ya existía.
    // Así los meses nuevos heredan el código (Enel/Aguas/Gas) aunque cambie el contrato (idadmon).
    try {
      const porInmueble = new Map()
      for (const r of rows_db) {
        const idinmue = String(r.idinmue || '').trim()
        if (!idinmue) continue
        const prev = porInmueble.get(idinmue) || { idinmue }
        if (r.codigo_ele)  prev.codigo_ele  = r.codigo_ele
        if (r.codigo_agua) prev.codigo_agua = r.codigo_agua
        if (r.codigo_gas)  prev.codigo_gas  = r.codigo_gas
        if (r.inmueble)    prev.inmueble    = r.inmueble
        porInmueble.set(idinmue, prev)
      }
      const idinmues = [...porInmueble.keys()]
      if (idinmues.length) {
        const { data: existentes } = await supabase
          .from('servicios_codigos')
          .select('idinmue, codigo_ele, codigo_agua, codigo_gas, inmueble')
          .in('idinmue', idinmues)
        const ex = new Map((existentes || []).map(c => [c.idinmue, c]))
        const upserts = []
        for (const [idinmue, nuevo] of porInmueble) {
          const p = ex.get(idinmue) || {}
          const fila = {
            idinmue,
            codigo_ele:  nuevo.codigo_ele  ?? p.codigo_ele  ?? null,
            codigo_agua: nuevo.codigo_agua ?? p.codigo_agua ?? null,
            codigo_gas:  nuevo.codigo_gas  ?? p.codigo_gas  ?? null,
            inmueble:    nuevo.inmueble    ?? p.inmueble    ?? null,
            updated_at:  new Date().toISOString(),
          }
          // Solo si aporta algún código (no crear filas vacías).
          if (fila.codigo_ele || fila.codigo_agua || fila.codigo_gas) upserts.push(fila)
        }
        for (let i = 0; i < upserts.length; i += 100) {
          await supabase.from('servicios_codigos').upsert(upserts.slice(i, i + 100), { onConflict: 'idinmue' })
        }
      }
    } catch (e) {
      console.error('cargar-excel: no se pudo alimentar servicios_codigos:', e.message)
      // No se bloquea la carga principal si esto falla.
    }

    return Response.json({
      ok: true,
      mes,
      aamm,
      totalExcel: filtradas.length,
      insertados,
      archivo: archivo.name
    })

  } catch(e) {
    console.error('cargar-excel error:', e)
    return Response.json({ error: e.message }, { status: 500 })
  }
}
