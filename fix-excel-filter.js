const fs = require('fs');
const file = 'app/publicaciones/page.js';
let c = fs.readFileSync(file, 'utf8');

// 1. Añadir el componente ExcelFilter y estado de filtros después de los imports
const excelFilterComp = `
const emptyF = { selected: [], sort: null, min: '', max: '' }

function ExcelFilter({ label, type, options, value, onApply, align }) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const [selected, setSelected] = React.useState(value.selected || [])
  const [sortDir, setSortDir] = React.useState(value.sort || null)
  const [minVal, setMinVal] = React.useState(value.min ?? '')
  const [maxVal, setMaxVal] = React.useState(value.max ?? '')
  const ref = React.useRef(null)

  React.useEffect(() => {
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const activo = (value.selected && value.selected.length > 0) || value.sort || value.min !== '' || value.max !== ''
  const filteredOpts = options.filter(o => String(o || '').toLowerCase().includes(search.toLowerCase()))

  function toggleAll() { setSelected(selected.length === options.length ? [] : [...options]) }
  function toggle(opt) { setSelected(s => s.includes(opt) ? s.filter(x => x !== opt) : [...s, opt]) }

  function apply() { onApply({ selected, sort: sortDir, min: minVal, max: maxVal }); setOpen(false) }
  function clear() {
    setSelected([]); setSortDir(null); setMinVal(''); setMaxVal('')
    onApply({ selected: [], sort: null, min: '', max: '' }); setOpen(false)
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      <button onClick={() => setOpen(v => !v)} style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600,
        color: activo ? '#1D4ED8' : '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em'
      }}>
        {label}
        <span style={{ fontSize: 9, color: activo ? '#1D4ED8' : '#9CA3AF' }}>
          {value.sort === 'asc' ? ' ↑' : value.sort === 'desc' ? ' ↓' : ' ⬇'}
        </span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', [align === 'right' ? 'right' : 'left']: 0, marginTop: 4,
          background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 220, zIndex: 300
        }}>
          <div style={{ padding: '8px 12px', borderBottom: '0.5px solid #F3F4F6' }}>
            <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 500, marginBottom: 6, textTransform: 'uppercase' }}>Ordenar</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[['asc', type === 'number' ? 'Menor → Mayor' : 'A → Z'], ['desc', type === 'number' ? 'Mayor → Menor' : 'Z → A']].map(([dir, lbl]) => (
                <button key={dir} onClick={() => setSortDir(d => d === dir ? null : dir)} style={{
                  flex: 1, padding: '4px 8px', borderRadius: 6, border: '1px solid',
                  fontSize: 11, cursor: 'pointer',
                  background: sortDir === dir ? '#EFF6FF' : '#F9FAFB',
                  borderColor: sortDir === dir ? '#BFDBFE' : '#E5E7EB',
                  color: sortDir === dir ? '#1D4ED8' : '#374151'
                }}>{lbl}</button>
              ))}
            </div>
          </div>
          {type === 'number' && (
            <div style={{ padding: '8px 12px', borderBottom: '0.5px solid #F3F4F6' }}>
              <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 500, marginBottom: 6, textTransform: 'uppercase' }}>Rango</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input placeholder="Mín" value={minVal} onChange={e => setMinVal(e.target.value)} type="number"
                  style={{ flex: 1, padding: '4px 8px', borderRadius: 6, border: '1px solid #E5E7EB', fontSize: 12 }} />
                <span style={{ color: '#9CA3AF', fontSize: 12 }}>—</span>
                <input placeholder="Máx" value={maxVal} onChange={e => setMaxVal(e.target.value)} type="number"
                  style={{ flex: 1, padding: '4px 8px', borderRadius: 6, border: '1px solid #E5E7EB', fontSize: 12 }} />
              </div>
            </div>
          )}
          <div style={{ padding: '8px 12px', borderBottom: '0.5px solid #F3F4F6' }}>
            <input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '4px 8px', borderRadius: 6, border: '1px solid #E5E7EB', fontSize: 12, boxSizing: 'border-box' }} />
          </div>
          <div style={{ maxHeight: 180, overflowY: 'auto', padding: '4px' }}>
            <div onClick={toggleAll} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
              onMouseEnter={e => e.currentTarget.style.background = '#F3F4F6'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <input type="checkbox" readOnly checked={selected.length === options.length} style={{ margin: 0 }} />
              <span style={{ fontWeight: 500 }}>Seleccionar todo</span>
            </div>
            {filteredOpts.map(opt => (
              <div key={String(opt)} onClick={() => toggle(opt)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
                onMouseEnter={e => e.currentTarget.style.background = '#F3F4F6'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <input type="checkbox" readOnly checked={selected.includes(opt)} style={{ margin: 0 }} />
                <span>{opt === null || opt === '' ? '(vacío)' : String(opt)}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: '8px 12px', borderTop: '0.5px solid #F3F4F6', display: 'flex', gap: 6 }}>
            <button onClick={clear} style={{ flex: 1, padding: '5px', borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', fontSize: 12, cursor: 'pointer', color: '#6B7280' }}>
              Limpiar
            </button>
            <button onClick={apply} style={{ flex: 1, padding: '5px', borderRadius: 6, border: 'none', background: '#1D4ED8', fontSize: 12, cursor: 'pointer', color: '#fff', fontWeight: 500 }}>
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

`;

// Insertar antes del export default
c = c.replace('export default function PublicacionesPage() {', excelFilterComp + 'export default function PublicacionesPage() {');

// 2. Añadir React import si no existe
if (!c.includes("import React")) {
  c = c.replace("'use client'", "'use client'\nimport React from 'react'");
}

// 3. Añadir estados de filtros Excel después de const [pubsMapa
c = c.replace(
  "const [pubsMapa, setPubsMapa] = useState([])",
  `const [pubsMapa, setPubsMapa] = useState([])
  const [fCodigo, setFCodigo] = useState(emptyF)
  const [fTipo, setFTipo] = useState(emptyF)
  const [fEstado, setFEstado] = useState(emptyF)
  const [fCaptador, setFCaptador] = useState(emptyF)
  const [fVendedor, setFVendedor] = useState(emptyF)
  const [fComuna, setFComuna] = useState(emptyF)
  const [sortCol, setSortCol] = useState(null)
  const [sortDir2, setSortDir2] = useState(null)`
);

// 4. Añadir función para obtener valores únicos y aplicar filtros Excel
// Insertar antes del return de la página
c = c.replace(
  "  return (\n    <div style={{ minHeight:'100vh'",
  `  const unicos = (campo) => [...new Set(pubs.map(p => p[campo]).filter(Boolean))].sort()

  function applyExcelFilters(lista) {
    let r = [...lista]
    if (fCodigo.selected.length) r = r.filter(p => fCodigo.selected.includes(p.codigo))
    if (fTipo.selected.length) r = r.filter(p => fTipo.selected.includes(p.tipo))
    if (fEstado.selected.length) r = r.filter(p => fEstado.selected.includes(p.estado))
    if (fCaptador.selected.length) r = r.filter(p => fCaptador.selected.includes(p.captador))
    if (fVendedor.selected.length) r = r.filter(p => fVendedor.selected.includes(p.vendedor))
    if (fComuna.selected.length) r = r.filter(p => fComuna.selected.includes(p.comuna))
    const sorts = [
      { f: fCodigo, k: 'codigo', n: false },
      { f: fTipo, k: 'tipo', n: false },
      { f: fEstado, k: 'estado', n: false },
      { f: fCaptador, k: 'captador', n: false },
      { f: fVendedor, k: 'vendedor', n: false },
      { f: fComuna, k: 'comuna', n: false },
    ].filter(s => s.f.sort)
    if (sorts.length) {
      const { k, n, f } = sorts[sorts.length - 1]
      r.sort((a, b) => {
        const av = n ? Number(a[k] || 0) : String(a[k] || '')
        const bv = n ? Number(b[k] || 0) : String(b[k] || '')
        return f.sort === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
      })
    }
    return r
  }

  const pubsFiltradas = applyExcelFilters(pubs)
  const hayFiltrosExcel = [fCodigo, fTipo, fEstado, fCaptador, fVendedor, fComuna].some(f => f.selected.length || f.sort)

  return (\n    <div style={{ minHeight:'100vh'`
);

// 5. Reemplazar cabeceras simples por ExcelFilter
const oldHeaders = `{['Imagen','C\u00c3\u00b3digo','Tipo','Operaci\u00c3\u00b3n','Estado','Captador','Vendedor','Direcci\u00c3\u00b3n','Precio','Comuna', modo==='historicas'?'Acci\u00c3\u00b3n':'Acciones'].map((h,i) => (
                      <th key={i} style={{ padding:'9px 10px', textAlign:'left', fontSize:10, fontWeight:600, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' }}>{h}</th>
                    ))}`;

const newHeaders = `<th style={{ padding:'9px 10px', borderBottom:'1px solid var(--border)', background:'var(--gray-50)' }}>
                      <ExcelFilter label="Código" type="text" options={unicos('codigo')} value={fCodigo} onApply={setFCodigo} />
                    </th>
                    <th style={{ padding:'9px 10px', borderBottom:'1px solid var(--border)', background:'var(--gray-50)' }}>
                      <ExcelFilter label="Tipo" type="text" options={unicos('tipo')} value={fTipo} onApply={setFTipo} />
                    </th>
                    <th style={{ padding:'9px 10px', borderBottom:'1px solid var(--border)', background:'var(--gray-50)', whiteSpace:'nowrap', fontSize:10, fontWeight:600, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Operación</th>
                    <th style={{ padding:'9px 10px', borderBottom:'1px solid var(--border)', background:'var(--gray-50)' }}>
                      <ExcelFilter label="Estado" type="text" options={unicos('estado')} value={fEstado} onApply={setFEstado} />
                    </th>
                    <th style={{ padding:'9px 10px', borderBottom:'1px solid var(--border)', background:'var(--gray-50)' }}>
                      <ExcelFilter label="Captador" type="text" options={unicos('captador')} value={fCaptador} onApply={setFCaptador} />
                    </th>
                    <th style={{ padding:'9px 10px', borderBottom:'1px solid var(--border)', background:'var(--gray-50)' }}>
                      <ExcelFilter label="Vendedor" type="text" options={unicos('vendedor')} value={fVendedor} onApply={setFVendedor} />
                    </th>
                    <th style={{ padding:'9px 10px', borderBottom:'1px solid var(--border)', background:'var(--gray-50)', whiteSpace:'nowrap', fontSize:10, fontWeight:600, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Dirección</th>
                    <th style={{ padding:'9px 10px', borderBottom:'1px solid var(--border)', background:'var(--gray-50)', whiteSpace:'nowrap', fontSize:10, fontWeight:600, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Precio</th>
                    <th style={{ padding:'9px 10px', borderBottom:'1px solid var(--border)', background:'var(--gray-50)' }}>
                      <ExcelFilter label="Comuna" type="text" options={unicos('comuna')} value={fComuna} onApply={setFComuna} />
                    </th>
                    <th style={{ padding:'9px 10px', borderBottom:'1px solid var(--border)', background:'var(--gray-50)', whiteSpace:'nowrap', fontSize:10, fontWeight:600, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'0.05em' }}>{modo==='historicas'?'Acción':'Acciones'}</th>`;

c = c.replace(oldHeaders, newHeaders);

// 6. Usar pubsFiltradas en lugar de pubs en el map de la tabla
c = c.replace(
  "{pubs.map((p,i) => {",
  "{pubsFiltradas.map((p,i) => {"
);

fs.writeFileSync(file, c, 'utf8');

console.log('1. ExcelFilter comp:', c.includes('function ExcelFilter'));
console.log('2. estados filtros:', c.includes('fCaptador'));
console.log('3. cabeceras:', c.includes('onApply={setFCodigo}'));
console.log('4. pubsFiltradas:', c.includes('pubsFiltradas.map'));
