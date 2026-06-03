const fs = require('fs');
const file = 'app/publicaciones/page.js';
let c = fs.readFileSync(file, 'utf8');

// Añadir estado fPrecio
c = c.replace(
  "const [fComuna, setFComuna] = useState(emptyF)",
  "const [fComuna, setFComuna] = useState(emptyF)\n  const [fPrecio, setFPrecio] = useState(emptyF)"
);

// Añadir filtro precio en applyExcelFilters
c = c.replace(
  "    if (fComuna.selected.length) r = r.filter(p => fComuna.selected.includes(p.comuna))",
  "    if (fComuna.selected.length) r = r.filter(p => fComuna.selected.includes(p.comuna))\n    if (fPrecio.min !== '') r = r.filter(p => Number(p.valor) >= Number(fPrecio.min))\n    if (fPrecio.max !== '') r = r.filter(p => Number(p.valor) <= Number(fPrecio.max))"
);

// Añadir fPrecio a los sorts
c = c.replace(
  "      { f: fVendedor, k: 'vendedor' }, { f: fComuna, k: 'comuna' },",
  "      { f: fVendedor, k: 'vendedor' }, { f: fComuna, k: 'comuna' }, { f: fPrecio, k: 'valor', n: true },"
);

// Reemplazar cabecera Precio estática por ExcelFilter
c = c.replace(
  "<th style={{ padding:'9px 10px', borderBottom:'1px solid var(--border)', background:'var(--gray-50)', whiteSpace:'nowrap', fontSize:10, fontWeight:600, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Precio</th>",
  "<th style={{ padding:'9px 10px', borderBottom:'1px solid var(--border)', background:'var(--gray-50)' }}><ExcelFilter label=\"Precio\" type=\"number\" options={[]} value={fPrecio} onApply={setFPrecio} /></th>"
);

// Arreglar el sort para campo numérico
c = c.replace(
  "      const { k, f } = sorts[sorts.length - 1]\n      r.sort((a, b) => {\n        const av = String(a[k] || ''), bv = String(b[k] || '')\n        return f.sort === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)",
  "      const { k, f, n } = sorts[sorts.length - 1]\n      r.sort((a, b) => {\n        const av = n ? Number(a[k] || 0) : String(a[k] || '')\n        const bv = n ? Number(b[k] || 0) : String(b[k] || '')\n        return f.sort === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)"
);

fs.writeFileSync(file, c, 'utf8');
console.log('done:', c.includes('fPrecio'));