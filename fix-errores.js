const fs = require('fs');
const file = 'app/contactos/page.js';
let c = fs.readFileSync(file, 'utf8');

// Añadir scroll al primer campo con error + resumen arriba del botón
c = c.replace(
  "    if (Object.keys(e).length === 0) return Object.keys(e).length === 0",
  "    if (Object.keys(e).length === 0) return true\n    // Scroll al primer error\n    setTimeout(() => {\n      const el = document.querySelector('[data-error=\"true\"]')\n      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })\n    }, 50)\n    return false"
);

// Corregir el return de validar
c = c.replace(
  "    setErrores(e)\n    return Object.keys(e).length === 0",
  "    setErrores(e)\n    setTimeout(() => {\n      const el = document.querySelector('[data-error=\"true\"]')\n      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })\n    }, 50)\n    return Object.keys(e).length === 0"
);

// Añadir data-error en campos con error
c = c.replace(
  '<input\n                style={inp(\'numero_doc\')}',
  '<input\n                data-error={!!errores.numero_doc}\n                style={inp(\'numero_doc\')}'
);
c = c.replace(
  '<input style={inp(\'nombre\')} value={form.nombre}',
  '<input data-error={!!errores.nombre} style={inp(\'nombre\')} value={form.nombre}'
);
c = c.replace(
  '<input style={inp(\'email\')} value={form.email}',
  '<input data-error={!!errores.email} style={inp(\'email\')} value={form.email}'
);

fs.writeFileSync(file, c, 'utf8');
console.log('done:', c.includes('data-error'));