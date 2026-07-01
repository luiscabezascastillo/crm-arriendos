// ============================================================
// CRM Bridge - content.js
// VERSION: v8  (2026-07-01)
// ------------------------------------------------------------
// Corre en el mundo ISOLATED de aguasandinas.cl y sencillito.com.
// - Habla con el background (chrome.runtime).
// - Para Sencillito: delega el fetch a senc-main.js (que corre en MAIN world
//   y SI ve Liferay) via window.postMessage. Esto resuelve el problema de que
//   los content scripts no ven las variables JS de la pagina.
// - Aguas Andinas: su fetch no necesita variables de la pagina, va aqui.
//
// Mensajes que atiende (desde el background):
//   { type: 'AGUA_FETCH', codigo }       -> { ok, deuda }
//   { type: 'SENCILLITO_FETCH', codigo } -> { ok, deuda, fecha }
// ============================================================

console.log('[CRM Bridge v8] content script (isolated) activo en', window.location.href)

try {
  chrome.runtime.sendMessage({ type: 'ENEL_TAB_READY', url: window.location.href })
} catch (e) {}

const P_AGUA = '_cl_aguasandinas_pago_cuenta_pub_PagarCuentaPubPorltetPortlet_INSTANCE_jL3QTDf9o9xo'

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'AGUA_FETCH') {
    consultarAguaAqui(msg.codigo)
      .then((deuda) => sendResponse({ ok: true, deuda }))
      .catch((e) => sendResponse({ ok: false, error: String((e && e.message) || e) }))
    return true
  }

  if (msg && msg.type === 'SENCILLITO_FETCH') {
    consultarSencillito(msg.codigo)
      .then((r) => sendResponse({ ok: true, deuda: r.deuda, fecha: r.fecha }))
      .catch((e) => sendResponse({ ok: false, error: String((e && e.message) || e) }))
    return true
  }
})

// ── Sencillito: pide el fetch a senc-main.js (MAIN world) via postMessage ──
let _sencReqId = 0
const _sencPendientes = {}

window.addEventListener('message', (ev) => {
  if (ev.source !== window) return
  const d = ev.data
  if (!d || d.__crmBridge !== 'SENC_RESULT') return
  const cb = _sencPendientes[d.reqId]
  if (cb) { delete _sencPendientes[d.reqId]; cb(d) }
})

function consultarSencillito(codigoBruto) {
  return new Promise((resolve, reject) => {
    const accRef = String(codigoBruto || '').trim()
    if (!accRef) { reject(new Error('codigo invalido: ' + codigoBruto)); return }

    const reqId = ++_sencReqId
    let done = false
    _sencPendientes[reqId] = (d) => {
      if (done) return
      done = true
      if (d.ok) resolve({ deuda: d.deuda, fecha: d.fecha })
      else reject(new Error(d.error || 'error desconocido en Sencillito'))
    }

    setTimeout(() => {
      if (done) return
      done = true
      delete _sencPendientes[reqId]
      reject(new Error(accRef + ': sin respuesta de senc-main.js (¿estas en la pagina de Sencillito?)'))
    }, 20000)

    window.postMessage({ __crmBridge: 'SENC_REQ', reqId, codigo: accRef }, '*')
  })
}

// ============================================================
// AGUAS ANDINAS - 2 POST encadenados DENTRO de la pagina (igual que v5/v7)
// ============================================================
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
