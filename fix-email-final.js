const fs = require('fs');
const file = 'app/contactos/page.js';
let c = fs.readFileSync(file, 'utf8');

// Reemplazar toda la lógica del campo email por algo simple
c = c.replace(
  /\{\.\.\.inp, borderColor: emailError \? '#E8593C' : '#E0DDD8'\}.*?onBlur=\{e => \{ const v = e\.target\.value; setEmailError\(v \? !validarEmail\(v\) : false\) \}\}/s,
  "{...inp} type=\"email\" autoComplete=\"new-password\" value={form.email} onChange={e => set('email', e.target.value)}"
);

// Quitar el mensaje de error inline — solo validar al guardar
c = c.replace(
  "\n              {emailError && <span style={{fontSize:11, color:'#E8593C'}}>Email inválido</span>}",
  ""
);

fs.writeFileSync(file, c, 'utf8');
console.log('done:', !c.includes('emailError &&'));