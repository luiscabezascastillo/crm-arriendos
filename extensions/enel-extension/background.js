// background.js
// Coordina mensajes entre el CRM (localhost:3000) y el content script de ENEL

// Escucha mensajes del CRM via chrome.runtime.sendMessage
// El CRM usa chrome.runtime.sendMessage con el extensionId

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message.type === 'CONSULTAR_ENEL') {
    handleConsultarEnel(message, sendResponse)
    return true // Mantener canal abierto para respuesta async
  }

  if (message.type === 'PING') {
    sendResponse({ ok: true, version: '1.0' })
    return false
  }
})

// También escucha mensajes internos (del content script)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ENEL_RESULT') {
    // Reenviar resultado al CRM que está esperando
    const tabId = sender.tab?.id
    if (tabId) {
      // Almacenar resultado temporalmente
      chrome.storage.session.set({ [`result_${message.requestId}`]: message })
    }
  }
})

async function handleConsultarEnel(message, sendResponse) {
  const { codigo, token, requestId } = message

  try {
    // Buscar la pestaña de ENEL abierta
    const tabs = await chrome.tabs.query({ url: 'https://www.enel.cl/*' })

    if (tabs.length === 0) {
      sendResponse({ ok: false, error: 'No hay pestaña de ENEL abierta. Abre el portal ENEL primero.' })
      return
    }

    const enelTab = tabs[0]

    // Ejecutar el fetch desde la pestaña de ENEL (mismo origen = sin CORS)
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
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: formData.toString(),
            }
          )

          if (!response.ok) {
            return { ok: false, error: `HTTP ${response.status}` }
          }

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
