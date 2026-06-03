const fs = require('fs');
const file = 'app/contactos/page.js';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(
  "onChange={e => { set('email', e.target.value); setEmailError(e.target.value ? !validarEmail(e.target.value) : false) }} onBlur={e => setEmailError(e.target.value ? !validarEmail(e.target.value) : false)}",
  "onChange={e => { const v = e.target.value; set('email', v); setEmailError(v.length > 3 && !validarEmail(v)) }} onBlur={e => { const v = e.target.value; setEmailError(v ? !validarEmail(v) : false) }}"
);

fs.writeFileSync(file, c, 'utf8');
console.log('done:', c.includes('v.length > 3'));