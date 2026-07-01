// ============================================================
// CRM Bridge - content.js
// VERSION: v7  (2026-07-01)
// ------------------------------------------------------------
// Se inyecta en aguasandinas.cl y sencillito.com (ver manifest
// content_scripts). Corre DENTRO de la pagina => sus fetch heredan la
// sesion y las cookies, igual que la consola de DevTools.
//
// CAMBIO v7 frente a v5/v6:
//   ENEL ya NO se consulta via Servipag (Cloudflare bloqueaba todo).
//   Ahora se consulta via SENCILLITO, que expone un GET simple sin
//   captcha ni Cloudflare:
//     GET https://sencillito.com/o/portal-publico/consulta-saldo/
//         ?accountReference=<CODIGO>&utilityNumber=20182&utilityVersion=1
//         &industriaId=13&productTypeId=null&userId=<UID>&session_key=null&p_auth=<AUTH>
//   El userId y el p_auth (authToken) se leen de Liferay (la plataforma
//   de Sencillito), asi siempre estan frescos:
//     Liferay.ThemeDisplay.getUserId()  -> userId
//     Liferay.authToken                 -> p_auth
//   Respuesta JSON: { invoices: [ { accountReference, amount, ... } ], errorMessage }
//   amount = deuda en pesos (entero). Sin deuda -> invoices vacio o amount 0.
//
//   Aguas Andinas sigue EXACTAMENTE igual (AGUA_FETCH).
//
// Mensajes que atiende (desde el background, via chrome.tabs.sendMessage):
//   { type: 'AGUA_FETCH', codigo }     -> { ok, deuda }        | { ok:false, error }
//   { type: 'SENCILLITO_FETCH', codigo } -> { ok, deuda, fecha } | { ok:false, error }
// ============================================================

console.log('[CRM Bridge v7] content script activo en', window.location.href)

// Avisar al background que esta pestana esta lista
try {
  chrome.runtime.sendMessage({ type: 'ENEL_TAB_READY', url: window.location.href })
} catch (e) {}

const P_AGUA = '_cl_aguasandinas_pago_cuenta_pub_PagarCuentaPubPorltetPortlet_INSTANCE_jL3QTDf9o9xo'

// Constantes de Sencillito para Enel (fijas)
const SENC_BASE = 'https://sencillito.com/o/portal-publico/consulta-saldo/'
const SENC_UTILITY_NUMBER = '20182'   // Enel
const SENC_UTILITY_VERSION = '1'
const SENC_INDUSTRIA = '13'           // Luz
const SENC_CONVENIO = '6001'          // Enel

// ============================================================
// LISTENER: mensajes del background
// ============================================================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'AGUA_FETCH') {
    consultarAguaAqui(msg.codigo)
      .then((deuda) => sendResponse({ ok: true, deuda }))
      .catch((e) => sendResponse({ ok: false, error: String((e && e.message) || e) }))
    return true // async
  }

  if (msg && msg.type === 'SENCILLITO_FETCH') {
    consultarSencillitoAqui(msg.codigo)
      .then((r) => sendResponse({ ok: true, deuda: r.deuda, fecha: r.fecha }))
      .catch((e) => sendResponse({ ok: false, error: String((e && e.message) || e) }))
    return true // async
  }
})

// ============================================================
// Parametros de sesion de Sencillito (Liferay)
// Se leen frescos en cada consulta: userId + authToken (p_auth).
// ============================================================
function obtenerSesionSencillito() {
  let userId = null
  let authToken = null
  try {
    if (typeof Liferay !== 'undefined') {
      if (Liferay.ThemeDisplay && typeof Liferay.ThemeDisplay.getUserId === 'function') {
        userId = Liferay.ThemeDisplay.getUserId()
      }
      if (Liferay.authToken) authToken = Liferay.authToken
    }
  } catch (e) {}
  return { userId, authToken }
}

// ============================================================
// ENEL via SENCILLITO - GET simple (sin captcha, sin Cloudflare)
// Se ejecuta dentro de sencillito.com, hereda la sesion.
// El accountReference es el codigo COMPLETO con guion y DV (ej. 3290097-6).
// ============================================================
async function consultarSencillitoAqui(codigoBruto) {
  const accRef = String(codigoBruto || '').trim()
  if (!accRef) throw new Error('codigo invalido: ' + codigoBruto)

  const { userId, authToken } = obtenerSesionSencillito()
  if (!userId || !authToken) {
    throw new Error(accRef + ': no se pudo leer la sesion de Sencillito (Liferay). Recarga la pestana de Sencillito estando logueado.')
  }

  const url = SENC_BASE +
    '?accountReference=' + encodeURIComponent(accRef) +
    '&utilityNumber=' + SENC_UTILITY_NUMBER +
    '&utilityVersion=' + SENC_UTILITY_VERSION +
    '&industriaId=' + SENC_INDUSTRIA +
    '&productTypeId=null' +
    '&userId=' + encodeURIComponent(userId) +
    '&session_key=null' +
    '&p_auth=' + encodeURIComponent(authToken)

  let r
  try {
    r = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: { 'accept': '*/*' },
    })
  } catch (e) {
    throw new Error(accRef + ': fallo de red en GET consulta-saldo (' + (e.message || e) + ')')
  }
  // Sencillito responde 200 o 202 con el JSON (202 = aceptado/procesado)
  if (r.status !== 200 && r.status !== 202) {
    throw new Error(accRef + ': GET consulta-saldo HTTP ' + r.status)
  }

  let j
  try { j = await r.json() } catch { throw new Error(accRef + ': respuesta sin JSON') }

  if (j.errorMessage) {
    throw new Error(accRef + ': ' + j.errorMessage)
  }

  const invoices = Array.isArray(j.invoices) ? j.invoices : []
  if (invoices.length === 0) {
    // Sin facturas pendientes -> deuda 0
    return { deuda: 0, fecha: null }
  }

  // Tomar la factura de mayor monto (DEUDA ACTUAL) como deuda vigente.
  // amount viene como string de pesos, ej "173122".
  let mejor = invoices[0]
  for (const inv of invoices) {
    const a = parseInt(inv.amount, 10) || 0
    const b = parseInt(mejor.amount, 10) || 0
    if (a > b) mejor = inv
  }

  const deuda = parseInt(mejor.amount, 10)
  const fecha = extraerFecha(mejor)
  return { deuda: isNaN(deuda) ? 0 : deuda, fecha }
}

// Intenta sacar una fecha de vencimiento del invoice.
// Sencillito trae "dateTime" tipo "20260701005246" (yyyymmdd...) y a veces
// un campo VENCIMIENTO dentro de "fields". Devuelve yyyy-mm-dd o null.
function extraerFecha(inv) {
  // 1) buscar en fields un label tipo VENCIMIENTO con dd/mm/yyyy
  if (Array.isArray(inv.fields)) {
    for (const f of inv.fields) {
      const label = String(f.label || '').toUpperCase()
      if (label.indexOf('VENC') !== -1) {
        const nf = normFecha(f.value)
        if (nf) return nf
      }
    }
  }
  // 2) dateTime "20260701005246" -> 2026-07-01 (es fecha de consulta, no de venc.,
  //    pero sirve como respaldo si no hay VENCIMIENTO)
  if (inv.dateTime && /^\d{8}/.test(String(inv.dateTime))) {
    const s = String(inv.dateTime)
    return s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8)
  }
  return null
}

// dd/mm/yyyy -> yyyy-mm-dd. Si no encaja, devuelve null.
function normFecha(s) {
  const m = String(s || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const dd = m[1].padStart(2, '0')
  const mm = m[2].padStart(2, '0')
  return m[3] + '-' + mm + '-' + dd
}

function sleep(ms) { return new Promise((res) => setTimeout(res, ms)) }

// ============================================================
// AGUAS ANDINAS - 2 POST encadenados DENTRO de la pagina (igual que v4/v5)
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
