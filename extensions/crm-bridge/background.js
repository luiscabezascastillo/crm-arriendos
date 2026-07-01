// ============================================================
// CRM Bridge - Fondo Capital
// background.js  (service worker, Manifest V3)
// VERSION: v5  (2026-06-30)   <-- sello visible para no confundir versiones
// ------------------------------------------------------------
// Cambio CLAVE v5 frente a v4:
//   Se REACTIVA ENEL a través de Servipag. El fetch (POST + polling) NO se
//   hace aqui: se delega al content.js que vive dentro de portal.servipag.com
//   (que SI pasa el Cloudflare Turnstile, como una consulta manual). El
//   background solo:
//     1) localiza la pestana de portal.servipag.com
//     2) le manda { type:'SERVIPAG_FETCH', codigo } via chrome.tabs.sendMessage
//     3) devuelve al CRM lo que responda el content.js  { ok, deuda, fecha }
//
//   Agua sigue EXACTAMENTE igual que en v4 (AGUA_FETCH delegado al content).
//
// Contrato con las paginas del CRM:
//   /op/servicios/luz/page.js   -> PING, CONSULTAR_ENEL {codigo} -> {ok, deuda, fecha}
//   /op/servicios/agua/page.js  -> PING, CONSULTAR_AGUA {codigo} -> {ok, deuda}
// ============================================================

const VERSION = 'v5'

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
// ENEL (via Servipag) - delega el fetch al content.js de la pestana
// ============================================================
async function consultarEnel(codigo) {
  if (!codigo) throw new Error('Falta el codigo de Enel')

  // Localizar la pestana de Servipag
  const tabs = await chrome.tabs.query({ url: '*://portal.servipag.com/*' })
  if (!tabs.length) {
    throw new Error('Abre una pestana de Servipag (portal.servipag.com/paymentexpress/category/luz/company/enel)')
  }
  const tabId = tabs[0].id

  let resp
  try {
    resp = await chrome.tabs.sendMessage(tabId, { type: 'SERVIPAG_FETCH', codigo })
  } catch (e) {
    throw new Error(
      'No respondio el content script en la pestana de Servipag. ' +
      'Recarga esa pestana (F5) y reintenta. Detalle: ' + (e.message || e)
    )
  }

  if (!resp) throw new Error('Respuesta vacia del content script (Servipag)')
  if (!resp.ok) throw new Error(resp.error || 'Error desconocido en la consulta de Enel')
  return { deuda: resp.deuda, fecha: resp.fecha }
}

// ============================================================
// AGUAS ANDINAS - delega el fetch al content.js de la pestana (igual que v4)
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
