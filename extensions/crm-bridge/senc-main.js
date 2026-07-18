// ============================================================
// CRM Bridge - senc-main.js
// VERSION: v8  (2026-07-01)
// Corre en el MAIN world de sencillito.com (declarado en manifest con
// "world": "MAIN"). Tiene acceso a Liferay.authToken y getUserId().
// Escucha peticiones SENC_REQ del content script (ISOLATED) via postMessage
// y responde con SENC_RESULT tras hacer el GET a consulta-saldo.
// ============================================================
(function () {
  const BASE = 'https://sencillito.com/o/portal-publico/consulta-saldo/'
  const UTIL = '20182', UVER = '1', IND = '13'

  window.addEventListener('message', async function (ev) {
    if (ev.source !== window) return
    const d = ev.data
    if (!d || d.__crmBridge !== 'SENC_REQ') return
    const reqId = d.reqId
    const accRef = String(d.codigo || '').trim()
    function reply(obj) { obj.__crmBridge = 'SENC_RESULT'; obj.reqId = reqId; window.postMessage(obj, '*') }

    try {
      let userId = null, authToken = null
      if (typeof Liferay !== 'undefined') {
        if (Liferay.ThemeDisplay && Liferay.ThemeDisplay.getUserId) userId = Liferay.ThemeDisplay.getUserId()
        if (Liferay.authToken) authToken = Liferay.authToken
      }
      if (!userId || !authToken) { reply({ ok: false, error: accRef + ': sin sesion Liferay (recarga Sencillito)' }); return }

      const url = BASE + '?accountReference=' + encodeURIComponent(accRef) +
        '&utilityNumber=' + UTIL + '&utilityVersion=' + UVER + '&industriaId=' + IND +
        '&productTypeId=null&userId=' + encodeURIComponent(userId) +
        '&session_key=null&p_auth=' + encodeURIComponent(authToken)

      let r
      try { r = await fetch(url, { method: 'GET', credentials: 'include', headers: { 'accept': '*/*' } }) }
      catch (e) { reply({ ok: false, error: accRef + ': fallo de red (' + (e.message || e) + ')' }); return }
      if (r.status !== 200 && r.status !== 202) { reply({ ok: false, error: accRef + ': HTTP ' + r.status }); return }

      let j
      try { j = await r.json() } catch (e) { reply({ ok: false, error: accRef + ': sin JSON' }); return }
      if (j.errorMessage) { reply({ ok: false, error: accRef + ': ' + j.errorMessage }); return }

      const invoices = Array.isArray(j.invoices) ? j.invoices : []
      if (invoices.length === 0) { reply({ ok: true, deuda: 0, fecha: null }); return }

      let mejor = invoices[0]
      for (const inv of invoices) {
        const a = parseInt(inv.amount, 10) || 0, b = parseInt(mejor.amount, 10) || 0
        if (a > b) mejor = inv
      }

      let fecha = null
      if (Array.isArray(mejor.fields)) {
        for (const f of mejor.fields) {
          if (String(f.label || '').toUpperCase().indexOf('VENC') !== -1) {
            const m = String(f.value || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
            if (m) { fecha = m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0'); break }
          }
        }
      }
      if (!fecha && mejor.dateTime && /^\d{8}/.test(String(mejor.dateTime))) {
        const s = String(mejor.dateTime); fecha = s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8)
      }

      const deuda = parseInt(mejor.amount, 10)
      reply({ ok: true, deuda: isNaN(deuda) ? 0 : deuda, fecha: fecha })
    } catch (e) {
      reply({ ok: false, error: accRef + ': ' + ((e && e.message) || e) })
    }
  })

  console.log('[CRM Bridge v8] senc-main.js activo (MAIN world) en', location.href)
})()
