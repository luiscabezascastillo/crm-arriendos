// RUTA: app/lib/parseGlobal66.js
// VERSION: v1 · 2026-08-16 · Lector del Excel de movimientos de Global 66 (en el navegador, SheetJS).
//   Localiza la cabecera por nombre ('Tipo de transacción') y mapea columnas por su título, así que
//   aguanta cambios de orden. Débito/crédito, glosa, tercero, tipo de cambio e ID (para no duplicar).
'use client'

function celdaFechaISO(v) {
  if (v == null || v === '') return null
  if (v instanceof Date && !isNaN(v)) return v.toISOString()
  const s = String(v).trim()
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`
  const d = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return d ? `${d[1]}-${d[2]}-${d[3]}T00:00:00` : null
}
const num = (v) => { if (v == null || v === '') return null; const n = Number(String(v).replace(/[^\d.\-]/g, '')); return Number.isFinite(n) ? n : null }
const txt = (v) => { const s = String(v == null ? '' : v).trim(); return s || null }

export async function parseGlobal66(file) {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: false })

  // cabecera: la fila cuyo primer valor empieza por 'Tipo de transacc'
  let hi = -1
  for (let i = 0; i < rows.length; i++) {
    if (String((rows[i] || [])[0] || '').trim().toLowerCase().startsWith('tipo de transacc')) { hi = i; break }
  }
  if (hi < 0) throw new Error('No encontré la cabecera (columna «Tipo de transacción»). ¿Es el Excel de Global 66?')
  const H = Array.from(rows[hi] || [], c => String(c == null ? '' : c).trim().toLowerCase())
  const col = (...subs) => { for (let i = 0; i < H.length; i++) if (subs.some(s => H[i].includes(s))) return i; return -1 }
  const C = {
    tipo: col('tipo de transacc'), fecha: col('fecha'),
    debito: col('debitado'), credito: col('acreditado'),
    costo: col('costo de tipo de cambio'), glosa: col('glosa'), tercero: col('nombre tercero'),
    // 'tipo de cambio' colisiona con 'costo de tipo de cambio': se coge la que NO lleva 'costo'
    tc: (() => { for (let i = 0; i < H.length; i++) if (H[i].includes('tipo de cambio') && !H[i].includes('costo')) return i; return -1 })(),
    id: col('id de la transacc'),
  }
  const movimientos = []
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i] || []
    const tipo = txt(r[C.tipo])
    const fecha = celdaFechaISO(r[C.fecha])
    if (!tipo && !fecha) continue
    movimientos.push({
      id_transaccion: txt(r[C.id]),
      fecha, tipo, glosa: txt(r[C.glosa]), tercero: txt(r[C.tercero]),
      debito: num(r[C.debito]), credito: num(r[C.credito]),
      costo_cambio: C.costo >= 0 ? num(r[C.costo]) : null,
      tipo_cambio: C.tc >= 0 ? num(r[C.tc]) : null,
      moneda: 'CLP',
    })
  }
  return { archivo: file.name, movimientos }
}
