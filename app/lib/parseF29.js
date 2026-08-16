// RUTA: app/lib/parseF29.js
// VERSION: v1 · 2026-08-16 · Lector del F29 (SII) en PDF, en el navegador (pdf.js desde CDN).
//   El F29 trae capa de texto con posiciones fijas. Se reconstruyen filas por 'y' y se detecta
//   el CÓDIGO por su ancla de columna (x≈39 izquierda, x≈339 derecha, x≈299 totales) y el VALOR
//   como el número más a la derecha de su celda. Validado contra 6 F29 reales de FCR (ene–jun 2026),
//   incluida la rectificatoria de mayo: los tres componentes (089 IVA + 062 PPM + 151 retención)
//   cuadran con el total 091 en todos.
'use client'

const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174'

async function cargarPdfJs() {
  if (typeof window === 'undefined') throw new Error('Solo en el navegador.')
  if (window.pdfjsLib) return window.pdfjsLib
  await new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = `${CDN}/pdf.min.js`
    s.onload = resolve
    s.onerror = () => reject(new Error('No pude cargar el lector de PDF (pdf.js). ¿Hay conexión?'))
    document.head.appendChild(s)
  })
  if (!window.pdfjsLib) throw new Error('pdf.js no quedó disponible.')
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${CDN}/pdf.worker.min.js`
  return window.pdfjsLib
}

// ── Núcleo puro: items {s,x,y} -> objeto F29. (Probado en Node con los 6 PDF.) ──
export function f29FromItems(items) {
  const it = items.filter(i => i.s && i.s.trim()).map(i => ({ s: i.s.trim(), x: Math.round(i.x), y: Math.round(i.y) }))
  it.sort((a, b) => b.y - a.y || a.x - b.x)
  const rows = []; let cur = null
  for (const t of it) { if (!cur || Math.abs(cur.y - t.y) > 3) { cur = { y: t.y, its: [] }; rows.push(cur) } cur.its.push(t) }
  for (const r of rows) r.its.sort((a, b) => a.x - b.x)

  const esCodigo = (t) => /^\d{2,4}$/.test(t.s) && ((t.x >= 34 && t.x <= 42) || (t.x >= 296 && t.x <= 301) || (t.x >= 337 && t.x <= 342))
  const esNum = (s) => /^-?[\d.]+$/.test(s)
  const M = {}       // codigo -> valor (texto)
  const G = {}       // codigo -> glosa
  for (const r of rows) {
    for (let i = 0; i < r.its.length; i++) {
      if (!esCodigo(r.its[i])) continue
      const code = r.its[i].s
      let val = null; const glosa = []
      for (let j = i + 1; j < r.its.length; j++) {
        if (esCodigo(r.its[j])) break
        if (esNum(r.its[j].s)) val = r.its[j].s
        else glosa.push(r.its[j].s)
      }
      if (M[code] === undefined) { if (val != null) M[code] = val; if (glosa.length) G[code] = glosa.join(' ') }
    }
  }
  const findRowWith = (frag) => rows.find(r => r.its.some(t => t.s.includes(frag)))
  const tokTrasEtiqueta = (frag, re) => { const r = findRowWith(frag); if (!r) return null; const m = r.its.filter(t => re.test(t.s)); return m.length ? m[m.length - 1].s : null }
  const folio = tokTrasEtiqueta('FOLIO', /^\d{6,}$/)
  const periodo = tokTrasEtiqueta('PERIODO', /^\d{6}$/)
  const rut = tokTrasEtiqueta('RUT', /^[\d.]+-[\dkK]$/)

  let tipo = null, corrige = null, fechaPres = null, banco = null, medio = null
  const iLbl = rows.findIndex(r => r.its.some(t => t.s.includes('Tipo de Declaración')))
  if (iLbl >= 0 && rows[iLbl + 1]) {
    for (const t of rows[iLbl + 1].its) {
      if (t.x < 114) tipo = (tipo ? tipo + ' ' : '') + t.s
      else if (t.x < 245) { if (/\d/.test(t.s)) corrige = t.s }
      else if (t.x < 366) banco = t.s
      else if (t.x < 470) medio = t.s
      else fechaPres = t.s
    }
  }
  const n = (c, rate) => { const v = M[c]; if (v == null) return null; return rate ? parseFloat(v) : parseInt(String(v).replace(/\./g, ''), 10) }
  const tipoNorm = /rectific/i.test(tipo || '') ? (/sin\s*giro/i.test(tipo) ? 'rectificatoria_sin_giro' : 'rectificatoria_con_giro') : 'primitiva'

  return {
    periodo, folio, rut,
    tipo_texto: tipo, tipo_declaracion: tipoNorm, corrige_folio: corrige,
    fecha_presentacion: fechaPres, banco, medio_pago: medio,
    iva_debito: n('538'), iva_credito: n('537'), iva_a_pagar: n('089'), remanente_siguiente: n('077'),
    ppm: n('062'), ppm_base: n('563'), ppm_tasa: n('115', true), retencion_honorarios: n('151'),
    reajustes: n('92'), intereses: n('93'), multas: n('94'), total_a_pagar: n('91'),
    n_facturas: n('503'), n_boletas: n('110'), n_nc: n('509'),
    lineas: Object.keys(M).map(codigo => ({ codigo, glosa: G[codigo] || null, valor_texto: M[codigo] })),
  }
}

// Lee un File PDF del F29 y devuelve el objeto parseado. Cuadra 089+062+151 contra 091.
export async function parseF29PDF(file) {
  const pdfjsLib = await cargarPdfJs()
  const buf = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  const page = await pdf.getPage(1)
  const tc = await page.getTextContent()
  const items = tc.items.filter(i => i.str && i.str.trim()).map(i => ({ s: i.str, x: i.transform[4], y: i.transform[5] }))
  const f = f29FromItems(items)

  const avisos = []
  if (!f.periodo || !/^\d{6}$/.test(f.periodo)) avisos.push('no encontré el período (código 15)')
  if (!f.folio) avisos.push('no encontré el folio (código 07)')
  if (f.total_a_pagar == null) avisos.push('no encontré el total a pagar (código 91)')
  // cuadre interno del F29
  const suma = (f.iva_a_pagar || 0) + (f.ppm || 0) + (f.retencion_honorarios || 0)
  if (f.total_a_pagar != null && Math.abs(suma - f.total_a_pagar) > 3) {
    avisos.push(`no cuadra: IVA ${f.iva_a_pagar} + PPM ${f.ppm} + retención ${f.retencion_honorarios} = ${suma} ≠ total ${f.total_a_pagar}`)
  }
  return { ...f, archivo: file.name, avisos }
}
