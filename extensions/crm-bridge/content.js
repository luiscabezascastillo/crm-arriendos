// ============================================================
// CRM Bridge - content.js
// VERSION: v4  (2026-06-13)
// ------------------------------------------------------------
// Se inyecta en enel.cl y aguasandinas.cl (ver manifest content_scripts).
// Corre DENTRO de la pagina => sus fetch heredan la sesion y las cookies
// anti-bot (Incapsula) igual que la consola de DevTools. Por eso el
// fetch de agua se hace AQUI, no en el service worker (que en perfiles
// no-default no envia las cookies).
//
// Mensajes que atiende (desde el background, via chrome.tabs.sendMessage):
//   { type: 'AGUA_FETCH', codigo }  ->  responde { ok, deuda } | { ok:false, error }
// ============================================================

console.log('[CRM Bridge v4] content script activo en', window.location.href)

// Avisar al background que esta pestana esta lista (compat. con lo anterior)
try {
  chrome.runtime.sendMessage({ type: 'ENEL_TAB_READY', url: window.location.href })
} catch (e) {}

const P_AGUA = '_cl_aguasandinas_pago_cuenta_pub_PagarCuentaPubPorltetPortlet_INSTANCE_jL3QTDf9o9xo'

// Listener: el background nos pide consultar una cuenta de agua
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'AGUA_FETCH') {
    consultarAguaAqui(msg.codigo)
      .then((deuda) => sendResponse({ ok: true, deuda }))
      .catch((e) => sendResponse({ ok: false, error: String((e && e.message) || e) }))
    return true // respuesta asincrona
  }
})

// Hace los 2 POST encadenados DENTRO de la pagina (hereda cookies)
async function consultarAguaAqui(codigoBruto) {
  const cuenta = String(codigoBruto || '').trim().split('-')[0].replace(/\D/g, '')
  if (!cuenta) throw new Error('codigo invalido: ' + codigoBruto)

  const P = P_AGUA
  const pAuth = (document.documentElement.innerHTML.match(/p_auth=([A-Za-z0-9]+)/) || [])[1] || ''
  if (!pAuth) throw new Error('cuenta ' + cuenta + ': sin p_auth (recarga la pestana de Aguas Andinas)')

  const base =
    '/web/aguasandinas/pagar-mi-cuenta' +
    '?p_p_id=cl_aguasandinas_pago_cuenta_pub_PagarCuentaPubPorltetPortlet_INSTANCE_jL3QTDf9o9xo' +
    '&p_p_lifecycle=1&p_p_state=normal&p_p_mode=view' +
    '&' + P + '_javax.portlet.action=%2Fcuenta%2Fbuscar' +
    '&' + P + '_cmd=buscar' +
    '&p_auth=' + pAuth

  const opts = {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  }

  // PASO 1: BUSCAR
  const b1 = new URLSearchParams()
  b1.set(P + '_buscador_cuenta', cuenta)
  b1.set(P + '_tipoBuscar', 'cuenta')
  b1.set(P + '_cmd', 'buscar')
  let r = await fetch(base, { ...opts, body: b1.toString() })
  if (!r.ok) throw new Error('cuenta ' + cuenta + ': PASO1 HTTP ' + r.status)
  let t = await r.text()
  if (/no existe la cuenta/i.test(t)) throw new Error('No existe la cuenta ' + cuenta)

  const radio = new DOMParser().parseFromString(t, 'text/html').querySelector('input[type=radio][id^="radio"]')
  if (!radio || !radio.value) throw new Error('cuenta ' + cuenta + ': PASO1 sin radio')

  // PASO 2: SELECCIONAR
  const b2 = new URLSearchParams()
  b2.set(P + '_radio', radio.value)
  b2.set(P + '_tipoBuscar', 'agregarCuentas')
  b2.set(P + '_agregarCuenta', 'ok')
  b2.set(P + '_tipoConvenio', 'x')
  r = await fetch(base, { ...opts, body: b2.toString() })
  if (!r.ok) throw new Error('cuenta ' + cuenta + ': PASO2 HTTP ' + r.status)
  t = await r.text()

  const m = t.match(/id="pago2"[^>]*value="(\d+)"/) || t.match(/id="montoPagoSum"[^>]*value="(\d+)"/)
  if (!m) {
    if (/id="pago2"/.test(t)) return 0
    throw new Error('cuenta ' + cuenta + ': PASO2 sin monto')
  }
  return parseInt(m[1], 10) || 0
}