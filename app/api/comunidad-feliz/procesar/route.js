import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function norm(s) {
  if (!s) return ''
  return String(s).trim().toLowerCase()
}

export async function POST(req) {
  try {
    const { archivoCFId, archivoCorId, mesClave, aamm, mesLabel } = await req.json()

    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS)
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.readonly']
    })
    const drive = google.drive({ version: 'v3', auth })

    // --- Leer archivo CF ---
    const cfRes = await drive.files.get(
      { fileId: archivoCFId, alt: 'media' },
      { responseType: 'arraybuffer' }
    )
    const wbCF = XLSX.read(cfRes.data, { type: 'array', cellDates: true })
    const wsName = wbCF.SheetNames.find(n => n.toLowerCase().includes('datos') || n.toLowerCase().includes('cf')) || wbCF.SheetNames[0]
    const dataCF = XLSX.utils.sheet_to_json(wbCF.Sheets[wsName], { raw: false })

    // Normalizar CF — columnas: FERCHA/FECHA, COMUNIDAD, INMUEBLE, DEUDA
    const cfMap = {}
    let fechaExtraccion = null
    for (const row of dataCF) {
      const comunidad = row['COMUNIDAD'] || row['Comunidad'] || ''
      const inmueble = String(row['INMUEBLE'] || row['Inmueble'] || '').trim()
      const deuda = parseFloat(String(row['DEUDA'] || row['Deuda'] || '0').replace(/[^0-9.-]/g,'')) || 0
      const fecha = row['FERCHA'] || row['FECHA'] || row['Fecha'] || ''
      if (fecha && !fechaExtraccion) {
        fechaExtraccion = String(fecha).substring(0, 10)
      }
      const key = norm(comunidad) + '||' + norm(inmueble)
      cfMap[key] = { deuda, fecha: fechaExtraccion, comunidad, inmueble }
    }

    // --- Cargar correspondencias desde Supabase ---
    const { data: corrRows, error: corrErr } = await supabase
      .from('cf_correspondencias')
      .select('*')
      .eq('activo', true)

    if (corrErr) throw new Error('Error cargando correspondencias: ' + corrErr.message)

    // Si hay archivo de correspondencias en Drive, también leerlo y mergear
    let corrNuevas = []
    if (archivoCorId) {
      const corrRes = await drive.files.get(
        { fileId: archivoCorId, alt: 'media' },
        { responseType: 'arraybuffer' }
      )
      const wbCorr = XLSX.read(corrRes.data, { type: 'array' })
      const dataCorr = XLSX.utils.sheet_to_json(wbCorr.Sheets[wbCorr.SheetNames[0]], { raw: false })
      // Detectar columnas
      for (const row of dataCorr) {
        const keys = Object.keys(row)
        const comunidad = row['Comunidad'] || row[keys[0]] || ''
        const inmueble = row['Inmueble'] || row[keys[1]] || ''
        const idinmue = row['IDINMUE'] || row['Idinmue'] || ''
        const idadmon = row['IDADMON ACTUAL'] || row['IDADMON'] || ''
        const propietario = row['PROPIETARIO'] || ''
        const estado = row['ESTADO'] || ''
        if (idadmon && !String(idadmon).startsWith('=') && !String(idadmon).startsWith('#')) {
          corrNuevas.push({ comunidad_cf: String(comunidad).trim(), inmueble_cf: String(inmueble).trim(),
            idinmue: String(idinmue).trim(), idadmon: String(idadmon).trim(),
            propietario: String(propietario).trim(), estado: String(estado).trim(), activo: true })
        }
      }
    }

    // Construir mapa de correspondencias: key → row
    const corrMap = {}
    for (const c of corrRows) {
      const key = norm(c.comunidad_cf) + '||' + norm(c.inmueble_cf)
      corrMap[key] = c
    }
    // Mergear nuevas (del archivo) — detectar nuevas no en Supabase
    const nuevasParaInsertar = []
    for (const c of corrNuevas) {
      const key = norm(c.comunidad_cf) + '||' + norm(c.inmueble_cf)
      if (!corrMap[key]) {
        corrMap[key] = c
        nuevasParaInsertar.push(c)
      }
    }

    // --- Cruce ---
    const filas = []
    let conMatch = 0, sinMatch = 0, nuevos = 0

    for (const [key, corr] of Object.entries(corrMap)) {
      if (!['S','P'].includes(corr.estado)) continue

      const cfRow = cfMap[key]
      const match = !!cfRow

      let observacion = ''
      if (!match) {
        observacion = 'No encontrado en CF'
        sinMatch++
      } else {
        conMatch++
      }

      filas.push({
        idadmon: corr.idadmon,
        idinmue: corr.idinmue,
        estado: corr.estado,
        propietario: corr.propietario,
        comunidad_cf: corr.comunidad_cf,
        inmueble_cf: corr.inmueble_cf,
        deuda: match ? Math.round(cfRow.deuda) : null,
        fecha: match ? cfRow.fecha : null,
        match,
        nuevo: false,
        observacion
      })
    }

    // Detectar inmuebles en CF sin correspondencia (nuevos)
    for (const [key, cfRow] of Object.entries(cfMap)) {
      if (!corrMap[key] && cfRow.deuda > 0) {
        nuevos++
        filas.push({
          idadmon: null,
          idinmue: null,
          estado: null,
          propietario: null,
          comunidad_cf: cfRow.comunidad,
          inmueble_cf: cfRow.inmueble,
          deuda: Math.round(cfRow.deuda),
          fecha: cfRow.fecha,
          match: false,
          nuevo: true,
          observacion: 'En CF pero sin correspondencia — revisar'
        })
      }
    }

    // Insertar nuevas correspondencias en Supabase si las hay
    if (nuevasParaInsertar.length > 0) {
      await supabase.from('cf_correspondencias').upsert(nuevasParaInsertar, {
        onConflict: 'comunidad_cf,inmueble_cf'
      })
    }

    const stats = { total: filas.length, conMatch, sinMatch, nuevos }

    return Response.json({ filas, stats, fechaExtraccion })
  } catch (e) {
    console.error(e)
    return Response.json({ error: e.message }, { status: 500 })
  }
}
