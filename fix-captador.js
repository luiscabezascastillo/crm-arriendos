const fs = require('fs');
const file = 'app/publicaciones/[id]/page.js';
let c = fs.readFileSync(file, 'utf8');

// 1. Añadir captador al estado inicial del form
c = c.replace(
  "ggcc: data.ggcc || '', vendedor: data.vendedor || '',",
  "ggcc: data.ggcc || '', vendedor: data.vendedor || '', captador: data.captador || '',"
);

// 2. Añadir captador al guardar
c = c.replace(
  "ggcc: form.ggcc ? Number(form.ggcc) : null, vendedor: form.vendedor,",
  "ggcc: form.ggcc ? Number(form.ggcc) : null, vendedor: form.vendedor, captador: form.captador,"
);

// 3. Añadir captador en resumen
c = c.replace(
  "['IDADMON',pub.idadmon||'\u2014']",
  "['Captador',pub.captador||'\u2014'],['IDADMON',pub.idadmon||'\u2014']"
);

// 4. Añadir captador en formulario editar
c = c.replace(
  "[['Tipo', 'tipo', TIPOS], ['Captador', 'vendedor', EJECUTIVOS]]",
  "[['Tipo', 'tipo', TIPOS], ['Vendedor', 'vendedor', EJECUTIVOS], ['Captador', 'captador', EJECUTIVOS]]"
);

// 5. Añadir captador en botón Descartar cambios
c = c.replace(
  "vendedor:pub.vendedor||'', observaciones:pub.observaciones||''",
  "vendedor:pub.vendedor||'', captador:pub.captador||'', observaciones:pub.observaciones||''"
);

fs.writeFileSync(file, c, 'utf8');
console.log('done');