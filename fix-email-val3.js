const fs = require('fs');
const file = 'app/contactos/page.js';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(
  "  const [emailError, setEmailError] = useState(() => form.email ? !validarEmail(form.email) : false)\n  const [email2Error, setEmail2Error] = useState(() => form.email_2 ? !validarEmail(form.email_2) : false)",
  "  const [emailError, setEmailError] = useState(false)\n  const [email2Error, setEmail2Error] = useState(false)"
);

fs.writeFileSync(file, c, 'utf8');
console.log('done:', c.includes("useState(false)\n  const [email2Error"));