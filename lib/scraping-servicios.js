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

// ─── ENEL (vía API de Servipag ejecutada DENTRO de Browserless) ──────────────
// Servipag (Cloudflare) bloquea con 403 las llamadas directas desde la IP de
// Vercel (datacenter). Solución: ejecutar el fetch desde una página real abierta
// en portal.servipag.com vía Browserless, donde el origen y la IP son de navegador.
//
// Mecanismo de la API:
//  1) POST /portal/bill/v3/query/  con empresa + nº cliente → devuelve queryId
//  2) GET  /portal/bill/v3/query/{queryId}/lastcall/false (polling) → se repite
//     hasta que data[0].queryStatus === 1 ("Busqueda finalizada con Exito")
//  3) Se leen data[0].totalAmount (deuda) y data[0].expirationDate (vencimiento)
// Enel = company 107, category 14.

const SERVIPAG_BASE = 'https://portal.servipag.com/portal/bill/v3/query/'
const ENEL_COMPANY_ID = 107
const ENEL_CATEGORY_ID = 14

export async function consultarEnel(codigo) {
  if (!codigo || EXCLUIR.includes(codigo.toLowerCase().trim())) return { omitido: true }
  const identifier = codigo.trim()
  const browser = await conectar()
  try {
    const page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

    // Cargar la página real de Servipag para quedar en su origen (cookies + Cloudflare)
    await page.goto('https://portal.servipag.com/paymentexpress/category/luz/company/enel', {
      waitUntil: 'domcontentloaded', timeout: 30000
    })
    await new Promise(r => setTimeout(r, 2500))

    // Ejecutar POST + polling DESDE la página (fetch con el origen de Servipag)
    const resultado = await page.evaluate(async (params) => {
      const { base, companyId, categoryId, ident, maxIntentos } = params
      const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' }

      // Paso 1
      const bodyInicial = {
        bill: {
          company: { id: companyId },
          category: { id: categoryId },
          type: 'standard',
          metaData: [{ name: 'identifier', value: ident }],
        },
        queryId: '',
      }
      const r1 = await fetch(base, { method: 'POST', headers, body: JSON.stringify(bodyInicial), credentials: 'include' })
      if (!r1.ok) return { error: `Servipag paso 1 HTTP ${r1.status}` }
      const j1 = await r1.json()
      const queryId = j1 && j1.data ? j1.data.queryId : null
      if (!queryId) return { error: 'Servipag no devolvió queryId' }

      // Paso 2: polling
      const pollUrl = base + queryId + '/lastcall/false'
      let registro = null
      for (let i = 0; i < maxIntentos; i++) {
        await new Promise((res) => setTimeout(res, 1000))
        const rp = await fetch(pollUrl, { method: 'GET', headers, credentials: 'include' })
        if (!rp.ok) continue
        const jp = await rp.json()
        const fila = Array.isArray(jp && jp.data) ? jp.data[0] : null
        if (fila && Number(fila.queryStatus) === 1) { registro = fila; break }
      }
      if (!registro) return { error: 'Tiempo agotado o cuenta no encontrada' }

      // Paso 3
      return {
        totalAmount: registro.totalAmount,
        expirationDate: registro.expirationDate,
        invoiceAddress: registro.invoiceAddress,
        companyName: registro.company ? registro.company.name : null,
      }
    }, { base: SERVIPAG_BASE, companyId: ENEL_COMPANY_ID, categoryId: ENEL_CATEGORY_ID, ident: identifier, maxIntentos: 15 })

    if (resultado.error) return { deuda: null, fecha: null, error: resultado.error }

    const deuda = Number(resultado.totalAmount) || 0
    return {
      deuda,
      fecha: resultado.expirationDate || null,
      sinDeuda: deuda === 0,
      direccion: resultado.invoiceAddress || null,
      empresa: resultado.companyName || null,
    }
  } catch (e) {
    return { error: e.message }
  } finally {
    await browser.close()
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