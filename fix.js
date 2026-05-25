const fs = require('fs');
const file = 'app/panel/page.js';
let c = fs.readFileSync(file, 'utf8');

// Quitar href del value
c = c.replace(
  "{ label: 'Morosos',     value: '8 (8,4%)', highlight: 'danger', href: '/op/morosidad' }",
  "{ label: 'Morosos',     value: '8 (8,4%)', highlight: 'danger', labelHref: '/op/morosidad' }"
);

// Hacer el label clickeable
const oldLabel = "            <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>{row.label}</span>";
const newLabel = [
  "            {row.labelHref ? (",
  "              <a href={row.labelHref} style={{ fontSize: 12, color: 'var(--gray-500)', textDecoration: 'none', cursor: 'pointer', borderBottom: '1px dashed var(--gray-400)' }}>{row.label}</a>",
  "            ) : (",
  "              <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>{row.label}</span>",
  "            )}",
].join('\r\n');
c = c.replace(oldLabel, newLabel);

// Revertir el value a span simple
const oldValue = [
  '            {row.href ? (',
  '              <Link href={row.href} style={{',
  '                fontSize: 13, fontWeight: 500, textDecoration: "none",',
  "                color: row.highlight === 'danger' ? 'var(--danger-600)'",
  "                     : row.highlight === 'warning' ? 'var(--warning-600)'",
  "                     : 'var(--gray-800)',",
  '              }}>{row.value} \u2192</Link>',
  '            ) : (',
  '              <span style={{',
  '                fontSize: 13, fontWeight: 500,',
  "                color: row.highlight === 'danger' ? 'var(--danger-600)'",
  "                     : row.highlight === 'warning' ? 'var(--warning-600)'",
  "                     : 'var(--gray-800)',",
  '              }}>{row.value}</span>',
  '            )}',
].join('\r\n');
const newValue = [
  '            <span style={{',
  '              fontSize: 13, fontWeight: 500,',
  "              color: row.highlight === 'danger' ? 'var(--danger-600)'",
  "                   : row.highlight === 'warning' ? 'var(--warning-600)'",
  "                   : 'var(--gray-800)',",
  '            }}>{row.value}</span>',
].join('\r\n');
c = c.replace(oldValue, newValue);

fs.writeFileSync(file, c, 'utf8');
console.log('done:', c.includes('labelHref'));