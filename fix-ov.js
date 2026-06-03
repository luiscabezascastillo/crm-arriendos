const fs = require('fs');
const file = 'app/contactos/[id]/page.js';
let c = fs.readFileSync(file, 'utf8');

// 1. Añadir import del modal
c = c.replace(
  "import TopNav from '../../components/ui/TopNav'",
  "import TopNav from '../../components/ui/TopNav'\nimport OrdenVisitaModal from '../../components/ui/OrdenVisitaModal'"
);

// 2. Añadir estado para el modal OV
c = c.replace(
  "const [guardando, setGuardando] = useState(false)",
  "const [guardando, setGuardando] = useState(false)\n  const [ovOpen, setOvOpen] = useState(false)"
);

// 3. Añadir botón Nueva OV junto a Editar
c = c.replace(
  "    <button onClick={() => setEditando(true)} style={{ padding: '7px 16px', borderRadius: 7, border: '1px solid #1D4ED8', background: '#EFF6FF', color: '#1D4ED8', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>\r\n            Editar\r\n          </button>",
  "    <div style={{ display: 'flex', gap: 8 }}>\r\n            <button onClick={() => setOvOpen(true)} style={{ padding: '7px 16px', borderRadius: 7, border: '1px solid #0F6E56', background: '#E1F5EE', color: '#0F6E56', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>\r\n              + Orden de Visita\r\n            </button>\r\n            <button onClick={() => setEditando(true)} style={{ padding: '7px 16px', borderRadius: 7, border: '1px solid #1D4ED8', background: '#EFF6FF', color: '#1D4ED8', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>\r\n              Editar\r\n            </button>\r\n          </div>"
);

// 4. Añadir modal al final antes del cierre del modal de edición
c = c.replace(
  "      {editando && form && (",
  "      {ovOpen && contacto && (\r\n        <OrdenVisitaModal\r\n          contacto={contacto}\r\n          onClose={() => setOvOpen(false)}\r\n          onCreated={() => {\r\n            setOvOpen(false)\r\n            // Recargar historial\r\n            supabase.from('contactos_historial').select('*').eq('contacto_id', id).order('fecha', { ascending: false }).then(({ data }) => setHistorial(data || []))\r\n          }}\r\n        />\r\n      )}\r\n\r\n      {editando && form && ("
);

fs.writeFileSync(file, c, 'utf8');
console.log('import:', c.includes('OrdenVisitaModal'));
console.log('estado:', c.includes('ovOpen'));
console.log('boton:', c.includes('Orden de Visita'));
console.log('modal:', c.includes('ovOpen && contacto'));