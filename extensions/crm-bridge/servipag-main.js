// ============================================================
// CRM Bridge - servipag-main.js
// VERSION: v15-servipag-ui  (2026-08-24)
//   v15: SIN pulsar "+" y SIN reset propio. El background navega al formulario de Enel
//        antes de cada consulta (carrito siempre vacio, Enel siempre seleccionado). Aqui
//        solo: escribir numero -> Continuar -> LEER el monto del resultado (o detectar
//        "no posee saldo deudor" = deuda 0). Se acabaron los problemas de carrito/deriva.
//   v14: manejaba modal sin-saldo; v13: selector "+"; v12: automatizacion de la UI.
// Corre en el MUNDO MAIN de portal.servipag.com ("world": "MAIN").
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
  async function esperar(fn, tries = 44, ms = 500) {
    for (let i = 0; i < tries; i++) { const r = fn(); if (r) return r; await sleep(ms) }
    return null
  }
  function inputIdentificador() {
    return [...document.querySelectorAll('input')].find(
      (i) => /cliente|identificador|numero|número/i.test(i.placeholder || '') && i.name !== 'inputSearch'
    )
  }
  // Elemento con el monto DENTRO de la caja de resultado (no el "Total" del carrito).
  function leerMontoEl() {
    const cont = document.querySelector('[id*="divAddToCart"], .form-control-price')
    if (cont) {
      const el = [...cont.querySelectorAll('*')].find((e) => e.childElementCount === 0 && /\$\s?[\d.]{2,}/.test(e.textContent || ''))
      if (el) return el
    }
    return null
  }

  async function consultar(identBruto) {
    const ident = String(identBruto || '').trim().split('-')[0].replace(/\D/g, '')
    if (!ident) throw new Error('codigo invalido')

    // 1) campo identificador (el background ya navego al formulario de Enel)
    const inp = await esperar(inputIdentificador, 24, 500)
    if (!inp) throw new Error(ident + ': no aparece el campo identificador (formulario Enel no cargado)')

    // 2) escribir y Continuar
    setVal(inp, identBruto)
    await sleep(500)
    const cont = botonPorTexto(/continuar/i)
    if (!cont) throw new Error(ident + ': no encuentro el boton Continuar')
    cont.click()

    // 3) esperar el desenlace: (a) monto en el resultado, (b) modal "no posee saldo deudor",
    //    (c) otro modal de error. NO pulsamos "+": solo leemos.
    const fin = await esperar(() => {
      const montoEl = leerMontoEl()
      if (montoEl) return { tipo: 'deuda', montoEl }
      const txt = document.body.innerText || ''
      if (/no posee saldo deudor|no posee saldo|sin saldo deudor|no registra deuda|no posee deuda/i.test(txt)) return { tipo: 'sinsaldo' }
      if (/no.*(encontr|existe|disponible|valid)/i.test(txt) && botonPorTexto(/aceptar|entendido|cerrar/i)) return { tipo: 'error' }
      return null
    }, 44, 500) // ~22s (la web hace su propio polling interno)

    if (!fin) throw new Error(ident + ': sin resultado ni mensaje (timeout)')
    if (fin.tipo === 'sinsaldo' || fin.tipo === 'error') return { deuda: 0, fecha: null, nota: fin.tipo }

    // 4) leer monto y (opcional) vencimiento
    const m = (fin.montoEl.textContent || '').match(/([\d.]+)/)
    const deuda = m ? parseInt(m[1].replace(/\./g, ''), 10) : 0
    let venc = null
    const vEl = [...document.querySelectorAll('div,span')].find((e) => e.childElementCount === 0 && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test((e.textContent || '').trim()))
    if (vEl) { const mm = (vEl.textContent || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (mm) venc = mm[3] + '-' + mm[2].padStart(2, '0') + '-' + mm[1].padStart(2, '0') }

    return { deuda: isNaN(deuda) ? 0 : deuda, fecha: venc }
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

  console.log('[CRM Bridge v15] servipag-main.js (UI, MAIN world) activo en', location.href)
})()
