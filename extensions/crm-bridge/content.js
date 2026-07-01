// ============================================================
// CRM Bridge - content.js
// VERSION: v5  (2026-06-30)
// ------------------------------------------------------------
// Se inyecta en enel.cl, aguasandinas.cl y portal.servipag.com
// (ver manifest content_scripts). Corre DENTRO de la pagina => sus fetch
// heredan la sesion, las cookies anti-bot y pasan el Cloudflare Turnstile,
// igual que la consola de DevTools. Por eso los fetch se hacen AQUI, no en
// el service worker (que en perfiles no-default no envia cookies).
//
// Mensajes que atiende (desde el background, via chrome.tabs.sendMessage):
//   { type: 'AGUA_FETCH', codigo }     -> { ok, deuda }        | { ok:false, error }
//   { type: 'SERVIPAG_FETCH', codigo } -> { ok, deuda, fecha } | { ok:false, error }
// ============================================================

console.log('[CRM Bridge v5] content script activo en', window.location.href)

// Avisar al background que esta pestana esta lista
try {
  chrome.runtime.sendMessage({ type: 'ENEL_TAB_READY', url: window.location.href })
} catch (e) {}

const P_AGUA = '_cl_aguasandinas_pago_cuenta_pub_PagarCuentaPubPorltetPortlet_INSTANCE_jL3QTDf9o9xo'

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

  if (msg && msg.type === 'SERVIPAG_FETCH') {
    consultarServipagAqui(msg.codigo)
      .then((r) => sendResponse({ ok: true, deuda: r.deuda, fecha: r.fecha }))
      .catch((e) => sendResponse({ ok: false, error: String((e && e.message) || e) }))
    return true // async
  }
})

// ============================================================
// ENEL via SERVIPAG - POST (registrar consulta) + polling (queryStatus)
// Se ejecuta dentro de portal.servipag.com, hereda cookies y pasa Turnstile.
// Enel = company.id 107, category.id 14, type "standard".
// El identifier es el numero de cliente COMPLETO con guion y DV (ej. 3290040-2).
// ============================================================
async function consultarServipagAqui(codigoBruto) {
  const identifier = String(codigoBruto || '').trim()
  if (!identifier) throw new Error('codigo invalido: ' + codigoBruto)

  const BASE = 'https://portal.servipag.com/portal/bill/v3/query/'

  // PASO 1: registrar la consulta -> devuelve queryId
  const bodyQuery = {
    bill: {
      company: { id: 107 },
      category: { id: 14 },
      type: 'standard',
      metaData: [{ name: 'identifier', value: identifier }],
    },
    queryId: '',
  }

  let r
  try {
    r = await fetch(BASE, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(bodyQuery),
    })
  } catch (e) {
    throw new Error(identifier + ': fallo de red en POST query (' + (e.message || e) + ')')
  }
  if (!r.ok) throw new Error(identifier + ': POST query HTTP ' + r.status)

  let j
  try { j = await r.json() } catch { throw new Error(identifier + ': POST query sin JSON') }
  const queryId = j && j.data && j.data.queryId
  if (!queryId) throw new Error(identifier + ': no se obtuvo queryId (' + (j?.result?.mensaje || 'sin mensaje') + ')')

  // PASO 2: polling hasta queryStatus === 1 (finalizada con exito)
  const urlPoll = BASE + encodeURIComponent(queryId) + '/lastcall/false'
  const MAX = 15
  for (let intento = 0; intento < MAX; intento++) {
    await sleep(1000)
    let rp
    try {
      rp = await fetch(urlPoll, { method: 'GET', credentials: 'include' })
    } catch (e) {
      continue // reintenta en el siguiente ciclo
    }
    if (!rp.ok) continue

    let jp
    try { jp = await rp.json() } catch { continue }
    const fila = jp && jp.data && jp.data[0]
    if (!fila) continue

    const estado = fila.queryStatus
    if (estado === 1) {
      // PASO 3: leer resultado
      const deuda = parseInt(fila.totalAmount, 10)
      const fecha = fila.expirationDate ? normFecha(fila.expirationDate) : null
      return { deuda: isNaN(deuda) ? 0 : deuda, fecha }
    }
    // estado === 0 -> seguir sondeando
  }

  throw new Error(identifier + ': la consulta no finalizo tras ' + MAX + ' intentos')
}

// dd/mm/yyyy -> yyyy-mm-dd (para guardar en Supabase). Si no encaja, devuelve tal cual.
function normFecha(s) {
  const m = String(s).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return String(s)
  const dd = m[1].padStart(2, '0')
  const mm = m[2].padStart(2, '0')
  return m[3] + '-' + mm + '-' + dd
}

function sleep(ms) { return new Promise((res) => setTimeout(res, ms)) }

// ============================================================
// AGUAS ANDINAS - 2 POST encadenados DENTRO de la pagina (igual que v4)
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
