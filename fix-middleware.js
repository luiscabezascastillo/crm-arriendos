const fs = require('fs');
const file = 'middleware.js';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(
  "  '/info':         ['admin', 'operaciones', 'finanzas', 'legal'],",
  "  '/info':         ['admin', 'operaciones', 'finanzas', 'legal'],\n  '/contactos':    ['admin', 'operaciones', 'finanzas', 'legal', 'comercial'],"
);

c = c.replace(
  "'/panel/:path*', '/admin/:path*', '/cc1/:path*', '/publicaciones/:path*', '/op/:path*', '/info/:path*'",
  "'/panel/:path*', '/admin/:path*', '/cc1/:path*', '/publicaciones/:path*', '/op/:path*', '/info/:path*', '/contactos/:path*'"
);

fs.writeFileSync(file, c, 'utf8');
console.log('done:', c.includes('/contactos'));