// RUTA: app/lib/parseFacturaInternacional.js
// VERSION: v1 · 2026-08-16 · Lector de la factura internacional de servicios (PDF), en el navegador.
//   Saca nº de factura, fecha, moneda+importe, proveedor y C.I. Validado contra las 7 facturas de
//   Fabiola (ene–jul 2026). El período (AAMM del servicio) = mes de la fecha de la factura.
'use client'

const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174'
const MES3 = { ENE: 1, FEB: 2, MAR: 3, ABR: 4, MAY: 5, JUN: 6, JUL: 7, AGO: 8, SEP: 9, OCT: 10, NOV: 11, DIC: 12 }

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

function fechaISO(dd, mm, yyyy) {
  const m = /^\d{2}$/.test(mm) ? Number(mm) : MES3[String(mm).toUpperCase().slice(0, 3)]
  if (!m) return null
  return `${yyyy}-${String(m).padStart(2, '0')}-${String(Number(dd)).padStart(2, '0')}`
}

// Núcleo puro: texto -> objeto factura. (Probado en Node con las 7.)
export function fiFromText(texto) {
  const t = String(texto || '').replace(/\s+/g, ' ')
  const numero = (t.match(/factura:\s*(\d+)/i) || [])[1] || null
  const mF = t.match(/fecha de la factura:\s*(\d{1,2})\s*-\s*([A-Za-zÉ]{3,}|\d{2})\s*-\s*(\d{4})/i)
  const fecha = mF ? fechaISO(mF[1], mF[2], mF[3]) : null
  const periodo = fecha ? fecha.slice(2, 4) + fecha.slice(5, 7) : null
  const mTot = t.match(/TOTAL\s+(USD|EUR|CLP|\$)\s*([\d.,]+)/i) || t.match(/(USD|EUR|CLP)\s*([\d.,]+)/i)
  const moneda = mTot ? mTot[1].toUpperCase().replace('$', 'USD') : null
  const importe = mTot ? Number(mTot[2].replace(/\./g, '').replace(',', '.')) : null
  const proveedor_id = (t.match(/C\.?I\.?\s*([\d.]+)/i) || [])[1] || null
  const mProv = t.match(/([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ .]{6,}?)\s+C\.?I\.?/)
  const proveedor = mProv ? mProv[1].replace(/\s+/g, ' ').trim() : null
  const mDesc = t.match(/DESCRIPCI[ÓO]N DE SERVICIOS\s*TOTAL\s*(.*?)\s*Subtotal/i)
  const descripcion = mDesc ? mDesc[1].replace(/\s+/g, ' ').trim() : null
  return { numero, fecha, periodo, moneda, importe, proveedor, proveedor_id, descripcion }
}

export async function parseFacturaInternacionalPDF(file) {
  const pdfjsLib = await cargarPdfJs()
  const buf = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  let texto = ''
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const tc = await page.getTextContent()
    texto += ' ' + tc.items.map(i => i.str).join(' ')
  }
  const f = fiFromText(texto)
  const avisos = []
  if (!f.numero) avisos.push('no encontré el número de factura')
  if (!f.fecha) avisos.push('no encontré la fecha')
  if (f.importe == null) avisos.push('no encontré el importe')
  return { ...f, archivo: file.name, avisos }
}
