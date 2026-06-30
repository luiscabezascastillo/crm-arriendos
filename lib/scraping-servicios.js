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

// ─── ENEL (rellenando el formulario de Servipag vía Browserless) ─────────────
// Cloudflare protege la API /portal/bill/v3/query/ con anti-bot (token de sesión),
// así que un fetch directo da 403 incluso desde Browserless. Solución: rellenar
// el formulario como un humano (escribir el nº de cliente, pulsar Continuar) y
// leer la deuda que aparece en pantalla. La propia web genera los tokens anti-bot.
//
// Lo que se ve en pantalla tras consultar (verificado manualmente):
//   "Fec.Venc.!  09/07/2026"   y   "$168.904"

export async function consultarEnel(codigo) {
  if (!codigo || EXCLUIR.includes(codigo.toLowerCase().trim())) return { omitido: true }
  const identifier = codigo.trim()
  const browser = await conectar()
  try {
    const page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

    await page.goto('https://portal.servipag.com/paymentexpress/category/luz/company/enel', {
      waitUntil: 'networkidle2', timeout: 35000
    })

    // Esperar a que cargue el input del número de cliente
    await page.waitForSelector('input', { timeout: 15000 })
    await new Promise(r => setTimeout(r, 1500))

    // Escribir el número de cliente en el campo "Ingresa Identificador"
    const escrito = await page.evaluate((cod) => {
      const inputs = Array.from(document.querySelectorAll('input'))
      // El campo visible de texto (placeholder "número de cliente")
      const inp = inputs.find(i => {
        const ph = (i.placeholder || '').toLowerCase()
        return i.offsetParent !== null && (ph.includes('cliente') || ph.includes('identific') || i.type === 'text' || !i.type)
      }) || inputs.find(i => i.offsetParent !== null)
      if (!inp) return false
      inp.focus()
      inp.value = ''
      return true
    }, identifier)
    if (!escrito) { await browser.close(); return { error: 'No se encontró el campo de número de cliente' } }

    // Escribir carácter a carácter (como humano) para que la web registre el input
    await page.type('input', identifier, { delay: 60 }).catch(() => {})

    // Pulsar el botón "Continuar"
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, input[type="submit"], a'))
      const btn = btns.find(b => (b.textContent || b.value || '').toLowerCase().includes('continuar'))
      if (btn) btn.click()
    })

    // Esperar a que aparezca la deuda en pantalla (hasta ~20s)
    let texto = ''
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 1000))
      texto = await page.evaluate(() => document.body.innerText)
      if (/Fec\.?\s*Venc/i.test(texto) || /\$\s*[\d.]+/.test(texto)) break
      if (/no se encontr|sin resultado|no existe|inválid|invalid/i.test(texto)) break
    }

    // Extraer monto y fecha del texto de pantalla
    const resultado = await page.evaluate(() => {
      const body = document.body.innerText
      if (/no se encontr|sin resultado|no existe|inválid|invalid/i.test(body)) {
        return { noEncontrado: true }
      }
      // Monto: el primer $ con miles (ej. $168.904)
      const montoMatch = body.match(/\$\s*([\d.]+)/)
      // Fecha de vencimiento: dd/mm/yyyy
      const fechaMatch = body.match(/(\d{1,2}\/\d{1,2}\/\d{4})/)
      const deuda = montoMatch ? parseInt(montoMatch[1].replace(/\./g, ''), 10) : null
      return { deuda, fecha: fechaMatch ? fechaMatch[1] : null, textoDebug: body.substring(0, 400) }
    })

    if (resultado.noEncontrado) return { deuda: null, fecha: null, error: 'Cuenta no encontrada en Servipag' }
    if (resultado.deuda == null) return { deuda: null, fecha: null, error: 'No se pudo leer la deuda', textoDebug: resultado.textoDebug }

    return {
      deuda: resultado.deuda,
      fecha: resultado.fecha,
      sinDeuda: resultado.deuda === 0,
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