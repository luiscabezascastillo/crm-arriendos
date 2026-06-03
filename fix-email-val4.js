const fs = require('fs');
const file = 'app/contactos/page.js';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(
  'type="email" value={form.email} onChange={e => { set(\'email\', e.target.value); setEmailError(e.target.value ? !validarEmail(e.target.value) : false) }} onBlur={e => setEmailError(e.target.value ? !validarEmail(e.target.value) : false)} placeholder="email@ejemplo.com"',
  'type="email" autoComplete="off" value={form.email} onChange={e => { set(\'email\', e.target.value); setEmailError(e.target.value ? !validarEmail(e.target.value) : false) }} onBlur={e => setEmailError(e.target.value ? !validarEmail(e.target.value) : false)} placeholder="email@ejemplo.com"'
);

fs.writeFileSync(file, c, 'utf8');
console.log('done:', c.includes('autoComplete="off"'));