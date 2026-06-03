const fs = require('fs');
const file = 'app/publicaciones/page.js';
let c = fs.readFileSync(file, 'utf8');

// En applyExcelFilters, normalizar valor a pesos para comparar
c = c.replace(
  "      const { k, f, n } = sorts[sorts.length - 1]\n      r.sort((a, b) => {\n        const av = n ? Number(a[k] || 0) : String(a[k] || '')\n        const bv = n ? Number(b[k] || 0) : String(b[k] || '')\n        return f.sort === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)",
  "      const { k, f, n } = sorts[sorts.length - 1]\n      r.sort((a, b) => {\n        const toP = (p) => p.tipo_moneda === 'UF' ? Number(p.valor||0) * (valorUF||1) : Number(p.valor||0)\n        const av = k === 'valor' ? toP(a) : (n ? Number(a[k]||0) : String(a[k]||''))\n        const bv = k === 'valor' ? toP(b) : (n ? Number(b[k]||0) : String(b[k]||''))\n        return f.sort === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)"
);

// Filtro min/max también en pesos
c = c.replace(
  "    if (fPrecio.min !== '') r = r.filter(p => Number(p.valor) >= Number(fPrecio.min))\n    if (fPrecio.max !== '') r = r.filter(p => Number(p.valor) <= Number(fPrecio.max))",
  "    const toP = (p) => p.tipo_moneda === 'UF' ? Number(p.valor||0) * (valorUF||1) : Number(p.valor||0)\n    if (fPrecio.min !== '') r = r.filter(p => toP(p) >= Number(fPrecio.min))\n    if (fPrecio.max !== '') r = r.filter(p => toP(p) <= Number(fPrecio.max))"
);

fs.writeFileSync(file, c, 'utf8');
console.log('done:', c.includes('toP'));