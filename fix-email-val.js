const fs = require('fs');
const file = 'app/contactos/page.js';
let c = fs.readFileSync(file, 'utf8');

// 1. Añadir función validarEmail antes del componente ModalContacto
c = c.replace(
  "function ModalContacto({ contacto, onClose, onSaved }) {",
  `function validarEmail(email) {
  if (!email) return true // no obligatorio
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
}

function ModalContacto({ contacto, onClose, onSaved }) {`
);

// 2. Añadir estado emailError
c = c.replace(
  "  const [guardando, setGuardando] = useState(false)\n  const [error, setError] = useState(null)",
  "  const [guardando, setGuardando] = useState(false)\n  const [error, setError] = useState(null)\n  const [emailError, setEmailError] = useState(false)"
);

// 3. Validar email al guardar
c = c.replace(
  "    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }",
  "    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }\n    if (form.email && !validarEmail(form.email)) { setError('El email no tiene un formato válido'); return }"
);

// 4. Añadir validación inline en el campo email
c = c.replace(
  "<input style={inp} type=\"email\" value={form.email} onChange={e => set('email', e.target.value)} placeholder=\"email@ejemplo.com\" />",
  "<input style={{...inp, borderColor: emailError ? '#E8593C' : '#E0DDD8'}} type=\"email\" value={form.email} onChange={e => { set('email', e.target.value); setEmailError(e.target.value ? !validarEmail(e.target.value) : false) }} onBlur={e => setEmailError(e.target.value ? !validarEmail(e.target.value) : false)} placeholder=\"email@ejemplo.com\" />\n              {emailError && <span style={{fontSize:11, color:'#E8593C'}}>Email inválido</span>}"
);

fs.writeFileSync(file, c, 'utf8');
console.log('validarEmail:', c.includes('validarEmail'));
console.log('emailError:', c.includes('emailError'));
console.log('inline:', c.includes('Email inválido'));