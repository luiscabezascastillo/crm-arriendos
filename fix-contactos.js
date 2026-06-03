const fs = require('fs');
const file = 'app/contactos/page.js';
let c = fs.readFileSync(file, 'utf8');

// 1. Actualizar roles
c = c.replace(
  "const ROLES = ['propietario', 'cliente', 'arrendatario', 'proveedor', 'otro']",
  "const ROLES = ['propietario', 'cliente', 'arrendatario', 'inversor', 'maestro', 'conserje', 'proveedor']"
);

// 2. Añadir useSession import
c = c.replace(
  "import { createClient } from '@supabase/supabase-js'",
  "import { createClient } from '@supabase/supabase-js'\nimport { useSession } from 'next-auth/react'"
);

// 3. Añadir useSession en el modal
c = c.replace(
  "function ModalContacto({ contacto, onClose, onSaved }) {\n  const esNuevo = !contacto?.id",
  "function ModalContacto({ contacto, onClose, onSaved }) {\n  const { data: session } = useSession()\n  const esNuevo = !contacto?.id"
);

// 4. Añadir creado_por y modificado_por al guardar
c = c.replace(
  "    const payload = { ...form, updated_at: new Date().toISOString() }\n    const { error: err } = esNuevo\n      ? await supabase.from('contactos').insert(payload)\n      : await supabase.from('contactos').update(payload).eq('id', contacto.id)",
  "    const userEmail = session?.user?.email || 'desconocido'\n    const payload = { ...form, updated_at: new Date().toISOString(), modificado_por: userEmail, ...(esNuevo ? { creado_por: userEmail } : {}) }\n    const { error: err } = esNuevo\n      ? await supabase.from('contactos').insert(payload)\n      : await supabase.from('contactos').update(payload).eq('id', contacto.id)"
);

fs.writeFileSync(file, c, 'utf8');
console.log('roles:', c.includes('inversor'));
console.log('session:', c.includes('useSession'));
console.log('auditoria:', c.includes('creado_por'));