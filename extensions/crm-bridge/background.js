// ============================================================
// CRM Bridge - Fondo Capital
// background.js  (service worker, Manifest V3)
// VERSION: v4  (2026-06-13)   <-- sello visible para no confundir versiones
// ------------------------------------------------------------
// Cambio CLAVE v4 frente a v3:
//   El fetch de agua YA NO se hace aqui ni con executeScript. Se delega
//   al content.js (que vive dentro de la pagina de Aguas y SI hereda las
//   cookies anti-bot, como la consola). El background solo:
//     1) localiza la pestana de aguasandinas.cl
//     2) le manda { type:'AGUA_FETCH', codigo } via chrome.tabs.sendMessage
//     3) devuelve al CRM lo que responda el content.js
//   Motivo: en perfiles de Chrome no-default, el fetch del service worker
//   (incluso world:MAIN) no envia las cookies -> 0 exitosos. El content
//   script no tiene ese problema.
//
// Contrato con las paginas del CRM (sin cambios):
//   /op/servicios/luz/page.js   -> PING, CONSULTAR_ENEL {codigo, token} -> {ok, data}
//   /op/servicios/agua/page.js  -> PING, CONSULTAR_AGUA {codigo}        -> {ok, deuda}
//
// ENEL: APARCADO (jun-2026 ENEL movio el pago tras login).
// ============================================================

const VERSION = 'v4'

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
    sendResponse({
      ok: false,
      error: 'ENEL: consulta publica deshabilitada por ENEL (jun-2026). Pendiente de rehacer.',
    })
    return
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
// AGUAS ANDINAS - delega el fetch al content.js de la pestana
// ============================================================
async function consultarAgua(codigo) {
  if (!codigo) throw new Error('Falta el codigo de agua')

  // Localizar la pestana de Aguas Andinas
  const tabs = await chrome.tabs.query({ url: '*://*.aguasandinas.cl/*' })
  if (!tabs.length) throw new Error('Abre una pestana de Aguas Andinas (pagar-mi-cuenta)')
  const tabId = tabs[0].id

  // Pedir al content.js que haga el fetch dentro de la pagina
  let resp
  try {
    resp = await chrome.tabs.sendMessage(tabId, { type: 'AGUA_FETCH', codigo })
  } catch (e) {
    // Suele pasar si el content script no esta cargado en esa pestana
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