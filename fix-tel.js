const fs = require('fs');
const file = 'app/contactos/page.js';
let c = fs.readFileSync(file, 'utf8');

// 1. Añadir funciones de validación después de validarEmail
c = c.replace(
  "function formatRUT(valor) {",
  `function validarTelChile(tel) {
  if (!tel) return true
  const limpio = tel.replace(/[\s\-().+]/g, '')
  // Acepta: 56912345678, 912345678, +56912345678
  return /^(56)?[2-9]\d{8}$/.test(limpio)
}

function validarTelIntl(tel) {
  if (!tel) return true
  const limpio = tel.replace(/[\s\-().+]/g, '')
  return /^\d{7,15}$/.test(limpio)
}

function formatTelChile(tel) {
  const limpio = tel.replace(/[\s\-().]/g, '').replace(/^\+?56/, '')
  if (limpio.length === 0) return tel
  if (limpio.length <= 9) {
    // Móvil: 9 XXXX XXXX
    if (limpio.startsWith('9') && limpio.length === 9)
      return '+56 ' + limpio[0] + ' ' + limpio.slice(1,5) + ' ' + limpio.slice(5)
  }
  return tel
}

function formatRUT(valor) {`
);

// 2. Añadir validaciones al objeto validar()
c = c.replace(
  "    if (form.email_2 && !validarEmail(form.email_2)) e.email_2 = 'Email inválido'",
  "    if (form.email_2 && !validarEmail(form.email_2)) e.email_2 = 'Email inválido'\n    if (form.telefono && !validarTelChile(form.telefono)) e.telefono = 'Formato inválido — ej: +56 9 1234 5678'\n    if (form.whatsapp && !validarTelIntl(form.whatsapp)) e.whatsapp = 'Número inválido (7-15 dígitos)'"
);

// 3. Añadir formateo y data-error en campo teléfono
c = c.replace(
  "<input style={inp('telefono')} value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder=\"+56 9 xxxx xxxx\" />",
  "<input data-error={!!errores.telefono} style={inp('telefono')} value={form.telefono} onChange={e => set('telefono', e.target.value)} onBlur={e => { const f = formatTelChile(e.target.value); if (f !== e.target.value) set('telefono', f) }} placeholder=\"+56 9 xxxx xxxx\" />\n              {errores.telefono && <div style={{fontSize:11,color:'#E8593C',marginTop:3}}>{errores.telefono}</div>}"
);

// 4. Añadir data-error en campo whatsapp
c = c.replace(
  "<input style={inp('whatsapp')} value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} placeholder=\"+56 9 xxxx xxxx\" />",
  "<input data-error={!!errores.whatsapp} style={inp('whatsapp')} value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} placeholder=\"+56 9 xxxx xxxx\" />\n              {errores.whatsapp && <div style={{fontSize:11,color:'#E8593C',marginTop:3}}>{errores.whatsapp}</div>}"
);

fs.writeFileSync(file, c, 'utf8');
console.log('validarTel:', c.includes('validarTelChile'));
console.log('formato:', c.includes('formatTelChile'));
console.log('error tel:', c.includes('errores.telefono'));