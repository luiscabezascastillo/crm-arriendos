// lib/scraping-servicios.js
// Funciones de scraping para ENEL, Aguas Andinas, Metrogas, Abastible, Gasco

const BROWSERLESS_WS = `wss://production-sfo.browserless.io?token=${process.env.BROWSERLESS_API_KEY}`
const EXCLUIR = ['estacionamiento','bodega','llega con ggcc','llega con g.c','pendiente ubicar','']

async function conectar() {
  const puppeteer = (await import('puppeteer-core')).default
  const browser = await puppeteer.connect({
    browserWSEndpoint: BROWSERLESS_WS,
    defaultViewport: { width: 1280, height: 800 }
  })
  return browser
}

// ─── ENEL (vía API directa de Servipag, sin navegador) ───────────────────────
// Mecanismo de la API de Servipag:
//  1) POST /portal/bill/v3/query/  con empresa + número de cliente → devuelve queryId
//  2) GET  /portal/bill/v3/query/{queryId}/lastcall/false (polling) → se repite
//     hasta que data[0].queryStatus === 1 ("Busqueda finalizada con Exito")
//  3) Se leen data[0].totalAmount (deuda) y data[0].expirationDate (vencimiento)
// Llamada HTTP directa desde el servidor (CORS no aplica). Enel = company 107, category 14.

const SERVIPAG_BASE = 'https://portal.servipag.com/portal/bill/v3/query/'
const ENEL_COMPANY_ID = 107
const ENEL_CATEGORY_ID = 14

export async function consultarEnel(codigo) {
  if (!codigo || EXCLUIR.includes(codigo.toLowerCase().trim())) return { omitido: true }
  const identifier = codigo.trim()

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Origin': 'https://portal.servipag.com',
    'Referer': 'https://portal.servipag.com/paymentexpress/category/luz/company/enel',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  }

  try {
    // Paso 1: registrar la consulta, obtener queryId
    const bodyInicial = {
      bill: {
        company: { id: ENEL_COMPANY_ID },
        category: { id: ENEL_CATEGORY_ID },
        type: 'standard',
        metaData: [{ name: 'identifier', value: identifier }],
      },
      queryId: '',
    }

    const r1 = await fetch(SERVIPAG_BASE, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyInicial),
    })
    if (!r1.ok) return { error: `Servipag paso 1 HTTP ${r1.status}` }
    const j1 = await r1.json()
    const queryId = j1?.data?.queryId
    if (!queryId) return { error: 'Servipag no devolvió queryId', textoDebug: JSON.stringify(j1).slice(0, 300) }

    // Paso 2: polling hasta queryStatus === 1
    const pollUrl = `${SERVIPAG_BASE}${queryId}/lastcall/false`
    const MAX_INTENTOS = 15
    let registro = null

    for (let intento = 0; intento < MAX_INTENTOS; intento++) {
      await new Promise((res) => setTimeout(res, 1000))
      const rp = await fetch(pollUrl, { method: 'GET', headers })
      if (!rp.ok) continue
      const jp = await rp.json()
      const fila = Array.isArray(jp?.data) ? jp.data[0] : null
      if (fila && Number(fila.queryStatus) === 1) {
        registro = fila
        break
      }
    }

    if (!registro) return { deuda: null, fecha: null, error: 'Tiempo agotado o cuenta no encontrada' }

    // Paso 3: leer deuda y vencimiento
    const deuda = Number(registro.totalAmount) || 0
    const fecha = registro.expirationDate || null

    return {
      deuda,
      fecha,
      sinDeuda: deuda === 0,
      direccion: registro.invoiceAddress || null,
      empresa: registro.company?.name || null,
    }
  } catch (e) {
    return { error: e.message }
  }
}

// ─── AGUAS ANDINAS ───────────────────────────────────────────────────────────
export async function consultarAguasAndinas(codigo) {
  if (!codigo || EXCLUIR.includes(codigo.toLowerCase().trim())) return { omitido: true }
  const browser = await conectar()
  try {
    const page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    await page.goto('https://www.aguasandinas.cl/web/aguasandinas/pagar-mi-cuenta', {
      waitUntil: 'networkidle2', timeout: 30000
    })
    await page.waitForSelector('input', { timeout: 15000 })
    await page.evaluate((cod) => {
      const inputs = document.querySelectorAll('input[type="text"], input[type="number"], input:not([type])')
      for (const inp of inputs) {
        const hint = (inp.placeholder || inp.name || inp.id || '').toLowerCase()
        if (hint.includes('cuenta') || hint.includes('número') || hint.includes('numero') || hint.includes('cliente')) {
          inp.value = cod
          inp.dispatchEvent(new Event('input', { bubbles: true }))
          inp.dispatchEvent(new Event('change', { bubbles: true }))
          break
        }
      }
    }, codigo)
    await page.evaluate(() => {
      const btns = document.querySelectorAll('button, input[type="submit"], a')
      for (const btn of btns) {
        const txt = (btn.textContent || btn.value || '').toLowerCase()
        if (txt.includes('buscar') || txt.includes('consultar') || txt.includes('pagar')) { btn.click(); break }
      }
    })
    await new Promise(r => setTimeout(r, 4000))
    const resultado = await page.evaluate(() => {
      const body = document.body.innerText
      if (body.toLowerCase().includes('sin deuda') || body.toLowerCase().includes('no tiene deuda')) {
        const fechaMatch = body.match(/(\d{1,2}\/\d{1,2}\/\d{4})/)
        return { deuda: 0, fecha: fechaMatch?.[1] || null, sinDeuda: true }
      }
      const montoMatch = body.match(/\$\s*([\d.,]+)/) ||
                         body.match(/[Tt]otal[^$\d]*\$\s*([\d.,]+)/)
      const fechaMatch = body.match(/(\d{1,2}\/\d{1,2}\/\d{4})/)
      if (montoMatch) {
        const monto = parseInt(montoMatch[1].replace(/\./g,'').replace(',',''))
        return { deuda: monto, fecha: fechaMatch?.[1] || null }
      }
      return { deuda: null, fecha: null, textoDebug: body.substring(0, 500) }
    })
    return resultado
  } catch(e) {
    return { error: e.message }
  } finally {
    await browser.close()
  }
}

// ─── METROGAS ────────────────────────────────────────────────────────────────
export async function consultarMetrogas(codigo) {
  if (!codigo || EXCLUIR.includes(codigo.toLowerCase().trim())) return { omitido: true }
  const browser = await conectar()
  try {
    const page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
    await page.goto('https://www.metrogas.cl/clientes/pagar-mi-cuenta/', {
      waitUntil: 'networkidle2', timeout: 30000
    })
    await page.waitForSelector('input', { timeout: 15000 })
    await page.evaluate((cod) => {
      const inputs = document.querySelectorAll('input[type="text"], input[type="number"]')
      for (const inp of inputs) {
        if (inp.offsetParent !== null) {
          inp.value = cod
          inp.dispatchEvent(new Event('input', { bubbles: true }))
          inp.dispatchEvent(new Event('change', { bubbles: true }))
          break
        }
      }
    }, codigo)
    await page.keyboard.press('Enter')
    await new Promise(r => setTimeout(r, 4000))
    const resultado = await page.evaluate(() => {
      const body = document.body.innerText
      if (body.toLowerCase().includes('sin deuda') || body.toLowerCase().includes('no registra deuda')) {
        return { deuda: 0, fecha: null, sinDeuda: true }
      }
      const montoMatch = body.match(/\$\s*([\d.,]+)/)
      const fechaMatch = body.match(/(\d{1,2}\/\d{1,2}\/\d{4})/)
      if (montoMatch) {
        return { deuda: parseInt(montoMatch[1].replace(/\./g,'').replace(',','')), fecha: fechaMatch?.[1] || null }
      }
      return { deuda: null, fecha: null, textoDebug: body.substring(0, 500) }
    })
    return resultado
  } catch(e) {
    return { error: e.message }
  } finally {
    await browser.close()
  }
}

// ─── ABASTIBLE ───────────────────────────────────────────────────────────────
export async function consultarAbastible(codigo) {
  if (!codigo || EXCLUIR.includes(codigo.toLowerCase().trim())) return { omitido: true }
  const codigoSinDV = codigo.includes('-') ? codigo.split('-')[0] : codigo
  const browser = await conectar()
  try {
    const page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
    await page.goto('https://webpay.abastible.cl/', {
      waitUntil: 'networkidle2', timeout: 30000
    })
    await page.waitForSelector('input', { timeout: 15000 })
    await page.evaluate((cod) => {
      const inputs = document.querySelectorAll('input[type="text"]')
      if (inputs[0]) {
        inputs[0].value = cod
        inputs[0].dispatchEvent(new Event('input', { bubbles: true }))
        inputs[0].dispatchEvent(new Event('change', { bubbles: true }))
      }
    }, codigoSinDV)
    await page.keyboard.press('Enter')
    await new Promise(r => setTimeout(r, 4000))
    const resultado = await page.evaluate(() => {
      const body = document.body.innerText
      const montoMatch = body.match(/\$\s*([\d.,]+)/)
      const fechaMatch = body.match(/(\d{1,2}\/\d{1,2}\/\d{4})/)
      if (body.toLowerCase().includes('sin deuda')) return { deuda: 0, fecha: null, sinDeuda: true }
      if (montoMatch) return { deuda: parseInt(montoMatch[1].replace(/\./g,'').replace(',','')), fecha: fechaMatch?.[1] || null }
      return { deuda: null, fecha: null, textoDebug: body.substring(0, 500) }
    })
    return resultado
  } catch(e) {
    return { error: e.message }
  } finally {
    await browser.close()
  }
}

// ─── GASCO ───────────────────────────────────────────────────────────────────
export async function consultarGasco(codigo) {
  if (!codigo || EXCLUIR.includes(codigo.toLowerCase().trim())) return { omitido: true }
  const browser = await conectar()
  try {
    const page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
    await page.goto('https://www.gasco.cl/pago-en-linea', {
      waitUntil: 'networkidle2', timeout: 30000
    })
    await page.waitForSelector('input', { timeout: 15000 })
    await page.evaluate((cod) => {
      const inputs = document.querySelectorAll('input[type="text"]')
      if (inputs[0]) {
        inputs[0].value = cod
        inputs[0].dispatchEvent(new Event('input', { bubbles: true }))
      }
    }, codigo)
    await page.keyboard.press('Enter')
    await new Promise(r => setTimeout(r, 4000))
    const resultado = await page.evaluate(() => {
      const body = document.body.innerText
      const montoMatch = body.match(/\$\s*([\d.,]+)/)
      const fechaMatch = body.match(/(\d{1,2}\/\d{1,2}\/\d{4})/)
      if (body.toLowerCase().includes('sin deuda')) return { deuda: 0, fecha: null, sinDeuda: true }
      if (montoMatch) return { deuda: parseInt(montoMatch[1].replace(/\./g,'').replace(',','')), fecha: fechaMatch?.[1] || null }
      return { deuda: null, fecha: null, textoDebug: body.substring(0, 500) }
    })
    return resultado
  } catch(e) {
    return { error: e.message }
  } finally {
    await browser.close()
  }
}

// ─── ROUTER ──────────────────────────────────────────────────────────────────
export async function consultarServicio(tipo, codigo, compania) {
  if (!codigo || EXCLUIR.includes((codigo || '').toLowerCase().trim())) return { omitido: true }
  switch(tipo) {
    case 'luz':  return consultarEnel(codigo)
    case 'agua': return consultarAguasAndinas(codigo)
    case 'gas': {
      const comp = (compania || '').toUpperCase()
      if (comp.includes('METROGAS')) return consultarMetrogas(codigo)
      if (comp.includes('ABASTIBLE')) return consultarAbastible(codigo)
      if (comp.includes('GASCO')) return consultarGasco(codigo)
      return { error: `Compañía de gas desconocida: ${compania}` }
    }
    default: return { error: `Tipo desconocido: ${tipo}` }
  }
}