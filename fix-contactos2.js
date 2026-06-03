const fs = require('fs');
const file = 'app/contactos/[id]/page.js';
let c = fs.readFileSync(file, 'utf8');

// 1. Actualizar roles
c = c.replace(
  "const ROLES = ['propietario', 'cliente', 'arrendatario', 'proveedor', 'otro']",
  "const ROLES = ['propietario', 'cliente', 'arrendatario', 'inversor', 'maestro', 'conserje', 'proveedor']"
);

// 2. Añadir modificado_por al guardar edicion
c = c.replace(
  "    await supabase.from('contactos').update({ ...form, updated_at: new Date().toISOString() }).eq('id', id)",
  "    const userEmail = session?.user?.email || 'desconocido'\n    await supabase.from('contactos').update({ ...form, updated_at: new Date().toISOString(), modificado_por: userEmail }).eq('id', id)"
);

// 3. Mostrar creado_por y modificado_por en tab Resumen
c = c.replace(
  "        ['Comercial', contacto.comercial_asignado || '—'],\n            ['Origen', contacto.origen || '—'],\n            ['Empresa', contacto.empresa || '—'],\n            ['Cargo', contacto.cargo || '—'],",
  "        ['Comercial', contacto.comercial_asignado || '—'],\n            ['Origen', contacto.origen || '—'],\n            ['Empresa', contacto.empresa || '—'],\n            ['Cargo', contacto.cargo || '—'],\n            ['Creado por', contacto.creado_por || '—'],\n            ['Modificado por', contacto.modificado_por || '—'],"
);

fs.writeFileSync(file, c, 'utf8');
console.log('roles:', c.includes('inversor'));
console.log('auditoria:', c.includes('modificado_por'));
console.log('muestra:', c.includes('Creado por'));