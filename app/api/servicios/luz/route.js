// app/api/servicios/luz/route.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// POST /api/servicios/luz
// Body: { mes, aamm, recaptchaToken, codigos }
// - mes: 'MAYO 2026'
// - aamm: '2605'
// - recaptchaToken: token capturado del portal ENEL
// - codigos: array de { idadmon, idinmue, codigo_ele }
export async function POST(request) {
  try {
    const { mes, aamm, recaptchaToken, codigos } = await request.json()

    if (!recaptchaToken) {
      return Response.json({ error: 'Token reCAPTCHA requerido' }, { status: 400 })
    }
    if (!codigos || codigos.length === 0) {
      return Response.json({ error: 'No hay códigos para consultar' }, { status: 400 })
    }

    const resultados = []
    let exitosos = 0
    let fallidos = 0

    // Consultar cada código contra la API interna de ENEL
    for (const item of codigos) {
      const { idadmon, idinmue, codigo_ele } = item

      try {
        const formData = new URLSearchParams()
        formData.append('searchType', 'nro_suministro')
        formData.append('client', codigo_ele)
        formData.append('g-recaptcha-response', recaptchaToken)
        formData.append('company', '1')
        formData.append('minutesT', 'TIME-SLOT-4')

        const response = await fetch(
          'https://www.enel.cl/es/clientes/servicios-en-linea/pago-de-cuenta.mdwedgeohl.getDebtsCl.html',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Origin': 'https://www.enel.cl',
              'Referer': 'https://www.enel.cl/es/clientes/servicios-en-linea/pago-de-cuenta.html',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            body: formData.toString(),
          }
        )

        if (!response.ok) {
          resultados.push({ idadmon, idinmue, codigo_ele, status: 'error', mensaje: `HTTP ${response.status}` })
          fallidos++
          continue
        }

        const data = await response.json()

        // Interpretar respuesta ENEL
        // result: "OK" + beResultCode: "005" = sin deuda
        // result: "OK" + debtAmount presente = con deuda
        let deudaVigente = 0
        let fechaHecho = null
        let statusConsulta = 'ok'

        if (data.result === 'OK') {
          if (data.beResultCode === '005') {
            // Sin deuda vigente
            deudaVigente = 0
            fechaHecho = new Date().toISOString().split('T')[0]
          } else if (data.debtAmount !== undefined) {
            // Con deuda — ENEL devuelve el monto en pesos como número o string
            deudaVigente = parseFloat(String(data.debtAmount).replace(/[^0-9.]/g, '')) || 0
            fechaHecho = data.dueDate || new Date().toISOString().split('T')[0]
          } else {
            // Respuesta OK pero estructura inesperada — guardar raw para debugging
            statusConsulta = 'ok_unknown'
            deudaVigente = 0
          }
        } else {
          // getDebts KO u otro error de negocio
          statusConsulta = 'error_negocio'
          fallidos++
          resultados.push({ idadmon, idinmue, codigo_ele, status: statusConsulta, raw: data })
          continue
        }

        // Actualizar ggcc_agua_luz
        const { error: upsertError } = await supabase
          .from('ggcc_agua_luz')
          .update({
            deuda_vigente_electricidad: deudaVigente,
            fecha_hecho_luz: fechaHecho,
            updated_at: new Date().toISOString(),
          })
          .eq('mes', mes)
          .eq('idadmon', idadmon)
          .eq('idinmue', idinmue)

        if (upsertError) {
          resultados.push({ idadmon, idinmue, codigo_ele, status: 'error_db', mensaje: upsertError.message })
          fallidos++
        } else {
          resultados.push({ idadmon, idinmue, codigo_ele, status: 'ok', deuda: deudaVigente })
          exitosos++
        }

        // Pausa pequeña entre requests para no saturar ENEL
        await new Promise(r => setTimeout(r, 300))

      } catch (err) {
        resultados.push({ idadmon, idinmue, codigo_ele, status: 'error', mensaje: err.message })
        fallidos++
      }
    }

    return Response.json({
      total: codigos.length,
      exitosos,
      fallidos,
      resultados,
    })

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

// GET /api/servicios/luz?mes=MAYO 2026
// Devuelve los códigos pendientes de consultar para el mes
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const mes = searchParams.get('mes')

    if (!mes) {
      return Response.json({ error: 'Parámetro mes requerido' }, { status: 400 })
    }

    // Traer filas resumen (sin punto en idadmon) con codigo_ele del mes
    const { data, error } = await supabase
      .from('ggcc_agua_luz')
      .select('idadmon, idinmue, codigo_ele, deuda_vigente_electricidad, fecha_hecho_luz, edificio_proyecto, inmueble')
      .eq('mes', mes)
      .not('codigo_ele', 'is', null)
      .neq('codigo_ele', '')
      .order('idadmon')

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    // Filtrar filas detalle (idinmue con punto) — solo filas resumen por contrato
    const filtrado = data.filter(row => !row.idinmue?.startsWith('.'))

    return Response.json({ codigos: filtrado, total: filtrado.length })

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
