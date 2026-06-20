import { NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabaseClient'
import { google } from 'googleapis'

const FOLDER_ID = '1zg3-H02UMhkVVDlF3OZjoE18x0eLLiXh'

function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}')
  return new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.file',
    ],
  })
}

async function buscarArchivo(drive, prefijo) {
  const res = await drive.files.list({
    q: `'${FOLDER_ID}' in parents and name contains '${prefijo}' and mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' and trashed=false`,
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  return res.data.files?.[0] || null
}

async function descargarArchivo(drive, fileId) {
  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' }
  )
  return Buffer.from(res.data)
}

async function subirADrive(drive, fileId, buffer) {
  const { Readable } = await import('stream')
  const stream = Readable.from(buffer)
  await drive.files.update({
    fileId,
    media: {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      body: stream,
    },
    supportsAllDrives: true,
  })
}

function extraerRut(detalle) {
  const m = String(detalle || '').trim().match(/^(\d{7,10}[Kk]?)/)
  return m ? m[1].toUpperCase() : ''
}

function normalizar(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ').trim().toUpperCase()
    .replace(/^\d+[Kk]?\s*/, '')
    .replace(/^TRANSF[\. ]+/, '')
    .replace(/^DE\s+/, '')
}

function similitud(a, b) {
  const ta = new Set(a.split(' ').filter(x => x.length > 2))
  const tb = new Set(b.split(' ').filter(x => x.length > 2))
  if (ta.size === 0 || tb.size === 0) return 0
  const comunes = [...ta].filter(t => tb.has(t)).length
  const union = new Set([...ta, ...tb]).size
  return comunes >= 2 ? (comunes / union) * 100 + 10 : (comunes / union) * 100
}

// GET — listar archivos disponibles en Drive
export async function GET() {
  try {
    const auth = getAuth()
    const drive = google.drive({ version: 'v3', auth })
    const res = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' and trashed=false`,
      fields: 'files(id, name, modifiedTime)',
      orderBy: 'name desc',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })
    return NextResponse.json({ ok: true, files: res.data.files || [] })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST — procesar liquidación
export async function POST(request) {
  try {
    const { mes, controlId, cartolaId, guardarEnDrive } = await request.json()
    const auth = getAuth()
    const drive = google.drive({ version: 'v3', auth })

    // Buscar archivos — por IDs específicos o por mes
    let controlBuffer, cartolaBuffer, controlName, cartolaName
    let controlFileId = controlId // guardamos el ID para poder sobreescribir

    if (controlId && cartolaId) {
      const [cb, lb] = await Promise.all([
        descargarArchivo(drive, controlId),
        descargarArchivo(drive, cartolaId),
      ])
      controlBuffer = cb; cartolaBuffer = lb
    } else {
      const prefijoMes = mes || new Date().toISOString().slice(0, 7)
      const [controlFile, cartolaFile] = await Promise.all([
        buscarArchivo(drive, `${prefijoMes}-Control`),
        buscarArchivo(drive, `${prefijoMes}-Cartola`),
      ])
      if (!controlFile) return NextResponse.json({ error: `No se encontró Control para ${prefijoMes} en Drive` }, { status: 404 })
      if (!cartolaFile) return NextResponse.json({ error: `No se encontró Cartola para ${prefijoMes} en Drive` }, { status: 404 })
      controlName = controlFile.name; cartolaName = cartolaFile.name
      controlFileId = controlFile.id
      const [cb, lb] = await Promise.all([
        descargarArchivo(drive, controlFile.id),
        descargarArchivo(drive, cartolaFile.id),
      ])
      controlBuffer = cb; cartolaBuffer = lb
    }

    // Parsear Excel
    const XLSX = await import('xlsx')
    const wbControl = XLSX.read(controlBuffer, { type: 'buffer', cellDates: true })
    const hojaLiq = wbControl.SheetNames.find(n => n.toUpperCase().includes('LIQUIDACION')) || wbControl.SheetNames[0]
    const rawLiq = XLSX.utils.sheet_to_json(wbControl.Sheets[hojaLiq], { header: 1, defval: null })
    const wbCartola = XLSX.read(cartolaBuffer, { type: 'buffer', cellDates: true })
    const rawCart = XLSX.utils.sheet_to_json(wbCartola.Sheets[wbCartola.SheetNames[0]], { header: 1, defval: null })

    // Extraer contratos (fila 3+)
    const contratos = []
    for (let i = 3; i < rawLiq.length; i++) {
      const row = rawLiq[i]
      if (!row[1] || typeof row[1] !== 'string' || !row[1].startsWith('A')) break
      contratos.push({
        filaExcel: i + 1, idadmon: row[1],
        propiedad: row[2] || '', arrendatario: row[5] || '',
        aCobrar: row[7] || null,
      })
    }

    // Cuotas Supabase
    const { data: supaData } = await supabase
      .from('datos_arriendos').select('idadmon, cuota, unid')
      .in('idadmon', contratos.map(c => c.idadmon))
    const cuotaMap = {}
    for (const r of supaData || []) cuotaMap[r.idadmon] = r

    // BD Pagadores Supabase
    const { data: pagadoresDB } = await supabase.from('pagadores').select('*')
    const rutMap = {}
    for (const p of pagadoresDB || []) {
      if (p.rut_sin_puntos) rutMap[p.rut_sin_puntos.toUpperCase()] = p
    }

    // Extraer abonos cartola
    const abonos = []
    for (let i = 3; i < rawCart.length; i++) {
      const row = rawCart[i]
      if (!row[0]) continue
      const monto = Number(row[3] || 0)
      if (monto > 10) abonos.push({ fecha: row[0], detalle: String(row[1] || ''), monto, rut: extraerRut(row[1]) })
    }

    // Cruzar abonos con contratos
    const pagosMap = {}
    const sinIdentificar = []

    for (const abono of abonos) {
      let encontrado = null, confianza = null, metodo = null

      // 1. Por RUT
      if (abono.rut && rutMap[abono.rut]) {
        const p = rutMap[abono.rut]
        const ids = [p.idadmon1, p.idadmon2, p.idadmon3, p.idadmon4, p.idadmon5].filter(Boolean)
        const posibles = ids.filter(id => contratos.find(c => c.idadmon === id))
        if (posibles.length === 1) {
          encontrado = posibles[0]; confianza = 'alta'; metodo = 'rut'
        } else if (posibles.length > 1) {
          const exacto = posibles.find(id => {
            const c = contratos.find(c => c.idadmon === id)
            const ac = cuotaMap[id]?.cuota || c?.aCobrar
            return ac && Math.abs(Number(ac) - abono.monto) < 1000
          })
          encontrado = exacto || posibles[0]
          confianza = exacto ? 'media' : 'baja'; metodo = 'rut-multi'
        }
      }

      // 2. Por similitud nombre
      if (!encontrado) {
        const detNorm = normalizar(abono.detalle)
        let mejorScore = 0, mejorId = null
        for (const c of contratos) {
          const score = similitud(detNorm, normalizar(c.arrendatario))
          if (score > mejorScore) { mejorScore = score; mejorId = c.idadmon }
        }
        if (mejorScore >= 65) {
          encontrado = mejorId
          confianza = mejorScore >= 85 ? 'alta' : 'media'; metodo = 'nombre'
        }
      }

      // 3. Por monto
      if (!encontrado) {
        const porMonto = contratos.find(c => {
          const ac = cuotaMap[c.idadmon]?.cuota || c.aCobrar
          return ac && Math.abs(Number(ac) - abono.monto) < 500
        })
        if (porMonto) { encontrado = porMonto.idadmon; confianza = 'sugerida'; metodo = 'monto' }
      }

      if (encontrado) {
        if (!pagosMap[encontrado]) pagosMap[encontrado] = []
        pagosMap[encontrado].push({ ...abono, confianza, metodo })
      } else {
        sinIdentificar.push(abono)
      }
    }

    // Resultado por contrato
    const resultado = contratos.map(c => {
      const supaInfo = cuotaMap[c.idadmon]
      const aCobrar = supaInfo?.cuota || c.aCobrar || null
      const pagos = pagosMap[c.idadmon] || []
      const totalRecibido = pagos.reduce((s, p) => s + p.monto, 0)
      const faltaMes = aCobrar ? Math.max(0, Number(aCobrar) - totalRecibido) : null
      const fechas = pagos.map(p => p.fecha instanceof Date ? p.fecha.toLocaleDateString('es-CL') : String(p.fecha).slice(0, 10))
      const confianza = pagos.length > 0
        ? (pagos.every(p => p.confianza === 'alta') ? 'alta'
          : pagos.every(p => p.confianza === 'sugerida') ? 'sugerida' : 'media')
        : null
      return {
        filaExcel: c.filaExcel, idadmon: c.idadmon,
        propiedad: c.propiedad, arrendatario: c.arrendatario,
        aCobrar: aCobrar ? Number(aCobrar) : null, unid: supaInfo?.unid || '',
        recibido: totalRecibido || null, faltaMes, fechas, confianza, pagos,
      }
    })

    // Generar Excel de salida
    const wbOut = XLSX.read(controlBuffer, { type: 'buffer', cellDates: true })
    const wsOut = wbOut.Sheets[hojaLiq]
    for (const r of resultado) {
      const er = r.filaExcel - 1
      if (r.aCobrar !== null) wsOut[XLSX.utils.encode_cell({ r: er, c: 7 })] = { v: r.aCobrar, t: 'n' }
      if (r.recibido) wsOut[XLSX.utils.encode_cell({ r: er, c: 8 })] = { v: r.recibido, t: 'n' }
      if (r.faltaMes !== null) wsOut[XLSX.utils.encode_cell({ r: er, c: 9 })] = { v: r.faltaMes, t: 'n' }
      if (r.fechas.length > 0) wsOut[XLSX.utils.encode_cell({ r: er, c: 10 })] = { v: r.fechas.join(' / '), t: 's' }
      if (r.pagos.length > 0) {
        const det = r.pagos.map(p => `$${p.monto.toLocaleString('es-CL')} (${p.metodo}/${p.confianza})`).join(' + ')
        wsOut[XLSX.utils.encode_cell({ r: er, c: 17 })] = { v: det, t: 's' }
      }
    }
    const outBuffer = XLSX.write(wbOut, { type: 'buffer', bookType: 'xlsx' })

    // Guardar en Drive si se solicita
    let guardadoEnDrive = false
    if (guardarEnDrive && controlFileId) {
      await subirADrive(drive, controlFileId, outBuffer)
      guardadoEnDrive = true
    }

    return NextResponse.json({
      ok: true, mesLabel: hojaLiq, controlName, cartolaName,
      guardadoEnDrive,
      resultado, sinIdentificar,
      resumen: {
        totalContratos: resultado.length,
        identificados: resultado.filter(r => r.recibido).length,
        sinPago: resultado.filter(r => !r.recibido).length,
        sinIdentificar: sinIdentificar.length,
        totalRecibido: resultado.reduce((s, r) => s + (r.recibido || 0), 0),
        totalACobrar: resultado.reduce((s, r) => s + (r.aCobrar || 0), 0),
      },
      excelBase64: outBuffer.toString('base64'),
    })

  } catch (error) {
    console.error('Error liquidacion-paola:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
