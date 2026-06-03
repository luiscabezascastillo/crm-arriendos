const fs = require('fs');
const file = 'app/publicaciones/page.js';
let c = fs.readFileSync(file, 'utf8');

const insert = `
  const unicos = (campo) => [...new Set(pubs.map(p => p[campo]).filter(Boolean))].sort()

  function applyExcelFilters(lista) {
    let r = [...lista]
    if (fCodigo.selected.length) r = r.filter(p => fCodigo.selected.includes(p.codigo))
    if (fTipo.selected.length) r = r.filter(p => fTipo.selected.includes(p.tipo))
    if (fEstado.selected.length) r = r.filter(p => fEstado.selected.includes(p.estado))
    if (fCaptador.selected.length) r = r.filter(p => fCaptador.selected.includes(p.captador))
    if (fVendedor.selected.length) r = r.filter(p => fVendedor.selected.includes(p.vendedor))
    if (fComuna.selected.length) r = r.filter(p => fComuna.selected.includes(p.comuna))
    const sorts = [
      { f: fCodigo, k: 'codigo' }, { f: fTipo, k: 'tipo' },
      { f: fEstado, k: 'estado' }, { f: fCaptador, k: 'captador' },
      { f: fVendedor, k: 'vendedor' }, { f: fComuna, k: 'comuna' },
    ].filter(s => s.f.sort)
    if (sorts.length) {
      const { k, f } = sorts[sorts.length - 1]
      r.sort((a, b) => {
        const av = String(a[k] || ''), bv = String(b[k] || '')
        return f.sort === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
      })
    }
    return r
  }

  const pubsFiltradas = applyExcelFilters(pubs)

`;

c = c.replace(
  "  return (\r\n    <div style={{ minHeight",
  insert + "  return (\r\n    <div style={{ minHeight"
);

fs.writeFileSync(file, c, 'utf8');
console.log('done:', c.includes('const unicos'));