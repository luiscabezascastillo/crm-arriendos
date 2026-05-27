const fs = require('fs');
const file = 'app/publicaciones/page.js';
let c = fs.readFileSync(file, 'utf8');

const old = "{p.captador||'\u2014'}\r\n                      </td>\r\n                      <td style={{ padding:'8px 10px', borderBottom:'1px solid var(--border-subtle)', verticalAlign:'top' }}>";
const neu = "{p.captador||'\u2014'}\r\n                      </td>\r\n                      <td style={{ padding:'8px 10px', fontSize:11, color:'var(--gray-600)', borderBottom:'1px solid var(--border-subtle)', verticalAlign:'top', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>\r\n                        {p.vendedor||'\u2014'}\r\n                      </td>\r\n                      <td style={{ padding:'8px 10px', borderBottom:'1px solid var(--border-subtle)', verticalAlign:'top' }}>";

c = c.replace(old, neu);
fs.writeFileSync(file, c, 'utf8');
console.log('done:', c.includes('p.vendedor'));