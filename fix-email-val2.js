const fs = require('fs');
const file = 'app/contactos/page.js';
let c = fs.readFileSync(file, 'utf8');

// Resetear emailError al abrir el modal — añadir en el useState inicial
c = c.replace(
  "  const [emailError, setEmailError] = useState(false)",
  "  const [emailError, setEmailError] = useState(false)\n  const [email2Error, setEmail2Error] = useState(false)"
);

// Limpiar error al cambiar tipo_doc o al montar
c = c.replace(
  "  const [guardando, setGuardando] = useState(false)\n  const [error, setError] = useState(null)\n  const [emailError, setEmailError] = useState(false)\n  const [email2Error, setEmail2Error] = useState(false)",
  "  const [guardando, setGuardando] = useState(false)\n  const [error, setError] = useState(null)\n  const [emailError, setEmailError] = useState(() => form.email ? !validarEmail(form.email) : false)\n  const [email2Error, setEmail2Error] = useState(() => form.email_2 ? !validarEmail(form.email_2) : false)"
);

// Añadir validación y mensaje para email secundario
c = c.replace(
  "<input style={inp} type=\"email\" value={form.email_2} onChange={e => set('email_2', e.target.value)} />",
  "<input style={{...inp, borderColor: email2Error ? '#E8593C' : '#E0DDD8'}} type=\"email\" value={form.email_2} onChange={e => { set('email_2', e.target.value); setEmail2Error(e.target.value ? !validarEmail(e.target.value) : false) }} onBlur={e => setEmail2Error(e.target.value ? !validarEmail(e.target.value) : false)} />\n              {email2Error && <span style={{fontSize:11, color:'#E8593C'}}>Email inválido</span>}"
);

// Añadir validación email2 al guardar
c = c.replace(
  "    if (form.email && !validarEmail(form.email)) { setError('El email no tiene un formato válido'); return }",
  "    if (form.email && !validarEmail(form.email)) { setError('El email principal no tiene un formato válido'); return }\n    if (form.email_2 && !validarEmail(form.email_2)) { setError('El email secundario no tiene un formato válido'); return }"
);

fs.writeFileSync(file, c, 'utf8');
console.log('done:', c.includes('email2Error'));