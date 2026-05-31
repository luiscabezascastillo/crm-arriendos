// background.js
// Recibe token ya resuelto por 2captcha y ejecuta el fetch desde la pestaña ENEL

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message.type === 'PING') {
    sendResponse({ ok: true, version: '1.1' })
    return false
  }

  if (message.type === 'CONSULTAR_ENEL') {
    handleConsultarEnel(message, sendResponse)
    return true // mantener canal abierto para respuesta async
  }
})

async function handleConsultarEnel(message, sendResponse) {
  const { codigo, token } = message

  try {
    // Buscar pestaña ENEL abierta
    const tabs = await chrome.tabs.query({ url: 'https://www.enel.cl/*' })

    if (tabs.length === 0) {
      sendResponse({ ok: false, error: 'No hay pestaña de ENEL abierta. Abre el portal ENEL primero.' })
      return
    }

    const enelTab = tabs[0]

    // Ejecutar fetch desde la pestaña ENEL (mismo origen = sin CORS, sin Akamai)
    const results = await chrome.scripting.executeScript({
      target: { tabId: enelTab.id },
      func: async (codigoEle, recaptchaToken) => {
        try {
          const formData = new URLSearchParams()
          formData.append('searchType', 'nro_suministro')
          formData.append('client', codigoEle)
          formData.append('g-recaptcha-response', recaptchaToken)
          formData.append('company', '1')
          formData.append('minutesT', 'TIME-SLOT-4')

          const response = await fetch(
            'https://www.enel.cl/es/clientes/servicios-en-linea/pago-de-cuenta.mdwedgeohl.getDebtsCl.html',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: formData.toString(),
            }
          )

          if (!response.ok) return { ok: false, error: `HTTP ${response.status}` }
          const data = await response.json()
          return { ok: true, data }
        } catch (e) {
          return { ok: false, error: e.message }
        }
      },
      args: [codigo, token],
    })

    const result = results[0]?.result
    if (!result) {
      sendResponse({ ok: false, error: 'No se pudo ejecutar script en pestaña ENEL' })
      return
    }

    sendResponse(result)

  } catch (e) {
    sendResponse({ ok: false, error: e.message })
  }
}
