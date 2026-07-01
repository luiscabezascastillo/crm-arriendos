// ============================================================
// CRM Bridge - Fondo Capital
// background.js  (service worker, Manifest V3)
// VERSION: v7  (2026-07-01)
// ------------------------------------------------------------
// Cambio v7 frente a v5:
//   ENEL se consulta ahora via SENCILLITO (no Servipag). El fetch (GET
//   simple) lo hace el content.js que vive dentro de sencillito.com
//   (hereda la sesion Liferay: userId + authToken). El background solo:
//     1) localiza la pestana de sencillito.com
//     2) le manda { type:'SENCILLITO_FETCH', codigo } via chrome.tabs.sendMessage
//     3) devuelve al CRM lo que responda el content.js  { ok, deuda, fecha }
//
//   Agua sigue EXACTAMENTE igual (AGUA_FETCH delegado al content).
//
// Contrato con las paginas del CRM:
//   /op/servicios/luz/page.js   -> PING, CONSULTAR_ENEL {codigo} -> {ok, deuda, fecha}
//   /op/servicios/agua/page.js  -> PING, CONSULTAR_AGUA {codigo} -> {ok, deuda}
// ============================================================

const VERSION = 'v7'

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
// ENEL (via Sencillito) - delega el fetch al content.js de la pestana
// ============================================================
async function consultarEnel(codigo) {
  if (!codigo) throw new Error('Falta el codigo de Enel')

  // Localizar la pestana de Sencillito
  const tabs = await chrome.tabs.query({ url: '*://sencillito.com/*' })
  if (!tabs.length) {
    throw new Error('Abre una pestana de Sencillito (sencillito.com/pagos-de-la-factura?industriaId=13&convenioId=6001) estando logueado')
  }
  const tabId = tabs[0].id

  let resp
  try {
    resp = await chrome.tabs.sendMessage(tabId, { type: 'SENCILLITO_FETCH', codigo })
  } catch (e) {
    throw new Error(
      'No respondio el content script en la pestana de Sencillito. ' +
      'Recarga esa pestana (F5) y reintenta. Detalle: ' + (e.message || e)
    )
  }

  if (!resp) throw new Error('Respuesta vacia del content script (Sencillito)')
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
