import { google } from 'googleapis'
import { NextResponse } from 'next/server'

const credentials = JSON.parse(
  process.env.GOOGLE_CREDENTIALS || '{}'
)

export async function POST(request) {
  try {
    const datos = await request.json()

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })

    const sheets = google.sheets({ version: 'v4', auth })
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID

    // Buscar si ya existe una fila con ese IDADMON en la hoja DATOS
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'DATOS!A:A',
    })

    const filas = response.data.values || []
    let filaIndex = filas.findIndex(f => f[0] === datos.idadmon)

    const fila = [
      datos.idadmon,
      datos.estado,
      datos.propietario,
      datos.propietario_rut,
      datos.propietario_email,
      datos.propietario_telefono,
      datos.direccion,
      datos.comuna,
      datos.moneda,
      datos.monto,
      datos.ajuste,
      datos.fecha_comienzo,
      datos.fecha_fin,
      datos.arrendatario_nombre,
      datos.arrendatario_rut,
      datos.arrendatario_email,
      datos.arrendatario_telefono,
      datos.aval_nombre,
      datos.aval_email,
      datos.aval_telefono,
      datos.garantia,
      datos.admon_tipo,
      datos.admon_cuota,
      datos.comentarios,
      datos.hecho,
    ]

    if (filaIndex === -1) {
      // No existe — añadir nueva fila al final
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'DATOS!A:A',
        valueInputOption: 'RAW',
        requestBody: { values: [fila] },
      })
    } else {
      // Ya existe — actualizar esa fila
      const filaReal = filaIndex + 1
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `DATOS!A${filaReal}:Y${filaReal}`,
        valueInputOption: 'RAW',
        requestBody: { values: [fila] },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error Google Sheets:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}