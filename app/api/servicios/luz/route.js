// app/api/servicios/luz/route.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const TWOCAPTCHA_API_KEY = process.env.TWOCAPTCHA_API_KEY
const ENEL_SITE_KEY = '6LeORoMUAAAAACZSDgr4cfCzNdcFoy5vzlLT7zib'
const ENEL_PAGE_URL = 'https://www.enel.cl/es/clientes/servicios-en-linea/pago-de-cuenta.html'

function esCodigoENELvalido(codigo) {
  if (!codigo) return false
  return /^[\d-]+$/.test(codigo.trim())
}

async function obtenerTokenDe2captcha() {
  const inRes = await fetch(
    `https://2captcha.com/in.php?key=${TWOCAPTCHA_API_KEY}&method=userrecaptcha&googlekey=${ENEL_SITE_KEY}&pageurl=${ENEL_PAGE_URL}&enterprise=1&json=1`
  )
  const inData = await inRes.json()
  if (inData.status !== 1) throw new Error(`2captcha crear tarea: ${inData.request}`)
  const taskId = inData.request
  for (let i = 0; i < 24; i++) {
    await new Promise(r => setTimeout(r, 5000))
    const outRes = await fetch(
      `https://2captcha.com/res.php?key=${TWOCAPTCHA_API_KEY}&action=get&id=${taskId}&json=1`
    )
    const outData = await outRes.json()
    if (outData.status === 1) return outData.request
    if (outData.request !== 'CAPCHA_NOT_READY') throw new Error(`2captcha: ${outData.request}`)
  }
  throw new Error('2captcha timeout')
}

async function guardar(mes, idadmon, idinmue, deuda, fecha) {
  const { error } = await supabase
    .from('ggcc_agua_luz')
    .update({
      deuda_vigente_electricidad: deuda,
      fecha_hecho_luz: fecha,
      updated_at: new Date().toISOString(),
    })
    .eq('mes', mes)
    .eq('idadmon', idadmon)
    .eq('idinmue', idinmue)
  if (error) throw new Error(error.message)
}

export async function POST(request) {
  try {
    const body = await request.json()

    if (body.action === 'get_token') {
      if (!TWOCAPTCHA_API_KEY) {
        return Response.json({ error: 'TWOCAPTCHA_API_KEY no configurada' }, { status: 500 })
      }
      const token = await obtenerTokenDe2captcha()
      return Response.json({ token })
    }

    if (body.action === 'guardar') {
      const { mes, idadmon, idinmue, deuda, fecha } = body
      await guardar(mes, idadmon, idinmue, deuda, fecha)
      return Response.json({ ok: true })
    }

    return Response.json({ error: 'Acción no reconocida' }, { status: 400 })

  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

// GET /api/servicios/luz?mes=MAYO 2026&solo_pendientes=true
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const mes = searchParams.get('mes')
    const soloPendientes = searchParams.get('solo_pendientes') === 'true'

    if (!mes) return Response.json({ error: 'Parámetro mes requerido' }, { status: 400 })

    let query = supabase
      .from('ggcc_agua_luz')
      .select('idadmon, idinmue, codigo_ele, deuda_vigente_electricidad, fecha_hecho_luz, edificio_proyecto, inmueble')
      .eq('mes', mes)
      .not('codigo_ele', 'is', null)
      .neq('codigo_ele', '')
      .not('idinmue', 'like', '.%')
      .order('idadmon')

    if (soloPendientes) {
      query = query.is('fecha_hecho_luz', null)
    }

    const { data, error } = await query
    if (error) return Response.json({ error: error.message }, { status: 500 })

    // Filtrar códigos no válidos (bodega, estacionamiento, etc.)
    const filtrado = (data || []).filter(row => {
      if (!row.codigo_ele) return false
      return /^[\d-]+$/.test(row.codigo_ele.trim())
    })

    return Response.json({ codigos: filtrado, total: filtrado.length })

  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}