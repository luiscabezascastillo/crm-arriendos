// content.js
// Inyectado en páginas de enel.cl
// Solo notifica al background que hay una pestaña ENEL disponible

console.log('[ENEL Bridge] Content script activo en', window.location.href)

// Notificar al background que esta pestaña está lista
chrome.runtime.sendMessage({ type: 'ENEL_TAB_READY', url: window.location.href })
