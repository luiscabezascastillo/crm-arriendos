const fs = require('fs');
const file = 'app/publicaciones/page.js';
let c = fs.readFileSync(file, 'utf8');

const oldH = `{['Imagen','C\u00f3digo','Tipo','Operaci\u00f3n','Estado','Captador','Vendedor','Direcci\u00f3n','Precio','Comuna', modo==='historicas'?'Acci\u00f3n':'Acciones'].map((h,i) => (\r\n                    <th key={i} style={{ padding:'9px 10px', textAlign:'left', fontSize:10, fontWeight:600, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' }}>{h}</th>\r\n                  ))}`;

const newH = `<th style={{ padding:'9px 10px', borderBottom:'1px solid var(--border)', background:'var(--gray-50)', whiteSpace:'nowrap', fontSize:10, fontWeight:600, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Imagen</th>
                    <th style={{ padding:'9px 10px', borderBottom:'1px solid var(--border)', background:'var(--gray-50)' }}>
                      <ExcelFilter label="C\u00f3digo" type="text" options={unicos('codigo')} value={fCodigo} onApply={setFCodigo} />
                    </th>
                    <th style={{ padding:'9px 10px', borderBottom:'1px solid var(--border)', background:'var(--gray-50)' }}>
                      <ExcelFilter label="Tipo" type="text" options={unicos('tipo')} value={fTipo} onApply={setFTipo} />
                    </th>
                    <th style={{ padding:'9px 10px', borderBottom:'1px solid var(--border)', background:'var(--gray-50)', whiteSpace:'nowrap', fontSize:10, fontWeight:600, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Operaci\u00f3n</th>
                    <th style={{ padding:'9px 10px', borderBottom:'1px solid var(--border)', background:'var(--gray-50)' }}>
                      <ExcelFilter label="Estado" type="text" options={unicos('estado')} value={fEstado} onApply={setFEstado} />
                    </th>
                    <th style={{ padding:'9px 10px', borderBottom:'1px solid var(--border)', background:'var(--gray-50)' }}>
                      <ExcelFilter label="Captador" type="text" options={unicos('captador')} value={fCaptador} onApply={setFCaptador} />
                    </th>
                    <th style={{ padding:'9px 10px', borderBottom:'1px solid var(--border)', background:'var(--gray-50)' }}>
                      <ExcelFilter label="Vendedor" type="text" options={unicos('vendedor')} value={fVendedor} onApply={setFVendedor} />
                    </th>
                    <th style={{ padding:'9px 10px', borderBottom:'1px solid var(--border)', background:'var(--gray-50)', whiteSpace:'nowrap', fontSize:10, fontWeight:600, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Direcci\u00f3n</th>
                    <th style={{ padding:'9px 10px', borderBottom:'1px solid var(--border)', background:'var(--gray-50)', whiteSpace:'nowrap', fontSize:10, fontWeight:600, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Precio</th>
                    <th style={{ padding:'9px 10px', borderBottom:'1px solid var(--border)', background:'var(--gray-50)' }}>
                      <ExcelFilter label="Comuna" type="text" options={unicos('comuna')} value={fComuna} onApply={setFComuna} />
                    </th>
                    <th style={{ padding:'9px 10px', borderBottom:'1px solid var(--border)', background:'var(--gray-50)', whiteSpace:'nowrap', fontSize:10, fontWeight:600, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'0.05em' }}>{modo==='historicas'?'Acci\u00f3n':'Acciones'}</th>`;

c = c.replace(oldH, newH);
fs.writeFileSync(file, c, 'utf8');
console.log('done:', c.includes('onApply={setFCodigo}'));