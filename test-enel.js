// ============================================================
// test-enel.js  -  PRUEBA DECISIVA de ENEL directo + 2captcha
// ------------------------------------------------------------
// Corre en TU PC (Node), no en Vercel, para usar tu IP residencial.
// Para UN solo codigo: pide token a 2captcha y hace el POST a ENEL.
// Imprime status + cabeceras + cuerpo, pase lo que pase.
//
// USO (PowerShell, en la carpeta del proyecto para que lea .env.local):
//   node test-enel.js 3030190-0
//
// Si no pasas codigo, usa 3030190-0 por defecto.
// ============================================================

// --- Leer TWOCAPTCHA_API_KEY de .env.local (sin dependencias extra) ---
const fs = require('fs')
const path = require('path')

function leerEnv(clave) {
  // 1) variable de entorno ya cargada
  if (process.env[clave]) return process.env[clave]
  // 2) buscar en .env.local del directorio actual
  try {
    const envPath = path.join(process.cwd(), '.env.local')
    const txt = fs.readFileSync(envPath, 'utf8')
    const linea = txt.split(/\r?\n/).find(l => l.startsWith(clave + '='))
    if (linea) return linea.slice(clave.length + 1).trim()
  } catch (e) {}
  return null
}

const TWOCAPTCHA_API_KEY = leerEnv('TWOCAPTCHA_API_KEY')
const ENEL_SITE_KEY = '6LeORoMUAAAAACZSDgr4cfCzNdcFoy5vzlLT7zib'
const ENEL_PAGE_URL = 'https://www.enel.cl/es/clientes/servicios-en-linea/pago-de-cuenta.html'
const ENEL_POST_URL = 'https://www.enel.cl/es/clientes/servicios-en-linea/pago-de-cuenta.mdwedgeohl.getDebtsCl.html'

const codigo = (process.argv[2] || '3030190-0').trim()

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// --- 2captcha: crear tarea (reCAPTCHA Enterprise) ---
async function solicitarTarea() {
  const url = `https://2captcha.com/in.php?key=${TWOCAPTCHA_API_KEY}`
    + `&method=userrecaptcha&googlekey=${ENEL_SITE_KEY}`
    + `&pageurl=${encodeURIComponent(ENEL_PAGE_URL)}`
    + `&enterprise=1&json=1`
  const res = await fetch(url)
  const data = await res.json()
  if (data.status !== 1) throw new Error('2captcha in.php: ' + data.request)
  return data.request
}

// --- 2captcha: esperar el token resuelto ---
async function obtenerToken(taskId) {
  const MAX = 24 // 24 * 5s = 2 min
  for (let i = 0; i < MAX; i++) {
    await sleep(5000)
    const url = `https://2captcha.com/res.php?key=${TWOCAPTCHA_API_KEY}`
      + `&action=get&id=${taskId}&json=1`
    const res = await fetch(url)
    const data = await res.json()
    if (data.status === 1) return data.request
    if (data.request !== 'CAPCHA_NOT_READY') throw new Error('2captcha res.php: ' + data.request)
    process.stdout.write(`   ...esperando captcha (${(i + 1) * 5}s)\r`)
  }
  throw new Error('2captcha timeout (2 min sin resolver)')
}

// --- POST a ENEL con el token ---
async function consultarEnel(codigoCliente, token) {
  const form = new URLSearchParams()
  form.append('searchType', 'nro_suministro')
  form.append('client', codigoCliente)
  form.append('g-recaptcha-response', token)
  form.append('company', '1')
  form.append('minutesT', 'TIME-SLOT-4')

  const res = await fetch(ENEL_POST_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'accept': 'application/json, text/plain, */*',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'origin': 'https://www.enel.cl',
      'referer': ENEL_PAGE_URL,
    },
    body: form.toString(),
  })
  return res
}

async function main() {
  console.log('==============================================')
  console.log(' PRUEBA ENEL DIRECTO + 2captcha')
  console.log('==============================================')
  if (!TWOCAPTCHA_API_KEY) {
    console.error('ERROR: no encuentro TWOCAPTCHA_API_KEY.')
    console.error('Ejecuta este script desde la carpeta del proyecto (donde esta .env.local),')
    console.error('o define la variable antes de correrlo.')
    process.exit(1)
  }
  console.log('Codigo a consultar :', codigo)
  console.log('2captcha key        : ...' + TWOCAPTCHA_API_KEY.slice(-4) + ' (ok, cargada)')
  console.log('')

  try {
    console.log('[1/3] Pidiendo captcha a 2captcha...')
    const taskId = await solicitarTarea()
    console.log('      tarea creada, id =', taskId)

    console.log('[2/3] Esperando token resuelto (puede tardar 15-40s)...')
    const token = await obtenerToken(taskId)
    console.log('\n      token recibido (' + token.length + ' chars): ' + token.slice(0, 40) + '...')

    console.log('[3/3] POST a ENEL...')
    const res = await consultarEnel(codigo, token)

    console.log('')
    console.log('==============================================')
    console.log(' RESPUESTA DE ENEL')
    console.log('==============================================')
    console.log('STATUS:', res.status, res.statusText)
    console.log('')
    console.log('--- CABECERAS ---')
    res.headers.forEach((v, k) => console.log(`  ${k}: ${v}`))
    console.log('')
    console.log('--- CUERPO (primeros 1500 chars) ---')
    const texto = await res.text()
    console.log(texto.slice(0, 1500))
    console.log('')
    console.log('==============================================')

    // Interpretacion rapida
    if (res.status === 403) {
      console.log('DIAGNOSTICO: 403 -> Akamai/ENEL bloquea la peticion (aunque el captcha sea valido).')
      console.log('             Desde TU PC deberia pasar; si da 403 aqui, ENEL bloquea por completo.')
    } else if (res.status === 200) {
      console.log('DIAGNOSTICO: 200 -> ENEL RESPONDIO. Revisa el cuerpo: si trae debtAmount/dueDate, FUNCIONA.')
    } else {
      console.log('DIAGNOSTICO: status', res.status, '-> revisa cabeceras y cuerpo arriba.')
    }
  } catch (e) {
    console.error('')
    console.error('FALLO:', e.message)
  }
}

main()