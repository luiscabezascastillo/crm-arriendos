// ============================================================
// CRM Bridge - Fondo Capital
// background.js  (service worker, Manifest V3)
// VERSION: v9-servipag  (2026-08-23)
// ------------------------------------------------------------
// Cambio v9 frente a v7:
//   ENEL vuelve a Servipag (la consulta publica y la via Sencillito quedaron
//   deshabilitadas). El fetch (POST query 107/14 + polling) lo hace el content.js
//   que vive dentro de portal.servipag.com (pasa el Cloudflare Turnstile via cookie).
//   El background solo:
//     1) localiza la pestana de portal.servipag.com
//     2) le manda { type:'SERVIPAG_FETCH', codigo } via chrome.tabs.sendMessage
//     3) devuelve al CRM lo que responda el content.js  { ok, deuda, fecha }
//
//   Agua sigue EXACTAMENTE igual (AGUA_FETCH delegado al content).
//
// Contrato con las paginas del CRM:
//   /op/servicios/luz/page.js   -> PING, CONSULTAR_ENEL {codigo} -> {ok, deuda, fecha}
//   /op/servicios/agua/page.js  -> PING, CONSULTAR_AGUA {codigo} -> {ok, deuda}
// ============================================================

const VERSION = 'v15-servipag-ui'

// ============================================================
// LISTENER PRINCIPAL - mensajes desde el CRM (pagina web)
// ============================================================
chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  const tipo = msg && msg.type

  if (tipo === 'PING') {
    sendResponse({ ok: true, pong: true, version: VERSION })
    return
  }

  if (tipo === 'CONSULTAR_AGUA') {
    consultarAgua(msg.codigo)
      .then((deuda) => sendResponse({ ok: true, deuda }))
      .catch((e) => sendResponse({ ok: false, error: e.message }))
    return true // async
  }

  if (tipo === 'CONSULTAR_ENEL') {
    consultarEnel(msg.codigo)
      .then((r) => sendResponse({ ok: true, deuda: r.deuda, fecha: r.fecha }))
      .catch((e) => sendResponse({ ok: false, error: e.message }))
    return true // async
  }

  sendResponse({ ok: false, error: 'Tipo de mensaje desconocido: ' + tipo })
  return
})

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'ENEL_TAB_READY') {
    console.log('[CRM Bridge ' + VERSION + '] content script activo en:', msg.url)
  }
})

// ============================================================
// ENEL (via Servipag) - RESET DETERMINISTA por navegacion.
// Antes de cada consulta navegamos la pestana al formulario limpio de Enel
// (carrito vacio, Enel siempre seleccionado) y luego el servipag-main escribe,
// pulsa Continuar y LEE el monto del resultado (sin pulsar "+", sin ensuciar el carrito).
// ============================================================
const ENEL_URL = 'https://portal.servipag.com/paymentexpress/category/luz/company/enel'

function esperarTabCompleta(tabId, timeoutMs = 25000) {
  return new Promise((resolve) => {
    let done = false
    const fin = () => { if (done) return; done = true; try { chrome.tabs.onUpdated.removeListener(listener) } catch (e) {}; resolve() }
    const listener = (id, info) => { if (id === tabId && info.status === 'complete') fin() }
    chrome.tabs.onUpdated.addListener(listener)
    setTimeout(fin, timeoutMs)
  })
}
const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

async function consultarEnel(codigo) {
  if (!codigo) throw new Error('Falta el codigo de Enel')

  const tabs = await chrome.tabs.query({ url: '*://portal.servipag.com/*' })
  if (!tabs.length) {
    throw new Error('Abre una pestana de Servipag (portal.servipag.com/paymentexpress/category/luz/company/enel) y dejala visible')
  }
  const tabId = tabs[0].id

  // 1) Reset limpio: navegar al formulario de Enel y esperar a que cargue + asiente.
  await chrome.tabs.update(tabId, { url: ENEL_URL })
  await esperarTabCompleta(tabId)
  await dormir(3200) // render de Angular + inyeccion del content script

  // 2) Enviar la orden con reintentos (el content script puede tardar en estar listo).
  let resp, lastErr
  for (let intento = 0; intento < 4; intento++) {
    try { resp = await chrome.tabs.sendMessage(tabId, { type: 'SERVIPAG_FETCH', codigo }); break }
    catch (e) { lastErr = e; await dormir(1500) }
  }
  if (!resp) {
    throw new Error('No respondio el content script en Servipag tras navegar (¿pestana visible y cargada?). ' + ((lastErr && lastErr.message) || ''))
  }
  if (!resp.ok) throw new Error(resp.error || 'Error desconocido en la consulta de Enel')
  return { deuda: resp.deuda, fecha: resp.fecha }
}

// ============================================================
// AGUAS ANDINAS - delega el fetch al content.js de la pestana (igual que v5)
// ============================================================
async function consultarAgua(codigo) {
  if (!codigo) throw new Error('Falta el codigo de agua')

  const tabs = await chrome.tabs.query({ url: '*://*.aguasandinas.cl/*' })
  if (!tabs.length) throw new Error('Abre una pestana de Aguas Andinas (pagar-mi-cuenta)')
  const tabId = tabs[0].id

  let resp
  try {
    resp = await chrome.tabs.sendMessage(tabId, { type: 'AGUA_FETCH', codigo })
  } catch (e) {
    throw new Error(
      'No respondio el content script en la pestana de Aguas. ' +
      'Recarga esa pestana (F5) y reintenta. Detalle: ' + (e.message || e)
    )
  }

  if (!resp) throw new Error('Respuesta vacia del content script')
  if (!resp.ok) throw new Error(resp.error || 'Error desconocido en la consulta de agua')
  return resp.deuda
}

console.log('[CRM Bridge ' + VERSION + '] Service worker arrancado y escuchando.')
