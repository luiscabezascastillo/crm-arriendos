// ============================================================
// CRM Bridge - servipag-main.js
// VERSION: v14-servipag-ui  (2026-08-24)
//   v14: maneja el modal "Cliente no posee saldo deudor" (deuda 0) y otros modales de
//        error: los cierra con "Aceptar" y sigue, en vez de quedar colgado esperando el "+".
//   v13: selector del boton "+" por id btnIconAddToCart + icono bi-plus.
// Corre en el MUNDO MAIN de portal.servipag.com ("world": "MAIN").
// La API de Servipag rechaza cualquier peticion "copiada" (Cloudflare bot),
// asi que consultamos CONDUCIENDO LA PROPIA WEB, como un humano:
//   1) escribir el numero en el campo identificador
//   2) pulsar "Continuar"           -> la web consulta (pasa Cloudflare)
//   3) pulsar "+"                    -> anade y muestra panel "Ultima anadida"
//   4) leer "Monto: $..." del panel
//   5) pulsar "Agregar otra cuenta"  -> vuelve al formulario (reset sin recarga)
// Atiende SERVIPAG_REQ del content script (ISOLATED) y responde SERVIPAG_RESULT.
// ============================================================
(function () {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

  function setVal(el, val) {
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set
    setter.call(el, val)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    el.dispatchEvent(new Event('blur', { bubbles: true }))
  }
  const botones = () => [...document.querySelectorAll('button')]
  const botonPorTexto = (re) => botones().find((b) => re.test((b.textContent || '').trim()))
  async function esperar(fn, tries = 40, ms = 500) {
    for (let i = 0; i < tries; i++) { const r = fn(); if (r) return r; await sleep(ms) }
    return null
  }
  function inputIdentificador() {
    return [...document.querySelectorAll('input')].find(
      (i) => /cliente|identificador|numero|número/i.test(i.placeholder || '') && i.name !== 'inputSearch'
    )
  }
  function botonMas() {
    // 1) por id de Servipag (btnIconAddToCart-...) — lo mas estable
    let b = document.querySelector('button[id*="AddToCart"]')
    if (b) return b
    // 2) boton que contiene el icono "+" (<i class="bi bi-plus">)
    const ico = document.querySelector('button i.bi-plus, button .bi-plus, button i[class*="plus"]')
    if (ico && ico.closest('button')) return ico.closest('button')
    // 3) dentro del contenedor del precio
    const cont = document.querySelector('#card-lib-divAddToCart-click, .form-control-price')
    if (cont) { const nb = cont.querySelector('button'); if (nb) return nb }
    // 4) fallback: boton cuyo texto es exactamente "+"
    b = botones().find((x) => (x.textContent || '').trim() === '+')
    return b || null
  }

  async function consultar(identBruto) {
    const ident = String(identBruto || '').trim().split('-')[0].replace(/\D/g, '')
    if (!ident) throw new Error('codigo invalido')

    // 1) campo identificador (formulario Enel)
    const inp = await esperar(inputIdentificador, 24, 500)
    if (!inp) throw new Error(ident + ': no aparece el campo identificador (formulario Enel no cargado)')

    // 2) escribir y Continuar
    setVal(inp, identBruto)
    await sleep(500)
    const cont = botonPorTexto(/continuar/i)
    if (!cont) throw new Error(ident + ': no encuentro el boton Continuar')
    cont.click()

    // 3) esperar el desenlace, que puede ser:
    //    (a) boton "+"  -> el cliente TIENE deuda
    //    (b) modal "Cliente no posee saldo deudor" -> SIN deuda (deuda 0)
    //    (c) otro modal de error (cuenta no encontrada, etc.) con boton Aceptar/Cerrar
    const fin = await esperar(() => {
      const mas = botonMas()
      if (mas) return { tipo: 'deuda', mas }
      const txt = document.body.innerText || ''
      if (/no posee saldo deudor|no posee saldo|sin saldo deudor|no registra deuda|no posee deuda/i.test(txt)) return { tipo: 'sinsaldo' }
      if (/no.*(encontr|existe|disponible|valid)/i.test(txt) && botonPorTexto(/aceptar|entendido|cerrar/i)) return { tipo: 'error', txt }
      return null
    }, 44, 500) // ~22s (la web hace su propio polling)

    if (!fin) throw new Error(ident + ': no aparecio ni resultado ni mensaje (timeout)')

    // Casos SIN monto: cerrar el modal y devolver deuda 0
    if (fin.tipo === 'sinsaldo' || fin.tipo === 'error') {
      await cerrarModal()
      await resetear()
      return { deuda: 0, fecha: null, nota: fin.tipo }
    }

    // Caso CON deuda: leer vencimiento (opcional) y pulsar "+"
    let venc = null
    const vEl = [...document.querySelectorAll('div,span')].find((e) => e.childElementCount === 0 && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test((e.textContent || '').trim()))
    if (vEl) { const m = (vEl.textContent || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (m) venc = m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0') }

    fin.mas.click()

    // 4) panel "Ultima anadida" con "Monto: $..."
    const panel = await esperar(() => [...document.querySelectorAll('*')].find((e) => /Monto:\s*\$/i.test(e.textContent || '') && /Identificador:/i.test(e.textContent || '')), 30, 500)
    if (!panel) throw new Error(ident + ': no aparecio el panel "Ultima anadida" tras pulsar "+"')
    const ptext = panel.innerText || panel.textContent || ''
    const mMonto = ptext.match(/Monto:\s*\$?\s*([\d.]+)/i)
    const deuda = mMonto ? parseInt(mMonto[1].replace(/\./g, ''), 10) : 0

    // 5) reset para el siguiente
    await resetear()

    return { deuda: isNaN(deuda) ? 0 : deuda, fecha: venc }
  }

  // Cierra un modal (ej. "Cliente no posee saldo deudor") pulsando Aceptar/Entendido/Cerrar o la X.
  async function cerrarModal() {
    let btn = botonPorTexto(/aceptar|entendido|cerrar/i)
    if (!btn) btn = document.querySelector('[role="dialog"] button, .modal button, .modal-content button, .modal-footer button')
    if (btn) { btn.click() }
    await sleep(700)
  }

  // Vuelve al formulario pulsando "Agregar otra cuenta" (si existe) y espera a que reaparezca el campo.
  async function resetear() {
    const reset = botonPorTexto(/agregar otra cuenta/i)
    if (reset) { reset.click() }
    await esperar(inputIdentificador, 20, 400)
  }

  // ── canal con el content script ──
  window.addEventListener('message', async (ev) => {
    if (ev.source !== window) return
    const d = ev.data
    if (!d || d.__crmBridge !== 'SERVIPAG_REQ') return
    const reqId = d.reqId
    const reply = (o) => { o.__crmBridge = 'SERVIPAG_RESULT'; o.reqId = reqId; window.postMessage(o, '*') }
    try {
      const res = await consultar(d.codigo)
      reply({ ok: true, deuda: res.deuda, fecha: res.fecha })
    } catch (e) {
      reply({ ok: false, error: (e && e.message) || String(e) })
    }
  })

  console.log('[CRM Bridge v14] servipag-main.js (UI, MAIN world) activo en', location.href)
})()
